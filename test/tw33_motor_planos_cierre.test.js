// PR #38 — cierre del motor de planos: matriz de aceptación (03_MATRIZ_GATES.csv). Cada test cita su caso PL-*.
// Pruebas primero-falla: el DXF regenerado con el escritor de rc.4 (fixture) DEBE fallar el gate P0; el nuevo DEBE pasarlo.
// Los casos que requieren AutoCAD 2027 real o revisión profesional (PL-DXF-03, PL-UAT-CAD-01, PL-UAT-PRO-01) NO se simulan aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tunnelModel, compose, cantidadesFortificacion, cantidadesTunelContrato } from '../src/drawing/model.js';
import { modeloDesdeEspecificacion, muroConVanoEspecificacion } from '../src/drawing/especificacion.js';
import { buildIR, validarReferencias, primitivasModelo } from '../src/drawing/ir.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { buildSheetsPdf, validateScene, estiloImpresion } from '../src/drawing/pdf.js';
import { inspeccionarDxf, leerDxf } from '../src/drawing/dxf_inspect.js';
import { paridadDxf, paridadPdf, tintaEnTramas } from '../src/drawing/paridad.js';
import { verificarDxfContraModelo } from '../src/drawing/dxf_verificar.js';
import { validarCatalogo, ESTILOS, TRAMAS, SIMBOLOS } from '../src/drawing/catalog.js';
import { validarRegion } from '../src/drawing/regions.js';
import { renderPdf } from '../src/drawing/render.js';
import { firmaRaster, compararFirma } from '../src/drawing/golden.js';
import { DrawingService } from '../src/drawing/service.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';
import { dxfDecode } from '../src/design/salidas.js';

const F = { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 };
const UAT = () => tunnelModel({ length: 150, width: 5.5, wall: 2.5, selected: 0.08, fortificacion: F });
const EDI = () => modeloDesdeEspecificacion(muroConVanoEspecificacion());
const FIXTURE = path.join(import.meta.dirname, 'fixtures_drawing', 'uat_rc4_planos_completos_regenerado.dxf');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const codigo = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };
const cache = new Map();
function salida(nombre, crear, opts = {}) {
  const k = `${nombre}|${JSON.stringify(opts)}`; if (cache.has(k)) return cache.get(k);
  const c = compose(crear(), opts); const ir = buildIR(c); const dxf = buildDrawingDxf(c, { ir }); const r = { c, ir, dxf }; cache.set(k, r); return r;
}
// En Windows el intérprete suele llamarse «python»; en Linux «python3».
const PY = ['python3', 'python'].find((c) => spawnSync(c, ['-I', '-c', 'import ezdxf'], { encoding: 'utf8' }).status === 0); const pyEzdxf = !!PY;
// En CI el lector independiente ezdxf es OBLIGATORIO (TW_REQUIRE_EZDXF=1): no se acepta un «skip» silencioso del oráculo.
const requiereEz = process.env.TW_REQUIRE_EZDXF === '1';

test('PL-G00 baseline: el DXF de rc.4 regenerado desde el código de PR #37 está congelado (47 entidades, 5 layouts) y su huella es fija', () => {
  const t = fs.readFileSync(FIXTURE, 'latin1');
  assert.equal(sha(Buffer.from(t, 'latin1')), 'fbbda8cdc1228df2c4d84072c95dcdffaf9571e005d45c8be2d756b70b4441c1');
  const S = leerDxf(t); assert.equal(S.ENTITIES.length, 47); assert.deepEqual([...new Set(S.ENTITIES.map((e) => e.tipo))].sort(), ['ARC', 'DIMENSION', 'LINE']);
  // Oráculos geométricos del UAT (hipótesis de prueba, no ingeniería geotécnica)
  const m = UAT(); const q = cantidadesTunelContrato(m).detalle;
  assert.ok(Math.abs(q.find((x) => x.id === 'q-excavacion').valor - 3844.372083) < 1e-6);
  assert.ok(Math.abs(q.find((x) => x.id === 'q-revestimiento').valor - 162.164593) < 1e-6);
  assert.equal(q.find((x) => x.unidad === 'u').valor, 1010);
  assert.ok(Math.abs(q.find((x) => x.partida === 'Malla de acero').valor - 2234.946783) < 1e-6);
});

