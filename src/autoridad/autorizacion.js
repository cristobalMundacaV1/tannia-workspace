// Solicitud de autorización HUMANA para acciones profesionales. El texto que ve la persona lo arma el SERVIDOR con datos del
// proyecto (no con texto libre del modelo). Canales admitidos: confirmación del cliente MCP (elicitación) y diálogo nativo del SO.
import { AprobacionHumana } from '../cic/aprobacion_humana.js';

/**
 * @returns {Promise<{por: 'human_elicitation'|'human_dialog'|null, rechazado?: boolean, nombre?: string|null}>}
 */
export async function pedirAutorizacionHumana({ sandbox, server, proyecto, clave, titulo, resumen, consecuencia, etiquetaAprobar = '_Autorizar', etiquetaRevision = 'He revisado lo anterior y lo autorizo personalmente.', aprobacion = null }) {
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
    canApprove: true, blocked: [], technical: '', approveLabel: etiquetaAprobar, reviewLabel: etiquetaRevision,
  };
  const d = await ah.decidir(proyecto, clave, { descripcion: `${titulo}\n\n${resumen}\n\n${consecuencia}`, elicitar, consentimiento, permitirArchivo: false });
  return { ...d, nombre };
}

export const TEXTO_SIN_CANAL = 'No hay un canal para que una PERSONA lo autorice: este cliente no ofrece ventanas de confirmación y el diálogo del sistema no está disponible (o no se respondió). Claude no puede autorizarlo por usted.';
