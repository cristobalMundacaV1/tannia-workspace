// Motor GENÉRICO de planos (auditoría integral 2026-11-17, TW-PRO-06): una especificación declarativa de vistas
// (planta, corte, elevación, perfil, sección, detalle) se convierte en el mismo modelo `tw.drawing/1` que usan el compositor,
// el DXF (AC1024, cotas DIMENSION nativas, layouts y viewports) y el PDF. El túnel es solo un adaptador más.
// Coordenadas del modelo en metros (tamaño real); papel en milímetros. Nada se infiere: cotas, escalas y capas son explícitas.
import { UserError } from '../mcp/util.js';
import { LAYERS } from './model.js';
import { autoIntersecta, segmentosIntersectan } from '../geo/geom.js';

export const TIPOS_VISTA = ['planta', 'corte', 'elevacion', 'perfil', 'seccion', 'detalle'];
/** Escalas normalizadas de dibujo técnico (1:n). Una escala fuera de la lista se rechaza en vez de redondearse. */
export const ESCALAS = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 200, 250, 500, 1000, 2000, 2500, 5000];
export const MARCA_TRABAJO = 'DOCUMENTO DE TRABAJO: requiere revisión profesional. No apto para construcción.';

const err = (code, msg, hint = '') => new UserError(code, msg, hint);
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const pt = (p, ctx) => { if (!Array.isArray(p) || p.length !== 2 || !p.every(num)) throw err('GEOMETRIA_INVALIDA', `${ctx}: se esperaba un punto [x, y] en metros.`); return [p[0], p[1]]; };
const pos = (x, ctx) => { if (!num(x) || x <= 0) throw err('GEOMETRIA_INVALIDA', `${ctx}: debe ser un número positivo.`); return x; };
const txt = (s, ctx, max = 90) => { if (typeof s !== 'string' || !s.trim() || s.length > max || /[\r\n\u0000-\u001f]/.test(s)) throw err('TEXTO_INVALIDO', `${ctx}: texto vacío, con saltos de línea o de más de ${max} caracteres.`); return s; };
const idOk = (s, ctx) => { if (typeof s !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(s)) throw err('ID_INVALIDO', `${ctx}: identificador inválido «${s}» (letras, números, - y _).`); return s; };

/** Convierte un elemento declarativo en entidades primitivas line/arc. */
function entidades(el, vista, i) {
  const ctx = `Vista ${vista}, elemento ${i + 1}`; const id = el.id ? idOk(el.id, ctx) : `e${i + 1}`; const layer = el.capa;
  const L = (sid, a, b) => ({ id: sid, kind: 'line', layer, a, b });
  switch (el.tipo) {
    case 'linea': { const a = pt(el.a, ctx); const b = pt(el.b, ctx); if (a[0] === b[0] && a[1] === b[1]) throw err('GEOMETRIA_INVALIDA', `${ctx}: línea de longitud cero.`); return [L(id, a, b)]; }
    case 'polilinea': {
      if (!Array.isArray(el.puntos) || el.puntos.length < 2) throw err('GEOMETRIA_INVALIDA', `${ctx}: la polilínea necesita al menos 2 puntos.`);
      const ps = el.puntos.map((p) => pt(p, ctx)); if (el.cerrada) ps.push(ps[0]);
      return ps.slice(1).map((b, k) => L(`${id}-${k + 1}`, ps[k], b));
    }
    case 'rectangulo': {
      const o = pt(el.origen, ctx); const w = pos(el.ancho, `${ctx} (ancho)`); const h = pos(el.alto, `${ctx} (alto)`);
      const ps = [o, [o[0] + w, o[1]], [o[0] + w, o[1] + h], [o[0], o[1] + h], o];
      return ps.slice(1).map((b, k) => L(`${id}-${k + 1}`, ps[k], b));
    }
    case 'arco': {
      const c = pt(el.centro, ctx); const r = pos(el.radio, `${ctx} (radio)`);
      if (!num(el.inicio) || !num(el.fin) || el.inicio < 0 || el.fin > 360 || el.fin <= el.inicio) throw err('GEOMETRIA_INVALIDA', `${ctx}: ángulos en grados con 0 ≤ inicio < fin ≤ 360.`);
      return [{ id, kind: 'arc', layer, center: c, radius: r, start: el.inicio, end: el.fin }];
    }
    case 'circulo': { const c = pt(el.centro, ctx); const r = pos(el.radio, `${ctx} (radio)`); return [{ id, kind: 'arc', layer, center: c, radius: r, start: 0, end: 360 }]; }
    default: throw err('GEOMETRIA_NO_SOPORTADA', `${ctx}: tipo «${el.tipo}» no soportado (linea, polilinea, rectangulo, arco, circulo).`);
  }
}

