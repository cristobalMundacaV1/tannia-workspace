// Herramientas MCP del Construction Intelligence Core (TW-11). Solo se registran con TANNIA_CIC=on (por defecto apagado: 72 herramientas).
// El código calcula y verifica; Claude interpreta, propone y explica. Esquemas planos; respuestas compactas.
import { z } from 'zod';
import { ok, UserError } from '../mcp/util.js';
import { ejecutarOperacion, listarOperaciones, obtenerOperacion, OpError } from '../cic/ops/index.js';
import { construirRegistro, NIVELES } from '../cic/capacidades.js';
import { Casos } from '../cic/store.js';
import { Ledger, claimsDeOperacion } from '../cic/claims.js';
import { verificarEntregable } from '../cic/verificador.js';
import { listarEspecializaciones } from '../cic/especializaciones.js';

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
export const AVISO = 'Resultado de ingeniería ASISTIDA: no sustituye revisión de un profesional competente; no es apto para construcción sin ella.';
const proyecto = z.string().describe('Nombre del proyecto');
const caso = z.string().min(1).max(60).describe('Nombre del caso de ingeniería (carpeta versionada en "03 Trabajo/Ingenieria")');
const entrada = z.object({ value: z.unknown().describe('número, lista de números, objeto o texto, según la operación'), unit: z.string().nullable().optional().describe('unidad (m, mm, m2, m3, deg, %…); NUNCA se supone') }).strict();

