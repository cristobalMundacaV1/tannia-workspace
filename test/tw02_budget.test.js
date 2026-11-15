import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { parseDxf } from '../src/dxf/reader.js';
import { measureDxf } from '../src/dxf/measure.js';
import { computeQuantity } from '../src/quantities/engine.js';
import { computeBudget, round0, apuUnitCost, validateApu } from '../src/budget/calc.js';
import { buildBudgetWorkbook } from '../src/budget/xlsx.js';
import { FIX } from './helpers.js';

// Precios FICTICIOS marcados TEST: solo para verificar aritmética. No son referencias de mercado.
const src = { fuente_precio: 'TEST-ficticio', fecha_precio: '2026-01-01' };
const apus = [
  { codigo: 'A1', descripcion: 'Radier (EJEMPLO TEST)', unidad: 'm3', insumos: [
    { tipo: 'material', descripcion: 'Cemento', unidad: 'kg', cantidad: 7.5, precio_unitario: 100, ...src },
    { tipo: 'material', descripcion: 'Arena', unidad: 'm3', cantidad: 0.5, precio_unitario: 200, ...src },
    { tipo: 'mano_obra', descripcion: 'Cuadrilla', unidad: 'jornada', rendimiento: 4, cuadrilla: 2, precio_unitario: 30000, ...src }] },
  { codigo: 'A2', descripcion: 'Pintura (EJEMPLO TEST)', unidad: 'm2', insumos: [
    { tipo: 'material', descripcion: 'Pintura', unidad: 'l', cantidad: 0.25, precio_unitario: 1000, ...src },
    { tipo: 'mano_obra', descripcion: 'Pintor', unidad: 'jornada', rendimiento: 20, precio_unitario: 40000, ...src }] },
];
const partidas = (verified = true) => [
  { codigo: '1', descripcion: 'Radier', unidad: 'm3', cantidad: 12.345, apu: 'A1', estado_revision: 'borrador', cantidad_verificada: verified, formula: 'manual' },
  { codigo: '2', descripcion: 'Pintura', unidad: 'm2', cantidad: 100.5, apu: 'A2', estado_revision: 'borrador', cantidad_verificada: verified },
];
const config = { gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 };

test('APU y presupuesto: valores calculados a mano', () => {
  assert.equal(apuUnitCost(apus[0]).costo_unitario, 15850);
  assert.equal(apuUnitCost(apus[1]).costo_unitario, 2250);
  const B = computeBudget({ partidas: partidas(), apus, config });
  assert.deepEqual([B.lineas[0].total, B.lineas[1].total], [195668, 226125]);
  assert.equal(B.costo_directo, 421793);
  assert.deepEqual([B.gastos_generales, B.utilidades, B.neto, B.iva, B.total], [42179, 21090, 485062, 92162, 577224]);
  assert.equal(B.estado_final_posible, true);
  assert.equal(round0(2.5), 3); assert.equal(round0(-2.5), -3); assert.equal(round0(0.49999), 0);
});

test('bloqueos: precio faltante, cantidad no verificada, unidad distinta, sin APU', () => {
  const sinPrecio = structuredClone(apus); sinPrecio[1].insumos[0].precio_unitario = null;
  let B = computeBudget({ partidas: partidas(), apus: sinPrecio, config });
  assert.equal(B.estado_final_posible, false); assert.equal(B.parcial, true);
  assert.ok(B.bloqueos.some((b) => /FALTA PRECIO/.test(b)));
  assert.equal(B.lineas[1].total, null);
  B = computeBudget({ partidas: partidas(false), apus, config });
  assert.equal(B.estado_final_posible, false);
  const mal = partidas(); mal[1].unidad = 'm3';
  B = computeBudget({ partidas: mal, apus, config });
  assert.ok(B.bloqueos.some((b) => /unidad de partida/.test(b))); assert.equal(B.lineas[1].total, null);
  B = computeBudget({ partidas: [{ ...partidas()[0], apu: 'X' }], apus, config });
  assert.ok(B.bloqueos.some((b) => /sin APU/.test(b)));
  const sinFuente = structuredClone(apus); delete sinFuente[0].insumos[0].fecha_precio;
  assert.ok(validateApu(sinFuente[0]).some((p) => /sin fuente o fecha/.test(p)));
  assert.throws(() => computeBudget({ partidas: partidas(), apus, config: { iva_pct: 150 } }), /iva_pct/);
});

