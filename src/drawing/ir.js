// Drawing IR v2 (`tw.drawing-ir/2`, PR #38 C1/PL-C09): UNA representación intermedia, determinista y serializable, de la que
// salen el PDF y el DXF. Cada primitiva visible lleva id estable, rol, capa, referencia a su fuente/elemento físico (o «unbound»),
// símbolo/trama/cuadro cuando aplica y la revisión. Modelo en metros (coordenadas de vista); papel en mm (y hacia abajo).
// Las primitivas de papel proyectadas desde el modelo (space:'model') las dibuja el PDF; el DXF las escribe UNA vez en el
// espacio modelo (visibles por el viewport). Tramas, leyendas y símbolos son representación: nunca generan cantidades.
import { UserError } from '../mcp/util.js';
import { capasDe, prefijoDe } from './model.js';
import { TRAMAS, SIMBOLOS, CATALOGO_ESQUEMA, CATALOGO_VERSION, estiloDeCapa, ESTILOS } from './catalog.js';
import { validarRegion, densificar, lineasTrama } from './regions.js';
import { primitivasTabla } from './tables.js';
import { ancho, TIPO } from './text_metrics.js';
import { LH, MUESTRA, tituloVista } from './composer.js';

export const IR_ESQUEMA = 'tw.drawing-ir/2';
const number = (n) => n.toFixed(2).replace('.', ',');
const overlap = (a, b) => a.x < b.x + b.w - 0.15 && a.x + a.w > b.x + 0.15 && a.y < b.y + b.h - 0.15 && a.y + a.h > b.y + 0.15;
export function crosses(a, b, box) {
  let lo = 0; let hi = 1; const dx = b[0] - a[0]; const dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - box.x], [dx, box.x + box.w - a[0]], [-dy, a[1] - box.y], [dy, box.y + box.h - a[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return false; } else { const r = q / p; if (p < 0) lo = Math.max(lo, r); else hi = Math.min(hi, r); if (lo > hi) return false; }
  } return true;
}
export const textBox = (e) => { const w = ancho(e.value, e.size); return { x: e.x - (e.align === 'center' ? w / 2 : e.align === 'right' ? w : 0), y: e.y, w, h: e.size * 1.2 }; };
export const segmentos = (e) => (e.kind === 'line' ? [[e.a, e.b]] : e.kind === 'path' ? e.points.slice(1).map((p, i) => [e.points[i], p]).concat(e.closed ? [[e.points[e.points.length - 1], e.points[0]]] : []) : e.kind === 'hatch' ? [...e.lines, ...e.loops.flatMap((l) => l.map((p, i) => [p, l[(i + 1) % l.length]]))] : e.kind === 'rect' ? [[[e.x, e.y], [e.x + e.w, e.y]], [[e.x + e.w, e.y], [e.x + e.w, e.y + e.h]], [[e.x + e.w, e.y + e.h], [e.x, e.y + e.h]], [[e.x, e.y + e.h], [e.x, e.y]]] : []);

/** Geometría de un símbolo del catálogo colocada en papel (mm, y hacia abajo): ancla + rotación (grados, antihorario CAD) × escala. */
export function simboloEnPapel(symbol, at, rot = 0, s = 1) {
  const S = SIMBOLOS[symbol]; if (!S) throw new UserError('SIMBOLO_INEXISTENTE', `Símbolo «${symbol}» sin entrada en el catálogo.`);
  const t = (rot * Math.PI) / 180; const T = (p) => { const x = p[0] * s; const y = p[1] * s; return [at[0] + x * Math.cos(t) - y * Math.sin(t), at[1] - (x * Math.sin(t) + y * Math.cos(t))]; };
  return S.geometria.map((g) => (g.kind === 'line' ? { kind: 'line', a: T(g.a), b: T(g.b) } : { kind: 'path', closed: true, points: Array.from({ length: 48 }, (_, k) => T([g.center[0] + g.radius * Math.cos((k * Math.PI) / 24), g.center[1] + g.radius * Math.sin((k * Math.PI) / 24)])), circle: { center: T(g.center), radius: g.radius * s } }));
}

