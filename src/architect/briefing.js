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



// ---------------- interpretación por cláusulas (alcance de negación, intención y prioridad LOCAL) ----------------
// Cada frase se separa en cláusulas y se clasifica antes de extraer nada: pregunta · instrucción al asistente («no inventes…», «dime…») ·
// dato desconocido · exclusión/retirada («no quiero priorizar…») · preferencia. Solo las PREFERENCIAS generan objetivos; la prioridad es la de
// su propia cláusula. Una mera mención, una advertencia o una instrucción al asistente NUNCA es una preferencia arquitectónica.
const OBJS = { pool: /\b(piscina|pileta)\b/, kids: /\b(hij[oa]s?|nin[oa]s?|nietos?|pequen[oa]s?|bebes?|chicos?|guagu\w*)\b/, patio: /\b(patio|jardin|juegos|zona de juego|terraza)\b/ };
const VERBO_VISUAL = /\b(ver\w*|visible\w*|se ve|ve|vean|vigil\w*|mirar\w*|miren|supervis\w*|control\w*|observ\w*|tener a la vista|a la vista|vista|visual\w*|se vea\w*|vea\w*|veamos|cuidar\w*)\b/;
const CLITICO = /\b(ver|vigilar|mirar|supervisar|controlar|cuidar|observar|tener)(?:lo|la|los|las|les|le)\b|\bque (?:los|las|lo|la) (?:vea|veamos|miremos)|\ba la vista\b/;
const RECINTO_ORIGEN = { cocina: 'R-COC', living: 'R-LIV', comedor: 'R-LIV', estar: 'R-LIV', 'dormitorio principal': 'R-DP' };

/** Frases con su terminador (para reconocer preguntas). */
function frasesInfo(t) { const out = []; for (const m of t.matchAll(/([^.;!?\n]+)([.;!?\n]*)/g)) { const s = m[1].trim(); if (s) out.push({ texto: s, pregunta: /\?/.test(m[2]) || /^¿/.test(s) }); } return out; }
const frases = (t) => frasesInfo(t).map((x) => x.texto);
function objetosDe(s) { return { pool: OBJS.pool.test(s), kids: OBJS.kids.test(s), patio: OBJS.patio.test(s) }; }

/** Relaciones visuales «ver X desde Y». Las referencias ambiguas generan una PREGUNTA, no una inferencia. */
export function detectarVistas(t) {
  const F = frases(t).flatMap((x) => x.split(/\s+(?:y|e)\s+(?:tambien\s+)?(?=(?:quiero\s+|necesito\s+)?(?:ver|vigilar|mirar|supervisar)\b)/)); const vistas = []; let ambiguedades = [];
  F.forEach((s, i) => {
    const desde = /\bdesde (?:la |el |mi |un |una |nuestra |nuestro )?(dormitorio principal|cocina|living|comedor|estar|dormitorio)\b/.exec(s);
    const conVista = /\b(cocina|living|comedor|estar) con (?:vista|visual|vision) (?:a|hacia|de|al) (?:la |el |los |las )?(\w+)/.exec(s) || /\b(?:la |el )?(cocina|living|comedor|estar) (?:\w+ )?(?:vea|vean|mire|miren|controle|vigile)\b\s*(?:a |hacia )?(?:la |el |los |las )?(\w+)/.exec(s);
    if (!((desde && VERBO_VISUAL.test(s)) || conVista)) return;
    const origenTxt = desde ? desde[1] : conVista[1];
    if (origenTxt === 'dormitorio') { ambiguedades.push({ codigo: 'VISTA_DORMITORIO_AMBIGUO', pregunta: '¿Desde cuál dormitorio quiere tener esa vista (el principal u otro)?', origen: origenTxt }); return; }
    const from = RECINTO_ORIGEN[origenTxt];
    // ámbito de objetos: el tramo (entre comas/dos puntos) de la propia mención; si no hay objeto, el tramo anterior de la frase y luego la frase anterior
    const tramos = s.split(/[,:]/).map((x) => x.trim()).filter(Boolean); const clave = (desde ? desde[0] : conVista[0]); const ti = Math.max(0, tramos.findIndex((x) => x.includes(clave)));
    let o = objetosDe(conVista ? `${tramos[ti] ?? s} ${conVista[2]}` : (tramos[ti] ?? s)); let porAnafora = false;
    if (!o.pool && !o.patio && ti > 0) { const pt = objetosDe(tramos[ti - 1]); if (pt.pool || pt.patio) { o = { pool: pt.pool, patio: pt.patio, kids: o.kids || pt.kids }; porAnafora = true; } }
    if (!o.pool && !o.patio && ti + 1 < tramos.length) { const nx = objetosDe(tramos[ti + 1]); if (nx.pool || nx.patio) { o = { pool: nx.pool, patio: nx.patio, kids: o.kids || nx.kids }; porAnafora = true; } }
    if (!o.pool && !o.patio && (CLITICO.test(s) || desde)) { const prev = i > 0 ? objetosDe(F[i - 1]) : { pool: false, kids: false, patio: false }; if (prev.pool || prev.patio) { o = { pool: prev.pool, patio: prev.patio, kids: o.kids || prev.kids }; porAnafora = true; } else if (!o.kids && prev.kids) { o = { ...o, kids: true }; } }
    let to = null;
    if (o.pool && o.patio) { ambiguedades.push({ codigo: 'VISTA_OBJETO_AMBIGUO', pregunta: `¿Quiere ver la piscina o el patio desde la ${origenTxt}? (o ambos)`, origen: origenTxt }); return; }
    if (o.pool) to = 'pool_play_zone'; else if (o.patio) to = 'patio';
    else { ambiguedades.push({ codigo: 'VISTA_OBJETO_AMBIGUO', pregunta: `¿Qué espacio quiere ver desde la ${origenTxt}: el patio, la piscina u otro? (mencionó ${o.kids ? 'a sus hijos' : 'una vista'} sin decir dónde)`, origen: origenTxt }); return; }
    vistas.push({ from, to, kids: o.kids, porAnafora, alta: o.kids || o.pool || ALTA.test(s) });
  });
  // una repetición del mismo origen ya resuelto (lista de prioridades, confirmación) no es una duda nueva
  ambiguedades = ambiguedades.filter((a) => !vistas.some((v) => v.from === RECINTO_ORIGEN[a.origen]));
  return { vistas, ambiguedades };
}

