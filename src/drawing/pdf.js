// Exportador PDF de la Drawing IR v2 (mismas primitivas que el DXF). Color de impresión por estilo del catálogo o monocromo;
// el significado se conserva por grosor y tipo de línea, nunca solo por color (PL-SYM-02 / PL-C03).
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { openPdf } from '../pdf/pdf.js';
import { UserError } from '../mcp/util.js';
import { capasDe, verifyDimensions, patronLinea } from './model.js';
import { drawingFont } from './font.js';
import { ESTILOS, TRAMAS, colorImpresion, estiloDeCapa } from './catalog.js';
import { sceneForSheet as escena, buildIR, textBox, segmentos, crosses } from './ir.js';
import { ancho, PT as PTm } from './text_metrics.js';

export const PT = PTm;
export { buildIR };
const overlap = (a, b) => a.x < b.x + b.w - 0.15 && a.x + a.w > b.x + 0.15 && a.y < b.y + b.h - 0.15 && a.y + a.h > b.y + 0.15;
export const sceneForSheet = (composition, sheet) => escena(composition, sheet);
/** Compatibilidad: la distribución de anotaciones ocurre al construir la escena de la IR. */
export const distributeAnnotations = (scene) => scene;

/** Estilo de impresión de una primitiva (capa → estilo del catálogo; capas de papel → negro fino). */
export function estiloImpresion(model, e, modo = 'color') {
  if (e.kind === 'hatch') { const T = TRAMAS[e.hatch_ref]; return { color: colorImpresion(T.rgb, modo), weight: T.grosor, dash: [] }; }
  const C = capasDe(model); const capa = C[e.layer];
  if (e.layer === 'COTAS' || e.role === 'dimension') return { color: colorImpresion(ESTILOS.DIMENSION.rgb, modo), weight: 0.18, dash: [] };
  if (!capa) return { color: '#000000', weight: e.role === 'frame' || e.role === 'title_block' ? 0.35 : e.role === 'callout' || e.layer === 'TW_SIMBOLOS' ? 0.25 : 0.18, dash: [] };
  const est = ESTILOS[estiloDeCapa(e.layer, capa)];
  return { color: colorImpresion(est.rgb, modo), weight: capa.weight, dash: patronLinea(e.layer, capa).elementos.map(Math.abs) };
}

export function validateScene(scene, sheet) {
  const boxes = []; const issues = [];
  for (const e of scene) {
    if (e.kind !== 'text') continue;
    if (/[^ -~ -ÿ—·²×]/u.test(e.value) || /\?|�/.test(e.value)) issues.push({ issue: 'unsupported_glyph', text: e.value });
    const box = { ...textBox(e), text: e.value }; const width = box.w;
    if (width > e.maxWidth + 1e-6) issues.push({ issue: 'text_too_wide', text: e.value, width, allowed: e.maxWidth });
    if (box.x < sheet.margin || box.x + box.w > sheet.size[0] - sheet.margin || box.y < sheet.margin || box.y + box.h > sheet.size[1] - sheet.margin) issues.push({ issue: 'text_outside', text: e.value });
    if (e.size < 2.2) issues.push({ issue: 'text_too_small', text: e.value });
    for (const prior of boxes) if (overlap(prior, box)) issues.push({ issue: 'text_overlap', texts: [prior.text, box.text] });
    boxes.push(box);
  }
  for (const e of scene) {
    for (const [a, b] of segmentos(e)) {
      if ([a, b].some((p) => p[0] < sheet.margin - 1e-6 || p[1] < sheet.margin - 1e-6 || p[0] > sheet.size[0] - sheet.margin + 1e-6 || p[1] > sheet.size[1] - sheet.margin + 1e-6)) issues.push({ issue: 'geometry_outside', id: e.id });
      for (const box of boxes) if (crosses(a, b, box)) issues.push({ issue: 'text_geometry_collision', text: box.text, id: e.id });
    }
  }
  for (const v of sheet.views || []) {
    const vp = v.viewport; const expected = 1000 / v.scale; const expectedY = 1000 / (v.verticalScale || v.scale);
    if (Math.abs(vp.scale - expected) > 1e-10 || Math.abs(vp.verticalScale - expectedY) > 1e-10 || v.transform.sx !== expected || v.transform.sy !== expectedY) issues.push({ issue: 'viewport_scale_wrong', view: v.id });
    const w = (v.bounds.max[0] - v.bounds.min[0]) * expected; const h = (v.bounds.max[1] - v.bounds.min[1]) * expectedY;
    if (Math.max(w, h) < 20) issues.push({ issue: 'view_too_small', view: v.id });
    if (vp.width < w + 20 || vp.height < h + 20) issues.push({ issue: 'viewport_clips_view', view: v.id });
    if (vp.center.some((n, i) => Math.abs(n - (v.bounds.min[i] + v.bounds.max[i]) / 2) > 1e-8)) issues.push({ issue: 'viewport_wrong_region', view: v.id });
    if (Math.abs(v.transform.tx + vp.center[0] * expected - vp.paperCenter[0]) > 1e-8 || Math.abs(v.transform.ty - vp.center[1] * expectedY - vp.paperCenter[1]) > 1e-8) issues.push({ issue: 'viewport_transform_wrong', view: v.id });
  }
  // Paneles: ninguno se superpone con otro ni con una vista (PL-SHEET-01).
  const rects = [...(sheet.views || []).map((v) => ({ id: `vista ${v.id}`, ...v.panel })), ...(sheet.panels || []).map((p) => ({ id: `panel ${p.id}`, x: p.x, y: p.y, w: p.w, h: p.h }))];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlap(rects[i], rects[j])) issues.push({ issue: 'panel_overlap', panels: [rects[i].id, rects[j].id] });
  return { ok: issues.length === 0, issues, textBoxes: boxes };
}

