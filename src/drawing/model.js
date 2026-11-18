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
  PERNOS: { color: 6, weight: 0.25, legend: 'Pernos de anclaje (patrón declarado)' },
  MALLA: { color: 2, weight: 0.18, legend: 'Malla de acero (desarrollo en bóveda y hastiales)', dash: [2, 1] },
};
/** Capas efectivas de un modelo: las base más las que declara el propio modelo (motor genérico). */
export const capasDe = (model) => ({ ...LAYERS, ...(model?.layers || {}) });
/** PL-06: definición ÚNICA del tipo de línea de una capa (mm de papel, trazo/hueco alternados). PDF y DXF usan esta misma función. */
export function patronLinea(nombre, capa) {
  const d = capa?.dash; if (!Array.isArray(d) || !d.length) return { nombre: 'CONTINUOUS', elementos: [] };
  if (d.length % 2 || !d.every((x) => Number.isFinite(x) && x > 0)) throw new Error(`Patrón de línea inválido en la capa ${nombre}`);
  return { nombre: `TW_${String(nombre).replace(/[^A-Za-z0-9_]/g, '_')}`, elementos: d.map((x, i) => (i % 2 ? -x : x)) };
}
/** Prefijo de código de lámina/layout: por modelo (p. ej. «TW12», «REC»). */
export const prefijoDe = (model) => model?.metadata?.code || 'TW12';
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

// Semántica explícita: qué elemento físico representa cada entidad gráfica y si es fuente de cubicación o solo representación.
// Un elemento aparece en varias vistas (planta, perfil…) y SOLO UNA entidad de una vista es su fuente medible.
const ELEMENT_BY_REF = { 'planta/axis': ['eje', 'fuente'], 'perfil/grade': ['eje', 'representacion'], 'planta/cut-aa': ['corte-aa', 'representacion'] };
function tagElements(views, { length, area }) {
  const lining = (v) => v.id.startsWith('detalle-');
  for (const v of views) for (const e of v.entities) {
    const ref = `${v.id}/${e.id}`; e.ref = ref; if (e.element) continue; // fortificación: elemento/rol ya asignados por su generador
    const [elemento, rol] = ELEMENT_BY_REF[ref] || [lining(v) ? 'revestimiento-comparativo' : 'tunel-excavacion', 'representacion'];
    e.element = elemento; e.role = rol;
  }
  return [
    { id: 'eje', tipo: 'alineamiento', unidad: 'm', fuente: 'planta/axis', magnitudes: { longitud_m: length }, vistas: ['planta', 'perfil'] },
    { id: 'tunel-excavacion', tipo: 'excavacion', unidad: 'm', fuente: null, magnitudes: { longitud_m: length, area_seccion_m2: area }, vistas: ['planta', 'perfil', 'seccion'] },
    { id: 'revestimiento-comparativo', tipo: 'espesor_geometrico', unidad: 'm', fuente: null, magnitudes: {}, vistas: views.filter(lining).map((d) => d.id) },
    { id: 'corte-aa', tipo: 'anotacion', unidad: 'm', fuente: null, magnitudes: {}, vistas: ['planta'] },
  ];
}

/**
 * Fortificación DIBUJADA y CUBICADA por el mismo motor (UAT-02: pernos y malla se calculaban fuera del motor geométrico).
 * Patrón declarado por la usuaria (sin valores por defecto): longitud de perno, espaciamientos transversal y longitudinal,
 * malla sí/no y traslapo de malla (%). Regla de distribución explícita: n = ceil(P / s_t) pernos por anillo, uniformes a P/n,
 * centrados en el desarrollo P (hastiales + bóveda, sin solera); anillos = ceil(L / s_l) + 1 (desde ambos portales).
 */
