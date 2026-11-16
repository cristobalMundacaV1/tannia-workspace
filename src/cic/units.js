// Motor dimensional: magnitudes con dimensión explícita [L, M, T] (exponentes enteros) y conversión a SI. Unidad desconocida = error, nunca suposición.
export class UnitError extends Error { constructor(code, message) { super(message); this.code = code; } }
export const D = (L = 0, M = 0, T = 0) => ({ L, M, T });
const dimStr = (d) => { const p = []; for (const k of ['L', 'M', 'T']) if (d[k]) p.push(d[k] === 1 ? k : `${k}${d[k]}`); return p.length ? p.join('·') : '1'; };
export const dimKey = dimStr;
const eq = (a, b) => a.L === b.L && a.M === b.M && a.T === b.T;
export const dimEq = eq;
const mul = (a, b) => D(a.L + b.L, a.M + b.M, a.T + b.T);
const pow = (a, n) => D(a.L * n, a.M * n, a.T * n);

// factor = valor en SI por 1 unidad. Ángulo, pendiente y moneda: adimensionales/propios (sin conversión monetaria implícita).
const T = {
  mm: [1e-3, D(1)], cm: [1e-2, D(1)], dm: [0.1, D(1)], m: [1, D(1)], km: [1000, D(1)], in: [0.0254, D(1)], pulgadas: [0.0254, D(1)], ft: [0.3048, D(1)], pies: [0.3048, D(1)],
  mm2: [1e-6, D(2)], cm2: [1e-4, D(2)], m2: [1, D(2)], km2: [1e6, D(2)], ha: [1e4, D(2)], ft2: [0.09290304, D(2)],
  mm3: [1e-9, D(3)], cm3: [1e-6, D(3)], l: [1e-3, D(3)], m3: [1, D(3)], ft3: [0.028316846592, D(3)],
  g: [1e-3, D(0, 1)], kg: [1, D(0, 1)], t: [1000, D(0, 1)],
  s: [1, D(0, 0, 1)], min: [60, D(0, 0, 1)], h: [3600, D(0, 0, 1)], d: [86400, D(0, 0, 1)],
  'm3/m': [1, D(2)], 'm2/m': [1, D(1)],
  'm/s': [1, D(1, 0, -1)], 'km/h': [1 / 3.6, D(1, 0, -1)], 'm3/s': [1, D(3, 0, -1)], 'l/s': [1e-3, D(3, 0, -1)],
  rad: [1, D()], deg: [Math.PI / 180, D()], '°': [Math.PI / 180, D()], grad: [Math.PI / 200, D()],
  CLP: [1, D()], UF: [1, D()], USD: [1, D()], 'CLP/m3': [1, D(-3)], 'CLP/m2': [1, D(-2)], 'CLP/m': [1, D(-1)],
  '1': [1, D()], adim: [1, D()], '%': [0.01, D()], '‰': [0.001, D()],
};
const ALIAS = { 'm²': 'm2', 'm³': 'm3', 'mm²': 'mm2', 'cm²': 'cm2', 'mm³': 'mm3', 'cm³': 'cm3', 'km²': 'km2', 'ft²': 'ft2', 'ft³': 'ft3', metros: 'm', metro: 'm', 'm3_por_m': 'm3/m', lt: 'l', litro: 'l', litros: 'l', grados: 'deg', 'ton': 't' };
export const unidadesConocidas = () => [...Object.keys(T), ...Object.keys(ALIAS)];

export function unidad(u) {
  const k = ALIAS[String(u).trim()] || String(u).trim();
  const e = T[k];
  if (!e) throw new UnitError('UNIDAD_DESCONOCIDA', `Unidad desconocida: "${u}". No se supone ninguna: indique una unidad de la tabla (${Object.keys(T).slice(0, 12).join(', ')}…).`);
  return { nombre: k, factor: e[0], dim: e[1] };
}
/** Magnitud: { valor (en SI), dim, unidad_origen }. */
export function mag(valor, u) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new UnitError('VALOR_INVALIDO', 'El valor debe ser un número finito.');
  const e = unidad(u); return { valor: valor * e.factor, dim: e.dim, unidad: e.nombre };
}
export function aUnidad(m, u) { const e = unidad(u); if (!eq(m.dim, e.dim)) throw new UnitError('DIMENSION_INCOMPATIBLE', `No se puede expresar ${dimStr(m.dim)} en "${u}" (${dimStr(e.dim)}).`); return m.valor / e.factor; }
export const sumar = (a, b) => { if (!eq(a.dim, b.dim)) throw new UnitError('DIMENSION_INCOMPATIBLE', `No se pueden sumar ${dimStr(a.dim)} con ${dimStr(b.dim)}.`); return { valor: a.valor + b.valor, dim: a.dim, unidad: a.unidad }; };
export const multiplicar = (a, b) => ({ valor: a.valor * b.valor, dim: mul(a.dim, b.dim), unidad: null });
export const potencia = (a, n) => ({ valor: a.valor ** n, dim: pow(a.dim, n), unidad: null });
/** Valida que `valor` en unidad `u` tenga la dimensión esperada y lo devuelve en la unidad canónica `canon`. */
export function normalizar(valor, u, canon, nombre = 'valor') {
  const m = mag(valor, u); const c = unidad(canon);
  if (!eq(m.dim, c.dim)) throw new UnitError('DIMENSION_INCOMPATIBLE', `"${nombre}" debe ser ${dimStr(c.dim)} (p. ej. ${canon}); se recibió ${valor} ${u} (${dimStr(m.dim)}).`);
  return m.valor / c.factor;
}
export const dimDe = (u) => dimStr(unidad(u).dim);
