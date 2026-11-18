// tw.symbol-catalog/1 — registro ÚNICO de estilos, tramas y símbolos del motor de planos (PR #38, C2).
// Cada entrada se define UNA vez y se dibuja desde la misma geometría declarativa en la escena real, en la muestra de leyenda,
// en el PDF y en el DXF. Las propuestas son representación gráfica, NO convenciones normativas certificadas: estado PROPUESTO
// hasta revisión profesional. Unidades: geometría de símbolo y tramas en mm de papel.
import { UserError } from '../mcp/util.js';

export const CATALOGO_ESQUEMA = 'tw.symbol-catalog/1';
export const CATALOGO_VERSION = '2026-11-18.1';
export const ESTADOS = ['DEFINIDO', 'PROPUESTO', 'PENDIENTE'];

/** Estilos de línea semánticos (rol técnico → presentación). rgb: impresión en color; en monocromo todo es negro y el significado
 *  se conserva por grosor + tipo de línea (nunca solo por color). */
export const ESTILOS = {
  EXCAVATION_CONTOUR: { significado: 'Contorno de excavación', rgb: '#1A1A1A', grosor: 0.5, trazo: null, estado: 'PROPUESTO' },
  INNER_LINING_FACE: { significado: 'Cara interior del revestimiento', rgb: '#245D4B', grosor: 0.25, trazo: null, estado: 'PROPUESTO' },
  ROCK_BOLT: { significado: 'Eje de perno de anclaje declarado', rgb: '#A3363C', grosor: 0.25, trazo: null, estado: 'PROPUESTO' },
  WIRE_MESH: { significado: 'Malla de acero declarada (traza esquemática)', rgb: '#307E83', grosor: 0.18, trazo: [2, 1], estado: 'PROPUESTO' },
  CENTERLINE: { significado: 'Eje de geometría', rgb: '#83527E', grosor: 0.18, trazo: [4, 1, 1, 1], estado: 'PROPUESTO' },
  DIMENSION: { significado: 'Cota geométrica física', rgb: '#4B4B4B', grosor: 0.18, trazo: null, estado: 'PROPUESTO' },
  SECTION_CUT: { significado: 'Traza de corte con flechas y rótulo', rgb: '#A3363C', grosor: 0.35, trazo: [8, 2, 2, 2], estado: 'PROPUESTO' },
  ALTERNATIVE_FACE: { significado: 'Cara de alternativa comparativa (no elegida)', rgb: '#5A5A9A', grosor: 0.25, trazo: null, estado: 'PROPUESTO' },
  WALL_CUT: { significado: 'Muro cortado', rgb: '#1A1A1A', grosor: 0.5, trazo: null, estado: 'PROPUESTO' },
  SLAB: { significado: 'Losa / fundación', rgb: '#3A3A3A', grosor: 0.35, trazo: null, estado: 'PROPUESTO' },
  LEVEL_LINE: { significado: 'Nivel de referencia', rgb: '#A3363C', grosor: 0.18, trazo: [4, 1], estado: 'PROPUESTO' },
  OPENING: { significado: 'Vano (hueco en muro)', rgb: '#245D4B', grosor: 0.25, trazo: null, estado: 'PROPUESTO' },
  GENERIC: { significado: 'Geometría declarada sin rol técnico de catálogo', rgb: '#1A1A1A', grosor: 0.25, trazo: null, estado: 'PENDIENTE' },
  BREAK_LINE: { significado: 'Línea de corte de detalle (interrupción del dibujo)', rgb: '#4B4B4B', grosor: 0.18, trazo: null, estado: 'PROPUESTO' },
};

/** Tramas de área: líneas paralelas (una o varias familias), paso en mm de papel. No miden nada (measurable:false). */
export const TRAMAS = {
  SHOTCRETE_REGION: { significado: 'Revestimiento proyectado (shotcrete) declarado', familias: [{ angulo: 45, paso: 1.2 }], rgb: '#245D4B', grosor: 0.13, dxf: 'ANSI31', estado: 'PROPUESTO', material_requerido: true },
  WIRE_MESH_REGION: { significado: 'Paño de malla de acero declarada', familias: [{ angulo: 45, paso: 3 }, { angulo: 135, paso: 3 }], rgb: '#307E83', grosor: 0.13, dxf: 'ANSI37', estado: 'PROPUESTO', material_requerido: true },
  MESH_OVERLAP_ZONE: { significado: 'Zona de traslapo de malla (ancho según dato declarado)', familias: [{ angulo: 45, paso: 1.5 }, { angulo: 135, paso: 1.5 }], rgb: '#A3363C', grosor: 0.13, dxf: 'ANSI37', estado: 'PROPUESTO', material_requerido: true },
  MASONRY_WALL: { significado: 'Muro de albañilería / hormigón declarado (corte)', familias: [{ angulo: 45, paso: 1.5 }], rgb: '#3A3A3A', grosor: 0.13, dxf: 'ANSI31', estado: 'PROPUESTO', material_requerido: true },
  CONCRETE: { significado: 'Hormigón declarado', familias: [{ angulo: 45, paso: 2 }, { angulo: 135, paso: 4 }], rgb: '#4B4B4B', grosor: 0.13, dxf: 'ANSI37', estado: 'PROPUESTO', material_requerido: true },
};

