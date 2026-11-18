// Exportador DXF (AC1024) de la Drawing IR v2: geometría en metros reales en el espacio modelo (colocación compacta), cotas
// DIMENSION nativas con estilo por escala, HATCH de regiones declaradas, símbolos como BLOCK + INSERT, y una presentación por
// lámina con viewport general + viewports de contenido bloqueados. Vista inicial *Active y $EXTMIN/$EXTMAX encuadran todo el
// modelo al abrir (P0: el DXF del UAT abría «aparentemente vacío»). Sin scripts ni código ejecutable.
import { capasDe, prefijoDe, patronLinea, colocacionDe, bounds } from './model.js';
import { UserError } from '../mcp/util.js';
import { DxfDocumento } from './dxf_doc.js';
import { densificar } from './regions.js';
import { TRAMAS, SIMBOLOS } from './catalog.js';
import { buildIR } from './ir.js';
import { alturaCad, ASC_EM } from './text_metrics.js';

const LW = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
const lw = (mm) => LW.reduce((b, x) => (Math.abs(x - mm * 100) < Math.abs(b - mm * 100) ? x : b), 25);
const ACI_TRAMA = { SHOTCRETE_REGION: 3, WIRE_MESH_REGION: 4, MESH_OVERLAP_ZONE: 1, MASONRY_WALL: 8, CONCRETE: 8 };
export const CAPAS_PAPEL = { PAPEL: { color: 7, w: 0.25 }, TW_TABLAS: { color: 7, w: 0.18 }, TW_LEYENDA: { color: 7, w: 0.18 }, TW_NOTAS: { color: 7, w: 0.18 }, TW_LLAMADAS: { color: 1, w: 0.25 }, TW_SIMBOLOS: { color: 1, w: 0.25 }, MODEL_DIMS: { color: 8, w: 0.18 } };
const num = (n) => n.toFixed(2).replace('.', ',');

