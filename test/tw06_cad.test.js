import { politicaDePrueba } from './helpers_com.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MATRIZ, ENTIDADES, OPERACIONES, matrizMarkdown } from '../src/cad/capabilities.js';
import { detectarAutoCad, parseRegQuery } from '../src/cad/detect.js';
import { AutoCadCom, SCRIPTS, buildScript, normalizarRuta } from '../src/cad/autocad_com.js';
import { sanitizar } from '../src/cad/sanitize.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { createServer } from '../src/server.js';
import { ROOT, tmpHome } from './helpers.js';

test('matriz: completa, sin SUPPORTED sin evidencia real en tests, y autocad_com sin SUPPORTED', () => {
  for (const b of Object.keys(MATRIZ)) for (const e of ENTIDADES) for (const op of OPERACIONES) {
    const c = MATRIZ[b][e][op]; assert.ok(c && ['SUPPORTED', 'UNSUPPORTED', 'UNVERIFIED'].includes(c.estado), `${b}/${e}/${op}`);
    if (c.estado === 'SUPPORTED' && b === 'dxf_archivo') {
      const [file, frag] = c.evidencia.split(' :: ');
      const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
      assert.ok(frag && body.includes(frag), `evidencia inexistente: ${c.evidencia}`);
    }
  }
  // autocad_com: SUPPORTED solo con evidencia REAL documentada (producto, versión de la extensión, fuente, fecha) y solo las celdas ejecutadas
  const soportadas = [];
  for (const e of ENTIDADES) for (const op of OPERACIONES) {
    const c = MATRIZ.autocad_com[e][op];
    if (c.estado === 'SUPPORTED') { soportadas.push(`${e}.${op}`); assert.ok(c.real && c.real.producto && c.real.extension && c.real.fuente && c.real.fecha, `evidencia real incompleta: ${e}.${op}`); assert.equal(c.real.reproducible_en_ci, false); }
  }
  assert.deepEqual(soportadas.sort(), ['LINE.editar_en_copia', 'LINE.longitud'], 'no se declaran verificadas operaciones no ejecutadas');
  for (const k of [['LINE', 'leer'], ['LINE', 'detectar'], ['LWPOLYLINE', 'longitud'], ['3DSOLID', 'volumen'], ['LINE', 'exportar']]) assert.equal(MATRIZ.autocad_com[k[0]][k[1]].estado, 'UNVERIFIED');
  // 3D ACIS: volumen NO soportado en DXF (nunca inventado)
  for (const t of ['3DSOLID', 'REGION', 'SURFACE']) assert.equal(MATRIZ.dxf_archivo[t].volumen.estado, 'UNSUPPORTED');
});

test('docs/qa/CAD_CAPABILITY_MATRIX.md está al día con el código', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, 'docs', 'qa', 'CAD_CAPABILITY_MATRIX.md'), 'utf8').replace(/\r\n/g, '\n'), `${matrizMarkdown()}\n`);
});