test('PL-DXF-01 (primero falla): el DXF de rc.4 NO supera la inspección de apertura; el nuevo sí, con vista inicial y extensiones útiles', () => {
  const viejo = inspeccionarDxf(fs.readFileSync(FIXTURE, 'latin1')); assert.equal(viejo.ok, false);
  const codigos = new Set(viejo.problemas.map((p) => p.codigo));
  for (const c of ['EXTENSIONES_AUSENTES', 'VPORT_ACTIVE_FALTANTE', 'ENCUADRE_DISPERSO', 'CAPA_0_FALTANTE', 'SECCION_FALTANTE', 'VIEWPORT_GENERAL_FALTANTE', 'PAPEL_ACTIVO_EN_BLOQUE', 'DICCIONARIO_FALTANTE']) assert.ok(codigos.has(c), `defecto reproducido: ${c}`);
  assert.ok(viejo.metricas.ocupacion_encuadre < 0.02, 'las vistas ocupaban < 2 % del encuadre (Y = 0…5007 m)');
  for (const [n, crear] of [['tunel', UAT], ['edi', EDI]]) {
    const { dxf } = salida(n, crear); const r = inspeccionarDxf(dxf);
    assert.deepEqual(r.problemas, [], n); assert.ok(r.metricas.ocupacion_encuadre > 0.3, `${n}: ocupación ${r.metricas.ocupacion_encuadre}`);
    assert.match(dxf, /\n\$TILEMODE\n70\n1\n/); assert.match(dxf, /\n2\n\*Active\n/);
  }
});

test('PL-DXF-01 mutaciones: quitar la vista inicial, las extensiones, la capa 0 o el viewport general vuelve a fallar el gate', () => {
  const { dxf } = salida('tunel', UAT);
  const mut = {
    VPORT_ACTIVE_FALTANTE: dxf.replace('\n2\n*Active\n', '\n2\n*Otra\n'),
    EXTENSIONES_AUSENTES: dxf.replace('\n9\n$EXTMIN\n', '\n9\n$XEXTMIN\n'),
    CAPA_0_FALTANTE: dxf.replace(/\nLAYER\n5\n([0-9A-F]+)\n330\n([0-9A-F]+)\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n0\n/, '\nLAYER\n5\n$1\n330\n$2\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\nCERO\n'),
    VIEWPORT_GENERAL_FALTANTE: dxf.replace(/\n69\n1\n/, '\n69\n7\n'),
  };
  for (const [c, t] of Object.entries(mut)) { assert.notEqual(t, dxf, `mutación aplicada: ${c}`); assert.ok(inspeccionarDxf(t).problemas.some((p) => p.codigo === c), c); }
});

test('PL-DXF-02: cada presentación TW12-01…06 tiene viewport general + viewports bloqueados cuyo encuadre contiene geometría del modelo', () => {
  const { dxf, c } = salida('tunel', UAT); const r = inspeccionarDxf(dxf);
  assert.deepEqual(r.metricas.presentaciones.map((l) => l.nombre), c.sheets.map((s) => `TW12-${s.id}`));
  for (const l of r.metricas.presentaciones) { assert.ok(l.viewports.length >= 1); assert.ok(l.viewports.every((v) => v.puntos_visibles > 0), l.nombre); }
  assert.equal(c.sheets.length, 6, 'túnel con fortificación: 5 láminas originales + 06 (detalles D1–D4)');
});

test('PL-DXF-02 lector independiente (ezdxf): reabre el DXF sin errores, 7 layouts, *Active encuadrado y viewports con escala exacta', { skip: pyEzdxf || requiereEz ? false : 'requiere python3 + ezdxf (obligatorio en CI)' }, () => {
  assert.ok(pyEzdxf, 'TW_REQUIRE_EZDXF=1 y ezdxf no está instalado');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw33-ez-')); const file = path.join(dir, 'p.dxf'); const { dxf, c } = salida('tunel', UAT); fs.writeFileSync(file, dxf);
  const code = `import sys,json\nfrom ezdxf import recover, bbox\nd,a=recover.readfile(sys.argv[1])\nact=d.viewports.get('*Active')[0]\nex=bbox.extents(d.modelspace(),fast=True)\nprint(json.dumps({'errors':len(a.errors),'layouts':[l.name for l in d.layouts],'ctr':list(act.dxf.center)[:2],'h':act.dxf.height,'asp':act.dxf.aspect_ratio,'ext':[list(ex.extmin)[:2],list(ex.extmax)[:2]],'vp':{l.name:[[v.dxf.id,v.dxf.height,v.dxf.view_height] for v in l.viewports()] for l in d.layouts if l.name!='Model'},'n':{l.name:len(l) for l in d.layouts}}))`;
  const r = spawnSync(PY, ['-I', '-c', code, file], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); const o = JSON.parse(r.stdout);
  assert.equal(o.errors, 0); assert.deepEqual(o.layouts, ['Model', ...c.sheets.map((s) => `TW12-${s.id}`)]);
  assert.ok(o.n.Model > 47 && Object.values(o.n).every((n) => n > 10), JSON.stringify(o.n));
  const [mn, mx] = o.ext; assert.ok(o.h >= (mx[1] - mn[1]) * 0.99 && o.h * o.asp >= (mx[0] - mn[0]) * 0.99, 'la vista inicial cubre la extensión real (ezdxf)');
  for (const s of c.sheets) { const vps = o.vp[`TW12-${s.id}`]; assert.equal(vps[0][0], 1, 'viewport general primero'); for (const [i, v] of s.views.entries()) assert.ok(Math.abs(vps[i + 1][2] - (vps[i + 1][1] * v.scale) / 1000) < 1e-6, `${s.id}/${v.id}: altura de vista = altura × escala`); }
});

