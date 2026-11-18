// Coordinador de trabajos en segundo plano (CAD-BG §4 y §6). La persona pide planos y sigue trabajando: el trabajo corre en un PROCESO
// PROPIO, oculto y de prioridad baja; el chat queda libre; el estado se consulta cuando se quiera y se avisa al terminar.
//
// Garantías en software:
//  - Un trabajo se ejecuta UNA vez: el inicio se reclama con un archivo exclusivo (wx); dos servidores no lo duplican.
//  - Un solo trabajo activo por proyecto (evita escrituras en conflicto) y un tope global según el hardware.
//  - Cancelación cooperativa (bandera) + terminación del proceso si no responde; reanudación tras caída: los pasos terminados no se repiten.
//  - Nada de interfaz: el proceso de fondo no puede usar COM (plataforma «sin CAD») ni abrir ventanas de autorización (TANNIA_SIN_DIALOGO).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { atomicWriteJson } from '../project/store.js';
import { UserError } from '../mcp/util.js';

export const ESQUEMA_TRABAJO = 'tw.trabajo/1';
export const ESTADOS = ['PENDIENTE', 'PREPARANDO', 'PROCESANDO', 'VERIFICANDO', 'TERMINADO', 'REQUIERE_INTERVENCIÓN', 'FALLÓ', 'CANCELADO'];
export const ACTIVOS = new Set(['PREPARANDO', 'PROCESANDO', 'VERIFICANDO']);
export const FINALES = new Set(['TERMINADO', 'REQUIERE_INTERVENCIÓN', 'FALLÓ', 'CANCELADO']);
export const PASOS = ['planos', 'a_partidas', 'presupuesto', 'memoria', 'dwg'];
/**
 * Punto de entrada que se relanza con --trabajo: el del servidor en ejecución (src/main.js o server/index.js del paquete). En el
 * paquete CommonJS `import.meta.url` no existe, por eso se usa primero el script en ejecución y la variable de soporte.
 */
export function entradaTrabajo() {
  if (process.env.TANNIA_ENTRADA_TRABAJO) return path.resolve(process.env.TANNIA_ENTRADA_TRABAJO);
  const a = process.argv[1] || '';
  if (/(server[\\/]index\.js|src[\\/]main\.js)$/.test(a)) return a;
  let u = null; try { u = import.meta?.url || null; } catch { u = null; }
  return u ? path.join(path.dirname(fileURLToPath(u)), '..', 'main.js') : a;
}

/** Límites adaptados al equipo, sin que la persona configure nada. Un equipo modesto ejecuta un trabajo a la vez. */
export function limitesPorHardware({ cpus = os.cpus().length, totalmem = os.totalmem(), sobre = {} } = {}) {
  const gb = totalmem / 1073741824;
  const base = {
    trabajos_simultaneos: cpus <= 4 || gb < 12 ? 1 : 2, // nunca más de 2: el computador debe seguir utilizable
    cad_simultaneos: 1, // Core Console es pesado: uno a la vez en todo el equipo
    memoria_libre_minima_mb: 512, // por debajo se espera (no se arranca un proceso pesado)
    heap_trabajo_mb: Math.max(512, Math.min(2048, Math.floor((totalmem / 1048576) / 4))),
    tiempo_maximo_ms: { planos: 10 * 60000, a_partidas: 2 * 60000, presupuesto: 5 * 60000, memoria: 5 * 60000, dwg: 15 * 60000 },
    latido_vencido_ms: 90000,
    reintentos_tras_caida: 1,
  };
  return { ...base, ...sobre, tiempo_maximo_ms: { ...base.tiempo_maximo_ms, ...(sobre.tiempo_maximo_ms || {}) } };
}

/** Archivo de bloqueo del proyecto (compartido por coordinador y proceso de fondo). */
export function rutaBloqueo(home, proyecto) { return path.join(path.resolve(home), '.tannia-trabajos', 'bloqueos', `${crypto.createHash('sha256').update(String(proyecto).normalize('NFC').toLowerCase()).digest('hex').slice(0, 24)}.lock`); }

/** Límites del equipo + ajustes de soporte (<home>/.tannia-trabajos/config.json). Coordinador y proceso de fondo usan los mismos. */
export function limitesDelEquipo(home) { let sobre = {}; try { sobre = JSON.parse(fs.readFileSync(path.join(path.resolve(home), '.tannia-trabajos', 'config.json'), 'utf8')); } catch { /* sin ajustes */ } return limitesPorHardware({ sobre }); }

