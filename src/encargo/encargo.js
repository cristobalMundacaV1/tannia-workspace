// Encargo profesional (G04 de TW-PRO-E2E, contrato C-01 «WorkOrder»): de «aquí están los antecedentes, prepara planos, cubicaciones,
// presupuesto y memoria» a un plan por RESULTADOS, con una sola ronda de preguntas indispensables y datos con procedencia.
//
// Reparto de autoridad: Claude lee los documentos y propone datos; el CÓDIGO decide qué vale como dato. Un dato VERIFICADO debe
// citar un documento recibido (source_id) y la cita literal debe aparecer en el texto de ese documento con el mismo número: el
// modelo no puede fabricar una procedencia. Lo dicho en la conversación queda DECLARADO (no acreditado); una HIPÓTESIS nunca se
// promociona a dato de diseño; lo que falta queda PENDIENTE y bloquea solo los resultados que dependen de ello.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { Project } from '../project/store.js';
import { openPdf } from '../pdf/pdf.js';
import { planosVigentes, REGLA_PLANOS } from '../expediente/planos_partidas.js';
import { estadoArtefactos } from '../autoridad/entrega.js';
import { revisionVigente } from '../autoridad/revision.js';

export const ESQUEMA_ENCARGO = 'tw.encargo/1';
export const ESTADOS_DATO = ['VERIFICADO', 'DECLARADO', 'HIPOTESIS', 'PENDIENTE'];
export const RESULTADOS = { planos: 'Planos', cantidades: 'Cubicaciones', presupuesto: 'Presupuesto (Excel)', memoria: 'Memoria de cálculo', entrega: 'Carpeta de entrega' };

