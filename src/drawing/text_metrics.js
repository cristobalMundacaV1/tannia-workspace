// Medición tipográfica real (métrica de la fuente embebida en el PDF) y perfil tipográfico de publicación (PL-SHEET-02).
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { drawingFont } from './font.js';

export const PT = 72 / 25.4;
/** Perfil jerárquico en mm de altura de texto impreso a 100 %. Mínimo absoluto 2,5 mm en cuerpo; títulos mayores. */
export const TIPO = { lamina: 4, vista: 3, panel: 3, cuerpo: 2.5, tabla: 2.5, cota: 2.5, cajetin: 2.5, llamada: 2.5, minimo: 2.2 };

let metrics = null;
function m() { if (!metrics) { metrics = new PDFDocument({ autoFirstPage: false }); metrics.registerFont('Drawing', drawingFont); metrics.font('Drawing'); } return metrics; }
/** Ancho en mm de `texto` a altura `size` mm. */
export function ancho(texto, size) { const d = m(); d.fontSize(size * PT); return d.widthOfString(String(texto)) / PT; }

/** Parte un texto en líneas de ancho ≤ `max` mm (por palabras; una palabra más larga se corta por caracteres). */
export function envolver(texto, size, max) {
  const out = []; let linea = '';
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (ancho(prueba, size) <= max) { linea = prueba; continue; }
    if (linea) out.push(linea);
    if (ancho(palabra, size) <= max) { linea = palabra; continue; }
    let trozo = ''; for (const ch of palabra) { if (ancho(trozo + ch, size) > max && trozo) { out.push(trozo); trozo = ''; } trozo += ch; } linea = trozo;
  }
  if (linea) out.push(linea);
  return out.length ? out : [''];
}
