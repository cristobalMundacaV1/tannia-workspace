// Explicación ÚNICA de una partida: la misma para la ventana de verificación, el Excel y el PDF. Separa cálculo, origen de
// los datos, alcance, supuestos y advertencias; no repite el cálculo dentro de los supuestos y no atribuye género a la persona.
const n = (x) => Number(x).toLocaleString('es-CL', { maximumFractionDigits: 3 });

/** Clasifica el origen: geometrico (medida desde archivo), manual (dato informado), mixto. */
export function tipoOrigen(p) {
  if (p.regla === 'manual') return 'manual';
  if (String(p.regla || '').startsWith('metodo:')) {
    const o = new Set((p.entradas || []).filter((e) => e.unidad).map((e) => e.origen));
    if (o.has('medido') && [...o].some((x) => x !== 'medido')) return 'mixto';
    return o.has('medido') ? 'geometrico' : 'manual';
  }
  return p.fuente?.archivo ? 'geometrico' : 'manual';
}

export function explicarPartida(p) {
  const tipo = tipoOrigen(p);
  const calculo = []; let alcance = null;
  const d = p.datos_metodo;
  if (p.metodo?.id === 'MC01-muro-area-neta' && d) {
    const caras = d.caras ?? 1; const L = d.tramos.reduce((s, t) => s + t.longitud_m, 0); const bruto = L * d.altura.valor_m;
    calculo.push(`Superficie del muro: ${d.tramos.map((t) => n(t.longitud_m)).join(' m + ')} m × ${n(d.altura.valor_m)} m = ${n(bruto)} m²${caras === 2 ? ' por cara' : ''}.`);
    const vanos = d.vanos || []; const desc = p.desglose?.vanos_descontados ?? vanos.length;
    for (const v of vanos) calculo.push(`Descuento por ${v.descripcion || 'vano'}: ${n(v.ancho_m)} m × ${n(v.alto_m)} m = ${n(v.ancho_m * v.alto_m)} m².`);
    const ded = p.desglose?.deducciones_por_cara_m2 ?? 0;
    calculo.push(`Superficie neta: ${caras === 2 ? '2 × (' : ''}${n(bruto)} − ${n(ded)}${caras === 2 ? ')' : ''} = ${n(p.cantidad)} m².`);
    alcance = vanos.length
      ? `Se descontaron ${desc === vanos.length ? 'los vanos informados' : `${desc} de ${vanos.length} vanos informados (según la política de descuento)`}. No se comprobó en el plano si existen otros vanos.`
      : 'No se informaron vanos; no se comprobó en el plano si existen.';
  } else if (p.metodo && p.formula) calculo.push(`Cálculo: ${p.formula}`);
  else if (tipo === 'manual') calculo.push(`Cantidad ingresada: ${n(p.cantidad)} ${p.unidad}.`);
  else calculo.push(`Cálculo: ${p.formula || p.regla}${p.fuente?.capas?.length ? ` (capas ${p.fuente.capas.join(', ')})` : ''}.`);
  const origen = tipo === 'manual' ? 'Medidas proporcionadas en la conversación; no medidas en el plano.'
    : tipo === 'geometrico' ? `Medida desde la geometría de «${p.fuente?.archivo || 'archivo no indicado'}».`
      : 'Algunas medidas provienen del plano y otras fueron proporcionadas en la conversación.';
  const advertencias = [...(p.advertencias || [])];
  if (tipo !== 'geometrico' && !advertencias.some((a) => /trazabilidad geom/i.test(a))) advertencias.push('Cantidad no comprobada en el plano (sin trazabilidad geométrica).');
  return { tipo_origen: tipo, calculo, origen, alcance, supuestos: (p.supuestos || []).filter((s) => !/^Cantidad ingresada/.test(s)), advertencias, limites: p.exclusiones || [] };
}

/** Texto plano (ventana / celdas). */
export function textoExplicacion(p, e = explicarPartida(p)) {
  return [...e.calculo, `Origen: ${e.origen}`, ...(e.alcance ? [`Alcance: ${e.alcance}`] : [])].join('\n');
}
