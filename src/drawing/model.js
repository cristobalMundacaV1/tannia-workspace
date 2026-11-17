// Drawing coordinates are metres; sheet coordinates and type sizes are millimetres.
// No CAD or filesystem dependency. Presentation never changes source geometry.
import { seccionArco, areaSeccion } from '../geo/lineal.js';
import { UserError } from '../mcp/util.js';

export const PAPERS = { A3: [420, 297], A2: [594, 420], A1: [841, 594] };
export const LAYERS = {
  EXCAVACION: { color: 7, weight: 0.5, legend: 'Contorno excavado' },
  INTERIOR: { color: 4, weight: 0.25, legend: 'Contorno interior académico' },
  EJE: { color: 1, weight: 0.18, legend: 'Eje / rasante hipotética', dash: [4, 1, 1, 1] },
  ALTERNATIVA_6: { color: 3, weight: 0.25, legend: 'Revestimiento académico 6 cm' },
  ALTERNATIVA_8: { color: 5, weight: 0.25, legend: 'Revestimiento académico 8 cm' },
  CORTE: { color: 1, weight: 0.35, legend: 'Plano de corte A-A (0+075)', dash: [8, 2, 2, 2] },
  COTAS: { color: 7, weight: 0.18, legend: 'Cotas geométricas (m)' },
};
const line = (id, layer, a, b) => ({ id, kind: 'line', layer, a, b });
const dim = (id, a, b, offset = 8) => ({ id, kind: 'linear', a, b, offset, value: Math.hypot(b[0] - a[0], b[1] - a[1]), unit: 'm' });
const section = (prefix, layer, radius, wall) => [line(`${prefix}-floor`, layer, [-radius, 0], [radius, 0]), line(`${prefix}-right`, layer, [radius, 0], [radius, wall]), { id: `${prefix}-arch`, kind: 'arc', layer, center: [0, wall], radius, start: 0, end: 180 }, line(`${prefix}-left`, layer, [-radius, wall], [-radius, 0])];

export function bounds(entities) {
  const points = [];
  for (const e of entities) {
    if (e.kind === 'line') points.push(e.a, e.b);
    else if (e.kind === 'arc') {
      for (const angle of [e.start, e.end, ...[0, 90, 180, 270, 360].filter(a => a >= e.start && a <= e.end)]) points.push([e.center[0] + e.radius * Math.cos(angle * Math.PI / 180), e.center[1] + e.radius * Math.sin(angle * Math.PI / 180)]);
    } else throw new UserError('GEOMETRIA_NO_SOPORTADA', `Entidad no soportada: ${e.kind}`);
  }
  if (!points.length || points.some(p => p.length !== 2 || p.some(n => !Number.isFinite(n)))) throw new UserError('GEOMETRIA_INVALIDA', 'La vista contiene geometría inválida.');
  return { min: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))], max: [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] };
}

