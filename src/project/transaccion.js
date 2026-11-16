// Transacción de versiones de varios archivos (TW09-04): staging + journal + renombrado + historial. Ante un corte, la siguiente
// operación RECONCILIA: los archivos huérfanos (sin entrada en el historial) se apartan a ".huerfanos" (nunca se borran) y no existe
// una versión "a medias". Cada versión deja un manifiesto con el SHA-256 de sus archivos para detectar alteraciones posteriores.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const JOURNAL = '.journal.json';

/** Reconcilia un directorio de versiones. `idsEnHistorial`: ids ya registrados. Devuelve null si no había nada pendiente. */
export function reconciliar(dir, idsEnHistorial) {
  if (!fs.existsSync(dir)) return null;
  const jf = path.join(dir, JOURNAL); let out = null;
  if (fs.existsSync(jf)) {
    let j = null; try { j = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch { j = null; }
    if (j?.id && !idsEnHistorial.includes(j.id)) {
      const dest = path.join(dir, '.huerfanos', `${j.id}-${Date.now()}`); fs.mkdirSync(dest, { recursive: true }); const movidos = [];
      for (const e of fs.readdirSync(dir)) if (e === j.id || e.startsWith(`${j.id}.`) || e.startsWith(`${j.id}_`)) { fs.renameSync(path.join(dir, e), path.join(dest, e)); movidos.push(e); }
      out = { recuperado: true, version: j.id, accion: 'archivos_huerfanos_apartados', movidos, carpeta: path.relative(dir, dest) };
    } else out = { recuperado: true, version: j?.id ?? null, accion: 'journal_residual_eliminado' };
    fs.rmSync(jf, { force: true });
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && e.name.startsWith('.staging-')) { fs.rmSync(path.join(dir, e.name), { recursive: true, force: true }); out = out || { recuperado: true, accion: 'staging_residual_eliminado' }; }
  return out;
}

/**
 * @param archivos [{ nombre, contenido }] — se escriben en staging y luego se mueven; ninguno puede existir ya (versiones inmutables).
 * @param actualizarHistorial () => void — último paso (commit lógico). @param hook (paso) => void — inyección de fallos en pruebas.
 */
export function commitVersion({ dir, id, archivos, actualizarHistorial, hook = () => {} }) {
  fs.mkdirSync(dir, { recursive: true });
  const staging = path.join(dir, `.staging-${id}`); const jf = path.join(dir, JOURNAL);
  for (const a of archivos) if (fs.existsSync(path.join(dir, a.nombre))) throw new UserError('VERSION_EXISTE', `Ya existe ${a.nombre}: las versiones son inmutables y no se sobrescriben.`);
  hook('antes_de_journal'); fs.writeFileSync(jf, JSON.stringify({ id, iniciada: new Date().toISOString(), archivos: archivos.map((a) => a.nombre) }), { flag: 'wx' });
  try {
    fs.mkdirSync(staging); const hashes = {};
    for (const a of archivos) { fs.writeFileSync(path.join(staging, a.nombre), a.contenido, { flag: 'wx' }); hashes[a.nombre] = { sha256: sha(a.contenido), bytes: Buffer.byteLength(a.contenido) }; hook(`staging:${a.nombre}`); }
    fs.writeFileSync(path.join(staging, `${id}.manifest.json`), JSON.stringify({ version: id, creado: new Date().toISOString(), archivos: hashes }, null, 2), { flag: 'wx' });
    hook('staging_completo');
    for (const n of [...archivos.map((a) => a.nombre), `${id}.manifest.json`]) { fs.renameSync(path.join(staging, n), path.join(dir, n)); hook(`movido:${n}`); }
    hook('archivos_en_destino'); actualizarHistorial(); hook('historial_actualizado');
    fs.rmSync(staging, { recursive: true, force: true }); fs.rmSync(jf, { force: true });
  } catch (e) {
    // Fallo antes del commit lógico: se deja el journal para que la siguiente operación reconcilie (o se reconcilia ya si es un error controlado)
    if (e instanceof UserError || e?.code === 'INYECCION') { /* se conserva el estado tal cual para la reconciliación */ }
    throw e;
  }
}

/** Verifica el manifiesto de una versión: cada archivo debe existir con el hash registrado. */
export function verificarManifiesto(dir, id) {
  const mf = path.join(dir, `${id}.manifest.json`);
  if (!fs.existsSync(mf)) return { estado: 'sin_manifiesto', problemas: [] };
  const man = JSON.parse(fs.readFileSync(mf, 'utf8')); const problemas = [];
  for (const [n, info] of Object.entries(man.archivos)) { const f = path.join(dir, n); if (!fs.existsSync(f)) problemas.push({ archivo: n, problema: 'faltante' }); else if (sha(fs.readFileSync(f)) !== info.sha256) problemas.push({ archivo: n, problema: 'modificado' }); }
  return { estado: problemas.length ? 'alterada' : 'integra', problemas, archivos: Object.keys(man.archivos).length };
}
