// Herramientas MCP del asistente de anteproyecto: pocas y de alto nivel (Tannia pide resultados; no dibuja elementos sueltos).
import { z } from 'zod';
import fs from 'node:fs';
import { ok, UserError } from '../mcp/util.js';
import { Project } from '../project/store.js';
import { sha256File } from '../security/sandbox.js';
import { Anteproyectos, resumenRecintos, vistaAscii } from '../design/servicio.js';
import { CATALOGO } from '../design/operaciones.js';
import { inspeccionarMuros, candidatosLibres } from '../design/inspeccion.js';
import { cubicarAnteproyecto } from '../design/cubicacion.js';
import { consultarConocimiento } from '../conocimiento/index.js';
import { SISTEMAS } from '../conocimiento/criterios.js';
import { FUENTES } from '../conocimiento/fuentes.js';

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RW = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const tabla = (geo) => ['| Recinto | Medidas útiles (m) | Superficie |', '|---|---|---|', ...resumenRecintos(geo).map((r) => `| ${r.recinto} | ${r.ancho_m.toFixed(2)} × ${r.fondo_m.toFixed(2)} | ${r.area_m2.toFixed(2)} m² |`)].join('\n');
const brevesAdv = (coh) => coh.advertencias.map((a) => `• ${a.mensaje}`);
const fundBreves = (m) => m.fundamentos.slice(0, 5).map((f) => ({ decision: f.decision, criterio: f.criterio, origen: f.origen, confirmar_en: f.confirmar_en.map((id) => FUENTES[id]?.nombre || id) }));

function presentar(titulo, r, extra = '') {
  const v = vistaAscii(r.geo);
  const adv = brevesAdv(r.coherencia);
  const texto = [
    `${titulo} — ${r.version} · ANTEPROYECTO (no apto para construcción)`,
    `Superficie construida ${r.geo.areas.construida_m2.toFixed(2)} m² · útil ${r.geo.areas.util_neta_m2.toFixed(2)} m² · ${SISTEMAS[r.modelo.sistema].nombre}`,
    '', tabla(r.geo), '', '```', v.plano, '```', v.leyenda.join(' · '), v.escala,
    ...(adv.length ? ['', 'A tener presente:', ...adv] : []),
    ...(extra ? ['', extra] : []),
    '', `Archivos: ${r.archivos.svg} (ábralo en el navegador) · ${r.archivos.dxf} (AutoCAD; use tannia_diseno_a_autocad para guardarlo como DWG).`,
  ].join('\n');
  return texto;
}