export function procesoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; }
  // Linux: un proceso terminado cuyo padre murió puede quedar «zombi» (sin recoger); ya no trabaja ni escribe.
  try { const st = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return !/^\d+ \(.*\) Z /.test(st); } catch { return true; }
}

const PLURAL = { planos: 'los planos', a_partidas: 'las cubicaciones', presupuesto: 'el presupuesto', memoria: 'la memoria', dwg: 'el archivo DWG' };

/** Mensaje sencillo para la persona (sin estados internos, rutas técnicas ni nombres de herramientas). */
export function mensajeParaPersona(t) {
  const obra = t.proyecto ? `«${t.proyecto}»` : 'la obra';
  const total = t.pasos.length; const hechos = t.pasos.filter((p) => p.estado === 'hecho');
  const actual = t.pasos.find((p) => p.estado === 'en_curso'); const primero = PLURAL[t.pasos[0]?.tipo] || 'el trabajo';
  const listos = (xs) => `${capital(listaY(xs.map((p) => PLURAL[p.tipo])))} de ${obra} ${xs.length === 1 && xs[0].tipo !== 'planos' && xs[0].tipo !== 'a_partidas' ? 'está listo' : 'están listos'}`;
  switch (t.estado) {
    case 'PENDIENTE': return t.espera === 'memoria' ? `El computador tiene poca memoria libre en este momento; empiezo con ${primero} de ${obra} apenas se libere. Puedes seguir trabajando.` : t.espera === 'cola' ? `Hay otro trabajo en curso; empiezo con ${primero} de ${obra} apenas termine. Puedes seguir trabajando.` : `Estoy preparando ${primero} de ${obra}. Puedes seguir utilizando tu computador; te aviso cuando esté listo.`;
    case 'PREPARANDO': case 'PROCESANDO': case 'VERIFICANDO': return `Sigo trabajando en ${obra}${actual ? `: ${PLURAL[actual.tipo]} (paso ${hechos.length + 1} de ${total})` : ''}. Puedes seguir utilizando tu computador.`;
    case 'TERMINADO': {
      const dwgPendiente = t.pasos.some((p) => p.tipo === 'planos') && !t.pasos.some((p) => p.tipo === 'dwg' && p.estado === 'hecho');
      return `${listos(hechos)} para revisión.${dwgPendiente ? ' Falta comprobar el archivo DWG en AutoCAD.' : ''}`;
    }
    case 'REQUIERE_INTERVENCIÓN': { const p = t.pasos.find((x) => x.estado === 'requiere_intervencion'); return `${hechos.length ? `${listos(hechos)}. ` : ''}${p?.pregunta || 'Necesito tu intervención para continuar.'}`; }
    case 'FALLÓ': return `No pude terminar el trabajo de ${obra}: ${String(t.motivo || 'ocurrió un error').replace(/[.\s]+$/, '')}. Lo que ya estaba listo sigue intacto y la versión anterior se conserva.`;
    case 'CANCELADO': return `Detuve el trabajo de ${obra}. No quedó nada a medias y la versión anterior sigue vigente.`;
    default: return '';
  }
}
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const listaY = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);

