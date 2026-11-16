import { defineOp, OpError } from './registry.js';
import { propiedades, poligonoConHuecos, autoIntersecta, teselar, validarPoligono } from '../../geo/geom.js';
import { TIN } from '../../geo/lineal.js';
import { ejecutarOperacion } from './registry.js';

const escalar = (v, f) => v.map((p) => [p[0] * f, p[1] * f, ...(p.length > 2 ? [p[2]] : [])]);

defineOp({
  id: 'geo.polygon.properties', version: '1.0.0', title: 'Área, perímetro y centroide de un polígono (con arcos y huecos)', disciplines: ['transversal'],
  inputs: [{ name: 'vertices', dimension: 'L', unit_in: 'm', shape: 'object', required: true }, { name: 'huecos', dimension: 'L', unit_in: 'm', shape: 'object', required: false }],
  outputs: [{ name: 'area', dimension: 'L2', unit_out: 'm2' }, { name: 'perimetro', dimension: 'L', unit_out: 'm' }, { name: 'centroide_x', dimension: 'L', unit_out: 'm' }, { name: 'centroide_y', dimension: 'L', unit_out: 'm' }],
  applicability: { assumptions: ['contorno cerrado, plano, simple (sin auto-intersección)', 'bulge con convención DXF (positivo = arco antihorario)'], validity: ['≥3 vértices (o 2 con bulge)', 'huecos contenidos y disjuntos'], error_bound: 'exacto (fórmulas cerradas); error de redondeo de punto flotante' },
  formula: 'Shoelace + Σ segmentos circulares ½r²(θ−sinθ); huecos se restan', tolerance: { relative: 1e-12, oracle: ['analytic:rect/circle/semicircle', 'mesh_tessellation'] }, maturity: 'E2', requires_review_by: [],
  failure_modes: ['INVALID_INPUT', 'SELF_INTERSECTION', 'UNIDAD_FALTANTE'],
}, ({ vertices, huecos }) => {
  const v = escalar(vertices.value, vertices.factor); validarPoligono(v);
  if (autoIntersecta(teselar(v))) throw new OpError('SELF_INTERSECTION', 'El contorno se auto-intersecta: no es un polígono simple.');
  const hs = (huecos?.value || []).map((h) => escalar(h, huecos.factor));
  const r = hs.length ? poligonoConHuecos(v, hs) : propiedades(v);
  const w = []; if (!hs.length && propiedades(v).orientacion === 'cw') w.push('contorno en sentido horario: el área se informa en valor absoluto');
  return { outputs: { area: r.area, perimetro: r.perimetro, centroide_x: r.centroide[0], centroide_y: r.centroide[1] }, warnings: w };
});

