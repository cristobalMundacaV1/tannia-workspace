// Confianza en el DWG: comparaciones TIPADAS (según las propiedades reales de cada entidad) y fidelidad DXF → DWG.
// Puro y determinista: se prueba sin AutoCAD con lecturas sintéticas; en uso real recibe lo que informa COM.
import { dxfDecode } from '../design/salidas.js';

const R = (v, d = 3) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace(/^-0\.0+$/, (m) => m.slice(1)) : 'NaN');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
const TWO_PI = 2 * Math.PI;

/** Propiedades que DEBEN existir y compararse por tipo de entidad (las demás son informativas). */
export const PROPIEDADES_POR_TIPO = {
  AcDbLine: ['inicio', 'fin'],
  AcDbArc: ['centro', 'radio', 'angulo_inicio', 'angulo_fin', 'longitud_arco'],
  AcDbCircle: ['centro', 'radio'],
  AcDbPolyline: ['coordenadas', 'cerrada'],
  AcDb2dPolyline: ['coordenadas', 'cerrada'],
  AcDbText: ['texto', 'altura', 'posicion_efectiva'],
  AcDbMText: ['texto', 'altura', 'posicion'],
  AcDb3dSolid: ['volumen', 'centroide'],
};
/** Propiedades que se comparan SOLO si AutoCAD las informó en ambas lecturas (no bloquean si faltan). */
const OPCIONALES_POR_TIPO = { AcDb3dSolid: ['bbox_min', 'bbox_max'] };

/** Posición efectiva de un texto: con justificación, AutoCAD usa el punto de alineación; si no, el punto de inserción. */
export function posicionEfectiva(e) {
  if (e.alineacion != null && e.alineacion !== 0 && Array.isArray(e.punto_alineacion)) return e.punto_alineacion;
  return e.posicion ?? null;
}
const vista = (e) => ({ ...e, ...(e.tipo === 'AcDbText' ? { posicion_efectiva: posicionEfectiva(e) } : {}) });

const igualNum = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a));
function iguales(a, b, tol) {
  if (typeof a === 'number' && typeof b === 'number') return igualNum(a, b, tol);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => iguales(v, b[i], tol));
  return a === b;
}

/**
 * Compara lecturas ANTES/DESPUÉS de cerrar y reabrir. Una propiedad que AutoCAD no informa NO se compara como null=null:
 * se declara `no_verificable` y el resultado deja de ser "verificada".
 */
export function compararLecturas(antes, despues, { tol = 1e-6 } = {}) {
  const diferencias = []; const noVerificables = []; const inconsistencias = []; const cobertura = {};
  const mapa = new Map(despues.map((d) => [String(d.handle).toUpperCase(), d]));
  for (const a0 of antes) {
    const h = String(a0.handle).toUpperCase(); const d0 = mapa.get(h);
    if (a0.error) { diferencias.push({ handle: a0.handle, problema: 'no_existia_antes_de_cerrar' }); continue; }
    const c = (cobertura[a0.tipo] ||= { entidades: 0, verificadas: 0, propiedades_comparadas: 0 }); c.entidades++;
    if (!d0 || d0.error) { diferencias.push({ handle: a0.handle, tipo: a0.tipo, problema: 'desaparecio_tras_reabrir' }); continue; }
    const a = vista(a0); const d = vista(d0);
    if (a.capa !== d.capa) diferencias.push({ handle: a.handle, tipo: a.tipo, problema: 'capa_distinta', antes: a.capa, despues: d.capa });
    if (a.tipo !== d.tipo) { diferencias.push({ handle: a.handle, problema: 'tipo_distinto', antes: a.tipo, despues: d.tipo }); continue; }
    const props = PROPIEDADES_POR_TIPO[a.tipo];
    if (!props) { noVerificables.push({ handle: a.handle, tipo: a.tipo, motivo: 'tipo_de_entidad_sin_comparador' }); continue; }
    let completa = true;
    for (const k of props) {
      if (a[k] == null) { noVerificables.push({ handle: a.handle, tipo: a.tipo, propiedad: k, motivo: 'AutoCAD no informó la propiedad antes de cerrar' }); completa = false; continue; }
      if (d[k] == null) { diferencias.push({ handle: a.handle, tipo: a.tipo, problema: 'propiedad_perdida', propiedad: k, antes: a[k] }); completa = false; continue; }
      c.propiedades_comparadas++;
      if (!iguales(a[k], d[k], tol)) { diferencias.push({ handle: a.handle, tipo: a.tipo, problema: `${k}_distinto`, antes: a[k], despues: d[k] }); completa = false; }
    }
    for (const k of OPCIONALES_POR_TIPO[a.tipo] || []) {
      if (a[k] == null || d[k] == null) continue;
      c.propiedades_comparadas++;
      if (!iguales(a[k], d[k], tol)) { diferencias.push({ handle: a.handle, tipo: a.tipo, problema: `${k}_distinto`, antes: a[k], despues: d[k] }); completa = false; }
    }
    for (const x of coherenciaInterna(d)) inconsistencias.push({ handle: d.handle, tipo: d.tipo, ...x });
    if (completa) c.verificadas++;
  }
  const estado = diferencias.length ? 'fallida' : (noVerificables.length || inconsistencias.length) ? 'no_concluyente' : 'verificada';
  return { estado, diferencias, no_verificables: noVerificables, inconsistencias_internas: inconsistencias, cobertura };
}

