// Contrato de cantidades del motor de planos (revisión PR #33, ítem 5; requisito previo de PL-09).
// Un consumidor (partidas, APU, presupuesto) SOLO suma filas de DETALLE. Los TOTALES son de control y lectura:
// nunca se suman con el detalle ni entre sí. Sumar un total, o mezclar unidades o naturalezas, lanza error.
export const ESQUEMA_CANTIDADES = 'tw.cantidades/1';

/** Documento consumible: { schema, modelo_sha256, revision, detalle[], totales[] }. */
export function documentoCantidades(model, { modelo_sha256, revision }) {
  const detalle = model.quantities || []; const totales = model.quantity_totals || [];
  if (detalle.some((f) => f.fila !== 'detalle') || totales.some((f) => f.fila !== 'total')) throw new Error('Contrato de cantidades: filas mal clasificadas (detalle/total).');
  return { schema: ESQUEMA_CANTIDADES, modelo_sha256, revision, regla: 'Sume solo «detalle» por partida; «totales» es de control (= suma del detalle) y no se vuelve a sumar. Solo filas TRAZADA (elemento físico declarado) o DECLARADA (con origen) son presupuestables; NEEDS_REVIEW es lectura exploratoria.', apto_presupuesto: detalle.every((f) => f.estado !== 'NEEDS_REVIEW'), detalle, totales };
}

/** Cantidad de una partida para presupuestar: suma del detalle, con verificación cruzada contra el total de control. */
export function cantidadPartida(doc, partida) {
  if (doc?.schema !== ESQUEMA_CANTIDADES) throw new Error(`Se esperaba ${ESQUEMA_CANTIDADES}.`);
  const filas = doc.detalle.filter((f) => f.partida === partida);
  if (!filas.length) throw new Error(`Partida «${partida}» sin detalle.`);
  if (filas.some((f) => f.fila !== 'detalle')) throw new Error('Solo se suman filas de detalle.');
  // R-01: una cantidad medida sin identidad física declarada es lectura exploratoria; no entra a partidas ni presupuesto.
  const sinTraza = filas.filter((f) => f.estado === 'NEEDS_REVIEW');
  if (sinTraza.length) throw Object.assign(new Error(`Partida «${partida}»: ${sinTraza.map((f) => f.id).join(', ')} sin identidad física declarada (NEEDS_REVIEW). Vincule cada medición a un elemento físico (fuentes/representaciones) antes de presupuestar.`), { code: 'PROCEDENCIA_NO_AUTORIZADA' });
  const unidades = [...new Set(filas.map((f) => f.unidad))]; if (unidades.length !== 1) throw new Error(`Partida «${partida}»: unidades mezcladas ${unidades.join(', ')}.`);
  const naturalezas = [...new Set(filas.map((f) => (f.metodo === 'DECLARADA' ? 'DECLARADA' : 'MEDIDA')))]; if (naturalezas.length !== 1) throw new Error(`Partida «${partida}»: mezcla medido y declarado.`);
  const valor = filas.reduce((t, f) => t + f.valor, 0);
  const control = doc.totales.find((t) => t.partida === partida);
  if (control && Math.abs(control.valor - valor) > 1e-9 * Math.max(1, Math.abs(valor))) throw new Error(`Partida «${partida}»: el detalle (${valor}) no coincide con su total de control (${control.valor}).`);
  return { partida, valor, unidad: unidades[0], naturaleza: naturalezas[0], filas: filas.map((f) => f.id), modelo_sha256: doc.modelo_sha256, revision: doc.revision };
}
