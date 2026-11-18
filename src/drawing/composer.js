// Compositor de láminas por paneles (PR #38, C5 / PL-C08): vistas a escala fija + cuadros + leyenda + notas + advertencias +
// cajetín, en A3/A2/A1. Nunca reescala la geometría ni reduce texto: si el contenido no cabe, distribuye en láminas de
// continuación explícitas; si una vista sola no cabe en una lámina vacía, error VISTA_NO_CABE.
import { UserError } from '../mcp/util.js';
import { bounds, capasDe, colocacionModelo, PAPERS } from './model.js';
import { ESTILOS, TRAMAS, SIMBOLOS, estiloDeCapa } from './catalog.js';
import { medirTabla } from './tables.js';
import { ancho, envolver, TIPO } from './text_metrics.js';

export const LH = (s) => s * 1.2 + 0.8;
const TITULO_VISTA = 6;
/** Título de vista impreso (mismo texto en composición y en la IR). */
export const tituloVista = (v, hojaLlamada = null) => `${v.title}  ·  ${v.schematic ? 'SIN ESCALA (esquemático)' : `1:${v.scale}${v.verticalScale ? ` H / 1:${v.verticalScale} V` : ''}`}${v.back_ref ? `  ·  Llamada en lámina ${hojaLlamada ?? 'PENDIENTE'}` : ''}`; const BARRA = 7; const GAP = 6; const TITLE_BLOCK = 40;

/** Margen del viewport alrededor de la vista (mm): lo necesario para cotas y rótulos, entre 10 y 20. */
function margenVista(v) {
  const offs = (v.dimensions || []).map((d) => (d.kind === 'radial' ? 12 : Math.abs(d.offset || 0) + 6));
  const labs = (v.labels || []).map((l) => Math.abs(l.dy || 0) + 6);
  return Math.min(20, Math.max(10, ...offs, ...labs));
}

/** Elementos de leyenda REALMENTE usados por un conjunto de vistas (y llamadas) — orden estable: líneas, tramas, símbolos. */
export function leyendaDe(model, views, { llamadas = 0 } = {}) {
  const C = capasDe(model); const items = []; const vistas = new Set();
  const capas = [...new Set(views.flatMap((v) => v.entities.map((e) => e.layer)))];
  if (views.some((v) => (v.dimensions || []).length)) capas.push('COTAS');
  for (const id of capas) {
    if (!C[id]) throw new UserError('CAPA_NO_DECLARADA', `La capa «${id}» no está declarada en el modelo.`);
    if (vistas.has(id)) continue; vistas.add(id); const estilo = estiloDeCapa(id, C[id]);
    items.push({ id, kind: 'line', layer: id, label: C[id].legend, estilo, estado: ESTILOS[estilo].estado, ...C[id] });
  }
  const tramas = new Map(); for (const v of views) for (const r of v.regions || []) { const k = `${r.trama}|${r.etiqueta || r.material?.nombre || ''}`; if (!tramas.has(k)) tramas.set(k, r); }
  for (const [k, r] of tramas) items.push({ id: `H:${k}`, kind: 'hatch', trama: r.trama, label: r.etiqueta || `${r.material?.nombre || TRAMAS[r.trama].significado}${r.material ? ' (declarado)' : ''}`, estado: TRAMAS[r.trama].estado });
  const simbolos = [...new Set(views.flatMap((v) => (v.symbols || []).map((s) => s.symbol)))]; if (llamadas) simbolos.push('DETAIL_CALLOUT');
  for (const s of [...new Set(simbolos)]) { if (!SIMBOLOS[s]) throw new UserError('SIMBOLO_INEXISTENTE', `Símbolo «${s}» sin entrada en el catálogo.`); items.push({ id: `S:${s}`, kind: 'symbol', symbol: s, label: SIMBOLOS[s].significado, estado: SIMBOLOS[s].estado }); }
  return items;
}
export const MUESTRA = 16;
export function medirLeyenda(items, maxLabel = 92) {
  const filas = items.map((it) => envolver(it.label, TIPO.cuerpo, maxLabel));
  const wl = Math.max(...filas.flat().map((s) => ancho(s, TIPO.cuerpo)), ancho('LEYENDA', TIPO.panel));
  const hs = filas.map((f) => Math.max(6, f.length * LH(TIPO.cuerpo)));
  const pie = envolver('Simbología: perfil tw.symbol-catalog/1 PROPUESTO; no es una convención normativa certificada.', TIPO.cuerpo, MUESTRA + 3 + wl);
  return { w: MUESTRA + 3 + wl + 2, h: LH(TIPO.panel) + 1 + hs.reduce((s, x) => s + x, 0) + pie.length * LH(TIPO.cuerpo) + 1, filas, hs, pie };
}
export function medirNotas(notas, w) {
  const filas = notas.map((n) => envolver(`· ${n}`, TIPO.cuerpo, w - 2));
  return { w, h: LH(TIPO.panel) + 1 + filas.flat().length * LH(TIPO.cuerpo), filas };
}

