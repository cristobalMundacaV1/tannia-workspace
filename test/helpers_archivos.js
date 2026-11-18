// Constructores de comprimidos para pruebas de recepción (G03). Se escriben byte a byte para controlar lo que una herramienta
// común no permite fabricar: rutas «..», enlaces, cifrado, CRC falso, tamaños mentirosos y datos superpuestos.
import zlib from 'node:zlib';

/**
 * ZIP con control total. Entrada: { nombre, datos, metodo: 0|8, cifrado, enlace, utf8 (def. true), crcFalso, tamanoDeclarado,
 * nombreCrudo (Buffer, sin UTF-8), directorio }. `superponer: [i, j]` hace que la entrada j apunte a los datos de la i.
 */
export function zipBytes(entradas, { superponer = null } = {}) {
  const locales = []; const centrales = []; let off = 0; const offsets = [];
  for (const e of entradas) {
    const datos = Buffer.isBuffer(e.datos) ? e.datos : Buffer.from(e.datos ?? '');
    const metodo = e.metodo ?? 8; const comp = metodo === 8 ? zlib.deflateRawSync(datos) : datos;
    const nb = e.nombreCrudo ?? Buffer.from(e.nombre, 'utf8'); const utf8 = e.nombreCrudo ? false : (e.utf8 ?? true);
    const crc = e.crcFalso ? 0xdeadbeef : (zlib.crc32(datos) >>> 0); const tam = e.tamanoDeclarado ?? datos.length;
    const flags = (utf8 ? 0x800 : 0) | (e.cifrado ? 1 : 0);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(metodo, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(tam, 22); lh.writeUInt16LE(nb.length, 26);
    offsets.push(off); const loc = Buffer.concat([lh, nb, comp]); locales.push(loc);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(e.enlace ? (3 << 8) | 20 : 20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(metodo, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(tam, 24); ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(e.enlace ? ((0o120777 << 16) >>> 0) : (e.directorio ? 0x10 : 0), 38); ch.writeUInt32LE(off, 42);
    centrales.push({ ch, nb }); off += loc.length;
  }
  if (superponer) { const [i, j] = superponer; centrales[j].ch.writeUInt32LE(offsets[i], 42); }
  const cd = Buffer.concat(centrales.map((c) => Buffer.concat([c.ch, c.nb])));
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entradas.length, 8); eocd.writeUInt16LE(entradas.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locales, cd, eocd]);
}

const crc16 = (b) => zlib.crc32(b) & 0xffff;
function hdr(type, flags, body) { const h = Buffer.alloc(7 + body.length); h.writeUInt8(type, 2); h.writeUInt16LE(flags, 3); h.writeUInt16LE(7 + body.length, 5); body.copy(h, 7); h.writeUInt16LE(crc16(h.subarray(2)), 0); return h; }

/** RAR 4 con método «store» (válido para libarchive). `cifrado` marca las entradas como cifradas; `cabeceras_cifradas` el archivo entero. */
export function rar4Bytes(archivos, { cifrado = false, cabeceras_cifradas = false } = {}) {
  const partes = [Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]), hdr(0x73, cabeceras_cifradas ? 0x0080 : 0, Buffer.alloc(6))];
  for (const { nombre, datos } of archivos) {
    const d = Buffer.from(datos); const n = Buffer.from(nombre, 'latin1'); const b = Buffer.alloc(25 + n.length);
    b.writeUInt32LE(d.length, 0); b.writeUInt32LE(d.length, 4); b.writeUInt8(0, 8); b.writeUInt32LE(zlib.crc32(d) >>> 0, 9); b.writeUInt32LE(0x5b710000, 13); b.writeUInt8(20, 17); b.writeUInt8(0x30, 18); b.writeUInt16LE(n.length, 19); b.writeUInt32LE(0x20, 21); n.copy(b, 25);
    partes.push(hdr(0x74, 0x8000 | (cifrado ? 0x04 : 0), b), d);
  }
  partes.push(Buffer.from([0xc4, 0x3d, 0x7b, 0x00, 0x40, 0x07, 0x00]));
  return Buffer.concat(partes);
}

/** DOCX mínimo válido (estructura OOXML) y XLSX se generan con ExcelJS en la prueba. */
export function docxBytes(texto) {
  return zipBytes([
    { nombre: '[Content_Types].xml', datos: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>' },
    { nombre: 'word/document.xml', datos: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${texto}</w:t></w:r></w:p></w:body></w:document>` },
  ]);
}
