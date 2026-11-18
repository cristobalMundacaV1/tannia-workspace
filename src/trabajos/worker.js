// Proceso de fondo de un trabajo (CAD-BG). El coordinador relanza el MISMO punto de entrada del servidor con «--trabajo <id>»
// (src/main.js en desarrollo, server/index.js en el paquete), oculto y con prioridad baja. Importar este módulo no ejecuta nada.
//  - Usa las MISMAS herramientas de Tannia (servidor MCP en memoria), así no hay una segunda lógica de planos, cubicaciones o documentos.
//  - Plataforma «trabajo-sin-cad»: el adaptador COM rechaza toda llamada (AUTOCAD_NO_DISPONIBLE). Este proceso NO puede tocar la sesión
//    de AutoCAD de la persona, ni su documento activo, ni sus ventanas.
//  - TANNIA_SIN_DIALOGO=1 y cliente sin elicitación: ninguna ventana de autorización aparece y nada se aprueba ni se verifica aquí.
//  - DWG: solo por Core Console (modo B). Si no está disponible, el paso queda «requiere intervención»; jamás se usa COM en su lugar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { atomicWriteJson, verificarContencion, readJson, renombrarConReintento } from '../project/store.js';
import { Sandbox } from '../security/sandbox.js';
import { mensajeParaPersona, limitesDelEquipo, rutaBloqueo, procesoVivo } from './coordinador.js';
import { sha256File } from '../security/sandbox.js';
import { huella } from '../autoridad/canonico.js';
import { detectarCoreConsole, convertirDxfADwgSinInterfaz } from './coreconsole.js';
import { seleccionarModalidad } from './modalidades.js';
import { tomarTurnoCad } from './bloqueo_cad.js';
import { avisarEscritorio } from './avisos.js';

export const PLATAFORMA_SIN_CAD = 'trabajo-sin-cad';

/** Ejecuta el trabajo `id` del equipo `home` (lo invoca main.js con --trabajo). */
export async function ejecutarTrabajo(id, home) {
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* se informa en el trabajo */ }
const dir = path.join(path.resolve(home), '.tannia-trabajos'); const f = (ext = 'json') => path.join(dir, `${id}.${ext}`);
const ahora = () => new Date().toISOString();
let t = JSON.parse(fs.readFileSync(f(), 'utf8'));
const guardar = () => { t.actualizado = ahora(); t.mensaje = mensajeParaPersona(t); atomicWriteJson(f(), t); };
const cancelado = () => fs.existsSync(f('cancelar'));
const evento = (e, x = {}) => t.eventos.push({ t: ahora(), evento: e, ...x });
const limites = limitesDelEquipo(home);

// Bloqueo del proyecto: un solo trabajo activo por proyecto, aunque haya varios servidores.
const sandbox = new Sandbox(home);
const lock = rutaBloqueo(home, t.proyecto);

