// Ejecutor idempotente y reanudable del plan (docs/tw11/02 §3). Solo ejecuta pasos de CÁLCULO deterministas; los pasos con herramientas que escriben
// (CAD/documentos) los ejecuta Claude con la herramienta indicada. NUNCA reintenta escrituras inciertas.
import { ejecutarOperacion, OpError } from './ops/index.js';
import { claimsDeOperacion } from './claims.js';
import { Ledger } from './claims.js';
import { ordenTopologico, esRef, esRefs, refsDe } from './interpretacion.js';
import { sha256 } from './hash.js';

const SIN_REINTENTO = new Set(['generate_cad', 'generate_doc']);

function profundo(v, ctx) {
  if (esRef(v)) { const r = resolverUno({ ref: v.ref }, ctx); return v.as === 'quantity' ? { value: r.value, unit: r.unit } : r.value; }
  if (Array.isArray(v)) return v.map((x) => profundo(x, ctx)); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, profundo(x, ctx)])); return v;
}
function resolverEntrada(v, ctx) {
  if (v && typeof v === 'object' && !esRef(v) && !esRefs(v) && 'value' in v && refsDe(v.value).length) return { value: profundo(v.value, ctx), unit: v.unit ?? null };
  if (esRefs(v)) { const xs = v.refs.map((r) => resolverEntrada({ ref: r }, ctx)); const u = xs[0].unit; if (xs.some((x) => x.unit !== u)) throw new OpError('DIMENSION_INCOMPATIBLE', 'Las referencias de una lista deben tener la misma unidad.'); return { value: xs.map((x) => x.value), unit: u }; }
  return resolverUno(v, ctx);
}
function resolverUno(v, { doc, L, porPaso }) {
  if (!esRef(v)) return v; const [tipo, resto] = [v.ref.split(':')[0], v.ref.slice(v.ref.indexOf(':') + 1)];
  if (tipo === 'magnitude') { const m = (doc.magnitudes || []).find((x) => x.name === resto); if (!m || m.value === null || m.value === undefined) throw new OpError('ENTRADA_FALTANTE', `Magnitud "${resto}" sin valor.`); if (m.origin === 'source' && !L.list().some((c) => c.kind === 'data' && c.statement === resto && c.status !== 'stale')) throw new OpError('ENTRADA_SIN_RESPALDO', `El dato "${resto}" declara una fuente pero no hay un claim vigente que lo respalde (fuente inexistente, retirada o dato desactualizado).`); return { value: m.value, unit: m.unit }; }
  if (tipo === 'claim') { const c = L.get(resto); if (!c || c.status === 'stale' || c.value === null) throw new OpError('CLAIM_NO_VIGENTE', `El claim ${resto} no existe o no está vigente.`); return { value: c.value, unit: c.unit }; }
  const [sid, out0] = resto.split('.'); const mi = /^(\w+)\[(\d+)\]$/.exec(out0 || ''); const out = mi ? mi[1] : out0; const c = porPaso.get(sid)?.[out]; if (!c) throw new OpError('ENTRADA_FALTANTE', `El paso ${sid} aún no produjo "${out}".`);
  if (mi) { if (!Array.isArray(c.value) || Number(mi[2]) >= c.value.length) throw new OpError('ENTRADA_FALTANTE', `"${out}" no tiene el elemento ${mi[2]}.`); return { value: c.value[Number(mi[2])], unit: c.unit }; } return { value: c.value, unit: c.unit };
}

