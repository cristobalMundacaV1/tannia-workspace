// Regiones cerradas y tramas vectoriales (PR #38, C3). Una región es REPRESENTACIÓN: nunca genera cantidades (measurable:false).
// Contornos como lista de vértices [x, y, bulge?] (bulge = tan(θ/4) del arco hacia el vértice siguiente, convención DXF),
// en metros del modelo. La misma definición alimenta el PDF (clip + líneas de trama) y el DXF (HATCH con contorno de polilínea).
import { UserError } from '../mcp/util.js';
import { TRAMAS } from './catalog.js';

const err = (code, msg) => new UserError(code, msg);

/** Puntos de un contorno con los arcos (bulge) muestreados a ≤ `pasoGrados`. */
export function densificar(loop, pasoGrados = 2) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]; const b = loop[(i + 1) % loop.length]; const bulge = a[2] || 0; out.push([a[0], a[1]]);
    if (Math.abs(bulge) < 1e-12) continue;
    const theta = 4 * Math.atan(bulge); const chord = Math.hypot(b[0] - a[0], b[1] - a[1]); const r = chord * (1 + bulge * bulge) / (4 * Math.abs(bulge));
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const off = (chord / 2) * ((1 - bulge * bulge) / (2 * bulge));
    const nrm = [-(b[1] - a[1]) / chord, (b[0] - a[0]) / chord]; const c = [mid[0] + nrm[0] * off, mid[1] + nrm[1] * off];
    const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]); const n = Math.max(2, Math.ceil(Math.abs(theta) * 180 / Math.PI / pasoGrados));
    for (let k = 1; k < n; k++) { const t = a0 + theta * k / n; out.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); }
  }
  return out;
}
/** Área firmada EXACTA de un contorno con arcos (polígono de vértices + segmentos circulares de cada bulge). */
export function areaExacta(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]; const q = loop[(i + 1) % loop.length]; a += (p[0] * q[1] - q[0] * p[1]) / 2; const b = p[2] || 0;
    if (Math.abs(b) > 1e-12) { const th = 4 * Math.atan(b); const c = Math.hypot(q[0] - p[0], q[1] - p[1]); const r = c / (2 * Math.sin(Math.abs(th) / 2)); a += Math.sign(th) * (r * r * (Math.abs(th) - Math.sin(Math.abs(th)))) / 2; }
  }
  return a;
}
export const areaFirmada = (ps) => ps.reduce((s, p, i) => { const q = ps[(i + 1) % ps.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function segCruza(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a); const d2 = o(c, d, b); const d3 = o(a, b, c); const d4 = o(a, b, d);
  return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12));
}
function autointerseca(ps) {
  const n = ps.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segCruza(ps[i], ps[(i + 1) % n], ps[j], ps[(j + 1) % n])) return true; }
  return false;
}
export function puntoDentro(p, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]; const b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro; }
  return dentro;
}

/**
 * Valida una región (PL-HATCH-01) ANTES de escribir nada: contorno cerrado (≥3 vértices, área > 0), sin autointersección,
 * huecos dentro del contorno y sin cruzarlo ni cruzarse entre sí, trama del catálogo y material con origen si la trama lo exige.
 * Devuelve la región normalizada con su área geométrica (solo control; NO es una cantidad).
 */
export function validarRegion(r) {
  const ctx = `Región ${r?.id ?? '?'}`;
  if (!r || typeof r.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/.test(r.id)) throw err('REGION_INVALIDA', `${ctx}: identificador inválido.`);
  const trama = TRAMAS[r.trama]; if (!trama) throw err('TRAMA_INEXISTENTE', `${ctx}: la trama «${r.trama}» no existe en el catálogo.`);
  if (trama.material_requerido && (!r.material || typeof r.material.nombre !== 'string' || !r.material.origen)) throw err('MATERIAL_SIN_ORIGEN', `${ctx}: la trama ${r.trama} representa un material; declare material.nombre y material.origen (no se infiere).`);
  const loops = [r.contorno, ...(r.huecos || [])];
  const polys = loops.map((l, k) => {
    if (!Array.isArray(l) || l.length < 3 || !l.every((p) => Array.isArray(p) && p.length >= 2 && p.slice(0, 3).every((x) => x === undefined || Number.isFinite(x)))) throw err('REGION_ABIERTA', `${ctx}: ${k ? `hueco ${k}` : 'contorno'} con menos de 3 vértices o coordenadas inválidas.`);
    const ps = densificar(l);
    if (autointerseca(ps)) throw err('REGION_AUTOINTERSECTA', `${ctx}: ${k ? `hueco ${k}` : 'contorno'} se autointersecta.`);
    if (!(Math.abs(areaExacta(l)) > 1e-10)) throw err('REGION_SIN_AREA', `${ctx}: ${k ? `hueco ${k}` : 'contorno'} no encierra superficie.`);
    return ps;
  });
  const [ext, ...hs] = polys;
  const cruzan = (P, Q) => P.some((a, i) => Q.some((c, j) => segCruza(a, P[(i + 1) % P.length], c, Q[(j + 1) % Q.length])));
  hs.forEach((h, k) => {
    if (cruzan(h, ext) || !h.every((p) => puntoDentro(p, ext))) throw err('HUECO_FUERA_DEL_CONTORNO', `${ctx}: el hueco ${k + 1} no está dentro del contorno.`);
    hs.slice(k + 1).forEach((g, m) => { if (cruzan(h, g) || h.some((p) => puntoDentro(p, g)) || g.some((p) => puntoDentro(p, h))) throw err('HUECOS_SUPERPUESTOS', `${ctx}: los huecos ${k + 1} y ${k + m + 2} se superponen.`); });
  });
  const area = Math.abs(areaExacta(r.contorno)) - (r.huecos || []).reduce((s, h) => s + Math.abs(areaExacta(h)), 0);
  return { ...r, measurable: false, area_control_m2: area, poligonos: polys };
}

/**
 * Líneas de trama recortadas a la región (regla par-impar con huecos), en el MISMO sistema que `poligonos` (p. ej. mm de papel).
 * Fase anclada al origen del sistema: la misma región produce las mismas líneas en cualquier exportación.
 */
export function lineasTrama(poligonos, familias) {
  const out = []; const all = poligonos.flatMap((p) => p);
  for (const { angulo, paso } of familias) {
    const t = (angulo * Math.PI) / 180; const u = [Math.cos(t), Math.sin(t)]; const n = [-u[1], u[0]];
    const proy = all.map((p) => p[0] * n[0] + p[1] * n[1]); const lo = Math.ceil(Math.min(...proy) / paso); const hi = Math.floor(Math.max(...proy) / paso);
    for (let k = lo; k <= hi; k++) {
      const c = k * paso; const cortes = [];
      for (const poly of poligonos) for (let i = 0; i < poly.length; i++) {
        const a = poly[i]; const b = poly[(i + 1) % poly.length]; const da = a[0] * n[0] + a[1] * n[1] - c; const db = b[0] * n[0] + b[1] * n[1] - c;
        if ((da > 0) === (db > 0) || da === db) continue; const s = da / (da - db); const p = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]; cortes.push(p[0] * u[0] + p[1] * u[1]);
      }
      cortes.sort((x, y) => x - y);
      for (let i = 0; i + 1 < cortes.length; i += 2) { if (cortes[i + 1] - cortes[i] < 1e-9) continue; const base = [n[0] * c, n[1] * c]; out.push([[base[0] + u[0] * cortes[i], base[1] + u[1] * cortes[i]], [base[0] + u[0] * cortes[i + 1], base[1] + u[1] * cortes[i + 1]]]); }
    }
  }
  return out;
}