/** Coherencia entre propiedades de una misma lectura (detecta lecturas COM defectuosas, p. ej. longitud de arco 0). */
export function coherenciaInterna(e, tol = 1e-6) {
  const out = [];
  if (e.tipo === 'AcDbArc' && e.radio != null && e.angulo_inicio != null && e.angulo_fin != null) {
    let sweep = (e.angulo_fin - e.angulo_inicio) % TWO_PI; if (sweep <= 0) sweep += TWO_PI;
    const esperado = e.radio * sweep;
    if (e.longitud_arco == null) out.push({ problema: 'arco_sin_longitud_informada' });
    else if (!(Math.abs(e.longitud_arco - esperado) <= Math.max(1e-6, 1e-6 * esperado))) out.push({ problema: 'arco_longitud_incoherente', informada: e.longitud_arco, calculada: esperado });
  }
  if (e.tipo === 'AcDbLine' && e.inicio && e.fin && e.longitud != null && Math.abs(e.longitud - dist(e.inicio, e.fin)) > Math.max(tol, 1e-6 * e.longitud)) out.push({ problema: 'linea_longitud_incoherente', informada: e.longitud, calculada: dist(e.inicio, e.fin) });
  return out;
}

// ---------- Fidelidad DXF → DWG (contrato por tipo de entidad; Astra A-03/E07) ----------
// Contrato de la operación «importar DXF y guardar DWG»: cada entidad conserva tipo, CAPA, geometría y, en polilíneas, la
// SECUENCIA de vértices (orden y sentido; en cerradas se admite otro vértice inicial), bulges (arcos) y elevación. Dos
// polilíneas con los mismos vértices pero distinta conectividad NO son equivalentes. Entidades sin comparador (bloques,
// cotas, sombreados, MTEXT…) o propiedades que AutoCAD no informó dejan el resultado NO CONCLUYENTE: un conteo no acredita.
const deg = (rad) => ((((rad * 180) / Math.PI) % 360) + 360) % 360;
const xy = (p) => `${R(p.x ?? p[0])},${R(p.y ?? p[1])}`;
const ordenar = (...v) => v.sort();
const B = (b) => R(Number(b) || 0, 6);

/** Secuencia canónica de vértices: abierta = exacta; cerrada = rotación con inicio mínimo, MISMO sentido (no se invierte). */
export function secuenciaCanonica(vs, cerrada) {
  const items = vs.map((v) => `${xy(v)}@${v.b === null ? '?' : B(v.b)}`);
  if (!cerrada || items.length < 2) return items.join(';');
  let mejor = null;
  for (let k = 0; k < items.length; k++) { const rot = [...items.slice(k), ...items.slice(0, k)].join(';'); if (mejor === null || rot < mejor) mejor = rot; }
  return mejor;
}
const elev = (e) => R(Number(e) || 0);

