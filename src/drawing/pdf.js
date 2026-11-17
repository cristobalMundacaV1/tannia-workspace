import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { openPdf } from '../pdf/pdf.js';
import { UserError } from '../mcp/util.js';
import { capasDe, prefijoDe, verifyDimensions } from './model.js';
import { drawingFont } from './font.js';

export const PT = 72 / 25.4;
const number = n => n.toFixed(2).replace('.', ',');
const overlap = (a, b) => a.x < b.x + b.w - 0.15 && a.x + a.w > b.x + 0.15 && a.y < b.y + b.h - 0.15 && a.y + a.h > b.y + 0.15;
function crosses(a, b, box) {
  let lo = 0; let hi = 1; const dx = b[0] - a[0]; const dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - box.x], [dx, box.x + box.w - a[0]], [-dy, a[1] - box.y], [dy, box.y + box.h - a[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return false; }
    else { const r = q / p; if (p < 0) lo = Math.max(lo, r); else hi = Math.min(hi, r); if (lo > hi) return false; }
  } return true;
}
export function sceneForSheet(composition, sheet) {
  const scene = []; const addLine = (a, b, layer = 'COTAS') => scene.push({ kind: 'line', a, b, layer });
  const text = (value, x, y, size = 2.5, maxWidth = 150, align = 'left') => { const entry = { kind: 'text', value, x, y, size, maxWidth, align }; scene.push(entry); return entry; };
  const meta = composition.model.metadata; const w = sheet.size[0]; const h = sheet.size[1]; const m = sheet.margin;
  scene.push({ kind: 'rect', x: m, y: m, w: w - 2 * m, h: h - 2 * m });
  text(`${sheet.id} / ${composition.sheets.length}   ${sheet.title.toUpperCase()}`, m + 4, m + 3, 4, w - 2 * m - 8);
  for (const v of sheet.views) {
    const t = v.transform; const xy = p => [p[0] * t.sx + t.tx, t.ty - p[1] * t.sy];
    for (const e of v.entities) {
      if (e.kind === 'line') addLine(xy(e.a), xy(e.b), e.layer);
      else if (e.kind === 'arc') {
        // True circular model arc; sampled at <=1 degree only for the PDF path.
        const count = Math.max(1, Math.ceil(e.end - e.start)); const points = [];
        for (let i = 0; i <= count; i++) { const a = (e.start + (e.end - e.start) * i / count) * Math.PI / 180; points.push(xy([e.center[0] + e.radius * Math.cos(a), e.center[1] + e.radius * Math.sin(a)])); }
        scene.push({ kind: 'path', points, layer: e.layer });
      }
    }
    for (const label of v.labels) { const p = xy(label.at); text(label.text, p[0], p[1] + label.dy, 2.5, 25, 'center').movable = true; }
    for (const d of v.dimensions) {
      if (d.kind === 'radial') {
        const a = xy(d.center); const angle = d.angle * Math.PI / 180; const b = xy([d.center[0] + d.radius * Math.cos(angle), d.center[1] + d.radius * Math.sin(angle)]);
        addLine(a, b); text(`R ${number(d.value)} m`, a[0] - 35, a[1] - 10, 2.5, 30).movable = true; continue;
      }
      const a = xy(d.a); const b = xy(d.b); const horizontal = Math.abs(d.b[1] - d.a[1]) < 1e-9;
      let c; let e;
      if (horizontal) { const y = Math.max(a[1], b[1]) + d.offset; c = [a[0], y]; e = [b[0], y]; const short = Math.abs(e[0] - c[0]) < 14; text(`${number(d.value)} m`, short ? Math.max(c[0], e[0]) + 9 : (c[0] + e[0]) / 2, short ? y - 1.5 : y + 1, 2.5, 35, 'center').movable = true; }
      else { const x = a[0] + d.offset; c = [x, a[1]]; e = [x, b[1]]; text(`${number(d.value)} m`, x + (d.offset < 0 ? -10 : 10), (a[1] + b[1]) / 2, 2.5, 22, 'center').movable = true; }
      addLine(a, c); addLine(b, e); addLine(c, e);
      for (const p of [c, e]) addLine([p[0] - 1, p[1] + 1], [p[0] + 1, p[1] - 1]);
    }
    text(v.title, v.viewport.paperCenter[0], m + 17, 3, v.viewport.width + 20, 'center');
    const barM = v.scale >= 100 ? 25 : v.scale >= 50 ? 2 : 0.2; const barW = barM * t.sx;
    const bx = v.viewport.paperCenter[0] - barW / 2; const by = h - m - 100;
    addLine([bx, by], [bx + barW, by]); addLine([bx, by - 1], [bx, by + 1]); addLine([bx + barW, by - 1], [bx + barW, by + 1]);
    text(`0                 ${number(barM)} m  |  1:${v.scale}${v.verticalScale ? ` H / 1:${v.verticalScale} V` : ''}`, v.viewport.paperCenter[0], by + 2, 2.5, 100, 'center');
  }
  let ny = h - m - 90;
  for (const v of sheet.views) for (const note of v.notes) { text(note, m + 4, ny, 2.5, w - 2 * m - 8); ny += 4; }
  text(`Leyenda: ${sheet.legend.map(l => l.legend).join(' | ')}`, m + 4, h - m - 65, 2.3, w - 2 * m - 8);
  composition.model.warnings.forEach((warning, i) => text(warning, m + 4, h - m - 59 + i * 4, 2.5, w - 2 * m - 8));
  const rx = w - m - 72; const ry = h - m - 94;
  scene.push({ kind: 'rect', x: rx, y: ry, w: 68, h: 12 }); addLine([rx, ry + 4], [rx + 68, ry + 4]); addLine([rx, ry + 8], [rx + 68, ry + 8]);
  text('REVISIONES: Rev  Fecha  Descripción', rx + 2, ry + 0.6, 2.3, 64);
  text(`${meta.revision}   ${meta.date}   Emisión para revisión`, rx + 2, ry + 4.6, 2.3, 64);
  text('(sin revisiones posteriores)', rx + 2, ry + 8.6, 2.3, 64);
  const b = sheet.titleBlock; scene.push({ kind: 'rect', x: b.x, y: b.y, w: b.width, h: b.height });
  const colW = b.width / 3;
  for (let i = 1; i < 3; i++) addLine([b.x + colW * i, b.y], [b.x + colW * i, b.y + b.height]);
  const cols = [
    [`Institución: ${meta.institution}`, `Proyecto: ${meta.project}`, `Especialidad: ${meta.specialty || 'obras civiles'}`, `Plano: ${sheet.title}`, `Código: ${prefijoDe(composition.model)}-${sheet.id} / ${composition.sheets.length}`, `Origen: ${meta.source}`, `Coordenadas: ${meta.coordinateSystem}`],
    [`Elaborado: ${meta.author}`, `Revisado: ${meta.reviewer}`, `Aprobado: ${meta.approval}`, 'Asignatura / docente: PENDIENTE', 'Firma: no incorporada', `Etapa: ${meta.stage}`, `Formato: ${sheet.paper}; modelo: m; papel: mm`],
    [`Revisión: ${meta.revision}`, `Fecha: ${meta.date}`, 'Cambio: emisión para revisión', 'Responsable revisión: PENDIENTE', 'Estado aprobación: PENDIENTE', `Escalas: ${[...new Set(sheet.views.map(v => `1:${v.scale}`))].join(' / ')}`, 'Imprimir a 100 %, sin ajustar a página'],
  ];
  cols.forEach((col, i) => col.forEach((value, j) => text(value, b.x + i * colW + 2, b.y + 2 + j * 5, 2.3, colW - 4)));
  return distributeAnnotations(scene, sheet);
}

