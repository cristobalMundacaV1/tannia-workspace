// TW-11 G6 / Caso D: plano (DXF) → cantidad → partidas → presupuesto → planificación → informe, SIN transcripción manual, con recomputación.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { tmpHome, startClient, call, data } from './helpers.js';
import { ejecutarOperacion as run, OpError } from '../src/cic/ops/index.js';
import { computeBudget } from '../src/budget/calc.js';
import { computeQuantity, REGLAS, REGLAS_TW11 } from '../src/quantities/engine.js';
import { extraerPdf } from '../src/cic/conocimiento/extractores.js';
import { verificarEntregable } from '../src/cic/verificador.js';
import { Ledger } from '../src/cic/claims.js';

const close = (a, b, rel = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${m} ${a} ≠ ${b}`);
const Mv = (value, unit) => ({ value, unit });
const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof OpError && e.code === code, code);

test('qty/bud/sched: oráculos manuales; precios, pérdida y tasas jamás por defecto; unidades sin conversión implícita', () => {
  close(run('qty.product', { base: Mv(100, 'm2'), factor: Mv(0.15, 'm') }).outputs.cantidad.value, 15); assert.equal(run('qty.product', { base: Mv(100, 'm2'), factor: Mv(0.15, 'm') }).outputs.cantidad.unit, 'm3');
  assert.equal(run('qty.product', { base: Mv(20, 'm'), factor: Mv(3, 'm') }).outputs.cantidad.unit, 'm2'); throwsCode(() => run('qty.product', { base: Mv(20, 'm2'), factor: Mv(3, 'm2') }), 'DIMENSION_INCOMPATIBLE');
  close(run('qty.apply_loss', { cantidad: Mv(100, 'm3'), perdida_pct: Mv(5, '%') }).outputs.cantidad_con_perdida.value, 105); throwsCode(() => run('qty.apply_loss', { cantidad: Mv(100, 'm3'), perdida_pct: Mv(5) }), 'INVALID_INPUT'); throwsCode(() => run('qty.apply_loss', { cantidad: Mv(100, 'm3') }), 'ENTRADA_FALTANTE');
  // regresión: las 9 reglas anteriores siguen y las nuevas coinciden con qty.product
  for (const r of ['directa_longitud', 'directa_perimetro', 'directa_area', 'area_por_espesor', 'longitud_por_altura', 'longitud_por_altura_por_espesor', 'longitud_por_seccion', 'directa_volumen', 'conteo']) assert.ok(REGLAS[r], r);
  const med = { unidades: { conversion: 'aplicada', factor_a_metros: 1, confirmadas: 'm' }, mediciones: [{ id: 1, capa: 'P', magnitud: 'perimetro', valor: 20, estado: 'ok' }] };
  const q = computeQuantity({ medicion: med, archivo: 'x', capas: ['P'], regla: 'perimetro_por_altura', parametros: { altura_m: 2.4 } }); close(q.cantidad, 48); assert.equal(q.unidad, 'm2'); close(computeQuantity({ medicion: med, archivo: 'x', capas: ['P'], regla: 'perimetro_por_altura_por_espesor', parametros: { altura_m: 2.4, espesor_m: 0.2 } }).cantidad, 9.6);
  assert.throws(() => computeQuantity({ medicion: med, archivo: 'x', capas: ['P'], regla: 'perimetro_por_altura', parametros: {} }), (e) => e.code === 'FALTA_DATO');
  // presupuesto: manual + contraste con el motor existente computeBudget (implementación independiente)
  const items = [{ codigo: 'E-1', descripcion: 'Excavación', unidad: 'm3', cantidad: Mv(7257.6, 'm3'), precio_unitario: 4500, fuente_precio: 'cotización A', fecha_precio: '2026-11-01' }, { codigo: 'C-1', descripcion: 'Compactación', unidad: 'm2', cantidad: Mv(3600, 'm2'), precio_unitario: 1200, fuente_precio: 'cotización B', fecha_precio: '2026-11-01' }];
  const r = run('bud.rollup', { items: { value: items, unit: null }, gastos_generales_pct: Mv(10, '%'), utilidades_pct: Mv(8, '%'), iva_pct: Mv(19, '%') });
  assert.deepEqual(r.outputs.subtotales.value, [32659200, 4320000]); assert.equal(r.outputs.costo_directo.value, 36979200); assert.equal(r.outputs.gastos_generales.value, 3697920); assert.equal(r.outputs.utilidades.value, 2958336); assert.equal(r.outputs.neto.value, 43635456); assert.equal(r.outputs.iva.value, 8290737); assert.equal(r.outputs.total.value, 51926193);
  const cb = computeBudget({ partidas: items.map((i) => ({ codigo: i.codigo, descripcion: i.descripcion, unidad: i.unidad, cantidad: i.cantidad.value, apu: i.codigo, estado_revision: 'borrador', cantidad_verificada: false })), apus: items.map((i) => ({ codigo: i.codigo, unidad: i.unidad, insumos: [{ tipo: 'material', descripcion: 'x', cantidad: 1, precio_unitario: i.precio_unitario, fuente_precio: i.fuente_precio, fecha_precio: i.fecha_precio }] })), config: { gastos_generales_pct: 10, utilidades_pct: 8, iva_pct: 19 } });
  const tot = cb.totales ?? cb; assert.ok(JSON.stringify(cb).includes('51926193'), 'el motor de presupuesto existente coincide con bud.rollup');
  throwsCode(() => run('bud.rollup', { items: { value: [{ ...items[0], precio_unitario: null }], unit: null }, gastos_generales_pct: Mv(0, '%'), utilidades_pct: Mv(0, '%'), iva_pct: Mv(19, '%') }), 'ENTRADA_FALTANTE');
  throwsCode(() => run('bud.rollup', { items: { value: [{ ...items[0], fuente_precio: '' }], unit: null }, gastos_generales_pct: Mv(0, '%'), utilidades_pct: Mv(0, '%'), iva_pct: Mv(19, '%') }), 'ENTRADA_FALTANTE');
  throwsCode(() => run('bud.rollup', { items: { value: [{ ...items[0], unidad: 'm2' }], unit: null }, gastos_generales_pct: Mv(0, '%'), utilidades_pct: Mv(0, '%'), iva_pct: Mv(19, '%') }), 'DIMENSION_INCOMPATIBLE');
  throwsCode(() => run('bud.rollup', { items: { value: items, unit: null }, gastos_generales_pct: Mv(0, '%'), utilidades_pct: Mv(0, '%') }), 'ENTRADA_FALTANTE'); // sin IVA explícito
  // duración
  close(run('sched.duration', { cantidad: Mv(7257.6, 'm3'), rendimiento_diario: Mv(800, 'm3'), cuadrillas: Mv(1) }).outputs.duracion.value, 9.072); assert.equal(run('sched.duration', { cantidad: Mv(7257.6, 'm3'), rendimiento_diario: Mv(800, 'm3'), cuadrillas: Mv(1) }).outputs.duracion_dias_enteros.value, 10);
  throwsCode(() => run('sched.duration', { cantidad: Mv(10, 'm3'), rendimiento_diario: Mv(5, 'm2'), cuadrillas: Mv(1) }), 'DIMENSION_INCOMPATIBLE');
});

test('CPM contra red de libro y enumeración independiente de caminos; ciclos; curva S y valor ganado con solución cerrada', () => {
  const A = [{ id: 'A', duracion: 3 }, { id: 'B', duracion: 4, predecesoras: ['A'] }, { id: 'C', duracion: 2, predecesoras: ['A'] }, { id: 'D', duracion: 5, predecesoras: ['B', 'C'] }, { id: 'E', duracion: 1, predecesoras: ['C'] }];
  const r = run('sched.cpm', { actividades: { value: A, unit: null } }); assert.equal(r.outputs.duracion_proyecto.value, 12); assert.equal(r.outputs.ruta_critica.value, 'A > B > D'); assert.deepEqual(r.outputs.holgura_total.value, [0, 0, 2, 0, 6]); assert.deepEqual(r.outputs.es.value, [0, 3, 3, 7, 5]); assert.deepEqual(r.outputs.lf.value, [3, 7, 7, 12, 12]);
  // oráculo independiente: camino más largo por enumeración
  const dur = Object.fromEntries(A.map((a) => [a.id, a.duracion])); const suc = { A: ['B', 'C'], B: ['D'], C: ['D', 'E'], D: [], E: [] }; const largo = (n) => dur[n] + Math.max(0, ...suc[n].map(largo)); close(largo('A'), 12);
  throwsCode(() => run('sched.cpm', { actividades: { value: [{ id: 'X', duracion: 1, predecesoras: ['Y'] }, { id: 'Y', duracion: 1, predecesoras: ['X'] }], unit: null } }), 'CYCLE'); throwsCode(() => run('sched.cpm', { actividades: { value: [{ id: 'X', duracion: 1, predecesoras: ['Z'] }], unit: null } }), 'INVALID_INPUT'); throwsCode(() => run('sched.cpm', { actividades: { value: [{ id: 'X', duracion: -1 }], unit: null } }), 'INVALID_INPUT');
  const s = run('sched.scurve', { actividades: { value: [{ id: 'a', inicio: 0, duracion: 10, costo: 1000 }, { id: 'b', inicio: 10, duracion: 10, costo: 3000 }], unit: null }, periodo: Mv(5, 'd') }); assert.deepEqual(s.outputs.tiempos.value, [0, 5, 10, 15, 20]); assert.deepEqual(s.outputs.acumulado.value, [0, 500, 1000, 2500, 4000]); close(s.outputs.costo_total.value, 4000); close(s.outputs.acumulado_pct.value.at(-1), 100);
  const e = run('sched.evm', { bac: Mv(100000), pv: Mv(40000), ev: Mv(30000), ac: Mv(36000) }); close(e.outputs.cpi.value, 30000 / 36000); close(e.outputs.spi.value, 0.75); assert.equal(e.outputs.cv.value, -6000); assert.equal(e.outputs.sv.value, -10000); close(e.outputs.eac.value, 120000); close(e.outputs.vac.value, -20000); close(e.outputs.etc.value, 84000);
  throwsCode(() => run('sched.evm', { bac: Mv(100000), pv: Mv(0), ev: Mv(1), ac: Mv(1) }), 'INVALID_INPUT');
});

const ARGS = (P, N) => ({ proyecto: P, caso: N, accion: 'generar_lineal', nombre: 'canal', titulo: 'Canal revestido', tramos: [{ type: 'straight', length: 1200 }], inicio: { x: 0, y: 0, azimut_deg: 0, progresiva: 0 }, secciones: [{ progresiva: 0, nombre: 'S1', tipo: 'trapecio', base: 3, talud_h_por_v: 1.5, altura: 1.2 }] });
const interp = (claimArea, claimLargo, ancho = 3) => ({
  schema: 'tw.cic.interpretation/1', mode: 'professional', restatement: 'Canal de riego revestido: cubicación de excavación y compactación, presupuesto con precios aportados y programa de obra.', intents: [{ kind: 'compute', text: 'cantidades' }, { kind: 'plan', text: 'programa' }],
  disciplines_proposed: [{ tag: 'hidráulica de canales' }], deliverables: [{ id: 'd1', kind: 'presupuesto', status: 'confirmed' }, { id: 'd2', kind: 'programa', status: 'confirmed' }],
  magnitudes: [{ name: 'ancho_base', value: ancho, unit: 'm', origin: 'user' }, { name: 'perdida_excavacion', value: 5, unit: '%', origin: 'user' }, { name: 'gg', value: 10, unit: '%', origin: 'user' }, { name: 'util', value: 8, unit: '%', origin: 'user' }, { name: 'iva', value: 19, unit: '%', origin: 'user' }, { name: 'rend_exc', value: 800, unit: 'm3', origin: 'user' }, { name: 'rend_comp', value: 1500, unit: 'm2', origin: 'user' }, { name: 'cuadrillas', value: 1, unit: '1', origin: 'user' }, { name: 'dias_recepcion', value: 2, unit: 'd', origin: 'user' }, { name: 'pu_exc', value: 4500, unit: 'CLP', origin: 'user' }, { name: 'pu_comp', value: 1200, unit: 'CLP', origin: 'user' }, { name: 'bac_pv', value: 20000000, unit: 'CLP', origin: 'user' }, { name: 'pv', value: 20000000, unit: 'CLP', origin: 'user' }, { name: 'ev', value: 18000000, unit: 'CLP', origin: 'user' }, { name: 'ac', value: 21000000, unit: 'CLP', origin: 'user' }],
  unknowns: [{ what: 'Diseño hidráulico del canal (caudal, pendiente, velocidad)', blocks: [], resolution: 'external_professional' }],
  proposed_steps: [
    { id: 's1', goal: 'Volumen de excavación', capability_id: 'op.geo.solid.extrude', inputs: { area: { ref: `claim:${claimArea}` }, length: { ref: `claim:${claimLargo}` }, section_plane: { value: 'normal_to_path', unit: null } } },
    { id: 's2', goal: 'Excavación con pérdida declarada', capability_id: 'op.qty.apply_loss', inputs: { cantidad: { ref: 'step:s1.volume' }, perdida_pct: { ref: 'magnitude:perdida_excavacion' } } },
    { id: 's3', goal: 'Compactación de fondo', capability_id: 'op.qty.product', inputs: { base: { ref: 'magnitude:ancho_base' }, factor: { ref: `claim:${claimLargo}` } } },
    { id: 's4', goal: 'Presupuesto', capability_id: 'op.bud.rollup', inputs: { items: { value: [{ codigo: 'E-1', descripcion: 'Excavación', unidad: 'm3', cantidad: { ref: 'step:s2.cantidad_con_perdida', as: 'quantity' }, precio_unitario: { ref: 'magnitude:pu_exc' }, fuente_precio: 'cotización A (aportada)', fecha_precio: '2026-11-01' }, { codigo: 'C-1', descripcion: 'Compactación', unidad: 'm2', cantidad: { ref: 'step:s3.cantidad', as: 'quantity' }, precio_unitario: { ref: 'magnitude:pu_comp' }, fuente_precio: 'cotización B (aportada)', fecha_precio: '2026-11-01' }], unit: null }, gastos_generales_pct: { ref: 'magnitude:gg' }, utilidades_pct: { ref: 'magnitude:util' }, iva_pct: { ref: 'magnitude:iva' } } },
    { id: 's5', goal: 'Duración de la excavación', capability_id: 'op.sched.duration', inputs: { cantidad: { ref: 'step:s2.cantidad_con_perdida' }, rendimiento_diario: { ref: 'magnitude:rend_exc' }, cuadrillas: { ref: 'magnitude:cuadrillas' } } },
    { id: 's6', goal: 'Duración de la compactación', capability_id: 'op.sched.duration', inputs: { cantidad: { ref: 'step:s3.cantidad' }, rendimiento_diario: { ref: 'magnitude:rend_comp' }, cuadrillas: { ref: 'magnitude:cuadrillas' } } },
    { id: 's7', goal: 'Ruta crítica', capability_id: 'op.sched.cpm', inputs: { actividades: { value: [{ id: 'A', descripcion: 'Excavación', duracion: { ref: 'step:s5.duracion_dias_enteros' }, predecesoras: [] }, { id: 'B', descripcion: 'Compactación', duracion: { ref: 'step:s6.duracion_dias_enteros' }, predecesoras: ['A'] }, { id: 'C', descripcion: 'Recepción', duracion: { ref: 'magnitude:dias_recepcion' }, predecesoras: ['B'] }], unit: null } } },
    { id: 's8', goal: 'Curva S', capability_id: 'op.sched.scurve', inputs: { actividades: { value: [{ id: 'A', inicio: { ref: 'step:s7.es[0]' }, duracion: { ref: 'step:s5.duracion_dias_enteros' }, costo: { ref: 'step:s4.subtotales[0]' } }, { id: 'B', inicio: { ref: 'step:s7.es[1]' }, duracion: { ref: 'step:s6.duracion_dias_enteros' }, costo: { ref: 'step:s4.subtotales[1]' } }], unit: null }, periodo: { value: 5, unit: 'd' } } },
    { id: 's9', goal: 'Valor ganado al corte', capability_id: 'op.sched.evm', inputs: { bac: { ref: 'step:s4.neto' }, pv: { ref: 'magnitude:pv' }, ev: { ref: 'magnitude:ev' }, ac: { ref: 'magnitude:ac' } } },
    { id: 's10', goal: 'Diseñar el canal', capability_id: null, inputs: {} },
  ],
});
const val = (cl, goal, out) => cl.find((x) => x.texto.includes(goal) && x.texto.endsWith(`→ ${out}`)).valor;

test('Caso D: plano → cantidad → partidas → presupuesto → programa → informe sin transcripción manual; cambio de un dato deja todo desactualizado y se recalcula', async () => {
  const home = tmpHome('Tannia ñ g6 '); const { client: c, close: cerrar } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Canal Riego'; const N = 'Canal ñ';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P });
    let g = await call(c, 'tannia_cic_geometria', ARGS(P, N)); assert.ok(!g.isError, JSON.stringify(g.content).slice(0, 300)); const dxfRel = data(g).archivo;
    // el plano (DXF guardado) es la fuente de las cantidades: se mide el archivo, no se teclea nada
    const mA = data(await call(c, 'tannia_cic_geometria', { proyecto: P, caso: N, accion: 'medir_dxf', ruta: dxfRel.replace(/^/, ''), capas: ['SECCION'], magnitud: 'area', unidad_confirmada: 'm', etiqueta: 'Área de la sección' })); const mL = data(await call(c, 'tannia_cic_geometria', { proyecto: P, caso: N, accion: 'medir_dxf', ruta: dxfRel, capas: ['EJE'], magnitud: 'longitud', unidad_confirmada: 'm', etiqueta: 'Largo del eje' }));
    close(mA.valor, 5.76); close(mL.valor, 1200); let sinU = await call(c, 'tannia_cic_geometria', { proyecto: P, caso: N, accion: 'medir_dxf', ruta: dxfRel, capas: ['EJE'], magnitud: 'longitud' }); assert.equal(data(sinU).error, 'UNIDAD_NO_CONFIRMADA');
    let r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso: N, interpretacion: interp(mA.claim_id, mL.claim_id) }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 500)); assert.equal(data(r).resultado, 'accepted_with_gaps');
    let ej = data(await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N })); assert.equal(ej.fallidos.length, 0, JSON.stringify(ej.fallidos)); assert.deepEqual(ej.ejecutados.map((x) => x.id), ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9']);
    let cl = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N, tipo: 'calculation' })).claims;
    close(val(cl, 'Volumen de excavación', 'volume'), 6912); close(val(cl, 'Excavación con pérdida', 'cantidad_con_perdida'), 7257.6); close(val(cl, 'Compactación de fondo', 'cantidad'), 3600);
    assert.deepEqual(cl.find((x) => x.texto.includes('Presupuesto') && x.texto.endsWith('→ subtotales')).valor, [32659200, 4320000]); assert.equal(val(cl, 'Presupuesto', 'total'), 51926193);
    assert.equal(val(cl, 'Duración de la excavación', 'duracion_dias_enteros'), 10); assert.equal(val(cl, 'Duración de la compactación', 'duracion_dias_enteros'), 3); assert.equal(val(cl, 'Ruta crítica', 'duracion_proyecto'), 15); assert.equal(val(cl, 'Ruta crítica', 'ruta_critica'), 'A > B > C');
    close(val(cl, 'Curva S', 'costo_total'), 36979200); close(val(cl, 'Valor ganado', 'cpi'), 18000000 / 21000000);
    // entregables editables: memoria + planilla con fórmulas de presupuesto + programa
    let en = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N }); assert.ok(!en.isError, JSON.stringify(en.content).slice(0, 500)); const arch = data(en).archivos; const abs = (a) => path.join(home, 'Proyectos', P, a.ruta);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(abs(arch[2])); assert.deepEqual(wb.worksheets.map((w) => w.name), ['Cantidades', 'Datos y supuestos', 'Pendientes', 'Fuentes', 'Presupuesto', 'Programa', 'Curva S', 'Valor ganado']);
    const wp = wb.getWorksheet('Presupuesto'); const fila = (ws, txt) => { let out = null; ws.eachRow((rw) => { if (String(rw.getCell(1).value) === txt) out = rw; }); return out; };
    const e1 = fila(wp, 'E-1'); assert.equal(e1.getCell(6).value.formula, `ROUND(D${e1.number}*E${e1.number},0)`); assert.equal(e1.getCell(6).value.result, 32659200); close(e1.getCell(4).value, 7257.6); assert.equal(e1.getCell(5).value, 4500);
    const tot = fila(wp, 'TOTAL'); assert.equal(tot.getCell(6).value.result, 51926193); assert.match(tot.getCell(6).value.formula, /^F\d+\+F\d+$/); assert.equal(fila(wp, 'Costo directo').getCell(6).value.formula, `SUM(F${e1.number}:F${e1.number + 1})`);
    const wpr = wb.getWorksheet('Programa'); assert.equal(fila(wpr, 'A').getCell(10).value, 'sí'); assert.equal(fila(wpr, 'Ruta crítica').getCell(3).value, 'A > B > C'); assert.equal(wb.getWorksheet('Curva S').rowCount, 1 + data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N, tipo: 'calculation' })).claims.find((x) => x.texto.endsWith('→ tiempos')).valor.length);
    // coherencia PDF ↔ claims
    const caso = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', N, `v${String(JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', N, 'historial.json'), 'utf8')).versiones.length).padStart(3, '0')}.json`), 'utf8'));
    const txt = (await extraerPdf(fs.readFileSync(abs(arch[1])))).map((p) => p.text).join('\n'); assert.ok(verificarEntregable({ texto: txt }, { claims: new Ledger(caso.claims), valoresEntrada: caso.magnitudes.map((m) => ({ value: m.value, unit: m.unit })) }).ok);
    assert.match(fs.readFileSync(abs(arch[0]), 'utf8'), /Diseñar el canal|Diseñar/); assert.match(fs.readFileSync(abs(arch[0]), 'utf8'), /Sujeto a revisión por profesional competente/);
    // ---- CAMBIO DE UN DATO: ancho de base 3 → 4 m ----
    const antes = fs.readdirSync(path.dirname(abs(arch[0]))).length;
    r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso: N, interpretacion: interp(mA.claim_id, mL.claim_id, 4) }); assert.equal(data(r).resultado, 'needs_confirmation', 'cambiar un dato fijado pide confirmación'); r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso: N, interpretacion: interp(mA.claim_id, mL.claim_id, 4), confirmar_cambios: ['ancho_base'] }); assert.ok(!r.isError); const pl = data(await call(c, 'tannia_cic_plan', { proyecto: P, caso: N })).plan.pasos; const est = Object.fromEntries(pl.map((s) => [s.id, s.estado]));
    assert.deepEqual([est.s1, est.s2], ['done', 'done'], 'lo independiente del dato no se recalcula'); for (const s of ['s3', 's4', 's6', 's7', 's8', 's9']) assert.equal(est[s], 'stale', s); // s5 (excavación) no depende del ancho
    const bloq = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N }); assert.equal(bloq.isError, true); assert.equal(data(bloq).error, 'BASE_DESACTUALIZADA'); assert.equal(fs.readdirSync(path.dirname(abs(arch[0]))).length, antes, 'no se generó nada');
    const ver = data(await call(c, 'tannia_cic_verificar', { proyecto: P, caso: N, texto: 'El presupuesto total es 51.926.193 CLP.' })); assert.equal(ver.ok, false); // base desactualizada: el total anterior ya no respalda cifras
    ej = data(await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N })); assert.equal(ej.fallidos.length, 0); assert.ok(ej.recalculados.includes('s3') && ej.recalculados.includes('s4'));
    cl = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N, tipo: 'calculation', estado: 'computed' })).claims; close(val(cl, 'Compactación de fondo', 'cantidad'), 4800);
    // nuevo presupuesto manual: compactación 4800 m2 × 1200 = 5.760.000; CD = 32.659.200 + 5.760.000 = 38.419.200; GG 3.841.920; U 3.073.536; neto 45.334.656; IVA 8.613.585 (45.334.656×0,19 = 8.613.584,64); total 53.948.241
    assert.equal(val(cl, 'Presupuesto', 'total'), 53948241); assert.equal(val(cl, 'Ruta crítica', 'duracion_proyecto'), 10 + 4 + 2);
    en = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N }); assert.ok(!en.isError, JSON.stringify(en.content).slice(0, 300));
    const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.readFile(abs(data(en).archivos[2])); assert.equal(fila(wb2.getWorksheet('Presupuesto'), 'TOTAL').getCell(6).value.result, 53948241);
    const ver2 = data(await call(c, 'tannia_cic_verificar', { proyecto: P, caso: N, texto: 'El presupuesto total es 53.948.241 CLP.', slots: [] })); assert.equal(ver2.ok, true, JSON.stringify(ver2));
    // el plano y la versión anterior siguen íntegros (versiones inmutables)
    const v1 = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N, version: 'v007' })); assert.ok(v1.claims.length > 0);
  } finally { await cerrar(); }
});
