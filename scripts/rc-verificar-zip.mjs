// Verifica el ZIP de instalación FINAL (no el árbol de desarrollo):
//   node scripts/rc-verificar-zip.mjs dist/rc/Tannia-Workspace-<ver>-windows-x64.zip [--salida informe.json]
// 1) huella del ZIP; 2) extracción en una ruta con espacios y ñ; 3) SHA256SUMS de cada archivo; 4) «instalación» de la extensión
// en un perfil limpio simulado, lanzada con el mismo comando y entorno del manifiesto (como Claude Desktop); 5) conexión MCP y
// flujo profesional de extremo a extremo con una persona que responde las ventanas de confirmación; 6) verificación de los
// entregables contra un oráculo calculado a mano; 7) interrupción y recuperación; 8) actualización/reinstalación con datos
// conservados; 9) desinstalación sin pérdida de proyectos. NO sustituye la prueba en Claude Desktop ni en AutoCAD reales.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import ExcelJS from 'exceljs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zipPath = path.resolve(process.argv[2] || '');
const iSal = process.argv.indexOf('--salida'); const salida = iSal > 0 ? path.resolve(process.argv[iSal + 1]) : path.join(path.dirname(zipPath), 'verificacion-zip.json');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const pasos = []; let fallos = 0;
const paso = async (nombre, fn) => { const t0 = Date.now(); try { const d = await fn(); pasos.push({ paso: nombre, ok: true, ms: Date.now() - t0, ...(d ? { detalle: d } : {}) }); return d; } catch (e) { fallos++; pasos.push({ paso: nombre, ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 600) }); throw e; } };
const afirmar = (c, m) => { if (!c) throw new Error(m); };
function extraer(buf, destino) { const ents = unzipSync(new Uint8Array(buf)); for (const [n, d] of Object.entries(ents)) { if (n.endsWith('/')) continue; const parts = n.split('/'); afirmar(!parts.includes('..') && !path.isAbsolute(n), `entrada insegura en ZIP: ${n}`); const f = path.join(destino, ...parts); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, d); } return Object.keys(ents).length; }

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'Verificación ZIP ñ '));
const extraido = path.join(base, 'Descargas de Tannia', 'ZIP extraído');
const perfil = path.join(base, 'Perfil limpio Ñuñoa');
const extDir = path.join(perfil, 'AppData', 'Roaming', 'Claude', 'Claude Extensions', 'tannia-workspace');
const datos = path.join(perfil, 'Documents', 'Tannia Workspace');
const informe = { zip: path.basename(zipPath), plataforma: `${os.platform()} ${os.release()} ${os.arch()}`, node: process.version, inicio: new Date().toISOString(), pasos };
let raizZip; let manifest; let cliente = null; let hijoPid = null;

function respuestasPersona(n) { return Array.from({ length: n }, () => ({ action: 'accept', content: { aprobar: true, nombre: 'Persona de prueba (verificador)' } })); }
async function conectar(respuestas) {
  const cfg = manifest.server.mcp_config;
  const args = cfg.args.map((a) => String(a).replace('${__dirname}', extDir));
  const env = { ...process.env, TANNIA_SIN_DIALOGO: '1' }; delete env.TANNIA_CIC; delete env.TANNIA_ENGINEERING;
  for (const [k, v] of Object.entries(cfg.env || {})) env[k] = String(v).replace('${user_config.carpeta_tannia}', datos).replace('${__dirname}', extDir);
  const tr = new StdioClientTransport({ command: cfg.command === 'node' ? process.execPath : cfg.command, args, env, stderr: 'pipe' });
  const c = new Client({ name: 'verificador-zip', version: '1' }, { capabilities: { elicitation: {} } });
  c.vistos = []; c.setRequestHandler(ElicitRequestSchema, async (req) => { c.vistos.push(req.params.message); return respuestas.length ? respuestas.shift() : { action: 'decline' }; });
  await c.connect(tr); hijoPid = tr.pid ?? null; return c;
}
const T = async (n, a = {}) => { const r = await cliente.callTool({ name: n, arguments: a }); if (r.isError) throw new Error(`${n}: ${r.content?.[0]?.text?.slice(0, 400)}`); return r.structuredContent; };
const TE = async (n, a, code) => { const r = await cliente.callTool({ name: n, arguments: a }); afirmar(r.isError && r.structuredContent?.error === code, `${n} debía fallar con ${code}: ${r.content?.[0]?.text?.slice(0, 300)}`); return r.structuredContent; };
function instalar() { fs.rmSync(extDir, { recursive: true, force: true }); fs.mkdirSync(extDir, { recursive: true }); return extraer(fs.readFileSync(path.join(raizZip, manifestZip.extension.archivo)), extDir); }
let manifestZip;

