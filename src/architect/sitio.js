// Contexto de sitio (site/1): predio, acceso, norte verdadero, coordenadas, fuentes y restricciones urbanas SOLO con fuente documentada.
// Nunca se infiere nada del nombre de una comuna. Sin norte/coordenadas/zona horaria no hay estudio solar real.
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { SCHEMA_IDS, sitioVacio, validar } from './schemas.js';
import { area, esOrtogonal, autoIntersecta, areaFirmada, bbox } from './poligonos.js';
import { cabeEnPredio } from './alternativas.js';
import { localAInstante } from './solar.js';

const IANA_OK = (z) => { try { localAInstante('2026-01-01T12:00', z); return true; } catch { return false; } };

/** Predio rectangular a partir de medidas (ancho × fondo), con el frente al lado `frente` ('S' por defecto). */
export function predioRectangular(ancho_mm, fondo_mm) {
  if (!(ancho_mm > 1000 && fondo_mm > 1000)) throw new UserError('PREDIO_INVALIDO', 'Las medidas del predio deben ser mayores a 1 m y estar en mm.');
  return [[0, 0], [ancho_mm, 0], [ancho_mm, fondo_mm], [0, fondo_mm]];
}

/**
 * Crea/actualiza un sitio. Todo dato opcional; el estado epistémico lo declara quien lo entrega. No se completan faltantes.
 * @param previo site/1 previo o null; @param cambios campos a fijar
 */
export function actualizarSitio(previo, cambios = {}) {
  const s = JSON.parse(JSON.stringify(previo ?? sitioVacio()));
  if (cambios.coordenadas !== undefined) {
    if (cambios.coordenadas === null) s.coordinates = null;
    else { const c = cambios.coordenadas; s.coordinates = { lat: c.lat, lon: c.lon, ...(c.elevacion_m != null ? { elevation_m: c.elevacion_m } : {}), status: c.estado ?? 'confirmed', ...(c.fuente ? { source: c.fuente } : {}) }; }
  }
  if (cambios.zona_horaria !== undefined) { if (cambios.zona_horaria !== null && !IANA_OK(cambios.zona_horaria)) throw new UserError('ZONA_INVALIDA', `Zona horaria IANA no reconocida: ${cambios.zona_horaria} (ej. America/Santiago).`); s.timezone = cambios.zona_horaria; }
  if (cambios.norte_grados !== undefined) {
    if (cambios.norte_grados === null) s.true_north_deg_from_local_plus_y_clockwise = null;
    else { const g = ((Number(cambios.norte_grados) % 360) + 360) % 360; if (!Number.isFinite(g)) throw new UserError('NORTE_INVALIDO', 'El norte debe ser un ángulo en grados.'); s.true_north_deg_from_local_plus_y_clockwise = { valor: g, estado: cambios.norte_estado ?? 'confirmed', ...(cambios.norte_fuente ? { fuente: cambios.norte_fuente } : {}) }; }
  }
  if (cambios.predio !== undefined) {
    if (cambios.predio === null) s.parcel_polygon_mm = null;
    else {
      const ring = cambios.predio.anillo; if (!Array.isArray(ring) || ring.length < 3) throw new UserError('PREDIO_INVALIDO', 'El predio necesita un polígono de al menos 3 vértices [x,y] en mm.');
      if (!esOrtogonal(ring)) throw new UserError('PREDIO_NO_SOPORTADO', 'En esta versión el predio debe ser un polígono ortogonal (lados paralelos a los ejes); indique otro marco o aproxime.', 'Un predio irregular necesita un levantamiento; no se inventa.');
      if (autoIntersecta(ring)) throw new UserError('PREDIO_INVALIDO', 'El polígono del predio se autointersecta.');
      s.parcel_polygon_mm = { ring: areaFirmada(ring) < 0 ? [...ring].reverse() : ring, status: cambios.predio.estado ?? 'confirmed', ...(cambios.predio.fuente ? { source: cambios.predio.fuente } : {}) };
    }
  }
  if (cambios.accesos) s.street_access = cambios.accesos.map((a, i) => ({ id: a.id ?? `acc${i + 1}`, side: a.lado, ...(a.x_mm != null ? { x_mm: a.x_mm } : {}), ...(a.ancho_mm != null ? { width_mm: a.ancho_mm } : {}), status: a.estado ?? 'confirmed' }));
  if (cambios.obstaculos) s.context_obstacles = cambios.obstaculos.map((o, i) => ({ id: o.id ?? `obs${i + 1}`, ring: o.anillo, height_mm: o.altura_mm ?? null, height_status: o.altura_mm == null ? 'unknown' : (o.altura_estado ?? 'confirmed'), kind: o.tipo ?? 'building' }));
  if (cambios.vegetacion) s.vegetation = cambios.vegetacion.map((v, i) => ({ id: v.id ?? `veg${i + 1}`, x_mm: v.x_mm, y_mm: v.y_mm, radius_mm: v.radio_mm, height_mm: v.altura_mm ?? null, deciduous: v.caduca ?? null }));
  if (cambios.vistas) s.view_targets = cambios.vistas.map((v, i) => ({ id: v.id ?? `vista${i + 1}`, x_mm: v.x_mm, y_mm: v.y_mm, z_mm: v.z_mm ?? 1500, desirable: v.deseable ?? true }));
  if (cambios.ruidos) s.noise_sources = cambios.ruidos.map((v, i) => ({ id: v.id ?? `ruido${i + 1}`, side: v.lado }));
  if (cambios.fuentes) s.sources = [...s.sources, ...cambios.fuentes.map((f, i) => ({ id: f.id ?? `fuente${s.sources.length + i + 1}`, kind: f.tipo, ref: f.ref, sha256: f.sha256 ?? null, ...(f.escala_legible != null ? { scale_legible: f.escala_legible } : {}) }))];
  s.status = estadoSitio(s);
  const r = validar('site', s); if (!r.ok) throw new UserError('SITIO_INVALIDO', `El sitio no es válido: ${r.errores.join(' | ')}`);
  return r.valor;
}