test('PL-DXF-04: cotas verticales (perfil exagerado 5× y sección) son DIMENSION giradas 90° con DIMLFAC y anclajes exactos', () => {
  const { dxf, c } = salida('tunel', UAT); assert.equal(verificarDxfContraModelo(dxf, c).ok, true);
  const S = leerDxf(dxf); const dims = S.ENTITIES.filter((e) => e.tipo === 'DIMENSION');
  const vert = dims.filter((e) => e.g.some(([k, v]) => k === 50 && Number(v) === 90)); assert.ok(vert.length >= 4, `cotas verticales: ${vert.length}`);
  const perfil = vert.find((e) => e.g.some(([k, v]) => k === 1000 && v === 'ir=dim:perfil/profile-height'));
  const lfac = Number(perfil.g[perfil.g.findIndex(([k, v]) => k === 1070 && Number(v) === 144) + 1][1]); assert.ok(Math.abs(lfac - 0.2) < 1e-12, 'DIMLFAC = 1/5');
  assert.ok(dims.every((e) => /^TW_1-\d+$/.test(e.g.find(([k]) => k === 3)[1])), 'estilo de cota por escala (texto 2,5 mm en papel)');
});

test('PL-IR-01: la IR v2 conserva el inventario de tw.drawing/1 (cada entidad, cota y referencia) y las cantidades previas', () => {
  for (const crear of [UAT, EDI]) {
    const m = crear(); const { ir } = salida(crear === UAT ? 'tunel' : 'edi', crear); assert.equal(ir.schema, 'tw.drawing-ir/2'); assert.equal(ir.compat, 'tw.drawing/1');
    const ids = new Set(ir.model.map((p) => p.id));
    for (const v of m.views) { for (const e of v.entities) assert.ok(ids.has(e.ref), e.ref); for (const d of v.dimensions) assert.ok(ids.has(`dim:${v.id}/${d.id}`)); }
    assert.ok(ir.model.every((p) => p.id && p.view_id && p.layer && p.role && p.source_ref && p.physical_element_ref), 'cada primitiva con id, vista, capa, rol, fuente y elemento (o unbound)');
    for (const s of ir.sheets) assert.ok(s.primitives.every((p) => p.id && p.kind && p.layer), s.id);
    assert.equal(new Set(ir.sheets.flatMap((s) => s.primitives.map((p) => p.id))).size, ir.sheets.reduce((n, s) => n + s.primitives.length, 0), 'ids de papel únicos');
  }
});

test('PL-IR-02 / PL-HATCH-03: detalles, tramas y símbolos NO cambian ni duplican las cubicaciones', () => {
  const m = UAT(); const antes = JSON.stringify([cantidadesTunelContrato(m).detalle, cantidadesFortificacion(m)]);
  const sin = UAT(); sin.views = sin.views.filter((v) => !v.detail_ref).map((v) => ({ ...v, regions: [], symbols: [] }));
  assert.equal(JSON.stringify([cantidadesTunelContrato(sin).detalle, cantidadesFortificacion(sin)]), antes);
  const { ir } = salida('tunel', UAT);
  for (const p of ir.model.filter((x) => ['hatch', 'symbol'].includes(x.kind))) assert.equal(p.measurable, false, p.id);
  for (const v of m.views.filter((x) => x.detail_ref)) assert.ok(v.entities.every((e) => e.role === 'representacion'), `${v.id}: los detalles nunca son fuente medible`);
  // Edificación: el muro se mide UNA vez (elevación); planta, corte y detalle son representaciones y no pueden medirse.
  const e = muroConVanoEspecificacion(); e.mediciones.push({ id: 'm-planta', partida: 'Muro de fachada', metodo: 'area', fuentes: ['planta/pilar-izq'] });
  assert.equal(codigo(() => modeloDesdeEspecificacion(e)), 'MEDICION_NO_AUTORIZADA');
});

test('PL-SYM-01: catálogo válido (ids únicos, estado, muestra renderizable); entradas corruptas o símbolos inexistentes se rechazan', () => {
  assert.deepEqual(validarCatalogo().problemas, []);
  assert.equal(validarCatalogo({ ESTILOS, TRAMAS, SIMBOLOS: { ...SIMBOLOS, ROTO: { significado: 'sin geometría', estado: 'PROPUESTO', medible: false, geometria: [] } } }).ok, false);
  assert.equal(validarCatalogo({ ESTILOS, TRAMAS: { ...TRAMAS, X1: { ...TRAMAS.CONCRETE, familias: [{ angulo: 0, paso: 0 }] } }, SIMBOLOS }).ok, false);
  assert.equal(validarCatalogo({ ESTILOS: { ...ESTILOS, MAL: { ...ESTILOS.GENERIC, estado: 'APROBADO' } }, TRAMAS, SIMBOLOS }).ok, false);
  const e = muroConVanoEspecificacion(); e.vistas[3].simbolos = [{ simbolo: 'NO_EXISTE', en: [0, 0] }]; assert.equal(codigo(() => modeloDesdeEspecificacion(e)), 'SIMBOLO_INEXISTENTE');
  const e2 = muroConVanoEspecificacion(); e2.capas.MUROS.estilo = 'NADA'; assert.equal(codigo(() => modeloDesdeEspecificacion(e2)), 'ESTILO_INEXISTENTE');
});

