// Validación DETERMINISTA de la interpretación propuesta por Claude y construcción del plan DAG (docs/tw11/02 §0.1).
// El backend no "comprende": verifica propiedades verificables. Las disciplinas son informativas y NUNCA condicionan el acceso a capacidades.
import { InterpretacionSchema, PlanSchema } from './schemas.js';
import { obtenerOperacion } from './ops/index.js';
import { construirRegistro } from './capacidades.js';
import { unidad, UnitError } from './units.js';
import { madurezPermitida, politicaDe } from './politica.js';

const REF = /^(magnitude|claim|step):(.+)$/;
export const esRef = (v) => v && typeof v === 'object' && typeof v.ref === 'string' && REF.test(v.ref);
export const esRefs = (v) => v && typeof v === 'object' && Array.isArray(v.refs) && v.refs.length > 0 && v.refs.every((r) => typeof r === 'string' && REF.test(r));
export const refsDe = (v) => (esRef(v) ? [v.ref] : esRefs(v) ? v.refs : Array.isArray(v) ? v.flatMap(refsDe) : v && typeof v === 'object' ? Object.values(v).flatMap(refsDe) : []);

function aciclico(pasos) {
  const g = new Map(pasos.map((p) => [p.id, p.depends_on])); const estado = new Map();
  const visita = (id) => { if (estado.get(id) === 1) return false; if (estado.get(id) === 2) return true; estado.set(id, 1); for (const d of g.get(id) || []) if (g.has(d) && !visita(d)) return false; estado.set(id, 2); return true; };
  return [...g.keys()].every(visita);
}
export function ordenTopologico(pasos) { const out = []; const vis = new Set(); const m = new Map(pasos.map((p) => [p.id, p])); const v = (id) => { if (vis.has(id)) return; vis.add(id); (m.get(id)?.depends_on || []).forEach(v); out.push(m.get(id)); }; pasos.forEach((p) => v(p.id)); return out.filter(Boolean); }

const KIND = (cap, tool) => (cap?.startsWith('op.') ? 'compute' : tool === 'tannia_cic_conocimiento' || tool === 'tannia_conocimiento_consultar' || tool === 'tannia_normativa_consultar' ? 'retrieve' : /tannia_(cad|3d|diseno|arq)/.test(tool || '') ? 'generate_cad' : /tannia_(informe|entregable|presupuesto|pdf|cic_entregable)/.test(tool || '') ? 'generate_doc' : cap ? 'generate_doc' : 'ask_user');

/**
 * @param interp propuesta (ya con esquema válido)
 * @param ctx { modo, herramientas:[nombres], conocimiento:{verificarCita(proj,{...}), listar?}, proyecto, magnitudesCaso:[{name,value,unit}], ledger }
 */
