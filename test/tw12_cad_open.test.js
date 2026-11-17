// CAD-OPEN-01: abrir_copia / exportar_dwg — diagnóstico por etapa, clasificación de causas, sin reintentos ciegos.
// No hay PowerShell/AutoCAD aquí: el runner simula la respuesta JSON que producen los scripts (contrato verificado por pruebas estáticas
// de los scripts y por el protocolo real). Nada de esto acredita que AutoCAD 2027 real abra la copia.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome } from './helpers.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { AutoCadCom, SCRIPTS, buildScript, validarArchivoParaApertura } from '../src/cad/autocad_com.js';
import { tunnelModel, compose } from '../src/drawing/model.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { expectedLayouts } from '../src/drawing/layouts_check.js';

function entorno() {
  const home = tmpHome('TW12 open ñ '); const sb = new Sandbox(home); createProject(sb, 'Piloto'); const root = sb.projectRoot('Piloto');
  const rel = '03 Trabajo/copia.dxf'; const abs = path.join(root, rel); const dxf = buildDrawingDxf(compose(tunnelModel({}))); fs.writeFileSync(abs, dxf);
  return { sb, root, rel, abs, dxf };
}
const cad = (sb, runner) => new AutoCadCom({ sandbox: sb, platform: 'win32', runner });
const DIBUJO1 = { nombre: 'Dibujo1.dwg', con_ruta_en_disco: false, guardado: false };

