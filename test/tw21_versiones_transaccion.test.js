// TW09-04: versiones transaccionales. Se inyecta un corte en CADA paso de la escritura (2D y 3D) y se comprueba que no queda una
// versión a medias, que la siguiente operación reconcilia sin borrar nada y que el historial sigue siendo válido.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { Anteproyectos } from '../src/design/servicio.js';
import { Modelos3d } from '../src/arq3d/servicio.js';
import { commitVersion, reconciliar, verificarManifiesto } from '../src/project/transaccion.js';
import { escribirSinSobrescribir } from '../src/tools/index.js';
import { tmpHome } from './helpers.js';

const mk = () => { const home = tmpHome("Tannia ñ trans '"); const sb = new Sandbox(home); createProject(sb, 'P'); return { home, sb, root: path.join(home, 'Proyectos', 'P'), done: () => fs.rmSync(home, { recursive: true, force: true }) }; };
const cortar = (paso) => (p) => { if (p === paso) { const e = new Error(`corte simulado en ${paso}`); e.code = 'INYECCION'; throw e; } };
const hashDir = (dir) => Object.fromEntries(fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex')]));

test('2D: un corte en cualquier paso no deja versión falsa; la siguiente operación reconcilia y las versiones históricas no cambian', () => {
  const e = mk();
  try {
    const A = new Anteproyectos(e.sb); A.crear('P', { nombre: 'C', programa: {} }); const dir = path.join(e.root, '03 Trabajo', 'Anteproyectos', 'C'); const v1 = hashDir(dir);
    const pasos = ['antes_de_journal', 'staging:v002.dxf', 'staging:v002.svg', 'staging:v002.json', 'staging_completo', 'movido:v002.dxf', 'movido:v002.json', 'movido:v002.manifest.json', 'archivos_en_destino'];
    for (const paso of pasos) {
      A.hook = cortar(paso);
      assert.throws(() => A.modificar('P', 'C', { operaciones: [{ operacion: 'espesores', ext_mm: 220, int_mm: 120 }] }), (x) => x.code === 'INYECCION', paso);
      A.hook = null;
      const h = JSON.parse(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8')); assert.equal(h.head, 'v001', `${paso}: el historial no avanzó`); assert.equal(h.versiones.length, 1);
      const rec = A.reconciliar('P', 'C'); // también ocurre solo al abrir; aquí se invoca explícito para observar el resultado
      const hayRestos = fs.readdirSync(dir).some((f) => f.startsWith('v002') || f.startsWith('.staging') || f === '.journal.json');
      assert.equal(hayRestos, false, `${paso}: sin restos de v002 en la carpeta de versiones`);
      if (rec) assert.ok(['archivos_huerfanos_apartados', 'journal_residual_eliminado', 'staging_residual_eliminado'].includes(rec.accion));
      const sinCambio = hashDir(dir); for (const [f, hh] of Object.entries(v1)) assert.equal(sinCambio[f], hh, `${paso}: ${f} de v001 intacto`);
    }
    // tras tantos cortes, un cambio normal funciona y crea v002 con manifiesto íntegro
    const ok = A.modificar('P', 'C', { operaciones: [{ operacion: 'espesores', ext_mm: 220, int_mm: 120 }] }); assert.equal(ok.version, 'v002'); assert.equal(verificarManifiesto(dir, 'v002').estado, 'integra'); assert.equal(verificarManifiesto(dir, 'v002').archivos, 3);
    assert.ok(fs.existsSync(path.join(dir, '.huerfanos')), 'los archivos huérfanos se apartan, no se borran');
  } finally { e.done(); }
});

test('2D: corte justo tras actualizar el historial (commit lógico hecho) conserva la versión y limpia el journal', () => {
  const e = mk();
  try {
    const A = new Anteproyectos(e.sb); A.crear('P', { nombre: 'C', programa: {} }); const dir = path.join(e.root, '03 Trabajo', 'Anteproyectos', 'C');
    A.hook = cortar('historial_actualizado'); assert.throws(() => A.modificar('P', 'C', { operaciones: [{ operacion: 'espesores', ext_mm: 220, int_mm: 120 }] }), (x) => x.code === 'INYECCION'); A.hook = null;
    const h = JSON.parse(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8')); assert.equal(h.head, 'v002'); A.reconciliar('P', 'C');
    assert.ok(fs.existsSync(path.join(dir, 'v002.dxf')) && !fs.existsSync(path.join(dir, '.journal.json')) && verificarManifiesto(dir, 'v002').estado === 'integra');
  } finally { e.done(); }
});

test('3D: mismos cortes en cada paso; el modelo anterior sigue siendo el vigente y nada se pierde', () => {
  const e = mk();
  try {
    const A = new Anteproyectos(e.sb); const M = new Modelos3d(e.sb, A); A.crear('P', { nombre: 'C', programa: {} }); M.crear('P', { nombre: 'M', desde_anteproyecto: { nombre: 'C' } }); const dir = path.join(e.root, '03 Trabajo', 'Modelos3D', 'M'); const v1 = hashDir(dir);
    for (const paso of ['antes_de_journal', 'staging:v002.json', 'staging_completo', 'movido:v002.json', 'archivos_en_destino']) {
      M.hook = cortar(paso); assert.throws(() => M.modificar('P', 'M', { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 2700 } }] }), (x) => x.code === 'INYECCION', paso); M.hook = null;
      const c = M.cargar('P', 'M'); assert.equal(c.id, 'v001', `${paso}: el modelo vigente sigue siendo v001`); assert.equal(c.h.versiones.length, 1);
      assert.equal(fs.readdirSync(dir).some((f) => f.startsWith('v002') || f.startsWith('.staging') || f === '.journal.json'), false, paso);
      const s = hashDir(dir); for (const [f, hh] of Object.entries(v1)) assert.equal(s[f], hh);
    }
    assert.equal(M.modificar('P', 'M', { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 2700 } }] }).version, 'v002'); assert.equal(verificarManifiesto(dir, 'v002').estado, 'integra');
  } finally { e.done(); }
});

