// Evaluador crítico: requisitos DUROS (bloquean), objetivos BLANDOS con evidencia (o "no evaluado"), alertas, estado global honesto,
// frontera de Pareto, sensibilidad a prioridades, contrafactuales y bitácora de decisiones. Ningún número proviene del texto de un modelo.
import crypto from 'node:crypto';
import { SCHEMA_IDS, validar } from './schemas.js';
import { recorridos, visual, seguridad, privacidad, constructibilidad, UMBRALES } from './habitabilidad.js';
import { horasSolVentanas, sitioApto, escena, rayoGolpea } from './sombras.js';
import { verificarContraSitio, retranqueosParaGenerar } from './sitio.js';
import { SECTORES_VIENTO } from './clima.js';
import { VERSION_MOTOR } from './version.js';
import { bbox } from './poligonos.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)); const R2 = (v) => Math.round(v * 100) / 100;
export const hashEntrada = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
export const PESO = { high: 3, medium: 2, low: 1 };
const DISCLAIMERS = ['ANTEPROYECTO conceptual: no apto para construcción ni para tramitación.', 'No acredita cumplimiento normativo (OGUC/RT/IPT), estructura, instalaciones ni seguridad.', 'Los resultados son geométricos/heurísticos; la decisión y la responsabilidad son de la profesional habilitada.'];

// ---------- viento: abrigo del patio y potencial de ventilación (SIN CFD) ----------
export function abrigoPatio({ esq, geo, sitio, perfil, estacionNombre = 'invierno', radio_mm = 15000 }) {
  const patio = esq.exterior_areas.find((e) => e.id === 'patio' && e.ring); if (!patio) return { estado: 'no_aplica', razon: 'Sin patio.' };
  const norte = sitio?.true_north_deg_from_local_plus_y_clockwise; if (!perfil || !norte || norte.estado !== 'confirmed') return { estado: 'no_concluyente', razon: 'Falta clima cargado y/o norte verdadero confirmado.' };
  const rosa = perfil.estaciones[estacionNombre]?.viento?.rosa; if (!rosa) return { estado: 'no_concluyente', razon: 'El clima no trae viento para esa estación.' };
  const b = bbox([patio.ring]); const c = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 1500]; const e = escena(esq, geo, {});
  let abrigo = 0; let total = 0; const porSector = [];
  for (let i = 0; i < 16; i++) {
    const f = rosa[i].frecuencia ?? 0; if (!f) continue; const origen = i * 22.5; // el viento viene DESDE este rumbo geográfico
    const local = ((origen + norte.valor) % 360) * (Math.PI / 180); const dir = [Math.sin(local), Math.cos(local), 0];
    const hit = rayoGolpea(c, dir, e.cajas, { tmax: radio_mm }); total += f; if (hit) abrigo += f; porSector.push({ sector: SECTORES_VIENTO[i], frecuencia: f, protegido: !!hit });
  }
  return { estado: 'calculado', indice_abrigo: total ? R2(abrigo / total) : null, estacion: estacionNombre, sectores: porSector, metodo: 'rayos horizontales desde el centro del patio hacia el rumbo de origen del viento regional', limites: 'Índice geométrico con viento REGIONAL: no estima velocidad dentro del patio ni turbulencia (sin CFD).' };
}
export function ventilacionPotencial({ esq, geo }) {
  const por = {}; for (const a of geo.aberturas.filter((x) => !x.invalida && x.ext && x.tipo === 'ventana')) { const s = geo.murosSeg.find((q) => q.id === a.segmento); (por[s.recinto] ||= new Set()).add(s.lado); }
  const OPUESTO = { S: 'N', N: 'S', E: 'O', O: 'E' }; const hab = Object.values(geo.recintos).filter((r) => ['dormitorio', 'dormitorio_principal', 'living_comedor'].includes(r.tipo));
  const filas = hab.map((r) => { const l = [...(por[r.id] ?? [])]; const cruzada = l.some((x) => l.includes(OPUESTO[x])); return { recinto: r.id, fachadas_con_ventana: l, potencial: cruzada ? 'cruzada' : l.length >= 2 ? 'en_esquina' : l.length === 1 ? 'unilateral' : 'sin_ventana' }; });
  return { recintos: filas, fraccion_con_ventilacion_cruzada_o_esquina: R2(filas.filter((f) => f.potencial === 'cruzada' || f.potencial === 'en_esquina').length / Math.max(1, filas.length)), limites: 'Potencial GEOMÉTRICO (ventanas en distintas fachadas, supuestas practicables); no calcula caudales ni renovaciones de aire.' };
}

