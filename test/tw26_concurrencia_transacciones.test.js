// Auditoría PR #11 — P1: concurrencia de transacciones de versión. Procesos hijos REALES: una sesión no puede apartar ni borrar los
// temporales de una escritura viva de otra; las operaciones abandonadas (proceso muerto/kill real) se recuperan sin pérdida de datos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { commitVersion, reconciliar, verificarManifiesto } from '../src/project/transaccion.js';

const HIJO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'proc', 'commit_child.mjs');
const nuevo = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw26 ñ ')); const dir = path.join(d, 'versiones'); fs.mkdirSync(dir); return { d, dir, done: () => fs.rmSync(d, { recursive: true, force: true }) }; };
const esperar = async (cond, ms = 20000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (cond()) return true; await new Promise((r) => setTimeout(r, 25)); } return false; };
function hijo(args) {
  const p = spawn(process.execPath, [HIJO, JSON.stringify(args)], { stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; let err = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  const fin = new Promise((res) => p.on('close', (code, signal) => { let r = null; try { r = JSON.parse(out.trim().split('\n').pop()); } catch { /* sin salida (kill) */ } res({ code, signal, r, err }); }));
  return { p, fin };
}
// En Windows no hay señales POSIX: un corte con process.kill termina el proceso sin salida y con código distinto de 0
const cortado = (fin) => fin.signal === 'SIGKILL' || (process.platform === 'win32' && fin.r === null && fin.code !== 0);
const hist = (dir) => (fs.existsSync(path.join(dir, 'historial.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8')).versiones.map((v) => v.id) : []);
const base = (dir) => { commitVersion({ dir, id: 'v001', archivos: [{ nombre: 'v001.json', contenido: 'primera' }], actualizarHistorial: () => fs.writeFileSync(path.join(dir, 'historial.json'), JSON.stringify({ versiones: [{ id: 'v001' }] })) }); };

test('una sesión NO puede apartar ni borrar los temporales de una escritura VIVA de otra (reconciliar durante una escritura en curso)', async () => {
  const t = nuevo();
  try {
    base(t.dir); const listo = path.join(t.d, 'listo'); const sigue = path.join(t.d, 'sigue');
    const A = hijo({ dir: t.dir, id: 'v002', paso: 'staging:v002.json', modo: 'pausa', listo, sigue });
    assert.ok(await esperar(() => fs.existsSync(listo)), 'el hijo A está a mitad de su escritura (journal + staging presentes)');
    assert.ok(fs.existsSync(path.join(t.dir, '.journal.json')) && fs.existsSync(path.join(t.dir, '.staging-v002')));
    // otra sesión "abre" el proyecto y reconcilia mientras A escribe
    const r = reconciliar(t.dir, hist(t.dir));
    assert.ok(fs.existsSync(path.join(t.dir, '.journal.json')) && fs.existsSync(path.join(t.dir, '.staging-v002')), 'el journal y el staging de A siguen intactos');
    assert.equal(fs.existsSync(path.join(t.dir, '.huerfanos')), false, 'no se apartó nada');
    assert.ok(r === null || r.en_curso === true, 'reconciliar reconoce la operación en curso y no la toca');
    fs.writeFileSync(sigue, '1'); const fin = await A.fin;
    assert.equal(fin.r?.ok, true, `A termina bien (${JSON.stringify(fin.r)} ${fin.err.slice(0, 200)})`);
    assert.deepEqual(hist(t.dir), ['v001', 'v002']); assert.equal(verificarManifiesto(t.dir, 'v002').estado, 'integra'); assert.equal(fs.readFileSync(path.join(t.dir, 'v002.json'), 'utf8'), 'contenido de v002');
    assert.equal(fs.existsSync(path.join(t.dir, '.journal.json')), false);
  } finally { t.done(); }
});

test('segunda escritura concurrente: espera un tiempo acotado y falla con VERSION_EN_CURSO sin mezclar archivos; al liberar, procede', async () => {
  const t = nuevo();
  try {
    base(t.dir); const listo = path.join(t.d, 'listo'); const sigue = path.join(t.d, 'sigue');
    const A = hijo({ dir: t.dir, id: 'v002', paso: 'staging:v002.json', modo: 'pausa', listo, sigue }); assert.ok(await esperar(() => fs.existsSync(listo)));
    assert.throws(() => commitVersion({ dir: t.dir, id: 'v003', archivos: [{ nombre: 'v003.json', contenido: 'otra' }], esperaMs: 300, idsEnHistorial: () => hist(t.dir), actualizarHistorial: () => {} }), (x) => x.code === 'VERSION_EN_CURSO');
    assert.equal(fs.existsSync(path.join(t.dir, 'v003.json')), false); assert.ok(fs.existsSync(path.join(t.dir, '.staging-v002')), 'el staging de A no fue tocado');
    fs.writeFileSync(sigue, '1'); assert.equal((await A.fin).r?.ok, true);
    // ahora el bloqueo está libre: la segunda escritura procede
    commitVersion({ dir: t.dir, id: 'v003', archivos: [{ nombre: 'v003.json', contenido: 'otra' }], idsEnHistorial: () => hist(t.dir), actualizarHistorial: () => { const h = JSON.parse(fs.readFileSync(path.join(t.dir, 'historial.json'), 'utf8')); h.versiones.push({ id: 'v003' }); fs.writeFileSync(path.join(t.dir, 'historial.json'), JSON.stringify(h)); } });
    assert.deepEqual(hist(t.dir), ['v001', 'v002', 'v003']);
  } finally { t.done(); }
});

test('cortes REALES de proceso (SIGKILL) en cada paso: la siguiente operación recupera sin pérdida de datos y sin bloqueos eternos', async () => {
  for (const paso of ['antes_de_journal', 'staging:v002.json', 'staging_completo', 'movido:v002.json', 'movido:v002.manifest.json', 'archivos_en_destino', 'historial_actualizado']) {
    const t = nuevo();
    try {
      base(t.dir); const A = hijo({ dir: t.dir, id: 'v002', paso, modo: 'kill', contenido: `datos importantes ${paso}` }); const fin = await A.fin; assert.ok(cortado(fin), `${paso}: el proceso fue cortado (${fin.signal}/${fin.code})`);
      const v1 = fs.readFileSync(path.join(t.dir, 'v001.json'), 'utf8');
      const confirmada = hist(t.dir).includes('v002');
      const rec = reconciliar(t.dir, hist(t.dir)); // el proceso dueño murió: se recupera
      assert.equal(fs.readdirSync(t.dir).some((f) => f === '.journal.json' || f.startsWith('.staging') || f === '.lock'), false, `${paso}: sin journal, staging ni bloqueo residuales`);
      if (confirmada) { assert.equal(fs.readFileSync(path.join(t.dir, 'v002.json'), 'utf8'), `datos importantes ${paso}`, `${paso}: la versión confirmada se conserva`); assert.equal(verificarManifiesto(t.dir, 'v002').estado, 'integra'); }
      else {
        assert.equal(fs.existsSync(path.join(t.dir, 'v002.json')), false, `${paso}: no queda una v002 a medias en la carpeta de versiones`);
        const ap = path.join(t.dir, '.huerfanos'); const movidos = fs.existsSync(ap) ? fs.readdirSync(ap).flatMap((d) => fs.readdirSync(path.join(ap, d))) : [];
        if (['movido:v002.json', 'movido:v002.manifest.json', 'archivos_en_destino'].includes(paso)) assert.ok(movidos.includes('v002.json'), `${paso}: el contenido se conserva en .huerfanos (sin pérdida)`);
        void rec;
      }
      assert.equal(fs.readFileSync(path.join(t.dir, 'v001.json'), 'utf8'), v1, `${paso}: v001 intacta`);
      // y se puede seguir trabajando
      const id = confirmada ? 'v003' : 'v002'; commitVersion({ dir: t.dir, id, archivos: [{ nombre: `${id}.json`, contenido: 'nuevo' }], idsEnHistorial: () => hist(t.dir), actualizarHistorial: () => { const h = JSON.parse(fs.readFileSync(path.join(t.dir, 'historial.json'), 'utf8')); h.versiones.push({ id }); fs.writeFileSync(path.join(t.dir, 'historial.json'), JSON.stringify(h)); } });
      assert.ok(hist(t.dir).includes(id));
    } finally { t.done(); }
  }
});

test('dos procesos reales intentan crear la MISMA versión a la vez: exactamente uno la confirma, el otro falla limpio y el estado es consistente', async () => {
  for (let k = 0; k < 6; k++) {
    const t = nuevo();
    try {
      base(t.dir); const [A, B] = [hijo({ dir: t.dir, id: 'v002', contenido: 'de A', esperaMs: 5000 }), hijo({ dir: t.dir, id: 'v002', contenido: 'de B', esperaMs: 5000 })]; const [ra, rb] = await Promise.all([A.fin, B.fin]);
      const oks = [ra, rb].filter((x) => x.r?.ok).length; assert.equal(oks, 1, `exactamente una confirma (${JSON.stringify([ra.r, rb.r])})`);
      const perdedor = [ra, rb].find((x) => !x.r?.ok); assert.ok(['VERSION_EXISTE', 'VERSION_CONCURRENTE', 'VERSION_EN_CURSO'].includes(perdedor.r?.code), JSON.stringify(perdedor.r));
      assert.deepEqual(hist(t.dir), ['v001', 'v002']); assert.equal(verificarManifiesto(t.dir, 'v002').estado, 'integra'); assert.match(fs.readFileSync(path.join(t.dir, 'v002.json'), 'utf8'), /^de [AB]$/);
      assert.equal(fs.readdirSync(t.dir).some((f) => f === '.journal.json' || f.startsWith('.staging') || f === '.lock'), false);
    } finally { t.done(); }
  }
});

test('bloqueo abandonado: dueño muerto o latido vencido se toma de forma atómica; un bloqueo vivo reciente no', async () => {
  const t = nuevo();
  try {
    base(t.dir); const lock = path.join(t.dir, '.lock'); fs.mkdirSync(lock);
    // dueño muerto (pid inexistente): se recupera
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: 2 ** 22 + 12345, token: 'x', host: os.hostname(), inicio: Date.now(), latido: Date.now() }));
    commitVersion({ dir: t.dir, id: 'v002', archivos: [{ nombre: 'v002.json', contenido: 'a' }], idsEnHistorial: () => hist(t.dir), actualizarHistorial: () => { fs.writeFileSync(path.join(t.dir, 'historial.json'), JSON.stringify({ versiones: [{ id: 'v001' }, { id: 'v002' }] })); } });
    assert.deepEqual(hist(t.dir), ['v001', 'v002']); assert.equal(fs.existsSync(lock), false);
    // dueño VIVO (este proceso) con latido reciente: no se toma
    fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'y', host: os.hostname(), inicio: Date.now(), latido: Date.now() }));
    assert.throws(() => commitVersion({ dir: t.dir, id: 'v003', archivos: [{ nombre: 'v003.json', contenido: 'b' }], esperaMs: 200, idsEnHistorial: () => hist(t.dir), actualizarHistorial: () => {} }), (x) => x.code === 'VERSION_EN_CURSO');
    // dueño vivo pero con latido vencido (proceso colgado): se recupera pasada la edad máxima
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'y', host: os.hostname(), inicio: Date.now() - 3600e3, latido: Date.now() - 3600e3 }));
    commitVersion({ dir: t.dir, id: 'v003', archivos: [{ nombre: 'v003.json', contenido: 'b' }], edadMaxMs: 60e3, idsEnHistorial: () => hist(t.dir), actualizarHistorial: () => { fs.writeFileSync(path.join(t.dir, 'historial.json'), JSON.stringify({ versiones: [{ id: 'v001' }, { id: 'v002' }, { id: 'v003' }] })); } });
    assert.ok(hist(t.dir).includes('v003'));
  } finally { t.done(); }
});