/** Firmas esperadas leídas del DXF (verdad de origen). `sin_comparador` = tipo que esta operación no puede verificar. */
export function firmasDesdeDxf(dxf) {
  const out = [];
  for (const e of dxf.entities) {
    const capa = e.layer ?? '0';
    const extrusionNoEstandar = e.extrusion && (Math.abs(e.extrusion.x) > 1e-9 || Math.abs(e.extrusion.y) > 1e-9 || Math.abs(e.extrusion.z - 1) > 1e-9);
    if (extrusionNoEstandar && e.type !== 'LINE') { out.push({ tipo: e.type, capa, firma: `OCS|${capa}|${e.type}`, sin_comparador: 'sistema de coordenadas de objeto (OCS) no estándar' }); continue; }
    if (e.type === 'LINE') out.push({ tipo: 'AcDbLine', capa, firma: `LINE|${capa}|${ordenar(xy(e.a), xy(e.b)).join('|')}` });
    else if (e.type === 'ARC') out.push({ tipo: 'AcDbArc', capa, firma: `ARC|${capa}|${xy(e.c)}|${R(e.r)}|${R(((e.a0 % 360) + 360) % 360)}|${R(((e.a1 % 360) + 360) % 360)}` });
    else if (e.type === 'CIRCLE') out.push({ tipo: 'AcDbCircle', capa, firma: `CIRCLE|${capa}|${xy(e.c)}|${R(e.r)}` });
    else if (e.type === 'LWPOLYLINE' || (e.type === 'POLYLINE' && !e.poly3d && !e.polygonMesh && !e.polyface)) {
      const vs = e.verts.map((v) => ({ x: v.x, y: v.y, b: v.bulge || 0 }));
      out.push({ tipo: 'poli', capa, firma: `POLY|${capa}|${e.closed ? 'c' : 'a'}|z=${elev(e.elevation)}|${secuenciaCanonica(vs, e.closed)}`, base: `POLY|${capa}|${e.closed ? 'c' : 'a'}|${secuenciaCanonica(vs.map((v) => ({ ...v, b: null })), e.closed)}` });
    } else if (e.type === 'TEXT') { const pos = e.just ? e.alin : e.p; out.push({ tipo: 'AcDbText', capa, firma: `TEXT|${capa}|${dxfDecode(e.text)}|${R(e.altura)}|${xy(pos)}|${R(((e.rot || 0) % 360 + 360) % 360)}` }); }
    else out.push({ tipo: e.type, capa, firma: `OTRO|${capa}|${e.type}`, sin_comparador: `la operación no tiene comparador geométrico para ${e.type}` });
  }
  return out;
}

/** Firmas de lo que AutoCAD informa (lecturas tipadas). Si falta una propiedad del contrato, la firma queda incompleta. */
export function firmasDesdeCom(lecturas) {
  const out = []; const ilegibles = [];
  for (const l of lecturas) {
    if (l.error) { ilegibles.push({ handle: l.handle, motivo: l.error }); continue; }
    const capa = l.capa ?? '0';
    if (l.tipo === 'AcDbLine' && l.inicio && l.fin) out.push({ tipo: l.tipo, capa, handle: l.handle, firma: `LINE|${capa}|${ordenar(xy(l.inicio), xy(l.fin)).join('|')}` });
    else if (l.tipo === 'AcDbArc' && l.centro && l.radio != null) out.push({ tipo: l.tipo, capa, handle: l.handle, firma: `ARC|${capa}|${xy(l.centro)}|${R(l.radio)}|${R(deg(l.angulo_inicio))}|${R(deg(l.angulo_fin))}` });
    else if (l.tipo === 'AcDbCircle' && l.centro && l.radio != null) out.push({ tipo: l.tipo, capa, handle: l.handle, firma: `CIRCLE|${capa}|${xy(l.centro)}|${R(l.radio)}` });
    else if ((l.tipo === 'AcDbPolyline' || l.tipo === 'AcDb2dPolyline') && l.coordenadas) {
      const paso = l.tipo === 'AcDb2dPolyline' ? 3 : 2; const vs = [];
      for (let i = 0; i + 1 < l.coordenadas.length; i += paso) vs.push({ x: l.coordenadas[i], y: l.coordenadas[i + 1], b: null });
      const conBulge = Array.isArray(l.bulges) && l.bulges.length === vs.length;
      if (conBulge) vs.forEach((v, i) => { v.b = l.bulges[i]; });
      const faltan = [...(conBulge ? [] : ['bulges']), ...(l.elevacion == null ? ['elevacion'] : [])];
      const c = l.cerrada ? 'c' : 'a';
      out.push({ tipo: 'poli', capa, handle: l.handle, firma: faltan.length ? null : `POLY|${capa}|${c}|z=${elev(l.elevacion)}|${secuenciaCanonica(vs, l.cerrada)}`, base: `POLY|${capa}|${c}|${secuenciaCanonica(vs.map((v) => ({ ...v, b: null })), l.cerrada)}`, incompleta: faltan.length ? faltan : undefined });
    } else if ((l.tipo === 'AcDbText') && l.texto != null) out.push({ tipo: l.tipo, capa, handle: l.handle, firma: `TEXT|${capa}|${l.texto}|${R(l.altura ?? 0)}|${xy(posicionEfectiva(l) || [NaN, NaN])}|${R(deg(l.rotacion ?? 0))}` });
    else ilegibles.push({ handle: l.handle, tipo: l.tipo, motivo: 'tipo o propiedades no interpretables' });
  }
  return { firmas: out, ilegibles };
}

