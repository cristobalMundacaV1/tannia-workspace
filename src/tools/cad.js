import { z } from 'zod';
import { ok } from '../mcp/util.js';
import { resumenCapacidades } from '../cad/capabilities.js';
import { detectarAutoCad } from '../cad/detect.js';

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

export function registerCad(reg, { cad }) {
  const proyecto = z.string();
  reg('tannia_cad_capacidades', {
    title: 'Capacidades CAD por entidad y operación', description: 'Matriz de qué entidades 2D/3D y operaciones están SUPPORTED / UNSUPPORTED / UNVERIFIED, por backend (DXF de archivo y AutoCAD COM). Consúltela antes de prometer una medición 3D.',
    inputSchema: {}, annotations: RO,
  }, async () => ok('Matriz de capacidades. AutoCAD COM: todo UNVERIFIED hasta probarlo en un AutoCAD real.', resumenCapacidades()));

  reg('tannia_cad_estado', {
    title: 'Estado de AutoCAD', description: 'Detecta si AutoCAD está instalado (registro) y, en Windows, si hay una sesión abierta (COM). No modifica nada.',
    inputSchema: {}, annotations: RO,
  }, async () => {
    const det = detectarAutoCad();
    let sesion = null; let error = null;
    if (det.instalado && det.compatible) { try { sesion = await cad.estado(); } catch (e) { error = e.message; } }
    return ok(sesion ? 'AutoCAD conectado (NO VERIFICADO en AutoCAD real por el desarrollador).' : 'Sin sesión de AutoCAD disponible.', { instalacion: det, sesion, detalle: error, verificado_en_autocad_real: false });
  });

  reg('tannia_cad_listar_entidades', {
    title: 'Listar entidades del dibujo abierto en AutoCAD (solo lectura)', description: 'Lista handle, tipo y capa de las entidades del espacio modelo del documento activo.',
    inputSchema: { capa: z.string().optional(), maximo: z.number().int().min(1).max(5000).optional() }, annotations: RO,
  }, async (a) => ok('Entidades del documento activo.', await cad.listarEntidades(a)));

  reg('tannia_cad_medir_entidad', {
    title: 'Medir una entidad en AutoCAD (solo lectura)', description: 'Devuelve Length/Area/Volume que AutoCAD informa para una entidad (por handle). Los volúmenes de sólidos solo existen aquí, no en DXF.',
    inputSchema: { handle: z.string() }, annotations: RO,
  }, async ({ handle }) => ok('Medición informada por AutoCAD (contrato NO VERIFICADO en AutoCAD real).', await cad.medirEntidad(handle)));

  reg('tannia_cad_abrir_copia', {
    title: 'Abrir una copia de trabajo en AutoCAD', description: 'Abre en AutoCAD un archivo de "03 Trabajo" (nunca un original).',
    inputSchema: { proyecto, archivo: z.string() }, annotations: RW,
  }, async ({ proyecto: p, archivo }) => ok('Copia abierta.', await cad.abrirCopia(p, archivo)));

  reg('tannia_cad_agregar_linea', {
    title: 'Agregar una línea en la copia de trabajo activa', description: 'Edición de ejemplo: agrega una línea solo si el documento activo es una copia en "03 Trabajo" del proyecto. Guarda la copia.',
    inputSchema: { proyecto, x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), capa: z.string().optional() }, annotations: RW,
  }, async ({ proyecto: p, ...rest }) => ok('Línea agregada a la copia.', await cad.agregarLinea(p, rest)));
}
