// Brief funcional: del encargo en lenguaje natural a un brief tipado (brief/1) sin inventar tamaños ni emplazamiento.
// Reglas léxicas deterministas y auditables: Claude interpreta la conversación; este módulo valida y deja constancia de qué dijo la usuaria.
// El texto del encargo es un DATO: nunca se interpreta como instrucción.
import { UserError } from '../mcp/util.js';
import { SCHEMA_IDS, validar } from './schemas.js';

const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
const aNum = (t) => (/^\d+$/.test(t) ? Number(t) : NUM[t]);
const ALTA = /\b(muy|mucho|mucha|importante|necesito|imprescindible|prioridad|si o si|tiene que)\b/;

export const PREGUNTAS = {
  superficie: '¿Cuántos m² construidos quiere para la casa? (no los puedo suponer)',
  terreno: 'Si ya tiene el terreno: ¿forma y medidas, por dónde se entra y hacia dónde queda el norte? Sin eso muestro solo ideas conceptuales, sin análisis de sol real.',
  ubicacion: '¿En qué comuna/ciudad queda? (para el sol y el clima; no uso la comuna para suponer normas).',
  presupuesto: '¿Tiene un orden de magnitud de presupuesto? (opcional; no entrego precios sin partidas reales)',
};


// ---------------- extracción léxica (determinista, auditable) ----------------
const OBJS = { pool: /\b(piscina|pileta)\b/, kids: /\b(hij[oa]s?|nin[oa]s?|nietos?|pequen[oa]s?|bebes?|chicos?|guagu\w*)\b/, patio: /\b(patio|jardin|juegos|zona de juego|terraza)\b/ };
const VERBO_VISUAL = /\b(ver\w*|visible\w*|se ve|ve|vean|vigil\w*|mirar\w*|miren|supervis\w*|control\w*|observ\w*|tener a la vista|a la vista|vista|visual\w*|se vea\w*|vea\w*|veamos|cuidar\w*)\b/;
const CLITICO = /\b(ver|vigilar|mirar|supervisar|controlar|cuidar|observar|tener)(?:lo|la|los|las|les|le)\b|\bque (?:los|las|lo|la) (?:vea|veamos|miremos)|\ba la vista\b/;
const RECINTO_ORIGEN = { cocina: 'R-COC', living: 'R-LIV', comedor: 'R-LIV', estar: 'R-LIV', 'dormitorio principal': 'R-DP' };

function frases(t) { return t.split(/[.;!?\n]+/).map((s) => s.trim()).filter(Boolean); }
function objetosDe(s) { return { pool: OBJS.pool.test(s), kids: OBJS.kids.test(s), patio: OBJS.patio.test(s) }; }

/** Relaciones visuales «ver X desde Y». Las referencias ambiguas generan una PREGUNTA, no una inferencia. */
export function detectarVistas(t) {
  const F = frases(t); const vistas = []; const ambiguedades = [];
  F.forEach((s, i) => {
    const desde = /\bdesde (?:la |el |mi |un |una |nuestra |nuestro )?(dormitorio principal|cocina|living|comedor|estar|dormitorio)\b/.exec(s);
    const conVista = /\b(cocina|living|comedor|estar) con (?:vista|visual|vision) (?:a|hacia|de|al) (?:la |el |los |las )?(\w+)/.exec(s);
    if (!((desde && VERBO_VISUAL.test(s)) || conVista)) return;
    const origenTxt = desde ? desde[1] : conVista[1];
    if (origenTxt === 'dormitorio') { ambiguedades.push({ codigo: 'VISTA_DORMITORIO_AMBIGUO', pregunta: '¿Desde cuál dormitorio quiere tener esa vista (el principal u otro)?' }); return; }
    const from = RECINTO_ORIGEN[origenTxt];
    let o = objetosDe(conVista ? `${s} ${conVista[2]}` : s); let porAnafora = false;
    if (!o.pool && !o.kids && !o.patio && (CLITICO.test(s) || desde)) { const prev = i > 0 ? objetosDe(F[i - 1]) : { pool: false, kids: false, patio: false }; if (prev.pool || prev.kids || prev.patio) { o = prev; porAnafora = true; } }
    const ref = origenTxt;
    let to = null;
    if (o.pool && o.patio) { ambiguedades.push({ codigo: 'VISTA_OBJETO_AMBIGUO', pregunta: `¿Quiere ver la piscina o el patio desde la ${ref}? (o ambos)` }); return; }
    if (o.pool) to = 'pool_play_zone'; else if (o.patio) to = 'patio';
    else { ambiguedades.push({ codigo: 'VISTA_OBJETO_AMBIGUO', pregunta: `¿Qué espacio quiere ver desde la ${ref}: el patio, la piscina u otro? (mencionó ${o.kids ? 'a sus hijos' : 'una vista'} sin decir dónde)` }); return; }
    vistas.push({ from, to, kids: o.kids, porAnafora, alta: o.kids || o.pool || ALTA.test(s) });
  });
  return { vistas, ambiguedades };
}

