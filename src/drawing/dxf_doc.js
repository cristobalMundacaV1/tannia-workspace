// Documento DXF AC1024 (AutoCAD 2010+) COMPLETO, escrito sin dependencias (P0 PL-C01, PR #38 C7).
// El escritor anterior omitía piezas que AutoCAD espera al abrir un DXF: sección CLASSES, tablas VPORT/VIEW/UCS, capa «0»,
// tipos ByBlock/ByLayer, propietarios (330) de los registros, viewport general (ID 1) de cada presentación, entidades del
// layout activo en ENTITIES (no en el bloque *Paper_Space), diccionarios ACAD_GROUP/ACAD_PLOTSTYLENAME/ACAD_MLINESTYLE,
// $EXTMIN/$EXTMAX y una vista inicial *Active encuadrada. La estructura sigue la de un dibujo nuevo AC1024 de referencia.
import { textoDxf } from '../design/salidas.js';

const fmt = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? String(Number(v.toFixed(9))) : (() => { throw new Error(`DXF: número no finito ${v}`); })()) : String(v));
export const pares = (lista) => lista.map(([c, v]) => `${c}\n${fmt(v)}`).join('\n') + '\n';
const P = (code, p) => [[code, p[0]], [code + 10, p[1]], [code + 20, p[2] || 0]];

/** Nombres de papel canónicos de «DWG To PDF.pc3» (trazado 1:1 de la lámina). */
const MEDIA = { '420x297': 'ISO_full_bleed_A3_(420.00_x_297.00_MM)', '594x420': 'ISO_full_bleed_A2_(594.00_x_420.00_MM)', '841x594': 'ISO_full_bleed_A1_(841.00_x_594.00_MM)' };
export const mediaDe = (size) => MEDIA[`${Math.max(...size)}x${Math.min(...size)}`] || `ANSI_(${size[0].toFixed(2)}_x_${size[1].toFixed(2)}_MM)`;

