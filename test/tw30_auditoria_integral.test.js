// Auditoría integral 2026-11-17 (continuidad de Astra): regresiones de defectos REPRODUCIDOS antes de corregirlos.
//  A) Moneda tratada como adimensional: CLP→USD 1:1, CLP→% y UF+CLP se aceptaban.
//  B) bud.rollup (CIC) y computeBudget/XLSX difieren con precios unitarios con decimales (PU redondeado vs. no redondeado).
//  C) Memoria PDF: el pie a y=800 sobrepasaba el margen inferior y PDFKit agregaba una página casi vacía (UAT-01).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../src/cic/units.js';
import { ejecutarOperacion as run } from '../src/cic/ops/index.js';
import { computeBudget, rubros } from '../src/budget/calc.js';
import { buildMemoriaPdf } from '../src/report/memoria.js';

const code = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };

test('A: la moneda es una dimensión propia; no hay conversión implícita CLP↔USD↔UF ni moneda↔adimensional', () => {
  assert.equal(code(() => U.aUnidad(U.mag(1000, 'CLP'), 'USD')), 'DIMENSION_INCOMPATIBLE');
  assert.equal(code(() => U.aUnidad(U.mag(1000, 'CLP'), '%')), 'DIMENSION_INCOMPATIBLE');
  assert.equal(code(() => U.aUnidad(U.mag(1000, 'CLP'), '1')), 'DIMENSION_INCOMPATIBLE');
  assert.equal(code(() => U.sumar(U.mag(1, 'UF'), U.mag(1, 'CLP'))), 'DIMENSION_INCOMPATIBLE');
  assert.equal(code(() => U.normalizar(5, 'USD/m2', 'CLP/m2')), 'DIMENSION_INCOMPATIBLE');
  // Análisis dimensional correcto: (CLP/m2)·m2 = CLP; adimensionales siguen funcionando sin unidad artificial.
  assert.equal(U.aUnidad(U.multiplicar(U.mag(8000, 'CLP/m2'), U.mag(10, 'm2')), 'CLP'), 80000);
  assert.equal(U.aUnidad(U.mag(19, '%'), '1'), 0.19);
  assert.equal(U.dimDe('CLP/m3'), 'L-3·CLP');
});

test('A: convertirMoneda exige tasa explícita, positiva, con fuente y fecha, y en el sentido correcto', () => {
  assert.equal(code(() => U.convertirMoneda(1, 'CLP', 'USD')), 'TASA_REQUERIDA');
  assert.equal(code(() => U.convertirMoneda(1, 'CLP', 'USD', { valor: 0 })), 'TASA_REQUERIDA');
  assert.equal(code(() => U.convertirMoneda(1, 'UF', 'CLP', { valor: 39000 })), 'TASA_SIN_RESPALDO');
  assert.equal(code(() => U.convertirMoneda(1, 'UF', 'CLP', { valor: 39000, fuente: 'x', fecha: 'y', desde: 'CLP', hacia: 'UF' })), 'TASA_INCONSISTENTE');
  assert.equal(code(() => U.convertirMoneda(1, 'EUR', 'CLP', { valor: 1, fuente: 'x', fecha: 'y' })), 'MONEDA_DESCONOCIDA');
  const r = U.convertirMoneda(2, 'UF', 'CLP', { valor: 39000, fuente: 'SII (aportada)', fecha: '2026-11-17' });
  assert.equal(r.valor, 78000); assert.equal(r.moneda, 'CLP'); assert.equal(r.tasa.fuente, 'SII (aportada)');
  assert.deepEqual(U.convertirMoneda(5, 'CLP', 'CLP'), { valor: 5, moneda: 'CLP', tasa: null });
});

test('A: operaciones CIC rechazan monedas mezcladas y rotulan la salida con la moneda de entrada (sin CLP fijo)', () => {
  assert.equal(code(() => run('sched.evm', { bac: { value: 100, unit: 'CLP' }, pv: { value: 50, unit: 'USD' }, ev: { value: 40, unit: 'CLP' }, ac: { value: 45, unit: 'CLP' } })), 'MONEDAS_MEZCLADAS');
  const r = run('sched.evm', { bac: { value: 100, unit: 'UF' }, pv: { value: 50, unit: 'UF' }, ev: { value: 40, unit: 'UF' }, ac: { value: 50, unit: 'UF' } });
  assert.equal(r.outputs.eac.unit, 'UF'); assert.equal(r.outputs.cpi.unit, '1'); assert.equal(r.outputs.eac.value, 125);
  // Magnitudes adimensionales NO exigen unidad artificial.
  const s = run('sched.evm', { bac: { value: 100 }, pv: { value: 50 }, ev: { value: 40 }, ac: { value: 50 } });
  assert.equal(s.outputs.cpi.value, 0.8);
});

