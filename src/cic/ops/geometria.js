import { defineOp, OpError } from './registry.js';
import { propiedades, poligonoConHuecos, autoIntersecta, teselar, validarPoligono } from '../../geo/geom.js';

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
