// Motor GENÉRICO de planos (auditoría integral 2026-11-17, TW-PRO-06): una especificación declarativa de vistas
// (planta, corte, elevación, perfil, sección, detalle) se convierte en el mismo modelo `tw.drawing/1` que usan el compositor,
// el DXF (AC1024, cotas DIMENSION nativas, layouts y viewports) y el PDF. El túnel es solo un adaptador más.
// Coordenadas del modelo en metros (tamaño real); papel en milímetros. Nada se infiere: cotas, escalas y capas son explícitas.
import { UserError } from '../mcp/util.js';
import { LAYERS } from './model.js';
import { ESTILOS, TRAMAS, SIMBOLOS } from './catalog.js';
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
    if (c?.estilo !== undefined && !ESTILOS[c.estilo]) throw err('ESTILO_INEXISTENTE', `Capa ${name}: el estilo «${c.estilo}» no existe en el catálogo.`);
    layers[name] = { color, weight, legend: txt(c?.leyenda || name, `leyenda de ${name}`, 60), ...(c?.estilo ? { estilo: c.estilo } : {}), ...(Array.isArray(c?.trazo) ? { dash: c.trazo } : {}) };
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
    // PR #38: regiones de material DECLARADO (trama del catálogo + material con origen), símbolos del catálogo y marca de detalle.
    const regions = (v.regiones || []).map((r, k) => {
      const ctx = `Vista ${id}, región ${k + 1}`; const rid = idOk(r.id || `r${k + 1}`, ctx);
      if (!TRAMAS[r.trama]) throw err('TRAMA_INEXISTENTE', `${ctx}: la trama «${r.trama}» no existe en el catálogo.`);
      if (TRAMAS[r.trama].material_requerido && !(r.material && typeof r.material.nombre === 'string' && r.material.origen)) throw err('MATERIAL_SIN_ORIGEN', `${ctx}: declare material.nombre y material.origen (el material no se infiere).`);
      const loop = (l) => (Array.isArray(l) ? l.map((q) => [...pt(q.slice(0, 2), ctx), ...(num(q[2]) ? [q[2]] : [])]) : (() => { throw err('REGION_ABIERTA', `${ctx}: contorno inválido.`); })());
      return { id: rid, trama: r.trama, material: r.material ? { nombre: txt(r.material.nombre, `${ctx}: material`, 60), origen: txt(r.material.origen, `${ctx}: origen`, 140), estado: 'DECLARADO_SIN_VALIDAR', especificacion: r.material.especificacion ? txt(r.material.especificacion, ctx, 80) : 'PENDIENTE' } : null, element: r.elemento ? idOk(r.elemento, ctx) : 'unbound', contorno: loop(r.contorno), huecos: (r.huecos || []).map(loop), ...(r.etiqueta ? { etiqueta: txt(r.etiqueta, ctx, 60) } : {}) };
    });
    const symbols = (v.simbolos || []).map((x, k) => { const ctx = `Vista ${id}, símbolo ${k + 1}`; if (!SIMBOLOS[x.simbolo]) throw err('SIMBOLO_INEXISTENTE', `${ctx}: «${x.simbolo}» no existe en el catálogo.`); return { id: idOk(x.id || `s${k + 1}`, ctx), symbol: x.simbolo, at: pt(x.en, ctx), rot: num(x.rot) ? x.rot : 0, element: x.elemento ? idOk(x.elemento, ctx) : 'unbound' }; });
    const detalle = v.detalle ? { detail_ref: idOk(v.detalle, `Vista ${id}: detalle`) } : {};
    return { id, title: txt(v.titulo, `Vista ${id}: título`, 60), type: v.tipo, scale: v.escala, ...(v.escala_vertical ? { verticalScale: v.escala_vertical } : {}), entities: ents, dimensions, labels, notes, regions, symbols, ...detalle, ...(v.esquematico ? { schematic: true } : {}) };
  });
  if (!Array.isArray(e.laminas) || !e.laminas.length) throw err('ESPECIFICACION_INVALIDA', 'La especificación necesita al menos una lámina.');
  const sids = new Set(); const usadas = new Set();
  const sheets = e.laminas.map((l, i) => {
    const id = idOk(l.id, `lámina ${i + 1}`); if (sids.has(id)) throw err('ID_DUPLICADO', `Lámina duplicada «${id}».`); sids.add(id);
    if (!Array.isArray(l.vistas) || !l.vistas.length || l.vistas.length > 8) throw err('LAMINA_INVALIDA', `Lámina ${id}: entre 1 y 8 vistas (si no caben, el compositor las distribuye en láminas de continuación).`);
    for (const v of l.vistas) { if (!ids.has(v)) throw err('VISTA_AUSENTE', `Lámina ${id}: la vista «${v}» no existe.`); usadas.add(v); }
    return { id, title: txt(l.titulo, `Lámina ${id}: título`, 60), views: [...l.vistas] };
  });
  const huerfanas = [...ids].filter((v) => !usadas.has(v)); if (huerfanas.length) throw err('VISTA_SIN_LAMINA', `Vistas sin lámina: ${huerfanas.join(', ')}.`);
  // Trazabilidad: cada entidad lleva ref vista/id y el elemento físico que representa (o «sin_elemento»).
  const fisicos = Array.isArray(e.elementos_fisicos) ? e.elementos_fisicos : [];
  // Identidad física: «fuentes» son las entidades que se miden; «representaciones» dibujan el MISMO elemento en otra vista y no se miden.
  // R-02: identidad EXCLUSIVA e independiente del orden. Cada entidad dibujada pertenece como máximo a un elemento, con un solo rol.
  const idsFisicos = new Set();
  for (const f of fisicos) { const fid = idOk(f.id, 'elemento físico'); if (idsFisicos.has(fid)) throw err('ID_DUPLICADO', `Elemento físico duplicado «${fid}».`); idsFisicos.add(fid); }
  const todasRefs = views.flatMap((v) => v.entities.map((en) => `${v.id}/${en.id}`));
  const fuenteDe = new Map(); const reprDe = new Map();
  for (const f of fisicos) for (const [rol, lista] of [['fuente', f.fuentes || []], ['representacion', f.representaciones || []]]) for (const k of lista) {
    const cubre = todasRefs.filter((ref) => ref === k || ref.startsWith(`${k}-`)); if (!cubre.length) throw err('FUENTE_INEXISTENTE', `Elemento ${f.id}: «${k}» no es una entidad dibujada.`);
    for (const ref of cubre) {
      const previo = fuenteDe.has(ref) ? ['fuente', fuenteDe.get(ref)] : reprDe.has(ref) ? ['representacion', reprDe.get(ref)] : null;
      if (previo) throw err('IDENTIDAD_AMBIGUA', `La entidad ${ref} ya es ${previo[0]} de «${previo[1]}»; no puede ser además ${rol} de «${f.id}».`, 'Cada entidad dibujada pertenece a un solo elemento físico y con un solo rol.');
      (rol === 'fuente' ? fuenteDe : reprDe).set(ref, f.id);
    }
  }
  for (const v of views) for (const en of v.entities) { en.ref = `${v.id}/${en.id}`; en.element = fuenteDe.get(en.ref) || reprDe.get(en.ref) || en.element || 'sin_elemento'; en.role = fuenteDe.has(en.ref) ? 'fuente' : 'representacion'; }
  const warnings = [MARCA_TRABAJO, ...(e.advertencias || []).map((a, i) => txt(a, `advertencia ${i + 1}`, 140))];
  const P = (x) => (x === undefined ? 'PENDIENTE' : txt(x, 'metadato', 90));
  return {
    schema: 'tw.drawing/1', unit: 'm', layers, elements: fisicos.map((f) => ({ id: idOk(f.id, 'elemento físico'), tipo: f.tipo || 'elemento', unidad: 'm', fuente: (f.fuentes || [])[0] || null, magnitudes: f.magnitudes || {}, vistas: [...new Set((f.fuentes || []).map((r) => r.split('/')[0]))] })),
    provenance: e.origen ? txt(e.origen, 'origen', 140) : 'Especificación explícita aportada en la conversación',
    metadata: { project: P(e.proyecto), revision: P(e.revision), date: P(e.fecha), institution: P(e.institucion), author: P(e.autor), reviewer: 'PENDIENTE', approval: 'PENDIENTE', stage: e.etapa ? txt(e.etapa, 'etapa', 40) : 'REVISIÓN', source: 'Especificación de planos', coordinateSystem: 'NO CONFIRMADO', code, specialty: especialidad },
    ...(() => { const q = cantidadesDeEspecificacion(e, views); return { quantities: q.detalle, quantity_totals: q.totales, tables: cuadrosDeEspecificacion(e, views, q, sids) }; })(), views, sheets, callouts: llamadasDeEspecificacion(e, views), warnings,
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
    // R-01: una medición es TRAZADA solo si TODAS sus entidades son fuentes de un elemento físico declarado; si no, NEEDS_REVIEW (lectura exploratoria, no presupuestable).
    const trazada = ents.every((x) => x.element !== 'sin_elemento' && x.role === 'fuente');
    filas.push({ id, partida, descripcion: m.descripcion ? txt(m.descripcion, `${ctx}: descripción`, 80) : partida, metodo: `${METODO_MEDICION}/${m.metodo}`, unidad: UNIDAD_METODO[m.metodo], valor: signo * valor, formula: `${signo < 0 ? 'DESCUENTO: ' : ''}${formula}`, fuentes: ents.map((x) => x.ref).join(' '), elementos: [...new Set(ents.map((x) => x.element))].join(' '), naturaleza: 'MEDIDA sobre la geometría del modelo', estado: trazada ? 'TRAZADA' : 'NEEDS_REVIEW', procedencia: trazada ? 'elemento_fisico_declarado' : 'geometria_sin_identidad_fisica', vistas_medidas: [...new Set(ents.map((x) => x.ref.split('/')[0]))] });
  }
  for (const [i, d] of (e.cantidades_declaradas || []).entries()) {
    const ctx = `Cantidad declarada ${i + 1}`;
    if (!num(d.cantidad) || !d.unidad || !d.origen) throw err('DATOS_INVALIDOS', `${ctx}: requiere cantidad numérica, unidad y origen (quién/qué documento la aporta).`);
    filas.push({ id: `d${i + 1}`, partida: txt(d.partida || d.descripcion || `declarada-${i + 1}`, ctx, 60), descripcion: d.descripcion ? txt(d.descripcion, ctx, 80) : '', metodo: 'DECLARADA', unidad: txt(d.unidad, ctx, 10), valor: d.cantidad, formula: '—', fuentes: '', naturaleza: `DECLARADA (no medida desde el plano). Origen: ${txt(d.origen, ctx, 100)}`, estado: 'DECLARADA', procedencia: 'declaracion_con_origen' });
  }
  // Totales por partida medida (con descuentos explícitos). Una partida mezcla de medido y declarado no se suma.
  // Los TOTALES van en una lista separada: nunca se suman junto con el detalle (PL-09).
  const totales = []; const partidas = [...new Set(filas.filter((f) => f.metodo !== 'DECLARADA').map((f) => f.partida))];
  for (const p of partidas) {
    const fs2 = filas.filter((f) => f.partida === p); if (fs2.some((f) => f.metodo === 'DECLARADA')) throw err('ORIGEN_MEZCLADO', `Partida «${p}»: no se suman cantidades medidas y declaradas.`);
    validarHuecos(fs2.map((f) => contornos.get(f.id)).filter(Boolean), p);
    // R-01: sin identidad, la misma partida y método medidos desde varias vistas pueden ser el MISMO elemento: se advierte en cada fila.
    for (const met of new Set(fs2.map((f) => f.metodo))) {
      const sinId = fs2.filter((f) => f.metodo === met && f.estado === 'NEEDS_REVIEW' && f.valor > 0); const vistas = new Set(sinId.flatMap((f) => f.vistas_medidas));
      if (vistas.size > 1) for (const f of sinId) f.advertencia = `Partida «${p}» medida en varias vistas (${[...vistas].join(', ')}) sin identidad física declarada: posible doble medición del mismo elemento.`;
    }
    const u = [...new Set(fs2.map((f) => f.unidad))]; if (u.length > 1) throw err('UNIDAD_INCOMPATIBLE', `Partida «${p}»: mezcla unidades ${u.join(', ')}.`);
    const total = fs2.reduce((t, f) => t + f.valor, 0); if (!(total > 0)) throw err('MEDICION_INVALIDA', `Partida «${p}»: los descuentos superan la cantidad medida.`);
    if (fs2.length > 1) totales.push({ id: `total-${p}`, partida: p, descripcion: `TOTAL ${p}`, metodo: METODO_MEDICION, unidad: u[0], valor: total, formula: fs2.map((f) => f.id).join(' + '), fuentes: '', naturaleza: 'MEDIDA (suma de mediciones y descuentos)', estado: fs2.every((f) => f.estado === 'TRAZADA') ? 'TRAZADA' : 'NEEDS_REVIEW' });
  }
  return { detalle: filas.map(({ vistas_medidas, ...f }) => ({ ...f, vistas_medidas: vistas_medidas ? vistas_medidas.join(' ') : undefined, fila: 'detalle' })), totales: totales.map((t) => ({ ...t, fila: 'total' })) };
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

