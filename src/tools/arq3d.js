// Herramientas MCP del modelo 3D arquitectónico (general, reutilizable): niveles, muros con vanos, losas y cubiertas → sólidos 3D
// en AutoCAD, vistas, inspección, modificación por operaciones y coherencia con el plano 2D. Sin datos de ninguna vivienda concreta.
import { z } from 'zod';
import { ok } from '../mcp/util.js';
import { Project } from '../project/store.js';
import { Anteproyectos } from '../design/servicio.js';
import { Modelos3d } from '../arq3d/servicio.js';
import { CATALOGO_3D } from '../arq3d/operaciones.js';
import { CAPAS_3D, LIMITES } from '../arq3d/geometria.js';
import { SUPUESTOS_POR_DEFECTO } from '../arq3d/desde_anteproyecto.js';
import { VISTAS, ESTILOS } from '../cad/autocad_com.js';

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const AVISO = 'MODELO 3D PRELIMINAR de visualización y anteproyecto: alturas, espesores y pendientes son supuestos editables (no normativos); sin cálculo estructural, térmico ni de instalaciones; no apto para construcción. Los criterios chilenos (OGUC/NCh) son orientación: confirme los valores vigentes con tannia_conocimiento_consultar y las fuentes oficiales.';

const pt = z.tuple([z.number(), z.number()]).describe('[x, y] en mm');
const vanoS = z.object({ id: z.string(), tipo: z.enum(['puerta', 'ventana', 'paso']), posicion_mm: z.number().describe('Centro del vano medido a lo largo del muro desde p1'), ancho_mm: z.number(), alto_mm: z.number(), antepecho_mm: z.number().optional().describe('Obligatorio en ventanas (altura del alféizar)') });
const muroS = z.object({ id: z.string(), nivel: z.string(), p1: pt, p2: pt, espesor_mm: z.number(), tipo: z.enum(['ext', 'int']), altura_mm: z.number().optional().describe('Si falta, se usa la altura del nivel'), vanos: z.array(vanoS).optional() });
const nivelS = z.object({ id: z.string(), nombre: z.string().optional(), cota_mm: z.number(), altura_mm: z.number().describe('Altura libre de muros del nivel: SUPUESTO editable que debe declararse') });
const losaS = z.object({ id: z.string(), nivel: z.string(), contorno: z.array(pt).min(3).describe('Contorno ORTOGONAL; la losa queda bajo la cota del nivel'), espesor_mm: z.number() });
const cubS = z.object({ id: z.string(), nivel: z.string(), tipo: z.enum(['plana', 'un_agua', 'dos_aguas']), espesor_mm: z.number().optional(), pendiente_pct: z.number().optional().describe('Obligatoria en cubiertas inclinadas; NO se asume'), direccion: z.enum(['+x', '-x', '+y', '-y']).optional().describe('Hacia dónde cae el agua (un_agua)'), eje_cumbrera: z.enum(['x', 'y']).optional().describe('Eje paralelo a la cumbrera (dos_aguas)'), voladizo_mm: z.number().optional(), contorno: z.array(pt).optional() });
const modeloS = z.object({ niveles: z.array(nivelS).min(1), muros: z.array(muroS), losas: z.array(losaS).optional(), cubiertas: z.array(cubS).optional(), opciones: z.object({ cubierta_visible: z.boolean().optional() }).optional() });
const vistaS = z.enum(Object.keys(VISTAS)).describe('iso_so (isométrica suroeste, la más usual), iso_se, iso_ne, iso_no, planta, frontal, lateral_derecha, posterior, lateral_izquierda');
const estiloS = z.enum(Object.keys(ESTILOS)).describe('Estilo visual (conceptual recomendado para ver los recintos)');