export function registerDiseno(reg, { sandbox, cad }) {
  const A = new Anteproyectos(sandbox);
  const proyecto = z.string().describe('Nombre del proyecto');
  const nombre = z.string().min(1).max(60).describe('Nombre del anteproyecto (ej. "Casa 80 m2")');

  reg('tannia_diseno_crear', {
    title: 'Diseñar un anteproyecto de vivienda (primera versión editable)',
    description: 'Tannia pide un RESULTADO ("casa de un piso de ~80 m², 3 dormitorios, 2 baños, living-comedor y cocina americana"): traduzca su pedido al programa y llame a esta herramienta SIN pedirle que dibuje nada. Genera una distribución coherente con supuestos y criterio técnico integrado (sistema constructivo, sísmica básica, habitabilidad), un plano 2D editable (DXF) y una vista (SVG/ASCII). Presente la propuesta, los supuestos y solo las preguntas esenciales; Tannia refina después con tannia_diseno_modificar. Siempre es un ANTEPROYECTO, no apto para construcción.',
    inputSchema: {
      proyecto, nombre, solicitud: z.string().max(2000).optional().describe('Texto original del pedido de Tannia (queda en la trazabilidad)'),
      programa: z.object({
        superficie_objetivo_m2: z.number().min(40).max(200).optional(), dormitorios: z.number().int().min(1).max(6).optional(), banos: z.number().int().min(1).max(4).optional(),
        cocina: z.enum(['americana', 'cerrada']).optional(), sistema_constructivo: z.enum(['albanileria_confinada', 'hormigon_armado', 'entramado_madera']).optional(), variante: z.enum(['A', 'B']).optional().describe('B = planta espejada (alternativa)'),
      }).optional(),
    }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, solicitud, programa }) => {
    const r = A.crear(p, { nombre: n, solicitud, programa: programa || {} });
    const sup = r.modelo.supuestos; const preg = r.modelo.preguntas;
    const extra = [sup.length ? `Supuestos: ${sup.join(' ')}` : '', `Preguntas para Tannia: ${preg.join(' / ')}`].filter(Boolean).join('\n');
    return ok(presentar(`Anteproyecto "${r.nombre}"`, r, extra), {
      anteproyecto: r.nombre, version: r.version, archivos: r.archivos, recintos: resumenRecintos(r.geo), areas: r.geo.areas,
      supuestos: sup, preguntas_para_tannia: preg, fundamentos: fundBreves(r.modelo), advertencias: r.coherencia.advertencias.map((a) => a.mensaje),
      indicadores_estructurales_de_referencia: r.geo.indicadores, verificacion_dxf: r.verificacion_dxf, operaciones_disponibles: Object.keys(CATALOGO),
      aviso: 'ANTEPROYECTO: no apto para construcción. Sin cálculo estructural ni verificación normativa; confirmar criterios en las fuentes indicadas.',
    });
  });

  reg('tannia_diseno_modificar', {
    title: 'Refinar el anteproyecto con cambios en lenguaje natural',
    description: `Traduzca el pedido de Tannia ("agranda el dormitorio 2", "cambia la ventana del living", "abre la cocina", "agrega un walk-in closet") a operaciones del catálogo y aplíquelas: se crea una NUEVA versión conservando lo no afectado; si el cambio deja la geometría inconsistente se rechaza y no se toca nada. Catálogo: ${Object.entries(CATALOGO).map(([k, v]) => `${k}: ${v}`).join(' | ')}`,
    inputSchema: {
      proyecto, nombre, descripcion: z.string().max(500).optional().describe('El pedido de Tannia, en sus palabras'),
      operaciones: z.array(z.object({ operacion: z.enum(Object.keys(CATALOGO)) }).catchall(z.any())).min(1).max(20),
    }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, descripcion, operaciones }) => {
    const r = A.modificar(p, n, { operaciones, descripcion });
    const c = r.cambios; const ab = c.aberturas;
    const que = [`Cambió: ${r.resumen.join('; ')}`, `Recintos sin cambios: ${c.recintos_sin_cambio}.`, ...(ab.agregadas.length ? [`Aberturas agregadas: ${ab.agregadas.join(', ')}.`] : []), ...(ab.eliminadas.length ? [`Aberturas eliminadas: ${ab.eliminadas.join(', ')}.`] : []), ...(ab.modificadas.length ? [`Aberturas modificadas: ${ab.modificadas.join(', ')}.`] : []), `Se puede volver atrás con tannia_diseno_historial (deshacer).`].join('\n');
    return ok(presentar(`Anteproyecto "${r.nombre}"`, r, que), { anteproyecto: r.nombre, version: r.version, padre: r.padre, cambios: r.cambios, archivos: r.archivos, recintos: resumenRecintos(r.geo), areas: r.geo.areas, advertencias: r.coherencia.advertencias.map((a) => a.mensaje), verificacion_dxf: r.verificacion_dxf });
  });

  reg('tannia_diseno_inspeccionar', {
    title: 'Inspeccionar muros y aberturas (ids, posiciones, tramos libres)',
    description: 'Solo lectura: lista cada muro con su eje, espesor y aberturas (centro y bordes medidos desde el INICIO del muro: oeste en horizontales, sur en verticales) y sus tramos libres. Con "segmento" y "ancho_mm" calcula dónde cabe una abertura nueva (rango del CENTRO). Úsela en vez de pedirle ids o medidas a Tannia. Solo geometría: no aprueba estructura ni normativa.',
    inputSchema: { proyecto, nombre, version: z.string().optional(), segmento: z.string().optional().describe('Id de muro para calcular candidatos'), ancho_mm: z.number().min(200).max(6000).optional() }, annotations: RO,
  }, async ({ proyecto: p, nombre: n, version, segmento, ancho_mm }) => {
    const c = A.cargar(p, n, version); const muros = inspeccionarMuros(c.geo);
    const cand = segmento && ancho_mm ? candidatosLibres(c.geo, segmento, ancho_mm) : null;
    if (segmento && !cand) throw new UserError('NO_EXISTE', `No existe el muro ${segmento}.`, `Muros: ${muros.map((m) => m.id).join(', ')}.`);
    return ok(`${muros.length} muros y ${c.geo.aberturas.filter((a) => !a.invalida).length} aberturas en ${c.h.nombre} ${c.id}.${cand ? ` Candidatos en ${segmento}: ${cand.viable ? cand.rangos_centro_mm.map((r) => `centro ${r.centro_min_mm}–${r.centro_max_mm} mm`).join('; ') : cand.motivo}` : ''}`, { anteproyecto: c.h.nombre, version: c.id, convencion: 'distancia_mm mide el CENTRO de la abertura; ancla inicio = extremo oeste (muros horizontales) o sur (verticales)', muros, candidatos: cand });
  });

  reg('tannia_diseno_previsualizar', {
    title: 'Previsualizar cambios sin crear versión',
    description: 'Aplica operaciones del catálogo a una copia EN MEMORIA y devuelve qué cambiaría, si la geometría sigue coherente y por qué no sería aplicable. No escribe archivos ni crea versiones. Use antes de tannia_diseno_modificar cuando haya riesgo de que no quepa (ventanas, divisiones, tamaños).',
    inputSchema: { proyecto, nombre, operaciones: z.array(z.object({ operacion: z.enum(Object.keys(CATALOGO)) }).catchall(z.any())).min(1).max(20) }, annotations: RO,
  }, async ({ proyecto: p, nombre: n, operaciones }) => {
    const r = A.previsualizar(p, n, { operaciones });
    return ok(r.aplicable ? `Se puede aplicar: ${r.resumen.join('; ')}. No se escribió nada.` : `No sería aplicable: ${r.motivo}. No se escribió nada.`, r);
  });

  reg('tannia_diseno_ver', {
    title: 'Ver un anteproyecto (o listar los existentes)', description: 'Muestra recintos, superficies, vista ASCII y archivos de la versión actual (o de la indicada). Sin "nombre" lista los anteproyectos del proyecto.',
    inputSchema: { proyecto, nombre: z.string().optional(), version: z.string().optional() }, annotations: RO,
  }, async ({ proyecto: p, nombre: n, version }) => {
    if (!n) { const l = A.listar(p); return ok(l.length ? `${l.length} anteproyecto(s).` : 'Aún no hay anteproyectos. Cree uno con tannia_diseno_crear.', { anteproyectos: l }); }
    const c = A.cargar(p, n, version); const rutas = A.rutas(p, n, c.id);
    const r = { version: c.id, geo: c.geo, modelo: c.modelo, coherencia: c.reg.coherencia, archivos: { dxf: rutas.dxf, svg: rutas.svg } };
    return ok(presentar(`Anteproyecto "${c.h.nombre}"`, r), { anteproyecto: c.h.nombre, version: c.id, version_actual: c.h.head, archivos: r.archivos, recintos: resumenRecintos(c.geo), areas: c.geo.areas, supuestos: c.modelo.supuestos, fundamentos: fundBreves(c.modelo), indicadores_estructurales_de_referencia: c.geo.indicadores, operaciones_disponibles: Object.keys(CATALOGO) });
  });

  reg('tannia_diseno_historial', {
    title: 'Historial de versiones: listar, deshacer, rehacer, restaurar', description: 'Nada se borra: deshacer/rehacer/restaurar solo mueven la versión actual. Los cambios nuevos tras deshacer crean una rama nueva.',
    inputSchema: { proyecto, nombre, accion: z.enum(['listar', 'deshacer', 'rehacer', 'restaurar']), version: z.string().optional() }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, accion, version }) => {
    const r = A.historial(p, n, accion, version);
    if (accion === 'listar') return ok(`Versiones de "${n}":\n${r.arbol.join('\n')}`, r);
    const c = A.cargar(p, n);
    return ok(`${accion === 'deshacer' ? 'Se deshizo el último cambio' : accion === 'rehacer' ? 'Se rehízo el cambio' : `Se restauró ${version}`}. Versión actual: ${r.head}.\n\n${tabla(c.geo)}`, { ...r, archivos: A.rutas(p, n), recintos: resumenRecintos(c.geo), areas: c.geo.areas });
  });

  reg('tannia_diseno_verificar', {
    title: 'Verificar coherencia geométrica y el DXF', description: 'Revisa solapes, aberturas, accesos, barridos de puertas y áreas, y vuelve a leer el DXF con el motor DXF para comprobar que sus superficies coinciden con el modelo. No es una evaluación normativa.',
    inputSchema: { proyecto, nombre, version: z.string().optional() }, annotations: RO,
  }, async ({ proyecto: p, nombre: n, version }) => {
    const r = A.verificar(p, n, version);
    return ok(r.coherencia.estado === 'ok' && r.verificacion_dxf.ok ? 'Geometría coherente y DXF consistente con el modelo.' : `Revisar: ${[...r.coherencia.errores, ...r.coherencia.advertencias].map((a) => a.mensaje).concat(r.verificacion_dxf.discrepancias).join(' | ')}`, r);
  });

  reg('tannia_diseno_a_autocad', {
    title: 'Guardar el anteproyecto como DWG con AutoCAD', description: 'Abre en AutoCAD el DXF de la versión indicada y lo guarda como DWG de trabajo en "03 Trabajo" (nunca sobrescribe). Verifica en disco la cabecera del DWG. NO VERIFICADO contra AutoCAD real hasta ejecutarlo.',
    inputSchema: { proyecto, nombre, version: z.string().optional() }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, version }) => {
    const rutas = A.rutas(p, n, version);
    const r = await cad.dxfADwg(p, rutas.dxf);
    return ok(r.archivo_dwg.cabecera_dwg_valida ? `DWG de trabajo guardado: ${r.dwg}` : r.verificacion, { version: rutas.version, ...r });
  });

  reg('tannia_diseno_verificar_dwg', {
    title: 'Verificar que el DWG es fiel al anteproyecto (DXF de origen) y que los textos con ñ/tildes se conservan',
    description: 'Con el DWG de la versión abierto y activo en AutoCAD (copia en "03 Trabajo", guardado con tannia_diseno_a_autocad): lee TODAS las entidades por lotes y las compara con el DXF de origen (líneas, arcos, polilíneas, textos), clasifica los textos (exactos / secuencia \\U+ sin decodificar / corruptos), comprueba capas y conteos por capa y detecta lecturas incoherentes (p. ej. arcos con longitud 0). Solo lectura.',
    inputSchema: { proyecto, nombre, version: z.string().optional(), tam_lote: z.number().int().min(10).max(400).optional() }, annotations: RO,
  }, async ({ proyecto: p, nombre: n, version, tam_lote }) => {
    const rutas = A.rutas(p, n, version);
    const r = await cad.verificarDwg(p, { dxfRel: rutas.dxf, dwgRel: rutas.dxf.replace(/\.dxf$/i, '.dwg'), tam_lote });
    const msg = { fiel: `DWG fiel al anteproyecto ${rutas.version}: geometría, textos y capas coinciden.`, con_diferencias: 'El DWG tiene DIFERENCIAS con el anteproyecto (ver comparacion_geometrica, textos y estructura).', no_concluyente: 'Verificación NO CONCLUYENTE: hay entidades sin comparador, propiedades que AutoCAD no informó (p. ej. arcos de polilínea) o lecturas ilegibles/incoherentes (ver comparacion_geometrica.no_verificables, sin_comparador, inconsistencias_internas e ilegibles). No se declara fiel.' }[r.fidelidad];
    return ok(msg, { version: rutas.version, ...r });
  });

  reg('tannia_diseno_cubicar', {
    title: 'Cantidades derivadas del anteproyecto (geometría construida)', description: 'Calcula pisos, muros (longitud, área, volumen), vanos y conteo de aberturas desde la geometría realmente construida y las guarda como partidas "AP-*" trazables a la versión. La altura de muros la entrega Tannia (no se asume).',
    inputSchema: { proyecto, nombre, version: z.string().optional(), altura_muros_m: z.number().min(2).max(6).describe('Altura de muros confirmada por la usuaria (m)') }, annotations: RW,
  }, async ({ proyecto: p, nombre: n, version, altura_muros_m }) => {
    const c = A.cargar(p, n, version); const rutas = A.rutas(p, n, c.id);
    const lista = cubicarAnteproyecto(c.modelo, c.geo, { altura_muros_m });
    const pr = new Project(sandbox, p); const todas = pr.partidas().filter((x) => !String(x.codigo).startsWith('AP-'));
    const archivoRel = `${c.rel}/${c.id}.json`; const sha = sha256File(rutas.abs_dxf.replace(/\.dxf$/i, '.json'));
    for (const q of lista) todas.push({ ...q, apu: undefined, regla: 'anteproyecto', fuente: { archivo: archivoRel, sha256: sha, anteproyecto: c.h.nombre, version: c.id, modelo_sha256: c.reg.modelo_sha256, capas: [] }, supuestos: q.supuestos || [], advertencias: ['Cantidad derivada de un ANTEPROYECTO: no apta para construcción ni presupuesto final sin revisión profesional.'], estado_revision: 'borrador', cantidad_verificada: false, creada: new Date().toISOString() });
    pr.savePartidas(todas); pr.audit('anteproyecto_cubicado', { nombre: c.h.nombre, version: c.id, partidas: lista.length });
    return ok(`${lista.length} partidas AP-* guardadas desde ${c.h.nombre} ${c.id} (altura de muros ${altura_muros_m} m).`, { version: c.id, partidas: lista.map((q) => ({ codigo: q.codigo, descripcion: q.descripcion, unidad: q.unidad, cantidad: q.cantidad })), aviso: 'Cantidades de anteproyecto, sin verificar por una persona.' });
  });

  reg('tannia_conocimiento_consultar', {
    title: 'Criterio técnico y dónde confirmar (LGUC, OGUC, NCh, instalaciones)', description: 'Orienta una decisión de diseño: criterio inicial usado, fuentes oficiales donde confirmar el valor vigente y qué profesional lo revisa. No evalúa cumplimiento ni cita valores normativos; use las fuentes con sus herramientas web si necesita el texto vigente.',
    inputSchema: { consulta: z.string().min(2).max(300), sistema_constructivo: z.enum(['albanileria_confinada', 'hormigon_armado', 'entramado_madera']).optional() }, annotations: RO,
  }, async ({ consulta, sistema_constructivo }) => ok('Criterio inicial y dónde confirmarlo (no evalúa cumplimiento).', consultarConocimiento(consulta, { sistema: sistema_constructivo })));
  void UserError; void fs;
}
