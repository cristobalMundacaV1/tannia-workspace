// Contratos Zod versionados de TW-10 (MRAA): brief/1, site/1, weather/1, scheme/2, decision/1, analysis/1.
// Política epistémica: todo dato relevante es confirmed (lo dijo la usuaria o un documento citado), assumed (supuesto editable y declarado)
// o unknown (no se sabe y NO se inventa). Un valor numérico "calculado" exige método y hash de entrada.
import { z } from 'zod';

export const SCHEMA_IDS = { brief: 'tw.arch.brief/1', site: 'tw.arch.site/1', weather: 'tw.arch.weather/1', scheme: 'tw.arch.scheme/2', decision: 'tw.arch.decision/1', analysis: 'tw.arch.analysis/1' };
export const ESTADOS = ['confirmed', 'assumed', 'unknown'];
export const estadoEpistemico = z.enum(ESTADOS);

const id = z.string().min(1).max(80);
const texto = z.string().max(2000);
const mm2 = z.array(z.number().finite()).length(2);
const anillo = z.array(mm2).min(3).max(500);
const prioridad = z.enum(['high', 'medium', 'low']);

/** Dato con estado epistémico. unknown ⇒ valor null (nunca un valor "ilustrativo"). */
export const dato = (valor) => z.object({ valor: valor.nullable(), estado: estadoEpistemico, fuente: texto.optional() }).strict()
  .superRefine((d, ctx) => { if (d.estado === 'unknown' && d.valor !== null) ctx.addIssue({ code: 'custom', message: 'Un dato unknown no puede traer valor.' }); if (d.estado !== 'unknown' && d.valor === null) ctx.addIssue({ code: 'custom', message: 'Un dato confirmed/assumed necesita valor.' }); });
export const desconocido = () => ({ valor: null, estado: 'unknown' });
export const confirmado = (valor, fuente) => ({ valor, estado: 'confirmed', ...(fuente ? { fuente } : {}) });
export const supuesto = (valor, fuente) => ({ valor, estado: 'assumed', ...(fuente ? { fuente } : {}) });

// ---------------- brief/1 ----------------
export const OBJETIVOS = ['daylight_preference', 'sightline', 'privacy', 'circulation_minimal', 'wind_shelter', 'summer_cooling', 'winter_sun', 'cost_saving', 'adjacency', 'outdoor_relation', 'future_extension', 'accessibility', 'quiet', 'courtyard', 'pool_supervision'];
export const REQUISITOS_DUROS = ['one_story', 'area_target', 'bedrooms', 'bathrooms', 'footprint_class', 'within_parcel', 'no_stairs'];
export const BriefV1 = z.object({
  schema: z.literal(SCHEMA_IDS.brief), project_id: id, version: z.number().int().min(1).default(1),
  request_original: z.string().min(1).max(4000),
  program: z.array(z.object({ id, usage: z.enum(['social', 'private', 'service', 'outdoor', 'circulation']), target_area_m2: z.number().positive().max(2000).optional(), quantity: z.number().int().min(1).max(20).optional(), status: estadoEpistemico.default('confirmed') }).strict()).max(60),
  household: z.object({ needs: z.array(id).max(20) }).strict(), // sin biografías íntimas ni edades
  objectives: z.array(z.object({ id, kind: z.enum(OBJETIVOS), from: id.optional(), to: id.optional(), target: id.optional(), priority: prioridad, evidence: z.enum(['user_statement', 'inferred_from_user', 'default']), status: estadoEpistemico }).strict()).max(40),
  hard_constraints: z.array(z.object({ id, kind: z.enum(REQUISITOS_DUROS), value: z.union([z.number(), z.string(), z.boolean()]).optional(), status: estadoEpistemico }).strict()).max(40),
  preferences: z.array(z.object({ id, text: texto, weight: z.number().min(0).max(1).optional(), negotiable: z.boolean().default(true), status: estadoEpistemico }).strict()).max(40),
  unknowns: z.array(id).max(40), review_required: z.array(id).max(40),
  budget: z.object({ order_of_magnitude: texto.nullable(), status: estadoEpistemico }).strict().optional(),
  prohibitions: z.array(texto).max(20).default([]),
}).strict();