test('PL-SYM-02: color y monocromo conservan la semántica (grosor y trazo idénticos; en mono todo negro); DXF con la misma capa/tipo/grosor', () => {
  const { c, ir, dxf } = salida('tunel', UAT); const m = c.model;
  for (const p of ir.sheets.flatMap((s) => s.primitives).filter((x) => x.kind !== 'text')) {
    const col = estiloImpresion(m, p, 'color'); const mono = estiloImpresion(m, p, 'mono');
    assert.equal(mono.color, '#000000'); assert.equal(col.weight, mono.weight); assert.deepEqual(col.dash, mono.dash);
  }
  assert.notEqual(estiloImpresion(m, { layer: 'PERNOS', kind: 'line' }, 'color').color, estiloImpresion(m, { layer: 'EXCAVACION', kind: 'line' }, 'color').color);
  assert.notEqual(estiloImpresion(m, { layer: 'PERNOS', kind: 'line' }).weight, estiloImpresion(m, { layer: 'EXCAVACION', kind: 'line' }).weight, 'contorno y perno se distinguen por grosor, no solo por color');
  const capa = (n) => leerDxf(dxf).TABLES.find((e) => e.tipo === 'LAYER' && e.g.some(([k, v]) => k === 2 && v === n));
  assert.equal(capa('EXCAVACION').g.find(([k]) => k === 370)[1], '50'); assert.equal(capa('EJE').g.find(([k]) => k === 6)[1], 'TW_EJE');
});

test('PL-HATCH-01: regiones inválidas se rechazan ANTES de escribir (abierta, autointersectada, hueco fuera, huecos superpuestos, material sin origen)', () => {
  const ok = { id: 'r', trama: 'CONCRETE', material: { nombre: 'H', origen: 'test' }, contorno: [[0, 0], [4, 0], [4, 4], [0, 4]], huecos: [] };
  assert.ok(validarRegion(ok).area_control_m2 === 16);
  for (const [cod, r] of [['REGION_ABIERTA', { ...ok, contorno: [[0, 0], [1, 1]] }], ['REGION_AUTOINTERSECTA', { ...ok, contorno: [[0, 0], [4, 4], [4, 0], [0, 4]] }], ['HUECO_FUERA_DEL_CONTORNO', { ...ok, huecos: [[[3, 3], [6, 3], [6, 6], [3, 6]]] }],
    ['HUECOS_SUPERPUESTOS', { ...ok, huecos: [[[1, 1], [2.5, 1], [2.5, 2.5], [1, 2.5]], [[2, 2], [3, 2], [3, 3], [2, 3]]] }], ['MATERIAL_SIN_ORIGEN', { ...ok, material: { nombre: 'H' } }], ['TRAMA_INEXISTENTE', { ...ok, trama: 'MARMOL' }], ['REGION_SIN_AREA', { ...ok, contorno: [[0, 0], [1, 0], [2, 0]] }]]) assert.equal(codigo(() => validarRegion(r)), cod);
  const e = muroConVanoEspecificacion(); e.vistas[0].regiones[0].huecos = [[[5.5, 1], [7, 1], [7, 2], [5.5, 2]]];
  assert.equal(codigo(() => buildIR(compose(modeloDesdeEspecificacion(e)))), 'HUECO_FUERA_DEL_CONTORNO', 'el plano no se genera');
});

test('PL-HATCH-02: shotcrete y malla son HATCH en el DXF y tramas recortadas en el PDF, con el mismo patrón, contorno, material y ref', async () => {
  const { c, ir, dxf } = salida('tunel', UAT); const S = leerDxf(dxf);
  const hatches = S.ENTITIES.filter((e) => e.tipo === 'HATCH' && !e.g.some(([k, v]) => k === 67 && v === '1'));
  const regiones = ir.model.filter((p) => p.kind === 'hatch'); assert.equal(hatches.length, regiones.length);
  for (const r of regiones) {
    const h = hatches.find((e) => e.g.some(([k, v]) => k === 1000 && v === `ir=${r.id}`)); assert.ok(h, r.id);
    const v = c.model.views.find((x) => x.id === r.view_id); const T = TRAMAS[r.hatch_ref];
    const pasos = h.g.filter(([k]) => k === 46).map(([, x]) => Number(x)); const angs = h.g.filter(([k]) => k === 53).map(([, x]) => Number(x));
    assert.deepEqual(angs, T.familias.map((f) => f.angulo)); T.familias.forEach((f, i) => assert.ok(Math.abs(Math.hypot(Number(h.g.filter(([k]) => k === 45)[i][1]), pasos[i]) - (f.paso * v.scale) / 1000) < 1e-9, 'paso = mm de papel × escala'));
    assert.ok(h.g.some(([k, x]) => k === 1000 && x === `material=${r.material.nombre}`));
    assert.equal(h.g.filter(([k]) => k === 93).reduce((n, [, x]) => n + Number(x), 0), r.loops.reduce((n, l) => n + l.length, 0), 'mismos vértices de contorno');
  }
  const sec = regiones.find((r) => r.id === 'hatch:seccion/seccion-rev'); const q = c.model.quantities.find((x) => x.thickness_m === 0.08);
  assert.ok(Math.abs(sec.area_control_m2 - q.lining_area_m2) < 1e-9, 'el área de control de la trama = área de revestimiento de la cubicación (no se suma)');
  const pdf = await buildSheetsPdf(c, '06', { ir }); const [p] = await renderPdf(pdf, { dpi: 144, pixels: true });
  assert.deepEqual(tintaEnTramas(ir.sheets.find((s) => s.id === '06'), p.pixels, { dpi: 144 }).problemas, []);
});

