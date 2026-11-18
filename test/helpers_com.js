// Servidor COM SIMULADO en Node para pruebas: reproduce lo que informa AutoCAD (propiedades por tipo) a partir de un DXF real
// del anteproyecto, con interruptores para simular defectos (arcos con longitud 0, textos corruptos, límite de llamada, etc.).
import { parseDxf } from '../src/dxf/reader.js';
import { dxfDecode } from '../src/design/salidas.js';
import fs from 'node:fs';
import { dataImportado } from './helpers_dxf_import.js';

const D2R = Math.PI / 180;

/** Entidades "como las ve AutoCAD" (nombres de propiedad COM) desde un DXF. */
export function entidadesCom(dxfTexto, { textoComo = 'real' } = {}) {
  const dxf = parseDxf(dxfTexto); const out = [];
  for (const e of dxf.entities) {
    if (e.type === 'LINE') out.push({ tipo: 'AcDbLine', capa: e.layer, props: { StartPoint: [e.a.x, e.a.y, 0], EndPoint: [e.b.x, e.b.y, 0], Length: Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) } });
    else if (e.type === 'ARC') {
      const a0 = e.a0 * D2R; const a1 = e.a1 * D2R; let sw = (a1 - a0) % (2 * Math.PI); if (sw <= 0) sw += 2 * Math.PI;
      out.push({ tipo: 'AcDbArc', capa: e.layer, props: { Center: [e.c.x, e.c.y, 0], Radius: e.r, StartAngle: a0, EndAngle: a1, ArcLength: e.r * sw, StartPoint: [e.c.x + e.r * Math.cos(a0), e.c.y + e.r * Math.sin(a0), 0], EndPoint: [e.c.x + e.r * Math.cos(a1), e.c.y + e.r * Math.sin(a1), 0] } }); // IAcadArc NO tiene Length
    } else if (e.type === 'POLYLINE') out.push({ tipo: 'AcDb2dPolyline', capa: e.layer, props: { Coordinates: e.verts.flatMap((v) => [v.x, v.y, 0]), Closed: e.closed, Elevation: e.elevation ?? 0, Bulges: e.verts.map((v) => v.bulge || 0) } }); // R12 → polilínea 2D: 3 valores por vértice
    else if (e.type === 'TEXT') {
      const real = dxfDecode(e.text);
      const ts = textoComo === 'escape' ? e.text : textoComo === 'corrupto' ? real.replace(/[^\x00-\x7f]/g, '?') : real;
      out.push({ tipo: 'AcDbText', capa: e.layer, props: { TextString: ts, InsertionPoint: [0, 0, 0], Alignment: e.just || 0, TextAlignmentPoint: [e.alin.x, e.alin.y, 0], Height: e.altura, Rotation: (e.rot || 0) * D2R } });
    }
  }
  return out;
}

const arr = (v) => (v == null ? null : [...v]);
/** Equivalente en Node de LeerEnt (PowerShell): solo propiedades que existen; nunca 0 por ausencia. */
export function tipado(e, h) {
  const p = e.props; const o = { handle: h, tipo: e.tipo, capa: e.capa };
  switch (e.tipo) {
    case 'AcDbLine': Object.assign(o, { inicio: arr(p.StartPoint), fin: arr(p.EndPoint), longitud: p.Length ?? null }); break;
    case 'AcDbArc': Object.assign(o, { centro: arr(p.Center), radio: p.Radius ?? null, angulo_inicio: p.StartAngle ?? null, angulo_fin: p.EndAngle ?? null, longitud_arco: p.ArcLength ?? null, inicio: arr(p.StartPoint), fin: arr(p.EndPoint) }); break;
    case 'AcDb2dPolyline': case 'AcDbPolyline': Object.assign(o, { coordenadas: arr(p.Coordinates), cerrada: p.Closed ?? null, longitud: p.Length ?? null, area: p.Area ?? null, elevacion: p.Elevation ?? null, bulges: arr(p.Bulges) }); break;
    case 'AcDbText': Object.assign(o, { texto: p.TextString, posicion: arr(p.InsertionPoint), alineacion: p.Alignment ?? null, punto_alineacion: arr(p.TextAlignmentPoint), altura: p.Height ?? null, rotacion: p.Rotation ?? null }); break;
    case 'AcDb3dSolid': Object.assign(o, { volumen: p.Volume ?? null, centroide: arr(p.Centroid) }); if (p.BBoxMin) { o.bbox_min = arr(p.BBoxMin); o.bbox_max = arr(p.BBoxMax); } break;
    default: o.sin_propiedades_conocidas = true;
  }
  return o;
}

