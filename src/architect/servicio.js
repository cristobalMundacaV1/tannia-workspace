// Servicio de estudios arquitectónicos: versiones inmutables y transaccionales (reutiliza commitConHistorial de TW-09).
// Todo bajo "03 Trabajo/Arquitectura/<estudio>/". Cada versión guarda el estado completo (brief, sitio, clima, alternativas, selección);
// las evaluaciones se RECALCULAN de forma determinista al leer (nunca quedan desfasadas) y llevan hash de entrada.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { FOLDERS } from '../security/sandbox.js';
import { Project, readJson } from '../project/store.js';
import { commitConHistorial, mutarHistorial, reconciliar } from '../project/transaccion.js';
import { slug } from '../design/servicio.js';
import { escribirDxf } from '../design/salidas.js';
import { interpretarEncargo, programaDeBrief, diffBrief, grafoRelaciones } from './briefing.js';
import { actualizarSitio, retranqueosParaGenerar, antecedentesFaltantes, verificarContraSitio, agregarRestriccionUrbana } from './sitio.js';
import { parsearEpw, perfilesClima } from './clima.js';
import { generarAlternativas } from './alternativas.js';
import { derivarEsquema } from './derivar_poly.js';
import { evaluarEsquema, compararMultiobjetivo, criticar, decisionesDe } from './evaluacion.js';
import { estudioAlero } from './sombras.js';
import { esquemaA3d } from './a3d.js';
import { hojaComparativa, planoSvg, diagramaSombras } from './reporte.js';
import { validar } from './schemas.js';
import { VERSION_MOTOR } from './version.js';
import { Modelos3d } from '../arq3d/servicio.js';
import { Anteproyectos, verificarDxfContraModelo } from '../design/servicio.js';

const RAIZ = 'Arquitectura';
const num3 = (n) => String(n).padStart(3, '0');
const shaDe = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

