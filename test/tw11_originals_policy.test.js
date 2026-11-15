// Issue #9: los archivos de bloqueo/temporales de AutoCAD no son originales. La exclusión no debe debilitar la protección.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Sandbox, sha256File } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { Project } from '../src/project/store.js';
import { clasificarOriginal, EXTENSIONES_PROTEGIDAS, RESIDUOS, dibujoDelBloqueo } from '../src/project/originals_policy.js';
import { tmpHome } from './helpers.js';

const setup = () => {
  const home = tmpHome("'Tannia ñ ó "); const sb = new Sandbox(home); createProject(sb, "Obra ñ'");
  const pr = new Project(sb, "Obra ñ'"); const orig = pr.p('02 Originales');
  return { home, pr, orig, done: () => fs.rmSync(home, { recursive: true, force: true }) };
};
const writable = (f) => (fs.statSync(f).mode & 0o222) !== 0;

test('política: ningún residuo puede alcanzar a DWG/DXF/PDF/plantillas (invariante), y los residuos conocidos se excluyen', () => {
  const nombres = ['plano', 'x.dwl', 'x.bak', '~$x', 'a.tmp', 'Thumbs.db', 'x.sv$', 'plano.dwl2', 'a.part'];
  for (const ext of EXTENSIONES_PROTEGIDAS) for (const n of nombres) {
    for (const nombre of [`${n}${ext}`, `${n}${ext.toUpperCase()}`, `~$${n}${ext}`, `${n}.dwl${ext}`]) assert.equal(clasificarOriginal(nombre).incluir, true, `${nombre} debe incluirse`);
  }
  for (const n of ['Dibujo2.dwl', 'Dibujo2.DWL2', 'Dibujo2.bak', 'Dibujo2.sv$', 'Dibujo2.ac$', '~$informe.docx', 'x.tmp', 'x.crdownload', 'Thumbs.db', 'desktop.ini', '.DS_Store']) {
    const c = clasificarOriginal(n); assert.equal(c.incluir, false, n); assert.ok(c.motivo && c.id, `${n} con justificación`);
  }
  for (const n of ['plano.dwg', 'cliente.xlsx', 'informe.docx', 'foto.jpg', 'datos.csv', 'notas.txt']) assert.equal(clasificarOriginal(n).incluir, true, n);
  assert.ok(RESIDUOS.every((r) => r.motivo && r.id), 'cada residuo tiene justificación');
  assert.equal(dibujoDelBloqueo('Plano de ñ.dwl2'), 'plano de ñ'); assert.equal(dibujoDelBloqueo('plano.dwg'), null);
});

test('registrar: solo originales admitidos; locks ignorados, sin hash ni cambio de permisos; verificación sin falsos positivos', () => {
  const e = setup();
  try {
    fs.writeFileSync(path.join(e.orig, 'dibujo_prueba1.dwg'), 'DWG-ORIGINAL'); fs.writeFileSync(path.join(e.orig, 'dibujo_prueba1.dwl'), 'LOCK1'); fs.writeFileSync(path.join(e.orig, 'dibujo_prueba1.dwl2'), 'LOCK2');
    fs.writeFileSync(path.join(e.orig, 'otro.dxf'), 'DXF'); fs.writeFileSync(path.join(e.orig, 'planta.pdf'), 'PDF');
    const r = e.pr.registerOriginals();
    assert.deepEqual(r.nuevos.sort(), ['02 Originales/dibujo_prueba1.dwg', '02 Originales/otro.dxf', '02 Originales/planta.pdf']);
    assert.deepEqual(r.ignorados.map((x) => x.politica).sort(), ['autocad_lock', 'autocad_lock']); assert.ok(r.ignorados.every((x) => x.motivo));
    assert.equal(r.total, 3);
    assert.ok(!e.pr.originales()['02 Originales/dibujo_prueba1.dwl'], 'los locks no son evidencia de integridad');
    assert.ok(writable(path.join(e.orig, 'dibujo_prueba1.dwl')) && writable(path.join(e.orig, 'dibujo_prueba1.dwl2')), 'permisos de los locks intactos (AutoCAD debe poder borrarlos)');
    assert.ok(!writable(path.join(e.orig, 'dibujo_prueba1.dwg')), 'el DWG real queda protegido');
    // ciclo de AutoCAD: lock cambia, desaparece, reaparece => nunca falso positivo
    assert.equal(e.pr.verifyOriginals().ok, true);
    fs.writeFileSync(path.join(e.orig, 'dibujo_prueba1.dwl'), 'OTRO CONTENIDO'); assert.equal(e.pr.verifyOriginals().ok, true);
    fs.unlinkSync(path.join(e.orig, 'dibujo_prueba1.dwl')); fs.unlinkSync(path.join(e.orig, 'dibujo_prueba1.dwl2')); assert.equal(e.pr.verifyOriginals().ok, true);
    fs.writeFileSync(path.join(e.orig, 'dibujo_prueba1.dwl'), 'NUEVO'); const v = e.pr.verifyOriginals();
    assert.equal(v.ok, true); assert.deepEqual(v.posiblemente_abiertos_en_autocad, ['02 Originales/dibujo_prueba1.dwg']);
  } finally { e.done(); }
});

