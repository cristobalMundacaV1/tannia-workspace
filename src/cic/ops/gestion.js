// Operaciones de cantidades, presupuesto y programación (docs/tw11/04 §5). Parámetros SIEMPRE aportados por la usuaria (rendimientos, precios, pérdidas, %): nunca por defecto.
import { defineOp, OpError } from './registry.js';
import { dimEq, D } from '../units.js';
import { subtotalPartida, rubros, POLITICA_REDONDEO } from '../../budget/calc.js';

const dimTxt = (d) => ['L', 'M', 'T'].filter((k) => d[k]).map((k) => (d[k] === 1 ? k : `${k}${d[k]}`)).join('·') || '1';
const SI = { L: ['m', 'L'], 'L2': ['m2', 'L2'], 'L3': ['m3', 'L3'] };
const unidadSalida = (dim) => { const k = dimTxt(dim); return SI[k] ? { unit: SI[k][0], dimension: SI[k][1] } : { unit: null, dimension: k }; };

defineOp({
  id: 'qty.product', version: '1.0.0', title: 'Cantidad = base × factor (regla de cubicación: área×espesor, perímetro×altura, longitud×sección…)', disciplines: ['cubicaciones', 'transversal'],
  inputs: [{ name: 'base', dimension: 'any', unit_in: null, shape: 'scalar', required: true }, { name: 'factor', dimension: 'any', unit_in: null, shape: 'scalar', required: true }],
  outputs: [{ name: 'cantidad', dimension: null, unit_out: null }],
  applicability: { assumptions: ['base y factor medidos/aportados con unidad explícita (p. ej. m2 × m, m × m2, m × m)', 'el factor (espesor, altura, sección) es un DATO de la usuaria'], validity: ['valores ≥0; la dimensión resultante debe ser L, L2 o L3'], error_bound: 'exacto' },
  formula: 'Q = base × factor', tolerance: { relative: 1e-12, oracle: ['aritmética', 'quantities/engine (regresión)'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['DIMENSION_INCOMPATIBLE', 'INVALID_INPUT'],
}, ({ base, factor }) => {
  if (base.v < 0 || factor.v < 0) throw new OpError('INVALID_INPUT', 'base y factor no pueden ser negativos.');
  const dim = D(base.dim.L + factor.dim.L, base.dim.M + factor.dim.M, base.dim.T + factor.dim.T); const u = unidadSalida(dim);
  if (!u.unit) throw new OpError('DIMENSION_INCOMPATIBLE', `El producto resulta ${u.dimension}: no es una longitud, área ni volumen.`);
  return { outputs: { cantidad: base.v * factor.v }, units: { cantidad: u }, warnings: [] };
});

defineOp({
  id: 'qty.apply_loss', version: '1.0.0', title: 'Cantidad con pérdida/merma DECLARADA por la usuaria', disciplines: ['cubicaciones'],
  inputs: [{ name: 'cantidad', dimension: 'any', unit_in: null, shape: 'scalar', required: true }, { name: 'perdida_pct', dimension: null, unit_in: null, shape: 'scalar', required: true }],
  outputs: [{ name: 'cantidad_con_perdida', dimension: null, unit_out: null }],
  applicability: { assumptions: ['el porcentaje de pérdida lo declara la usuaria (no hay valor por defecto)'], validity: ['0 ≤ pérdida ≤ 100 %'], error_bound: 'exacto' }, formula: 'Q·(1 + p/100)', tolerance: { relative: 1e-12, oracle: ['aritmética'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['INVALID_INPUT'],
}, ({ cantidad, perdida_pct }) => { const p = perdida_pct * 100; /* adimensional: llega como fracción si la unidad es % */ if (!(perdida_pct >= 0 && perdida_pct <= 1)) throw new OpError('INVALID_INPUT', 'La pérdida debe estar entre 0 y 100 % (indíquela con unidad "%").'); return { outputs: { cantidad_con_perdida: cantidad.v * (1 + perdida_pct) }, units: { cantidad_con_perdida: unidadSalida(cantidad.dim) }, warnings: p === 0 ? [] : [] }; });

defineOp({
  id: 'bud.rollup', version: '1.0.0', title: 'Presupuesto a partir de partidas con cantidad (claim) y precio unitario aportado (CLP)', disciplines: ['presupuestos'],
  inputs: [{ name: 'items', dimension: null, unit_in: null, shape: 'object', required: true }, { name: 'gastos_generales_pct', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'utilidades_pct', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'iva_pct', dimension: null, unit_in: null, shape: 'scalar', required: true }],
  outputs: [{ name: 'subtotales', dimension: null, unit_out: 'CLP' }, { name: 'costo_directo', dimension: null, unit_out: 'CLP' }, { name: 'gastos_generales', dimension: null, unit_out: 'CLP' }, { name: 'utilidades', dimension: null, unit_out: 'CLP' }, { name: 'neto', dimension: null, unit_out: 'CLP' }, { name: 'iva', dimension: null, unit_out: 'CLP' }, { name: 'total', dimension: null, unit_out: 'CLP' }],
  applicability: { assumptions: ['cada ítem: {codigo, descripcion, unidad, cantidad:{value,unit}, precio_unitario (CLP por unidad de la partida), fuente_precio, fecha_precio}', 'los precios, su fuente y fecha los aporta la usuaria: NO se inventan', 'GG, utilidades e IVA aportados explícitamente (sin valores por defecto)', 'redondeo: precio unitario, cada subtotal y cada rubro a pesos enteros (mitad se aleja de cero), igual que el XLSX y budget/calc'], validity: ['unidad de la partida = unidad de la cantidad (sin conversión implícita)', 'precios ≥0 con fuente y fecha'], error_bound: 'exacto (aritmética entera); la validez del precio es responsabilidad de la fuente' },
  formula: 'CD=Σ round(cant·round(pu)); GG=round(CD·gg%); U=round(CD·u%); Neto=CD+GG+U; IVA=round(Neto·iva%); Total=Neto+IVA', tolerance: { relative: 0, oracle: ['cálculo manual', 'budget/calc.computeBudget (implementación independiente)'] }, maturity: 'E2', requires_review_by: ['profesional_de_costos'], failure_modes: ['ENTRADA_FALTANTE', 'DIMENSION_INCOMPATIBLE'],
}, ({ items, gastos_generales_pct, utilidades_pct, iva_pct }) => {
  const lista = items; if (!Array.isArray(lista) || !lista.length) throw new OpError('INVALID_INPUT', 'Se requiere al menos una partida.');
  const faltan = lista.filter((i) => i.precio_unitario === null || i.precio_unitario === undefined).map((i) => i.codigo); if (faltan.length) throw new OpError('ENTRADA_FALTANTE', `FALTA PRECIO (no se inventa) en: ${faltan.join(', ')}.`, { partidas: faltan });
  const sinFuente = lista.filter((i) => !i.fuente_precio || !i.fecha_precio).map((i) => i.codigo); if (sinFuente.length) throw new OpError('ENTRADA_FALTANTE', `Precio sin fuente o fecha en: ${sinFuente.join(', ')}.`, { partidas: sinFuente });
  for (const [n, v] of [['gastos_generales_pct', gastos_generales_pct], ['utilidades_pct', utilidades_pct], ['iva_pct', iva_pct]]) if (!(v >= 0 && v <= 1)) throw new OpError('INVALID_INPUT', `${n} debe estar entre 0 y 100 % (use unidad "%").`);
  const subs = lista.map((i) => { const c = i.cantidad; if (!c || typeof c.value !== 'number') throw new OpError('ENTRADA_FALTANTE', `La partida ${i.codigo} no tiene cantidad.`); if (i.unidad && c.unit && i.unidad !== c.unit) throw new OpError('DIMENSION_INCOMPATIBLE', `Partida ${i.codigo}: la unidad de la partida (${i.unidad}) no coincide con la de la cantidad (${c.unit}); no se convierte implícitamente.`); if (!(i.precio_unitario >= 0)) throw new OpError('INVALID_INPUT', `Partida ${i.codigo}: precio inválido.`); return subtotalPartida(c.value, i.precio_unitario); });
  // Misma política que budget/calc y el XLSX (hallazgo B): porcentajes a escala 0–100 sin ruido binario.
  const p100 = (f) => Math.round(f * 100 * 1e9) / 1e9;
  const cd = subs.reduce((a, b) => a + b, 0); const R = rubros(cd, { gastos_generales_pct: p100(gastos_generales_pct), utilidades_pct: p100(utilidades_pct), iva_pct: p100(iva_pct) });
  return { outputs: { subtotales: subs, costo_directo: cd, gastos_generales: R.gastos_generales, utilidades: R.utilidades, neto: R.neto, iva: R.iva, total: R.total }, warnings: ['Los precios son datos aportados; este cálculo no los valida.', POLITICA_REDONDEO] };
});

defineOp({
  id: 'sched.duration', version: '1.0.0', title: 'Duración de una actividad = cantidad / (rendimiento × cuadrillas)', disciplines: ['planificacion'],
  inputs: [{ name: 'cantidad', dimension: 'any', unit_in: null, shape: 'scalar', required: true }, { name: 'rendimiento_diario', dimension: 'any', unit_in: null, shape: 'scalar', required: true }, { name: 'cuadrillas', dimension: null, unit_in: null, shape: 'scalar', required: true }],
  outputs: [{ name: 'duracion', dimension: 'T', unit_out: 'd' }, { name: 'duracion_dias_enteros', dimension: 'T', unit_out: 'd' }],
  applicability: { assumptions: ['el rendimiento DIARIO (misma unidad que la cantidad) y el nº de cuadrillas los aporta la usuaria', 'productividad constante'], validity: ['rendimiento>0; cuadrillas>0; misma dimensión'], error_bound: 'exacto; la realidad depende del rendimiento declarado' }, formula: 'd = Q / (r·n); d_ent = ceil(d)', tolerance: { relative: 1e-12, oracle: ['aritmética'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['DIMENSION_INCOMPATIBLE', 'INVALID_INPUT'],
}, ({ cantidad, rendimiento_diario: r, cuadrillas }) => {
  if (!dimEq(cantidad.dim, r.dim)) throw new OpError('DIMENSION_INCOMPATIBLE', `La cantidad (${dimTxt(cantidad.dim)}) y el rendimiento (${dimTxt(r.dim)}) deben tener la misma dimensión.`);
  if (!(r.v > 0) || !(cuadrillas > 0) || cantidad.v < 0) throw new OpError('INVALID_INPUT', 'rendimiento y cuadrillas deben ser positivos y la cantidad no negativa.');
  const d = cantidad.v / (r.v * cuadrillas); return { outputs: { duracion: d, duracion_dias_enteros: Math.ceil(d - 1e-12) }, warnings: [] };
});

defineOp({
  id: 'sched.cpm', version: '1.0.0', title: 'Ruta crítica (CPM) con precedencias fin-a-inicio', disciplines: ['planificacion'],
  inputs: [{ name: 'actividades', dimension: null, unit_in: null, shape: 'object', required: true }],
  outputs: [{ name: 'duracion_proyecto', dimension: 'T', unit_out: 'd' }, { name: 'es', dimension: 'T', unit_out: 'd' }, { name: 'ef', dimension: 'T', unit_out: 'd' }, { name: 'ls', dimension: 'T', unit_out: 'd' }, { name: 'lf', dimension: 'T', unit_out: 'd' }, { name: 'holgura_total', dimension: 'T', unit_out: 'd' }, { name: 'ruta_critica', dimension: null, unit_out: null }],
  applicability: { assumptions: ['actividades [{id, duracion (días), predecesoras:[ids]}] con duraciones APORTADAS', 'solo relaciones fin-a-inicio sin desfases; recursos ilimitados'], validity: ['ids únicos; sin ciclos; predecesoras existentes; duraciones ≥0'], error_bound: 'exacto para el modelo; no considera calendarios ni restricciones de recursos' },
  formula: 'ES=max(EF pred); EF=ES+d; LF=min(LS suc); LS=LF−d; holgura=LS−ES; crítica si holgura=0', tolerance: { relative: 1e-12, oracle: ['red de libro con solución cerrada', 'enumeración de caminos'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['CYCLE', 'INVALID_INPUT'],
}, ({ actividades }) => {
  const A = actividades; if (!Array.isArray(A) || !A.length) throw new OpError('INVALID_INPUT', 'Se requiere al menos una actividad.');
  const ids = A.map((a) => a.id); if (new Set(ids).size !== ids.length) throw new OpError('INVALID_INPUT', 'Hay ids de actividad duplicados.');
  const idx = new Map(ids.map((id, i) => [id, i])); const dur = A.map((a) => { if (!(typeof a.duracion === 'number' && a.duracion >= 0)) throw new OpError('INVALID_INPUT', `Actividad ${a.id}: duración inválida.`); return a.duracion; });
  const preds = A.map((a) => (a.predecesoras || []).map((p) => { if (!idx.has(p)) throw new OpError('INVALID_INPUT', `Actividad ${a.id}: predecesora inexistente "${p}".`); return idx.get(p); }));
  const orden = []; const estado = new Array(A.length).fill(0); const visita = (i) => { if (estado[i] === 2) return; if (estado[i] === 1) throw new OpError('CYCLE', 'La red contiene un ciclo de precedencias.'); estado[i] = 1; preds[i].forEach(visita); estado[i] = 2; orden.push(i); }; A.forEach((_, i) => visita(i));
  const es = new Array(A.length).fill(0); const ef = new Array(A.length).fill(0); for (const i of orden) { es[i] = preds[i].length ? Math.max(...preds[i].map((p) => ef[p])) : 0; ef[i] = es[i] + dur[i]; }
  const T = Math.max(...ef); const suc = A.map(() => []); preds.forEach((ps, i) => ps.forEach((p) => suc[p].push(i))); const lf = new Array(A.length).fill(T); const ls = new Array(A.length).fill(0);
  for (const i of [...orden].reverse()) { lf[i] = suc[i].length ? Math.min(...suc[i].map((s) => ls[s])) : T; ls[i] = lf[i] - dur[i]; }
  const h = es.map((_, i) => ls[i] - es[i]); const crit = ids.filter((_, i) => Math.abs(h[i]) < 1e-9);
  return { outputs: { duracion_proyecto: T, es, ef, ls, lf, holgura_total: h, ruta_critica: crit.join(' > ') }, warnings: ['Con varias rutas críticas la cadena indicada lista todas las actividades críticas en orden de entrada.'] };
});

defineOp({
  id: 'sched.scurve', version: '1.0.0', title: 'Curva S: costo acumulado planificado por periodo (distribución uniforme dentro de cada actividad)', disciplines: ['planificacion', 'presupuestos'],
  inputs: [{ name: 'actividades', dimension: null, unit_in: null, shape: 'object', required: true }, { name: 'periodo', dimension: 'T', unit_in: 'd', shape: 'scalar', required: true }],
  outputs: [{ name: 'tiempos', dimension: 'T', unit_out: 'd' }, { name: 'acumulado', dimension: null, unit_out: 'CLP' }, { name: 'acumulado_pct', dimension: null, unit_out: '%' }, { name: 'costo_total', dimension: null, unit_out: 'CLP' }],
  applicability: { assumptions: ['actividades [{inicio (d), duracion (d), costo}] con costo APORTADO', 'costo distribuido de forma lineal entre inicio y fin'], validity: ['duraciones>0, costos≥0, periodo>0'], error_bound: 'exacto para la distribución lineal' }, formula: 'C(t)=Σ costo·clamp((t−inicio)/duración,0,1)', tolerance: { relative: 1e-12, oracle: ['suma manual', 'costo_total = Σ costos'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['INVALID_INPUT'],
}, ({ actividades, periodo }) => {
  const A = actividades; if (!Array.isArray(A) || !A.length) throw new OpError('INVALID_INPUT', 'Se requiere al menos una actividad.'); if (!(periodo > 0)) throw new OpError('INVALID_INPUT', 'El periodo debe ser positivo.');
  for (const a of A) if (!(a.duracion > 0) || !(a.costo >= 0) || !(a.inicio >= 0)) throw new OpError('INVALID_INPUT', `Actividad ${a.id}: inicio ≥0, duración >0 y costo ≥0.`);
  const fin = Math.max(...A.map((a) => a.inicio + a.duracion)); const total = A.reduce((s, a) => s + a.costo, 0); const t = []; const c = []; const pct = [];
  for (let x = 0; x < fin + periodo - 1e-9; x += periodo) { const tt = Math.min(x, fin); t.push(tt); const v = A.reduce((s, a) => s + a.costo * Math.min(1, Math.max(0, (tt - a.inicio) / a.duracion)), 0); c.push(v); pct.push(total ? (v / total) * 100 : 0); if (tt >= fin) break; }
  return { outputs: { tiempos: t, acumulado: c, acumulado_pct: pct, costo_total: total }, warnings: [] };
});

defineOp({
  id: 'sched.evm', version: '1.0.0', title: 'Valor ganado: CPI, SPI, variaciones y proyección', disciplines: ['planificacion', 'control_de_proyectos'],
  inputs: [{ name: 'bac', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'pv', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'ev', dimension: null, unit_in: null, shape: 'scalar', required: true }, { name: 'ac', dimension: null, unit_in: null, shape: 'scalar', required: true }],
  outputs: [{ name: 'cpi', dimension: null, unit_out: '1' }, { name: 'spi', dimension: null, unit_out: '1' }, { name: 'cv', dimension: null, unit_out: 'CLP' }, { name: 'sv', dimension: null, unit_out: 'CLP' }, { name: 'eac', dimension: null, unit_out: 'CLP' }, { name: 'etc', dimension: null, unit_out: 'CLP' }, { name: 'vac', dimension: null, unit_out: 'CLP' }],
  applicability: { assumptions: ['BAC, PV, EV y AC aportados con la misma moneda', 'EAC = BAC/CPI (tendencia de desempeño actual)'], validity: ['BAC>0; PV, EV, AC ≥0; AC>0 para CPI y PV>0 para SPI'], error_bound: 'exacto; EAC es una proyección bajo la hipótesis declarada' }, formula: 'CPI=EV/AC; SPI=EV/PV; CV=EV−AC; SV=EV−PV; EAC=BAC/CPI; ETC=EAC−AC; VAC=BAC−EAC', tolerance: { relative: 1e-12, oracle: ['caso de libro PMBOK-estilo con solución cerrada'] }, maturity: 'E2', requires_review_by: [], failure_modes: ['INVALID_INPUT'],
}, ({ bac, pv, ev, ac }) => {
  if (!(bac > 0) || pv < 0 || ev < 0 || ac < 0) throw new OpError('INVALID_INPUT', 'BAC>0 y PV, EV, AC ≥ 0.'); if (!(ac > 0) || !(pv > 0)) throw new OpError('INVALID_INPUT', 'Se requiere AC>0 y PV>0 para calcular CPI y SPI.');
  const cpi = ev / ac; if (!(cpi > 0)) throw new OpError('INVALID_INPUT', 'CPI=0: el EAC no está definido.'); const eac = bac / cpi; return { outputs: { cpi, spi: ev / pv, cv: ev - ac, sv: ev - pv, eac, etc: eac - ac, vac: bac - eac }, warnings: [] };
});
