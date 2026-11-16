// TW09-03: identidad estable, resolución sin adivinar, resumen, importación segura y aislamiento entre proyectos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Sandbox, sha256File } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { Project } from '../src/project/store.js';
import { asegurarId, resolverProyecto, resumenProyecto, importarArchivos } from '../src/project/gestion.js';
import { Anteproyectos } from '../src/design/servicio.js';
import { Modelos3d } from '../src/arq3d/servicio.js';
import { tmpHome, startClient, call, data } from './helpers.js';

const mk = () => { const home = tmpHome("Tannia ñ gest '"); const sb = new Sandbox(home); const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'externo ñ ')); return { home, sb, ext, done: () => { fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(ext, { recursive: true, force: true }); } }; };
const archivo = (dir, nombre, contenido) => { const f = path.join(dir, nombre); fs.writeFileSync(f, contenido); return f; };

test('identidad: id UUID estable al crear; proyectos anteriores se migran sin cambiar rutas ni archivos; nombres equivalentes no crean carpetas parecidas', () => {
  const e = mk();
  try {
    createProject(e.sb, 'Casa Los Robles'); const id = new Project(e.sb, 'Casa Los Robles').meta().id; assert.match(id, /^[0-9a-f-]{36}$/); assert.equal(asegurarId(e.sb, 'Casa Los Robles'), id, 'estable');
    for (const parecido of ['casa los robles', 'CASA LOS ROBLES', 'Casa  Los   Róbles']) assert.throws(() => createProject(e.sb, parecido), (x) => ['PROYECTO_PARECIDO', 'PROYECTO_EXISTE'].includes(x.code));
    assert.throws(() => createProject(e.sb, 'Casa Los Robles'), (x) => x.code === 'PROYECTO_EXISTE');
    // proyecto "antiguo" sin id: se migra conservando una copia del project.json anterior; el resto queda igual
    createProject(e.sb, 'Antiguo'); const pr = new Project(e.sb, 'Antiguo'); const m = pr.meta(); delete m.id; fs.writeFileSync(pr.p('.tannia', 'project.json'), JSON.stringify(m)); fs.writeFileSync(pr.p('02 Originales', 'o.dwg'), 'ORIGINAL'); const antes = sha256File(pr.p('02 Originales', 'o.dwg'));
    const nuevo = asegurarId(e.sb, 'Antiguo'); assert.match(nuevo, /^[0-9a-f-]{36}$/); assert.equal(asegurarId(e.sb, 'Antiguo'), nuevo);
    assert.ok(fs.existsSync(pr.p('.tannia', 'project.pre-id.json')), 'copia del metadato previo'); assert.equal(JSON.parse(fs.readFileSync(pr.p('.tannia', 'project.pre-id.json'), 'utf8')).id, undefined);
    assert.equal(sha256File(pr.p('02 Originales', 'o.dwg')), antes); assert.equal(pr.meta().nombre, 'Antiguo');
    assert.throws(() => asegurarId(e.sb, 'NoExiste'), (x) => x.code === 'PROYECTO_NO_EXISTE' || x.code);
  } finally { e.done(); }
});

test('resolver: único, probable, ambiguo y ninguno; nunca elige entre varios y no escribe nada', () => {
  const e = mk();
  try {
    for (const n of ['Casa Los Robles', 'Casa Los Álamos', 'Galpón Norte']) createProject(e.sb, n);
    assert.equal(resolverProyecto(e.sb, 'casa los robles').estado, 'unico'); assert.equal(resolverProyecto(e.sb, 'GALPON NORTE').estado, 'unico', 'sin distinguir tildes');
    const amb = resolverProyecto(e.sb, 'la casa los'); assert.equal(amb.estado, 'ambiguo'); assert.equal(amb.candidatos.length, 2);
    const prob = resolverProyecto(e.sb, 'el galpón'); assert.equal(prob.estado, 'probable'); assert.equal(prob.candidatos[0].nombre, 'Galpón Norte');
    const nada = resolverProyecto(e.sb, 'edificio central'); assert.equal(nada.estado, 'ninguno'); assert.deepEqual(nada.existentes.sort(), ['Casa Los Robles', 'Casa Los Álamos', 'Galpón Norte'].sort());
    assert.equal(resolverProyecto(e.sb, '').estado, 'ninguno');
  } finally { e.done(); }
});

