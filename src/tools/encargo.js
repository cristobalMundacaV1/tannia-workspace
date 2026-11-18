// Herramienta del encargo profesional (G04 de TW-PRO-E2E): objetivo → datos con procedencia → una ronda de preguntas → plan por resultados.
import { z } from 'zod';
import { ok } from '../mcp/util.js';
import { iniciarEncargo, registrarDatos, planEncargo, marcarPreguntadas, mensajeEncargo, ESTADOS_DATO, RESULTADOS } from '../encargo/encargo.js';

const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const dato = z.object({
  clave: z.string().max(60), valor: z.union([z.number(), z.boolean(), z.string().max(500), z.null()]).optional(), unidad: z.string().max(10).optional(), estado: z.enum(ESTADOS_DATO),
  origen: z.object({ source_id: z.string().max(40).optional(), cita: z.string().max(400).optional().describe('Frase LITERAL del documento'), pagina: z.number().int().optional(), declarado_por: z.string().max(80).optional(), motivo: z.string().max(300).optional() }).optional(),
});

export function registerEncargo(reg, { sandbox }) {
  reg('tannia_encargo', {
    title: 'Encargo de la obra: qué se pidió, qué datos hay, qué falta y qué se puede hacer ya',
    description: [
      'Columna vertebral de un encargo completo (antecedentes → planos → cubicaciones → presupuesto → memoria → entrega). Flujo:',
      '1) Reciba los antecedentes con tannia_expediente_recibir (una ruta). 2) accion "iniciar" con el objetivo en palabras de la persona (perfil túnel/edificación se detecta).',
      '3) Lea los documentos y registre con accion "datos" lo que encuentre: VERIFICADO exige source_id + cita LITERAL del documento que contenga el número (el servidor lo comprueba en el texto y rechaza citas inexistentes); lo que diga la persona es DECLARADO (origen.declarado_por); una suposición es HIPOTESIS con motivo y nunca se presenta como diseño aprobado. No invente valores ni use «típicos».',
      '4) accion "plan": devuelve resultados (LISTO / HECHO / BLOQUEADO / PARCIAL / DESACTUALIZADO / AUTORIZACION_PENDIENTE), las preguntas indispensables AGRUPADAS con su porqué y efecto, y parametros_motor listos para tannia_planos. Haga TODAS esas preguntas en UNA sola ronda, y marque accion "preguntas_hechas"; avance en paralelo con lo que ya está LISTO.',
      'Hable a la persona con mensaje_para_la_persona (lenguaje de obra, sin nombres de herramientas, JSON ni rutas técnicas).',
    ].join(' '),
    inputSchema: {
      proyecto: z.string(), accion: z.enum(['iniciar', 'datos', 'plan', 'preguntas_hechas']),
      objetivo: z.string().max(2000).optional().describe('Con "iniciar": lo que pidió la persona, en sus palabras'), perfil: z.enum(['tunel', 'edificacion']).optional(),
      entregables: z.array(z.enum(Object.keys(RESULTADOS))).max(5).optional(), datos: z.array(dato).max(60).optional(), claves: z.array(z.string().max(60)).max(60).optional(),
    }, annotations: RW,
  }, async ({ proyecto, accion, objetivo, perfil, entregables, datos, claves }) => {
    let registro = null;
    if (accion === 'iniciar') iniciarEncargo(sandbox, proyecto, { objetivo, perfil, entregables });
    if (accion === 'datos') registro = await registrarDatos(sandbox, proyecto, datos || []);
    if (accion === 'preguntas_hechas') marcarPreguntadas(sandbox, proyecto, claves || []);
    const plan = planEncargo(sandbox, proyecto); const mensaje = mensajeEncargo(plan);
    const resumen = registro ? `${registro.aceptados.length} dato(s) registrado(s)${registro.rechazados.length ? `, ${registro.rechazados.length} rechazado(s) (ver motivo)` : ''}. ` : '';
    return ok(`${resumen}${mensaje}`, { mensaje_para_la_persona: mensaje, ...(registro ? { registro } : {}), ...plan });
  });
}
