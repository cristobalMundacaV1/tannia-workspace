// Aprobación HUMANA con límite de confianza explícito (hallazgo P1 de la auditoría): el agente NUNCA puede leer ni escribir el canal de aprobación.
// Canales, en orden: (1) confirmación del CLIENTE MCP (elicitación); (2) diálogo nativo del sistema operativo lanzado por el servidor (solo la persona lo ve);
// (3) archivo creado por la persona en la carpeta de configuración de Tannia Workspace, FUERA de los proyectos (las herramientas MCP solo resuelven rutas dentro de un
// proyecto: no pueden leerla ni escribirla). No existe ningún secreto/código en rutas legibles por herramientas: no hay nada que filtrar ni que Claude pueda leer.
// Limitación declarada: si el agente tuviera OTRA herramienta con acceso de escritura a la carpeta del usuario (p. ej. un servidor de archivos), el canal de archivo
// podría falsificarse; por eso la elicitación y el diálogo del SO tienen prioridad y el canal de archivo es el último recurso.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { CONSENT_WPF } from './consent.js';

const TIMEOUT_DIALOGO_MS = 90_000;
const activeDecisions = new Set();
const seguro = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';

/** Diálogo nativo Sí/No. Devuelve 'si' | 'no' | null (no disponible o sin respuesta). El texto va por variable de entorno/argv, nunca interpolado en un script. */
export function dialogoSO(mensaje, { plataforma = process.platform, ejecutar = execFile, timeoutMs = TIMEOUT_DIALOGO_MS, consentimiento = null } = {}) {
  if (process.env.CI || process.env.TANNIA_SIN_DIALOGO === '1') return Promise.resolve(null);
  return new Promise((resolve) => {
    const fin = (err, out) => { if (err) return resolve(err.killed || err.code === 'ETIMEDOUT' ? 'no' : null); resolve(out); };
    const data = consentimiento || { action: mensaje, project: 'Proyecto indicado en la solicitud', document: 'Ver solicitud', origin: 'Solicitud del servidor', publisher: 'No informado', date: 'No informada', license: 'No aplica', verification: 'Requiere su revisión', excerpt: mensaje, consequence: 'Autoriza únicamente la acción descrita.', distinction: 'Autorizar no verifica la veracidad del contenido.', canApprove: true, blocked: [], technical: '' };
    const opts = { timeout: timeoutMs, windowsHide: true, env: { ...process.env, TANNIA_DLG_MSG: mensaje, TANNIA_DLG_DATA: JSON.stringify(data) } };
    if (plataforma === 'win32') ejecutar('powershell.exe', ['-NoProfile', '-STA', '-NonInteractive', '-EncodedCommand', Buffer.from(CONSENT_WPF, 'utf16le').toString('base64')], opts, (e, o) => fin(e, e ? null : (String(o).trim() === 'si' ? 'si' : 'no')));
    else if (plataforma === 'darwin') ejecutar('osascript', ['-e', 'on run argv', '-e', 'set r to button returned of (display dialog (system attribute "TANNIA_DLG_MSG") with title "Tannia Workspace" buttons {"No", "Sí"} default button "No" with icon caution)', '-e', 'if r is "Sí" then return "si"', '-e', 'return "no"', '-e', 'end run'], opts, (e, o) => fin(e, e ? null : (String(o).trim() === 'si' ? 'si' : 'no')));
    else ejecutar('zenity', ['--question', '--title=Tannia Workspace', '--text', mensaje, '--ok-label=Sí', '--cancel-label=No', '--width=480'], opts, (e) => { if (!e) return resolve('si'); resolve(e.code === 1 ? 'no' : null); });
  });
}

