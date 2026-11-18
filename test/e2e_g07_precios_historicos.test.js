// G07 / NEG-10 (TW-PRO-E2E): un precio histórico (p. ej. APU de 2010) es REFERENCIAL. Puede mostrarse, pero el presupuesto no
// puede quedar final ni presentarse como costo vigente; la etiqueta única lo dice en Excel, memoria, ventana y manifiesto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBudget } from '../src/budget/calc.js';

const partidas = [{ codigo: 'F-01', descripcion: 'Pernos', unidad: 'u', cantidad: 10, apu: 'A', cantidad_verificada: true, estado_revision: 'borrador' }];
const apu = (fecha) => [{ codigo: 'A', unidad: 'u', insumos: [{ tipo: 'material', descripcion: 'Perno helicoidal', unidad: 'u', cantidad: 1, precio_unitario: 8500, fuente_precio: 'APU del enunciado', fecha_precio: fecha }] }];
const config = { gastos_generales_pct: 0, utilidades_pct: 0, iva_pct: 19, alcance: 'parcial', alcance_descripcion: 'fortificación', fecha_referencia_precios: '2026-11-18' };

test('NEG-10: precio de 2010 → referencial, sin estado final; mismo cálculo aritmético', () => {
  const h = computeBudget({ partidas, apus: apu('2010-05-01'), config });
  assert.equal(h.estado_final_posible, false);
  assert.match(h.etiqueta_total, /PRECIOS HISTÓRICOS/);
  assert.ok(h.bloqueos.some((b) => /2010-05-01.*referencial/.test(b)), h.bloqueos.join(' | '));
  const v = computeBudget({ partidas, apus: apu('2026-10-01'), config });
  assert.equal(v.estado_final_posible, true, v.bloqueos.join(' | ')); assert.doesNotMatch(v.etiqueta_total, /HISTÓRICOS/);
  assert.equal(h.costo_directo, v.costo_directo, 'la aritmética no cambia: cambia el estatus');
});