export function registerCic(reg, { sandbox, herramientas }) {
  const C = new Casos(sandbox);

  reg('tannia_cic_catalogo', {
    title: 'Catálogo de capacidades, operaciones de cálculo y especializaciones (con su nivel de validación)',
    description: 'Lista qué se puede EJECUTAR, con qué hipótesis y madurez (E0–E3) y nivel de evidencia (N0–N3). Úselo ANTES de planificar para no prometer lo que no existe. Sin ninguna etiqueta de disciplina obligatoria: todas las capacidades transversales están disponibles siempre. Con `id` devuelve el contrato completo (entradas con unidades, hipótesis, rango de validez, cota de error, oráculos).',
    inputSchema: { tipo: z.enum(['todo', 'operaciones', 'herramientas', 'especializaciones']).optional(), buscar: z.string().max(80).optional().describe('texto a buscar en id/título/disciplinas'), id: z.string().optional().describe('id de operación (p. ej. geo.volume.prismoidal) para ver el contrato completo') }, annotations: RO,
  }, async ({ tipo = 'todo', buscar, id }) => {
    if (id) { const m = obtenerOperacion(id); if (!m) throw new UserError('OPERACION_DESCONOCIDA', `No existe la operación "${id}".`, 'Consulte el catálogo sin id.'); return ok(`Contrato de ${id} (${m.maturity}). Hipótesis y rango de validez incluidos; fuera de él la operación devuelve un error, nunca un número aproximado.`, m); }
    const q = (buscar || '').toLowerCase(); const f = (x) => !q || JSON.stringify([x.id, x.title, x.disciplines]).toLowerCase().includes(q);
    const caps = construirRegistro({ herramientas: herramientas() }); const esp = listarEspecializaciones().filter(f);
    const ops = caps.filter((c) => c.kind === 'operation' && f(c)).map((c) => ({ id: c.id.slice(3), titulo: c.title, madurez: c.maturity, nivel: c.validation.level, revision_por: c.risk_class === 'high' ? 'requerida' : 'no' }));
    const tools = caps.filter((c) => c.kind === 'tool' && f(c)).map((c) => ({ herramienta: c.mcp_tool, nivel: c.validation.level, hardware_real: c.validation.real_hardware, efecto: c.side_effects }));
    const data = { niveles: NIVELES, ...(tipo === 'todo' || tipo === 'operaciones' ? { operaciones: ops } : {}), ...(tipo === 'todo' || tipo === 'herramientas' ? { herramientas: tools.length > 40 && tipo === 'todo' ? { total: tools.length, nota: 'Use tipo="herramientas" para listarlas.' } : tools } : {}), ...(tipo === 'todo' || tipo === 'especializaciones' ? { especializaciones: esp.map((e) => ({ id: e.id, titulo: e.title, estado: e.status, limites: e.automation_limits })) } : {}) };
    return ok(`Catálogo CIC: ${ops.length} operación(es) de cálculo, ${tools.length} herramienta(s), ${esp.length} especialización(es). Ninguna capacidad está validada en AutoCAD real ni por un profesional salvo que el nivel diga N2/N3.`, data);
  });

  reg('tannia_cic_calcular', {
    title: 'Ejecutar una operación de cálculo verificada (el código calcula; usted solo explica)',
    description: 'Ejecuta una operación del catálogo con entradas {value, unit}. Valida unidades y rango de validez: fuera de él devuelve un ERROR tipificado, jamás un valor aproximado. Devuelve cada resultado con su unidad, hipótesis y un claim reproducible (hash de entradas). Si indica proyecto y caso, los claims se guardan en una versión nueva del caso. NUNCA invente entradas: lo que falte, pregúntelo. ' + AVISO,
    inputSchema: { operacion: z.string().describe('id de operación, p. ej. geo.section.arch'), entradas: z.record(z.string(), entrada).describe('entradas por nombre'), modo: z.enum(['academic', 'professional']).optional(), etiqueta: z.string().max(120).optional().describe('descripción corta del resultado (para el claim)'), proyecto: proyecto.optional(), caso: caso.optional() }, annotations: RW,
  }, async ({ operacion, entradas, modo, etiqueta, proyecto: p, caso: n }) => {
    let m = modo || 'professional'; if (p && n && C.existe(p, n)) m = modo || C.cargar(p, n).doc.mode || m;
    let res;
    try { res = ejecutarOperacion(operacion, entradas, { modo: m }); }
    catch (e) { if (e instanceof OpError) throw new UserError(e.code, e.message, 'Revise las hipótesis y el rango de validez con tannia_cic_catalogo (id de la operación). No se calculó nada.', e.detalle); throw e; }
    const claims = claimsDeOperacion(res, { modo: m, etiqueta: etiqueta || '' });
    let version = null;
    if (p && n) { if (!C.existe(p, n)) C.crear(p, n, m); const g = C.guardar(p, n, (doc) => { const L = new Ledger(doc.claims); claims.forEach((c) => L.add(c)); doc.claims = L.list(); return `Cálculo ${operacion}`; }); version = g.version; }
    const resumen = Object.fromEntries(Object.entries(res.outputs).map(([k, o]) => [k, { valor: o.value, unidad: o.unit }]));
    return ok(`${operacion} (${res.maturity}): calculado. ${res.warnings.length ? `Advertencias: ${res.warnings.join(' · ')}` : 'Sin advertencias.'}${res.requires_review_by.length ? ` Requiere revisión de: ${res.requires_review_by.join(', ')}.` : ''}${version ? ` Guardado en ${n} ${version}.` : ''}`, { operacion, version_operacion: res.version, madurez: res.maturity, resultados: resumen, advertencias: res.warnings, input_hash: res.input_hash, claims: claims.map((c) => c.id), caso_version: version, requiere_revision_de: res.requires_review_by });
  });

  reg('tannia_cic_claims', {
    title: 'Consultar las afirmaciones técnicas (claims) de un caso con su procedencia',
    description: 'Devuelve los claims separados por tipo: dato de fuente, inferencia, supuesto, cálculo y pendiente. Cada cálculo indica operación, versión, madurez y hash de entradas. Los claims desactualizados (stale) no respaldan resultados.',
    inputSchema: { proyecto, caso, version: z.string().optional(), tipo: z.enum(['data', 'inference', 'assumption', 'calculation', 'pending']).optional(), estado: z.string().optional() }, annotations: RO,
  }, async ({ proyecto: p, caso: n, version, tipo, estado }) => {
    const { doc, id } = C.cargar(p, n, version); let cl = doc.claims; if (tipo) cl = cl.filter((c) => c.kind === tipo); if (estado) cl = cl.filter((c) => c.status === estado);
    const por = {}; for (const c of doc.claims) por[c.kind] = (por[c.kind] || 0) + 1;
    return ok(`Caso ${n} ${id}: ${doc.claims.length} claim(s) (${Object.entries(por).map(([k, v]) => `${k}: ${v}`).join(', ') || 'ninguno'}); ${doc.claims.filter((c) => c.status === 'stale').length} desactualizado(s).`, { version: id, por_tipo: por, claims: cl.slice(0, 60).map((c) => ({ id: c.id, tipo: c.kind, estado: c.status, texto: c.statement, valor: c.value, unidad: c.unit, metodo: c.method_ref ? `${c.method_ref.operation_id}@${c.method_ref.version} (${c.method_ref.maturity})` : null, depende_de: c.depends_on, fuentes: c.source_refs, revision: c.requires_review_by })), truncado: cl.length > 60 });
  });

  reg('tannia_cic_verificar', {
    title: 'Verificar un entregable: cada número técnico debe tener respaldo (claim o dato registrado)',
    description: 'Verifica por ROLES numéricos: technical_result / input_parameter / source_datum exigen respaldo; math_constant, identifier, doc_numbering y metadata están exentos (página, versión, id de partida, π, fechas NO se bloquean). En texto libre solo se verifican cifras con unidad o moneda. Devuelve bloqueos (impiden entregar) y avisos. Detecta además claims desactualizados del caso.',
    inputSchema: { proyecto, caso, version: z.string().optional(), slots: z.array(z.object({ id: z.string(), role: z.enum(['technical_result', 'input_parameter', 'source_datum', 'math_constant', 'identifier', 'doc_numbering', 'metadata']), value: z.union([z.number(), z.string()]).nullable().optional(), unit: z.string().nullable().optional(), claim_id: z.string().optional(), input_ref: z.string().optional(), decimals: z.number().int().min(0).max(8).optional() })).optional().describe('números con rol explícito'), texto: z.string().max(60000).optional().describe('texto libre del entregable a revisar') }, annotations: RO,
  }, async ({ proyecto: p, caso: n, version, slots, texto }) => {
    const { doc, id } = C.cargar(p, n, version); const L = new Ledger(doc.claims);
    const entradas = new Set((doc.magnitudes || []).map((m) => m.name)); const valoresEntrada = (doc.magnitudes || []).filter((m) => typeof m.value === 'number').map((m) => ({ value: m.value, unit: m.unit }));
    const v = verificarEntregable({ slots: (slots || []).map((s) => ({ ...s, value: s.value === null || s.value === undefined ? s.value : Number(s.value) })), texto }, { claims: L, entradas, valoresEntrada });
    const stale = L.list().filter((c) => c.status === 'stale').map((c) => c.id);
    const abiertas = (doc.contradictions || []).filter((c) => c.status !== 'resolved');
    return ok(v.ok && !stale.length ? `Verificado (${id}): ${v.stats.verificados} número(s) con respaldo, ${v.stats.exentos} exento(s).` : `NO verificado: ${v.bloqueos.length} bloqueo(s)${stale.length ? `, ${stale.length} claim(s) desactualizado(s)` : ''}.`, { version: id, ok: v.ok && !stale.length, bloqueos: v.bloqueos, avisos: v.avisos, estadisticas: v.stats, claims_desactualizados: stale, contradicciones_abiertas: abiertas.map((c) => c.id) });
  });
}