/** Primitivas del ESPACIO MODELO (coordenadas de vista, m) — fuente única para el DXF y para la proyección del PDF. */
export function primitivasModelo(model) {
  const out = [];
  for (const v of model.views) {
    const ex = v.verticalScale ? v.scale / v.verticalScale : 1;
    for (const e of v.entities) out.push({ id: e.ref || `${v.id}/${e.id}`, view_id: v.id, kind: e.kind === 'arc' && e.end - e.start >= 360 ? 'circle' : e.kind, layer: e.layer, role: e.role || 'representacion', physical_element_ref: e.element || 'unbound', source_ref: e.ref || `${v.id}/${e.id}`, style_ref: estiloDeCapa(e.layer, capasDe(model)[e.layer]), geom: e.kind === 'line' ? { a: e.a, b: e.b } : { center: e.center, radius: e.radius, start: e.start, end: e.end } });
    for (const d of v.dimensions || []) out.push({ id: `dim:${v.id}/${d.id}`, view_id: v.id, kind: 'dimension', layer: 'MODEL_DIMS', role: 'dimension', physical_element_ref: 'unbound', source_ref: `${v.id}/${d.id}`, style_ref: 'DIMENSION', dim: d, text: d.kind === 'radial' ? `R ${number(d.value)} m` : `${number(d.value)} m` });
    for (const r of v.regions || []) {
      if (ex !== 1) throw new UserError('REGION_EN_PERFIL_EXAGERADO', `Vista ${v.id}: no se admiten regiones con escala vertical distinta.`);
      const ok = validarRegion(r);
      out.push({ id: `hatch:${v.id}/${r.id}`, view_id: v.id, kind: 'hatch', layer: `TRAMA_${r.trama}`, role: 'region', measurable: false, physical_element_ref: r.element || 'unbound', source_ref: `${v.id}/${r.id}`, hatch_ref: r.trama, material: r.material || null, loops: [r.contorno, ...(r.huecos || [])], area_control_m2: ok.area_control_m2 });
    }
    for (const s of v.symbols || []) { if (!SIMBOLOS[s.symbol]) throw new UserError('SIMBOLO_INEXISTENTE', `Vista ${v.id}: símbolo «${s.symbol}» sin entrada en el catálogo.`); out.push({ id: `sym:${v.id}/${s.id}`, view_id: v.id, kind: 'symbol', layer: 'TW_SIMBOLOS', role: 'symbol', measurable: false, physical_element_ref: s.element || 'unbound', source_ref: `${v.id}/${s.id}`, symbol_ref: s.symbol, at: s.at, rot: s.rot || 0, scale_m_per_mm: v.scale / 1000 }); }
  }
  return out;
}

function distribuir(scene, sheet, zona = null) {
  const reserved = scene.filter((e) => e.kind === 'text' && !e.movable).map(textBox);
  const segs = scene.filter((x) => x.kind !== 'hatch').flatMap(segmentos); // la trama se enmascara bajo el texto (no lo desplaza)
  const candidates = [[0, 0], ...[4, 8, 12, 16].flatMap((d) => [[d, 0], [-d, 0], [0, -d], [0, d], [d, -d], [-d, -d], [d, d], [-d, d]])];
  for (const e of scene.filter((x) => x.kind === 'text' && x.movable)) {
    const original = [e.x, e.y]; const lim = e.panel || zona;
    for (const [dx, dy] of candidates) {
      const b = textBox({ ...e, x: original[0] + dx, y: original[1] + dy });
      if (b.x < sheet.margin + 1 || b.x + b.w > sheet.size[0] - sheet.margin - 1 || b.y < sheet.margin + 1 || b.y + b.h > sheet.size[1] - sheet.margin - 1) continue;
      if (lim && (b.x < lim.x || b.x + b.w > lim.x + lim.w || b.y < lim.y || b.y + b.h > lim.y + lim.h)) continue;
      if (reserved.some((r) => overlap(r, b)) || segs.some(([a, c]) => crosses(a, c, b))) continue;
      e.x = original[0] + dx; e.y = original[1] + dy; e.displacement_mm = [dx, dy]; break;
    }
    reserved.push(textBox(e));
  }
  return scene;
}

