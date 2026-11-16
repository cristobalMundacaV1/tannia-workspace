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
};

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

// ---------- Fidelidad DXF → DWG (multiconjuntos de firmas) ----------
const deg = (rad) => ((((rad * 180) / Math.PI) % 360) + 360) % 360;
const xy = (p) => `${R(p.x ?? p[0])},${R(p.y ?? p[1])}`;
const ordenar = (...v) => v.sort();

/** Firmas esperadas leídas del DXF (verdad de origen). */
export function firmasDesdeDxf(dxf) {
  const out = [];
  for (const e of dxf.entities) {
    if (e.type === 'LINE') out.push({ tipo: 'AcDbLine', capa: e.layer, firma: `LINE|${ordenar(xy(e.a), xy(e.b)).join('|')}` });
    else if (e.type === 'ARC') out.push({ tipo: 'AcDbArc', capa: e.layer, firma: `ARC|${xy(e.c)}|${R(e.r)}|${R(((e.a0 % 360) + 360) % 360)}|${R(((e.a1 % 360) + 360) % 360)}` });
    else if (e.type === 'POLYLINE') out.push({ tipo: 'poli', capa: e.layer, firma: `POLY|${e.closed ? 'c' : 'a'}|${e.verts.map((v) => xy(v)).sort().join(';')}` });
    else if (e.type === 'LWPOLYLINE') out.push({ tipo: 'poli', capa: e.layer, firma: `POLY|${e.closed ? 'c' : 'a'}|${e.verts.map((v) => xy(v)).sort().join(';')}` });
    else if (e.type === 'TEXT') { const pos = e.just ? e.alin : e.p; out.push({ tipo: 'AcDbText', capa: e.layer, firma: `TEXT|${dxfDecode(e.text)}|${R(e.altura)}|${xy(pos)}` }); }
    else if (e.type !== 'INSERT') out.push({ tipo: e.type, capa: e.layer, firma: `OTRO|${e.type}` });
  }
  return out;
}

/** Firmas de lo que AutoCAD informa (lecturas tipadas). */
export function firmasDesdeCom(lecturas) {
  const out = []; const ilegibles = [];
  for (const l of lecturas) {
    if (l.error) { ilegibles.push({ handle: l.handle, motivo: l.error }); continue; }
    if (l.tipo === 'AcDbLine' && l.inicio && l.fin) out.push({ tipo: l.tipo, capa: l.capa, handle: l.handle, firma: `LINE|${ordenar(xy(l.inicio), xy(l.fin)).join('|')}` });
    else if (l.tipo === 'AcDbArc' && l.centro && l.radio != null) out.push({ tipo: l.tipo, capa: l.capa, handle: l.handle, firma: `ARC|${xy(l.centro)}|${R(l.radio)}|${R(deg(l.angulo_inicio))}|${R(deg(l.angulo_fin))}` });
    else if ((l.tipo === 'AcDbPolyline' || l.tipo === 'AcDb2dPolyline') && l.coordenadas) {
      const paso = l.tipo === 'AcDb2dPolyline' ? 3 : 2; const vs = [];
      for (let i = 0; i + 1 < l.coordenadas.length; i += paso) vs.push(xy([l.coordenadas[i], l.coordenadas[i + 1]]));
      out.push({ tipo: 'poli', capa: l.capa, handle: l.handle, firma: `POLY|${l.cerrada ? 'c' : 'a'}|${vs.sort().join(';')}` });
    } else if ((l.tipo === 'AcDbText') && l.texto != null) out.push({ tipo: l.tipo, capa: l.capa, handle: l.handle, firma: `TEXT|${l.texto}|${R(l.altura ?? 0)}|${xy(posicionEfectiva(l) || [NaN, NaN])}` });
    else ilegibles.push({ handle: l.handle, tipo: l.tipo, motivo: 'tipo o propiedades no interpretables' });
  }
  return { firmas: out, ilegibles };
}

function multiconjunto(lista) { const m = new Map(); for (const f of lista) m.set(f.firma, (m.get(f.firma) || 0) + 1); return m; }

/** Compara DXF (esperado) con DWG (informado por COM). */
export function compararFidelidad(esperadas, informadas) {
  const a = multiconjunto(esperadas); const b = multiconjunto(informadas);
  const faltan = []; const sobran = [];
  for (const [k, n] of a) { const m = b.get(k) || 0; if (m < n) faltan.push({ firma: k, cantidad: n - m }); }
  for (const [k, n] of b) { const m = a.get(k) || 0; if (m < n) sobran.push({ firma: k, cantidad: n - m }); }
  const porTipo = (xs) => xs.reduce((acc, x) => { const t = x.firma.split('|')[0]; acc[t] = (acc[t] || 0) + x.cantidad; return acc; }, {});
  return { esperadas: esperadas.length, informadas: informadas.length, faltan_en_dwg: faltan, sobran_en_dwg: sobran, faltan_por_tipo: porTipo(faltan), sobran_por_tipo: porTipo(sobran), fiel: !faltan.length && !sobran.length };
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
