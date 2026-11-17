// CAD-OPEN-02: excepción tras Documents.Add (documento aislado vacío), diagnóstico visible para clientes que no leen structuredContent,
// registro persistente del estado parcial, bloqueo de nuevas importaciones, inspección de solo lectura y reconciliación sin borrar marcas.
// El runner SIMULA lo que devuelven los scripts: no acredita nada sobre AutoCAD 2027 real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { tmpHome } from './helpers.js';
import { createServer } from '../src/server.js';
import { buildScript } from '../src/cad/autocad_com.js';
import { listarMarcas, dirOperaciones } from '../src/cad/marcas.js';
import { tunnelModel, compose } from '../src/drawing/model.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { diagnosticoVisible } from '../src/mcp/util.js';

const dxf = buildDrawingDxf(compose(tunnelModel({})));
const esReconc = (s) => /aislado_presente = \$presente/.test(s);
const esInspeccion = (s) => /solo_lectura_inspeccion/.test(s);
const esImport = (s) => /Documents\.Add\(/.test(s);
const esReconcApertura = (s) => /ya_abierto = \$abierto/.test(s) && !esReconc(s);
const ETAPAS_HASTA_IMPORT = [{ etapa: 'conexion_com', estado: 'ok', t_ms: 90 }, { etapa: 'consulta_ocupacion', estado: 'ok', t_ms: 130 }, { etapa: 'enumerar_documentos', estado: 'ok', t_ms: 160 }, { etapa: 'crear_documento_aislado', estado: 'inicio', t_ms: 170 }, { etapa: 'crear_documento_aislado', estado: 'ok', t_ms: 410, dato: { nombre: 'Dibujo2' } }, { etapa: 'importar_dxf', estado: 'inicio', t_ms: 420 }];
const FALLO_EN_IMPORT = { ok: false, etapa: 'importar_dxf', hresult: '0x80020009', tipo: 'COMException', msg: 'Error de AutoCAD en Import de C:\\Users\\Alguien\\Proyectos\\x.dxf', diag: { documento_aislado: 'Dibujo2', entidades_aislado_tras_error: 0, error_import: 'Error en C:\\Users\\Alguien\\x.dxf', sin_guardar: ['Dibujo1.dwg', 'Dibujo2'], documentos: [{ nombre: 'Dibujo1.dwg', con_ruta_en_disco: false, guardado: false }, { nombre: 'Dibujo2', con_ruta_en_disco: false, guardado: true }] } };

async function mcp({ runner }) {
  const prev = process.env.TANNIA_ENGINEERING; process.env.TANNIA_ENGINEERING = 'on';
  const home = tmpHome('TW12 open02 ñ ');
  const { server } = createServer({ home, cadRunner: runner, platform: 'win32', detectar: () => ({ instalado: true, estado: 'instalado', compatible: true }) });
  if (prev === undefined) delete process.env.TANNIA_ENGINEERING; else process.env.TANNIA_ENGINEERING = prev;
  const [a, b] = InMemoryTransport.createLinkedPair(); const client = new Client({ name: 't', version: '1' }); await Promise.all([server.connect(a), client.connect(b)]);
  await client.callTool({ name: 'tannia_proyecto_crear', arguments: { nombre: 'Piloto' } });
  const root = path.join(home, 'Proyectos', 'Piloto'); const rel = '03 Trabajo/copia.dxf'; fs.writeFileSync(path.join(root, rel), dxf);
  const op = dirOperaciones(root);
  return { client, home, root, rel, op, close: async () => client.close() };
}
// Un cliente que SOLO muestra el texto (como Claude Desktop en el piloto): ignora structuredContent.
const soloTexto = (r) => r.content.map((c) => c.text).join('\n');

test('CAD-OPEN-02 excepción exacta tras Documents.Add (Dibujo2 vacío): el TEXTO visible trae etapa, HRESULT, excepción, mensaje saneado y últimas etapas; structuredContent se mantiene', async () => {
  const llamadas = [];
  const e = await mcp({ runner: async (script, input, opts) => {
    if (esReconc(script)) { llamadas.push('reconciliar'); return JSON.stringify({ ok: true, data: { aislado_presente: true, entidades_aislado: 0, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (esImport(script)) { llamadas.push('importar'); opts.trazas.push(...ETAPAS_HASTA_IMPORT); return JSON.stringify(FALLO_EN_IMPORT); }
    throw new Error('operación inesperada');
  } });
  try {
    const r = await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } });
    assert.equal(r.isError, true); const texto = soloTexto(r);
    for (const parte of ['ERROR APERTURA_FALLIDA', 'etapa=importar_dxf', 'operación=importar_dxf_aislado', 'HRESULT=0x80020009', 'excepción=COMException', 'Documento aislado: Dibujo2 (entidades en ModelSpace tras el error: 0)', 'Últimas etapas:', 'crear_documento_aislado:ok@410ms', 'importar_dxf:inicio@420ms', 'Estado parcial registrado: sí', 'Documentos sin guardar (no se tocaron): Dibujo1.dwg, Dibujo2', 'Reconciliación: aislado_presente · entidades=0'])
      assert.ok(texto.includes(parte), `falta en el texto visible: ${parte}\n${texto}`);
    assert.ok(!/Alguien|C:\\Users/.test(texto), 'sin rutas ni usuarios del equipo en el texto');
    // structuredContent sigue presente y completo
    const d = r.structuredContent.detalle; assert.equal(d.etapa, 'importar_dxf'); assert.equal(d.hresult, '0x80020009'); assert.equal(d.tipo_excepcion, 'COMException'); assert.equal(d.diagnostico.entidades_aislado_tras_error, 0); assert.ok(d.estado_parcial_registrado);
    // estado parcial PERSISTENTE (excepción, no solo timeout)
    const marcas = listarMarcas(e.op).filter((m) => m.tipo === 'importacion'); assert.equal(marcas.length, 1);
    assert.deepEqual([marcas[0].tipo_fallo, marcas[0].nombre_aislado, marcas[0].ultima_etapa, marcas[0].hresult, marcas[0].tipo_excepcion, marcas[0].entidades_vistas, marcas[0].resuelta], ['excepcion', 'Dibujo2', 'importar_dxf', '0x80020009', 'COMException', 0, false]);
    assert.ok(!/Alguien/.test(fs.readFileSync(marcas[0].file, 'utf8')), 'la marca no guarda rutas del equipo');
    assert.deepEqual(llamadas, ['importar', 'reconciliar'], 'una sola importación y una reconciliación de solo lectura');
  } finally { await e.close(); fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('CAD-OPEN-02 mientras exista un documento aislado pendiente NO se inicia otra importación (ni abrir_copia ni exportar_dwg); se bloquea con texto claro', async () => {
  const llamadas = [];
  const e = await mcp({ runner: async (script, input, opts) => {
    if (esReconc(script)) { llamadas.push('reconciliar'); return JSON.stringify({ ok: true, data: { aislado_presente: true, entidades_aislado: 0, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (esImport(script)) { llamadas.push('importar'); opts.trazas.push(...ETAPAS_HASTA_IMPORT); return JSON.stringify(FALLO_EN_IMPORT); }
    throw new Error('inesperada');
  } });
  try {
    await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } }); llamadas.length = 0;
    const r2 = await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } });
    const t = soloTexto(r2); assert.match(t, /ERROR IMPORTACION_PENDIENTE_SIN_RECONCILIAR/); assert.match(t, /Dibujo2/); assert.match(t, /inspeccionar_aislado/); assert.match(t, /SIN guardar/);
    assert.deepEqual(llamadas, ['reconciliar'], 'solo reconcilia: no se crea otro documento'); assert.equal(listarMarcas(e.op).filter((m) => m.tipo === 'importacion').length, 1, 'no se acumulan marcas por reintentos bloqueados');
  } finally { await e.close(); fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('CAD-OPEN-02 inspección de SOLO LECTURA: entidades, layouts, viewports y nombre del documento aislado; el script no puede modificar, activar, guardar ni cerrar', async () => {
  const s = buildScript('inspeccionar_aislado');
  assert.ok(!/\.Add\(|\.Import\(|\.Activate\(|SaveAs|\.Close\(|\.Save\(|\.Delete\(|SendCommand|Documents\.Open|\.SetVariable\(|\.TextString\s*=/.test(s), 'sin verbos de escritura');
  assert.ok([...s.matchAll(/ActiveDocument\.(\w+)/g)].every((m) => m[1] === 'GetVariable'));
  assert.match(s, /FullName -ceq \[string\]\$c0\.Name/); assert.match(s, /hallados\.Count -ne 1/);
  const e = await mcp({ runner: async (script, input, opts) => {
    if (esReconc(script)) return JSON.stringify({ ok: true, data: { aislado_presente: true, entidades_aislado: 0, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } });
    if (esImport(script)) { opts.trazas.push(...ETAPAS_HASTA_IMPORT); return JSON.stringify(FALLO_EN_IMPORT); }
    if (esInspeccion(script)) { assert.equal(input.nombre, 'Dibujo2'); assert.ok(!esImport(script)); return JSON.stringify({ ok: true, data: { encontrado: true, documento: 'Dibujo2', guardado: true, solo_lectura_inspeccion: true, medido: { entidades_modelo: 0, por_capa: {}, dimensiones: 0, con_traza: 0, ilegibles: 0, layouts: [{ nombre: 'Layout1', viewports: [], textos: [] }, { nombre: 'Layout2', viewports: [], textos: [] }] }, tipos_entidad: {}, documentos: [{ nombre: 'Dibujo1.dwg', con_ruta_en_disco: false, guardado: false }, { nombre: 'Dibujo2', con_ruta_en_disco: false, guardado: true }], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [7] } }); }
    throw new Error('inesperada');
  } });
  try {
    await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } });
    const r = await e.client.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Piloto', accion: 'inspeccionar_aislado' } }); assert.ok(!r.isError, soloTexto(r));
    const d = r.structuredContent; assert.equal(d.solo_lectura, true); assert.equal(d.documento, 'Dibujo2'); assert.equal(d.encontrado, true); assert.equal(d.entidades_modelo, 0); assert.deepEqual(d.layouts, [{ nombre: 'Layout1', viewports: 0, textos: 0 }, { nombre: 'Layout2', viewports: 0, textos: 0 }]);
    assert.equal(d.documentos.find((x) => x.nombre === 'Dibujo1.dwg').guardado, false, 'Dibujo1 solo se observa');
    // el nombre del documento no admite inyección
    const mal = await e.client.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Piloto', accion: 'inspeccionar_aislado', documento: 'x"; Remove-Item *' } }); assert.equal(mal.isError, true);
  } finally { await e.close(); fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('CAD-OPEN-02 reconciliación segura: las marcas se CONSERVAN; se resuelven por entrada de solo-adición solo con estado real limpio, y entonces se permite una importación explícita', async () => {
  let presente = true; const llamadas = [];
  const e = await mcp({ runner: async (script, input, opts) => {
    if (esReconc(script)) { llamadas.push('reconciliar'); return JSON.stringify({ ok: true, data: { aislado_presente: presente, entidades_aislado: presente ? 0 : null, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (esImport(script)) { llamadas.push('importar'); if (presente) { opts.trazas.push(...ETAPAS_HASTA_IMPORT); return JSON.stringify(FALLO_EN_IMPORT); } return JSON.stringify({ ok: true, data: { documento: 'Dibujo3', nombre_aislado: 'Dibujo3', ruta: 'Dibujo3', guardado: false, aislado: true, medido: null } }); }
    throw new Error('inesperada');
  } });
  try {
    await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } }); llamadas.length = 0;
    const antes = listarMarcas(e.op).filter((m) => m.tipo === 'importacion')[0];
    const r1 = await e.client.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Piloto', accion: 'reconciliar_marcas' } }); assert.equal(r1.structuredContent.resultados[0].resuelta, false); assert.equal(r1.structuredContent.resultados[0].estado, 'aislado_presente'); assert.match(r1.structuredContent.resultados[0].que_hacer, /SIN guardar/);
    assert.equal(r1.structuredContent.pendientes_restantes, 1);
    presente = false; // la persona cerró Dibujo2 sin guardar
    const r2 = await e.client.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Piloto', accion: 'reconciliar_marcas' } }); assert.equal(r2.structuredContent.resultados[0].resuelta, true); assert.equal(r2.structuredContent.pendientes_restantes, 0);
    assert.ok(fs.existsSync(antes.file), 'la marca original NO se borra'); assert.ok(fs.existsSync(antes.file.replace('.pendiente.json', '.resolucion.json')), 'resolución de solo-adición');
    assert.equal(JSON.parse(fs.readFileSync(antes.file, 'utf8')).creada, antes.creada, 'la marca no se modificó');
    const m2 = listarMarcas(e.op)[0]; assert.equal(m2.resuelta, true);
    llamadas.length = 0; const ok = await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } }); assert.ok(!/IMPORTACION_PENDIENTE_SIN_RECONCILIAR/.test(soloTexto(ok)), 'ya no está bloqueada');
    assert.deepEqual(llamadas.filter((x) => x === 'importar'), ['importar'], 'ahora sí: una única importación explícita');
  } finally { await e.close(); fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('CAD-OPEN-02 marcas históricas apertura-*.pendiente.json: se listan, no se borran ni bloquean importaciones, y se reconcilian con el archivo indicado (solo lectura)', async () => {
  const llamadas = [];
  const e = await mcp({ runner: async (script) => {
    if (esReconcApertura(script)) { llamadas.push('reconciliar_apertura'); return JSON.stringify({ ok: true, data: { abierto: false, documentos: [{ nombre: 'Dibujo1.dwg', con_ruta_en_disco: false, guardado: false }], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (esReconc(script)) { llamadas.push('reconciliar_importacion'); return JSON.stringify({ ok: true, data: { aislado_presente: false, entidades_aislado: null, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (esImport(script)) { llamadas.push('importar'); return JSON.stringify({ ok: true, data: { documento: 'Dibujo2', nombre_aislado: 'Dibujo2', ruta: 'Dibujo2', guardado: false, aislado: true, medido: null } }); }
    throw new Error('inesperada');
  } });
  try {
    // dos marcas históricas del formato anterior (sin marca de tiempo en el nombre)
    fs.mkdirSync(e.op, { recursive: true });
    const real = fs.realpathSync.native(path.join(e.root, e.rel)); const h = crypto.createHash('sha256').update(String(real).toLowerCase()).digest('hex').slice(0, 16);
    const h2 = 'a'.repeat(16); const viejas = [[h, '2026-11-16T22:00:00.000Z'], [h2, '2026-11-16T22:05:00.000Z']];
    for (const [hash, creada] of viejas) fs.writeFileSync(path.join(e.op, `apertura-${hash}.pendiente.json`), JSON.stringify({ schema: 'tw.cad.apertura_pendiente/1', operacion: 'abrir_copia', ultima_etapa: 'abrir_documento', estado: 'incierto', creada }));
    const lista = await e.client.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Piloto', accion: 'marcas' } }); const ms = lista.structuredContent.marcas; assert.equal(ms.length, 2); assert.ok(ms.every((m) => m.tipo === 'apertura' && m.resuelta === false));
    // no bloquean las importaciones (son del flujo Documents.Open anterior)
    await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } }); assert.ok(llamadas.includes('importar'), 'la importación no queda bloqueada por marcas históricas de apertura'); llamadas.length = 0;
    // sin archivo: no se puede reconciliar (la marca solo guarda el hash de la ruta)
    const sin = await e.client.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Piloto', accion: 'reconciliar_marcas' } }); assert.ok(sin.structuredContent.resultados.every((r) => r.resuelta === false && r.estado === 'requiere_archivo'));
    // con el archivo de la copia: la marca de esa ruta se resuelve; la otra permanece
    const con = await e.client.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Piloto', accion: 'reconciliar_marcas', archivo: e.rel } });
    const res = con.structuredContent.resultados; assert.equal(res.find((r) => r.estado === 'no_abierto').resuelta, true); assert.equal(res.filter((r) => r.estado === 'otra_ruta').length, 1); assert.equal(con.structuredContent.pendientes_restantes, 1);
    for (const [hash] of viejas) assert.ok(fs.existsSync(path.join(e.op, `apertura-${hash}.pendiente.json`)), 'ninguna marca histórica se borró');
    assert.ok(fs.existsSync(path.join(e.op, `apertura-${h}.resolucion.json`)));
  } finally { await e.close(); fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('CAD-OPEN-02 fallos ANTERIORES a crear el documento aislado (AutoCAD ocupado) no dejan marca ni bloquean; fallos en la medición sí (excepción tras Add)', async () => {
  let modo = 'ocupado';
  const e = await mcp({ runner: async (script, input, opts) => {
    if (esReconc(script)) return JSON.stringify({ ok: true, data: { aislado_presente: true, entidades_aislado: 29, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } });
    if (modo === 'ocupado') return JSON.stringify({ ok: false, etapa: 'preparar', codigo: 'AUTOCAD_OCUPADO', diag: { ocupacion: { quiescente: false, cmdactive: 0 } } });
    opts.trazas.push(...ETAPAS_HASTA_IMPORT.slice(0, 5), { etapa: 'importar_dxf', estado: 'ok', t_ms: 900 }, { etapa: 'medir_importado', estado: 'inicio', t_ms: 910 });
    return JSON.stringify({ ok: false, etapa: 'medir_importado', hresult: '0x80004005', tipo: 'COMException', msg: 'fallo midiendo layouts', diag: { documento_aislado: 'Dibujo2', entidades_aislado_tras_error: 29 } });
  } });
  try {
    const r = await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } }); assert.match(soloTexto(r), /ERROR AUTOCAD_OCUPADO/); assert.equal(listarMarcas(e.op).length, 0, 'nada parcial que registrar');
    modo = 'medir'; const r2 = await e.client.callTool({ name: 'tannia_cad_abrir_copia', arguments: { proyecto: 'Piloto', archivo: e.rel } }); const t = soloTexto(r2);
    assert.match(t, /etapa=medir_importado/); assert.match(t, /entidades en ModelSpace tras el error: 29/); assert.equal(listarMarcas(e.op).filter((m) => m.tipo === 'importacion').length, 1);
  } finally { await e.close(); fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('diagnosticoVisible: compacto, sin rutas, sin JSON, y vacío cuando el detalle no trae campos técnicos', () => {
  assert.equal(diagnosticoVisible(undefined), ''); assert.equal(diagnosticoVisible({ campo: 'x' }), '');
  const t = diagnosticoVisible({ etapa: 'importar_dxf', hresult: '0x1', tipo_excepcion: 'COMException', mensaje: 'x'.repeat(900), etapas: Array.from({ length: 20 }, (_, i) => ({ etapa: `e${i}`, estado: 'ok', t_ms: i })) });
  assert.ok(t.length < 1200); assert.ok(!t.includes('{')); assert.match(t, /Últimas etapas: .*e19:ok@19ms$/m);
});

import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { AutoCadCom } from '../src/cad/autocad_com.js';
import { expectedLayouts } from '../src/drawing/layouts_check.js';
test('CAD-OPEN-02 exportar_dwg (guardarLaminas) también queda bloqueada por un documento aislado pendiente: sin importar, sin SaveAs, sin diario', async () => {
  const home = tmpHome('TW12 open02b ñ '); const sb = new Sandbox(home); createProject(sb, 'Piloto'); const root = sb.projectRoot('Piloto'); const rel = '03 Trabajo/copia.dxf'; fs.writeFileSync(path.join(root, rel), dxf); fs.mkdirSync(path.join(root, '03 Trabajo', 'CAD'), { recursive: true });
  const c0 = compose(tunnelModel({})); const exp = expectedLayouts(c0); void exp; const llamadas = [];
  const cad = new AutoCadCom({ sandbox: sb, platform: 'win32', runner: async (script, input, opts) => {
    if (esReconc(script)) { llamadas.push('reconciliar'); return JSON.stringify({ ok: true, data: { aislado_presente: true, entidades_aislado: 0, documentos: [], ocupacion: { quiescente: true, cmdactive: 0 }, procesos: [1] } }); }
    if (input.dwg) { llamadas.push('guardar'); return JSON.stringify({ ok: true, data: {} }); }
    llamadas.push('importar'); opts.trazas.push(...ETAPAS_HASTA_IMPORT); return JSON.stringify(FALLO_EN_IMPORT);
  } });
  await assert.rejects(cad.guardarLaminas('Piloto', { dxf: rel, dwg: '03 Trabajo/CAD/a.dwg', operacion: 'op-a', composition: c0 }), (e) => e.code === 'APERTURA_FALLIDA' && !!e.detalle.estado_parcial_registrado);
  llamadas.length = 0;
  await assert.rejects(cad.guardarLaminas('Piloto', { dxf: rel, dwg: '03 Trabajo/CAD/b.dwg', operacion: 'op-b', composition: c0 }), (e) => e.code === 'IMPORTACION_PENDIENTE_SIN_RECONCILIAR');
  assert.deepEqual(llamadas, ['reconciliar']); assert.ok(!fs.existsSync(path.join(root, '03 Trabajo', 'CAD', 'b.dwg')));
  fs.rmSync(home, { recursive: true, force: true });
});