async function main() {
  try { fs.writeFileSync(lock, JSON.stringify({ trabajo: id, pid: process.pid, t: ahora() }), { flag: 'wx' }); }
  catch {
    let otro = null; try { otro = JSON.parse(fs.readFileSync(lock, 'utf8')); } catch { /* ilegible */ }
    let vivo = false; try { process.kill(otro?.pid, 0); vivo = true; } catch (e) { vivo = e.code === 'EPERM'; }
    if (otro && otro.trabajo !== id && vivo) { t.estado = 'PENDIENTE'; t.espera = 'cola'; evento('proyecto_ocupado', { por: otro.trabajo }); fs.rmSync(f('inicio'), { force: true }); guardar(); return; }
    fs.writeFileSync(lock, JSON.stringify({ trabajo: id, pid: process.pid, t: ahora() }));
  }
  t.pid = process.pid; t.latido = ahora(); t.estado = 'PREPARANDO'; evento('proceso_iniciado', { prioridad: (() => { try { return os.getPriority(0); } catch { return null; } })() }); guardar();
  const latido = setInterval(() => { t.latido = ahora(); try { guardar(); } catch { /* el siguiente latido lo reintenta */ } }, 2000); latido.unref();

  sandbox.projectRoot(t.proyecto); // el proyecto existe y es auténtico (sin enlaces fuera de Proyectos)
  const { server } = createServer({ home, platform: PLATAFORMA_SIN_CAD, log: () => {} });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st);
  const client = new Client({ name: 'tannia-trabajo-fondo', version: '1' }); await client.connect(ct); // sin capacidad de elicitación
  const T = async (name, args) => { const r = await client.callTool({ name, arguments: args }); return { error: r.isError ? (r.structuredContent?.error || 'ERROR') : null, texto: r.content?.[0]?.text || '', d: r.structuredContent || {} }; };

  try {
    for (const p of t.pasos) {
      if (p.estado === 'hecho') continue; // reanudación: lo terminado no se repite
      if (cancelado()) { t.estado = 'CANCELADO'; evento('cancelado', { antes_de: p.tipo }); guardar(); return; }
      t.estado = 'PROCESANDO'; p.estado = 'en_curso'; p.inicio = ahora(); guardar();
      const r = await ejecutarPaso(p, T);
      p.fin = ahora();
      if (r.intervencion) { p.estado = 'requiere_intervencion'; p.pregunta = r.pregunta; p.detalle = r.detalle; t.estado = 'REQUIERE_INTERVENCIÓN'; evento('requiere_intervencion', { paso: p.tipo }); guardar(); return; }
      if (r.cancelado) { p.estado = 'cancelado'; t.estado = 'CANCELADO'; evento('cancelado', { durante: p.tipo }); guardar(); return; }
      if (r.error) { p.estado = 'fallo'; p.error = r.error; t.estado = 'FALLÓ'; t.motivo = r.motivo; evento('fallo', { paso: p.tipo, codigo: r.error }); guardar(); return; }
      p.estado = 'hecho'; p.resultado = r.resultado; guardar();
    }
    t.estado = 'VERIFICANDO'; guardar();
    const v = await verificarCoherencia(T);
    t.verificacion = v;
    if (!v.ok) { t.estado = 'FALLÓ'; t.motivo = v.motivo; evento('verificacion_fallida', v); guardar(); return; }
    t.estado = 'TERMINADO'; evento('terminado'); guardar();
  } finally {
    clearInterval(latido);
    try { const u = process.resourceUsage(); t.recursos = { cpu_usuario_ms: Math.round(u.userCPUTime / 1000), cpu_sistema_ms: Math.round(u.systemCPUTime / 1000), memoria_max_mb: Math.round(u.maxRSS / 1024), prioridad: os.getPriority(0), equipo: { cpus: os.cpus().length, memoria_total_mb: Math.round(os.totalmem() / 1048576) } }; } catch { /* informativo */ }
    try { await client.close(); } catch { /* cerrado */ }
    try { const c = JSON.parse(fs.readFileSync(lock, 'utf8')); if (c.trabajo === id) fs.rmSync(lock, { force: true }); } catch { /* sin bloqueo */ }
    fs.rmSync(f('inicio'), { force: true });
    if (['TERMINADO', 'REQUIERE_INTERVENCIÓN', 'FALLÓ'].includes(t.estado)) { t.aviso = avisarEscritorio({ titulo: 'Tannia Workspace', texto: t.mensaje }); try { guardar(); } catch { /* aviso informativo */ } }
  }
}

const errorDe = (r, tipo) => ({ error: r.error, motivo: `${{ planos: 'los planos', a_partidas: 'las cubicaciones', presupuesto: 'el presupuesto', memoria: 'la memoria' }[tipo] || tipo} — ${r.texto.split('\n')[0].replace(/^ERROR [A-Z_]+:\s*/, '').slice(0, 240)}` });

