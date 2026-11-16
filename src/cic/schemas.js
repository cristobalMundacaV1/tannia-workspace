// Contratos versionados del Construction Intelligence Core (docs/tw11/02..05). Zod 4. Todo contrato lleva `schema` con versión.
import { z } from 'zod';

export const ESTADO_EPISTEMICO = z.enum(['confirmed', 'assumed', 'unknown']);
export const MODO = z.enum(['academic', 'professional']);
export const NIVEL_VALIDACION = z.enum(['N0', 'N1', 'N2', 'N3']);   // evidencia de la capacidad
export const MADUREZ = z.enum(['E0', 'E1', 'E2', 'E3']);            // madurez de la operación de cálculo
export const CLASE_FUENTE = z.enum(['A', 'B', 'C', 'D']);
export const BINDING = z.enum(['binding', 'recommendation', 'informative', 'didactic', 'unknown']);
export const KIND_CLAIM = z.enum(['data', 'inference', 'assumption', 'calculation', 'pending']);
export const ROL_NUMERICO = z.enum(['technical_result', 'input_parameter', 'source_datum', 'math_constant', 'identifier', 'doc_numbering', 'metadata']);
export const ROLES_CON_RESPALDO = ['technical_result', 'input_parameter', 'source_datum'];
export const ROLES_EXENTOS = ['math_constant', 'identifier', 'doc_numbering', 'metadata'];

const id = (p) => z.string().regex(new RegExp(`^${p}-[A-Za-z0-9_.-]{1,60}$`), `id con prefijo ${p}-`);
const locator = z.object({ page: z.number().int().positive().nullable().optional(), section: z.string().nullable().optional(), sheet: z.string().nullable().optional(), slide: z.number().int().positive().nullable().optional(), heading_path: z.array(z.string()).optional(), line: z.number().int().positive().nullable().optional() }).strict();
export const sourceRef = z.object({ source_id: z.string(), locator: locator.optional() }).strict();

// ---- Fuente y pasaje (doc 03) ----
export const ESTADO_FUENTE = z.enum(['candidate', 'registered', 'rejected', 'withdrawn']);
export const FuenteSchema = z.object({
  schema: z.literal('tw.cic.source/1'), id: id('src'), class: CLASE_FUENTE, title: z.string().min(1), publisher: z.string().nullable().optional(), edition: z.string().nullable().optional(),
  date: z.string().nullable().optional(), version: z.string().nullable().optional(),
  origin: z.object({ kind: z.enum(['file', 'url', 'user_text']), path_or_url: z.string().nullable(), retrieved_at: z.string().nullable().optional(), retrieved_by: z.enum(['user', 'claude_web', 'import', 'system']) }).strict(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), state: ESTADO_FUENTE,
  // Distinción P02: registrada ≠ aprobada ≠ contenido disponible ≠ extracto comprobado ≠ cita verificable
  approval: z.object({ approved: z.boolean(), by: z.enum(['human_elicitation', 'human_out_of_band', 'system_import', 'none']), at: z.string().nullable() }).strict(),
  content: z.object({ available: z.boolean(), storage: z.enum(['none', 'hash_only', 'excerpt', 'full_private']), chars: z.number().int().nonnegative(), verified_by_server: z.boolean() }).strict(),
  license: z.object({ status: z.enum(['public', 'licensed', 'unknown']), quote_limit_chars: z.number().int().positive() }).strict(),
  binding: BINDING, supersedes: z.string().nullable().optional(), valid_from: z.string().nullable().optional(), valid_until: z.string().nullable().optional(),
  disciplines: z.array(z.string()), language: z.string().default('es'), sharing: z.enum(['private', 'project_export']).default('private'),
}).strict();
export const PasajeSchema = z.object({ schema: z.literal('tw.cic.passage/1'), id: id('psg'), source_id: z.string(), locator, text_hash: z.string().regex(/^[0-9a-f]{64}$/), text: z.string().nullable(), summary: z.string().nullable().optional() }).strict();

