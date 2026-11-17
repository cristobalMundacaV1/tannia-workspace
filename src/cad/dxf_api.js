// Contrato de APIs de AutoCAD para abrir archivos (CAD-OPEN-01, 3.ª incidencia).
//
// Documentación oficial AutoCAD 2027 (ActiveX, Documents.Open):
//   https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-ActiveX-Reference/files/GUID-9ED7A548-7978-4BFD-8462-E2FA747E8880.htm
//   - Documents.Open abre un dibujo DWG y lo activa.
//   - «Use the Import method to open SAT, EPS, DXF, WMF, or BMP format files.»
// Por tanto: Documents.Open SOLO recibe .dwg; un .dxf nunca se pasa a Open.
//
// Vía para DXF: documento AISLADO. Se crea un documento nuevo propio (Documents.Add) y se importa el DXF en él (Document.Import).
// Así Dibujo1 y cualquier otro documento del usuario no se tocan. Import opera sobre un documento y NO se asume que conserve
// layouts, viewports, cotas, textos ni XDATA: se mide el documento importado y se compara contra lo esperado del propio DXF
// ANTES de guardar cualquier DWG (`verificarImportacion`). Si algo falta, no se guarda nada y se informa qué falta.
// Este módulo es puro (sin AutoCAD): la validación real en AutoCAD 2027 sigue NO VERIFICADA hasta ejecutar el procedimiento de
// docs/tw12/PROCEDIMIENTO_PRUEBA_DXF_AUTOCAD_2027.md.
import { readPairs } from '../dxf/reader.js';
import { dxfDecode } from '../design/salidas.js';
import { viewportsFromDxf, verifyLayouts } from '../drawing/layouts_check.js';
import { UserError } from '../mcp/util.js';

export const DOC_OPEN_URL = 'https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-ActiveX-Reference/files/GUID-9ED7A548-7978-4BFD-8462-E2FA747E8880.htm';
export const APP_TRAZA = 'TANNIA_TRACE';

/** Vía de apertura permitida por extensión. Falla cerrado: una extensión desconocida no se envía a AutoCAD. */
export function viaApertura(ruta) {
  const ext = String(ruta).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === 'dwg') return 'open_dwg';
  if (ext === 'dxf') return 'dxf_documento_aislado';
  throw new UserError('TIPO_NO_PERMITIDO', 'Solo se abren archivos .dwg o .dxf.');
}

// VERTEX/SEQEND/ATTRIB son subentidades de otra entidad: no son entidades independientes del espacio modelo
const SUBENTIDADES = new Set(['VERTEX', 'SEQEND', 'ATTRIB']);
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();

/**
 * Estructura esperada, leída del PROPIO DXF (sin AutoCAD): entidades del espacio modelo por capa, cotas, entidades con XDATA
 * TANNIA_TRACE, y por layout los viewports y los textos del espacio papel.
 */
export function esperadoDesdeDxf(texto) {
  const pairs = readPairs(String(texto)); const ents = []; let seccion = null; let cur = null; let esperaNombre = false;
  for (const p of pairs) {
    if (p.c === 0 && p.v === 'SECTION') { esperaNombre = true; seccion = null; cur = null; continue; }
    if (esperaNombre && p.c === 2) { seccion = p.v; esperaNombre = false; continue; }
    if (p.c === 0 && p.v === 'ENDSEC') { seccion = null; cur = null; continue; }
    if (seccion !== 'ENTITIES' && seccion !== 'BLOCKS') continue; // el espacio papel de este DXF vive en bloques *Paper_Space
    if (p.c === 0) { cur = { tipo: p.v, seccion, g: [] }; if (!SUBENTIDADES.has(p.v)) ents.push(cur); else cur = null; } else if (cur) cur.g.push([p.c, p.v]);
  }
  const get = (e, c) => e.g.find(([k]) => k === c)?.[1];
  const enPapel = (e) => get(e, 67) === '1' || e.tipo === 'VIEWPORT';
  const modelo = ents.filter((e) => e.seccion === 'ENTITIES' && !enPapel(e));
  const porCapa = {}; for (const e of modelo) { const c = get(e, 8) ?? '0'; porCapa[c] = (porCapa[c] || 0) + 1; }
  const conTraza = modelo.filter((e) => e.g.some(([k, v]) => k === 1001 && v === APP_TRAZA)).length;
  const dimensiones = modelo.filter((e) => e.tipo === 'DIMENSION').length;
  const textosPapel = {};
  for (const e of ents) {
    if (!enPapel(e) || !['TEXT', 'MTEXT'].includes(e.tipo)) continue;
    const layout = get(e, 410); if (!layout) continue;
    (textosPapel[layout] ||= []).push(norm(dxfDecode(get(e, 1) ?? '')));
  }
  const layouts = viewportsFromDxf(String(texto));
  return { entidades_modelo: modelo.length, por_capa: porCapa, dimensiones, con_traza: conTraza, layouts, textos_papel: textosPapel, viewports_total: layouts.reduce((n, l) => n + l.viewports.length, 0) };
}