test('PL-LEG-01: la leyenda muestra EXACTAMENTE lo usado en cada lámina, con muestra real; sin filas fantasma', () => {
  const { c, ir } = salida('tunel', UAT);
  for (const s of c.sheets) {
    const prims = ir.sheets.find((x) => x.id === s.id).primitives; const views = s.views;
    const capas = new Set([...views.flatMap((v) => v.entities.map((e) => e.layer)), ...(views.some((v) => v.dimensions.length) ? ['COTAS'] : [])]);
    const tramas = new Set(views.flatMap((v) => (v.regions || []).map((r) => r.trama))); const simb = new Set(views.flatMap((v) => (v.symbols || []).map((x) => x.symbol)));
    if ((c.callouts || []).some((x) => x.source_sheet === s.id)) simb.add('DETAIL_CALLOUT');
    const filas = s.legend; assert.deepEqual(new Set(filas.filter((f) => f.kind === 'line').map((f) => f.layer)), capas, s.id);
    assert.deepEqual(new Set(filas.filter((f) => f.kind === 'hatch').map((f) => f.trama)), tramas, s.id); assert.deepEqual(new Set(filas.filter((f) => f.kind === 'symbol').map((f) => f.symbol)), simb, s.id);
    for (const f of filas) { assert.ok(prims.some((p) => p.role === 'legend_sample' && p.legend_ref === f.id), `${s.id}: muestra de ${f.id}`); assert.ok(prims.some((p) => p.role === 'legend_label' && p.legend_ref === f.id), `${s.id}: texto de ${f.id}`); }
  }
});

test('PL-CALLOUT-01: globos D1–D4 ↔ detalles: referencias bidireccionales; huérfanos, duplicados o destinos inexistentes se rechazan', () => {
  const { c } = salida('tunel', UAT); assert.deepEqual(c.callouts.map((x) => [x.label, x.source_sheet, x.target_sheet]), [['D1', '05', '06'], ['D2', '05', '06'], ['D3', '05', '06'], ['D4', '05', '06']]);
  const romper = (fn) => { const k = structuredClone(c); fn(k); return codigo(() => validarReferencias(k)); };
  assert.equal(romper((k) => { k.callouts.pop(); }), 'REFERENCIAS_INVALIDAS', 'detalle D4 huérfano');
  assert.equal(romper((k) => { k.callouts.push({ ...k.callouts[0] }); }), 'REFERENCIAS_INVALIDAS', 'llamada duplicada');
  assert.equal(romper((k) => { k.callouts[1].target_view = 'D9'; }), 'REFERENCIAS_INVALIDAS', 'destino inexistente');
  assert.equal(romper((k) => { k.callouts[0].target_sheet = undefined; }), 'REFERENCIAS_INVALIDAS', 'detalle sin lámina');
  const { ir } = salida('tunel', UAT); const t06 = ir.sheets.find((s) => s.id === '06').primitives.filter((p) => p.role === 'view_title').map((p) => p.value);
  for (const d of ['D1', 'D2', 'D3', 'D4']) assert.ok(t06.some((t) => t.startsWith(d) && t.endsWith('Llamada en lámina 05')), `${d} cita su lámina de origen`);
});

test('PL-CALLOUT-02: globos y líderes sin colisiones con cotas, textos ni geometría; una colisión forzada se detecta', () => {
  const { c, ir } = salida('tunel', UAT); const s = c.sheets.find((x) => x.id === '05'); const prims = ir.sheets.find((x) => x.id === '05').primitives;
  assert.deepEqual(validateScene(prims, s).issues, []); assert.equal(prims.filter((p) => p.role === 'callout' && p.kind === 'text').length, 8);
  const globo = prims.find((p) => p.role === 'callout' && p.kind === 'text'); const cota = prims.find((p) => p.role === 'dimension' && p.kind === 'text');
  assert.equal(validateScene([...prims, { ...globo, x: cota.x, y: cota.y }], s).ok, false);
});