/** Dibuja una escena (primitivas de la IR) en la página actual. */
function dibujar(doc, model, scene, modo) {
  for (const e of scene) {
    doc.save(); const st = estiloImpresion(model, e, modo); doc.lineWidth(st.weight * PT).strokeColor(st.color).fillColor('#000000');
    if (st.dash.length && e.kind !== 'text') doc.dash(st.dash.map((x) => x * PT));
    if (e.kind === 'line') doc.moveTo(e.a[0] * PT, e.a[1] * PT).lineTo(e.b[0] * PT, e.b[1] * PT).stroke();
    else if (e.kind === 'path') { e.points.forEach((p, i) => doc[i ? 'lineTo' : 'moveTo'](p[0] * PT, p[1] * PT)); if (e.closed) doc.closePath(); doc.stroke(); }
    else if (e.kind === 'rect') doc.rect(e.x * PT, e.y * PT, e.w * PT, e.h * PT).stroke();
    else if (e.kind === 'hatch') {
      // Trama vectorial RECORTADA al contorno (par-impar, con huecos); las líneas ya vienen recortadas: el clip es defensa adicional.
      for (const l of e.loops) { l.forEach((p, i) => doc[i ? 'lineTo' : 'moveTo'](p[0] * PT, p[1] * PT)); doc.closePath(); }
      doc.clip('even-odd'); for (const [a, b] of e.lines) doc.moveTo(a[0] * PT, a[1] * PT).lineTo(b[0] * PT, b[1] * PT); doc.stroke();
    } else if (e.kind === 'text') { doc.font('Drawing').fontSize(e.size * PT); const w = doc.widthOfString(e.value); doc.text(e.value, e.x * PT - (e.align === 'center' ? w / 2 : e.align === 'right' ? w : 0), e.y * PT, { lineBreak: false }); }
    doc.restore();
  }
}

export function buildSheetsPdf(composition, onlyId = null, { modo = null, ir = null } = {}) {
  if (!verifyDimensions(composition.model).ok) throw new UserError('COTAS_INVALIDAS', 'Las cotas no coinciden con la geometría.');
  const I = ir || buildIR(composition); const sheets = composition.sheets.filter((s) => !onlyId || s.id === onlyId);
  if (!sheets.length) throw new UserError('LAMINA_AUSENTE', 'No existe la lámina.');
  const scenes = sheets.map((sheet) => { const scene = I.sheets.find((x) => x.id === sheet.id).primitives; const qa = validateScene(scene, sheet); if (!qa.ok) throw new UserError('COMPOSICION_INVALIDA', 'La composición necesita corrección antes de exportar.', '', qa); return scene; });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, compress: true, info: { Title: composition.model.metadata.project, Author: composition.model.metadata.author, Creator: 'Tannia Workspace TW12', Subject: `${I.schema} revisión ${I.revision}`, CreationDate: new Date('2000-01-01T00:00:00Z'), ModDate: new Date('2000-01-01T00:00:00Z') } });
    doc.registerFont('Drawing', drawingFont);
    const chunks = []; doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    sheets.forEach((sheet, i) => { doc.addPage({ size: sheet.size.map((v) => v * PT), margin: 0 }); dibujar(doc, composition.model, scenes[i], modo || sheet.color || 'color'); });
    doc.end();
  });
}

export async function verifyPdf(buffer, expectedSheets, { prefijo = 'TW12', marca = 'EJERCICIO ACADÉMICO' } = {}) {
  const { doc: pdf } = await openPdf(buffer); const issues = [];
  try {
    if (pdf.numPages !== expectedSheets.length) issues.push('page_count');
    for (let i = 1; i <= Math.min(pdf.numPages, expectedSheets.length); i++) {
      const page = await pdf.getPage(i); const view = page.getViewport({ scale: 1 }); const sheet = expectedSheets[i - 1];
      if (Math.abs(view.width / PT - sheet.size[0]) > 0.1 || Math.abs(view.height / PT - sheet.size[1]) > 0.1) issues.push(`paper_${i}`);
      const content = await page.getTextContent(); const text = content.items.map((x) => x.str).join(' ');
      if (text.length < 150 || !text.includes(`${prefijo}-${sheet.id}`) || !text.includes(marca) || /�|\?/.test(text)) issues.push(`content_${i}`);
      const ops = await page.getOperatorList(); if (ops.fnArray.length < 50) issues.push(`empty_${i}`);
    }
    return { ok: !issues.length, issues, pages: pdf.numPages, visual_review: 'PENDING_RENDER_AND_HUMAN_REVIEW', origin: 'drawing_model_not_saved_DWG' };
  } finally { await pdf.destroy(); }
}
export { ancho };
