// Motor GENÉRICO de planos (auditoría integral 2026-11-17, TW-PRO-06): una especificación declarativa de vistas
// (planta, corte, elevación, perfil, sección, detalle) se convierte en el mismo modelo `tw.drawing/1` que usan el compositor,
// el DXF (AC1024, cotas DIMENSION nativas, layouts y viewports) y el PDF. El túnel es solo un adaptador más.
// Coordenadas del modelo en metros (tamaño real); papel en milímetros. Nada se infiere: cotas, escalas y capas son explícitas.
import { UserError } from '../mcp/util.js';
import { LAYERS } from './model.js';

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
 *   laminas: [{id, titulo, vistas: [ids]}], elementos_fisicos?: [{id, tipo, unidad, vistas}] }
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
  const porEntidad = new Map(); for (const f of fisicos) for (const r of f.fuentes || []) porEntidad.set(r, f.id);
  for (const v of views) for (const en of v.entities) { en.ref = `${v.id}/${en.id}`; en.element = porEntidad.get(en.ref) || en.element || 'sin_elemento'; en.role = porEntidad.has(en.ref) ? 'fuente' : 'representacion'; }
  const warnings = [MARCA_TRABAJO, ...(e.advertencias || []).map((a, i) => txt(a, `advertencia ${i + 1}`, 140))];
  const P = (x) => (x === undefined ? 'PENDIENTE' : txt(x, 'metadato', 90));
  return {
    schema: 'tw.drawing/1', unit: 'm', layers, elements: fisicos.map((f) => ({ id: idOk(f.id, 'elemento físico'), tipo: f.tipo || 'elemento', unidad: 'm', fuente: (f.fuentes || [])[0] || null, magnitudes: f.magnitudes || {}, vistas: [...new Set((f.fuentes || []).map((r) => r.split('/')[0]))] })),
    provenance: e.origen ? txt(e.origen, 'origen', 140) : 'Especificación explícita aportada en la conversación',
    metadata: { project: P(e.proyecto), revision: P(e.revision), date: P(e.fecha), institution: P(e.institucion), author: P(e.autor), reviewer: 'PENDIENTE', approval: 'PENDIENTE', stage: e.etapa ? txt(e.etapa, 'etapa', 40) : 'REVISIÓN', source: 'Especificación de planos', coordinateSystem: 'NO CONFIRMADO', code, specialty: especialidad },
    quantities: e.cantidades || [], views, sheets, warnings,
  };
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