async function ejecutarPaso(p, T) {
  const P = t.proyecto;
  if (p.tipo === 'planos') {
    let args = p.args || {};
    if (!args.especificacion && !args.datos) { // datos del encargo (nunca valores por defecto)
      const plan = await T('tannia_encargo', { proyecto: P, accion: 'plan' });
      if (plan.error || !plan.d.parametros_motor) return { intervencion: true, pregunta: `Para dibujar los planos me faltan datos: ${(plan.d.preguntas || []).map((q) => q.pregunta).slice(0, 4).join(' ') || 'la geometría de la obra'}`, detalle: { faltan: (plan.d.preguntas || []).map((q) => q.clave) } };
      args = { datos: plan.d.parametros_motor };
    }
    const r = await T('tannia_planos', { proyecto: P, accion: args.especificacion ? 'generar' : 'generar_tunel', ...(args.especificacion ? { especificacion: args.especificacion } : { datos: args.datos }), ...(args.papel ? { papel: args.papel } : {}) });
    if (r.error) return errorDe(r, 'planos');
    return { resultado: { revision_planos: r.d.revision, reutilizada: !!r.d.reused, laminas: (r.d.files || []).filter((x) => /lamina-.*\.pdf$/.test(x)).length, carpeta: r.d.folder } };
  }
  if (p.tipo === 'a_partidas') { const r = await T('tannia_planos', { proyecto: P, accion: 'a_partidas', ...(p.args?.asignaciones ? { asignaciones: p.args.asignaciones } : {}) }); return r.error ? errorDe(r, 'a_partidas') : { resultado: { revision_planos: r.d.revision_planos, partidas: r.d.creadas.length, bloqueadas: r.d.bloqueadas.length } }; }
  if (p.tipo === 'presupuesto') { const r = await T('tannia_presupuesto_generar', { proyecto: P }); return r.error ? errorDe(r, 'presupuesto') : { resultado: { archivo: r.d.archivo, revision: r.d.revision, estado: r.d.estado_final_posible ? 'candidato' : 'borrador', etiqueta: r.d.etiqueta_total } }; }
  if (p.tipo === 'memoria') { const r = await T('tannia_informe_generar', { proyecto: P }); return r.error ? errorDe(r, 'memoria') : { resultado: { archivo: r.d.archivo, revision: r.d.revision } }; }
  if (p.tipo === 'dwg') return pasoDwg(p);
  return { error: 'PASO_NO_PERMITIDO', motivo: `paso desconocido ${p.tipo}` };
}

/** Huella del registro de verificación (sin su propio campo `huella`): una edición posterior lo invalida. */
const huellaRegistro = (r) => { const { huella: _h, ...resto } = r; return huella(resto); };

/**
 * BG-R01: un DWG publicado solo se REUTILIZA si todo sigue íntegro: registro con huella válida, de la revisión vigente, que cita el DXF
 * vigente (= manifiesto de planos), con la misma huella de DWG en disco y sin afirmar validación en AutoCAD real. Devuelve los motivos
 * por los que NO se puede reutilizar (lista vacía = reutilizable).
 */
function motivosNoReutilizar({ destino, registro, revision, shaDxf }) {
  const m = [];
  if (!fs.existsSync(destino)) m.push('falta el DWG publicado');
  if (!fs.existsSync(registro)) { m.push('falta el registro de verificación del DWG'); return m; }
  let r; try { r = JSON.parse(fs.readFileSync(registro, 'utf8')); } catch { m.push('el registro de verificación es ilegible'); return m; }
  if (r.schema !== 'tw.dwg_verificacion/1' || r.huella !== huellaRegistro(r)) m.push('el registro de verificación fue modificado después de emitirse');
  if (r.revision_planos !== revision) m.push(`el registro corresponde a otra revisión de planos (${r.revision_planos}; vigente ${revision})`);
  if (r.dxf_sha256 !== shaDxf) m.push('el registro cita un DXF distinto del de los planos vigentes');
  if (fs.existsSync(destino) && sha256File(destino) !== r.sha256) m.push('el DWG cambió en disco después de verificarlo');
  if (r.fidelidad?.autocad_real_verificado !== false) m.push('el registro afirma una validación en AutoCAD real que este proceso no hace');
  return m;
}

/**
 * BG-R02: semáforo GLOBAL del equipo para AutoCAD sin interfaz (un proceso Core Console a la vez, aunque haya varios trabajos,
 * proyectos o servidores). Archivo exclusivo con dueño (pid del trabajo y del proceso CAD); un dueño muerto lo libera.
 */