/** Escena de papel de una lámina: primitivas en mm (incluye las proyectadas del modelo, space:'model'). */
export function sceneForSheet(composition, sheet, modelo = null) {
  const model = composition.model; const meta = model.metadata; const w = sheet.size[0]; const h = sheet.size[1]; const m = sheet.margin;
  const prims = modelo || primitivasModelo(model); const scene = []; let n = 0; const id = (g) => `${sheet.id}:${g}:${n++}`;
  const push = (g, e) => { const x = { id: id(g), ...e }; scene.push(x); return x; };
  const text = (g, value, x, y, size = TIPO.cuerpo, maxWidth = 150, align = 'left', extra = {}) => push(g, { kind: 'text', value, x, y, size, maxWidth, align, layer: 'PAPEL', role: 'annotation', ...extra });
  const line = (g, a, b, extra = {}) => push(g, { kind: 'line', a, b, layer: 'PAPEL', role: 'annotation', ...extra });
  push('marco', { kind: 'rect', x: m, y: m, w: w - 2 * m, h: h - 2 * m, layer: 'PAPEL', role: 'frame' });
  text('titulo', `${sheet.id} / ${composition.sheets.length}   ${sheet.title.toUpperCase()}`, m + 4, m + 3, TIPO.lamina, w - 2 * m - 8, 'left', { role: 'sheet_title' });
  const llamadas = (composition.callouts || []).filter((c) => c.source_sheet === sheet.id);
  for (const v of sheet.views) {
    const t = v.transform; const xy = (p) => [p[0] * t.sx + t.tx, t.ty - p[1] * t.sy]; const pnl = v.panel;
    const base = (p) => ({ space: 'model', model_ref: p.id, view_id: v.id, layer: p.layer, role: p.role, physical_element_ref: p.physical_element_ref, source_ref: p.source_ref });
    for (const p of prims.filter((x) => x.view_id === v.id)) {
      if (p.kind === 'line') push('m', { kind: 'line', a: xy(p.geom.a), b: xy(p.geom.b), ...base(p), style_ref: p.style_ref });
      else if (p.kind === 'arc' || p.kind === 'circle') {
        const g = p.geom; const count = Math.max(1, Math.ceil(g.end - g.start)); const points = [];
        for (let i = 0; i <= count; i++) { const a = ((g.start + ((g.end - g.start) * i) / count) * Math.PI) / 180; points.push(xy([g.center[0] + g.radius * Math.cos(a), g.center[1] + g.radius * Math.sin(a)])); }
        push('m', { kind: 'path', points, ...base(p), style_ref: p.style_ref });
      } else if (p.kind === 'hatch') {
        const loops = p.loops.map((l) => densificar(l).map(xy)); const fam = TRAMAS[p.hatch_ref].familias.map((f) => ({ angulo: -f.angulo, paso: f.paso }));
        push('m', { kind: 'hatch', loops, lines: lineasTrama(loops, fam), hatch_ref: p.hatch_ref, material: p.material, measurable: false, ...base(p) });
      } else if (p.kind === 'symbol') {
        for (const g of simboloEnPapel(p.symbol_ref, xy(p.at), p.rot)) push('m', { ...g, ...base(p), symbol_ref: p.symbol_ref, layer: 'TW_SIMBOLOS', inst: { id: p.id, at: xy(p.at), rot: p.rot, s: 1 } });
      } else if (p.kind === 'dimension') {
        const d = p.dim; const dimBase = { ...base(p), layer: 'COTAS', role: 'dimension' };
        if (d.kind === 'radial') {
          const a = xy(d.center); const ang = (d.angle * Math.PI) / 180; const b = xy([d.center[0] + d.radius * Math.cos(ang), d.center[1] + d.radius * Math.sin(ang)]);
          push('m', { kind: 'line', a, b, ...dimBase }); push('m', { kind: 'text', value: p.text, x: a[0] - 35, y: a[1] - 10, size: TIPO.cota, maxWidth: 30, align: 'left', movable: true, panel: pnl, ...dimBase }); continue;
        }
        const a = xy(d.a); const b = xy(d.b); const horizontal = Math.abs(d.b[1] - d.a[1]) < 1e-9; let c; let e;
        if (horizontal) { const y = Math.max(a[1], b[1]) + d.offset; c = [a[0], y]; e = [b[0], y]; const short = Math.abs(e[0] - c[0]) < 14; push('m', { kind: 'text', value: p.text, x: short ? Math.max(c[0], e[0]) + 9 : (c[0] + e[0]) / 2, y: short ? y - 1.5 : y + 1, size: TIPO.cota, maxWidth: 35, align: 'center', movable: true, panel: pnl, ...dimBase }); }
        else { const x = a[0] + d.offset; c = [x, a[1]]; e = [x, b[1]]; push('m', { kind: 'text', value: p.text, x: x + (d.offset < 0 ? -10 : 10), y: (a[1] + b[1]) / 2, size: TIPO.cota, maxWidth: 22, align: 'center', movable: true, panel: pnl, ...dimBase }); }
        push('m', { kind: 'line', a, b: c, ...dimBase }); push('m', { kind: 'line', a: b, b: e, ...dimBase }); push('m', { kind: 'line', a: c, b: e, ...dimBase });
        for (const q of [c, e]) push('m', { kind: 'line', a: [q[0] - 1, q[1] + 1], b: [q[0] + 1, q[1] - 1], ...dimBase });
      }
    }
    for (const label of v.labels || []) { const p = xy(label.at); text('rotulo', label.text, p[0], p[1] + label.dy, TIPO.cuerpo, 25, 'center', { movable: true, panel: pnl, view_id: v.id, role: 'label' }); }
    text('vista', tituloVista(v, (composition.callouts || []).find((c) => c.target_view === v.id)?.source_sheet), pnl.x + pnl.w / 2, pnl.y, TIPO.vista, pnl.w, 'center', { role: 'view_title', view_id: v.id, detail_ref: v.detail_ref || null });
    if (!v.schematic) {
      const barM = v.scale >= 100 ? 25 : v.scale >= 50 ? 2 : v.scale >= 20 ? 0.5 : 0.2; const barW = barM * t.sx; const bx = v.viewport.paperCenter[0] - barW / 2; const by = pnl.y + pnl.h - 5.5;
      line('barra', [bx, by], [bx + barW, by], { role: 'scale_bar' }); line('barra', [bx, by - 1], [bx, by + 1], { role: 'scale_bar' }); line('barra', [bx + barW, by - 1], [bx + barW, by + 1], { role: 'scale_bar' });
      // Escala gráfica con sus DOS extremos rotulados (UAT AutoCAD 2027: «0 / 0,50 m» parecía una cota sin referentes).
      text('barra', '0', bx, by + 1.6, TIPO.cuerpo, 10, 'center', { role: 'scale_bar' }); text('barra', `${number(barM)} m`, bx + barW, by + 1.6, TIPO.cuerpo, 20, 'center', { role: 'scale_bar' });
    }
  }
  // Paneles: cuadros, leyenda (muestras REALES desde el catálogo) y notas.
  for (const pnl of sheet.panels) {
    if (pnl.type === 'table') scene.push(...primitivasTabla(pnl.data.t, pnl.x, pnl.y, sheet.id, pnl.data));
    else if (pnl.type === 'legend') {
      const L = pnl.data; text('leyenda', 'LEYENDA', pnl.x, pnl.y, TIPO.panel, pnl.w, 'left', { layer: 'TW_LEYENDA', role: 'legend_title' }); let y = pnl.y + LH(TIPO.panel) + 1;
      L.items.forEach((it, i) => {
        const cy = y + L.hs[i] / 2; const sx0 = pnl.x; const sx1 = pnl.x + MUESTRA; const ref = { layer: 'TW_LEYENDA', role: 'legend_sample', legend_ref: it.id };
        if (it.kind === 'line') push('leyenda', { kind: 'line', a: [sx0, cy], b: [sx1, cy], ...ref, layer: it.layer, style_ref: it.estilo });
        else if (it.kind === 'hatch') { const loops = [[[sx0, cy - 2], [sx1, cy - 2], [sx1, cy + 2], [sx0, cy + 2]]]; push('leyenda', { kind: 'hatch', loops, lines: lineasTrama(loops, TRAMAS[it.trama].familias.map((f) => ({ angulo: -f.angulo, paso: f.paso }))), hatch_ref: it.trama, ...ref, layer: `TRAMA_${it.trama}` }); }
        else { const sc = it.symbol === 'DETAIL_CALLOUT' ? 0.55 : 1; const inst = { id: `${sheet.id}:leyenda:${it.id}`, at: [(sx0 + sx1) / 2, cy], rot: 0, s: sc }; for (const g of simboloEnPapel(it.symbol, inst.at, 0, sc)) push('leyenda', { ...g, ...ref, symbol_ref: it.symbol, layer: 'TW_SIMBOLOS', inst }); }
        L.filas[i].forEach((s, k) => text('leyenda', s, pnl.x + MUESTRA + 3, y + k * LH(TIPO.cuerpo) + (L.hs[i] - L.filas[i].length * LH(TIPO.cuerpo)) / 2, TIPO.cuerpo, pnl.w, 'left', { layer: 'TW_LEYENDA', role: 'legend_label', legend_ref: it.id }));
        y += L.hs[i];
      });
      for (const s of L.pie) { text('leyenda', s, pnl.x, y + 0.5, TIPO.cuerpo, pnl.w, 'left', { layer: 'TW_LEYENDA', role: 'legend_note' }); y += LH(TIPO.cuerpo); }
    } else if (pnl.type === 'notes') {
      text('notas', 'NOTAS', pnl.x, pnl.y, TIPO.panel, pnl.w, 'left', { layer: 'TW_NOTAS', role: 'notes_title' }); let y = pnl.y + LH(TIPO.panel) + 1;
      for (const f of pnl.data.filas) for (const s of f) { text('notas', s, pnl.x, y, TIPO.cuerpo, pnl.w, 'left', { layer: 'TW_NOTAS', role: 'note' }); y += LH(TIPO.cuerpo); }
    }
  }
  sheet.warnings.forEach((s, i) => text('aviso', s, sheet.warnBand.x, sheet.warnBand.y + i * LH(TIPO.cuerpo), TIPO.cuerpo, sheet.warnBand.w, 'left', { role: 'warning' }));
  const rb = sheet.revisionBox; push('revision', { kind: 'rect', x: rb.x, y: rb.y, w: rb.w, h: rb.h, layer: 'PAPEL', role: 'revision_box' });
  for (let i = 1; i < 4; i++) line('revision', [rb.x, rb.y + i * 6.5], [rb.x + rb.w, rb.y + i * 6.5], { role: 'revision_box' });
  text('revision', 'REVISIONES: Rev  Fecha  Descripción', rb.x + 2, rb.y + 1.2, TIPO.cajetin, rb.w - 4, 'left', { role: 'revision_box' });
  text('revision', `${meta.revision}   ${meta.date}   Emisión para revisión`, rb.x + 2, rb.y + 7.7, TIPO.cajetin, rb.w - 4, 'left', { role: 'revision_box' });
  text('revision', '(sin revisiones posteriores)', rb.x + 2, rb.y + 14.2, TIPO.cajetin, rb.w - 4, 'left', { role: 'revision_box' });
  text('revision', 'Estado: BORRADOR PARA REVISIÓN', rb.x + 2, rb.y + 21, TIPO.cajetin, rb.w - 4, 'left', { role: 'revision_box' });
  const b = sheet.titleBlock; push('cajetin', { kind: 'rect', x: b.x, y: b.y, w: b.width, h: b.height, layer: 'PAPEL', role: 'title_block' }); const colW = b.width / 3;
  for (let i = 1; i < 3; i++) line('cajetin', [b.x + colW * i, b.y], [b.x + colW * i, b.y + b.height], { role: 'title_block' });
  const cols = [
    [`Institución: ${meta.institution}`, `Proyecto: ${meta.project}`, `Especialidad: ${meta.specialty || 'obras civiles'}`, `Plano: ${sheet.title}`, `Código: ${prefijoDe(model)}-${sheet.id} / ${composition.sheets.length}`, `Origen: ${meta.source}`, `Coordenadas: ${meta.coordinateSystem}`],
    [`Elaborado: ${meta.author}`, `Revisado: ${meta.reviewer}`, `Aprobado: ${meta.approval}`, 'Asignatura / docente: PENDIENTE', 'Firma: no incorporada', `Etapa: ${meta.stage}`, `Formato: ${sheet.paper}; modelo: m; papel: mm`],
    [`Revisión: ${meta.revision}`, `Fecha: ${meta.date}`, 'Cambio: emisión para revisión', 'Responsable revisión: PENDIENTE', 'Estado aprobación: PENDIENTE', `Escalas: ${[...new Set(sheet.views.map((v) => (v.schematic ? 'S/E' : `1:${v.scale}`)))].join(' / ')}`, 'Imprimir a 100 %, sin ajustar a página'],
  ];
  cols.forEach((col, i) => col.forEach((value, j) => text('cajetin', value, b.x + i * colW + 2, b.y + 1.5 + j * 5.4, TIPO.cajetin, colW - 4, 'left', { role: 'title_block' })));
  distribuir(scene, sheet);
  colocarLlamadas(scene, sheet, llamadas, text, line, push);
  enmascararTramas(scene);
  return scene;
}

