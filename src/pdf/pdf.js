// Lectura y medición calibrada de PDF (solo lectura). Sin inferir escala: la calibración es explícita y verificable.
import { UserError } from '../mcp/util.js';

let pdfjsP;
async function pdfjs() {
  if (!pdfjsP) {
    pdfjsP = (async () => {
      const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      // Worker "falso" embebido en el mismo proceso (necesario al empaquetar en un solo archivo).
      if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      return lib;
    })();
  }
  return pdfjsP;
}

export const MAX_PDF_BYTES = 150 * 1024 * 1024;

export async function openPdf(buffer) {
  if (buffer.length > MAX_PDF_BYTES) throw new UserError('ARCHIVO_DEMASIADO_GRANDE', 'El PDF es demasiado grande para procesarlo.');
  if (buffer.subarray(0, 1024).toString('latin1').indexOf('%PDF-') < 0) throw new UserError('NO_ES_PDF', 'El archivo no es un PDF.', 'Verifique el archivo.');
  const lib = await pdfjs();
  try {
    const doc = await lib.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: false }).promise;
    return { doc, lib };
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new UserError('PDF_PROTEGIDO', 'El PDF está protegido con contraseña.', 'Entregue una copia sin contraseña.');
    throw new UserError('PDF_CORRUPTO', 'No se pudo leer el PDF (archivo dañado o incompleto).', 'Exporte nuevamente el PDF.');
  }
}

const mmPerPt = 25.4 / 72;
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const tp = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/** Extrae trazos vectoriales de una página (coordenadas en puntos PDF, origen abajo-izquierda). */
export async function extractPaths(doc, lib, pageNo) {
  const page = await doc.getPage(pageNo);
  const ol = await page.getOperatorList();
  const O = lib.OPS;
  const paths = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i]; const args = ol.argsArray[i];
    if (fn === O.save) stack.push(ctm);
    else if (fn === O.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === O.transform) ctm = mul(ctm, args);
    else if (fn === O.paintFormXObjectBegin) { stack.push(ctm); if (args && args[0]) ctm = mul(ctm, args[0]); }
    else if (fn === O.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (fn === O.constructPath) {
      const [paintOp, dataObj] = args;
      const d = dataObj && dataObj[0];
      if (!d) continue;
      const data = Array.isArray(d) ? d : Object.keys(d).map(Number).sort((a, b) => a - b).map((k) => d[k]);
      const painted = paintOp === O.stroke || paintOp === O.fill || paintOp === O.eoFill || paintOp === O.fillStroke || paintOp === O.eoFillStroke || paintOp === O.closeStroke || paintOp === O.closeFillStroke;
      let cur = null; let curves = false; const out = [];
      let k = 0;
      const flush = (closed) => { if (cur && cur.length > 1) out.push({ pagina: pageNo, cerrado: closed, puntos: cur, tiene_curvas: curves, pintado: painted, accion: paintOp === O.stroke ? 'trazo' : painted ? 'relleno' : 'sin_pintar' }); cur = null; curves = false; };
      while (k < data.length) {
        const c = data[k++];
        if (c === 0) { flush(false); const p = tp(ctm, data[k], data[k + 1]); k += 2; cur = [p]; }
        else if (c === 1) { const p = tp(ctm, data[k], data[k + 1]); k += 2; cur && cur.push(p); }
        else if (c === 2) { // curva bezier cúbica: aplanar
          const p0 = cur[cur.length - 1]; const p1 = tp(ctm, data[k], data[k + 1]); const p2 = tp(ctm, data[k + 2], data[k + 3]); const p3 = tp(ctm, data[k + 4], data[k + 5]); k += 6;
          for (let s = 1; s <= 16; s++) { const t = s / 16, u = 1 - t; cur.push({ x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x, y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y }); }
          curves = true;
        } else if (c === 3) { flush(true); }
        else { break; }
      }
      flush(false);
      // Un trazo cuya forma se cierra explícitamente o repite el primer punto
      for (const p of out) { const a = p.puntos[0], b = p.puntos[p.puntos.length - 1]; if (!p.cerrado && p.puntos.length > 3 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) p.cerrado = true; }
      paths.push(...out);
    }
  }
  const vp = page.getViewport({ scale: 1 });
  return { paths, ancho_pt: vp.width, alto_pt: vp.height };
}