export function fortificacionVista({ r, wall, length, f }) {
  for (const k of ['perno_longitud', 'espaciamiento_transversal', 'espaciamiento_longitudinal']) if (!(Number.isFinite(f[k]) && f[k] > 0)) throw new UserError('DATOS_INVALIDOS', `Fortificación: «${k}» debe declararse en metros (no se supone).`);
  if (f.malla && !(Number.isFinite(f.traslapo_malla_pct) && f.traslapo_malla_pct >= 0 && f.traslapo_malla_pct <= 50)) throw new UserError('DATOS_INVALIDOS', 'Fortificación: declare el traslapo de malla en % (0 a 50).');
  const Lp = f.perno_longitud; const P = 2 * wall + Math.PI * r; const n = Math.ceil(P / f.espaciamiento_transversal - 1e-9); const paso = P / n;
  // Punto y normal exterior a una abscisa curvilínea s medida desde el pie del hastial izquierdo.
  const en = (s) => { if (s <= wall) return { p: [-r, s], nrm: [-1, 0] }; if (s >= wall + Math.PI * r) { const y = wall - (s - wall - Math.PI * r); return { p: [r, y], nrm: [1, 0] }; } const a = Math.PI - (s - wall) / r; return { p: [r * Math.cos(a), wall + r * Math.sin(a)], nrm: [Math.cos(a), Math.sin(a)] }; };
  const ents = [...section('fort', 'EXCAVACION', r, wall).map((e) => ({ ...e, element: e.id === 'fort-floor' ? 'tunel-excavacion' : 'contorno-fortificado', role: e.id === 'fort-floor' ? 'representacion' : 'fuente' }))];
  for (let i = 0; i < n; i++) { const { p, nrm } = en((i + 0.5) * paso); ents.push({ id: `perno-${i + 1}`, kind: 'line', layer: 'PERNOS', a: p, b: [p[0] + nrm[0] * Lp, p[1] + nrm[1] * Lp], element: 'pernos', role: 'fuente' }); }
  if (f.malla) { const rm = r - 0.03; ents.push({ id: 'malla-izq', kind: 'line', layer: 'MALLA', a: [-rm, 0], b: [-rm, wall], element: 'malla', role: 'representacion' }, { id: 'malla-boveda', kind: 'arc', layer: 'MALLA', center: [0, wall], radius: rm, start: 0, end: 180, element: 'malla', role: 'representacion' }, { id: 'malla-der', kind: 'line', layer: 'MALLA', a: [rm, wall], b: [rm, 0], element: 'malla', role: 'representacion' }); }
  const corona = ents.find((e) => e.layer === 'PERNOS' && Math.abs(e.a[0]) < 1e-9);
  const dims = [{ id: 'ancho-fort', kind: 'linear', a: [-r, 0], b: [r, 0], offset: 12, value: 2 * r, unit: 'm' }];
  if (corona) dims.push({ id: 'perno-corona', kind: 'linear', a: corona.a, b: corona.b, offset: 10, value: Lp, unit: 'm' });
  // G08 (referencia del PO): cuadro de pernos CALCULADO con la misma regla que la cubicación (anillos en ambos extremos) y
  // bloque de hipótesis/pendientes. Los pernos se numeran en el dibujo para poder citarlos en el cuadro.
  const c2 = (x, d = 2) => x.toFixed(d).replace('.', ',');
  const anillos = Math.ceil(length / f.espaciamiento_longitudinal - 1e-9) + 1;
  const notes = [`CUADRO DE PERNOS (calculado): L = ${c2(Lp)} m; ${n} por anillo (P1 a P${n}) a ${c2(paso, 3)} m sobre el contorno (máximo declarado ${c2(f.espaciamiento_transversal)} m); ${anillos} anillos = ceil(${length} / ${c2(f.espaciamiento_longitudinal)}) + 1; TOTAL ${n * anillos} pernos.`, f.malla ? `Malla en hastiales y bóveda, traslapo ${f.traslapo_malla_pct} % (representación esquemática a 3 cm del contorno).` : 'Sin malla declarada.', 'HIPÓTESIS: patrón de fortificación DECLARADO; no es un diseño geotécnico verificado.', 'PENDIENTES: clasificación del macizo, tipo de perno y lechada, placa y tuerca (no dibujadas) y validación por especialista.'];
  const labels = ents.filter((e) => e.layer === 'PERNOS').map((e, i) => ({ at: e.b, dy: e.b[1] >= wall ? -3 : 3, text: `P${i + 1}` }));
  return { id: 'fortificacion', title: 'Sección tipo de fortificación', scale: 75, entities: ents, dimensions: dims, labels, notes };
}