// ---------------- site/1 ----------------
export const SiteV1 = z.object({
  schema: z.literal(SCHEMA_IDS.site),
  coordinates: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), elevation_m: z.number().optional(), status: estadoEpistemico, source: texto.optional() }).strict().nullable(),
  timezone: z.string().min(3).max(64).nullable(), // IANA
  true_north_deg_from_local_plus_y_clockwise: dato(z.number().gte(0).lt(360)).nullable().default(null),
  parcel_polygon_mm: z.object({ ring: anillo, status: estadoEpistemico, source: texto.optional() }).strict().nullable(),
  street_access: z.array(z.object({ id, side: z.enum(['S', 'N', 'E', 'O']), x_mm: z.number().optional(), width_mm: z.number().positive().optional(), status: estadoEpistemico }).strict()).max(8),
  terrain: z.object({ level_points: z.array(z.object({ x_mm: z.number(), y_mm: z.number(), z_mm: z.number() }).strict()).max(500), source: z.enum(['unknown', 'user', 'survey']) }).strict(),
  context_obstacles: z.array(z.object({ id, ring: anillo, height_mm: z.number().positive().nullable(), height_status: estadoEpistemico, kind: z.enum(['building', 'wall', 'other']) }).strict()).max(100),
  vegetation: z.array(z.object({ id, x_mm: z.number(), y_mm: z.number(), radius_mm: z.number().positive(), height_mm: z.number().positive().nullable(), deciduous: z.boolean().nullable() }).strict()).max(200),
  view_targets: z.array(z.object({ id, x_mm: z.number(), y_mm: z.number(), z_mm: z.number().default(1500), desirable: z.boolean() }).strict()).max(40),
  noise_sources: z.array(z.object({ id, side: z.enum(['S', 'N', 'E', 'O']) }).strict()).max(20),
  urban_constraints: z.array(z.object({ id, requirement: texto, value: z.union([z.number(), z.string()]).nullable(), source_doc: texto, source_date: z.string().nullable(), status: estadoEpistemico }).strict()).max(50),
  sources: z.array(z.object({ id, kind: z.enum(['user', 'cip', 'prc', 'survey', 'epw', 'other']), ref: texto, sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(), scale_legible: z.boolean().optional() }).strict()).max(50),
  status: z.enum(['insufficient_for_real_solar_study', 'solar_study_possible', 'parcel_known_only']),
}).strict();

// ---------------- weather/1 ----------------
export const WeatherV1 = z.object({
  schema: z.literal(SCHEMA_IDS.weather), source_kind: z.enum(['epw', 'open_meteo_era5', 'user_observation', 'none']),
  source_ref: texto.nullable(), source_sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(), station_or_grid: texto.nullable(), geospatial_resolution: texto.nullable(),
  coverage_period: texto.nullable(), variables: z.array(z.enum(['temperature', 'humidity', 'wind_speed_10m', 'wind_direction_10m', 'radiation'])).max(10),
  missingness: z.record(z.string(), z.number().min(0).max(1)).nullable(), license_note: texto.nullable(),
  representativeness: z.enum(['unknown', 'regional', 'estimated', 'validated']), status: z.enum(['not_loaded', 'loaded', 'failed']),
}).strict().superRefine((w, ctx) => { if (w.representativeness === 'validated') ctx.addIssue({ code: 'custom', message: 'Un clima de archivo nunca es "validated" para el predio sin medición propia.' }); if (w.status === 'loaded' && w.source_kind !== 'none' && !w.source_sha256 && w.source_kind === 'epw') ctx.addIssue({ code: 'custom', message: 'EPW cargado exige sha256.' }); });

// ---------------- scheme/2 ----------------
export const CONCEPTOS = ['compacta', 'L_con_patio', 'dos_alas', 'patio_central', 'lineal'];
const poligonosHuella = z.array(anillo).min(1).max(8);
export const SchemeV2 = z.object({
  schema: z.literal(SCHEMA_IDS.scheme), id, brief_ref: z.string().min(1).max(80), site_ref: z.string().max(80).nullable(), engine_version: z.string().max(40),
  concept: z.enum(CONCEPTOS), rationale: texto,
  footprint_polygons_mm: poligonosHuella, open_courts_mm: z.array(anillo).max(8),
  espesores_mm: z.object({ ext: z.number().positive(), int: z.number().positive() }).strict(),
  altura_piso_cielo_mm: z.number().positive(),
  spaces: z.array(z.object({ id, nombre: z.string().max(80), tipo: z.string().max(40), ring: anillo, zona: z.enum(['social', 'servicio', 'privada', 'circulacion']) }).strict()).min(1).max(40),
  openings: z.array(z.object({ id, tipo: z.enum(['puerta', 'ventana', 'paso']), funcion: z.enum(['acceso']).optional(), abre_hacia: id.optional(), entre: z.array(id).min(1).max(2), ancho_mm: z.number().positive(), alto_mm: z.number().positive(), antepecho_mm: z.number().min(0).optional(), centro: mm2, exterior_side: z.enum(['S', 'N', 'E', 'O']).optional(), control_acceso: z.enum(['none', 'needs_review', 'controlled']).optional() }).strict()).max(120),
  exterior_areas: z.array(z.object({ id, use: z.string().max(40), ring: anillo.optional(), access_control: z.enum(['none', 'needs_review', 'controlled']).optional() }).strict()).max(20),
  separaciones_abiertas: z.array(z.array(id).length(2)).max(40).default([]),
  adjacencies: z.array(z.array(id).length(2)).max(200).default([]),
  line_of_sight_goals: z.array(z.object({ id, from: id, to: id }).strict()).max(20).default([]),
  sources: z.array(id).max(20).default([]),
  model_status: z.enum(['concept', 'validated_geometry', 'published']),
}).strict();

