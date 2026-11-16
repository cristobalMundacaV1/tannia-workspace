// Verificador de entregables por ROLES NUMÉRICOS (docs/tw11/02 §8): bloquea solo lo técnico sin respaldo; constantes, ids, numeración y metadatos están exentos.
import { ROLES_CON_RESPALDO, ROLES_EXENTOS } from './schemas.js';
import { unidad, UnitError, dimEq } from './units.js';

const UN = 'mm2|cm2|m2|km2|mm3|cm3|m3|m²|m³|cm²|mm²|km²|cm³|mm|cm|dm|km|m|kg|ha|t|l|min|h|d|días|dias|%|‰|°|deg|rad|CLP|UF|USD';
const RE = new RegExp(String.raw`(?<![\w.,/-])(\$\s?)?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s?(${UN})(?![\p{L}\d_]))?`, 'gu');
const ESTATICA = /^\s*(?:[-•*]\s*)?(?:F[óo]rmula|Hip[óo]tesis|Rango de validez|Cota de error)\s*:/i;
const FECHA = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;

/** Interpreta un número en notación es/en. Devuelve posibles valores (puede ser ambiguo "1.234"). */
export function candidatosNumericos(txt) {
  const s = txt.replace(/\s/g, ''); const out = new Set();
  const comas = (s.match(/,/g) || []).length; const puntos = (s.match(/\./g) || []).length;
  const num = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };
  if (comas && puntos) { const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'; const mil = dec === ',' ? '.' : ','; out.add(num(s.split(mil).join('').replace(dec, '.'))); }
  else if (comas) { if (comas === 1 && /,\d{1,2}$/.test(s) || comas === 1 && !/,\d{3}$/.test(s)) out.add(num(s.replace(',', '.'))); else out.add(num(s.split(',').join(''))); if (comas === 1 && /,\d{3}$/.test(s)) out.add(num(s.replace(',', '.'))); }
  else if (puntos) { out.add(num(s)); if (/\.\d{3}$/.test(s) || puntos > 1) out.add(num(s.split('.').join(''))); }
  else out.add(num(s));
  return [...out].filter((v) => v !== null);
}
const dec = (t) => { const m = t.replace(/\s/g, '').match(/[.,](\d+)$/); return m && !/^\d{3}$/.test(m[1]) ? m[1].length : 0; };
const aSI = (v, u) => { try { const e = unidad(u); return { v: v * e.factor, dim: e.dim }; } catch (err) { if (err instanceof UnitError) return null; throw err; } };

function coincide(valorTexto, unTxt, claim, decimales) {
  if (claim.value === null || typeof claim.value !== 'number') return false;
  const tol = (x) => Math.max(0.5 * 10 ** -decimales * 1.0000001, Math.abs(x) * 1e-9) + 1e-12;
  const cu = claim.unit; const eqMismo = (a, b) => Math.abs(a - b) <= tol(b) || Math.abs(a - b) <= Math.abs(b) * 0.0051 && decimales === 0;
  if (!unTxt) return eqMismo(valorTexto, claim.value);
  if (cu === unTxt || (cu === 'CLP' && unTxt === '$')) return eqMismo(valorTexto, claim.value);
  const a = aSI(valorTexto, unTxt); const b = cu ? aSI(claim.value, cu) : null; if (!a || !b || !dimEq(a.dim, b.dim)) return false;
  const tolSI = Math.max(0.5 * 10 ** -decimales * unidad(unTxt).factor, Math.abs(b.v) * 1e-9) + 1e-12; return Math.abs(a.v - b.v) <= tolSI * 1.0000001 || Math.abs(a.v - b.v) <= Math.abs(b.v) * 0.0051 && decimales === 0;
}
const claimValido = (c) => c && !['stale', 'model_asserted', 'not_computed'].includes(c.status) && c.kind !== 'pending';

/**
 * @param entregable { slots:[{id,role,value,unit,claim_id,input_ref,decimals}], texto?:string }
 * @param ctx { claims: Map|Ledger, entradas: Set<string> (ids de magnitudes/datos del encargo), fuentes: Set<string> (ids de fuentes registradas) }
 */