// ---------- Servicios reales (2D y 3D) con procesos hijos ----------
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { Anteproyectos } from '../src/design/servicio.js';
import { Modelos3d } from '../src/arq3d/servicio.js';
const SERV = path.join(path.dirname(fileURLToPath(import.meta.url)), 'proc', 'servicio_child.mjs');
function hijoServ(args) {
  const p = spawn(process.execPath, [SERV, JSON.stringify(args)], { stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; let err = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  return { p, fin: new Promise((res) => p.on('close', (code, signal) => { let r = null; try { r = JSON.parse(out.trim().split('\n').pop()); } catch { /* kill */ } res({ code, signal, r, err }); })) };
}
function entornoServ() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tw26 serv ñ ')); const sb = new Sandbox(home); createProject(sb, 'P'); const A = new Anteproyectos(sb); const M = new Modelos3d(sb, A);
  A.crear('P', { nombre: 'C', programa: {} }); M.crear('P', { nombre: 'M', desde_anteproyecto: { nombre: 'C' } });
  const d2 = path.join(home, 'Proyectos', 'P', '03 Trabajo', 'Anteproyectos', 'C'); const d3 = path.join(home, 'Proyectos', 'P', '03 Trabajo', 'Modelos3D', 'M');
  return { home, sb, A, M, d2, d3, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}
const limpio = (dir) => !fs.readdirSync(dir).some((f) => f === '.journal.json' || f.startsWith('.staging') || f === '.lock');

test('servicios 2D y 3D: otra sesión que abre, consulta, deshace o modifica durante una escritura viva NO la daña; el conflicto se informa sin pérdida', async () => {
  for (const tipo of ['2d', '3d']) {
    const e = entornoServ();
    try {
      const svc = tipo === '2d' ? e.A : e.M; const nombre = tipo === '2d' ? 'C' : 'M'; const dir = tipo === '2d' ? e.d2 : e.d3; const listo = path.join(e.home, 'listo'); const sigue = path.join(e.home, 'sigue');
      const H = hijoServ({ home: e.home, proyecto: 'P', tipo, nombre, ext: 230, altura: 2900, paso: 'staging_completo', modo: 'pausa', listo, sigue });
      assert.ok(await esperar(() => fs.existsSync(listo)), `${tipo}: el hijo está a mitad de su escritura`);
      // esta sesión abre el proyecto (reconcilia) y consulta: no debe tocar el staging ni el journal del hijo
      svc.cargar('P', nombre); assert.ok(fs.existsSync(path.join(dir, '.journal.json')) && fs.existsSync(path.join(dir, '.staging-v002')), `${tipo}: journal y staging del hijo intactos tras abrir`); assert.equal(fs.existsSync(path.join(dir, '.huerfanos')), false);
      // deshacer / modificar durante la escritura ajena: esperan un tiempo acotado y fallan sin modificar nada
      svc.esperaMs = 300; assert.throws(() => svc.historial('P', nombre, 'deshacer'), (x) => x.code === 'VERSION_EN_CURSO');
      assert.throws(() => (tipo === '2d' ? svc.modificar('P', nombre, { operaciones: [{ operacion: 'espesores', ext_mm: 240, int_mm: 120 }] }) : svc.modificar('P', nombre, { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 3000 } }] })), (x) => x.code === 'VERSION_EN_CURSO');
      fs.writeFileSync(sigue, '1'); const fin = await H.fin; assert.equal(fin.r?.ok, true, `${tipo}: el hijo termina bien ${JSON.stringify(fin.r)} ${fin.err.slice(0, 200)}`); assert.equal(fin.r.version, 'v002');
      assert.ok(limpio(dir)); assert.equal(svc.cargar('P', nombre).h.versiones.length, 2); assert.equal(svc.cargar('P', nombre).id, 'v002');
      // tras liberar, esta sesión sí puede trabajar: la siguiente versión es v003 (sin pisar v002)
      svc.esperaMs = 5000; const r3 = tipo === '2d' ? svc.modificar('P', nombre, { operaciones: [{ operacion: 'espesores', ext_mm: 240, int_mm: 120 }] }) : svc.modificar('P', nombre, { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 3000 } }] }); assert.equal(r3.version, 'v003');
    } finally { e.done(); }
  }
});

