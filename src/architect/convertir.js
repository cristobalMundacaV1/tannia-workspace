// Conversión por COPIA de un modelo de diseño v1 (árbol rectangular) a scheme/2. El v1 no se modifica ni se migra.
import { SCHEMA_IDS } from './schemas.js';
import { anilloDeRect } from './poligonos.js';
import { huellaDeEspacios } from './derivar_poly.js';
import { VERSION_MOTOR } from './version.js';

const ZONA = { living_comedor: 'social', cocina: 'servicio', bano: 'servicio', pasillo: 'circulacion', dormitorio: 'privada', dormitorio_principal: 'privada' };
export function esquemaDesdeV1(modelo, geo, { id = 'v1-copia', briefRef = 'v1' } = {}) {
  const spaces = Object.values(geo.recintos).map((r) => ({ id: r.id, nombre: r.nombre, tipo: r.tipo, ring: anilloDeRect(geo.rect[r.id]), zona: ZONA[r.tipo] ?? 'social' }));
  const openings = geo.aberturas.filter((a) => !a.invalida).map((a) => ({
    id: a.id, tipo: a.tipo, ...(a.funcion ? { funcion: a.funcion } : {}), ...(a.abre_hacia ? { abre_hacia: a.abre_hacia } : {}),
    entre: a.entre ? [...a.entre] : [a.recinto], ancho_mm: a.ancho_mm, alto_mm: a.alto_mm ?? (a.tipo === 'ventana' ? 1200 : 2100),
    ...(a.tipo === 'ventana' ? { antepecho_mm: a.antepecho_mm ?? 900 } : {}), centro: a.orient === 'h' ? [a.centro, a.fijo] : [a.fijo, a.centro], ...(a.lado ? { exterior_side: a.lado } : {}),
  }));
  return {
    schema: SCHEMA_IDS.scheme, id, brief_ref: briefRef, site_ref: null, engine_version: VERSION_MOTOR, concept: 'compacta', rationale: 'Copia de un anteproyecto v1 (planta rectangular); el original no se modifica.',
    footprint_polygons_mm: huellaDeEspacios(spaces), open_courts_mm: [], espesores_mm: { ext: modelo.espesores.ext, int: modelo.espesores.int }, altura_piso_cielo_mm: modelo.altura_piso_cielo_mm,
    spaces, openings, exterior_areas: [], separaciones_abiertas: modelo.separaciones.filter((s) => s.tipo === 'abierta').map((s) => [s.a, s.b]), adjacencies: [], line_of_sight_goals: [], sources: [], model_status: 'concept',
  };
}