test('PL-DETAIL-01…04: D1–D4 dibujan solo lo declarado; lo no declarado queda PENDIENTE (sin placa, solera ni longitud de traslapo inventadas)', () => {
  const m = UAT(); const d = Object.fromEntries(m.views.filter((v) => v.detail_ref).map((v) => [v.id, v]));
  assert.deepEqual(Object.keys(d), ['D1', 'D2', 'D3', 'D4']);
  for (const v of Object.values(d)) { assert.ok((v.regions || []).every((r) => r.material?.origen), `${v.id}: material con origen`); assert.ok(v.notes.some((n) => /PENDIENTE/.test(n)), `${v.id}: pendientes visibles`); assert.ok(v.symbols.some((s) => s.symbol === 'PENDING_MARK')); }
  // D1: geometría derivada del contorno real (radio r y r − e) y espesor acotado = espesor declarado
  const r = 2.75; assert.ok(d.D1.entities.some((e) => e.kind === 'arc' && e.radius === r) && d.D1.entities.some((e) => e.kind === 'arc' && Math.abs(e.radius - (r - 0.08)) < 1e-12));
  assert.ok(Math.abs(d.D1.dimensions[0].value - 0.08) < 1e-12);
  // D2: sin solera/drenaje: ninguna entidad bajo el piso (y < 0)
  assert.ok(d.D2.entities.every((e) => e.a[1] >= 0 && e.b[1] >= 0)); assert.ok(d.D2.notes.some((n) => /solera, drenaje/.test(n)));
  // D3: cabeza de perno = símbolo esquemático NO medible; ninguna entidad de placa/tuerca
  assert.equal(SIMBOLOS.ANCHOR_HEAD.medible, false); assert.ok(!d.D3.entities.some((e) => /placa|tuerca|lechada/i.test(e.id)));
  // D4: esquemático, sin cotas: el % no se convierte en longitud
  assert.equal(d.D4.schematic, true); assert.deepEqual(d.D4.dimensions, []); assert.ok(d.D4.notes.some((n) => /longitud de traslapo es PENDIENTE/.test(n)));
  const sinMalla = tunnelModel({ fortificacion: { ...F, malla: false } }); assert.ok(!sinMalla.views.some((v) => v.id === 'D4'), 'sin malla declarada no hay D4');
});

test('PL-TABLE-01/02/03: cuadros = misma fuente que la cubicación, impresos igual en PDF y DXF; materiales sin especificación inventada', async () => {
  const { c, ir, dxf } = salida('tunel', UAT); const fort = cantidadesFortificacion(c.model); const pernos = fort.find((x) => x.unidad === 'u');
  const tp = c.model.tables.find((t) => t.id === 'T-PERNOS'); const filasP = tp.rows.filter((r) => /^P\d+$/.test(r.id));
  assert.equal(filasP.length * pernos.distribucion.anillos, 1010); assert.equal(tp.rows.find((r) => r.id === 'total').values.zona, '1010 pernos');
  assert.equal(filasP.length, c.model.views.find((v) => v.id === 'fortificacion').entities.filter((e) => e.layer === 'PERNOS').length, 'una fila por perno dibujado');
  const tg = c.model.tables.find((t) => t.id === 'T-GEOM'); assert.equal(tg.rows.find((r) => r.id === 'ancho').values.val, 5.5);
  assert.ok(Math.abs(tg.rows.find((r) => r.id === 'area-exc').values.val - 25.629147) < 1e-6);
  const tm = c.model.tables.find((t) => t.id === 'T-MAT'); assert.ok(tm.rows.every((r) => r.values.eett === 'PENDIENTE'));
  const papel = (id) => ir.sheets.find((s) => s.id === id).primitives.filter((p) => p.kind === 'text').map((p) => p.value);
  assert.ok(papel('05').includes('1010 pernos')); assert.ok(papel('03').includes('5,50')); assert.ok(papel('03').includes('25,629147'));
  const dxfTextos = leerDxf(dxf).BLOCKS.concat(leerDxf(dxf).ENTITIES).filter((e) => e.tipo === 'TEXT').map((e) => dxfDecode(e.g.find(([k]) => k === 1)[1]));
  for (const t of ['1010 pernos', '25,629147', '5,50', 'PENDIENTE']) assert.ok(dxfTextos.includes(t), `DXF: ${t}`);
});

test('PL-CSV-01 / PL-E2E: el servicio entrega IR, DXF inspeccionado, paridad y CSV tipado sin «[object Object]»', async () => {
  const home = tmpHome('TW33 '); const sb = new Sandbox(home); createProject(sb, 'Cierre'); const svc = new DrawingService(sb);
  const g = await svc.generate('Cierre', { model: { length: 150, width: 5.5, wall: 2.5, selected: 0.08, fortificacion: F } });
  const dir = path.join(sb.projectRoot('Cierre'), g.folder); const leer = (suf) => fs.readFileSync(path.join(dir, g.files.find((f) => f.endsWith(suf))), 'utf8');
  assert.equal(g.files.filter((f) => /lamina-.*\.pdf$/.test(f)).length, 6); assert.ok(g.files.some((f) => f.endsWith('ir.json')));
  const csv = leer('fortificacion.csv'); assert.ok(!/object Object/.test(csv)); assert.match(csv.split('\n')[0], /distribucion\.anillos/);
  const v = JSON.parse(leer('verificacion.json')); assert.equal(v.dxf_inspeccion.ok, true); assert.equal(v.paridad.dxf.ok, true); assert.equal(v.paridad.pdf.ok, true); assert.match(v.autocad_2027, /NO VERIFICADO/);
  assert.equal(JSON.parse(leer('ir.json')).schema, 'tw.drawing-ir/2');
});