/** Cantidades de fortificación MEDIDAS sobre la vista dibujada (única autoridad geométrica). */
export function cantidadesFortificacion(model) {
  const v = model.views.find((x) => x.id === 'fortificacion'); if (!v) return null; const f = model.fortificacion;
  const largo = (e) => (e.kind === 'line' ? Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) : e.radius * (e.end - e.start) * Math.PI / 180);
  // La malla se cubica sobre la MALLA dibujada (antes: sobre el contorno de excavación, que no es lo dibujado como malla).
  const pernos = v.entities.filter((e) => e.layer === 'PERNOS'); const desarrollo = v.entities.filter((e) => e.layer === 'MALLA').reduce((s, e) => s + largo(e), 0);
  const L = model.length_m; const anillos = Math.ceil(L / f.espaciamiento_longitudinal - 1e-9) + 1; const porAnillo = pernos.length;
  const ESQUEMA = 'Patrón esquemático académico a partir de espaciamientos declarados: NO es una disposición geotécnica validada ni una exigencia de construcción.';
  const distribucion = { anillos, espaciamiento_longitudinal_real_m: anillos > 1 ? L / (anillos - 1) : null, por_anillo: porAnillo, extremos: 'un anillo en cada extremo (0 m y L)' };
  const filas = [{ partida: 'Pernos de anclaje', unidad: 'u', cantidad: porAnillo * anillos, formula: `${porAnillo} pernos/anillo (contados en la sección dibujada) × ${anillos} anillos = ceil(${L} / ${f.espaciamiento_longitudinal}) + 1 (anillos en ambos extremos; espaciamiento real ${(L / (anillos - 1)).toFixed(3)} m ≤ ${f.espaciamiento_longitudinal} m)`, naturaleza: ESQUEMA, distribucion, longitud_total_m: pernos.reduce((s, e) => s + largo(e), 0) * anillos }];
  if (f.malla) filas.push({ partida: 'Malla de acero', unidad: 'm2', cantidad: desarrollo * L * (1 + f.traslapo_malla_pct / 100), formula: `desarrollo ${desarrollo.toFixed(4)} m (malla dibujada: hastiales + bóveda) × ${L} m × (1 + ${f.traslapo_malla_pct} % de traslapo)`, naturaleza: ESQUEMA, desarrollo_m: desarrollo });
  return filas;
}

/**
 * Contrato tw.cantidades/1 del túnel (PL-09): filas de DETALLE sumables solo para la alternativa de revestimiento ELEGIDA y la
 * fortificación dibujada; la otra alternativa queda aparte como comparación NO sumable. Las magnitudes salen de la misma
 * sección que se dibuja (bóveda semicircular de radio ancho/2 sobre hastiales verticales) y del patrón declarado.
 */
export function cantidadesTunelContrato(model) {
  const L = model.length_m; const t = model.selected_thickness_m; const alt = model.quantities.find((q) => q.thickness_m === t);
  if (!alt || !Number.isFinite(L)) return null;
  const n = (x) => x.toFixed(4).replace('.', ',');
  const detalle = [
    { id: 'q-excavacion', partida: 'Excavación de túnel', descripcion: 'Excavación de la sección tipo en todo el largo', metodo: 'TW-MED/1/area_x_largo', unidad: 'm3', valor: alt.excavation_volume_m3, formula: `área de sección dibujada ${n(alt.excavation_area_m2)} m² × largo ${L} m`, fuentes: 'seccion/outer-arch seccion/outer-left seccion/outer-right seccion/outer-floor', elementos: 'tunel-excavacion', naturaleza: 'MEDIDA sobre la sección dibujada con parámetros declarados (sin sobreexcavación ni perfil real de terreno)', estado: 'TRAZADA', procedencia: 'seccion_parametrica_dibujada' },
    { id: 'q-revestimiento', partida: `Revestimiento shotcrete e = ${Math.round(t * 100)} cm`, descripcion: 'Revestimiento de hastiales y bóveda, sin solera', metodo: 'TW-MED/1/area_x_largo', unidad: 'm3', valor: alt.lining_volume_m3, formula: `(área excavada ${n(alt.excavation_area_m2)} − área interior ${n(alt.interior_area_m2)}) m² × ${L} m`, fuentes: 'seccion/outer-arch seccion/inner-arch', elementos: 'tunel-excavacion', naturaleza: 'MEDIDA geométrica del espesor declarado (no es diseño de sostenimiento ni incluye rebote o pérdidas)', estado: 'TRAZADA', procedencia: 'seccion_parametrica_dibujada' },
  ];
  for (const f of cantidadesFortificacion(model) || []) detalle.push({ id: `q-${f.partida.toLowerCase().replace(/[^a-z]+/g, '-')}`, partida: f.partida, descripcion: f.partida, metodo: f.unidad === 'u' ? 'TW-MED/1/conteo_x_anillos' : 'TW-MED/1/desarrollo_x_largo', unidad: f.unidad, valor: f.cantidad, formula: f.formula, fuentes: f.unidad === 'u' ? 'fortificacion/perno-*' : 'fortificacion/malla-*', elementos: f.unidad === 'u' ? 'pernos' : 'malla', naturaleza: f.naturaleza, estado: 'TRAZADA', procedencia: 'patron_declarado_dibujado' });
  return { detalle: detalle.map((d) => ({ ...d, fila: 'detalle' })), totales: [], alternativas_no_sumables: model.quantities.filter((q) => q.thickness_m !== t).map((q) => ({ ...q, nota: 'Alternativa comparativa: NO se suma ni se presupuesta.' })) };
}