/** Máscara de texto en tramas (como el «background mask» CAD): las líneas de trama se interrumpen bajo cada texto, +0,6 mm. */
function enmascararTramas(scene) {
  const cajas = scene.filter((e) => e.kind === 'text').map((e) => { const b = textBox(e); return { x: b.x - 0.6, y: b.y - 0.6, w: b.w + 1.2, h: b.h + 1.2 }; });
  for (const h of scene.filter((e) => e.kind === 'hatch')) {
    let segs = h.lines;
    for (const c of cajas) segs = segs.flatMap(([a, b]) => {
      let lo = 0; let hi = 1; const dx = b[0] - a[0]; const dy = b[1] - a[1];
      for (const [p, q] of [[-dx, a[0] - c.x], [dx, c.x + c.w - a[0]], [-dy, a[1] - c.y], [dy, c.y + c.h - a[1]]]) { if (Math.abs(p) < 1e-12) { if (q < 0) return [[a, b]]; } else { const r = q / p; if (p < 0) lo = Math.max(lo, r); else hi = Math.min(hi, r); } }
      if (lo >= hi) return [[a, b]]; const P = (t) => [a[0] + dx * t, a[1] + dy * t]; const out = [];
      if (lo > 1e-6) out.push([a, P(lo)]); if (hi < 1 - 1e-6) out.push([P(hi), b]); return out;
    });
    if (segs.length !== h.lines.length || segs.some((x, i) => x !== h.lines[i])) h.masked = true;
    h.lines = segs;
  }
}

