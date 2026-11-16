// Auditoría PR #11 — H5: un bloqueo cuyo dueño SIGUE VIVO nunca se interviene aunque su latido haya vencido (proceso pausado,
// lento o suspendido); solo se recupera cuando el dueño murió (o su pid fue reutilizado por otro proceso).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { commitVersion, reconciliar, tomarBloqueo, verificarManifiesto } from '../src/project/transaccion.js';

const HIJO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'proc', 'commit_child.mjs');
const nuevo = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw29 ñ ')); const dir = path.join(d, 'versiones'); fs.mkdirSync(dir); return { d, dir, done: () => fs.rmSync(d, { recursive: true, force: true }) }; };
const esperar = async (cond, ms = 20000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (cond()) return true; await new Promise((r) => setTimeout(r, 25)); } return false; };
function hijo(args) { const p = spawn(process.execPath, [HIJO, JSON.stringify(args)], { stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; let err = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; }); return { p, fin: new Promise((res) => p.on('close', (code, signal) => { let r = null; try { r = JSON.parse(out.trim().split('\n').pop()); } catch { /* sin salida */ } res({ code, signal, r, err }); })) }; }
const hist = (dir) => (fs.existsSync(path.join(dir, 'historial.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8')).versiones.map((v) => v.id) : []);
const base = (dir) => commitVersion({ dir, id: 'v001', archivos: [{ nombre: 'v001.json', contenido: 'primera' }], actualizarHistorial: () => fs.writeFileSync(path.join(dir, 'historial.json'), JSON.stringify({ versiones: [{ id: 'v001' }] })) });
const envejecer = (dir, ms = 3600e3) => { const f = path.join(dir, '.lock', 'owner.json'); const o = JSON.parse(fs.readFileSync(f, 'utf8')); o.latido = Date.now() - ms; fs.writeFileSync(f, JSON.stringify(o)); return o; };
const nueva = (dir, id, extra = {}) => commitVersion({ dir, id, archivos: [{ nombre: `${id}.json`, contenido: `de ${id}` }], idsEnHistorial: () => hist(dir), actualizarHistorial: () => { const h = JSON.parse(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8')); h.versiones.push({ id }); fs.writeFileSync(path.join(dir, 'historial.json'), JSON.stringify(h)); }, ...extra });

test('REPRODUCCIÓN: dueño VIVO con latido vencido (proceso pausado) — otro proceso NO interviene su escritura; la escritura termina íntegra', async () => {
  const t = nuevo();
  try {
    base(t.dir); const listo = path.join(t.d, 'listo'); const sigue = path.join(t.d, 'sigue');
    const A = hijo({ dir: t.dir, id: 'v002', paso: 'staging:v002.json', modo: 'pausa', listo, sigue, contenido: 'datos de A' }); assert.ok(await esperar(() => fs.existsSync(listo)));
    envejecer(t.dir); // A sigue vivo (pausado) pero su latido es de hace 1 hora
    // otro proceso (esta sesión) intenta escribir con un umbral de latido de 1 s: NO puede tomar el bloqueo de un dueño vivo
    assert.throws(() => nueva(t.dir, 'v003', { esperaMs: 300, edadMaxMs: 1000 }), (x) => x.code === 'VERSION_EN_CURSO' && x.detalle?.propietario_vivo === true && x.detalle?.latido_vencido === true, 'espera acotada y falla informando que el dueño sigue vivo');
    const r = reconciliar(t.dir, hist(t.dir)); assert.ok(r?.en_curso === true, 'reconciliar tampoco interviene');
    assert.ok(fs.existsSync(path.join(t.dir, '.journal.json')) && fs.existsSync(path.join(t.dir, '.staging-v002')), 'journal y staging del dueño vivo intactos');
    assert.equal(fs.existsSync(path.join(t.dir, 'v003.json')), false);
    fs.writeFileSync(sigue, '1'); const fin = await A.fin; assert.equal(fin.r?.ok, true, `A termina bien: ${JSON.stringify(fin.r)} ${fin.err.slice(0, 160)}`);
    assert.deepEqual(hist(t.dir), ['v001', 'v002']); assert.equal(verificarManifiesto(t.dir, 'v002').estado, 'integra'); assert.equal(fs.readFileSync(path.join(t.dir, 'v002.json'), 'utf8'), 'datos de A');
    nueva(t.dir, 'v003'); assert.deepEqual(hist(t.dir), ['v001', 'v002', 'v003'], 'liberado el bloqueo, la otra sesión sí puede escribir');
  } finally { t.done(); }
});

test('recuperación LEGÍTIMA tras una caída real: dueño muerto (SIGKILL) con latido reciente o vencido se recupera sin esperar y sin pérdida', async () => {
  for (const viejo of [false, true]) {
    const t = nuevo();
    try {
      base(t.dir); const listo = path.join(t.d, 'listo'); const A = hijo({ dir: t.dir, id: 'v002', paso: 'movido:v002.json', modo: 'pausa', listo, sigue: path.join(t.d, 'nunca'), contenido: 'datos que no deben perderse' }); assert.ok(await esperar(() => fs.existsSync(listo)));
      if (viejo) envejecer(t.dir);
      A.p.kill('SIGKILL'); const fin = await A.fin; assert.ok(fin.signal === 'SIGKILL' || process.platform === 'win32', 'el dueño murió');
      const t0 = Date.now(); const r = reconciliar(t.dir, hist(t.dir)); assert.ok(Date.now() - t0 < 3000, 'recuperación inmediata (no espera al vencimiento)');
      assert.equal(r?.accion, 'archivos_huerfanos_apartados', `viejo=${viejo}`); assert.ok(r.bloqueo_abandonado, 'se informa que el bloqueo era de un proceso inexistente');
      const ap = path.join(t.dir, '.huerfanos'); const movidos = fs.readdirSync(ap).flatMap((d) => fs.readdirSync(path.join(ap, d))); assert.ok(movidos.includes('v002.json'), 'el contenido se conserva');
      assert.equal(fs.existsSync(path.join(t.dir, '.lock')), false); nueva(t.dir, 'v002'); assert.deepEqual(hist(t.dir), ['v001', 'v002']);
    } finally { t.done(); }
  }
});

test('pid reutilizado: dueño "vivo" con otra identidad de proceso y latido vencido se recupera; con la MISMA identidad no', () => {
  const t = nuevo();
  try {
    base(t.dir); const lock = path.join(t.dir, '.lock'); const inicioPropio = Date.now() - process.uptime() * 1000;
    const poner = (o) => { fs.rmSync(lock, { recursive: true, force: true }); fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'x', host: os.hostname(), inicio: Date.now() - 3600e3, latido: Date.now() - 3600e3, ...o })); };
    // misma identidad (es este mismo proceso, con su hora de inicio real): NO se interviene aunque el latido tenga una hora
    poner({ inicio_proceso_ms: inicioPropio }); assert.throws(() => nueva(t.dir, 'v002', { esperaMs: 200, edadMaxMs: 60e3 }), (x) => x.code === 'VERSION_EN_CURSO' && x.detalle?.propietario_vivo === true);
    // sin dato de identidad (formato anterior): tampoco (se asume vivo, nunca se interviene)
    poner({}); assert.throws(() => nueva(t.dir, 'v002', { esperaMs: 200, edadMaxMs: 60e3 }), (x) => x.code === 'VERSION_EN_CURSO');
    // otra identidad (el pid fue reutilizado por otro proceso, hora de inicio 1 día antes): bloqueo abandonado
    poner({ inicio_proceso_ms: inicioPropio - 86400e3 }); nueva(t.dir, 'v002', { esperaMs: 500, edadMaxMs: 60e3 }); assert.deepEqual(hist(t.dir), ['v001', 'v002']);
    // identidad distinta PERO latido reciente: no se interviene (podría ser un reloj desfasado)
    poner({ inicio_proceso_ms: inicioPropio - 86400e3, latido: Date.now() }); assert.throws(() => nueva(t.dir, 'v003', { esperaMs: 200, edadMaxMs: 60e3 }), (x) => x.code === 'VERSION_EN_CURSO');
  } finally { t.done(); }
});

test('dueño en OTRO equipo (carpeta compartida): no se puede verificar su vida; solo se recupera pasada la edad máxima', () => {
  const t = nuevo();
  try {
    base(t.dir); const lock = path.join(t.dir, '.lock'); fs.mkdirSync(lock);
    const poner = (latido) => fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: 1, token: 'z', host: 'otro-equipo-xyz', inicio: Date.now(), latido }));
    poner(Date.now()); assert.throws(() => nueva(t.dir, 'v002', { esperaMs: 200, edadMaxMs: 60e3 }), (x) => x.code === 'VERSION_EN_CURSO');
    poner(Date.now() - 3600e3); nueva(t.dir, 'v002', { esperaMs: 500, edadMaxMs: 60e3 }); assert.deepEqual(hist(t.dir), ['v001', 'v002']);
  } finally { t.done(); }
});

test('tomarBloqueo informa el diagnóstico y el latido se renueva en cada paso de la escritura (un dueño activo no queda "vencido" por su propio avance)', async () => {
  const t = nuevo();
  try {
    const b = tomarBloqueo(t.dir, { motivo: 'prueba' }); const f = path.join(t.dir, '.lock', 'owner.json'); const o1 = JSON.parse(fs.readFileSync(f, 'utf8')); assert.equal(o1.pid, process.pid); assert.equal(typeof o1.inicio_proceso_ms, 'number');
    await new Promise((r) => setTimeout(r, 30)); b.latido(); const o2 = JSON.parse(fs.readFileSync(f, 'utf8')); assert.ok(o2.latido > o1.latido); b.liberar(); assert.equal(fs.existsSync(path.join(t.dir, '.lock')), false);
    const diag = {}; const b2 = tomarBloqueo(t.dir, {}); const b3 = tomarBloqueo(t.dir, { esperaMs: 0, diagnostico: diag }); assert.equal(b3, null); assert.equal(diag.propietario_vivo, true); assert.equal(diag.latido_vencido, false); b2.liberar();
  } finally { t.done(); }
});
