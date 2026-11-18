// Política ÚNICA de AutoCAD interactivo (modo C) — revisión BG-R03 del PR #36.
// Toda operación COM que pueda interrumpir el escritorio de la persona (abrir o crear pestañas, activar un dibujo, escribir, guardar,
// cerrar, cambiar la vista o enviar comandos a SU AutoCAD) exige un PERMISO otorgado por una persona en una ventana, específico para
// esa operación y esos documentos, y vigente por pocos minutos. El adaptador COM lo exige en su único punto de paso (#exec): una
// herramienta nueva o antigua que se olvide de pedirlo falla cerrado. Las lecturas (estado, listar, medir…) no interrumpen y no lo piden.
import path from 'node:path';
import fs from 'node:fs';
import { canonico, huella } from '../autoridad/canonico.js';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { UserError } from '../mcp/util.js';
import { pedirAutorizacionHumana, contenidoVentana, resultadoNoConfirmado } from '../autoridad/autorizacion.js';

/** Scripts COM que interrumpen el escritorio (inventario de src/cad/autocad_com.js). */
export const SCRIPTS_INTERACTIVOS = new Set(['importar_dxf_aislado', 'abrir_copia', 'laminas_a_dwg', 'dxf_a_dwg', 'agregar_lineas', 'cerrar_reabrir', 'construir_3d', 'vista_3d', 'transformar_solido']);
/** Scripts COM de solo lectura: consultan la sesión sin crear, activar, escribir, guardar ni cerrar documentos. */
export const SCRIPTS_LECTURA = new Set(['estado', 'listar', 'medir', 'leer_lote', 'enumerar', 'resumen', 'sesion', 'inspeccionar_laminas', 'inspeccionar_aislado', 'reconciliar_apertura', 'reconciliar_importacion']);

/** Operaciones interactivas: qué scripts cubre su permiso y cómo se explica a la persona. */
export const OPERACIONES_INTERACTIVAS = {
  abrir_copia: { scripts: ['abrir_copia', 'importar_dxf_aislado'], accion: 'abrir la copia de trabajo en AutoCAD', efectos: ['AutoCAD abrirá la copia en una pestaña y la dejará activa.'], alternativa: 'Puedo seguir midiendo y preparando planos sin AutoCAD.' },
  agregar_lineas: { scripts: ['agregar_lineas'], accion: 'dibujar líneas en la copia de trabajo abierta en AutoCAD', efectos: ['Las líneas se agregan solo a esa copia; no se guarda nada por su cuenta.'], alternativa: 'Puedo preparar el dibujo en un DXF sin usar AutoCAD.' },
  exportar_dwg: { scripts: ['importar_dxf_aislado', 'laminas_a_dwg'], accion: 'guardar los planos como DWG usando AutoCAD', efectos: ['AutoCAD mostrará una pestaña nueva con los planos y la activará unos segundos.', 'Conviene no escribir en AutoCAD mientras dura (normalmente menos de un minuto).'], alternativa: 'Los planos DXF y PDF siguen disponibles; el DWG queda pendiente para cuando quieras.' },
  dxf_a_dwg: { scripts: ['importar_dxf_aislado', 'dxf_a_dwg'], accion: 'convertir el anteproyecto a DWG usando AutoCAD', efectos: ['AutoCAD mostrará una pestaña nueva y la activará unos segundos.'], alternativa: 'El DXF sigue disponible; el DWG queda pendiente.' },
  verificar_persistencia: { scripts: ['cerrar_reabrir'], accion: 'cerrar y volver a abrir la copia de trabajo en AutoCAD para comprobar lo guardado', efectos: ['La copia (ya guardada) se cerrará y se volverá a abrir.'], alternativa: 'La comprobación queda pendiente.' },
  construir_3d: { scripts: ['construir_3d'], accion: 'construir el modelo 3D en AutoCAD', efectos: ['AutoCAD creará un dibujo nuevo, lo guardará en 03 Trabajo y lo cerrará.'], alternativa: 'El modelo 3D sigue disponible en Tannia; el DWG 3D queda pendiente.' },
  vista_3d: { scripts: ['vista_3d'], accion: 'cambiar la vista 3D de la copia de trabajo en AutoCAD', efectos: ['Cambia el punto de vista y el estilo visual de esa copia.'], alternativa: 'Puedo generar la vista como imagen sin AutoCAD.' },
  transformar_solido: { scripts: ['transformar_solido'], accion: 'mover o girar un sólido en la copia de trabajo de AutoCAD', efectos: ['Se modifica un sólido de esa copia.'], alternativa: 'Puedo hacer el cambio en el modelo 3D de Tannia.' },
};