function multiconjunto(lista, clave = (f) => f.firma) { const m = new Map(); for (const f of lista) { const k = clave(f); m.set(k, (m.get(k) || 0) + 1); } return m; }

/**
 * Compara DXF (esperado) con DWG (informado por COM) según el contrato. `fiel` solo si TODO lo esperado tiene comparador,
 * toda lectura fue completa y los multiconjuntos de firmas coinciden exactamente. Estados: fiel | con_diferencias | no_concluyente.
 */
export function compararFidelidad(esperadas, informadas) {
  const comparables = esperadas.filter((f) => !f.sin_comparador);
  const sinComparador = esperadas.filter((f) => f.sin_comparador).map((f) => ({ tipo: f.tipo, capa: f.capa, motivo: f.sin_comparador }));
  const completas = informadas.filter((f) => f.firma); const incompletas = informadas.filter((f) => !f.firma);
  const a = multiconjunto(comparables); const b = multiconjunto(completas);
  const faltan = []; const sobran = [];
  for (const [k, n] of a) { const m = b.get(k) || 0; if (m < n) faltan.push({ firma: k, cantidad: n - m }); }
  for (const [k, n] of b) { const m = a.get(k) || 0; if (m < n) sobran.push({ firma: k, cantidad: n - m }); }
  // Lecturas incompletas: solo pueden «cubrir» un faltante con la misma geometría base; quedan NO VERIFICABLES, nunca fieles.
  const noVerificables = [];
  const restantes = [];
  for (const f of faltan) { const e = comparables.find((x) => x.firma === f.firma); for (let i = 0; i < f.cantidad; i++) restantes.push(e); }
  const pendientes = [];
  for (const e of restantes) {
    const j = incompletas.findIndex((x) => x.base && x.base === e.base);
    if (j >= 0) { const x = incompletas.splice(j, 1)[0]; noVerificables.push({ handle: x.handle, firma_esperada: e.firma, falta_informar: x.incompleta }); } else pendientes.push(e.firma);
  }
  const faltanReales = Object.entries(pendientes.reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {})).map(([firma, cantidad]) => ({ firma, cantidad }));
  for (const x of incompletas) sobran.push({ firma: `${x.base} (lectura incompleta: ${x.incompleta.join(', ')})`, cantidad: 1 });
  const porTipo = (xs) => xs.reduce((acc, x) => { const t = x.firma.split('|')[0]; acc[t] = (acc[t] || 0) + x.cantidad; return acc; }, {});
  const diferencias = faltanReales.length > 0 || sobran.length > 0;
  const estado = diferencias ? 'con_diferencias' : (noVerificables.length || sinComparador.length) ? 'no_concluyente' : 'fiel';
  return { estado, esperadas: esperadas.length, informadas: informadas.length, faltan_en_dwg: faltanReales, sobran_en_dwg: sobran, faltan_por_tipo: porTipo(faltanReales), sobran_por_tipo: porTipo(sobran), no_verificables: noVerificables, sin_comparador: sinComparador, fiel: estado === 'fiel' };
}