test('B: bud.rollup, computeBudget y la política del XLSX coinciden en 2.000 presupuestos aleatorios con decimales', () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2000; k++) {
    const n = 1 + Math.floor(rnd() * 4); const items = [];
    for (let i = 0; i < n; i++) items.push({ codigo: 'P' + i, descripcion: 'x', unidad: 'm2', cantidad: { value: Math.round(rnd() * 100000) / 100, unit: 'm2' }, precio_unitario: Math.round(rnd() * 2000000) / 100, fuente_precio: 'f', fecha_precio: '2026-01-01' });
    const g = Math.floor(rnd() * 30); const u = Math.floor(rnd() * 20); const iva = [0, 19][Math.floor(rnd() * 2)];
    const r = run('bud.rollup', { items: { value: items, unit: null }, gastos_generales_pct: { value: g, unit: '%' }, utilidades_pct: { value: u, unit: '%' }, iva_pct: { value: iva, unit: '%' } });
    const cb = computeBudget({ partidas: items.map((i) => ({ codigo: i.codigo, descripcion: 'x', unidad: 'm2', cantidad: i.cantidad.value, apu: i.codigo, cantidad_verificada: true })), apus: items.map((i) => ({ codigo: i.codigo, unidad: 'm2', insumos: [{ tipo: 'material', descripcion: 'x', cantidad: 1, precio_unitario: i.precio_unitario, fuente_precio: 'f', fecha_precio: 'x' }] })), config: { gastos_generales_pct: g, utilidades_pct: u, iva_pct: iva } });
    for (const k2 of ['costo_directo', 'gastos_generales', 'utilidades', 'neto', 'iva', 'total']) assert.equal(r.outputs[k2].value, cb[k2], `caso ${k}: ${k2}`);
  }
});

test('B: UAT-01 se conserva exactamente (10 m² × $8.000, GG 10 %, U 5 %, IVA 19 % = $109.480)', () => {
  assert.deepEqual(rubros(80000, { gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 }), { costo_directo: 80000, gastos_generales: 8000, utilidades: 4000, neto: 92000, iva: 17480, total: 109480 });
});

test('C: la memoria PDF de UAT-01 tiene exactamente las páginas con contenido (sin hoja final vacía)', async () => {
  const partidas = [{ codigo: 'M1', descripcion: 'Muro', unidad: 'm2', cantidad: 10, cantidad_verificada: true, estado_revision: 'verificada', apu: 'A1' }];
  const apus = [{ codigo: 'A1', unidad: 'm2', insumos: [{ tipo: 'material', descripcion: 'x', cantidad: 1, precio_unitario: 8000, fuente_precio: 'f', fecha_precio: '2026-11-01' }] }];
  const B = computeBudget({ partidas, apus, config: { gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 } });
  const buf = await buildMemoriaPdf({ proyecto: 'UAT01', generado: '2026-11-17', revision: 'R6', partidas, presupuesto: B, archivos: [], advertencias: [], estado_documento: 'candidato' });
  const n = (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  assert.equal(n, 1, 'una sola página para UAT-01');
  assert.equal(B.total, 109480);
});

// Cambio de decisión (TW-PRO-E2E G07, C-06, NEG-10): un precio con más de 12 meses sigue sin reescribirse y el cálculo se muestra,
// pero ahora es REFERENCIAL: bloquea el estado final y la etiqueta lo dice (antes solo se advertía).
test('UAT-02: un presupuesto parcial se rotula como tal; los precios con más de 12 meses se advierten, no se reescriben y son referenciales (sin estado final)', () => {
  const partidas = [{ codigo: 'F1', descripcion: 'Pernos', unidad: 'u', cantidad: 1010, apu: 'P', cantidad_verificada: true }];
  const apus = [{ codigo: 'P', unidad: 'u', insumos: [{ tipo: 'material', descripcion: 'perno', cantidad: 1, precio_unitario: 25000, fuente_precio: 'APU histórico CODELCO', fecha_precio: '2019-01-15' }] }];
  const cfg = { gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19, fecha_referencia_precios: '2026-11-17' };
  const parcial = computeBudget({ partidas, apus, config: { ...cfg, alcance: 'parcial', alcance_descripcion: 'solo fortificación' } });
  assert.match(parcial.etiqueta_total, /PRESUPUESTO PARCIAL \(solo fortificación\): no es el costo total/); assert.match(parcial.etiqueta_total, /PRECIOS HISTÓRICOS/); assert.equal(parcial.estado_final_posible, false);
  assert.ok(parcial.advertencias.some((a) => /2019-01-15.*7 año\(s\).*No es un precio vigente/.test(a)), parcial.advertencias.join(' | '));
  assert.equal(parcial.total, 34_554_625); // oráculo: 1010×25.000=25.250.000; +10 %+5 % = 29.037.500; IVA 19 % = 5.517.125
  const sinAlcance = computeBudget({ partidas, apus: [{ ...apus[0], insumos: [{ ...apus[0].insumos[0], fecha_precio: '2026-10-01' }] }], config: cfg });
  assert.equal(sinAlcance.alcance, 'no_declarado'); assert.equal(sinAlcance.etiqueta_total, 'TOTAL (alcance no declarado)'); // revisión PR #30: el alcance desconocido se rotula, no se presenta como total de obra
  assert.ok(sinAlcance.advertencias.some((a) => /Alcance del presupuesto no declarado/.test(a)));
  assert.ok(!sinAlcance.advertencias.some((a) => /vigente/.test(a)));
  assert.equal(computeBudget({ partidas, apus: [{ ...apus[0], insumos: [{ ...apus[0].insumos[0], fecha_precio: '2026-10-01' }] }], config: { ...cfg, alcance: 'completo' } }).etiqueta_total, 'TOTAL DE LA OBRA');
});