/**
 * Runner que simula AutoCAD: estado/enumerar/leer_lote/resumen/cerrar_reabrir/dxf_a_dwg.
 * opciones: { activePath, maxHandles (simula timeout si una llamada trae más), alReabrir(entidades)→entidades, capasVacias, calls }
 */
export function servidorSimulado(entidades, { activePath, maxHandles = Infinity, alReabrir, capasVacias = false, calls = [], arcoLongitud0 = false, escribeDwg, sinBbox = false, defectoSolido, falloConstruir, reaperturaConteoCero = false, rutaReabierta, sinDocumento = false, mutarImportacion = null } = {}) {
  let reabierto = false;
  let ents = entidades.map((e, i) => ({ ...e, handle: (0x100 + i).toString(16).toUpperCase() }));
  const leer = (e) => { const t = tipado(e, e.handle); if (arcoLongitud0 && t.tipo === 'AcDbArc') t.longitud_arco = 0; return t; };
  const capas = () => (capasVacias ? [] : ['0', ...new Set(ents.map((e) => e.capa))]);
  const porCapa = () => ents.reduce((a, e) => { a[e.capa] = (a[e.capa] || 0) + 1; return a; }, {});
  return async (script, input) => {
    const marca = (n) => script.includes(SCRIPT_MARCAS[n]);
    const n = Object.keys(SCRIPT_MARCAS).find(marca); calls.push({ name: n, input });
    let data;
    if (n === 'estado' && sinDocumento) data = { version: '26.0s', nombre: 'AutoCAD', progid: 'AutoCAD.Application.26', documento: null, ruta: null, guardado: null, documentos: 0, sin_documento: true };
    else if (n === 'estado') data = { version: '26.0s', nombre: 'AutoCAD', progid: 'AutoCAD.Application.26', documento: String(activePath).split(/[\\/]/).pop(), ruta: activePath, guardado: true, unidades_insunits: 4 };
    else if (n === 'enumerar') { const lista = (reabierto && reaperturaConteoCero ? [] : ents).filter((e) => !input.capa || e.capa === input.capa); const pagina = lista.slice(input.offset, input.offset + input.limite); const sig = input.offset + input.limite < lista.length ? input.offset + input.limite : null; data = { ruta: activePath, total: ents.length, entidades: pagina.map((e) => ({ handle: e.handle, tipo: e.tipo, capa: e.capa })), siguiente: sig }; }
    else if (n === 'leer_lote') {
      if (input.handles.length > maxHandles) throw Object.assign(new Error('tiempo'), { clase: 'tiempo_agotado' });
      const m = new Map(ents.map((e) => [e.handle, e]));
      data = { ruta: activePath, unidades_insunits: 4, documento: 'x.dwg', entidades: input.handles.map((h) => (m.has(h) ? leer(m.get(h)) : { handle: h, error: 'no_encontrada' })) };
    } else if (n === 'resumen') data = { documento: 'x.dwg', ruta: activePath, guardado: true, entidades: reabierto && reaperturaConteoCero ? 0 : ents.length, capas: capas(), entidades_por_capa: porCapa(), entidades_por_tipo: {}, unidades_insunits: 4 };
    else if (n === 'cerrar_reabrir') { if (alReabrir) ents = alReabrir(ents); reabierto = true; data = { documento: 'x.dwg', ruta: rutaReabierta || activePath, guardado: true, entidades: reaperturaConteoCero ? 0 : ents.length, conteo_inicial_tras_abrir: reaperturaConteoCero ? 0 : ents.length, espera_ms: 0, unidades_insunits: 4 }; }
    else if (n === 'importar_dxf_aislado') { const txt = fs.readFileSync(input.dxf, 'utf8'); data = dataImportado(txt, { mutar: mutarImportacion }); }
    else if (n === 'dxf_a_dwg') { if (escribeDwg) escribeDwg(input.dwg); data = { documento: 'v001.dwg', ruta: input.dwg, entidades: ents.length, capas: capas(), entidades_por_capa: porCapa(), textos_normalizados: 0, unidades_insunits: 4 }; }
    else if (n === 'construir_3d') {
      if (falloConstruir) throw Object.assign(new Error('fallo'), { clase: 'powershell_fallo' });
      ents = input.primitivas.map((q, i) => { const e = q.esperado; let props = { Volume: e.volumen, Centroid: [...e.centroide], ...(sinBbox ? {} : { BBoxMin: [...e.bbox_min], BBoxMax: [...e.bbox_max] }) }; let capa = q.capa; if (defectoSolido) ({ props, capa } = defectoSolido(q, i, props, capa)); return { tipo: 'AcDb3dSolid', capa, props, handle: (0x200 + i).toString(16).toUpperCase() }; });
      ents.push({ tipo: 'AcDbText', capa: 'TW3D_NOTAS', props: { TextString: input.nota, InsertionPoint: input.nota_pos, Height: 200 }, handle: 'FFF' });
      if (escribeDwg) escribeDwg(input.dwg);
      data = { documento: String(input.dwg).split(/[\\/]/).pop(), ruta: input.dwg, entidades: ents.length, capas: capas(), entidades_por_capa: porCapa(), mapa: ents.filter((x) => x.tipo === 'AcDb3dSolid').map((x, i) => ({ id: input.primitivas[i].id, handle: x.handle })), lecturas: ents.filter((x) => x.tipo === 'AcDb3dSolid').map((x) => tipado(x, x.handle)), centroide_informado: true, vista: { aplicada: true, direccion: input.vista_dir }, estilo: input.estilo_cmd ? 'solicitado' : 'no_solicitado', unidades_insunits: 4 };
    } else if (n === 'vista_3d') data = { documento: 'x.dwg', direccion_vista: input.dir, estilo: input.estilo_cmd ? 'solicitado' : 'no_solicitado', capas_visibles: Object.fromEntries(capas().map((c) => [c, !(input.ocultar || []).includes(c)])) };
    else if (n === 'transformar_solido') {
      const e = ents.find((x) => x.handle === input.handle); if (!e || e.tipo !== 'AcDb3dSolid') { const err = new Error('no sólido'); throw err; }
      const antes = tipado(e, e.handle);
      if (input.operacion === 'mover') { e.props.Centroid = e.props.Centroid.map((v, i) => v + [input.dx, input.dy, input.dz][i]); if (e.props.BBoxMin) { e.props.BBoxMin = e.props.BBoxMin.map((v, i) => v + [input.dx, input.dy, input.dz][i]); e.props.BBoxMax = e.props.BBoxMax.map((v, i) => v + [input.dx, input.dy, input.dz][i]); } }
      data = { antes, despues: tipado(e, e.handle), guardado: !!input.guardar, guardado_en_disco: !!input.guardar };
    }
    else throw new Error('script no reconocido en el servidor simulado');
    return JSON.stringify({ ok: true, data });
  };
}
import { SCRIPTS } from '../src/cad/autocad_com.js';
// huella única de cada script (su cuerpo) para identificarlo dentro del texto completo enviado a PowerShell
const SCRIPT_MARCAS = Object.fromEntries(Object.entries(SCRIPTS).map(([k, v]) => [k, v]));