const resumenModelo = (reg) => ({
  niveles: reg.modelo.niveles, muros: reg.modelo.muros.length, vanos: reg.modelo.muros.reduce((a, w) => a + (w.vanos?.length || 0), 0), losas: reg.modelo.losas.length, cubiertas: reg.modelo.cubiertas.map((c) => ({ id: c.id, tipo: c.tipo })),
  solidos: reg.resumen_geometria.n_primitivas, por_clase: reg.resumen_geometria.por_clase, volumen_muros_m3: reg.resumen_geometria.volumen_muros_m3, volumen_losas_m3: reg.resumen_geometria.volumen_losas_m3, envolvente_mm: reg.resumen_geometria.envolvente_mm,
  cubierta_visible: reg.modelo.opciones?.cubierta_visible === true,
});

export function registerArq3d(reg, { sandbox, cad }) {
  const A = new Anteproyectos(sandbox); const M = new Modelos3d(sandbox, A);
  const proyecto = z.string().describe('Nombre del proyecto');
  const nombre = z.string().min(1).max(60).describe('Nombre del modelo 3D (ej. "Casa Rodríguez 3D")');
  const version = z.string().optional().describe('Versión (por defecto la actual)');

  reg('tannia_3d_crear', {
    title: 'Crear un modelo 3D arquitectónico (niveles, muros con vanos, losas, cubiertas)',
    description: `Crea la primera versión de un modelo 3D PRELIMINAR. Dos fuentes (indique solo una): (A) "desde_anteproyecto": levanta en 3D un anteproyecto 2D existente (tannia_diseno_crear) conservando exactamente muros, espesores, vanos y posiciones; (B) "modelo": un modelo estructurado que usted diseña desde el encargo (niveles con cota y altura, muros por eje p1→p2 con espesor y vanos, losas ortogonales, cubiertas plana/un_agua/dos_aguas). Unidades mm, Z hacia arriba. NO inventa valores: alturas (por defecto ${SUPUESTOS_POR_DEFECTO.altura_muros_mm} mm solo si viene de un anteproyecto) y espesores son SUPUESTOS que debe declararle a la usuaria y que ella puede editar; las pendientes de cubierta son obligatorias en cubiertas inclinadas. Este paso solo calcula y guarda el modelo; use después tannia_3d_a_autocad para verlo en AutoCAD. ${AVISO}`,
    inputSchema: {
      proyecto, nombre, modelo: modeloS.optional(), desde_anteproyecto: z.object({ nombre: z.string(), version: z.string().optional() }).optional(),
      parametros: z.object({
        altura_muros_mm: z.number().min(LIMITES.altura_mm[0]).max(LIMITES.altura_mm[1]).optional().describe('Supuesto editable (solo con desde_anteproyecto)'), espesor_losa_mm: z.number().optional(),
        cubierta: cubS.omit({ id: true, nivel: true }).nullable().optional().describe('null = sin cubierta; por defecto plana de 150 mm'), cubierta_visible: z.boolean().optional().describe('Por defecto la cubierta queda OCULTA para ver el interior'),
      }).optional(),
      solicitud: z.string().max(2000).optional().describe('Texto original del encargo (queda en la trazabilidad)'),
    }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, modelo, desde_anteproyecto, parametros, solicitud }) => {
    const r = M.crear(p, { nombre: n, modelo, desde_anteproyecto, parametros: parametros || {}, solicitud });
    const coh = r.reg.origen ? M.coherencia2d(p, n, r.version) : null;
    const sup = r.reg.supuestos_lista;
    return ok(`Modelo 3D "${r.nombre}" ${r.version} creado: ${r.reg.resumen_geometria.n_primitivas} sólidos (${Object.entries(r.reg.resumen_geometria.por_clase).map(([k, v]) => `${v} ${k}`).join(', ')}). Aún no está en AutoCAD: use tannia_3d_a_autocad.${coh ? ` Coherencia con el plano 2D: ${coh.estado}.` : ''}\n${sup.length ? `Supuestos a confirmar con la usuaria: ${sup.join(' ')}\n` : ''}${AVISO}`, {
      modelo3d: r.nombre, version: r.version, archivo: `${r.rel}/${r.version}.json`, ...resumenModelo(r.reg), supuestos: r.reg.modelo.supuestos ?? null, supuestos_a_confirmar: sup, advertencias: r.reg.advertencias, coherencia_2d: coh, operaciones_disponibles: Object.keys(CATALOGO_3D), aviso: AVISO,
    });
  });

  reg('tannia_3d_modificar', {
    title: 'Modificar el modelo 3D con operaciones (nueva versión; el DWG anterior no se toca)',
    description: `Traduzca las nuevas instrucciones de la usuaria a operaciones explícitas y aplíquelas todas o ninguna: ${Object.entries(CATALOGO_3D).map(([k, v]) => `${k} (${v.campos})`).join('; ')}. También "actualizar_desde_anteproyecto" para que muros, vanos y losa vuelvan a coincidir con la versión indicada (o la actual) del plano 2D de origen, conservando niveles, alturas y cubierta del 3D. Crea una versión nueva inmutable; después use tannia_3d_a_autocad para generar su DWG. ${AVISO}`,
    inputSchema: { proyecto, nombre, operaciones: z.array(z.object({ operacion: z.enum(Object.keys(CATALOGO_3D)) }).loose()).optional(), actualizar_desde_anteproyecto: z.object({ version: z.string().optional() }).optional(), descripcion: z.string().max(300).optional() }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, operaciones, actualizar_desde_anteproyecto, descripcion }) => {
    const r = M.modificar(p, n, { operaciones, actualizar_desde_anteproyecto, descripcion });
    const coh = r.reg.origen ? M.coherencia2d(p, n, r.version) : null;
    return ok(`Modelo 3D "${r.nombre}" ${r.version} (desde ${r.padre}): ${r.resumen.join(' ')} ${coh ? `Coherencia con el 2D: ${coh.estado}.` : ''} Genere el DWG con tannia_3d_a_autocad.`, { modelo3d: r.nombre, version: r.version, padre: r.padre, cambios: r.resumen, ...resumenModelo(r.reg), supuestos_a_confirmar: r.reg.supuestos_lista, advertencias: r.reg.advertencias, coherencia_2d: coh, aviso: AVISO });
  });

  reg('tannia_3d_ver', {
    title: 'Ver modelos 3D, su estructura, supuestos y coherencia con el 2D',
    description: 'Sin "nombre": lista los modelos 3D del proyecto. Con "nombre": niveles, muros, vanos, losas, cubiertas, volúmenes, supuestos explícitos, advertencias, coherencia con el plano 2D de origen y el catálogo de operaciones.',
    inputSchema: { proyecto, nombre: nombre.optional(), version }, annotations: RO,
  }, async ({ proyecto: p, nombre: n, version: v }) => {
    if (!n) { const l = M.listar(p); return ok(l.length ? `${l.length} modelo(s) 3D: ${l.map((x) => `${x.nombre} (${x.head})`).join(', ')}.` : 'Aún no hay modelos 3D en este proyecto.', { modelos: l }); }
    const c = M.cargar(p, n, v); const coh = c.reg.origen ? M.coherencia2d(p, n, c.id) : null;
    return ok(`Modelo 3D "${c.h.nombre}" ${c.id}: ${c.reg.resumen_geometria.n_primitivas} sólidos.`, { modelo3d: c.h.nombre, version: c.id, ...resumenModelo(c.reg), modelo: c.reg.modelo, supuestos_a_confirmar: c.reg.supuestos_lista, advertencias: c.reg.advertencias, coherencia_2d: coh, capas: Object.fromEntries(Object.entries(CAPAS_3D).map(([k, x]) => [k, x.descripcion])), operaciones_disponibles: Object.fromEntries(Object.entries(CATALOGO_3D).map(([k, x]) => [k, `${x.descripcion} ${x.campos}`])), aviso: AVISO });
  });

  reg('tannia_3d_historial', {
    title: 'Historial del modelo 3D: listar, deshacer, rehacer o restaurar una versión',
    description: 'Mueve la versión actual del modelo 3D. Nada se borra: las versiones (y sus DWG) siguen en disco.',
    inputSchema: { proyecto, nombre, accion: z.enum(['listar', 'deshacer', 'rehacer', 'restaurar']), version }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, accion, version: v }) => { const r = M.historial(p, n, accion, v); return ok(accion === 'listar' ? `Versión actual ${r.head}.` : `Versión actual: ${r.head}.`, r); });

  reg('tannia_3d_a_autocad', {
    title: 'Construir el modelo 3D en AutoCAD (sólidos 3D editables) y guardarlo como DWG 3D independiente',
    description: `Crea en AutoCAD un dibujo NUEVO con un sólido 3D (3DSOLID) por cada prisma/cuña del modelo, capas TW3D_*, rótulo de modelo preliminar y vista isométrica (por defecto suroeste, estilo conceptual), y lo guarda como "<versión>_3D.dwg" en 03 Trabajo/Modelos3D/<nombre>/ (nunca sobrescribe; no toca el DWG 2D, ni originales ni otros dibujos abiertos). La cubierta queda en una capa OCULTA por defecto para ver los recintos. Verifica el archivo en disco y las capas; use tannia_3d_verificar para comprobar cada sólido. ${AVISO}`,
    inputSchema: { proyecto, nombre, version, vista: vistaS.optional(), estilo: estiloS.optional() }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, version: v, vista, estilo }) => {
    const c = M.cargar(p, n, v); const rt = M.rutas(p, n, c.id); const env = c.reg.resumen_geometria.envolvente_mm;
    const r = await cad.construir3d(p, { dwgRel: rt.dwg, primitivas: c.reg.primitivas, capas: c.reg.capas, nota: c.reg.nota, nota_pos: env ? [env.min[0], env.min[1] - 1500, 0] : [0, -1500, 0], vista: vista || 'iso_so', estilo: estilo || 'conceptual' });
    new Project(sandbox, p).audit('modelo3d_dwg', { nombre: n, version: c.id });
    return ok(r.archivo_dwg.cabecera_dwg_valida ? `DWG 3D guardado: ${r.dwg} (${r.entidades} entidades; vista ${vista || 'iso_so'}). ${r.verificacion_estructura.ok ? 'Capas y conteos coinciden con el modelo.' : 'ATENCIÓN: capas/conteos no coinciden (ver verificacion_estructura).'} Compruebe a ojo la vista y el estilo visual; verifique cada sólido con tannia_3d_verificar.` : r.verificacion, { modelo3d: n, version: c.id, ...r, supuestos_a_confirmar: c.reg.supuestos_lista, aviso: AVISO });
  });

  reg('tannia_3d_vista', {
    title: 'Cambiar la vista 3D de AutoCAD (isométrica, planta, alzados), estilo visual y capas visibles',
    description: 'Sobre el dibujo ACTIVO (debe ser una copia en 03 Trabajo): fija la dirección de vista, hace zoom a la extensión, pide el estilo visual y muestra/oculta capas (p. ej. ocultar TW3D_CUBIERTA para ver el interior, mostrarla para ver la casa cerrada). Es una inspección: no cambia la geometría; la vista queda en el DWG solo si usted lo guarda en AutoCAD.',
    inputSchema: { proyecto, vista: vistaS.optional(), estilo: estiloS.optional(), mostrar: z.array(z.string()).optional(), ocultar: z.array(z.string()).optional() }, annotations: RW,
  }, async ({ proyecto: p, vista, estilo, mostrar, ocultar }) => { const r = await cad.vista3d(p, { vista: vista || 'iso_so', estilo: estilo ?? null, mostrar: mostrar || [], ocultar: ocultar || [] }); return ok(`Vista ${r.vista} aplicada${estilo ? ` (estilo ${estilo} solicitado: confírmelo en pantalla)` : ''}.`, r); });

  reg('tannia_3d_inspeccionar', {
    title: 'Inspeccionar los sólidos 3D del dibujo activo (volumen, centroide, caja envolvente)',
    description: 'Solo lectura del dibujo activo (copia en 03 Trabajo): cuenta y mide los 3DSOLID por capa (volumen, centroide, caja envolvente) para comprobar el modelo o localizar un handle antes de moverlo.',
    inputSchema: { proyecto, capa: z.string().optional(), max: z.number().int().min(1).max(2000).optional() }, annotations: RO,
  }, async ({ proyecto: p, capa, max }) => { const r = await cad.inspeccionarSolidos(p, { capa, max: max || 400 }); return ok(`${r.total_solidos} sólido(s) 3D en ${r.documento}${r.truncado ? ' (lectura truncada: acote por capa)' : ''}.`, r); });

  reg('tannia_3d_solido_transformar', {
    title: 'Mover o rotar un sólido 3D concreto en AutoCAD',
    description: `Mueve (dx, dy, dz en mm) o rota alrededor de Z (grados, centro [x,y]) UN sólido del dibujo activo (copia en 03 Trabajo) con marca de deshacer. No guarda salvo guardar=true. ATENCIÓN: el DWG deja de coincidir con el modelo guardado; los cambios que deban persistir se hacen con tannia_3d_modificar y se regenera el DWG.`,
    inputSchema: { proyecto, handle: z.string(), operacion: z.enum(['mover', 'rotar_z']), dx: z.number().optional(), dy: z.number().optional(), dz: z.number().optional(), grados: z.number().optional(), centro: pt.optional(), guardar: z.boolean().optional() }, annotations: RW,
  }, async ({ proyecto: p, ...args }) => { const r = await cad.transformarSolido(p, args); return ok(`Sólido ${args.handle}: ${args.operacion} aplicado${args.guardar ? ' y guardado' : ' (sin guardar)'}.`, r); });

  reg('tannia_3d_verificar', {
    title: 'Verificar que el DWG 3D es fiel al modelo y que el 3D es coherente con el plano 2D',
    description: 'Con el DWG 3D de la versión activo en AutoCAD: lee CADA sólido (volumen, centroide, caja envolvente, capa) y lo compara con el valor calculado analíticamente desde el modelo; comprueba capas y conteos; y, si el modelo viene de un anteproyecto 2D, compara huella de muros y vanos con ese plano. Estados: fiel / con_diferencias / no_concluyente (p. ej. AutoCAD no informó la caja envolvente). Solo lectura. Para cierre y reapertura use además tannia_cad_verificar_persistencia.',
    inputSchema: { proyecto, nombre, version, tam_lote: z.number().int().min(10).max(400).optional() }, annotations: RO,
  }, async ({ proyecto: p, nombre: n, version: v, tam_lote }) => {
    const c = M.cargar(p, n, v); const rt = M.rutas(p, n, c.id);
    const r = await cad.verificarSolidos(p, { dwgRel: rt.dwg, primitivas: c.reg.primitivas, tam_lote });
    const coh = c.reg.origen ? M.coherencia2d(p, n, c.id) : null;
    const msg = { fiel: `DWG 3D fiel al modelo ${c.id}: cada sólido coincide en volumen, centroide, caja envolvente y capa.`, con_diferencias: 'El DWG 3D tiene DIFERENCIAS con el modelo (ver solidos y estructura).', no_concluyente: 'Verificación NO CONCLUYENTE (ver solidos.caja_envolvente).' }[r.estado];
    return ok(`${msg}${coh ? ` Coherencia con el plano 2D: ${coh.estado}.` : ''}`, { modelo3d: n, version: c.id, ...r, coherencia_2d: coh });
  });
}