// ---------- evaluación ----------
function ventanasRecinto(geo, id) { return geo.aberturas.filter((a) => !a.invalida && a.ext && a.tipo === 'ventana' && geo.murosSeg.find((s) => s.id === a.segmento).recinto === id); }
function adyacentes(geo, a, b) { return geo.murosSeg.some((s) => s.tipo === 'int' && s.entre.includes(a) && s.entre.includes(b)) || geo.segmentos.some((s) => s.tipo === 'int' && s.abierta && s.entre.includes(a) && s.entre.includes(b)); }

export function evaluarEsquema({ esq, geo, brief = null, sitio = null, perfil = null, aleros = [], fechas = null }) {
  const hash = hashEntrada({ esq, brief: brief?.version ?? null, sitio: sitio ? { c: sitio.coordinates, n: sitio.true_north_deg_from_local_plus_y_clockwise, p: sitio.parcel_polygon_mm, o: sitio.context_obstacles } : null, perfil: perfil?.estaciones ? 'clima' : null, aleros, v: VERSION_MOTOR });
  const rec = recorridos(esq, geo); const seg = seguridad(esq, geo, { hayPiscina: brief ? brief.program.some((p) => p.id === 'piscina') || undefined : undefined }); const priv = privacidad(esq, geo, { sitio }); const con = constructibilidad(esq, geo); const vent = ventilacionPotencial({ esq, geo });
  const solarOk = sitio ? sitioApto(sitio).length === 0 : false; const sur = sitio?.coordinates ? sitio.coordinates.lat < 0 : true;
  const fVer = fechas?.verano ?? (sur ? '2026-12-21' : '2026-06-21'); const fInv = fechas?.invierno ?? (sur ? '2026-06-21' : '2026-12-21');
  const sol = solarOk ? { verano: horasSolVentanas({ esq, geo, sitio, fecha: fVer, aleros }), invierno: horasSolVentanas({ esq, geo, sitio, fecha: fInv, aleros }) } : null;
  const metricas = []; const M = (m) => metricas.push({ valor: null, ...m });
  M({ id: 'superficie_huella_m2', familia: 'superficie', estado: 'computed', valor: geo.huella.area_m2, unidad: 'm²', metodo: 'área de la unión de polígonos (no caja envolvente)', limites: 'No es superficie edificada legal.' });
  M({ id: 'superficie_util_m2', familia: 'superficie', estado: 'computed', valor: geo.areas.util_neta_m2, unidad: 'm²', metodo: 'suma de recintos netos', limites: 'No es superficie útil legal.' });
  M({ id: 'circulacion_pct', familia: 'recorridos', estado: 'computed', valor: rec.circulacion_pct, unidad: '%', metodo: rec.metodo, limites: rec.limites });
  M({ id: 'indice_envolvente', familia: 'economia_relativa', estado: 'computed', valor: con.indice_envolvente, metodo: 'perímetro exterior / perímetro de cuadrado equivalente', limites: con.limites });
  M({ id: 'precio_clp', familia: 'economia_relativa', estado: 'not_evaluated', metodo: 'sin partidas', limites: con.precio.razon, razon: con.precio.razon });
  M({ id: 'ventilacion_potencial', familia: 'viento', estado: 'computed', valor: vent.fraccion_con_ventilacion_cruzada_o_esquina, metodo: 'ventanas en fachadas distintas', limites: vent.limites });
  for (const [k, n] of [['verano', fVer], ['invierno', fInv]]) { const s = sol?.[k]; if (s && s.estado !== 'no_concluyente') M({ id: `sol_directo_${k}`, familia: 'sol', estado: s.estado === 'calculado' ? 'computed' : 'inconclusive', valor: s.estado === 'calculado' ? R2(s.ventanas.reduce((a, v) => a + v.horas_sol_directo, 0)) : null, unidad: 'h·ventana', detalle: n, metodo: s.metodo, limites: s.limites, ...(s.estado !== 'calculado' ? { razon: (s.razon_contexto ?? [s.estado]).join(' ') } : {}) }); else M({ id: `sol_directo_${k}`, familia: 'sol', estado: 'blocked', metodo: 'ray casting', limites: 'Sol directo geométrico.', razon: s?.razon ?? 'Falta norte verdadero, coordenadas y/o zona horaria confirmados: no se afirma ninguna hora de sol.' }); }
  const abrigo = abrigoPatio({ esq, geo, sitio, perfil });
  M({ id: 'abrigo_patio_viento', familia: 'viento', estado: abrigo.estado === 'calculado' ? 'computed' : abrigo.estado === 'no_aplica' ? 'not_evaluated' : 'blocked', valor: abrigo.estado === 'calculado' ? abrigo.indice_abrigo : null, metodo: 'rayos hacia el rumbo del viento regional', limites: abrigo.limites ?? 'Viento regional; sin CFD.', ...(abrigo.razon ? { razon: abrigo.razon } : {}) });
  const vis = (brief?.objectives ?? []).filter((o) => o.kind === 'sightline').map((o) => ({ o, r: visual(esq, geo, { desde: o.from, hacia: o.to, sitio }) }));
  for (const { o, r } of vis) M({ id: `visual_${o.from}_${o.to}`, familia: 'visuales', estado: r.estado === 'no_evaluado' ? 'not_evaluated' : 'computed', valor: r.estado === 'no_evaluado' ? null : r.fraccion_visible_mejor_punto, metodo: 'ray casting ojo→rejilla objetivo', limites: r.limites ?? 'Visual geométrica.', ...(r.razon ? { razon: r.razon } : {}), detalle: r.estado });
  M({ id: 'privacidad_hallazgos', familia: 'privacidad', estado: 'computed', valor: priv.hallazgos.length, metodo: 'ventanas enfrentadas y deslindes/vecinos si hay sitio', limites: priv.limites, detalle: priv.privacidad_vecinos === 'no_evaluado' ? 'Solo privacidad interna (sin predio/vecinos).' : undefined });
  M({ id: 'normativa', familia: 'normativa', estado: 'not_evaluated', metodo: 'sin documento fuente', limites: 'El código nunca declara cumplimiento normativo.', razon: 'Requiere CIP/IPT vigente y profesional; no se evalúa.' });

  // ---- requisitos duros ----
  const gates = []; const G = (id, passed, detalle) => gates.push({ id, passed, detalle });
  G('geometria_valida', geo.errores.length === 0, geo.errores.length ? geo.errores.map((e) => e.mensaje).join(' | ') : 'Sin solapes, huecos no declarados, vanos inválidos ni recintos sin acceso.');
  const dura = (k) => brief?.hard_constraints.find((h) => h.kind === k);
  const at = dura('area_target'); if (at) { const dev = (geo.huella.area_m2 - at.value) / at.value; G('superficie_objetivo', Math.abs(dev) <= 0.035, `Huella ${geo.huella.area_m2} m² vs objetivo ${at.value} m² (${R2(dev * 100)} %; tolerancia ±3,5 %).`); }
  const dorm = dura('bedrooms'); if (dorm) { const n = Object.values(geo.recintos).filter((r) => r.tipo === 'dormitorio' || r.tipo === 'dormitorio_principal').length; G('dormitorios', n === dorm.value, `${n} dormitorios (pedidos: ${dorm.value}).`); }
  const bn = dura('bathrooms'); if (bn) { const n = Object.values(geo.recintos).filter((r) => r.tipo === 'bano').length; G('banos', n === bn.value, `${n} baños (pedidos: ${bn.value}).`); }
  const fc = dura('footprint_class'); if (fc) G('clase_de_huella', fc.value === esq.concept, `Partido ${esq.concept} (pedido: ${fc.value}). Informativo: las otras ideas se muestran como contraste y no se bloquean.`);
  if (sitio?.parcel_polygon_mm) { const v = verificarContraSitio(geo, sitio, null).verificaciones.find((x) => x.id === 'encaje'); G('encaje_en_predio', v.estado === 'consistente_con_dato', v.detalle); }
  const bloqueada = gates.some((g) => !g.passed && g.id !== 'clase_de_huella'); // la clase de huella pedida orienta, no bloquea: la usuaria quiere ver alternativas

  // ---- objetivos ----
  const objetivos = [];
  const O = (o, r) => objetivos.push({ id: o.id, kind: o.kind, prioridad: o.priority, peso: PESO[o.priority] ?? 2, score: r.score ?? null, estado: r.estado, evidencia: r.evidencia ?? [], razon: r.razon ?? null, aviso: r.aviso ?? null });
  for (const o of brief?.objectives ?? []) {
    const k = o.kind; const liv = ventanasRecinto(geo, 'R-LIV');
    if (k === 'sightline') { const x = vis.find((v) => v.o === o).r; O(o, x.estado === 'no_evaluado' ? { estado: 'no_evaluado', razon: x.razon } : { estado: 'evaluado', score: x.fraccion_visible_mejor_punto, evidencia: [`visual ${x.estado} (${x.fraccion_visible_mejor_punto})`], aviso: 'La visual no sustituye barreras ni supervisión.' }); }
    else if (k === 'daylight_preference') { const rid = o.target === 'R-LIV' || o.target === 'vivienda' ? 'R-LIV' : o.target; const r = geo.recintos[rid]; if (!r) O(o, { estado: 'no_evaluado', razon: `Recinto ${rid} inexistente.` }); else { const a = ventanasRecinto(geo, rid).reduce((s, v) => s + (v.ancho_mm * v.alto_mm) / 1e6, 0); const rel = a / r.area_neta_m2; O(o, { estado: 'parcial', score: R2(clamp(rel / 0.1)), evidencia: [`relación vano/piso ${R2(rel)} (referencia de práctica 0,10)`], aviso: 'Proxy geométrico: no es iluminancia ni luz natural calculada.' }); } }
    else if (k === 'winter_sun') { if (!sol || sol.invierno.estado === 'no_concluyente') O(o, { estado: 'no_evaluado', razon: 'Falta norte/coordenadas/zona horaria confirmados.' }); else { const h = Math.max(0, ...sol.invierno.ventanas.filter((v) => v.recinto === 'R-LIV').map((v) => v.horas_sol_directo)); O(o, { estado: 'evaluado', score: R2(clamp(h / 6)), evidencia: [`${h} h de sol directo en la mejor ventana del living (invierno)`], aviso: 'Sol directo geométrico; no ganancia térmica.' }); } }
    else if (k === 'summer_cooling') { if (!sol || sol.verano.estado === 'no_concluyente') O(o, { estado: 'no_evaluado', razon: 'Falta norte/coordenadas/zona horaria confirmados.' }); else { const hs = sol.verano.ventanas.filter((v) => v.recinto === 'R-LIV').map((v) => v.horas_sol_directo); const h = hs.length ? Math.max(...hs) : 0; O(o, { estado: 'evaluado', score: R2(clamp(1 - h / 8)), evidencia: [`${h} h de sol directo en la ventana más expuesta del living (verano)`], aviso: 'Sol directo geométrico; no es temperatura interior.' }); } }
    else if (k === 'outdoor_relation') { const patio = esq.exterior_areas.some((e) => e.id === 'patio'); const puerta = esq.openings.some((a) => a.entre.length === 1 && a.entre[0] === o.from && a.tipo === 'puerta' && a.funcion !== 'acceso'); const vent = ventanasRecinto(geo, o.from).length > 0; O(o, { estado: 'evaluado', score: patio && puerta ? 1 : patio && vent ? 0.5 : vent ? 0.25 : 0, evidencia: [patio ? 'hay patio propio' : 'sin patio propio en la huella', puerta ? 'puerta directa desde el living' : 'sin puerta al exterior desde el living'] }); }
    else if (k === 'courtyard') O(o, { estado: 'evaluado', score: esq.exterior_areas.some((e) => e.id === 'patio') ? 1 : 0, evidencia: ['patio incluido en el partido'] });
    else if (k === 'circulation_minimal') O(o, { estado: 'evaluado', score: R2(clamp(1 - (rec.circulacion_pct - 8) / 12)), evidencia: [`circulación ${rec.circulacion_pct} % de la superficie útil`, rec.cruces_por_zona_social.length ? `${rec.cruces_por_zona_social.length} trayecto(s) dormitorio→baño cruzan la zona social` : 'sin cruces por zona social'] });
    else if (k === 'privacy') { const nPriv = Object.values(geo.recintos).filter((r) => r.zona === 'privada').length; O(o, { estado: priv.privacidad_vecinos === 'evaluado' ? 'evaluado' : 'parcial', score: R2(clamp(1 - priv.hallazgos.length / Math.max(1, nPriv))), evidencia: [`${priv.hallazgos.length} hallazgo(s) de privacidad`], ...(priv.privacidad_vecinos === 'no_evaluado' ? { aviso: 'Sin predio/vecinos: solo se evaluó la privacidad interna.' } : {}) }); }
    else if (k === 'cost_saving') O(o, { estado: 'evaluado', score: R2(clamp(1 - (con.indice_envolvente - 1) / 0.5)), evidencia: [`índice de envolvente ${con.indice_envolvente}`, `${con.esquinas_entrantes} esquina(s) entrante(s)`], aviso: 'Índice relativo: no hay precios ni presupuesto.' });
    else if (k === 'wind_shelter') O(o, abrigo.estado === 'calculado' ? { estado: 'evaluado', score: abrigo.indice_abrigo, evidencia: [`abrigo del patio ${abrigo.indice_abrigo} frente al viento regional de ${abrigo.estacion}`], aviso: abrigo.limites } : { estado: 'no_evaluado', razon: abrigo.razon ?? 'Sin patio.' });
    else if (k === 'adjacency') { const d = adyacentes(geo, o.from, o.to); const p = rec.cocina_a_living; O(o, { estado: 'evaluado', score: d ? 1 : p?.distancia_m != null && p.distancia_m < 6 ? 0.5 : 0, evidencia: [d ? 'recintos contiguos' : `distancia ${p?.distancia_m ?? '—'} m`] }); }
    else if (k === 'accessibility') O(o, { estado: 'parcial', score: seg.ancho_puerta_min_mm >= UMBRALES.ancho_puerta_min_mm ? 1 : 0.5, evidencia: ['un piso', seg.accesibilidad_info], aviso: 'Accesibilidad normativa NO verificada.' });
    else if (k === 'quiet') { const dorms = Object.values(geo.recintos).filter((r) => r.zona === 'privada' && r.tipo !== 'bano'); const ok = dorms.filter((d) => !Object.values(geo.recintos).some((r) => r.zona === 'social' && adyacentes(geo, d.id, r.id))).length; O(o, { estado: 'parcial', score: R2(ok / Math.max(1, dorms.length)), evidencia: [`${ok}/${dorms.length} dormitorios sin muro común con la zona social`], aviso: 'Heurística de adyacencias: no es acústica.' }); }
    else if (k === 'pool_supervision') O(o, { estado: 'alerta', razon: 'Supervisión y barreras no son verificables por el código: ver alertas de seguridad.' });
    else O(o, { estado: 'no_evaluado', razon: 'Sin método de evaluación en esta versión.' });
  }

  const alertas = [...seg.alertas, ...con.alertas, ...priv.hallazgos.map((h, i) => ({ id: `priv_${i}`, severidad: 'media', texto: h.texto }))];
  if (!solarOk) alertas.push({ id: 'sitio_insuficiente', severidad: 'info', texto: 'Sin norte verdadero, coordenadas y zona horaria confirmados no se afirma ninguna hora de sol ni sombra real.' });
  if (!perfil) alertas.push({ id: 'sin_clima', severidad: 'info', texto: 'Sin clima cargado: no se evalúa viento ni confort.' });
  const critica = alertas.some((a) => a.severidad === 'critica'); const noEval = objetivos.some((o) => o.estado === 'no_evaluado');
  const estado = critica ? 'con_alertas_criticas' : bloqueada || noEval || !solarOk ? 'no_conclusive' : 'sin_alertas_detectadas';
  const analisis = { schema: SCHEMA_IDS.analysis, scheme_id: esq.id, input_hash: hash, engine_version: VERSION_MOTOR, hard_gates: gates, metrics: metricas, alerts: alertas.map(({ id, severidad, texto }) => ({ id, severidad, texto })), global_state: estado, disclaimers: DISCLAIMERS };
  const v = validar('analysis', analisis); if (!v.ok) throw new Error(`analysis/1 inválido: ${v.errores.join(' | ')}`);
  return { analisis: v.valor, objetivos, bloqueada, detalle: { recorridos: rec, seguridad: seg, privacidad: priv, constructibilidad: con, viento: { abrigo, ventilacion: vent }, sol }, hash };
}

