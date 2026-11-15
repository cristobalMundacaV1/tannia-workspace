// Derivación geométrica: del modelo (árbol + aberturas) a recintos netos, muros, vanos, puertas con barrido, cotas e indicadores.
// Todo en mm. Coordenadas ABSOLUTAS: origen en la esquina SO del contorno EXTERIOR de los muros.
import { calcularRects } from './modelo.js';
import { unionMuros } from './contorno.js';
import { SISTEMAS, GENERALES } from '../conocimiento/criterios.js';

const R2 = (v) => Math.round(v * 100) / 100;

export function derivar(modelo) {
  const te = modelo.espesores.ext; const ti = modelo.espesores.int;
  const { ancho: AX, profundidad: AY } = modelo.ejes;
  const off = te / 2;
  const local = calcularRects(modelo.arbol, AX, AY);
  const rect = {}; for (const [id, r] of Object.entries(local)) rect[id] = { x0: r.x0 + off, y0: r.y0 + off, x1: r.x1 + off, y1: r.y1 + off };
  const exterior = { x0: 0, y0: 0, x1: AX + te, y1: AY + te };
  const eje = { x0: off, y0: off, x1: AX + off, y1: AY + off };
  const abierta = (a, b) => modelo.separaciones.some((s) => s.tipo === 'abierta' && ((s.a === a && s.b === b) || (s.a === b && s.b === a)));
  const ids = Object.keys(rect).sort();

  // --- segmentos de muro ---
  const segs = [];
  for (const id of ids) {
    const r = rect[id];
    if (r.y0 === eje.y0) segs.push({ id: `E-${id}-S`, tipo: 'ext', orient: 'h', fijo: r.y0, desde: r.x0, hasta: r.x1, espesor: te, recinto: id, lado: 'S' });
    if (r.y1 === eje.y1) segs.push({ id: `E-${id}-N`, tipo: 'ext', orient: 'h', fijo: r.y1, desde: r.x0, hasta: r.x1, espesor: te, recinto: id, lado: 'N' });
    if (r.x0 === eje.x0) segs.push({ id: `E-${id}-O`, tipo: 'ext', orient: 'v', fijo: r.x0, desde: r.y0, hasta: r.y1, espesor: te, recinto: id, lado: 'O' });
    if (r.x1 === eje.x1) segs.push({ id: `E-${id}-E`, tipo: 'ext', orient: 'v', fijo: r.x1, desde: r.y0, hasta: r.y1, espesor: te, recinto: id, lado: 'E' });
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i]; const b = ids[j]; const ra = rect[a]; const rb = rect[b];
    const vx = ra.x1 === rb.x0 ? { x: ra.x1, izq: a, der: b } : rb.x1 === ra.x0 ? { x: rb.x1, izq: b, der: a } : null;
    if (vx) { const y0 = Math.max(ra.y0, rb.y0); const y1 = Math.min(ra.y1, rb.y1); if (y1 > y0) segs.push({ id: `I-${a}-${b}`, tipo: 'int', orient: 'v', fijo: vx.x, desde: y0, hasta: y1, espesor: ti, entre: [a, b], abierta: abierta(a, b), lados: { izq: vx.izq, der: vx.der } }); }
    const hy = ra.y1 === rb.y0 ? { y: ra.y1, bajo: a, sobre: b } : rb.y1 === ra.y0 ? { y: rb.y1, bajo: b, sobre: a } : null;
    if (hy) { const x0 = Math.max(ra.x0, rb.x0); const x1 = Math.min(ra.x1, rb.x1); if (x1 > x0) segs.push({ id: `I-${a}-${b}`, tipo: 'int', orient: 'h', fijo: hy.y, desde: x0, hasta: x1, espesor: ti, entre: [a, b], abierta: abierta(a, b), lados: { bajo: hy.bajo, sobre: hy.sobre } }); }
  }
  const murosSeg = segs.filter((s) => !s.abierta);
  const rectMuro = (s) => {
    let { desde, hasta } = s; const t = s.espesor;
    if (s.tipo === 'ext') { // cerrar esquinas exteriores
      const [lo, hi] = s.orient === 'h' ? [eje.x0, eje.x1] : [eje.y0, eje.y1];
      if (desde === lo) desde -= te / 2; if (hasta === hi) hasta += te / 2;
    }
    return s.orient === 'h' ? { x0: desde, x1: hasta, y0: s.fijo - t / 2, y1: s.fijo + t / 2, clase: s.tipo } : { x0: s.fijo - t / 2, x1: s.fijo + t / 2, y0: desde, y1: hasta, clase: s.tipo };
  };
  const rectsMuro = murosSeg.map(rectMuro);

  // --- recintos netos ---
  const mitad = (r, lado) => {
    const cand = murosSeg.filter((s) => {
      if (lado === 'O') return s.orient === 'v' && s.fijo === r.x0 && s.hasta > r.y0 && s.desde < r.y1;
      if (lado === 'E') return s.orient === 'v' && s.fijo === r.x1 && s.hasta > r.y0 && s.desde < r.y1;
      if (lado === 'S') return s.orient === 'h' && s.fijo === r.y0 && s.hasta > r.x0 && s.desde < r.x1;
      return s.orient === 'h' && s.fijo === r.y1 && s.hasta > r.x0 && s.desde < r.x1;
    });
    return cand.length ? Math.max(...cand.map((s) => s.espesor / 2)) : 0;
  };
  const recintos = {};
  for (const id of ids) {
    const r = rect[id]; const base = modelo.recintos[id];
    const neto = { x0: r.x0 + mitad(r, 'O'), x1: r.x1 - mitad(r, 'E'), y0: r.y0 + mitad(r, 'S'), y1: r.y1 - mitad(r, 'N') };
    const w = neto.x1 - neto.x0; const d = neto.y1 - neto.y0;
    recintos[id] = { id, nombre: base.nombre, tipo: base.tipo, eje: r, neto, ancho_neto_mm: w, fondo_neto_mm: d, area_neta_m2: R2((w * d) / 1e6), relacion: R2(Math.max(w, d) / Math.min(w, d)) };
  }

  // --- aberturas ---
  const margen = GENERALES.margen_abertura_a_esquina_mm;
  const aberturas = []; const advertenciasDeriv = [];
  for (const a of modelo.aberturas) {
    const seg = a.lado ? segs.find((s) => s.tipo === 'ext' && s.recinto === a.recinto && s.lado === a.lado) : segs.find((s) => s.tipo === 'int' && a.entre && ((s.entre[0] === a.entre[0] && s.entre[1] === a.entre[1]) || (s.entre[0] === a.entre[1] && s.entre[1] === a.entre[0])));
    if (!seg) { aberturas.push({ ...a, invalida: true, motivo: a.lado ? `El recinto ${a.recinto} no tiene muro exterior en el lado ${a.lado}.` : `Los recintos ${a.entre?.join(' y ')} no comparten muro.` }); continue; }
    if (seg.abierta) { aberturas.push({ ...a, invalida: true, motivo: `Entre ${seg.entre.join(' y ')} no hay muro (separación abierta).` }); continue; }
    const len = seg.hasta - seg.desde; const w = a.ancho_mm;
    let pos = a.ancla === 'fin' ? len - a.distancia_mm : a.ancla === 'centro' ? len / 2 + (a.distancia_mm || 0) : a.distancia_mm;
    const min = margen + w / 2; const max = len - margen - w / 2; let ajustada = false;
    if (max < min) { aberturas.push({ ...a, invalida: true, motivo: `La abertura de ${w} mm no cabe en un muro de ${len} mm.` }); continue; }
    if (pos < min) { pos = min; ajustada = true; } if (pos > max) { pos = max; ajustada = true; }
    const c = seg.desde + pos; const t = seg.espesor;
    const corte = seg.orient === 'h' ? { x0: c - w / 2, x1: c + w / 2, y0: seg.fijo - t / 2, y1: seg.fijo + t / 2 } : { x0: seg.fijo - t / 2, x1: seg.fijo + t / 2, y0: c - w / 2, y1: c + w / 2 };
    const o = { ...a, segmento: seg.id, orient: seg.orient, fijo: seg.fijo, centro: c, pos_mm: pos, largo_muro_mm: len, espesor: t, corte, ajustada, ext: seg.tipo === 'ext', desde: c - w / 2, hasta: c + w / 2 };
    if (a.tipo === 'puerta') {
      const objetivo = a.abre_hacia || (seg.entre ? seg.entre[0] : seg.recinto);
      const rr = rect[objetivo];
      if (!rr) { aberturas.push({ ...a, invalida: true, motivo: `abre_hacia ${objetivo} no existe.` }); continue; }
      const centroR = seg.orient === 'h' ? (rr.y0 + rr.y1) / 2 : (rr.x0 + rr.x1) / 2;
      const signo = centroR > seg.fijo ? 1 : -1; // hacia dónde abre (normal)
      const bisagraInicio = a.bisagra ? a.bisagra === 'inicio' : pos < len / 2;
      const hp = bisagraInicio ? o.desde : o.hasta; // coordenada de la bisagra a lo largo del muro
      const cerrado = bisagraInicio ? 1 : -1;       // dirección de la hoja cerrada (a lo largo del muro)
      const cara = seg.fijo + signo * (t / 2); // la hoja pivota en la cara del muro del lado del recinto al que abre
      const H = seg.orient === 'h' ? { x: hp, y: cara } : { x: cara, y: hp };
      const dirC = seg.orient === 'h' ? { x: cerrado, y: 0 } : { x: 0, y: cerrado };
      const dirA = seg.orient === 'h' ? { x: 0, y: signo } : { x: signo, y: 0 };
      const ang = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
      const cross = dirC.x * dirA.y - dirC.y * dirA.x;
      const a0 = cross > 0 ? ang(dirC) : ang(dirA); const a1 = cross > 0 ? ang(dirA) : ang(dirC);
      const norm = (g) => ((g % 360) + 360) % 360;
      const poly = [H]; for (let k = 0; k <= 12; k++) { const g = ((norm(a0) + (((norm(a1) - norm(a0) + 360) % 360) * k) / 12) * Math.PI) / 180; void g; }
      const A0 = norm(a0); const sweep = (norm(a1) - A0 + 360) % 360;
      for (let k = 0; k <= 12; k++) { const g = ((A0 + (sweep * k) / 12) * Math.PI) / 180; poly.push({ x: H.x + w * Math.cos(g), y: H.y + w * Math.sin(g) }); }
      o.hoja = { bisagra: H, abierta_hasta: { x: H.x + dirA.x * w, y: H.y + dirA.y * w }, cerrada_hasta: { x: H.x + dirC.x * w, y: H.y + dirC.y * w }, abre_hacia: objetivo, arco: { cx: H.x, cy: H.y, r: w, a0: A0, a1: (A0 + sweep) % 360 }, barrido: poly };
    }
    aberturas.push(o);
  }

  // --- vanos y unión de muros ---
  const cortes = aberturas.filter((a) => !a.invalida).map((a) => a.corte);
  const uni = unionMuros(rectsMuro, cortes);
  const bruta = unionMuros(rectsMuro, []);
  const areaConstruida = (exterior.x1 * exterior.y1) / 1e6;

  // --- cotas (geometría; no entidades DIMENSION) ---
  const xs = [...new Set(Object.values(rect).flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
  const ys = [...new Set(Object.values(rect).flatMap((r) => [r.y0, r.y1]))].sort((a, b) => a - b);
  const cotas = [];
  const cad = (orient, a, b, nivel, plano) => cotas.push({ orient, desde: a, hasta: b, valor_mm: Math.round(b - a), nivel, plano });
  for (let i = 0; i + 1 < xs.length; i++) cad('h', xs[i], xs[i + 1], 1, 'S');
  cad('h', exterior.x0, exterior.x1, 2, 'S');
  for (let i = 0; i + 1 < ys.length; i++) cad('v', ys[i], ys[i + 1], 1, 'O');
  cad('v', exterior.y0, exterior.y1, 2, 'O');

  // --- indicadores sísmicos básicos (referencia de anteproyecto; sin umbral normativo) ---
  const sis = SISTEMAS[modelo.sistema];
  const resist = murosSeg.filter((s) => s.tipo === 'ext' || sis.interiores_resistentes);
  let kx = 0; let ky = 0; let sx = 0; let sy = 0; const cm = { x: exterior.x1 / 2, y: exterior.y1 / 2 };
  for (const s of resist) {
    const huecos = aberturas.filter((a) => !a.invalida && a.segmento === s.id).reduce((acc, a) => acc + a.ancho_mm, 0);
    const lef = Math.max(0, s.hasta - s.desde - huecos); const k = lef * s.espesor;
    if (s.orient === 'h') { kx += k; sy += k * s.fijo; } else { ky += k; sx += k * s.fijo; }
  }
  const aPl = exterior.x1 * exterior.y1;
  const dx = kx / aPl; const dy = ky / aPl;
  const indicadores = {
    nota: 'Referencia de anteproyecto: no es un cálculo ni una verificación normativa; el ingeniero estructural define muros resistentes y su diseño.',
    densidad_muros_x_pct: R2(dx * 100), densidad_muros_y_pct: R2(dy * 100), balance_x_y: R2(Math.min(dx, dy) / Math.max(dx, dy, 1e-9)),
    excentricidad_x_pct: ky ? R2(((sx / ky - cm.x) / exterior.x1) * 100) : null, excentricidad_y_pct: kx ? R2(((sy / kx - cm.y) / exterior.y1) * 100) : null,
    sistema: modelo.sistema, interiores_considerados_resistentes: sis.interiores_resistentes,
  };

  const sumaNeta = Object.values(recintos).reduce((a, r) => a + r.area_neta_m2, 0);
  return {
    exterior, eje, rect, recintos, segmentos: segs, murosSeg, rectsMuro, aberturas, advertenciasDeriv, cotas, union: uni, unionBruta: bruta,
    areas: { construida_m2: R2(areaConstruida), util_neta_m2: R2(sumaNeta), muros_m2: R2(areaConstruida - sumaNeta), muros_union_bruta_m2: R2(bruta.area_mm2 / 1e6), vanos_m2: R2((bruta.area_mm2 - uni.area_mm2) / 1e6) },
    indicadores,
  };
}
