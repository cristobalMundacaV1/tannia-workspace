// Semántica de actualización de encargos (H1): `actualizar` conserva todo lo previo y aplica SOLO lo expresamente indicado; `reemplazar` es una interpretación
// integral nueva (la anterior queda en el historial de versiones). Nada se elimina por omisión; los conflictos importantes exigen confirmación nombrada.
import { UserError } from '../mcp/util.js';
import { mag, dimEq, UnitError } from './units.js';

const CLAVES = {
  intents: (x) => `${x.kind}|${x.text}`, research_questions: (x) => x.id, deliverables: (x) => x.id, disciplines_proposed: (x) => x.tag, antecedents: (x) => `${x.ref}|${x.quote || ''}`,
  magnitudes: (x) => x.name, methods_proposed: (x) => x.operation_id || x.free_text || JSON.stringify(x), assumptions: (x) => x.text, unknowns: (x) => x.what, proposed_steps: (x) => x.id,
};
const RETIRO = { magnitudes: ['magnitudes', 'name'], pasos: ['proposed_steps', 'id'], entregables: ['deliverables', 'id'], supuestos: ['assumptions', 'text'], preguntas: ['research_questions', 'id'], desconocidos: ['unknowns', 'what'] };

const igualSI = (a, b) => {
  if (a.value === b.value && a.unit === b.unit) return { igual: true };
  if (a.value === null || b.value === null || a.value === undefined || b.value === undefined) return { igual: false, motivo: 'valor' };
  if (!a.unit || !b.unit) return { igual: a.value === b.value && (a.unit || null) === (b.unit || null), motivo: 'valor' };
  try { const x = mag(a.value, a.unit); const y = mag(b.value, b.unit); if (!dimEq(x.dim, y.dim)) return { igual: false, motivo: 'dimension' }; return { igual: Math.abs(x.valor - y.valor) <= 1e-9 * Math.max(1, Math.abs(y.valor)), motivo: 'valor' }; }
  catch (e) { if (e instanceof UnitError) return { igual: false, motivo: 'unidad_desconocida' }; throw e; }
};

/** @returns {merged, cambios} — `prev` es la interpretación vigente (o null), `nuevo` la propuesta parcial. */
export function fusionar(prev, nuevo, retirar = {}) {
  const merged = JSON.parse(JSON.stringify(prev || {})); const cambios = { agregados: [], modificados: [], retirados: [], conservados: 0 };
  for (const campo of ['restatement', 'mode', 'engagement_id']) if (nuevo[campo] !== undefined && nuevo[campo] !== merged[campo]) { if (merged[campo] !== undefined) cambios.modificados.push(campo); merged[campo] = nuevo[campo]; }
  for (const [campo, clave] of Object.entries(CLAVES)) {
    const base = merged[campo] || []; const mapa = new Map(base.map((x) => [clave(x), x]));
    for (const x of nuevo[campo] || []) { const k = clave(x); if (mapa.has(k)) { if (JSON.stringify(mapa.get(k)) !== JSON.stringify(x)) cambios.modificados.push(`${campo}:${k}`); mapa.set(k, x); } else { mapa.set(k, x); cambios.agregados.push(`${campo}:${k}`); } }
    merged[campo] = [...mapa.values()];
  }
  if (nuevo.risk_flags_proposed) merged.risk_flags_proposed = [...new Set([...(merged.risk_flags_proposed || []), ...nuevo.risk_flags_proposed])]; // solo AGREGAN restricciones
  for (const [clave, lista] of Object.entries(retirar || {})) {
    const def = RETIRO[clave]; if (!def) throw new UserError('RETIRO_DESCONOCIDO', `No se puede retirar "${clave}". Opciones: ${Object.keys(RETIRO).join(', ')}.`);
    for (const id of lista || []) { const [campo, k] = def; const antes = (merged[campo] || []).length; merged[campo] = (merged[campo] || []).filter((x) => x[k] !== id); if (merged[campo].length === antes) throw new UserError('RETIRO_INEXISTENTE', `No se puede retirar «${id}» de ${clave}: no existe.`, 'Compruebe el nombre exacto; nada se eliminó.'); cambios.retirados.push(`${clave}:${id}`); }
  }
  cambios.conservados = ['magnitudes', 'deliverables', 'proposed_steps', 'assumptions'].reduce((a, c) => a + (merged[c] || []).filter((x) => !cambios.agregados.concat(cambios.modificados).some((s) => s.startsWith(`${c}:`) && s.endsWith(`:${CLAVES[c](x)}`))).length, 0);
  return { merged, cambios };
}

/** Conflictos que exigen confirmación humana nombrada (confirmar_cambios). */
export function conflictos(prev, merged, { pasosHechos = new Set() } = {}) {
  const out = []; if (!prev) return out;
  if (prev.mode && merged.mode && prev.mode !== merged.mode && prev.mode !== 'unspecified') out.push({ dato: 'mode', antes: prev.mode, despues: merged.mode, motivo: 'cambia el modo (académico↔profesional): cambian las políticas de madurez y las marcas' });
  for (const m of merged.magnitudes || []) {
    const o = (prev.magnitudes || []).find((x) => x.name === m.name); if (!o || o.value === null || o.value === undefined || o.origin === 'unknown') continue;
    const r = igualSI(o, m); if (r.igual) continue;
    out.push({ dato: m.name, antes: `${o.value} ${o.unit ?? ''}`.trim(), despues: m.value === null ? 'desconocido' : `${m.value} ${m.unit ?? ''}`.trim(), motivo: r.motivo === 'dimension' ? 'cambia la dimensión física' : r.motivo === 'unidad_desconocida' ? 'unidad no reconocida' : m.value === null ? 'pasa a desconocido (eliminar un dato es explícito: use retirar)' : 'cambia el valor', afecta: (merged.proposed_steps || []).filter((s) => JSON.stringify(s.inputs).includes(`"ref":"magnitude:${m.name}"`)).map((s) => s.id) });
  }
  for (const s of merged.proposed_steps || []) { const o = (prev.proposed_steps || []).find((x) => x.id === s.id); if (o && pasosHechos.has(s.id) && JSON.stringify([o.capability_id, o.inputs]) !== JSON.stringify([s.capability_id, s.inputs])) out.push({ dato: `paso:${s.id}`, antes: `${o.capability_id}`, despues: `${s.capability_id}`, motivo: 'cambia un paso ya ejecutado (sus resultados quedarán desactualizados)', afecta: [s.id] }); }
  return out;
}