test('detección: parseo del registro, LT, no Windows y fallos que NO prueban ausencia', () => {
  const out = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\AutoCAD\\R25.0\\ACAD-8101:409\r\n    ProductName    REG_SZ    AutoCAD 2025 - Español\r\n\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\AutoCAD\\R25.0\\ACADLT-9\r\n    ProductName    REG_SZ    AutoCAD LT 2025\r\n';
  const p = parseRegQuery(out);
  assert.equal(p.length, 2); assert.equal(p[0].release, 'R25.0'); assert.equal(p[0].es_lt, false); assert.equal(p[1].es_lt, true);
  const full = detectarAutoCad({ platform: 'win32', run: () => out });
  assert.equal(full.instalado, true); assert.equal(full.compatible, true); assert.equal(full.verificado_en_autocad_real, false);
  const lt = detectarAutoCad({ platform: 'win32', run: () => out.split('\r\n\r\n')[1] });
  assert.equal(lt.compatible, false); assert.match(lt.advertencia, /LT/);
  assert.equal(detectarAutoCad({ platform: 'linux' }).estado, 'no_windows');
  // consulta fallida (timeout / reg ausente / error): DESCONOCIDO, nunca "no instalado"
  for (const err of [Object.assign(new Error('x'), { code: 'ETIMEDOUT' }), Object.assign(new Error('x'), { code: 'ENOENT' }), Object.assign(new Error('x'), { status: 5 })]) {
    const r = detectarAutoCad({ platform: 'win32', run: () => { throw err; } });
    assert.equal(r.instalado, null); assert.equal(r.estado, 'desconocido'); assert.match(r.motivo, /COM igualmente/);
  }
  // clave inexistente (reg.exe status 1 localizado): no encontrado, pero se sigue intentando COM
  const nf = detectarAutoCad({ platform: 'win32', run: () => { throw Object.assign(new Error('x'), { status: 1 }); } });
  assert.equal(nf.instalado, false); assert.equal(nf.estado, 'no_encontrado');
  // una rama falla y la otra responde: se aprovecha la que responde
  let n = 0; const mixto = detectarAutoCad({ platform: 'win32', run: () => { if (n++ === 0) throw Object.assign(new Error('x'), { code: 'ETIMEDOUT' }); return out; } });
  assert.equal(mixto.instalado, true);
});

test('saneamiento: sin rutas, usuarios ni correos', () => {
  const t = sanitizar('Error en C:\\Users\\EliteBook\\Documents\\\'Tannia Workspace\\Proyectos\\x.dwg y \\\\srv\\share\\a.dwg de bob@correo.cl ' + '\u0001' + 'fin');
  assert.ok(!/EliteBook|Tannia Workspace|srv|bob@/.test(t), t);
  assert.match(t, /<ruta>/);
  assert.ok(sanitizar('x'.repeat(1000)).length <= 241);
});

test('normalizarRuta: prefijo \\\\?\\ y NFC sin alterar el contenido Unicode', () => {
  assert.equal(normalizarRuta('\\\\?\\C:\\a\\b.dwg'), 'C:\\a\\b.dwg');
  assert.equal(normalizarRuta('\\\\?\\UNC\\srv\\s\\a.dwg'), '\\\\srv\\s\\a.dwg');
  assert.equal(normalizarRuta('C:\\integracio\u0301n.dwg'), 'C:\\integraci\u00f3n.dwg'); // NFD -> NFC
  assert.equal(normalizarRuta('C:\\Prueba de integración \'ñ\\a.dwg'), 'C:\\Prueba de integración \'ñ\\a.dwg');
});

