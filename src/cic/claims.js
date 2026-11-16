// Ledger de claims: unidad mínima de afirmación técnica con procedencia (docs/tw11/02 §2, §8). IDs deterministas → reproducible.
import { ClaimSchema } from './schemas.js';
import { sha256 } from './hash.js';

export const claimId = (clave) => `clm-${sha256(clave).slice(0, 16)}`;

/** Claims `calculation` a partir del resultado de una operación (uno por salida). `entradas_claims` = claims de los que depende. */
export function claimsDeOperacion(res, { modo = 'professional', etiqueta = '', depende_de = [], ahora = () => new Date().toISOString() } = {}) {
  const claims = [];
  for (const [nombre, o] of Object.entries(res.outputs)) {
    if (o.value === null || o.value === undefined) continue;
    claims.push(ClaimSchema.parse({
      schema: 'tw.cic.claim/1', id: claimId({ op: res.operation_id, v: res.version, h: res.input_hash, out: nombre }), kind: 'calculation',
      statement: `${etiqueta ? `${etiqueta}: ` : ''}${res.operation_id} → ${nombre}`, value: o.value, unit: o.unit, dimension: o.dimension, source_refs: [],
      method_ref: { operation_id: res.operation_id, version: res.version, input_hash: res.input_hash, maturity: res.maturity }, depends_on: depende_de,
      status: 'computed', requires_review_by: res.requires_review_by || [], created_at: ahora(), mode: modo,
    }));
  }
  return claims;
}
/** Claim de dato aportado por la usuaria (parámetro de entrada) o de una fuente. */
export function claimDeDato({ statement, value, unit = null, dimension = null, source_refs = [], user = true, ahora = () => new Date().toISOString(), modo }) {
  const status = user ? 'user_stated' : 'reported_by_source';
  return ClaimSchema.parse({ schema: 'tw.cic.claim/1', id: claimId({ k: 'data', statement, value, unit, status, source_refs }), kind: 'data', statement, value, unit, dimension, source_refs, method_ref: null, depends_on: [], status, requires_review_by: [], created_at: ahora(), ...(modo ? { mode: modo } : {}) });
}
export function claimSupuesto({ statement, value = null, unit = null, ahora = () => new Date().toISOString() }) {
  return ClaimSchema.parse({ schema: 'tw.cic.claim/1', id: claimId({ k: 'assumption', statement, value, unit }), kind: 'assumption', statement, value, unit, dimension: null, source_refs: [], method_ref: null, depends_on: [], status: 'assumed_editable', requires_review_by: [], created_at: ahora() });
}
export function claimPendiente({ statement, requires_review_by = [], ahora = () => new Date().toISOString() }) {
  return ClaimSchema.parse({ schema: 'tw.cic.claim/1', id: claimId({ k: 'pending', statement }), kind: 'pending', statement, value: null, unit: null, dimension: null, source_refs: [], method_ref: null, depends_on: [], status: 'not_computed', requires_review_by, created_at: ahora() });
}

export class Ledger {
  constructor(claims = []) { this.map = new Map(); for (const c of claims) this.map.set(c.id, c); }
  add(c) { const v = ClaimSchema.parse(c); this.map.set(v.id, v); return v; }
  get(id) { return this.map.get(id) || null; }
  list() { return [...this.map.values()]; }
  /** Marca como `stale` los claims dependientes (transitivo). Devuelve los ids afectados. */
  invalidar(ids) {
    const afectados = new Set(); const pend = [...ids];
    while (pend.length) { const x = pend.pop(); for (const c of this.map.values()) if (c.depends_on.includes(x) && !afectados.has(c.id)) { afectados.add(c.id); pend.push(c.id); } }
    for (const id of ids) afectados.add(id);
    for (const id of afectados) { const c = this.map.get(id); if (c) this.map.set(id, { ...c, status: 'stale' }); }
    return [...afectados];
  }
  /** Un claim `calculation` es reproducible si su hash de método existe; la reproducción la hace el llamador con las mismas entradas. */
  porKind(k) { return this.list().filter((c) => c.kind === k); }
}
