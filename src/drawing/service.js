import fs from 'node:fs';
import path from 'node:path';
import { tunnelModel, compose, verifyDimensions, cantidadesFortificacion, cantidadesTunelContrato, prefijoDe } from './model.js';
import { modeloDesdeEspecificacion } from './especificacion.js';
import { buildSheetsPdf, verifyPdf, validateScene } from './pdf.js';
import { buildIR } from './ir.js';
import { inspeccionarDxf } from './dxf_inspect.js';
import { paridadDxf, paridadPdf, tintaEnTramas, paridadEspacialDxf } from './paridad.js';
import { buildDrawingDxf } from './dxf.js';
import { verificarDxfContraModelo } from './dxf_verificar.js';
import { documentoCantidades } from './cantidades_contrato.js';
import { digest } from '../cad/operations.js';
import { commitConHistorial, verificarManifiesto, mutarHistorial } from '../project/transaccion.js';
import { readJson, verificarContencion } from '../project/store.js';
import { UserError } from '../mcp/util.js';
import { copiarDentro } from '../project/store.js';
import { renderPdf } from './render.js';
import { buildQuantityModel } from './quantity_model.js';
import { expectedLayouts, verifyLayouts, viewportsFromDxf } from './layouts_check.js';

export class DrawingService {
  constructor(sandbox) { this.sandbox = sandbox; }
  location(project) {
    const root = this.sandbox.projectRoot(project); const dir = path.join(root, '06 Informes', 'Planos');
    verificarContencion(root, dir); return { root, dir, history: path.join(dir, 'historial.json') };
  }
  status(project) {
    const { root, dir, history } = this.location(project); const h = readJson(history, null, { raiz: root });
    if (!h) return { state: 'no_drawing_job' };
    return { ...h, integrity: verificarManifiesto(dir, h.head), ready_for_delivery: false, pending: ['Revisión visual humana', 'Validación DWG en AutoCAD 2027', 'Aceptación del Product Owner'] };
  }
  async exportDwg(project, cad) {
    const { root, dir, history } = this.location(project); const h = readJson(history, null, { raiz: root });
    if (!h || verificarManifiesto(dir, h.head).estado !== 'integra') throw new UserError('REVISION_NO_INTEGRA', 'Genere y verifique una revisión antes de exportar DWG.');
    const work = path.join(root, '03 Trabajo', 'CAD', 'modelos', h.head); verificarContencion(root, work); fs.mkdirSync(work, { recursive: true });
    const source = path.join(dir, `${h.head}-planos.dxf`); const copy = path.join(work, 'planos.dxf'); verificarContencion(root, copy);
    if (!fs.existsSync(copy)) copiarDentro(root, source, copy);
    else if (digest(fs.readFileSync(copy)) !== digest(fs.readFileSync(source))) throw new UserError('COPIA_MODIFICADA', 'La copia CAD cambió; se conserva y no se sobrescribe.');
    const sidecarSrc = path.join(dir, `${h.head}-planos.tannia-modelo.json`); const sidecarCopy = path.join(work, 'planos.tannia-modelo.json');
    if (fs.existsSync(sidecarSrc) && !fs.existsSync(sidecarCopy)) copiarDentro(root, sidecarSrc, sidecarCopy);
    const composition = readJson(path.join(dir, `${h.head}-composicion.json`), null, { raiz: root });
    return cad.guardarLaminas(project, { dxf: path.relative(root, copy), dwg: path.relative(root, path.join(work, 'planos.dwg')), operacion: `dwg-${h.head}`, composition });
  }
  async generate(project, { model: input = {}, especificacion = null, paper = 'A3', orientation = 'landscape', margin = 12 } = {}) {
    const { root, dir, history } = this.location(project);
    // Motor genérico: una especificación (planta/corte/elevación/perfil/sección/detalle) o el adaptador de túnel.
    const model = especificacion ? modeloDesdeEspecificacion({ ...especificacion, proyecto: especificacion.proyecto || project }) : tunnelModel({ ...input, project });
    const pdfOpts = especificacion ? { prefijo: prefijoDe(model), marca: model.warnings[0].slice(0, 24) } : {}; const composition = compose(model, { paper, orientation, margin });
    const id = `r-${digest({ model, paper, orientation, margin }).slice(0, 20)}`;
    const prior = readJson(history, null, { raiz: root });
    if (prior?.versiones.some(v => v.id === id)) {
      const integrity = verificarManifiesto(dir, id);
      if (integrity.estado !== 'integra') throw new UserError('ENTREGA_ALTERADA', 'Una revisión existente fue modificada; se conserva para investigar.');
      // A→B→A: volver a un modelo ya generado lo convierte en la revisión VIGENTE (antes el puntero se quedaba en B y
      // cantidades, partidas y entrega seguían a B). Se registra el evento sin reescribir las láminas inmutables.
      let restaurada = false;
      if (prior.head !== id) {
        mutarHistorial({ dir, historial: history, raiz: root, fn: (h) => { const desde = h.head; h.head = id; h.redo = []; h.eventos = [...(Array.isArray(h.eventos) ? h.eventos : []), { tipo: 'vigente_restaurada', desde, hacia: id, t: new Date().toISOString() }].slice(-200); } });
        restaurada = true;
      }
      return { revision: id, reused: true, restaurada, folder: '06 Informes/Planos', files: prior.versiones.find(v => v.id === id).files, ready_for_delivery: false };
    }
    const all = []; const add = (ext, content) => { const name = `${id}-${ext}`; all.push({ nombre: name, contenido: content }); return name; };
    const ir = buildIR(composition); // Drawing IR v2: fuente ÚNICA del PDF y del DXF
    const pdfQa = []; const sceneQa = composition.sheets.map(s => { const q = validateScene(ir.sheets.find((x) => x.id === s.id).primitives, s); return { sheet: s.id, ok: q.ok, issues: q.issues }; });
    if (sceneQa.some(q => !q.ok)) throw new UserError('LEGIBILIDAD_FALLIDA', 'La lámina no supera el gate de legibilidad.', '', sceneQa);
    add('modelo.json', JSON.stringify(model, null, 2)); add('composicion.json', JSON.stringify(composition, null, 2));
    add('ir.json', JSON.stringify({ ...ir, sheets: ir.sheets.map((sh) => ({ ...sh, primitives: sh.primitives.map(({ lines, ...p }) => (lines ? { ...p, lines_count: lines.length } : p)) })) }));
    const dxfText = buildDrawingDxf(composition, { ir });
    // P0 / gate 5d: el DXF debe ser estructuralmente utilizable al abrir (vista inicial, extensiones, layouts, viewports con geometría).
    const dxfInspeccion = inspeccionarDxf(dxfText);
    if (!dxfInspeccion.ok) throw new UserError('DXF_NO_UTILIZABLE', 'El DXF generado no supera la inspección de apertura (vista inicial, extensiones, presentaciones); no se entrega.', '', dxfInspeccion);
    const paridadCad = paridadDxf(ir, dxfText); const espacial = paridadEspacialDxf(ir, dxfText);
    if (!espacial.ok) throw new UserError('COMPOSICION_CAD_DESBORDADA', 'En el DXF algún texto no cabe en su celda, panel o lámina; no se entrega.', '', espacial);
    paridadCad.espacial = { ok: true, textos_verificados: espacial.textos_verificados };
    if (!paridadCad.ok) throw new UserError('PARIDAD_DXF_FALLIDA', 'El DXF no contiene exactamente los elementos de la representación común; no se entrega.', '', paridadCad);
    const layoutQa = verifyLayouts(viewportsFromDxf(dxfText), expectedLayouts(composition));
    if (!layoutQa.ok) throw new UserError('LAYOUTS_INVALIDOS', 'El DXF generado no cumple la verificación estructural de layouts y viewports.', '', layoutQa);
    // G1: el DXF se contrasta entidad por entidad con el modelo canónico (verificador independiente del escritor).
    const dxfQa = verificarDxfContraModelo(dxfText, composition);
    if (!dxfQa.ok) throw new UserError('DXF_DIVERGE_DEL_MODELO', 'El DXF generado no coincide con el modelo; no se entrega.', '', dxfQa);
    add('planos.dxf', dxfText); add('planos.tannia-modelo.json', JSON.stringify(buildQuantityModel(model, dxfText), null, 2));
    for (const sheet of composition.sheets) {
      const pdf = await buildSheetsPdf(composition, sheet.id, { ir }); const rendered = await renderPdf(pdf, { pixels: true });
      if (rendered.length !== 1 || !rendered[0].qa.ok) throw new UserError('RENDER_INVALIDO', 'El PDF renderizado está vacío o fuera del área de página.');
      const tinta = tintaEnTramas(ir.sheets.find((x) => x.id === sheet.id), rendered[0].pixels, { dpi: rendered[0].qa.dpi }); delete rendered[0].pixels;
      if (!tinta.ok) throw new UserError('TRAMA_NO_RENDERIZADA', 'Una trama declarada no aparece en el render del PDF.', '', tinta);
      add(`lamina-${sheet.id}.png`, rendered[0].png);
      const qa = await verifyPdf(pdf, [sheet], pdfOpts); pdfQa.push({ sheet: sheet.id, ...qa, raster: rendered[0].qa, visual_review: 'RENDERED_HUMAN_REVIEW_PENDING' });
      if (!qa.ok) throw new UserError('PDF_INVALIDO', 'El PDF no supera el control físico y de contenido.', '', qa);
      add(`lamina-${sheet.id}.pdf`, pdf);
    }
    const combined = await buildSheetsPdf(composition, null, { ir }); const combinedQa = await verifyPdf(combined, composition.sheets, pdfOpts);
    if (!combinedQa.ok) throw new UserError('PDF_INVALIDO', 'El PDF combinado es inválido.');
    const paridadPapel = await paridadPdf(ir, combined);
    if (!paridadPapel.ok) throw new UserError('PARIDAD_PDF_FALLIDA', 'El PDF no contiene exactamente los textos de la representación común; no se entrega.', '', paridadPapel);
    add('conjunto.pdf', combined);
    // PL-CSV-01: campos anidados en columnas planas tipadas (p. ej. distribucion.anillos) y escape CSV; nunca «[object Object]».
    const plano = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? plano(v, `${pre}${k}.`) : [[`${pre}${k}`, Array.isArray(v) ? v.join(' ') : v]]));
    const celda = (v) => { const t = v === null || v === undefined ? '' : String(v); return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const csv = (rows) => { const filas = rows.map((q) => Object.fromEntries(plano(q))); const cols = [...new Set(filas.flatMap((q) => Object.keys(q)))]; return `${cols.join(';')}\n${filas.map((q) => cols.map((c) => celda(q[c])).join(';')).join('\n')}\n`; };
    if (model.quantities?.length) add('cantidades.csv', csv(model.quantities));
    if (model.quantity_totals?.length) add('cantidades-totales.csv', csv(model.quantity_totals)); // separado: no sumar con el detalle
    // Especificación genérica: filas clasificadas. Túnel: adaptador con la alternativa elegida sumable y la otra como comparación no sumable.
    if (model.quantities?.length && model.quantities.every((f) => f.fila)) add('cantidades.json', JSON.stringify(documentoCantidades(model, { modelo_sha256: digest(model), revision: id }), null, 2)); // contrato tw.cantidades/1
    else if (!especificacion) { const t = cantidadesTunelContrato(model); if (t) add('cantidades.json', JSON.stringify({ ...documentoCantidades({ quantities: t.detalle, quantity_totals: t.totales }, { modelo_sha256: digest(model), revision: id }), alternativas_no_sumables: t.alternativas_no_sumables }, null, 2)); } // PL-09: túnel en el mismo contrato
    const fort = cantidadesFortificacion(model); if (fort) add('fortificacion.csv', csv(fort));
    add('verificacion.json', JSON.stringify({ ir: { schema: ir.schema, catalogo: ir.catalog.version, primitivas_modelo: ir.model.length, laminas: ir.sheets.map((x) => ({ id: x.id, primitivas: x.primitives.length })) }, dimensions: verifyDimensions(model), composition: sceneQa, dxf_inspeccion: dxfInspeccion, paridad: { dxf: paridadCad, pdf: paridadPapel }, layouts_dxf: layoutQa, dxf_vs_modelo: dxfQa, pdf: pdfQa, combined: combinedQa, dwg: 'NOT_RUN', autocad_2027: 'NO VERIFICADO (gate externo G11)', ready_for_delivery: false, warnings: model.warnings }, null, 2));
    const entry = { id, files: all.map(a => a.nombre), model_sha256: digest(model), status: 'review_candidate', origin: model.provenance };
    const next = { schema: 'tw.drawing.history/1', head: id, versiones: [entry], redo: [] };
    commitConHistorial({ dir, historial: history, id, archivos: all, base: prior?.head || null, nuevo: prior ? null : next, entrada: entry, raiz: root });
    return { revision: id, files: entry.files, folder: '06 Informes/Planos', dimensions: verifyDimensions(model), pdf: pdfQa, ...(fort ? { fortificacion: fort } : {}), ready_for_delivery: false, pending: ['PDF generado desde el modelo: no se ha contrastado con un DWG guardado.', 'Revisión visual humana de los PNG', 'AutoCAD 2027 y aprobación profesional'] };
  }
}