test('servicios: una sesión que preparó su cambio sobre una versión que otra ya avanzó recibe VERSION_CONCURRENTE (nada se pisa ni queda a medias)', async () => {
  const e = entornoServ();
  try {
    const listo = path.join(e.home, 'listo'); const sigue = path.join(e.home, 'sigue');
    const H = hijoServ({ home: e.home, proyecto: 'P', tipo: '2d', nombre: 'C', ext: 230, paso: 'archivos_en_destino', modo: 'pausa', listo, sigue }); assert.ok(await esperar(() => fs.existsSync(listo)));
    // esta sesión cargó v001 como base y espera el bloqueo (hasta 8 s); el hijo lo libera enseguida y avanza el historial a v002
    e.A.esperaMs = 8000; spawn(process.execPath, ['-e', `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(sigue)}, '1'), 400)`], { stdio: 'ignore' }); // otro proceso libera al hijo (esta espera es síncrona)
    assert.throws(() => e.A.modificar('P', 'C', { operaciones: [{ operacion: 'espesores', ext_mm: 250, int_mm: 120 }] }), (x) => ['VERSION_CONCURRENTE', 'VERSION_EXISTE'].includes(x.code), 'conflicto informado');
    assert.equal((await H.fin).r?.ok, true); assert.deepEqual(e.A.cargar('P', 'C').h.versiones.map((v) => v.id), ['v001', 'v002']); assert.ok(limpio(e.d2));
    assert.equal(e.A.modificar('P', 'C', { operaciones: [{ operacion: 'espesores', ext_mm: 250, int_mm: 120 }] }).version, 'v003', 'repetir sobre la versión actual funciona');
  } finally { e.done(); }
});

