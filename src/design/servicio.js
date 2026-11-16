// Servicio de anteproyectos: crear, modificar, ver, historial (deshacer/rehacer/restaurar) y verificación cruzada con el motor DXF.
// Todo se escribe bajo "03 Trabajo/Anteproyectos/<nombre>/" (nunca en originales). Cada versión es inmutable.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { FOLDERS } from '../security/sandbox.js';
import { Project, atomicWriteJson, readJson } from '../project/store.js';
import { commitVersion, reconciliar } from '../project/transaccion.js';
import { VERSION } from '../version.js';
import { generarModelo } from './generador.js';
import { derivar } from './derivar.js';
import { verificarCoherencia } from './coherencia.js';
import { aplicarOperacion, CATALOGO } from './operaciones.js';
import { escribirDxf, escribirSvg, vistaAscii, dxfDecode } from './salidas.js';
import { parseDxf } from '../dxf/reader.js';
import { measureDxf } from '../dxf/measure.js';

const RAIZ = 'Anteproyectos';
const num3 = (n) => String(n).padStart(3, '0');
const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
export const slug = (s) => String(s || '').trim().replace(/[\\/:*?"<>|\0]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/, '').slice(0, 60);

export function diff(prev, next, gPrev, gNext) {
  const cambios = []; let sinCambio = 0;
  for (const id of Object.keys(gNext.recintos)) {
    const a = gPrev.recintos[id]; const b = gNext.recintos[id];
    if (!a) { cambios.push({ recinto: id, nombre: b.nombre, cambio: 'nuevo', despues: { ancho_m: b.ancho_neto_mm / 1000, fondo_m: b.fondo_neto_mm / 1000, area_m2: b.area_neta_m2 } }); continue; }
    const igual = JSON.stringify(a.neto) === JSON.stringify(b.neto) && a.nombre === b.nombre;
    if (igual) { sinCambio++; continue; }
    cambios.push({ recinto: id, nombre: b.nombre, cambio: a.nombre !== b.nombre ? 'renombrado/modificado' : 'modificado', antes: { ancho_m: a.ancho_neto_mm / 1000, fondo_m: a.fondo_neto_mm / 1000, area_m2: a.area_neta_m2 }, despues: { ancho_m: b.ancho_neto_mm / 1000, fondo_m: b.fondo_neto_mm / 1000, area_m2: b.area_neta_m2 } });
  }
  for (const id of Object.keys(gPrev.recintos)) if (!gNext.recintos[id]) cambios.push({ recinto: id, nombre: gPrev.recintos[id].nombre, cambio: 'eliminado' });
  const idsP = new Map(prev.aberturas.map((a) => [a.id, a])); const idsN = new Map(next.aberturas.map((a) => [a.id, a]));
  const ab = { agregadas: [...idsN.keys()].filter((i) => !idsP.has(i)), eliminadas: [...idsP.keys()].filter((i) => !idsN.has(i)), modificadas: [...idsN.keys()].filter((i) => idsP.has(i) && JSON.stringify(idsP.get(i)) !== JSON.stringify(idsN.get(i))) };
  return { recintos_modificados: cambios, recintos_sin_cambio: sinCambio, aberturas: ab, superficie_construida_m2: { antes: gPrev.areas.construida_m2, despues: gNext.areas.construida_m2 } };
}

/** Verificación cruzada: el DXF escrito se vuelve a leer con el motor DXF del producto y se comparan áreas y conteos con el modelo. */
export function verificarDxfContraModelo(dxfTexto, geo) {
  const med = measureDxf(parseDxf(dxfTexto), { unidad_confirmada: 'mm' });
  const areasDxf = med.mediciones.filter((m) => m.capa === 'TW_RECINTO' && m.magnitud === 'area').map((m) => m.valor / 1e6).sort((a, b) => a - b);
  const areasModelo = Object.values(geo.recintos).map((r) => (r.ancho_neto_mm * r.fondo_neto_mm) / 1e6).sort((a, b) => a - b);
  const discrepancias = [];
  if (areasDxf.length !== areasModelo.length) discrepancias.push(`El DXF tiene ${areasDxf.length} recintos y el modelo ${areasModelo.length}.`);
  else areasModelo.forEach((v, i) => { if (Math.abs(v - areasDxf[i]) > 1e-6) discrepancias.push(`Área de recinto: modelo ${v.toFixed(4)} m² vs DXF ${areasDxf[i].toFixed(4)} m².`); });
  const L = med.totales_por_capa_unidades_dibujo || {};
  const parseado = parseDxf(dxfTexto);
  const textos = parseado.entities.filter((e) => e.type === 'TEXT').map((e) => dxfDecode(e.text));
  const capas = Object.keys(L);
  return { ok: discrepancias.length === 0, recintos_dxf: areasDxf.length, area_util_dxf_m2: +areasDxf.reduce((a, b) => a + b, 0).toFixed(4), area_util_modelo_m2: +areasModelo.reduce((a, b) => a + b, 0).toFixed(4), capas_medidas: capas, textos: textos.length, motor_dxf_necesita_revision: !!med.necesita_revision, discrepancias };
}

export class Anteproyectos {
  constructor(sandbox) { this.sandbox = sandbox; }

  #dir(project, nombre) {
    const n = slug(nombre); if (!n) throw new UserError('NOMBRE_INVALIDO', 'Falta el nombre del anteproyecto.');
    return { n, rel: `${FOLDERS.trabajo}/${RAIZ}/${n}` };
  }
  #abs(project, rel) { return this.sandbox.resolveWritable(project, rel).abs; }
  #historial(project, nombre) {
    const { rel } = this.#dir(project, nombre);
    const f = this.#abs(project, `${rel}/historial.json`);
    if (!fs.existsSync(f)) throw new UserError('ANTEPROYECTO_NO_EXISTE', `No existe el anteproyecto "${nombre}".`, 'Créelo con tannia_diseno_crear o consulte los existentes con tannia_diseno_ver.');
    const h = readJson(f, null); try { reconciliar(this.#abs(project, rel), h.versiones.map((v) => v.id)); } catch { /* la reconciliación nunca bloquea la lectura */ }
    return { h, f, rel };
  }
  listar(project) {
    const base = this.#abs(project, `${FOLDERS.trabajo}/${RAIZ}`);
    if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'historial.json'))).map((d) => { const h = readJson(path.join(base, d.name, 'historial.json'), {}); return { nombre: h.nombre, head: h.head, versiones: (h.versiones || []).length }; });
  }

  /** Escribe la versión como TRANSACCIÓN (staging + journal + manifiesto + historial). `actualizar` es el commit lógico del historial. */
  #escribirVersion(project, rel, id, registro, modelo, geo, coh, meta, actualizar) {
    const dxf = escribirDxf(modelo, geo, meta); const svg = escribirSvg(modelo, geo, meta); const cruzada = verificarDxfContraModelo(dxf, geo);
    const json = JSON.stringify({ ...registro, modelo, coherencia: coh, verificacion_dxf: cruzada, areas: geo.areas }, null, 2);
    commitVersion({ dir: this.#abs(project, rel), id, archivos: [{ nombre: `${id}.dxf`, contenido: dxf }, { nombre: `${id}.svg`, contenido: svg }, { nombre: `${id}.json`, contenido: json }], actualizarHistorial: actualizar, hook: this.hook || undefined });
    return { dxf: `${rel}/${id}.dxf`, svg: `${rel}/${id}.svg`, cruzada };
  }

  /** Reconcilia cortes previos (archivos huérfanos de una versión que no llegó al historial). */
  reconciliar(project, nombre) { const { rel } = this.#dir(project, nombre); const f = this.#abs(project, `${rel}/historial.json`); if (!fs.existsSync(f)) return null; const h = readJson(f, { versiones: [] }); return reconciliar(this.#abs(project, rel), h.versiones.map((v) => v.id)); }

  crear(project, { nombre, solicitud, programa = {} }) {
    const { n, rel } = this.#dir(project, nombre);
    const fh = this.#abs(project, `${rel}/historial.json`);
    if (fs.existsSync(fh)) throw new UserError('ANTEPROYECTO_EXISTE', `Ya existe el anteproyecto "${n}".`, 'Use otro nombre o refine el existente con tannia_diseno_modificar.');
    const modelo = generarModelo(programa); const geo = derivar(modelo); const coh = verificarCoherencia(modelo, geo);
    if (coh.errores.length) throw new UserError('DISENO_INCOHERENTE', `La distribución generada tiene inconsistencias geométricas: ${coh.errores.map((e) => e.mensaje).join(' | ')}`, 'Pruebe otra variante o ajuste el programa.', { errores: coh.errores });
    const id = `v${num3(1)}`; const creada = new Date().toISOString();
    const meta = { titulo: n, version: id, fecha: creada.slice(0, 10) };
    const registro = { id, numero: 1, padre: null, creada, descripcion: 'Versión inicial generada a partir de la solicitud', solicitud: solicitud || null, operaciones: [], resumen: 'Versión inicial', modelo_sha256: sha(modelo), generado_por: `tannia-workspace ${VERSION}` };
    const out = this.#escribirVersion(project, rel, id, registro, modelo, geo, coh, meta, () => atomicWriteJson(fh, { nombre: n, creado: creada, head: id, redo: [], versiones: [{ id, padre: null, creada, descripcion: registro.descripcion, resumen: registro.resumen, construida_m2: geo.areas.construida_m2 }] }));
    new Project(this.sandbox, project).audit('anteproyecto_creado', { nombre: n, version: id });
    return { nombre: n, version: id, modelo, geo, coherencia: coh, archivos: { dxf: out.dxf, svg: out.svg }, verificacion_dxf: out.cruzada };
  }

  cargar(project, nombre, version) {
    const { h, rel } = this.#historial(project, nombre);
    const id = version || h.head; if (!h.versiones.some((v) => v.id === id)) throw new UserError('VERSION_NO_EXISTE', `No existe la versión ${id}.`, `Versiones: ${h.versiones.map((v) => v.id).join(', ')}.`);
    const reg = readJson(this.#abs(project, `${rel}/${id}.json`), null);
    const modelo = reg.modelo; const geo = derivar(modelo);
    return { h, rel, id, reg, modelo, geo };
  }

  modificar(project, nombre, { operaciones, descripcion }) {
    const { h, f, rel } = this.#historial(project, nombre);
    const cur = this.cargar(project, nombre);
    if (!Array.isArray(operaciones) || !operaciones.length) throw new UserError('SIN_OPERACIONES', 'Indique al menos una operación.', `Operaciones: ${Object.keys(CATALOGO).join(', ')}.`);
    let modelo = cur.modelo; const resumenes = []; const retiradas = [];
    for (const [i, op] of operaciones.entries()) {
      try { const r = aplicarOperacion(modelo, op); modelo = r.modelo; resumenes.push(r.resumen); if (r.retiradas?.length) retiradas.push(...r.retiradas); }
      catch (e) { if (e instanceof UserError) throw new UserError(e.code, `Operación ${i + 1} (${op.operacion}): ${e.message}`, e.hint, e.detalle); throw e; }
    }
    const geo = derivar(modelo); const coh = verificarCoherencia(modelo, geo);
    if (coh.errores.length) throw new UserError('CAMBIO_RECHAZADO_INCOHERENTE', `El cambio dejaría la geometría inconsistente y NO se aplicó: ${coh.errores.map((e) => e.mensaje).join(' | ')}`, 'Pruebe un cambio menor o ajuste también lo que choca; el anteproyecto sigue en la versión anterior.', { errores: coh.errores });
    const numero = Math.max(...h.versiones.map((v) => Number(v.id.slice(1)))) + 1; const id = `v${num3(numero)}`; const creada = new Date().toISOString();
    const meta = { titulo: h.nombre, version: id, fecha: creada.slice(0, 10) };
    const registro = { id, numero, padre: cur.id, creada, descripcion: descripcion || resumenes.join('; '), operaciones, resumen: resumenes.join('; '), modelo_sha256: sha(modelo), generado_por: `tannia-workspace ${VERSION}` };
    const out = this.#escribirVersion(project, rel, id, registro, modelo, geo, coh, meta, () => { h.versiones.push({ id, padre: cur.id, creada, descripcion: registro.descripcion, resumen: registro.resumen, construida_m2: geo.areas.construida_m2 }); h.head = id; h.redo = []; atomicWriteJson(f, h); });
    new Project(this.sandbox, project).audit('anteproyecto_modificado', { nombre: h.nombre, version: id, operaciones: operaciones.map((o) => o.operacion) });
    return { nombre: h.nombre, version: id, padre: cur.id, resumen: resumenes, retiradas, cambios: diff(cur.modelo, modelo, cur.geo, geo), modelo, geo, coherencia: coh, archivos: { dxf: out.dxf, svg: out.svg }, verificacion_dxf: out.cruzada };
  }

  historial(project, nombre, accion, version) {
    const { h, f } = this.#historial(project, nombre);
    const idx = (id) => h.versiones.find((v) => v.id === id);
    if (accion === 'listar') return { head: h.head, redo: h.redo, versiones: h.versiones, arbol: h.versiones.map((v) => `${v.id}${v.padre ? ` ← ${v.padre}` : ''}${v.id === h.head ? '  (actual)' : ''}: ${v.descripcion}`) };
    if (accion === 'deshacer') { const v = idx(h.head); if (!v.padre) throw new UserError('NADA_QUE_DESHACER', 'Ya está en la versión inicial.'); h.redo.push(h.head); h.head = v.padre; }
    else if (accion === 'rehacer') { const r = h.redo.pop(); if (!r) throw new UserError('NADA_QUE_REHACER', 'No hay cambios deshechos para rehacer.'); h.head = r; }
    else if (accion === 'restaurar') { if (!version || !idx(version)) throw new UserError('VERSION_NO_EXISTE', `No existe la versión ${version}.`, `Versiones: ${h.versiones.map((v) => v.id).join(', ')}.`); if (h.head !== version) h.redo = []; h.head = version; }
    else throw new UserError('ACCION_INVALIDA', 'accion debe ser listar, deshacer, rehacer o restaurar.');
    atomicWriteJson(f, h);
    new Project(this.sandbox, project).audit('anteproyecto_historial', { nombre: h.nombre, accion, head: h.head });
    return { head: h.head, redo: h.redo, accion };
  }

  verificar(project, nombre, version) {
    const c = this.cargar(project, nombre, version);
    const coh = verificarCoherencia(c.modelo, c.geo);
    const dxf = fs.readFileSync(this.#abs(project, `${c.rel}/${c.id}.dxf`), 'utf8');
    const cruzada = verificarDxfContraModelo(dxf, c.geo);
    return { version: c.id, coherencia: coh, verificacion_dxf: cruzada, areas: c.geo.areas, indicadores: c.geo.indicadores };
  }

  /** Previsualización PURA: aplica las operaciones a una copia en memoria y devuelve el efecto; no escribe ni crea versión. */
  previsualizar(project, nombre, { operaciones }) {
    const cur = this.cargar(project, nombre);
    if (!Array.isArray(operaciones) || !operaciones.length) throw new UserError('SIN_OPERACIONES', 'Indique al menos una operación.', `Operaciones: ${Object.keys(CATALOGO).join(', ')}.`);
    let modelo = cur.modelo; const resumenes = [];
    try { for (const [i, op] of operaciones.entries()) { const r = aplicarOperacion(modelo, op); modelo = r.modelo; resumenes.push(r.resumen); void i; } }
    catch (e) { if (e instanceof UserError) return { aplicable: false, motivo: e.message, pista: e.hint ?? null, codigo: e.code, se_escribio_algo: false }; throw e; }
    const geo = derivar(modelo); const coh = verificarCoherencia(modelo, geo);
    return { aplicable: coh.errores.length === 0, motivo: coh.errores.length ? `Dejaría la geometría inconsistente: ${coh.errores.map((x) => x.mensaje).join(' | ')}` : null, resumen: resumenes, cambios: diff(cur.modelo, modelo, cur.geo, geo), errores: coh.errores, advertencias: coh.advertencias, areas: geo.areas, aberturas_invalidas: geo.aberturas.filter((a) => a.invalida).map((a) => ({ id: a.id, motivo: a.motivo })), se_escribio_algo: false,
      alcance: 'Previsualización geométrica: no crea versión ni archivos; que sea aplicable no es una aprobación estructural ni normativa.' };
  }

  rutas(project, nombre, version) { const c = this.cargar(project, nombre, version); return { version: c.id, dxf: `${c.rel}/${c.id}.dxf`, svg: `${c.rel}/${c.id}.svg`, abs_dxf: this.#abs(project, `${c.rel}/${c.id}.dxf`), abs_svg: this.#abs(project, `${c.rel}/${c.id}.svg`) }; }
}

export function resumenRecintos(geo) {
  return Object.values(geo.recintos).map((r) => ({ id: r.id, recinto: r.nombre, ancho_m: +(r.ancho_neto_mm / 1000).toFixed(2), fondo_m: +(r.fondo_neto_mm / 1000).toFixed(2), area_m2: r.area_neta_m2 }));
}
export { vistaAscii };
