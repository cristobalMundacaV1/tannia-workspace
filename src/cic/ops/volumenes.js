// Métodos de volumen con hipótesis DISTINTAS (docs/tw11/04 §2b). No se exige equivalencia entre ellos.
import { defineOp, OpError } from './registry.js';
import { propiedades, teselar, autoIntersecta, validarPoligono } from '../../geo/geom.js';

const monot = (s) => { for (let i = 1; i < s.length; i++) if (!(s[i] > s[i - 1])) return false; return true; };
const chkSecciones = (stations, areas, nombre = 'areas') => {
  if (stations.length < 2) throw new OpError('INVALID_INPUT', 'Se requieren al menos 2 secciones.');
  if (areas.length !== stations.length) throw new OpError('INVALID_INPUT', `"${nombre}" debe tener la misma cantidad de elementos que "stations" (${stations.length}).`);
  if (!monot(stations)) throw new OpError('NOT_MONOTONIC', 'Las progresivas deben ser estrictamente crecientes.');
  if (areas.some((a) => a < 0)) throw new OpError('INVALID_INPUT', 'Hay áreas negativas.');
};
const V = (n, dimension, unit_in) => ({ name: n, dimension, unit_in, shape: 'vector', required: true });

defineOp({
  id: 'geo.volume.average_end_area', version: '1.0.0', title: 'Volumen por áreas medias entre secciones', disciplines: ['obras_lineales', 'movimiento_de_tierras', 'tuneles'],
  inputs: [V('stations', 'L', 'm'), V('areas', 'L2', 'm2')],
  outputs: [{ name: 'volume', dimension: 'L3', unit_out: 'm3' }, { name: 'interval_volumes', dimension: 'L3', unit_out: 'm3' }],
  applicability: { assumptions: ['A(s) lineal entre secciones consecutivas', 'secciones perpendiculares al eje de referencia de s; Δs a lo largo de ese eje'], validity: ['≥2 secciones', 'progresivas estrictamente crecientes', 'áreas ≥0', 'si hay cruce corte/relleno, partir las secciones en el cruce'], error_bound: 'Si A(s)=a·s²+b·s+c en un tramo de longitud L: V_AEA − V_exacto = a·L³/6 (sobrestima si a>0). Cono/pirámide desde el vértice: AEA = A·L/2 frente a A·L/3 exacto.' },
  formula: 'V = Σ (A_i + A_{i+1})/2 · Δs_i', tolerance: { relative: 1e-12, oracle: ['analytic:prism/wedge (exacto)', 'analytic:cone_frustum (error conocido a·L³/6)', 'mesh_divergence'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['NOT_MONOTONIC', 'INVALID_INPUT'],
}, ({ stations, areas }) => {
  chkSecciones(stations, areas); const iv = []; for (let i = 0; i < areas.length - 1; i++) iv.push((areas[i] + areas[i + 1]) / 2 * (stations[i + 1] - stations[i]));
  return { outputs: { volume: iv.reduce((a, b) => a + b, 0), interval_volumes: iv }, warnings: [] };
});

defineOp({
  id: 'geo.volume.prismoidal', version: '1.0.0', title: 'Volumen prismoidal (Simpson) con sección intermedia real', disciplines: ['obras_lineales', 'movimiento_de_tierras', 'tuneles'],
  inputs: [V('stations', 'L', 'm'), V('areas', 'L2', 'm2'), V('mid_areas', 'L2', 'm2')],
  outputs: [{ name: 'volume', dimension: 'L3', unit_out: 'm3' }, { name: 'interval_volumes', dimension: 'L3', unit_out: 'm3' }],
  applicability: { assumptions: ['A(s) polinomial de grado ≤ 3 en cada tramo', 'mid_areas[i] = área de la sección REAL a mitad de [s_i, s_{i+1}] (no el promedio de los extremos)'], validity: ['mid_areas tiene n−1 elementos', 'progresivas estrictamente crecientes'], error_bound: 'exacto si A(s) es polinomio de grado ≤3 (tronco de cono/pirámide, cuña, prisma). Si mid_areas se interpola linealmente degenera a áreas medias.' },
  formula: 'V = Σ (L_i/6)(A_i + 4·Am_i + A_{i+1})', tolerance: { relative: 1e-12, oracle: ['analytic:cone_frustum (exacto)', 'analytic:prism', 'mesh_divergence'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['NOT_MONOTONIC', 'INVALID_INPUT'],
}, ({ stations, areas, mid_areas }) => {
  chkSecciones(stations, areas); if (mid_areas.length !== stations.length - 1) throw new OpError('INVALID_INPUT', `"mid_areas" debe tener ${stations.length - 1} elementos (una sección intermedia real por tramo).`);
  if (mid_areas.some((a) => a < 0)) throw new OpError('INVALID_INPUT', 'Hay áreas intermedias negativas.');
  const iv = []; const w = [];
  for (let i = 0; i < areas.length - 1; i++) { iv.push((stations[i + 1] - stations[i]) / 6 * (areas[i] + 4 * mid_areas[i] + areas[i + 1])); if (Math.abs(mid_areas[i] - (areas[i] + areas[i + 1]) / 2) < 1e-12 * Math.max(1, areas[i])) w.push(`tramo ${i}: la sección intermedia coincide con el promedio de los extremos; el resultado equivale a áreas medias`); }
  return { outputs: { volume: iv.reduce((a, b) => a + b, 0), interval_volumes: iv }, warnings: w };
});

defineOp({
  id: 'geo.solid.extrude', version: '1.0.0', title: 'Extrusión recta de sección constante', disciplines: ['transversal', 'tuneles', 'obras_civiles'],
  inputs: [{ name: 'area', dimension: 'L2', unit_in: 'm2', shape: 'scalar', required: true }, { name: 'length', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'section_plane', dimension: null, unit_in: null, shape: 'object', required: true }, { name: 'oblique_angle', dimension: null, unit_in: 'deg', shape: 'scalar', required: false }],
  outputs: [{ name: 'volume', dimension: 'L3', unit_out: 'm3' }],
  applicability: { assumptions: ['sección constante', 'trayectoria RECTA', 'normal_to_path: area en el plano normal a la trayectoria y length = longitud de la trayectoria', 'vertical_cut: area de la sección vertical y length = longitud HORIZONTAL (V=A_v·L_h)'], validity: ['section_plane ∈ {normal_to_path, vertical_cut}', 'oblique_angle (si se da) entre 0° y <90° y solo con normal_to_path'], error_bound: 'exacto bajo sus hipótesis; mezclar ambos planos sin declararlo produce un error de 1/cosφ' },
  formula: 'normal_to_path: V=A_n·L_3D·cos(α) ; vertical_cut: V=A_v·L_h', tolerance: { relative: 1e-12, oracle: ['analytic:prism', 'analytic:oblique_cylinder'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['INVALID_INPUT', 'OUT_OF_RANGE'],
}, ({ area, length, section_plane, oblique_angle }) => {
  if (!(area > 0) || !(length > 0)) throw new OpError('INVALID_INPUT', 'area y length deben ser positivos.');
  const sp = typeof section_plane === 'object' ? section_plane.value : section_plane;
  if (sp !== 'normal_to_path' && sp !== 'vertical_cut') throw new OpError('INVALID_INPUT', 'section_plane debe ser "normal_to_path" o "vertical_cut" (declararlo es obligatorio).');
  if (oblique_angle !== undefined) { if (sp !== 'normal_to_path') throw new OpError('INVALID_INPUT', 'oblique_angle solo aplica con normal_to_path.'); const c = Math.cos(oblique_angle); if (!(oblique_angle >= 0) || !(c > 1e-9)) throw new OpError('OUT_OF_RANGE', 'oblique_angle debe estar en [0°, 90°).'); return { outputs: { volume: area * length * c }, warnings: [] }; }
  return { outputs: { volume: area * length }, warnings: [] };
});

defineOp({
  id: 'geo.sweep.volume', version: '1.0.0', title: 'Barrido de una sección constante sobre una alineación horizontal (rectas y arcos)', disciplines: ['obras_lineales', 'tuneles', 'transversal'],
  inputs: [{ name: 'path', dimension: 'L', unit_in: 'm', shape: 'object', required: true }, { name: 'section', dimension: 'L', unit_in: 'm', shape: 'object', required: true }],
  outputs: [{ name: 'volume', dimension: 'L3', unit_out: 'm3' }, { name: 'axis_length', dimension: 'L', unit_out: 'm' }, { name: 'centroid_path_length', dimension: 'L', unit_out: 'm' }, { name: 'section_area', dimension: 'L2', unit_out: 'm2' }, { name: 'centroid_offset', dimension: 'L', unit_out: 'm' }],
  applicability: { assumptions: ['sección plana y constante, VERTICAL y normal a la alineación horizontal', 'x lateral positivo a la IZQUIERDA del avance, y vertical', 'alineación horizontal: tramos {type:"straight",length} y {type:"arc",radius,angle_deg,turn:"left"|"right"}', 'sin pendiente longitudinal (para pendiente use extrusión recta con section_plane o descomponga en tramos)'], validity: ['1 − κ·x > 0 para todo punto de la sección (sin auto-solape): radio > distancia lateral hacia el centro', 'polígono de la sección simple'], error_bound: 'exacto bajo las hipótesis: V = Σ A·(L_recta) + A·θ·(R − s·x̄) con s=+1 izquierda, −1 derecha. Pappus (V=A·L_centroide) es el mismo resultado para trayectoria plana con sección normal.' },
  formula: 'V = ∫ A(1−κ(s)·x̄) ds', tolerance: { relative: 1e-12, oracle: ['analytic:torus_sector (V=θ·R_c·A)', 'mesh_divergence(barrido teselado)'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['SELF_OVERLAP', 'INVALID_INPUT'],
}, ({ path, section }) => {
  const f = path.factor; const tramos = path.value; const sec = section.value.map((p) => [p[0] * section.factor, p[1] * section.factor, ...(p.length > 2 ? [p[2]] : [])]);
  if (!Array.isArray(tramos) || !tramos.length) throw new OpError('INVALID_INPUT', 'La alineación necesita al menos un tramo.');
  validarPoligono(sec); const pr = propiedades(sec); const A = pr.area; const xb = pr.centroide[0];
  if (!(A > 0)) throw new OpError('INVALID_INPUT', 'La sección tiene área nula.'); const tes = teselar(sec);
  if (autoIntersecta(tes)) throw new OpError('INVALID_INPUT', 'La sección se auto-intersecta.');
  let V = 0; let Lax = 0; let Lc = 0; const w = [];
  tramos.forEach((t, i) => {
    if (t.type === 'straight') { const L = t.length * f; if (!(L > 0)) throw new OpError('INVALID_INPUT', `Tramo ${i}: longitud no positiva.`); V += A * L; Lax += L; Lc += L; }
    else if (t.type === 'arc') {
      const R = t.radius * f; const th = (t.angle_deg * Math.PI) / 180; const s = t.turn === 'left' ? 1 : t.turn === 'right' ? -1 : 0;
      if (!(R > 0) || !(th > 0) || !s) throw new OpError('INVALID_INPUT', `Tramo ${i}: arco con radio/ángulo positivos y turn "left"|"right".`);
      const xmax = Math.max(...tes.map((p) => s * p[0])); if (!(R - xmax > 1e-12 * R)) throw new OpError('SELF_OVERLAP', `Tramo ${i}: el radio (${R} m) no supera la distancia lateral de la sección hacia el centro (${xmax} m): el barrido se auto-solapa.`);
      V += A * th * (R - s * xb); Lax += R * th; Lc += th * (R - s * xb);
    } else throw new OpError('INVALID_INPUT', `Tramo ${i}: tipo "${t.type}" no soportado (straight|arc).`);
  });
  if (Math.abs(xb) > 1e-12) w.push('el centroide de la sección está fuera del eje: el volumen en curvas ≠ A·longitud del eje (use la longitud del centroide)');
  return { outputs: { volume: V, axis_length: Lax, centroid_path_length: Lc, section_area: A, centroid_offset: xb }, warnings: w };
});

defineOp({
  id: 'geo.profile.vertical_curve', version: '1.0.0', title: 'Curva vertical parabólica: cota y pendiente en una progresiva', disciplines: ['carreteras', 'obras_lineales', 'tuneles'],
  inputs: [{ name: 'pvc_station', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'pvc_elevation', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'g1', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'g2', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'length', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }, { name: 'station', dimension: 'L', unit_in: 'm', shape: 'scalar', required: true }],
  outputs: [{ name: 'elevation', dimension: 'L', unit_out: 'm' }, { name: 'grade', dimension: null, unit_out: '1' }, { name: 'k_value', dimension: 'L', unit_out: 'm' }, { name: 'turning_station', dimension: 'L', unit_out: 'm' }],
  applicability: { assumptions: ['parábola de eje vertical con progresiva horizontal', 'pendientes g1,g2 como fracción (use unidad % si son porcentajes)'], validity: ['length>0', 'pvc_station ≤ station ≤ pvc_station+length', 'g1≠g2 para K y punto de giro'], error_bound: 'exacto' },
  formula: 'y = y0 + g1·x + (g2−g1)·x²/(2L); g(x)=g1+(g2−g1)x/L; K=L/|g2−g1|', tolerance: { relative: 1e-12, oracle: ['analytic'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['OUT_OF_RANGE', 'INVALID_INPUT'],
}, ({ pvc_station: s0, pvc_elevation: y0, g1, g2, length: L, station: s }) => {
  if (!(L > 0)) throw new OpError('INVALID_INPUT', 'La longitud de la curva debe ser positiva.');
  const x = s - s0; if (x < -1e-12 || x > L + 1e-12) throw new OpError('OUT_OF_RANGE', `La progresiva ${s} m está fuera de la curva [${s0}, ${s0 + L}].`);
  const dg = g2 - g1; const y = y0 + g1 * x + (dg * x * x) / (2 * L); const g = g1 + (dg * x) / L;
  const xt = dg !== 0 ? (-g1 * L) / dg : null; const turning = xt !== null && xt >= 0 && xt <= L ? s0 + xt : null;
  return { outputs: { elevation: y, grade: g, k_value: dg !== 0 ? L / Math.abs(dg) : null, turning_station: turning }, warnings: dg === 0 ? ['g1 = g2: no hay curvatura; K y punto de giro no definidos'] : [] };
});

defineOp({
  id: 'earth.volume_estimate', version: '1.0.0', title: 'Estimación de movimiento de tierras por secciones (corte/relleno, áreas medias)', disciplines: ['movimiento_de_tierras', 'obras_lineales', 'carreteras'],
  inputs: [V('stations', 'L', 'm'), V('cut_areas', 'L2', 'm2'), V('fill_areas', 'L2', 'm2'), { name: 'cut_to_fill_factor', dimension: null, unit_in: null, shape: 'scalar', required: true }],
  outputs: [{ name: 'cut_volume', dimension: 'L3', unit_out: 'm3' }, { name: 'fill_volume', dimension: 'L3', unit_out: 'm3' }, { name: 'net_balance', dimension: 'L3', unit_out: 'm3' }, { name: 'mass_ordinates', dimension: 'L3', unit_out: 'm3' }],
  applicability: { assumptions: ['áreas de corte y relleno medidas en secciones transversales verticales al eje', 'cut_to_fill_factor = m³ de relleno compactado obtenidos por m³ de corte en banco (DATO DE LA USUARIA: esponjamiento/compactación no se asumen)', 'método de áreas medias'], validity: ['progresivas crecientes', 'áreas ≥0', 'factor>0 aportado explícitamente'], error_bound: 'ESTIMACIÓN: depende del espaciamiento de secciones y del terreno; en tramos de transición corte↔relleno el método de áreas medias es inexacto (se advierte). No es un volumen geométrico exacto.' },
  formula: 'Vc=Σ(Ac_i+Ac_{i+1})/2·Δs; Vr=Σ(Ar_i+Ar_{i+1})/2·Δs; balance=Vc·f−Vr; ordenada_k=Σ_{i≤k}(ΔVc_i·f−ΔVr_i)', tolerance: { relative: 1e-12, oracle: ['cálculo manual independiente', 'geo.volume.average_end_area'] }, maturity: 'E2', requires_review_by: ['ingeniero_vial_o_civil'], failure_modes: ['NOT_MONOTONIC', 'ENTRADA_FALTANTE'],
}, ({ stations, cut_areas, fill_areas, cut_to_fill_factor: f }) => {
  chkSecciones(stations, cut_areas, 'cut_areas'); chkSecciones(stations, fill_areas, 'fill_areas'); if (!(f > 0)) throw new OpError('INVALID_INPUT', 'cut_to_fill_factor debe ser positivo (lo aporta la usuaria).');
  let vc = 0; let vr = 0; const ord = [0]; const w = [];
  for (let i = 0; i < stations.length - 1; i++) { const ds = stations[i + 1] - stations[i]; const dc = (cut_areas[i] + cut_areas[i + 1]) / 2 * ds; const dr = (fill_areas[i] + fill_areas[i + 1]) / 2 * ds; vc += dc; vr += dr; ord.push(ord[i] + dc * f - dr); }
  stations.forEach((_, i) => { if (cut_areas[i] > 0 && fill_areas[i] > 0) w.push(`sección ${i}: mixta (corte y relleno simultáneos)`); });
  for (let i = 0; i < stations.length - 1; i++) if ((cut_areas[i] === 0 && fill_areas[i + 1] === 0 && fill_areas[i] > 0 && cut_areas[i + 1] > 0) || (fill_areas[i] === 0 && cut_areas[i + 1] === 0 && cut_areas[i] > 0 && fill_areas[i + 1] > 0)) w.push(`tramo ${i}: transición corte↔relleno: áreas medias poco exactas; considere una sección en el cruce de cota cero`);
  return { outputs: { cut_volume: vc, fill_volume: vr, net_balance: vc * f - vr, mass_ordinates: ord }, warnings: w };
});