const RETIRO = /\b(ya no (?:quiero|necesito|me interesa|me importa|hace falta)|olvida\w*|quita\w*|elimina\w*|saca\w*|prescinde\w* de|no es necesari[oa]|sin necesidad de)\b/;
const RETIRABLE = [
  [/piscina|pileta/, { programa: ['piscina'], objetivo: (o) => o.kind === 'pool_supervision' || (o.kind === 'sightline' && o.to === 'pool_play_zone') }],
  [/patio|jardin/, { objetivo: (o) => ['courtyard', 'outdoor_relation'].includes(o.kind) || (o.kind === 'sightline' && o.to === 'patio'), programa: ['patio'] }],
  [/ahorr|presupuesto|costo|economic/, { objetivo: (o) => o.kind === 'cost_saving' }],
  [/\bluz|iluminaci|luminos|claridad/, { objetivo: (o) => o.kind === 'daylight_preference' }],
  [/fresc|verano|alero/, { objetivo: (o) => o.kind === 'summer_cooling' }],
  [/pasillo|circulaci/, { objetivo: (o) => o.kind === 'circulation_minimal' }],
  [/privacidad|intimidad/, { objetivo: (o) => o.kind === 'privacy' }],
  [/viento/, { objetivo: (o) => o.kind === 'wind_shelter' }],
  [/silencio|ruido|tranquil/, { objetivo: (o) => o.kind === 'quiet' }],
  [/ampliaci/, { objetivo: (o) => o.kind === 'future_extension' }],
  [/\ben l\b|forma de l/, { dura: ['footprint_class'] }],
];
const RELATIVO = /\b(?:(?:un|una|otro|otra|dos)\s+(?:dormitorios?|banos?|piezas?|habitaciones?)\s+(?:mas|adicional\w*|extra)|(?:agrega\w*|suma\w*|anade\w*|aumenta\w*|sube\w*|baja\w*|reduce\w*)\s+(?:un|una|dos|otro|otra)?\s*(?:dormitorios?|banos?|piezas?|habitaciones?))\b/g;
const RELATIVO_M2 = /\b\d{1,3}\s*(?:m2|m²|metros cuadrados)\s+(?:mas|menos)\b/g;