test('PL-SHEET-01/02: A3, A2 y A1 en ambos dominios: cero recortes/colisiones/solapes de panel, escalas exactas, texto ≥ 2,5 mm', () => {
  for (const [n, crear] of [['tunel', UAT], ['edi', EDI]]) for (const paper of ['A3', 'A2', 'A1']) {
    const { c, ir } = salida(n, crear, { paper });
    for (const s of c.sheets) {
      const prims = ir.sheets.find((x) => x.id === s.id).primitives; assert.deepEqual(validateScene(prims, s).issues, [], `${n} ${paper} ${s.id}`);
      assert.ok(prims.filter((p) => p.kind === 'text').every((p) => p.size >= 2.5), 'perfil tipográfico: mínimo 2,5 mm');
      assert.ok(prims.some((p) => p.role === 'sheet_title' && p.size >= 4) && prims.some((p) => p.role === 'view_title' && p.size >= 3), 'jerarquía: lámina > vista > cuerpo');
      for (const v of s.views) assert.equal(v.viewport.scale, 1000 / v.scale, 'escala declarada = escala aplicada');
    }
  }
});

test('PL-SHEET-03: si no cabe, se pagina en láminas de continuación (sin reescalar); una vista sola demasiado grande falla con VISTA_NO_CABE', () => {
  const e = muroConVanoEspecificacion(); e.laminas = [{ id: '01', titulo: 'Todo', vistas: ['elevacion', 'planta', 'corte', 'det-vano'] }];
  e.cuadros = [{ id: 'T-CANT', lamina: '01', tipo: 'cantidades' }, { id: 'T-MAT', lamina: '01', tipo: 'materiales' }];
  e.vistas.find((v) => v.id === 'elevacion').escala = 25; e.vistas.find((v) => v.id === 'planta').escala = 25;
  const c = compose(modeloDesdeEspecificacion(e)); assert.ok(c.sheets.length >= 2, `${c.sheets.length} láminas`); assert.ok(c.sheets.slice(1).every((s) => s.continuation_of === '01'));
  assert.deepEqual(c.sheets.flatMap((s) => s.views.map((v) => v.id)).sort(), ['corte', 'det-vano', 'elevacion', 'planta']);
  for (const s of c.sheets) { assert.deepEqual(validateScene(buildIR(c).sheets.find((x) => x.id === s.id).primitives, s).issues, []); for (const v of s.views) assert.equal(v.viewport.scale, 1000 / v.scale); }
  assert.equal(codigo(() => compose(UAT(), { orientation: 'portrait' })), 'VISTA_NO_CABE');
});

test('PL-PARITY-01: PDF y DXF de la MISMA IR (ambos dominios): mismos elementos por id, textos, cuadros, llamadas, tramas y revisión', async () => {
  for (const [n, crear] of [['tunel', UAT], ['edi', EDI]]) {
    const { c, ir, dxf } = salida(n, crear); assert.deepEqual(paridadDxf(ir, dxf).problemas, [], n);
    const pdf = await buildSheetsPdf(c, null, { ir }); assert.deepEqual((await paridadPdf(ir, pdf)).problemas, [], n);
  }
});

test('PL-PARITY-02 mutaciones: quitar una trama, un globo o una fila; alterar un valor o el tipo de línea; el PDF de otra IR: cada gate lo detecta', async () => {
  const { c, ir, dxf } = salida('tunel', UAT);
  const quitarEntidad = (t, ir1) => { const i = t.indexOf(`\n1000\nir=${ir1}\n`); const ini = t.lastIndexOf('\n0\n', i); const fin = t.indexOf('\n0\n', i); return t.slice(0, ini) + t.slice(fin); };
  const hatch = ir.model.find((p) => p.kind === 'hatch').id; assert.equal(paridadDxf(ir, quitarEntidad(dxf, hatch)).ok, false, 'trama eliminada');
  const globo = ir.sheets.find((s) => s.id === '05').primitives.find((p) => p.role === 'callout' && p.inst).inst.id; assert.equal(paridadDxf(ir, quitarEntidad(dxf, globo)).ok, false, 'globo eliminado');
  const celda = ir.sheets.find((s) => s.id === '05').primitives.find((p) => p.value === '1010 pernos'); assert.equal(paridadDxf(ir, quitarEntidad(dxf, celda.id)).ok, false, 'fila/celda eliminada');
  assert.equal(paridadDxf(ir, dxf.replace('\n1\n1010 pernos\n', '\n1\n1011 pernos\n')).ok, false, 'valor alterado');
  assert.equal(verificarDxfContraModelo(dxf.replace(/(\n2\nEJE\n(?:[^\n]*\n)*?6\n)TW_EJE/, (_, a) => `${a}Continuous`), c).ok, false, 'tipo de línea alterado');
  const otra = compose(tunnelModel({ length: 150, width: 5.5, wall: 2.5, selected: 0.06, fortificacion: F })); const pdfOtra = await buildSheetsPdf(otra);
  assert.equal((await paridadPdf(ir, pdfOtra)).ok, false, 'PDF de otra revisión/espesor');
});