export function estadoSitio(s) {
  const norte = s.true_north_deg_from_local_plus_y_clockwise; const ok = (d) => d && d.estado !== 'unknown';
  const solar = s.coordinates && s.coordinates.status !== 'unknown' && s.timezone && ok(norte) && norte.estado === 'confirmed' && s.coordinates.status === 'confirmed';
  if (solar) return 'solar_study_possible';
  return s.parcel_polygon_mm ? 'parcel_known_only' : 'insufficient_for_real_solar_study';
}

/** Qué falta para cada tipo de estudio. Lista concreta de antecedentes a pedir. */
export function antecedentesFaltantes(s) {
  const f = [];
  if (!s.parcel_polygon_mm) f.push({ id: 'predio', texto: 'Forma y medidas del predio (plano de deslindes/levantamiento).', necesario_para: ['encaje', 'sombras de contexto'] });
  if (!s.street_access.length) f.push({ id: 'acceso', texto: 'Por qué lado se accede al predio.', necesario_para: ['orientación del partido'] });
  if (!s.coordinates) f.push({ id: 'coordenadas', texto: 'Latitud/longitud del predio (o comuna para obtenerlas de fuente confiable).', necesario_para: ['estudio solar', 'clima'] });
  if (!s.timezone) f.push({ id: 'zona_horaria', texto: 'Zona horaria IANA (ej. America/Santiago).', necesario_para: ['estudio solar'] });
  if (!s.true_north_deg_from_local_plus_y_clockwise || s.true_north_deg_from_local_plus_y_clockwise.estado === 'unknown') f.push({ id: 'norte', texto: 'Norte verdadero respecto del plano (no el norte dibujado sin verificar).', necesario_para: ['estudio solar', 'viento por fachada'] });
  if (!s.urban_constraints.length) f.push({ id: 'cip_prc', texto: 'CIP / instrumento de planificación vigente (retranqueos, ocupación, alturas, rasantes).', necesario_para: ['restricciones urbanísticas'] });
  if (s.context_obstacles.some((o) => o.height_mm == null)) f.push({ id: 'alturas_vecinos', texto: 'Alturas de edificios vecinos/árboles que dan sombra.', necesario_para: ['sombra de contexto'] });
  return f;
}