// PR #38 C4: llamadas a detalle (bidireccionales) y cuadros técnicos con la MISMA fuente que la cubicación.
function llamadasDeEspecificacion(e, views) {
  const out = []; const vistas = new Map(views.map((v) => [v.id, v]));
  for (const [i, c] of (e.llamadas || []).entries()) {
    const ctx = `Llamada ${i + 1}`; const det = vistas.get(c.detalle); const orig = vistas.get(c.desde_vista);
    if (!det || !det.detail_ref) throw err('REFERENCIAS_INVALIDAS', `${ctx}: la vista de detalle «${c.detalle}» no existe o no está marcada como detalle.`);
    if (!orig) throw err('REFERENCIAS_INVALIDAS', `${ctx}: la vista de origen «${c.desde_vista}» no existe.`);
    det.back_ref = { view: orig.id };
    out.push({ id: `C-${det.detail_ref}`, label: det.detail_ref, from_view: orig.id, at: pt(c.en, ctx), target_view: det.id });
  }
  return out;
}
function cuadrosDeEspecificacion(e, views, q, laminas) {
  const out = [];
  for (const [i, c] of (e.cuadros || []).entries()) {
    const ctx = `Cuadro ${i + 1}`; const id = idOk(c.id || `T${i + 1}`, ctx); const lamina = idOk(c.lamina, `${ctx}: lámina`);
    if (!laminas.has(lamina)) throw err('LAMINA_AUSENTE', `${ctx}: la lámina ${lamina} no existe.`);
    if (c.tipo === 'cantidades') {
      out.push({ id, sheet: lamina, title: txt(c.titulo || 'CUADRO DE CANTIDADES', ctx, 60), source: 'tw.cantidades/1',
        columns: [{ key: 'partida', label: 'Partida' }, { key: 'valor', label: 'Cantidad', align: 'right' }, { key: 'u', label: 'Unidad' }, { key: 'estado', label: 'Estado' }],
        rows: [...q.detalle.map((d) => ({ id: d.id, refs: [d.id], quantity_ref: d.id, values: { partida: `${d.valor < 0 ? '(-) ' : ''}${d.descripcion || d.partida}`, valor: d.valor, u: d.unidad, estado: d.estado }, fmt: { valor: d.unidad === 'u' ? 0 : 3 } })),
          ...q.totales.map((t) => ({ id: t.id, refs: [t.id], quantity_ref: t.id, values: { partida: t.descripcion, valor: t.valor, u: t.unidad, estado: t.estado }, fmt: { valor: t.unidad === 'u' ? 0 : 3 } }))],
        footnotes: ['Medido sobre la geometría dibujada (TW-MED/1). Los totales son de control: no se suman con el detalle.'] });
    } else if (c.tipo === 'materiales') {
      const mats = new Map(); for (const v of views) for (const r of v.regions || []) if (r.material && !mats.has(r.material.nombre)) mats.set(r.material.nombre, r);
      out.push({ id, sheet: lamina, title: txt(c.titulo || 'CUADRO DE MATERIALES', ctx, 60), source: 'regiones declaradas',
        columns: [{ key: 'mat', label: 'Material' }, { key: 'origen', label: 'Origen del dato' }, { key: 'eett', label: 'Especificación técnica' }],
        rows: [...mats.values()].map((r, k) => ({ id: `m${k + 1}`, refs: [r.id], values: { mat: r.material.nombre, origen: r.material.origen, eett: r.material.especificacion } })),
        footnotes: ['Materiales declarados en la especificación; sin validación profesional.'] });
    } else throw err('TABLA_INVALIDA', `${ctx}: tipo «${c.tipo}» no soportado (cantidades, materiales).`);
  }
  return out;
}