function extraer(t, textoOriginal) {
  const hechos = []; const objetivos = []; const duras = []; const programa = []; const needs = new Set(); const prohibiciones = []; const ambiguedades = []; let budget = null;
  const alta = ALTA.test(t);
  const rel = t.match(RELATIVO); const relm2 = t.match(RELATIVO_M2);
  if (rel) ambiguedades.push({ codigo: 'CAMBIO_RELATIVO', pregunta: '¿Cuántos dormitorios y baños quiere en total ahora? (no interpreto «uno más» sin saber el total)' });
  if (relm2) ambiguedades.push({ codigo: 'CAMBIO_RELATIVO_M2', pregunta: '¿Cuántos m² en total quiere ahora? (no interpreto «más/menos» sin el total)' });
  t = t.replace(RELATIVO, ' ').replace(RELATIVO_M2, ' ');
  const m2 = /(\d{2,3}(?:[.,]\d+)?)\s*(?:m2|m²|mts2|mt2|metros cuadrados|metros2)/.exec(t);
  let superficie = null; if (m2) { superficie = Number(m2[1].replace(',', '.')); duras.push({ kind: 'area_target', value: superficie, status: 'confirmed' }); hechos.push(`Superficie objetivo ${superficie} m² (dicho por usted)`); }
  const dorm = /(\d+|un|una|dos|tres|cuatro|cinco)\s*(?:dormitorios?|piezas?|habitaciones?|cuartos?)/.exec(t);
  if (dorm) { const v = aNum(dorm[1]); duras.push({ kind: 'bedrooms', value: v, status: 'confirmed' }); programa.push({ id: 'dormitorios', usage: 'private', quantity: v, status: 'confirmed' }); hechos.push(`${v} dormitorio(s)`); }
  const ban = /(\d+|un|una|dos|tres)\s*banos?/.exec(t);
  if (ban) { const v = aNum(ban[1]); duras.push({ kind: 'bathrooms', value: v, status: 'confirmed' }); programa.push({ id: 'banos', usage: 'service', quantity: v, status: 'confirmed' }); hechos.push(`${v} baño(s)`); }
  if (/\b(un piso|una planta|de un nivel|un solo piso|single|sin segundo piso|sin escalera)\b/.test(t)) duras.push({ kind: 'one_story', status: 'confirmed' });
  if (/\bsin escaleras?\b/.test(t)) duras.push({ kind: 'no_stairs', status: 'confirmed' });
  let clase = null;
  if (/\b(en l|forma de l|casa l|planta en l|con forma de ele)\b/.test(t)) clase = 'L_con_patio'; else if (/\b(dos alas|en u|en c|pabellones)\b/.test(t)) clase = 'dos_alas'; else if (/\b(compacta|compacto|rectangular|cuadrada)\b/.test(t)) clase = 'compacta';
  if (clase) duras.push({ kind: 'footprint_class', value: clase, status: 'confirmed' });
  const piscina = OBJS.pool.test(t); if (piscina) { programa.push({ id: 'piscina', usage: 'outdoor', status: 'confirmed' }); hechos.push('Piscina en el programa'); }
  if (/\b(patio|jardin|terraza)\b/.test(t)) programa.push({ id: 'patio', usage: 'outdoor', status: 'confirmed' });
  if (/\b(teletrabajo|home office|escritorio|oficina en casa)\b/.test(t)) needs.add('teletrabajo');
  if (OBJS.kids.test(t)) needs.add('supervision_infantil');
  if (/\b(adulto mayor|abuel[oa]s?|silla de ruedas|movilidad reducida|accesib)/.test(t)) { needs.add('accesibilidad'); objetivos.push({ kind: 'accessibility', priority: 'high', evidence: 'user_statement', status: 'confirmed' }); }
  if (/\b(mascotas?|perro|gato)\b/.test(t)) needs.add('mascotas');

  const v = detectarVistas(t); ambiguedades.push(...v.ambiguedades);
  for (const x of v.vistas) {
    objetivos.push({ kind: 'sightline', from: x.from, to: x.to, priority: x.alta ? 'high' : 'medium', evidence: x.porAnafora ? 'inferred_from_user' : 'user_statement', status: x.porAnafora ? 'assumed' : 'confirmed' });
    if (x.to === 'pool_play_zone' || x.kids) objetivos.push({ kind: 'pool_supervision', target: 'pool_play_zone', priority: 'high', evidence: 'inferred_from_user', status: 'assumed' });
  }
  if (/\b(luz|luminos\w*|iluminad\w*|iluminacion|claridad|solead\w*|mucho sol|ventanales|entre (?:mucha )?luz|luz natural)\b/.test(t)) objetivos.push({ kind: 'daylight_preference', target: /living|estar|comedor/.test(t) ? 'R-LIV' : 'vivienda', priority: alta || /mucha|mucho|bastante/.test(t) ? 'high' : 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\bsol de invierno|sol en invierno|calor en invierno\b/.test(t)) objetivos.push({ kind: 'winter_sun', target: 'R-LIV', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/(sin calor|fresc[ao] en verano|fresco\b|fresca\b|no (?:nos )?cocin|cocinemos|sobrecalent|aleros?|sombra en verano|protegid[ao] del sol)/.test(t)) objetivos.push({ kind: 'summer_cooling', target: 'R-LIV', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\bviento/.test(t)) objetivos.push({ kind: 'wind_shelter', target: /patio|jardin/.test(t) ? 'patio' : 'vivienda', priority: alta ? 'high' : 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(privacidad|intimidad|que no nos vean|vecinos)\b/.test(t)) objetivos.push({ kind: 'privacy', target: /dormitorio/.test(t) ? 'dormitorios' : 'vivienda', priority: 'high', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(pocas circulaciones|pocos pasillos|sin pasillos|menos pasillos|circulaciones minimas|pasillos cortos|evitar pasillos)\b/.test(t)) objetivos.push({ kind: 'circulation_minimal', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(ahorrar|ahorro|economic\w*|gastar poco|barat[oa]\w*|bajo costo|costos? (?:bajos?|contenidos?|controlados?)|(?:cuidar|controlar|ajustar|cuidemos|cuidar bien|vigilar) (?:el |la |mi |los |las )?(?:presupuesto|plata|costos?|gastos?)|presupuesto (?:ajustado|limitado|justo|acotado|bajo|reducido|apretado)|no (?:pasarme|excederme|pasarnos|gastar mucho)|sin pasarme(?:s)? del presupuesto)\b/.test(t)) objetivos.push({ kind: 'cost_saving', priority: 'high', evidence: 'user_statement', status: 'confirmed' });
  const pb = /presupuesto[^.;]{0,40}?(\d[\d.,]*\s*(?:millones?|uf|clp|pesos|mil))/.exec(t); if (pb) { budget = { order_of_magnitude: `presupuesto indicado por la usuaria: ${pb[1]}`.slice(0, 200), status: 'confirmed' }; hechos.push('Orden de magnitud de presupuesto indicado'); }
  if (/\b(se abra al (?:jardin|patio)|abierto al (?:jardin|patio)|salir al (?:jardin|patio)|conectad[oa] (?:con|al) (?:el )?(?:jardin|patio))\b/.test(t)) objetivos.push({ kind: 'outdoor_relation', from: 'R-LIV', to: 'patio', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\bpatio\b/.test(t) && !objetivos.some((o) => o.kind === 'outdoor_relation')) objetivos.push({ kind: 'courtyard', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(ampliar|ampliacion|crecer|futura|mas adelante agregar)\b/.test(t)) objetivos.push({ kind: 'future_extension', priority: 'low', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(silencio|silenciosa|tranquil[ao]|ruido)\b/.test(t)) objetivos.push({ kind: 'quiet', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(cocina abierta|cocina americana|integrad[ao])\b/.test(t)) objetivos.push({ kind: 'adjacency', from: 'R-COC', to: 'R-LIV', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  for (const m of t.matchAll(/\b(?:sin|no quiero|prohibid[ao]|nada de)\s+([a-z ]{3,30})/g)) { const x = m[1].trim(); if (x && !/pasillos?|escaleras?|calor|vecinos|ruido|pasarme|excederme|gastar/.test(x) && prohibiciones.length < 10) prohibiciones.push(x); }
  void textoOriginal;
  return { hechos, objetivos, duras, programa, needs: [...needs], prohibiciones, budget, ambiguedades, superficie };
}

const kObj = (o) => `${o.kind}|${o.from ?? ''}|${o.to ?? ''}|${o.target ?? ''}`;
const siguienteId = (arr, pref) => { let n = 0; for (const x of arr) { const m = new RegExp(`^${pref}(\\d+)$`).exec(x.id ?? ''); if (m) n = Math.max(n, Number(m[1])); } return () => `${pref}${++n}`; };

function recalcularMeta(b) {
  const dur = (k) => b.hard_constraints.some((h) => h.kind === k);
  const unk = ['site_dimensions', 'site_true_north', 'site_coordinates']; if (!b.budget || b.budget.status === 'unknown') unk.push('budget');
  if (!dur('area_target')) unk.unshift('area_target'); if (!dur('bedrooms')) unk.push('bedrooms'); if (!dur('bathrooms')) unk.push('bathrooms');
  b.unknowns = unk; const rev = ['site_urban_rules']; if (b.program.some((p) => p.id === 'piscina') || b.household.needs.includes('supervision_infantil')) rev.push('child_pool_access_barriers'); b.review_required = rev;
  return b;
}

/**
 * @param modo 'actualizar' (por defecto con `previo`): conserva TODO lo anterior y aplica solo lo nuevo; un requisito solo se elimina si la usuaria lo
 *             retira explícitamente («ya no quiero la piscina»). 'reemplazar': encargo integral nuevo (la versión anterior queda en el historial).
 */
export function interpretarEncargo(texto, { projectId = 'proyecto', previo = null, modo } = {}) {
  if (typeof texto !== 'string' || !texto.trim()) throw new UserError('ENCARGO_VACIO', 'Escriba el encargo con sus palabras (p. ej. «casa de 90 m² en L con patio y piscina visible desde la cocina»).');
  // eslint-disable-next-line no-control-regex
  const limpio = texto.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, 4000);
  const reemplazo = !previo || modo === 'reemplazar'; let t = sinTildes(limpio);
  const retiros = []; const ambRet = [];
  if (!reemplazo) { // frases de retiro: se tratan solo como retiro (no suman objetivos)
    const F = frases(t).filter((s) => { if (!RETIRO.test(s)) return true; const hit = RETIRABLE.filter(([re]) => re.test(s)); if (!hit.length) ambRet.push({ codigo: 'RETIRO_AMBIGUO', pregunta: '¿Qué quiere quitar exactamente del encargo? (no elimino nada por inferencia)' }); retiros.push(...hit.map(([, r]) => r)); return false; });
    t = F.join('. ');
  }
  const d = extraer(t, limpio); d.ambiguedades.push(...ambRet);
  let brief;
  const nuevoVersion = (previo?.version ?? 0) + 1;
  if (reemplazo) {
    const nid = siguienteId([], 'o'); const hid = siguienteId([], 'h');
    brief = { schema: SCHEMA_IDS.brief, project_id: projectId, version: nuevoVersion, request_original: limpio, request_updates: [], program: d.programa, household: { needs: d.needs }, objectives: d.objetivos.map((o) => ({ id: nid(), ...o })), hard_constraints: d.duras.map((h) => ({ id: hid(), ...h })), preferences: [], unknowns: [], review_required: [], prohibitions: d.prohibiciones, ...(d.budget ? { budget: d.budget } : {}) };
  } else {
    const hay = d.objetivos.length || d.duras.length || d.programa.length || d.needs.length || d.prohibiciones.length || d.budget || retiros.length;
    if (!hay) return { sin_cambios: true, modo: 'actualizar', brief: previo, hechos: [], preguntas: d.ambiguedades.map((a) => a.pregunta).slice(0, 3), ambiguedades: d.ambiguedades, pregunta_esencial: null, puede_generar_conceptos: previo.hard_constraints.some((h) => h.kind === 'area_target'), nota: 'No reconocí ningún cambio en ese mensaje: el encargo quedó igual (no se creó una versión nueva).' };
    brief = structuredClone(previo); brief.version = nuevoVersion; brief.request_updates = [...(previo.request_updates ?? []), { version: nuevoVersion, text: limpio.slice(0, 1000) }].slice(-40);
    const nid = siguienteId(brief.objectives, 'o'); const hid = siguienteId(brief.hard_constraints, 'h');
    for (const x of d.duras) { const i = brief.hard_constraints.findIndex((h) => h.kind === x.kind); if (i >= 0) brief.hard_constraints[i] = { ...x, id: brief.hard_constraints[i].id }; else brief.hard_constraints.push({ id: hid(), ...x }); }
    for (const p of d.programa) { const i = brief.program.findIndex((q) => q.id === p.id); if (i >= 0) brief.program[i] = { ...brief.program[i], ...p }; else brief.program.push(p); }
    for (const o of d.objetivos) { const i = brief.objectives.findIndex((q) => kObj(q) === kObj(o)); if (i >= 0) brief.objectives[i] = { ...brief.objectives[i], priority: o.priority, status: o.status === 'confirmed' ? 'confirmed' : brief.objectives[i].status, evidence: o.evidence === 'user_statement' ? 'user_statement' : brief.objectives[i].evidence }; else brief.objectives.push({ id: nid(), ...o }); }
    brief.household.needs = [...new Set([...brief.household.needs, ...d.needs])]; brief.prohibitions = [...new Set([...(brief.prohibitions ?? []), ...d.prohibiciones])].slice(0, 20); if (d.budget) brief.budget = d.budget;
    for (const r of retiros) { if (r.programa) brief.program = brief.program.filter((p) => !r.programa.includes(p.id)); if (r.objetivo) brief.objectives = brief.objectives.filter((o) => !r.objetivo(o)); if (r.dura) brief.hard_constraints = brief.hard_constraints.filter((h) => !r.dura.includes(h.kind)); }
  }
  recalcularMeta(brief);
  const r = validar('brief', brief); if (!r.ok) throw new UserError('BRIEF_INVALIDO', `El brief generado no es válido: ${r.errores.join(' | ')}`);
  const tieneArea = r.valor.hard_constraints.some((h) => h.kind === 'area_target');
  const preguntas = []; const amb = d.ambiguedades.map((a) => a.pregunta);
  if (!tieneArea) preguntas.push(PREGUNTAS.superficie); preguntas.push(...amb);
  if (reemplazo || !previo) { preguntas.push(PREGUNTAS.terreno); if (!/\b(santiago|valpara|concepcion|temuco|puerto|chile|comuna|region)\b/.test(t)) preguntas.push(PREGUNTAS.ubicacion); }
  const esencial = !tieneArea ? PREGUNTAS.superficie : null;
  return { brief: r.valor, modo: reemplazo ? (previo ? 'reemplazar' : 'crear') : 'actualizar', hechos: d.hechos, preguntas: [...new Set(preguntas)].slice(0, 3), ambiguedades: d.ambiguedades, pregunta_esencial: esencial, puede_generar_conceptos: tieneArea,
    nota: reemplazo && previo ? 'REEMPLAZO integral del encargo: lo anterior queda solo en las versiones previas del historial.' : 'Brief derivado de sus palabras; lo no dicho queda como "desconocido", no como supuesto; lo ya confirmado se conserva.' };
}

/** Diferencias entre dos briefs: qué objetivos/restricciones cambiaron (para explicar el cambio en la conversación). */
export function diffBrief(a, b) {
  const clave = (x) => `${x.kind}:${x.from ?? ''}>${x.to ?? x.target ?? ''}`; const dur = (x) => `${x.kind}=${x.value ?? ''}`;
  const set = (arr, f) => new Map(arr.map((x) => [f(x), x]));
  const cambios = { objetivos_agregados: [], objetivos_quitados: [], restricciones_agregadas: [], restricciones_quitadas: [], restricciones_modificadas: [] };
  const oa = set(a.objectives, clave); const ob = set(b.objectives, clave);
  for (const [k, v] of ob) if (!oa.has(k)) cambios.objetivos_agregados.push(v.kind); for (const [k, v] of oa) if (!ob.has(k)) cambios.objetivos_quitados.push(v.kind);
  const ha = new Map(a.hard_constraints.map((x) => [x.kind, x])); const hb = new Map(b.hard_constraints.map((x) => [x.kind, x]));
  for (const [k, v] of hb) { if (!ha.has(k)) cambios.restricciones_agregadas.push(dur(v)); else if (dur(ha.get(k)) !== dur(v)) cambios.restricciones_modificadas.push({ de: dur(ha.get(k)), a: dur(v) }); }
  for (const [k, v] of ha) if (!hb.has(k)) cambios.restricciones_quitadas.push(dur(v));
  return cambios;
}

/** Programa para el generador a partir del brief; lo faltante queda null (el generador pide el dato). */
export function programaDeBrief(brief) {
  const dur = (k) => brief.hard_constraints.find((h) => h.kind === k)?.value;
  const prog = { superficie_m2: dur('area_target') ?? null, ...(dur('bedrooms') != null ? { dormitorios: dur('bedrooms') } : {}), ...(dur('bathrooms') != null ? { banos: dur('bathrooms') } : {}), piscina: brief.program.some((p) => p.id === 'piscina') };
  const cocina = brief.objectives.some((o) => o.kind === 'adjacency' && o.from === 'R-COC'); if (cocina) prog.cocina = 'americana';
  return prog;
}

/** Grafo de relaciones deseadas: privacidad, cercanía, visual, circulación; con procedencia (usuaria vs heurística editable). */
export function grafoRelaciones(brief) {
  const aristas = [];
  const add = (a, b, tipo, origen, nota) => aristas.push({ a, b, tipo, origen, ...(nota ? { nota } : {}) });
  add('R-COC', 'R-LIV', 'cercania', 'heuristica_editable', 'Cocina–comedor–living cercanos (práctica de diseño; modificable).');
  add('R-DP', 'R-BP', 'cercania', 'heuristica_editable'); add('R-DP', 'R-LIV', 'privacidad', 'heuristica_editable', 'Dormitorios apartados de la zona social.');
  for (const o of brief.objectives) {
    if (o.kind === 'sightline') { add(o.from, o.to, 'visual', 'usuaria'); if (o.to === 'pool_play_zone') add(o.to, 'barrera_independiente', 'seguridad', 'alerta', 'La visual NO reemplaza barreras ni supervisión activa.'); }
    if (o.kind === 'outdoor_relation') add(o.from, o.to, 'cercania', 'usuaria');
    if (o.kind === 'adjacency') add(o.from, o.to, 'cercania', 'usuaria');
    if (o.kind === 'privacy') add(o.target ?? 'vivienda', 'vecinos', 'privacidad', 'usuaria');
    if (o.kind === 'circulation_minimal') add('circulaciones', 'superficie', 'circulacion', 'usuaria', 'Reducir superficie de pasillos sin perder acceso ni privacidad.');
    if (o.kind === 'quiet') add('dormitorios', 'fuentes_de_ruido', 'acustica', 'usuaria');
    if (o.kind === 'future_extension') add('vivienda', 'ampliacion', 'adaptacion_futura', 'usuaria');
  }
  return aristas;
}
