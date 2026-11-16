// Núcleo geométrico 2D puro (sin E/S). Polilíneas con bulge (convención DXF: bulge>0 = arco antihorario de P1 a P2, abultado a la DERECHA del avance).
export class GeoError extends Error { constructor(code, message) { super(message); this.code = code; } }
const fin = (x) => typeof x === 'number' && Number.isFinite(x);

/** Un vértice es [x, y, bulge?]. */
export function validarPoligono(v, { minVert = 2, nombre = 'polilínea' } = {}) {
  if (Array.isArray(v) && v.length === 2 && !(v[0][2] || v[1][2])) throw new GeoError('INVALID_INPUT', `${nombre}: con 2 vértices al menos uno debe tener bulge (segmento circular/lente/círculo).`);
  if (!Array.isArray(v) || v.length < minVert) throw new GeoError('INVALID_INPUT', `${nombre}: se requieren al menos ${minVert} vértices.`);
  v.forEach((p, i) => { if (!Array.isArray(p) || p.length < 2 || !fin(p[0]) || !fin(p[1]) || (p[2] !== undefined && !fin(p[2]))) throw new GeoError('INVALID_INPUT', `${nombre}: vértice ${i} inválido ([x, y, bulge?]).`); });
}
const sgn = (x) => (x < 0 ? -1 : 1);
/** Geometría del arco entre p (con bulge b) y q. */
export function arco(p, q, b) {
  const dx = q[0] - p[0]; const dy = q[1] - p[1]; const c = Math.hypot(dx, dy);
  if (c === 0) throw new GeoError('INVALID_INPUT', 'Arco con extremos coincidentes.');
  const th = 4 * Math.atan(b);                       // ángulo central con signo
  const r = c / (2 * Math.abs(Math.sin(th / 2)));
  const nx = dy / c; const ny = -dx / c;             // normal derecha
  const s = b * c / 2;                               // flecha con signo
  const mx = (p[0] + q[0]) / 2; const my = (p[1] + q[1]) / 2;
  const cx = mx + nx * (s - sgn(b) * r); const cy = my + ny * (s - sgn(b) * r);
  return { theta: th, r, centro: [cx, cy], longitud: r * Math.abs(th), medio: [mx + nx * s, my + ny * s], cuerda: c };
}
/** Área con signo, perímetro y centroide de una polilínea cerrada con arcos. */
export function propiedades(v) {
  validarPoligono(v); const n = v.length;
  let A2 = 0; let cxA = 0; let cyA = 0; let per = 0;
  for (let i = 0; i < n; i++) {
    const p = v[i]; const q = v[(i + 1) % n]; const cr = p[0] * q[1] - q[0] * p[1];
    A2 += cr; cxA += (p[0] + q[0]) * cr; cyA += (p[1] + q[1]) * cr; per += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  let A = A2 / 2; let cx; let cy;
  if (Math.abs(A) < 1e-300) { cx = 0; cy = 0; } else { cx = cxA / (6 * A); cy = cyA / (6 * A); }
  let Atot = A; let mx = cx * A; let my = cy * A;
  for (let i = 0; i < n; i++) {
    const b = v[i][2] || 0; if (!b) continue;
    const p = v[i]; const q = v[(i + 1) % n]; const a = arco(p, q, b);
    const aseg = 0.5 * a.r * a.r * (a.theta - Math.sin(a.theta));          // con signo
    const d = (4 * a.r * Math.sin(Math.abs(a.theta) / 2) ** 3) / (3 * (Math.abs(a.theta) - Math.sin(Math.abs(a.theta))));
    const ux = a.medio[0] - a.centro[0]; const uy = a.medio[1] - a.centro[1]; const ul = Math.hypot(ux, uy);
    const gx = a.centro[0] + (ux / ul) * d; const gy = a.centro[1] + (uy / ul) * d;
    // El centroide del segmento está del lado del arco respecto del centro: (medio - centro) ya apunta hacia él (también si el arco supera 180°).
    Atot += aseg; mx += gx * aseg; my += gy * aseg; per += a.longitud - a.cuerda;
  }
  return { area_signed: Atot, area: Math.abs(Atot), perimetro: per, centroide: Math.abs(Atot) < 1e-300 ? null : [mx / Atot, my / Atot], orientacion: Atot >= 0 ? 'ccw' : 'cw' };
}
export function segmentosIntersectan(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); if (Math.abs(d) < 1e-15) return null;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 1e-12 && t < 1 - 1e-12 && u > 1e-12 && u < 1 - 1e-12 ? [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] : null;
}
/** Auto-intersección de una polilínea cerrada (solo tramos rectos; los arcos se aproximan con `teselar`). */
export function autoIntersecta(v) {
  const n = v.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segmentosIntersectan(v[i], v[(i + 1) % n], v[j], v[(j + 1) % n])) return true; }
  return false;
}
/** Convierte arcos a segmentos rectos (para verificaciones y mallas); `paso_rad` máximo por segmento. */
export function teselar(v, paso = Math.PI / 64) {
  const out = []; const n = v.length;
  for (let i = 0; i < n; i++) {
    const p = v[i]; const q = v[(i + 1) % n]; const b = p[2] || 0; out.push([p[0], p[1]]);
    if (!b) continue; const a = arco(p, q, b); const k = Math.max(2, Math.ceil(Math.abs(a.theta) / paso));
    const a0 = Math.atan2(p[1] - a.centro[1], p[0] - a.centro[0]);
    for (let j = 1; j < k; j++) { const ang = a0 + a.theta * (j / k); out.push([a.centro[0] + a.r * Math.cos(ang), a.centro[1] + a.r * Math.sin(ang)]); }
  }
  return out;
}
export function puntoEnPoligono(pt, poly) {
  let dentro = false; const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = poly[i]; const [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) dentro = !dentro; }
  return dentro;
}
/** Polígono con huecos: área = exterior − huecos (los huecos deben estar dentro del exterior y no solaparse). */
export function poligonoConHuecos(exterior, huecos = []) {
  const e = propiedades(exterior); const te = teselar(exterior); let area = e.area; let mx = e.centroide[0] * e.area; let my = e.centroide[1] * e.area; let perim = e.perimetro;
  const tess = huecos.map((h) => teselar(h));
  huecos.forEach((h, i) => {
    const ph = propiedades(h);
    if (!tess[i].every((p) => puntoEnPoligono(p, te) || false)) throw new GeoError('INVALID_INPUT', `El hueco ${i} no está contenido en el contorno exterior.`);
    tess.forEach((t2, j) => { if (j !== i && t2.some((p) => puntoEnPoligono(p, tess[i]))) throw new GeoError('INVALID_INPUT', `Los huecos ${i} y ${j} se solapan o se anidan.`); });
    area -= ph.area; mx -= ph.centroide[0] * ph.area; my -= ph.centroide[1] * ph.area; perim += ph.perimetro;
  });
  if (area <= 0) throw new GeoError('INVALID_INPUT', 'El área neta es no positiva.');
  return { area, perimetro: perim, centroide: [mx / area, my / area] };
}
/** Volumen de una malla cerrada de triángulos por suma de tetraedros con signo (teorema de la divergencia). */
export function volumenMalla(tris) { let v = 0; for (const [a, b, c] of tris) v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; return v; }
