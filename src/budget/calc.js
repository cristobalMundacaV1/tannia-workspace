// Cálculo de APU y presupuesto en CLP. Reglas de redondeo EXPLÍCITAS e idénticas a las fórmulas del XLSX.
import { UserError } from '../mcp/util.js';

/** ROUND(x,0) de Excel: la mitad se aleja de cero (tolerancia 1e-9 para ruido binario). */
export function round0(x) {
  const sgn = x < 0 ? -1 : 1;
  return sgn * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}
/**
 * POLÍTICA ECONÓMICA ÚNICA (auditoría 2026-11-17, hallazgo B): todas las rutas de presupuesto (computeBudget, bud.rollup del CIC
 * y las fórmulas del XLSX) usan exactamente estas reglas. Porcentajes en escala 0–100.
 *   PU = ROUND(pu, 0); subtotal = ROUND(cantidad × PU, 0); CD = Σ subtotales;
 *   GG = ROUND(CD × gg/100); U = ROUND(CD × u/100); Neto = CD + GG + U; IVA = ROUND(Neto × iva/100); Total = Neto + IVA.
 */
export const POLITICA_REDONDEO = 'Cada precio unitario y cada total de partida, GG, utilidades e IVA se redondean a peso entero (ROUND, mitad hacia arriba).';
export const subtotalPartida = (cantidad, pu) => round0(cantidad * round0(pu));
export function rubros(costoDirecto, { gastos_generales_pct: gg, utilidades_pct: ut, iva_pct: iva }) {
  const g = round0(costoDirecto * gg / 100); const u = round0(costoDirecto * ut / 100); const neto = costoDirecto + g + u; const i = round0(neto * iva / 100);
  return { costo_directo: costoDirecto, gastos_generales: g, utilidades: u, neto, iva: i, total: neto + i };
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
  // Política económica EXPLÍCITA (Astra A-04/E16): un parámetro no indicado es DESCONOCIDO (null), nunca 0 ni 19 implícitos.
  // Se calcula un total parcial con 0 para mostrar el avance, pero el presupuesto no puede quedar en estado final.
  const PARAM = { gastos_generales_pct: 'gastos generales', utilidades_pct: 'utilidades', iva_pct: 'IVA' };
  const cfg = {}; const noDefinidos = [];
  for (const k of Object.keys(PARAM)) {
    const v = config?.[k];
    if (v === undefined || v === null) { cfg[k] = null; noDefinidos.push(k); continue; }
    if (!(typeof v === 'number' && v >= 0 && v <= 100)) throw new UserError('DATO_INVALIDO', `${k} debe estar entre 0 y 100.`);
    cfg[k] = v;
  }
  const pct = (k) => cfg[k] ?? 0;
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
    const total = pu === null || probs.some((x) => x.includes('unidad de partida')) ? null : subtotalPartida(p.cantidad, pu);
    return { codigo: p.codigo, descripcion: p.descripcion, unidad: p.unidad, cantidad: p.cantidad, apu: p.apu, precio_unitario: pu, total, problemas: probs };
  });
  const incompleto = lineas.some((l) => l.total === null);
  const directo = lineas.reduce((a, l) => a + (l.total || 0), 0);
  const R = rubros(directo, { gastos_generales_pct: pct('gastos_generales_pct'), utilidades_pct: pct('utilidades_pct'), iva_pct: pct('iva_pct') });
  const { gastos_generales: gg, utilidades: ut, neto, iva, total } = R;
  // Alcance y vigencia (UAT-02): un presupuesto de una parte de la obra no es el costo total; un precio antiguo no es vigente.
  const alcance = ['completo', 'parcial'].includes(config?.alcance) ? config.alcance : 'no_declarado';
  const alcanceTxt = typeof config?.alcance_descripcion === 'string' && config.alcance_descripcion.trim() ? config.alcance_descripcion.trim().slice(0, 200) : null;
  const etiqueta_total = alcance === 'parcial' ? `PRESUPUESTO PARCIAL${alcanceTxt ? ` (${alcanceTxt})` : ''}: no es el costo total de la obra` : 'TOTAL';
  const advertencias = [];
  if (alcance === 'no_declarado') advertencias.push('Alcance del presupuesto no declarado: indique si cubre la obra completa o solo una parte.');
  const ref = Date.parse(config?.fecha_referencia_precios || '') || Date.now(); const MESES = 12;
  for (const a of apus) for (const i of a.insumos || []) {
    const t = Date.parse(i.fecha_precio || ''); if (!Number.isFinite(t)) { if (i.precio_unitario != null && i.fecha_precio) advertencias.push(`APU ${a.codigo}/${i.descripcion}: fecha de precio no reconocible («${i.fecha_precio}»); no se puede juzgar su vigencia.`); continue; }
    const meses = (ref - t) / (30.44 * 86400000);
    if (meses > MESES) advertencias.push(`APU ${a.codigo}/${i.descripcion}: precio de ${i.fecha_precio} (${Math.floor(meses / 12)} año(s) y ${Math.floor(meses % 12)} mes(es) de antigüedad). No es un precio vigente: actualícelo o declare un reajuste con su índice y fuente.`);
  }
  for (const k of noDefinidos) bloqueos.push(`Parámetro económico no definido: ${PARAM[k]} (%). Indíquelo explícitamente (0 es válido si así se decide); no se supone.`);
  for (const l of lineas) bloqueos.push(...l.problemas);
  return {
    config: cfg, lineas, costo_directo: directo, gastos_generales: gg, utilidades: ut, neto, iva, total,
    moneda: 'CLP', redondeo: POLITICA_REDONDEO,
    alcance, alcance_descripcion: alcanceTxt, etiqueta_total, advertencias: [...new Set(advertencias)],
    parametros_no_definidos: noDefinidos, parcial: incompleto || noDefinidos.length > 0, bloqueos: [...new Set(bloqueos)],
    estado_final_posible: bloqueos.length === 0 && partidas.length > 0,
  };
}
