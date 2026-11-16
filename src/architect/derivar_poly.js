// Derivación geométrica genérica de un ArchitecturalSchemeV2: recintos rectangulares a ejes → muros, vanos, huella REAL (unión de
// polígonos, nunca caja envolvente), áreas, cotas y validaciones duras. El resultado tiene los mismos campos que `derivar` v1
// para reutilizar los emisores DXF/SVG y la coherencia 2D↔3D existentes.
import { UserError } from '../mcp/util.js';
import { unionMuros } from '../design/contorno.js';
import { rectDeAnillo, anilloDeRect, area, contornosDeUnion, enPoligono, bbox } from './poligonos.js';

const R2 = (v) => Math.round(v * 100) / 100;
const MARGEN = 300;

export function derivarEsquema(esq, { margen = MARGEN } = {}) {
  const te = esq.espesores_mm.ext; const ti = esq.espesores_mm.int;
  const errores = []; const advertencias = [];
  const info = new Map(esq.spaces.map((s) => [s.id, s]));
  if (info.size !== esq.spaces.length) throw new UserError('ESPACIO_REPETIDO', 'Hay recintos con el mismo id.');
  const rect = {};
  for (const s of esq.spaces) { const R = rectDeAnillo(s.ring); if (!R) throw new UserError('ESPACIO_NO_RECTANGULAR', `El recinto ${s.id} debe ser un rectángulo ortogonal (en esta versión los recintos son rectangulares; la huella sí puede ser L, U o con patio).`); rect[s.id] = R; }
  const ids = Object.keys(rect).sort();
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = rect[ids[i]]; const b = rect[ids[j]];
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0) throw new UserError('RECINTOS_SOLAPADOS', `Los recintos ${ids[i]} y ${ids[j]} se solapan.`);
  }
  const abierta = (a, b) => esq.separaciones_abiertas.some((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));

  // --- segmentos elementales por línea (H: y fijo; V: x fijo) ---
  const bordes = [];
  for (const id of ids) { const r = rect[id]; bordes.push({ o: 'h', f: r.y0, a: r.x0, b: r.x1, id, lado: 'S' }, { o: 'h', f: r.y1, a: r.x0, b: r.x1, id, lado: 'N' }, { o: 'v', f: r.x0, a: r.y0, b: r.y1, id, lado: 'O' }, { o: 'v', f: r.x1, a: r.y0, b: r.y1, id, lado: 'E' }); }
  const piezas = [];
  const grupos = new Map(); for (const e of bordes) { const k = `${e.o}|${e.f}`; (grupos.get(k) || grupos.set(k, []).get(k)).push(e); }
  for (const [k, lista] of grupos) {
    const [o, f] = k.split('|'); const cortes = [...new Set(lista.flatMap((e) => [e.a, e.b]))].sort((x, y) => x - y);
    for (let i = 0; i + 1 < cortes.length; i++) {
      const a = cortes[i]; const b = cortes[i + 1]; const cub = lista.filter((e) => e.a <= a && e.b >= b);
      if (!cub.length) continue;
      if (cub.length === 1) piezas.push({ o, f: Number(f), a, b, clave: `E|${cub[0].id}|${cub[0].lado}`, tipo: 'ext', recinto: cub[0].id, lado: cub[0].lado });
      else if (cub.length === 2) { const par = [cub[0].id, cub[1].id].sort(); piezas.push({ o, f: Number(f), a, b, clave: `I|${par.join('|')}`, tipo: 'int', entre: par, lados: cub }); }
      else throw new UserError('RECINTOS_SOLAPADOS', 'Aristas de más de dos recintos coinciden.');
    }
  }
  // fusionar contiguos de igual clave y línea
  const segs = []; const contadores = {};
  const orden = piezas.sort((p, q) => (p.o === q.o ? p.f - q.f || p.clave.localeCompare(q.clave) || p.a - q.a : p.o.localeCompare(q.o)));
  for (const p of orden) {
    const ult = segs[segs.length - 1];
    if (ult && ult._clave === p.clave && ult.orient === p.o && ult.fijo === p.f && ult.hasta === p.a) { ult.hasta = p.b; continue; }
    segs.push({ _clave: p.clave, orient: p.o, fijo: p.f, desde: p.a, hasta: p.b, tipo: p.tipo, espesor: p.tipo === 'ext' ? te : ti, ...(p.tipo === 'ext' ? { recinto: p.recinto, lado: p.lado } : { entre: p.entre, abierta: abierta(p.entre[0], p.entre[1]) }) });
  }
  for (const s of segs) { const base = s.tipo === 'ext' ? `E-${s.recinto}-${s.lado}` : `I-${s.entre[0]}-${s.entre[1]}`; contadores[base] = (contadores[base] || 0) + 1; s.id = contadores[base] === 1 ? base : `${base}~${contadores[base]}`; delete s._clave; }
  const murosSeg = segs.filter((s) => !s.abierta);

  // --- rectángulos de muro con extensión en encuentros ---
  const ext = (P, s) => {
    let e = 0;
    for (const o of murosSeg) {
      if (o === s || o.orient === s.orient) continue;
      const dentro = o.orient === 'h' ? (P[1] === o.fijo && P[0] >= o.desde && P[0] <= o.hasta) : (P[0] === o.fijo && P[1] >= o.desde && P[1] <= o.hasta);
      if (dentro) e = Math.max(e, o.espesor / 2);
    }
    return e;
  };
  const rectsMuro = murosSeg.map((s) => {
    const P1 = s.orient === 'h' ? [s.desde, s.fijo] : [s.fijo, s.desde]; const P2 = s.orient === 'h' ? [s.hasta, s.fijo] : [s.fijo, s.hasta];
    const e1 = ext(P1, s); const e2 = ext(P2, s); const t = s.espesor;
    return s.orient === 'h' ? { x0: s.desde - e1, x1: s.hasta + e2, y0: s.fijo - t / 2, y1: s.fijo + t / 2, clase: s.tipo } : { x0: s.fijo - t / 2, x1: s.fijo + t / 2, y0: s.desde - e1, y1: s.hasta + e2, clase: s.tipo };
  });

  // --- recintos netos ---
  const mitad = (r, lado) => {
    const cand = murosSeg.filter((s) => (lado === 'O' ? s.orient === 'v' && s.fijo === r.x0 && s.hasta > r.y0 && s.desde < r.y1 : lado === 'E' ? s.orient === 'v' && s.fijo === r.x1 && s.hasta > r.y0 && s.desde < r.y1 : lado === 'S' ? s.orient === 'h' && s.fijo === r.y0 && s.hasta > r.x0 && s.desde < r.x1 : s.orient === 'h' && s.fijo === r.y1 && s.hasta > r.x0 && s.desde < r.x1));
    return cand.length ? Math.max(...cand.map((s) => s.espesor / 2)) : 0;
  };
  const recintos = {};
  for (const id of ids) {
    const r = rect[id]; const base = info.get(id);
    const neto = { x0: r.x0 + mitad(r, 'O'), x1: r.x1 - mitad(r, 'E'), y0: r.y0 + mitad(r, 'S'), y1: r.y1 - mitad(r, 'N') };
    const w = neto.x1 - neto.x0; const d = neto.y1 - neto.y0;
    recintos[id] = { id, nombre: base.nombre, tipo: base.tipo, zona: base.zona, eje: r, neto, ancho_neto_mm: w, fondo_neto_mm: d, area_neta_m2: R2((w * d) / 1e6), relacion: R2(Math.max(w, d) / Math.min(w, d)) };
  }

  // --- aberturas ---
  const aberturas = [];
  for (const a of esq.openings) {
    const [cx, cy] = a.centro;
    const cand = murosSeg.filter((s) => {
      const enEje = s.orient === 'h' ? (cy === s.fijo && cx >= s.desde && cx <= s.hasta) : (cx === s.fijo && cy >= s.desde && cy <= s.hasta);
      if (!enEje) return false;
      if (a.entre.length === 2) return s.tipo === 'int' && s.entre.includes(a.entre[0]) && s.entre.includes(a.entre[1]);
      return s.tipo === 'ext' && s.recinto === a.entre[0] && (!a.exterior_side || s.lado === a.exterior_side);
    });
    const seg = cand[0];
    if (!seg) { aberturas.push({ ...a, ancho_mm: a.ancho_mm, invalida: true, motivo: `La abertura ${a.id} no está sobre un muro ${a.entre.length === 2 ? `compartido por ${a.entre.join(' y ')}` : `exterior de ${a.entre[0]}`} (centro ${cx},${cy}).` }); continue; }
    const len = seg.hasta - seg.desde; const w = a.ancho_mm; const pos = (seg.orient === 'h' ? cx : cy) - seg.desde;
    if (pos - w / 2 < margen - 1e-6 || pos + w / 2 > len - margen + 1e-6) { aberturas.push({ ...a, invalida: true, motivo: `La abertura ${a.id} (${w} mm) no cabe con ${margen} mm de margen a las esquinas en un muro de ${len} mm.` }); continue; }
    const c = seg.desde + pos; const t = seg.espesor;
    const corte = seg.orient === 'h' ? { x0: c - w / 2, x1: c + w / 2, y0: seg.fijo - t / 2, y1: seg.fijo + t / 2 } : { x0: seg.fijo - t / 2, x1: seg.fijo + t / 2, y0: c - w / 2, y1: c + w / 2 };
    const o = { ...a, segmento: seg.id, orient: seg.orient, fijo: seg.fijo, centro: c, pos_mm: pos, largo_muro_mm: len, espesor: t, corte, ajustada: false, ext: seg.tipo === 'ext', desde: c - w / 2, hasta: c + w / 2, alto_mm: a.alto_mm };
    if (a.tipo === 'puerta') {
      const objetivo = a.abre_hacia || a.entre[0]; const rr = rect[objetivo];
      if (!rr) { aberturas.push({ ...a, invalida: true, motivo: `abre_hacia ${objetivo} no existe.` }); continue; }
      const cR = seg.orient === 'h' ? (rr.y0 + rr.y1) / 2 : (rr.x0 + rr.x1) / 2; const signo = cR > seg.fijo ? 1 : -1;
      const bisInicio = pos < len / 2; const hp = bisInicio ? o.desde : o.hasta; const cerrado = bisInicio ? 1 : -1; const cara = seg.fijo + signo * (t / 2);
      const H = seg.orient === 'h' ? { x: hp, y: cara } : { x: cara, y: hp };
      const dirC = seg.orient === 'h' ? { x: cerrado, y: 0 } : { x: 0, y: cerrado }; const dirA = seg.orient === 'h' ? { x: 0, y: signo } : { x: signo, y: 0 };
      const ang = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI; const cross = dirC.x * dirA.y - dirC.y * dirA.x;
      const a0 = cross > 0 ? ang(dirC) : ang(dirA); const a1 = cross > 0 ? ang(dirA) : ang(dirC); const norm = (g) => ((g % 360) + 360) % 360;
      const A0 = norm(a0); const sweep = (norm(a1) - A0 + 360) % 360; const poly = [H];
      for (let k = 0; k <= 12; k++) { const g = ((A0 + (sweep * k) / 12) * Math.PI) / 180; poly.push({ x: H.x + w * Math.cos(g), y: H.y + w * Math.sin(g) }); }
      o.hoja = { bisagra: H, abierta_hasta: { x: H.x + dirA.x * w, y: H.y + dirA.y * w }, cerrada_hasta: { x: H.x + dirC.x * w, y: H.y + dirC.y * w }, abre_hacia: objetivo, arco: { cx: H.x, cy: H.y, r: w, a0: A0, a1: (A0 + sweep) % 360 }, barrido: poly };
    }
    aberturas.push(o);
  }
  // solape de vanos en un mismo muro
  const porSeg = {}; for (const a of aberturas.filter((x) => !x.invalida)) (porSeg[a.segmento] ||= []).push(a);
  for (const lista of Object.values(porSeg)) { lista.sort((p, q) => p.desde - q.desde); for (let i = 1; i < lista.length; i++) if (lista[i].desde < lista[i - 1].hasta) { lista[i].invalida = true; lista[i].motivo = `La abertura ${lista[i].id} se solapa con ${lista[i - 1].id}.`; } }
  for (const a of aberturas.filter((x) => x.invalida)) errores.push({ codigo: 'VANO_INVALIDO', id: a.id, mensaje: a.motivo });

  // --- huella real, huecos y áreas ---
  const cortes = aberturas.filter((a) => !a.invalida).map((a) => a.corte);
  const union = unionMuros(rectsMuro, cortes); const unionBruta = unionMuros(rectsMuro, []);
  const huella = contornosDeUnion([...rectsMuro, ...ids.map((id) => rect[id])]);
  const huecos = huella.anillos.filter((a) => a.hueco); const exteriores = huella.anillos.filter((a) => !a.hueco);
  const centros = esq.open_courts_mm.map((r) => { const b = bbox([r]); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; });
  for (const h of huecos) if (!centros.some((c) => enPoligono(c[0], c[1], h.ring))) errores.push({ codigo: 'HUECO_NO_DECLARADO', mensaje: 'Hay un vacío interior en la planta que no está declarado como patio (open_courts_mm).' });
  for (const c of centros) if (!huecos.some((h) => enPoligono(c[0], c[1], h.ring))) errores.push({ codigo: 'PATIO_INEXISTENTE', mensaje: 'Un patio declarado no corresponde a un vacío de la planta.' });
  // huella declarada = unión de los recintos a ejes
  const axis = contornosDeUnion(ids.map((id) => rect[id]));
  const declarada = esq.footprint_polygons_mm.reduce((a, r) => a + area(r), 0) - esq.open_courts_mm.reduce((a, r) => a + area(r), 0);
  if (Math.abs(declarada - axis.area_mm2) > 1) errores.push({ codigo: 'HUELLA_INCONSISTENTE', mensaje: `La huella declarada (${R2(declarada / 1e6)} m²) no coincide con la unión de recintos (${R2(axis.area_mm2 / 1e6)} m²).` });

  // --- acceso: grafo de pasos (puertas/pasos y separaciones abiertas) desde el exterior ---
  const adj = new Map([['EXT', new Set()], ...ids.map((i) => [i, new Set()])]);
  const un = (a, b) => { adj.get(a).add(b); adj.get(b).add(a); };
  for (const a of aberturas.filter((x) => !x.invalida && (x.tipo === 'puerta' || x.tipo === 'paso'))) { if (a.entre.length === 2) un(a.entre[0], a.entre[1]); else un(a.entre[0], 'EXT'); }
  for (const [x, y] of esq.separaciones_abiertas) if (adj.has(x) && adj.has(y)) un(x, y);
  const vis = new Set(['EXT']); const cola = ['EXT']; while (cola.length) { const u = cola.shift(); for (const v of adj.get(u)) if (!vis.has(v)) { vis.add(v); cola.push(v); } }
  for (const id of ids) if (!vis.has(id)) errores.push({ codigo: 'RECINTO_SIN_ACCESO', id, mensaje: `El recinto ${id} (${info.get(id).nombre}) no tiene acceso: ninguna puerta o paso lo conecta con el exterior.` });

  // --- cotas (cadenas a ejes + total de la huella) ---
  const xs = [...new Set(ids.flatMap((id) => [rect[id].x0, rect[id].x1]))].sort((a, b) => a - b); const ys = [...new Set(ids.flatMap((id) => [rect[id].y0, rect[id].y1]))].sort((a, b) => a - b);
  const ex = bbox(rectsMuro.map(anilloDeRect)); const cotas = [];
  const cad = (orient, a, b, nivel, plano) => cotas.push({ orient, desde: a, hasta: b, valor_mm: Math.round(b - a), nivel, plano });
  for (let i = 0; i + 1 < xs.length; i++) cad('h', xs[i], xs[i + 1], 1, 'S');
  cad('h', ex.x0, ex.x1, 2, 'S');
  for (let i = 0; i + 1 < ys.length; i++) cad('v', ys[i], ys[i + 1], 1, 'O');
  cad('v', ex.y0, ex.y1, 2, 'O');

  const sumaNeta = Object.values(recintos).reduce((a, r) => a + r.area_neta_m2, 0);
  const areaHuella = huella.area_mm2 / 1e6;
  return {
    exterior: ex, // caja envolvente: SOLO para extensión de ejes y cota total; el contorno real es `huella`/`union`
    eje: bbox(ids.map((id) => anilloDeRect(rect[id]))), rect, recintos, segmentos: segs, murosSeg, rectsMuro, aberturas, advertenciasDeriv: advertencias, cotas, union, unionBruta,
    huella: { anillos: huella.anillos, area_m2: R2(areaHuella), area_caja_envolvente_m2: R2(((ex.x1 - ex.x0) * (ex.y1 - ex.y0)) / 1e6), huecos: huecos.length },
    areas: { construida_m2: R2(areaHuella), util_neta_m2: R2(sumaNeta), muros_m2: R2(areaHuella - sumaNeta), muros_union_bruta_m2: R2(unionBruta.area_mm2 / 1e6), vanos_m2: R2((unionBruta.area_mm2 - union.area_mm2) / 1e6) },
    errores, advertencias, anillos_exteriores: exteriores.length,
  };
}

/** Huella a ejes (anillos) de una lista de recintos: para llenar `footprint_polygons_mm`. */
export function huellaDeEspacios(spaces) {
  const r = contornosDeUnion(spaces.map((s) => rectDeAnillo(s.ring)));
  return r.anillos.filter((a) => !a.hueco).map((a) => a.ring);
}
