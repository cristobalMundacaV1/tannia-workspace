// Habitabilidad: recorridos, visuales (ray casting), privacidad, seguridad (piscina) y constructibilidad relativa.
// Heurísticas versionadas y editables, NO normativas; la línea visual nunca sustituye barreras ni supervisión.
import { escena, rayoGolpea } from './sombras.js';
import { bbox } from './poligonos.js';
import { firmaHuella } from './diversidad.js';

export const UMBRALES = { version: 'heur-1', privacidad_distancia_mm: 8000, privacidad_ventanas_enfrentadas_mm: 6000, ancho_puerta_min_mm: 800, altura_ojo_mm: 1500, altura_objetivo_visual_mm: 900, no_normativo: true };
const R1 = (v) => Math.round(v * 10) / 10; const R2 = (v) => Math.round(v * 100) / 100;
const centro = (geo, id) => { const n = geo.recintos[id].neto; return [(n.x0 + n.x1) / 2, (n.y0 + n.y1) / 2]; };

// ---------------- recorridos ----------------
export function recorridos(esq, geo) {
  // nodos: centros de recinto y puntos de paso (puertas/pasos y separaciones abiertas)
  const nodos = new Map(); const aristas = [];
  const add = (id, p) => nodos.set(id, p); const arista = (a, b, w) => { aristas.push([a, b, w]); aristas.push([b, a, w]); };
  for (const id of Object.keys(geo.recintos)) add(`R:${id}`, centro(geo, id));
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  for (const a of geo.aberturas.filter((x) => !x.invalida && (x.tipo === 'puerta' || x.tipo === 'paso'))) {
    const p = a.orient === 'h' ? [a.centro, a.fijo] : [a.fijo, a.centro]; add(`D:${a.id}`, p);
    if (a.entre.length === 2) { arista(`D:${a.id}`, `R:${a.entre[0]}`, d(p, nodos.get(`R:${a.entre[0]}`))); arista(`D:${a.id}`, `R:${a.entre[1]}`, d(p, nodos.get(`R:${a.entre[1]}`))); }
    else { add('EXT', [p[0], p[1]]); arista(`D:${a.id}`, `R:${a.entre[0]}`, d(p, nodos.get(`R:${a.entre[0]}`))); if (a.funcion === 'acceso') arista('EXT', `D:${a.id}`, 0); else arista('EXT_PATIO', `D:${a.id}`, 0); }
  }
  for (const [x, y] of esq.separaciones_abiertas) { const seg = geo.segmentos.find((s) => s.tipo === 'int' && s.abierta && s.entre.includes(x) && s.entre.includes(y)); if (!seg) continue; const mid = seg.orient === 'h' ? [(seg.desde + seg.hasta) / 2, seg.fijo] : [seg.fijo, (seg.desde + seg.hasta) / 2]; const id = `O:${x}|${y}`; add(id, mid); arista(id, `R:${x}`, d(mid, nodos.get(`R:${x}`))); arista(id, `R:${y}`, d(mid, nodos.get(`R:${y}`))); }
  const adj = new Map(); for (const [a, b, w] of aristas) (adj.get(a) || adj.set(a, []).get(a)).push([b, w]);
  const dijkstra = (src) => { const dist = new Map([[src, 0]]); const prev = new Map(); const q = [[0, src]]; while (q.length) { q.sort((a, b) => a[0] - b[0]); const [du, u] = q.shift(); if (du > (dist.get(u) ?? Infinity)) continue; for (const [v, w] of adj.get(u) ?? []) { const nd = du + w; if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); q.push([nd, v]); } } } return { dist, prev }; };
  const camino = (prev, a, b) => { const out = []; let u = b; while (u && u !== a) { if (u.startsWith('R:')) out.unshift(u.slice(2)); u = prev.get(u); } return out; };
  const ent = dijkstra('EXT'); const tiene = adj.has('EXT');
  const porRecinto = {}; for (const id of Object.keys(geo.recintos)) porRecinto[id] = tiene && ent.dist.has(`R:${id}`) ? { distancia_m: R1(ent.dist.get(`R:${id}`) / 1000), ruta: camino(ent.prev, 'EXT', `R:${id}`) } : { distancia_m: null, ruta: null };
  const par = (a, b) => { if (!geo.recintos[a] || !geo.recintos[b]) return null; const r = dijkstra(`R:${a}`); return r.dist.has(`R:${b}`) ? { distancia_m: R1(r.dist.get(`R:${b}`) / 1000), ruta: [a, ...camino(r.prev, `R:${a}`, `R:${b}`)] } : { distancia_m: null, ruta: null }; };
  const tipo = (t) => Object.values(geo.recintos).filter((r) => r.tipo === t || (t === 'dormitorio' && r.tipo === 'dormitorio_principal')).map((r) => r.id);
  const cruces = []; // trayectos dormitorio → baño que cruzan la zona social (living/cocina)
  for (const dm of tipo('dormitorio')) for (const bn of tipo('bano')) { const p = par(dm, bn); if (p?.ruta && p.ruta.some((r) => geo.recintos[r]?.zona === 'social') && p.ruta[0] !== dm) cruces.push({ dormitorio: dm, bano: bn }); else if (p?.ruta && p.ruta.slice(1, -1).some((r) => geo.recintos[r]?.zona === 'social')) cruces.push({ dormitorio: dm, bano: bn, ruta: p.ruta }); }
  const sup = (t) => Object.values(geo.recintos).filter((r) => r.zona === t).reduce((a, r) => a + r.area_neta_m2, 0); const util = geo.areas.util_neta_m2;
  const salidas = esq.openings.filter((a) => a.entre.length === 1 && a.tipo === 'puerta');
  return {
    desde_acceso: porRecinto, cocina_a_living: par('R-COC', 'R-LIV'), baños_a_dormitorios: tipo('bano').flatMap((b) => tipo('dormitorio').map((dm) => ({ bano: b, dormitorio: dm, ...par(dm, b) }))).slice(0, 12),
    circulacion_pct: R1((sup('circulacion') * 100) / util), superficie_circulacion_m2: R2(sup('circulacion')), cruces_por_zona_social: cruces, salidas_exteriores: salidas.length,
    recintos_sin_ruta: Object.entries(porRecinto).filter(([, v]) => v.distancia_m == null).map(([k]) => k),
    metodo: 'camino mínimo por centros de recinto y puntos de puerta/paso (distancia en planta)', limites: 'Distancias geométricas; no es flujo real de personas ni verificación de accesibilidad o evacuación normativa.',
  };
}