test('contrato COM: scripts estáticos; sin comandos destructivos; Delete/Save/Close/Open solo donde corresponde; sin enumeración COM frágil ni conversiones a 0', () => {
  for (const n of Object.keys(SCRIPTS)) {
    const s = buildScript(n);
    assert.ok(!/\b(Erase|Purge|Quit|Remove-Item|Invoke-Expression|iex|Start-Process|Kill)\b/i.test(s), `script ${n} contiene comando prohibido`);
    // SendCommand: SOLO para pedir el estilo visual en los scripts 3D (comando fijo, nunca construido con datos del usuario)
    if (!['construir_3d', 'vista_3d'].includes(n)) assert.ok(!/SendCommand/i.test(s), `${n}: SendCommand no permitido`);
    if (!['dxf_a_dwg', 'construir_3d', 'laminas_a_dwg'].includes(n)) assert.ok(!/SaveAs/i.test(s), `${n}: SaveAs no permitido`);
    assert.ok(!/"[^"]*\$in\.[^"]*"/.test(SCRIPTS[n]), `script ${n} interpola datos del usuario dentro de una cadena`);
    if (!['agregar_lineas', 'construir_3d'].includes(n)) assert.ok(!/\.Delete\(/.test(s), `${n}: Delete no permitido`);
    if (!['agregar_lineas', 'transformar_solido'].includes(n)) assert.ok(!/\.Save\(/.test(s), `${n}: Save no permitido`);
    if (!['cerrar_reabrir', 'construir_3d'].includes(n)) assert.ok(!/\.Close\(/.test(s), `${n}: Close no permitido`);
    // CAD-OPEN-01 (3.ª): Documents.Open es DWG-only (abrir_copia, cerrar_reabrir); un DXF jamás llega a Open: se importa en un documento aislado
    if (!['cerrar_reabrir', 'abrir_copia'].includes(n)) assert.ok(!/Documents\.Open\(/.test(s), `${n}: Open no permitido`);
    if (n !== 'importar_dxf_aislado') assert.ok(!/\.Import\(/.test(s), `${n}: Import solo en importar_dxf_aislado`);
    if (!['construir_3d', 'importar_dxf_aislado'].includes(n)) assert.ok(!/Documents\.Add\(/.test(s), `${n}: Documents.Add solo en construir_3d e importar_dxf_aislado`);
    // Causa raíz de "capas: []": `foreach` sobre colecciones COM de AutoCAD no enumera de forma fiable → se recorre por índice
    assert.ok(!/foreach \(\$\w+ in \$\w*\.?(ModelSpace|Layers|Documents)\b/.test(s), `${n}: enumeración COM con foreach (usar índices)`);
    assert.ok(!/foreach \(\$\w+ in \$(doc|d|acad|objetivo|nuevo)\.(ModelSpace|Layers|Documents)\)/.test(s), `${n}: foreach sobre colección COM`);
    // Causa raíz de "longitud 0": [double]$null es 0. Las propiedades COM solo se leen con DNum/DArr/DBool (null si no existen)
    assert.ok(!/\[double\]\$e\.\w+/.test(s) && !/\[double\[\]\]\$e\.\w+/.test(s.replace(/function DArr[^\n]*\n/, '')), `${n}: conversión directa de una propiedad COM (usar DNum/DArr)`);
  }
  // 3D: el único Close es sobre el documento NUEVO que el propio script creó (nunca sobre dibujos del usuario); el estilo es un comando fijo
  const c3 = SCRIPTS.construir_3d;
  assert.deepEqual([...c3.matchAll(/(\$\w+)\.Close\(([^)]*)\)/g)].map((m) => `${m[1]}.Close(${m[2]})`), ['$d.Close($false)']);
  assert.ok(c3.indexOf('Documents.Add') < c3.indexOf('$d.Close') && /\$d = \$acad\.Documents\.Add\(\)/.test(c3));
  assert.ok(!/\$doc\./.test(c3.replace(/\$doc = /g, '')), 'construir_3d no toca el documento activo previo ($doc)');
  assert.ok(SCRIPTS.vista_3d.indexOf('ruta_esperada') < SCRIPTS.vista_3d.indexOf('Layers') && SCRIPTS.transformar_solido.indexOf('ruta_esperada') < SCRIPTS.transformar_solido.indexOf('HandleToObject'), 'las escrituras sobre el dibujo activo verifican ruta_esperada primero');
  assert.ok(!/\.Delete\(/.test(SCRIPTS.transformar_solido) && !/SaveAs/.test(SCRIPTS.transformar_solido));
  const a = SCRIPTS.agregar_lineas;
  assert.deepEqual([...new Set([...a.matchAll(/\$(\w+)\.Delete\(/g)].map((m) => m[1]))].sort(), ['capaObj', 'e']);
  assert.equal([...a.matchAll(/\.Save\(/g)].length, 1);
  assert.ok(a.indexOf('Layers.Add') < a.indexOf('StartUndoMark') && a.indexOf('StartUndoMark') < a.indexOf('AddLine'));
  assert.ok(a.indexOf('ruta_esperada') < a.indexOf('Layers'));
  const p = SCRIPTS.cerrar_reabrir;
  assert.deepEqual([...p.matchAll(/\.Close\(([^)]*)\)/g)].map((m) => m[1]), ['$false'], 'un único Close, sin guardar');
  assert.ok(p.indexOf('Saved') < p.indexOf('.Close('), 'se exige Saved=true ANTES de cerrar');
  assert.ok(p.indexOf('ruta_esperada') < p.indexOf('.Close('), 'se localiza el documento exacto antes de cerrar');
  assert.ok(p.indexOf('.Close(') < p.indexOf('Documents.Open('), 'cierra y luego reabre');
  const g = SCRIPTS.dxf_a_dwg;
  assert.deepEqual([...g.matchAll(/SaveAs\(([^)]*)\)/g)].map((m) => m[1]), ['[string]$in.dwg, 64', '[string]$in.dwg'], 'SaveAs solo hacia la ruta nueva indicada por Node');
  assert.ok(!/\.Delete\(|\.Close\(/.test(g));
  assert.ok(g.indexOf('TextString') < g.indexOf('SaveAs('), 'los textos se normalizan ANTES de guardar el DWG');
  assert.throws(() => buildScript('rm -rf'));
});

function fakeRunner({ activePath, calls, onScript }) {
  return async (script, input) => {
    const name = Object.keys(SCRIPTS).find((k) => script.includes(SCRIPTS[k]));
    calls.push({ name, input });
    if (onScript) { const r = onScript(name, input); if (r !== undefined) return r; }
    const data = {
      estado: { version: '26.0s', nombre: 'AutoCAD', progid: 'AutoCAD.Application.26', documento: activePath.split(/[\\/]/).pop(), ruta: activePath, guardado: true, unidades_insunits: 4 },
      listar: { entidades: [{ handle: '2A', tipo: 'AcDbLine', capa: 'MUROS', longitud: 6000 }], truncado: false },
      medir: { handle: input.handle, tipo: 'AcDb3dSolid', capa: '3D', Volume: 24 },
      abrir_copia: { documento: path.basename(input.ruta || ''), ruta: input.ruta },
      agregar_lineas: { handles: input.lineas?.map((_, i) => `H${i}`), capa_creada: !!input.capa },
      leer_lote: { unidades_insunits: 4, documento: 'x.dwg', entidades: input.handles?.map((h) => ({ handle: h, tipo: 'AcDbLine', capa: 'TW_PRUEBA', longitud: 1, inicio: [0, 0, 0], fin: [1, 0, 0] })) },
      enumerar: { total: 0, entidades: [], siguiente: null },
      resumen: { documento: 'x.dwg', ruta: activePath, guardado: true, entidades: 0, capas: ['0'], entidades_por_capa: {}, entidades_por_tipo: {}, unidades_insunits: 4 },
      cerrar_reabrir: { documento: 'x.dwg', guardado: true, entidades: 0, unidades_insunits: 4 },
    }[name];
    return JSON.stringify({ ok: true, data });
  };
}
const R = (obj) => async () => JSON.stringify(obj);

test('autorización: copia en 03 Trabajo con ó, ñ, espacios y apóstrofo SÍ; originales, enlaces y rutas ilegibles NO (fallan cerrado)', async (t) => {
  const home = tmpHome("'Tannia Workspace ó ñ "); const sb = new Sandbox(home); createProject(sb, "Prueba de integración 'ñ");
  const P = "Prueba de integración 'ñ"; const root = path.join(home, 'Proyectos', P);
  const orig = path.join(root, '02 Originales', 'Dibujo2 - integración.dwg'); const work = path.join(root, '03 Trabajo', "Dibujo2 - copia de trabajo ñ'.dwg");
  fs.writeFileSync(orig, 'x'); fs.writeFileSync(work, 'AC1032 synthetic work copy header'); fs.writeFileSync(path.join(root, '04 Cubicaciones', 'o.dwg'), 'x'); fs.writeFileSync(path.join(home, 'otro.dwg'), 'x');
  const calls = [];
  const com = (active, extra = {}) => new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, platform: 'win32', runner: fakeRunner({ activePath: active, calls, ...extra }) });
  const L = { lineas: [{ x1: 0, y1: 0, x2: 6000, y2: 0 }], capa: 'TW_PRUEBA' };

  const ok = await com(work).agregarLineas(P, L);
  assert.equal(ok.cantidad, 1);
  assert.equal(calls.find((c) => c.name === 'agregar_lineas').input.ruta_esperada, work, 'la ruta esperada viaja byte a byte');
  for (const [active, code] of [[orig, 'ORIGINAL_PROTEGIDO'], [path.join(root, '04 Cubicaciones', 'o.dwg'), 'DOCUMENTO_FUERA_DE_TRABAJO'], [path.join(home, 'otro.dwg'), 'DOCUMENTO_FUERA_DEL_PROYECTO'],
    ['Dibujo1.dwg', 'DOCUMENTO_NO_GUARDADO'], [work.replace('ñ', '\uFFFD'), 'DOCUMENTO_NO_ENCONTRADO'], [path.join(root, '03 Trabajo', 'no existe.dwg'), 'DOCUMENTO_NO_ENCONTRADO']]) {
    calls.length = 0;
    await assert.rejects(() => com(active).agregarLineas(P, L), (e) => e.code === code, `${code} para ${path.basename(active)}`);
    assert.ok(!calls.some((c) => c.name === 'agregar_lineas'), `no se escribió (${code})`);
  }
  // la causa de una ruta corrupta se distingue de "original": detalle seguro, sin la ruta
  await assert.rejects(() => com(work.replace('ñ', '\uFFFD')).agregarLineas(P, L), (e) => e.detalle.contiene_caracter_reemplazo === true && !JSON.stringify(e.detalle).includes('Tannia') && e.code !== 'ORIGINAL_PROTEGIDO');
  // enlace simbólico en 03 Trabajo que apunta a un original: sigue siendo original
  const link = path.join(root, '03 Trabajo', 'enlace.dwg');
  try { fs.symlinkSync(orig, link); await assert.rejects(() => com(link).agregarLineas(P, L), (e) => e.code === 'ORIGINAL_PROTEGIDO'); } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') t.diagnostic('symlinks no disponibles'); else throw e; }
  // abrir: original rechazado, copia aceptada
  await assert.rejects(() => com(orig).abrirCopia(P, '02 Originales/Dibujo2 - integración.dwg'), (e) => e.code === 'ORIGINAL_PROTEGIDO');
  assert.equal((await com(work).abrirCopia(P, "03 Trabajo/Dibujo2 - copia de trabajo ñ'.dwg")).ruta, fs.realpathSync.native(work));
  fs.rmSync(home, { recursive: true, force: true });
});

test('validación de entradas (capa, handle, coordenadas, tamaño del lote) antes de tocar AutoCAD', async () => {
  const home = tmpHome(); const sb = new Sandbox(home); createProject(sb, 'P');
  const calls = []; const work = path.join(home, 'Proyectos', 'P', '03 Trabajo', 'c.dwg'); fs.writeFileSync(work, 'x');
  const com = new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, platform: 'win32', runner: fakeRunner({ activePath: work, calls }) });
  const one = { lineas: [{ x1: 0, y1: 0, x2: 1, y2: 1 }] };
  for (const capa of ["TW'; Quit", 'a/b', 'a;b', 'a<b', '', 'x'.repeat(256)]) await assert.rejects(() => com.agregarLineas('P', { ...one, capa }), (e) => e.code === 'DATO_INVALIDO', capa);
  for (const bad of [{ lineas: [] }, { lineas: Array(101).fill(one.lineas[0]) }, { lineas: [{ x1: NaN, y1: 0, x2: 1, y2: 1 }] }, { lineas: [{ x1: 0, y1: 0, x2: 1 }] }]) await assert.rejects(() => com.agregarLineas('P', bad), (e) => e.code === 'DATO_INVALIDO');
  for (const h of ["2A'; Erase", '', 'ZZ', '1'.repeat(20)]) await assert.rejects(() => com.medirEntidad(h), (e) => e.code === 'DATO_INVALIDO');
  await assert.rejects(() => com.listarEntidades({ capa: "X'; Quit" }), (e) => e.code === 'DATO_INVALIDO');
  assert.equal(calls.length, 0, 'ninguna entrada inválida llegó a AutoCAD');
  assert.equal((await com.medirEntidad('2A')).Volume, 24);
  assert.equal((await com.listarEntidades({ medidas: true })).entidades[0].longitud, 6000);
  assert.equal(calls.at(-1).input.medidas, true);
  fs.rmSync(home, { recursive: true, force: true });
});

test('contrato COM: errores por etapa, causas separadas, reintento si AutoCAD está ocupado, sin datos sensibles', async () => {
  const sb = new Sandbox(tmpHome());
  const mk = (runner, extra = {}) => new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, runner, platform: 'win32', sleep: async () => {}, ...extra });
  await assert.rejects(() => new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, runner: async () => '', platform: 'linux' }).estado(), (e) => e.code === 'AUTOCAD_NO_DISPONIBLE');
  // proceso: clases seguras y stderr saneado otra vez
  await assert.rejects(() => mk(async () => { throw Object.assign(new Error('x'), { clase: 'tiempo_agotado', codigo_salida: null, stderr: 'fallo en C:\\Users\\Bob\\x' }); }).estado(),
    (e) => e.code === 'AUTOCAD_ERROR' && e.detalle.clase === 'tiempo_agotado' && !JSON.stringify(e.detalle).includes('Bob') && /no respondió/.test(e.hint));
  await assert.rejects(() => mk(async () => { throw Object.assign(new Error('x'), { clase: 'politica_ejecucion' }); }).estado(), (e) => /política/.test(e.hint));
  await assert.rejects(() => mk(async () => 'basura').estado(), (e) => e.code === 'AUTOCAD_RESPUESTA_INVALIDA');
  // conexión: no abierto / elevación / sin documento
  await assert.rejects(() => mk(R({ ok: false, etapa: 'conectar', codigo: 'AUTOCAD_NO_ABIERTO', intentos: ['AutoCAD.Application=0x800401E3'] })).estado(), (e) => e.code === 'AUTOCAD_NO_ABIERTO' && /administrador/.test(e.hint) && e.detalle.intentos.length === 1);
  await assert.rejects(() => mk(R({ ok: false, etapa: 'conectar', codigo: 'AUTOCAD_NO_ABIERTO', intentos: ['AutoCAD.Application.26=0x80070005'] })).estado(), (e) => e.code === 'AUTOCAD_ACCESO_DENEGADO');
  await assert.rejects(() => mk(R({ ok: false, etapa: 'documento_activo', codigo: 'SIN_DOCUMENTO' })).estado(), (e) => e.code === 'AUTOCAD_SIN_DOCUMENTO');
  // ocupado: reintenta y se recupera
  let n = 0; const busy = async () => (++n < 3 ? JSON.stringify({ ok: false, etapa: 'operacion_estado', hresult: '0x80010001', tipo: 'COMException', msg: 'Llamada rechazada por el destinatario.' }) : JSON.stringify({ ok: true, data: { documento: 'a.dwg' } }));
  assert.equal((await mk(busy).estado()).documento, 'a.dwg'); assert.equal(n, 3);
  let m = 0; await assert.rejects(() => mk(async () => { m++; return JSON.stringify({ ok: false, etapa: 'operacion_estado', hresult: '0x8001010A', msg: 'x' }); }).estado(), (e) => e.code === 'AUTOCAD_OCUPADO'); assert.equal(m, 3);
  await assert.rejects(() => mk(R({ ok: false, etapa: 'operacion_estado', hresult: '0x800706BA', msg: 'RPC' })).estado(), (e) => e.code === 'AUTOCAD_RPC');
  // genérico: etapa + HRESULT + mensaje saneado (sin rutas)
  await assert.rejects(() => mk(R({ ok: false, etapa: 'operacion_listar', hresult: '0x80020009', tipo: 'COMException', msg: 'Excepción en C:\\Users\\Bob\\Dibujo.dwg' })).listarEntidades(),
    (e) => e.code === 'AUTOCAD_ERROR' && e.detalle.etapa === 'operacion_listar' && e.detalle.hresult === '0x80020009' && !JSON.stringify(e.detalle).includes('Bob'));
});

test('escritura todo-o-nada: capa no creada, dibujo revertido, documento cambiado y guardado fallido se informan por separado', async () => {
  const home = tmpHome(); const sb = new Sandbox(home); createProject(sb, 'P');
  const work = path.join(home, 'Proyectos', 'P', '03 Trabajo', 'c.dwg'); fs.writeFileSync(work, 'x');
  const L = { lineas: [{ x1: 0, y1: 0, x2: 6000, y2: 0 }], capa: 'TW_PRUEBA' };
  const com = (resp) => new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, platform: 'win32', runner: fakeRunner({ activePath: work, calls: [], onScript: (n) => (n === 'agregar_lineas' ? JSON.stringify(resp) : undefined) }) });
  await assert.rejects(() => com({ ok: false, etapa: 'preparar_capa', hresult: '0x80020009', msg: 'x' }).agregarLineas('P', L), (e) => e.code === 'CAPA_NO_DISPONIBLE');
  await assert.rejects(() => com({ ok: false, etapa: 'dibujar', hresult: '0x80020009', msg: 'x', revertido: true, capa_revertida: true }).agregarLineas('P', L), (e) => e.code === 'DIBUJO_REVERTIDO' && e.detalle.revertido === true && e.detalle.capa_revertida === true);
  await assert.rejects(() => com({ ok: false, etapa: 'verificar_documento', codigo: 'DOCUMENTO_CAMBIO' }).agregarLineas('P', L), (e) => e.code === 'DOCUMENTO_CAMBIO');
  await assert.rejects(() => com({ ok: false, etapa: 'guardar', codigo: 'GUARDADO_FALLO', handles: ['1A', '1B'], hresult: '0x80020009' }).agregarLineas('P', L), (e) => e.code === 'GUARDADO_FALLO' && e.detalle.handles.length === 2);
  fs.rmSync(home, { recursive: true, force: true });
});