const multiconjunto = (a) => { const m = new Map(); for (const x of a) m.set(x, (m.get(x) || 0) + 1); return m; };

/**
 * Compara lo MEDIDO en el documento importado (script `importar_dxf_aislado`) con lo ESPERADO del DXF.
 * Devuelve `ok:false` con la lista exacta de diferencias; nunca decide por suposición.
 * `layoutsEsperados` (opcional) son los layouts de la composición autorizada; si no, se usan los del propio DXF.
 */
export function verificarImportacion(esperado, medido, { layoutsEsperados = null } = {}) {
  const issues = []; const add = (issue, extra = {}) => issues.push({ issue, ...extra });
  if (!medido || typeof medido !== 'object') return { ok: false, issues: [{ issue: 'sin_medicion' }] };
  if (medido.entidades_modelo !== esperado.entidades_modelo) add('entidades_modelo', { esperado: esperado.entidades_modelo, medido: medido.entidades_modelo });
  const capas = new Set([...Object.keys(esperado.por_capa), ...Object.keys(medido.por_capa || {})]);
  for (const c of capas) {
    // AutoCAD crea la capa «0» y puede reportar capas sin entidades: solo se comparan capas con entidades esperadas o medidas
    const e = esperado.por_capa[c] ?? 0; const m = medido.por_capa?.[c] ?? 0;
    if (e !== m) add('capa_conteo', { capa: c, esperado: e, medido: m });
  }
  if (medido.dimensiones !== esperado.dimensiones) add('cotas', { esperado: esperado.dimensiones, medido: medido.dimensiones });
  if (medido.con_traza !== esperado.con_traza) add('xdata_tannia_trace', { esperado: esperado.con_traza, medido: medido.con_traza });
  const layouts = Array.isArray(medido.layouts) ? medido.layouts : [];
  const esperadosLayouts = layoutsEsperados ?? esperado.layouts.map((l) => ({ name: l.nombre, size: null, viewports: l.viewports }));
  if (layoutsEsperados) {
    const v = verifyLayouts(layouts, layoutsEsperados);
    for (const i of v.issues) add(`layout:${i.issue}`, i);
  } else {
    const nombresM = layouts.map((l) => l.nombre); const nombresE = esperadosLayouts.map((l) => l.name);
    for (const n of nombresE) if (!nombresM.includes(n)) add('layout_faltante', { layout: n });
    for (const l of esperadosLayouts) {
      const m = layouts.find((x) => x.nombre === l.name); if (!m) continue;
      if ((m.viewports?.length ?? 0) !== l.viewports.length) add('viewports_por_layout', { layout: l.name, esperado: l.viewports.length, medido: m.viewports?.length ?? 0 });
    }
  }
  for (const [layout, textos] of Object.entries(esperado.textos_papel)) {
    const m = layouts.find((x) => x.nombre === layout); if (!m) continue;
    const med = multiconjunto((m.textos || []).map(norm)); const exp = multiconjunto(textos);
    const faltan = [...exp].filter(([t, n]) => (med.get(t) || 0) < n).map(([t]) => t);
    if (faltan.length) add('textos_papel_faltantes', { layout, faltan: faltan.slice(0, 10), total_faltan: faltan.length });
  }
  const viewportsMedidos = layouts.reduce((n, l) => n + (l.viewports?.length ?? 0), 0);
  return { ok: issues.length === 0, issues, resumen: { layouts: layouts.length, viewports: viewportsMedidos, cotas: medido.dimensiones ?? null, con_traza: medido.con_traza ?? null, entidades_modelo: medido.entidades_modelo ?? null } };
}
