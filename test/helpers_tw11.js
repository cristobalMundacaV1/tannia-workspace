// Generadores de documentos sintéticos (PDF, DOCX, PPTX, XLSX, ZIP) para pruebas de TW-11. Sin material licenciado.
import zlib from 'node:zlib';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zipear(entradas, { metodo = 8 } = {}) {
  const locales = []; const centrales = []; let off = 0;
  for (const [nombre, contenido] of Object.entries(entradas)) {
    const data = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf8'); const comp = metodo === 8 ? zlib.deflateRawSync(data) : data; const nom = Buffer.from(nombre); const crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(metodo, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nom.length, 26);
    locales.push(lh, nom, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(metodo, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nom.length, 28); ch.writeUInt32LE(off, 42);
    centrales.push(ch, nom); off += 30 + nom.length + comp.length;
  }
  const cd = Buffer.concat(centrales); const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(Object.keys(entradas).length, 8); eo.writeUInt16LE(Object.keys(entradas).length, 10); eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([...locales, cd, eo]);
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** bloques: [{h:1, t:'Título'} | {p:'párrafo'}] */
export const docx = (bloques) => zipear({ '[Content_Types].xml': '<Types/>', 'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${bloques.map((b) => b.h ? `<w:p><w:pPr><w:pStyle w:val="Heading${b.h}"/></w:pPr><w:r><w:t>${esc(b.t)}</w:t></w:r></w:p>` : `<w:p><w:r><w:t xml:space="preserve">${esc(b.p)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>` });
export const pptx = (slides) => zipear({ '[Content_Types].xml': '<Types/>', ...Object.fromEntries(slides.map((s, i) => [`ppt/slides/slide${i + 1}.xml`, `<p:sld><p:cSld><p:spTree>${s.map((t) => `<p:sp><p:txBody><a:p><a:r><a:t>${esc(t)}</a:t></a:r></a:p></p:txBody></p:sp>`).join('')}</p:spTree></p:cSld></p:sld>`])) });
export function pdf(paginas) {
  return new Promise((res) => { const d = new PDFDocument({ autoFirstPage: false }); const ch = []; d.on('data', (c) => ch.push(c)); d.on('end', () => res(Buffer.concat(ch))); paginas.forEach((lineas) => { d.addPage(); d.fontSize(11); lineas.forEach((l) => d.text(l)); }); d.end(); });
}
export async function xlsx(hojas) { const wb = new ExcelJS.Workbook(); for (const [n, filas] of Object.entries(hojas)) { const ws = wb.addWorksheet(n); filas.forEach((f) => ws.addRow(f)); } return Buffer.from(await wb.xlsx.writeBuffer()); }