/** Símbolos vectoriales (geometría en mm de papel, origen = punto de inserción). `kind`: primitivas del símbolo. */
export const SIMBOLOS = {
  ANCHOR_HEAD: { significado: 'Cabeza de perno (esquemática: placa y tuerca NO declaradas)', estado: 'PROPUESTO', medible: false,
    geometria: [{ kind: 'line', a: [-1.2, 0], b: [1.2, 0] }, { kind: 'line', a: [-1.2, -0.5], b: [1.2, -0.5] }, { kind: 'line', a: [-1.2, 0], b: [-1.2, -0.5] }, { kind: 'line', a: [1.2, 0], b: [1.2, -0.5] }] },
  DETAIL_CALLOUT: { significado: 'Llamada a detalle (globo con número de detalle y lámina)', estado: 'PROPUESTO', medible: false,
    geometria: [{ kind: 'circle', center: [0, 0], radius: 4.5 }, { kind: 'line', a: [-4.5, 0], b: [4.5, 0] }] },
  SECTION_MARK: { significado: 'Flecha de dirección de corte', estado: 'PROPUESTO', medible: false,
    geometria: [{ kind: 'line', a: [0, 0], b: [4, 0] }, { kind: 'line', a: [4, 0], b: [2.6, 1] }, { kind: 'line', a: [4, 0], b: [2.6, -1] }] },
  PENDING_MARK: { significado: 'Dato técnico PENDIENTE: no se dibuja especificación ficticia', estado: 'DEFINIDO', medible: false,
    geometria: [{ kind: 'line', a: [-2.5, -2], b: [2.5, -2] }, { kind: 'line', a: [2.5, -2], b: [0, 2.3] }, { kind: 'line', a: [0, 2.3], b: [-2.5, -2] }] },
};

/** Rol técnico de cada capa base del motor → estilo del catálogo (las capas declaradas por especificación indican `estilo`). */
export const ESTILO_DE_CAPA = {
  EXCAVACION: 'EXCAVATION_CONTOUR', INTERIOR: 'INNER_LINING_FACE', EJE: 'CENTERLINE', ALTERNATIVA_6: 'ALTERNATIVE_FACE', ALTERNATIVA_8: 'ALTERNATIVE_FACE',
  CORTE: 'SECTION_CUT', COTAS: 'DIMENSION', PERNOS: 'ROCK_BOLT', MALLA: 'WIRE_MESH', MUROS: 'WALL_CUT', LOSA: 'SLAB', NPT: 'LEVEL_LINE', VANOS: 'OPENING', DETALLE_CORTE: 'BREAK_LINE',
};

export function estiloDeCapa(nombre, capa) {
  const id = capa?.estilo || ESTILO_DE_CAPA[nombre] || 'GENERIC';
  if (!ESTILOS[id]) throw new UserError('ESTILO_INEXISTENTE', `La capa ${nombre} referencia el estilo «${id}», que no existe en ${CATALOGO_ESQUEMA}.`);
  return id;
}

/** Validación exhaustiva del catálogo (PL-SYM-01): ids únicos, estado válido, geometría y muestra renderizable, tramas con paso > 0. */
export function validarCatalogo(cat = { ESTILOS, TRAMAS, SIMBOLOS }) {
  const problemas = []; const vistos = new Set();
  for (const [grupo, entradas] of Object.entries(cat)) for (const [id, e] of Object.entries(entradas)) {
    if (vistos.has(id)) problemas.push(`id duplicado entre grupos: ${id}`); vistos.add(id);
    if (!/^[A-Z][A-Z0-9_]+$/.test(id)) problemas.push(`id inválido: ${id}`);
    if (!ESTADOS.includes(e.estado)) problemas.push(`${id}: estado inválido ${e.estado}`);
    if (typeof e.significado !== 'string' || e.significado.length < 4) problemas.push(`${id}: sin significado`);
    if (grupo === 'ESTILOS' && !(e.grosor > 0 && /^#[0-9A-F]{6}$/i.test(e.rgb))) problemas.push(`${id}: grosor/color inválido`);
    if (grupo === 'ESTILOS' && e.trazo && (e.trazo.length % 2 || !e.trazo.every((x) => x > 0))) problemas.push(`${id}: trazo inválido`);
    if (grupo === 'TRAMAS' && (!Array.isArray(e.familias) || !e.familias.length || !e.familias.every((f) => f.paso > 0 && Number.isFinite(f.angulo)) || !e.dxf)) problemas.push(`${id}: trama sin familias válidas`);
    if (grupo === 'SIMBOLOS' && (!Array.isArray(e.geometria) || !e.geometria.length || e.medible !== false)) problemas.push(`${id}: símbolo sin geometría o marcado como medible`);
  }
  return { ok: problemas.length === 0, problemas, schema: CATALOGO_ESQUEMA, version: CATALOGO_VERSION };
}

/** Color de impresión de un estilo según el modo: 'color' (catálogo) o 'mono' (negro; el significado lo llevan grosor y trazo). */
export const colorImpresion = (rgb, modo = 'color') => (modo === 'mono' ? '#000000' : rgb);
