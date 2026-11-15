// Unión de rectángulos ortogonales (muros) menos recortes (vanos) por compresión de coordenadas: exacto, sin librerías.
// Devuelve las aristas del contorno (fusionadas) clasificadas por tipo de muro, y las celdas sólidas (para SVG/ASCII).

const uniq = (a) => [...new Set(a)].sort((x, y) => x - y);

/**
 * @param muros [{x0,y0,x1,y1,clase}] rectángulos sólidos (clase: 'ext'|'int')
 * @param cortes [{x0,y0,x1,y1}] vanos a restar
 */
export function unionMuros(muros, cortes = []) {
  const xs = uniq([...muros, ...cortes].flatMap((r) => [r.x0, r.x1]));
  const ys = uniq([...muros, ...cortes].flatMap((r) => [r.y0, r.y1]));
  const nx = xs.length - 1; const ny = ys.length - 1;
  const cell = Array.from({ length: ny }, () => new Array(nx).fill(0)); // 0 vacío, 1 int, 2 ext
  const inRect = (r, cx, cy) => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2; const cy = (ys[j] + ys[j + 1]) / 2;
    let v = 0;
    for (const m of muros) if (inRect(m, cx, cy)) { v = Math.max(v, m.clase === 'ext' ? 2 : 1); }
    if (v && cortes.some((c) => inRect(c, cx, cy))) v = 0;
    cell[j][i] = v;
  }
  // aristas: entre celda sólida y no sólida (o borde)
  const horiz = []; const vert = []; // horiz: {y, x0, x1, clase}; vert: {x, y0, y1, clase}
  const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : cell[j][i]);
  for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j - 1); const b = at(i, j); // a debajo (j-1), b encima (j)
    if ((a > 0) !== (b > 0)) horiz.push({ y: ys[j], x0: xs[i], x1: xs[i + 1], clase: (a > 0 ? a : b) === 2 ? 'ext' : 'int' });
  }
  for (let i = 0; i <= nx; i++) for (let j = 0; j < ny; j++) {
    const a = at(i - 1, j); const b = at(i, j);
    if ((a > 0) !== (b > 0)) vert.push({ x: xs[i], y0: ys[j], y1: ys[j + 1], clase: (a > 0 ? a : b) === 2 ? 'ext' : 'int' });
  }
  const fusionar = (arr, fijo, d0, d1) => {
    const grupos = new Map();
    for (const e of arr) { const k = `${e[fijo]}|${e.clase}`; (grupos.get(k) || grupos.set(k, []).get(k)).push(e); }
    const out = [];
    for (const lista of grupos.values()) {
      lista.sort((p, q) => p[d0] - q[d0]);
      let cur = { ...lista[0] };
      for (let k = 1; k < lista.length; k++) { if (lista[k][d0] === cur[d1]) cur[d1] = lista[k][d1]; else { out.push(cur); cur = { ...lista[k] }; } }
      out.push(cur);
    }
    return out;
  };
  const lineas = [
    ...fusionar(horiz, 'y', 'x0', 'x1').map((e) => ({ x0: e.x0, y0: e.y, x1: e.x1, y1: e.y, clase: e.clase })),
    ...fusionar(vert, 'x', 'y0', 'y1').map((e) => ({ x0: e.x, y0: e.y0, x1: e.x, y1: e.y1, clase: e.clase })),
  ];
  // área de sólidos y celdas (corridas horizontales por fila) para dibujo
  let area = 0; const corridas = [];
  for (let j = 0; j < ny; j++) {
    let i = 0;
    while (i < nx) {
      if (!cell[j][i]) { i++; continue; }
      const k0 = i; while (i < nx && cell[j][i]) i++;
      corridas.push({ x0: xs[k0], x1: xs[i], y0: ys[j], y1: ys[j + 1] });
      area += (xs[i] - xs[k0]) * (ys[j + 1] - ys[j]);
    }
  }
  const esSolido = (x, y) => { const i = xs.findIndex((v, k) => x >= v && x < xs[k + 1]); const j = ys.findIndex((v, k) => y >= v && y < ys[k + 1]); return i >= 0 && j >= 0 && cell[j][i] > 0; };
  return { lineas, area_mm2: area, corridas, esSolido };
}