/** Globos D1–D4 con líder al punto de anclaje: posición buscada sin colisión con textos, cotas ni geometría. */
function colocarLlamadas(scene, sheet, llamadas, text, line, push) {
  for (const c of llamadas) {
    const v = sheet.views.find((x) => x.id === c.from_view); const t = v.transform; const A = [c.at[0] * t.sx + t.tx, t.ty - c.at[1] * t.sy]; const R = 4.5;
    const boxes = scene.filter((e) => e.kind === 'text').map(textBox); const segs = scene.flatMap(segmentos); let ok = null;
    for (const d of [16, 22, 28, 34]) {
      for (let k = 0; k < 16 && !ok; k++) {
        const ang = (k * Math.PI) / 8; const C = [A[0] + d * Math.cos(ang), A[1] - d * Math.sin(ang)]; const caja = { x: C[0] - R - 0.5, y: C[1] - R - 0.5, w: 2 * R + 1, h: 2 * R + 1 };
        const p = v.panel; if (caja.x < p.x || caja.x + caja.w > p.x + p.w || caja.y < p.y + 6 || caja.y + caja.h > p.y + p.h - 7) continue;
        const L0 = [C[0] - R * Math.cos(ang), C[1] + R * Math.sin(ang)];
        if (boxes.some((b) => overlap(b, caja) || crosses(L0, A, b)) || segs.some(([a, b]) => crosses(a, b, caja))) continue;
        ok = { C, L0 };
      }
      if (ok) break;
    }
    if (!ok) throw new UserError('LLAMADA_SIN_ESPACIO', `No hay lugar libre para la llamada ${c.label} en la lámina ${sheet.id}.`, 'Use un papel mayor; no se superponen llamadas sobre cotas ni textos.');
    const ref = { layer: 'TW_LLAMADAS', role: 'callout', callout_ref: c.id, detail_ref: c.target_view, target_sheet: c.target_sheet };
    for (const g of simboloEnPapel('DETAIL_CALLOUT', ok.C)) push('llamada', { ...g, ...ref, symbol_ref: 'DETAIL_CALLOUT', inst: { id: `${sheet.id}:${c.id}`, at: ok.C, rot: 0, s: 1 } });
    line('llamada', ok.L0, A, ref);
    text('llamada', c.label, ok.C[0], ok.C[1] - 3.6, TIPO.llamada, 8, 'center', ref);
    text('llamada', c.target_sheet, ok.C[0], ok.C[1] + 0.6, TIPO.llamada, 8, 'center', ref);
  }
}