// ---------- multiobjetivo: Pareto, pesos visibles, sensibilidad, contrafactuales ----------
export function compararMultiobjetivo(evals) {
  const elegibles = evals.filter((e) => !e.bloqueada); const bloqueadas = evals.filter((e) => e.bloqueada).map((e) => ({ id: e.id, motivo: e.gatesFallidos }));
  if (!elegibles.length) return { estado: 'sin_alternativas_elegibles', bloqueadas, frontera: [], dimensiones: [], nota: 'Ninguna alternativa cumple los requisitos duros: no se compara.' };
  const comunes = elegibles[0].objetivos.filter((o) => o.score != null).map((o) => o.id).filter((id) => elegibles.every((e) => e.objetivos.find((o) => o.id === id)?.score != null));
  const pesos = Object.fromEntries(elegibles[0].objetivos.filter((o) => comunes.includes(o.id)).map((o) => [o.id, o.peso]));
  const noComparables = [...new Set(elegibles.flatMap((e) => e.objetivos.filter((o) => !comunes.includes(o.id)).map((o) => o.id)))];
  const sc = (e, id) => e.objetivos.find((o) => o.id === id).score;
  const domina = (a, b) => comunes.every((d) => sc(a, d) >= sc(b, d) - 1e-9) && comunes.some((d) => sc(a, d) > sc(b, d) + 1e-9);
  const frontera = comunes.length ? elegibles.filter((e) => !elegibles.some((o) => o !== e && domina(o, e))).map((e) => e.id) : [];
  const total = (e, w) => comunes.reduce((s, d) => s + w[d] * sc(e, d), 0);
  const ordenar = (w) => [...elegibles].sort((a, b) => total(b, w) - total(a, w) || a.id.localeCompare(b.id)).map((e) => e.id);
  const base = ordenar(pesos); const escenarios = []; let estable = 0;
  for (const d of comunes) for (const f of [0.5, 2, 3]) { const w = { ...pesos, [d]: pesos[d] * f }; const orden = ordenar(w); const igual = orden[0] === base[0]; if (igual) estable++; escenarios.push({ objetivo: d, factor: f, primero: orden[0], cambia: !igual }); }
  const contrafactuales = []; const lider = base[0];
  for (const e of elegibles.filter((x) => x.id !== lider)) { const L = elegibles.find((x) => x.id === lider); const gana = comunes.filter((d) => sc(e, d) > sc(L, d) + 1e-9).map((d) => ({ objetivo: d, ventaja: R2(sc(e, d) - sc(L, d)) })); contrafactuales.push({ alternativa: e.id, gana_en: gana, condicion: gana.length ? `${e.id} supera a ${lider} en ${gana.map((g) => g.objetivo).join(', ')}; ganaría si esos objetivos pesaran más (ver sensibilidad).` : `${e.id} no supera a ${lider} en ningún objetivo evaluado.` }); }
  return { estado: comunes.length ? 'comparado' : 'no_concluyente', dimensiones: comunes, pesos_visibles: pesos, no_comparables: noComparables, frontera_pareto: frontera, ranking_con_pesos_actuales: base, aviso_ranking: 'El ranking ponderado es una VISTA de sensibilidad; el criterio es la frontera de Pareto. Ningún puntaje global es una decisión.',
    sensibilidad: { escenarios, estabilidad: comunes.length ? R2(estable / escenarios.length) : null, lider_estable: escenarios.every((s) => !s.cambia) }, contrafactuales, bloqueadas, tabla: elegibles.map((e) => ({ id: e.id, ...Object.fromEntries(comunes.map((d) => [d, sc(e, d)])) })) };
}