export function distributeAnnotations(scene, sheet) {
  const metrics = new PDFDocument({ autoFirstPage: false }); metrics.registerFont('Drawing', drawingFont);
  const boxFor = e => { metrics.font('Drawing').fontSize(e.size * PT); const w = metrics.widthOfString(e.value) / PT; return { x: e.x - (e.align === 'center' ? w / 2 : 0), y: e.y, w, h: e.size * 1.2 }; };
  const reserved = scene.filter(e => e.kind === 'text' && !e.movable).map(boxFor);
  const segments = scene.flatMap(e => e.kind === 'line' ? [[e.a, e.b]] : e.kind === 'path' ? e.points.slice(1).map((p, i) => [e.points[i], p]) : []);
  const candidates = [[0, 0], ...[4, 8, 12, 16].flatMap(d => [[d, 0], [-d, 0], [0, -d], [0, d], [d, -d], [-d, -d]])];
  for (const e of scene.filter(e => e.kind === 'text' && e.movable)) {
    const original = [e.x, e.y];
    for (const [dx, dy] of candidates) {
      const trial = { ...e, x: original[0] + dx, y: original[1] + dy }; const b = boxFor(trial);
      if (b.x < sheet.margin + 1 || b.x + b.w > sheet.size[0] - sheet.margin - 1 || b.y < sheet.margin + 22 || b.y + b.h > sheet.size[1] - sheet.margin - 100) continue;
      if (reserved.some(r => overlap(r, b)) || segments.some(([a, c]) => crosses(a, c, b))) continue;
      e.x = trial.x; e.y = trial.y; e.displacement_mm = [dx, dy]; break;
    }
    reserved.push(boxFor(e)); // If no candidate fits, validation fails; nothing is silently omitted.
  }
  metrics.end(); return scene;
}