test('XLSX: fórmulas presentes, archivo reabrible y recalculado por LibreOffice == cálculo JS', { timeout: 120000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx ñ '));
  const f = path.join(dir, 'p.xlsx');
  // SIN caché: LibreOffice debe calcular todo por sí mismo (oráculo independiente).
  const { workbook, budget } = await buildBudgetWorkbook({ proyecto: 'Prueba', partidas: partidas(), apus, config, cache: false });
  await workbook.xlsx.writeFile(f);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['Parametros', 'APU', 'Presupuesto', 'Cubicacion', 'Alertas']);
  const pres = wb.getWorksheet('Presupuesto');
  assert.ok(pres.getCell('F5').value.formula, 'total de partida es fórmula');
  const out = path.join(dir, 'recalc'); fs.mkdirSync(out);
  try { execFileSync('soffice', ['--headless', '--convert-to', 'xlsx', '--outdir', out, f], { stdio: 'pipe', timeout: 100000 }); }
  catch (e) { if (e.code === 'ENOENT') return; throw e; }
  const wr = new ExcelJS.Workbook(); await wr.xlsx.readFile(path.join(out, 'p.xlsx'));
  const rp = wr.getWorksheet('Presupuesto');
  const v = (a) => { const c = rp.getCell(a).value; return c && typeof c === 'object' && 'result' in c ? c.result : c; };
  assert.equal(v('E5'), 15850); assert.equal(v('F5'), 195668); assert.equal(v('F6'), 226125);
  const rows = {}; rp.eachRow((row) => { const l = row.getCell(2).value; if (typeof l === 'string') rows[l] = v(`F${row.number}`); });
  assert.equal(rows['Costo directo'], budget.costo_directo); assert.equal(rows['Gastos generales'], budget.gastos_generales);
  assert.equal(rows.Utilidades, budget.utilidades); assert.equal(rows.IVA, budget.iva); assert.equal(rows.TOTAL, budget.total);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('XLSX borrador con pendientes: marca PENDIENTE y no entrega total final', async () => {
  const sp = structuredClone(apus); sp[1].insumos[0].precio_unitario = null;
  const { workbook, budget } = await buildBudgetWorkbook({ proyecto: 'X', partidas: partidas(false), apus: sp, config });
  const ws = workbook.getWorksheet('Presupuesto');
  assert.match(ws.getCell('A2').value, /BORRADOR/);
  assert.equal(ws.getCell('F6').value, 'PENDIENTE');
  assert.equal(budget.estado_final_posible, false);
  const buf = await workbook.xlsx.writeBuffer(); assert.ok(buf.byteLength > 2000);
});

const med = (n, u = 'm') => measureDxf(parseDxf(fs.readFileSync(path.join(FIX, 'dxf', `${n}.dxf`))), { unidad_confirmada: u });
test('cantidades: reglas exigen parámetros, sin valores por defecto', () => {
  const m = med('simple_m');
  assert.throws(() => computeQuantity({ medicion: m, archivo: 'a.dxf', capas: ['LOSA'], regla: 'area_por_espesor' }), (e) => e.code === 'FALTA_DATO');
  assert.throws(() => computeQuantity({ medicion: m, archivo: 'a.dxf', capas: ['LOSA'], regla: 'area_por_espesor', parametros: { espesor_m: 0 } }), (e) => e.code === 'FALTA_DATO');
  assert.throws(() => computeQuantity({ medicion: m, archivo: 'a.dxf', capas: ['LOSA'], regla: 'nueva' }), (e) => e.code === 'REGLA_DESCONOCIDA');
  const q = computeQuantity({ medicion: m, archivo: 'a.dxf', sha256: 'abc', capas: ['LOSA'], regla: 'area_por_espesor', parametros: { espesor_m: 0.1 }, descuentos: [{ motivo: 'ducto', cantidad: 0.5 }], perdida_pct: 5 });
  const base = 20 + Math.PI / 2;
  assert.ok(Math.abs(q.cantidad - (base * 0.1 - 0.5) * 1.05) < 1e-9);
  assert.equal(q.unidad, 'm3'); assert.equal(q.cantidad_verificada, false);
  assert.match(q.formula, /espesor_m=0.1/); assert.match(q.supuestos[0], /no deducido del dibujo/);
  assert.deepEqual(q.fuente.capas, ['LOSA']);
});
test('cantidades: unidad no confirmada, needs_review y discrepancia', () => {
  const sin = measureDxf(parseDxf(fs.readFileSync(path.join(FIX, 'dxf', 'sin_unidades.dxf'))));
  assert.throws(() => computeQuantity({ medicion: sin, archivo: 'a', capas: ['LOSA'], regla: 'directa_area' }), (e) => e.code === 'UNIDAD_NO_CONFIRMADA');
  const bow = computeQuantity({ medicion: med('duplicados_abiertas'), archivo: 'a', capas: ['LOSA'], regla: 'directa_area' });
  assert.equal(bow.estado_revision, 'needs_review'); assert.equal(bow.cantidad, 0);
  const mal = computeQuantity({ medicion: med('mm', 'm'), archivo: 'a', capas: ['LOSA'], regla: 'directa_area' });
  assert.equal(mal.estado_revision, 'needs_review');
  const dup = computeQuantity({ medicion: med('duplicados_abiertas'), archivo: 'a', capas: ['DUP'], regla: 'directa_longitud' });
  assert.equal(dup.cantidad, 4);
  const cnt = computeQuantity({ medicion: med('bloques'), archivo: 'a', capas: ['0'], regla: 'conteo', instancia_bloque: 'PILAR' });
  assert.equal(cnt.cantidad, 11); // 1+1+6 directos + 2 anidados en PORTICO + 1 espejado
  assert.throws(() => computeQuantity({ medicion: med('simple_m'), archivo: 'a', capas: ['LOSA'], regla: 'directa_area', descuentos: [{ cantidad: 999 }] }), (e) => e.code === 'DATO_INVALIDO');
});
