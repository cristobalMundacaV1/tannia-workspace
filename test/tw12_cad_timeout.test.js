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
import { dataImportado } from './helpers_dxf_import.js';
import { CadOperations } from '../src/cad/operations.js';
import { fail } from '../src/mcp/util.js';

const etapaLinea = (e, s, t, x) => `TANNIA_ETAPA:${Buffer.from(JSON.stringify({ e, s, t, ...(x ? { x } : {}) })).toString('base64')}`;
function entorno() {
  const home = tmpHome('TW12 timeout ñ '); const sb = new Sandbox(home); createProject(sb, 'Piloto'); const root = sb.projectRoot('Piloto');
  const rel = '03 Trabajo/copia.dxf'; const abs = path.join(root, rel); const dxf = buildDrawingDxf(compose(tunnelModel({}))); fs.writeFileSync(abs, dxf);
  return { sb, root, rel, abs, dxf };
}
const timeoutError = (etapas, ms = 30000) => Object.assign(new Error('powershell'), { clase: 'tiempo_agotado', codigo_salida: null, stderr: '', etapas, duracion_ms: ms + 14, timeout_ms: ms });
const BLOQUEADO_EN_IMPORT = [{ etapa: 'conexion_com', estado: 'inicio', t_ms: 3 }, { etapa: 'conexion_com', estado: 'ok', t_ms: 90 }, { etapa: 'consulta_ocupacion', estado: 'inicio', t_ms: 95 }, { etapa: 'consulta_ocupacion', estado: 'ok', t_ms: 130, dato: { quiescente: true, cmdactive: 0 } }, { etapa: 'enumerar_documentos', estado: 'inicio', t_ms: 135 }, { etapa: 'enumerar_documentos', estado: 'ok', t_ms: 160, dato: { abiertos: 1 } }, { etapa: 'crear_documento_aislado', estado: 'inicio', t_ms: 170 }, { etapa: 'crear_documento_aislado', estado: 'ok', t_ms: 400, dato: { nombre: 'Drawing2.dwg' } }, { etapa: 'importar_dxf', estado: 'inicio', t_ms: 410 }];
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

const esReconc = (script) => /aislado_presente/.test(script) && !/Documents\.Add\(/.test(script);
const OK_LIBRE = { ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [7] };

test('texto visible del tiempo agotado en la importación: código, última etapa, duración y estado incierto; detalle saneado', async () => {
  const e = entorno(); let capturado;
  const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (s, i) => {
    if (esReconc(s)) { assert.equal(i.nombre_aislado, 'Drawing2.dwg', 'se reconcilia por el nombre del documento aislado creado'); return JSON.stringify({ ok: true, data: { aislado_presente: false, documentos: [{ nombre: 'Dibujo1.dwg', con_ruta_en_disco: false, guardado: false }], ...OK_LIBRE } }); }
    throw timeoutError(BLOQUEADO_EN_IMPORT, 120000);
  } });
  await assert.rejects(c.abrirCopia('Piloto', e.rel), x => { capturado = x; return true; });
  const r = fail(capturado.code, capturado.message, capturado.hint, capturado.detalle); const texto = r.content[0].text;
  assert.match(texto, /ERROR AUTOCAD_ERROR/); assert.match(texto, /Última etapa alcanzada: importar_dxf \(iniciada, SIN terminar/); assert.match(texto, /Duración: 120\.0 s/); assert.match(texto, /INCIERTO/); assert.match(texto, /Reconciliación: no figura documento aislado/);
  const d = r.structuredContent.detalle; assert.equal(d.etapa, 'importar_dxf'); assert.equal(d.estado_incierto, true); assert.equal(d.clase, 'tiempo_agotado'); assert.equal(d.etapas.length, BLOQUEADO_EN_IMPORT.length); assert.equal(d.reconciliacion.estado, 'aislado_ausente'); assert.equal(d.importacion_incierta, true);
  assert.ok(!JSON.stringify(r).includes(e.root), 'sin rutas absolutas del equipo');
});