test('importar: copia real con hash, manifiesto, sin sobrescribir, duplicados por SHA, rechazos claros y originales protegidos', () => {
  const e = mk();
  try {
    createProject(e.sb, 'Obra'); const pr = new Project(e.sb, 'Obra');
    const pdf = archivo(e.ext, 'Certificado informes ñ.pdf', '%PDF-1.4 contenido'); const dwg = archivo(e.ext, 'Plano base.dwg', 'AC1032xxxxxx'); const dup = archivo(e.ext, 'copia.pdf', '%PDF-1.4 contenido');
    const r = importarArchivos(e.sb, 'Obra', { archivos: [pdf, dwg, dup], nota: 'Entregado por la mandante el 10-11' });
    assert.deepEqual(r.resumen, { importados: 2, duplicados: 1, rechazados: 0 }); const imp = r.resultados.find((x) => x.estado === 'importado' && /pdf/.test(x.destino));
    assert.equal(sha256File(pr.p(...imp.destino.split('/'))), sha256File(pdf)); assert.ok(imp.destino.startsWith('01 Antecedentes/')); assert.equal(imp.formato.firma_coincide, true);
    const man = JSON.parse(fs.readFileSync(pr.p('.tannia', 'antecedentes.json'), 'utf8')).importaciones; assert.equal(man.length, 2); assert.equal(man[0].autoridad, 'sin verificar (dato aportado por la usuaria)'); assert.ok(!JSON.stringify(man).includes(e.ext), 'el manifiesto no guarda rutas del computador');
    // mismo nombre con otro contenido: no sobrescribe
    const otro = archivo(fs.mkdtempSync(path.join(e.ext, 'x')), 'Plano base.dwg', 'AC1032 OTRO'); const r2 = importarArchivos(e.sb, 'Obra', { archivos: [otro] }); assert.match(r2.resultados[0].destino, /Plano base \(2\)\.dwg$/); assert.equal(fs.readFileSync(pr.p('01 Antecedentes', 'Plano base.dwg'), 'latin1'), 'AC1032xxxxxx');
    // rechazos: no absoluta, inexistente, formato, enlace, dentro de proyectos, demasiado grande no se prueba (límite documentado)
    const enlace = path.join(e.ext, 'enlace.pdf'); try { fs.symlinkSync(pdf, enlace); } catch { /* sin permisos */ }
    const adentro = pr.p('01 Antecedentes', 'Plano base.dwg');
    const rr = importarArchivos(e.sb, 'Obra', { archivos: ['plano.pdf', path.join(e.ext, 'no existe.pdf'), archivo(e.ext, 'virus.exe', 'MZ'), adentro, ...(fs.existsSync(enlace) ? [enlace] : [])] });
    assert.deepEqual(rr.resultados.map((x) => x.codigo), ['RUTA_NO_ABSOLUTA', 'ARCHIVO_NO_ENCONTRADO', 'FORMATO_NO_PERMITIDO', 'ORIGEN_EN_PROYECTOS', ...(fs.existsSync(enlace) ? ['ENLACE_NO_PERMITIDO'] : [])]);
    assert.match(rr.resultados[0].pista, /adjuntos del chat/); assert.equal(rr.resumen.importados, 0);
    // modo original: queda registrado y protegido
    const orig = archivo(e.ext, 'Original cliente.dwg', 'AC1027 original'); const ro = importarArchivos(e.sb, 'Obra', { archivos: [orig], modo: 'original' });
    assert.equal(ro.resumen.importados, 1); assert.deepEqual(ro.originales_registrados.nuevos, ['02 Originales/Original cliente.dwg']); assert.equal(pr.verifyOriginals().estado, 'integros'); assert.equal(pr.verifyOriginals().proteccion_validada, true);
    assert.throws(() => importarArchivos(e.sb, 'Obra', { archivos: [] }), (x) => x.code === 'DATO_INVALIDO'); assert.throws(() => importarArchivos(e.sb, 'Obra', { archivos: [pdf], modo: 'raro' }), (x) => x.code === 'DATO_INVALIDO');
    assert.equal(fs.readFileSync(pdf, 'utf8'), '%PDF-1.4 contenido', 'el archivo de origen no se modifica');
  } finally { e.done(); }
});

test('originales: 0 registrados NO es una prueba positiva de protección; con originales sí, y un cambio se detecta', () => {
  const e = mk();
  try {
    createProject(e.sb, 'O'); const pr = new Project(e.sb, 'O'); let v = pr.verifyOriginals(); assert.equal(v.estado, 'sin_originales_que_verificar'); assert.equal(v.proteccion_validada, false); assert.equal(v.ok, true);
    fs.writeFileSync(pr.p('02 Originales', 'a.dwg'), 'AC1032 a'); pr.registerOriginals(); v = pr.verifyOriginals(); assert.equal(v.estado, 'integros'); assert.equal(v.proteccion_validada, true);
    fs.chmodSync(pr.p('02 Originales', 'a.dwg'), 0o644); fs.writeFileSync(pr.p('02 Originales', 'a.dwg'), 'AC1032 CAMBIADO'); v = pr.verifyOriginals(); assert.equal(v.estado, 'comprometidos'); assert.equal(v.proteccion_validada, false); assert.equal(v.ok, false);
  } finally { e.done(); }
});

