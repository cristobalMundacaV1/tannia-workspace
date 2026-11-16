// Cantidades: separa medida geométrica -> partida -> regla constructiva -> cantidad -> revisión.
// Ningún parámetro constructivo (altura, espesor, pérdida) tiene valor por defecto: si falta, se pide.
import { UserError } from '../mcp/util.js';

export const UNIDADES_PARTIDA = ['m', 'm2', 'm3', 'un', 'kg', 'gl', 'ml', 'jornada', 'hh'];

/** Reglas constructivas: qué magnitud geométrica consumen y qué parámetros explícitos exigen. */
export const REGLAS = {
  directa_longitud: { magnitud: 'longitud', params: [], unidad: 'm', formula: 'Σ longitudes' },
  directa_perimetro: { magnitud: 'perimetro', params: [], unidad: 'm', formula: 'Σ perímetros' },
  directa_area: { magnitud: 'area', params: [], unidad: 'm2', formula: 'Σ áreas' },
  area_por_espesor: { magnitud: 'area', params: ['espesor_m'], unidad: 'm3', formula: 'Σ áreas × espesor' },
  longitud_por_altura: { magnitud: 'longitud', params: ['altura_m'], unidad: 'm2', formula: 'Σ longitudes × altura' },
  longitud_por_altura_por_espesor: { magnitud: 'longitud', params: ['altura_m', 'espesor_m'], unidad: 'm3', formula: 'Σ longitudes × altura × espesor' },
  longitud_por_seccion: { magnitud: 'longitud', params: ['seccion_m2'], unidad: 'm3', formula: 'Σ longitudes × sección' },
  directa_volumen: { magnitud: 'volumen', params: [], unidad: 'm3', formula: 'Σ volúmenes de mallas cerradas (geometría pura; no implica material ni partida)' },
  conteo: { magnitud: 'conteo', params: [], unidad: 'un', formula: 'Nº de elementos' },
};

/** Reglas añadidas por TW-11 (NO forman parte del esquema de tannia_cubicar_dxf: las 72 herramientas permanecen idénticas). */
export const REGLAS_TW11 = {
  perimetro_por_altura: { magnitud: 'perimetro', params: ['altura_m'], unidad: 'm2', formula: 'Σ perímetros × altura' },
  perimetro_por_altura_por_espesor: { magnitud: 'perimetro', params: ['altura_m', 'espesor_m'], unidad: 'm3', formula: 'Σ perímetros × altura × espesor' },
  area_por_altura: { magnitud: 'area', params: ['altura_m'], unidad: 'm3', formula: 'Σ áreas × altura (prisma)' },
  longitud_por_tasa: { magnitud: 'longitud', params: ['tasa_m3_por_m'], unidad: 'm3', formula: 'Σ longitudes × tasa (m³ por metro lineal)' },
};
const TODAS = { ...REGLAS, ...REGLAS_TW11 };
const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * mediciones: resultado de measureDxf (con unidad confirmada).
 * Devuelve la partida con cantidad, fórmula visible, trazabilidad y estado.
 */