/** Clasifica los textos del DWG frente a lo esperado: exacto, con secuencia \U+ sin decodificar, o corrupto. */
export function clasificarTextos(esperados, informados) {
  const restantes = new Map(); for (const t of esperados) restantes.set(t, (restantes.get(t) || 0) + 1);
  const res = { exactos: 0, escape_sin_decodificar: [], corruptos: [], faltantes: [], sobrantes: [] };
  const conAcento = [];
  for (const t of informados) {
    if (restantes.get(t) > 0) { restantes.set(t, restantes.get(t) - 1); res.exactos++; if (/[^\x00-\x7f]/.test(t)) conAcento.push(t); continue; }
    if (/\\U\+[0-9A-Fa-f]{4}/.test(t)) res.escape_sin_decodificar.push(t); else res.sobrantes.push(t);
  }
  for (const [t, n] of restantes) if (n > 0) res.faltantes.push({ texto: t, cantidad: n, codepoints: [...t].filter((c) => c.codePointAt(0) > 127).map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`) });
  // un "sobrante" que se parece a un faltante con otros caracteres es texto corrupto (p. ej. BA?O / BAÃ‘O)
  for (const s of [...res.sobrantes]) { const f = res.faltantes.find((x) => x.texto.length === s.length || Math.abs(x.texto.length - s.length) <= 2); if (f && /[^\x00-\x7f?]|\?/.test(s)) { res.corruptos.push({ esperado: f.texto, informado: s, codepoints_informados: [...s].filter((c) => c.codePointAt(0) > 127 || c === '?').map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`) }); } }
  res.con_acentos_correctos = conAcento.length;
  res.ok = !res.escape_sin_decodificar.length && !res.corruptos.length && !res.faltantes.length && !res.sobrantes.length;
  return res;
}

// ---------- Sólidos 3D (modelo 3D preliminar) ----------
/**
 * Compara los sólidos ESPERADOS (cajas calculadas desde el anteproyecto) con los 3DSOLID leídos de AutoCAD.
 * Un sólido coincide si su centroide, volumen y capa son los esperados; si AutoCAD informó la caja envolvente también se
 * compara. Sin caja envolvente la verificación de dimensiones queda `no_concluyente` (volumen+centroide no fijan las 3 medidas).
 * @param esperados [{id,capa,volumen,centro,min,max}] @param leidos lecturas tipadas (AcDb3dSolid)
 */
export function compararSolidos(esperados, leidos, { tolCentro = 0.01, tolVol = 1e-6, tolBox = 0.01 } = {}) {
  const sol = leidos.filter((e) => e.tipo === 'AcDb3dSolid' && !e.error);
  const usados = new Set(); const faltan = []; const distintos = []; let conBbox = 0; let sinBbox = 0; let coinciden = 0;
  for (const x of esperados) {
    let mejor = -1; let mejorD = Infinity;
    sol.forEach((s, i) => { if (usados.has(i) || !Array.isArray(s.centroide)) return; const d = dist(s.centroide, x.centro); if (d < mejorD) { mejorD = d; mejor = i; } });
    if (mejor < 0 || mejorD > tolCentro) { faltan.push({ id: x.id, capa: x.capa, centro_esperado: x.centro, volumen_esperado: x.volumen, mas_cercano_mm: mejor < 0 ? null : Math.round(mejorD * 1000) / 1000 }); continue; }
    usados.add(mejor); const s = sol[mejor]; const problemas = [];
    if (s.capa !== x.capa) problemas.push({ problema: 'capa_distinta', esperada: x.capa, leida: s.capa });
    if (!(typeof s.volumen === 'number') || Math.abs(s.volumen - x.volumen) > tolVol * x.volumen) problemas.push({ problema: 'volumen_distinto', esperado: x.volumen, leido: s.volumen ?? null });
    if (Array.isArray(s.bbox_min) && Array.isArray(s.bbox_max)) {
      conBbox++;
      if (dist(s.bbox_min, x.min) > tolBox || dist(s.bbox_max, x.max) > tolBox) problemas.push({ problema: 'caja_envolvente_distinta', esperada: { min: x.min, max: x.max }, leida: { min: s.bbox_min, max: s.bbox_max } });
    } else sinBbox++;
    if (problemas.length) distintos.push({ id: x.id, handle: s.handle, problemas }); else coinciden++;
  }
  const sobran = sol.filter((_, i) => !usados.has(i)).map((s) => ({ handle: s.handle, capa: s.capa, centroide: s.centroide, volumen: s.volumen }));
  const fiel = !faltan.length && !distintos.length && !sobran.length;
  const estado = !fiel ? 'con_diferencias' : sinBbox > 0 ? 'no_concluyente' : 'fiel';
  return { estado, esperados: esperados.length, leidos: sol.length, coinciden, faltan, distintos, sobran, caja_envolvente: { informada: conBbox, no_informada: sinBbox } };
}