// ---------------- visuales ----------------
function puntosObjetivo(esq, objetivoId) {
  const ea = esq.exterior_areas.find((e) => e.id === objetivoId && e.ring); if (!ea) return null; const b = bbox([ea.ring]); const pts = [];
  const nx = 4; const ny = 4; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push([b.x0 + ((i + 0.5) * (b.x1 - b.x0)) / nx, b.y0 + ((j + 0.5) * (b.y1 - b.y0)) / ny, UMBRALES.altura_objetivo_visual_mm]);
  return pts;
}
export function visual(esq, geo, { desde, hacia, sitio = null } = {}) {
  const pts = puntosObjetivo(esq, hacia);
  if (!geo.recintos[desde]) return { estado: 'no_evaluado', razon: `El recinto ${desde} no existe en este partido.` };
  if (!pts) return { estado: 'no_evaluado', razon: `El partido no define la zona "${hacia}" (p. ej. sin patio/piscina): no se puede evaluar la visual.` };
  const e = escena(esq, geo, { sitio }); const n = geo.recintos[desde].neto; const ojos = [];
  for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) ojos.push([n.x0 + fx * (n.x1 - n.x0), n.y0 + fy * (n.y1 - n.y0), UMBRALES.altura_ojo_mm]);
  let mejor = 0; let suma = 0; const bloqueos = new Map();
  for (const o of ojos) { let v = 0; for (const t of pts) { const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]]; const L = Math.hypot(...d); const u = d.map((x) => x / L); const hit = rayoGolpea(o, u, e.cajas, { tmax: L - 1 }); if (!hit) v++; else bloqueos.set(hit.origen, (bloqueos.get(hit.origen) || 0) + 1); } mejor = Math.max(mejor, v / pts.length); suma += v / pts.length; }
  const media = suma / ojos.length;
  return { estado: mejor >= 0.5 ? 'visible' : mejor > 0 ? 'parcial' : 'obstruida', fraccion_visible_mejor_punto: R2(mejor), fraccion_visible_media_recinto: R2(media), bloqueado_por: [...bloqueos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    supuestos: ['Puertas interiores abiertas y vanos sin vidrio opaco', `Ojo a ${UMBRALES.altura_ojo_mm} mm y objetivo a ${UMBRALES.altura_objetivo_visual_mm} mm (supuestos editables)`], limites: 'La línea visual NO sustituye barreras independientes ni supervisión adulta activa.' };
}

