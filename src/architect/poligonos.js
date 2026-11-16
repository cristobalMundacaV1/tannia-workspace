// Utilidades de polígonos ortogonales (mm). Sin dependencias.
export const areaFirmada = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i]; const [x2, y2] = r[(i + 1) % r.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
export const area = (r) => Math.abs(areaFirmada(r));
export const perimetro = (r) => r.reduce((a, p, i) => a + Math.hypot(r[(i + 1) % r.length][0] - p[0], r[(i + 1) % r.length][1] - p[1]), 0);
export const esOrtogonal = (r) => r.every((p, i) => { const q = r[(i + 1) % r.length]; return p[0] === q[0] || p[1] === q[1]; });
export function enPoligono(x, y, r) { let d = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i]; const [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; }
export function rectDeAnillo(r) {
  if (!Array.isArray(r) || r.length !== 4 || !esOrtogonal(r)) return null;
  const xs = r.map((p) => p[0]); const ys = r.map((p) => p[1]); const R = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  return R.x1 > R.x0 && R.y1 > R.y0 && area(r) === (R.x1 - R.x0) * (R.y1 - R.y0) ? R : null;
}
export const anilloDeRect = (R) => [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]];
const orient = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const sobre = (a, b, c) => Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
export function segmentosSeCruzan(p1, p2, p3, p4) {
  const o1 = orient(p1, p2, p3); const o2 = orient(p1, p2, p4); const o3 = orient(p3, p4, p1); const o4 = orient(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && sobre(p1, p2, p3)) || (o2 === 0 && sobre(p1, p2, p4)) || (o3 === 0 && sobre(p3, p4, p1)) || (o4 === 0 && sobre(p3, p4, p2));
}
/** Un anillo se autointersecta si dos aristas no adyacentes se cruzan o tocan. */
export function autoIntersecta(r) {
  const n = r.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    if (segmentosSeCruzan(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true;
  }
  return false;
}
/** Elimina vértices colineales y repetidos. */
export function simplificar(r) {
  const out = [];
  for (let i = 0; i < r.length; i++) { const a = r[(i + r.length - 1) % r.length]; const b = r[i]; const c = r[(i + 1) % r.length]; if (b[0] === a[0] && b[1] === a[1]) continue; if (orient(a, b, c) === 0) continue; out.push(b); }
  return out;
}
export const centroideBox = (r) => { const xs = r.map((p) => p[0]); const ys = r.map((p) => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
export const bbox = (rings) => { const pts = rings.flat(); const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; };

/**
 * Unión de rectángulos (celdas por compresión de coordenadas) → anillos exteriores y huecos.
 * @returns {{anillos:{ring:number[][], hueco:boolean, area_mm2:number}[], area_mm2:number}} anillos exteriores CCW, huecos CW.
 */
export function contornosDeUnion(rects) {
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b); const ys = [...new Set(rects.flatMap((r) => [r.y0, r.y1]))].sort((a, b) => a - b);
  const nx = xs.length - 1; const ny = ys.length - 1; const sol = Array.from({ length: ny }, () => new Array(nx).fill(false));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const cx = (xs[i] + xs[i + 1]) / 2; const cy = (ys[j] + ys[j + 1]) / 2; sol[j][i] = rects.some((r) => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1); }
  const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && sol[j][i];
  const aristas = new Map(); // "x,y" -> [[x,y]...]
  const add = (a, b) => { const k = `${a[0]},${a[1]}`; (aristas.get(k) || aristas.set(k, []).get(k)).push(b); };
  let area_mm2 = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!sol[j][i]) continue; area_mm2 += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
    const x0 = xs[i]; const x1 = xs[i + 1]; const y0 = ys[j]; const y1 = ys[j + 1];
    if (!at(i, j - 1)) add([x0, y0], [x1, y0]); // sur, hacia +x (sólido a la izquierda)
    if (!at(i + 1, j)) add([x1, y0], [x1, y1]);
    if (!at(i, j + 1)) add([x1, y1], [x0, y1]);
    if (!at(i - 1, j)) add([x0, y1], [x0, y0]);
  }
  const anillos = [];
  while (aristas.size) {
    const [k0, lista0] = aristas.entries().next().value; const start = k0.split(',').map(Number); let cur = start; let dirPrev = null; const ring = [start];
    for (let guard = 0; guard < 100000; guard++) {
      const k = `${cur[0]},${cur[1]}`; const lista = aristas.get(k); if (!lista?.length) break;
      let idx = 0;
      if (lista.length > 1 && dirPrev) { // en un pellizco, gire a la izquierda (mantiene anillos simples)
        const giro = (b) => { const d = [Math.sign(b[0] - cur[0]), Math.sign(b[1] - cur[1])]; return dirPrev[0] * d[1] - dirPrev[1] * d[0]; };
        idx = lista.map((b, n) => [giro(b), n]).sort((p, q) => q[0] - p[0])[0][1];
      }
      const next = lista.splice(idx, 1)[0]; if (!lista.length) aristas.delete(k);
      dirPrev = [Math.sign(next[0] - cur[0]), Math.sign(next[1] - cur[1])]; cur = next;
      if (cur[0] === start[0] && cur[1] === start[1]) break;
      ring.push(cur);
    }
    void lista0;
    const r = simplificar(ring); anillos.push({ ring: r, hueco: areaFirmada(r) < 0, area_mm2: area(r) });
  }
  return { anillos, area_mm2 };
}
