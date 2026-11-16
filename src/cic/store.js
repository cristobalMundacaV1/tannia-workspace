// Persistencia de casos de ingeniería: versiones inmutables y transaccionales bajo "03 Trabajo/Ingenieria/<caso>/" (reusa commitConHistorial).
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../mcp/util.js';
import { FOLDERS } from '../security/sandbox.js';
import { readJson } from '../project/store.js';
import { commitConHistorial, reconciliar } from '../project/transaccion.js';
import { slug } from '../design/servicio.js';
import { sha256 } from './hash.js';

const RAIZ = 'Ingenieria';
const num3 = (n) => String(n).padStart(3, '0');
export const casoVacio = (nombre, mode) => ({ schema: 'tw.cic.case/1', nombre, mode, engagement: null, plan: null, claims: [], issues: [], magnitudes: [], artifacts: [], research: [], contradictions: [] });

export class Casos {
  constructor(sandbox) { this.sandbox = sandbox; }
  #n(nombre) { const n = slug(nombre); if (!n) throw new UserError('NOMBRE_INVALIDO', 'Falta el nombre del caso de ingeniería.'); return { n, rel: `${FOLDERS.trabajo}/${RAIZ}/${n}` }; }
  #abs(project, rel) { return this.sandbox.resolveWritable(project, rel).abs; }
  dirAbs(project, nombre) { return this.#abs(project, this.#n(nombre).rel); }
  existe(project, nombre) { const { rel } = this.#n(nombre); return fs.existsSync(this.#abs(project, `${rel}/historial.json`)); }
  listar(project) {
    const base = this.#abs(project, `${FOLDERS.trabajo}/${RAIZ}`); if (!fs.existsSync(base)) return [];
    return fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'historial.json'))).map((d) => { const h = readJson(path.join(base, d.name, 'historial.json'), {}); return { nombre: h.nombre, head: h.head, versiones: (h.versiones || []).length }; });
  }
  cargar(project, nombre, version) {
    const { rel } = this.#n(nombre); const f = this.#abs(project, `${rel}/historial.json`);
    if (!fs.existsSync(f)) throw new UserError('CASO_NO_EXISTE', `No existe el caso de ingeniería "${nombre}".`, 'Créelo con tannia_cic_encargo o tannia_cic_calcular (con proyecto y caso).');
    try { reconciliar(this.#abs(project, rel), () => (readJson(f, null)?.versiones ?? []).map((v) => v.id)); } catch { /* nunca bloquea la lectura */ }
    const h = readJson(f, null); const id = version || h.head;
    if (!h.versiones.some((v) => v.id === id)) throw new UserError('VERSION_NO_EXISTE', `No existe la versión ${id}.`, `Versiones: ${h.versiones.map((v) => v.id).join(', ')}.`);
    const doc = readJson(this.#abs(project, `${rel}/${id}.json`), null); return { doc, id, h, rel };
  }
  #escribir(project, rel, id, doc, tx) {
    const reg = { ...doc, doc_sha256: sha256({ ...doc, doc_sha256: undefined }) };
    commitConHistorial({ dir: this.#abs(project, rel), historial: this.#abs(project, `${rel}/historial.json`), id, archivos: [{ nombre: `${id}.json`, contenido: JSON.stringify(reg, null, 2) }], ...tx, hook: this.hook || undefined, raiz: this.sandbox.projectRoot(project) });
    return reg;
  }
  crear(project, nombre, mode, descripcion = 'Versión inicial') {
    const { n, rel } = this.#n(nombre); const id = `v${num3(1)}`; const creada = new Date().toISOString();
    const err = new UserError('CASO_EXISTE', `Ya existe el caso "${n}".`, 'Use tannia_cic_* sobre el caso existente.');
    const reg = this.#escribir(project, rel, id, { ...casoVacio(n, mode), version: id }, { nuevo: { nombre: n, creado: creada, head: id, versiones: [{ id, padre: null, creada, descripcion }] }, errorExiste: err });
    return { nombre: n, version: id, doc: reg };
  }
  /** Aplica `fn(docClonado)` y publica una versión NUEVA (la anterior queda intacta). `fn` devuelve la descripción (o {descripcion}). */
  guardar(project, nombre, fn) {
    const { doc, id: base, h, rel } = this.cargar(project, nombre); const clon = JSON.parse(JSON.stringify(doc)); delete clon.doc_sha256;
    const r = fn(clon); const descripcion = typeof r === 'string' ? r : r?.descripcion || 'Actualización';
    const n = h.versiones.length + 1; const id = `v${num3(n)}`; const creada = new Date().toISOString();
    clon.version = id; clon.padre = base;
    const reg = this.#escribir(project, rel, id, clon, { base, entrada: { id, padre: base, creada, descripcion } });
    return { version: id, doc: reg };
  }
}