export function tunnelModel({ length = 150, width = 5.5, wall = 2.5, selected = 0.06, project = 'Túnel minero académico', revision = 'R01', date = 'PENDIENTE', institution = 'PENDIENTE', author = 'PENDIENTE' } = {}) {
  if (![length, width, wall, selected].every(Number.isFinite) || length <= 0 || width <= 0 || wall <= 0 || ![0.06, 0.08].includes(selected) || width <= selected * 2) throw new UserError('DATOS_INVALIDOS', 'Dimensiones positivas y alternativa de 0,06 o 0,08 m requeridas.');
  for (const s of [project, revision, date, institution, author]) if (typeof s !== 'string' || s.length > 90 || /[\r\n\u0000-\u001f]/.test(s)) throw new UserError('METADATOS_INVALIDOS', 'Texto de cajetín inválido o demasiado largo.');
  const r = width / 2; const interior = r - selected;
  const area = areaSeccion(seccionArco({ luz: width, altura_hastial: wall, flecha: r }));
  const quantities = [0.06, 0.08].map(t => { const ri = r - t; const ai = areaSeccion(seccionArco({ luz: ri * 2, altura_hastial: wall, flecha: ri })); return { thickness_m: t, excavation_area_m2: area, interior_area_m2: ai, lining_area_m2: area - ai, excavation_volume_m3: area * length, lining_volume_m3: (area - ai) * length }; });
  const stations = []; for (let s = 0; s < length; s += 25) stations.push(s); stations.push(length);
  const plan = { id: 'planta', title: 'Planta general', scale: 500, entities: [line('axis', 'EJE', [0, 0], [length, 0]), line('north-edge', 'EXCAVACION', [0, r], [length, r]), line('south-edge', 'EXCAVACION', [0, -r], [length, -r]), line('cut-aa', 'CORTE', [length / 2, -3 * r], [length / 2, 3 * r])], dimensions: [dim('length', [0, -r], [length, -r], 12)], labels: [...stations.map(s => ({ at: [s, 0], dy: -10, text: `0+${String(s).padStart(3, '0')}` })), { at: [length / 2, 3 * r], dy: -5, text: 'A' }, { at: [length / 2, -3 * r], dy: 3, text: 'A' }], notes: ['Trazado recto hipotético. Orientación geográfica no confirmada.', 'Corte A-A en 0+075: ver lámina 03.'] };
  const profile = { id: 'perfil', title: 'Perfil longitudinal', scale: 500, verticalScale: 100, entities: [line('grade', 'EJE', [0, 0], [length, 0]), line('roof', 'EXCAVACION', [0, wall + r], [length, wall + r]), line('portal-start', 'EXCAVACION', [0, 0], [0, wall + r]), line('portal-end', 'EXCAVACION', [length, 0], [length, wall + r])], dimensions: [dim('profile-length', [0, 0], [length, 0], 12), dim('profile-height', [0, 0], [0, wall + r], -14)], labels: stations.map(s => ({ at: [s, 0], dy: 7, text: `0+${String(s).padStart(3, '0')}` })), notes: ['Rasante horizontal hipotética: pendiente 0,00 %. Sin topografía.', 'Datum local 0,00 m arbitrario, NO es cota geográfica.', 'Escala H 1:500 / V 1:100. Exageración vertical 5x.'] };
  const cross = { id: 'seccion', title: 'Sección A-A / 0+075', scale: 50, entities: [...section('outer', 'EXCAVACION', r, wall), ...section('inner', 'INTERIOR', interior, wall)], dimensions: [dim('width', [-r, 0], [r, 0], 12), dim('wall', [r, 0], [r, wall], 10), dim('height', [-r, 0], [-r, wall + r], -12), { id: 'radius', kind: 'radial', center: [0, wall], radius: r, angle: 45, value: r, unit: 'm' }], labels: [], notes: [`Área excavada: ${area.toFixed(4)} m². Área interior: ${quantities.find(q => q.thickness_m === selected).interior_area_m2.toFixed(4)} m².`, `Alternativa representada: ${selected * 100} cm. Sin revestimiento de solera.`] };
  const details = [0.06, 0.08].map(t => ({ id: `detalle-${t * 100}`, title: `Detalle hastial / alternativa ${t * 100} cm`, scale: 10, entities: [line(`outer-${t}`, 'EXCAVACION', [0, 0], [0, 1]), line(`inner-${t}`, `ALTERNATIVA_${t * 100}`, [t, 0], [t, 1])], dimensions: [dim(`thickness-${t}`, [0, 0.5], [t, 0.5], 12)], labels: [], notes: [`Espesor geométrico ${t * 100} cm. No es diseño de sostenimiento.`] }));
  return { schema: 'tw.drawing/1', unit: 'm', provenance: 'Datos autorizados del ejercicio TW12; hipótesis académicas explícitas', metadata: { project, revision, date, institution, author, reviewer: 'PENDIENTE', approval: 'PENDIENTE', stage: 'REVISIÓN ACADÉMICA', source: 'Modelo TW12', coordinateSystem: 'NO CONFIRMADO' }, quantities, views: [plan, profile, cross, ...details], sheets: [{ id: '01', title: 'Planta general', views: ['planta'] }, { id: '02', title: 'Perfil longitudinal', views: ['perfil'] }, { id: '03', title: 'Sección transversal', views: ['seccion'] }, { id: '04', title: 'Detalles de revestimiento', views: details.map(v => v.id) }], warnings: ['EJERCICIO ACADÉMICO. No apto para construcción.', 'Sin validación geotécnica ni fortificación aprobada.', 'Espesores comparativos; no constituyen diseño estructural.'] };
}

export function compose(model, { paper = 'A3', orientation = 'landscape', margin = 12 } = {}) {
  if (!PAPERS[paper] || !['landscape', 'portrait'].includes(orientation) || !Number.isFinite(margin) || margin < 8 || margin > 30) throw new UserError('PAPEL_INVALIDO', 'Formato, orientación o margen no válido.');
  const size = orientation === 'landscape' ? PAPERS[paper] : [...PAPERS[paper]].reverse();
  const sheets = model.sheets.map(sheet => {
    const usable = size[0] - 2 * margin; const gap = 18; const count = sheet.views.length;
    const slotW = (usable - (count - 1) * gap) / count; const slotH = size[1] - 2 * margin - 105;
    const views = sheet.views.map((id, i) => {
      const v = model.views.find(x => x.id === id); if (!v) throw new UserError('VISTA_AUSENTE', id);
      if (!(v.scale > 0) || !Number.isFinite(v.scale)) throw new UserError('ESCALA_INVALIDA', id);
      const box = bounds(v.entities); const sx = 1000 / v.scale; const sy = 1000 / (v.verticalScale || v.scale);
      const w = (box.max[0] - box.min[0]) * sx; const h = (box.max[1] - box.min[1]) * sy;
      if (w + 40 > slotW || h + 40 > slotH) throw new UserError('VISTA_NO_CABE', `La vista ${id} no cabe a escala 1:${v.scale}.`, 'Seleccione un papel mayor o una lámina adicional. La escala no se ha cambiado.');
      const cx = margin + slotW * (i + 0.5) + i * gap; const cy = margin + 12 + slotH / 2;
      const center = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2];
      return { ...v, bounds: box, viewport: { center, paperCenter: [cx, cy], width: w + 40, height: h + 40, scale: sx, verticalScale: sy, locked: true }, transform: { sx, sy, tx: cx - center[0] * sx, ty: cy + center[1] * sy } };
    });
    const layers = [...new Set(views.flatMap(v => v.entities.map(e => e.layer)))];
    return { ...sheet, paper, size, margin, views, legend: layers.map(id => ({ id, ...LAYERS[id] })), titleBlock: { x: margin, y: size[1] - margin - 40, width: usable, height: 40 } };
  });
  return { schema: 'tw.sheets/1', model, sheets, status: 'needs_review' };
}

export function verifyDimensions(model) {
  const issues = [];
  for (const v of model.views) for (const d of v.dimensions) {
    const measured = d.kind === 'linear' ? Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) : d.kind === 'radial' ? d.radius : NaN;
    if (!Number.isFinite(measured) || Math.abs(measured - d.value) > 1e-9) issues.push({ view: v.id, dimension: d.id, issue: 'dimension_mismatch' });
  }
  return { ok: issues.length === 0, issues };
}