export class AprobacionHumana {
  constructor(sandbox, { dialogo = dialogoSO } = {}) { this.sandbox = sandbox; this.dialogo = dialogo; }
  get dir() { return path.join(this.sandbox.home, '.tannia-config', 'aprobaciones'); }
  clave(project, id) { return `${seguro(project)}__${seguro(id)}`; }
  archivoAprobacion(project, id) { return path.join(this.dir, `${this.clave(project, id)}.txt`); }
  #pend(project, id) { return path.join(this.dir, 'pendientes', `${this.clave(project, id)}.json`); }
  /** Registra la solicitud en la carpeta de configuración (sin secretos). Devuelve la ruta que SOLO la persona debe usar. */
  solicitar(project, id, descripcion) {
    const f = this.#pend(project, id); fs.mkdirSync(path.dirname(f), { recursive: true });
    if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ project, id, descripcion, creado_ms: Date.now() }, null, 2));
    return { archivo_aprobacion: this.archivoAprobacion(project, id), formato: `una línea:  APRUEBO ${id}`, nota: 'Carpeta de configuración de Tannia Workspace, fuera de los proyectos: Claude no puede leerla ni escribirla con sus herramientas.' };
  }
  /** Base temporal: la fecha del propio registro de la solicitud, medida con el MISMO reloj del sistema de archivos (el reloj de pared puede adelantarse unos ms). */
  #baseTiempo(pf) { try { return fs.statSync(pf).mtimeMs; } catch { return Infinity; } }
  /** Contrato del archivo: archivo REGULAR (no enlace, no directorio, un solo nombre), creado después de la solicitud, con EXACTAMENTE `APRUEBO <id>` y, como mucho, un terminador LF o CRLF. Cualquier otro byte lo invalida. */
  #aprobacionValida(f, id, creadoMs) {
    let l; try { l = fs.lstatSync(f); } catch { return false; }
    if (l.isSymbolicLink() || !l.isFile() || l.nlink !== 1 || l.size > 256 || l.mtimeMs < creadoMs) return false;
    let buf; try { buf = fs.readFileSync(f); } catch { return false; }
    const linea = Buffer.from(`APRUEBO ${id}`, 'utf8');
    return buf.equals(linea) || buf.equals(Buffer.concat([linea, Buffer.from('\n')])) || buf.equals(Buffer.concat([linea, Buffer.from('\r\n')]));
  }
  /** @returns {por:'human_elicitation'|'human_dialog'|'human_out_of_band'|null, rechazado?} */
  async decidir(project, id, { descripcion = '', elicitar = null, usarDialogo = true, consentimiento = null, permitirArchivo = true } = {}) {
    const key = JSON.stringify([this.sandbox.home, project, id]);
    if (activeDecisions.has(key)) return { por: null, en_curso: true };
    activeDecisions.add(key);
    try { return await this.#decidir(project, id, { descripcion, elicitar, usarDialogo, consentimiento, permitirArchivo }); }
    finally { activeDecisions.delete(key); }
  }
  async #decidir(project, id, { descripcion, elicitar, usarDialogo, consentimiento, permitirArchivo }) {
    if (consentimiento?.canApprove === false) return { por: null, bloqueado: true, razones: consentimiento.blocked };
    if (elicitar) { let r = null; try { r = await elicitar(); } catch { r = null; } if (r && r.action === 'accept' && r.content?.aprobar === true) return { por: 'human_elicitation' }; if (r && (r.action === 'decline' || r.action === 'cancel' || (r.action === 'accept' && r.content?.aprobar === false))) return { por: null, rechazado: true }; }
    if (usarDialogo) { let r = null; try { r = await this.dialogo(`¿Autoriza esto?\n\n${descripcion}\n\nSolo usted puede aprobarlo; Claude no puede hacerlo por usted.`, { consentimiento }); } catch { r = null; } if (r === 'si') return { por: 'human_dialog' }; if (r === 'no') return { por: null, rechazado: true }; }
    // Autorizaciones profesionales (verificar cantidades, aprobar una entrega): el canal de archivo queda DESACTIVADO porque otra
    // herramienta con acceso al perfil podría crearlo (Astra A-01/E05). Solo cuentan la confirmación del cliente y el diálogo del SO.
    if (!permitirArchivo) return { por: null };
    const pf = this.#pend(project, id); const af = this.archivoAprobacion(project, id);
    if (fs.existsSync(pf)) {
      let pend = null; try { pend = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch { pend = null; }
      if (pend && this.#aprobacionValida(af, id, this.#baseTiempo(pf))) {
        // Consumo ATÓMICO y a prueba de carreras: se «toma» el archivo renombrándolo; si no se puede (otra decisión lo tomó, permisos…) NO se aprueba.
        const tomado = `${af}.usado-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try { fs.renameSync(af, tomado); } catch { return { por: null }; }
        const ok = this.#aprobacionValida(tomado, id, this.#baseTiempo(pf)); // se revalida lo realmente tomado (TOCTOU)
        try { fs.rmSync(tomado, { force: true }); } catch { /* ya consumido */ }
        if (ok) { try { fs.rmSync(pf, { force: true }); } catch { /* uso único */ } return { por: 'human_out_of_band' }; }
      }
    }
    return { por: null };
  }
}
