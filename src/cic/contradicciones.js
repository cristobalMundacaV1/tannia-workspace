// Detección de contradicciones entre claims de dato (mismo enunciado, valores incompatibles tras convertir unidades). Nunca resuelve: solo expone.
import { unidad, dimEq } from './units.js';
import { sha256 } from './hash.js';
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const aSI = (c) => { if (typeof c.value !== 'number') return null; if (!c.unit) return { v: c.value, dim: null }; try { const u = unidad(c.unit); return { v: c.value * u.factor, dim: u.dim }; } catch { return { v: c.value, dim: 'u:' + c.unit }; } };
export function detectarContradicciones(claims) {
  const grupos = new Map(); for (const c of claims) { if (c.kind !== 'data' || c.status === 'stale') continue; const k = norm(c.statement); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(c); }
  const out = [];
  for (const [k, g] of grupos) {
    if (g.length < 2) continue; const vals = g.map((c) => ({ c, s: aSI(c) })).filter((x) => x.s);
    const distintos = []; for (const x of vals) if (!distintos.some((y) => (y.s.dim === null && x.s.dim === null || (typeof y.s.dim === 'string' || typeof x.s.dim === 'string' ? y.s.dim === x.s.dim : y.s.dim && x.s.dim && dimEq(y.s.dim, x.s.dim))) && Math.abs(y.s.v - x.s.v) <= 1e-9 * Math.max(1, Math.abs(y.s.v)))) distintos.push(x);
    if (distintos.length > 1) out.push({ schema: 'tw.cic.contradiction/1', id: `ctr-${sha256(k).slice(0, 12)}`, kind: 'valor', items: distintos.map((x) => ({ ref: x.c.id, value: `${x.c.value}${x.c.unit ? ' ' + x.c.unit : ''} (${x.c.status}${x.c.source_refs[0] ? `; fuente ${x.c.source_refs[0].source_id}` : ''})` })), status: 'open', resolution: null });
  }
  return out;
}
