// Servidor COM SIMULADO en Node para pruebas: reproduce lo que informa AutoCAD (propiedades por tipo) a partir de un DXF real
// del anteproyecto, con interruptores para simular defectos (arcos con longitud 0, textos corruptos, límite de llamada, etc.).
import { parseDxf } from '../src/dxf/reader.js';
import { dxfDecode } from '../src/design/salidas.js';

const D2R = Math.PI / 180;

/** Entidades "como las ve AutoCAD" (nombres de propiedad COM) desde un DXF. */
export function entidadesCom(dxfTexto, { textoComo = 'real' } = {}) {
  const dxf = parseDxf(dxfTexto); const out = [];
  for (const e of dxf.entities) {
    if (e.type === 'LINE') out.push({ tipo: 'AcDbLine', capa: e.layer, props: { StartPoint: [e.a.x, e.a.y, 0], EndPoint: [e.b.x, e.b.y, 0], Length: Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) } });
    else if (e.type === 'ARC') {
      const a0 = e.a0 * D2R; const a1 = e.a1 * D2R; let sw = (a1 - a0) % (2 * Math.PI); if (sw <= 0) sw += 2 * Math.PI;
      out.push({ tipo: 'AcDbArc', capa: e.layer, props: { Center: [e.c.x, e.c.y, 0], Radius: e.r, StartAngle: a0, EndAngle: a1, ArcLength: e.r * sw, StartPoint: [e.c.x + e.r * Math.cos(a0), e.c.y + e.r * Math.sin(a0), 0], EndPoint: [e.c.x + e.r * Math.cos(a1), e.c.y + e.r * Math.sin(a1), 0] } }); // IAcadArc NO tiene Length
    } else if (e.type === 'POLYLINE') out.push({ tipo: 'AcDb2dPolyline', capa: e.layer, props: { Coordinates: e.verts.flatMap((v) => [v.x, v.y, 0]), Closed: e.closed } }); // R12 → polilínea 2D: 3 valores por vértice
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
    case 'AcDb2dPolyline': case 'AcDbPolyline': Object.assign(o, { coordenadas: arr(p.Coordinates), cerrada: p.Closed ?? null, longitud: p.Length ?? null, area: p.Area ?? null }); break;
    case 'AcDbText': Object.assign(o, { texto: p.TextString, posicion: arr(p.InsertionPoint), alineacion: p.Alignment ?? null, punto_alineacion: arr(p.TextAlignmentPoint), altura: p.Height ?? null, rotacion: p.Rotation ?? null }); break;
    default: o.sin_propiedades_conocidas = true;
  }
  return o;
}

/**
 * Runner que simula AutoCAD: estado/enumerar/leer_lote/resumen/cerrar_reabrir/dxf_a_dwg.
 * opciones: { activePath, maxHandles (simula timeout si una llamada trae más), alReabrir(entidades)→entidades, capasVacias, calls }
 */
export function servidorSimulado(entidades, { activePath, maxHandles = Infinity, alReabrir, capasVacias = false, calls = [], arcoLongitud0 = false, escribeDwg } = {}) {
  let ents = entidades.map((e, i) => ({ ...e, handle: (0x100 + i).toString(16).toUpperCase() }));
  const leer = (e) => { const t = tipado(e, e.handle); if (arcoLongitud0 && t.tipo === 'AcDbArc') t.longitud_arco = 0; return t; };
  const capas = () => (capasVacias ? [] : ['0', ...new Set(ents.map((e) => e.capa))]);
  const porCapa = () => ents.reduce((a, e) => { a[e.capa] = (a[e.capa] || 0) + 1; return a; }, {});
  return async (script, input) => {
    const marca = (n) => script.includes(SCRIPT_MARCAS[n]);
    const n = Object.keys(SCRIPT_MARCAS).find(marca); calls.push({ name: n, input });
    let data;
    if (n === 'estado') data = { version: '26.0s', nombre: 'AutoCAD', progid: 'AutoCAD.Application.26', documento: String(activePath).split(/[\\/]/).pop(), ruta: activePath, guardado: true, unidades_insunits: 4 };
    else if (n === 'enumerar') { const lista = ents.filter((e) => !input.capa || e.capa === input.capa); const pagina = lista.slice(input.offset, input.offset + input.limite); const sig = input.offset + input.limite < lista.length ? input.offset + input.limite : null; data = { total: ents.length, entidades: pagina.map((e) => ({ handle: e.handle, tipo: e.tipo, capa: e.capa })), siguiente: sig }; }
    else if (n === 'leer_lote') {
      if (input.handles.length > maxHandles) throw Object.assign(new Error('tiempo'), { clase: 'tiempo_agotado' });
      const m = new Map(ents.map((e) => [e.handle, e]));
      data = { unidades_insunits: 4, documento: 'x.dwg', entidades: input.handles.map((h) => (m.has(h) ? leer(m.get(h)) : { handle: h, error: 'no_encontrada' })) };
    } else if (n === 'resumen') data = { documento: 'x.dwg', ruta: activePath, guardado: true, entidades: ents.length, capas: capas(), entidades_por_capa: porCapa(), entidades_por_tipo: {}, unidades_insunits: 4 };
    else if (n === 'cerrar_reabrir') { if (alReabrir) ents = alReabrir(ents); data = { documento: 'x.dwg', guardado: true, entidades: ents.length, unidades_insunits: 4 }; }
    else if (n === 'dxf_a_dwg') { if (escribeDwg) escribeDwg(input.dwg); data = { documento: 'v001.dwg', ruta: input.dwg, entidades: ents.length, capas: capas(), entidades_por_capa: porCapa(), textos_normalizados: 0, unidades_insunits: 4 }; }
    else throw new Error('script no reconocido en el servidor simulado');
    return JSON.stringify({ ok: true, data });
  };
}
import { SCRIPTS } from '../src/cad/autocad_com.js';
// huella única de cada script (su cuerpo) para identificarlo dentro del texto completo enviado a PowerShell
const SCRIPT_MARCAS = Object.fromEntries(Object.entries(SCRIPTS).map(([k, v]) => [k, v]));
