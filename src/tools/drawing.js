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
    description: 'Planos técnicos. generar: motor genérico (planta, corte, elevación, perfil, sección, detalle) desde una especificación. generar_tunel crea cuatro láminas (cinco con «fortificacion»: pernos y malla dibujados y cubicados en el mismo motor) académicas DXF/PDF en revisión inmutable; estado verifica manifiesto; sesion consulta la copia CAD por ruta; operacion consulta recuperación; inspeccionar_aislado (SOLO LECTURA: entidades, layouts, viewports y nombre del documento aislado que dejó una importación), marcas (lista las ejecuciones parciales/inciertas) y reconciliar_marcas (solo lectura por COM; las marcas nunca se borran). Tannia nunca cierra ni guarda documentos del usuario. No certifica construcción ni aprueba entregas. NUNCA deduzca author/institution de la cuenta, el correo o el equipo: use solo lo que la persona dijo; un nombre propuesto requiere su autorización y, sin él, el campo queda PENDIENTE. La escala se conserva: si no cabe, falla. No abre AutoCAD ni sustituye originales.',
    inputSchema: { proyecto: z.string(), accion: z.enum(['generar', 'generar_tunel', 'estado', 'sesion', 'operacion', 'exportar_dwg', 'inspeccionar_aislado', 'marcas', 'reconciliar_marcas']), archivo: z.string().optional(), documento: z.string().max(60).optional(), operacion: z.string().optional(), papel: z.enum(['A3', 'A2', 'A1']).optional(), orientacion: z.enum(['landscape', 'portrait']).optional(), datos: z.object({ length: z.number().positive().max(10000), width: z.number().positive().max(100), wall: z.number().positive().max(100), selected: z.union([z.literal(0.06), z.literal(0.08)]), fortificacion: z.object({ perno_longitud: z.number().positive().max(20), espaciamiento_transversal: z.number().positive().max(10), espaciamiento_longitudinal: z.number().positive().max(10), malla: z.boolean(), traslapo_malla_pct: z.number().min(0).max(50).optional() }).optional(), date: z.string().max(90).optional(), institution: z.string().max(90).optional(), author: z.string().max(90).optional(), revision: z.string().max(90).optional() }).optional(), especificacion: z.record(z.string(), z.any()).optional().describe('Solo con accion=generar: especificación genérica de planos (codigo, especialidad, capas, vistas con elementos linea/polilinea/rectangulo/arco/circulo y cotas lineal/radial en metros, laminas). Escalas normalizadas; si una vista no cabe, falla sin cambiar la escala.') },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ proyecto, accion, datos, papel, orientacion, archivo, operacion, documento, especificacion }) => {
    if (accion === 'inspeccionar_aislado') return ok('Inspección de solo lectura del documento aislado (no se modificó ni guardó nada).', await cad.inspeccionarAislado(proyecto, { documento: documento ?? null }));
    if (accion === 'marcas') return ok('Ejecuciones parciales o inciertas registradas (las marcas se conservan siempre).', { marcas: cad.marcas(proyecto) });
    if (accion === 'reconciliar_marcas') return ok('Reconciliación de solo lectura; las marcas originales se conservan.', await cad.reconciliarMarcas(proyecto, { archivo: archivo ?? null }));
    if (accion === 'estado') return ok('Estado y archivos de revisión.', service.status(proyecto));
    if (accion === 'exportar_dwg') return ok('Resultado de guardado DWG; revise la evidencia adjunta.', await service.exportDwg(proyecto, cad));
    if (accion === 'operacion') { if (!operacion) throw new UserError('FALTA_OPERACION', 'Falta identificar la operación.'); return ok('Registro de ejecución CAD.', new CadOperations(sandbox.projectRoot(proyecto)).status(operacion)); }
    if (accion === 'sesion') { if (!archivo) throw new UserError('FALTA_ARCHIVO', 'Indique la copia de trabajo.'); return ok('Sesión CAD identificada.', await cad.sesion(proyecto, archivo)); }
    if (accion === 'generar') {
      if (!especificacion) throw new UserError('FALTAN_DATOS', 'Falta la especificación de los planos (vistas, elementos, cotas y láminas).');
      const r = await service.generate(proyecto, { especificacion, paper: papel, orientation: orientacion });
      return ok('Láminas generadas para revisión (DXF con cotas nativas y layouts, PDF y vista previa). Validación en AutoCAD y revisión visual pendientes.', r);
    }
    if (!datos) throw new UserError('FALTAN_DATOS', 'Se requieren longitud, ancho, hastial y alternativa de revestimiento confirmados.');
    const cap = server?.server?.getClientCapabilities?.()?.elicitation;
    const elicitar = cap && ('form' in cap || Object.keys(cap).length === 0) ? () => server.server.elicitInput({ message: `¿Autoriza rotular los planos del proyecto «${proyecto}» con este texto?\n\n${[datos.author && `Elaborado por: ${datos.author}`, datos.institution && `Institución: ${datos.institution}`].filter(Boolean).join('\n')}\n\nClaude propuso este texto; el servidor no puede comprobar que usted lo indicó.`, requestedSchema: { type: 'object', properties: { aprobar: { type: 'boolean', title: 'Autorizo este texto en los planos', default: false } }, required: ['aprobar'] } }) : null;
    const { datos: limpios, atribucion } = await autorizarAtribucion({ sandbox, ah: AH, project: proyecto, datos, elicitar });
    const r = await service.generate(proyecto, { model: limpios, paper: papel, orientation: orientacion });
    return ok(`${r.files.filter((f) => /lamina-.*\.pdf$/.test(f)).length} láminas generadas para revisión. Validación CAD y visual pendientes.`, { ...r, atribucion: atribucion ? { autorizada_por: atribucion.por, reutilizada: atribucion.reutilizada } : { estado: 'PENDIENTE', nota: 'Sin autor ni institución confirmados por una persona.' } });
  });
}