// ---------------- seguridad (piscina y salidas) ----------------
export function seguridad(esq, geo, { hayPiscina = null } = {}) {
  const alertas = []; const pool = esq.exterior_areas.find((e) => e.id === 'pool_play_zone'); const piscina = hayPiscina ?? !!pool;
  if (piscina) {
    alertas.push({ id: 'piscina_barrera', severidad: 'critica', texto: 'Piscina en el programa: se requiere barrera independiente, control de acceso y supervisión activa, verificados por un profesional con la normativa vigente. La visual desde la casa no los reemplaza.' });
    for (const a of esq.openings.filter((o) => o.entre.length === 1 && o.tipo === 'puerta' && o.funcion !== 'acceso')) if (pool && (a.control_acceso ?? pool.access_control ?? 'none') !== 'controlled') alertas.push({ id: `puerta_directa_${a.id}`, severidad: 'critica', texto: `La puerta ${a.id} da directamente al patio con piscina sin control de acceso definido: no puede declararse seguridad demostrada.` });
  }
  const salidas = esq.openings.filter((a) => a.entre.length === 1 && a.tipo === 'puerta').length;
  if (salidas < 2) alertas.push({ id: 'una_salida', severidad: 'media', texto: 'La vivienda tiene una sola puerta exterior: revisar rutas de evacuación y salidas con la profesional (no se verifica norma).' });
  const anchos = esq.openings.filter((a) => a.tipo === 'puerta').map((a) => a.ancho_mm); const minA = anchos.length ? Math.min(...anchos) : null;
  return { piscina, alertas, seguridad_demostrada: false, motivo_no_demostrada: piscina ? 'Faltan barreras/supervisión verificadas por profesional.' : 'La seguridad no se demuestra con el código; solo se señalan alertas.', puertas_exteriores: salidas, ancho_puerta_min_mm: minA, accesibilidad_info: minA != null && minA < UMBRALES.ancho_puerta_min_mm ? `Hay puertas de ${minA} mm (<${UMBRALES.ancho_puerta_min_mm} mm de referencia de práctica): revisar accesibilidad si el encargo la exige.` : 'Anchos de puerta ≥ referencia de práctica; no es verificación normativa.' };
}