defineOp({
  id: 'geo.section.arch', version: '1.0.0', title: 'Sección en arco sobre hastiales rectos (herradura si flecha = luz/2)', disciplines: ['obras_civiles', 'tuneles', 'transversal'],
  inputs: [{ name: 'luz', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'altura_hastial', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'flecha', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }],
  outputs: [{ name: 'area', dimension: 'L2', unit_out: 'm2' }, { name: 'perimetro_total', dimension: 'L', unit_out: 'm' }, { name: 'perimetro_sin_solera', dimension: 'L', unit_out: 'm' }, { name: 'centroide_y', dimension: 'L', unit_out: 'm' }],
  applicability: { assumptions: ['solera plana horizontal', 'hastiales verticales de altura dada', 'bóveda de arco circular único'], validity: ['luz>0, altura_hastial≥0', '0<flecha≤luz/2 (bóveda hasta semicircular)'], error_bound: 'exacto (geometría); no incluye revestimiento ni sobreexcavación' },
  formula: 'A = b·h + ½r²(θ−sinθ); r=(b²/4+f²)/(2f); θ=2·asin(b/2r)', tolerance: { relative: 1e-12, oracle: ['analytic:semicircle', 'geo.polygon.properties(arco)'] }, maturity: 'E2', requires_review_by: [],
  failure_modes: ['OUT_OF_RANGE', 'INVALID_INPUT'],
}, ({ luz: b, altura_hastial: h, flecha: f }) => {
  if (!(b > 0) || h < 0 || !(f > 0)) throw new OpError('INVALID_INPUT', 'luz y flecha deben ser positivas y la altura de hastial no negativa.');
  if (f > b / 2 * (1 + 1e-12)) throw new OpError('OUT_OF_RANGE', `Flecha ${f} m mayor que luz/2 (${b / 2} m): la bóveda sería más que semicircular (herradura cerrada); este método solo cubre hasta semicircular.`);
  const ff = Math.min(f, b / 2); const r = (b * b / 4 + ff * ff) / (2 * ff); const th = ff >= b / 2 ? Math.PI : 2 * Math.asin(Math.min(1, b / (2 * r)));
  const aSeg = 0.5 * r * r * (th - Math.sin(th)); const area = b * h + aSeg; const arc = r * th;
  const d = th === 0 ? 0 : (4 * r * Math.sin(th / 2) ** 3) / (3 * (th - Math.sin(th))); const cyCentro = h + ff - r; const cySeg = cyCentro + d;
  const cy = (b * h * (h / 2) + aSeg * cySeg) / area;
  return { outputs: { area, perimetro_total: b + 2 * h + arc, perimetro_sin_solera: 2 * h + arc, centroide_y: cy }, warnings: [] };
});

