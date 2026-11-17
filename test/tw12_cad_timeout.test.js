// CAD-OPEN-01 (2.ª incidencia): tiempo agotado con progreso por etapas, resultado incierto y reconciliación sin repetir Documents.Open.
// Los mocks NO acreditan integración con AutoCAD real; el proceso falso de la primera prueba sí ejercita el spawn/kill reales de runPowerShell.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tmpHome } from './helpers.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { AutoCadCom, SCRIPTS, buildScript, runPowerShell, parseEtapas } from '../src/cad/autocad_com.js';
import { tunnelModel, compose } from '../src/drawing/model.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { expectedLayouts } from '../src/drawing/layouts_check.js';
import { CadOperations } from '../src/cad/operations.js';
import { fail } from '../src/mcp/util.js';

const etapaLinea = (e, s, t, x) => `TANNIA_ETAPA:${Buffer.from(JSON.stringify({ e, s, t, ...(x ? { x } : {}) })).toString('base64')}`;
function entorno() {
  const home = tmpHome('TW12 timeout ñ '); const sb = new Sandbox(home); createProject(sb, 'Piloto'); const root = sb.projectRoot('Piloto');
  const rel = '03 Trabajo/copia.dxf'; const abs = path.join(root, rel); const dxf = buildDrawingDxf(compose(tunnelModel({}))); fs.writeFileSync(abs, dxf);
  return { sb, root, rel, abs, dxf };
}
const timeoutError = (etapas, ms = 30000) => Object.assign(new Error('powershell'), { clase: 'tiempo_agotado', codigo_salida: null, stderr: '', etapas, duracion_ms: ms + 14, timeout_ms: ms });
const BLOQUEADO_EN_OPEN = [{ etapa: 'conexion_com', estado: 'inicio', t_ms: 3 }, { etapa: 'conexion_com', estado: 'ok', t_ms: 90 }, { etapa: 'consulta_ocupacion', estado: 'inicio', t_ms: 95 }, { etapa: 'consulta_ocupacion', estado: 'ok', t_ms: 130, dato: { quiescente: true, cmdactive: 0 } }, { etapa: 'enumerar_documentos', estado: 'inicio', t_ms: 135 }, { etapa: 'enumerar_documentos', estado: 'ok', t_ms: 160, dato: { abiertos: 1, ya_abierto: false } }, { etapa: 'abrir_documento', estado: 'inicio', t_ms: 170 }];

test('runPowerShell real: el progreso emitido ANTES del bloqueo sobrevive al tiempo agotado y al kill', { skip: process.platform === 'win32' ? 'proceso falso tipo shell' : false }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-ps ')); const exe = path.join(dir, 'fake-ps.sh');
  fs.writeFileSync(exe, `#!/bin/sh\necho '${etapaLinea('conexion_com', 'inicio', 1)}'\necho '${etapaLinea('conexion_com', 'ok', 40)}'\necho '${etapaLinea('abrir_documento', 'inicio', 55, { ruta: 'x' })}'\nsleep 20\n`, { mode: 0o755 });
  try {
    const trazas = []; const t0 = Date.now();
    await assert.rejects(runPowerShell('x', {}, { exe, timeoutMs: 700, trazas }), x => {
      assert.equal(x.clase, 'tiempo_agotado'); assert.ok(x.duracion_ms >= 650 && x.duracion_ms < 4000, `duración ${x.duracion_ms}`); assert.equal(x.timeout_ms, 700);
      const ultima = x.etapas.at(-1); assert.deepEqual([ultima.etapa, ultima.estado], ['abrir_documento', 'inicio']); assert.equal(x.etapas.length, 3); return true;
    });
    assert.deepEqual(trazas.map(t => t.etapa), ['conexion_com', 'conexion_com', 'abrir_documento']); assert.ok(Date.now() - t0 < 5000, 'el proceso fue terminado, no esperado');
    // camino feliz: etapas + respuesta final
    fs.writeFileSync(exe, `#!/bin/sh\necho '${etapaLinea('conexion_com', 'ok', 5)}'\necho 'TANNIA_OUT:${Buffer.from('{"ok":true}').toString('base64')}'\n`, { mode: 0o755 });
    const t2 = []; assert.equal(await runPowerShell('x', {}, { exe, timeoutMs: 3000, trazas: t2 }), '{"ok":true}'); assert.equal(t2.length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.deepEqual(parseEtapas(`basura\nTANNIA_ETAPA:%%%\n${etapaLinea('a', 'ok', 1)}\nTANNIA_ETAPA:eyJ`), [{ etapa: 'a', estado: 'ok', t_ms: 1 }], 'líneas truncadas o corruptas se ignoran');
});

test('texto visible del tiempo agotado: código, última etapa, duración y estado incierto; detalle saneado', async () => {
  const e = entorno(); const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async () => { throw timeoutError(BLOQUEADO_EN_OPEN); } });
  const err = await c.estado().then(() => null, x => x);
  // estado() no abre: usa el mismo mapeo; la prueba relevante es abrirCopia (siguiente); aquí solo se valida que el mapeo exista
  assert.ok(err);
  let capturado; const abrir = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (s, i) => { if (i.ruta && i.estricto && !i.ruta_esperada && /Documents\.Open/.test(s) && !/ya_abierto = \$abierto/.test(s)) throw timeoutError(BLOQUEADO_EN_OPEN); return JSON.stringify({ ok: true, data: { abierto: false, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); } });
  await assert.rejects(abrir.abrirCopia('Piloto', e.rel), x => { capturado = x; return true; });
  const r = fail(capturado.code, capturado.message, capturado.hint, capturado.detalle); const texto = r.content[0].text;
  assert.match(texto, /ERROR AUTOCAD_ERROR/); assert.match(texto, /Última etapa alcanzada: abrir_documento \(iniciada, SIN terminar/); assert.match(texto, /Duración: 30\.0 s/); assert.match(texto, /INCIERTO/); assert.match(texto, /Reconciliación: el archivo NO figura abierto/);
  const d = r.structuredContent.detalle; assert.equal(d.etapa, 'abrir_documento'); assert.equal(d.estado_incierto, true); assert.equal(d.clase, 'tiempo_agotado'); assert.equal(d.etapas.length, 7); assert.equal(d.reconciliacion.estado, 'no_abierto');
  assert.ok(!JSON.stringify(r).includes(e.root), 'sin rutas absolutas del equipo');
});