/** IR completa de la composición (lo que consumen PDF y DXF). */
export function buildIR(composition) {
  const model = composition.model; const modelo = primitivasModelo(model);
  const ids = new Set(); for (const p of modelo) { if (ids.has(p.id)) throw new UserError('IR_ID_DUPLICADO', `Primitiva duplicada en la IR: ${p.id}`); ids.add(p.id); }
  validarReferencias(composition);
  const sheets = composition.sheets.map((s) => ({ id: s.id, name: `${prefijoDe(model)}-${s.id}`, title: s.title, paper: s.paper, size: s.size, margin: s.margin,
    viewports: s.views.map((v) => ({ view_id: v.id, paperCenter: v.viewport.paperCenter, width: v.viewport.width, height: v.viewport.height, scale: v.viewport.scale, verticalScale: v.viewport.verticalScale, center: v.viewport.center, schematic: !!v.schematic })),
    primitives: sceneForSheet(composition, s, modelo) }));
  const usados = { estilos: [...new Set(modelo.map((p) => p.style_ref).filter(Boolean))], tramas: [...new Set(modelo.filter((p) => p.kind === 'hatch').map((p) => p.hatch_ref))], simbolos: [...new Set(sheets.flatMap((s) => s.primitives.map((p) => p.symbol_ref)).filter(Boolean))] };
  return { schema: IR_ESQUEMA, compat: model.schema, revision: model.metadata.revision, units: { model: 'm', paper: 'mm' }, catalog: { schema: CATALOGO_ESQUEMA, version: CATALOGO_VERSION, usados, estilos: Object.fromEntries(usados.estilos.map((k) => [k, ESTILOS[k]])) }, placement: composition.placement, callouts: composition.callouts || [], tables: (model.tables || []).map((t) => t.id), model: modelo, sheets };
}

