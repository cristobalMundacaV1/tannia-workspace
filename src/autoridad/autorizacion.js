// Solicitud de autorización HUMANA para acciones profesionales. El texto que ve la persona lo arma el SERVIDOR con datos del
// proyecto (no con texto libre del modelo). Canales admitidos: confirmación del cliente MCP (elicitación) y diálogo nativo del SO.
import { AprobacionHumana } from '../cic/aprobacion_humana.js';

/**
 * @returns {Promise<{por: 'human_elicitation'|'human_dialog'|null, rechazado?: boolean, nombre?: string|null}>}
 */
export async function pedirAutorizacionHumana({ sandbox, server, proyecto, clave, titulo, resumen, consecuencia, etiquetaAprobar = '_Autorizar', etiquetaRechazar = '_No autorizar', etiquetaRevision = 'He revisado lo anterior y lo autorizo personalmente.', aprobacion = null }) {
  const ah = aprobacion || new AprobacionHumana(sandbox);
  let nombre = null;
  const cap = server?.server?.getClientCapabilities?.()?.elicitation;
  const elicitar = cap && ('form' in cap || Object.keys(cap).length === 0)
    ? async () => {
      const r = await server.server.elicitInput({
        message: `${titulo}\n\n${resumen}\n\n${consecuencia}\n\nSolo usted puede autorizar esto; Claude no puede hacerlo por usted.`,
        requestedSchema: { type: 'object', properties: { aprobar: { type: 'boolean', title: 'Lo revisé y lo autorizo', default: false }, nombre: { type: 'string', title: 'Su nombre (opcional, queda en el registro)', maxLength: 120 } }, required: ['aprobar'] },
      });
      if (r?.action === 'accept' && typeof r.content?.nombre === 'string' && r.content.nombre.trim()) nombre = r.content.nombre.trim().slice(0, 120);
      return r;
    }
    : null;
  const consentimiento = {
    action: titulo, project: proyecto, document: resumen.split('\n')[0] || titulo, origin: 'Generado por Tannia Workspace en este equipo',
    publisher: 'No aplica', date: new Date().toISOString().slice(0, 10), license: 'No aplica', verification: 'El servidor comprobó huellas, revisión vigente y bloqueos antes de mostrar esta ventana.',
    excerpt: resumen, excerptLabel: 'Qué está autorizando', consequence: consecuencia,
    distinction: 'Autorizar registra SU decisión profesional. No certifica cumplimiento normativo ni reemplaza la firma de un profesional responsable.',
    canApprove: true, blocked: [], technical: '', approveLabel: etiquetaAprobar, rejectLabel: etiquetaRechazar, reviewLabel: etiquetaRevision,
  };
  const d = await ah.decidir(proyecto, clave, { descripcion: `${titulo}\n\n${resumen}\n\n${consecuencia}`, elicitar, consentimiento, permitirArchivo: false });
  return { ...d, nombre };
}

/** Mensaje y código para la herramienta según el resultado humano (no confundir «no se emitió» con «se revocó»). */
export function resultadoNoConfirmado(d, objeto) {
  const M = {
    rechazado: ['RECHAZADO_POR_LA_PERSONA', `La persona respondió «No» a ${objeto}.`],
    cancelado: ['VENTANA_CERRADA_SIN_RESPUESTA', `La ventana de ${objeto} se cerró sin respuesta.`],
    tiempo_agotado: ['TIEMPO_AGOTADO', `La ventana de ${objeto} se cerró por tiempo sin respuesta.`],
    error_tecnico: ['ERROR_TECNICO_VENTANA', `No se pudo mostrar o completar la ventana de ${objeto} (error técnico).`],
    sin_canal: ['SIN_CANAL_HUMANO', TEXTO_SIN_CANAL],
  };
  const [codigo, mensaje] = M[d.resultado] || ['RESULTADO_DESCONOCIDO', `No se sabe qué ocurrió con la ventana de ${objeto}.`];
  return { codigo, mensaje, detalle: { resultado: d.resultado || 'desconocido', ventana_mostrada: d.mostrada ?? null, canal: d.canal || null, efecto: 'No se emitió una autorización nueva. Las autorizaciones anteriores vigentes NO se revocan por esto.' } };
}

export const TEXTO_SIN_CANAL = 'No hay un canal para que una PERSONA lo autorice: este cliente no ofrece ventanas de confirmación y el diálogo del sistema no está disponible (o no se respondió). Claude no puede autorizarlo por usted.';