// ---------------- decision/1 ----------------
export const EvidenciaV1 = z.object({
  type: z.enum(['calculation', 'geometry', 'user_statement', 'heuristic', 'source_document']),
  metric: id, value: z.number().nullable(), status: z.enum(['computed', 'not_computed', 'inconclusive']),
  method: z.string().max(120).optional(), input_hash: z.string().max(80).optional(), engine_version: z.string().max(40).optional(), at: z.string().max(40).optional(),
}).strict().superRefine((e, ctx) => {
  if (e.status === 'computed' && (e.value === null || !e.method || !e.input_hash)) ctx.addIssue({ code: 'custom', message: 'Evidencia calculada exige valor, método y hash de entrada.' });
  if (e.status !== 'computed' && e.value !== null) ctx.addIssue({ code: 'custom', message: 'Sin cálculo no puede haber valor.' });
});
export const DecisionV1 = z.object({
  schema: z.literal(SCHEMA_IDS.decision), id, goal_id: id, decision: texto, candidate_ids: z.array(id).max(20), selected: id.nullable(),
  evidence: z.array(EvidenciaV1).max(30), tradeoffs: z.array(texto).max(20), uncertainty: z.array(texto).max(20),
  status: z.enum(['proposed_pending_evidence', 'proposed', 'accepted_by_user', 'rejected_by_user']),
  requires_professional_review: z.boolean(), reviewer: z.string().max(80).nullable().default(null),
}).strict();

// ---------------- analysis/1 ----------------
export const FAMILIAS = ['superficie', 'recorridos', 'adyacencias', 'sol', 'viento', 'visuales', 'privacidad', 'seguridad', 'economia_relativa', 'constructibilidad', 'normativa'];
export const ResultadoMetrica = z.object({
  id, familia: z.enum(FAMILIAS), estado: z.enum(['computed', 'inconclusive', 'not_evaluated', 'blocked']), valor: z.number().nullable().default(null), unidad: z.string().max(20).optional(),
  detalle: texto.optional(), razon: texto.optional(), metodo: z.string().max(120), limites: texto,
}).strict().superRefine((m, ctx) => { if (m.estado !== 'computed' && m.valor !== null) ctx.addIssue({ code: 'custom', message: 'Métrica no calculada no puede traer valor.' }); });
export const AnalysisV1 = z.object({
  schema: z.literal(SCHEMA_IDS.analysis), scheme_id: id, input_hash: z.string().max(80), engine_version: z.string().max(40),
  hard_gates: z.array(z.object({ id, passed: z.boolean(), detalle: texto }).strict()),
  metrics: z.array(ResultadoMetrica), alerts: z.array(z.object({ id, severidad: z.enum(['critica', 'alta', 'media', 'info']), texto }).strict()),
  global_state: z.enum(['no_conclusive', 'con_alertas_criticas', 'sin_alertas_detectadas']), // nunca "excelente"/"apto"/"cumple"
  disclaimers: z.array(texto).min(1),
}).strict();

export const SCHEMAS = { brief: BriefV1, site: SiteV1, weather: WeatherV1, scheme: SchemeV2, decision: DecisionV1, analysis: AnalysisV1 };
export function validar(nombre, obj) { const r = SCHEMAS[nombre].safeParse(obj); return r.success ? { ok: true, valor: r.data } : { ok: false, errores: r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) }; }

/** Sitio vacío: sin ningún dato inventado. */
export function sitioVacio() { return { schema: SCHEMA_IDS.site, coordinates: null, timezone: null, true_north_deg_from_local_plus_y_clockwise: null, parcel_polygon_mm: null, street_access: [], terrain: { level_points: [], source: 'unknown' }, context_obstacles: [], vegetation: [], view_targets: [], noise_sources: [], urban_constraints: [], sources: [], status: 'insufficient_for_real_solar_study' }; }
export function climaVacio() { return { schema: SCHEMA_IDS.weather, source_kind: 'none', source_ref: null, source_sha256: null, station_or_grid: null, geospatial_resolution: null, coverage_period: null, variables: [], missingness: null, license_note: null, representativeness: 'unknown', status: 'not_loaded' }; }