export class Estudios {
  constructor(sandbox) { this.sandbox = sandbox; }
  #dir(nombre) { const n = slug(nombre); if (!n) throw new UserError('NOMBRE_INVALIDO', 'Falta el nombre del estudio.'); return { n, rel: `${FOLDERS.trabajo}/${RAIZ}/${n}` }; }
  #abs(project, rel) { return this.sandbox.resolveWritable(project, rel).abs; }
  #hist(project, nombre) {
    const { rel } = this.#dir(nombre); const f = this.#abs(project, `${rel}/historial.json`);
    if (!fs.existsSync(f)) throw new UserError('ESTUDIO_NO_EXISTE', `No existe el estudio "${nombre}".`, 'Créelo con tannia_arq_encargo.');
    try { reconciliar(this.#abs(project, rel), () => (readJson(f, null)?.versiones ?? []).map((v) => v.id)); } catch { /* nunca bloquea la lectura */ }
    return { h: readJson(f, null), f, rel };
  }
  listar(project) {
    const base = this.#abs(project, `${FOLDERS.trabajo}/${RAIZ}`); if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'historial.json'))).map((d) => { const h = readJson(path.join(base, d.name, 'historial.json'), {}); return { nombre: h.nombre, head: h.head, versiones: h.versiones?.length ?? 0 }; });
  }
  cargar(project, nombre, version) {
    const { h, rel } = this.#hist(project, nombre); const id = version || h.head;
    if (!h.versiones.some((v) => v.id === id)) throw new UserError('VERSION_NO_EXISTE', `No existe la versión ${id}.`, `Versiones: ${h.versiones.map((v) => v.id).join(', ')}.`);
    const reg = readJson(this.#abs(project, `${rel}/${id}.json`), null);
    return { h, rel, id, reg, estado: reg.estado };
  }
  #commit(project, nombre, { estado, descripcion, archivos = [], creando = false }) {
    const { n, rel } = this.#dir(nombre); const f = this.#abs(project, `${rel}/historial.json`); const creada = new Date().toISOString();
    let numero = 1; let base = null; let padre = null;
    if (!creando) { const { h } = this.#hist(project, nombre); numero = Math.max(...h.versiones.map((v) => Number(v.id.slice(1)))) + 1; base = h.head; padre = h.head; }
    const id = `v${num3(numero)}`; const reg = { id, numero, padre, creada, descripcion, motor: VERSION_MOTOR, estado_sha256: shaDe(estado), estado };
    const entrada = { id, padre, creada, descripcion };
    const tx = creando ? { nuevo: { nombre: n, creado: creada, head: id, redo: [], versiones: [entrada] } } : { base, entrada };
    commitConHistorial({ dir: this.#abs(project, rel), historial: f, id, archivos: [{ nombre: `${id}.json`, contenido: JSON.stringify(reg, null, 2) }, ...archivos.map((a) => ({ nombre: `${id}-${a.nombre}`, contenido: a.contenido }))], ...tx, errorExiste: new UserError('ESTUDIO_EXISTE', `Ya existe el estudio "${n}".`, 'Use otro nombre o refine el existente.'), raiz: this.sandbox.projectRoot(project) });
    new Project(this.sandbox, project).audit(creando ? 'estudio_arq_creado' : 'estudio_arq_version', { nombre: n, version: id });
    return { id, rel, numero };
  }

  // ---------- cálculo determinista de evaluaciones ----------
  calcular(estado) {
    const evals = Object.values(estado.alternativas).map((a) => { const esq = a.esquema; const geo = derivarEsquema(esq); const aleros = estado.aleros?.[esq.id] ?? []; const e = evaluarEsquema({ esq, geo, brief: estado.brief, sitio: estado.sitio, perfil: estado.clima?.perfiles ?? null, aleros }); return { id: esq.id, ...e, esq, geo, gatesFallidos: e.analisis.hard_gates.filter((g) => !g.passed).map((g) => g.id) }; });
    const comparacion = evals.length ? compararMultiobjetivo(evals) : null; return { evals, comparacion };
  }
  #resumenAlt(e) { return { id: e.id, concepto: e.esq.concept, huella_m2: e.geo.huella.area_m2, util_m2: e.geo.areas.util_neta_m2, clase_huella: e.detalle.constructibilidad.clase_huella, bloqueada: e.bloqueada, requisitos_fallidos: e.gatesFallidos, estado_global: e.analisis.global_state, alertas_criticas: e.analisis.alerts.filter((a) => a.severidad === 'critica').length, objetivos: e.objetivos.map((o) => ({ id: o.id, objetivo: o.kind, estado: o.estado, indice: o.score, aviso: o.aviso, razon: o.razon })), motivo: e.esq.rationale }; }

  crear(project, { nombre, texto }) {
    const { n } = this.#dir(nombre); const r = interpretarEncargo(texto, { projectId: new Project(this.sandbox, project).name });
    const estado = { nombre: n, brief: r.brief, sitio: actualizarSitio(null, {}), clima: null, alternativas: {}, aleros: {}, seleccion: null, publicaciones: [], semilla: 0, supuestos: [] };
    const c = this.#commit(project, nombre, { estado, descripcion: 'Encargo interpretado (brief v1)', creando: true });
    return { nombre: n, version: c.id, brief: r.brief, hechos: r.hechos, preguntas: r.preguntas, pregunta_esencial: r.pregunta_esencial, puede_generar: r.puede_generar_conceptos, grafo_relaciones: grafoRelaciones(r.brief), faltantes: antecedentesFaltantes(estado.sitio), rel: c.rel };
  }
  encargo(project, nombre, texto) {
    const cur = this.cargar(project, nombre); const r = interpretarEncargo(texto, { projectId: cur.estado.brief.project_id, previo: cur.estado.brief }); const cambios = diffBrief(cur.estado.brief, r.brief);
    const estado = { ...cur.estado, brief: r.brief, alternativas: cur.estado.alternativas }; // las alternativas previas se conservan; se reevalúan contra el brief nuevo
    const c = this.#commit(project, nombre, { estado, descripcion: `Encargo actualizado (brief v${r.brief.version})` });
    return { version: c.id, cambios, brief: r.brief, preguntas: r.preguntas, puede_generar: r.puede_generar_conceptos, nota: 'Las alternativas existentes se conservan en sus versiones anteriores; regenere para reflejar el encargo nuevo.' };
  }
  sitio(project, nombre, cambios) {
    const cur = this.cargar(project, nombre); const s = actualizarSitio(cur.estado.sitio, cambios);
    const c = this.#commit(project, nombre, { estado: { ...cur.estado, sitio: s }, descripcion: 'Contexto de sitio actualizado' });
    return { version: c.id, sitio: s, faltantes: antecedentesFaltantes(s), estado_sitio: s.status, nota: s.status === 'solar_study_possible' ? 'Hay datos suficientes para estudiar sol y sombra.' : 'Sin norte verdadero, coordenadas y zona horaria confirmados no se afirman horas de sol reales.' };
  }
  restriccion(project, nombre, { requisito, valor, fecha_fuente }) {
    const cur = this.cargar(project, nombre); const f = cur.estado.sitio.sources.filter((x) => ['cip', 'prc', 'other'].includes(x.kind)).at(-1);
    const sitio = agregarRestriccionUrbana(cur.estado.sitio, { requisito, valor, fuente_id: f?.id ?? null, fecha_fuente });
    const c = this.#commit(project, nombre, { estado: { ...cur.estado, sitio }, descripcion: `Restricción urbana registrada (${requisito}) con fuente ${f.id}` });
    return { version: c.id, sitio, faltantes: antecedentesFaltantes(sitio), estado_sitio: sitio.status, nota: 'Restricción registrada como DATO con fuente y fecha; verificación contra el dato ingresado, no certificación.' };
  }
  clima(project, nombre, ruta) {
    const cur = this.cargar(project, nombre); const abs = this.sandbox.resolve(project, ruta).abs; const st = fs.statSync(abs);
    if (st.size > 25 * 1024 * 1024) throw new UserError('EPW_MUY_GRANDE', 'El archivo de clima excede 25 MB.');
    const r = parsearEpw(fs.readFileSync(abs, 'utf8'), { nombre: path.basename(abs) }); const perfiles = perfilesClima(r);
    const estado = { ...cur.estado, clima: { meta: r.clima, estacion: r.estacion, perfiles, comentarios_archivo: r.comentarios_archivo } };
    const c = this.#commit(project, nombre, { estado, descripcion: `Clima cargado (${path.basename(abs)})` });
    return { version: c.id, clima: r.clima, estacion: r.estacion, resumen: Object.fromEntries(Object.entries(perfiles.estaciones).map(([k, v]) => [k, { temp_media_c: v.temperatura_c.media, viento_dominante_desde: v.viento.direccion_dominante_desde }])), salvedades: perfiles.salvedades };
  }
  generar(project, nombre, { semilla = 0, conceptos } = {}) {
    const cur = this.cargar(project, nombre); const { brief, sitio } = cur.estado; const prog = programaDeBrief(brief);
    if (prog.superficie_m2 == null) throw new UserError('FALTA_SUPERFICIE', 'Falta la superficie objetivo en el encargo (no se inventa).', 'Pregunte cuántos m² construidos desea y actualice el encargo.');
    const acceso = sitio.street_access[0]?.side ?? null; const n = sitio.true_north_deg_from_local_plus_y_clockwise;
    const hem = sitio.coordinates ? (sitio.coordinates.lat < 0 ? 'S' : 'N') : null;
    const dur = brief.hard_constraints.find((h) => h.kind === 'footprint_class'); const cs = conceptos?.length ? conceptos : undefined; void dur;
    const g = generarAlternativas({ programa: prog, predio: sitio.parcel_polygon_mm ? { ring: sitio.parcel_polygon_mm.ring } : null, acceso, norte_deg: n && n.estado === 'confirmed' ? n.valor : null, hemisferio: hem, retranqueos: retranqueosParaGenerar(sitio, acceso), conceptos: cs, semilla, briefRef: shaDe(brief).slice(0, 16), siteRef: sitio.parcel_polygon_mm ? shaDe(sitio).slice(0, 16) : null, vistas: brief.objectives.filter((o) => o.kind === 'sightline').map((o) => ({ from: o.from, to: o.to })) });
    const alternativas = {}; for (const a of g.alternativas) { const z = validar('scheme', a.esquema); if (!z.ok) throw new UserError('ESQUEMA_INVALIDO', z.errores.join(' | ')); alternativas[a.esquema.id] = { esquema: z.valor, supuestos: a.supuestos, area_m2: a.area_m2, encaje: a.encaje }; }
    const estadoNuevo = { ...cur.estado, alternativas, aleros: {}, seleccion: null, semilla, supuestos: [...new Set(g.alternativas.flatMap((a) => a.supuestos))] };
    const { evals, comparacion } = this.calcular(estadoNuevo);
    const archivos = [];
    const items = evals.map((e) => { const svg = planoSvg(e.esq, e.geo, e.id); archivos.push({ nombre: `${e.id}.svg`, contenido: svg }); return { titulo: `${e.id} (${e.esq.concept})`, svg, lineas: [`Huella ${e.geo.huella.area_m2} m² · útil ${e.geo.areas.util_neta_m2} m²`, `Huella: ${e.detalle.constructibilidad.clase_huella} · envolvente ${e.detalle.constructibilidad.indice_envolvente}`, e.bloqueada ? `BLOQUEADA: ${e.gatesFallidos.join(', ')}` : `Estado: ${e.analisis.global_state}`, `Alertas críticas: ${e.analisis.alerts.filter((a) => a.severidad === 'critica').length}`] }; });
    if (items.length) archivos.push({ nombre: 'comparacion.svg', contenido: hojaComparativa(items, { pie: [`Diversidad: ${g.diversidad.clases_de_huella} clases de huella, ${g.diversidad.topologias_distintas} topologías distintas.`, 'Frontera de Pareto: ' + (comparacion?.frontera_pareto?.join(', ') || '—'), 'La vista de líneas es un croquis; la decisión es suya y de la profesional.'] }) });
    if (sitio.status === 'solar_study_possible') for (const e of evals) { const d = diagramaSombras({ esq: e.esq, geo: e.geo, sitio, fecha: sitio.coordinates.lat < 0 ? '2026-06-21' : '2026-12-21' }); if (d) archivos.push({ nombre: `${e.id}-sombras-invierno.svg`, contenido: d }); }
    const c = this.#commit(project, nombre, { estado: estadoNuevo, descripcion: `Alternativas generadas (${evals.length}; semilla ${semilla})`, archivos });
    return { version: c.id, alternativas: evals.map((e) => this.#resumenAlt(e)), comparacion: this.#resumenCmp(comparacion), diversidad: { clases_de_huella: g.diversidad?.clases_de_huella ?? 0, topologias_distintas: g.diversidad?.topologias_distintas ?? 0, firmas: g.diversidad?.firmas.map((f) => f.huella.clase) ?? [] }, minimo_cumplido: g.minimo_cumplido, descartadas: g.descartadas, nota: g.nota, archivos: archivos.filter((a) => /comparacion|sombras/.test(a.nombre)).map((a) => `${c.rel}/${c.id}-${a.nombre}`), supuestos: estadoNuevo.supuestos, entrada_hash: g.entrada_hash };
  }
  #resumenCmp(c) { if (!c) return null; return { estado: c.estado, frontera_pareto: c.frontera_pareto, dimensiones: c.dimensiones, no_comparables: c.no_comparables, bloqueadas: c.bloqueadas, pesos_visibles: c.pesos_visibles, estabilidad_del_lider: c.sensibilidad?.estabilidad ?? null, lider_estable: c.sensibilidad?.lider_estable ?? null, contrafactuales: c.contrafactuales, aviso: c.aviso_ranking, tabla: c.tabla }; }

  ver(project, nombre, version) {
    const cur = this.cargar(project, nombre, version); const { evals, comparacion } = this.calcular(cur.estado);
    return { version: cur.id, historial: cur.h.versiones.map((v) => v.id), head: cur.h.head, brief: cur.estado.brief, sitio_estado: cur.estado.sitio.status, clima: cur.estado.clima?.meta ?? null, alternativas: evals.map((e) => this.#resumenAlt(e)), comparacion: this.#resumenCmp(comparacion), seleccion: cur.estado.seleccion, publicaciones: cur.estado.publicaciones, faltantes: antecedentesFaltantes(cur.estado.sitio) };
  }
  evaluar(project, nombre, { alternativa, version } = {}) {
    const cur = this.cargar(project, nombre, version); const { evals, comparacion } = this.calcular(cur.estado); const e = alternativa ? evals.find((x) => x.id === alternativa) : (evals.length === 1 ? evals[0] : cur.estado.seleccion ? evals.find((x) => x.id === cur.estado.seleccion) : null);
    if (!e) throw new UserError('ALTERNATIVA_NO_EXISTE', `Indique la alternativa (${evals.map((x) => x.id).join(', ') || 'ninguna generada aún'}).`);
    return { version: cur.id, alternativa: e.id, analisis: e.analisis, objetivos: e.objetivos, detalle: { recorridos: e.detalle.recorridos, seguridad: e.detalle.seguridad, privacidad: e.detalle.privacidad, constructibilidad: e.detalle.constructibilidad, viento: e.detalle.viento, sol: e.detalle.sol ? { verano: this.#solRes(e.detalle.sol.verano), invierno: this.#solRes(e.detalle.sol.invierno) } : null }, sitio_urbano: verificarContraSitio(e.geo, cur.estado.sitio), critica: criticar(e, comparacion, e.esq) };
  }
  #solRes(s) { return s ? { estado: s.estado, fecha: s.fecha, ventanas: s.ventanas?.map((v) => ({ id: v.id, recinto: v.recinto, lado: v.lado, horas_sol_directo: v.horas_sol_directo })), limites: s.limites, razon: s.razon ?? null } : null; }
  comparar(project, nombre, version) { const cur = this.cargar(project, nombre, version); const { evals, comparacion } = this.calcular(cur.estado); if (!evals.length) throw new UserError('SIN_ALTERNATIVAS', 'Aún no hay alternativas: use tannia_arq_generar_alternativas.'); return { version: cur.id, comparacion: this.#resumenCmp(comparacion), alternativas: evals.map((e) => this.#resumenAlt(e)) }; }
  decisiones(project, nombre, { alternativa, version } = {}) {
    const cur = this.cargar(project, nombre, version); const { evals, comparacion } = this.calcular(cur.estado); const id = alternativa ?? cur.estado.seleccion; const e = evals.find((x) => x.id === id);
    if (!e) throw new UserError('ALTERNATIVA_NO_EXISTE', 'Indique la alternativa o selecciónela primero.');
    return { version: cur.id, alternativa: e.id, decisiones: decisionesDe({ evalElegida: e, brief: cur.estado.brief, comparacion, schemeId: e.id }), aviso: 'Cada decisión conserva objetivo, evidencia (o su ausencia), compromisos e incertidumbre; ninguna está aprobada por una profesional.' };
  }

  /** Refinar = nueva versión. Operaciones: aleros | prioridad | seleccionar | norte (vía sitio) | programa (regenera). */
  refinar(project, nombre, op) {
    const cur = this.cargar(project, nombre); const estado = JSON.parse(JSON.stringify(cur.estado)); let desc;
    if (op.tipo === 'aleros') {
      const alt = estado.alternativas[op.alternativa]; if (!alt) throw new UserError('ALTERNATIVA_NO_EXISTE', 'Alternativa inexistente.');
      const geo = derivarEsquema(alt.esquema); const seg = geo.murosSeg.find((s) => s.tipo === 'ext' && s.recinto === op.recinto && s.lado === op.lado); if (!seg) throw new UserError('FACHADA_NO_EXISTE', `El recinto ${op.recinto} no tiene muro exterior ${op.lado}.`);
      if (!(op.profundidad_mm >= 0 && op.profundidad_mm <= 2000)) throw new UserError('ALERO_INVALIDO', 'Profundidad de alero entre 0 y 2000 mm.');
      estado.aleros[op.alternativa] = [...(estado.aleros[op.alternativa] ?? []).filter((a) => !(a.fachada.recinto === op.recinto && a.fachada.lado === op.lado)), ...(op.profundidad_mm > 0 ? [{ fachada: { recinto: op.recinto, lado: op.lado }, profundidad_mm: op.profundidad_mm }] : [])];
      desc = `Alero ${op.profundidad_mm} mm en ${op.recinto}/${op.lado} de ${op.alternativa} (geometría sin cambios; solo se recalcula el sol)`;
    } else if (op.tipo === 'prioridad') {
      const o = estado.brief.objectives.find((x) => x.id === op.objetivo || x.kind === op.objetivo); if (!o) throw new UserError('OBJETIVO_NO_EXISTE', 'Objetivo inexistente en el brief.');
      o.priority = op.prioridad; estado.brief.version += 1; desc = `Prioridad de "${o.kind}" → ${op.prioridad}`;
    } else if (op.tipo === 'seleccionar') { if (!estado.alternativas[op.alternativa]) throw new UserError('ALTERNATIVA_NO_EXISTE', 'Alternativa inexistente.'); estado.seleccion = op.alternativa; desc = `Alternativa elegida: ${op.alternativa}`; }
    else throw new UserError('OPERACION_NO_SOPORTADA', 'Operaciones: aleros, prioridad, seleccionar. Para norte/sitio use tannia_arq_sitio; para cambios de programa, tannia_arq_encargo y regenerar.');
    const antes = this.calcular(cur.estado); const despues = this.calcular(estado);
    const cambios = despues.evals.map((e) => { const a = antes.evals.find((x) => x.id === e.id); const ma = Object.fromEntries(a.analisis.metrics.map((m) => [m.id, m.valor])); const mb = Object.fromEntries(e.analisis.metrics.map((m) => [m.id, m.valor])); return { alternativa: e.id, geometria_cambio: shaDe(a.esq) !== shaDe(e.esq), metricas_cambiadas: Object.keys(mb).filter((k) => ma[k] !== mb[k]).map((k) => ({ metrica: k, antes: ma[k], despues: mb[k] })) }; });
    const c = this.#commit(project, nombre, { estado, descripcion: desc });
    return { version: c.id, padre: cur.id, descripcion: desc, cambios, nota: 'La versión anterior no se modifica; puede volver a ella con el historial.' };
  }
  estudioAlero(project, nombre, { alternativa, recinto, lado, version }) {
    const cur = this.cargar(project, nombre, version); const alt = cur.estado.alternativas[alternativa]; if (!alt) throw new UserError('ALTERNATIVA_NO_EXISTE', 'Alternativa inexistente.'); const geo = derivarEsquema(alt.esquema);
    return estudioAlero({ esq: alt.esquema, geo, sitio: cur.estado.sitio, fachada: { recinto, lado } });
  }

  historial(project, nombre, accion, version) {
    const { h, f, rel } = this.#hist(project, nombre); if (accion === 'listar') return { head: h.head, redo: h.redo, versiones: h.versiones };
    return mutarHistorial({ dir: this.#abs(project, rel), historial: f, raiz: this.sandbox.projectRoot(project), fn: (hh) => { const hay = (i) => hh.versiones.find((v) => v.id === i); if (accion === 'deshacer') { const v = hay(hh.head); if (!v.padre) throw new UserError('NADA_QUE_DESHACER', 'Ya está en la versión inicial.'); hh.redo.push(hh.head); hh.head = v.padre; } else if (accion === 'rehacer') { const r = hh.redo.pop(); if (!r) throw new UserError('NADA_QUE_REHACER', 'No hay cambios deshechos.'); hh.head = r; } else { if (!version || !hay(version)) throw new UserError('VERSION_NO_EXISTE', 'Versión inexistente.'); hh.redo = []; hh.head = version; } return { head: hh.head, redo: hh.redo }; } });
  }

  /** Publica la alternativa elegida: DXF + SVG + modelo 3D (versión inmutable en Modelos3D). El DWG lo genera la herramienta CAD existente. */
  publicar(project, nombre, { alternativa, version } = {}) {
    const cur = this.cargar(project, nombre, version); const id = alternativa ?? cur.estado.seleccion; const alt = cur.estado.alternativas[id]; if (!alt) throw new UserError('ALTERNATIVA_NO_EXISTE', 'Elija una alternativa (tannia_arq_refinar seleccionar) o indíquela.');
    const geo = derivarEsquema(alt.esquema); if (geo.errores.length) throw new UserError('ESQUEMA_CON_ERRORES', `No se publica: ${geo.errores.map((e) => e.mensaje).join(' | ')}`);
    const { evals } = this.calcular(cur.estado); const ev = evals.find((e) => e.id === id);
    if (ev.bloqueada) throw new UserError('ALTERNATIVA_BLOQUEADA', `La alternativa no cumple requisitos duros del encargo: ${ev.gatesFallidos.join(', ')}.`, 'Ajuste el encargo o elija otra.');
    const num = cur.estado.publicaciones.length + 1; const pid = `p${num3(num)}`; const fecha = new Date().toISOString().slice(0, 10);
    const dxf = escribirDxf({ sistema: 'albanileria_confinada' }, geo, { titulo: `${cur.estado.nombre} ${id}`, version: `${cur.id}-${pid}`, fecha }); const cruz = verificarDxfContraModelo(dxf, geo);
    const svg = planoSvg(alt.esquema, geo, `${cur.estado.nombre} ${id}`);
    const modelo3d = esquemaA3d(alt.esquema, geo, { cubierta_visible: false, origen: { tipo: 'esquema_arq', estudio: cur.estado.nombre, version: cur.id, esquema: id, esquema_sha256: shaDe(alt.esquema) } });
    const nombre3d = `${slug(cur.estado.nombre)} ${id} ${pid}`; const M = new Modelos3d(this.sandbox, new Anteproyectos(this.sandbox)); const r3 = M.crear(project, { nombre: nombre3d, modelo: modelo3d, solicitud: cur.estado.brief.request_original });
    const informe = { estudio: cur.estado.nombre, version_estudio: cur.id, alternativa: id, publicacion: pid, fecha, esquema_sha256: shaDe(alt.esquema), analisis_input_hash: ev.analisis.input_hash, motor: VERSION_MOTOR, verificacion_dxf: cruz, estado_global: ev.analisis.global_state, alertas: ev.analisis.alerts, disclaimers: ev.analisis.disclaimers, modelo_3d: { nombre: nombre3d, version: r3.version, sha256: r3.reg.modelo_sha256, solidos: r3.reg.resumen_geometria.n_primitivas } };
    const estado = { ...cur.estado, publicaciones: [...cur.estado.publicaciones, { id: pid, alternativa: id, modelo_3d: nombre3d, version_3d: r3.version, esquema_sha256: informe.esquema_sha256 }] };
    const c = this.#commit(project, nombre, { estado, descripcion: `Publicación ${pid} de ${id}`, archivos: [{ nombre: `${pid}.dxf`, contenido: dxf }, { nombre: `${pid}.svg`, contenido: svg }, { nombre: `${pid}-informe.json`, contenido: JSON.stringify(informe, null, 2) }] });
    return { version: c.id, publicacion: pid, archivos: { dxf: `${c.rel}/${c.id}-${pid}.dxf`, svg: `${c.rel}/${c.id}-${pid}.svg`, informe: `${c.rel}/${c.id}-${pid}-informe.json` }, modelo_3d: { nombre: nombre3d, version: r3.version, solidos: informe.modelo_3d.solidos }, verificacion_dxf: { ok: cruz.ok, discrepancias: cruz.discrepancias ?? [] }, estado_global: informe.estado_global, siguiente: `Para el DWG 3D use tannia_3d_a_autocad con el modelo "${nombre3d}".` };
  }
  rutaDxf(project, nombre, pid) { const cur = this.cargar(project, nombre); const rel = `${cur.rel}/${cur.id}-${pid}.dxf`; return { rel, existe: fs.existsSync(this.#abs(project, rel)) }; }
  _ruta(project, nombre) { return this.cargar(project, nombre); }
  bloqueDxf(project, nombre, pid) { const { h, rel } = this.#hist(project, nombre); for (const v of [...h.versiones].reverse()) { const f = `${rel}/${v.id}-${pid}.dxf`; if (fs.existsSync(this.#abs(project, f))) return f; } return null; }
}