export function buildDrawingDxf(composition, { ir = null } = {}) {
  const I = ir || buildIR(composition); const model = composition.model; const C = capasDe(model); const off = colocacionDe(composition);
  const doc = new DxfDocumento({ insunits: 6 }); doc.appid('TANNIA_TRACE'); doc.appid('TANNIA_IR');
  const irx = (id, extra = []) => [[1001, 'TANNIA_IR'], [1000, `ir=${id}`], ...extra.map((x) => [1000, x])];
  doc.layer('TW_VIEWPORTS', { color: 8, plot: false });
  for (const [n, c] of Object.entries(C)) { const pat = patronLinea(n, c); if (pat.elementos.length) doc.ltype(pat.nombre, pat.elementos); doc.layer(n, { color: c.color || 7, ltype: pat.elementos.length ? pat.nombre : 'Continuous', lineweight: lw(c.weight || 0.18) }); }
  for (const [n, c] of Object.entries(CAPAS_PAPEL)) doc.layer(n, { color: c.color, lineweight: lw(c.w) });
  for (const [k, t] of Object.entries(TRAMAS)) doc.layer(`TRAMA_${k}`, { color: ACI_TRAMA[k] || 8, lineweight: lw(t.grosor) });
  // Símbolos del catálogo como bloques en mm de papel (se insertan a escala de la vista en el modelo y 1:1 en papel).
  const usados = new Set([...I.model.filter((p) => p.symbol_ref).map((p) => p.symbol_ref), ...I.sheets.flatMap((s) => s.primitives.filter((p) => p.symbol_ref).map((p) => p.symbol_ref))]);
  for (const s of usados) { const b = doc.block(`TW_${s}`); for (const g of SIMBOLOS[s].geometria) { if (g.kind === 'line') doc.line(b, '0', g.a, g.b); else doc.circle(b, '0', g.center, g.radius); } }
  const ext = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] }; const track = (p) => { ext.min = [Math.min(ext.min[0], p[0]), Math.min(ext.min[1], p[1])]; ext.max = [Math.max(ext.max[0], p[0]), Math.max(ext.max[1], p[1])]; };
  const views = new Map(model.views.map((v) => [v.id, v]));
  // TANNIA_TRACE conserva EXACTAMENTE su contrato previo (elemento, vista, rol, ref) en la geometría medible; los metadatos de la IR
  // (id, trama, material, símbolo) van en una aplicación aparte, TANNIA_IR, para no alterar consumidores de la trazabilidad.
  const traza = (p, v) => [...(p.kind === 'line' || p.kind === 'arc' || p.kind === 'circle' ? [[1001, 'TANNIA_TRACE'], [1000, `elemento=${p.physical_element_ref}`], [1000, `vista=${v.id}`], [1000, `rol=${p.role}`], [1000, `ref=${p.source_ref}`]] : []), ...irx(p.id, [...(p.hatch_ref ? [`trama=${p.hatch_ref}`, `material=${p.material?.nombre ?? 'sin material'}`, `elemento=${p.physical_element_ref}`, 'medible=no'] : []), ...(p.symbol_ref ? [`simbolo=${p.symbol_ref}`, `elemento=${p.physical_element_ref}`, 'medible=no'] : []), ...(p.view_id && !(p.kind === 'line' || p.kind === 'arc' || p.kind === 'circle') ? [`vista=${p.view_id}`] : [])])];
  let nDim = 0;
  for (const p of I.model) {
    const v = views.get(p.view_id); const o = off[v.id]; const ex = v.verticalScale ? v.scale / v.verticalScale : 1; const P = (a) => { const q = [a[0] + o[0], a[1] * ex + o[1]]; track(q); return q; };
    const xd = { xdata: traza(p, v) };
    if (p.kind === 'line') doc.line(doc.model, p.layer, P(p.geom.a), P(p.geom.b), xd);
    else if (p.kind === 'arc' || p.kind === 'circle') {
      // PL-04: un arco con exageración vertical sería elíptico en el PDF y circular en el DXF. Se rechaza en vez de divergir.
      if (ex !== 1) throw new UserError('ARCO_EN_PERFIL_EXAGERADO', `Vista ${v.id}: no se admiten arcos ni círculos con escala vertical distinta de la horizontal.`);
      const b = bounds([{ kind: 'arc', ...p.geom }]); P(b.min); P(b.max);
      const c = [p.geom.center[0] + o[0], p.geom.center[1] + o[1]];
      if (p.kind === 'circle') doc.circle(doc.model, p.layer, c, p.geom.radius, xd); else doc.arc(doc.model, p.layer, c, p.geom.radius, p.geom.start, p.geom.end, xd);
    } else if (p.kind === 'hatch') {
      for (const q of densificar(p.loops[0])) P(q);
      const loops = p.loops.map((l) => l.map((q) => { const r = P(q); return q[2] ? [r[0], r[1], q[2]] : r; }));
      doc.hatch(doc.model, p.layer, { loops, nombre: '_USER', familias: TRAMAS[p.hatch_ref].familias.map((f) => ({ angulo: f.angulo, paso: (f.paso * v.scale) / 1000 })), opt: xd });
    } else if (p.kind === 'symbol') {
      const R = Math.max(...SIMBOLOS[p.symbol_ref].geometria.flatMap((g) => (g.kind === 'line' ? [...g.a, ...g.b].map(Math.abs) : [Math.abs(g.center[0]) + g.radius, Math.abs(g.center[1]) + g.radius]))) * p.scale_m_per_mm;
      const c = P(p.at); track([c[0] - R, c[1] - R]); track([c[0] + R, c[1] + R]);
      doc.insert(doc.model, 'TW_SIMBOLOS', `TW_${p.symbol_ref}`, c, p.scale_m_per_mm, p.rot, xd);
    }
    else if (p.kind === 'dimension') {
      const d = p.dim; const scale = v.scale / 1000; const h = alturaCad(2.5) * scale; const style = doc.dimstyle(`TW_1-${v.scale}`, { dimscale: scale, post: '<> m' });
      const blk = doc.block(`*D${++nDim}`, { anonymous: true }); let data;
      if (d.kind === 'linear') {
        const a = P(d.a); const b = P(d.b); const horizontal = Math.abs(a[1] - b[1]) < 1e-9;
        const c = horizontal ? [a[0], a[1] - d.offset * scale] : [a[0] + d.offset * scale, a[1]]; const e = horizontal ? [b[0], c[1]] : [c[0], b[1]];
        const mid = [(c[0] + e[0]) / 2, (c[1] + e[1]) / 2 + (horizontal ? h : 0)]; track(c); track(e);
        const tw = (`${num(d.value)} m`.length * h * 0.75) / 2 + h; track([mid[0] - tw, mid[1] - tw]); track([mid[0] + tw, mid[1] + tw]);
        doc.line(blk, 'MODEL_DIMS', a, c); doc.line(blk, 'MODEL_DIMS', b, e); doc.line(blk, 'MODEL_DIMS', c, e);
        doc.text(blk, 'MODEL_DIMS', `${num(d.value)} m`, horizontal ? mid : [mid[0] - h * 0.6, mid[1]], h, { align: 'center' });
        // PL-07: en un perfil exagerado la distancia dibujada vertical es value·ex; DIMLFAC = 1/ex hace que AutoCAD, al recalcular, muestre el valor físico.
        const geom = Math.hypot(b[0] - a[0], b[1] - a[1]); const factor = geom > 0 ? d.value / geom : 1;
        const dstyle = Math.abs(factor - 1) > 1e-9 ? [[1001, 'ACAD'], [1000, 'DSTYLE'], [1002, '{'], [1070, 144], [1040, factor], [1002, '}']] : [];
        data = [[100, 'AcDbDimension'], [2, blk.name], [10, e[0]], [20, e[1]], [30, 0], [11, mid[0]], [21, mid[1]], [31, 0], [70, 32], [1, ''], [3, style], [42, geom], [100, 'AcDbAlignedDimension'], [13, a[0]], [23, a[1]], [33, 0], [14, b[0]], [24, b[1]], [34, 0], [50, horizontal ? 0 : 90], [100, 'AcDbRotatedDimension'], ...dstyle];
      } else {
        const c = P(d.center); const ang = (d.angle * Math.PI) / 180; const tip = [c[0] + d.radius * Math.cos(ang), c[1] + d.radius * Math.sin(ang)]; const mid = [(c[0] + tip[0]) / 2, (c[1] + tip[1]) / 2];
        doc.line(blk, 'MODEL_DIMS', c, tip); doc.text(blk, 'MODEL_DIMS', `R ${num(d.value)} m`, mid, h);
        data = [[100, 'AcDbDimension'], [2, blk.name], [10, c[0]], [20, c[1]], [30, 0], [11, mid[0]], [21, mid[1]], [31, 0], [70, 36], [1, ''], [3, style], [42, d.value], [100, 'AcDbRadialDimension'], [15, tip[0]], [25, tip[1]], [35, 0], [40, 0]];
      }
      doc.add(doc.model, 'DIMENSION', 'MODEL_DIMS', data, { xdata: irx(p.id, [`vista=${v.id}`]) });
    }
  }
  if (!Number.isFinite(ext.min[0])) throw new UserError('DXF_SIN_GEOMETRIA', 'El modelo no contiene geometría que escribir.');
  // Presentaciones: una por lámina (mismo orden y nombre que el PDF). Papel en mm con origen abajo-izquierda.
  for (const s of I.sheets) {
    const lay = doc.layout(s.name, { size: s.size }); const H = s.size[1]; const fy = (p) => [p[0], H - p[1]];
    const xd = (p) => ({ xdata: irx(p.id, [...(p.table_ref ? [`cuadro=${p.table_ref}`] : []), ...(p.legend_ref ? [`leyenda=${p.legend_ref}`] : []), ...(p.callout_ref ? [`llamada=${p.callout_ref}`, `detalle=${p.detail_ref}`] : [])]) });
    const hechos = new Set();
    for (const p of s.primitives) {
      if (p.space === 'model') continue; // visible a través del viewport: escrito una sola vez en el espacio modelo
      if (p.inst) { if (hechos.has(p.inst.id)) continue; hechos.add(p.inst.id); doc.insert(lay, 'TW_SIMBOLOS', `TW_${p.symbol_ref}`, fy(p.inst.at), p.inst.s, p.inst.rot, xd({ ...p, id: p.inst.id })); continue; }
      const capa = doc.layers.has(p.layer) ? p.layer : 'PAPEL';
      if (p.kind === 'line') doc.line(lay, capa, fy(p.a), fy(p.b), xd(p));
      else if (p.kind === 'rect') doc.lwpolyline(lay, capa, [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]].map(fy), true, xd(p));
      else if (p.kind === 'path') { if (p.circle) doc.circle(lay, capa, fy(p.circle.center), p.circle.radius, xd(p)); else doc.lwpolyline(lay, capa, p.points.map(fy), !!p.closed, xd(p)); }
      else if (p.kind === 'hatch') doc.hatch(lay, capa, { loops: p.loops.map((l) => l.map(fy)), nombre: '_USER', familias: TRAMAS[p.hatch_ref].familias, opt: xd(p) });
      else if (p.kind === 'text') doc.text(lay, capa, p.value, fy([p.x, p.y + p.size * ASC_EM]), alturaCad(p.size), { align: p.align, ...xd(p) }); // altura de mayúsculas y línea base iguales a las del PDF
    }
    for (const vp of s.viewports) {
      const o = off[vp.view_id]; const v = views.get(vp.view_id); const ex = v.verticalScale ? v.scale / v.verticalScale : 1;
      doc.viewport(lay, { paperCenter: fy(vp.paperCenter), width: vp.width, height: vp.height, viewCenter: [vp.center[0] + o[0], vp.center[1] * ex + o[1]], viewHeight: vp.height / vp.scale, xdata: irx(`viewport:${s.id}/${vp.view_id}`, [`vista=${vp.view_id}`]) });
    }
  }
  return doc.toString({ extmin: [ext.min[0], ext.min[1], 0], extmax: [ext.max[0], ext.max[1], 0], vista: ext });
}
export { prefijoDe };
