// Lector ZIP mínimo (solo lectura en memoria) para DOCX/PPTX con límites anti zip-bomb. No extrae a disco: no hay riesgo de path traversal.
import zlib from 'node:zlib';
export class ZipError extends Error { constructor(code, message) { super(message); this.code = code; } }
export const LIMITES_ZIP = { entradas: 4000, bytes_descomprimidos: 60 * 1024 * 1024, ratio: 200 };

export function leerZip(buf, lim = LIMITES_ZIP) {
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ZipError('ZIP_INVALIDO', 'No es un archivo ZIP/OOXML válido.');
  const n = buf.readUInt16LE(eocd + 10); let off = buf.readUInt32LE(eocd + 16);
  if (n > lim.entradas) throw new ZipError('ZIP_DEMASIADAS_ENTRADAS', `El archivo tiene ${n} entradas (máx. ${lim.entradas}).`);
  const entradas = new Map(); let total = 0;
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new ZipError('ZIP_INVALIDO', 'Directorio central corrupto.');
    const metodo = buf.readUInt16LE(off + 10); const csize = buf.readUInt32LE(off + 20); const usize = buf.readUInt32LE(off + 24); const nl = buf.readUInt16LE(off + 28); const el = buf.readUInt16LE(off + 30); const cl = buf.readUInt16LE(off + 32); const lho = buf.readUInt32LE(off + 42);
    const nombre = buf.toString('utf8', off + 46, off + 46 + nl); off += 46 + nl + el + cl;
    total += usize; if (total > lim.bytes_descomprimidos) throw new ZipError('ZIP_BOMBA', 'El contenido descomprimido excede el límite permitido.');
    if (csize > 0 && usize / csize > lim.ratio) throw new ZipError('ZIP_BOMBA', `Relación de compresión sospechosa en "${nombre}".`);
    entradas.set(nombre, { metodo, csize, usize, lho });
  }
  return {
    nombres: () => [...entradas.keys()],
    leer(nombre) {
      const e = entradas.get(nombre); if (!e) return null;
      const ll = buf.readUInt16LE(e.lho + 26); const le = buf.readUInt16LE(e.lho + 28); const ini = e.lho + 30 + ll + le; const datos = buf.subarray(ini, ini + e.csize);
      if (e.metodo === 0) return datos;
      if (e.metodo === 8) { const out = zlib.inflateRawSync(datos, { maxOutputLength: Math.max(e.usize, 1) + 1024 }); return out; }
      throw new ZipError('ZIP_METODO', `Método de compresión ${e.metodo} no soportado.`);
    },
  };
}
