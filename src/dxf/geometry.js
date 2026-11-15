// Geometría 2D/3D pura: transformaciones afines, polilíneas con bulge, áreas, intersecciones.
export const EPS = 1e-9;
const D2R = Math.PI / 180;

// Matriz afín 3D: { m: [a,b,c, d,e,f, g,h,i], t: [tx,ty,tz] } con p' = M p + t
export const IDENTITY = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

export function apply(T, p) {
  const [a, b, c, d, e, f, g, h, i] = T.m;
  return { x: a * p.x + b * p.y + c * p.z + T.t[0], y: d * p.x + e * p.y + f * p.z + T.t[1], z: g * p.x + h * p.y + i * p.z + T.t[2] };
}

export function compose(A, B) { // A ∘ B  (primero B, luego A)
  const a = A.m, b = B.m;
  const m = [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
  const bt = apply(A, { x: B.t[0], y: B.t[1], z: B.t[2] });
  return { m, t: [bt.x, bt.y, bt.z] };
}

export function insertTransform(ins, base, ci = 0, ri = 0) {
  const th = ins.rot * D2R, c = Math.cos(th), s = Math.sin(th);
  const R = { m: [c, -s, 0, s, c, 0, 0, 0, 1], t: [0, 0, 0] };
  const S = { m: [ins.sx, 0, 0, 0, ins.sy, 0, 0, 0, ins.sz], t: [0, 0, 0] };
  const place = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [ins.p.x + ci * ins.dx, ins.p.y + ri * ins.dy, ins.p.z] };
  const unbase = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [-base.x, -base.y, -base.z] };
  // rotación del arreglo: el espaciado se aplica en el sistema rotado del INSERT
  const arr = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
  const off = apply(R, { x: ci * ins.dx, y: ri * ins.dy, z: 0 });
  place.t = [ins.p.x + off.x, ins.p.y + off.y, ins.p.z];
  return compose(place, compose(R, compose(S, compose(unbase, arr))));
}

export function det3(T) {
  const [a, b, c, d, e, f, g, h, i] = T.m;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

export function det2(T) { return T.m[0] * T.m[4] - T.m[1] * T.m[3]; }

/** ¿La parte 2D es una similitud (escala uniforme + rotación, con o sin espejo)? Devuelve factor de escala o null. */
export function similarityScale(T) {
  const [a, b, , d, e] = T.m;
  const c1 = Math.hypot(a, d), c2 = Math.hypot(b, e);
  const dot = a * b + d * e;
  if (c1 < EPS || Math.abs(c1 - c2) > 1e-9 * Math.max(1, c1) || Math.abs(dot) > 1e-9 * c1 * c2) return null;
  return c1;
}

export const dist3 = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

/** Longitud, ángulo barrido (rad, con signo) y radio de un segmento con bulge. */
export function bulgeSeg(p0, p1, bulge) {
  const c = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (Math.abs(bulge) < EPS || c < EPS) return { len: c, theta: 0, r: Infinity, chord: c };
  const theta = 4 * Math.atan(bulge);
  const r = c / (2 * Math.abs(Math.sin(theta / 2)));
  return { len: r * Math.abs(theta), theta, r, chord: c };
}

/** Longitud total de polilínea (con arcos); verts ya transformados y bulge ajustado. */
export function polyLength(verts, closed) {
  let L = 0;
  const n = verts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) L += bulgeSeg(verts[i], verts[(i + 1) % n], verts[i].bulge || 0).len;
  return L;
}

/** Área neta con signo (CCW positiva) de polilínea cerrada con arcos. */
export function polySignedArea(verts) {
  const n = verts.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const p = verts[i], q = verts[(i + 1) % n];
    s += p.x * q.y - q.x * p.y;
    const b = p.bulge || 0;
    if (Math.abs(b) >= EPS) {
      const { theta, chord } = bulgeSeg(p, q, b);
      const sin2 = Math.sin(theta / 2) ** 2;
      s += 2 * (chord * chord / 8) * ((theta - Math.sin(theta)) / sin2); // 2× para compensar el /2 final
    }
  }
  return s / 2;
}

function flatten(verts, closed, steps = 24) {
  const pts = [];
  const n = verts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p = verts[i], q = verts[(i + 1) % n];
    pts.push({ x: p.x, y: p.y });
    const b = p.bulge || 0;
    if (Math.abs(b) >= EPS) {
      const { theta, r } = bulgeSeg(p, q, b);
      const chord = Math.hypot(q.x - p.x, q.y - p.y);
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      const nx = -(q.y - p.y) / chord, ny = (q.x - p.x) / chord; // normal izquierda
      const off = (chord / 2) * ((1 - b * b) / (2 * b));          // con signo
      const cx = mx + nx * off, cy = my + ny * off;
      const a0 = Math.atan2(p.y - cy, p.x - cx);
      for (let k = 1; k < steps; k++) { const a = a0 + (theta * k) / steps; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    }
  }
  if (!closed) pts.push({ x: verts[n - 1].x, y: verts[n - 1].y });
  return pts;
}

function segIntersect(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-14) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  const e = 1e-9;
  return t > e && t < 1 - e && u > e && u < 1 - e;
}

/** Autointersección (aproximando arcos por tramos). */
export function selfIntersects(verts, closed) {
  const pts = flatten(verts, closed);
  const n = pts.length;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    for (let j = i + 2; j < m; j++) {
      if (closed && i === 0 && j === m - 1) continue;
      if (segIntersect(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function arcSweep(a0, a1) {
  let s = (a1 - a0) % 360;
  if (s <= 0) s += 360;
  return s * D2R;
}