test('MCP: estado separa registro y COM (registro fallido + COM vivo => conectado); COM caído => causa separada; sin rutas ajenas', async () => {
  const home = tmpHome(); const calls = [];
  const active = 'C:\\Users\\EliteBook\\Dibujos privados\\cliente.dwg';
  const mk = async (detectar, runner) => {
    const { server } = createServer({ home, cadRunner: runner, platform: 'win32', detectar });
    const [a, b] = InMemoryTransport.createLinkedPair(); const client = new Client({ name: 't', version: '1' });
    await Promise.all([server.connect(a), client.connect(b)]); return client;
  };
  const regFalla = () => ({ instalado: null, estado: 'desconocido', motivo: 'No se pudo consultar el registro' });
  let c = await mk(regFalla, fakeRunner({ activePath: active, calls }));
  let st = (await c.callTool({ name: 'tannia_cad_estado', arguments: {} })).structuredContent;
  assert.equal(st.instalacion_registro.estado, 'desconocido'); assert.equal(st.conexion_com.conectado, true);
  assert.equal(st.conexion_com.sesion.ubicacion_documento.clase, 'no_resoluble'); assert.equal(st.conexion_com.sesion.documento, 'cliente.dwg');
  assert.ok(!JSON.stringify(st).includes('EliteBook') && !JSON.stringify(st).includes('privados'), 'no filtra rutas fuera de Tannia');
  assert.equal(calls.filter((x) => x.name === 'estado').length, 1, 'COM se intentó pese al fallo del registro');
  await c.close();
  c = await mk(() => ({ instalado: true, estado: 'instalado', compatible: true }), R({ ok: false, etapa: 'conectar', codigo: 'AUTOCAD_NO_ABIERTO', intentos: [] }));
  st = (await c.callTool({ name: 'tannia_cad_estado', arguments: {} })).structuredContent;
  assert.equal(st.instalacion_registro.instalado, true); assert.equal(st.conexion_com.conectado, false); assert.equal(st.conexion_com.codigo, 'AUTOCAD_NO_ABIERTO');
  await c.close(); fs.rmSync(home, { recursive: true, force: true });
});