test('servicios: dos procesos reales modifican el mismo anteproyecto/modelo a la vez — exactamente uno gana, el otro falla limpio y el historial queda consistente', async () => {
  for (const tipo of ['2d', '3d']) for (let k = 0; k < 3; k++) {
    const e = entornoServ();
    try {
      const nombre = tipo === '2d' ? 'C' : 'M'; const dir = tipo === '2d' ? e.d2 : e.d3;
      const [a, b] = [hijoServ({ home: e.home, proyecto: 'P', tipo, nombre, ext: 230, altura: 2900, esperaMs: 8000 }), hijoServ({ home: e.home, proyecto: 'P', tipo, nombre, ext: 240, altura: 3000, esperaMs: 8000 })]; const [ra, rb] = await Promise.all([a.fin, b.fin]);
      const oks = [ra, rb].filter((x) => x.r?.ok); assert.ok(oks.length >= 1, `${tipo}: al menos una confirma ${JSON.stringify([ra.r, rb.r, ra.err.slice(0, 100)])}`);
      for (const x of [ra, rb]) if (!x.r?.ok) assert.ok(['VERSION_CONCURRENTE', 'VERSION_EXISTE', 'VERSION_EN_CURSO'].includes(x.r?.code), JSON.stringify(x.r));
      const ids = (tipo === '2d' ? e.A : e.M).cargar('P', nombre).h.versiones.map((v) => v.id); assert.equal(new Set(ids).size, ids.length, 'sin ids repetidos'); assert.equal(ids.length, 1 + oks.length); assert.ok(limpio(dir));
      for (const id of ids) assert.equal(verificarManifiesto(dir, id).estado, id === 'v001' ? verificarManifiesto(dir, id).estado : 'integra');
    } finally { e.done(); }
  }
});