/**
 * Varios dibujos abiertos a la vez. Modela lo que HACE el script real (PS_DOC): con `ruta_esperada` se localiza EXACTAMENTE ese
 * documento y, si no está abierto, se falla con DOCUMENTO_NO_ABIERTO (nunca se cae al activo). Sin ruta, se usa el activo.
 * opciones: { activo (ruta), abiertos: {ruta: entidades}, ignorarRuta (simula el defecto antiguo: siempre el activo), alLlamar(n, input, estado) }
 */
export function servidorMultiDoc({ abiertos, activo, ignorarRuta = false, alLlamar, escribeDwg } = {}) {
  const estado = { activo, abiertos: new Set(Object.keys(abiertos)) };
  const internos = Object.fromEntries(Object.entries(abiertos).map(([ruta, ents]) => [ruta, servidorSimulado(ents, { activePath: ruta, escribeDwg })]));
  return async (script, input) => {
    const n = Object.keys(SCRIPT_MARCAS).find((k) => script.includes(SCRIPT_MARCAS[k]));
    alLlamar?.(n, input, estado);
    const objetivo = !ignorarRuta && input?.ruta_esperada ? input.ruta_esperada : estado.activo;
    if (!estado.abiertos.has(objetivo)) return JSON.stringify({ ok: false, etapa: 'localizar_documento', codigo: input?.ruta_esperada ? 'DOCUMENTO_NO_ABIERTO' : 'SIN_DOCUMENTO' });
    return internos[objetivo](script, input);
  };
}

// BG-R03: el adaptador COM deniega por defecto toda operación que interrumpa el escritorio. Las pruebas que ejercitan esas operaciones
// con un COM simulado declaran EXPLÍCITAMENTE esta política, que simula «una persona autorizó» y registra cada pedido (operación + documentos).
import { crearPermiso } from '../src/cad/politica_interactiva.js';
export const politicaDePrueba = (registro = []) => ({ permiso: async (ctx) => { registro.push(ctx); return crearPermiso({ ...ctx, canal: 'prueba_automatizada' }); } });