export function validarInterpretacion(interp, ctx) {
  const modo = ctx.modo || (interp.mode === 'unspecified' ? 'professional' : interp.mode); const pol = politicaDe(modo);
  const issues = []; const gaps = []; const preguntas = []; let n = 0; const iss = (kind, severity, message, refs = []) => issues.push({ schema: 'tw.cic.issue/1', id: `iss-${++n}`, kind, severity, message, refs });
  const caps = new Map(construirRegistro({ herramientas: ctx.herramientas || [] }).map((c) => [c.id, c]));
  // 1) estructura: ids únicos y DAG
  const dup = (arr, f, nombre) => { const s = new Set(); for (const x of arr) { const k = f(x); if (s.has(k)) return `${nombre} duplicado: ${k}`; s.add(k); } return null; };
  const err = dup(interp.proposed_steps, (s) => s.id, 'paso') || dup(interp.deliverables, (d) => d.id, 'entregable') || dup(interp.research_questions, (q) => q.id, 'pregunta');
  if (err) return { outcome: 'rejected', issues: [{ schema: 'tw.cic.issue/1', id: 'iss-0', kind: 'policy', severity: 'blocking', message: err, refs: [] }], gaps, preguntas, plan: null };
  const ids = new Set(interp.proposed_steps.map((s) => s.id));
  for (const s of interp.proposed_steps) for (const d of s.depends_on) if (!ids.has(d)) { return { outcome: 'rejected', issues: [{ schema: 'tw.cic.issue/1', id: 'iss-0', kind: 'policy', severity: 'blocking', message: `El paso ${s.id} depende de "${d}", que no existe.`, refs: [s.id] }], gaps, preguntas, plan: null }; }
  // dependencias implícitas por referencias a pasos
  const pasos = interp.proposed_steps.map((s) => { const dep = new Set(s.depends_on); for (const v of Object.values(s.inputs || {})) for (const rf of refsDe(v)) { const m = REF.exec(rf); if (m[1] === 'step') { const sid = m[2].split('.')[0]; if (!ids.has(sid)) iss('missing_input', 'blocking', `El paso ${s.id} referencia un paso inexistente (${sid}).`, [s.id]); else dep.add(sid); } } return { ...s, depends_on: [...dep] }; });
  if (!aciclico(pasos)) return { outcome: 'rejected', issues: [{ schema: 'tw.cic.issue/1', id: 'iss-0', kind: 'policy', severity: 'blocking', message: 'El plan contiene un ciclo de dependencias.', refs: [] }], gaps, preguntas, plan: null };
  // 2) antecedentes: citas verificadas contra el almacén (nunca por confianza)
  const antecedentes = interp.antecedents.map((a) => {
    const sid = a.ref.startsWith('psg-') ? null : a.ref; let estado = 'sin_cita';
    if (a.quote) { if (!ctx.conocimiento || !sid) estado = 'no_verificable'; else { const r = ctx.conocimiento.verificarCita(ctx.proyecto, { source_id: sid, quote: a.quote }); estado = r.estado; if (r.estado !== 'verified_exact') iss('unverified_citation', 'warning', `La cita de ${a.ref} no se pudo verificar (${r.estado}): no sustentará claims.`, [a.ref]); } }
    else if (sid && ctx.conocimiento) { const f = (ctx.conocimiento.listar(ctx.proyecto) || []).find((x) => x.id === sid); if (!f) iss('unverified_citation', 'warning', `El antecedente ${sid} no existe en el almacén.`, [sid]); else if (f.state !== 'registered') iss('policy', 'warning', `La fuente ${sid} está "${f.state}": no puede sustentar entregables.`, [sid]); }
    return { ...a, verificacion: estado };
  });
  // 3) magnitudes: unidades obligatorias para valores; unidad desconocida = pregunta, nunca suposición
  const magnitudes = [];
  for (const m of interp.magnitudes) {
    if (m.value !== null && m.unit === null && m.origin !== 'unknown') { iss('missing_input', 'warning', `La magnitud "${m.name}" tiene valor pero no unidad: no se supone ninguna.`, [m.name]); preguntas.push(`¿En qué unidad está "${m.name}"?`); magnitudes.push({ ...m, estado: 'sin_unidad' }); continue; }
    if (m.unit) { try { unidad(m.unit); } catch (e) { if (e instanceof UnitError) { iss('unit_mismatch', 'warning', `Unidad desconocida en "${m.name}": ${m.unit}.`, [m.name]); preguntas.push(`¿Qué significa la unidad "${m.unit}" de "${m.name}"?`); magnitudes.push({ ...m, estado: 'unidad_desconocida' }); continue; } throw e; } }
    magnitudes.push({ ...m, estado: m.value === null ? 'desconocida' : 'ok' });
  }
  // 4) métodos propuestos
  for (const m of interp.methods_proposed) { if (m.operation_id && !obtenerOperacion(m.operation_id)) gaps.push({ id: `gap-${gaps.length + 1}`, need: `Método "${m.free_text || m.operation_id}" sin operación ejecutable (${m.operation_id})`, why: 'La operación indicada no existe en el catálogo.', resolution: 'new_tool', blocks: [] }); else if (!m.operation_id && m.free_text) gaps.push({ id: `gap-${gaps.length + 1}`, need: `Método propuesto sin operación: ${m.free_text}`, why: 'Conservado como método propuesto no ejecutable; el servidor no calcula con texto libre.', resolution: 'new_tool', blocks: [] }); }
  // 5) desconocidos → brechas o preguntas
  for (const u of interp.unknowns) { if (u.resolution === 'external_professional') gaps.push({ id: `gap-${gaps.length + 1}`, need: u.what, why: 'Requiere criterio/validación de un profesional competente: el sistema no lo calcula ni lo infiere.', resolution: 'external_professional', blocks: u.blocks }); else if (u.resolution === 'research_external') gaps.push({ id: `gap-${gaps.length + 1}`, need: u.what, why: 'Requiere investigación con fuentes externas autorizadas (flujo de fuentes candidatas).', resolution: 'research_external', blocks: u.blocks }); else if (u.resolution === 'ask_user') preguntas.push(u.what); }
  // 6) pasos
  const flagsRiesgo = interp.risk_flags_proposed; const salida = [];
  for (const s of pasos) {
    const cap = s.capability_id ? caps.get(s.capability_id) : null; const tool = cap?.mcp_tool || (s.capability_id?.startsWith('tool.') ? s.capability_id.slice(5) : null);
    let status = 'planned'; let reason = null; let kind = KIND(s.capability_id, tool);
    if (!s.capability_id) { status = 'blocked_gap'; kind = 'external'; reason = 'Sin capacidad ejecutable para este objetivo.'; gaps.push({ id: `gap-${gaps.length + 1}`, need: s.goal, why: 'No existe una capacidad registrada que lo ejecute.', resolution: 'new_tool', blocks: [s.id] }); }
    else if (!cap) { status = 'blocked_gap'; kind = 'external'; reason = `Capacidad inexistente: ${s.capability_id}.`; gaps.push({ id: `gap-${gaps.length + 1}`, need: s.goal, why: `La capacidad "${s.capability_id}" no existe en el registro.`, resolution: 'new_tool', blocks: [s.id] }); }
    else if (cap.kind === 'operation') {
      const meta = obtenerOperacion(cap.id.slice(3)); const faltan = meta.inputs.filter((i) => i.required && !(i.name in (s.inputs || {}))).map((i) => i.name);
      if (!madurezPermitida(modo, meta.maturity)) { status = 'blocked_policy'; reason = `La operación es ${meta.maturity}: el modo ${modo} exige ≥${pol.madurez_minima_para_cifras}.`; iss('policy', 'warning', `${s.id}: ${reason}`, [s.id]); }
      else if (faltan.length) { reason = `Faltan entradas: ${faltan.join(', ')}.`; iss('missing_input', 'warning', `${s.id}: ${reason}`, [s.id]); preguntas.push(`Para "${s.goal}" faltan: ${faltan.join(', ')}.`); }
    }
    let revision = cap?.risk_class === 'high' || flagsRiesgo.includes('safety_critical') ? ['profesional_competente'] : [];
    salida.push({ id: s.id, goal: s.goal, capability_id: s.capability_id ?? null, kind, inputs: s.inputs || {}, depends_on: s.depends_on, status, reason, result_claims: [], input_hash: null, error: null, ...(revision.length ? { requires_review_by: revision } : {}) });
  }
  // 7) plan mínimo cuando Claude no propuso pasos (encargo incompleto o solo investigación)
  if (!salida.length) {
    interp.research_questions.filter((q) => q.status === 'open').forEach((q, i) => salida.push({ id: `s-inv-${i + 1}`, goal: `Investigar: ${q.text}`, capability_id: 'tool.tannia_cic_conocimiento', kind: 'retrieve', inputs: { consultas: [q.text] }, depends_on: [], status: 'ready', reason: 'Búsqueda en fuentes registradas; si no hay evidencia, proponer investigación externa.', result_claims: [], input_hash: null, error: null }));
    preguntas.slice(0, 3).forEach((q, i) => salida.push({ id: `s-preg-${i + 1}`, goal: q, capability_id: null, kind: 'ask_user', inputs: {}, depends_on: [], status: 'ready', reason: 'Dato que solo la usuaria puede aportar.', result_claims: [], input_hash: null, error: null }));
  }
  // 8) resultado
  const bloqueantes = issues.some((i) => i.severity === 'blocking'); const algunListo = salida.some((s) => ['ready', 'planned'].includes(s.status));
  const outcome = bloqueantes ? 'rejected' : (!salida.length && !preguntas.length) ? 'needs_input' : !algunListo && preguntas.length && !gaps.length ? 'needs_input' : gaps.length || issues.length ? 'accepted_with_gaps' : 'accepted';
  const plan = bloqueantes ? null : { schema: 'tw.cic.workplan/1', engagement_ref: interp.engagement_id || 'eng-pendiente', revision: 1, mode: modo, steps: salida.map(({ requires_review_by, ...p }) => p), gaps };
  if (plan) PlanSchema.parse(plan);
  return { outcome, issues, gaps, preguntas: [...new Set(preguntas)], plan, magnitudes, antecedentes, disciplinas_informativas: interp.disciplines_proposed, flags_riesgo: flagsRiesgo, revision_por_paso: Object.fromEntries(salida.filter((s) => s.requires_review_by).map((s) => [s.id, s.requires_review_by])) };
}
export const parseInterpretacion = (x) => InterpretacionSchema.safeParse(x);
