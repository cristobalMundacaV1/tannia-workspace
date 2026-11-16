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

export function interpretarEncargo(texto, { projectId = 'proyecto', previo = null } = {}) {
  if (typeof texto !== 'string' || !texto.trim()) throw new UserError('ENCARGO_VACIO', 'Escriba el encargo con sus palabras (p. ej. «casa de 90 m² en L con patio y piscina visible desde la cocina»).');
  // eslint-disable-next-line no-control-regex
  const limpio = texto.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, 4000);
  const t = sinTildes(limpio);
  const hechos = []; const objetivos = []; const duras = []; const prefs = []; const programa = []; const needs = new Set(); const prohibiciones = [];
  let n = 0; const oid = () => `o${++n}`; let h = 0; const hid = () => `h${++h}`; let pf = 0;
  const alta = ALTA.test(t);

  const m2 = /(\d{2,3}(?:[.,]\d+)?)\s*(?:m2|m²|mts2|mt2|metros cuadrados|metros2)/.exec(t);
  let superficie = null; if (m2) { superficie = Number(m2[1].replace(',', '.')); duras.push({ id: hid(), kind: 'area_target', value: superficie, status: 'confirmed' }); hechos.push(`Superficie objetivo ${superficie} m² (dicho por usted)`); }
  const dorm = /(\d+|un|una|dos|tres|cuatro|cinco)\s*(?:dormitorios?|piezas?|habitaciones?|cuartos?)/.exec(t);
  let dormitorios = null; if (dorm) { dormitorios = aNum(dorm[1]); duras.push({ id: hid(), kind: 'bedrooms', value: dormitorios, status: 'confirmed' }); programa.push({ id: 'dormitorios', usage: 'private', quantity: dormitorios, status: 'confirmed' }); hechos.push(`${dormitorios} dormitorio(s)`); }
  const ban = /(\d+|un|una|dos|tres)\s*banos?/.exec(t);
  let banos = null; if (ban) { banos = aNum(ban[1]); duras.push({ id: hid(), kind: 'bathrooms', value: banos, status: 'confirmed' }); programa.push({ id: 'banos', usage: 'service', quantity: banos, status: 'confirmed' }); hechos.push(`${banos} baño(s)`); }
  if (/\b(un piso|una planta|de un nivel|un solo piso|single|sin segundo piso|sin escalera)\b/.test(t)) duras.push({ id: hid(), kind: 'one_story', status: 'confirmed' });
  if (/\bsin escaleras?\b/.test(t)) duras.push({ id: hid(), kind: 'no_stairs', status: 'confirmed' });
  let clase = null;
  if (/\b(en l|forma de l|casa l|planta en l|con forma de ele)\b/.test(t)) clase = 'L_con_patio'; else if (/\b(dos alas|en u|en c|pabellones)\b/.test(t)) clase = 'dos_alas'; else if (/\b(compacta|compacto|rectangular|cuadrada)\b/.test(t)) clase = 'compacta';
  if (clase) duras.push({ id: hid(), kind: 'footprint_class', value: clase, status: 'confirmed' });
  const piscina = /\bpiscina|pileta\b/.test(t); if (piscina) { programa.push({ id: 'piscina', usage: 'outdoor', status: 'confirmed' }); hechos.push('Piscina en el programa'); }
  if (/\b(patio|jardin|terraza)\b/.test(t)) programa.push({ id: 'patio', usage: 'outdoor', status: 'confirmed' });
  if (/\b(teletrabajo|home office|escritorio|oficina en casa)\b/.test(t)) { needs.add('teletrabajo'); }
  if (/\b(ninos|hijos|ninas|bebes?)\b/.test(t)) needs.add('supervision_infantil');
  if (/\b(adulto mayor|abuel[oa]s?|silla de ruedas|movilidad reducida|accesib)/.test(t)) { needs.add('accesibilidad'); objetivos.push({ id: oid(), kind: 'accessibility', priority: 'high', evidence: 'user_statement', status: 'confirmed' }); }
  if (/\b(mascotas?|perro|gato)\b/.test(t)) needs.add('mascotas');

  // visuales: "ver/vigilar/vista ... desde la cocina"
  const DESDE = '(cocina|living|comedor|dormitorio|estar)';
  const OBJ = '(piscina|pileta|patio|jardin|ninos|hijos|juegos)';
  const re1 = new RegExp(`(?:ver|vigilar|mirar|supervisar|vista a|vista de|visual a|control(?:ar)? visual de)\\s+(?:a\\s+)?(?:los\\s+|las\\s+|la\\s+|el\\s+)?(?:\\w+\\s+){0,4}?${OBJ}\\b(?:\\s+\\w+){0,6}?\\s+desde\\s+(?:la\\s+|el\\s+)?${DESDE}`).exec(t)
    || new RegExp(`${OBJ}\\s+(?:visible|a la vista)\\s+desde\\s+(?:la\\s+|el\\s+)?${DESDE}`).exec(t);
  if (re1) {
    const objeto = re1[1]; const desde = re1[2] === 'cocina' ? 'R-COC' : re1[2] === 'living' || re1[2] === 'comedor' || re1[2] === 'estar' ? 'R-LIV' : re1[2];
    const hacia = /piscina|pileta/.test(objeto) || (piscina && /ninos|hijos|juegos/.test(objeto)) ? 'pool_play_zone' : 'patio';
    objetivos.push({ id: oid(), kind: 'sightline', from: desde, to: hacia, priority: alta || /ninos|hijos|piscina/.test(objeto) ? 'high' : 'medium', evidence: 'user_statement', status: 'confirmed' });
    if (hacia === 'pool_play_zone' || /ninos|hijos/.test(t)) objetivos.push({ id: oid(), kind: 'pool_supervision', target: 'pool_play_zone', priority: 'high', evidence: 'inferred_from_user', status: 'assumed' });
  }
  if (/\b(luz|luminos\w*|iluminad\w*|claridad|solead\w*|mucho sol)\b/.test(t)) objetivos.push({ id: oid(), kind: 'daylight_preference', target: /living|estar|comedor/.test(t) ? 'R-LIV' : 'vivienda', priority: alta ? 'high' : 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\bsol de invierno|sol en invierno|calor en invierno\b/.test(t)) objetivos.push({ id: oid(), kind: 'winter_sun', target: 'R-LIV', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/(sin calor|fresc[ao] en verano|no (?:nos )?cocin|cocinemos|sobrecalent|aleros?|sombra en verano|protegid[ao] del sol)/.test(t)) objetivos.push({ id: oid(), kind: 'summer_cooling', target: 'R-LIV', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\bviento/.test(t)) objetivos.push({ id: oid(), kind: 'wind_shelter', target: /patio|jardin/.test(t) ? 'patio' : 'vivienda', priority: alta ? 'high' : 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(privacidad|intimidad|que no nos vean|vecinos)\b/.test(t)) objetivos.push({ id: oid(), kind: 'privacy', target: /dormitorio/.test(t) ? 'dormitorios' : 'vivienda', priority: 'high', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(pocas circulaciones|pocos pasillos|sin pasillos|menos pasillos|circulaciones minimas|pasillos cortos)\b/.test(t)) objetivos.push({ id: oid(), kind: 'circulation_minimal', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(ahorrar|economic[oa]|gastar poco|barat[oa]|bajo costo|presupuesto ajustado)\b/.test(t)) objetivos.push({ id: oid(), kind: 'cost_saving', priority: 'high', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(se abra al (?:jardin|patio)|abierto al (?:jardin|patio)|salir al (?:jardin|patio)|conectad[oa] (?:con|al) (?:el )?(?:jardin|patio))\b/.test(t)) objetivos.push({ id: oid(), kind: 'outdoor_relation', from: 'R-LIV', to: 'patio', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\bpatio\b/.test(t) && !objetivos.some((o) => o.kind === 'outdoor_relation')) objetivos.push({ id: oid(), kind: 'courtyard', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(ampliar|ampliacion|crecer|futura|mas adelante agregar)\b/.test(t)) objetivos.push({ id: oid(), kind: 'future_extension', priority: 'low', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(silencio|silenciosa|tranquil[ao]|ruido)\b/.test(t)) objetivos.push({ id: oid(), kind: 'quiet', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(cocina abierta|cocina americana|integrad[ao])\b/.test(t)) objetivos.push({ id: oid(), kind: 'adjacency', from: 'R-COC', to: 'R-LIV', priority: 'medium', evidence: 'user_statement', status: 'confirmed' });
  for (const m of t.matchAll(/\b(?:sin|no quiero|prohibid[ao]|nada de)\s+([a-z ]{3,30})/g)) { const x = m[1].trim(); if (x && !/pasillos?|escaleras?|calor|vecinos|ruido/.test(x) && prohibiciones.length < 10) prohibiciones.push(x); }
  void pf; void prefs;

  const unknowns = ['site_dimensions', 'site_true_north', 'site_coordinates', 'budget'];
  if (superficie === null) unknowns.unshift('area_target'); if (dormitorios === null) unknowns.push('bedrooms'); if (banos === null) unknowns.push('bathrooms');
  const revisar = ['site_urban_rules']; if (piscina || needs.has('supervision_infantil')) revisar.push('child_pool_access_barriers');
  const brief = {
    schema: SCHEMA_IDS.brief, project_id: projectId, version: (previo?.version ?? 0) + 1, request_original: limpio,
    program: programa, household: { needs: [...needs] }, objectives: objetivos, hard_constraints: duras, preferences: [], unknowns, review_required: revisar, prohibitions: prohibiciones,
  };
  const r = validar('brief', brief); if (!r.ok) throw new UserError('BRIEF_INVALIDO', `El brief generado no es válido: ${r.errores.join(' | ')}`);
  const preguntas = [];
  if (superficie === null) preguntas.push(PREGUNTAS.superficie);
  preguntas.push(PREGUNTAS.terreno); if (!/\b(santiago|valpara|concepcion|temuco|puerto|chile|comuna|region)\b/.test(t)) preguntas.push(PREGUNTAS.ubicacion);
  const esencial = superficie === null ? PREGUNTAS.superficie : null; // única pregunta que bloquea generar ideas
  return { brief: r.valor, hechos, preguntas: esencial ? [esencial, ...preguntas.filter((x) => x !== esencial)].slice(0, 3) : preguntas.slice(0, 2), pregunta_esencial: esencial, puede_generar_conceptos: superficie !== null,
    nota: 'Brief derivado de sus palabras; lo no dicho queda como "desconocido", no como supuesto.' };
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