// ---------------- privacidad ----------------
export function privacidad(esq, geo, { sitio = null } = {}) {
  const hallazgos = []; const aberts = geo.aberturas.filter((a) => !a.invalida && a.ext && a.tipo === 'ventana');
  const info = (a) => { const seg = geo.murosSeg.find((s) => s.id === a.segmento); return { a, seg, n: { S: [0, -1], N: [0, 1], E: [1, 0], O: [-1, 0] }[seg.lado], c: a.orient === 'h' ? [a.centro, a.fijo] : [a.fijo, a.centro], zona: geo.recintos[seg.recinto].zona }; };
  const W = aberts.map(info);
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
    const p = W[i]; const q = W[j]; if (p.n[0] + q.n[0] !== 0 || p.n[1] + q.n[1] !== 0) continue; // enfrentadas (normales opuestas)
    const dx = q.c[0] - p.c[0]; const dy = q.c[1] - p.c[1]; const frente = dx * p.n[0] + dy * p.n[1]; const lateral = Math.abs(dx * -p.n[1] + dy * p.n[0]);
    if (frente > 0 && frente <= UMBRALES.privacidad_ventanas_enfrentadas_mm && lateral < (p.a.ancho_mm + q.a.ancho_mm) / 2 + 500 && (p.zona === 'privada' || q.zona === 'privada') && p.seg.recinto !== q.seg.recinto) hallazgos.push({ tipo: 'ventanas_enfrentadas', a: p.a.id, b: q.a.id, distancia_mm: Math.round(frente), texto: `Las ventanas ${p.a.id} y ${q.a.id} se enfrentan a ${Math.round(frente)} mm (una es de zona privada).` });
  }
  let vecinos = 'no_evaluado'; const razon = [];
  if (sitio?.parcel_polygon_mm || sitio?.context_obstacles?.length) {
    vecinos = 'evaluado'; const e = escena(esq, geo, { sitio }); void e;
    for (const w of W.filter((x) => x.zona === 'privada')) {
      const P = sitio.parcel_polygon_mm?.ring; if (P) { const b = bbox([P]); const dist = w.n[0] > 0 ? b.x1 - w.c[0] : w.n[0] < 0 ? w.c[0] - b.x0 : w.n[1] > 0 ? b.y1 - w.c[1] : w.c[1] - b.y0; if (dist < UMBRALES.privacidad_distancia_mm) hallazgos.push({ tipo: 'dormitorio_cerca_del_deslinde', ventana: w.a.id, distancia_mm: Math.round(dist), texto: `La ventana ${w.a.id} de zona privada mira a un deslinde a ${Math.round(dist)} mm (<${UMBRALES.privacidad_distancia_mm} mm de referencia heurística): posible vista desde/hacia el vecino.` }); }
      for (const o of sitio.context_obstacles ?? []) { const b = bbox([o.ring]); const frente = w.n[0] > 0 ? b.x0 - w.c[0] : w.n[0] < 0 ? w.c[0] - b.x1 : w.n[1] > 0 ? b.y0 - w.c[1] : w.c[1] - b.y1; if (frente > 0 && frente < UMBRALES.privacidad_distancia_mm) hallazgos.push({ tipo: 'vista_a_vecino', ventana: w.a.id, obstaculo: o.id, distancia_mm: Math.round(frente), texto: `La ventana ${w.a.id} mira al volumen vecino ${o.id} a ${Math.round(frente)} mm.` }); }
    }
  } else razon.push('Sin predio ni vecinos: solo se evalúa la privacidad interna (ventanas enfrentadas).');
  return { hallazgos, privacidad_vecinos: vecinos, razon, umbrales: UMBRALES, limites: 'Geométrica y heurística; no considera cortinas, vegetación ni usos culturales de la privacidad.' };
}

// ---------------- constructibilidad / economía relativa ----------------
export function constructibilidad(esq, geo) {
  const f = firmaHuella(geo); const A = geo.huella.area_m2; const per = geo.segmentos.filter((s) => s.tipo === 'ext').reduce((a, s) => a + (s.hasta - s.desde), 0) / 1000;
  const ideal = 4 * Math.sqrt(A); const indice = per / ideal; const hum = Object.values(geo.recintos).filter((r) => r.tipo === 'bano' || r.tipo === 'cocina'); let dmax = 0;
  for (let i = 0; i < hum.length; i++) for (let j = i + 1; j < hum.length; j++) { const a = centro(geo, hum[i].id); const b = centro(geo, hum[j].id); dmax = Math.max(dmax, Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])); }
  const alertas = []; if (f.concavos > 0) alertas.push({ id: 'planta_irregular', severidad: 'media', texto: `La planta tiene ${f.concavos} esquina(s) entrante(s): una planta no rectangular exige que el ingeniero estructural revise su regularidad (no se afirma nada sobre sismo).` });
  if (f.huecos > 0) alertas.push({ id: 'patio_interior', severidad: 'media', texto: 'Patio interior: cubiertas y desagües perimetrales más complejos.' });
  return { perimetro_exterior_m: R1(per), area_huella_m2: A, indice_envolvente: R2(indice), indice_ref: 'perímetro exterior / perímetro de un cuadrado de igual área (1,00 = ideal)', esquinas_entrantes: f.concavos, quiebres: f.vertices, piezas_de_cubierta_planas: geo.huella.anillos.filter((a) => !a.hueco).length + f.huecos, distancia_maxima_entre_humedos_m: R1(dmax / 1000), clase_huella: f.clase, alertas,
    precio: { estado: 'no_estimado', razon: 'Sin partidas, cubicaciones ni precios confirmados no se estima ningún valor en pesos.' }, limites: 'Índices geométricos relativos; no son presupuesto ni verificación estructural/hidráulica.' };
}
