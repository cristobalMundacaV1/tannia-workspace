// TW-11 G1: motor dimensional y operaciones con contrato contra oráculos independientes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mag, aUnidad, sumar, normalizar, UnitError, dimDe } from '../src/cic/units.js';
import { ejecutarOperacion as run, listarOperaciones, OpError } from '../src/cic/ops/index.js';
import { propiedades, volumenMalla } from '../src/geo/geom.js';

const M = (value, unit = 'm') => ({ value, unit });
const close = (a, b, rel = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${msg} ${a} ≠ ${b}`);
const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof OpError && e.code === code, code);

test('unidades: conversiones exactas, dimensiones y rechazo de incompatibles/desconocidas', () => {
  close(aUnidad(mag(250, 'cm2'), 'm2'), 0.025); close(aUnidad(mag(1, 'ft'), 'mm'), 304.8); close(aUnidad(mag(2, 'km'), 'm'), 2000);
  close(aUnidad(mag(5, '%'), '1'), 0.05); close(aUnidad(mag(180, 'deg'), 'rad'), Math.PI); assert.equal(dimDe('m3'), 'L3');
  assert.throws(() => sumar(mag(1, 'm'), mag(1, 'm2')), (e) => e instanceof UnitError && e.code === 'DIMENSION_INCOMPATIBLE');
  assert.throws(() => mag(1, 'furlong'), (e) => e.code === 'UNIDAD_DESCONOCIDA');
  assert.throws(() => normalizar(3, 'kg', 'm', 'x'), (e) => e.code === 'DIMENSION_INCOMPATIBLE');
  assert.throws(() => mag(NaN, 'm'), (e) => e.code === 'VALOR_INVALIDO');
});

test('catálogo: todas las operaciones declaran contrato completo y madurez E2 con oráculo', () => {
  const ops = listarOperaciones(); assert.ok(ops.length >= 9);
  for (const o of ops) { assert.ok(o.applicability.validity.length && o.applicability.assumptions.length, o.id); assert.ok(o.tolerance.oracle.length, o.id); assert.ok(['E1', 'E2'].includes(o.maturity)); if (o.maturity === 'E1') assert.match(o.id, /^edu./); assert.ok(o.failure_modes.length, o.id); }
});

test('geo.polygon.properties: rectángulo, círculo (2 bulges), semicírculo, huecos; invariancias', () => {
  let r = run('geo.polygon.properties', { vertices: M([[0, 0], [4, 0], [4, 3], [0, 3]]) }); close(r.outputs.area.value, 12); close(r.outputs.perimetro.value, 14); close(r.outputs.centroide_x.value, 2); close(r.outputs.centroide_y.value, 1.5);
  r = run('geo.polygon.properties', { vertices: M([[-1, 0, 1], [1, 0, 1]]) }); close(r.outputs.area.value, Math.PI); close(r.outputs.perimetro.value, 2 * Math.PI);
  r = run('geo.polygon.properties', { vertices: M([[0, 0, 1], [2, 0], [2, 1], [0, 1]]) }); close(r.outputs.area.value, 2 + Math.PI / 2); close(r.outputs.centroide_y.value, (2 * 0.5 - (Math.PI / 2) * (4 * 1) / (3 * Math.PI)) / (2 + Math.PI / 2));
  r = run('geo.polygon.properties', { vertices: M([[0, 0], [10, 0], [10, 10], [0, 10]]), huecos: M([[[2, 2], [4, 2], [4, 4], [2, 4]], [[6, 6], [8, 6], [8, 8], [6, 8]]]) }); close(r.outputs.area.value, 92); close(r.outputs.perimetro.value, 40 + 16); close(r.outputs.centroide_x.value, 5);
  // invariancia de unidad, traslación y rotación
  const base = [[0, 0], [5, 1], [6, 4], [1, 3]]; const a0 = run('geo.polygon.properties', { vertices: M(base) });
  const mm = run('geo.polygon.properties', { vertices: M(base.map((p) => [p[0] * 1000, p[1] * 1000]), 'mm') }); close(mm.outputs.area.value, a0.outputs.area.value); close(mm.outputs.perimetro.value, a0.outputs.perimetro.value);
  const th = 0.7; const rot = base.map(([x, y]) => [x * Math.cos(th) - y * Math.sin(th) + 100, x * Math.sin(th) + y * Math.cos(th) - 50]); const a1 = run('geo.polygon.properties', { vertices: M(rot) });
  close(a1.outputs.area.value, a0.outputs.area.value); close(a1.outputs.perimetro.value, a0.outputs.perimetro.value);
});

test('geo.polygon.properties: rechaza auto-intersección, huecos fuera/solapados y falta de unidad; advierte sentido horario', () => {
  throwsCode(() => run('geo.polygon.properties', { vertices: M([[0, 0], [2, 2], [2, 0], [0, 2]]) }), 'SELF_INTERSECTION');
  throwsCode(() => run('geo.polygon.properties', { vertices: M([[0, 0], [10, 0], [10, 10], [0, 10]]), huecos: M([[[20, 20], [22, 20], [22, 22], [20, 22]]]) }), 'INVALID_INPUT');
  throwsCode(() => run('geo.polygon.properties', { vertices: M([[0, 0], [10, 0], [10, 10], [0, 10]]), huecos: M([[[1, 1], [5, 1], [5, 5], [1, 5]], [[3, 3], [7, 3], [7, 7], [3, 7]]]) }), 'INVALID_INPUT');
  throwsCode(() => run('geo.polygon.properties', { vertices: { value: [[0, 0], [1, 0], [1, 1]], unit: null } }), 'UNIDAD_FALTANTE');
  throwsCode(() => run('geo.polygon.properties', { vertices: M([[0, 0], [1, 0], [1, 1]]), extra: M(1) }), 'ENTRADA_DESCONOCIDA');
  assert.ok(run('geo.polygon.properties', { vertices: M([[0, 0], [0, 3], [4, 3], [4, 0]]) }).warnings.length);
});

test('geo.section.arch: semicírculo (herradura) exacto, contraste con polígono con arco y rango de validez', () => {
  let r = run('geo.section.arch', { luz: M(8), altura_hastial: M(0), flecha: M(4) }); close(r.outputs.area.value, 8 * Math.PI); close(r.outputs.centroide_y.value, 16 / (3 * Math.PI)); close(r.outputs.perimetro_sin_solera.value, 4 * Math.PI);
  // herradura 8 m de luz con hastiales de 2 m: A = 8·2 + 8π; comparación con el polígono equivalente (otro camino de cálculo)
  r = run('geo.section.arch', { luz: M(8), altura_hastial: M(2), flecha: M(4) }); close(r.outputs.area.value, 16 + 8 * Math.PI);
  const pol = run('geo.polygon.properties', { vertices: M([[0, 0], [8, 0], [8, 2, 1], [0, 2]]) }); // arco antihorario de (8,2) a (0,2): bóveda hacia arriba
  close(pol.outputs.area.value, 16 + 8 * Math.PI); close(pol.outputs.centroide_y.value, r.outputs.centroide_y.value);
  // bóveda rebajada: flecha 1 de luz 8 (r=8.5): comparación con el segmento circular por polígono-arco
  const b = run('geo.section.arch', { luz: M(8), altura_hastial: M(0), flecha: M(1) }); const th = 2 * Math.asin(4 / 8.5); close(b.outputs.area.value, 0.5 * 8.5 * 8.5 * (th - Math.sin(th)), 1e-12);
  const bulge = Math.tan(th / 4); const seg = run('geo.polygon.properties', { vertices: { value: [[8, 0, bulge], [0, 0]], unit: 'm' } }); close(seg.outputs.area.value, b.outputs.area.value, 1e-10);
  throwsCode(() => run('geo.section.arch', { luz: M(8), altura_hastial: M(0), flecha: M(5) }), 'OUT_OF_RANGE');
  throwsCode(() => run('geo.section.arch', { luz: M(8), altura_hastial: M(0), flecha: M(0) }), 'INVALID_INPUT');
  const mm = run('geo.section.arch', { luz: M(8000, 'mm'), altura_hastial: M(2000, 'mm'), flecha: M(4000, 'mm') }); close(mm.outputs.area.value, 16 + 8 * Math.PI);
});

// Sólidos analíticos de referencia
const frustumA = (A1, A2, t) => { const r1 = Math.sqrt(A1); const r2 = Math.sqrt(A2); const r = r1 + (r2 - r1) * t; return r * r; }; // A(s) cuadrática (secciones homotéticas)
const frustumV = (A1, A2, L) => (L / 3) * (A1 + A2 + Math.sqrt(A1 * A2));

test('P01 volúmenes: áreas medias vs prismoidal con hipótesis distintas (no se exige equivalencia)', () => {
  // (1) A(s) LINEAL (prisma de sección variable tipo cuña): ambos exactos y coinciden entre sí
  const st = [0, 10, 20]; const lineal = [2, 6, 10]; const mid = [4, 8];
  const aea = run('geo.volume.average_end_area', { stations: M(st), areas: M(lineal, 'm2') }).outputs.volume.value; const pri = run('geo.volume.prismoidal', { stations: M(st), areas: M(lineal, 'm2'), mid_areas: M(mid, 'm2') }).outputs.volume.value;
  close(aea, 120); close(pri, 120); close(aea, pri);
  // (2) tronco de cono/pirámide: A(s) cuadrática → prismoidal EXACTO, áreas medias sobrestima exactamente a·L³/6
  const A1 = 4; const A2 = 25; const L = 12; const exact = frustumV(A1, A2, L); const a = (Math.sqrt(A1) - Math.sqrt(A2)) ** 2 / (L * L); // coeficiente de s² de A(s)
  const v1 = run('geo.volume.average_end_area', { stations: M([0, L]), areas: M([A1, A2], 'm2') }).outputs.volume.value;
  const v2 = run('geo.volume.prismoidal', { stations: M([0, L]), areas: M([A1, A2], 'm2'), mid_areas: M([frustumA(A1, A2, 0.5)], 'm2') }).outputs.volume.value;
  close(v2, exact, 1e-12); assert.ok(v1 > exact); close(v1 - exact, (a * L ** 3) / 6, 1e-9, 'AEA−exacto = a·L³/6');
  // (3) pirámide desde el vértice: AEA = A·L/2 frente a A·L/3
  const p1 = run('geo.volume.average_end_area', { stations: M([0, 9]), areas: M([0, 16], 'm2') }).outputs.volume.value; close(p1, 16 * 9 / 2); close(run('geo.volume.prismoidal', { stations: M([0, 9]), areas: M([0, 16], 'm2'), mid_areas: M([4], 'm2') }).outputs.volume.value, 16 * 9 / 3);
  // (4) si la sección intermedia se interpola, degenera a áreas medias y se advierte
  const dg = run('geo.volume.prismoidal', { stations: M([0, 12]), areas: M([A1, A2], 'm2'), mid_areas: M([(A1 + A2) / 2], 'm2') }); assert.ok(dg.warnings.some((w) => /equivale a áreas medias/.test(w))); close(dg.outputs.volume.value, v1);
  // mutación del oráculo: usar el promedio de dimensiones o L³/5 sería detectado
  assert.ok(Math.abs((L / 6) * (A1 + 4 * ((Math.sqrt(A1) + Math.sqrt(A2)) / 2) ** 2 + A2) - exact) < 1e-9, 'prismoidal con área de dimensiones medias es exacto en troncos homotéticos');
  assert.ok(Math.abs(v1 - exact - (a * L ** 3) / 5) > 1e-3, 'un coeficiente L³/5 no pasa el oráculo');
});

test('volúmenes: rechazo de progresivas no monótonas, áreas negativas, longitudes distintas y unidades', () => {
  throwsCode(() => run('geo.volume.average_end_area', { stations: M([0, 5, 5]), areas: M([1, 2, 3], 'm2') }), 'NOT_MONOTONIC');
  throwsCode(() => run('geo.volume.average_end_area', { stations: M([0, 5]), areas: M([1, -2], 'm2') }), 'INVALID_INPUT');
  throwsCode(() => run('geo.volume.average_end_area', { stations: M([0, 5, 9]), areas: M([1, 2], 'm2') }), 'INVALID_INPUT');
  throwsCode(() => run('geo.volume.average_end_area', { stations: M([0, 5]), areas: M([1, 2], 'm') }), 'DIMENSION_INCOMPATIBLE');
  throwsCode(() => run('geo.volume.prismoidal', { stations: M([0, 5, 9]), areas: M([1, 2, 3], 'm2'), mid_areas: M([1], 'm2') }), 'INVALID_INPUT');
  // unidades: km + cm2 mezclados dan lo mismo que SI
  const a = run('geo.volume.average_end_area', { stations: M([0, 0.01], 'km'), areas: M([20000, 40000], 'cm2') }).outputs.volume.value; close(a, 3 * 10);
});

test('P01 extrusión: sección CONSTANTE; normal vs corte vertical; oblicua (no se usa una cuña de sección variable)', () => {
  close(run('geo.solid.extrude', { area: M(6, 'm2'), length: M(10), section_plane: { value: 'normal_to_path', unit: null } }).outputs.volume.value, 60);
  // túnel con pendiente φ: A_v·L_h = A_n·L_3D con A_n = A_v·cosφ
  const phi = Math.atan(0.08); const Lh = 100; const Av = 40; const L3 = Lh / Math.cos(phi); const An = Av * Math.cos(phi);
  const v = run('geo.solid.extrude', { area: M(Av, 'm2'), length: M(Lh), section_plane: { value: 'vertical_cut', unit: null } }).outputs.volume.value;
  const n = run('geo.solid.extrude', { area: M(An, 'm2'), length: M(L3), section_plane: { value: 'normal_to_path', unit: null } }).outputs.volume.value; close(v, n, 1e-12);
  // mezclar sin declarar: usar A_v con L_3D da error 1/cosφ
  assert.ok(Math.abs(Av * L3 - v) / v > 0.003);
  // cilindro oblicuo: área en plano oblicuo con α → V = A·L·cosα
  close(run('geo.solid.extrude', { area: M(2, 'm2'), length: M(10), section_plane: { value: 'normal_to_path', unit: null }, oblique_angle: M(60, 'deg') }).outputs.volume.value, 10);
  throwsCode(() => run('geo.solid.extrude', { area: M(2, 'm2'), length: M(10), section_plane: { value: 'normal_to_path', unit: null }, oblique_angle: M(90, 'deg') }), 'OUT_OF_RANGE');
  throwsCode(() => run('geo.solid.extrude', { area: M(2, 'm2'), length: M(10), section_plane: { value: 'vertical_cut', unit: null }, oblique_angle: M(10, 'deg') }), 'INVALID_INPUT');
  throwsCode(() => run('geo.solid.extrude', { area: M(2, 'm2'), length: M(10), section_plane: { value: 'otro', unit: null } }), 'INVALID_INPUT');
});

// Oráculo independiente: malla del sólido barrido + teorema de la divergencia
function mallaBarrido(sec, R, thetaTot, turn, n) {
  const s = turn === 'left' ? 1 : -1; // centro de curvatura a la izquierda (s=+1) o derecha
  const pos = (ang, x, y) => { const rho = R - s * x; const cx = 0; const cy = s * R; // centro; avance inicial +X desde el origen
    const a = s * ang; return [cx + rho * Math.sin(ang), cy - s * rho * Math.cos(ang), y, a]; };
  const ring = (ang) => sec.map(([x, y]) => { const rho = R - s * x; return [rho * Math.sin(ang), s * R - s * rho * Math.cos(ang), y]; });
  const rings = []; for (let i = 0; i <= n; i++) rings.push(ring((thetaTot * i) / n)); const tris = []; const m = sec.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = rings[i][j]; const b = rings[i][(j + 1) % m]; const c = rings[i + 1][(j + 1) % m]; const d = rings[i + 1][j]; tris.push([a, b, c], [a, c, d]); }
  const cap = (r, inv) => { const c0 = r.reduce((q, p) => [q[0] + p[0] / m, q[1] + p[1] / m, q[2] + p[2] / m], [0, 0, 0]); for (let j = 0; j < m; j++) { const a = r[j]; const b = r[(j + 1) % m]; tris.push(inv ? [c0, b, a] : [c0, a, b]); } };
  cap(rings[0], true); cap(rings[n], false); return tris;
}
test('P01 barrido: torus-sector analítico, oráculo de malla+divergencia, Pappus solo con centroide y distinto de A·L_eje', () => {
  const sec = [[0.5, 0], [2.5, 0], [2.5, 3], [0.5, 3]]; const A = 6; const xb = 1.5; const R = 40; const th = Math.PI / 2;
  const r = run('geo.sweep.volume', { path: M([{ type: 'arc', radius: R, angle_deg: 90, turn: 'left' }]), section: M(sec) });
  close(r.outputs.volume.value, A * th * (R - xb), 1e-12); close(r.outputs.centroid_path_length.value, th * (R - xb)); close(r.outputs.axis_length.value, th * R);
  assert.ok(Math.abs(r.outputs.volume.value - A * r.outputs.axis_length.value) > 1, 'V ≠ A·L_eje cuando el centroide está fuera del eje (Pappus usa la trayectoria del centroide)');
  // oráculo de malla (otro algoritmo): converge con O(1/n²)
  let prev = Infinity; for (const n of [16, 64, 256]) { const v = Math.abs(volumenMalla(mallaBarrido(sec, R, th, 'left', n))); const e = Math.abs(v - r.outputs.volume.value) / r.outputs.volume.value; assert.ok(e < prev, 'converge'); prev = e; }
  assert.ok(prev < 2e-4, `error de malla ${prev}`);
  // derecha: espejo → x̄ del lado opuesto
  const rr = run('geo.sweep.volume', { path: M([{ type: 'arc', radius: R, angle_deg: 90, turn: 'right' }]), section: M(sec) }); close(rr.outputs.volume.value, A * th * (R + xb), 1e-12);
  const mm = run('geo.sweep.volume', { path: M([{ type: 'arc', radius: R, angle_deg: 90, turn: 'right' }]), section: M(sec.map((p) => [p[0] * 1000, p[1] * 1000])) }); // unidad: m vs implícita… misma unidad m
  assert.ok(mm.outputs.volume.value > 0);
  // toro completo de sección circular (polígono con 2 bulges): V = 2π²R r²
  const tor = run('geo.sweep.volume', { path: M([{ type: 'arc', radius: 10, angle_deg: 360, turn: 'left' }]), section: { value: [[-1, 0, 1], [1, 0, 1]].map(([x, y, b]) => [x, y + 0, b]), unit: 'm' } });
  close(tor.outputs.volume.value, Math.PI * 1 * 2 * Math.PI * 10, 1e-12); // A=π, x̄=0 ⇒ V=A·2πR = 2π²Rr²
  // tramos mixtos recta+arco+recta
  const mix = run('geo.sweep.volume', { path: M([{ type: 'straight', length: 20 }, { type: 'arc', radius: R, angle_deg: 30, turn: 'left' }, { type: 'straight', length: 5 }]), section: M(sec) });
  close(mix.outputs.volume.value, A * 25 + A * (Math.PI / 6) * (R - xb), 1e-12);
  // auto-solape: radio menor que el ancho lateral hacia el centro
  throwsCode(() => run('geo.sweep.volume', { path: M([{ type: 'arc', radius: 2, angle_deg: 90, turn: 'left' }]), section: M(sec) }), 'SELF_OVERLAP');
  close(run('geo.sweep.volume', { path: M([{ type: 'arc', radius: 2, angle_deg: 90, turn: 'right' }]), section: M(sec) }).outputs.volume.value, A * th * (2 + xb), 1e-12); // hacia el exterior no se solapa
});

test('geo.profile.vertical_curve: parábola analítica, derivada numérica y punto de giro', () => {
  const inp = (s) => ({ pvc_station: M(1000), pvc_elevation: M(100), g1: { value: -3, unit: '%' }, g2: { value: 2, unit: '%' }, length: M(200), station: M(s) });
  const r0 = run('geo.profile.vertical_curve', inp(1000)); close(r0.outputs.elevation.value, 100); close(r0.outputs.grade.value, -0.03); close(r0.outputs.k_value.value, 200 / 0.05);
  const r = run('geo.profile.vertical_curve', inp(1120)); const x = 120; close(r.outputs.elevation.value, 100 - 0.03 * x + (0.05 * x * x) / 400);
  const h = 1e-3; const d = (run('geo.profile.vertical_curve', inp(1120 + h)).outputs.elevation.value - run('geo.profile.vertical_curve', inp(1120 - h)).outputs.elevation.value) / (2 * h); close(d, r.outputs.grade.value, 1e-8);
  close(r.outputs.turning_station.value, 1000 + (0.03 * 200) / 0.05); close(run('geo.profile.vertical_curve', inp(1200)).outputs.grade.value, 0.02);
  throwsCode(() => run('geo.profile.vertical_curve', inp(1201)), 'OUT_OF_RANGE');
});

test('earth.volume_estimate: caso manual, factor obligatorio aportado, advertencias de transición/mixtas', () => {
  const base = { stations: M([0, 20, 40, 60]), cut_areas: M([10, 30, 20, 0], 'm2'), fill_areas: M([0, 0, 5, 25], 'm2'), cut_to_fill_factor: { value: 0.9, unit: null } };
  const r = run('earth.volume_estimate', base); close(r.outputs.cut_volume.value, 20 * (20 + 25 + 10)); close(r.outputs.fill_volume.value, 20 * (0 + 2.5 + 15));
  close(r.outputs.net_balance.value, 1100 * 0.9 - 350); assert.equal(r.outputs.mass_ordinates.value.length, 4); close(r.outputs.mass_ordinates.value[3], 1100 * 0.9 - 350);
  throwsCode(() => run('earth.volume_estimate', { stations: base.stations, cut_areas: base.cut_areas, fill_areas: base.fill_areas }), 'ENTRADA_FALTANTE');
  assert.ok(run('earth.volume_estimate', { ...base, fill_areas: M([0, 1, 5, 25], 'm2') }).warnings.some((w) => /mixta/.test(w)));
  assert.deepEqual(run('earth.volume_estimate', base).requires_review_by, ['ingeniero_vial_o_civil']);
});

test('reproducibilidad: el hash de entradas es estable y distinto si cambia una entrada o la operación', () => {
  const a = run('geo.section.circle', { radio: M(2) }); const b = run('geo.section.circle', { radio: M(2) }); const c = run('geo.section.circle', { radio: M(2.0001) });
  assert.equal(a.input_hash, b.input_hash); assert.notEqual(a.input_hash, c.input_hash); close(a.outputs.area.value, 4 * Math.PI);
  assert.throws(() => run('no.existe', {}), (e) => e.code === 'OPERACION_DESCONOCIDA');
});
