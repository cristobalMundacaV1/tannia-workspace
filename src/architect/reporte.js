// Salidas visuales: hoja comparativa (SVG) con croquis de plantas + matriz, y diagrama de sombras sobre el suelo.
import { escribirSvg } from '../design/salidas.js';
import { escena, rayoGolpea, sitioApto } from './sombras.js';
import { muestrasDia, vectorSolLocal, localAInstante, posicionSolar } from './solar.js';
import { bbox } from './poligonos.js';

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
export const planoSvg = (esq, geo, titulo) => escribirSvg({ sistema: 'albanileria_confinada' }, geo, { titulo, version: esq.id, fecha: new Date().toISOString().slice(0, 10) });

function anidar(svg, x, y, w) {
  const m = /<svg[^>]*viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"[^>]*>/.exec(svg); if (!m) return { svg: '', h: 0 };
  const vw = Number(m[1]); const vh = Number(m[2]); const h = Math.round((w * vh) / vw);
  const cuerpo = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
  return { svg: `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}">${cuerpo}</svg>`, h };
}

/** items: [{titulo, svg, lineas:[string]}] */
export function hojaComparativa(items, { titulo = 'Comparación de partidos', pie = [] } = {}) {
  const W = 420; const gap = 20; const total = items.length * W + (items.length + 1) * gap; const out = []; let alto = 90;
  const bloques = items.map((it, i) => { const x = gap + i * (W + gap); const a = anidar(it.svg, x, 86, W); const lineas = it.lineas.map((l, k) => `<text x="${x}" y="${86 + a.h + 20 + k * 15}" font-size="11">${esc(l)}</text>`).join(''); alto = Math.max(alto, 86 + a.h + 30 + it.lineas.length * 15); return `<text x="${x}" y="76" font-size="14" font-weight="bold">${esc(it.titulo)}</text>${a.svg}${lineas}`; });
  const H = alto + 20 + pie.length * 15;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H}" viewBox="0 0 ${total} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="${gap}" y="28" font-size="18" font-weight="bold">${esc(titulo)}</text><text x="${gap}" y="46" font-size="11" fill="#a00">ANTEPROYECTO conceptual — no apto para construcción; sin verificación normativa ni profesional.</text>`, ...bloques, ...pie.map((l, k) => `<text x="${gap}" y="${alto + 10 + k * 15}" font-size="11" fill="#444">${esc(l)}</text>`), '</svg>');
  return out.join('\n');
}

/** Sombras proyectadas sobre el suelo (rejilla) a horas locales dadas. Requiere sitio apto; si no, devuelve null. */
export function diagramaSombras({ esq, geo, sitio, fecha, horas = ['10:00', '13:00', '16:00'], celda = 500 }) {
  if (sitioApto(sitio).length) return null;
  const norte = sitio.true_north_deg_from_local_plus_y_clockwise.valor; const e = escena(esq, geo, { sitio }); const b = bbox(geo.huella.anillos.map((a) => a.ring)); const mg = 6000;
  const x0 = b.x0 - mg; const y0 = b.y0 - mg; const x1 = b.x1 + mg; const y1 = b.y1 + mg; const W = 300; const sc = W / (x1 - x0); const H = Math.round((y1 - y0) * sc);
  const paneles = horas.map((h, i) => {
    const ms = localAInstante(`${fecha}T${h}`, sitio.timezone); const p = posicionSolar(ms, sitio.coordinates.lat, sitio.coordinates.lon); const cel = [];
    if (p.elevacion_aparente_deg > 0) { const d = vectorSolLocal(p.azimut_deg, p.elevacion_aparente_deg, norte); for (let x = x0; x < x1; x += celda) for (let y = y0; y < y1; y += celda) if (rayoGolpea([x + celda / 2, y + celda / 2, 50], d, e.cajas)) cel.push(`<rect x="${((x - x0) * sc).toFixed(1)}" y="${((y1 - y - celda) * sc).toFixed(1)}" width="${(celda * sc + 0.4).toFixed(1)}" height="${(celda * sc + 0.4).toFixed(1)}" fill="#445"/>`); }
    const huella = geo.huella.anillos.map((a) => `<polygon points="${a.ring.map(([x, y]) => `${((x - x0) * sc).toFixed(1)},${((y1 - y) * sc).toFixed(1)}`).join(' ')}" fill="none" stroke="#c00" stroke-width="1.5"/>`).join('');
    const ang = (p.azimut_deg + norte) * Math.PI / 180; const fl = `<line x1="${W / 2}" y1="14" x2="${W / 2 + 12 * Math.sin(0)}" y2="2" stroke="#000"/>`; void ang; void fl;
    return `<g transform="translate(${10 + i * (W + 20)},50)"><rect width="${W}" height="${H}" fill="#fffbe6" stroke="#999"/>${cel.join('')}${huella}<text x="4" y="-6" font-size="12">${esc(h)} — sol ${p.elevacion_aparente_deg > 0 ? `elev ${p.elevacion_aparente_deg.toFixed(0)}° acimut ${p.azimut_deg.toFixed(0)}°` : 'bajo el horizonte'}</text></g>`;
  });
  const total = 20 + horas.length * (W + 20);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H + 90}" viewBox="0 0 ${total} ${H + 90}" font-family="Arial, Helvetica, sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="10" y="20" font-size="14" font-weight="bold">Sombras sobre el suelo — ${esc(esq.id)} — ${esc(fecha)}</text><text x="10" y="36" font-size="10" fill="#555">Sol directo geométrico (incluye el que entra por vanos; sin nubosidad ni vegetación caduca); NO es iluminancia ni confort térmico. Norte verdadero a ${norte.toFixed(0)}° desde +Y local.</text>${paneles.join('')}</svg>`;
}
export { muestrasDia };
