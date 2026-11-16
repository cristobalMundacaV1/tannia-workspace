// Extracción de texto con LOCALIZADORES (página, sección, hoja, diapositiva, línea). Todo texto extraído es DATO (nunca instrucción).
import { leerZip } from './zip.js';
import { openPdf } from '../../pdf/pdf.js';

export const MAX_CARACTERES = 4_000_000;
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const decodeXml = (s) => s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (m, n, d, h) => (n ? ENT[`&${n.toLowerCase()};`] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16))));
const limpiar = (s) => s.replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

/** Divide en pasajes por párrafos agrupados (≤ max caracteres) conservando el localizador. */
export function trocear(parrafos, loc, max = 1100) {
  const out = []; let cur = '';
  const flush = () => { if (cur.trim()) out.push({ locator: { ...loc }, text: cur.trim() }); cur = ''; };
  for (const p of parrafos) { const t = p.trim(); if (!t) continue; if ((cur + '\n' + t).length > max && cur) flush(); if (t.length > max) { for (let i = 0; i < t.length; i += max) { cur = t.slice(i, i + max); flush(); } } else cur = cur ? `${cur}\n${t}` : t; }
  flush(); return out;
}

export function extraerTexto(texto, { formato = 'txt' } = {}) {
  const lineas = texto.replace(/\r/g, '').split('\n'); const pasajes = []; let ruta = []; let buf = []; let ini = 1;
  const cerrar = () => { if (buf.length) pasajes.push(...trocear(buf, { section: ruta.join(' > ') || null, heading_path: [...ruta], line: ini })); buf = []; };
  lineas.forEach((ln, i) => {
    const h = formato === 'md' ? /^(#{1,6})\s+(.*\S)\s*$/.exec(ln) : null;
    if (h) { cerrar(); const nivel = h[1].length; ruta = [...ruta.slice(0, nivel - 1), h[2].trim()]; ini = i + 2; }
    else if (ln.trim() === '') { if (buf.length && buf[buf.length - 1] !== '') buf.push(''); if (buf.length === 1) ini = i + 2; }
    else { if (!buf.length) ini = i + 1; buf.push(ln.trim()); }
  });
  cerrar(); return pasajes.map((p) => ({ ...p, text: p.text.replace(/\n{2,}/g, '\n') }));
}

export async function extraerPdf(buffer) {
  const { doc } = await openPdf(buffer); const pasajes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p); const tc = await page.getTextContent(); let linea = ''; const lineas = []; let lastY = null;
    for (const it of tc.items) { if (!('str' in it)) continue; const y = Math.round(it.transform[5]); if (lastY !== null && Math.abs(y - lastY) > 2 && linea) { lineas.push(linea); linea = ''; } linea += (linea && !linea.endsWith(' ') && it.str && !it.str.startsWith(' ') ? ' ' : '') + it.str; lastY = y; }
    if (linea) lineas.push(linea);
    pasajes.push(...trocear(lineas.map((l) => l.trim()).filter(Boolean), { page: p }));
  }
  await doc.destroy?.(); return pasajes;
}

export function extraerDocx(buffer) {
  const zip = leerZip(buffer); const x = zip.leer('word/document.xml'); if (!x) throw new Error('DOCX sin word/document.xml');
  const xml = x.toString('utf8'); const pasajes = []; let ruta = []; let buf = []; let ini = 0; let k = 0;
  const cerrar = () => { if (buf.length) pasajes.push(...trocear(buf, { section: ruta.join(' > ') || null, heading_path: [...ruta], line: ini + 1 })); buf = []; };
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    k++; const p = m[0]; const estilo = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] || '';
    const t = limpiar(decodeXml([...p.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>/g)].map((q) => (q[1] === undefined ? ' ' : q[1])).join('')));
    const h = /^(?:Heading|Ttulo|Título|Titulo)\s*(\d)$/i.exec(estilo);
    if (h && t) { cerrar(); const n = Number(h[1]); ruta = [...ruta.slice(0, n - 1), t]; ini = k; } else if (t) { if (!buf.length) ini = k; buf.push(t); }
  }
  cerrar(); return pasajes;
}

export function extraerPptx(buffer) {
  const zip = leerZip(buffer); const slides = zip.nombres().map((n) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(n)).filter(Boolean).map((m) => ({ n: Number(m[1]), nombre: m[0] })).sort((a, b) => a.n - b.n); const out = [];
  for (const s of slides) { const xml = zip.leer(s.nombre).toString('utf8'); const parr = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map((p) => limpiar(decodeXml([...p[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((q) => q[1]).join('')))).filter(Boolean); out.push(...trocear(parr, { slide: s.n })); }
  return out;
}

export async function extraerXlsx(buffer) {
  const ExcelJS = (await import('exceljs')).default ?? (await import('exceljs')); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); const out = [];
  wb.eachSheet((ws) => { const filas = []; ws.eachRow({ includeEmpty: false }, (row, i) => { const vals = []; row.eachCell({ includeEmpty: false }, (c) => { let v = c.value; if (v && typeof v === 'object') v = v.result ?? v.text ?? (v.richText ? v.richText.map((r) => r.text).join('') : ''); if (v !== null && v !== undefined && v !== '') vals.push(String(v)); }); if (vals.length) filas.push(`F${i}: ${vals.join(' | ')}`); }); out.push(...trocear(filas, { sheet: ws.name })); });
  return out;
}

/** Despacha por extensión. Devuelve {formato, pasajes[{locator,text}], chars}. */
export async function extraer(buffer, nombre) {
  const ext = (nombre.split('.').pop() || '').toLowerCase(); let pasajes; let formato = ext;
  if (ext === 'pdf') pasajes = await extraerPdf(buffer);
  else if (ext === 'docx') pasajes = extraerDocx(buffer);
  else if (ext === 'pptx') pasajes = extraerPptx(buffer);
  else if (ext === 'xlsx') pasajes = await extraerXlsx(buffer);
  else if (ext === 'md' || ext === 'markdown') { formato = 'md'; pasajes = extraerTexto(buffer.toString('utf8'), { formato: 'md' }); }
  else if (ext === 'txt' || ext === 'csv') { formato = 'txt'; pasajes = extraerTexto(buffer.toString('utf8'), { formato: 'txt' }); }
  else { const e = new Error(`Formato no soportado: .${ext}`); e.code = 'FORMATO_NO_SOPORTADO'; throw e; }
  const chars = pasajes.reduce((a, p) => a + p.text.length, 0); if (chars > MAX_CARACTERES) { const e = new Error('Documento demasiado extenso para indexar.'); e.code = 'DOCUMENTO_DEMASIADO_EXTENSO'; throw e; }
  return { formato, pasajes, chars };
}
