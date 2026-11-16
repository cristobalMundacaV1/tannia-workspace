// Servicio de modelos 3D: versiones inmutables bajo "03 Trabajo/Modelos3D/<nombre>/", historial (deshacer/rehacer/restaurar),
// creación desde un modelo estructurado o desde un anteproyecto 2D, modificación por operaciones y coherencia con el 2D.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { FOLDERS } from '../security/sandbox.js';
import { Project, atomicWriteJson, readJson } from '../project/store.js';
import { VERSION } from '../version.js';
import { construirPrimitivas } from './geometria.js';
import { aplicarOperaciones3d } from './operaciones.js';
import { modeloDesdeGeo, coherenciaConGeo } from './desde_anteproyecto.js';
import { slug } from '../design/servicio.js';

const RAIZ = 'Modelos3D';
const num3 = (n) => String(n).padStart(3, '0');
const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

export class Modelos3d {
  constructor(sandbox, anteproyectos) { this.sandbox = sandbox; this.ante = anteproyectos; }
  #dir(nombre) { const n = slug(nombre); if (!n) throw new UserError('NOMBRE_INVALIDO', 'Falta el nombre del modelo 3D.'); return { n, rel: `${FOLDERS.trabajo}/${RAIZ}/${n}` }; }
  #abs(project, rel) { return this.sandbox.resolveWritable(project, rel).abs; }
  #hist(project, nombre) {
    const { rel } = this.#dir(nombre); const f = this.#abs(project, `${rel}/historial.json`);
    if (!fs.existsSync(f)) throw new UserError('MODELO3D_NO_EXISTE', `No existe el modelo 3D "${nombre}".`, 'Créelo con tannia_3d_crear o consulte los existentes con tannia_3d_ver.');
    return { h: readJson(f, null), f, rel };
  }
  listar(project) {
    const base = this.#abs(project, `${FOLDERS.trabajo}/${RAIZ}`); if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'historial.json'))).map((d) => { const h = readJson(path.join(base, d.name, 'historial.json'), {}); return { nombre: h.nombre, head: h.head, versiones: (h.versiones || []).length }; });
  }
  #escribir(project, rel, id, registro, modelo) {
    const built = construirPrimitivas(modelo);
    // Registro de supuestos DERIVADO del modelo final (se actualiza con cada cambio de altura/espesor; nunca queda desfasado)
    built.modelo.supuestos = { niveles: built.modelo.niveles.map((n) => ({ id: n.id, altura_mm: n.altura_mm, fuente: n.fuente_altura || 'indicada' })), espesores_losa_mm: [...new Set(built.modelo.losas.map((l) => l.espesor_mm))], nota: 'Alturas y espesores verticales: supuestos preliminares editables (no normativos).' };
    const reg = { ...registro, modelo: built.modelo, modelo_sha256: sha(built.modelo), primitivas: built.primitivas, capas: built.capas, nota: built.nota, resumen_geometria: built.resumen, supuestos_lista: built.supuestos, advertencias: built.advertencias, generado_por: `tannia-workspace ${VERSION}` };
    const f = this.#abs(project, `${rel}/${id}.json`); fs.mkdirSync(path.dirname(f), { recursive: true });
    if (fs.existsSync(f)) throw new UserError('VERSION_EXISTE', `La versión ${id} ya existe (las versiones son inmutables).`);
    atomicWriteJson(f, reg); return reg;
  }
  /** Crea v001. `modelo` estructurado O `desde_anteproyecto:{nombre,version?}` + parámetros (alturas/cubierta como supuestos explícitos). */
  crear(project, { nombre, modelo, desde_anteproyecto, parametros = {}, solicitud }) {
    const { n, rel } = this.#dir(nombre); const fh = this.#abs(project, `${rel}/historial.json`);
    if (fs.existsSync(fh)) throw new UserError('MODELO3D_EXISTE', `Ya existe el modelo 3D "${n}".`, 'Use otro nombre o modifíquelo con tannia_3d_modificar.');
    if (!!modelo === !!desde_anteproyecto) throw new UserError('FUENTE_AMBIGUA', 'Indique exactamente una fuente: "modelo" (estructurado) o "desde_anteproyecto".');
    let m = modelo; let origen = null;
    if (desde_anteproyecto) {
      const c = this.ante.cargar(project, desde_anteproyecto.nombre, desde_anteproyecto.version);
      origen = { tipo: 'anteproyecto', nombre: c.h.nombre, version: c.id, modelo_sha256: c.reg.modelo_sha256 };
      m = modeloDesdeGeo(c.geo, { ...parametros, altura_2d_mm: c.modelo.altura_piso_cielo_mm, origen });
    }
    const id = `v${num3(1)}`; const creada = new Date().toISOString();
    const reg = this.#escribir(project, rel, id, { id, numero: 1, padre: null, creada, descripcion: 'Versión inicial', solicitud: solicitud || null, operaciones: [], origen }, m);
    atomicWriteJson(fh, { nombre: n, creado: creada, head: id, redo: [], versiones: [{ id, padre: null, creada, descripcion: reg.descripcion }] });
    new Project(this.sandbox, project).audit('modelo3d_creado', { nombre: n, version: id });
    return { nombre: n, version: id, reg, rel };
  }
  cargar(project, nombre, version) {
    const { h, rel } = this.#hist(project, nombre); const id = version || h.head;
    if (!h.versiones.some((v) => v.id === id)) throw new UserError('VERSION_NO_EXISTE', `No existe la versión ${id}.`, `Versiones: ${h.versiones.map((v) => v.id).join(', ')}.`);
    return { h, rel, id, reg: readJson(this.#abs(project, `${rel}/${id}.json`), null) };
  }
  rutas(project, nombre, version) {
    const c = this.cargar(project, nombre, version);
    return { version: c.id, json: `${c.rel}/${c.id}.json`, dwg: `${c.rel}/${c.id}_3D.dwg`, abs_dwg: this.#abs(project, `${c.rel}/${c.id}_3D.dwg`) };
  }
  modificar(project, nombre, { operaciones, descripcion, actualizar_desde_anteproyecto }) {
    const { h, f, rel } = this.#hist(project, nombre); const cur = this.cargar(project, nombre);
    let m = cur.reg.modelo; const resumen = []; let origen = cur.reg.origen;
    if (actualizar_desde_anteproyecto) {
      if (!origen) throw new UserError('SIN_ORIGEN_2D', 'Este modelo 3D no se creó desde un anteproyecto 2D: no hay plano con el cual sincronizar.');
      const c = this.ante.cargar(project, origen.nombre, actualizar_desde_anteproyecto.version);
      const nuevo = modeloDesdeGeo(c.geo, { altura_muros_mm: m.niveles[0].altura_mm, altura_2d_mm: c.modelo.altura_piso_cielo_mm, espesor_losa_mm: m.losas[0]?.espesor_mm, cubierta: m.cubiertas[0] ? (({ id, nivel, ...r }) => r)(m.cubiertas[0]) : null, cubierta_visible: m.opciones?.cubierta_visible });
      m = { ...nuevo, niveles: m.niveles }; // conserva niveles/alturas/supuestos del 3D; muros, vanos y losa vienen del 2D
      origen = { tipo: 'anteproyecto', nombre: c.h.nombre, version: c.id, modelo_sha256: c.reg.modelo_sha256 }; m.origen = origen;
      resumen.push(`Muros, vanos y losa actualizados desde el anteproyecto ${c.h.nombre} ${c.id}; niveles, alturas y cubierta del 3D conservados.`);
    }
    if (operaciones?.length) { const r = aplicarOperaciones3d(m, operaciones); m = r.modelo; resumen.push(...r.resumen); }
    else if (!actualizar_desde_anteproyecto) throw new UserError('SIN_OPERACIONES', 'Indique operaciones o actualizar_desde_anteproyecto.');
    const numero = Math.max(...h.versiones.map((v) => Number(v.id.slice(1)))) + 1; const id = `v${num3(numero)}`; const creada = new Date().toISOString();
    const reg = this.#escribir(project, rel, id, { id, numero, padre: cur.id, creada, descripcion: descripcion || resumen.join('; '), operaciones: operaciones || [], origen }, m);
    h.versiones.push({ id, padre: cur.id, creada, descripcion: reg.descripcion }); h.head = id; h.redo = []; atomicWriteJson(f, h);
    new Project(this.sandbox, project).audit('modelo3d_modificado', { nombre: h.nombre, version: id });
    return { nombre: h.nombre, version: id, padre: cur.id, resumen, reg, rel };
  }
  historial(project, nombre, accion, version) {
    const { h, f } = this.#hist(project, nombre); const hay = (id) => h.versiones.find((v) => v.id === id);
    if (accion === 'listar') return { head: h.head, redo: h.redo, versiones: h.versiones };
    if (accion === 'deshacer') { const v = hay(h.head); if (!v.padre) throw new UserError('NADA_QUE_DESHACER', 'Ya está en la versión inicial.'); h.redo.push(h.head); h.head = v.padre; }
    else if (accion === 'rehacer') { const r = h.redo.pop(); if (!r) throw new UserError('NADA_QUE_REHACER', 'No hay cambios deshechos.'); h.head = r; }
    else if (accion === 'restaurar') { if (!version || !hay(version)) throw new UserError('VERSION_NO_EXISTE', `No existe la versión ${version}.`); if (h.head !== version) h.redo = []; h.head = version; }
    else throw new UserError('ACCION_INVALIDA', 'accion debe ser listar, deshacer, rehacer o restaurar.');
    atomicWriteJson(f, h); return { head: h.head, redo: h.redo, accion };
  }
  /** Coherencia con el 2D de origen (si lo hay): re-deriva el anteproyecto y compara huella y vanos. */
  coherencia2d(project, nombre, version) {
    const c = this.cargar(project, nombre, version); const o = c.reg.origen;
    if (!o) return { estado: 'no_aplica', motivo: 'El modelo 3D no se creó desde un anteproyecto 2D.' };
    const a = this.ante.cargar(project, o.nombre, o.version);
    const r = coherenciaConGeo(c.reg.modelo, a.geo, a.modelo);
    const actual = this.ante.cargar(project, o.nombre);
    r.facetas.revision_origen = { estado: actual.id === o.version ? 'verificado' : 'revisar', comparado: 'versión del plano 2D usada frente a la actual', usada: o.version, actual: actual.id, plano_modificado_desde_el_3d: a.reg.modelo_sha256 !== o.modelo_sha256 };
    if (r.estado === 'coherente_en_alcance' && actual.id !== o.version) r.estado = 'con_observaciones';
    return { ...r, origen: o, anteproyecto_versiones: { usada: o.version, actual: actual.id }, plano_2d_modificado_desde_el_3d: a.reg.modelo_sha256 !== o.modelo_sha256, hay_version_2d_mas_reciente: actual.id !== o.version, nota: actual.id !== o.version ? `El anteproyecto tiene una versión más reciente (${actual.id}); use tannia_3d_modificar con actualizar_desde_anteproyecto para sincronizar.` : null };
  }
}
