// Respuestas compactas e interpretadas de la evaluación (F01/F04/F05): el modelo y la usuaria reciben cifras con unidad, fórmula, lectura
// correcta y límites, sin depender de que un JSON enorme sobreviva al recorte del texto. Nada aquí calcula: solo presenta lo ya calculado.

export const ACCIONES = {
  piscina_barrera: 'Pedir a la arquitecta/o definir barreras independientes, control de acceso y supervisión conforme a la normativa vigente (no inferida aquí). Mientras tanto, no presentar la piscina como segura.',
  puerta_directa: 'Definir con la arquitecta/o un control de acceso a la zona de piscina para esa puerta (o reubicar el acceso). No declarar seguridad demostrada.',
  una_salida: 'Revisar con la arquitecta/o las rutas de evacuación y la cantidad de salidas exigibles en el contexto del proyecto.',
  planta_irregular: 'Pedir al ingeniero estructural que revise la regularidad de la planta (esquinas entrantes); el código no afirma nada sobre comportamiento sísmico.',
  patio_interior: 'Revisar con la arquitecta/o la cubierta y los desagües perimetrales del patio interior.',
  priv: 'Revisar con la arquitecta/o la ubicación o el tratamiento de esa ventana (privacidad); es una heurística geométrica editable.',
  sitio_insuficiente: 'Entregar norte verdadero confirmado, coordenadas y zona horaria (tannia_arq_sitio) para habilitar el estudio solar.',
  sin_clima: 'Cargar un archivo de clima (.epw) con tannia_arq_clima para evaluar viento regional.',
};
export const accionDe = (id) => ACCIONES[id] ?? ACCIONES[String(id).replace(/_.*$/, '')] ?? (/^puerta_directa_/.test(id) ? ACCIONES.puerta_directa : /^priv_/.test(id) ? ACCIONES.priv : 'Revisar con la profesional responsable.');

export const INTERPRETACION = {
  circulacion_pct: { unidad: '%', formula: 'circulación % = superficie neta de los recintos de circulación (pasillos) ÷ superficie útil neta × 100', lectura: 'Parte de la superficie útil ocupada por pasillos. Menos no es necesariamente mejor: puede costar privacidad o separación de zonas.', limites: 'Geométrico; no mide flujo real de personas ni accesibilidad normativa.' },
  indice_envolvente: { unidad: 'sin unidad (1,00 = cuadrado)', formula: 'índice de envolvente = perímetro exterior de muros ÷ (4·√área de huella)', lectura: 'Compara cuánto perímetro exterior tiene la planta frente a un cuadrado de igual área. 1,35 significa 35 % MÁS PERÍMETRO de muro exterior que un cuadrado; NO significa 35 % más costo.', limites: 'Índice geométrico relativo; el costo depende de materiales, cubierta, terreno y precios que no se estiman (no hay presupuesto).' },
  ventilacion_potencial: { unidad: 'fracción 0–1', formula: 'fracción de dormitorios y living con ventanas en al menos dos fachadas', lectura: 'Potencial GEOMÉTRICO de ventilación cruzada/en esquina. Un 0 no demuestra falta de ventilación: no se modelan ventanas practicables, caudales ni viento local.', limites: 'Sin CFD ni cálculo de renovaciones de aire.' },
  abrigo_patio_viento: { unidad: 'fracción 0–1', formula: 'frecuencia del viento regional (rosa de la estación) cuyo rumbo de origen queda bloqueado por la edificación desde el centro del patio', lectura: 'Índice geométrico de abrigo frente al viento REGIONAL.', limites: 'No estima velocidad ni turbulencia dentro del patio.' },
  sol_directo_invierno: { unidad: 'horas·ventana', formula: 'suma de horas de sol directo geométrico sobre todas las ventanas exteriores (ray casting, paso de muestreo declarado)', lectura: 'Horas con el sol visible desde el centro de cada vano.', limites: 'No es iluminancia, deslumbramiento, ganancia térmica ni energía.' },
  sol_directo_verano: { unidad: 'horas·ventana', formula: 'ídem invierno, para el solsticio de verano', lectura: 'Horas con el sol visible desde el centro de cada vano.', limites: 'No es iluminancia, deslumbramiento, ganancia térmica ni energía.' },
  privacidad_hallazgos: { unidad: 'hallazgos', formula: 'conteo de ventanas enfrentadas y de ventanas de zona privada cercanas a deslindes/vecinos (si hay sitio)', lectura: 'Cantidad de situaciones de posible falta de privacidad detectadas con umbrales heurísticos editables.', limites: 'No considera cortinas, vegetación ni usos culturales.' },
  superficie_huella_m2: { unidad: 'm²', formula: 'área de la unión de polígonos de muros y recintos', lectura: 'Superficie en planta de la huella (no la caja envolvente).', limites: 'No es superficie edificada legal.' },
  superficie_util_m2: { unidad: 'm²', formula: 'suma de superficies netas de recintos', lectura: 'Superficie interior neta.', limites: 'No es superficie útil legal.' },
};
export const INDICE_OBJETIVO = 'Índice 0–1 de cumplimiento geométrico/heurístico del objetivo con el partido actual. No es un porcentaje de satisfacción de la usuaria ni una nota de calidad; null = no evaluado.';
export const AVISO_VISUAL = 'La visual hacia la piscina NO significa seguridad infantil: requiere barreras independientes, control de acceso y supervisión activa verificadas por profesional. Sin un punto de observación confirmado, la visual es solo geométrica PRELIMINAR (no refleja el lugar real de trabajo ni el mobiliario).';

