// Motor de cuadros técnicos (PR #38, C4 / PL-C07): filas y columnas tipadas, unidades, formato numérico, referencias a la fuente,
// envoltura de celdas y pie. Un valor ausente se muestra PENDIENTE; nunca se completa. La tabla produce primitivas de papel (mm).
import { UserError } from '../mcp/util.js';
import { ancho, envolver, TIPO } from './text_metrics.js';

const PAD = 1.5; const LH = TIPO.tabla * 1.2 + 0.6;
export const formatear = (v, dec) => (v === null || v === undefined ? 'PENDIENTE' : typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(dec ?? 2).replace('.', ',') : 'PENDIENTE') : String(v));

export function validarTabla(t) {
  const ctx = `Cuadro ${t?.id ?? '?'}`;
  if (!t || typeof t.id !== 'string' || !t.title || !Array.isArray(t.columns) || !t.columns.length || !Array.isArray(t.rows)) throw new UserError('TABLA_INVALIDA', `${ctx}: requiere id, título, columnas y filas.`);
  const keys = new Set(); for (const c of t.columns) { if (!c.key || !c.label || keys.has(c.key)) throw new UserError('TABLA_INVALIDA', `${ctx}: columna sin clave/rótulo o duplicada (${c.key}).`); keys.add(c.key); }
  const ids = new Set(); for (const r of t.rows) { if (!r.id || ids.has(r.id)) throw new UserError('TABLA_INVALIDA', `${ctx}: fila sin id o duplicada (${r.id}).`); ids.add(r.id); for (const k of Object.keys(r.values || {})) if (!keys.has(k)) throw new UserError('TABLA_INVALIDA', `${ctx}: la fila ${r.id} trae la columna desconocida «${k}».`); }
  return t;
}

/** Texto de cada celda (formateado) — también lo usan los oráculos de paridad. */
export const celdas = (t) => t.rows.map((r) => t.columns.map((c) => formatear(r.values?.[c.key], r.fmt?.[c.key])));

/** Mide la tabla con anchos de columna naturales (tope `maxCol` mm, con envoltura). */
export function medirTabla(t, { maxCol = 70 } = {}) {
  validarTabla(t); const C = celdas(t);
  const anchos = t.columns.map((c, j) => Math.min(maxCol, Math.max(ancho(c.label, TIPO.tabla), ...C.map((r) => ancho(r[j], TIPO.tabla))) + 2 * PAD));
  const titulo = Math.max(...anchos.map(() => 0), ancho(t.title, TIPO.panel) + 2 * PAD);
  const w = Math.max(anchos.reduce((s, x) => s + x, 0), titulo);
  if (w > anchos.reduce((s, x) => s + x, 0)) { const extra = (w - anchos.reduce((s, x) => s + x, 0)) / anchos.length; for (let j = 0; j < anchos.length; j++) anchos[j] += extra; }
  const lineas = C.map((r) => r.map((v, j) => envolver(v, TIPO.tabla, anchos[j] - 2 * PAD)));
  const head = t.columns.map((c, j) => envolver(c.label, TIPO.tabla, anchos[j] - 2 * PAD));
  const pie = (t.footnotes || []).flatMap((f) => envolver(f, TIPO.cuerpo, w - 2 * PAD));
  const hHead = Math.max(...head.map((l) => l.length)) * LH + 1; const hRows = lineas.map((r) => Math.max(...r.map((l) => l.length)) * LH + 1);
  const h = TIPO.panel * 1.2 + 2 + hHead + hRows.reduce((s, x) => s + x, 0) + (pie.length ? pie.length * LH + 1.5 : 0);
  return { w, h, anchos, lineas, head, pie, hHead, hRows };
}

/** Primitivas de papel de la tabla en (x, y) (esquina superior izquierda, y hacia abajo). */
export function primitivasTabla(t, x, y, idBase, med = medirTabla(t)) {
  const out = []; let n = 0; const id = () => `${idBase}/${t.id}/${n++}`; const base = { layer: 'TW_TABLAS', role: 'table', table_ref: t.id };
  out.push({ id: id(), kind: 'text', value: t.title, x: x + PAD, y, size: TIPO.panel, maxWidth: med.w, align: 'left', ...base, role: 'table_title' });
  let yy = y + TIPO.panel * 1.2 + 2; const top = yy;
  const hl = (yv) => out.push({ id: id(), kind: 'line', a: [x, yv], b: [x + med.w, yv], ...base, role: 'table_grid' });
  hl(yy);
  const fila = (lineas, alto, row) => {
    let xx = x;
    lineas.forEach((ls, j) => { const c = t.columns[j]; ls.forEach((s, k) => { if (!s) return; const right = c.align === 'right'; out.push({ id: id(), kind: 'text', value: s, x: right ? xx + med.anchos[j] - PAD : xx + PAD, y: yy + 0.6 + k * LH, size: TIPO.tabla, maxWidth: med.anchos[j] - 2 * PAD + 0.01, align: right ? 'right' : 'left', ...base, role: 'table_cell', cell: { row: row?.id ?? 'header', col: c.key, refs: row?.refs || [], quantity_ref: row?.quantity_ref ?? null } }); }); xx += med.anchos[j]; });
    yy += alto; hl(yy);
  };
  fila(med.head, med.hHead, null);
  med.lineas.forEach((r, i) => fila(r, med.hRows[i], t.rows[i]));
  let xx = x; out.push({ id: id(), kind: 'line', a: [xx, top], b: [xx, yy], ...base, role: 'table_grid' });
  for (const a of med.anchos) { xx += a; out.push({ id: id(), kind: 'line', a: [xx, top], b: [xx, yy], ...base, role: 'table_grid' }); }
  yy += 1.5; for (const s of med.pie) { out.push({ id: id(), kind: 'text', value: s, x: x + PAD, y: yy, size: TIPO.cuerpo, maxWidth: med.w, align: 'left', ...base, role: 'table_note' }); yy += LH; }
  return out;
}