function cota(c, vista, i) {
  const ctx = `Vista ${vista}, cota ${i + 1}`; const id = c.id ? idOk(c.id, ctx) : `c${i + 1}`;
  if (c.tipo === 'radial') { const center = pt(c.centro, ctx); const radius = pos(c.radio, `${ctx} (radio)`); const angle = num(c.angulo) ? c.angulo : 45; return { id, kind: 'radial', center, radius, angle, value: radius, unit: 'm' }; }
  if (c.tipo !== 'lineal') throw err('COTA_NO_SOPORTADA', `${ctx}: tipo «${c.tipo}» no soportado (lineal, radial).`);
  const a = pt(c.a, ctx); const b = pt(c.b, ctx);
  const horizontal = Math.abs(a[1] - b[1]) < 1e-9; const vertical = Math.abs(a[0] - b[0]) < 1e-9;
  if (!horizontal && !vertical) throw err('COTA_NO_SOPORTADA', `${ctx}: las cotas lineales deben ser horizontales o verticales.`);
  if (horizontal && vertical) throw err('COTA_INVALIDA', `${ctx}: cota de longitud cero.`);
  const offset = num(c.desfase) ? c.desfase : 10; // mm de papel
  return { id, kind: 'linear', a, b, offset, value: Math.hypot(b[0] - a[0], b[1] - a[1]), unit: 'm' };
}

/**
 * especificacion: { codigo, especialidad, proyecto, revision?, fecha?, autor?, institucion?, etapa?, origen?, advertencias?[],
 *   capas: {NOMBRE: {color, grosor, leyenda, trazo?}}, vistas: [{id, titulo, tipo, escala, escala_vertical?, elementos[], cotas?[], textos?[], notas?[]}],
 *   laminas: [{id, titulo, vistas: [ids]}], elementos_fisicos?: [{id, tipo, fuentes: [refs medibles], representaciones?: [refs del mismo elemento en otras vistas, no medibles]}],
 *   mediciones?: [{id, partida?, descripcion?, metodo: longitud|area|conteo, fuentes: ['vista/elemento'], unidad?, signo?: -1}],
 *   cantidades_declaradas?: [{partida, descripcion?, cantidad, unidad, origen}] }  (NO se admite «cantidades» ya calculadas) }
 */
