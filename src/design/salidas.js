// Salidas del anteproyecto: DXF editable (AC1009/R12, el más tolerante), SVG de presentación y vista ASCII.
import { SISTEMAS } from '../conocimiento/criterios.js';

export const CAPAS = {
  TW_MURO_EXT: { color: 7, descripcion: 'Muros exteriores (contorno)' },
  TW_MURO_INT: { color: 8, descripcion: 'Muros y tabiques interiores (contorno)' },
  TW_PUERTA: { color: 3, descripcion: 'Puertas: hoja y barrido' },
  TW_VENTANA: { color: 4, descripcion: 'Ventanas' },
  TW_RECINTO: { color: 2, descripcion: 'Contorno útil de cada recinto (polilínea cerrada; útil para área)' },
  TW_TEXTO: { color: 7, descripcion: 'Nombres, superficies y rótulo' },
  TW_COTA: { color: 6, descripcion: 'Cotas (geometría editable)' },
  TW_EJES: { color: 9, descripcion: 'Ejes de muros' },
};

const num = (v) => { const r = Math.round(v * 1e4) / 1e4; return Object.is(r, -0) ? '0' : String(r); };
/** Texto DXF seguro: ASCII; el resto como \U+XXXX (lo interpreta AutoCAD). */
export function textoDxf(s) { return [...String(s)].map((c) => (c.codePointAt(0) < 128 && c !== '\\' ? c : `\\U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)).join(''); }
const dxfDecode = (s) => s.replace(/\\U\+([0-9A-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
export { dxfDecode };

export function escribirDxf(modelo, geo, meta = {}) {
  const out = []; const p = (c, v) => out.push(`${c}\n${v}`);
  const ent = [];
  const E = (...pares) => { for (const [c, v] of pares) ent.push(`${c}\n${v}`); };
  const linea = (capa, x0, y0, x1, y1) => E([0, 'LINE'], [8, capa], [10, num(x0)], [20, num(y0)], [30, 0], [11, num(x1)], [21, num(y1)], [31, 0]);
  const texto = (capa, x, y, h, s, rot = 0) => E([0, 'TEXT'], [8, capa], [10, num(x)], [20, num(y)], [30, 0], [40, h], [1, textoDxf(s)], ...(rot ? [[50, rot]] : []), [72, 1], [11, num(x)], [21, num(y)], [31, 0]);
  const arco = (capa, cx, cy, r, a0, a1) => E([0, 'ARC'], [8, capa], [10, num(cx)], [20, num(cy)], [30, 0], [40, num(r)], [50, num(a0)], [51, num(a1)]);
  const polilinea = (capa, pts) => { E([0, 'POLYLINE'], [8, capa], [66, 1], [70, 1]); for (const q of pts) E([0, 'VERTEX'], [8, capa], [10, num(q[0])], [20, num(q[1])], [30, 0]); E([0, 'SEQEND'], [8, capa]); };

  const ex = geo.exterior;
  // Muros (contorno de la unión, vanos recortados)
  for (const l of geo.union.lineas) linea(l.clase === 'ext' ? 'TW_MURO_EXT' : 'TW_MURO_INT', l.x0, l.y0, l.x1, l.y1);
  // Recintos: contorno útil + rótulo
  for (const r of Object.values(geo.recintos)) {
    const n = r.neto; polilinea('TW_RECINTO', [[n.x0, n.y0], [n.x1, n.y0], [n.x1, n.y1], [n.x0, n.y1]]);
    const cx = (n.x0 + n.x1) / 2; const cy = (n.y0 + n.y1) / 2;
    if (r.tipo === 'pasillo') { texto('TW_TEXTO', cx, cy + 40, 130, `${r.nombre}  ${r.area_neta_m2.toFixed(2)} m2`); }
    else { texto('TW_TEXTO', cx, cy + 90, 170, r.nombre); texto('TW_TEXTO', cx, cy - 190, 140, `${r.area_neta_m2.toFixed(2)} m2`); }
  }
  // Aberturas
  for (const a of geo.aberturas.filter((x) => !x.invalida)) {
    if (a.tipo === 'ventana') {
      const t = a.espesor;
      for (const k of [-t / 3, 0, t / 3]) { if (a.orient === 'h') linea('TW_VENTANA', a.desde, a.fijo + k, a.hasta, a.fijo + k); else linea('TW_VENTANA', a.fijo + k, a.desde, a.fijo + k, a.hasta); }
    } else if (a.hoja) {
      linea('TW_PUERTA', a.hoja.bisagra.x, a.hoja.bisagra.y, a.hoja.abierta_hasta.x, a.hoja.abierta_hasta.y);
      arco('TW_PUERTA', a.hoja.arco.cx, a.hoja.arco.cy, a.hoja.arco.r, a.hoja.arco.a0, a.hoja.arco.a1);
    }
  }
  // Ejes
  const xs = [...new Set(Object.values(geo.rect).flatMap((r) => [r.x0, r.x1]))]; const ys = [...new Set(Object.values(geo.rect).flatMap((r) => [r.y0, r.y1]))];
  for (const x of xs) linea('TW_EJES', x, -300, x, ex.y1 + 300);
  for (const y of ys) linea('TW_EJES', -300, y, ex.x1 + 300, y);
  // Cotas
  const H = 140;
  for (const c of geo.cotas) {
    const d = c.nivel === 1 ? 600 : 1300;
    const txt = (c.valor_mm / 1000).toFixed(2);
    if (c.orient === 'h') {
      const y = -d; const yRef = c.nivel === 1 ? -250 : -250;
      linea('TW_COTA', c.desde, yRef, c.desde, y - 150); linea('TW_COTA', c.hasta, yRef, c.hasta, y - 150); linea('TW_COTA', c.desde, y, c.hasta, y);
      linea('TW_COTA', c.desde - 100, y - 100, c.desde + 100, y + 100); linea('TW_COTA', c.hasta - 100, y - 100, c.hasta + 100, y + 100);
      texto('TW_COTA', (c.desde + c.hasta) / 2, y + 60, H, txt);
    } else {
      const x = -d; const xRef = -250;
      linea('TW_COTA', xRef, c.desde, x - 150, c.desde); linea('TW_COTA', xRef, c.hasta, x - 150, c.hasta); linea('TW_COTA', x, c.desde, x, c.hasta);
      linea('TW_COTA', x - 100, c.desde - 100, x + 100, c.desde + 100); linea('TW_COTA', x - 100, c.hasta - 100, x + 100, c.hasta + 100);
      texto('TW_COTA', x - 60, (c.desde + c.hasta) / 2, H, txt, 90);
    }
  }
  // Rótulo
  const sis = SISTEMAS[modelo.sistema];
  const y0 = -2300; const lineas = [
    `ANTEPROYECTO - NO APTO PARA CONSTRUCCION`, `${meta.titulo || 'Vivienda'}  |  ${meta.version || ''}  |  ${meta.fecha || ''}`,
    `Superficie construida ${geo.areas.construida_m2.toFixed(2)} m2  |  util ${geo.areas.util_neta_m2.toFixed(2)} m2  |  sistema: ${sis.nombre}`,
    'Medidas a ejes en cotas; superficies utiles netas. Valores preliminares sujetos a proyecto de arquitectura, calculo e instalaciones.',
  ];
  lineas.forEach((s, i) => texto('TW_TEXTO', ex.x1 / 2, y0 - i * 260, i === 0 ? 220 : 150, s));

  p(0, 'SECTION'); p(2, 'HEADER');
  p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSBASE'); p(10, 0); p(20, 0); p(30, 0);
  p(9, '$EXTMIN'); p(10, -2000); p(20, -3500); p(30, 0); p(9, '$EXTMAX'); p(10, num(ex.x1 + 600)); p(20, num(ex.y1 + 600)); p(30, 0);
  p(9, '$INSUNITS'); p(70, 4); p(9, '$MEASUREMENT'); p(70, 1);
  p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'TABLES');
  p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 1); p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, 0); p(0, 'ENDTAB');
  p(0, 'TABLE'); p(2, 'LAYER'); p(70, Object.keys(CAPAS).length);
  for (const [n, c] of Object.entries(CAPAS)) { p(0, 'LAYER'); p(2, n); p(70, 0); p(62, c.color); p(6, 'CONTINUOUS'); }
  p(0, 'ENDTAB');
  p(0, 'TABLE'); p(2, 'STYLE'); p(70, 1); p(0, 'STYLE'); p(2, 'STANDARD'); p(70, 0); p(40, 0); p(41, 1); p(50, 0); p(71, 0); p(42, 2.5); p(3, 'txt'); p(4, ''); p(0, 'ENDTAB');
  p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'BLOCKS'); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'ENTITIES');
  out.push(...ent);
  p(0, 'ENDSEC'); p(0, 'EOF');
  return `${out.join('\n')}\n`;
}

// ---------------- SVG ----------------
const COLOR_TIPO = { living_comedor: '#f6efe0', cocina: '#fbe9d0', bano: '#d9ecf5', dormitorio_principal: '#e4efe0', dormitorio: '#ecf3e3', pasillo: '#f1f1f1' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function escribirSvg(modelo, geo, meta = {}) {
  const ex = geo.exterior; const m = { x0: -2200, y0: -3100, x1: ex.x1 + 900, y1: ex.y1 + 700 };
  const W = m.x1 - m.x0; const Hh = m.y1 - m.y0; const Y = (y) => m.y1 - y; const X = (x) => x - m.x0;
  const L = []; const add = (s) => L.push(s);
  add(`<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 ${W} ${Hh}" width="${Math.round(W / 8)}" height="${Math.round(Hh / 8)}" font-family="Arial, Helvetica, sans-serif">`);
  add(`<rect width="${W}" height="${Hh}" fill="#ffffff"/>`);
  for (const r of Object.values(geo.recintos)) { const n = r.neto; add(`<rect x="${X(n.x0)}" y="${Y(n.y1)}" width="${n.x1 - n.x0}" height="${n.y1 - n.y0}" fill="${COLOR_TIPO[r.tipo] || '#f5f5f5'}"/>`); }
  for (const c of geo.union.corridas) add(`<rect x="${X(c.x0)}" y="${Y(c.y1)}" width="${c.x1 - c.x0}" height="${c.y1 - c.y0}" fill="#2b2b2b"/>`);
  for (const a of geo.aberturas.filter((x) => !x.invalida)) {
    if (a.tipo === 'ventana') {
      add(`<rect x="${X(a.corte.x0)}" y="${Y(a.corte.y1)}" width="${a.corte.x1 - a.corte.x0}" height="${a.corte.y1 - a.corte.y0}" fill="#ffffff"/>`);
      const t = a.espesor; for (const k of [-t / 3, 0, t / 3]) { if (a.orient === 'h') add(`<line x1="${X(a.desde)}" y1="${Y(a.fijo + k)}" x2="${X(a.hasta)}" y2="${Y(a.fijo + k)}" stroke="#2a7fb8" stroke-width="18"/>`); else add(`<line x1="${X(a.fijo + k)}" y1="${Y(a.desde)}" x2="${X(a.fijo + k)}" y2="${Y(a.hasta)}" stroke="#2a7fb8" stroke-width="18"/>`); }
    } else {
      add(`<rect x="${X(a.corte.x0)}" y="${Y(a.corte.y1)}" width="${a.corte.x1 - a.corte.x0}" height="${a.corte.y1 - a.corte.y0}" fill="#ffffff"/>`);
      if (a.hoja) { const h = a.hoja; const sw = h.barrido.slice(1);
        add(`<path d="M ${X(h.bisagra.x)} ${Y(h.bisagra.y)} L ${sw.map((q) => `${X(q.x)} ${Y(q.y)}`).join(' L ')} Z" fill="#3b9a4a" fill-opacity="0.12" stroke="#3b9a4a" stroke-width="12"/>`);
        add(`<line x1="${X(h.bisagra.x)}" y1="${Y(h.bisagra.y)}" x2="${X(h.abierta_hasta.x)}" y2="${Y(h.abierta_hasta.y)}" stroke="#2f7a3a" stroke-width="26"/>`); }
    }
  }
  for (const r of Object.values(geo.recintos)) {
    const n = r.neto; const cx = (n.x0 + n.x1) / 2; const cy = (n.y0 + n.y1) / 2; const nombre = r.nombre.length > 14 && r.ancho_neto_mm < 3500 ? r.nombre.split(' ') : [r.nombre];
    const fs = r.tipo === 'pasillo' ? 130 : 160;
    if (r.tipo === 'pasillo') add(`<text x="${X(cx)}" y="${Y(cy) + 45}" font-size="${fs}" text-anchor="middle" fill="#444">${esc(r.nombre)} ${r.area_neta_m2.toFixed(2)} m²</text>`);
    else { nombre.forEach((s, i) => add(`<text x="${X(cx)}" y="${Y(cy) - 40 + i * 175 - (nombre.length - 1) * 80}" font-size="${fs}" font-weight="700" text-anchor="middle" fill="#222">${esc(s)}</text>`)); add(`<text x="${X(cx)}" y="${Y(cy) + 190 + (nombre.length - 1) * 90}" font-size="140" text-anchor="middle" fill="#555">${r.area_neta_m2.toFixed(2)} m²</text>`); }
  }
  for (const c of geo.cotas) {
    const d = c.nivel === 1 ? 600 : 1300; const t = (c.valor_mm / 1000).toFixed(2);
    if (c.orient === 'h') { const y = -d; add(`<line x1="${X(c.desde)}" y1="${Y(y)}" x2="${X(c.hasta)}" y2="${Y(y)}" stroke="#a02c8c" stroke-width="12"/>`); for (const x of [c.desde, c.hasta]) add(`<line x1="${X(x)}" y1="${Y(-250)}" x2="${X(x)}" y2="${Y(y - 150)}" stroke="#a02c8c" stroke-width="8"/><line x1="${X(x - 90)}" y1="${Y(y - 90)}" x2="${X(x + 90)}" y2="${Y(y + 90)}" stroke="#a02c8c" stroke-width="14"/>`); add(`<text x="${X((c.desde + c.hasta) / 2)}" y="${Y(y) - 50}" font-size="125" text-anchor="middle" fill="#a02c8c">${t}</text>`); }
    else { const x = -d; add(`<line x1="${X(x)}" y1="${Y(c.desde)}" x2="${X(x)}" y2="${Y(c.hasta)}" stroke="#a02c8c" stroke-width="12"/>`); for (const y of [c.desde, c.hasta]) add(`<line x1="${X(-250)}" y1="${Y(y)}" x2="${X(x - 150)}" y2="${Y(y)}" stroke="#a02c8c" stroke-width="8"/><line x1="${X(x - 90)}" y1="${Y(y - 90)}" x2="${X(x + 90)}" y2="${Y(y + 90)}" stroke="#a02c8c" stroke-width="14"/>`); add(`<text transform="translate(${X(x) - 55} ${Y((c.desde + c.hasta) / 2)}) rotate(-90)" font-size="125" text-anchor="middle" fill="#a02c8c">${t}</text>`); }
  }
  const sis = SISTEMAS[modelo.sistema];
  add(`<text x="${X(ex.x1 / 2)}" y="${Y(-2300)}" font-size="230" font-weight="700" text-anchor="middle" fill="#b00020">ANTEPROYECTO — NO APTO PARA CONSTRUCCIÓN</text>`);
  add(`<text x="${X(ex.x1 / 2)}" y="${Y(-2560)}" font-size="150" text-anchor="middle" fill="#333">${esc(meta.titulo || 'Vivienda')} · ${esc(meta.version || '')} · ${esc(meta.fecha || '')}</text>`);
  add(`<text x="${X(ex.x1 / 2)}" y="${Y(-2820)}" font-size="140" text-anchor="middle" fill="#333">Construida ${geo.areas.construida_m2.toFixed(2)} m² · útil ${geo.areas.util_neta_m2.toFixed(2)} m² · ${esc(sis.nombre)}</text>`);
  add('</svg>');
  return L.join('\n');
}

// ---------------- ASCII ----------------
export function vistaAscii(geo, { paso = 250 } = {}) {
  const ex = geo.exterior; const cols = Math.ceil(ex.x1 / paso); const filas = Math.ceil(ex.y1 / (paso * 2));
  const letras = {}; const claves = Object.keys(geo.recintos).sort(); const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  claves.forEach((id, i) => { letras[id] = abc[i % abc.length]; });
  const rows = [];
  for (let j = filas - 1; j >= 0; j--) {
    let s = '';
    for (let i = 0; i < cols; i++) {
      const cw = ex.x1 / cols; const ch = ex.y1 / filas; const x = (i + 0.5) * cw; const y = (j + 0.5) * ch;
      const muestras = []; for (const fx of [0.17, 0.5, 0.83]) for (const fy of [0.17, 0.5, 0.83]) muestras.push([i * cw + fx * cw, j * ch + fy * ch]);
      const ab = muestras.map(([mx, my]) => geo.aberturas.find((a) => !a.invalida && mx >= a.corte.x0 && mx <= a.corte.x1 && my >= a.corte.y0 && my <= a.corte.y1)).find(Boolean);
      const sobreMuro = muestras.some(([mx, my]) => geo.union.esSolido(mx, my));
      if (ab && !muestras.every(([mx, my]) => !geo.union.esSolido(mx, my) && !geo.aberturas.some((q) => !q.invalida && mx >= q.corte.x0 && mx <= q.corte.x1 && my >= q.corte.y0 && my <= q.corte.y1) )) { if (ab.tipo === 'ventana') { s += '='; continue; } if (ab.tipo === 'puerta') { s += '+'; continue; } s += ' '; continue; }
      if (sobreMuro) { s += '#'; continue; }
      const r = Object.values(geo.recintos).find((q) => x >= q.neto.x0 && x < q.neto.x1 && y >= q.neto.y0 && y < q.neto.y1);
      s += r ? letras[r.id] : '·';
    }
    rows.push(s);
  }
  const leyenda = claves.map((id) => `${letras[id]} = ${geo.recintos[id].nombre} (${geo.recintos[id].area_neta_m2.toFixed(2)} m²)`);
  return { plano: rows.join('\n'), leyenda, escala: `1 carácter = ${paso} mm en X, ${paso * 2} mm en Y; # muro, + puerta, = ventana, espacio = paso libre (arriba = norte)` };
}
