// Durable CAD journal. An uncertain write is never replayed, even after process death.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tomarBloqueo } from '../project/transaccion.js';
import { atomicWriteJson, verificarContencion } from '../project/store.js';
import { UserError } from '../mcp/util.js';

export const digest = (value) => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');

export class CadOperations {
  constructor(root) { this.root = root; this.dir = path.join(root, '03 Trabajo', 'CAD', 'operaciones'); }
  file(id) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(id)) throw new UserError('OPERACION_ID_INVALIDA', 'Identificador de operación inválido.');
    const file = path.join(this.dir, `${id}.json`); verificarContencion(this.root, file); return file;
  }
  status(id) {
    const file = this.file(id);
    // Deliberately no .bak recovery: it could revert an uncertain write to a replayable state.
    verificarContencion(this.root, `${file}.dispatched`);
    if (!fs.existsSync(file)) {
      if (fs.existsSync(`${file}.dispatched`)) throw new UserError('ESCRITURA_INCIERTA', 'Falta el registro de una escritura ya despachada. No se repetirá.');
      return null;
    }
    let record; try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new UserError('CHECKPOINT_DANADO', 'El registro CAD está dañado. No se repetirá la escritura.'); }
    if (record.id !== id || !['prepared', 'applying', 'verified', 'uncertain'].includes(record.state)) throw new UserError('CHECKPOINT_DANADO', 'Registro CAD inválido.');
    return record;
  }
  async run({ id, intent, preflight, apply, verify }) {
    const file = this.file(id); verificarContencion(this.root, this.dir);
    const lock = tomarBloqueo(this.dir, { esperaMs: 0, motivo: `CAD ${id}` });
    if (!lock) throw new UserError('CAD_OPERACION_EN_CURSO', 'Otra operación CAD está en curso.');
    const save = (record) => { atomicWriteJson(file, record, { raiz: this.root }); const fd = fs.openSync(file, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };
    try {
      const fingerprint = digest(intent); const prior = this.status(id);
      if (prior && prior.fingerprint !== fingerprint) throw new UserError('OPERACION_CONFLICTO', 'La identidad ya corresponde a otra operación.');
      if (prior?.state === 'verified') return { ...prior.result, reused: true, verification_scope: 'historical_checkpoint_not_current_document' };
      if ((prior && prior.state !== 'prepared') || fs.existsSync(`${file}.dispatched`)) throw new UserError('ESCRITURA_INCIERTA', 'La escritura anterior puede haberse aplicado. No se repetirá.', 'Inspeccione el documento y el registro antes de una recuperación supervisada.', { operacion: id, checkpoint: prior });
      const conditions = await preflight();
      const record = { schema: 'tw.cad.operation/1', id, fingerprint, intent, conditions, state: 'prepared', updated: new Date().toISOString() };
      save(record);
      verificarContencion(this.root, `${file}.dispatched`);
      const marker = fs.openSync(`${file}.dispatched`, 'wx');
      try { fs.writeSync(marker, fingerprint); fs.fsyncSync(marker); } finally { fs.closeSync(marker); }
      record.state = 'applying'; save(record); // Persist BEFORE dispatch, including the crash window.
      try {
        const result = await apply(conditions);
        const proof = await verify(result, conditions);
        if (proof !== true) throw new UserError('CAD_VERIFICACION_FALLIDA', 'No se pudo verificar la escritura CAD.');
        record.state = 'verified'; record.result = result; record.updated = new Date().toISOString(); save(record);
        return result;
      } catch (error) {
        record.state = 'uncertain'; record.error = { code: error.code || 'CAD_ERROR', message: error.message }; record.updated = new Date().toISOString(); save(record);
        throw error;
      }
    } finally { lock.liberar(); }
  }
}