// vocabulario de temas (solo para registrar instrucciones/exclusiones; no genera objetivos por sí mismo)
const TEMAS = { orientacion: /orientaci\w+|\bnorte\b|asoleamiento/, normativa: /normativ\w+|\bnormas?\b|oguc|reglament\w+|\bprc\b|\bcip\b/, viento: /viento/, terreno: /terreno|predio|deslinde/, sol: /\bsol\b|sombras?/, clima: /\bclima/, precios: /precios?|costos?|presupuesto|valores?\b/ };
const temasDe = (c) => Object.entries(TEMAS).filter(([, re]) => re.test(c)).map(([k]) => k);

const R_PREGUNTA_AL_ASISTENTE = /\b(dime|dig(?:a|ame)|muestrame|muestra|explicame|explica|indicame|preguntame|pregunta|avisame|enumera|listame|propon\w*|proponer|genera\w*|crea\b|crear\b|dame|entregame|revisa|verifica|compara|sugiere\w*|recomienda\w*|cuentame|informame|quiero que (?:me )?(?:muestres|digas|expliques|presentes|generes|propongas|des|entregues|crees|pregun\w+)|necesito que (?:me )?(?:muestres|digas|expliques|presentes|generes|propongas|des|entregues|pregun\w+))\b/;
const R_NO_INVENTAR = /\b(no (?:me )?(?:inventes|inventen|supongas|asumas|infieras|estimes|calcules|afirmes|digas|des por (?:sentado|cierto|hecho)|presumas)|sin (?:inventar|suponer|asumir|adivinar|presumir)|evit\w+ (?:inventar|suponer|asumir|adivinar)|nada de inventar)\b/;
const R_DESCONOCIDO = /\b(?:dato|datos|informacion)\s+(?:desconocid\w+|pendientes?|faltantes?|por confirmar)|\bdesconozc\w+|\bsin datos\b|\bno (?:lo |la |los |las )?(?:conozco|se|sabemos|tengo(?: aun)?|manejo|dispongo)\b|\baun no (?:lo |la )?(?:se|tengo|conozco|confirmo)|\bpendiente de confirmar|\bno (?:esta|estan) (?:confirmad\w+|definid\w+)/;
const NEG_FUERTE = /\b(?:ya no (?:quiero|necesito|me interesa|me importa|hace falta)|olvida\w*|quita\w*|elimina\w*|saca\w*|prescind\w+|descart\w+|no (?:quiero|necesito|deseo|busco|pretendo) (?:que se )?(?:priorizar|priorice|darle prioridad|dar prioridad|darle importancia|dar importancia|preocuparme|preocuparnos)|no me (?:importa|interesa|preocupa)|no (?:es|son) (?:una |un )?(?:prioridad|importante|necesari\w+)|no hace falta|sin necesidad de)\b/;
const NEG_SIMPLE = /^(?:no (?:quiero|necesito|deseo|busco|pretendo)\b|sin\b|nada de\b|ni\b)/;
// temas «de amenidad» que una negación simple («no quiero X», «sin X») excluye; los que ya expresan una preferencia en negativo (pasillos, calor, ruido, vecinos) NO.
const TEMA_EXCLUIBLE = [
  [/piscina|pileta/, { id: 'piscina', programa: ['piscina'], objetivo: (o) => o.kind === 'pool_supervision' || (o.kind === 'sightline' && o.to === 'pool_play_zone'), kinds: ['sightline', 'pool_supervision'], nombre: 'piscina' }],
  [/patio|jardin/, { id: 'patio', programa: ['patio'], objetivo: (o) => ['courtyard', 'outdoor_relation'].includes(o.kind) || (o.kind === 'sightline' && o.to === 'patio'), kinds: ['courtyard', 'outdoor_relation'], nombre: 'patio' }],
  [/ahorr|presupuesto|costos?\b|economic/, { id: 'ahorro', objetivo: (o) => o.kind === 'cost_saving', kinds: ['cost_saving'], nombre: 'ahorro' }],
  [/\bluz\b|iluminaci|luminos|claridad/, { id: 'luz', objetivo: (o) => o.kind === 'daylight_preference', kinds: ['daylight_preference'], nombre: 'luz' }],
  [/fresc|verano|alero/, { id: 'verano', objetivo: (o) => o.kind === 'summer_cooling', kinds: ['summer_cooling'], nombre: 'verano' }],
  [/viento/, { id: 'viento', objetivo: (o) => o.kind === 'wind_shelter', kinds: ['wind_shelter'], nombre: 'viento' }],
  [/ampliaci/, { id: 'ampliacion', objetivo: (o) => o.kind === 'future_extension', kinds: ['future_extension'], nombre: 'ampliacion' }],
  [/\ben l\b|forma de l/, { id: 'forma_l', dura: ['footprint_class'], kinds: [], nombre: 'forma_l' }],
];
const TEMA_FUERTE_EXTRA = [
  [/pasillo|circulaci/, { id: 'pasillos', objetivo: (o) => o.kind === 'circulation_minimal', kinds: ['circulation_minimal'], nombre: 'pasillos' }],
  [/privacidad|intimidad/, { id: 'privacidad', objetivo: (o) => o.kind === 'privacy', kinds: ['privacy'], nombre: 'privacidad' }],
  [/silencio|ruido|tranquil/, { id: 'silencio', objetivo: (o) => o.kind === 'quiet', kinds: ['quiet'], nombre: 'silencio' }],
];
const temasExcluibles = (c, fuerte) => [...TEMA_EXCLUIBLE, ...(fuerte ? TEMA_FUERTE_EXTRA : [])].filter(([re]) => re.test(c)).map(([, v]) => v);

