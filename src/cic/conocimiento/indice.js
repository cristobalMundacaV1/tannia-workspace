// Índice BM25 local, determinista y sin dependencias, con facetas, sinónimos editables y fusión RRF de múltiples consultas.
const STOP = new Set('a al algo ante con contra cual cuando de del desde donde el ella ellas ello ellos en entre era es esta estas este estos fue ha han hasta la las le les lo los mas me mi muy no nos o para pero por que se si sin sobre su sus te tu un una uno unos y ya como son ser'.split(' '));
export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function stem(w) { let t = w; for (const suf of ['aciones', 'acion', 'amientos', 'amiento', 'idades', 'idad', 'mente', 'adores', 'ador', 'ables', 'able', 'ando', 'iendo', 'ados', 'adas', 'ado', 'ada', 'es', 's']) if (t.length > suf.length + 3 && t.endsWith(suf)) { t = t.slice(0, -suf.length); break; } return t; }
export function tokens(s) { return norm(s).split(/[^a-z0-9ñ.,]+/).flatMap((x) => x.replace(/[.,]+$/g, '').split(/(?<=\d)[.,](?=\D)|(?<=\D)[.,](?=\d)/)).filter((x) => x && !STOP.has(x) && x.length > 1).map(stem); }

export class Indice {
  constructor({ sinonimos = {} } = {}) { this.docs = []; this.df = new Map(); this.avg = 0; this.sin = new Map(Object.entries(sinonimos).flatMap(([k, v]) => { const g = [k, ...v].map((x) => tokens(x).join(' ')); return g.map((x) => [x, g]); })); }
  agregar(id, texto, meta) { const tk = tokens(texto); const tf = new Map(); tk.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1)); this.docs.push({ id, tf, len: tk.length, meta, texto }); for (const t of tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1); this.avg = this.docs.reduce((a, d) => a + d.len, 0) / this.docs.length; }
  expandir(q) { const base = tokens(q); const extra = []; const qn = tokens(q).join(' '); for (const [k, g] of this.sin) if (qn.includes(k)) extra.push(...g.filter((x) => x !== k).flatMap((x) => x.split(' '))); return [...new Set([...base, ...extra])].map((t) => ({ t, peso: base.includes(t) ? 1 : 0.6 })); }
  buscar(q, { k1 = 1.5, b = 0.75, filtro = () => true, limite = 10 } = {}) {
    const qs = this.expandir(q); const N = this.docs.length; const res = [];
    for (const d of this.docs) { if (!filtro(d.meta)) continue; let s = 0; for (const { t, peso } of qs) { const f = d.tf.get(t); if (!f) continue; const df = this.df.get(t); const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5)); s += peso * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / (this.avg || 1)))); } if (s > 0) { const base = qs.filter((x) => x.peso === 1); const cob = base.length ? base.filter((x) => d.tf.has(x.t)).length / base.length : 0; res.push({ id: d.id, score: s, cobertura: cob, meta: d.meta, texto: d.texto }); } }
    return res.sort((a, b2) => b2.score - a.score || (a.id < b2.id ? -1 : 1)).slice(0, limite);
  }
  /** Reciprocal Rank Fusion de varias consultas (p. ej. reformulaciones aportadas por Claude). */
  buscarMulti(consultas, opts = {}) { const m = new Map(); consultas.forEach((q) => this.buscar(q, { ...opts, limite: 30 }).forEach((r, i) => { const e = m.get(r.id) || { ...r, score: 0, rrf: 0, cobertura: 0 }; e.rrf += 1 / (60 + i + 1); e.score = Math.max(e.score, r.score); e.cobertura = Math.max(e.cobertura, r.cobertura); m.set(r.id, e); })); return [...m.values()].sort((a, b) => b.rrf - a.rrf || (a.id < b.id ? -1 : 1)).slice(0, opts.limite || 10); }
}