test('importación tardía/incompleta: tras el timeout se reconcilia; NO se repite Import, NO se guarda y NO se cierra nada; la marca persiste hasta limpiar', async () => {
  const e = entorno(); const log = []; let estado = 'presente';
  const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (script, input, opts) => {
    if (esReconc(script)) { log.push('reconciliar'); assert.equal(opts.timeoutMs, 15000, 'la reconciliación tiene su propio límite corto'); return JSON.stringify({ ok: true, data: { aislado_presente: estado === 'presente', entidades_aislado: estado === 'presente' ? 29 : null, documentos: [{ nombre: 'Dibujo1.dwg', con_ruta_en_disco: false, guardado: false }], ...OK_LIBRE } }); }
    log.push('importar'); if (estado === 'presente') throw timeoutError(BLOQUEADO_EN_IMPORT, 120000);
    return JSON.stringify({ ok: true, data: dataImportado(e.dxf) });
  } });
  await assert.rejects(c.abrirCopia('Piloto', e.rel), x => x.code === 'AUTOCAD_ERROR' && x.detalle.reconciliacion.estado === 'aislado_presente' && /NO verificada/.test(x.message));
  assert.deepEqual(log, ['importar', 'reconciliar']); log.length = 0;
  const pend = () => fs.readdirSync(path.join(e.root, '03 Trabajo', 'CAD', 'operaciones')).filter(f => f.endsWith('.pendiente.json'));
  assert.equal(pend().length, 1, 'marca pendiente persistente');
  await assert.rejects(c.abrirCopia('Piloto', e.rel), x => x.code === 'IMPORTACION_PENDIENTE_SIN_RECONCILIAR' && x.detalle.estado_incierto === true);
  assert.deepEqual(log, ['reconciliar'], 'solo reconcilia: ninguna importación ni Documents.Open'); log.length = 0;
  estado = 'limpio'; const ok = await c.abrirCopia('Piloto', e.rel);
  assert.deepEqual(log, ['reconciliar', 'importar'], 'con estado limpio comprobado, una única importación explícita'); assert.equal(ok.aislado, true); assert.equal(pend().length, 1, 'la marca histórica NO se borra'); assert.equal(c.marcas('Piloto')[0].resuelta, true, 'queda resuelta por una entrada de solo-adición');
});

test('estado incierto no verificable: mientras no se pueda reconciliar no se inicia ninguna importación', async () => {
  const e = entorno(); const log = [];
  const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (script) => {
    const rec = esReconc(script); log.push(rec ? 'reconciliar' : 'importar');
    if (rec) throw timeoutError([{ etapa: 'consulta_ocupacion', estado: 'inicio', t_ms: 4 }], 15000);
    throw timeoutError(BLOQUEADO_EN_IMPORT, 120000);
  } });
  await assert.rejects(c.abrirCopia('Piloto', e.rel), x => x.code === 'AUTOCAD_ERROR' && x.detalle.reconciliacion.estado === 'no_verificable' && /no se pudo verificar/.test(x.message));
  assert.deepEqual(log, ['importar', 'reconciliar']); log.length = 0;
  await assert.rejects(c.abrirCopia('Piloto', e.rel), x => x.code === 'IMPORTACION_PENDIENTE_SIN_RECONCILIAR');
  assert.deepEqual(log, ['reconciliar']);
});