const RELATIVO = /\b(?:(?:un|una|otro|otra|dos)\s+(?:dormitorios?|banos?|piezas?|habitaciones?)\s+(?:mas|adicional\w*|extra)|(?:agrega\w*|suma\w*|anade\w*|aumenta\w*|sube\w*|baja\w*|reduce\w*)\s+(?:un|una|dos|otro|otra)?\s*(?:dormitorios?|banos?|piezas?|habitaciones?))\b/g;
const RELATIVO_M2 = /\b\d{1,3}\s*(?:m2|m²|metros cuadrados)\s+(?:mas|menos)\b/g;
const SPLIT_CLAUSULA = /\s+(?:pero|aunque|sin embargo|mientras que|salvo que|excepto)\s+|,\s+(?=(?:no (?:me )?(?:inventes|supongas|asumas|infieras|estimes|calcules|afirmes|digas)|dime|muestrame|explicame|preguntame|sin (?:inventar|suponer))\b)/;

/** Clasifica una cláusula. */
function clasificar(c, esPregunta) {
  if (esPregunta) return { tipo: 'pregunta', topics: temasDe(c) };
  if (R_NO_INVENTAR.test(c)) return { tipo: 'no_inventar', topics: temasDe(c) };
  if (R_PREGUNTA_AL_ASISTENTE.test(c) && !/\bquiero (?:una|un|la|el)\b/.test(c)) return { tipo: 'pedido', topics: temasDe(c) };
  const fuerte = NEG_FUERTE.test(c); const ex = temasExcluibles(c, fuerte);
  if ((fuerte || NEG_SIMPLE.test(c)) && ex.length) return { tipo: 'exclusion', excl: ex, fuerte, topics: temasDe(c) };
  if (fuerte && /^(?:ya no|olvida|quita|elimina|saca|prescind)/.test(c)) return { tipo: 'retiro_ambiguo' };
  if (R_DESCONOCIDO.test(c)) return { tipo: 'desconocido', topics: temasDe(c) };
  return { tipo: 'preferencia' };
}

