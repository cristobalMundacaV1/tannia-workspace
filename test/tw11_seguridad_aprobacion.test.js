// Hallazgo P1 (auditoría): el código de aprobación humana era recuperable con herramientas MCP. Estas pruebas son ADVERSARIALES: modelan al agente.
// Invariante: ningún secreto de autorización existe en rutas legibles por herramientas, y el agente no puede autoaprobar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ROOT, tmpHome, startClient, call, data } from './helpers.js';
import { AprobacionHumana, dialogoSO } from '../src/cic/aprobacion_humana.js';
import { Sandbox } from '../src/security/sandbox.js';

const P = 'Seguridad ñ';
const M = (value, unit = 'm') => ({ value, unit });
async function env(extra = {}) { const home = tmpHome('Tannia ñ seg '); const cl = await startClient(home, undefined, { TANNIA_CIC: 'on', TANNIA_SIN_DIALOGO: '1', ...extra }); await call(cl.client, 'tannia_proyecto_crear', { nombre: P }); return { home, ...cl }; }
const caminar = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath ?? e.path, e.name)) : []);
const SECRETO = /APRUEBO\s+\S+\s+[0-9a-f]{6,}|nonce|\.codigo\.txt/i;
const base = () => ({ schema: 'tw.cic.interpretation/1', mode: 'professional', restatement: 'caso', intents: [{ kind: 'compute', text: 'c' }], magnitudes: [{ name: 'largo', value: 100, unit: 'm', origin: 'user' }, { name: 'ancho', value: 3, unit: 'm', origin: 'user' }], proposed_steps: [{ id: 's1', goal: 'Área', capability_id: 'op.qty.product', inputs: { base: { ref: 'magnitude:ancho' }, factor: { ref: 'magnitude:largo' } } }] });
async function casoObsoleto(c, N) { await call(c, 'tannia_cic_encargo', { proyecto: P, caso: N, interpretacion: base() }); await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N }); await call(c, 'tannia_cic_encargo', { proyecto: P, caso: N, interpretacion: { schema: 'tw.cic.interpretation/1', magnitudes: [{ name: 'largo', value: 120, unit: 'm', origin: 'user' }] }, confirmar_cambios: ['largo'] }); }

test('P1: ningún secreto de aprobación existe en el proyecto ni es recuperable con herramientas MCP (fuente candidata y borrador desactualizado)', async () => {
  const { home, client: c, close } = await env();
  try {
    const f = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'proponer_fuente', titulo: 'Manual X', url: 'https://ejemplo.org/x', extracto: 'El espesor del sostenimiento depende de la clase de roca.' })); assert.ok(f.id);
    await casoObsoleto(c, 'Obs'); const r0 = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: 'Obs', tipos: ['memoria_md'], borrador_desactualizado: true }); assert.equal(data(r0).error, 'CONSENTIMIENTO_HUMANO_REQUERIDO');
    // 1) recorrido exhaustivo del proyecto: ni archivos «codigo» ni líneas «APRUEBO <id> <código>»
    const proyecto = path.join(home, 'Proyectos', P); const archivos = caminar(proyecto); for (const a of archivos) { assert.ok(!/codigo|nonce/i.test(path.basename(a)), `archivo con nombre de código: ${a}`); let t = ''; try { t = fs.readFileSync(a, 'utf8'); } catch { /* binario */ } assert.ok(!SECRETO.test(t), `secreto legible en ${path.relative(home, a)}`); }
    // 2) el agente intenta INDEXAR todo texto del proyecto con la herramienta de conocimiento y buscar el secreto
    for (const a of archivos.filter((x) => /\.(txt|json|md)$/i.test(x))) await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'registrar_archivo', ruta: path.relative(proyecto, a).split(path.sep).join('/'), clase: 'C' });
    for (const q of [['APRUEBO código aprobación'], ['nonce codigo secreto'], ['archivo de aprobación línea']]) { const res = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'buscar', consultas: q, incluir_candidatas: true })); assert.ok(!SECRETO.test(JSON.stringify(res)), `la búsqueda ${q} devolvió un secreto`); }
    // 3) rutas históricas donde antes vivía el código: ya no existen
    for (const rel of [`03 Trabajo/Conocimiento/pendientes/${f.id}.codigo.txt`, '03 Trabajo/Consentimientos']) { const r = await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'registrar_archivo', ruta: rel, clase: 'C' }); assert.equal(r.isError, true, rel); }
    // 4) ni las respuestas de las herramientas contienen el secreto
    assert.ok(!SECRETO.test(JSON.stringify(r0.content) + JSON.stringify(r0.structuredContent)), 'la respuesta del borrador no expone secretos');
  } finally { await close(); }
});