test('manifiesto detecta alteración posterior; versiones inmutables (no se sobrescribe); dos solicitudes simultáneas no pisan archivos', () => {
  const e = mk();
  try {
    const dir = path.join(e.root, '03 Trabajo', 'T'); let hist = [];
    commitVersion({ dir, id: 'v001', archivos: [{ nombre: 'v001.txt', contenido: 'uno' }], actualizarHistorial: () => hist.push('v001') });
    assert.equal(verificarManifiesto(dir, 'v001').estado, 'integra'); fs.writeFileSync(path.join(dir, 'v001.txt'), 'ALTERADO'); const alt = verificarManifiesto(dir, 'v001'); assert.equal(alt.estado, 'alterada'); assert.deepEqual(alt.problemas, [{ archivo: 'v001.txt', problema: 'modificado' }]);
    fs.rmSync(path.join(dir, 'v001.txt')); assert.equal(verificarManifiesto(dir, 'v001').problemas[0].problema, 'faltante');
    fs.writeFileSync(path.join(dir, 'v001.txt'), 'uno');
    assert.throws(() => commitVersion({ dir, id: 'v001', archivos: [{ nombre: 'v001.txt', contenido: 'otro' }], actualizarHistorial: () => {} }), (x) => x.code === 'VERSION_EXISTE'); assert.equal(fs.readFileSync(path.join(dir, 'v001.txt'), 'utf8'), 'uno');
    // un journal ajeno (otra operación en curso) impide pisar: el segundo intento falla en vez de mezclar archivos
    fs.writeFileSync(path.join(dir, '.journal.json'), JSON.stringify({ id: 'v002' })); assert.throws(() => commitVersion({ dir, id: 'v003', archivos: [{ nombre: 'v003.txt', contenido: 'x' }], actualizarHistorial: () => {} }), (x) => x.code === 'VERSION_PENDIENTE_RECONCILIAR');
    assert.equal(reconciliar(dir, ['v001']).accion, 'archivos_huerfanos_apartados'); assert.equal(fs.existsSync(path.join(dir, '.journal.json')), false);
  } finally { e.done(); }
});

test('exportaciones: jamás reemplazan un archivo existente (idéntico se reutiliza; distinto recibe otro nombre)', () => {
  const e = mk();
  try {
    const d = path.join(e.root, '07 Entregables'); const f = path.join(d, 'Presupuesto.xlsx');
    assert.equal(escribirSinSobrescribir(f, Buffer.from('v1')), f); assert.equal(escribirSinSobrescribir(f, Buffer.from('v1')), f, 'idéntico: reutiliza');
    const f2 = escribirSinSobrescribir(f, Buffer.from('v2')); assert.match(f2, /Presupuesto \(2\)\.xlsx$/); const f3 = escribirSinSobrescribir(f, Buffer.from('v3')); assert.match(f3, /Presupuesto \(3\)\.xlsx$/);
    assert.equal(fs.readFileSync(f, 'utf8'), 'v1'); assert.equal(fs.readFileSync(f2, 'utf8'), 'v2');
  } finally { e.done(); }
});