async function tomarCad(p) {
  return tomarTurnoCad({ archivo: path.join(dir, 'cad.lock'), trabajo: id, cancelado, timeoutMs: limites.tiempo_maximo_ms.dwg, evento,
    esperando: (o) => { p.etapa = 'esperando_cad'; evento('esperando_cad', { por: o?.trabajo ?? 'propietario no identificado' }); guardar(); } });
}

/** DWG sin interfaz (modo B) de la revisión VIGENTE de planos; si B no existe → intervención (nunca COM automático). */
async function pasoDwg(p) {
  const root = sandbox.projectRoot(t.proyecto); const planosDir = path.join(root, '06 Informes', 'Planos');
  const h = readJson(path.join(planosDir, 'historial.json'), null, { raiz: root });
  if (!h?.head) return { error: 'SIN_PLANOS', motivo: 'el archivo DWG — aún no hay planos generados' };
  const sel = seleccionarModalidad('dwg', { coreConsole: detectarCoreConsole() });
  if (sel.modo !== 'B') return { intervencion: true, pregunta: 'Para guardar los planos en DWG necesito usar AutoCAD con su ventana (en este equipo no está disponible AutoCAD sin interfaz). ¿Autorizas abrirlo ahora? Tus dibujos abiertos no se modifican; si prefieres, lo hago después y los DXF y PDF siguen siendo válidos.', detalle: { motivo: sel.motivo, revision_planos: h.head, modalidad_requerida: 'C (con autorización)' } };
  const motor = detectarCoreConsole();
  const dxf = path.join(planosDir, `${h.head}-planos.dxf`); const comp = readJson(path.join(planosDir, `${h.head}-composicion.json`), null, { raiz: root });
  const man = readJson(path.join(planosDir, `${h.head}.manifest.json`), null, { raiz: root });
  const shaDxf = fs.existsSync(dxf) ? sha256File(dxf) : null;
  if (!shaDxf || shaDxf !== man?.archivos?.[`${h.head}-planos.dxf`]?.sha256) return { error: 'PLANOS_ALTERADOS', motivo: 'el archivo DWG — el DXF de los planos vigentes no coincide con su registro de integridad; vuelva a generar los planos' };
  const destDir = path.join(root, '03 Trabajo', 'CAD', 'modelos', h.head); const destino = path.join(destDir, 'planos.dwg');
  const registro = path.join(destDir, 'dwg-verificacion.json');
  verificarContencion(root, destDir); fs.mkdirSync(destDir, { recursive: true });
  let reconciliado = null;
  if (fs.existsSync(destino) || fs.existsSync(registro)) {
    const motivos = motivosNoReutilizar({ destino, registro, revision: h.head, shaDxf });
    if (!motivos.length) { const prev = JSON.parse(fs.readFileSync(registro, 'utf8')); return { resultado: { ...prev, reutilizado: true } }; } // íntegro: no se repite la escritura
    // No se confía en lo que hay: se APARTA (se conserva para revisar, nunca se borra) y se vuelve a convertir y verificar.
    const apartado = path.join(destDir, '.descartados', `${new Date().toISOString().replace(/[:.]/g, '-')}-${id}`);
    verificarContencion(root, apartado); fs.mkdirSync(apartado, { recursive: true });
    for (const x of [destino, registro]) if (fs.existsSync(x)) renombrarConReintento(x, path.join(apartado, path.basename(x)));
    reconciliado = { motivos, apartado: path.relative(root, apartado).split(path.sep).join('/') }; evento('dwg_reconciliado', reconciliado); guardar();
  }
  const prep = path.join(destDir, `.preparando-${id}-${t.intentos}`); // carpeta propia por intento: un proceso huérfano de un intento anterior no la comparte
  verificarContencion(root, prep); fs.rmSync(prep, { recursive: true, force: true });
  for (const e of fs.readdirSync(destDir)) if (e.startsWith(`.preparando-${id}-`) && e !== path.basename(prep)) fs.rmSync(path.join(destDir, e), { recursive: true, force: true }); // restos de un intento interrumpido (nunca publicados)
  const turno = await tomarCad(p);
  if (turno === null) return { cancelado: true };
  if (turno === 'tiempo') return { error: 'CAD_OCUPADO', motivo: 'el archivo DWG — otro trabajo de AutoCAD sin interfaz no terminó a tiempo; se intentará más tarde' };
  try {
    const r = await convertirDxfADwgSinInterfaz({ motor, dxf, destino, composicion: comp, preparacion: prep, timeoutMs: limites.tiempo_maximo_ms.dwg, cancelado, alIniciar: (pid) => { p.pid_cad = pid; turno.anotarCad(pid); guardar(); }, paso: (etapa) => { p.etapa = etapa; guardar(); } });
    if (r.codigo === 'CANCELADO') return { cancelado: true };
    if (r.estado !== 'PUBLICADO_VERIFICADO') return { error: r.codigo, motivo: `el archivo DWG — ${String(r.motivo || r.codigo).replace(/^./, (c) => c.toLowerCase()).replace(/[.\s]+$/, '')}` };
    const auditOk = r.auditoria?.errores_encontrados === 0;
    const rec = { schema: 'tw.dwg_verificacion/1', revision_planos: h.head, archivo: path.relative(root, destino).split(path.sep).join('/'), sha256: r.sha256, dxf_sha256: r.entrada_sha256, modalidad: 'B', motor: { origen: motor.origen, version: motor.version },
      fidelidad: { estado: auditOk ? 'RELECTURA_COINCIDE_CON_EL_MODELO' : 'RELECTURA_COINCIDE_AUDIT_NO_INTERPRETABLE', alcance: 'entidades, capas, coordenadas, cotas, XDATA y layouts que el modelo de Tannia representa, releídos guardando el DWG como DXF (no cubre todo el comportamiento de AutoCAD)', autocad_real_verificado: false, nota: auditOk ? 'Relectura coincidente y AUDIT sin errores informados por el motor indicado. No equivale a validación en AutoCAD 2027 real ni a revisión profesional.' : 'La relectura coincide, pero el informe de AUDIT no se pudo interpretar: no se declara el DWG libre de errores. No equivale a validación en AutoCAD 2027 real ni a revisión profesional.' },
      auditoria: r.auditoria, creado: ahora(), trabajo: id, ...(reconciliado ? { reconciliado } : {}) };
    rec.huella = huellaRegistro(rec);
    if (fs.existsSync(registro)) throw new Error('registro inesperado');
    atomicWriteJson(registro, rec, { raiz: root });
    const h2 = readJson(path.join(planosDir, 'historial.json'), null, { raiz: root });
    return { resultado: { ...rec, ...(h2?.head !== h.head ? { advertencia: `Los planos cambiaron durante la conversión (${h.head} → ${h2?.head}); este DWG corresponde a ${h.head}.` } : {}) } };
  } finally { turno.liberar(); fs.rmSync(prep, { recursive: true, force: true }); }
}

