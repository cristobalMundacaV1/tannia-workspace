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

  const handlesSchema = z.array(z.string().regex(/^[0-9A-Fa-f]{1,16}$/)).min(1).max(200);
  reg('tannia_cad_leer_geometria', {
    title: 'Leer extremos de líneas en AutoCAD (solo lectura)', description: 'Devuelve StartPoint/EndPoint, longitud, capa y tipo de las entidades indicadas (por handle) leídos por COM.',
    inputSchema: { handles: handlesSchema }, annotations: RO,
  }, async ({ handles }) => ok('Geometría leída desde AutoCAD.', await cad.leerGeometria(handles)));

  reg('tannia_cad_verificar_contorno', {
    title: 'Verificar cierre y medidas de un contorno de líneas (solo lectura)',
    description: 'Lee los extremos de las líneas por COM y comprueba con un cálculo independiente si forman un contorno CERRADO, si es un rectángulo (ángulos 90°, lados opuestos iguales) y sus medidas/área. ancho/alto esperados son opcionales y en UNIDADES DEL DIBUJO (no se convierten).',
    inputSchema: { handles: handlesSchema, ancho: z.number().positive().optional(), alto: z.number().positive().optional(), tolerancia: z.number().positive().optional() }, annotations: RO,
  }, async ({ handles, ...o }) => {
    const r = await cad.verificarContorno(handles, o);
    return ok(r.analisis.estado === 'ok' ? 'Contorno cerrado y medidas verificadas.' : 'Contorno con discrepancias (needs_review): ver analisis.discrepancias.', r);
  });

  reg('tannia_cad_verificar_persistencia', {
    title: 'Verificar que el DWG guardado conserva las entidades (cierra y reabre la copia)',
    description: 'Con la COPIA de trabajo activa y ya guardada: lee las entidades por lotes (cada tipo según sus propiedades reales: LINE, ARC, círculos, polilíneas, textos), cierra el documento sin guardar (se exige que no haya cambios pendientes), lo reabre desde disco, vuelve a leer y compara; registra huella/fecha del archivo antes y después. Sin "handles" verifica todo el espacio modelo (o la capa indicada). Lo que AutoCAD no informa queda "no verificable": no se compara null contra null. Solo copias de "03 Trabajo"; nunca originales.',
    inputSchema: { proyecto, archivo: z.string().describe('Ruta relativa de la copia, ej. "03 Trabajo/plano - copia de trabajo.dwg"'), handles: handlesSchema.optional().describe('Opcional: solo estas entidades'), capa: capaSchema.optional().describe('Opcional: solo esta capa'), creado_en: z.string().optional().describe('Marca de tiempo devuelta por tannia_cad_agregar_lineas, para comprobar que el archivo se guardó después'), tolerancia: z.number().positive().optional(), tam_lote: z.number().int().min(10).max(400).optional() }, annotations: RW,
  }, async ({ proyecto: p, ...rest }) => {
    const r = await cad.verificarPersistencia(p, rest);
    const msg = { verificada: 'Persistencia verificada: las entidades siguen en el DWG tras cerrar y reabrir.', fallida: 'PERSISTENCIA FALLIDA: hay diferencias tras reabrir (ver diferencias).', no_concluyente: 'Persistencia NO CONCLUYENTE: hay propiedades que AutoCAD no informó o lecturas incoherentes (ver no_verificables e inconsistencias_internas).' }[r.persistencia];
    return ok(msg, r);
  });
}