/** Empaque en estanterías: devuelve posiciones relativas o null si no cabe en (W, H). */
function estanterias(items, W, H) {
  const pos = []; let x = 0; let y = 0; let fila = 0;
  for (const it of items) {
    if (it.w > W + 1e-9) return null;
    if (x > 0 && x + it.w > W + 1e-9) { y += fila + GAP; x = 0; fila = 0; }
    pos.push([x, y]); x += it.w + GAP; fila = Math.max(fila, it.h);
  }
  const alto = items.length ? y + fila : 0; return alto <= H + 1e-9 ? { pos, alto } : null;
}
/** Columnas: apila paneles; nueva columna al llenarse. Devuelve posiciones o null. */
function columnas(items, W, H) {
  const pos = []; let x = 0; let y = 0; let col = 0;
  for (const it of items) {
    if (it.h > H + 1e-9) return null;
    if (y > 0 && y + it.h > H + 1e-9) { x += col + GAP; y = 0; col = 0; }
    pos.push([x, y]); y += it.h + GAP; col = Math.max(col, it.w);
  }
  return x + col <= W + 1e-9 ? { pos } : null;
}

function vistaPanel(model, id) {
  const v = model.views.find((x) => x.id === id); if (!v) throw new UserError('VISTA_AUSENTE', id);
  if (!(v.scale > 0) || !Number.isFinite(v.scale)) throw new UserError('ESCALA_INVALIDA', id);
  const box = bounds(v.entities); const sx = 1000 / v.scale; const sy = 1000 / (v.verticalScale || v.scale);
  const w = (box.max[0] - box.min[0]) * sx; const h = (box.max[1] - box.min[1]) * sy; const mv = margenVista(v);
  return { v, box, sx, sy, vw: w + 2 * mv, vh: h + 2 * mv, w: Math.max(w + 2 * mv, ancho(tituloVista(v, '00-00'), TIPO.vista) + 4), h: TITULO_VISTA + h + 2 * mv + BARRA };
}

function intentar(model, hoja, size, margin, vistas, tablas) {
  const X0 = margin + 4; const X1 = size[0] - margin - 4; const Y0 = margin + 12;
  const avisos = model.warnings.flatMap((a) => envolver(a, TIPO.cuerpo, X1 - X0));
  const warnH = avisos.length * LH(TIPO.cuerpo) + 2; const Y1 = size[1] - margin - TITLE_BLOCK - warnH - 2; const W = X1 - X0; const H = Y1 - Y0;
  const vp = vistas.map((id) => vistaPanel(model, id));
  const llamadas = (model.callouts || []).filter((c) => vistas.includes(c.from_view)).length;
  const items = leyendaDe(model, vp.map((p) => p.v), { llamadas });
  const notas = [...new Set(vp.flatMap((p) => p.v.notes || []))];
  const T = tablas.map((t) => ({ t, ...medirTabla(t) })); const L = medirLeyenda(items);
  for (const cfg of ['lateral', 'inferior']) {
    let ok = null;
    if (cfg === 'lateral') {
      const Wc = Math.min(Math.max(100, L.w, ...T.map((x) => x.w)), W * 0.5); const N = notas.length ? medirNotas(notas, Wc) : null;
      if (T.some((x) => x.w > Wc) || L.w > Wc) continue;
      const lado = [...T.map((x) => ({ type: 'table', id: x.t.id, w: x.w, h: x.h, data: x })), { type: 'legend', id: 'leyenda', w: L.w, h: L.h, data: { items, ...L } }, ...(N ? [{ type: 'notes', id: 'notas', w: N.w, h: N.h, data: N }] : [])];
      const c = columnas(lado, Wc, H); const e = estanterias(vp, W - Wc - GAP, H);
      if (c && e) ok = { vistas: e.pos.map(([x, y], i) => [X0 + x, Y0 + y]), paneles: lado.map((p, i) => ({ ...p, x: X1 - Wc + c.pos[i][0], y: Y0 + c.pos[i][1] })) };
    } else {
      const e = estanterias(vp, W, H); if (!e) continue;
      const Hb = H - e.alto - GAP; const Wn = Math.min(150, W); const N = notas.length ? medirNotas(notas, Wn) : null;
      const banda = [...T.map((x) => ({ type: 'table', id: x.t.id, w: x.w, h: x.h, data: x })), { type: 'legend', id: 'leyenda', w: L.w, h: L.h, data: { items, ...L } }, ...(N ? [{ type: 'notes', id: 'notas', w: N.w, h: N.h, data: N }] : [])];
      const c = Hb > 0 ? columnas(banda, W, Hb) : null;
      if (c) ok = { vistas: e.pos.map(([x, y]) => [X0 + x, Y0 + y]), paneles: banda.map((p, i) => ({ ...p, x: X0 + c.pos[i][0], y: Y0 + e.alto + GAP + c.pos[i][1] })) };
    }
    if (!ok) continue;
    const views = vp.map((p, i) => {
      const [px, py] = ok.vistas[i]; const center = [(p.box.min[0] + p.box.max[0]) / 2, (p.box.min[1] + p.box.max[1]) / 2];
      const cx = px + p.w / 2; const cy = py + TITULO_VISTA + p.vh / 2;
      return { ...p.v, bounds: p.box, panel: { x: px, y: py, w: p.w, h: p.h }, viewport: { center, paperCenter: [cx, cy], width: p.vw, height: p.vh, scale: p.sx, verticalScale: p.sy, locked: true }, transform: { sx: p.sx, sy: p.sy, tx: cx - center[0] * p.sx, ty: cy + center[1] * p.sy } };
    });
    return { ok: true, layout: cfg, views, panels: ok.paneles, legend: items, warnings: avisos, warnBand: { x: X0, y: Y1 + 2, w: W, h: warnH } };
  }
  return { ok: false };
}