test('la protección real NO se debilita: DWG modificado o faltante se detecta aunque haya locks', () => {
  const e = setup();
  try {
    const f = path.join(e.orig, 'plano.dwg'); fs.writeFileSync(f, 'ORIGINAL'); fs.writeFileSync(path.join(e.orig, 'plano.dwl'), 'L');
    e.pr.registerOriginals();
    fs.chmodSync(f, 0o644); fs.writeFileSync(f, 'ALTERADO');
    let v = e.pr.verifyOriginals(); assert.equal(v.ok, false); assert.deepEqual(v.problemas.map((p) => p.problema), ['modificado']);
    fs.writeFileSync(f, 'ORIGINAL'); assert.equal(e.pr.verifyOriginals().ok, true);
    fs.unlinkSync(f); v = e.pr.verifyOriginals(); assert.deepEqual(v.problemas.map((p) => p.problema), ['faltante']);
    // un DWG con nombre parecido a residuo sigue siendo original
    fs.writeFileSync(path.join(e.orig, 'copia.dwl.dwg'), 'X'); fs.writeFileSync(path.join(e.orig, '~$informe.dwg'), 'Y'); fs.writeFileSync(path.join(e.orig, 'x.tmp.pdf'), 'Z');
    const r = e.pr.registerOriginals(); assert.ok(r.nuevos.includes('02 Originales/copia.dwl.dwg') && r.nuevos.includes('02 Originales/~$informe.dwg') && r.nuevos.includes('02 Originales/x.tmp.pdf'));
  } finally { e.done(); }
});

test('captura inestable: lock presente al registrar => advertencia explícita, marca en el manifiesto y nota en la verificación; no se borran locks', () => {
  const e = setup();
  try {
    const f = path.join(e.orig, 'Plano ó.dwg'); fs.writeFileSync(f, 'V1'); fs.writeFileSync(path.join(e.orig, 'Plano ó.dwl'), 'L'); fs.writeFileSync(path.join(e.orig, 'Plano ó.bak'), 'B');
    const r = e.pr.registerOriginals();
    assert.ok(r.advertencias.some((a) => /CAPTURA INESTABLE/.test(a)) && r.advertencias.some((a) => /\.bak/.test(a)));
    assert.equal(e.pr.originales()['02 Originales/Plano ó.dwg'].captura_inestable, true);
    assert.ok(fs.existsSync(path.join(e.orig, 'Plano ó.dwl')) && fs.existsSync(path.join(e.orig, 'Plano ó.bak')), 'no se eliminan locks ni .bak');
    fs.chmodSync(f, 0o644); fs.writeFileSync(f, 'V2 (guardado desde AutoCAD)');
    const v = e.pr.verifyOriginals(); assert.equal(v.ok, false); assert.match(v.problemas[0].nota, /captura inestable/);
    // copia de trabajo con lock presente: advierte, no toca el lock ni el original
    fs.writeFileSync(f, 'V1'); fs.chmodSync(f, 0o444); const antes = sha256File(f);
    const c = e.pr.copyToWork('02 Originales/Plano ó.dwg'); assert.match(c.advertencia, /CAPTURA INESTABLE/);
    assert.equal(sha256File(f), antes); assert.ok(fs.existsSync(path.join(e.orig, 'Plano ó.dwl')));
    assert.throws(() => e.pr.copyToWork('02 Originales/Plano ó.dwl'), (x) => x.code === 'ARCHIVO_TRANSITORIO');
  } finally { e.done(); }
});

