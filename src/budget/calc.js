// Cálculo de APU y presupuesto en CLP. Reglas de redondeo EXPLÍCITAS e idénticas a las fórmulas del XLSX.
import { UserError } from '../mcp/util.js';

/** ROUND(x,0) de Excel: la mitad se aleja de cero (tolerancia 1e-9 para ruido binario). */
export function round0(x) {
  const sgn = x < 0 ? -1 : 1;
  return sgn * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}
export const TIPOS_INSUMO = ['material', 'mano_obra', 'equipo', 'subcontrato'];

export function insumoCantidad(i) {
  if (i.rendimiento !== undefined && i.rendimiento !== null) {
    if (!(i.rendimiento > 0)) throw new UserError('DATO_INVALIDO', `Rendimiento inválido en "${i.descripcion}".`);
    return (i.cuadrilla ?? 1) / i.rendimiento;
  }
  return i.cantidad;
}

export function validateApu(apu) {
  const probs = [];
  if (!apu.codigo) probs.push('APU sin código.');
  if (!apu.unidad) probs.push(`APU ${apu.codigo}: falta unidad.`);
  if (!Array.isArray(apu.insumos) || !apu.insumos.length) probs.push(`APU ${apu.codigo}: sin insumos.`);
  for (const i of apu.insumos || []) {
    if (!TIPOS_INSUMO.includes(i.tipo)) probs.push(`APU ${apu.codigo}: tipo de insumo inválido "${i.tipo}".`);
    const c = i.rendimiento != null ? i.cuadrilla ?? 1 : i.cantidad;
    if (!(typeof c === 'number' && c > 0)) probs.push(`APU ${apu.codigo}/${i.descripcion}: cantidad o rendimiento no válido.`);
    if (i.precio_unitario == null) probs.push(`APU ${apu.codigo}/${i.descripcion}: FALTA PRECIO (no se inventa).`);
    else if (!(i.precio_unitario >= 0)) probs.push(`APU ${apu.codigo}/${i.descripcion}: precio inválido.`);
    if (i.precio_unitario != null && (!i.fuente_precio || !i.fecha_precio)) probs.push(`APU ${apu.codigo}/${i.descripcion}: precio sin fuente o fecha.`);
  }
  return probs;
}

export function apuUnitCost(apu) {
  const lineas = apu.insumos.map((i) => {
    const cant = insumoCantidad(i);
    const sub = i.precio_unitario == null ? null : cant * i.precio_unitario;
    return { ...i, cantidad_efectiva: cant, subtotal: sub };
  });
  const faltan = lineas.some((l) => l.subtotal === null);
  const total = faltan ? null : lineas.reduce((a, l) => a + l.subtotal, 0);
  return { lineas, costo_unitario: total === null ? null : round0(total), costo_sin_redondear: total, incompleto: faltan };
}

/**
 * partidas: [{codigo, descripcion, unidad, cantidad, estado_revision, cantidad_verificada, apu: codigo}]
 * apus: [{codigo, unidad, insumos}]
 * config: {gastos_generales_pct, utilidades_pct, iva_pct}
 */
export function computeBudget({ partidas, apus, config }) {
  const cfg = { gastos_generales_pct: 0, utilidades_pct: 0, iva_pct: 19, ...config };
  for (const k of ['gastos_generales_pct', 'utilidades_pct', 'iva_pct']) if (!(cfg[k] >= 0 && cfg[k] <= 100)) throw new UserError('DATO_INVALIDO', `${k} debe estar entre 0 y 100.`);
  const apuMap = new Map(apus.map((a) => [a.codigo, a]));
  const bloqueos = [];
  const lineas = partidas.map((p) => {
    const apu = apuMap.get(p.apu);
    const probs = [];
    let pu = null;
    if (!p.apu || !apu) probs.push(`Partida ${p.codigo}: sin APU asociado.`);
    else {
      probs.push(...validateApu(apu));
      if (apu.unidad !== p.unidad) probs.push(`Partida ${p.codigo}: unidad de partida (${p.unidad}) distinta a la del APU (${apu.unidad}); no se convierte automáticamente.`);
      pu = apuUnitCost(apu).costo_unitario;
    }
    if (p.estado_revision === 'needs_review') probs.push(`Partida ${p.codigo}: cantidad con needs_review.`);
    if (!p.cantidad_verificada) probs.push(`Partida ${p.codigo}: cantidad NO verificada por una persona.`);
    const total = pu === null || probs.some((x) => x.includes('unidad de partida')) ? null : round0(p.cantidad * pu);
    return { codigo: p.codigo, descripcion: p.descripcion, unidad: p.unidad, cantidad: p.cantidad, apu: p.apu, precio_unitario: pu, total, problemas: probs };
  });
  const incompleto = lineas.some((l) => l.total === null);
  const directo = lineas.reduce((a, l) => a + (l.total || 0), 0);
  const gg = round0(directo * cfg.gastos_generales_pct / 100);
  const ut = round0(directo * cfg.utilidades_pct / 100);
  const neto = directo + gg + ut;
  const iva = round0(neto * cfg.iva_pct / 100);
  const total = neto + iva;
  for (const l of lineas) bloqueos.push(...l.problemas);
  return {
    config: cfg, lineas, costo_directo: directo, gastos_generales: gg, utilidades: ut, neto, iva, total,
    moneda: 'CLP', redondeo: 'Cada precio unitario y cada total de partida, GG, utilidades e IVA se redondean a peso entero (ROUND, mitad hacia arriba).',
    parcial: incompleto, bloqueos: [...new Set(bloqueos)],
    estado_final_posible: bloqueos.length === 0 && partidas.length > 0,
  };
}
