// Infraestructura lineal: alineamiento horizontal (rectas y arcos), progresivas, perfil longitudinal (PIV con curvas verticales parabólicas),
// secciones tipo y TIN. Núcleo puro (sin E/S). Convención: ángulos matemáticos (0 = +X, antihorario), progresivas en metros.
import { GeoError, propiedades } from './geom.js';

export class Alineamiento {
  /** tramos: [{type:'straight',length}|{type:'arc',radius,angle_deg,turn:'left'|'right'}]. inicio: {x,y,azimut_deg (0=+X, antihorario), progresiva} */
  constructor(tramos, { x = 0, y = 0, azimut_deg = 0, progresiva = 0 } = {}) {
    if (!Array.isArray(tramos) || !tramos.length) throw new GeoError('INVALID_INPUT', 'La alineación necesita al menos un tramo.');
    this.tramos = []; let px = x; let py = y; let h = (azimut_deg * Math.PI) / 180; let s = progresiva;
    tramos.forEach((t, i) => {
      if (t.type === 'straight') { const L = t.length; if (!(L > 0)) throw new GeoError('INVALID_INPUT', `Tramo ${i}: longitud no positiva.`); const x1 = px + L * Math.cos(h); const y1 = py + L * Math.sin(h); this.tramos.push({ type: 'straight', s0: s, s1: s + L, x0: px, y0: py, x1, y1, h0: h, h1: h, L }); px = x1; py = y1; s += L; }
      else if (t.type === 'arc') {
        const R = t.radius; const th = (t.angle_deg * Math.PI) / 180; const k = t.turn === 'left' ? 1 : t.turn === 'right' ? -1 : 0; if (!(R > 0) || !(th > 0) || !k) throw new GeoError('INVALID_INPUT', `Tramo ${i}: arco con radio/ángulo positivos y turn left|right.`);
        const cx = px - k * R * Math.sin(h); const cy = py + k * R * Math.cos(h); const h1 = h + k * th; const x1 = cx + k * R * Math.sin(h1); const y1 = cy - k * R * Math.cos(h1); const L = R * th;
        this.tramos.push({ type: 'arc', s0: s, s1: s + L, x0: px, y0: py, x1, y1, h0: h, h1, L, R, k, cx, cy, th }); px = x1; py = y1; h = h1; s += L;
      } else throw new GeoError('INVALID_INPUT', `Tramo ${i}: tipo "${t.type}" no soportado.`);
    });
    this.s0 = progresiva; this.s1 = s; this.largo = s - progresiva;
  }
  /** Posición y rumbo en la progresiva s. */
  punto(s) {
    if (s < this.s0 - 1e-9 || s > this.s1 + 1e-9) throw new GeoError('OUT_OF_RANGE', `Progresiva ${s} fuera de la alineación [${this.s0}, ${this.s1}].`);
    const t = this.tramos.find((q) => s <= q.s1 + 1e-9) || this.tramos.at(-1); const d = Math.min(Math.max(s - t.s0, 0), t.L);
    if (t.type === 'straight') return { x: t.x0 + d * Math.cos(t.h0), y: t.y0 + d * Math.sin(t.h0), heading: t.h0, tramo: t };
    const h = t.h0 + t.k * (d / t.R); return { x: t.cx + t.k * t.R * Math.sin(h), y: t.cy - t.k * t.R * Math.cos(h), heading: h, tramo: t };
  }
  /** Progresivas cada `paso` m (incluye inicio y fin). */
  estaciones(paso) { if (!(paso > 0)) throw new GeoError('INVALID_INPUT', 'El paso debe ser positivo.'); const out = []; for (let s = this.s0; s < this.s1 - 1e-9; s += paso) out.push(s); out.push(this.s1); return out; }
}
export const formatoProgresiva = (s) => { const k = Math.floor(s / 1000 + 1e-12); const m = s - k * 1000; return `${k}+${m.toFixed(2).padStart(6, '0')}`; };