test('MCP: herramientas CAD (matriz, listado, lote) y validación de esquema', async () => {
  const home = tmpHome(); const calls = [];
  const { server } = createServer({ home, cadRunner: fakeRunner({ activePath: 'C:\\x\\a.dwg', calls }), platform: 'win32', detectar: () => ({ instalado: true, estado: 'instalado', compatible: true }) });
  const [a, b] = InMemoryTransport.createLinkedPair(); const client = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const cap = (await client.callTool({ name: 'tannia_cad_capacidades', arguments: {} })).structuredContent;
  assert.equal(cap.autocad_com.conteo.SUPPORTED, 2); assert.ok(cap.dxf_archivo.conteo.SUPPORTED > 20);
  const l = await client.callTool({ name: 'tannia_cad_listar_entidades', arguments: { con_medidas: true } });
  assert.equal(l.structuredContent.entidades[0].longitud, 6000);
  const bad = await client.callTool({ name: 'tannia_cad_medir_entidad', arguments: { handle: 'ZZ;' } });
  assert.equal(bad.isError, true); assert.equal(bad.structuredContent.error, 'DATO_INVALIDO');
  const tools = (await client.listTools()).tools.map((t) => t.name); assert.ok(tools.includes('tannia_cad_agregar_lineas'));
  const vacio = await client.callTool({ name: 'tannia_cad_agregar_lineas', arguments: { proyecto: 'P', lineas: [] } });
  assert.equal(vacio.isError, true);
  await client.close(); fs.rmSync(home, { recursive: true, force: true });
});