export function tunnelModel({ length = 150, width = 5.5, wall = 2.5, selected = 0.06, project = 'Túnel minero académico', revision = 'R01', date = 'PENDIENTE', institution = 'PENDIENTE', author = 'PENDIENTE', fortificacion = null } = {}) {
  if (![length, width, wall, selected].every(Number.isFinite) || length <= 0 || width <= 0 || wall <= 0 || ![0.06, 0.08].includes(selected) || width <= selected * 2) throw new UserError('DATOS_INVALIDOS', 'Dimensiones positivas y alternativa de 0,06 o 0,08 m requeridas.');
  for (const s of [project, revision, date, institution, author]) if (typeof s !== 'string' || s.length > 90 || /[\r\n\u0000-\u001f]/.test(s)) throw new UserError('METADATOS_INVALIDOS', 'Texto de cajetín inválido o demasiado largo.');
  const r = width / 2; const interior = r - selected;
  const area = areaSeccion(seccionArco({ luz: width, altura_hastial: wall, flecha: r }));
  const quantities = [0.06, 0.08].map(t => { const ri = r - t; const ai = areaSeccion(seccionArco({ luz: ri * 2, altura_hastial: wall, flecha: ri })); return { thickness_m: t, excavation_area_m2: area, interior_area_m2: ai, lining_area_m2: area - ai, excavation_volume_m3: area * length, lining_volume_m3: (area - ai) * length }; });
  const stations = []; for (let s = 0; s < length; s += 25) stations.push(s); stations.push(length);
  const plan = { id: 'planta', title: 'Planta general', scale: 500, entities: [line('axis', 'EJE', [0, 0], [length, 0]), line('north-edge', 'EXCAVACION', [0, r], [length, r]), line('south-edge', 'EXCAVACION', [0, -r], [length, -r]), line('cut-aa', 'CORTE', [length / 2, -3 * r], [length / 2, 3 * r])], dimensions: [dim('length', [0, -r], [length, -r], 12)], labels: [...stations.map(s => ({ at: [s, 0], dy: -10, text: `0+${String(s).padStart(3, '0')}` })), { at: [length / 2, 3 * r], dy: -5, text: 'A' }, { at: [length / 2, -3 * r], dy: 3, text: 'A' }], notes: ['Trazado recto hipotético. Orientación geográfica no confirmada.', 'Corte A-A en 0+075: ver lámina 03.'] };
  const profile = { id: 'perfil', title: 'Perfil longitudinal', scale: 500, verticalScale: 100, entities: [line('grade', 'EJE', [0, 0], [length, 0]), line('roof', 'EXCAVACION', [0, wall + r], [length, wall + r]), line('portal-start', 'EXCAVACION', [0, 0], [0, wall + r]), line('portal-end', 'EXCAVACION', [length, 0], [length, wall + r])], dimensions: [dim('profile-length', [0, 0], [length, 0], 12), dim('profile-height', [0, 0], [0, wall + r], -14)], labels: stations.map(s => ({ at: [s, 0], dy: 7, text: `0+${String(s).padStart(3, '0')}` })), notes: ['Rasante horizontal hipotética: pendiente 0,00 %. Sin topografía.', 'Datum local 0,00 m arbitrario, NO es cota geográfica.', 'Escala H 1:500 / V 1:100. Exageración vertical 5x.'] };
  const cross = { id: 'seccion', title: 'Sección A-A / 0+075', scale: 50, entities: [...section('outer', 'EXCAVACION', r, wall), ...section('inner', 'INTERIOR', interior, wall)], dimensions: [dim('width', [-r, 0], [r, 0], 12), dim('wall', [r, 0], [r, wall], 10), dim('height', [-r, 0], [-r, wall + r], -12), { id: 'radius', kind: 'radial', center: [0, wall], radius: r, angle: 45, value: r, unit: 'm' }], labels: [], notes: [`CUADRO GEOMÉTRICO: ancho ${width.toFixed(2).replace('.', ',')} m · hastial ${wall.toFixed(2).replace('.', ',')} m · radio de bóveda ${r.toFixed(2).replace('.', ',')} m · altura total ${(wall + r).toFixed(2).replace('.', ',')} m · contorno (hastiales + bóveda) ${(2 * wall + Math.PI * r).toFixed(3).replace('.', ',')} m.`, `Área excavada: ${area.toFixed(4)} m². Área interior: ${quantities.find(q => q.thickness_m === selected).interior_area_m2.toFixed(4)} m².`, `Alternativa representada: ${selected * 100} cm. Sin revestimiento de solera.`] };
  const details = [0.06, 0.08].map(t => ({ id: `detalle-${t * 100}`, title: `Detalle hastial / alternativa ${t * 100} cm`, scale: 10, entities: [line(`outer-${t}`, 'EXCAVACION', [0, 0], [0, 1]), line(`inner-${t}`, `ALTERNATIVA_${t * 100}`, [t, 0], [t, 1])], dimensions: [dim(`thickness-${t}`, [0, 0.5], [t, 0.5], 12)], labels: [], notes: [`Espesor geométrico ${t * 100} cm. No es diseño de sostenimiento.`] }));
  const views = [plan, profile, cross, ...details];
  if (fortificacion) views.push(fortificacionVista({ r, wall, length, f: fortificacion }));
  const elements = tagElements(views, { length, area });
  if (fortificacion) elements.push({ id: 'pernos', tipo: 'fortificacion', unidad: 'u', fuente: 'fortificacion/perno-1', magnitudes: {}, vistas: ['fortificacion'] }, { id: 'contorno-fortificado', tipo: 'superficie', unidad: 'm', fuente: 'fortificacion/fort-arch', magnitudes: {}, vistas: ['fortificacion'] });
  return { schema: 'tw.drawing/1', unit: 'm', selected_thickness_m: selected, elements, provenance: 'Datos autorizados del ejercicio TW12; hipótesis académicas explícitas', metadata: { project, revision, date, institution, author, reviewer: 'PENDIENTE', approval: 'PENDIENTE', stage: 'REVISIÓN ACADÉMICA', source: 'Modelo TW12', coordinateSystem: 'NO CONFIRMADO' }, quantities, views, length_m: length, fortificacion, sheets: [{ id: '01', title: 'Planta general', views: ['planta'] }, { id: '02', title: 'Perfil longitudinal', views: ['perfil'] }, { id: '03', title: 'Sección transversal', views: ['seccion'] }, { id: '04', title: 'Detalles de revestimiento', views: details.map(v => v.id) }, ...(fortificacion ? [{ id: '05', title: 'Fortificación tipo', views: ['fortificacion'] }] : [])], warnings: ['EJERCICIO ACADÉMICO. No apto para construcción.', fortificacion ? 'Fortificación según patrón declarado; sin validación geotécnica.' : 'Sin validación geotécnica ni fortificación aprobada.', 'Espesores comparativos; no constituyen diseño estructural.'] };
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
    const layers = [...new Set(views.flatMap(v => v.entities.map(e => e.layer)))]; const C = capasDe(model);
    for (const id of layers) if (!C[id]) throw new UserError('CAPA_NO_DECLARADA', `La capa «${id}» no está declarada en el modelo.`);
    return { ...sheet, paper, size, margin, views, legend: layers.map(id => ({ id, ...C[id] })), titleBlock: { x: margin, y: size[1] - margin - 40, width: usable, height: 40 } };
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