export class Perfil {
  /** pivs: [{s, z, curva?}] con `curva` = longitud de la curva vertical centrada en el PIV (0/omitida = quiebre sin curva). */
  constructor(pivs) {
    if (!Array.isArray(pivs) || pivs.length < 2) throw new GeoError('INVALID_INPUT', 'El perfil necesita al menos 2 PIV.');
    for (let i = 1; i < pivs.length; i++) if (!(pivs[i].s > pivs[i - 1].s)) throw new GeoError('NOT_MONOTONIC', 'Las progresivas de los PIV deben ser estrictamente crecientes.');
    this.p = pivs.map((q) => ({ s: q.s, z: q.z, L: q.curva || 0 })); this.g = []; for (let i = 0; i < this.p.length - 1; i++) this.g.push((this.p[i + 1].z - this.p[i].z) / (this.p[i + 1].s - this.p[i].s));
    for (let i = 1; i < this.p.length - 1; i++) { const L = this.p[i].L; if (L > 0) { const a = this.p[i].s - L / 2; const b = this.p[i].s + L / 2; if (a < this.p[i - 1].s + (this.p[i - 1].L || 0) / 2 - 1e-9 || b > this.p[i + 1].s - (this.p[i + 1].L || 0) / 2 + 1e-9) throw new GeoError('INVALID_INPUT', `La curva vertical del PIV ${i} se solapa con sus vecinas o excede los tramos.`); } }
    this.s0 = this.p[0].s; this.s1 = this.p.at(-1).s;
  }
  cota(s) {
    if (s < this.s0 - 1e-9 || s > this.s1 + 1e-9) throw new GeoError('OUT_OF_RANGE', `Progresiva ${s} fuera del perfil.`);
    for (let i = 1; i < this.p.length - 1; i++) { const q = this.p[i]; if (q.L > 0) { const a = q.s - q.L / 2; if (s >= a && s <= q.s + q.L / 2) { const g1 = this.g[i - 1]; const g2 = this.g[i]; const x = s - a; const z0 = q.z - g1 * (q.L / 2); return z0 + g1 * x + ((g2 - g1) * x * x) / (2 * q.L); } } }
    let i = this.p.findIndex((q, j) => j < this.p.length - 1 && s <= this.p[j + 1].s + 1e-12); if (i < 0) i = this.p.length - 2; return this.p[i].z + this.g[i] * (s - this.p[i].s);
  }
  pendiente(s) { const h = 1e-4; const a = Math.max(this.s0, s - h); const b = Math.min(this.s1, s + h); return (this.cota(b) - this.cota(a)) / (b - a); }
}

/** Secciones tipo. Todas devuelven un polígono con bulge en coordenadas locales (x lateral izquierda+, y vertical desde la solera). */
export function seccionArco({ luz, altura_hastial, flecha }) {
  if (!(luz > 0) || altura_hastial < 0 || !(flecha > 0)) throw new GeoError('INVALID_INPUT', 'luz y flecha positivas; altura de hastial no negativa.');
  if (flecha > luz / 2 * (1 + 1e-12)) throw new GeoError('OUT_OF_RANGE', 'La flecha excede luz/2 (más que semicircular).');
  const r = (luz * luz / 4 + flecha * flecha) / (2 * flecha); const th = flecha >= luz / 2 ? Math.PI : 2 * Math.asin(Math.min(1, luz / (2 * r))); const bulge = Math.tan(th / 4); const b = luz / 2; const h = altura_hastial;
  return [[-b, 0], [b, 0], [b, h, bulge], [-b, h]];
}
export const seccionRectangular = (ancho, alto) => { if (!(ancho > 0 && alto > 0)) throw new GeoError('INVALID_INPUT', 'ancho y alto positivos.'); return [[-ancho / 2, 0], [ancho / 2, 0], [ancho / 2, alto], [-ancho / 2, alto]]; };
export const seccionTrapecio = (base, talud_h_por_v, altura) => { if (!(base > 0 && talud_h_por_v >= 0 && altura > 0)) throw new GeoError('INVALID_INPUT', 'base y altura positivas; talud ≥ 0.'); const t = talud_h_por_v * altura; return [[-base / 2, 0], [base / 2, 0], [base / 2 + t, altura], [-base / 2 - t, altura]]; };
export const areaSeccion = (poly) => propiedades(poly).area;