export class Coordinador {
  constructor({ home, limites = null, workerPath = null, lanzar = null, memoriaLibre = () => os.freemem(), ahora = () => Date.now() }) {
    this.home = path.resolve(home); this.dir = path.join(this.home, '.tannia-trabajos');
    this.limites = limites || limitesDelEquipo(this.home);
    this.workerPath = workerPath || entradaTrabajo(); this.memoriaLibre = memoriaLibre; this.ahora = ahora;
    this.lanzar = lanzar || ((id) => this.#lanzarProceso(id));
    this.hijos = new Map(); this.vigilancia = null;
  }

  #f(id, ext = 'json') { if (!/^trb-[0-9a-f]{12}$/.test(String(id))) throw new UserError('TRABAJO_NO_EXISTE', 'No existe ese trabajo.'); return path.join(this.dir, `${id}.${ext}`); }
  #lock(proyecto) { return rutaBloqueo(this.home, proyecto); }

  leer(id) { try { return JSON.parse(fs.readFileSync(this.#f(id), 'utf8')); } catch (e) { if (e instanceof UserError) throw e; return null; } }
  escribir(t) { t.actualizado = new Date(this.ahora()).toISOString(); atomicWriteJson(this.#f(t.id), t); return t; }
  listar({ proyecto = null } = {}) {
    if (!fs.existsSync(this.dir)) return [];
    return fs.readdirSync(this.dir).filter((n) => /^trb-[0-9a-f]{12}\.json$/.test(n)).map((n) => this.leer(n.slice(0, -5))).filter(Boolean)
      .filter((t) => !proyecto || t.proyecto === proyecto).sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0) || a.creado.localeCompare(b.creado)); // FIFO estable
  }

  /** Crea un trabajo PENDIENTE. `pasos`: [{ tipo, args }] en el orden en que se ejecutan. No arranca nada por sí mismo: ver programar(). */
  crear({ proyecto, pasos, origen = 'conversacion' }) {
    if (!Array.isArray(pasos) || !pasos.length || pasos.length > PASOS.length) throw new UserError('DATO_INVALIDO', 'Indique los pasos del trabajo.');
    for (const p of pasos) if (!PASOS.includes(p.tipo)) throw new UserError('PASO_NO_PERMITIDO', `«${p.tipo}» no se ejecuta en segundo plano.`, `Pasos permitidos: ${PASOS.join(', ')}. Verificar cantidades y aprobar entregas son actos de una persona.`);
    fs.mkdirSync(path.join(this.dir, 'bloqueos'), { recursive: true });
    Coordinador.contador = ((Coordinador.contador || 0) + 1) % 1000;
    const t = { schema: ESQUEMA_TRABAJO, id: `trb-${crypto.randomBytes(6).toString('hex')}`, proyecto, origen, estado: 'PENDIENTE', creado: new Date(this.ahora()).toISOString(), secuencia: this.ahora() * 1000 + Coordinador.contador, pasos: pasos.map((p) => ({ tipo: p.tipo, args: p.args || {}, estado: 'pendiente' })), eventos: [], intentos: 0, pid: null, latido: null, motivo: null };
    t.mensaje = mensajeParaPersona(t); this.escribir(t); return t;
  }

  cancelar(id) {
    const t = this.leer(id); if (!t) throw new UserError('TRABAJO_NO_EXISTE', 'No existe ese trabajo.');
    if (FINALES.has(t.estado)) return t;
    fs.writeFileSync(this.#f(id, 'cancelar'), new Date(this.ahora()).toISOString());
    if (t.estado === 'PENDIENTE' && !fs.existsSync(this.#f(id, 'inicio'))) { // aún no arrancó: se cancela sin proceso
      t.estado = 'CANCELADO'; t.eventos.push({ t: new Date(this.ahora()).toISOString(), evento: 'cancelado_antes_de_iniciar' }); t.mensaje = mensajeParaPersona(t); return this.escribir(t);
    }
    const h = this.hijos.get(id);
    if (h) setTimeout(() => { if (procesoVivo(h.pid) && !FINALES.has(this.leer(id)?.estado)) { try { process.kill(h.pid); } catch { /* ya terminó */ } } }, 15000).unref(); // si no responde a la bandera
    return this.leer(id);
  }

  /** Arranca pendientes dentro de los límites: uno por proyecto, tope global, memoria libre mínima. */
  programar() {
    const todos = this.listar(); const activos = todos.filter((t) => ACTIVOS.has(t.estado));
    let libres = this.limites.trabajos_simultaneos - activos.length; const iniciados = [];
    const ocupados = new Set(activos.map((t) => t.proyecto));
    for (const t of todos.filter((x) => x.estado === 'PENDIENTE')) {
      if (fs.existsSync(this.#f(t.id, 'cancelar'))) { t.estado = 'CANCELADO'; t.mensaje = mensajeParaPersona(t); this.escribir(t); continue; }
      const espera = ocupados.has(t.proyecto) || libres <= 0 ? 'cola' : (this.memoriaLibre() / 1048576 < this.limites.memoria_libre_minima_mb ? 'memoria' : null);
      if (espera) { if (t.espera !== espera) { t.espera = espera; t.mensaje = mensajeParaPersona(t); this.escribir(t); } continue; }
      let fd; try { fd = fs.openSync(this.#f(t.id, 'inicio'), 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd); } catch { continue; } // otro servidor ya lo reclamó
      t.estado = 'PREPARANDO'; t.espera = null; t.intentos += 1; t.eventos.push({ t: new Date(this.ahora()).toISOString(), evento: 'iniciado', intento: t.intentos }); t.mensaje = mensajeParaPersona(t); this.escribir(t);
      ocupados.add(t.proyecto); libres -= 1; iniciados.push(t.id);
      const hijo = this.lanzar(t.id); if (Number.isInteger(hijo?.pid)) { const x = this.leer(t.id); if (x && !x.pid) { x.pid = hijo.pid; this.escribir(x); } }
    }
    if (iniciados.length || activos.length) this.#vigilar();
    return iniciados;
  }

  /** Tras un reinicio o una caída: los trabajos «en curso» cuyo proceso ya no existe vuelven a la cola (si quedan intentos) o fallan. */
  reanudar() {
    const out = [];
    for (const t of this.listar().filter((x) => ACTIVOS.has(x.estado))) {
      const vencido = !procesoVivo(t.pid) || (t.latido && this.ahora() - Date.parse(t.latido) > this.limites.latido_vencido_ms);
      if (!vencido) continue;
      if (procesoVivo(t.pid)) { try { process.kill(t.pid); } catch { /* ya terminó */ } }
      fs.rmSync(this.#f(t.id, 'inicio'), { force: true });
      for (const p of t.pasos) if (p.estado === 'en_curso') { if (procesoVivo(p.pid_cad)) { try { process.kill(p.pid_cad); } catch { /* ya terminó */ } } p.estado = 'pendiente'; p.pid_cad = null; } // lo terminado no se repite; un proceso CAD huérfano se detiene
      const cancelado = fs.existsSync(this.#f(t.id, 'cancelar'));
      if (cancelado) t.estado = 'CANCELADO';
      else if (t.intentos <= this.limites.reintentos_tras_caida) { t.estado = 'PENDIENTE'; t.espera = null; }
      else { t.estado = 'FALLÓ'; t.motivo = 'el proceso se interrumpió más de una vez'; }
      t.eventos.push({ t: new Date(this.ahora()).toISOString(), evento: 'interrupcion_detectada', pid: t.pid, nuevo_estado: t.estado });
      t.pid = null; t.mensaje = mensajeParaPersona(t); this.escribir(t); this.#liberarBloqueo(t);
      out.push({ id: t.id, estado: t.estado });
    }
    return out;
  }

  #liberarBloqueo(t) { try { const l = this.#lock(t.proyecto); const c = JSON.parse(fs.readFileSync(l, 'utf8')); if (c.trabajo === t.id) fs.rmSync(l, { force: true }); } catch { /* sin bloqueo */ } }
  bloqueoProyecto(proyecto) { return this.#lock(proyecto); }

  #vigilar() {
    if (this.vigilancia) return;
    this.vigilancia = setInterval(() => {
      const r = this.reanudar(); for (const t of this.listar().filter((x) => ACTIVOS.has(x.estado))) {
        const ini = t.eventos.filter((e) => e.evento === 'iniciado').at(-1); const max = t.pasos.reduce((s, p) => s + (this.limites.tiempo_maximo_ms[p.tipo] || 600000), 0) + 60000;
        if (ini && this.ahora() - Date.parse(ini.t) > max && procesoVivo(t.pid)) { try { process.kill(t.pid); } catch { /* ya terminó */ } }
      }
      if (r.length || this.listar().some((x) => x.estado === 'PENDIENTE')) this.programar();
      if (!this.listar().some((x) => ACTIVOS.has(x.estado) || x.estado === 'PENDIENTE')) { clearInterval(this.vigilancia); this.vigilancia = null; }
    }, 5000);
    this.vigilancia.unref(); // la vigilancia nunca mantiene vivo al servidor
  }

  #lanzarProceso(id) {
    const env = { ...process.env, TANNIA_HOME: this.home, TANNIA_SIN_DIALOGO: '1', TANNIA_TRABAJO_ID: id };
    const child = spawn(process.execPath, [`--max-old-space-size=${this.limites.heap_trabajo_mb}`, this.workerPath, '--trabajo', id], { env, windowsHide: true, stdio: 'ignore', detached: false });
    try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* el propio proceso de fondo lo vuelve a intentar */ }
    this.hijos.set(id, { pid: child.pid });
    child.on('exit', () => { this.hijos.delete(id); setImmediate(() => { this.reanudar(); this.programar(); }); });
    child.unref();
    return child;
  }
}
