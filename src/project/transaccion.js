// Transacción de versiones de varios archivos (TW09-04) con EXCLUSIÓN ENTRE PROCESOS.
//   • Bloqueo por directorio atómico (`.lock/` con `owner.json`: pid, token, latido). Una escritura viva JAMÁS es tocada por otra sesión:
//     `reconciliar` solo actúa si logra tomar el bloqueo, y no lo logra mientras el dueño esté vivo.
//   • Una operación se considera ABANDONADA solo si su dueño murió (pid inexistente) o su latido superó la edad máxima. La toma del
//     bloqueo abandonado es atómica (renombrado): si dos procesos lo intentan, solo uno gana.
//   • Staging + journal + manifiesto con hashes. Los archivos huérfanos (sin entrada en el historial) se APARTAN a ".huerfanos"; nunca
//     se borran. El historial se actualiza dentro del bloqueo y como último paso (commit lógico).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { atomicWriteJson, readJson } from './store.js';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const JOURNAL = '.journal.json'; const LOCK = '.lock'; const OWNER = 'owner.json';
export const ESPERA_POR_DEFECTO_MS = 15000; export const EDAD_MAX_BLOQUEO_MS = 10 * 60 * 1000;
const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const leerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/**
 * Toma el bloqueo del directorio. `esperaMs` = 0 → no espera (devuelve null si hay un dueño vivo).
 * @returns {{ token, latido(), liberar(), abandonado: object|null } | null}
 */
export function tomarBloqueo(dir, { esperaMs = ESPERA_POR_DEFECTO_MS, edadMaxMs = EDAD_MAX_BLOQUEO_MS, motivo = 'escritura' } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, LOCK); const fin = Date.now() + esperaMs; const token = crypto.randomUUID(); let abandonado = null;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      const owner = { pid: process.pid, token, host: os.hostname(), inicio: Date.now(), latido: Date.now(), motivo };
      fs.writeFileSync(path.join(lock, OWNER), JSON.stringify(owner));
      const escribir = (o) => { try { fs.writeFileSync(path.join(lock, OWNER), JSON.stringify(o)); } catch { /* el bloqueo pudo ser tomado por abandono */ } };
      return {
        token, abandonado,
        latido() { owner.latido = Date.now(); escribir(owner); },
        liberar() { const o = leerJson(path.join(lock, OWNER)); if (o?.token === token) fs.rmSync(lock, RM); },
      };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const o = leerJson(path.join(lock, OWNER)); let st = null; try { st = fs.statSync(lock); } catch { continue; }
      const edad = Date.now() - (o?.latido ?? st.mtimeMs);
      const mismoHost = !o?.host || o.host === os.hostname();
      const muerto = o ? (mismoHost && !vivo(o.pid)) : edad > 5000; // sin owner.json: creación interrumpida (tras 5 s)
      if (muerto || edad > edadMaxMs) {
        const apartado = `${lock}.abandonado-${token}`;
        try { fs.renameSync(lock, apartado); abandonado = { pid: o?.pid ?? null, motivo: muerto ? 'proceso_inexistente' : 'latido_vencido', edad_ms: edad }; fs.rmSync(apartado, RM); } catch { /* otro proceso lo tomó primero */ }
        continue;
      }
      if (Date.now() >= fin) return null;
      dormir(25);
    }
  }
}

/** Ejecuta `fn` bajo el bloqueo (p. ej. para mover el puntero del historial). Falla con VERSION_EN_CURSO si no se obtiene a tiempo. */
export function conBloqueo(dir, fn, opts = {}) {
  const b = tomarBloqueo(dir, opts);
  if (!b) throw new UserError('VERSION_EN_CURSO', 'Otra sesión está escribiendo en este proyecto en este momento.', 'Espere unos segundos y repita; no se modificó nada.');
  try { return fn(b); } finally { b.liberar(); }
}

const RM = { recursive: true, force: true, maxRetries: 5, retryDelay: 40 };
/** Aparta (renombra, sin copiar) un archivo/carpeta a `.huerfanos`: nunca se borra contenido en preparación. */
function apartar(dir, nombre, carpeta) { fs.mkdirSync(carpeta, { recursive: true }); fs.renameSync(path.join(dir, nombre), path.join(carpeta, nombre)); return nombre; }