// Datos que cada perfil necesita, con la pregunta en lenguaje de obra, por qué importa y qué pasa si no se sabe.
// `motor`: nombre del parámetro en la herramienta real; `admite`: valores que el motor soporta hoy (límite honesto).
const T = (clave, unidad, pregunta, por_que, si_no_se_sabe, bloquea, extra = {}) => ({ clave, unidad, pregunta, por_que, si_no_se_sabe, bloquea, ...extra });
export const PERFILES = {
  tunel: {
    nombre: 'Túnel (sección de bóveda semicircular sobre hastiales verticales)',
    limites: ['El generador dibuja solo bóveda semicircular (radio = ancho/2) sobre hastiales verticales; otra forma de sección se dibuja con una especificación propia.', 'Revestimiento soportado: 6 u 8 cm.', 'La fortificación es un esquema con el patrón declarado: no es un diseño geotécnico verificado.', 'El DWG se entrega solo si AutoCAD lo guarda y se verifica; hasta entonces, DXF y PDF.'],
    datos: [
      T('largo_m', 'm', '¿Cuál es el largo del túnel?', 'Define la planta, el perfil y todos los volúmenes.', 'No se pueden calcular volúmenes ni cantidades de fortificación.', ['planos', 'cantidades', 'presupuesto', 'memoria'], { motor: 'length' }),
      T('ancho_m', 'm', '¿Cuál es el ancho de la sección (luz)?', 'Define el radio de la bóveda y el área excavada.', 'No se puede dibujar la sección.', ['planos', 'cantidades', 'presupuesto', 'memoria'], { motor: 'width' }),
      T('altura_hastial_m', 'm', '¿Qué altura tienen los hastiales (paredes verticales) hasta el arranque de la bóveda?', 'Junto con el ancho fija la sección; sin ella el área de excavación es desconocida.', 'No se dibuja la sección ni se calcula excavación; no se supone un valor.', ['planos', 'cantidades', 'presupuesto', 'memoria'], { motor: 'wall' }),
      T('espesor_revestimiento_m', 'm', '¿Qué espesor de shotcrete se considera (6 u 8 cm)?', 'Define el volumen de revestimiento.', 'Se pueden dibujar ambas alternativas como comparación, pero ninguna entra al presupuesto.', ['planos', 'cantidades', 'presupuesto', 'memoria'], { motor: 'selected', admite: [0.06, 0.08] }),
      T('perno_longitud_m', 'm', '¿Qué largo tienen los pernos?', 'Fija el cuadro de pernos y el detalle de fortificación.', 'La fortificación queda fuera de planos y presupuesto.', ['fortificacion'], { motor: 'fortificacion.perno_longitud' }),
      T('espaciamiento_transversal_m', 'm', '¿Cada cuánto van los pernos en la sección (espaciamiento transversal)?', 'Define cuántos pernos tiene cada anillo.', 'La fortificación queda fuera.', ['fortificacion'], { motor: 'fortificacion.espaciamiento_transversal' }),
      T('espaciamiento_longitudinal_m', 'm', '¿Cada cuánto van los anillos de pernos a lo largo del túnel?', 'Define el número de anillos y el total de pernos.', 'La fortificación queda fuera.', ['fortificacion'], { motor: 'fortificacion.espaciamiento_longitudinal' }),
      T('malla', 'sí/no', '¿Lleva malla de acero?', 'Agrega la partida de malla y su detalle.', 'Se asume que NO se presupuesta malla (no se dibuja).', ['fortificacion'], { motor: 'fortificacion.malla', tipo: 'booleano' }),
      T('traslapo_malla_pct', '%', '¿Qué traslapo de malla se considera (en %)?', 'Aumenta la superficie de malla a comprar.', 'Sin traslapo declarado la malla no se cubica.', ['fortificacion'], { motor: 'fortificacion.traslapo_malla_pct', solo_si: 'malla' }),
    ],
  },
  edificacion: {
    nombre: 'Edificación (muros, vanos, losas)',
    limites: ['Las cantidades se miden sobre la geometría dibujada con elementos físicos identificados; no se declara cumplimiento normativo.', 'No es proyecto de permiso ni diseño estructural.', 'El DWG se entrega solo si AutoCAD lo guarda y se verifica; hasta entonces, DXF y PDF.'],
    datos: [
      T('geometria_planta', 'plano', '¿De dónde salen las medidas de muros y vanos (plano DXF/PDF del expediente o medidas que usted me dicte)?', 'Sin una fuente de geometría no hay plantas, elevaciones ni cubicación.', 'No se dibuja ni se cubica nada.', ['planos', 'cantidades', 'presupuesto', 'memoria'], { tipo: 'texto' }),
      T('altura_muros_m', 'm', '¿Qué altura tienen los muros?', 'Las áreas de muro (y sus descuentos de vanos) dependen de la altura.', 'No se calculan áreas de muro; no se supone un valor.', ['planos', 'cantidades', 'presupuesto', 'memoria']),
      T('politica_vanos', 'texto', '¿Los vanos se descuentan todos, solo los mayores a cierto tamaño, o ninguno?', 'Cambia el área de muro a pagar.', 'Se deja la partida con needs_review hasta decidirlo.', ['cantidades', 'presupuesto'], { tipo: 'texto' }),
    ],
  },
};
const COMUNES = [
  T('precios_partidas', 'APU', '¿Con qué precios valorizo las partidas (planilla de precios, cotización o APU con fecha y fuente)?', 'Un presupuesto sin precios con fecha y fuente no es un presupuesto; los precios históricos se rotulan como referencia.', 'Se entregan cubicaciones y un Excel con precios PENDIENTES, sin total final.', ['presupuesto'], { tipo: 'texto' }),
  T('gastos_generales_pct', '%', '¿Qué porcentaje de gastos generales uso?', 'Cambia el total; no se supone.', 'El total queda como parcial (sin gastos generales).', ['presupuesto']),
  T('utilidades_pct', '%', '¿Qué porcentaje de utilidades uso?', 'Cambia el total; no se supone.', 'El total queda como parcial.', ['presupuesto']),
  T('iva_pct', '%', '¿Aplico IVA (19 %) u otro régimen?', 'Cambia el total con impuestos.', 'El total queda neto, sin impuestos.', ['presupuesto']),
];

const PATRONES_PERFIL = [[/t[uú]nel|socav[oó]n|galer[ií]a|portal|hastial|b[oó]veda|shotcrete|perno/i, 'tunel'], [/casa|vivienda|edificio|edificaci[oó]n|muro|losa|radier|tabique|departamento|oficina|bodega|galp[oó]n/i, 'edificacion']];
export function detectarPerfil(objetivo) { for (const [re, p] of PATRONES_PERFIL) if (re.test(objetivo || '')) return p; return null; }