const VIGENCIA_MS = 10 * 60000;
const als = new AsyncLocalStorage();
const emitidos = new WeakMap();
const instantanea = (documentos) => documentos.map(p => ({ documento: p, sha256: fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null }));
const congelar = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(congelar); Object.freeze(x); } return x; };
function descripcionCambios(cambios) {
  const lineas = cambios.agregar_lineas?.lineas;
  if (lineas) return [`Se agregarán ${lineas.length} líneas en la capa «${cambios.agregar_lineas.capa || 'actual'}». Coordenadas en las unidades del dibujo:`, ...lineas.map((l, i) => `${i + 1}: desde (${l.x1}, ${l.y1}) hasta (${l.x2}, ${l.y2}).`)];
  const t = cambios.transformar_solido;
  if (t) return [`Sólido ${t.handle}: ${t.operacion === 'mover' ? `desplazamiento (${t.dx}, ${t.dy}, ${t.dz}) mm` : `giro de ${t.grados} grados alrededor de (${t.cx}, ${t.cy}) mm`}. ${t.guardar ? 'Se guardará la copia.' : 'Quedará sin guardar.'}`];
  const v = cambios.vista_3d;
  if (v) return [`Vista hacia (${v.dir}); mostrar capas: ${(v.mostrar || []).join(', ') || 'sin cambio'}; ocultar: ${(v.ocultar || []).join(', ') || 'ninguna'}. La geometría permanece intacta.`];
  const m = cambios.construir_3d;
  if (m) return [`Se creará un documento nuevo con ${m.primitivas.length} elementos del modelo indicado; el archivo anterior se conserva.`, ...m.primitivas.map(p => `Elemento ${p.id}: ${p.tipo || p.type || 'sólido'}, capa ${p.capa}; dimensiones y posición: ${JSON.stringify(p.esperado)}.`)];
  return ['Se ejecutará una sola vez esta operación sobre la versión actual de los documentos indicados. No autoriza otras ediciones.'];
}
const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').normalize('NFC').toLowerCase();
const nombre = (p) => path.win32.basename(path.posix.basename(String(p).replace(/\\/g, '/')));

export const permisoActual = () => als.getStore() || null;
export const conPermiso = (permiso, fn) => als.run(permiso, fn);

/** El permiso vigente cubre ESTE script y TODAS sus rutas; si no, falla cerrado (no se envía nada a AutoCAD). */
export function exigirAlcance(permiso, script, input = {}) {
  if (!permiso || !(permiso.expira > Date.now())) throw new UserError('AUTORIZACION_INTERACTIVA_REQUERIDA', 'Esta operación usa AutoCAD con su ventana y necesita que la persona la autorice antes; no se envió nada a AutoCAD.', 'Pida la operación de nuevo: aparecerá una ventana para autorizarla.');
  if (!permiso.scripts.has(script)) throw new UserError('FUERA_DEL_ALCANCE_AUTORIZADO', 'La autorización vigente no cubre esta operación de AutoCAD; no se ejecutó.', 'Pida la operación de nuevo para autorizarla específicamente.');
  const estado = emitidos.get(permiso);
  if (!estado || estado.usados.has(script)) throw new UserError('FUERA_DEL_ALCANCE_AUTORIZADO', 'La autorización no existe o ya se utilizó para este cambio.');
  const esperado = permiso.cambios[script];
  if (!esperado || Object.entries(esperado).some(([k, v]) => canonico(input[k] ?? null) !== canonico(v ?? null))) throw new UserError('FUERA_DEL_ALCANCE_AUTORIZADO', 'Los cambios solicitados no coinciden con los que autorizó la persona.');
  const docs = permiso.documentos.map(norm);
  for (const k of ['dxf', 'dwg', 'ruta', 'ruta_esperada']) if (input[k] && !docs.includes(norm(input[k]))) throw new UserError('FUERA_DEL_ALCANCE_AUTORIZADO', `La autorización vigente no incluye «${nombre(input[k])}»; no se tocó ese dibujo.`, 'Pida la operación de nuevo para ese documento.');
  if (huella(instantanea(permiso.documentos)) !== permiso.revision) throw new UserError('DOCUMENTO_CAMBIO_DURANTE_AUTORIZACION', 'El documento cambió después de mostrar la autorización. Vuelva a solicitar el cambio.');
  estado.usados.add(script);
}

export function crearPermiso({ proyecto, operacion, documentos, cambios = {}, canal, declarado_por = null, vigenciaMs = VIGENCIA_MS, ahora = Date.now() }) {
  const op = OPERACIONES_INTERACTIVAS[operacion]; if (!op) throw new UserError('OPERACION_DESCONOCIDA', `Operación interactiva desconocida: ${operacion}.`);
  const p = Object.freeze({ id: `perm-${crypto.randomBytes(6).toString('hex')}`, proyecto, operacion, documentos: Object.freeze([...documentos]), cambios: congelar(JSON.parse(canonico(cambios))), revision: huella(instantanea(documentos)), scripts: new Set(op.scripts), canal, declarado_por, otorgado: new Date(ahora).toISOString(), expira: ahora + vigenciaMs });
  emitidos.set(p, { usados: new Set() }); return p;
}