// ---- Interpretación propuesta por Claude (doc 02 §0.1) ----
export const InterpretacionSchema = z.object({
  schema: z.literal('tw.cic.interpretation/1'), engagement_id: z.string().nullable().optional(), mode: z.enum(['academic', 'professional', 'unspecified']),
  restatement: z.string().min(1),
  intents: z.array(z.object({ kind: z.enum(['deliver_artifact', 'answer_question', 'research', 'compute', 'verify', 'teach', 'plan']), text: z.string() }).strict()).min(1),
  research_questions: z.array(z.object({ id: z.string(), text: z.string(), needed_for: z.array(z.string()).optional(), status: z.enum(['open', 'answered', 'unanswerable_with_sources']).default('open') }).strict()).default([]),
  deliverables: z.array(z.object({ id: z.string(), kind: z.string(), status: ESTADO_EPISTEMICO }).strict()).default([]),
  disciplines_proposed: z.array(z.object({ tag: z.string(), registry_id: z.string().nullable().optional(), rationale: z.string().optional() }).strict()).default([]),
  antecedents: z.array(z.object({ ref: z.string(), quote: z.string().optional(), use: z.string().optional() }).strict()).default([]),
  magnitudes: z.array(z.object({ name: z.string(), value: z.number().nullable(), unit: z.string().nullable(), origin: z.enum(['user', 'source', 'assumed', 'unknown']), ref: z.string().nullable().optional() }).strict()).default([]),
  methods_proposed: z.array(z.object({ operation_id: z.string().nullable().optional(), free_text: z.string().optional(), source_ref: z.string().nullable().optional(), why: z.string().optional() }).strict()).default([]),
  assumptions: z.array(z.object({ text: z.string(), editable: z.boolean().default(true) }).strict()).default([]),
  unknowns: z.array(z.object({ what: z.string(), blocks: z.array(z.string()).default([]), resolution: z.enum(['ask_user', 'retrieve', 'research_external', 'external_professional']) }).strict()).default([]),
  risk_flags_proposed: z.array(z.string()).default([]),
  proposed_steps: z.array(z.object({ id: z.string(), goal: z.string(), capability_id: z.string().nullable().optional(), inputs: z.record(z.string(), z.unknown()).default({}), depends_on: z.array(z.string()).default([]) }).strict()).default([]),
}).strict();

// ---- Plan de trabajo (DAG) ----
export const ESTADO_PASO = z.enum(['planned', 'ready', 'blocked_gap', 'blocked_policy', 'blocked_dependency', 'running', 'done', 'failed', 'skipped', 'stale']);
export const PasoSchema = z.object({
  id: z.string(), goal: z.string(), capability_id: z.string().nullable(), kind: z.enum(['compute', 'retrieve', 'generate_cad', 'generate_doc', 'ask_user', 'external']),
  inputs: z.record(z.string(), z.unknown()), depends_on: z.array(z.string()), status: ESTADO_PASO, reason: z.string().nullable().optional(),
  result_claims: z.array(z.string()).default([]), input_hash: z.string().nullable().optional(), error: z.object({ code: z.string(), message: z.string() }).nullable().optional(),
}).strict();
export const BrechaSchema = z.object({ id: z.string(), need: z.string(), why: z.string(), resolution: z.enum(['external_professional', 'new_tool', 'ask_user', 'research_external']), blocks: z.array(z.string()) }).strict();
export const PlanSchema = z.object({ schema: z.literal('tw.cic.workplan/1'), engagement_ref: z.string(), revision: z.number().int().positive(), mode: MODO, steps: z.array(PasoSchema), gaps: z.array(BrechaSchema) }).strict();

// ---- Claim (doc 02) ----
export const ClaimSchema = z.object({
  schema: z.literal('tw.cic.claim/1'), id: id('clm'), kind: KIND_CLAIM, statement: z.string().min(1), value: z.union([z.number(), z.string(), z.boolean(), z.null(), z.array(z.number())]).nullable(),
  unit: z.string().nullable(), dimension: z.string().nullable(), source_refs: z.array(sourceRef).default([]),
  method_ref: z.object({ operation_id: z.string(), version: z.string(), input_hash: z.string(), maturity: MADUREZ }).strict().nullable(),
  depends_on: z.array(z.string()).default([]), status: z.enum(['computed', 'reported_by_source', 'user_stated', 'assumed_editable', 'model_asserted', 'not_computed', 'stale']),
  requires_review_by: z.array(z.string()).default([]), created_at: z.string(), mode: MODO.optional(),
}).strict();