test('aislamiento: tres proyectos con anteproyecto, 3D, importaciones e historial independientes; el resumen no cruza referencias', () => {
  const e = mk();
  try {
    const A = new Anteproyectos(e.sb); const M = new Modelos3d(e.sb, A); const nombres = ['Proyecto Uno', 'Proyecto Dos', 'Proyecto Tres']; const ids = new Set();
    for (const [i, n] of nombres.entries()) { createProject(e.sb, n); A.crear(n, { nombre: 'Casa', programa: { dormitorios: 2 + (i % 2), superficie_m2: 60 + i * 15 } }); M.crear(n, { nombre: 'Modelo', desde_anteproyecto: { nombre: 'Casa' } }); importarArchivos(e.sb, n, { archivos: [archivo(e.ext, `doc ${i}.pdf`, `%PDF doc ${i}`)] }); ids.add(asegurarId(e.sb, n)); }
    assert.equal(ids.size, 3);
    const res = nombres.map((n) => resumenProyecto(e.sb, n, { anteproyectos: { listar: (p) => A.listar(p) }, modelos3d: { listar: (p) => M.listar(p) } }));
    for (const [i, r] of res.entries()) { assert.equal(r.nombre, nombres[i]); assert.equal(r.anteproyectos.length, 1); assert.equal(r.modelos_3d.length, 1); assert.equal(r.antecedentes.importados, 1); assert.ok(r.ruta_local.includes(nombres[i])); assert.ok(!JSON.stringify(r).includes(nombres[(i + 1) % 3]), 'sin referencias cruzadas'); }
    assert.match(res[0].pendientes.join(' '), /protección de originales aún no se ha ejercido/); assert.match(res[0].pendientes.join(' '), /DWG/);
    // modificar uno no toca a los otros
    const h2 = fs.readFileSync(path.join(e.home, 'Proyectos', 'Proyecto Dos', '03 Trabajo', 'Anteproyectos', 'Casa', 'historial.json'), 'utf8'); A.modificar('Proyecto Uno', 'Casa', { operaciones: [{ operacion: 'espesores', ext_mm: 220, int_mm: 120 }] });
    assert.equal(fs.readFileSync(path.join(e.home, 'Proyectos', 'Proyecto Dos', '03 Trabajo', 'Anteproyectos', 'Casa', 'historial.json'), 'utf8'), h2);
  } finally { e.done(); }
});

test('MCP: resolver, resumen e importar por herramientas (flujo "Casa Los Robles con antecedentes")', async () => {
  const e = mk(); const cli = await startClient(e.home); const c = cli.client;
  try {
    const t = (await c.listTools()).tools.map((x) => x.name); for (const n of ['tannia_proyecto_resolver', 'tannia_proyecto_resumen', 'tannia_proyecto_importar']) assert.ok(t.includes(n), n);
    await call(c, 'tannia_proyecto_crear', { nombre: 'Casa Los Robles' }); await call(c, 'tannia_proyecto_crear', { nombre: 'Casa Los Pinos' });
    assert.equal(data(await call(c, 'tannia_proyecto_resolver', { texto: 'casa los robles' })).estado, 'unico'); assert.equal(data(await call(c, 'tannia_proyecto_resolver', { texto: 'la casa los' })).estado, 'ambiguo');
    const pdf = archivo(e.ext, 'antecedentes ñ.pdf', '%PDF-1.7 x'); let r = await call(c, 'tannia_proyecto_importar', { proyecto: 'Casa Los Robles', archivos: [pdf, 'adjunto-del-chat.pdf'], nota: 'plano del terreno' }); assert.ok(!r.isError); assert.deepEqual(data(r).resumen, { importados: 1, duplicados: 0, rechazados: 1 });
    r = await call(c, 'tannia_proyecto_resumen', { proyecto: 'Casa Los Robles' }); assert.equal(data(r).antecedentes.importados, 1); assert.match(data(r).id, /^[0-9a-f-]{36}$/);
    r = await call(c, 'tannia_originales_verificar', { proyecto: 'Casa Los Robles' }); assert.match(r.content[0].text, /NO prueba que la protección/);
    r = await call(c, 'tannia_proyecto_crear', { nombre: 'CASA LOS ROBLES' }); assert.equal(r.isError, true);
  } finally { await cli.close(); e.done(); }
});