const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const numeros = (t) => [...String(t).matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.')));

/** Texto completo de una fuente legible (PDF con capa de texto, MD/TXT/CSV, textos de DXF). null si no tiene texto verificable. */
export async function textoDeFuente(pr, f) {
  if (!f.canonical_path || f.lectura !== 'LEIDO') return null;
  const abs = pr.p(...f.canonical_path.split('/'));
  if (['.md', '.txt', '.csv', '.dxf'].includes(f.extension)) return fs.readFileSync(abs, 'utf8');
  if (f.extension === '.pdf') { const { doc } = await openPdf(fs.readFileSync(abs)); const out = []; for (let i = 1; i <= doc.numPages; i++) { const tc = await (await doc.getPage(i)).getTextContent(); out.push(tc.items.map((x) => x.str).join(' ')); } return out.join('\n'); }
  return null;
}

function leer(pr) { return pr.leer(pr.p('.tannia', 'encargo.json'), null); }
function guardar(pr, e) { pr.escribir(pr.p('.tannia', 'encargo.json'), e); }
const definiciones = (perfil) => [...(PERFILES[perfil]?.datos || []), ...COMUNES];

/** Inicia (o retoma) el encargo. No borra datos ya registrados: un nuevo objetivo se agrega al registro de decisiones. */
export function iniciarEncargo(sandbox, nombre, { objetivo, perfil = null, entregables = null }) {
  const pr = new Project(sandbox, nombre); pr.verificarTannia(); sandbox.projectRoot(nombre);
  const previo = leer(pr); const p = perfil || detectarPerfil(objetivo) || previo?.perfil || null;
  const e = previo || { schema: ESQUEMA_ENCARGO, id: `enc-${crypto.randomBytes(6).toString('hex')}`, creado: new Date().toISOString(), datos: {}, decisiones: [], preguntas_hechas: [] };
  e.objetivo = String(objetivo || e.objetivo || '').slice(0, 2000); e.perfil = p; e.soportado = !!PERFILES[p];
  e.entregables = (entregables && entregables.length ? entregables : Object.keys(RESULTADOS)).filter((x) => RESULTADOS[x]);
  e.decisiones.push({ t: new Date().toISOString(), tipo: previo ? 'objetivo_actualizado' : 'encargo_iniciado', detalle: e.objetivo.slice(0, 300) });
  guardar(pr, e); return e;
}

/**
 * Registra datos con su procedencia. Cada dato: { clave, valor, unidad?, estado, origen: { source_id, cita, pagina? } | { declarado_por, cita_usuaria? } }.
 * Rechaza (sin guardar ese dato) lo que no cumple: clave desconocida, unidad incompatible, valor fuera de lo que el motor admite,
 * VERIFICADO sin cita encontrada en el documento citado, HIPÓTESIS sin rotular. Devuelve { aceptados, rechazados }.
 */
export async function registrarDatos(sandbox, nombre, datos) {
  const pr = new Project(sandbox, nombre); pr.verificarTannia(); const e = leer(pr);
  if (!e) throw new UserError('SIN_ENCARGO', 'Aún no hay un encargo en este proyecto.', 'Inícielo con el objetivo que dio la persona.');
  const defs = new Map(definiciones(e.perfil).map((d) => [d.clave, d]));
  const inv = pr.leer(pr.p('.tannia', 'fuentes.json'), { fuentes: [] }); const fuentes = new Map(inv.fuentes.map((f) => [f.source_id, f]));
  const aceptados = []; const rechazados = []; const textos = new Map();
  for (const d of datos) {
    const def = defs.get(d.clave); const no = (codigo, motivo) => rechazados.push({ clave: d.clave, codigo, motivo });
    if (!def) { no('DATO_DESCONOCIDO', `«${d.clave}» no es un dato de este encargo (${e.perfil || 'sin perfil'}).`); continue; }
    if (!ESTADOS_DATO.includes(d.estado)) { no('ESTADO_INVALIDO', `Estado ${d.estado} no válido.`); continue; }
    let valor = d.valor;
    if (d.estado !== 'PENDIENTE') {
      if (def.tipo === 'booleano') { if (typeof valor !== 'boolean') { no('VALOR_INVALIDO', 'Debe ser sí o no.'); continue; } }
      else if (def.tipo === 'texto') { if (typeof valor !== 'string' || !valor.trim()) { no('VALOR_INVALIDO', 'Falta el texto.'); continue; } }
      else {
        if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) { no('VALOR_INVALIDO', 'Debe ser un número no negativo.'); continue; }
        if (d.unidad && d.unidad !== def.unidad) { no('UNIDAD_INCOMPATIBLE', `Se espera en ${def.unidad}; indique el valor convertido y su origen (no se convierte en silencio).`); continue; }
        if (def.admite && !def.admite.some((x) => Math.abs(x - valor) < 1e-9)) { no('NO_SOPORTADO_POR_EL_MOTOR', `El generador actual admite ${def.admite.join(' o ')} ${def.unidad}. Otro valor requiere una especificación de planos propia.`); continue; }
      }
    }
    if (d.estado === 'VERIFICADO') {
      const f = fuentes.get(d.origen?.source_id);
      if (!f) { no('FUENTE_INEXISTENTE', 'El documento citado no está entre los antecedentes recibidos.'); continue; }
      const cita = String(d.origen?.cita || '');
      if (norm(cita).length < 4) { no('CITA_REQUERIDA', 'Un dato VERIFICADO necesita la frase literal del documento que lo respalda.'); continue; }
      if (!textos.has(f.source_id)) { try { textos.set(f.source_id, await textoDeFuente(pr, f)); } catch { textos.set(f.source_id, null); } }
      const texto = textos.get(f.source_id);
      if (texto == null) { no('FUENTE_SIN_TEXTO', `«${f.display_name}» no tiene texto verificable (${f.detalle_lectura || f.lectura}). Si la persona confirma el valor, regístrelo como DECLARADO.`); continue; }
      if (!norm(texto).includes(norm(cita))) { no('CITA_NO_ENCONTRADA', `La frase citada no aparece en «${f.display_name}». No se registra como verificado.`); continue; }
      if (typeof valor === 'number' && !numeros(cita).some((n) => Math.abs(n - valor) < 1e-9)) { no('CITA_NO_RESPALDA_VALOR', `La cita no contiene el valor ${valor} (si el documento lo da en otra unidad, regístrelo como DECLARADO con la conversión explicada).`); continue; }
    }
    if (d.estado === 'DECLARADO' && !d.origen?.declarado_por) { no('ORIGEN_REQUERIDO', 'Indique quién lo declaró (p. ej. «usuaria en la conversación»).'); continue; }
    if (d.estado === 'HIPOTESIS' && !d.origen?.motivo) { no('HIPOTESIS_SIN_MOTIVO', 'Una hipótesis requiere su motivo (p. ej. «recomendado para el ejercicio académico»); nunca se presenta como dato de diseño.'); continue; }
    const reg = { valor: d.estado === 'PENDIENTE' ? null : valor, unidad: def.unidad, estado: d.estado, origen: d.origen || null, registrado: new Date().toISOString() };
    const ant = e.datos[d.clave]; e.datos[d.clave] = reg;
    e.decisiones.push({ t: reg.registrado, tipo: ant ? 'dato_cambiado' : 'dato_registrado', clave: d.clave, antes: ant ? { valor: ant.valor, estado: ant.estado } : null, despues: { valor: reg.valor, estado: reg.estado } });
    aceptados.push({ clave: d.clave, valor: reg.valor, estado: reg.estado });
  }
  guardar(pr, e); return { aceptados, rechazados };
}