export const SECCIONES = ['resumen', 'objetivos', 'alertas', 'circulacion', 'sol', 'viento', 'visuales', 'privacidad', 'seguridad', 'constructibilidad', 'requisitos', 'metricas', 'critica', 'completo'];

const corto = (s, n = 110) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const num = (v) => (v == null ? '—' : String(v).replace('.', ','));

function objetivoCompacto(o) { return { id: o.id, objetivo: o.kind, prioridad: o.prioridad, estado: o.estado, indice: o.score, resumen: corto(o.evidencia?.[0] ?? o.razon ?? o.aviso ?? '', o.kind === 'sightline' ? 230 : 100) }; }
function alertaCompleta(a) { return { codigo: a.id, severidad: a.severidad, texto: a.texto, accion_recomendada: a.accion ?? accionDe(a.id) }; }

/** Resumen por defecto: lo imprescindible, siempre completo (alertas críticas exactas, circulación m²/%, índice de envolvente, objetivos). */
export function resumenEvaluacion(e, ctx) {
  const rec = e.detalle.recorridos; const con = e.detalle.constructibilidad; const crit = e.analisis.alerts.filter((a) => a.severidad === 'critica');
  const sev = {}; for (const a of e.analisis.alerts) sev[a.severidad] = (sev[a.severidad] ?? 0) + 1;
  const falla = e.analisis.hard_gates.filter((g) => !g.passed);
  return {
    seccion: 'resumen', ...ctx, estado_global: e.analisis.global_state,
    aviso: 'ANTEPROYECTO conceptual: no apto para construcción; sin verificación normativa ni revisión profesional. Cifras geométricas/heurísticas.',
    requisitos_duros: { cumplidos: e.analisis.hard_gates.filter((g) => g.passed).map((g) => g.id), no_cumplidos: falla.map((g) => ({ id: g.id, detalle: g.detalle })) },
    alertas_criticas: crit.map(alertaCompleta), alertas_por_severidad: sev,
    circulacion: { superficie_m2: rec.superficie_circulacion_m2, porcentaje_de_superficie_util: rec.circulacion_pct, formula: INTERPRETACION.circulacion_pct.formula, lectura: INTERPRETACION.circulacion_pct.lectura, limites: INTERPRETACION.circulacion_pct.limites },
    huella_m2: e.detalle.constructibilidad.area_huella_m2, util_m2: e.analisis.metrics.find((m) => m.id === 'superficie_util_m2')?.valor ?? null,
    indice_envolvente: { valor: con.indice_envolvente, formula: INTERPRETACION.indice_envolvente.formula, lectura: INTERPRETACION.indice_envolvente.lectura, limites: INTERPRETACION.indice_envolvente.limites },
    objetivos: e.objetivos.map(objetivoCompacto), escala_indice_objetivos: INDICE_OBJETIVO,
    no_evaluado: e.objetivos.filter((o) => o.estado === 'no_evaluado').map((o) => ({ objetivo: o.kind, razon: corto(o.razon, 140) })),
    como_ver_mas: `Pida una sección con tannia_arq_evaluar (seccion): ${SECCIONES.filter((s) => s !== 'resumen').join(', ')}.`,
  };
}

export function textoResumen(r) {
  const L = [`Evaluación de ${r.alternativa} (${r.version}) — estado global: ${r.estado_global}.`];
  if (r.requisitos_duros.no_cumplidos.length) L.push(`Requisitos duros NO cumplidos: ${r.requisitos_duros.no_cumplidos.map((g) => g.id).join(', ')}.`);
  L.push(r.alertas_criticas.length ? `ALERTAS CRÍTICAS (${r.alertas_criticas.length}):\n${r.alertas_criticas.map((a) => `• [${a.codigo}] ${a.texto} → Acción: ${a.accion_recomendada}`).join('\n')}` : 'Sin alertas críticas detectadas (no es una garantía).');
  L.push(`Circulación: ${num(r.circulacion.superficie_m2)} m² = ${num(r.circulacion.porcentaje_de_superficie_util)} % de la superficie útil (${r.circulacion.formula}).`);
  L.push(`Índice de envolvente: ${num(r.indice_envolvente.valor)} (${r.indice_envolvente.formula}). ${r.indice_envolvente.lectura}`);
  L.push(`Huella ${num(r.huella_m2)} m² · útil ${num(r.util_m2)} m².`);
  L.push(`Objetivos (índice 0–1; sin índice = no evaluado):\n${r.objetivos.map((o) => `• ${o.objetivo} [${o.prioridad}]: ${o.estado}${o.indice != null ? `, índice ${num(o.indice)}` : ''}${o.resumen ? ` — ${o.resumen}` : ''}`).join('\n')}`);
  if (r.objetivos.some((o) => o.objetivo === 'sightline')) L.push(AVISO_VISUAL);
  L.push(r.como_ver_mas);
  return L.join('\n');
}