test('exportar_dwg: un timeout al importar no crea una escritura incierta en el diario; tras limpiar el estado continúa una sola vez', async () => {
  const e = entorno(); const c0 = compose(tunnelModel({})); const exp = expectedLayouts(c0); const dwgRel = '03 Trabajo/CAD/out.dwg'; fs.mkdirSync(path.join(e.root, '03 Trabajo', 'CAD'), { recursive: true }); const dwgAbs = path.join(e.root, dwgRel);
  let fase = 'timeout'; const seq = [];
  const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: async (script, input) => {
    if (input.dwg) { seq.push('guardar'); fs.writeFileSync(dwgAbs, 'AC1032 synthetic'); return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true } }); }
    if (esReconc(script)) { seq.push('reconciliar'); return JSON.stringify({ ok: true, data: { aislado_presente: false, documentos: [], ...OK_LIBRE } }); }
    if (input.dxf) { seq.push('importar'); if (fase === 'timeout') throw timeoutError(BLOQUEADO_EN_IMPORT, 120000); return JSON.stringify({ ok: true, data: dataImportado(e.dxf) }); }
    seq.push('inspeccionar'); return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true, unidades: 6, layouts: exp.map(l => ({ nombre: l.name, viewports: l.viewports.map(v => ({ centro_papel: [...v.paperCenter], ancho: v.width, alto: v.height, escala: v.scale, bloqueado: true, centro_vista: [...v.modelCenter] })) })) } });
  } });
  await assert.rejects(c.guardarLaminas('Piloto', { dxf: e.rel, dwg: dwgRel, operacion: 'exp-timeout', composition: c0 }), x => x.code === 'AUTOCAD_ERROR' && x.detalle.estado_incierto === true);
  assert.deepEqual(seq, ['importar', 'reconciliar'], 'no se intentó guardar'); assert.equal(new CadOperations(e.root).status('exp-timeout'), null, 'el diario no registra una escritura que nunca se despachó'); assert.ok(!fs.existsSync(dwgAbs));
  fase = 'ok'; seq.length = 0;
  const r = await c.guardarLaminas('Piloto', { dxf: e.rel, dwg: dwgRel, operacion: 'exp-timeout', composition: c0 });
  assert.equal(r.dwg_validado_autocad_real, false); assert.equal(r.verificacion_layouts.ok, true);
  assert.deepEqual(seq, ['reconciliar', 'importar', 'guardar', 'inspeccionar'], 'marca pendiente → reconciliación limpia → una importación → un guardado');
});

test('lógica de apertura por contrato: Open solo en abrir_copia (.dwg); DXF solo vía Add+Import con progreso antes/después; guardar no abre ni importa', () => {
  const sOpen = buildScript('abrir_copia'); assert.equal((sOpen.match(/Documents\.Open\(/g) || []).length, 1, 'abrir_copia: un solo Open');
  const ini = sOpen.indexOf("Progreso 'abrir_documento' 'inicio'"); const op = sOpen.indexOf('Documents.Open('); const fin = sOpen.indexOf("Progreso 'abrir_documento' 'ok'"); assert.ok(ini > 0 && ini < op && op < fin, 'progreso antes y después de Open');
  assert.ok(sOpen.indexOf('TIPO_NO_PERMITIDO_OPEN') < sOpen.indexOf('Documents.Open('), 'guardia de extensión antes del Open');
  const sImp = buildScript('importar_dxf_aislado'); assert.ok(!/Documents\.Open\(/.test(sImp), 'el script de DXF no contiene Documents.Open');
  for (const [a, b] of [["Progreso 'crear_documento_aislado' 'inicio'", 'Documents.Add()'], ["Progreso 'importar_dxf' 'inicio'", '.Import(']]) assert.ok(sImp.indexOf(a) > 0 && sImp.indexOf(a) < sImp.indexOf(b), `${b}: progreso antes`);
  assert.ok(sImp.indexOf('.Import(') < sImp.indexOf("Progreso 'importar_dxf' 'ok'"), 'progreso después del Import');
  assert.equal((sImp.match(/Documents\.Add\(/g) || []).length, 1); assert.equal((sImp.match(/\.Import\(/g) || []).length, 1); assert.ok(!/SaveAs|\.Close\(|Activate\(/.test(sImp), 'importar solo mide: no guarda, no cierra, no activa otros');
  for (const n of ['laminas_a_dwg', 'dxf_a_dwg']) { const s = buildScript(n); assert.ok(!/Documents\.(Open|Add)\(|\.Import\(/.test(s), `${n}: no abre ni importa`); assert.match(s, /LocalizarAislado/); }
  for (const n of ['abrir_copia', 'importar_dxf_aislado', 'laminas_a_dwg', 'dxf_a_dwg']) { const s = buildScript(n); for (const etapa of ['conexion_com', 'consulta_ocupacion']) assert.ok(s.includes(`'${etapa}'`), `${n}: ${etapa}`); assert.ok(!/New-Object -ComObject|CreateObject|Start-Process/.test(s)); }
  for (const n of ['reconciliar_apertura', 'reconciliar_importacion']) assert.equal((buildScript(n).match(/Documents\.(Open|Add)\(|\.Import\(|SaveAs|\.Close\(/g) || []).length, 0, `${n}: solo lectura`);
  assert.match(runPowerShell.toString(), /timeoutMs = 30000/, 'el tiempo límite por defecto NO se aumentó');
});