const util = (d) => d && d.estado !== 'PENDIENTE' && d.valor !== null && d.valor !== undefined;

/** Plan por resultados a partir del encargo y del estado REAL del proyecto (planos, partidas, artefactos vigentes, aprobación). */
export function planEncargo(sandbox, nombre) {
  const pr = new Project(sandbox, nombre); pr.verificarTannia(); const e = leer(pr);
  if (!e) throw new UserError('SIN_ENCARGO', 'Aún no hay un encargo en este proyecto.');
  const inv = pr.leer(pr.p('.tannia', 'fuentes.json'), { recepciones: [], fuentes: [] });
  const defs = definiciones(e.perfil); const D = e.datos;
  const aplica = (d) => !(d.solo_si && D[d.solo_si]?.valor === false); // traslapo se pregunta junto con malla (una sola ronda)
  const faltan = defs.filter((d) => aplica(d) && !util(D[d.clave]));
  const hipotesis = Object.entries(D).filter(([, v]) => v.estado === 'HIPOTESIS').map(([k, v]) => ({ clave: k, valor: v.valor, motivo: v.origen?.motivo }));
  const vig = planosVigentes(pr); const rev = revisionVigente(pr); const arts = estadoArtefactos(pr, rev);
  const partidas = pr.partidas(); const deplanos = partidas.filter((p) => p.regla === REGLA_PLANOS);
  const viejas = deplanos.filter((p) => !vig || p.fuente?.plano_revision !== vig.head);
  const vigente = (t) => arts.some((a) => a.tipo === t && a.estado === 'vigente');
  const bloqueantes = (r) => faltan.filter((d) => d.bloquea.includes(r));
  const res = {};
  const paso = (r, estado, detalle, extra = {}) => { res[r] = { resultado: RESULTADOS[r], estado, detalle, ...extra }; };
  if (!e.soportado) for (const r of e.entregables) paso(r, 'NO_SOPORTADO', 'No hay un perfil de obra validado para este encargo; puedo organizar antecedentes y documentos, pero no generar planos ni cubicar sin especificación.');
  else {
    const bp = bloqueantes('planos');
    paso('planos', vig ? (vig.integridad === 'integra' ? 'HECHO' : 'REVISAR') : bp.length ? 'BLOQUEADO' : 'LISTO', vig ? `Revisión ${vig.head} (borrador para revisión; AutoCAD real no verificado).` : bp.length ? `Falta: ${bp.map((d) => d.pregunta).join(' ')}` : 'Con los datos registrados se pueden generar.', { faltan: bp.map((d) => d.clave) });
    const bc = bloqueantes('cantidades');
    paso('cantidades', deplanos.length && !viejas.length ? 'HECHO' : viejas.length ? 'DESACTUALIZADO' : (!vig || bc.length) ? 'BLOQUEADO' : 'LISTO', viejas.length ? `${viejas.length} partida(s) salieron de otra revisión de planos: hay que regenerarlas.` : deplanos.length ? `${deplanos.length} partida(s) medidas desde los planos vigentes.` : !vig ? 'Primero los planos.' : 'Se pueden llevar las cantidades de los planos al presupuesto.', { faltan: bc.map((d) => d.clave) });
    const bpr = bloqueantes('presupuesto'); const sinApu = partidas.filter((p) => !p.apu).map((p) => p.codigo);
    paso('presupuesto', vigente('presupuesto_xlsx') && !bpr.length ? 'HECHO' : !deplanos.length ? 'BLOQUEADO' : bpr.length || sinApu.length ? 'PARCIAL' : 'LISTO', bpr.length || sinApu.length ? `Sin ${[...bpr.map((d) => d.clave), ...(sinApu.length ? [`APU de ${sinApu.join(', ')}`] : [])].join(', ')}: el Excel sale con cantidades y precios PENDIENTES, sin total final.` : vigente('presupuesto_xlsx') ? 'Excel de la revisión vigente.' : 'Se puede generar.', { faltan: [...bpr.map((d) => d.clave), ...sinApu.map((c) => `apu:${c}`)] });
    paso('memoria', vigente('memoria_pdf') ? 'HECHO' : !deplanos.length ? 'BLOQUEADO' : 'LISTO', vigente('memoria_pdf') ? 'Memoria de la revisión vigente.' : 'Se genera con las mismas cifras del presupuesto.');
    const estado = pr.meta().estado;
    paso('entrega', estado === 'entregable' ? 'HECHO' : estado === 'aprobado' ? 'LISTO' : 'AUTORIZACION_PENDIENTE', estado === 'aprobado' ? 'Aprobada por una persona: se puede exportar.' : 'Requiere que una persona revise y apruebe en la ventana de autorización; Claude no puede aprobar.');
  }
  // Una sola ronda inicial: las preguntas se agrupan; las ya hechas no se repiten como nuevas.
  const yaHechas = new Set(e.preguntas_hechas || []);
  const quiereFort = /fortific|perno|malla/i.test(e.objetivo) || ['perno_longitud_m', 'espaciamiento_transversal_m', 'espaciamiento_longitudinal_m', 'malla'].some((k) => D[k]);
  const preguntas = faltan.filter((d) => !d.bloquea.includes('fortificacion') || quiereFort).map((d) => ({ clave: d.clave, pregunta: d.pregunta, por_que: d.por_que, si_no_se_sabe: d.si_no_se_sabe, unidad: d.unidad, ya_preguntada: yaHechas.has(d.clave) }));
  const parametros = e.perfil === 'tunel' ? parametrosTunel(D) : null;
  return { encargo: e.id, objetivo: e.objetivo, perfil: e.perfil, perfil_nombre: PERFILES[e.perfil]?.nombre || null, limites: PERFILES[e.perfil]?.limites || ['Perfil de obra no validado.'], antecedentes: { recepciones: inv.recepciones.length, documentos: inv.fuentes.length, legibles: inv.fuentes.filter((f) => f.lectura === 'LEIDO').length, pendientes: inv.fuentes.filter((f) => f.lectura === 'PENDIENTE').length, no_leidos: inv.fuentes.filter((f) => f.lectura === 'NO_LEIDO').length }, resultados: Object.values(res), preguntas, hipotesis, datos: D, parametros_motor: parametros, revision_datos: rev.id };
}