export class DxfDocumento {
  constructor({ insunits = 6 } = {}) {
    this.n = 0x20; this.insunits = insunits;
    this.h = {}; for (const k of ['VPORT', 'LTYPE', 'LAYER', 'STYLE', 'VIEW', 'UCS', 'APPID', 'DIMSTYLE', 'BLOCK_RECORD', 'ROOT', 'GROUP', 'LAYOUTS', 'MLSTYLES', 'PLOTSET', 'PSTYLES', 'PSNORMAL', 'MLSTD']) this.h[k] = this.handle();
    this.ltypes = new Map(); this.layers = new Map(); this.styles = new Map(); this.dimstyles = new Map(); this.appids = new Map(); this.blocks = []; this.layouts = [];
    for (const n of ['ByBlock', 'ByLayer', 'Continuous']) this.ltype(n, []);
    this.layer('0', { color: 7, lineweight: -3 }); this.layer('Defpoints', { color: 7, lineweight: -3, plot: false });
    this.textStyle('Standard', 'arial.ttf'); this.appid('ACAD');
    this.dimstyle('Standard', {});
    this.model = this.addBlockRecord('*Model_Space', true); this.model.layoutName = 'Model'; this.model.entities = []; this.model.tab = 0;
  }
  handle() { return (this.n++).toString(16).toUpperCase(); }
  ltype(nombre, elementos) { if (!this.ltypes.has(nombre)) this.ltypes.set(nombre, { h: this.handle(), elementos }); return nombre; }
  layer(nombre, { color = 7, ltype = 'Continuous', lineweight = -3, plot = true } = {}) { if (!this.layers.has(nombre)) this.layers.set(nombre, { h: this.handle(), color, ltype, lineweight, plot }); return nombre; }
  textStyle(nombre, fuente) { if (!this.styles.has(nombre)) this.styles.set(nombre, { h: this.handle(), fuente }); return nombre; }
  appid(nombre) { if (!this.appids.has(nombre)) this.appids.set(nombre, this.handle()); return nombre; }
  dimstyle(nombre, v) { if (!this.dimstyles.has(nombre)) this.dimstyles.set(nombre, { h: this.handle(), v }); return nombre; }
  addBlockRecord(name, isLayout = false) { const b = { name, rec: this.handle(), begin: this.handle(), end: this.handle(), layout: isLayout ? this.handle() : null, entities: [] }; this.blocks.push(b); return b; }
  /** Bloque de usuario (símbolo) o anónimo (*D de cota). Geometría en coordenadas del bloque. */
  block(name, { anonymous = false } = {}) { const b = this.addBlockRecord(name); b.anonymous = anonymous; return b; }
  /** Presentación (paper space) en mm. */
  layout(nombre, { size, plotMargin = 0 }) {
    const b = this.addBlockRecord('?', true); Object.assign(b, { layoutName: nombre, size, plotMargin, tab: this.layouts.length + 1, viewports: 0 });
    this.layouts.push(b);
    // Viewport general (ID 1): define el área visible de la hoja; sin él AutoCAD no activa los viewports de contenido.
    b.overall = this.add(b, 'VIEWPORT', 'Defpoints', [[100, 'AcDbViewport'], ...P(10, [size[0] / 2, size[1] / 2]), [40, size[0] * 1.05], [41, size[1] * 1.05], [68, 1], [69, 1], ...P(12, [size[0] / 2, size[1] / 2]).slice(0, 2), ...this.vpComun(size[1] * 1.05), [90, 557088], [1, ''], [281, 0], [71, 0], [74, 0], ...P(110, [0, 0]), ...P(111, [1, 0]), ...P(112, [0, 1]), [79, 0], [146, 0], [282, 0]]);
    b.viewports = 1;
    return b;
  }
  vpComun(viewHeight) { return [...P(13, [0, 0]).slice(0, 2), ...P(14, [10, 10]).slice(0, 2), ...P(15, [10, 10]).slice(0, 2), ...P(16, [0, 0, 1]), ...P(17, [0, 0, 0]), [42, 50], [43, 0], [44, 0], [45, viewHeight], [50, 0], [51, 0], [72, 1000]]; }
  /** Viewport de contenido: centro/tamaño en mm de papel; ventana del modelo por centro y altura (m). Bloqueado, encendido. */
  viewport(lay, { paperCenter, width, height, viewCenter, viewHeight, frozenLayers = [], xdata = [] }) {
    lay.viewports += 1;
    return this.add(lay, 'VIEWPORT', 'TW_VIEWPORTS', [[100, 'AcDbViewport'], ...P(10, paperCenter), [40, width], [41, height], [68, lay.viewports], [69, lay.viewports], ...P(12, viewCenter).slice(0, 2), ...this.vpComun(viewHeight), ...frozenLayers.map((n) => [341, this.layers.get(n).h]), [90, 32768 | 16384], [1, ''], [281, 0], [71, 0], [74, 0], ...P(110, [0, 0]), ...P(111, [1, 0]), ...P(112, [0, 1]), [79, 0], [146, 0], [282, 0], ...xdata]);
  }
  /** Agrega una entidad a un bloque/layout. `codes` empieza en el subclass marker propio de la entidad. */
  add(owner, tipo, layer, codes, { xdata = [], linetype, lineweight, color } = {}) {
    if (!this.layers.has(layer)) throw new Error(`DXF: capa no declarada ${layer}`);
    const enPapel = owner.layout && owner !== this.model; const h = this.handle();
    const head = [[0, tipo], [5, h], [330, owner.rec], [100, 'AcDbEntity'], ...(enPapel ? [[67, 1], [410, owner.layoutName]] : []), [8, layer], ...(linetype ? [[6, linetype]] : []), ...(color ? [[62, color]] : []), ...(lineweight !== undefined ? [[370, lineweight]] : [])];
    owner.entities.push(pares([...head, ...codes, ...xdata])); return h;
  }
  line(o, layer, a, b, opt) { return this.add(o, 'LINE', layer, [[100, 'AcDbLine'], ...P(10, a), ...P(11, b)], opt); }
  circle(o, layer, c, r, opt) { return this.add(o, 'CIRCLE', layer, [[100, 'AcDbCircle'], ...P(10, c), [40, r]], opt); }
  arc(o, layer, c, r, s, e, opt) { return this.add(o, 'ARC', layer, [[100, 'AcDbCircle'], ...P(10, c), [40, r], [100, 'AcDbArc'], [50, s], [51, e]], opt); }
  text(o, layer, value, p, height, { align = 'left', style = 'Standard', ...opt } = {}) {
    const al = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    return this.add(o, 'TEXT', layer, [[100, 'AcDbText'], ...P(10, p), [40, height], [1, textoDxf(value)], [7, style], ...(al ? [[72, al], ...P(11, p)] : []), [100, 'AcDbText']], opt);
  }
  lwpolyline(o, layer, pts, closed, opt) { return this.add(o, 'LWPOLYLINE', layer, [[100, 'AcDbPolyline'], [90, pts.length], [70, closed ? 1 : 0], [43, 0], ...pts.flatMap((p) => [[10, p[0]], [20, p[1]], ...(p[2] ? [[42, p[2]]] : [])])], opt); }
  insert(o, layer, block, p, scale, rot = 0, opt) { return this.add(o, 'INSERT', layer, [[100, 'AcDbBlockReference'], [2, block], ...P(10, p), [41, scale], [42, scale], [43, scale], [50, rot]], opt); }
  /** HATCH de patrón con contornos de polilínea (bulges) y líneas de definición explícitas (familias: ángulo, paso en unidades del espacio). */
  hatch(o, layer, { loops, nombre, familias, opt }) {
    const paths = loops.map((l, i) => [[92, i === 0 ? 3 : 2], [72, l.some((p) => p[2]) ? 1 : 0], [73, 1], [93, l.length], ...l.flatMap((p) => [[10, p[0]], [20, p[1]], ...(l.some((q) => q[2]) ? [[42, p[2] || 0]] : [])]), [97, 0]]).flat();
    const defs = familias.flatMap((f) => { const t = (f.angulo * Math.PI) / 180; return [[53, f.angulo], [43, 0], [44, 0], [45, -Math.sin(t) * f.paso], [46, Math.cos(t) * f.paso], [79, 0]]; });
    return this.add(o, 'HATCH', layer, [[100, 'AcDbHatch'], ...P(10, [0, 0]), ...P(210, [0, 0, 1]), [2, nombre], [70, 0], [71, 0], [91, loops.length], ...paths, [75, 0], [76, 2], [52, 0], [41, 1], [77, 0], [78, familias.length], ...defs, [98, 0]], opt);
  }