test('CAD-OPEN-01 script: una sola apertura, sin reintento tras error, rutas sin excepción, etapas y ocupación explícitas', () => {
  const s = buildScript('abrir_copia');
  assert.equal((s.match(/Documents\.Open\(/g) || []).length, 1, 'un único Documents.Open en todo el script');
  const catchBlock = s.slice(s.indexOf('catch {', s.indexOf('Documents.Open(')), s.indexOf("$global:Etapa = 'verificar_apertura'"));
  assert.ok(!/Documents\.Open\(/.test(catchBlock), 'el manejo de error no reabre');
  assert.ok(!/GetFullPath\(\[string\]\$candidate/.test(s), 'ya no se normaliza FullName sin proteger (Dibujo1 sin ruta)');
  assert.match(s, /RutaSegura \$c\.FullName/); assert.match(s, /IsNullOrWhiteSpace/);
  for (const etapa of ['preparar', 'enumerar_documentos', 'abrir_documento', 'verificar_apertura', 'activar_documento']) assert.ok(s.includes(`'${etapa}'`), etapa);
  assert.match(s, /AUTOCAD_CUADRO_MODAL/); assert.match(s, /AUTOCAD_COMANDO_ACTIVO/); assert.match(s, /-band 8/);
  assert.match(s, /\$global:Diag\.sin_guardar/); assert.match(s, /Fail 'operacion_abrir_copia'/);
  assert.match(s, /global:Etapa/, 'Fail usa la etapa real');
  assert.ok(!/New-Object -ComObject|CreateObject|Start-Process|AutoCAD\.Application'\)\s*\)/.test(s.replace(/GetActiveObject[^\n]*/g, '')), 'nunca lanza otra instancia');
});

test('CAD-OPEN-01 con Dibujo1 sin guardar: abre/reutiliza y expone los documentos sin guardar; una sola llamada', async () => {
  const e = entorno(); const calls = [];
  const c = cad(e.sb, async (script, input) => { calls.push(input); return JSON.stringify({ ok: true, data: { documento: 'copia.dxf', ruta: e.abs, reutilizado: false, recuperado_tras_error: false, guardado: true, documentos_abiertos: 2, sin_guardar: ['Dibujo1.dwg'] } }); });
  const r = await c.abrirCopia('Piloto', e.rel);
  assert.deepEqual(r.sin_guardar, ['Dibujo1.dwg']); assert.equal(calls.length, 1); assert.equal(calls[0].estricto, true);
  assert.equal(calls[0].ruta, fs.realpathSync.native(e.abs));
});

test('CAD-OPEN-01 fallo de apertura: etapa, HRESULT, tipo y diagnóstico en detalle; NO se reintenta; no se lanza otra operación', async () => {
  const e = entorno(); let calls = 0;
  const c = cad(e.sb, async () => { calls++; return JSON.stringify({ ok: false, etapa: 'abrir_documento', hresult: '0x80020009', tipo: 'COMException', msg: 'Error de AutoCAD al abrir C:\\Users\\Alguien\\x.dxf', diag: { documentos: [DIBUJO1, { nombre: 'otro.dwg', con_ruta_en_disco: true, guardado: true }], sin_guardar: ['Dibujo1.dwg'], ocupacion: { quiescente: true, cmdactive: 0, error_estado: null } } }); });
  await assert.rejects(c.abrirCopia('Piloto', e.rel), err => {
    assert.equal(err.code, 'APERTURA_FALLIDA'); const d = err.detalle;
    assert.equal(d.etapa, 'abrir_documento'); assert.equal(d.hresult, '0x80020009'); assert.equal(d.tipo_excepcion, 'COMException'); assert.equal(d.operacion, 'abrir_copia');
    assert.deepEqual(d.diagnostico.sin_guardar, ['Dibujo1.dwg']); assert.equal(d.diagnostico.documentos[0].con_ruta_en_disco, false);
    assert.ok(!JSON.stringify(d).includes('Alguien'), 'sin rutas/usuarios del equipo'); return true;
  });
  assert.equal(calls, 1, 'sin reintento ciego');
});

test('CAD-OPEN-01 clasificación: ocupado, comando activo, cuadro modal, sesión ambigua, COM caído, fallo COM al enumerar, ruta', async () => {
  const e = entorno();
  const casos = [
    [{ codigo: 'AUTOCAD_CUADRO_MODAL', etapa: 'preparar', diag: { ocupacion: { cmdactive: 8 } } }, 'AUTOCAD_CUADRO_MODAL'],
    [{ codigo: 'AUTOCAD_COMANDO_ACTIVO', etapa: 'preparar' }, 'AUTOCAD_COMANDO_ACTIVO'],
    [{ codigo: 'AUTOCAD_OCUPADO', etapa: 'preparar' }, 'AUTOCAD_OCUPADO'],
    [{ codigo: 'SESION_AMBIGUA', etapa: 'sesion', diag: { procesos_acad: [10, 20] } }, 'SESION_AMBIGUA'],
    [{ etapa: 'abrir_documento', hresult: '0x80010001', tipo: 'COMException', msg: 'busy' }, 'AUTOCAD_OCUPADO'],
    [{ etapa: 'abrir_documento', hresult: '0x800706BA', tipo: 'COMException', msg: 'rpc' }, 'AUTOCAD_RPC'],
    [{ etapa: 'enumerar_documentos', hresult: '0x80004005', tipo: 'COMException', msg: 'x' }, 'AUTOCAD_COM_FALLO'],
    [{ etapa: 'activar_documento', hresult: '0x80004005', tipo: 'COMException', msg: 'x' }, 'AUTOCAD_COM_FALLO'],
    [{ etapa: 'abrir_documento', hresult: '0x80004005', tipo: 'COMException', msg: 'x' }, 'APERTURA_FALLIDA'],
    [{ codigo: 'RUTA_NO_VALIDA', etapa: 'preparar' }, 'RUTA_NO_VALIDA'],
    [{ etapa: 'otra', hresult: '0x1', tipo: 'X', msg: 'x' }, 'AUTOCAD_ERROR'],
  ];
  for (const [resp, code] of casos) {
    let n = 0; await assert.rejects(cad(e.sb, async () => { n++; return JSON.stringify({ ok: false, ...resp }); }).abrirCopia('Piloto', e.rel), err => err.code === code && err.detalle && 'etapa' in err.detalle, `${code}`);
    assert.equal(n, 1, `${code}: una sola llamada`);
  }
});

test('CAD-OPEN-01 el DXF inválido se detecta en Node antes de tocar AutoCAD (no se confunde con un fallo COM)', async () => {
  const e = entorno(); let n = 0; const c = cad(e.sb, async () => { n++; return JSON.stringify({ ok: true, data: {} }); });
  for (const [contenido, code] of [['', 'ARCHIVO_NO_LEGIBLE'], ['basura sin estructura dxf', 'DXF_INVALIDO'], [e.dxf.slice(0, 400), 'DXF_INVALIDO'], [e.dxf.replace(/0\r?\nEOF\r?\n$/, ''), 'DXF_INVALIDO']]) {
    fs.writeFileSync(e.abs, contenido); await assert.rejects(c.abrirCopia('Piloto', e.rel), err => err.code === code, code);
  }
  assert.equal(n, 0, 'AutoCAD nunca fue invocado');
  fs.writeFileSync(e.abs, e.dxf); assert.doesNotThrow(() => validarArchivoParaApertura(fs.realpathSync.native(e.abs)));
  fs.writeFileSync(path.join(e.root, '03 Trabajo', 'x.dwg'), 'XX1032 no es dwg................'); await assert.rejects(c.abrirCopia('Piloto', '03 Trabajo/x.dwg'), err => err.code === 'DWG_INVALIDO');
});

test('CAD-OPEN-01 originales siguen protegidos y la sesión ambigua bloquea la apertura', async () => {
  const e = entorno(); const orig = path.join(e.root, '02 Originales', 'o.dxf'); fs.writeFileSync(orig, e.dxf); let n = 0;
  await assert.rejects(cad(e.sb, async () => { n++; return '{}'; }).abrirCopia('Piloto', '02 Originales/o.dxf'), err => err.code === 'ORIGINAL_PROTEGIDO'); assert.equal(n, 0);
  assert.match(buildScript('abrir_copia'), /SESION_AMBIGUA/);
});

test('CAD-OPEN-01 recuperación: apertura válida (con Dibujo1 sin guardar) → DXF→DWG continúa una sola vez y es idempotente', async () => {
  const e = entorno(); const c0 = compose(tunnelModel({})); const exp = expectedLayouts(c0);
  const dwgRel = '03 Trabajo/CAD/planos.dwg'; fs.mkdirSync(path.join(e.root, '03 Trabajo', 'CAD'), { recursive: true }); const dwgAbs = path.join(e.root, dwgRel);
  const seq = [];
  const c = cad(e.sb, async (script, input) => {
    if (input.dwg) { seq.push('laminas_a_dwg'); fs.writeFileSync(dwgAbs, 'AC1032 synthetic'); return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true } }); }
    if (input.ruta && !input.ruta_esperada) { seq.push('abrir_copia'); return JSON.stringify({ ok: true, data: { documento: 'copia.dxf', ruta: e.abs, reutilizado: false, guardado: true, sin_guardar: ['Dibujo1.dwg'] } }); }
    seq.push('inspeccionar'); const layouts = exp.map(l => ({ nombre: l.name, viewports: l.viewports.map(v => ({ centro_papel: [...v.paperCenter], ancho: v.width, alto: v.height, escala: v.scale, bloqueado: true, centro_vista: [...v.modelCenter] })) }));
    return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true, unidades: 6, layouts } });
  });
  const abierto = await c.abrirCopia('Piloto', e.rel); assert.deepEqual(abierto.sin_guardar, ['Dibujo1.dwg']);
  const r1 = await c.guardarLaminas('Piloto', { dxf: e.rel, dwg: dwgRel, operacion: 'open01', composition: c0 });
  assert.equal(r1.dwg_validado_autocad_real, false); assert.equal(r1.verificacion_layouts.ok, true);
  const r2 = await c.guardarLaminas('Piloto', { dxf: e.rel, dwg: dwgRel, operacion: 'open01', composition: c0 });
  assert.equal(r2.reused, true); assert.deepEqual(seq, ['abrir_copia', 'abrir_copia', 'laminas_a_dwg', 'inspeccionar'], 'la 2.ª exportación (verificada) no toca AutoCAD: ni apertura ni guardado repetidos');
});