export function validateScene(scene, sheet) {
  const metrics = new PDFDocument({ autoFirstPage: false }); metrics.registerFont('Drawing', drawingFont); const boxes = []; const issues = [];
  for (const e of scene) {
    if (e.kind !== 'text') continue;
    if (/[^\u0020-\u007e\u00a0-\u00ff]/u.test(e.value) || /\?|\uFFFD/.test(e.value)) issues.push({ issue: 'unsupported_glyph', text: e.value });
    metrics.font('Drawing').fontSize(e.size * PT);
    const width = metrics.widthOfString(e.value) / PT; const height = e.size * 1.2;
    if (width > e.maxWidth) issues.push({ issue: 'text_too_wide', text: e.value, width, allowed: e.maxWidth });
    const box = { x: e.x - (e.align === 'center' ? width / 2 : 0), y: e.y, w: width, h: height, text: e.value };
    if (box.x < sheet.margin || box.x + box.w > sheet.size[0] - sheet.margin || box.y < sheet.margin || box.y + box.h > sheet.size[1] - sheet.margin) issues.push({ issue: 'text_outside', text: e.value });
    if (e.size < 2.2) issues.push({ issue: 'text_too_small', text: e.value });
    for (const prior of boxes) if (overlap(prior, box)) issues.push({ issue: 'text_overlap', texts: [prior.text, box.text] });
    boxes.push(box);
  }
  for (const e of scene) {
    const segments = e.kind === 'line' ? [[e.a, e.b]] : e.kind === 'path' ? e.points.slice(1).map((p, i) => [e.points[i], p]) : [];
    for (const [a, b] of segments) {
      if ([a, b].some(p => p[0] < sheet.margin || p[1] < sheet.margin || p[0] > sheet.size[0] - sheet.margin || p[1] > sheet.size[1] - sheet.margin)) issues.push({ issue: 'geometry_outside' });
      for (const box of boxes) if (crosses(a, b, box)) issues.push({ issue: 'text_geometry_collision', text: box.text });
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
  metrics.end(); return { ok: issues.length === 0, issues, textBoxes: boxes };
}

export function buildSheetsPdf(composition, onlyId = null) {
  if (!verifyDimensions(composition.model).ok) throw new UserError('COTAS_INVALIDAS', 'Las cotas no coinciden con la geometría.');
  const sheets = composition.sheets.filter(s => !onlyId || s.id === onlyId);
  if (!sheets.length) throw new UserError('LAMINA_AUSENTE', 'No existe la lámina.');
  const scenes = sheets.map(sheet => { const scene = sceneForSheet(composition, sheet); const qa = validateScene(scene, sheet); if (!qa.ok) throw new UserError('COMPOSICION_INVALIDA', 'La composición necesita corrección antes de exportar.', '', qa); return scene; });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, compress: true, info: { Title: composition.model.metadata.project, Author: composition.model.metadata.author, Creator: 'Tannia Workspace TW12', CreationDate: new Date('2000-01-01T00:00:00Z'), ModDate: new Date('2000-01-01T00:00:00Z') } });
    doc.registerFont('Drawing', drawingFont);
    const chunks = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    sheets.forEach((sheet, index) => {
      doc.addPage({ size: sheet.size.map(v => v * PT), margin: 0 });
      for (const e of scenes[index]) {
        doc.save(); const layer = capasDe(composition.model)[e.layer] || { weight: 0.18 }; doc.lineWidth(layer.weight * PT).strokeColor('black').fillColor('black');
        if (layer.dash) doc.dash(layer.dash[0] * PT, { space: layer.dash[1] * PT });
        if (e.kind === 'line') doc.moveTo(e.a[0] * PT, e.a[1] * PT).lineTo(e.b[0] * PT, e.b[1] * PT).stroke();
        if (e.kind === 'path') { e.points.forEach((p, i) => doc[i ? 'lineTo' : 'moveTo'](p[0] * PT, p[1] * PT)); doc.stroke(); }
        if (e.kind === 'rect') doc.rect(e.x * PT, e.y * PT, e.w * PT, e.h * PT).stroke();
        if (e.kind === 'text') { doc.font('Drawing').fontSize(e.size * PT); const width = doc.widthOfString(e.value); doc.text(e.value, e.x * PT - (e.align === 'center' ? width / 2 : 0), e.y * PT, { lineBreak: false }); }
        doc.restore();
      }
    }); doc.end();
  });
}

export async function verifyPdf(buffer, expectedSheets, { prefijo = 'TW12', marca = 'EJERCICIO ACADÉMICO' } = {}) {
  const { doc: pdf } = await openPdf(buffer); const issues = [];
  try {
    if (pdf.numPages !== expectedSheets.length) issues.push('page_count');
    for (let i = 1; i <= Math.min(pdf.numPages, expectedSheets.length); i++) {
      const page = await pdf.getPage(i); const view = page.getViewport({ scale: 1 }); const sheet = expectedSheets[i - 1];
      if (Math.abs(view.width / PT - sheet.size[0]) > 0.1 || Math.abs(view.height / PT - sheet.size[1]) > 0.1) issues.push(`paper_${i}`);
      const content = await page.getTextContent(); const text = content.items.map(x => x.str).join(' ');
      if (text.length < 150 || !text.includes(`${prefijo}-${sheet.id}`) || !text.includes(marca) || /\uFFFD|\?/.test(text)) issues.push(`content_${i}`);
      const ops = await page.getOperatorList(); if (ops.fnArray.length < 50) issues.push(`empty_${i}`);
    }
    return { ok: !issues.length, issues, pages: pdf.numPages, visual_review: 'PENDING_RENDER_AND_HUMAN_REVIEW', origin: 'drawing_model_not_saved_DWG' };
  } finally { await pdf.destroy(); }
}