export function modeloDesdeEspecificacion(e) {
  if (!e || typeof e !== 'object') throw err('ESPECIFICACION_INVALIDA', 'Falta la especificación del plano.');
  const code = idOk(e.codigo || 'TW', 'codigo').toUpperCase(); const especialidad = txt(e.especialidad || 'construcción', 'especialidad', 40);
  const layers = {};
  for (const [name, c] of Object.entries(e.capas || {})) {
    if (!/^[A-Z0-9_]{1,31}$/.test(name)) throw err('CAPA_INVALIDA', `Nombre de capa inválido «${name}» (MAYÚSCULAS, números y _).`);
    if (['PAPEL', 'MODEL_DIMS'].includes(name)) throw err('CAPA_RESERVADA', `La capa «${name}» está reservada.`);
    const color = Number.isInteger(c?.color) && c.color >= 1 && c.color <= 255 ? c.color : 7;
    const weight = num(c?.grosor) && c.grosor >= 0.09 && c.grosor <= 2.11 ? c.grosor : 0.25;
    if (c?.trazo !== undefined && (!Array.isArray(c.trazo) || !c.trazo.length || c.trazo.length % 2 || !c.trazo.every((x) => num(x) && x > 0 && x <= 50))) throw err('TRAZO_INVALIDO', `Capa ${name}: el trazo es una lista par de longitudes en mm de papel (trazo, hueco, …), todas > 0.`);
    layers[name] = { color, weight, legend: txt(c?.leyenda || name, `leyenda de ${name}`, 60), ...(Array.isArray(c?.trazo) ? { dash: c.trazo } : {}) };
  }
  const capasValidas = new Set([...Object.keys(LAYERS), ...Object.keys(layers)]);
  if (!Array.isArray(e.vistas) || !e.vistas.length) throw err('ESPECIFICACION_INVALIDA', 'La especificación necesita al menos una vista.');
  const ids = new Set();
  const views = e.vistas.map((v, vi) => {
    const id = idOk(v.id, `vista ${vi + 1}`); if (ids.has(id)) throw err('ID_DUPLICADO', `Vista duplicada «${id}».`); ids.add(id);
    if (!TIPOS_VISTA.includes(v.tipo)) throw err('VISTA_INVALIDA', `Vista ${id}: tipo «${v.tipo}» no soportado (${TIPOS_VISTA.join(', ')}).`);
    if (!ESCALAS.includes(v.escala)) throw err('ESCALA_INVALIDA', `Vista ${id}: escala 1:${v.escala} no normalizada.`, `Use una de: ${ESCALAS.join(', ')}.`);
    if (v.escala_vertical !== undefined && (!ESCALAS.includes(v.escala_vertical) || v.tipo !== 'perfil')) throw err('ESCALA_INVALIDA', `Vista ${id}: la escala vertical distinta solo se admite en perfiles y debe ser normalizada.`);
    if (!Array.isArray(v.elementos) || !v.elementos.length) throw err('VISTA_VACIA', `Vista ${id}: no tiene elementos.`);
    const ents = v.elementos.flatMap((el, i) => entidades(el, id, i));
    for (const en of ents) if (!capasValidas.has(en.layer)) throw err('CAPA_NO_DECLARADA', `Vista ${id}: la capa «${en.layer}» no está declarada.`);
    const eids = new Set(); for (const en of ents) { if (eids.has(en.id)) throw err('ID_DUPLICADO', `Vista ${id}: entidad duplicada «${en.id}».`); eids.add(en.id); }
    const dimensions = (v.cotas || []).map((c, i) => cota(c, id, i));
    const labels = (v.textos || []).map((t, i) => ({ at: pt(t.en, `Vista ${id}, texto ${i + 1}`), dy: num(t.dy) ? t.dy : 0, text: txt(t.texto, `Vista ${id}, texto ${i + 1}`, 40) }));
    const notes = (v.notas || []).map((n, i) => txt(n, `Vista ${id}, nota ${i + 1}`, 140));
    if (v.escala_vertical && v.escala_vertical !== v.escala && (ents.some((e) => e.kind === 'arc') || dimensions.some((d) => d.kind === 'radial'))) throw err('GEOMETRIA_NO_SOPORTADA', `Vista ${id}: con escala vertical distinta no se admiten arcos, círculos ni cotas radiales (se deformarían en elipses). Use una vista sin exageración.`);
    return { id, title: txt(v.titulo, `Vista ${id}: título`, 60), type: v.tipo, scale: v.escala, ...(v.escala_vertical ? { verticalScale: v.escala_vertical } : {}), entities: ents, dimensions, labels, notes };
  });
  if (!Array.isArray(e.laminas) || !e.laminas.length) throw err('ESPECIFICACION_INVALIDA', 'La especificación necesita al menos una lámina.');
  const sids = new Set(); const usadas = new Set();
  const sheets = e.laminas.map((l, i) => {
    const id = idOk(l.id, `lámina ${i + 1}`); if (sids.has(id)) throw err('ID_DUPLICADO', `Lámina duplicada «${id}».`); sids.add(id);
    if (!Array.isArray(l.vistas) || !l.vistas.length || l.vistas.length > 3) throw err('LAMINA_INVALIDA', `Lámina ${id}: entre 1 y 3 vistas.`);
    for (const v of l.vistas) { if (!ids.has(v)) throw err('VISTA_AUSENTE', `Lámina ${id}: la vista «${v}» no existe.`); usadas.add(v); }
    return { id, title: txt(l.titulo, `Lámina ${id}: título`, 60), views: [...l.vistas] };
  });
  const huerfanas = [...ids].filter((v) => !usadas.has(v)); if (huerfanas.length) throw err('VISTA_SIN_LAMINA', `Vistas sin lámina: ${huerfanas.join(', ')}.`);
  // Trazabilidad: cada entidad lleva ref vista/id y el elemento físico que representa (o «sin_elemento»).
  const fisicos = Array.isArray(e.elementos_fisicos) ? e.elementos_fisicos : [];
  // Identidad física: «fuentes» son las entidades que se miden; «representaciones» dibujan el MISMO elemento en otra vista y no se miden.
  const porEntidad = new Map(); const porRepr = new Map();
  for (const f of fisicos) { for (const r of f.fuentes || []) porEntidad.set(r, f.id); for (const r of f.representaciones || []) { if (porEntidad.has(r)) throw err('IDENTIDAD_AMBIGUA', `La entidad ${r} no puede ser fuente y representación a la vez.`); porRepr.set(r, f.id); } }
  const expandir = (m) => { const out = new Map(); for (const v of views) for (const en of v.entities) { const ref = `${v.id}/${en.id}`; for (const [k, id] of m) if (ref === k || ref.startsWith(`${k}-`)) out.set(ref, id); } return out; };
  const fuenteDe = expandir(porEntidad); const reprDe = expandir(porRepr);
  for (const v of views) for (const en of v.entities) { en.ref = `${v.id}/${en.id}`; en.element = fuenteDe.get(en.ref) || reprDe.get(en.ref) || en.element || 'sin_elemento'; en.role = fuenteDe.has(en.ref) ? 'fuente' : 'representacion'; }
  const warnings = [MARCA_TRABAJO, ...(e.advertencias || []).map((a, i) => txt(a, `advertencia ${i + 1}`, 140))];
  const P = (x) => (x === undefined ? 'PENDIENTE' : txt(x, 'metadato', 90));
  return {
    schema: 'tw.drawing/1', unit: 'm', layers, elements: fisicos.map((f) => ({ id: idOk(f.id, 'elemento físico'), tipo: f.tipo || 'elemento', unidad: 'm', fuente: (f.fuentes || [])[0] || null, magnitudes: f.magnitudes || {}, vistas: [...new Set((f.fuentes || []).map((r) => r.split('/')[0]))] })),
    provenance: e.origen ? txt(e.origen, 'origen', 140) : 'Especificación explícita aportada en la conversación',
    metadata: { project: P(e.proyecto), revision: P(e.revision), date: P(e.fecha), institution: P(e.institucion), author: P(e.autor), reviewer: 'PENDIENTE', approval: 'PENDIENTE', stage: e.etapa ? txt(e.etapa, 'etapa', 40) : 'REVISIÓN', source: 'Especificación de planos', coordinateSystem: 'NO CONFIRMADO', code, specialty: especialidad },
    ...(() => { const q = cantidadesDeEspecificacion(e, views); return { quantities: q.detalle, quantity_totals: q.totales }; })(), views, sheets, warnings,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// G3 / PL-02 (issue #32): las cantidades NO se copian de la especificación. Se MIDEN sobre las entidades del modelo con un método
// versionado (TW-MED/1), o se aceptan como DECLARADAS con origen explícito y rotuladas como no medidas desde el plano.
export const METODO_MEDICION = 'TW-MED/1';
const UNIDAD_METODO = { longitud: 'm', area: 'm2', conteo: 'u' };
const largoEnt = (x) => (x.kind === 'line' ? Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) : (x.radius * Math.PI * (x.end - x.start)) / 180);
/** Área de un contorno cerrado formado por segmentos encadenados (o de un círculo completo). */
function areaContorno(ents, ctx) {
  if (ents.length === 1 && ents[0].kind === 'arc' && ents[0].end - ents[0].start >= 360) { const c = ents[0]; const poligono = Array.from({ length: 720 }, (_, k) => [c.center[0] + c.radius * Math.cos((k * Math.PI) / 360), c.center[1] + c.radius * Math.sin((k * Math.PI) / 360)]); return { valor: Math.PI * c.radius ** 2, formula: `π·r² (r = ${c.radius})`, poligono }; }
  if (ents.some((x) => x.kind !== 'line')) throw err('MEDICION_NO_SOPORTADA', `${ctx}: el área solo se mide sobre polilíneas/rectángulos cerrados o círculos completos.`);
  const ps = [ents[0].a]; for (const x of ents) { const u = ps[ps.length - 1]; if (Math.hypot(x.a[0] - u[0], x.a[1] - u[1]) > 1e-9) throw err('CONTORNO_ABIERTO', `${ctx}: los segmentos no están encadenados (${x.id}).`); ps.push(x.b); }
  const f = ps[ps.length - 1]; if (Math.hypot(f[0] - ps[0][0], f[1] - ps[0][1]) > 1e-9) throw err('CONTORNO_ABIERTO', `${ctx}: el contorno no está cerrado.`);
  // Superficie física: polígono simple (≥ 3 vértices distintos, sin autointersección ni tramos superpuestos/retrocesos).
  const vs = ps.slice(0, -1); const clave = (p) => `${Math.round(p[0] * 1e9)}|${Math.round(p[1] * 1e9)}`;
  if (vs.length < 3 || new Set(vs.map(clave)).size !== vs.length) throw err('CONTORNO_NO_SIMPLE', `${ctx}: el contorno repite vértices o tiene menos de 3.`);
  for (let k = 0; k < vs.length; k++) { const a = vs[(k + vs.length - 1) % vs.length]; const b = vs[k]; const c = vs[(k + 1) % vs.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]); if (Math.abs(cr) < 1e-12 && dot < 0) throw err('CONTORNO_NO_SIMPLE', `${ctx}: el contorno retrocede sobre sí mismo en ${b.join(', ')}.`); }
  if (autoIntersecta(vs)) throw err('CONTORNO_NO_SIMPLE', `${ctx}: el contorno se autointersecta; no representa una superficie física.`);
  if (!(areaPoligono(vs) > 1e-12)) throw err('CONTORNO_NO_SIMPLE', `${ctx}: el contorno no encierra superficie.`);
  return { valor: areaPoligono(vs), formula: `fórmula del área de Gauss sobre ${vs.length} vértices dibujados`, poligono: vs };
}
// Huecos (descuentos de área): cada uno debe quedar DENTRO de un contorno positivo de la misma partida, y no superponerse con otro.
const enSegmento = (p, a, b) => { const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); if (Math.abs(cr) > 1e-9 * Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]))) return false; const d = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]); return d >= -1e-12 && d <= (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + 1e-12; };
/** 1 dentro, 0 sobre el borde, -1 fuera. */
function ubicar(p, poly) {
  for (let i = 0; i < poly.length; i++) if (enSegmento(p, poly[i], poly[(i + 1) % poly.length])) return 0;
  let dentro = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]; const b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro; }
  return dentro ? 1 : -1;
}
const aristas = (poly) => poly.map((a, i) => [a, poly[(i + 1) % poly.length]]);
const seCruzan = (P, Q) => aristas(P).some(([a, b]) => aristas(Q).some(([c, d]) => segmentosIntersectan(a, b, c, d)));
const muestras = (poly) => [...poly, ...aristas(poly).map(([a, b]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])];
const contenido = (D, P) => !seCruzan(D, P) && muestras(D).every((q) => ubicar(q, P) >= 0) && ubicar(interiorDe(D), P) === 1;
const interiorDe = (poly) => { const c = poly.reduce((s, q) => [s[0] + q[0] / poly.length, s[1] + q[1] / poly.length], [0, 0]); return c; };
const superpuestos = (A, B) => seCruzan(A, B) || muestras(A).some((q) => ubicar(q, B) === 1) || muestras(B).some((q) => ubicar(q, A) === 1) || ubicar(interiorDe(A), B) === 1 || ubicar(interiorDe(B), A) === 1;
function validarHuecos(contornos, partida) {
  const positivos = contornos.filter((c) => c.signo > 0).flatMap((c) => c.poligonos);
  const huecos = contornos.filter((c) => c.signo < 0).flatMap((c) => c.poligonos.map((poligono) => ({ poligono, ctx: c.ctx })));
  for (const h of huecos) if (!positivos.some((P) => contenido(h.poligono, P))) throw err('DESCUENTO_FUERA_DEL_CONTORNO', `${h.ctx}: el descuento no está contenido en ningún contorno medido de «${partida}»; no puede restarse.`);
  for (let i = 0; i < huecos.length; i++) for (let j = i + 1; j < huecos.length; j++) if (superpuestos(huecos[i].poligono, huecos[j].poligono)) throw err('DESCUENTOS_SUPERPUESTOS', `${huecos[j].ctx}: se superpone con ${huecos[i].ctx}; la superficie común se restaría dos veces.`);
}