/** Referencias bidireccionales (PL-CALLOUT-01): globo → detalle existente en su lámina real; detalle → llamada que lo cita. */
export function validarReferencias(composition) {
  const model = composition.model; const problemas = []; const ids = new Set();
  for (const c of composition.callouts || []) {
    if (ids.has(c.id) || ids.has(c.label)) problemas.push(`llamada duplicada ${c.id}`); ids.add(c.id); ids.add(c.label);
    const det = model.views.find((v) => v.id === c.target_view);
    if (!det) problemas.push(`llamada ${c.id}: detalle ${c.target_view} inexistente`);
    else if (!det.detail_ref || det.detail_ref !== c.label) problemas.push(`llamada ${c.id}: el detalle ${c.target_view} no se identifica como ${c.label}`);
    if (!c.target_sheet) problemas.push(`llamada ${c.id}: el detalle no está en ninguna lámina`);
    if (!c.source_sheet) problemas.push(`llamada ${c.id}: la vista de origen ${c.from_view} no está en ninguna lámina`);
    if (det?.back_ref && det.back_ref.view !== c.from_view) problemas.push(`detalle ${det.id}: cita la vista ${det.back_ref.view} y la llamada sale de ${c.from_view}`);
  }
  for (const v of model.views.filter((x) => x.detail_ref)) if (!(composition.callouts || []).some((c) => c.target_view === v.id)) problemas.push(`detalle ${v.id} sin llamada que lo cite (huérfano)`);
  if (problemas.length) throw new UserError('REFERENCIAS_INVALIDAS', `Referencias de detalle inválidas: ${problemas.join('; ')}.`, '', { problemas });
  return { ok: true };
}