// ---- Capacidad y operación ----
export const CapacidadSchema = z.object({
  schema: z.literal('tw.cic.capability/1'), id: z.string(), kind: z.enum(['tool', 'operation', 'generator', 'retrieval', 'document']), mcp_tool: z.string().nullable(),
  title: z.string(), disciplines: z.array(z.string()), preconditions: z.array(z.string()), side_effects: z.enum(['read', 'write_copy', 'write_project', 'none']),
  risk_class: z.enum(['low', 'medium', 'high']), validation: z.object({ level: NIVEL_VALIDACION, evidence: z.array(z.string()), real_hardware: z.enum(['no', 'pending', 'yes']) }).strict(),
  maturity: MADUREZ.nullable(), limits: z.array(z.string()),
}).strict();
export const OperacionMetaSchema = z.object({
  schema: z.literal('tw.cic.operation/1'), id: z.string(), version: z.string(), title: z.string(), disciplines: z.array(z.string()),
  inputs: z.array(z.object({ name: z.string(), dimension: z.string().nullable(), unit_in: z.string().nullable(), shape: z.enum(['scalar', 'vector', 'object']), required: z.boolean() }).strict()),
  outputs: z.array(z.object({ name: z.string(), dimension: z.string().nullable(), unit_out: z.string().nullable() }).strict()),
  applicability: z.object({ assumptions: z.array(z.string()), validity: z.array(z.string()), error_bound: z.string() }).strict(),
  formula: z.string(), tolerance: z.object({ relative: z.number(), oracle: z.array(z.string()) }).strict(), maturity: MADUREZ, requires_review_by: z.array(z.string()), failure_modes: z.array(z.string()),
}).strict();

// ---- Especialización ----
export const EspecializacionSchema = z.object({
  schema: z.literal('tw.cic.specialization/1'), id: z.string(), version: z.string(), parent: z.string().nullable(), status: z.enum(['draft', 'active', 'deprecated']),
  title: z.string(), concepts: z.array(z.object({ term: z.string(), synonyms: z.array(z.string()).default([]) }).strict()).default([]),
  inputs: z.array(z.object({ name: z.string(), kind: z.enum(['geometry', 'document', 'datum']), required: z.boolean() }).strict()).default([]),
  deliverables: z.array(z.object({ kind: z.string(), editable: z.boolean() }).strict()).default([]),
  methods: z.array(z.object({ id: z.string(), title: z.string(), steps: z.array(z.string()), operations: z.array(z.string()), tools: z.array(z.string()).default([]) }).strict()).default([]),
  automation_limits: z.array(z.string()), required_validation: z.array(z.object({ what: z.string(), by: z.string() }).strict()),
  competencies: z.array(z.string()).default([]), gaps: z.array(z.object({ need: z.string(), resolution: z.enum(['external_professional', 'new_tool']) }).strict()).default([]),
  // Una especialización solo declara; nunca puede bajar restricciones del núcleo
  mode_overrides: z.object({}).strict().optional(),
}).strict();

export const IssueSchema = z.object({ schema: z.literal('tw.cic.issue/1'), id: z.string(), kind: z.enum(['contradiction', 'stale', 'unit_mismatch', 'missing_input', 'unverified_citation', 'policy', 'geometry']), severity: z.enum(['info', 'warning', 'blocking']), message: z.string(), refs: z.array(z.string()).default([]) }).strict();
export const ContradiccionSchema = z.object({ schema: z.literal('tw.cic.contradiction/1'), id: z.string(), kind: z.enum(['valor', 'vigencia', 'alcance', 'binding']), items: z.array(z.object({ ref: z.string(), value: z.string() }).strict()).min(2), status: z.enum(['open', 'resolved', 'pending_competent_review']), resolution: z.object({ decision: z.string(), by: z.string(), at: z.string() }).strict().nullable() }).strict();
export const EngagementSchema = z.object({ schema: z.literal('tw.cic.engagement/1'), id: z.string(), mode: MODO, interpretation: InterpretacionSchema, validation: z.object({ outcome: z.enum(['accepted', 'accepted_with_gaps', 'needs_input', 'rejected']), issues: z.array(IssueSchema) }).strict(), created_at: z.string() }).strict();

export const parse = (schema, v) => { const r = schema.safeParse(v); return r.success ? { ok: true, value: r.data } : { ok: false, errores: r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) }; };
