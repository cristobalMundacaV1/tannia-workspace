// Geometría 3D de mallas: área, volumen (teorema de la divergencia) y verificación de cierre/orientación.
// NO calcula volúmenes de 3DSOLID/REGION/SURFACE (datos ACIS opacos en DXF): eso requiere AutoCAD real.

const key = (p, q) => `${Math.round(p.x / q)},${Math.round(p.y / q)},${Math.round(p.z / q)}`;

function triArea(a, b, c) {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

/** Triangula caras (listas de 3+ puntos). Devuelve triángulos y aviso si hay caras no planas. */
export function triangulate(faces) {
  const tris = []; let nonPlanar = false;
  for (const f of faces) {
    for (let i = 1; i + 1 < f.length; i++) tris.push([f[0], f[i], f[i + 1]]);
    if (f.length === 4) { // planaridad aproximada
      const [a, b, c, d] = f; const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y), ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z), nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const nl = Math.hypot(nx, ny, nz); const sz = Math.max(Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z), 1e-12);
      if (nl > 1e-12 && Math.abs(((d.x - a.x) * nx + (d.y - a.y) * ny + (d.z - a.z) * nz) / nl) > 1e-6 * sz) nonPlanar = true;
    }
  }
  return { tris, nonPlanar };
}

/**
 * faces: array de arrays de puntos {x,y,z} ya en coordenadas de mundo.
 * Devuelve { area, volumen|null, cerrada, advertencias[], necesita_revision }.
 */
export function analyzeSurface(faces, { tolRel = 1e-9 } = {}) {
  const warn = [];
  const { tris, nonPlanar } = triangulate(faces);
  if (!tris.length) return { area: 0, volumen: null, cerrada: false, triangulos: 0, advertencias: ['Sin caras.'], necesita_revision: true };
  if (nonPlanar) warn.push('Hay caras cuadrangulares no planas: se triangularon (aproximación).');
  // escala de tolerancia: dimensión característica
  let max = 0; for (const t of tris) for (const p of t) max = Math.max(max, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  const q = Math.max(max * tolRel, 1e-12);
  let area = 0; let vol6 = 0; let degenerate = 0;
  const edges = new Map(); // "a|b" dirigido -> conteo
  for (const [a, b, c] of tris) {
    const ar = triArea(a, b, c);
    if (ar < 1e-14 * Math.max(1, max * max)) { degenerate++; continue; }
    area += ar;
    vol6 += (a.x * (b.y * c.z - b.z * c.y)) - (a.y * (b.x * c.z - b.z * c.x)) + (a.z * (b.x * c.y - b.y * c.x));
    const ka = key(a, q), kb = key(b, q), kc = key(c, q);
    for (const [u, v] of [[ka, kb], [kb, kc], [kc, ka]]) { const k = `${u}>${v}`; edges.set(k, (edges.get(k) || 0) + 1); }
  }
  if (degenerate) warn.push(`${degenerate} triángulo(s) degenerado(s) ignorado(s).`);
  let abiertas = 0; let mismaDireccion = 0; let noManifold = 0;
  for (const [k, n] of edges) {
    const [u, v] = k.split('>');
    if (n > 1) mismaDireccion++; // mismo sentido repetido: normales inconsistentes o solapamiento
    const rev = edges.get(`${v}>${u}`) || 0;
    if (rev === 0) abiertas++;
    else if (rev !== n) noManifold++;
  }
  const cerrada = abiertas === 0 && mismaDireccion === 0 && noManifold === 0;
  let volumen = null;
  if (cerrada) {
    volumen = Math.abs(vol6 / 6);
    if (vol6 < 0) warn.push('Las normales apuntan hacia adentro (orientación invertida): se tomó el valor absoluto.');
  } else {
    if (abiertas) warn.push(`Malla ABIERTA (${abiertas} arista(s) sin pareja): no hay volumen definido.`);
    if (mismaDireccion) warn.push('Orientación de caras inconsistente o caras duplicadas: no se calcula volumen.');
    if (noManifold) warn.push('Aristas no manifold: no se calcula volumen.');
  }
  return { area, volumen, cerrada, triangulos: tris.length, advertencias: warn, necesita_revision: !cerrada || nonPlanar || degenerate > 0 };
}
