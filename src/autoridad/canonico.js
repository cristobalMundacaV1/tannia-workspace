// Serialización canónica y huellas deterministas para revisiones, recibos y manifiestos.
// Sin reloj ni orden de inserción dentro de la huella: el mismo contenido produce siempre la misma huella.
import crypto from 'node:crypto';

/** JSON canónico: claves ordenadas, sin espacios; rechaza números no finitos y tipos no serializables. */
export function canonico(v) {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new TypeError('Número no finito en contenido canónico.');
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map((x) => canonico(x === undefined ? null : x)).join(',')}]`;
  if (typeof v === 'object') {
    const claves = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  }
  throw new TypeError(`Tipo no serializable en contenido canónico: ${typeof v}`);
}

export const huella = (v) => crypto.createHash('sha256').update(canonico(v)).digest('hex');
export const sha256Buf = (b) => crypto.createHash('sha256').update(b).digest('hex');
export const idAleatorio = (prefijo) => `${prefijo}-${crypto.randomBytes(8).toString('hex')}`;
