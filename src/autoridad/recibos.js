// Recibos de autorización HUMANA (E03/E05). Un recibo solo se emite cuando una persona respondió en un canal que el modelo
// no controla (formulario de confirmación del cliente MCP o diálogo nativo del sistema operativo). Queda ligado a:
//   acción + objetivo (id, versión y huella de contenido) + revisión del proyecto + huellas de los artefactos.
// Integridad: HMAC-SHA256 con una clave local guardada en la carpeta de configuración de Tannia (fuera de los proyectos;
// ninguna herramienta MCP la lee ni la escribe). Un nombre o un booleano enviado por el modelo NUNCA produce un recibo.
// Frontera declarada: un proceso del MISMO usuario con acceso de escritura a su perfil (otro programa, otro servidor de
// archivos) queda fuera de esta garantía; ver docs/release-candidate/DECISIONES.md (D-SEC-01).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonico, idAleatorio } from './canonico.js';
import { adjuntarLinea } from '../project/store.js';

export const CANALES_HUMANOS_PROFESIONALES = new Set(['human_elicitation', 'human_dialog']);
const ESQUEMA = 'tw.approval_receipt/1';

export class Recibos {
  constructor(sandbox) { this.sandbox = sandbox; }
  get archivoClave() { return path.join(this.sandbox.home, '.tannia-config', 'clave-recibos'); }

  /** Clave local de 32 bytes; se crea una sola vez (wx) con permisos de solo propietario. */
  #clave() {
    const f = this.archivoClave;
    for (let intento = 0; intento < 2; intento++) {
      try {
        const st = fs.lstatSync(f);
        if (st.isSymbolicLink() || !st.isFile() || st.size !== 32) throw Object.assign(new Error('Clave de recibos inválida'), { code: 'CLAVE_INVALIDA' });
        return fs.readFileSync(f);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        fs.mkdirSync(path.dirname(f), { recursive: true });
        try { fs.writeFileSync(f, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (e2) { if (e2.code !== 'EEXIST') throw e2; }
      }
    }
    throw new Error('No se pudo preparar la clave de recibos.');
  }
  firmar(cuerpo) { return crypto.createHmac('sha256', this.#clave()).update(canonico(cuerpo)).digest('hex'); }
  #firmaOk(cuerpo, mac) {
    if (typeof mac !== 'string' || !/^[0-9a-f]{64}$/.test(mac)) return false;
    const a = Buffer.from(this.firmar(cuerpo), 'hex'); const b = Buffer.from(mac, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  #ledger(pr) { return pr.p('.tannia', 'recibos.jsonl'); }

  /**
   * Emite y registra un recibo. `canal` DEBE venir del resultado de AprobacionHumana.decidir (nunca de argumentos del modelo).
   */
  emitir(pr, { accion, objetivo, objetivo_version = null, objetivo_hash, revision, snapshot, artefactos = [], canal, declarado_por = null, nota_asistente = null, resumen = null }) {
    if (!CANALES_HUMANOS_PROFESIONALES.has(canal)) throw new Error(`Canal no admitido para autorización profesional: ${canal}`);
    const cuerpo = {
      schema: ESQUEMA, id: idAleatorio('rec'), proyecto: pr.name, proyecto_id: pr.meta()?.id || null,
      accion, objetivo, objetivo_version, objetivo_hash, revision, snapshot,
      artefactos: artefactos.map((a) => ({ rel: a.rel, sha256: a.sha256 })), canal,
      declarado_por: declarado_por ? String(declarado_por).slice(0, 120) : null,
      nota_asistente: nota_asistente ? String(nota_asistente).slice(0, 500) : null, resumen,
      emitido: new Date().toISOString(),
    };
    const recibo = { ...cuerpo, hmac: this.firmar(cuerpo) };
    adjuntarLinea(pr.root, this.#ledger(pr), `${JSON.stringify({ tipo: 'recibo', recibo })}\n`);
    return recibo;
  }
  /** Registra el consumo de un recibo de un solo uso (exportación). */
  consumir(pr, id, motivo) {
    const ev = { tipo: 'consumo', id, motivo, t: new Date().toISOString() };
    adjuntarLinea(pr.root, this.#ledger(pr), `${JSON.stringify({ ...ev, hmac: this.firmar(ev) })}\n`);
  }
  /** Lee el registro: solo recibos con firma válida; las líneas alteradas o fabricadas se cuentan como inválidas. */
  leer(pr) {
    const out = { recibos: [], consumidos: new Set(), invalidos: 0 };
    let txt = ''; try { txt = fs.readFileSync(this.#ledger(pr), 'utf8'); } catch { return out; }
    for (const linea of txt.split('\n')) {
      if (!linea.trim()) continue;
      let o; try { o = JSON.parse(linea); } catch { out.invalidos++; continue; }
      if (o?.tipo === 'recibo' && o.recibo) {
        const { hmac, ...cuerpo } = o.recibo;
        if (cuerpo.schema === ESQUEMA && CANALES_HUMANOS_PROFESIONALES.has(cuerpo.canal) && cuerpo.proyecto === pr.name && this.#firmaOk(cuerpo, hmac)) out.recibos.push(o.recibo); else out.invalidos++;
      } else if (o?.tipo === 'consumo') {
        const { hmac, ...ev } = o; if (this.#firmaOk(ev, hmac)) out.consumidos.add(ev.id); else out.invalidos++;
      } else out.invalidos++;
    }
    return out;
  }
}