test('migración segura del manifiesto de rc.2 (locks registrados como originales): DWG idéntico, locks apartados con su hash, permisos restaurados', () => {
  const e = setup();
  try {
    const dwg = path.join(e.orig, 'dibujo_prueba1.dwg'); const l1 = path.join(e.orig, 'dibujo_prueba1.dwl'); const l2 = path.join(e.orig, 'dibujo_prueba1.dwl2');
    fs.writeFileSync(dwg, 'REAL'); fs.writeFileSync(l1, 'L1'); fs.writeFileSync(l2, 'L2');
    // manifiesto plano tal como lo dejó rc.2, con los locks en solo lectura
    const flat = {}; for (const f of [dwg, l1, l2]) { flat[`02 Originales/${path.basename(f)}`] = { sha256: sha256File(f), bytes: fs.statSync(f).size, registrado: '2026-11-15T22:00:00.000Z' }; fs.chmodSync(f, 0o444); }
    fs.writeFileSync(e.pr.p('.tannia', 'originales.json'), JSON.stringify(flat));
    const original = JSON.stringify(flat['02 Originales/dibujo_prueba1.dwg']);
    // antes de migrar, el lock desaparece (AutoCAD cerró): con rc.2 esto era un falso "faltante"
    fs.chmodSync(l2, 0o644); fs.unlinkSync(l2);
    assert.equal(e.pr.verifyOriginals().ok, true, 'sin falso positivo ni siquiera antes de persistir la migración');
    const r = e.pr.registerOriginals();
    assert.equal(r.total, 1); assert.deepEqual(r.migrados_de_versiones_anteriores.map((m) => m.archivo).sort(), ['02 Originales/dibujo_prueba1.dwl', '02 Originales/dibujo_prueba1.dwl2']);
    assert.deepEqual(r.permisos_restaurados, ['02 Originales/dibujo_prueba1.dwl'], 'solo el que existe');
    assert.ok(writable(l1), 'el lock vuelve a ser borrable por AutoCAD'); assert.ok(!writable(dwg), 'el DWG sigue protegido');
    const m = JSON.parse(fs.readFileSync(e.pr.p('.tannia', 'originales.json'), 'utf8'));
    assert.equal(m.version, 2); assert.equal(JSON.stringify({ sha256: m.archivos['02 Originales/dibujo_prueba1.dwg'].sha256, bytes: m.archivos['02 Originales/dibujo_prueba1.dwg'].bytes, registrado: m.archivos['02 Originales/dibujo_prueba1.dwg'].registrado }), original, 'entrada del DWG genuino intacta');
    assert.equal(m.migrados.length, 2); assert.ok(m.migrados.every((x) => x.sha256 && x.motivo), 'el hash histórico se conserva como evidencia');
    assert.equal(e.pr.verifyOriginals().ok, true);
    // idempotente
    const r2 = e.pr.registerOriginals(); assert.deepEqual(r2.nuevos, []); assert.deepEqual(r2.permisos_restaurados, []);
  } finally { e.done(); }
});

test('reparar migra el manifiesto antiguo y el original no cambia (hash, tamaño y fecha) tras copiar y registrar', () => {
  const e = setup();
  try {
    const dwg = path.join(e.orig, 'a.dwg'); fs.writeFileSync(dwg, 'DATA'); const lk = path.join(e.orig, 'a.dwl'); fs.writeFileSync(lk, 'L');
    const flat = { '02 Originales/a.dwg': { sha256: sha256File(dwg), bytes: 4, registrado: 'x' }, '02 Originales/a.dwl': { sha256: sha256File(lk), bytes: 1, registrado: 'x' } };
    fs.writeFileSync(e.pr.p('.tannia', 'originales.json'), JSON.stringify(flat)); fs.chmodSync(dwg, 0o444);
    const st0 = fs.statSync(dwg); const h0 = sha256File(dwg);
    const rep = e.pr.repair(); assert.ok(rep.acciones.some((a) => /migrado/.test(a))); assert.ok(rep.originales_ok);
    e.pr.registerOriginals(); e.pr.copyToWork('02 Originales/a.dwg');
    const st1 = fs.statSync(dwg);
    assert.equal(sha256File(dwg), h0); assert.equal(st1.size, st0.size); assert.equal(st1.mtimeMs, st0.mtimeMs, 'metadatos (fecha) intactos');
  } finally { e.done(); }
});