function reconciliarBajoBloqueo(dir, idsEnHistorial) {
  let out = null; const jf = path.join(dir, JOURNAL);
  if (fs.existsSync(jf)) {
    const j = leerJson(jf);
    if (j?.id && !idsEnHistorial.includes(j.id)) {
      const dest = path.join(dir, '.huerfanos', `${j.id}-${Date.now()}`); const movidos = [];
      for (const e of fs.readdirSync(dir)) if (e === j.id || e.startsWith(`${j.id}.`) || e.startsWith(`${j.id}_`) || e === `.staging-${j.id}`) movidos.push(apartar(dir, e, dest));
      out = { recuperado: true, version: j.id, accion: 'archivos_huerfanos_apartados', movidos, carpeta: path.relative(dir, dest) };
    } else out = { recuperado: true, version: j?.id ?? null, accion: 'journal_residual_eliminado' };
    fs.rmSync(jf, RM);
  }
  // Staging sin journal (resto de una confirmación ya completada): se aparta, no se borra
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && e.name.startsWith('.staging-')) { apartar(dir, e.name, path.join(dir, '.huerfanos', `residuos-${Date.now()}`)); out = out || { recuperado: true, accion: 'staging_residual_apartado' }; }
  return out;
}

/**
 * Reconcilia un directorio de versiones. NUNCA toca una operación viva: solo actúa si logra tomar el bloqueo (es decir, si no hay un
 * dueño vivo). Devuelve null si no había nada pendiente, `{ en_curso: true }` si hay una escritura viva, o el resultado de la recuperación.
 */
export function reconciliar(dir, idsEnHistorial) {
  if (!fs.existsSync(dir)) return null;
  const b = tomarBloqueo(dir, { esperaMs: 0, motivo: 'reconciliacion' });
  if (!b) return { en_curso: true, accion: 'operacion_en_curso_no_se_toca' };
  try { const ids = typeof idsEnHistorial === 'function' ? idsEnHistorial() : idsEnHistorial; /* releído DENTRO del bloqueo */ const r = reconciliarBajoBloqueo(dir, ids); return r && b.abandonado ? { ...r, bloqueo_abandonado: b.abandonado } : (r ?? (b.abandonado ? { recuperado: true, accion: 'bloqueo_abandonado_liberado', bloqueo_abandonado: b.abandonado } : null)); }
  finally { b.liberar(); }
}

/**
 * @param archivos [{ nombre, contenido }] — se escriben en staging y luego se mueven; ninguno puede existir ya (versiones inmutables).
 * @param idsEnHistorial () => string[] — ids registrados, leídos DENTRO del bloqueo (necesario para recuperar operaciones abandonadas).
 * @param validar (ids) => void — comprobación bajo el bloqueo (p. ej. la versión base sigue vigente); debe lanzar si hay conflicto.
 * @param actualizarHistorial () => void — último paso (commit lógico). @param hook (paso) => void — inyección de fallos/pausas en pruebas.
 */
export function commitVersion({ dir, id, archivos, actualizarHistorial, idsEnHistorial, validar, hook = () => {}, esperaMs = ESPERA_POR_DEFECTO_MS, edadMaxMs = EDAD_MAX_BLOQUEO_MS }) {
  fs.mkdirSync(dir, { recursive: true });
  const b = tomarBloqueo(dir, { esperaMs, edadMaxMs, motivo: `version ${id}` });
  if (!b) throw new UserError('VERSION_EN_CURSO', 'Otra sesión está escribiendo una versión en este proyecto en este momento.', 'Espere unos segundos y repita; no se modificó nada.');
  try {
    const ids = idsEnHistorial ? idsEnHistorial() : null;
    const jf = path.join(dir, JOURNAL); const staging = path.join(dir, `.staging-${id}`);
    // Restos de un proceso muerto (el bloqueo estaba libre): se recuperan ANTES de escribir, sin perder nada
    if (fs.existsSync(jf) || fs.readdirSync(dir).some((e) => e.startsWith('.staging-'))) {
      if (!ids) throw new UserError('VERSION_PENDIENTE_RECONCILIAR', 'Hay una operación anterior sin cerrar y no se puede decidir su destino.', 'Abra el proyecto para reconciliar y repita.');
      reconciliarBajoBloqueo(dir, ids);
    }
    if (validar) validar(ids ?? []);
    if (ids?.includes(id)) throw new UserError('VERSION_CONCURRENTE', `Otra sesión ya creó la versión ${id}.`, 'Vuelva a abrir el proyecto y repita el cambio sobre la versión actual.');
    for (const a of archivos) if (fs.existsSync(path.join(dir, a.nombre))) throw new UserError('VERSION_EXISTE', `Ya existe ${a.nombre}: las versiones son inmutables y no se sobrescriben.`);
    hook('antes_de_journal'); b.latido();
    fs.writeFileSync(jf, JSON.stringify({ id, pid: process.pid, token: b.token, iniciada: new Date().toISOString(), archivos: archivos.map((a) => a.nombre) }), { flag: 'wx' });
    fs.mkdirSync(staging); const hashes = {};
    for (const a of archivos) { fs.writeFileSync(path.join(staging, a.nombre), a.contenido, { flag: 'wx' }); hashes[a.nombre] = { sha256: sha(a.contenido), bytes: Buffer.byteLength(a.contenido) }; hook(`staging:${a.nombre}`); b.latido(); }
    fs.writeFileSync(path.join(staging, `${id}.manifest.json`), JSON.stringify({ version: id, creado: new Date().toISOString(), archivos: hashes }, null, 2), { flag: 'wx' });
    hook('staging_completo'); b.latido();
    for (const n of [...archivos.map((a) => a.nombre), `${id}.manifest.json`]) { fs.renameSync(path.join(staging, n), path.join(dir, n)); hook(`movido:${n}`); }
    hook('archivos_en_destino'); b.latido(); actualizarHistorial(); hook('historial_actualizado');
    fs.rmSync(staging, RM); fs.rmSync(jf, RM);
  } finally { b.liberar(); }
}

