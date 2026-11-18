// Revisión PR #30: `alcance` (qué parte de la obra cubre) y `calculo_incompleto` (faltan datos) son ejes distintos. La MISMA
// etiqueta debe aparecer en ventana, XLSX, PDF, manifiesto y respuesta. Aprobaciones SIMULADAS por el cliente de prueba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { startClientConPersona, PERSONA_SI, call, data, tmpHome } from './helpers.js';
import { computeBudget } from '../src/budget/calc.js';

const textoPdf = (f) => { const raw = fs.readFileSync(f).toString('latin1'); return (raw.match(/<([0-9a-fA-F]{2,})>/g) || []).map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join(''); };
const textoXlsx = (f) => Object.entries(unzipSync(new Uint8Array(fs.readFileSync(f)))).filter(([n]) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(n)).map(([, d]) => strFromU8(d)).join(' ');
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const partidas = [{ codigo: 'F1', descripcion: 'Pernos', unidad: 'un', cantidad: 10, apu: 'A', cantidad_verificada: true }];
const apu = (precio, extra = {}) => [{ codigo: 'A', unidad: 'un', insumos: [{ tipo: 'material', descripcion: 'Perno', unidad: 'un', cantidad: 1, precio_unitario: precio, fuente_precio: 'declarada', fecha_precio: '2026-11-01', ...extra }] }];
const cfg = { gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 };

test('unidad: alcance y cálculo incompleto no se confunden; precio sin fuente/fecha bloquea', () => {
  const parcial = computeBudget({ partidas, apus: apu(1000), config: { ...cfg, alcance: 'parcial', alcance_descripcion: 'solo fortificación' } });
  assert.equal(parcial.calculo_incompleto, false, 'aritméticamente completo');
  assert.equal(parcial.alcance, 'parcial'); assert.match(parcial.etiqueta_total, /^PRESUPUESTO PARCIAL \(solo fortificación\): no es el costo total de la obra$/);
  assert.equal(parcial.estado_final_posible, true, 'un parcial completo puede aprobarse, pero rotulado');
  const nd = computeBudget({ partidas, apus: apu(1000), config: cfg });
  assert.equal(nd.etiqueta_total, 'TOTAL (alcance no declarado)'); assert.ok(nd.advertencias.some((a) => /Alcance del presupuesto no declarado/.test(a)));
  const comp = computeBudget({ partidas, apus: apu(1000), config: { ...cfg, alcance: 'completo' } });
  assert.equal(comp.etiqueta_total, 'TOTAL DE LA OBRA');
  const inc = computeBudget({ partidas, apus: apu(null), config: { ...cfg, alcance: 'parcial', alcance_descripcion: 'solo fortificación' } });
  assert.equal(inc.calculo_incompleto, true); assert.match(inc.etiqueta_total, /PRESUPUESTO PARCIAL \(solo fortificación\).*TOTAL INCOMPLETO/); assert.equal(inc.estado_final_posible, false);
  const sinFuente = computeBudget({ partidas, apus: apu(1000, { fuente_precio: undefined }), config: { ...cfg, alcance: 'completo' } });
  assert.equal(sinFuente.estado_final_posible, false); assert.ok(sinFuente.bloqueos.some((b) => /sin fuente o fecha/.test(b)));
  const sinFecha = computeBudget({ partidas, apus: apu(1000, { fecha_precio: undefined }), config: { ...cfg, alcance: 'completo' } });
  assert.equal(sinFecha.estado_final_posible, false);
});

for (const [nombre, extra, esperada] of [
  ['parcial fortificación', { alcance: 'parcial', alcance_descripcion: 'solo fortificación' }, 'PRESUPUESTO PARCIAL (solo fortificación): no es el costo total de la obra'],
  ['alcance no declarado', {}, 'TOTAL (alcance no declarado)'],
]) {
  test(`integración «${nombre}»: misma etiqueta en respuesta, ventana, XLSX, PDF y manifiesto`, { timeout: 180000 }, async () => {
    const home = tmpHome('Alcance ñ '); const c = await startClientConPersona(home, undefined, Array.from({ length: 4 }, () => PERSONA_SI('Prueba (SIMULADA)')));
    const OK = async (n, a) => { const r = await call(c.client, n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return data(r); };
    const p = { proyecto: `Fortificacion ${nombre}` }; const root = path.join(home, 'Proyectos', p.proyecto);
    try {
      await OK('tannia_proyecto_crear', { nombre: p.proyecto });
      await OK('tannia_proyecto_modalidad', { ...p, accion: 'definir', modalidad: 'manual_declarado' });
      await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
      await OK('tannia_partida_manual', { ...p, codigo: 'F1', descripcion: 'Pernos de anclaje', unidad: 'un', cantidad: 10, origen: 'declarado', apu: 'A' });
      await OK('tannia_apu_definir', { ...p, codigo: 'A', unidad: 'un', insumos: apu(1000)[0].insumos });
      await OK('tannia_presupuesto_config', { ...p, ...cfg, ...extra });
      await OK('tannia_partida_verificar', { ...p, codigo: 'F1' });
      await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
      const x = await OK('tannia_presupuesto_generar', p); const m = await OK('tannia_informe_generar', p);
      assert.equal(x.etiqueta_total, esperada); assert.equal(x.calculo_incompleto, false);
      assert.ok(sinTildes(textoXlsx(path.join(root, x.archivo))).includes(sinTildes(esperada)), 'XLSX');
      assert.ok(sinTildes(textoPdf(path.join(root, m.archivo))).includes(sinTildes(esperada.replace('—', '-'))) || textoPdf(path.join(root, m.archivo)).includes(esperada.split(':')[0]), 'PDF');
      await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }); await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
      assert.ok(c.vistos.at(-1).includes(`${esperada}: $`), `ventana: ${c.vistos.at(-1).slice(0, 400)}`);
      assert.ok(!/TOTAL PARCIAL/.test(c.vistos.at(-1)), 'la ventana no usa «TOTAL PARCIAL» por un cálculo completo');
      const ex = await OK('tannia_entregable_exportar', p);
      const man = JSON.parse(fs.readFileSync(path.join(root, ex.carpeta, 'manifiesto-entrega.json'), 'utf8'));
      assert.equal(man.resumen.etiqueta_total, esperada); assert.equal(man.resumen.alcance, extra.alcance || 'no_declarado');
    } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
  });
}