/** Parámetros para tannia_planos generar_tunel SOLO con datos registrados (nunca valores por defecto). */
export function parametrosTunel(D) {
  const v = (k) => (util(D[k]) ? D[k].valor : undefined);
  const base = { length: v('largo_m'), width: v('ancho_m'), wall: v('altura_hastial_m'), selected: v('espesor_revestimiento_m') };
  if (Object.values(base).some((x) => x === undefined)) return null;
  const f = { perno_longitud: v('perno_longitud_m'), espaciamiento_transversal: v('espaciamiento_transversal_m'), espaciamiento_longitudinal: v('espaciamiento_longitudinal_m'), malla: v('malla') };
  if (f.malla === true) f.traslapo_malla_pct = v('traslapo_malla_pct');
  const fortOk = [f.perno_longitud, f.espaciamiento_transversal, f.espaciamiento_longitudinal].every((x) => x !== undefined) && f.malla !== undefined && (f.malla === false || f.traslapo_malla_pct !== undefined);
  return { ...base, ...(fortOk ? { fortificacion: f } : {}) };
}

/** Registra que las preguntas se hicieron (una sola ronda) para no repetirlas como nuevas. */
export function marcarPreguntadas(sandbox, nombre, claves) {
  const pr = new Project(sandbox, nombre); const e = leer(pr); if (!e) return;
  e.preguntas_hechas = [...new Set([...(e.preguntas_hechas || []), ...claves])]; e.decisiones.push({ t: new Date().toISOString(), tipo: 'preguntas_realizadas', claves }); guardar(pr, e);
}

