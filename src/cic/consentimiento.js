// Consentimiento HUMANO comprobable (H3): elicitación del cliente o archivo creado fuera de la conversación con un código que Claude no obtiene por las herramientas.
// Nunca basta un parámetro/booleano enviado por Claude. El consentimiento es específico (id = caso + versión + estado) y queda registrado.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FOLDERS } from '../security/sandbox.js';
import { atomicWriteJson, readJson } from '../project/store.js';

const hex = (s) => crypto.createHash('sha256').update(s).digest('hex');
const RAIZ = 'Consentimientos';
export class Consentimientos {
  constructor(sandbox) { this.sandbox = sandbox; }
  #rel(...p) { return [FOLDERS.trabajo, RAIZ, ...p].join('/'); }
  #abs(project, rel) { return this.sandbox.resolveWritable(project, rel).abs; }
  solicitar(project, id, descripcion) {
    const nf = this.#abs(project, this.#rel(`${id}.json`)); fs.mkdirSync(path.dirname(nf), { recursive: true });
    if (!fs.existsSync(nf)) { const nonce = crypto.randomBytes(5).toString('hex'); atomicWriteJson(nf, { id, descripcion, nonce_sha256: hex(nonce), creado: new Date().toISOString() }, { raiz: this.sandbox.projectRoot(project) }); fs.writeFileSync(this.#abs(project, this.#rel(`${id}.codigo.txt`)), `Para autorizar «${descripcion}» fuera de la conversación, cree el archivo\n01 Antecedentes/Aprobaciones/${id}.txt\ncon esta única línea:\nAPRUEBO ${id} ${nonce}\n`); }
    return { archivo_aprobacion: `01 Antecedentes/Aprobaciones/${id}.txt`, codigo_en: this.#rel(`${id}.codigo.txt`) };
  }
  /** @returns {por:'human_elicitation'|'human_out_of_band'|null} */
  async decidir(project, id, { elicitar } = {}) {
    if (elicitar) { let r = null; try { r = await elicitar(); } catch { r = null; } if (r && r.action === 'accept' && r.content?.aprobar === true) return { por: 'human_elicitation' }; if (r && (r.action === 'decline' || r.action === 'cancel')) return { por: null, rechazado: true }; }
    const nf = this.#abs(project, this.#rel(`${id}.json`)); const pend = fs.existsSync(nf) ? readJson(nf, null, { raiz: this.sandbox.projectRoot(project) }) : null; const af = path.join(this.sandbox.projectRoot(project), '01 Antecedentes', 'Aprobaciones', `${id}.txt`);
    if (pend && fs.existsSync(af)) { const m = /^APRUEBO (\S+) (\S+)\s*$/m.exec(fs.readFileSync(af, 'utf8')); if (m && m[1] === id && hex(m[2]) === pend.nonce_sha256) return { por: 'human_out_of_band' }; }
    return { por: null };
  }
}
