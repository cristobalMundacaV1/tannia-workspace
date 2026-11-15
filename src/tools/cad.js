import { z } from 'zod';
import { ok } from '../mcp/util.js';
import { resumenCapacidades } from '../cad/capabilities.js';
import { detectarAutoCad } from '../cad/detect.js';
import { sanitizar } from '../cad/sanitize.js';

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const capaSchema = z.string().min(1).max(255);

export function registerCad(reg, { cad, detectar = detectarAutoCad }) {
  const proyecto = z.string();
  reg('tannia_cad_capacidades', {
    title: 'Capacidades CAD por entidad y operación', description: 'Matriz de qué entidades 2D/3D y operaciones están SUPPORTED / UNSUPPORTED / UNVERIFIED, por backend (DXF de archivo y AutoCAD COM). Consúltela antes de prometer una medición 3D.',
    inputSchema: {}, annotations: RO,
  }, async () => ok('Matriz de capacidades. AutoCAD COM: todo UNVERIFIED hasta probarlo en un AutoCAD real.', resumenCapacidades()));

  reg('tannia_cad_estado', {
    title: 'Estado de AutoCAD', description: 'Informa por SEPARADO (1) la detección por registro de Windows y (2) la conexión COM con la sesión abierta. Un fallo del registro no impide intentar COM. No modifica nada ni devuelve rutas fuera de Tannia Workspace.',
    inputSchema: {}, annotations: RO,
  }, async () => {
    const instalacion = detectar();
    let conexion_com; let conectado = false;
    if (instalacion.estado === 'no_windows') conexion_com = { conectado: false, codigo: 'AUTOCAD_NO_DISPONIBLE', mensaje: instalacion.motivo };
    else {
      try { const sesion = await cad.estadoSeguro(); conexion_com = { conectado: true, sesion }; conectado = true; }
      catch (e) { conexion_com = { conectado: false, codigo: e.code || 'AUTOCAD_ERROR', mensaje: sanitizar(e.message), que_hacer: e.hint || null, detalle: e.detalle || null }; }
    }
    return ok(conectado ? 'Conexión COM con AutoCAD establecida.' : 'Sin conexión COM con AutoCAD (ver conexion_com).', { instalacion_registro: instalacion, conexion_com, verificado_en_autocad_real: 'solo conexión/lectura de estado observadas por el usuario en AutoCAD 2027 (issue #8); resto NO VERIFICADO' });
  });

  reg('tannia_cad_listar_entidades', {
    title: 'Listar entidades del dibujo abierto en AutoCAD (solo lectura)', description: 'Lista handle, tipo y capa (y longitud si con_medidas) de las entidades del espacio modelo del documento activo.',
    inputSchema: { capa: z.string().optional(), maximo: z.number().int().min(1).max(5000).optional(), con_medidas: z.boolean().optional() }, annotations: RO,
  }, async ({ con_medidas, ...a }) => ok('Entidades del documento activo.', await cad.listarEntidades({ ...a, medidas: con_medidas })));

  reg('tannia_cad_medir_entidad', {
    title: 'Medir una entidad en AutoCAD (solo lectura)', description: 'Devuelve Length/Area/Volume que AutoCAD informa para una entidad (por handle). Los volúmenes de sólidos solo existen aquí, no en DXF.',
    inputSchema: { handle: z.string() }, annotations: RO,
  }, async ({ handle }) => ok('Medición informada por AutoCAD (contrato NO VERIFICADO en AutoCAD real).', await cad.medirEntidad(handle)));

  reg('tannia_cad_abrir_copia', {
    title: 'Abrir una copia de trabajo en AutoCAD', description: 'Abre en AutoCAD un archivo de "03 Trabajo" (nunca un original).',
    inputSchema: { proyecto, archivo: z.string() }, annotations: RW,
  }, async ({ proyecto: p, archivo }) => ok('Copia abierta.', await cad.abrirCopia(p, archivo)));

  reg('tannia_cad_agregar_linea', {
    title: 'Agregar una línea en la copia de trabajo activa', description: 'Agrega una línea solo si el documento activo es una copia de "03 Trabajo" del proyecto. Si indica capa, se crea o selecciona ANTES de dibujar. Todo o nada: ante un fallo se revierte. Guarda la copia.',
    inputSchema: { proyecto, x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), capa: capaSchema.optional() }, annotations: RW,
  }, async ({ proyecto: p, ...rest }) => ok('Línea agregada a la copia.', await cad.agregarLinea(p, rest)));

  reg('tannia_cad_agregar_lineas', {
    title: 'Agregar varias líneas en la copia de trabajo activa (todo o nada)', description: 'Hasta 100 líneas en una sola operación sobre la copia de "03 Trabajo" activa, opcionalmente en una capa (se crea si no existe, p. ej. TW_PRUEBA). Si cualquier línea falla se revierte todo lo creado en la operación (incluida la capa nueva). Guarda la copia una vez.',
    inputSchema: { proyecto, lineas: z.array(z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() })).min(1).max(100), capa: capaSchema.optional() }, annotations: RW,
  }, async ({ proyecto: p, lineas, capa }) => ok('Líneas agregadas a la copia.', await cad.agregarLineas(p, { lineas, capa })));
}