const PROY = 'Edificio Ñuñoa – Revisión A';
const pj = () => path.join(datos, 'Proyectos', PROY);
const sumas = (dir) => { const out = {}; const w = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) w(f); else out[path.relative(dir, f)] = sha(fs.readFileSync(f)); } }; if (fs.existsSync(dir)) w(dir); return out; };
async function totalXlsx(f) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f); let t = null; wb.getWorksheet('Presupuesto').eachRow((row) => { if (String(row.getCell(2).value ?? '') === 'TOTAL') { const v = row.getCell(6).value; t = typeof v === 'object' && v ? v.result : v; } }); return t; }
/** Oráculo independiente (a mano, sin el motor): losa (20 + π/2) m² × 0,1 m del fixture; muro MC01 5 × 2,4 − 1 × 2. */
function oraculo(precioMuro) {
  const r = (x) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5 + 1e-9);
  const q1 = (20 + Math.PI / 2) * 0.1; const pu1 = r(1.05 * 1000 + (1 / 5) * 5000); const t1 = r(q1 * pu1);
  const t2 = r(10 * precioMuro); const cd = t1 + t2; const gg = r(cd * 0.10); const u = r(cd * 0.05); const n = cd + gg + u; return n + r(n * 0.19);
}

try {
  await paso('1. huella del ZIP', () => { const b = fs.readFileSync(zipPath); informe.zip_sha256 = sha(b); informe.zip_bytes = b.length; return { sha256: informe.zip_sha256 }; });
  await paso('2. extracción en ruta con espacios y ñ', () => { fs.mkdirSync(extraido, { recursive: true }); const n = extraer(fs.readFileSync(zipPath), extraido); const dirs = fs.readdirSync(extraido); afirmar(dirs.length === 1, 'el ZIP debe tener una sola carpeta raíz'); raizZip = path.join(extraido, dirs[0]); return { entradas: n, carpeta: dirs[0] }; });
  await paso('3. SHA256SUMS de cada archivo y manifiesto de la entrega', () => {
    const lineas = fs.readFileSync(path.join(raizZip, 'SHA256SUMS.txt'), 'utf8').trim().split('\n'); let ok = 0;
    for (const l of lineas) { const [h, ...r] = l.split('  '); const f = path.join(raizZip, ...r.join('  ').split('/')); afirmar(fs.existsSync(f), `falta ${r}`); afirmar(sha(fs.readFileSync(f)) === h, `huella distinta: ${r}`); ok++; }
    manifestZip = JSON.parse(fs.readFileSync(path.join(raizZip, 'release-manifest.json'), 'utf8'));
    afirmar(sha(fs.readFileSync(path.join(raizZip, manifestZip.extension.archivo))) === manifestZip.extension.sha256, 'huella de la extensión distinta del manifiesto');
    for (const req of ['INSTALAR.cmd', 'DIAGNOSTICO.cmd', 'LEEME_PRIMERO.txt', 'documentos/GUIA_RAPIDA.md', 'documentos/RECUPERACION_Y_DESINSTALACION.md', 'VERSION_Y_COMPATIBILIDAD.json', 'AVISOS_DE_TERCEROS.md']) afirmar(fs.existsSync(path.join(raizZip, ...req.split('/'))), `falta ${req}`);
    const inst = fs.readFileSync(path.join(raizZip, 'INSTALAR.cmd'), 'utf8'); afirmar(inst.includes(manifestZip.extension.sha256) && !inst.includes('{{'), 'INSTALAR.cmd sin huella o con plantilla sin completar');
    afirmar(/\r\n/.test(inst), 'INSTALAR.cmd debe tener fin de línea CRLF');
    informe.version = manifestZip.version; informe.commit = manifestZip.commit; informe.extension_sha256 = manifestZip.extension.sha256;
    return { archivos_verificados: ok, version: manifestZip.version, commit: manifestZip.commit };
  });
  await paso('4. instalación en perfil limpio (extensión extraída como la instala Claude Desktop)', () => {
    afirmar(!fs.existsSync(datos), 'el perfil no está limpio'); const n = instalar();
    manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
    const contenido = sumas(extDir); for (const [r, h] of Object.entries(manifestZip.extension.contenido_sha256)) afirmar(contenido[r.split('/').join(path.sep)] === h, `contenido de la extensión distinto: ${r}`);
    return { archivos: n, nombre: manifest.name, version: manifest.version, plataformas: manifest.compatibility?.platforms };
  });
  await paso('5. registro y conexión MCP (initialize, herramientas, procedimientos, diagnóstico)', async () => {
    cliente = await conectar(respuestasPersona(20));
    const tools = (await cliente.listTools()).tools.map((t) => t.name).sort(); const decl = manifest.tools.map((t) => t.name).sort();
    afirmar(JSON.stringify(tools) === JSON.stringify(decl), `herramientas publicadas (${tools.length}) ≠ manifiesto (${decl.length})`);
    const prompts = (await cliente.listPrompts()).prompts.map((p) => p.name);
    const d = await T('tannia_diagnostico'); afirmar(d.version === manifest.version, `versión ${d.version} ≠ ${manifest.version}`); afirmar(d.carpeta_escribible === true, 'carpeta no escribible');
    afirmar(path.resolve(d.carpeta_tannia) === path.resolve(datos), 'carpeta de datos distinta de la configurada');
    // R-03: el diagnóstico identifica exactamente lo instalado (versión, commit de compilación y huella del servidor).
    const pq = d.versiones?.paquete; afirmar(pq?.version === manifest.version && pq?.compilacion?.version === manifest.version, `diagnóstico sin versión de paquete coherente: ${JSON.stringify(pq)?.slice(0, 200)}`);
    afirmar(pq?.compilacion?.commit === manifestZip.commit, `commit del diagnóstico ${pq?.compilacion?.commit} ≠ commit del ZIP ${manifestZip.commit}`);
    afirmar(pq?.huella_servidor_sha256 === sha(fs.readFileSync(path.join(extDir, 'server', 'index.js'))), 'huella del servidor del diagnóstico ≠ servidor instalado');
    return { servidor: cliente.getServerVersion(), herramientas: tools.length, procedimientos: prompts, ventana_del_cliente: d.autorizacion_humana.ventana_del_cliente };
  });
  // G0 / PL-01 (issue #32): el PAQUETE distribuido (no el servidor de desarrollo) expone el motor de planos con la configuración del manifiesto.
  await paso('5b. motor de planos del paquete: tannia_planos expuesto y 5 láminas del túnel generadas (DXF AC1024 + PDF)', async () => {
    afirmar(manifest.server.mcp_config.env?.TANNIA_ENGINEERING === 'on', 'el manifiesto no declara TANNIA_ENGINEERING=on (configuración de producción)');
    afirmar(manifest.tools.some((t) => t.name === 'tannia_planos'), 'el manifiesto no declara tannia_planos');
    const tools = (await cliente.listTools()).tools.map((t) => t.name); afirmar(tools.includes('tannia_planos'), 'el servidor instalado no publica tannia_planos');
    const P = 'Túnel UAT-02 (verificador G0)'; await T('tannia_proyecto_crear', { nombre: P });
    // El ZIP es para Windows x64: en otro sistema el componente gráfico nativo no carga. Ahí se exige un error CLARO (no interno);
    // la generación completa de las 5 láminas se exige en el job rc-zip-windows, con el mismo ZIP.
    const mismoSistema = process.platform === 'win32' && process.arch === 'x64';
    if (!mismoSistema) {
      const r = await cliente.callTool({ name: 'tannia_planos', arguments: { proyecto: P, accion: 'generar_tunel', datos: { length: 150, width: 5.5, wall: 2.5, selected: 0.06 } } });
      afirmar(r.isError && r.structuredContent?.error === 'COMPONENTE_GRAFICO_NO_DISPONIBLE', `fuera de Windows x64 se esperaba COMPONENTE_GRAFICO_NO_DISPONIBLE: ${r.content?.[0]?.text?.slice(0, 200)}`);
      return { tannia_planos: true, generacion_5_laminas: `NO EJECUTADA en ${process.platform}-${process.arch} (binario nativo win32-x64); se exige en rc-zip-windows`, error_claro: true };
    }
    const F = { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 };
    const g = await T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: { length: 150, width: 5.5, wall: 2.5, selected: 0.06, fortificacion: F } });
    const laminas = g.files.filter((f) => /lamina-.*\.pdf$/.test(f)); afirmar(laminas.length === 5, `láminas PDF: ${laminas.length} ≠ 5`);
    const dxfs = g.files.filter((f) => /\.dxf$/i.test(f)); afirmar(dxfs.length >= 1, 'sin DXF');
    const raiz = path.join(datos, 'Proyectos', P, g.folder);
    for (const f of dxfs) { const t = fs.readFileSync(fs.existsSync(path.join(raiz, f)) ? path.join(raiz, f) : path.join(datos, 'Proyectos', P, f), 'latin1'); afirmar(/\$ACADVER\r?\n\s*1\r?\n\s*AC1024/.test(t), `${f}: no es AC1024`); afirmar(/\nDIMENSION\r?\n/.test(t), `${f}: sin cotas nativas`); }
    afirmar(g.fortificacion?.some((x) => x.partida === 'Pernos de anclaje'), 'sin cubicación de fortificación');
    return { tannia_planos: true, laminas: laminas.length, dxf: dxfs, revision: g.revision };
  });
  // CAD-BG: el PAQUETE instalado ejecuta trabajos en segundo plano (mismo server/index.js relanzado con --trabajo, oculto y de prioridad baja).
  await paso('5c. trabajo en segundo plano desde el paquete instalado (planos + cubicaciones sin bloquear el servidor; prioridad baja)', async () => {
    const P = 'Obra segundo plano (verificador CAD-BG)'; await T('tannia_proyecto_crear', { nombre: P });
    const t0 = Date.now(); const c = await T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'cubicaciones', datos: { length: 150, width: 5.5, wall: 2.5, selected: 0.06 } }); const msCrear = Date.now() - t0;
    afirmar(msCrear < 3000, `crear tardó ${msCrear} ms (debe responder de inmediato)`);
    let e; for (let i = 0; i < 400; i++) { e = await T('tannia_trabajos', { accion: 'estado', trabajo: c.trabajo }); if (['TERMINADO', 'REQUIERE_INTERVENCIÓN', 'FALLÓ', 'CANCELADO'].includes(e.estado_interno)) break; await new Promise((r) => setTimeout(r, 300)); }
    const reg = JSON.parse(fs.readFileSync(path.join(datos, '.tannia-trabajos', `${c.trabajo}.json`), 'utf8'));
    afirmar(reg.recursos?.prioridad === os.constants.priority.PRIORITY_BELOW_NORMAL, `prioridad del proceso de fondo: ${JSON.stringify(reg.recursos)}`);
    const mismoSistema = process.platform === 'win32' && process.arch === 'x64';
    if (!mismoSistema) { afirmar(e.estado_interno === 'FALLÓ' && /componente gr[aá]fico|COMPONENTE_GRAFICO/i.test(`${e.mensaje_para_la_persona} ${reg.pasos[0].error}`), `fuera de Windows x64 se esperaba un fallo claro del componente gráfico: ${e.mensaje_para_la_persona}`); return { crear_ms: msCrear, estado: e.estado_interno, nota: `planos NO generados en ${process.platform}-${process.arch} (binario win32); se exige en rc-zip-windows`, recursos: reg.recursos }; }
    afirmar(e.estado_interno === 'TERMINADO', `estado ${e.estado_interno}: ${e.mensaje_para_la_persona}`);
    return { crear_ms: msCrear, estado: e.estado_interno, mensaje: e.mensaje_para_la_persona, pasos: e.pasos.map((p) => p.estado), recursos: reg.recursos };
  });
  let aprob1;
  await paso('6. flujo profesional de extremo a extremo (plano → cubicación → APU → verificación → presupuesto/memoria → aprobación → entrega)', async () => {
    await T('tannia_proyecto_crear', { nombre: PROY });
    const orig = path.join(pj(), '02 Originales', 'planta piso 1 ñ.dxf'); fs.copyFileSync(path.join(raiz, 'fixtures', 'dxf', 'simple_m.dxf'), orig); informe.original_sha256 = sha(fs.readFileSync(orig));
    const p = { proyecto: PROY };
    await T('tannia_originales_registrar', p); await T('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
    await T('tannia_dxf_inspeccionar', { ...p, archivo: '02 Originales/planta piso 1 ñ.dxf' });
    await T('tannia_cubicar_dxf', { ...p, archivo: '02 Originales/planta piso 1 ñ.dxf', unidad_confirmada: 'm', codigo: '1', descripcion: 'Losa', capas: ['LOSA'], regla: 'area_por_espesor', parametros: { espesor_m: 0.1 }, apu: 'A1' });
    await T('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC01-muro-area-neta', archivo_origen: '02 Originales/planta piso 1 ñ.dxf', datos: { tramos: [{ longitud_m: 5, origen: 'medido' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } }, guardar_como: { codigo: '2', descripcion: 'Muro eje A', apu: 'A2' } });
    await T('tannia_apu_definir', { ...p, codigo: 'A1', unidad: 'm3', insumos: [{ tipo: 'material', descripcion: 'Hormigón', unidad: 'm3', cantidad: 1.05, precio_unitario: 1000, fuente_precio: 'fixture verificador', fecha_precio: '2026-11-17' }, { tipo: 'mano_obra', descripcion: 'Cuadrilla', unidad: 'jornada', rendimiento: 5, cuadrilla: 1, precio_unitario: 5000, fuente_precio: 'fixture verificador', fecha_precio: '2026-11-17' }] });
    await T('tannia_apu_definir', { ...p, codigo: 'A2', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: 8000, fuente_precio: 'fixture verificador', fecha_precio: '2026-11-17' }] });
    await T('tannia_presupuesto_config', { ...p, gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 });
    await T('tannia_partida_verificar', { ...p, codigo: '1' }); await T('tannia_partida_verificar', { ...p, codigo: '2' });
    await T('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
    const x = await T('tannia_presupuesto_generar', p); const mem = await T('tannia_informe_generar', p);
    afirmar(x.estado_final_posible === true, `presupuesto no final: ${JSON.stringify(x.pendientes)}`); afirmar(x.total === oraculo(8000), `total ${x.total} ≠ oráculo ${oraculo(8000)}`);
    await T('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' });
    aprob1 = await T('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
    const ex = await T('tannia_entregable_exportar', p);
    return { total: x.total, oraculo: oraculo(8000), xlsx: x.archivo, memoria: mem.archivo, revision: aprob1.revision, recibo: aprob1.recibo, entrega: ex.carpeta, ventanas_mostradas_a_la_persona: cliente.vistos.length };
  });
  await paso('7. verificación de los entregables generados', async () => {
    const st = await T('tannia_proyecto_estado', { proyecto: PROY }); afirmar(st.estado === 'entregable', `estado ${st.estado}`);
    const carpeta = fs.readdirSync(path.join(pj(), '07 Entregables')).find((n) => n.startsWith('Entrega ')); const dir = path.join(pj(), '07 Entregables', carpeta);
    const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifiesto-entrega.json'), 'utf8'));
    const huellas = fs.readFileSync(path.join(dir, 'HUELLAS-SHA256.txt'), 'utf8').trim().split('\n');
    for (const l of huellas) { const [h, n] = l.split('  '); afirmar(sha(fs.readFileSync(path.join(dir, n))) === h, `huella de entrega distinta: ${n}`); }
    for (const a of man.archivos) afirmar(sha(fs.readFileSync(path.join(dir, path.basename(a.rel)))) === a.sha256, `archivo entregado ≠ aprobado: ${a.rel}`);
    const xlsx = fs.readdirSync(dir).find((n) => n.endsWith('.xlsx')); const pdf = fs.readdirSync(dir).find((n) => n.endsWith('.pdf'));
    const t = await totalXlsx(path.join(dir, xlsx)); afirmar(t === oraculo(8000), `TOTAL del XLSX entregado ${t} ≠ oráculo ${oraculo(8000)}`);
    afirmar(fs.readFileSync(path.join(dir, pdf)).subarray(0, 5).toString() === '%PDF-', 'la memoria no es un PDF');
    afirmar(sha(fs.readFileSync(path.join(pj(), '02 Originales', 'planta piso 1 ñ.dxf'))) === informe.original_sha256, 'el ORIGINAL cambió');
    afirmar(man.revision_id === aprob1.revision && man.aprobacion.recibo === aprob1.recibo, 'manifiesto no corresponde a la aprobación');
    return { carpeta, archivos: huellas.length, total_xlsx: t, original_intacto: true };
  });
  await paso('8. cambio después de entregar: precio nuevo ⇒ archivos y aprobación nuevos; la entrega anterior no se toca', async () => {
    const antes = sumas(path.join(pj(), '07 Entregables'));
    await T('tannia_apu_definir', { proyecto: PROY, codigo: 'A2', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: 9000, fuente_precio: 'fixture verificador', fecha_precio: '2026-11-17' }] });
    const est = await T('tannia_entrega_estado', { proyecto: PROY }); afirmar(est.aprobacion.vigente === false, 'la aprobación anterior sigue vigente');
    await TE('tannia_proyecto_avanzar', { proyecto: PROY, a_estado: 'revision' }, 'GATE_NO_CUMPLIDO');
    const x = await T('tannia_presupuesto_generar', { proyecto: PROY }); await T('tannia_informe_generar', { proyecto: PROY });
    afirmar(x.total === oraculo(9000), `total ${x.total} ≠ oráculo ${oraculo(9000)}`);
    await T('tannia_proyecto_avanzar', { proyecto: PROY, a_estado: 'revision' }); await T('tannia_proyecto_avanzar', { proyecto: PROY, a_estado: 'aprobado' });
    const ex = await T('tannia_entregable_exportar', { proyecto: PROY });
    const despues = sumas(path.join(pj(), '07 Entregables')); for (const [k, h] of Object.entries(antes)) afirmar(despues[k] === h, `entrega anterior modificada: ${k}`);
    return { total_nuevo: x.total, entrega_nueva: ex.carpeta };
  });
  await paso('9. interrupción abrupta del servidor y recuperación sin estado a medias', async () => {
    await T('tannia_apu_definir', { proyecto: PROY, codigo: 'A2', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: 9500, fuente_precio: 'fixture verificador', fecha_precio: '2026-11-17' }] });
    await T('tannia_presupuesto_generar', { proyecto: PROY });
    if (hijoPid) { try { process.kill(hijoPid, 'SIGKILL'); } catch { /* ya terminó */ } }
    try { await cliente.close(); } catch { /* conexión rota */ }
    cliente = await conectar(respuestasPersona(10));
    const est = await T('tannia_entrega_estado', { proyecto: PROY });
    afirmar(est.aprobacion.vigente === false, 'tras la interrupción no debe haber aprobación vigente');
    afirmar(!fs.readdirSync(path.join(pj(), '07 Entregables')).some((n) => n.startsWith('.preparando-')), 'quedó una entrega a medias');
    const json = ['04 Cubicaciones/partidas.json', '05 Presupuestos/apus.json', '.tannia/project.json', '.tannia/revision.json'].map((r) => JSON.parse(fs.readFileSync(path.join(pj(), ...r.split('/')), 'utf8')));
    return { revision: est.revision, pendientes: est.pendientes.length, json_legibles: json.length, proceso_terminado: !!hijoPid };
  });
  await paso('10. actualización / reinstalación de la extensión con datos conservados', async () => {
    const antes = sumas(datos); await cliente.close(); cliente = null;
    instalar(); cliente = await conectar(respuestasPersona(5));
    const st = await T('tannia_proyecto_estado', { proyecto: PROY }); const despues = sumas(datos);
    const cambiados = Object.keys(antes).filter((k) => antes[k] !== despues[k] && !k.endsWith('revision.json') && !k.endsWith('auditoria.jsonl'));
    afirmar(cambiados.length === 0, `la reinstalación cambió datos: ${cambiados.slice(0, 5).join(', ')}`);
    return { estado: st.estado, revision: st.revision_datos, archivos_de_datos: Object.keys(despues).length };
  });
  await paso('11. desinstalación: se elimina la extensión y los proyectos quedan intactos', async () => {
    await cliente.close(); cliente = null; const antes = sumas(datos);
    fs.rmSync(extDir, { recursive: true, force: true }); afirmar(!fs.existsSync(extDir), 'extensión no eliminada');
    const despues = sumas(datos); afirmar(JSON.stringify(antes) === JSON.stringify(despues), 'la desinstalación cambió datos');
    return { proyectos: fs.readdirSync(path.join(datos, 'Proyectos')), archivos_conservados: Object.keys(despues).length };
  });
} catch { /* el detalle queda en pasos */ } finally {
  try { await cliente?.close(); } catch { /* cerrado */ }
  informe.fin = new Date().toISOString(); informe.resultado = fallos ? 'FALLA' : 'OK';
  informe.alcance = 'Prueba del artefacto ZIP con Node y el protocolo MCP real en esta plataforma. NO prueba Claude Desktop (interfaz, instalación por doble clic, ventanas de confirmación reales), ni AutoCAD, ni revisión profesional.';
  fs.writeFileSync(salida, `${JSON.stringify(informe, null, 2)}\n`);
  fs.rmSync(base, { recursive: true, force: true });
  for (const p of pasos) console.log(`${p.ok ? 'OK  ' : 'FALLA'} ${p.paso}${p.ok ? '' : ` — ${p.error}`}`);
  console.log(`\n${informe.resultado}: ${informe.zip} sha256=${informe.zip_sha256}\ninforme: ${salida}`);
  process.exit(fallos ? 1 : 0);
}