const RECT = (h = ['39A', '39B', '39C', '39D']) => [
  { handle: h[0], tipo: 'AcDbLine', capa: 'TW_PRUEBA', longitud: 6000, inicio: [0, 0, 0], fin: [6000, 0, 0] },
  { handle: h[1], tipo: 'AcDbLine', capa: 'TW_PRUEBA', longitud: 4000, inicio: [6000, 0, 0], fin: [6000, 4000, 0] },
  { handle: h[2], tipo: 'AcDbLine', capa: 'TW_PRUEBA', longitud: 6000, inicio: [6000, 4000, 0], fin: [0, 4000, 0] },
  { handle: h[3], tipo: 'AcDbLine', capa: 'TW_PRUEBA', longitud: 4000, inicio: [0, 4000, 0], fin: [0, 0, 0] }];

test('verificar contorno: lee extremos por COM y concluye cierre del rectángulo 6000×4000 (cálculo independiente)', async () => {
  const sb = new Sandbox(tmpHome());
  const calls = [];
  const com = new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, platform: 'win32', runner: fakeRunner({ activePath: '/x/a.dwg', calls, onScript: (n, i) => (n === 'leer_lote' ? JSON.stringify({ ok: true, data: { ruta: '/x/a.dwg', unidades_insunits: 4, documento: 'a.dwg', entidades: RECT().filter((e) => i.handles.includes(e.handle)) } }) : undefined) }) });
  const r = await com.verificarContorno(['39A', '39B', '39C', '39D'], { ancho: 6000, alto: 4000 });
  assert.equal(r.analisis.cerrado, true); assert.equal(r.analisis.es_rectangulo, true); assert.equal(r.analisis.estado, 'ok');
  assert.equal(r.analisis.area, 24000000); assert.equal(r.analisis.perimetro, 20000); assert.equal(r.analisis.dimensiones_coinciden_con_lo_esperado, true);
  assert.deepEqual(calls.at(-1).input.handles, ['39A', '39B', '39C', '39D']);
  const mal = await com.verificarContorno(['39A', '39B', '39C'], { ancho: 6000, alto: 4000 });
  assert.equal(mal.analisis.cerrado, false); assert.equal(mal.analisis.estado, 'needs_review');
  await assert.rejects(() => com.leerGeometria(["39A'; Erase"]), (e) => e.code === 'DATO_INVALIDO');
  await assert.rejects(() => com.leerGeometria([]), (e) => e.code === 'DATO_INVALIDO');
});