/** Sin canal humano no hay permiso: el valor por defecto del adaptador COM. */
export const politicaDenegada = Object.freeze({ permiso: async () => { throw new UserError('AUTORIZACION_INTERACTIVA_REQUERIDA', 'Esta operación usa AutoCAD con su ventana y necesita la autorización de la persona; no hay un canal para pedirla. No se envió nada a AutoCAD.', 'Hágalo desde Claude Desktop, donde aparece la ventana para autorizar.'); } });

/** Política del servidor: pide la autorización a la PERSONA (ventana del sistema o confirmación del cliente MCP), nunca al modelo. */
export class PoliticaInteractiva {
  constructor({ sandbox, server = null, aprobacion = null, vigenciaMs = VIGENCIA_MS, ahora = () => Date.now() }) { this.sandbox = sandbox; this.server = server; this.aprobacion = aprobacion; this.vigenciaMs = vigenciaMs; this.ahora = ahora; this.vigentes = new Map(); }

  async permiso({ proyecto, operacion, documentos, cambios = {} }) {
    const op = OPERACIONES_INTERACTIVAS[operacion]; if (!op) throw new UserError('OPERACION_DESCONOCIDA', `Operación interactiva desconocida: ${operacion}.`);
    cambios = congelar(JSON.parse(canonico(cambios)));
    const revision = huella(instantanea(documentos));
    const inicio = this.ahora();
    const clave = huella({ proyecto, operacion, documentos, cambios, revision, solicitud: crypto.randomUUID() });
    const docTxt = documentos.map((d) => `«${nombre(d)}»`).join(' y ');
    const ventana = contenidoVentana({
      pregunta: `¿Autorizas que Tannia use AutoCAD ahora para ${op.accion}?`,
      porque: 'Esta operación necesita la ventana de AutoCAD (no se puede hacer en segundo plano) y podría interrumpir lo que estés haciendo en él.',
      revisar: [`Documento: ${docTxt}, en la carpeta «03 Trabajo» del proyecto «${proyecto}» (nunca un original).`, ...op.efectos, ...descripcionCambios(cambios), 'Queda intacto: tus otros dibujos abiertos, aunque tengan cambios sin guardar. No se guardan, no se cierran y no reciben nada.'],
      autoriza: `Solo ${op.accion} en ${docTxt}, una sola vez y solo para el lote descrito. Debe comenzar antes de ${Math.round(this.vigenciaMs / 60000)} minutos.`,
      si_acepta: 'Tannia hace la operación y revisa el resultado; si algo no coincide, te lo dice.',
      si_rechaza: `No se abre ni se toca AutoCAD. ${op.alternativa}`,
      afecta: documentos.map(nombre),
      tecnico: [`Operación: ${operacion}`, `Proyecto: ${proyecto}`, 'Modalidad C (AutoCAD interactivo autorizado)'],
    });
    const d = await pedirAutorizacionHumana({ sandbox: this.sandbox, server: this.server, aprobacion: this.aprobacion, proyecto, clave: `cad-${operacion}-${crypto.createHash('sha256').update(clave).digest('hex').slice(0, 12)}`, ventana, titulo: `Usar AutoCAD: ${op.accion}`, resumen: ventana.texto_plano, consecuencia: 'Tus otros dibujos abiertos no se tocan.', etiquetaAprobar: '_Usar AutoCAD ahora', etiquetaRechazar: '_Después' });
    if (!d.por) { const r = resultadoNoConfirmado(d, 'uso de AutoCAD'); throw new UserError(d.rechazado ? 'INTERVENCION_POSPUESTA' : 'AUTORIZACION_INTERACTIVA_REQUERIDA', `${r.mensaje} No se envió nada a AutoCAD.`, op.alternativa, { resultado_codigo: r.codigo, operacion }); }
    if (this.ahora() - inicio >= this.vigenciaMs) throw new UserError('AUTORIZACION_INTERACTIVA_REQUERIDA', 'La solicitud venció mientras esperaba respuesta; vuelva a pedirla.');
    if (revision !== huella(instantanea(documentos))) throw new UserError('DOCUMENTO_CAMBIO_DURANTE_AUTORIZACION', 'El documento cambió mientras esperaba la autorización; vuelva a solicitarla.');
    const p = crearPermiso({ proyecto, operacion, documentos, cambios, canal: d.por, declarado_por: d.nombre || null, vigenciaMs: this.vigenciaMs, ahora: this.ahora() });
    return p;
  }
}