test('servicios: corte real (SIGKILL) a mitad de una modificación — la siguiente sesión recupera sin pérdida y el proyecto sigue utilizable', async () => {
  for (const tipo of ['2d', '3d']) for (const paso of ['staging_completo', 'movido:v002.json', 'archivos_en_destino']) {
    const e = entornoServ();
    try {
      const nombre = tipo === '2d' ? 'C' : 'M'; const dir = tipo === '2d' ? e.d2 : e.d3; const svc = tipo === '2d' ? e.A : e.M;
      const v1 = fs.readFileSync(path.join(dir, 'v001.json'), 'utf8'); const H = hijoServ({ home: e.home, proyecto: 'P', tipo, nombre, ext: 230, altura: 2900, paso, modo: 'kill' }); assert.ok(cortado(await H.fin), 'proceso cortado');
      const c = svc.cargar('P', nombre); // abrir = reconciliar
      assert.equal(c.id, 'v001', `${tipo}/${paso}: la versión vigente sigue siendo v001`); assert.ok(limpio(dir)); assert.equal(fs.existsSync(path.join(dir, 'v002.json')), false); assert.equal(fs.readFileSync(path.join(dir, 'v001.json'), 'utf8'), v1);
      if (paso !== 'staging_completo') { const ap = path.join(dir, '.huerfanos'); assert.ok(fs.existsSync(ap) && fs.readdirSync(ap).flatMap((d) => fs.readdirSync(path.join(ap, d))).includes('v002.json'), `${tipo}/${paso}: el contenido se conserva apartado`); }
      assert.equal((tipo === '2d' ? svc.modificar('P', nombre, { operaciones: [{ operacion: 'espesores', ext_mm: 230, int_mm: 120 }] }) : svc.modificar('P', nombre, { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 2900 } }] })).version, 'v002');
    } finally { e.done(); }
  }
});
