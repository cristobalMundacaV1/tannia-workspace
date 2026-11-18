// PL-VISUAL-01: firma raster de una lámina (proporción de tinta en una rejilla de celdas) para comparar contra goldens APROBADOS.
// Tolerante al antialiasing entre sistemas; sensible a cambios de contenido (vistas, cuadros, tramas). No reemplaza la revisión humana.
export function firmaRaster({ data, width, height }, [nx, ny] = [42, 30]) {
  const celdas = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x0 = Math.floor((i * width) / nx); const x1 = Math.floor(((i + 1) * width) / nx); const y0 = Math.floor((j * height) / ny); const y1 = Math.floor(((j + 1) * height) / ny);
    let tinta = 0; let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * width + x) * 4; n++; if (data[k] < 200 || data[k + 1] < 200 || data[k + 2] < 200) tinta++; }
    celdas.push(Math.round((tinta / Math.max(1, n)) * 1000) / 1000);
  }
  return { rejilla: [nx, ny], celdas };
}
export function compararFirma(a, b, { media = 0.004, maxima = 0.08 } = {}) {
  if (!b || JSON.stringify(a.rejilla) !== JSON.stringify(b.rejilla)) return { ok: false, motivo: 'rejilla distinta' };
  const d = a.celdas.map((x, i) => Math.abs(x - b.celdas[i])); const m = d.reduce((s, x) => s + x, 0) / d.length; const mx = Math.max(...d);
  return { ok: m <= media && mx <= maxima, media: m, maxima: mx, celda: d.indexOf(mx) };
}