/** Verifica el manifiesto de una versión: cada archivo debe existir con el hash registrado. */
export function verificarManifiesto(dir, id) {
  const mf = path.join(dir, `${id}.manifest.json`);
  if (!fs.existsSync(mf)) return { estado: 'sin_manifiesto', problemas: [] };
  const man = JSON.parse(fs.readFileSync(mf, 'utf8')); const problemas = [];
  for (const [n, info] of Object.entries(man.archivos)) { const f = path.join(dir, n); if (!fs.existsSync(f)) problemas.push({ archivo: n, problema: 'faltante' }); else if (sha(fs.readFileSync(f)) !== info.sha256) problemas.push({ archivo: n, problema: 'modificado' }); }
  return { estado: problemas.length ? 'alterada' : 'integra', problemas, archivos: Object.keys(man.archivos).length };
}

/**
 * Confirma una versión Y actualiza el historial bajo el MISMO bloqueo, releyendo el historial fresco (nunca el que cargó el llamador):
 * así una sesión no puede pisar los cambios de otra (nuevas versiones, deshacer/rehacer).
 * @param nuevo objeto de historial inicial (creación) | null  @param base id de la versión sobre la que se edita (modificación)
 */
export function commitConHistorial({ dir, historial, id, archivos, base = null, nuevo = null, entrada = null, errorExiste, hook, esperaMs, edadMaxMs }) {
  const leer = () => readJson(historial, null);
  commitVersion({
    dir, id, archivos, hook, esperaMs, edadMaxMs,
    idsEnHistorial: () => (leer()?.versiones ?? []).map((v) => v.id),
    validar: () => {
      const h = leer();
      if (nuevo) { if (h) throw errorExiste ?? new UserError('HISTORIAL_EXISTE', 'Ya existe un historial para este nombre.'); }
      else if (!h) throw new UserError('HISTORIAL_NO_EXISTE', 'El historial desapareció mientras se preparaba el cambio.');
      else if (h.head !== base) throw new UserError('VERSION_CONCURRENTE', 'La versión actual cambió mientras se preparaba el cambio (otra sesión o un deshacer).', 'Vuelva a abrir el proyecto y repita el cambio sobre la versión actual; no se modificó nada.');
    },
    actualizarHistorial: () => { if (nuevo) atomicWriteJson(historial, nuevo); else { const h = leer(); h.versiones.push(entrada); h.head = id; h.redo = []; atomicWriteJson(historial, h); } },
  });
}

/** Mueve el puntero del historial (deshacer/rehacer/restaurar) bajo el bloqueo, sobre el historial fresco. */
export function mutarHistorial({ dir, historial, fn, esperaMs, edadMaxMs }) {
  return conBloqueo(dir, () => { const h = readJson(historial, null); if (!h) throw new UserError('HISTORIAL_NO_EXISTE', 'No existe el historial.'); const r = fn(h); atomicWriteJson(historial, h); return r; }, { esperaMs, edadMaxMs, motivo: 'historial' });
}