test('PL-VISUAL-01: render de las láminas comparado con firmas golden aprobadas (cambios visuales no aprobados fallan)', async () => {
  const goldens = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures_drawing', 'golden_firmas.json'), 'utf8'));
  for (const [n, crear] of [['tunel', UAT], ['edi', EDI]]) {
    const { c, ir } = salida(n, crear); const pages = await renderPdf(await buildSheetsPdf(c, null, { ir }), { dpi: 72, pixels: true });
    assert.equal(pages.length, goldens[n].length, n);
    pages.forEach((p, i) => { const r = compararFirma(firmaRaster(p.pixels), goldens[n][i]); assert.ok(r.ok, `${n} lámina ${i + 1}: ${JSON.stringify(r)}`); });
  }
  // Una lámina alterada (otro espesor) debe salirse de la firma aprobada
  const otra = compose(tunnelModel({ length: 150, width: 5.5, wall: 2.5, selected: 0.08, fortificacion: { ...F, perno_longitud: 1.2 } }));
  const [p] = await renderPdf(await buildSheetsPdf(otra, '05'), { dpi: 72, pixels: true }); assert.equal(compararFirma(firmaRaster(p.pixels), goldens.tunel[4]).ok, false);
});

test('PL-DOMAIN-01/02: túnel (6 láminas con planta, perfil, sección, D1–D4, cuadros y leyenda) y edificación (muro con vano: 13,8 m² = 15,6 − 1,8)', () => {
  const { c } = salida('tunel', UAT); assert.deepEqual(c.sheets.map((s) => s.id), ['01', '02', '03', '04', '05', '06']);
  assert.deepEqual(c.sheets.flatMap((s) => s.panels.filter((p) => p.type === 'table').map((p) => p.id)).sort(), ['T-CANT', 'T-GEOM', 'T-MAT', 'T-PERNOS']);
  assert.ok(c.sheets.every((s) => s.panels.some((p) => p.type === 'legend')));
  const m = EDI(); const tot = m.quantity_totals.find((t) => t.partida === 'Muro de fachada');
  assert.ok(Math.abs(tot.valor - (6 * 2.6 - 1.5 * 1.2)) < 1e-9); assert.equal(tot.estado, 'TRAZADA');
  assert.ok(m.quantities.every((q) => q.vistas_medidas === 'elevacion'), 'solo la elevación se mide');
  const sinMaterial = modeloDesdeEspecificacion(muroConVanoEspecificacion({ material: null })); assert.ok(sinMaterial.views.every((v) => !v.regions.length), 'sin material declarado no se dibuja trama');
});

test('G11 UAT AutoCAD 2027 (regresión): cada registro DIMSTYLE lleva el handle en 105 (nunca en 5); el DXF de rc.5 que AutoCAD descartó falla el gate', () => {
  // Evidencia UAT del PO (PR #39): «Error en la tabla DIMSTYLE / eHandleInUse / dibujo descartado» con el DXF de edificación de rc.5.
  const rc5 = fs.readFileSync(path.join(import.meta.dirname, 'fixtures_drawing', 'rc5_edificacion_planos_dimstyle_5.dxf'), 'utf8');
  assert.equal(sha(Buffer.from(rc5, 'utf8')), 'd240802bf7d141d0ad7667eb76c56f39323aa36f2aaa48bfe50d10746c7888d2', 'copia exacta del DXF del ZIP rc.5');
  const viejo = inspeccionarDxf(rc5); assert.equal(viejo.ok, false); assert.ok(viejo.problemas.filter((p) => p.codigo === 'DIMSTYLE_HANDLE_INVALIDO').length >= 2);
  assert.ok(viejo.problemas.some((p) => p.codigo === 'VARIABLE_CABECERA_DESCONOCIDA'), '$MSLTSCALE informada por AutoCAD 2027');
  for (const [n, crear] of [['tunel', UAT], ['edi', EDI]]) {
    const { dxf } = salida(n, crear); const regs = leerDxf(dxf).TABLES.filter((e) => e.tipo === 'DIMSTYLE');
    assert.ok(regs.length >= 2, n);
    for (const r of regs) { assert.ok(r.g.some(([k]) => k === 105), `${n}: DIMSTYLE con 105`); assert.ok(!r.g.some(([k]) => k === 5), `${n}: DIMSTYLE sin código 5`); }
    assert.ok(!dxf.includes('$MSLTSCALE')); assert.deepEqual(inspeccionarDxf(dxf).problemas, [], n);
  }
});