export function compose(model, { paper = 'A3', orientation = 'landscape', margin = 12, color = 'color' } = {}) {
  if (!PAPERS[paper] || !['landscape', 'portrait'].includes(orientation) || !Number.isFinite(margin) || margin < 8 || margin > 30 || !['color', 'mono'].includes(color)) throw new UserError('PAPEL_INVALIDO', 'Formato, orientación, margen o modo de color no válido.');
  const size = orientation === 'landscape' ? PAPERS[paper] : [...PAPERS[paper]].reverse();
  const sheets = [];
  for (const spec of model.sheets) {
    let vistas = [...spec.views]; let tablas = (model.tables || []).filter((t) => t.sheet === spec.id); let k = 1;
    while (vistas.length || tablas.length) {
      let v = [...vistas]; let t = [...tablas]; let r = intentar(model, spec, size, margin, v, t);
      while (!r.ok) {
        if (t.length) t = t.slice(0, -1); else if (v.length > 1) v = v.slice(0, -1);
        else if (v.length === 1) { const p = vistaPanel(model, v[0]); throw new UserError('VISTA_NO_CABE', `La vista ${v[0]} no cabe a escala 1:${p.v.scale} en ${paper} ${orientation}.`, 'Seleccione un papel mayor. La escala no se ha cambiado.'); }
        else throw new UserError('COMPOSICION_INSUFICIENTE', `Lámina ${spec.id}: los cuadros no caben en ${paper} ${orientation}.`, 'Seleccione un papel mayor.');
        r = intentar(model, spec, size, margin, v, t);
      }
      const id = k === 1 ? spec.id : `${spec.id}-${k}`;
      sheets.push({ id, title: k === 1 ? spec.title : `${spec.title} (continuación ${k})`, continuation_of: k === 1 ? null : spec.id, paper, size, margin, color, layout: r.layout, views: r.views, panels: r.panels, legend: r.legend, warnings: r.warnings, warnBand: r.warnBand,
        titleBlock: { x: margin, y: size[1] - margin - TITLE_BLOCK, width: size[0] - 2 * margin - 74, height: TITLE_BLOCK }, revisionBox: { x: size[0] - margin - 74, y: size[1] - margin - TITLE_BLOCK, w: 74, h: TITLE_BLOCK } });
      vistas = vistas.filter((x) => !v.includes(x)); tablas = tablas.filter((x) => !t.includes(x)); k++;
      if (!v.length && !t.length) throw new UserError('COMPOSICION_INSUFICIENTE', `Lámina ${spec.id}: no se pudo colocar contenido.`);
    }
  }
  // Las llamadas se resuelven contra las láminas REALES (tras paginar): globo → lámina del detalle; detalle → lámina de la llamada.
  const hojaDe = (vid) => sheets.find((s) => s.views.some((v) => v.id === vid))?.id;
  const callouts = (model.callouts || []).map((c) => ({ ...c, source_sheet: hojaDe(c.from_view), target_sheet: hojaDe(c.target_view) }));
  return { schema: 'tw.sheets/2', model, placement: colocacionModelo(model), callouts, sheets, status: 'needs_review' };
}