/** Ejecuta pasos `ready`/`planned` cuyo resultado sea determinista. Modifica `doc` (plan, claims). Devuelve el informe. */
export function ejecutarPlan(doc, { modo, solo = null, ahora = () => new Date().toISOString() } = {}) {
  const plan = doc.plan; if (!plan) return { ejecutados: [], fallidos: [], omitidos: [], mensaje: 'No hay plan.' };
  const L = new Ledger(doc.claims); const informe = { ejecutados: [], fallidos: [], omitidos: [], delegados: [], recomputados: [], invalidados: [] }; const porPaso = new Map();
  const estadoPaso = new Map(plan.steps.map((s) => [s.id, s]));
  for (const s of plan.steps) if (s.status === 'done') { const o = {}; for (const cid of s.result_claims) { const c = L.get(cid); if (c) o[c.statement.split('→ ').pop().trim()] = c; } porPaso.set(s.id, o); }
  for (const s of ordenTopologico(plan.steps)) {
    if (solo && !solo.includes(s.id)) continue;
    // reanudación tras interrupción: `running` en pasos de escritura NO se reintenta
    if (s.status === 'running') { if (SIN_REINTENTO.has(s.kind)) { s.status = 'failed'; s.error = { code: 'RESULTADO_INCIERTO', message: 'La ejecución se interrumpió durante una escritura: no se reintenta automáticamente. Verifique el archivo y decida.' }; informe.fallidos.push({ id: s.id, codigo: 'RESULTADO_INCIERTO' }); continue; } s.status = 'planned'; }
    if (s.kind !== 'compute') { if (['ready', 'planned'].includes(s.status) && s.capability_id) informe.delegados.push({ id: s.id, herramienta: s.capability_id.replace(/^tool\./, ''), objetivo: s.goal }); continue; }
    if (!['ready', 'planned', 'done', 'stale', 'failed', 'blocked_dependency'].includes(s.status)) { informe.omitidos.push({ id: s.id, estado: s.status, razon: s.reason }); continue; }
    const bloqueadoPor = s.depends_on.filter((d) => { const p = estadoPaso.get(d); return p && !['done'].includes(p.status) && !(solo && !solo.includes(d)); });
    if (bloqueadoPor.length) { if (['ready', 'planned'].includes(s.status)) { s.status = 'blocked_dependency'; s.reason = `Espera: ${bloqueadoPor.join(', ')}`; } informe.omitidos.push({ id: s.id, estado: s.status, razon: s.reason }); continue; }
    try {
      const entradas = {}; for (const [k, v] of Object.entries(s.inputs)) entradas[k] = resolverEntrada(v, { doc, L, porPaso });
      const hash = sha256({ op: s.capability_id, entradas, modo }); if (s.status === 'done' && s.input_hash === hash) { informe.omitidos.push({ id: s.id, estado: 'done', razon: 'idempotente: mismas entradas' }); continue; }
      const rehace = s.status === 'done' || s.status === 'stale'; const res = ejecutarOperacion(s.capability_id.slice(3), entradas, { modo });
      const claims = claimsDeOperacion(res, { modo, etiqueta: s.goal, depende_de: Object.values(s.inputs).flatMap((v) => refsDe(v)).flatMap((r) => (r.startsWith('claim:') ? [r.slice(6)] : r.startsWith('magnitude:') ? L.list().filter((c) => c.kind === 'data' && c.statement === r.slice(10) && c.status !== 'stale').map((c) => c.id) : [])), ahora });
      if (rehace) { const inv = L.invalidar(s.result_claims.filter((c) => !claims.some((n) => n.id === c))); informe.invalidados.push(...inv); informe.recomputados.push(s.id); }
      claims.forEach((c) => L.add(c)); s.result_claims = claims.map((c) => c.id); s.input_hash = hash; s.status = 'done'; s.error = null; s.reason = res.warnings.join(' · ') || null;
      const o = {}; for (const c of claims) o[c.statement.split('→ ').pop().trim()] = c; porPaso.set(s.id, o); informe.ejecutados.push({ id: s.id, claims: s.result_claims, madurez: res.maturity });
      // los pasos dependientes quedan desactualizados si este se recomputó con resultado distinto
      if (rehace) for (const d of plan.steps) if (d.depends_on.includes(s.id) && d.status === 'done') { d.status = 'stale'; d.reason = `Su base (${s.id}) cambió: recalcular.`; L.invalidar(d.result_claims); informe.invalidados.push(...d.result_claims); }
    } catch (e) {
      if (!(e instanceof OpError)) throw e; s.status = 'failed'; s.error = { code: e.code, message: e.message }; informe.fallidos.push({ id: s.id, codigo: e.code, mensaje: e.message });
      for (const d of plan.steps) if (d.depends_on.includes(s.id) && ['ready', 'planned'].includes(d.status)) { d.status = 'blocked_dependency'; d.reason = `Depende de ${s.id}, que falló (${e.code}).`; }
    }
  }
  doc.claims = L.list(); informe.invalidados = [...new Set(informe.invalidados)]; return informe;
}