test('apertura tardía: tras el timeout se reconcilia; si AutoCAD sí abrió, se informa y NO se repite Documents.Open', async () => {
  const e = entorno(); const llamadas = [];
  const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (script, input, opts) => {
    const reconc = /ya_abierto = \$abierto/.test(script); llamadas.push(reconc ? 'reconciliar' : 'abrir');
    if (!reconc) throw timeoutError(BLOQUEADO_EN_OPEN);
    assert.equal(opts.timeoutMs, 15000, 'la reconciliación tiene su propio límite corto');
    return JSON.stringify({ ok: true, data: { abierto: true, documentos: [{ nombre: 'Dibujo1.dwg', con_ruta_en_disco: false, guardado: false }, { nombre: 'copia.dxf', con_ruta_en_disco: true, guardado: true }], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [7] } });
  } });
  const r = await c.abrirCopia('Piloto', e.rel);
  assert.equal(r.apertura_tardia, true); assert.equal(r.reconciliado, true); assert.deepEqual(llamadas, ['abrir', 'reconciliar']);
  assert.equal(r.reconciliacion.documentos[0].nombre, 'Dibujo1.dwg'); assert.equal(r.reconciliacion.documentos[0].guardado, false, 'Dibujo1 solo se observa');
  assert.ok(!fs.readdirSync(path.join(e.root, '03 Trabajo', 'CAD', 'operaciones')).some(f => f.endsWith('.pendiente.json')), 'marca pendiente retirada');
});