export function cantidadesDeEspecificacion(e, views) {
  if (e.cantidades !== undefined) throw err('CANTIDADES_NO_DERIVADAS', 'La especificación no puede traer cantidades ya calculadas.', 'Use «mediciones» (se miden sobre la geometría dibujada) o «cantidades_declaradas» con su origen (quedan rotuladas como no medidas desde el plano).');
  const porRef = new Map(); for (const v of views) for (const x of v.entities) porRef.set(x.ref, x);
  const resolver = (f, ctx) => { const exacta = porRef.get(f); if (exacta) return [exacta]; const pref = [...porRef.keys()].filter((r) => r.startsWith(`${f}-`)); if (!pref.length) throw err('FUENTE_INEXISTENTE', `${ctx}: «${f}» no es una entidad dibujada.`); return pref.map((r) => porRef.get(r)); };
  const filas = []; const usadas = new Map(); const contornos = new Map();
  for (const [i, m] of (e.mediciones || []).entries()) {
    const ctx = `Medición ${m.id || i + 1}`; const id = idOk(m.id || `m${i + 1}`, ctx);
    if (!UNIDAD_METODO[m.metodo]) throw err('METODO_INVALIDO', `${ctx}: método «${m.metodo}» no soportado (longitud, area, conteo).`);
    if (m.unidad !== undefined && m.unidad !== UNIDAD_METODO[m.metodo]) throw err('UNIDAD_INCOMPATIBLE', `${ctx}: el método ${m.metodo} mide en ${UNIDAD_METODO[m.metodo]}, no en ${m.unidad}.`);
    if (!Array.isArray(m.fuentes) || !m.fuentes.length) throw err('FUENTE_INEXISTENTE', `${ctx}: indique las entidades dibujadas que mide.`);
    const signo = m.signo === -1 ? -1 : 1; const partida = m.partida ? txt(m.partida, `${ctx}: partida`, 60) : id;
    const grupos = m.fuentes.map((f) => resolver(f, ctx)); const ents = grupos.flat();
    for (const x of ents) {
      if (x.element !== 'sin_elemento' && x.role !== 'fuente') throw err('MEDICION_NO_AUTORIZADA', `${ctx}: ${x.ref} es una representación del elemento «${x.element}»; mida su fuente declarada.`);
      const k = `${partida}|${x.ref}`; if (usadas.has(k)) throw err('MEDICION_DUPLICADA', `${ctx}: la entidad ${x.ref} ya se midió en «${usadas.get(k)}» para la misma partida.`); usadas.set(k, id);
    }
    // Un elemento físico declarado se mide una sola vez por partida y método, aunque esté dibujado (como fuente) en varias vistas.
    for (const el of new Set(ents.map((x) => x.element).filter((x) => x !== 'sin_elemento'))) {
      const k = `${partida}|${m.metodo}|elemento:${el}`; const vistasEl = new Set(ents.filter((x) => x.element === el).map((x) => x.ref.split('/')[0]));
      if (usadas.has(k) || vistasEl.size > 1) throw err('MEDICION_DUPLICADA', `${ctx}: el elemento físico «${el}» ya se midió${usadas.has(k) ? ` en «${usadas.get(k)}»` : ' en más de una vista'} para «${partida}» (${m.metodo}).`); usadas.set(k, id);
    }
    let valor; let formula;
    if (m.metodo === 'longitud') { valor = ents.reduce((t, x) => t + largoEnt(x), 0); formula = `suma de ${ents.length} longitudes dibujadas`; }
    else if (m.metodo === 'area') { const r = grupos.map((g2) => areaContorno(g2, ctx)); valor = r.reduce((t, x) => t + x.valor, 0); formula = r.map((x) => x.formula).join(' + '); contornos.set(id, { signo, poligonos: r.map((x) => x.poligono), ctx }); }
    else { valor = grupos.length; formula = `conteo de ${grupos.length} elemento(s) dibujado(s)`; }
    if (!(valor > 0)) throw err('MEDICION_INVALIDA', `${ctx}: la magnitud medida es nula.`);
    filas.push({ id, partida, descripcion: m.descripcion ? txt(m.descripcion, `${ctx}: descripción`, 80) : partida, metodo: `${METODO_MEDICION}/${m.metodo}`, unidad: UNIDAD_METODO[m.metodo], valor: signo * valor, formula: `${signo < 0 ? 'DESCUENTO: ' : ''}${formula}`, fuentes: ents.map((x) => x.ref).join(' '), naturaleza: 'MEDIDA sobre la geometría del modelo' });
  }
  for (const [i, d] of (e.cantidades_declaradas || []).entries()) {
    const ctx = `Cantidad declarada ${i + 1}`;
    if (!num(d.cantidad) || !d.unidad || !d.origen) throw err('DATOS_INVALIDOS', `${ctx}: requiere cantidad numérica, unidad y origen (quién/qué documento la aporta).`);
    filas.push({ id: `d${i + 1}`, partida: txt(d.partida || d.descripcion || `declarada-${i + 1}`, ctx, 60), descripcion: d.descripcion ? txt(d.descripcion, ctx, 80) : '', metodo: 'DECLARADA', unidad: txt(d.unidad, ctx, 10), valor: d.cantidad, formula: '—', fuentes: '', naturaleza: `DECLARADA (no medida desde el plano). Origen: ${txt(d.origen, ctx, 100)}` });
  }
  // Totales por partida medida (con descuentos explícitos). Una partida mezcla de medido y declarado no se suma.
  // Los TOTALES van en una lista separada: nunca se suman junto con el detalle (PL-09).
  const totales = []; const partidas = [...new Set(filas.filter((f) => f.metodo !== 'DECLARADA').map((f) => f.partida))];
  for (const p of partidas) {
    const fs2 = filas.filter((f) => f.partida === p); if (fs2.some((f) => f.metodo === 'DECLARADA')) throw err('ORIGEN_MEZCLADO', `Partida «${p}»: no se suman cantidades medidas y declaradas.`);
    validarHuecos(fs2.map((f) => contornos.get(f.id)).filter(Boolean), p);
    const u = [...new Set(fs2.map((f) => f.unidad))]; if (u.length > 1) throw err('UNIDAD_INCOMPATIBLE', `Partida «${p}»: mezcla unidades ${u.join(', ')}.`);
    const total = fs2.reduce((t, f) => t + f.valor, 0); if (!(total > 0)) throw err('MEDICION_INVALIDA', `Partida «${p}»: los descuentos superan la cantidad medida.`);
    if (fs2.length > 1) totales.push({ id: `total-${p}`, partida: p, descripcion: `TOTAL ${p}`, metodo: METODO_MEDICION, unidad: u[0], valor: total, formula: fs2.map((f) => f.id).join(' + '), fuentes: '', naturaleza: 'MEDIDA (suma de mediciones y descuentos)' });
  }
  return { detalle: filas.map((f) => ({ ...f, fila: 'detalle' })), totales: totales.map((t) => ({ ...t, fila: 'total' })) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Segundo dominio (prueba de reutilización): recinto rectangular de edificación con muros perimetrales.
// Cantidades DERIVADAS de la geometría dibujada (no de los parámetros): área de muros en planta = área contorno exterior − interior.
const areaPoligono = (ps) => Math.abs(ps.reduce((s, p, i) => { const q = ps[(i + 1) % ps.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const verticesRect = (ents, prefijo) => ents.filter((x) => x.id.startsWith(prefijo + '-')).map((x) => x.a);

export function recintoEspecificacion({ largo, ancho, espesor_muro: t, altura, proyecto = 'Recinto', revision = 'R01', fecha, autor, institucion }) {
  for (const [n, v] of Object.entries({ largo, ancho, espesor_muro: t, altura })) if (!num(v) || v <= 0) throw err('DATOS_INVALIDOS', `«${n}» debe ser un número positivo en metros (no se supone).`);
  if (2 * t >= Math.min(largo, ancho)) throw err('DATOS_INVALIDOS', 'El espesor de muro no cabe en el recinto.');
  return {
    codigo: 'REC', especialidad: 'edificación', proyecto, revision, fecha, autor, institucion, etapa: 'ANTEPROYECTO',
    capas: { MUROS: { color: 7, grosor: 0.5, leyenda: 'Muros (corte)' }, LOSA: { color: 8, grosor: 0.35, leyenda: 'Losa / fundación' }, NPT: { color: 1, grosor: 0.18, leyenda: 'Nivel de piso terminado', trazo: [4, 1] } },
    vistas: [
      { id: 'planta', titulo: 'Planta', tipo: 'planta', escala: 50, elementos: [{ id: 'ext', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: largo, alto: ancho }, { id: 'int', tipo: 'rectangulo', capa: 'MUROS', origen: [t, t], ancho: largo - 2 * t, alto: ancho - 2 * t }],
        cotas: [{ id: 'largo', tipo: 'lineal', a: [0, 0], b: [largo, 0], desfase: 10 }, { id: 'ancho', tipo: 'lineal', a: [largo, 0], b: [largo, ancho], desfase: 10 }, { id: 'espesor', tipo: 'lineal', a: [0, ancho], b: [t, ancho], desfase: -8 }],
        notas: [`Muros perimetrales de ${t.toFixed(2).replace('.', ',')} m. Sin vanos declarados.`] },
      { id: 'corte', titulo: 'Corte A-A', tipo: 'corte', escala: 50, elementos: [{ id: 'piso', tipo: 'linea', capa: 'NPT', a: [0, 0], b: [largo, 0] }, { id: 'muro-izq', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: t, alto: altura }, { id: 'muro-der', tipo: 'rectangulo', capa: 'MUROS', origen: [largo - t, 0], ancho: t, alto: altura }],
        cotas: [{ id: 'altura', tipo: 'lineal', a: [largo, 0], b: [largo, altura], desfase: 10 }, { id: 'luz', tipo: 'lineal', a: [t, 0], b: [largo - t, 0], desfase: 10 }], notas: ['Altura de muro desde NPT 0,00 (datum local).'] },
      { id: 'elevacion', titulo: 'Elevación principal', tipo: 'elevacion', escala: 50, elementos: [{ id: 'fachada', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: largo, alto: altura }, { id: 'terreno', tipo: 'linea', capa: 'NPT', a: [-0.5, 0], b: [largo + 0.5, 0] }],
        cotas: [{ id: 'largo-elev', tipo: 'lineal', a: [0, 0], b: [largo, 0], desfase: 10 }] },
    ],
    laminas: [{ id: '01', titulo: 'Planta', vistas: ['planta'] }, { id: '02', titulo: 'Corte A-A', vistas: ['corte'] }, { id: '03', titulo: 'Elevación', vistas: ['elevacion'] }],
    elementos_fisicos: [{ id: 'muros', tipo: 'muro', fuentes: ['planta/ext-1', 'planta/int-1'] }],
    advertencias: ['Geometría de anteproyecto. Sin cálculo estructural.'],
  };
}

/** Cantidades del recinto medidas sobre las entidades dibujadas (única autoridad: la geometría del modelo). */
export function cantidadesRecinto(model, altura) {
  const planta = model.views.find((v) => v.id === 'planta'); if (!planta) throw err('VISTA_AUSENTE', 'planta');
  const ext = areaPoligono(verticesRect(planta.entities, 'ext')); const int = areaPoligono(verticesRect(planta.entities, 'int'));
  const corte = model.views.find((v) => v.id === 'corte'); const h = corte ? Math.max(...corte.entities.filter((x) => x.layer === 'MUROS').flatMap((x) => [x.a[1], x.b[1]])) : altura;
  const areaMuroPlanta = ext - int;
  return [{ partida: 'Muros perimetrales', area_planta_m2: areaMuroPlanta, altura_m: h, volumen_m3: areaMuroPlanta * h, superficie_interior_util_m2: int, formula: 'V = (A_ext − A_int) × h, medido sobre la planta y el corte dibujados' }];
}