/** TIN por Bowyer–Watson (O(n²), para ≤ ~2000 puntos). Puntos [x,y,z]. */
export function triangular(pts) {
  const n = pts.length; if (n < 3) throw new GeoError('INVALID_INPUT', 'Se requieren al menos 3 puntos.');
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); const minx = Math.min(...xs); const maxx = Math.max(...xs); const miny = Math.min(...ys); const maxy = Math.max(...ys); const d = Math.max(maxx - minx, maxy - miny) || 1; const mx = (minx + maxx) / 2; const my = (miny + maxy) / 2;
  const P = [...pts.map((p) => [p[0], p[1]]), [mx - 20 * d, my - d], [mx, my + 20 * d], [mx + 20 * d, my - d]];
  const circ = (a, b, c) => { const A = P[a]; const B = P[b]; const C = P[c]; const D = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])); if (Math.abs(D) < 1e-18) return null; const ux = ((A[0] ** 2 + A[1] ** 2) * (B[1] - C[1]) + (B[0] ** 2 + B[1] ** 2) * (C[1] - A[1]) + (C[0] ** 2 + C[1] ** 2) * (A[1] - B[1])) / D; const uy = ((A[0] ** 2 + A[1] ** 2) * (C[0] - B[0]) + (B[0] ** 2 + B[1] ** 2) * (A[0] - C[0]) + (C[0] ** 2 + C[1] ** 2) * (B[0] - A[0])) / D; return { x: ux, y: uy, r2: (A[0] - ux) ** 2 + (A[1] - uy) ** 2 }; };
  let tris = [{ v: [n, n + 1, n + 2], c: circ(n, n + 1, n + 2) }];
  for (let i = 0; i < n; i++) {
    const bad = tris.filter((t) => t.c && (P[i][0] - t.c.x) ** 2 + (P[i][1] - t.c.y) ** 2 < t.c.r2 * (1 - 1e-12)); const edges = new Map();
    for (const t of bad) for (let k = 0; k < 3; k++) { const a = t.v[k]; const b = t.v[(k + 1) % 3]; const key = a < b ? `${a}-${b}` : `${b}-${a}`; edges.set(key, (edges.get(key) || 0) + 1); }
    tris = tris.filter((t) => !bad.includes(t));
    for (const t of bad) for (let k = 0; k < 3; k++) { const a = t.v[k]; const b = t.v[(k + 1) % 3]; const key = a < b ? `${a}-${b}` : `${b}-${a}`; if (edges.get(key) === 1) { const c = circ(a, b, i); if (c) tris.push({ v: [a, b, i], c }); } }
  }
  const out = tris.filter((t) => t.v.every((v) => v < n)).map((t) => t.v); if (!out.length) throw new GeoError('INVALID_INPUT', 'Los puntos son colineales o duplicados: no se pudo triangular.');
  return { puntos: pts, triangulos: out };
}
export class TIN {
  constructor(pts) { const t = triangular(pts); this.p = t.puntos; this.t = t.triangulos; }
  /** Cota en (x,y) por interpolación baricéntrica; null fuera de la envolvente. */
  z(x, y) { for (const [a, b, c] of this.t) { const A = this.p[a]; const B = this.p[b]; const C = this.p[c]; const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(d) < 1e-18) continue; const l1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / d; const l2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / d; const l3 = 1 - l1 - l2; const e = -1e-12; if (l1 >= e && l2 >= e && l3 >= e) return l1 * A[2] + l2 * B[2] + l3 * C[2]; } return null; }
  /** Volumen entre la superficie y un plano horizontal z0: integral EXACTA de max(h,0) (sobre) y max(−h,0) (bajo) por triángulo lineal. */
  volumenSobrePlano(z0) {
    const pp = (ar, h) => { const s = [...h].sort((a, b) => b - a); if (s[2] >= 0) return (ar * (s[0] + s[1] + s[2])) / 3; if (s[0] <= 0) return 0; if (s[1] <= 0) return (ar * s[0] ** 3) / (3 * (s[0] - s[1]) * (s[0] - s[2])); return (ar * (s[0] + s[1] + s[2])) / 3 + (ar * (-s[2]) ** 3) / (3 * (s[0] - s[2]) * (s[1] - s[2])); };
    let sobre = 0; let bajo = 0; let area = 0;
    for (const [a, b, c] of this.t) { const A = this.p[a]; const B = this.p[b]; const C = this.p[c]; const ar = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2; area += ar; const h = [A[2] - z0, B[2] - z0, C[2] - z0]; sobre += pp(ar, h); bajo += pp(ar, h.map((x) => -x)); }
    return { sobre, bajo, neto: sobre - bajo, area_planta: area };
  }
}