/** Mensaje breve (2–5 líneas) en lenguaje de obra para la persona. */
const CORTO = { Planos: 'los planos', Cubicaciones: 'las cubicaciones', 'Presupuesto (Excel)': 'el presupuesto', 'Memoria de cálculo': 'la memoria', 'Carpeta de entrega': 'la carpeta de entrega' };
const yLista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
export function mensajeEncargo(plan) {
  const a = plan.antecedentes; const l = [];
  if (a.documentos) l.push(`Tengo ${a.documentos} documento${a.documentos === 1 ? '' : 's'} del expediente (${a.legibles} ${a.legibles === 1 ? 'legible' : 'legibles'}${a.pendientes ? `, ${a.pendientes} para revisión visual o AutoCAD` : ''}${a.no_leidos ? `, ${a.no_leidos} sin abrir` : ''}).`);
  if (!plan.perfil || plan.resultados.every((r) => r.estado === 'NO_SOPORTADO')) { l.push('Para este tipo de obra no tengo un generador de planos validado: puedo ordenar los antecedentes y preparar documentos, pero no inventar planos ni cubicaciones.'); return l.join(' '); }
  const listo = plan.resultados.filter((r) => ['LISTO', 'HECHO'].includes(r.estado) && r.resultado !== 'Carpeta de entrega').map((r) => CORTO[r.resultado] || r.resultado);
  const bloq = plan.resultados.filter((r) => ['BLOQUEADO', 'PARCIAL', 'DESACTUALIZADO'].includes(r.estado));
  if (listo.length) l.push(`Puedo avanzar con ${yLista(listo)}.`);
  if (plan.preguntas.length) { const afect = [...new Set(plan.resultados.filter((r) => ['BLOQUEADO', 'PARCIAL'].includes(r.estado)).map((r) => CORTO[r.resultado] || r.resultado))]; l.push(`Para completar ${afect.length ? yLista(afect) : 'el resto'} necesito ${plan.preguntas.length === 1 ? 'un dato' : `${plan.preguntas.length} datos`}; se los pregunto todos juntos ahora. Lo que no se sepa queda pendiente: no lo invento.`); }
  else if (bloq.length) l.push(bloq.map((r) => `${r.resultado}: ${r.detalle}`).join(' '));
  if (plan.hipotesis.length) l.push(`Trabajo con ${plan.hipotesis.length} hipótesis declarada(s); quedan rotuladas como tales, no como diseño aprobado.`);
  return l.join(' ');
}