/** Modo crítico ("abogado del diablo") sobre una alternativa elegida; solo con datos ya calculados. */
export function criticar(evalElegida, comparacion, esqElegido = null) {
  const peores = [...evalElegida.objetivos].filter((o) => o.score != null).sort((a, b) => a.score - b.score).slice(0, 3).map((o) => ({ objetivo: o.kind, score: o.score, evidencia: o.evidencia }));
  const sinEvaluar = evalElegida.objetivos.filter((o) => o.estado === 'no_evaluado').map((o) => ({ objetivo: o.kind, razon: o.razon }));
  const crit = evalElegida.analisis.alerts.filter((a) => a.severidad === 'critica' || a.severidad === 'alta');
  const falta = []; if (evalElegida.analisis.alerts.some((a) => a.id === 'sitio_insuficiente')) falta.push('Norte verdadero, coordenadas y zona horaria confirmados (habilitan sol/sombra reales).'); if (evalElegida.analisis.alerts.some((a) => a.id === 'sin_clima')) falta.push('Archivo de clima (EPW) o caché local para viento regional.'); falta.push('CIP/IPT vigente para restricciones urbanísticas.', 'Revisión profesional de estructura, instalaciones y seguridad.');
  return { alternativa: esqElegido?.id ?? evalElegida.analisis.scheme_id, puntos_debiles: peores, alertas_pendientes: crit, objetivos_sin_evaluar: sinEvaluar, donde_otra_opcion_gana: comparacion?.contrafactuales?.filter((c) => c.gana_en.length) ?? [], evidencia_que_cambiaria_la_conclusion: falta, aviso: 'Esto es una crítica sobre datos calculados; no inventa datos faltantes ni certifica nada.' };
}