test('P1: el agente no puede autoaprobar (archivos falsos en el proyecto, parámetros, preexistentes, de otro id, contenido ajeno)', async () => {
  const { home, client: c, close } = await env(); const ah = new AprobacionHumana(new Sandbox(home));
  try {
    const f = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'proponer_fuente', titulo: 'Guía', url: 'https://ejemplo.org/g', extracto: 'Extracto literal suficientemente largo de la guía.' })); const id = f.id;
    const decidir = async (extra = {}) => data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'decidir_fuente', id, ...extra })).estado;
    // (a) parámetros inventados
    assert.equal(await decidir({ aprobado: true, aprobar: true, humano: true, confirmado_por_usuario: true, por: 'human_dialog' }), 'candidate');
    // (b) archivos «de aprobación» que el agente pudiera dejar DENTRO del proyecto (en cualquier carpeta) ya no cuentan
    for (const rel of ['01 Antecedentes/Aprobaciones', '03 Trabajo/Consentimientos', '03 Trabajo/Conocimiento/pendientes', '.tannia']) { const d = path.join(home, 'Proyectos', P, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, `${id}.txt`), `APRUEBO ${id}\nAPRUEBO ${id} 0123456789\n`); }
    assert.equal(await decidir(), 'candidate');
    // (c) archivo en la carpeta de configuración con id ajeno o contenido ajeno
    const af = ah.archivoAprobacion(P, id); fs.mkdirSync(path.dirname(af), { recursive: true }); fs.writeFileSync(af, 'APRUEBO otro-id\n'); assert.equal(await decidir(), 'candidate');
    fs.writeFileSync(path.join(path.dirname(af), `${ah.clave(P, 'src-otra-cosa')}.txt`), `APRUEBO ${id}\n`); assert.equal(await decidir(), 'candidate');
    // (d) archivo PREEXISTENTE a la solicitud (fecha anterior): no vale
    fs.writeFileSync(af, `APRUEBO ${id}\n`); const antes = new Date(Date.now() - 3600_000); fs.utimesSync(af, antes, antes); assert.equal(await decidir(), 'candidate');
    // (e) un id sin solicitud registrada no se aprueba aunque exista el archivo
    const huerfano = ah.archivoAprobacion(P, 'src-sin-solicitud-00000000'); fs.writeFileSync(huerfano, 'APRUEBO src-sin-solicitud-00000000\n'); const r = await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'decidir_fuente', id: 'src-sin-solicitud-00000000' }); assert.equal(r.isError, true);
    // (f) la persona SÍ puede: archivo correcto creado después de la solicitud, en la carpeta de configuración; es de un solo uso
    fs.writeFileSync(af, `APRUEBO ${id}\n`); assert.equal(await decidir(), 'registered'); assert.ok(!fs.existsSync(af), 'la aprobación se consume');
    const lista = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'listar' })).fuentes.find((x) => x.id === id); assert.equal(lista.aprobada_por, 'human_out_of_band');
    // la aprobación de un proyecto no sirve para el mismo id en otro proyecto
    assert.notEqual(ah.archivoAprobacion('Otro proyecto', id), ah.archivoAprobacion(P, id));
  } finally { await close(); }
});