export function verificarEntregable(entregable, ctx = {}) {
  const L = ctx.claims; const getC = (id) => (L?.get ? L.get(id) : null);
  const bloqueos = []; const avisos = []; const stats = { slots: 0, exentos: 0, verificados: 0, texto_con_unidad: 0, texto_sin_unidad: 0 };
  for (const s of entregable.slots || []) {
    stats.slots++;
    if (ROLES_EXENTOS.includes(s.role)) { stats.exentos++; continue; }
    if (!ROLES_CON_RESPALDO.includes(s.role)) { bloqueos.push({ codigo: 'ROL_DESCONOCIDO', slot: s.id, mensaje: `Rol numérico desconocido "${s.role}".` }); continue; }
    const c = s.claim_id ? getC(s.claim_id) : null;
    if (s.role === 'input_parameter' && !c && s.input_ref && ctx.entradas?.has(s.input_ref)) { stats.verificados++; continue; }
    if (!c) { bloqueos.push({ codigo: 'SIN_CLAIM', slot: s.id, mensaje: `El número técnico "${s.id}" (${s.role}) no tiene claim ni entrada registrada.` }); continue; }
    if (!claimValido(c)) { bloqueos.push({ codigo: 'CLAIM_NO_VIGENTE', slot: s.id, mensaje: `El claim ${c.id} está ${c.status}: no puede respaldar un resultado.` }); continue; }
    if (s.role === 'technical_result' && c.kind !== 'calculation' && c.kind !== 'data') { bloqueos.push({ codigo: 'CLAIM_TIPO_INCORRECTO', slot: s.id, mensaje: `Un resultado técnico requiere un claim de cálculo o de dato; es "${c.kind}".` }); continue; }
    if (s.role === 'technical_result' && c.kind === 'data' && c.status === 'user_stated') { bloqueos.push({ codigo: 'DATO_NO_ES_RESULTADO', slot: s.id, mensaje: 'Un dato aportado no es un resultado técnico: use rol input_parameter.' }); continue; }
    if (s.role === 'source_datum') { if (c.kind !== 'data' || !c.source_refs.length) { bloqueos.push({ codigo: 'SIN_FUENTE', slot: s.id, mensaje: 'Un dato de fuente requiere claim "data" con referencia de fuente.' }); continue; } if (ctx.fuentes && !c.source_refs.every((r) => ctx.fuentes.has(r.source_id))) { bloqueos.push({ codigo: 'FUENTE_NO_REGISTRADA', slot: s.id, mensaje: 'La fuente citada no está registrada/aprobada.' }); continue; } }
    if (s.value !== undefined && s.value !== null && !coincide(Number(s.value), s.unit || null, c, s.decimals ?? dec(String(s.value)))) { bloqueos.push({ codigo: 'VALOR_NO_COINCIDE', slot: s.id, mensaje: `El valor mostrado (${s.value} ${s.unit || ''}) no coincide con el claim ${c.id} (${c.value} ${c.unit || ''}).` }); continue; }
    stats.verificados++;
  }
  if (typeof entregable.texto === 'string') {
    // Documentación ESTÁTICA de las operaciones (fórmula, hipótesis, rango de validez, cota de error): no son cifras del proyecto (p. ej. «<90°»).
    const t = entregable.texto.split('\n').filter((ln) => { if (ESTATICA.test(ln)) { stats.texto_estatico = (stats.texto_estatico || 0) + 1; return false; } return true; }).join('\n').replace(FECHA, ' ');
    const claims = L?.list ? L.list().filter(claimValido) : [];
    for (const m of t.matchAll(RE)) {
      const mon = m[1]; const raw = m[2]; const un = m[3] ? m[3].replace('²', '2').replace('³', '3') : (mon ? 'CLP' : null);
      if (!un) { stats.texto_sin_unidad++; continue; }          // sin unidad ni moneda: nunca bloquea (identificadores, numeración, conteos)
      stats.texto_con_unidad++;
      const cands = candidatosNumericos(raw); const d = dec(raw);
      const ok = cands.some((v) => claims.some((c) => coincide(v, un, c, d)) || (ctx.valoresEntrada || []).some((e) => coincide(v, un, { value: e.value, unit: e.unit }, d)));
      if (!ok) bloqueos.push({ codigo: 'NUMERO_SIN_RESPALDO', texto: m[0].trim(), mensaje: `La cifra "${m[0].trim()}" lleva unidad pero no coincide con ningún claim ni dato registrado.` });
    }
    if (stats.texto_sin_unidad) avisos.push({ codigo: 'NUMEROS_SIN_UNIDAD_NO_VERIFICADOS', cantidad: stats.texto_sin_unidad, mensaje: 'Hay números sin unidad en el texto (conteos, identificadores, numeración): no se bloquean; revíselos si representan resultados técnicos.' });
  }
  return { ok: bloqueos.length === 0, bloqueos, avisos, stats };
}