test('CAD-OPEN-01 exportar_dwg: documento abierto con cambios / solo lectura / otra ruta se distinguen, sin escribir', async () => {
  const e = entorno(); const c0 = compose(tunnelModel({})); const dwgRel = '03 Trabajo/CAD/out.dwg'; fs.mkdirSync(path.join(e.root, '03 Trabajo', 'CAD'), { recursive: true });
  for (const [codigo, code] of [['CAMBIOS_SIN_GUARDAR', 'CAMBIOS_SIN_GUARDAR'], ['DOCUMENTO_SOLO_LECTURA', 'DOCUMENTO_SOLO_LECTURA'], ['DOCUMENTO_CAMBIO', 'DOCUMENTO_CAMBIO']]) {
    let n = 0; const c = cad(e.sb, async (script, input) => { if (!input.dwg) return JSON.stringify({ ok: true, data: { documento: 'copia.dxf', ruta: e.abs } }); n++; assert.match(script, /SaveAs/); return JSON.stringify({ ok: false, etapa: 'verificar_documento', codigo, diag: { documento: 'copia.dxf', solo_lectura: false, guardado: false } }); });
    await assert.rejects(c.guardarLaminas('Piloto', { dxf: e.rel, dwg: dwgRel, operacion: `neg-${codigo}`, composition: c0 }), err => err.code === code && err.detalle.diagnostico.documento === 'copia.dxf');
    assert.equal(n, 1); assert.ok(!fs.existsSync(path.join(e.root, dwgRel)));
  }
  const s = SCRIPTS.laminas_a_dwg; assert.ok(s.indexOf('DOCUMENTO_SOLO_LECTURA') < s.indexOf('SaveAs')); assert.ok(s.indexOf('CAMBIOS_SIN_GUARDAR') < s.indexOf('SaveAs'));
});