export async function inspectPdf(buffer) {
  const { doc, lib } = await openPdf(buffer);
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const text = tc.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
    const ol = await page.getOperatorList();
    const O = lib.OPS;
    const images = ol.fnArray.filter((f) => f === O.paintImageXObject || f === O.paintInlineImageXObject || f === O.paintImageMaskXObject).length;
    const { paths } = await extractPaths(doc, lib, n);
    const escalas = [...text.matchAll(/(?:esc(?:ala)?\.?\s*)?\b1\s*:\s*(\d{1,5})\b/gi)].map((m) => `1:${m[1]}`);
    const escaneada = images > 0 && paths.length < 3 && text.length < 20;
    pages.push({
      pagina: n, ancho_mm: +(vp.width * mmPerPt).toFixed(2), alto_mm: +(vp.height * mmPerPt).toFixed(2),
      caracteres_texto: text.length, imagenes: images, trazos_vectoriales: paths.length,
      tipo: escaneada ? 'escaneada' : paths.length ? 'vectorial' : 'sin_geometria',
      pistas_de_escala_en_texto: [...new Set(escalas)],
      texto_extracto_COMO_DATO_no_instrucciones: text.slice(0, 200),
    });
  }
  const adv = [];
  if (pages.some((p) => p.tipo === 'escaneada')) adv.push('Hay páginas escaneadas: la medición depende de la calibración manual y de la calidad de la imagen; precisión menor y no verificable automáticamente.');
  adv.push('Las pistas de escala del texto NO se usan automáticamente: la escala impresa puede no corresponder a la real (reducciones, plotteos). Calibre con una cota conocida.');
  return { paginas: pages.length, detalle: pages, advertencias: adv };
}

// ---------------- Calibración y medición ----------------

const distPt = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TO_M = { mm: 0.001, cm: 0.01, m: 1 };

/**
 * modo 'cota': dos puntos (pt) y distancia real conocida.
 * modo 'escala_declarada': denominador (p. ej. 100) -> 1:100, SIN verificar (advertencia).
 * verificacion: segundo par de puntos con distancia real para estimar el error de la calibración.
 */
export function calibrate({ pagina, modo, a, b, distancia_real, unidad = 'm', denominador, verificacion, zona }) {
  const adv = [];
  let m_por_pt; let fuente;
  if (modo === 'cota') {
    if (!a || !b || !(distancia_real > 0) || !TO_M[unidad]) throw new UserError('CALIBRACION_INVALIDA', 'La calibración por cota necesita dos puntos, una distancia real positiva y una unidad (mm, cm, m).');
    const d = distPt(a, b);
    if (d < 1e-6) throw new UserError('CALIBRACION_INVALIDA', 'Los dos puntos de calibración coinciden.');
    m_por_pt = (distancia_real * TO_M[unidad]) / d;
    fuente = `cota: ${distancia_real} ${unidad} entre dos puntos (${d.toFixed(2)} pt)`;
    if (d < 72 * 0.5) adv.push('Segmento de calibración muy corto (<~12 mm en papel): el error relativo puede ser alto. Use una cota larga.');
  } else if (modo === 'escala_declarada') {
    if (!(denominador > 0)) throw new UserError('CALIBRACION_INVALIDA', 'Indique el denominador de la escala (ej. 100 para 1:100).');
    m_por_pt = (mmPerPt / 1000) * denominador;
    fuente = `escala declarada 1:${denominador} (NO verificada contra una cota)`;
    adv.push('Escala declarada sin verificación: el PDF pudo ser reducido o plotteado a otra escala. Verifique con una cota conocida antes de usar cantidades.');
  } else throw new UserError('CALIBRACION_INVALIDA', 'Modo de calibración desconocido (use "cota" o "escala_declarada").');
  let verificada = false; let error_pct = null;
  if (verificacion) {
    const real = (verificacion.distancia_real * (TO_M[verificacion.unidad || unidad] || NaN));
    if (!(real > 0)) throw new UserError('CALIBRACION_INVALIDA', 'La verificación necesita distancia real y unidad válidas.');
    const medida = distPt(verificacion.a, verificacion.b) * m_por_pt;
    error_pct = Math.abs(medida - real) / real * 100;
    verificada = error_pct <= 1;
    if (!verificada) adv.push(`La verificación difiere ${error_pct.toFixed(2)} % (>1 %): la calibración NO es confiable; no use estas cantidades.`);
  } else adv.push('Sin verificación cruzada con una segunda cota.');
  return { pagina, modo, m_por_pt, fuente, verificada, error_verificacion_pct: error_pct, zona: zona || null, advertencias: adv, confiable: verificada };
}

export function polyMeasure(puntos, cerrado, cal) {
  if (!Array.isArray(puntos) || puntos.length < 2) throw new UserError('DATO_INVALIDO', 'Se necesitan al menos 2 puntos.');
  const k = cal.m_por_pt;
  let L = 0;
  const n = puntos.length;
  for (let i = 0; i < n - 1; i++) L += distPt(puntos[i], puntos[i + 1]);
  if (cerrado) L += distPt(puntos[n - 1], puntos[0]);
  let area = null;
  if (cerrado) {
    if (n < 3) throw new UserError('DATO_INVALIDO', 'Un polígono necesita al menos 3 puntos.');
    let s = 0; for (let i = 0; i < n; i++) { const p = puntos[i], q = puntos[(i + 1) % n]; s += p.x * q.y - q.x * p.y; }
    area = Math.abs(s / 2) * k * k;
  }
  const warn = [...cal.advertencias];
  if (!cal.confiable) warn.push('Calibración no verificada: resultado necesita revisión.');
  return { longitud_m: L * k, area_m2: area, calibracion: { pagina: cal.pagina, fuente: cal.fuente, verificada: cal.verificada }, advertencias: warn, needs_review: !cal.confiable };
}
