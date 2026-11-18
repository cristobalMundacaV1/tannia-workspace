// Herramienta de trabajos en segundo plano (CAD-BG §4): delegar planos, cubicaciones, documentos y DWG sin ocupar el computador.
import { z } from 'zod';
import { ok, UserError } from '../mcp/util.js';
import { Coordinador, mensajeParaPersona, ACTIVOS, PASOS } from '../trabajos/coordinador.js';
import { detectarCoreConsole } from '../trabajos/coreconsole.js';
import { seleccionarModalidad, OPERACIONES, MODOS } from '../trabajos/modalidades.js';

const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const PRESETS = { planos: ['planos'], cubicaciones: ['planos', 'a_partidas'], documentos: ['presupuesto', 'memoria'], expediente: ['planos', 'a_partidas', 'presupuesto', 'memoria', 'dwg'], dwg: ['dwg'] };

const publico = (t) => ({ trabajo: t.id, proyecto: t.proyecto, estado_interno: t.estado, mensaje_para_la_persona: t.mensaje || mensajeParaPersona(t), pasos: t.pasos.map((p) => ({ paso: p.tipo, estado: p.estado, ...(p.resultado ? { resultado: p.resultado } : {}), ...(p.pregunta ? { pregunta: p.pregunta } : {}) })), creado: t.creado, actualizado: t.actualizado, ...(t.motivo ? { motivo: t.motivo } : {}) });

export function registerTrabajos(reg, { sandbox, coordinador = null, enFondo = !!process.env.TANNIA_TRABAJO_ID }) {
  const C = coordinador || new Coordinador({ home: sandbox.home });
  if (!enFondo) setImmediate(() => { try { C.reanudar(); C.programar(); } catch { /* sin trabajos */ } }); // al iniciar: reanudar lo interrumpido
  reg('tannia_trabajos', {
    title: 'Trabajos en segundo plano: planos, cubicaciones, documentos y DWG sin ocupar el computador',
    description: [
      'Use «crear» cuando la persona pida planos u otros archivos que tardan: el trabajo corre aparte, oculto y con prioridad baja, y ella puede seguir usando su computador (Word, Excel, AutoCAD). Responda con mensaje_para_la_persona y siga conversando.',
      'tipo: planos | cubicaciones (planos + partidas) | documentos (presupuesto + memoria) | expediente (todo, incluido DWG) | dwg. Para planos: «datos» (túnel) o «especificacion»; si no los da, se usan los datos del encargo (nunca valores por defecto).',
      'Sin AutoCAD: planos, cubicaciones y documentos. DWG: solo con AutoCAD sin interfaz (Core Console); si no existe, el trabajo termina «requiere intervención» con una pregunta para la persona — NUNCA abre AutoCAD por su cuenta. Un trabajo nunca verifica cantidades ni aprueba entregas.',
      '«estado» (de un trabajo o de los del proyecto), «cancelar» (lo que no terminó no se publica), «capacidades» (qué modalidades hay en este equipo). Consulte «estado» cuando la persona vuelva o pregunte.',
    ].join(' '),
    inputSchema: {
      accion: z.enum(['crear', 'estado', 'cancelar', 'capacidades']), proyecto: z.string().optional(), trabajo: z.string().max(20).optional(),
      tipo: z.enum(Object.keys(PRESETS)).optional(),
      datos: z.record(z.string(), z.any()).optional().describe('Solo planos de túnel: los mismos datos de tannia_planos generar_tunel'),
      especificacion: z.record(z.string(), z.any()).optional().describe('Solo planos genéricos: la especificación de tannia_planos generar'),
      asignaciones: z.array(z.object({ partida: z.string().max(80), codigo: z.string().max(40).optional(), apu: z.string().max(40).optional() })).max(200).optional(),
    }, annotations: RW,
  }, async ({ accion, proyecto, trabajo, tipo, datos, especificacion, asignaciones }) => {
    if (accion === 'capacidades') {
      const cc = detectarCoreConsole();
      const ops = Object.fromEntries(Object.keys(OPERACIONES).map((k) => [k, seleccionarModalidad(k, { coreConsole: cc })]));
      return ok(cc.disponible ? 'Este equipo puede generar planos, cubicaciones y documentos sin AutoCAD, y el DWG con AutoCAD sin interfaz (pendiente de comprobar en AutoCAD real).' : 'Este equipo puede generar planos, cubicaciones y documentos sin AutoCAD. El DWG necesitaría abrir AutoCAD con su ventana: se pedirá autorización antes.', { modos: MODOS, core_console: cc, operaciones: ops, limites: C.limites });
    }
    if (accion === 'crear') {
      if (!proyecto || !tipo) throw new UserError('FALTA_DATO', 'Indique proyecto y tipo de trabajo.');
      sandbox.projectRoot(proyecto);
      const pasos = PRESETS[tipo].map((t) => ({ tipo: t, args: t === 'planos' ? { ...(datos ? { datos } : {}), ...(especificacion ? { especificacion } : {}) } : t === 'a_partidas' && asignaciones ? { asignaciones } : {} }));
      const t = C.crear({ proyecto, pasos }); C.programar();
      const x = C.leer(t.id); const m = mensajeParaPersona({ ...x, estado: ACTIVOS.has(x.estado) ? 'PENDIENTE' : x.estado });
      return ok(m, { ...publico(x), mensaje_para_la_persona: m });
    }
    if (accion === 'cancelar') { if (!trabajo) throw new UserError('FALTA_DATO', 'Indique el trabajo.'); const t = C.cancelar(trabajo); return ok(t.estado === 'CANCELADO' ? t.mensaje : 'Pedí detener el trabajo: se detiene al terminar el paso en curso; lo que no alcance a terminar no se publica.', publico(t)); }
    // estado
    C.reanudar(); C.programar();
    if (trabajo) { const t = C.leer(trabajo); if (!t) throw new UserError('TRABAJO_NO_EXISTE', 'No existe ese trabajo.'); return ok(t.mensaje, publico(t)); }
    const lista = C.listar({ proyecto }).slice(-10);
    const activos = lista.filter((t) => ACTIVOS.has(t.estado) || t.estado === 'PENDIENTE');
    return ok(lista.length ? (activos.length ? activos.map((t) => t.mensaje).join(' ') : lista.at(-1).mensaje) : 'No hay trabajos en segundo plano.', { trabajos: lista.map(publico), pasos_disponibles: PASOS });
  });
  return C;
}
