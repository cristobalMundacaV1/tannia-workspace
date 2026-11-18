import { z } from 'zod';
import { DrawingService } from '../drawing/service.js';
import { CadOperations } from '../cad/operations.js';
import { ok, UserError, conArchivos } from '../mcp/util.js';
const entregables = (r) => ({ carpeta: r.folder, archivos: r.files.filter((f) => /\.(pdf|dxf|csv)$/.test(f) && !/lamina-\d/.test(f)).map((f) => `${r.folder}/${f}`) });
import { AprobacionHumana } from '../cic/aprobacion_humana.js';
import { autorizarAtribucion } from '../drawing/atribucion.js';
import { Project } from '../project/store.js';
import { partidasDesdePlanos, planosVigentes } from '../expediente/planos_partidas.js';
import { detectarCoreConsole } from '../trabajos/coreconsole.js';
import { seleccionarModalidad } from '../trabajos/modalidades.js';

export function registerDrawing(reg, { sandbox, cad, server = null, aprobacion = null, guardarPartida = null, coordinador = null }) {
  const service = new DrawingService(sandbox); const AH = aprobacion || new AprobacionHumana(sandbox);
  reg('tannia_planos', {
    title: 'Preparar, verificar y consultar planos técnicos',
    description: 'Planos técnicos. generar: motor genérico (planta, corte, elevación, perfil, sección, detalle) desde una especificación; las cantidades se piden como «mediciones» (longitud, area, conteo, descuentos) sobre entidades dibujadas, o como «cantidades_declaradas» con origen; no se admiten cantidades ya calculadas. generar_tunel (SOLO bóveda semicircular radio = width/2 sobre hastiales verticales de altura «wall», revestimiento 0,06 o 0,08 m; otra forma de sección → «generar» con especificación; nunca suponga «wall» ni la fortificación) crea cuatro láminas (cinco con «fortificacion»: pernos y malla dibujados y cubicados en el mismo motor) académicas DXF/PDF en revisión inmutable; estado verifica manifiesto; sesion consulta la copia CAD por ruta; operacion consulta recuperación; inspeccionar_aislado (SOLO LECTURA: entidades, layouts, viewports y nombre del documento aislado que dejó una importación), marcas (lista las ejecuciones parciales/inciertas) y reconciliar_marcas (solo lectura por COM; las marcas nunca se borran). exportar_dwg: guarda el DWG SIN usar la ventana de AutoCAD (Core Console, en segundo plano); si este equipo no lo permite, NO abre AutoCAD: explica y pregunta. exportar_dwg_interactivo: SOLO si la persona dijo que quiere hacerlo ahora con AutoCAD abierto; muestra una ventana para que ella autorice (qué se hará, qué dibujo, qué queda intacto). a_partidas (después de generar): convierte las cantidades MEDIDAS en la revisión vigente de planos (contrato tw.cantidades/1, solo filas de detalle trazadas) en partidas del presupuesto, ligadas a esa revisión; si los planos cambian, esas partidas quedan desactualizadas y la entrega se bloquea hasta repetir a_partidas; las mediciones sin elemento físico (NEEDS_REVIEW) no se convierten. Tannia nunca cierra ni guarda documentos del usuario. No certifica construcción ni aprueba entregas. NUNCA deduzca author/institution de la cuenta, el correo o el equipo: use solo lo que la persona dijo; un nombre propuesto requiere su autorización y, sin él, el campo queda PENDIENTE. La escala se conserva: si no cabe, falla. No abre AutoCAD ni sustituye originales.',
    inputSchema: { proyecto: z.string(), accion: z.enum(['generar', 'generar_tunel', 'a_partidas', 'estado', 'sesion', 'operacion', 'exportar_dwg', 'exportar_dwg_interactivo', 'inspeccionar_aislado', 'marcas', 'reconciliar_marcas']), asignaciones: z.array(z.object({ partida: z.string().max(80), codigo: z.string().max(40).optional(), apu: z.string().max(40).optional() })).max(200).optional().describe('Solo con a_partidas: código y APU que la persona quiere para cada partida medida en los planos'), archivo: z.string().optional(), documento: z.string().max(60).optional(), operacion: z.string().optional(), papel: z.enum(['A3', 'A2', 'A1']).optional(), orientacion: z.enum(['landscape', 'portrait']).optional(), datos: z.object({ length: z.number().positive().max(10000), width: z.number().positive().max(100), wall: z.number().positive().max(100), selected: z.union([z.literal(0.06), z.literal(0.08)]), fortificacion: z.object({ perno_longitud: z.number().positive().max(20), espaciamiento_transversal: z.number().positive().max(10), espaciamiento_longitudinal: z.number().positive().max(10), malla: z.boolean(), traslapo_malla_pct: z.number().min(0).max(50).optional() }).optional(), date: z.string().max(90).optional(), institution: z.string().max(90).optional(), author: z.string().max(90).optional(), revision: z.string().max(90).optional() }).optional(), especificacion: z.record(z.string(), z.any()).optional().describe('Solo con accion=generar: especificación genérica de planos (codigo, especialidad, capas, vistas con elementos linea/polilinea/rectangulo/arco/circulo y cotas lineal/radial en metros, laminas). Escalas normalizadas; si una vista no cabe, falla sin cambiar la escala.') },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ proyecto, accion, datos, papel, orientacion, archivo, operacion, documento, especificacion, asignaciones }) => {
    if (accion === 'a_partidas') {
      if (!guardarPartida) throw new UserError('NO_DISPONIBLE', 'La creación de partidas no está disponible en esta configuración.');
      const pr = new Project(sandbox, proyecto); sandbox.projectRoot(proyecto);
      const r = partidasDesdePlanos(pr, { asignaciones: asignaciones || [], guardar: (p) => guardarPartida(pr, p) });
      if (!r.creadas.length) throw new UserError('SIN_PARTIDAS_PRESUPUESTABLES', 'Ninguna cantidad de los planos se puede llevar al presupuesto todavía.', 'Vincule cada medición a un elemento físico (o declare la cantidad con su origen) y vuelva a generar los planos.', { bloqueadas: r.bloqueadas, revision_planos: r.revision_planos });
      return ok(`${r.creadas.length} partida(s) desde los planos ${r.revision_planos}${r.bloqueadas.length ? `; ${r.bloqueadas.length} cantidad(es) NO se llevaron al presupuesto (ver motivo)` : ''}. Quedan sin verificar: una persona debe confirmarlas.`, r);
    }
    if (accion === 'inspeccionar_aislado') return ok('Inspección de solo lectura del documento aislado (no se modificó ni guardó nada).', await cad.inspeccionarAislado(proyecto, { documento: documento ?? null }));
    if (accion === 'marcas') return ok('Ejecuciones parciales o inciertas registradas (las marcas se conservan siempre).', { marcas: cad.marcas(proyecto) });
    if (accion === 'reconciliar_marcas') return ok('Reconciliación de solo lectura; las marcas originales se conservan.', await cad.reconciliarMarcas(proyecto, { archivo: archivo ?? null }));
    if (accion === 'estado') return ok('Estado y archivos de revisión.', service.status(proyecto));
    if (accion === 'exportar_dwg') {
      // CAD-BG: nunca se usa la sesión de AutoCAD de la persona por iniciativa del sistema. Modo B (sin interfaz) o intervención explicada.
      const sel = seleccionarModalidad('dwg', { coreConsole: detectarCoreConsole() });
      if (sel.modo === 'B' && coordinador) { sandbox.projectRoot(proyecto); const t = coordinador.crear({ proyecto, pasos: [{ tipo: 'dwg', args: {} }] }); coordinador.programar(); const x = coordinador.leer(t.id); return ok(`Estoy guardando los planos en DWG con AutoCAD sin interfaz. Puedes seguir utilizando tu computador; tus dibujos abiertos no se tocan.`, { trabajo: x.id, modalidad: 'B', estado_interno: x.estado }); }
      const v = planosVigentes(new Project(sandbox, proyecto));
      throw new UserError('REQUIERE_INTERVENCION', 'Para guardar los planos en DWG necesito usar AutoCAD con su ventana, porque en este equipo no está disponible AutoCAD sin interfaz. No abrí nada.', 'Pregunte a la persona si autoriza hacerlo ahora (exportar_dwg_interactivo muestra la ventana de autorización) o si prefiere después. Los DXF y PDF siguen siendo válidos.', { modalidad_requerida: 'C', motivo_tecnico: sel.motivo, revision_planos: v?.head ?? null, que_se_hara: 'Crear en AutoCAD un dibujo nuevo, importar el DXF de los planos vigentes y guardarlo como DWG en 03 Trabajo.', que_queda_intacto: 'Los dibujos que la persona tiene abiertos (aunque no estén guardados): no se guardan, no se cierran y no reciben entidades.', si_pospone: 'Los planos DXF y PDF siguen disponibles; el DWG queda pendiente.' });
    }
    if (accion === 'exportar_dwg_interactivo') {
      // Modo C: la autorización la pide la política ÚNICA del adaptador COM (misma ventana para toda operación interactiva).
      const v = planosVigentes(new Project(sandbox, proyecto)); if (!v) throw new UserError('SIN_PLANOS', 'Aún no hay planos generados.');
      return ok('Resultado de guardado DWG (modalidad interactiva autorizada por la persona). Se verificaron conteos, capas, cotas, XDATA y layouts; la fidelidad geométrica entidad por entidad queda PENDIENTE de verificación en AutoCAD real.', await service.exportDwg(proyecto, cad));
    }
    if (accion === 'operacion') { if (!operacion) throw new UserError('FALTA_OPERACION', 'Falta identificar la operación.'); return ok('Registro de ejecución CAD.', new CadOperations(sandbox.projectRoot(proyecto)).status(operacion)); }
    if (accion === 'sesion') { if (!archivo) throw new UserError('FALTA_ARCHIVO', 'Indique la copia de trabajo.'); return ok('Sesión CAD identificada.', await cad.sesion(proyecto, archivo)); }
    if (accion === 'generar') {
      if (!especificacion) throw new UserError('FALTAN_DATOS', 'Falta la especificación de los planos (vistas, elementos, cotas y láminas).');
      const r = await service.generate(proyecto, { especificacion, paper: papel, orientation: orientacion });
      return conArchivos(ok('Láminas generadas para revisión (DXF con cotas nativas y layouts, PDF y vista previa). Validación en AutoCAD y revisión visual pendientes.', r), { raiz: sandbox.projectRoot(proyecto), ...entregables(r) });
    }
    if (!datos) throw new UserError('FALTAN_DATOS', 'Se requieren longitud, ancho, hastial y alternativa de revestimiento confirmados.');
    const cap = server?.server?.getClientCapabilities?.()?.elicitation;
    const elicitar = cap && ('form' in cap || Object.keys(cap).length === 0) ? () => server.server.elicitInput({ message: `¿Autoriza rotular los planos del proyecto «${proyecto}» con este texto?\n\n${[datos.author && `Elaborado por: ${datos.author}`, datos.institution && `Institución: ${datos.institution}`].filter(Boolean).join('\n')}\n\nClaude propuso este texto; el servidor no puede comprobar que usted lo indicó.`, requestedSchema: { type: 'object', properties: { aprobar: { type: 'boolean', title: 'Autorizo este texto en los planos', default: false } }, required: ['aprobar'] } }) : null;
    const { datos: limpios, atribucion } = await autorizarAtribucion({ sandbox, ah: AH, project: proyecto, datos, elicitar });
    const r = await service.generate(proyecto, { model: limpios, paper: papel, orientation: orientacion });
    return conArchivos(ok(`${r.files.filter((f) => /lamina-.*\.pdf$/.test(f)).length} láminas generadas para revisión. Validación CAD y visual pendientes.`, { ...r, atribucion: atribucion ? { autorizada_por: atribucion.por, reutilizada: atribucion.reutilizada } : { estado: 'PENDIENTE', nota: 'Sin autor ni institución confirmados por una persona.' } }), { raiz: sandbox.projectRoot(proyecto), ...entregables(r) });
  });
}