test('P1: las herramientas MCP no pueden leer, escribir ni importar la carpeta de configuración (aprobaciones y preferencias)', async () => {
  const { home, client: c, close } = await env(); const cfg = path.join(home, '.tannia-config');
  try {
    await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'proponer_fuente', titulo: 'G', url: 'https://x.invalid', extracto: 'Extracto literal suficientemente largo.' }); await call(c, 'tannia_comunicacion', { accion: 'establecer', nivel: 'normal' });
    assert.ok(fs.existsSync(path.join(cfg, 'aprobaciones', 'pendientes')), 'la solicitud vive fuera de los proyectos'); const f = caminar(path.join(cfg, 'aprobaciones'))[0];
    // lectura: traversal y rutas absolutas hacia la configuración
    for (const rel of ['../../.tannia-config/aprobaciones/pendientes', '../../.tannia-config/comunicacion.json', f, path.relative(path.join(home, 'Proyectos', P), f)]) { const r = await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'registrar_archivo', ruta: rel, clase: 'C' }); assert.equal(r.isError, true, rel); const d = await call(c, 'tannia_dxf_inspeccionar', { proyecto: P, archivo: rel }); assert.equal(d.isError, true, `dxf ${rel}`); }
    // importación: copiar la configuración a un proyecto para leerla está bloqueado
    const imp = await call(c, 'tannia_proyecto_importar', { proyecto: P, archivos: [f, path.join(cfg, 'comunicacion.json')] }); assert.equal(data(imp).resultados?.every((x) => x.estado === 'rechazado' && x.codigo === 'ORIGEN_RESERVADO') ?? false, true, JSON.stringify(data(imp)));
    // escritura: nombres hostiles de caso/proyecto no llegan a la configuración
    const antes = JSON.stringify(caminar(cfg).sort()); for (const n of ['../../.tannia-config/aprobaciones/x', '..\\..\\.tannia-config', '../.tannia-config']) { await call(c, 'tannia_cic_calcular', { proyecto: P, caso: n, operacion: 'geo.section.circle', entradas: { radio: M(1) } }); await call(c, 'tannia_cic_geometria', { proyecto: P, caso: n, accion: 'generar_lineal', tramos: [{ type: 'straight', length: 10 }] }); }
    assert.equal(JSON.stringify(caminar(cfg).sort()), antes, 'ninguna herramienta escribió en la configuración (salvo su archivo de preferencia)');
    const nota = await call(c, 'tannia_comunicacion', { accion: 'establecer', nivel: 'detallado', alcance: 'proyecto', proyecto: '../../.tannia-config' }); assert.equal(nota.isError, true);
  } finally { await close(); }
});

test('canales: elicitación (aceptar/rechazar), diálogo del SO (si/no/no disponible) y archivo — con prioridad y sin fallback tras un rechazo explícito', async () => {
  const home = tmpHome('Tannia ñ can '); const sb = new Sandbox(home); sb.ensureHome(); fs.mkdirSync(path.join(home, 'Proyectos', 'Q'), { recursive: true });
  const crea = (dialogo) => new AprobacionHumana(sb, { dialogo }); let ah = crea(async () => 'si');
  assert.deepEqual(await ah.decidir('Q', 'x1', { descripcion: 'd', elicitar: async () => ({ action: 'accept', content: { aprobar: true } }) }), { por: 'human_elicitation' });
  assert.equal((await ah.decidir('Q', 'x2', { descripcion: 'd', elicitar: async () => ({ action: 'decline' }) })).rechazado, true, 'rechazo del cliente: no se prueba otro canal');
  assert.equal((await ah.decidir('Q', 'x3', { descripcion: 'd', elicitar: async () => ({ action: 'accept', content: { aprobar: false } }) })).rechazado, true, 'aceptar la ventana sin marcar «aprobar» es un NO explícito');
  assert.deepEqual(await ah.decidir('Q', 'x4', { descripcion: 'd' }), { por: 'human_dialog' });
  ah = crea(async () => 'no'); ah.solicitar('Q', 'x5', 'd'); fs.writeFileSync(ah.archivoAprobacion('Q', 'x5'), 'APRUEBO x5\n'); assert.equal((await ah.decidir('Q', 'x5', { descripcion: 'd' })).rechazado, true, 'un «No» explícito del diálogo prevalece sobre un archivo');
  ah = crea(async () => null); assert.deepEqual(await ah.decidir('Q', 'x6', { descripcion: 'd' }), { por: null }); ah.solicitar('Q', 'x6', 'd'); fs.writeFileSync(ah.archivoAprobacion('Q', 'x6'), 'APRUEBO x6\n'); assert.equal((await ah.decidir('Q', 'x6', { descripcion: 'd' })).por, 'human_out_of_band');
  assert.equal((await crea(async () => { throw new Error('sin GUI'); }).decidir('Q', 'x7', { descripcion: 'd' })).por, null, 'un fallo del diálogo no aprueba');
  // el diálogo nativo: el mensaje viaja por variable de entorno (no se interpola en el script) y los fallos nunca aprueban
  const llamadas = []; const ejecutar = (cmd, args, opts, cb) => { llamadas.push({ cmd, args, env: opts.env.TANNIA_DLG_MSG }); cb(null, cmd === 'powershell.exe' ? 'si\n' : 'si\n'); };
  const previo = process.env.CI; delete process.env.CI; const prev2 = process.env.TANNIA_SIN_DIALOGO; delete process.env.TANNIA_SIN_DIALOGO;
  try {
    const hostil = '"; Remove-Item -Recurse C:\\ ; "'; assert.equal(await dialogoSO(hostil, { plataforma: 'win32', ejecutar }), 'si'); assert.equal(llamadas[0].cmd, 'powershell.exe'); assert.equal(llamadas[0].env, hostil); assert.ok(!llamadas[0].args.join(' ').includes('Remove-Item'), 'el texto no se inyecta en el script');
    assert.equal(await dialogoSO('m', { plataforma: 'darwin', ejecutar }), 'si'); assert.equal(llamadas[1].cmd, 'osascript'); assert.ok(!llamadas[1].args.join(' ').includes('"m"'));
    assert.equal(await dialogoSO('m', { plataforma: 'linux', ejecutar: (c, a, o, cb) => cb(Object.assign(new Error('x'), { code: 'ENOENT' })) }), null, 'sin zenity: no disponible');
    assert.equal(await dialogoSO('m', { plataforma: 'win32', ejecutar: (c, a, o, cb) => cb(Object.assign(new Error('t'), { killed: true })) }), 'no', 'tiempo agotado = No');
    process.env.CI = 'true'; assert.equal(await dialogoSO('m', { plataforma: 'win32', ejecutar }), null, 'en CI no se abre ningún diálogo');
  } finally { if (previo === undefined) delete process.env.CI; else process.env.CI = previo; if (prev2 !== undefined) process.env.TANNIA_SIN_DIALOGO = prev2; }
});

