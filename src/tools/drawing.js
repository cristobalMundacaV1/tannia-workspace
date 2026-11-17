import { z } from 'zod';
import { DrawingService } from '../drawing/service.js';
import { CadOperations } from '../cad/operations.js';
import { ok, UserError } from '../mcp/util.js';
import { AprobacionHumana } from '../cic/aprobacion_humana.js';
import { autorizarAtribucion } from '../drawing/atribucion.js';

export function registerDrawing(reg, { sandbox, cad, server = null, aprobacion = null }) {
  const service = new DrawingService(sandbox); const AH = aprobacion || new AprobacionHumana(sandbox);
  reg('tannia_planos', {
    title: 'Preparar, verificar y consultar planos técnicos',
    description: 'Flujo TW12: generar_tunel crea cuatro láminas académicas DXF/PDF en revisión inmutable; estado verifica manifiesto; sesion consulta la copia CAD por ruta; operacion consulta recuperación. No certifica construcción ni aprueba entregas. NUNCA deduzca author/institution de la cuenta, el correo o el equipo: use solo lo que la persona dijo; un nombre propuesto requiere su autorización y, sin él, el campo queda PENDIENTE. La escala se conserva: si no cabe, falla. No abre AutoCAD ni sustituye originales.',
    inputSchema: { proyecto: z.string(), accion: z.enum(['generar_tunel', 'estado', 'sesion', 'operacion', 'exportar_dwg']), archivo: z.string().optional(), operacion: z.string().optional(), papel: z.enum(['A3', 'A2', 'A1']).optional(), orientacion: z.enum(['landscape', 'portrait']).optional(), datos: z.object({ length: z.number().positive().max(10000), width: z.number().positive().max(100), wall: z.number().positive().max(100), selected: z.union([z.literal(0.06), z.literal(0.08)]), date: z.string().max(90).optional(), institution: z.string().max(90).optional(), author: z.string().max(90).optional(), revision: z.string().max(90).optional() }).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ proyecto, accion, datos, papel, orientacion, archivo, operacion }) => {
    if (accion === 'estado') return ok('Estado y archivos de revisión.', service.status(proyecto));
    if (accion === 'exportar_dwg') return ok('Resultado de guardado DWG; revise la evidencia adjunta.', await service.exportDwg(proyecto, cad));
    if (accion === 'operacion') { if (!operacion) throw new UserError('FALTA_OPERACION', 'Falta identificar la operación.'); return ok('Registro de ejecución CAD.', new CadOperations(sandbox.projectRoot(proyecto)).status(operacion)); }
    if (accion === 'sesion') { if (!archivo) throw new UserError('FALTA_ARCHIVO', 'Indique la copia de trabajo.'); return ok('Sesión CAD identificada.', await cad.sesion(proyecto, archivo)); }
    if (!datos) throw new UserError('FALTAN_DATOS', 'Se requieren longitud, ancho, hastial y alternativa de revestimiento confirmados.');
    const cap = server?.server?.getClientCapabilities?.()?.elicitation;
    const elicitar = cap && ('form' in cap || Object.keys(cap).length === 0) ? () => server.server.elicitInput({ message: `¿Autoriza rotular los planos del proyecto «${proyecto}» con este texto?\n\n${[datos.author && `Elaborado por: ${datos.author}`, datos.institution && `Institución: ${datos.institution}`].filter(Boolean).join('\n')}\n\nClaude propuso este texto; el servidor no puede comprobar que usted lo indicó.`, requestedSchema: { type: 'object', properties: { aprobar: { type: 'boolean', title: 'Autorizo este texto en los planos', default: false } }, required: ['aprobar'] } }) : null;
    const { datos: limpios, atribucion } = await autorizarAtribucion({ sandbox, ah: AH, project: proyecto, datos, elicitar });
    const r = await service.generate(proyecto, { model: limpios, paper: papel, orientation: orientacion });
    return ok('Cuatro láminas generadas para revisión. Validación CAD y visual pendientes.', { ...r, atribucion: atribucion ? { autorizada_por: atribucion.por, reutilizada: atribucion.reutilizada } : { estado: 'PENDIENTE', nota: 'Sin autor ni institución confirmados por una persona.' } });
  });
}