export function seccionEvaluacion(e, ctx, seccion, critica) {
  const base = { seccion, ...ctx }; const d = e.detalle;
  switch (seccion) {
    case 'objetivos': return { ...base, escala_indice: INDICE_OBJETIVO, objetivos: e.objetivos.map((o) => ({ id: o.id, objetivo: o.kind, prioridad: o.prioridad, peso: o.peso, estado: o.estado, indice: o.score, evidencia: o.evidencia, razon: o.razon, aviso: o.aviso })), ...(e.objetivos.some((o) => o.kind === 'sightline') ? { aviso_visual: AVISO_VISUAL } : {}) };
    case 'alertas': return { ...base, alertas: e.analisis.alerts.map(alertaCompleta), nota: 'No se afirma cumplimiento normativo; las acciones son recomendaciones para la profesional.' };
    case 'circulacion': { const r = d.recorridos; return { ...base, superficie_circulacion_m2: r.superficie_circulacion_m2, porcentaje_de_superficie_util: r.circulacion_pct, formula: INTERPRETACION.circulacion_pct.formula, lectura: INTERPRETACION.circulacion_pct.lectura, cocina_a_living: r.cocina_a_living, distancias_desde_el_acceso_m: Object.fromEntries(Object.entries(r.desde_acceso).map(([k, v]) => [k, v.distancia_m])), trayectos_dormitorio_bano_que_cruzan_zona_social: r.cruces_por_zona_social.map((c) => `${c.dormitorio}→${c.bano}`), salidas_exteriores: r.salidas_exteriores, recintos_sin_ruta: r.recintos_sin_ruta, limites: r.limites }; }
    case 'sol': return { ...base, calculo: d.sol ? { verano: solRes(d.sol.verano), invierno: solRes(d.sol.invierno) } : { estado: 'no_concluyente', razon: 'Falta norte verdadero, coordenadas y/o zona horaria confirmados: no se afirma ninguna hora de sol.' }, ...INTERP_BREVE('sol_directo_invierno') };
    case 'viento': return { ...base, abrigo_patio: d.viento.abrigo, ventilacion_potencial: { ...d.viento.ventilacion, interpretacion: INTERPRETACION.ventilacion_potencial.lectura } };
    case 'visuales': return { ...base, visuales: d.visuales ?? [], aviso_seguridad: AVISO_VISUAL };
    case 'privacidad': return { ...base, ...d.privacidad, lectura: INTERPRETACION.privacidad_hallazgos.lectura };
    case 'seguridad': return { ...base, ...d.seguridad, aviso_visual: AVISO_VISUAL, alertas: d.seguridad.alertas.map(alertaCompleta) };
    case 'constructibilidad': return { ...base, ...d.constructibilidad, formula_indice: INTERPRETACION.indice_envolvente.formula, lectura_indice: INTERPRETACION.indice_envolvente.lectura };
    case 'requisitos': return { ...base, requisitos: e.analisis.hard_gates };
    case 'metricas': return { ...base, metricas: e.analisis.metrics.map((m) => ({ id: m.id, familia: m.familia, estado: m.estado, valor: m.valor, unidad: m.unidad ?? INTERPRETACION[m.id]?.unidad ?? null, formula: INTERPRETACION[m.id]?.formula ?? m.metodo, lectura: INTERPRETACION[m.id]?.lectura ?? null, limites: INTERPRETACION[m.id]?.limites ?? m.limites, razon: m.razon ?? null })) };
    case 'critica': return { ...base, critica };
    default: return null;
  }
}
const INTERP_BREVE = (id) => ({ formula: INTERPRETACION[id].formula, limites: INTERPRETACION[id].limites });
function solRes(s) { return s ? { estado: s.estado, fecha: s.fecha ?? null, ventanas: s.ventanas?.map((v) => ({ id: v.id, recinto: v.recinto, lado: v.lado, horas_sol_directo: v.horas_sol_directo })), razon: s.razon ?? s.razon_contexto ?? null, limites: s.limites ?? null } : null; }