/** Los resultados del trabajo pertenecen a la MISMA revisión de planos vigente; si no, no se presentan como actualizados. */
async function verificarCoherencia(T) {
  const hechos = Object.fromEntries(t.pasos.filter((p) => p.estado === 'hecho').map((p) => [p.tipo, p.resultado]));
  if (!hechos.planos && !hechos.a_partidas && !hechos.dwg) return { ok: true };
  const est = await T('tannia_planos', { proyecto: t.proyecto, accion: 'estado' });
  const head = est.d.head; const integra = est.d.integrity?.estado === 'integra';
  if (!integra) return { ok: false, motivo: 'los archivos de los planos no coinciden con su registro de integridad' };
  for (const [paso, rev] of [['planos', hechos.planos?.revision_planos], ['a_partidas', hechos.a_partidas?.revision_planos], ['dwg', hechos.dwg?.revision_planos]]) if (rev && rev !== head) return { ok: false, motivo: `${paso === 'dwg' ? 'el DWG' : paso === 'a_partidas' ? 'las cubicaciones' : 'los planos'} quedaron de una versión anterior (otra sesión cambió los planos mientras trabajaba): no se presentan como actuales` };
  return { ok: true, revision_planos: head };
}

return main().catch((e) => { try { t.estado = 'FALLÓ'; t.motivo = String(e?.message || e).slice(0, 240); evento('excepcion', { codigo: e?.code || null }); guardar(); } catch { /* sin registro */ } process.exitCode = 1; });
}