// ---------- DecisionLedger ----------
export function decisionesDe({ evalElegida, brief, comparacion, schemeId }) {
  const out = []; let i = 0;
  for (const o of evalElegida.objetivos) {
    const bo = brief.objectives.find((x) => x.id === o.id); const calculado = o.score != null;
    const evidencia = [{ type: calculado ? 'calculation' : 'user_statement', metric: o.kind, value: calculado ? o.score : null, status: calculado ? 'computed' : 'not_computed', ...(calculado ? { method: o.estado === 'parcial' ? 'proxy geométrico (ver aviso)' : 'cálculo determinista del motor', input_hash: evalElegida.hash, engine_version: VERSION_MOTOR, at: new Date().toISOString().slice(0, 10) } : {}) }];
    const trade = (comparacion?.contrafactuales ?? []).filter((c) => c.gana_en.some((g) => g.objetivo === o.id)).map((c) => `${c.alternativa} rinde más en "${o.kind}"`);
    const incert = [...(o.razon ? [o.razon] : []), ...(o.aviso ? [o.aviso] : [])];
    const revisar = ['sightline', 'pool_supervision', 'accessibility'].includes(o.kind) || o.estado !== 'evaluado';
    const d = { schema: SCHEMA_IDS.decision, id: `d-${String(++i).padStart(3, '0')}`, goal_id: bo?.id ?? o.id, decision: `Objetivo "${o.kind}" (${o.prioridad}) evaluado sobre ${schemeId}: ${o.estado}${calculado ? `, índice ${o.score}` : ''}.`, candidate_ids: (comparacion?.tabla ?? []).map((t) => t.id), selected: schemeId, evidence: evidencia, tradeoffs: trade, uncertainty: incert, status: calculado ? 'proposed' : 'proposed_pending_evidence', requires_professional_review: revisar, reviewer: null };
    const v = validar('decision', d); if (!v.ok) throw new Error(`decision/1 inválida: ${v.errores.join(' | ')}`); out.push(v.valor);
  }
  return out;
}