test('estado incierto persistente: mientras no se pueda reconciliar no se inicia ninguna apertura; con estado limpio se permite una llamada explícita', async () => {
  const e = entorno(); const log = []; let modo = 'bloqueado';
  const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (script, input) => {
    const reconc = /ya_abierto = \$abierto/.test(script); log.push(reconc ? 'reconciliar' : 'abrir');
    if (reconc) { if (modo === 'bloqueado') throw timeoutError([{ etapa: 'consulta_ocupacion', estado: 'inicio', t_ms: 4 }], 15000); return JSON.stringify({ ok: true, data: { abierto: false, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (modo === 'bloqueado') throw timeoutError(BLOQUEADO_EN_OPEN);
    return JSON.stringify({ ok: true, data: { documento: 'copia.dxf', ruta: e.abs, reutilizado: false } });
  } });
  await assert.rejects(c.abrirCopia('Piloto', e.rel), x => x.code === 'AUTOCAD_ERROR' && x.detalle.reconciliacion.estado === 'no_verificable' && /no se pudo verificar/.test(x.message));
  assert.deepEqual(log, ['abrir', 'reconciliar']); log.length = 0;
  await assert.rejects(c.abrirCopia('Piloto', e.rel), x => x.code === 'OPERACION_PENDIENTE_INCIERTA' && x.detalle.estado_incierto === true);
  assert.deepEqual(log, ['reconciliar'], 'solo reconcilia: ningún Documents.Open'); log.length = 0;
  modo = 'libre'; const ok = await c.abrirCopia('Piloto', e.rel);
  assert.deepEqual(log, ['reconciliar', 'abrir'], 'tras comprobar estado limpio, una única apertura explícita'); assert.equal(ok.documento, 'copia.dxf');
  assert.ok(!fs.readdirSync(path.join(e.root, '03 Trabajo', 'CAD', 'operaciones')).some(f => f.endsWith('.pendiente.json')));
});

test('exportar_dwg: un timeout al abrir no crea una escritura incierta en el diario; con apertura tardía continúa una sola vez', async () => {
  const e = entorno(); const c0 = compose(tunnelModel({})); const exp = expectedLayouts(c0); const dwgRel = '03 Trabajo/CAD/out.dwg'; fs.mkdirSync(path.join(e.root, '03 Trabajo', 'CAD'), { recursive: true }); const dwgAbs = path.join(e.root, dwgRel);
  let fase = 'timeout'; const seq = [];
  const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (script, input) => {
    const reconc = /ya_abierto = \$abierto/.test(script);
    if (input.dwg) { seq.push('guardar'); fs.writeFileSync(dwgAbs, 'AC1032 synthetic'); return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true } }); }
    if (reconc) { seq.push('reconciliar'); return JSON.stringify({ ok: true, data: { abierto: fase === 'tardia', documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (input.ruta && !input.ruta_esperada) { seq.push('abrir'); if (fase === 'timeout') throw timeoutError(BLOQUEADO_EN_OPEN); return JSON.stringify({ ok: true, data: { documento: 'copia.dxf', ruta: e.abs } }); }
    seq.push('inspeccionar'); return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true, unidades: 6, layouts: exp.map(l => ({ nombre: l.name, viewports: l.viewports.map(v => ({ centro_papel: [...v.paperCenter], ancho: v.width, alto: v.height, escala: v.scale, bloqueado: true, centro_vista: [...v.modelCenter] })) })) } });
  } });
  await assert.rejects(c.guardarLaminas('Piloto', { dxf: e.rel, dwg: dwgRel, operacion: 'exp-timeout', composition: c0 }), x => x.code === 'AUTOCAD_ERROR' && x.detalle.estado_incierto === true);
  assert.deepEqual(seq, ['abrir', 'reconciliar'], 'no se intentó guardar'); assert.equal(new CadOperations(e.root).status('exp-timeout'), null, 'el diario no registra una escritura que nunca se despachó'); assert.ok(!fs.existsSync(dwgAbs));
  fase = 'tardia'; seq.length = 0;
  const r = await c.guardarLaminas('Piloto', { dxf: e.rel, dwg: dwgRel, operacion: 'exp-timeout', composition: c0 });
  assert.equal(r.dwg_validado_autocad_real, false); assert.equal(r.verificacion_layouts.ok, true);
  assert.deepEqual(seq, ['reconciliar', 'guardar', 'inspeccionar'], 'marca pendiente → reconciliación → un único guardado, sin Documents.Open');
});

test('una única lógica de apertura: abrir_copia, laminas_a_dwg y dxf_a_dwg comparten AbrirPorRuta con progreso antes/después de Documents.Open', () => {
  for (const n of ['abrir_copia', 'laminas_a_dwg', 'dxf_a_dwg']) {
    const s = buildScript(n); assert.equal((s.match(/Documents\.Open\(/g) || []).length, 1, `${n}: un solo Open`); assert.match(SCRIPTS[n], /AbrirPorRuta \$in\.(ruta|dxf)/);
    const ini = s.indexOf("Progreso 'abrir_documento' 'inicio'"); const op = s.indexOf('Documents.Open('); const fin = s.indexOf("Progreso 'abrir_documento' 'ok'");
    assert.ok(ini > 0 && ini < op && op < fin, `${n}: progreso antes y después de Open`);
    for (const etapa of ['conexion_com', 'consulta_ocupacion', 'enumerar_documentos', 'activar_documento']) assert.ok(s.includes(`'${etapa}'`), `${n}: ${etapa}`);
    assert.ok(!/New-Object -ComObject|CreateObject|Start-Process/.test(s));
  }
  assert.match(buildScript('reconciliar_apertura'), /ya_abierto/); assert.equal((buildScript('reconciliar_apertura').match(/Documents\.Open\(/g) || []).length, 0, 'la reconciliación es de solo lectura');
  assert.match(runPowerShell.toString(), /timeoutMs = 30000/, 'el tiempo límite NO se aumentó');
});