/** Registra una restricción urbanística: exige fuente existente (con documento y fecha). La extracción automática no basta: la usuaria/profesional confirma. */
export function agregarRestriccionUrbana(s, { requisito, valor, fuente_id, fecha_fuente, estado = 'confirmed' }) {
  const fuente = s.sources.find((x) => x.id === fuente_id);
  if (!fuente || !['cip', 'prc', 'other'].includes(fuente.kind)) throw new UserError('SIN_FUENTE_URBANA', 'Una restricción urbanística necesita una fuente registrada (CIP/IPT) con documento y fecha; no se infiere de la comuna.', 'Registre primero el documento como fuente.');
  if (fuente.scale_legible === false) throw new UserError('FUENTE_SIN_ESCALA_LEGIBLE', 'El documento fuente no tiene escala/medidas legibles: no se extrae ninguna condición ni medida de él.', 'Pida el documento original legible o una escala validada por la profesional.');
  if (!fecha_fuente) throw new UserError('SIN_FECHA_FUENTE', 'Indique la fecha del documento fuente (la norma depende de la versión vigente).');
  const n = structuredClone(s); n.urban_constraints.push({ id: `urb${n.urban_constraints.length + 1}`, requirement: requisito, value: valor ?? null, source_doc: `${fuente.id}: ${fuente.ref}`, source_date: fecha_fuente, status: estado });
  return n;
}

export const RETRANQUEOS = { retranqueo_frente_mm: 'S', retranqueo_fondo_mm: 'N', retranqueo_lateral_mm: ['E', 'O'] };

/** Verifica la huella contra los datos ingresados. NUNCA dice "cumple la norma": dice "consistente con el dato ingresado" o "no evaluable". */
export function verificarContraSitio(geo, s, acceso = null) {
  const out = []; const aviso = 'Verificación contra el dato ingresado; no es certificación normativa (requiere CIP vigente y profesional).';
  if (!s.parcel_polygon_mm) out.push({ id: 'encaje', estado: 'no_evaluable', detalle: 'Sin predio no se verifica el encaje.' });
  else { const r = cabeEnPredio(geo, { ring: s.parcel_polygon_mm.ring }, retranqueosDe(s, acceso)); out.push({ id: 'encaje', estado: r.cabe ? 'consistente_con_dato' : 'no_consistente', detalle: r.cabe ? 'La huella cabe en el predio ingresado (y retranqueos con fuente, si los hay).' : r.motivo }); }
  const ocup = s.urban_constraints.find((c) => c.requirement === 'ocupacion_max_pct' && typeof c.value === 'number');
  if (ocup && s.parcel_polygon_mm) { const pct = (geo.huella.area_m2 * 1e6 * 100) / area(s.parcel_polygon_mm.ring); out.push({ id: 'ocupacion', estado: pct <= ocup.value ? 'consistente_con_dato' : 'no_consistente', valor_pct: Math.round(pct * 10) / 10, limite_pct: ocup.value, fuente: ocup.source_doc }); }
  else out.push({ id: 'ocupacion', estado: 'no_evaluable', detalle: 'Falta el coeficiente de ocupación con fuente documentada.' });
  const alt = s.urban_constraints.find((c) => c.requirement === 'altura_max_mm' && typeof c.value === 'number');
  out.push(alt ? { id: 'altura', estado: 'consistente_con_dato', detalle: 'Altura del modelo (1 piso) contra límite ingresado.', limite_mm: alt.value } : { id: 'altura', estado: 'no_evaluable', detalle: 'Falta altura máxima/rasantes con fuente.' });
  return { verificaciones: out, aviso, faltantes: antecedentesFaltantes(s) };
}
function retranqueosDe(s, acceso) {
  const r = {}; for (const c of s.urban_constraints) { if (typeof c.value !== 'number') continue; if (c.requirement === 'retranqueo_frente_mm' && acceso) r[acceso] = c.value; if (c.requirement === 'retranqueo_fondo_mm' && acceso) r[{ S: 'N', N: 'S', E: 'O', O: 'E' }[acceso]] = c.value; if (c.requirement === 'retranqueo_lateral_mm' && acceso) for (const l of (acceso === 'S' || acceso === 'N' ? ['E', 'O'] : ['N', 'S'])) r[l] = c.value; }
  return r;
}
export const retranqueosParaGenerar = retranqueosDe;

export const hashSitio = (s) => crypto.createHash('sha256').update(JSON.stringify(s)).digest('hex');
export { bbox };
export const _schema = SCHEMA_IDS;
