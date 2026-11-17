// Auditoría PR #11 — H4: NINGUNA escritura (migración de id, respaldo, manifiestos, auditoría, JSON de proyecto) puede salir del
// proyecto, ni siquiera en un proyecto heredado sin UUID cuya carpeta `.tannia` fue reemplazada por un symlink/junction, ni cuando
// el directorio se sustituye DURANTE la operación. La validación canónica precede a toda escritura.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { Project, atomicWriteJson } from '../src/project/store.js';
import { asegurarId, importarArchivos, resumenProyecto } from '../src/project/gestion.js';
import { tmpHome } from './helpers.js';

const mk = () => {
  const home = tmpHome("Tannia ñ h4 '"); const sb = new Sandbox(home); createProject(sb, 'Heredado'); const pr = new Project(sb, 'Heredado');
  const m = pr.meta(); delete m.id; fs.writeFileSync(pr.p('.tannia', 'project.json'), JSON.stringify(m, null, 2)); // proyecto heredado SIN uuid
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'h4 ext ñ ')); const fuera = fs.mkdtempSync(path.join(os.tmpdir(), 'FUERA h4 '));
  return { home, sb, pr, ext, fuera, done: () => { for (const d of [home, ext, fuera]) fs.rmSync(d, { recursive: true, force: true }); } };
};
/** Reemplaza `.tannia` por un enlace hacia `fuera` (que conserva una copia del project.json, para que la lectura "funcione"). */
function sustituirTannia(e) {
  const real = e.pr.p('.tannia'); for (const f of fs.readdirSync(real)) fs.copyFileSync(path.join(real, f), path.join(e.fuera, f));
  fs.rmSync(real, { recursive: true, force: true }); try { fs.symlinkSync(e.fuera, real, process.platform === 'win32' ? 'junction' : 'dir'); return true; } catch { return false; }
}
const foto = (d) => JSON.stringify(fs.readdirSync(d).sort().map((f) => [f, fs.statSync(path.join(d, f)).size, fs.statSync(path.join(d, f)).mtimeMs]));
const pdf = (e, n = 'a.pdf') => { const f = path.join(e.ext, n); fs.writeFileSync(f, `%PDF-1.4 ${n}`); return f; };

test('proyecto heredado sin UUID con `.tannia` reemplazada por un enlace: la migración de id y su respaldo NO escriben fuera', () => {
  const e = mk();
  try {
    if (!sustituirTannia(e)) { e.done(); return; }
    const antes = foto(e.fuera);
    assert.throws(() => asegurarId(e.sb, 'Heredado'), (x) => ['DESTINO_ENLAZADO', 'DESTINO_NO_CANONICO'].includes(x.code));
    assert.equal(foto(e.fuera), antes, 'ni project.pre-id.json, ni .bak, ni .tmp, ni el id en el project.json de fuera');
    assert.equal(JSON.parse(fs.readFileSync(path.join(e.fuera, 'project.json'), 'utf8')).id, undefined);
  } finally { e.done(); }
});

test('importar y resumir con `.tannia` enlazada: se rechaza ANTES de cualquier escritura (id, manifiesto de antecedentes, auditoría)', () => {
  const e = mk();
  try {
    if (!sustituirTannia(e)) { e.done(); return; }
    const antes = foto(e.fuera);
    const imp = (() => { try { return importarArchivos(e.sb, 'Heredado', { archivos: [pdf(e)] }); } catch (x) { return { error: x.code }; } })();
    assert.ok(imp.error || imp.resumen.importados === 0, 'no se importa');
    assert.equal(foto(e.fuera), antes, 'importarArchivos no escribió nada fuera (manifiesto, auditoría, id)');
    assert.throws(() => resumenProyecto(e.sb, 'Heredado', { anteproyectos: { listar: () => [] }, modelos3d: { listar: () => [] } }), (x) => ['DESTINO_ENLAZADO', 'DESTINO_NO_CANONICO'].includes(x.code));
    assert.equal(foto(e.fuera), antes);
    assert.equal(fs.readdirSync(e.pr.p('01 Antecedentes')).length, 0, 'nada se copió dentro tampoco');
    // los guardados y la auditoría del propio proyecto también se niegan
    assert.throws(() => e.pr.audit('prueba', {}), (x) => ['DESTINO_ENLAZADO', 'DESTINO_NO_CANONICO'].includes(x.code)); assert.equal(foto(e.fuera), antes);
    assert.throws(() => e.pr.saveMeta({ nombre: 'x' }), (x) => ['DESTINO_ENLAZADO', 'DESTINO_NO_CANONICO'].includes(x.code)); assert.equal(foto(e.fuera), antes);
    assert.throws(() => e.pr.saveManifiesto({ archivos: {}, migrados: [] }), (x) => ['DESTINO_ENLAZADO', 'DESTINO_NO_CANONICO'].includes(x.code)); assert.equal(foto(e.fuera), antes);
  } finally { e.done(); }
});