export function computeQuantity({ medicion, archivo, sha256, capas, regla, parametros = {}, descuentos = [], perdida_pct, instancia_bloque }) {
  const R = TODAS[regla];
  if (!R) throw new UserError('REGLA_DESCONOCIDA', `Regla "${regla}" no existe.`, `Reglas: ${Object.keys(TODAS).join(', ')}.`);
  if (medicion.unidades.conversion !== 'aplicada') {
    throw new UserError('UNIDAD_NO_CONFIRMADA', 'No se puede calcular una cantidad: la unidad real del dibujo no está confirmada.', 'Pregunte a la usuaria la unidad real del dibujo (mm, cm, m) y repita con unidad_confirmada.');
  }
  for (const p of R.params) {
    if (!positive(parametros[p])) throw new UserError('FALTA_DATO', `La regla "${regla}" necesita ${p} (valor positivo confirmado por la usuaria). No se asume ninguno.`, `Indique ${p}.`);
  }
  if (perdida_pct !== undefined && !(perdida_pct >= 0 && perdida_pct <= 100)) throw new UserError('DATO_INVALIDO', 'perdida_pct debe estar entre 0 y 100.');
  const f = medicion.unidades.factor_a_metros;
  const usadas = medicion.mediciones.filter((m) => capas.includes(m.capa) && m.estado !== 'duplicada' && (R.magnitud === 'conteo' ? false : m.magnitud === R.magnitud));
  const ids = usadas.map((m) => m.id);
  const warnings = [];
  let needsReview = !!medicion.necesita_revision && false;
  let base = 0;
  if (R.magnitud === 'conteo') {
    const inst = medicion.mediciones.filter((m) => capas.includes(m.capa) && m.tipo_geometria === 'INSERT' && m.estado !== 'duplicada' && (!instancia_bloque || m.bloque_nombre === instancia_bloque));
    base = inst.reduce((a, m) => a + m.valor, 0);
    ids.push(...inst.map((m) => m.id));
    if (inst.some((m) => m.estado === 'needs_review')) { needsReview = true; warnings.push('Hay bloques con problemas (needs_review).'); }
    if (!inst.length) warnings.push('No se encontraron bloques (INSERT) en esas capas.');
  } else {
    const dim = R.magnitud === 'area' ? f * f : R.magnitud === 'volumen' ? f * f * f : f;
    for (const m of usadas) {
      if (m.valor === null || m.estado === 'needs_review') { needsReview = true; continue; }
      base += m.valor * dim;
    }
    if (usadas.some((m) => m.estado === 'needs_review' || m.valor === null)) warnings.push('Hay mediciones con needs_review en estas capas: su valor NO se sumó o es dudoso. Revise antes de usar la cantidad.');
    if (!usadas.length) warnings.push('No se encontraron mediciones de esa magnitud en las capas indicadas.');
  }
  if (medicion.unidades.discrepancia) { needsReview = true; warnings.push('Discrepancia entre unidad declarada y confirmada.'); }
  let q = base;
  const formula = [`${R.formula}`];
  if (R.params.includes('espesor_m') && R.magnitud === 'area' || regla === 'longitud_por_altura_por_espesor') { /* se aplica abajo */ }
  for (const p of R.params) q *= parametros[p];
  if (R.params.length) formula.push(`× ${R.params.map((p) => `${p}=${parametros[p]}`).join(' × ')}`);
  const desc = descuentos.reduce((a, d) => a + (positive(d.cantidad) ? d.cantidad : 0), 0);
  if (descuentos.some((d) => !positive(d.cantidad))) throw new UserError('DATO_INVALIDO', 'Los descuentos deben ser cantidades positivas.');
  if (desc) { q -= desc; formula.push(`− descuentos(${descuentos.map((d) => `${d.motivo || 'sin motivo'}: ${d.cantidad}`).join('; ')})`); }
  if (q < 0) throw new UserError('DATO_INVALIDO', 'Los descuentos superan la cantidad medida.');
  if (perdida_pct) { q *= 1 + perdida_pct / 100; formula.push(`× (1 + ${perdida_pct}% pérdida declarada)`); }
  const supuestos = R.params.map((p) => `${p} = ${parametros[p]} (dato entregado por la usuaria; no deducido del dibujo)`);
  return {
    unidad: R.unidad, cantidad: q, cantidad_geometrica_base: base, regla,
    formula: formula.join(' '), parametros, descuentos, perdida_pct: perdida_pct ?? null,
    fuente: { archivo, sha256: sha256 || null, capas, mediciones: ids, unidad_confirmada: medicion.unidades.confirmadas },
    supuestos, advertencias: warnings,
    estado_revision: needsReview ? 'needs_review' : 'borrador',
    cantidad_verificada: false, // solo una persona la marca como verificada
  };
}
