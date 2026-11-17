// ASCII DXF with real-unit model geometry, native dimensions and independent layouts.
// Unicode is encoded using the existing DXF encoder. No script or user code executes.
import { textoDxf } from '../design/salidas.js';
import { LAYERS } from './model.js';
import { sceneForSheet } from './pdf.js';

export function buildDrawingDxf(composition) {
  let next = 256; const handle = () => (next++).toString(16).toUpperCase();
  const root = handle(); const dictionary = handle(); const modelBlock = handle(); const modelLayout = handle();
  const layers = Object.fromEntries([...Object.keys(LAYERS), 'PAPEL', 'MODEL_DIMS'].map(n => [n, handle()]));
  const layouts = composition.sheets.map(s => ({ sheet: s, block: handle(), layout: handle(), name: `TW12-${s.id}` }));
  const offsets = Object.fromEntries(composition.model.views.map((v, i) => [v.id, [0, i * 1000]]));
  const pairs = list => list.map(([c, v]) => `${c}\n${typeof v === 'number' ? Number(v.toFixed(9)) : v}`).join('\n') + '\n';
  const section = (n, content) => pairs([[0, 'SECTION'], [2, n]]) + content + pairs([[0, 'ENDSEC']]);
  const point = (code, p) => [[code, p[0]], [code + 10, p[1]], [code + 20, p[2] || 0]];
  const entity = (kind, owner, layer, extra, layout) => pairs([[0, kind], [5, handle()], [330, owner], [100, 'AcDbEntity'], [8, layer], ...(layout ? [[67, 1], [410, layout]] : []), ...extra]);
  const line = (a, b, owner, layer, layout) => entity('LINE', owner, layer, [[100, 'AcDbLine'], ...point(10, a), ...point(11, b)], layout);
  const text = (value, p, height, owner, layer, layout, center = false) => entity('TEXT', owner, layer, [[100, 'AcDbText'], ...point(10, p), [40, height], [1, textoDxf(value)], [7, 'STANDARD'], [72, center ? 1 : 0], ...point(11, p), [100, 'AcDbText'], [73, 0]], layout);
  let entities = ''; const dimensionBlocks = [];
  for (const view of composition.model.views) {
    const offset = offsets[view.id]; const exaggeration = view.verticalScale ? view.scale / view.verticalScale : 1;
    const p = a => [a[0] + offset[0], a[1] * exaggeration + offset[1]];
    for (const e of view.entities) {
      if (e.kind === 'line') entities += line(p(e.a), p(e.b), modelBlock, e.layer);
      else entities += entity('ARC', modelBlock, e.layer, [[100, 'AcDbCircle'], ...point(10, p(e.center)), [40, e.radius], [100, 'AcDbArc'], [50, e.start], [51, e.end]]);
    }
    for (const [i, d] of view.dimensions.entries()) {
      const name = `*D${dimensionBlocks.length + 1}`; const block = handle(); const scale = view.scale / 1000; const h = 2.5 * scale;
      let representation = ''; let data;
      if (d.kind === 'linear') {
        const a = p(d.a); const b = p(d.b); const horizontal = Math.abs(a[1] - b[1]) < 1e-9;
        const c = horizontal ? [a[0], a[1] - d.offset * scale] : [a[0] + d.offset * scale, a[1]];
        const e = horizontal ? [b[0], c[1]] : [c[0], b[1]]; const mid = [(c[0] + e[0]) / 2, (c[1] + e[1]) / 2 + h];
        representation += line(a, c, block, 'MODEL_DIMS') + line(b, e, block, 'MODEL_DIMS') + line(c, e, block, 'MODEL_DIMS') + text(d.value.toFixed(2), mid, h, block, 'MODEL_DIMS', null, true);
        data = [[100, 'AcDbDimension'], [2, name], ...point(10, e), ...point(11, mid), [70, 33], [3, 'STANDARD'], [42, d.value], [100, 'AcDbAlignedDimension'], ...point(13, a), ...point(14, b)];
      } else {
        const c = p(d.center); const a = d.angle * Math.PI / 180; const tip = [c[0] + d.radius * Math.cos(a), c[1] + d.radius * Math.sin(a)]; const mid = [(c[0] + tip[0]) / 2, (c[1] + tip[1]) / 2];
        representation += line(c, tip, block, 'MODEL_DIMS') + text(`R ${d.value.toFixed(2)}`, mid, h, block, 'MODEL_DIMS');
        data = [[100, 'AcDbDimension'], [2, name], ...point(10, c), ...point(11, mid), [70, 36], [3, 'STANDARD'], [42, d.value], [100, 'AcDbRadialDimension'], ...point(15, tip), [40, 0]];
      }
      dimensionBlocks.push({ name, block, representation }); entities += entity('DIMENSION', modelBlock, 'MODEL_DIMS', data);
    }
  }
  const paperContents = {};
  for (const { sheet, block, name } of layouts) {
    const start = entities.length;
    const py = p => [p[0], sheet.size[1] - p[1]];
    for (const e of sceneForSheet(composition, sheet)) {
      // Model entities are shown by the viewport. Paper annotations are separate, in mm.
      if (e.layer && e.layer !== 'COTAS') continue;
      if (e.kind === 'line') entities += line(py(e.a), py(e.b), block, 'PAPEL', name);
      if (e.kind === 'rect') { const pts = [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]]; for (let i = 0; i < 4; i++) entities += line(py(pts[i]), py(pts[(i + 1) % 4]), block, 'PAPEL', name); }
      if (e.kind === 'text') entities += text(e.value, py([e.x, e.y + e.size]), e.size, block, 'PAPEL', name, e.align === 'center');
    }
    sheet.views.forEach((v, i) => {
      const vp = v.viewport; const off = offsets[v.id]; const ex = v.verticalScale ? v.scale / v.verticalScale : 1;
      entities += entity('VIEWPORT', block, 'PAPEL', [[100, 'AcDbViewport'], ...point(10, py(vp.paperCenter)), [40, vp.width], [41, vp.height], [68, 1], [69, i + 2], [12, vp.center[0] + off[0]], [22, vp.center[1] * ex + off[1]], ...point(16, [0, 0, 1]), ...point(17, [0, 0, 0]), [45, vp.height / vp.scale], [50, 0], [51, 0], [90, 16384], [331, layers.MODEL_DIMS]], name);
    });
    paperContents[block] = entities.slice(start); entities = entities.slice(0, start);
  }
  const table = (name, records) => pairs([[0, 'TABLE'], [2, name], [5, handle()], [100, 'AcDbSymbolTable'], [70, records.length]]) + records.join('') + pairs([[0, 'ENDTAB']]);
  let tables = table('LTYPE', [pairs([[0, 'LTYPE'], [5, handle()], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbLinetypeTableRecord'], [2, 'CONTINUOUS'], [70, 0], [3, 'Continuous'], [72, 65], [73, 0], [40, 0]])]);
  tables += table('LAYER', Object.entries(layers).map(([name, id]) => pairs([[0, 'LAYER'], [5, id], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbLayerTableRecord'], [2, name], [70, 0], [62, LAYERS[name]?.color || 7], [6, 'CONTINUOUS'], [370, Math.round((LAYERS[name]?.weight || 0.18) * 100)]])));
  tables += table('STYLE', [pairs([[0, 'STYLE'], [5, handle()], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbTextStyleTableRecord'], [2, 'STANDARD'], [70, 0], [40, 0], [41, 1], [50, 0], [71, 0], [42, 2.5], [3, 'Arial.ttf'], [4, '']])]);
  tables += table('DIMSTYLE', [pairs([[0, 'DIMSTYLE'], [105, handle()], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbDimStyleTableRecord'], [2, 'STANDARD'], [70, 0], [40, 1], [41, 0.1], [140, 0.125], [271, 2]])]);
  const blocks = [{ name: '*Model_Space', block: modelBlock, layout: modelLayout }, ...layouts.map((l, i) => ({ ...l, name: `*Paper_Space${i || ''}` })), ...dimensionBlocks];
  tables += table('BLOCK_RECORD', blocks.map(b => pairs([[0, 'BLOCK_RECORD'], [5, b.block], [100, 'AcDbSymbolTableRecord'], [100, 'AcDbBlockTableRecord'], [2, b.name], ...(b.layout ? [[340, b.layout]] : [])])));
  const blockSection = blocks.map(b => entity('BLOCK', b.block, '0', [[100, 'AcDbBlockBegin'], [2, b.name], [70, b.representation ? 1 : 0], ...point(10, [0, 0, 0]), [3, b.name], [1, '']]) + (b.representation || paperContents[b.block] || '') + entity('ENDBLK', b.block, '0', [[100, 'AcDbBlockEnd']])).join('');
  let objects = pairs([[0, 'DICTIONARY'], [5, root], [330, '0'], [100, 'AcDbDictionary'], [281, 1], [3, 'ACAD_LAYOUT'], [350, dictionary]]);
  objects += pairs([[0, 'DICTIONARY'], [5, dictionary], [330, root], [100, 'AcDbDictionary'], [281, 1], [3, 'Model'], [350, modelLayout], ...layouts.flatMap(l => [[3, l.name], [350, l.layout]])]);
  for (const [i, l] of [{ name: 'Model', block: modelBlock, layout: modelLayout, sheet: { size: [420, 297], margin: 12 } }, ...layouts].entries()) {
    objects += pairs([[0, 'LAYOUT'], [5, l.layout], [330, dictionary], [100, 'AcDbPlotSettings'], [1, ''], [2, 'DWG To PDF.pc3'], [4, ''], [40, l.sheet.margin], [41, l.sheet.margin], [42, l.sheet.margin], [43, l.sheet.margin], [44, l.sheet.size[0]], [45, l.sheet.size[1]], [140, 1], [141, 1], [70, 0], [72, 1], [73, 0], [74, 5], [100, 'AcDbLayout'], [1, l.name], [70, 1], [71, i], [10, 0], [20, 0], [11, l.sheet.size[0]], [21, l.sheet.size[1]], ...point(12, [0, 0, 0]), ...point(14, [0, 0, 0]), ...point(15, [l.sheet.size[0], l.sheet.size[1], 0]), [146, 0], ...point(13, [0, 0, 0]), ...point(16, [1, 0, 0]), ...point(17, [0, 1, 0]), [76, 0], [330, l.block]]);
  }
  const header = pairs([[9, '$ACADVER'], [1, 'AC1024'], [9, '$INSUNITS'], [70, 6], [9, '$MEASUREMENT'], [70, 1], [9, '$TILEMODE'], [70, 1], [9, '$HANDSEED'], [5, (next + 1).toString(16).toUpperCase()]]);
  return section('HEADER', header) + section('TABLES', tables) + section('BLOCKS', blockSection) + section('ENTITIES', entities) + section('OBJECTS', objects) + pairs([[0, 'EOF']]);
}