test('sustitución de `.tannia` DURANTE la migración de id (entre leer y escribir): no se escribe fuera', () => {
  const e = mk();
  try {
    let llamado = false;
    const hook = (paso) => { if (paso === 'antes_de_migrar') { llamado = true; sustituirTannia(e); } };
    const antes = foto(e.fuera);
    try { asegurarId(e.sb, 'Heredado', { hook }); } catch { /* rechazado: correcto */ }
    assert.ok(llamado, 'existe el punto de control previo a la migración'); if (!fs.lstatSync(e.pr.p('.tannia')).isSymbolicLink()) { return; }
    const despues = fs.readdirSync(e.fuera).filter((f) => !['project.json'].includes(f) && !/^(auditoria\.jsonl|originales\.json|calibraciones\.json|esquema\.json)$/.test(f));
    assert.deepEqual(despues, [], `nada nuevo escrito fuera: ${despues.join(', ')}`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(e.fuera, 'project.json'), 'utf8')).id, undefined, 'el project.json de fuera no recibió el id');
    void antes;
  } finally { e.done(); }
});

test('sustitución de `.tannia` DURANTE la importación, antes de la actualización FINAL del manifiesto: no se escribe fuera y se deshace lo copiado', () => {
  const e = mk();
  try {
    const id = asegurarId(e.sb, 'Heredado'); assert.ok(id); // heredado ya migrado: el riesgo es el manifiesto final
    let llamado = false; const hook = (paso) => { if (paso === 'antes_de_manifiesto') { llamado = true; sustituirTannia(e); } };
    const origen = pdf(e, 'b.pdf'); const antes = foto(e.fuera);
    const r = (() => { try { return importarArchivos(e.sb, 'Heredado', { archivos: [origen], hook }); } catch (x) { return { error: x.code }; } })();
    assert.ok(llamado, 'existe el punto de control previo al manifiesto'); if (!fs.lstatSync(e.pr.p('.tannia')).isSymbolicLink()) return;
    assert.ok(r.error, 'la importación falla de forma explícita al no poder registrar'); assert.ok(['DESTINO_ENLAZADO', 'DESTINO_NO_CANONICO', 'DESTINO_CAMBIO_DURANTE_COPIA'].includes(r.error), r.error);
    assert.ok(!fs.existsSync(path.join(e.fuera, 'antecedentes.json')), 'el manifiesto NO se escribió fuera'); assert.equal(fs.existsSync(path.join(e.fuera, 'auditoria.jsonl')) && /antecedentes_importados/.test(fs.readFileSync(path.join(e.fuera, 'auditoria.jsonl'), 'utf8')), false, 'ni la auditoría');
    assert.equal(fs.readdirSync(e.pr.p('01 Antecedentes')).length, 0, 'lo copiado en esta operación se deshizo (no queda un archivo sin registrar)');
    assert.equal(fs.readFileSync(origen, 'utf8'), '%PDF-1.4 b.pdf', 'el origen no se toca'); void antes;
  } finally { e.done(); }
});

test('atomicWriteJson con raíz: rechaza destinos fuera de la raíz o con componentes enlazados, y no deja .tmp/.bak fuera', () => {
  const e = mk();
  try {
    const raiz = e.pr.root; const dentro = path.join(raiz, '.tannia', 'x.json'); atomicWriteJson(dentro, { a: 1 }, { raiz }); atomicWriteJson(dentro, { a: 2 }, { raiz }); assert.equal(JSON.parse(fs.readFileSync(dentro, 'utf8')).a, 2); assert.ok(fs.existsSync(`${dentro}.bak`));
    assert.throws(() => atomicWriteJson(path.join(e.fuera, 'y.json'), { a: 1 }, { raiz }), (x) => ['DESTINO_FUERA_DE_RAIZ', 'DESTINO_NO_CANONICO'].includes(x.code)); assert.deepEqual(fs.readdirSync(e.fuera), []);
    const enlace = path.join(raiz, '03 Trabajo', 'salida'); try { fs.symlinkSync(e.fuera, enlace, process.platform === 'win32' ? 'junction' : 'dir'); } catch { e.done(); return; }
    assert.throws(() => atomicWriteJson(path.join(enlace, 'z.json'), { a: 1 }, { raiz }), (x) => ['DESTINO_ENLAZADO', 'DESTINO_NO_CANONICO'].includes(x.code)); assert.deepEqual(fs.readdirSync(e.fuera), [], 'sin tmp ni bak');
    atomicWriteJson(path.join(raiz, '03 Trabajo', 'sub', 'ok.json'), { a: 1 }, { raiz }); assert.ok(fs.existsSync(path.join(raiz, '03 Trabajo', 'sub', 'ok.json')), 'las escrituras legítimas siguen funcionando (incluida la creación de subcarpetas)');
  } finally { e.done(); }
});

test('flujo legítimo intacto: migración de id, importación, resumen y auditoría funcionan en un proyecto normal', () => {
  const e = mk();
  try {
    const id = asegurarId(e.sb, 'Heredado'); assert.match(id, /^[0-9a-f-]{36}$/); assert.ok(fs.existsSync(e.pr.p('.tannia', 'project.pre-id.json')));
    const r = importarArchivos(e.sb, 'Heredado', { archivos: [pdf(e)] }); assert.equal(r.resumen.importados, 1);
    const s = resumenProyecto(e.sb, 'Heredado', { anteproyectos: { listar: () => [] }, modelos3d: { listar: () => [] } }); assert.equal(s.antecedentes.importados, 1);
    assert.match(fs.readFileSync(e.pr.p('.tannia', 'auditoria.jsonl'), 'utf8'), /antecedentes_importados/);
  } finally { e.done(); }
});