/**
 * Segundo corpus (PL-DOMAIN-02): muro de fachada con un vano declarado. Elevación (fuente de la superficie), planta y corte
 * (representaciones), detalle del vano con datos PENDIENTES, trama del material declarado y cuadros de cantidades y materiales.
 */
export function muroConVanoEspecificacion({ largo = 6, alto = 2.6, espesor = 0.2, vano = { x: 2, ancho: 1.5, alto: 1.2, antepecho: 0.9 }, material = { nombre: 'Albañilería de ladrillo', origen: 'Declarado en el caso de prueba EDI (fixture del repositorio)' }, proyecto = 'Muro con vano' } = {}) {
  for (const [n, v] of Object.entries({ largo, alto, espesor, ...Object.fromEntries(Object.entries(vano).map(([k, x]) => [`vano.${k}`, x])) })) if (!num(v) || v < 0) throw err('DATOS_INVALIDOS', `«${n}» debe ser un número en metros (no se supone).`);
  if (vano.x <= 0 || vano.x + vano.ancho >= largo || vano.antepecho + vano.alto >= alto) throw err('DATOS_INVALIDOS', 'El vano no cabe dentro del muro.');
  const R = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; const v = vano;
  const mat = material ? { material, trama: 'MASONRY_WALL' } : null;
  return {
    codigo: 'EDI', especialidad: 'edificación', proyecto, revision: 'R01', etapa: 'ANTEPROYECTO',
    capas: { MUROS: { color: 7, grosor: 0.5, leyenda: 'Muro (contorno)', estilo: 'WALL_CUT' }, VANOS: { color: 3, grosor: 0.25, leyenda: 'Vano declarado', estilo: 'OPENING' }, NPT: { color: 1, grosor: 0.18, leyenda: 'Nivel de piso terminado', trazo: [4, 1], estilo: 'LEVEL_LINE' } },
    vistas: [
      { id: 'elevacion', titulo: 'Elevación del muro', tipo: 'elevacion', escala: 50, elementos: [{ id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: largo, alto }, { id: 'vano', tipo: 'rectangulo', capa: 'VANOS', origen: [v.x, v.antepecho], ancho: v.ancho, alto: v.alto }, { id: 'npt', tipo: 'linea', capa: 'NPT', a: [-0.5, 0], b: [largo + 0.5, 0] }],
        cotas: [{ id: 'largo', tipo: 'lineal', a: [0, 0], b: [largo, 0], desfase: 12 }, { id: 'alto', tipo: 'lineal', a: [largo, 0], b: [largo, alto], desfase: 12 }, { id: 'vano-ancho', tipo: 'lineal', a: [v.x, v.antepecho + v.alto], b: [v.x + v.ancho, v.antepecho + v.alto], desfase: -8 }, { id: 'vano-alto', tipo: 'lineal', a: [v.x, v.antepecho], b: [v.x, v.antepecho + v.alto], desfase: -10 }, { id: 'antepecho', tipo: 'lineal', a: [v.x + v.ancho, 0], b: [v.x + v.ancho, v.antepecho], desfase: 10 }],
        regiones: mat ? [{ id: 'muro-elev', trama: mat.trama, material: mat.material, elemento: 'muro', contorno: R(0, 0, largo, alto), huecos: [R(v.x, v.antepecho, v.ancho, v.alto)] }] : [],
        notas: ['Superficie del muro medida en esta elevación (fuente); planta y corte son representaciones y no se miden.'] },
      { id: 'planta', titulo: 'Planta del muro', tipo: 'planta', escala: 50, elementos: [{ id: 'pilar-izq', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: v.x, alto: espesor }, { id: 'pilar-der', tipo: 'rectangulo', capa: 'MUROS', origen: [v.x + v.ancho, 0], ancho: largo - v.x - v.ancho, alto: espesor }, { id: 'vano-pl', tipo: 'linea', capa: 'VANOS', a: [v.x, espesor / 2], b: [v.x + v.ancho, espesor / 2] }],
        cotas: [{ id: 'espesor', tipo: 'lineal', a: [0, 0], b: [0, espesor], desfase: -10 }, { id: 'vano-pl', tipo: 'lineal', a: [v.x, 0], b: [v.x + v.ancho, 0], desfase: 10 }],
        regiones: mat ? [{ id: 'muro-pl-izq', trama: mat.trama, material: mat.material, elemento: 'muro', contorno: R(0, 0, v.x, espesor) }, { id: 'muro-pl-der', trama: mat.trama, material: mat.material, elemento: 'muro', contorno: R(v.x + v.ancho, 0, largo - v.x - v.ancho, espesor) }] : [] },
      { id: 'corte', titulo: 'Corte por el vano', tipo: 'corte', escala: 20, elementos: [{ id: 'antepecho', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: espesor, alto: v.antepecho }, { id: 'sobre-vano', tipo: 'rectangulo', capa: 'MUROS', origen: [0, v.antepecho + v.alto], ancho: espesor, alto: alto - v.antepecho - v.alto }, { id: 'vano-c', tipo: 'linea', capa: 'VANOS', a: [espesor / 2, v.antepecho], b: [espesor / 2, v.antepecho + v.alto] }, { id: 'npt-c', tipo: 'linea', capa: 'NPT', a: [-0.4, 0], b: [espesor + 0.4, 0] }],
        cotas: [{ id: 'esp-c', tipo: 'lineal', a: [0, 0], b: [espesor, 0], desfase: 10 }, { id: 'antepecho-c', tipo: 'lineal', a: [espesor, 0], b: [espesor, v.antepecho], desfase: 10 }, { id: 'vano-c', tipo: 'lineal', a: [espesor, v.antepecho], b: [espesor, v.antepecho + v.alto], desfase: 10 }],
        regiones: mat ? [{ id: 'muro-c1', trama: mat.trama, material: mat.material, elemento: 'muro', contorno: R(0, 0, espesor, v.antepecho) }, { id: 'muro-c2', trama: mat.trama, material: mat.material, elemento: 'muro', contorno: R(0, v.antepecho + v.alto, espesor, alto - v.antepecho - v.alto) }] : [] },
      { id: 'det-vano', titulo: 'D1 Borde inferior del vano', tipo: 'detalle', escala: 10, detalle: 'D1', elementos: [{ id: 'muro-d', tipo: 'polilinea', capa: 'MUROS', puntos: [[0, v.antepecho - 0.3], [0, v.antepecho], [espesor, v.antepecho], [espesor, v.antepecho - 0.3]] }],
        cotas: [{ id: 'esp-d', tipo: 'lineal', a: [0, v.antepecho], b: [espesor, v.antepecho], desfase: -10 }],
        regiones: mat ? [{ id: 'muro-d', trama: mat.trama, material: mat.material, elemento: 'muro', contorno: R(0, v.antepecho - 0.3, espesor, 0.3) }] : [],
        simbolos: [{ id: 'pend-d', simbolo: 'PENDING_MARK', en: [espesor + 0.08, v.antepecho - 0.12] }],
        notas: ['D1: alféizar, dintel, marco y sellos NO declarados: PENDIENTES (no se dibujan).'] },
    ],
    llamadas: [{ desde_vista: 'corte', en: [espesor, v.antepecho], detalle: 'det-vano' }],
    laminas: [{ id: '01', titulo: 'Elevación y planta', vistas: ['elevacion', 'planta'] }, { id: '02', titulo: 'Corte y detalle', vistas: ['corte', 'det-vano'] }],
    cuadros: [{ id: 'T-CANT', lamina: '01', tipo: 'cantidades', titulo: 'CUADRO DE CANTIDADES' }, ...(mat ? [{ id: 'T-MAT', lamina: '02', tipo: 'materiales', titulo: 'CUADRO DE MATERIALES' }] : [])],
    elementos_fisicos: [{ id: 'muro', tipo: 'muro', fuentes: ['elevacion/muro'], representaciones: ['planta/pilar-izq', 'planta/pilar-der', 'corte/antepecho', 'corte/sobre-vano', 'det-vano/muro-d'] }, { id: 'vano', tipo: 'vano', fuentes: ['elevacion/vano'], representaciones: ['planta/vano-pl', 'corte/vano-c'] }],
    mediciones: [{ id: 'm-muro', partida: 'Muro de fachada', descripcion: 'Superficie bruta del muro', metodo: 'area', fuentes: ['elevacion/muro'] }, { id: 'm-vano', partida: 'Muro de fachada', descripcion: 'Vano de ventana', metodo: 'area', fuentes: ['elevacion/vano'], signo: -1 }],
    advertencias: ['Caso de prueba de edificación: geometría y material declarados; sin cálculo estructural.'],
  };
}