async function clienteElic(home, resp) { const client = new Client({ name: 't', version: '1' }, { capabilities: { elicitation: {} } }); client.setRequestHandler(ElicitRequestSchema, async () => resp); await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'src', 'main.js')], env: { ...process.env, TANNIA_HOME: home, TANNIA_CIC: 'on', TANNIA_SIN_DIALOGO: '1' }, stderr: 'pipe' })); return client; }
test('regresión end-to-end: borrador desactualizado y fuente — elicitación y archivo de la persona funcionan; el agente solo recibe una ruta sin secretos', async () => {
  const { home, client: c, close } = await env(); const N = 'Obs';
  try {
    await casoObsoleto(c, N); let r = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'], borrador_desactualizado: true }); assert.equal(data(r).error, 'CONSENTIMIENTO_HUMANO_REQUERIDO');
    const ruta = data(r).detalle.archivo_aprobacion; assert.ok(path.isAbsolute(ruta) && !ruta.startsWith(path.join(home, 'Proyectos')), 'la ruta de aprobación está fuera de los proyectos'); assert.ok(!SECRETO.test(JSON.stringify(data(r))));
    const idc = data(r).detalle.id_consentimiento; assert.ok(fs.existsSync(path.join(home, '.tannia-config', 'aprobaciones', 'pendientes')));
    fs.writeFileSync(ruta, `APRUEBO ${idc}\n`); r = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'], borrador_desactualizado: true }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300)); assert.equal(data(r).consentimiento, 'human_out_of_band'); assert.equal(data(r).entrega_valida, false);
    // reutilizar la misma aprobación para una segunda exportación ya no basta (uso único)
    r = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_pdf'], borrador_desactualizado: true }); assert.equal(data(r).error, 'CONSENTIMIENTO_HUMANO_REQUERIDO');
  } finally { await close(); }
  for (const [resp, ok] of [[{ action: 'accept', content: { aprobar: true } }, true], [{ action: 'decline' }, false]]) { const h = tmpHome('Tannia ñ el '); const c2 = await clienteElic(h, resp); try { await call(c2, 'tannia_proyecto_crear', { nombre: P }); await casoObsoleto(c2, 'Z'); const x = await call(c2, 'tannia_cic_entregable', { proyecto: P, caso: 'Z', tipos: ['memoria_md'], borrador_desactualizado: true }); assert.equal(!x.isError, ok); if (!ok) assert.equal(data(x).detalle.rechazado, true); const fid = data(await call(c2, 'tannia_cic_conocimiento', { proyecto: P, accion: 'proponer_fuente', titulo: 'Fuente sint?tica para probar el canal', url: 'https://example.org/fixture', extracto: 'Extracto literal suficientemente largo.' })).id; const dd = data(await call(c2, 'tannia_cic_conocimiento', { proyecto: P, accion: 'decidir_fuente', id: fid })); assert.equal(dd.estado, ok ? 'registered' : 'rejected'); } finally { await c2.close(); } }
});