const VIENTO_CUE = /\b(?:proteg\w+|abrig\w+|resguard\w+|refugi\w+|cortaviento)\b|viento (?:fuerte|molest\w+|frio|helado|intenso|del sur|del norte|del oeste|de invierno|invernal|cruzado)|\b(?:fuerte|molest\w+|frio|helado|intenso) viento|que no (?:nos )?(?:entre|moleste|pase|llegue|sople|incomode)[^,.;]{0,30}viento|viento[^,.;]{0,30}\bno (?:entre|moleste|pase|llegue|sople|incomode)\b|\bsin viento\b/;
/** ¿El término aparece NEGADO dentro de su cláusula? (no/sin/ni/evitar antes del término, en el mismo tramo). */
function negado(c, idx) { const antes = c.slice(0, idx).split(/[,:]| pero | y /).pop(); return /\b(no|nunca|jamas|ni|sin|nada de|evita\w*|descarta\w*|prescind\w*)\b/.test(antes); }
const pos = (c, re) => { const m = re.exec(c); return !!m && !negado(c, m.index); };

/** Objetivos de UNA cláusula de preferencia; la prioridad es la de la propia cláusula. */
function objetivosDeClausula(c) {
  const out = []; const alta = ALTA.test(c); const P = (media = 'medium') => (alta ? 'high' : media);
  if (pos(c, /\b(luz|luminos\w*|iluminad\w*|iluminacion|claridad|solead\w*|mucho sol|ventanales|entre (?:mucha )?luz|luz natural)\b/)) out.push({ kind: 'daylight_preference', target: /living|estar|comedor/.test(c) ? 'R-LIV' : 'vivienda', priority: alta || /\b(mucha|mucho|bastante)\b/.test(c) ? 'high' : 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (pos(c, /\bsol de invierno|sol en invierno|calor en invierno\b/)) out.push({ kind: 'winter_sun', target: 'R-LIV', priority: P(), evidence: 'user_statement', status: 'confirmed' });
  if (/(sin calor|fresc[ao] en verano|\bfresco\b|\bfresca\b|no (?:nos )?cocin|cocinemos|sobrecalent|aleros?|sombra en verano|protegid[ao] del sol)/.test(c) && !negado(c, c.search(/aleros?|fresc[ao]/) < 0 ? 0 : c.search(/aleros?|fresc[ao]/)) ) out.push({ kind: 'summer_cooling', target: 'R-LIV', priority: P(), evidence: 'user_statement', status: 'confirmed' });
  if (/\bviento/.test(c) && VIENTO_CUE.test(c)) out.push({ kind: 'wind_shelter', target: /patio|jardin/.test(c) ? 'patio' : 'vivienda', priority: alta ? 'high' : 'medium', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(privacidad|intimidad|que no nos vean|vecinos)\b/.test(c)) out.push({ kind: 'privacy', target: /dormitorio/.test(c) ? 'dormitorios' : 'vivienda', priority: 'high', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(pocas circulaciones|pocos pasillos|sin pasillos|menos pasillos|circulaciones minimas|pasillos cortos|evitar pasillos|no quiero (?:muchos )?pasillos)\b/.test(c)) out.push({ kind: 'circulation_minimal', priority: P(), evidence: 'user_statement', status: 'confirmed' });
  if (/\b(ahorrar|ahorro|economic\w*|gastar poco|barat[oa]\w*|bajo costo|costos? (?:bajos?|contenidos?|controlados?)|(?:cuidar|controlar|ajustar|cuidemos|cuidar bien|vigilar) (?:el |la |mi |los |las )?(?:presupuesto|plata|costos?|gastos?)|presupuesto (?:ajustado|limitado|justo|acotado|bajo|reducido|apretado)|no (?:pasarme|excederme|pasarnos|gastar mucho)|sin pasarme(?:s)? del presupuesto)\b/.test(c)) out.push({ kind: 'cost_saving', priority: 'high', evidence: 'user_statement', status: 'confirmed' });
  if (pos(c, /\b(se abra al (?:jardin|patio)|abierto al (?:jardin|patio)|salir al (?:jardin|patio)|conectad[oa] (?:con|al) (?:el )?(?:jardin|patio))\b/)) out.push({ kind: 'outdoor_relation', from: 'R-LIV', to: 'patio', priority: P(), evidence: 'user_statement', status: 'confirmed' });
  if (pos(c, /\bpatio\b/) && !out.some((o) => o.kind === 'outdoor_relation')) out.push({ kind: 'courtyard', priority: P(), evidence: 'user_statement', status: 'confirmed' });
  if (pos(c, /\b(ampliar|ampliacion|crecer|futura|mas adelante agregar)\b/)) out.push({ kind: 'future_extension', priority: 'low', evidence: 'user_statement', status: 'confirmed' });
  if (/\b(silencio|silenciosa|tranquil[ao]|ruido)\b/.test(c)) out.push({ kind: 'quiet', priority: P(), evidence: 'user_statement', status: 'confirmed' });
  if (pos(c, /\b(cocina abierta|cocina americana|integrad[ao])\b/)) out.push({ kind: 'adjacency', from: 'R-COC', to: 'R-LIV', priority: P(), evidence: 'user_statement', status: 'confirmed' });
  if (/\b(adulto mayor|abuel[oa]s?|silla de ruedas|movilidad reducida|accesib)/.test(c)) out.push({ kind: 'accessibility', priority: 'high', evidence: 'user_statement', status: 'confirmed' });
  return out;
}

const PRIO = { high: 3, medium: 2, low: 1 }; const PROC = { confirmed: 2, assumed: 1, unknown: 0 };
const kObj = (o) => `${o.kind}|${o.from ?? ''}|${o.to ?? ''}|${o.target ?? ''}`;
/** Deduplicación SEMÁNTICA: misma clave (tipo+origen+destino+objetivo) ⇒ un solo objetivo, con la mayor prioridad y la mejor procedencia. */
export function deduplicarObjetivos(lista) {
  const m = new Map();
  for (const o of lista) {
    const k = kObj(o); const a = m.get(k);
    if (!a) { m.set(k, { ...o }); continue; }
    if ((PRIO[o.priority] ?? 0) > (PRIO[a.priority] ?? 0)) a.priority = o.priority;
    if ((PROC[o.status] ?? 0) > (PROC[a.status] ?? 0)) { a.status = o.status; a.evidence = o.evidence; }
  }
  return [...m.values()];
}

function extraer(textoNormalizado) {
  const hechos = []; const duras = []; const programa = []; const needs = new Set(); const prohibiciones = []; const notas = []; const ambiguedades = []; let budget = null;
  const t0 = textoNormalizado;
  const rel = t0.match(RELATIVO); const relm2 = t0.match(RELATIVO_M2);
  if (rel) ambiguedades.push({ codigo: 'CAMBIO_RELATIVO', pregunta: '¿Cuántos dormitorios y baños quiere en total ahora? (no interpreto «uno más» sin saber el total)' });
  if (relm2) ambiguedades.push({ codigo: 'CAMBIO_RELATIVO_M2', pregunta: '¿Cuántos m² en total quiere ahora? (no interpreto «más/menos» sin el total)' });
  const t = t0.replace(RELATIVO, ' ').replace(RELATIVO_M2, ' ');
  // 1) cláusulas clasificadas
  const prefs = []; const exclusiones = []; let idx = 0; let objetivos = []; const ord = [];
  for (const f of frasesInfo(t)) for (const c of f.texto.split(SPLIT_CLAUSULA).map((x) => x.trim()).filter(Boolean)) {
    idx++; const k = clasificar(c, f.pregunta);
    if (k.tipo === 'preferencia') { prefs.push(c); for (const item of c.split(/\s*,\s*(?:y |e )?|\s+y\s+/).map((x) => x.trim()).filter(Boolean)) for (const o of objetivosDeClausula(item)) { objetivos.push(o); ord.push([o.kind, idx, 'obj']); } }
    else if (k.tipo === 'exclusion') { exclusiones.push({ ...k, idx, texto: c }); notas.push({ kind: 'excluido', topics: k.excl.map((e) => e.nombre), text: c.slice(0, 240) }); }
    else if (k.tipo === 'retiro_ambiguo') ambiguedades.push({ codigo: 'RETIRO_AMBIGUO', pregunta: '¿Qué quiere quitar exactamente del encargo? (no elimino nada por inferencia)' });
    else if (k.tipo === 'no_inventar') notas.push({ kind: 'no_inventar', topics: k.topics.length ? k.topics : ['general'], text: c.slice(0, 240) });
    else if (k.tipo === 'desconocido' && k.topics.length) notas.push({ kind: 'dato_desconocido', topics: k.topics, text: c.slice(0, 240) });
    else if (k.tipo === 'pregunta' && k.topics.length) notas.push({ kind: 'pregunta', topics: k.topics, text: c.slice(0, 240) });
  }
  const tPref = prefs.join('. ');
  // 2) hechos (solo de cláusulas de preferencia/declarativas)
  const m2 = /(\d{2,3}(?:[.,]\d+)?)\s*(?:m2|m²|mts2|mt2|metros cuadrados|metros2)/.exec(tPref);
  let superficie = null; if (m2) { superficie = Number(m2[1].replace(',', '.')); duras.push({ kind: 'area_target', value: superficie, status: 'confirmed' }); hechos.push(`Superficie objetivo ${superficie} m² (dicho por usted)`); }
  const dorm = /(\d+|un|una|dos|tres|cuatro|cinco)\s*(?:dormitorios?|piezas?|habitaciones?|cuartos?)/.exec(tPref);
  if (dorm) { const v = aNum(dorm[1]); duras.push({ kind: 'bedrooms', value: v, status: 'confirmed' }); programa.push({ id: 'dormitorios', usage: 'private', quantity: v, status: 'confirmed' }); hechos.push(`${v} dormitorio(s)`); }
  const ban = /(\d+|un|una|dos|tres)\s*banos?/.exec(tPref);
  if (ban) { const v = aNum(ban[1]); duras.push({ kind: 'bathrooms', value: v, status: 'confirmed' }); programa.push({ id: 'banos', usage: 'service', quantity: v, status: 'confirmed' }); hechos.push(`${v} baño(s)`); }
  if (/\b(un piso|una planta|de un nivel|un solo piso|single|sin segundo piso|sin escalera)\b/.test(tPref)) duras.push({ kind: 'one_story', status: 'confirmed' });
  if (/\bsin escaleras?\b/.test(tPref)) duras.push({ kind: 'no_stairs', status: 'confirmed' });
  let clase = null;
  if (/\b(en l|forma de l|casa l|planta en l|con forma de ele)\b/.test(tPref)) clase = 'L_con_patio'; else if (/\b(dos alas|en u|en c|pabellones)\b/.test(tPref)) clase = 'dos_alas'; else if (/\b(lineal|alargada|en una sola fila)\b/.test(tPref)) clase = 'lineal'; else if (/\b(compacta|compacto|rectangular|cuadrada)\b/.test(tPref)) clase = 'compacta';
  if (clase) duras.push({ kind: 'footprint_class', value: clase, status: 'confirmed' });
  if (pos(tPref, OBJS.pool)) { programa.push({ id: 'piscina', usage: 'outdoor', status: 'confirmed' }); hechos.push('Piscina en el programa'); }
  if (pos(tPref, /\b(patio|jardin|terraza)\b/)) programa.push({ id: 'patio', usage: 'outdoor', status: 'confirmed' });
  if (/\b(teletrabajo|home office|escritorio|oficina en casa)\b/.test(tPref)) needs.add('teletrabajo');
  if (OBJS.kids.test(tPref)) needs.add('supervision_infantil');
  if (/\b(adulto mayor|abuel[oa]s?|silla de ruedas|movilidad reducida|accesib)/.test(tPref)) needs.add('accesibilidad');
  if (/\b(mascotas?|perro|gato)\b/.test(tPref)) needs.add('mascotas');
  const pb = /presupuesto[^.;]{0,40}?(\d[\d.,]*\s*(?:millones?|uf|clp|pesos|mil))/.exec(tPref); if (pb) { budget = { order_of_magnitude: `presupuesto indicado por la usuaria: ${pb[1]}`.slice(0, 200), status: 'confirmed' }; hechos.push('Orden de magnitud de presupuesto indicado'); }
  // 3) vistas
  const v = detectarVistas(tPref); ambiguedades.push(...v.ambiguedades);
  for (const x of v.vistas) {
    objetivos.push({ kind: 'sightline', from: x.from, to: x.to, priority: x.alta ? 'high' : 'medium', evidence: x.porAnafora ? 'inferred_from_user' : 'user_statement', status: x.porAnafora ? 'assumed' : 'confirmed' });
    if (x.to === 'pool_play_zone' || x.kids) objetivos.push({ kind: 'pool_supervision', target: 'pool_play_zone', priority: 'high', evidence: 'inferred_from_user', status: 'assumed' });
  }
  for (const m of tPref.matchAll(/\b(?:sin|no quiero|prohibid[ao]|nada de)\s+([a-z ]{3,30})/g)) { const x = m[1].trim(); if (x && !/^(?:eso|esto|aquello|nada|lo|la|el|los|las|mas)$/.test(x) && !/pasillos?|escaleras?|calor|vecinos|ruido|pasarme|excederme|gastar/.test(x) && prohibiciones.length < 10) prohibiciones.push(x); }
  objetivos = deduplicarObjetivos(objetivos);
  // 4) la última palabra manda: una exclusión posterior a una preferencia (o al revés) del mismo tema se resuelve por orden
  const ultPos = new Map(ord.map(([k, i]) => [k, i])); const excluidos = new Set();
  for (const e of exclusiones) for (const tema of e.excl) for (const kd of tema.kinds) { if ((ultPos.get(kd) ?? -1) > e.idx) continue; excluidos.add(kd); objetivos = objetivos.filter((o) => o.kind !== kd || (ultPos.get(kd) ?? -1) > e.idx); }
  for (const e of exclusiones) for (const tema of e.excl) if (tema.kinds.length === 0) excluidos.add(tema.id === 'forma_l' ? 'footprint_class' : tema.id);
  return { hechos, objetivos, duras, programa, needs: [...needs], prohibiciones, budget, ambiguedades, superficie, notas, exclusiones, excluidos: [...excluidos] };
}

const siguienteId = (arr, pref) => { let n = 0; for (const x of arr) { const m = new RegExp(`^${pref}(\\d+)$`).exec(x.id ?? ''); if (m) n = Math.max(n, Number(m[1])); } return () => `${pref}${++n}`; };
const claveNota = (n) => `${n.kind}|${[...n.topics].sort().join(',')}`;

function recalcularMeta(b) {
  const dur = (k) => b.hard_constraints.some((h) => h.kind === k);
  const unk = ['site_dimensions', 'site_true_north', 'site_coordinates']; if (!b.budget || b.budget.status === 'unknown') unk.push('budget');
  if (b.assistant_notes.some((n) => n.kind === 'dato_desconocido' && n.topics.includes('viento'))) unk.push('wind_data');
  if (!dur('area_target')) unk.unshift('area_target'); if (!dur('bedrooms')) unk.push('bedrooms'); if (!dur('bathrooms')) unk.push('bathrooms');
  b.unknowns = [...new Set(unk)]; const rev = ['site_urban_rules']; if (b.program.some((p) => p.id === 'piscina') || b.household.needs.includes('supervision_infantil')) rev.push('child_pool_access_barriers'); b.review_required = rev;
  return b;
}

/**
 * @param modo 'actualizar' (por defecto con `previo`): conserva TODO lo anterior y aplica solo lo nuevo; un requisito solo se elimina si la usuaria lo
 *             retira explícitamente («ya no quiero la piscina», «no quiero priorizar el viento»). 'reemplazar': encargo integral nuevo (la versión anterior queda en el historial).
 */
export function interpretarEncargo(texto, { projectId = 'proyecto', previo = null, modo } = {}) {
  if (typeof texto !== 'string' || !texto.trim()) throw new UserError('ENCARGO_VACIO', 'Escriba el encargo con sus palabras (p. ej. «casa de 90 m² en L con patio y piscina visible desde la cocina»).');
  // eslint-disable-next-line no-control-regex
  const limpio = texto.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, 4000);
  const reemplazo = !previo || modo === 'reemplazar';
  const d = extraer(sinTildes(limpio));
  let brief; const nuevoVersion = (previo?.version ?? 0) + 1;
  const notasUnicas = (arr) => { const m = new Map(); for (const n of arr) m.set(claveNota(n), n); return [...m.values()].slice(-40); };
  if (reemplazo) {
    const nid = siguienteId([], 'o'); const hid = siguienteId([], 'h');
    brief = { schema: SCHEMA_IDS.brief, project_id: projectId, version: nuevoVersion, request_original: limpio, request_updates: [], program: d.programa, household: { needs: d.needs }, objectives: d.objetivos.map((o) => ({ id: nid(), ...o })), hard_constraints: d.duras.map((h) => ({ id: hid(), ...h })), preferences: [], unknowns: [], review_required: [], prohibitions: d.prohibiciones, assistant_notes: notasUnicas(d.notas), excluded_objectives: d.excluidos, ...(d.budget ? { budget: d.budget } : {}) };
  } else {
    const hay = d.objetivos.length || d.duras.length || d.programa.length || d.needs.length || d.prohibiciones.length || d.budget || d.exclusiones.length || d.notas.length;
    if (!hay) return { sin_cambios: true, modo: 'actualizar', brief: previo, hechos: [], preguntas: d.ambiguedades.map((a) => a.pregunta).slice(0, 3), ambiguedades: d.ambiguedades, pregunta_esencial: null, puede_generar_conceptos: previo.hard_constraints.some((h) => h.kind === 'area_target'), nota: 'No reconocí ningún cambio en ese mensaje: el encargo quedó igual (no se creó una versión nueva).' };
    brief = structuredClone(previo); brief.version = nuevoVersion; brief.request_updates = [...(previo.request_updates ?? []), { version: nuevoVersion, text: limpio.slice(0, 1000) }].slice(-40); brief.assistant_notes ??= []; brief.excluded_objectives ??= [];
    d.ambiguedades = d.ambiguedades.filter((a) => !(a.origen && previo.objectives.some((q) => q.kind === 'sightline' && q.from === RECINTO_ORIGEN[a.origen]))); // repetición de una vista ya registrada
    const nid = siguienteId(brief.objectives, 'o'); const hid = siguienteId(brief.hard_constraints, 'h');
    for (const x of d.duras) { const i = brief.hard_constraints.findIndex((h) => h.kind === x.kind); if (i >= 0) brief.hard_constraints[i] = { ...x, id: brief.hard_constraints[i].id }; else brief.hard_constraints.push({ id: hid(), ...x }); }
    for (const p of d.programa) { const i = brief.program.findIndex((q) => q.id === p.id); if (i >= 0) brief.program[i] = { ...brief.program[i], ...p }; else brief.program.push(p); }
    // retiradas contextuales (primero), luego lo nuevo
    for (const e of d.exclusiones) for (const tema of e.excl) { if (tema.programa) brief.program = brief.program.filter((p) => !tema.programa.includes(p.id)); if (tema.objetivo) brief.objectives = brief.objectives.filter((o) => !tema.objetivo(o)); if (tema.dura) brief.hard_constraints = brief.hard_constraints.filter((h) => !tema.dura.includes(h.kind)); }
    for (const o of d.objetivos) { const i = brief.objectives.findIndex((q) => kObj(q) === kObj(o)); if (i >= 0) brief.objectives[i] = { ...brief.objectives[i], priority: o.priority, status: o.status === 'confirmed' ? 'confirmed' : brief.objectives[i].status, evidence: o.evidence === 'user_statement' ? 'user_statement' : brief.objectives[i].evidence }; else brief.objectives.push({ id: nid(), ...o }); }
    brief.objectives = deduplicarObjetivos(brief.objectives);
    brief.household.needs = [...new Set([...brief.household.needs, ...d.needs])]; brief.prohibitions = [...new Set([...(brief.prohibitions ?? []), ...d.prohibiciones])].slice(0, 20); if (d.budget) brief.budget = d.budget;
    brief.assistant_notes = notasUnicas([...brief.assistant_notes, ...d.notas]);
    brief.excluded_objectives = [...new Set([...brief.excluded_objectives, ...d.excluidos])].filter((k) => !d.objetivos.some((o) => o.kind === k));
    const estable = (v) => (Array.isArray(v) ? `[${v.map(estable).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${estable(v[k])}`).join(',')}}` : JSON.stringify(v));
    const sinMeta = (b) => estable({ ...b, version: 0, request_updates: [], unknowns: [], review_required: [] }); recalcularMeta(brief);
    if (sinMeta(brief) === sinMeta(previo) && !d.ambiguedades.length) return { sin_cambios: true, modo: 'actualizar', brief: previo, hechos: [], preguntas: [], ambiguedades: [], pregunta_esencial: null, puede_generar_conceptos: previo.hard_constraints.some((h) => h.kind === 'area_target'), nota: 'Ese mensaje repite lo que ya estaba registrado: el encargo quedó igual (no se creó una versión nueva ni se duplicó nada).' };
  }
  recalcularMeta(brief);
  const r = validar('brief', brief); if (!r.ok) throw new UserError('BRIEF_INVALIDO', `El brief generado no es válido: ${r.errores.join(' | ')}`);
  const tieneArea = r.valor.hard_constraints.some((h) => h.kind === 'area_target');
  const preguntas = []; const amb = d.ambiguedades.map((a) => a.pregunta);
  if (!tieneArea) preguntas.push(PREGUNTAS.superficie); preguntas.push(...amb);
  if (reemplazo || !previo) { preguntas.push(PREGUNTAS.terreno); if (!/\b(santiago|valpara|concepcion|temuco|puerto|chile|comuna|region)\b/.test(sinTildes(limpio))) preguntas.push(PREGUNTAS.ubicacion); }
  const esencial = !tieneArea ? PREGUNTAS.superficie : null;
  return { brief: r.valor, modo: reemplazo ? (previo ? 'reemplazar' : 'crear') : 'actualizar', hechos: d.hechos, preguntas: [...new Set(preguntas)].slice(0, 3), ambiguedades: d.ambiguedades, pregunta_esencial: esencial, puede_generar_conceptos: tieneArea,
    nota: reemplazo && previo ? 'REEMPLAZO integral del encargo: lo anterior queda solo en las versiones previas del historial.' : 'Brief derivado de sus palabras; lo no dicho queda como "desconocido", no como supuesto; lo ya confirmado se conserva; las instrucciones al asistente («no inventes…») se registran como notas, no como preferencias.' };
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