  toString({ extmin, extmax, vista }) {
    const S = (n, c) => pares([[0, 'SECTION'], [2, n]]) + c + pares([[0, 'ENDSEC']]);
    // Viewport general y layout por nombre de bloque: el layout de pestaña 1 es *Paper_Space (entidades en ENTITIES).
    this.layouts.forEach((l, i) => { l.name = i === 0 ? '*Paper_Space' : `*Paper_Space${i - 1}`; });
    const tabla = (nombre, h, registros, extra = []) => pares([[0, 'TABLE'], [2, nombre], [5, h], [330, 0], [100, 'AcDbSymbolTable'], [70, registros.length], ...extra]) + registros.join('') + pares([[0, 'ENDTAB']]);
    const rec = (tipo, h, owner, sub, codes, hcode = 5) => pares([[0, tipo], [hcode, h], [330, owner], [100, 'AcDbSymbolTableRecord'], [100, sub], ...codes]);
    const aspecto = 1.6; const vh = Math.max((vista.max[1] - vista.min[1]) * 1.08, (vista.max[0] - vista.min[0]) * 1.08 / aspecto, 1);
    const centro = [(vista.min[0] + vista.max[0]) / 2, (vista.min[1] + vista.max[1]) / 2];
    let t = tabla('VPORT', this.h.VPORT, [rec('VPORT', this.handle(), this.h.VPORT, 'AcDbViewportTableRecord', [[2, '*Active'], [70, 0], [10, 0], [20, 0], [11, 1], [21, 1], [12, centro[0]], [22, centro[1]], [13, 0], [23, 0], [14, 1], [24, 1], [15, 1], [25, 1], [16, 0], [26, 0], [36, 1], [17, 0], [27, 0], [37, 0], [40, vh], [41, aspecto], [42, 50], [43, 0], [44, 0], [50, 0], [51, 0], [71, 0], [72, 1000], [73, 1], [74, 3], [75, 0], [76, 0], [77, 0], [78, 0], [281, 0], [65, 1], [110, 0], [120, 0], [130, 0], [111, 1], [121, 0], [131, 0], [112, 0], [122, 1], [132, 0], [79, 0], [146, 0]])]);
    t += tabla('LTYPE', this.h.LTYPE, [...this.ltypes].map(([n, l]) => rec('LTYPE', l.h, this.h.LTYPE, 'AcDbLinetypeTableRecord', [[2, n], [70, 0], [3, l.elementos.length ? l.elementos.map((x) => (x > 0 ? '__' : ' ')).join('') : (n === 'Continuous' ? 'Solid line' : '')], [72, 65], [73, l.elementos.length], [40, l.elementos.reduce((s, x) => s + Math.abs(x), 0)], ...l.elementos.flatMap((x) => [[49, x], [74, 0]])])));
    t += tabla('LAYER', this.h.LAYER, [...this.layers].map(([n, l]) => rec('LAYER', l.h, this.h.LAYER, 'AcDbLayerTableRecord', [[2, n], [70, 0], [62, l.color], [6, l.ltype], ...(l.plot ? [] : [[290, 0]]), [370, l.lineweight], [390, this.h.PSNORMAL]])));
    t += tabla('STYLE', this.h.STYLE, [...this.styles].map(([n, s]) => rec('STYLE', s.h, this.h.STYLE, 'AcDbTextStyleTableRecord', [[2, n], [70, 0], [40, 0], [41, 1], [50, 0], [71, 0], [42, 2.5], [3, s.fuente], [4, '']])));
    t += tabla('VIEW', this.h.VIEW, []) + tabla('UCS', this.h.UCS, []);
    t += tabla('APPID', this.h.APPID, [...this.appids].map(([n, h]) => rec('APPID', h, this.h.APPID, 'AcDbRegAppTableRecord', [[2, n], [70, 0]])));
    const std = this.styles.get('Standard').h;
    t += tabla('DIMSTYLE', this.h.DIMSTYLE, [...this.dimstyles].map(([n, d]) => rec('DIMSTYLE', d.h, this.h.DIMSTYLE, 'AcDbDimStyleTableRecord', [[2, n], [70, 0], [3, d.v.post ?? ''], [40, d.v.dimscale ?? 1], [41, 2.5], [42, 0.625], [43, 3.75], [44, 1.25], [140, 2.5 * 1467 / 2048], [141, 2.5], [144, 1], [147, 0.625], [77, 1], [78, 8], [271, d.v.dec ?? 2], [278, 44], [279, 0], [340, std]], 105)), [[100, 'AcDbDimStyleTable'], [71, 0]]); // DIMSTYLE: el handle va en el código 105 (UAT AutoCAD 2027: con 5 → eHandleInUse, dibujo descartado)
    t += tabla('BLOCK_RECORD', this.h.BLOCK_RECORD, this.blocks.map((b) => rec('BLOCK_RECORD', b.rec, this.h.BLOCK_RECORD, 'AcDbBlockTableRecord', [[2, b.name], ...(b.layout ? [[340, b.layout]] : []), [70, 0], [280, 1], [281, 0]])));
    const ent = (b) => b.entities.join('');
    const activo = this.layouts[0];
    const blocks = this.blocks.map((b) => pares([[0, 'BLOCK'], [5, b.begin], [330, b.rec], [100, 'AcDbEntity'], ...(b.layout && b !== this.model ? [[67, 1]] : []), [8, '0'], [100, 'AcDbBlockBegin'], [2, b.name], [70, b.anonymous ? 1 : 0], ...P(10, [0, 0, 0]), [3, b.name], [1, '']])
      + (b === this.model || b === activo ? '' : ent(b)) + pares([[0, 'ENDBLK'], [5, b.end], [330, b.rec], [100, 'AcDbEntity'], ...(b.layout && b !== this.model ? [[67, 1]] : []), [8, '0'], [100, 'AcDbBlockEnd']])).join('');
    const entities = ent(this.model) + (activo ? ent(activo) : '');
    // OBJECTS: diccionario raíz con los diccionarios que AutoCAD espera encontrar.
    const lays = [this.model, ...this.layouts];
    let o = pares([[0, 'DICTIONARY'], [5, this.h.ROOT], [330, 0], [100, 'AcDbDictionary'], [281, 1], [3, 'ACAD_GROUP'], [350, this.h.GROUP], [3, 'ACAD_LAYOUT'], [350, this.h.LAYOUTS], [3, 'ACAD_MLINESTYLE'], [350, this.h.MLSTYLES], [3, 'ACAD_PLOTSETTINGS'], [350, this.h.PLOTSET], [3, 'ACAD_PLOTSTYLENAME'], [350, this.h.PSTYLES]]);
    o += pares([[0, 'DICTIONARY'], [5, this.h.GROUP], [330, this.h.ROOT], [100, 'AcDbDictionary'], [281, 1]]);
    o += pares([[0, 'DICTIONARY'], [5, this.h.LAYOUTS], [330, this.h.ROOT], [100, 'AcDbDictionary'], [281, 1], ...lays.flatMap((l) => [[3, l.layoutName], [350, l.layout]])]);
    o += pares([[0, 'DICTIONARY'], [5, this.h.MLSTYLES], [330, this.h.ROOT], [100, 'AcDbDictionary'], [281, 1], [3, 'Standard'], [350, this.h.MLSTD]]);
    o += pares([[0, 'DICTIONARY'], [5, this.h.PLOTSET], [330, this.h.ROOT], [100, 'AcDbDictionary'], [281, 1]]);
    o += pares([[0, 'ACDBDICTIONARYWDFLT'], [5, this.h.PSTYLES], [330, this.h.ROOT], [100, 'AcDbDictionary'], [281, 1], [3, 'Normal'], [350, this.h.PSNORMAL], [100, 'AcDbDictionaryWithDefault'], [340, this.h.PSNORMAL]]);
    o += pares([[0, 'ACDBPLACEHOLDER'], [5, this.h.PSNORMAL], [330, this.h.PSTYLES]]);
    o += pares([[0, 'MLINESTYLE'], [5, this.h.MLSTD], [330, this.h.MLSTYLES], [100, 'AcDbMlineStyle'], [2, 'Standard'], [70, 0], [3, ''], [62, 256], [51, 90], [52, 90], [71, 2], [49, 0.5], [62, 256], [6, 'BYLAYER'], [49, -0.5], [62, 256], [6, 'BYLAYER']]);
    for (const l of lays) {
      const isModel = l === this.model; const size = isModel ? [420, 297] : l.size;
      o += pares([[0, 'LAYOUT'], [5, l.layout], [330, this.h.LAYOUTS], [100, 'AcDbPlotSettings'], [1, ''], [2, isModel ? '' : 'DWG To PDF.pc3'], [4, isModel ? '' : mediaDe(size)], [6, ''], [40, 0], [41, 0], [42, 0], [43, 0], [44, size[0]], [45, size[1]], [46, 0], [47, 0], [48, 0], [49, 0], [140, 0], [141, 0], [142, 1], [143, 1], [70, isModel ? 1024 : 688], [72, 1], [73, 0], [74, 5], [7, ''], [75, 16], [76, 0], [77, 2], [78, 300], [147, 1], [148, 0], [149, 0],
        [100, 'AcDbLayout'], [1, l.layoutName], [70, 1], [71, l.tab], [10, 0], [20, 0], [11, size[0]], [21, size[1]], ...P(12, [0, 0, 0]), ...P(14, isModel ? extmin : [0, 0, 0]), ...P(15, isModel ? extmax : [size[0], size[1], 0]), [146, 0], ...P(13, [0, 0, 0]), ...P(16, [1, 0, 0]), ...P(17, [0, 1, 0]), [76, 1], [330, l.rec], ...(l.overall ? [[331, l.overall]] : [])]);
    }
    const classes = [['ACDBDICTIONARYWDFLT', 'AcDbDictionaryWithDefault'], ['ACDBPLACEHOLDER', 'AcDbPlaceHolder'], ['LAYOUT', 'AcDbLayout']].map(([n, c]) => pares([[0, 'CLASS'], [1, n], [2, c], [3, 'ObjectDBX Classes'], [90, 0], [91, 0], [280, 0], [281, 0]])).join('');
    const header = pares([[9, '$ACADVER'], [1, 'AC1024'], [9, '$DWGCODEPAGE'], [3, 'ANSI_1252'], [9, '$INSBASE'], ...P(10, [0, 0, 0]), [9, '$EXTMIN'], ...P(10, extmin), [9, '$EXTMAX'], ...P(10, extmax), [9, '$LIMMIN'], [10, extmin[0]], [20, extmin[1]], [9, '$LIMMAX'], [10, extmax[0]], [20, extmax[1]],
      [9, '$LTSCALE'], [40, 1], [9, '$PSLTSCALE'], [70, 1], [9, '$TEXTSTYLE'], [7, 'Standard'], [9, '$CLAYER'], [8, '0'], [9, '$DIMSTYLE'], [2, 'Standard'], [9, '$LUNITS'], [70, 2], [9, '$LUPREC'], [70, 3], [9, '$INSUNITS'], [70, this.insunits], [9, '$MEASUREMENT'], [70, 1], [9, '$LWDISPLAY'], [290, 1], [9, '$DIMASSOC'], [280, 1], [9, '$TILEMODE'], [70, 1],
      [9, '$VIEWCTR'], [10, centro[0]], [20, centro[1]], [9, '$VIEWSIZE'], [40, vh], [9, '$PEXTMIN'], ...P(10, [0, 0, 0]), [9, '$PEXTMAX'], ...P(10, activo ? [activo.size[0], activo.size[1], 0] : [420, 297, 0]), [9, '$PLIMMIN'], [10, 0], [20, 0], [9, '$PLIMMAX'], [10, activo ? activo.size[0] : 420], [20, activo ? activo.size[1] : 297], [9, '$HANDSEED'], [5, (this.n + 16).toString(16).toUpperCase()]]);
    return S('HEADER', header) + S('CLASSES', classes) + S('TABLES', t) + S('BLOCKS', blocks) + S('ENTITIES', entities) + S('OBJECTS', o) + pares([[0, 'EOF']]);
  }
}