defineOp({
  id: 'geo.section.circle', version: '1.0.0', title: 'Sección circular', disciplines: ['obras_civiles', 'tuneles', 'hidraulica', 'transversal'],
  inputs: [{ name: 'radio', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }],
  outputs: [{ name: 'area', dimension: 'L2', unit_out: 'm2' }, { name: 'perimetro', dimension: 'L', unit_out: 'm' }],
  applicability: { assumptions: ['círculo completo'], validity: ['radio>0'], error_bound: 'exacto' }, formula: 'A=πr²; P=2πr', tolerance: { relative: 1e-12, oracle: ['analytic'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['INVALID_INPUT'],
}, ({ radio }) => { if (!(radio > 0)) throw new OpError('INVALID_INPUT', 'El radio debe ser positivo.'); return { outputs: { area: Math.PI * radio * radio, perimetro: 2 * Math.PI * radio }, warnings: [] }; });

defineOp({
  id: 'edu.hydraulics.manning_rectangular_channel', version: '1.0.0', title: 'Manning en canal rectangular a sección llena (EJERCICIO ACADÉMICO)', disciplines: ['hidraulica', 'obras_civiles'],
  inputs: [{ name: 'ancho', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'altura_agua', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'n_manning', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'pendiente', dimension: null, unit_in: null, shape: 'scalar', required: true }],
  outputs: [{ name: 'caudal', dimension: 'L3·T-1', unit_out: 'm3/s' }, { name: 'area', dimension: 'L2', unit_out: 'm2' }, { name: 'radio_hidraulico', dimension: 'L', unit_out: 'm' }, { name: 'velocidad', dimension: 'L·T-1', unit_out: 'm/s' }],
  applicability: { assumptions: ['flujo uniforme permanente', 'n de Manning y pendiente APORTADOS por el enunciado (no se asumen)', 'canal rectangular prismático'], validity: ['ancho>0, altura_agua>0, n>0, pendiente>0'], error_bound: 'fórmula empírica: solo para ejercicio; NO es un diseño hidráulico profesional' },
  formula: 'Q = (1/n)·A·R^(2/3)·S^(1/2); A=b·y; P=b+2y; R=A/P', tolerance: { relative: 1e-12, oracle: ['cálculo manual independiente'] }, maturity: 'E1', requires_review_by: ['ingeniero_hidraulico'], failure_modes: ['INVALID_INPUT'],
}, ({ ancho: b, altura_agua: y, n_manning: n, pendiente: S }) => {
  if (!(b > 0 && y > 0 && n > 0 && S > 0)) throw new OpError('INVALID_INPUT', 'ancho, altura_agua, n_manning y pendiente deben ser positivos.');
  const A = b * y; const R = A / (b + 2 * y); const Q = (1 / n) * A * R ** (2 / 3) * Math.sqrt(S); return { outputs: { caudal: Q, area: A, radio_hidraulico: R, velocidad: Q / A }, warnings: ['E1: fórmula educativa; no válido para diseño profesional sin revisión'] };
});

defineOp({
  id: 'geo.area.subtract', version: '1.0.0', title: 'Resta de áreas (p. ej. área de excavación − área interior terminada)', disciplines: ['transversal', 'tuneles', 'cubicaciones'],
  inputs: [{ name: 'minuendo', dimension: 'L2', unit_in: 'm2', shape: 'scalar', required: true }, { name: 'sustraendo', dimension: 'L2', unit_in: 'm2', shape: 'scalar', required: true }],
  outputs: [{ name: 'diferencia', dimension: 'L2', unit_out: 'm2' }],
  applicability: { assumptions: ['ambas áreas en el mismo plano de sección y con sección interior contenida en la exterior (lo declara quien aporta los datos)'], validity: ['minuendo ≥ sustraendo ≥ 0'], error_bound: 'exacto' }, formula: 'D = A − B', tolerance: { relative: 1e-12, oracle: ['aritmética'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['OUT_OF_RANGE'],
}, ({ minuendo, sustraendo }) => { if (sustraendo < 0 || minuendo < sustraendo) throw new OpError('OUT_OF_RANGE', `El sustraendo (${sustraendo} m²) debe estar entre 0 y el minuendo (${minuendo} m²).`); return { outputs: { diferencia: minuendo - sustraendo }, warnings: [] }; });

defineOp({
  id: 'geo.tin.volume_to_plane', version: '1.0.0', title: 'Volumen entre una superficie triangulada (TIN) y un plano horizontal (corte/relleno)', disciplines: ['topografia', 'movimiento_de_tierras'],
  inputs: [{ name: 'puntos', dimension: 'L', unit_in: 'm', shape: 'object', required: true }, { name: 'cota_plano', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }],
  outputs: [{ name: 'sobre_plano', dimension: 'L3', unit_out: 'm3' }, { name: 'bajo_plano', dimension: 'L3', unit_out: 'm3' }, { name: 'neto', dimension: 'L3', unit_out: 'm3' }, { name: 'area_planta', dimension: 'L2', unit_out: 'm2' }],
  applicability: { assumptions: ['triangulación de Delaunay de los puntos dados; superficie plana por triángulo', 'volumen solo dentro de la envolvente convexa de los puntos'], validity: ['≥3 puntos no colineales [x,y,z] en la misma unidad', 'sin puntos duplicados'], error_bound: 'exacto para la superficie triangulada; la fidelidad al terreno real depende de la densidad de puntos (no es una medición del terreno)' },
  formula: 'Σ_triángulos ∫ max(±(z−z0),0) dA, exacta para triángulos lineales con cruce de plano', tolerance: { relative: 1e-9, oracle: ['analytic:plano inclinado', 'analytic:pirámide'] }, maturity: 'E2', requires_review_by: ['topografo_o_ingeniero_civil'], failure_modes: ['INVALID_INPUT'],
}, ({ puntos, cota_plano }) => {
  const pts = puntos.value.map((p) => [p[0] * puntos.factor, p[1] * puntos.factor, p[2] * puntos.factor]); const llaves = new Set(pts.map((p) => `${p[0]},${p[1]}`)); if (llaves.size !== pts.length) throw new OpError('INVALID_INPUT', 'Hay puntos con (x,y) duplicados.');
  const t = new TIN(pts); const v = t.volumenSobrePlano(cota_plano); return { outputs: { sobre_plano: v.sobre, bajo_plano: v.bajo, neto: v.neto, area_planta: v.area_planta }, warnings: ['Volumen de la superficie triangulada, no del terreno real'] };
});

defineOp({
  id: 'geo.alignment.length', version: '1.0.0', title: 'Longitud de una alineación horizontal (rectas y arcos)', disciplines: ['obras_lineales', 'tuneles', 'carreteras', 'topografia'],
  inputs: [{ name: 'path', dimension: 'L', unit_in: 'm', shape: 'object', required: true }],
  outputs: [{ name: 'longitud', dimension: 'L', unit_out: 'm' }, { name: 'longitud_rectas', dimension: 'L', unit_out: 'm' }, { name: 'longitud_curvas', dimension: 'L', unit_out: 'm' }, { name: 'deflexion_total', dimension: null, unit_out: 'deg' }],
  applicability: { assumptions: ['tramos {type:"straight",length} y {type:"arc",radius,angle_deg,turn}', 'la continuidad geométrica (tangencia) la garantiza el encadenamiento por construcción'], validity: ['longitudes y radios positivos; ángulos en grados > 0'], error_bound: 'exacto' },
  formula: 'L = Σ L_recta + Σ R·θ', tolerance: { relative: 1e-12, oracle: ['analytic', 'DXF releído por lector independiente'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['INVALID_INPUT'],
}, ({ path }) => {
  let rec = 0; let cur = 0; let def = 0; path.value.forEach((t, i) => { if (t.type === 'straight') { if (!(t.length > 0)) throw new OpError('INVALID_INPUT', `Tramo ${i}: longitud no positiva.`); rec += t.length * path.factor; } else if (t.type === 'arc') { if (!(t.radius > 0 && t.angle_deg > 0) || !['left', 'right'].includes(t.turn)) throw new OpError('INVALID_INPUT', `Tramo ${i}: arco inválido.`); cur += t.radius * path.factor * (t.angle_deg * Math.PI) / 180; def += t.angle_deg; } else throw new OpError('INVALID_INPUT', `Tramo ${i}: tipo no soportado.`); });
  return { outputs: { longitud: rec + cur, longitud_rectas: rec, longitud_curvas: cur, deflexion_total: def }, warnings: [] };
});

defineOp({
  id: 'geo.volume.subtract', version: '1.0.0', title: 'Resta de volúmenes (p. ej. excavación − volumen interior = volumen de revestimiento)', disciplines: ['transversal', 'tuneles', 'cubicaciones'],
  inputs: [{ name: 'minuendo', dimension: 'L3', unit_in: 'm3', shape: 'scalar', required: true }, { name: 'sustraendo', dimension: 'L3', unit_in: 'm3', shape: 'scalar', required: true }],
  outputs: [{ name: 'diferencia', dimension: 'L3', unit_out: 'm3' }],
  applicability: { assumptions: ['volúmenes calculados con el mismo método y la misma alineación; el interior está contenido en la excavación'], validity: ['minuendo ≥ sustraendo ≥ 0'], error_bound: 'exacto' }, formula: 'D = V1 − V2', tolerance: { relative: 1e-12, oracle: ['aritmética'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['OUT_OF_RANGE'],
}, ({ minuendo, sustraendo }) => { if (sustraendo < 0 || minuendo < sustraendo) throw new OpError('OUT_OF_RANGE', `El sustraendo (${sustraendo} m³) debe estar entre 0 y el minuendo (${minuendo} m³).`); return { outputs: { diferencia: minuendo - sustraendo }, warnings: [] }; });

defineOp({
  id: 'geo.section.horseshoe_lined', version: '1.0.0', title: 'Sección en herradura con revestimiento de espesor constante (interior, excavación y revestimiento)', disciplines: ['obras_civiles', 'tuneles'],
  inputs: [{ name: 'luz_interior', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'altura_hastial', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'espesor_revestimiento', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }],
  outputs: [{ name: 'area_interior', dimension: 'L2', unit_out: 'm2' }, { name: 'area_excavacion', dimension: 'L2', unit_out: 'm2' }, { name: 'area_revestimiento', dimension: 'L2', unit_out: 'm2' }, { name: 'perimetro_interior_sin_solera', dimension: 'L', unit_out: 'm' }],
  applicability: { assumptions: ['bóveda semicircular concéntrica', 'hastiales verticales de igual altura', 'revestimiento de espesor constante SOLO en hastiales y bóveda (sin solera/contrabóveda)', 'el espesor es un DATO aportado (no se asume)'], validity: ['luz>0, altura_hastial≥0, espesor>0'], error_bound: 'exacto (geometría); el espesor estructural no se verifica' },
  formula: 'A_i = b·h + π(b/2)²/2 ; A_e = (b+2e)·h + π(b/2+e)²/2 ; A_rev = A_e − A_i', tolerance: { relative: 1e-12, oracle: ['analytic', 'geo.section.arch (dos secciones)'] }, maturity: 'E2', requires_review_by: ['ingeniero_de_tuneles'], failure_modes: ['INVALID_INPUT'],
}, ({ luz_interior: b, altura_hastial: h, espesor_revestimiento: e }) => {
  if (!(b > 0) || h < 0 || !(e > 0)) throw new OpError('INVALID_INPUT', 'luz y espesor positivos y altura de hastial no negativa.');
  const ai = b * h + (Math.PI * (b / 2) ** 2) / 2; const ae = (b + 2 * e) * h + (Math.PI * (b / 2 + e) ** 2) / 2; return { outputs: { area_interior: ai, area_excavacion: ae, area_revestimiento: ae - ai, perimetro_interior_sin_solera: 2 * h + Math.PI * (b / 2) }, warnings: [] };
});

defineOp({
  id: 'geo.sweep.volume_arch', version: '1.0.0', title: 'Volumen de una sección en herradura (opcionalmente con espesor de revestimiento exterior) barrida a lo largo de una alineación', disciplines: ['obras_lineales', 'tuneles'],
  inputs: [{ name: 'path', dimension: 'L', unit_in: 'm', shape: 'object', required: true }, { name: 'luz_interior', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'altura_hastial', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'espesor_exterior', dimension: 'L', unit_in: 'm', shape: 'scalar', required: false }],
  outputs: [{ name: 'volume', dimension: 'L3', unit_out: 'm3' }, { name: 'section_area', dimension: 'L2', unit_out: 'm2' }, { name: 'axis_length', dimension: 'L', unit_out: 'm' }],
  applicability: { assumptions: ['misma que geo.sweep.volume (alineación horizontal, sección vertical normal al eje)', 'sección simétrica respecto del eje (centroide sobre el eje: V = A·L_eje)', 'con espesor_exterior: se barre la sección EXCAVADA (luz+2e, bóveda concéntrica); sin él, la interior'], validity: ['radio de cada arco > semiancho de la sección (sin auto-solape)'], error_bound: 'exacto bajo las hipótesis' },
  formula: 'V = A·L_eje (centroide en el eje); A de geo.section.horseshoe_lined', tolerance: { relative: 1e-12, oracle: ['analytic', 'geo.sweep.volume con polígono con bulge'] }, maturity: 'E2', requires_review_by: ['ingeniero_de_tuneles'], failure_modes: ['SELF_OVERLAP', 'INVALID_INPUT'],
}, ({ path, luz_interior: b, altura_hastial: h, espesor_exterior: e }) => {
  const luz = b + 2 * (e || 0); const poly = [[-luz / 2, 0], [luz / 2, 0], [luz / 2, h, 1], [-luz / 2, h]];
  const f = path.factor;
  // `path` ya viene normalizado a metros por el registro (factor→m): se reconstruye para evitar doble conversión
  const r2 = ejecutarOperacion('geo.sweep.volume', { path: { value: path.value.map((t) => (t.type === 'straight' ? { ...t, length: t.length * f } : { ...t, radius: t.radius * f })), unit: 'm' }, section: { value: poly, unit: 'm' } }, { modo: 'academic' });
  return { outputs: { volume: r2.outputs.volume.value, section_area: r2.outputs.section_area.value, axis_length: r2.outputs.axis_length.value }, warnings: r2.warnings };
});
