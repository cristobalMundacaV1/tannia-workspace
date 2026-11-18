// E2E con servidor MCP real: las 3 políticas de descuento de MC01 + una segunda partida (MC02), ventana/Excel/PDF/manifiesto
// con el MISMO cálculo y política, y recálculo REAL del XLSX sin caché (LibreOffice) con varias partidas y cambio de IVA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { startClientConPersona, PERSONA_SI, call, data, tmpHome, FIX } from './helpers.js';
import { recalcular, motorDisponible } from '../scripts/lib/recalcular_xlsx.mjs';

const MOTOR = motorDisponible();
const r0 = (x) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5 + 1e-9);
/** Oráculo independiente del motor: CD = Σ round(q·pu); GG, U sobre CD; IVA sobre neto; redondeo a peso. */
const oraculo = (lineas, gg, u, iva) => { const cd = lineas.reduce((s, [q, pu]) => s + r0(q * pu), 0); const G = r0(cd * gg / 100); const U = r0(cd * u / 100); const n = cd + G + U; const I = r0(n * iva / 100); return { 'Costo directo': cd, 'Gastos generales': G, Utilidades: U, Neto: n, IVA: I, TOTAL: n + I }; };
const textoPdf = (f) => { const raw = fs.readFileSync(f).toString('latin1'); return (raw.match(/<([0-9a-fA-F]{2,})>/g) || []).map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join(''); };
async function hojaCubicacion(f) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f); const out = {}; wb.getWorksheet('Cubicacion').eachRow((row, i) => { if (i > 1) out[row.getCell(1).value] = { cantidad: row.getCell(4).value, calculo: row.getCell(5).value, origen: row.getCell(6).value }; }); return out; }

const POLITICAS = {
  descontar_todos: { pol: { tipo: 'descontar_todos', origen: 'decision_profesional' }, q: 9.8, desc: ['Descuento por puerta', 'Descuento por rejilla'], alcance: 'Se descontaron los vanos informados' },
  descontar_mayores_a: { pol: { tipo: 'descontar_mayores_a', umbral_m2: 1, origen: 'decision_profesional' }, q: 10, desc: ['Descuento por puerta', 'NO descontado por la política: rejilla'], alcance: 'Se descontaron 1 de 2 vanos informados' },
  no_descontar: { pol: { tipo: 'no_descontar', origen: 'decision_profesional' }, q: 12, desc: ['NO descontado por la política: puerta', 'NO descontado por la política: rejilla'], alcance: 'No se descontó ningún vano informado' },
};

for (const [nombre, E] of Object.entries(POLITICAS)) {
  test(`E2E MC01 «${nombre}» + MC02: ventana, Excel, PDF y manifiesto coinciden; recálculo real`, { timeout: 300000 }, async (t) => {
    const home = tmpHome(`E2E ${nombre} ñ `);
    const c = await startClientConPersona(home, undefined, Array.from({ length: 8 }, () => PERSONA_SI('Prueba (SIMULADA)')));
    const OK = async (n, a) => { const r = await call(c.client, n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return data(r); };
    const P = `Politica ${nombre}`; const p = { proyecto: P }; const root = path.join(home, 'Proyectos', P);
    try {
      await OK('tannia_proyecto_crear', { nombre: P });
      fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(root, '02 Originales', 'planta.dxf')); await OK('tannia_originales_registrar', p); await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
      const m1 = await OK('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: { tramos: [{ longitud_m: 5, origen: 'declarado_usuaria' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ descripcion: 'puerta', ancho_m: 1, alto_m: 2, tramo: 0, posicion_m: 0.5, origen: 'declarado_usuaria' }, { descripcion: 'rejilla', ancho_m: 0.5, alto_m: 0.4, tramo: 0, posicion_m: 3, origen: 'declarado_usuaria' }], politica_descuento: E.pol }, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A1' } });
      assert.ok(Math.abs(m1.cantidad - E.q) < 1e-9, `${m1.cantidad} ≠ ${E.q}`);
      await OK('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC02-losa-volumen', datos: { zonas: [{ area_m2: 20, espesor_m: 0.1, origen: 'declarado_usuaria' }] }, guardar_como: { codigo: 'L1', descripcion: 'Losa', apu: 'A2' } });
      await OK('tannia_apu_definir', { ...p, codigo: 'A1', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: 8000, fuente_precio: 'declarada', fecha_precio: '2026-11-17' }] });
      await OK('tannia_apu_definir', { ...p, codigo: 'A2', unidad: 'm3', insumos: [{ tipo: 'material', descripcion: 'Hormigón', unidad: 'm3', cantidad: 1, precio_unitario: 50000, fuente_precio: 'declarada', fecha_precio: '2026-11-17' }] });
      await OK('tannia_presupuesto_config', { ...p, gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 });
      await OK('tannia_partida_verificar', { ...p, codigo: 'M1' }); const ventanaM1 = c.vistos.at(-1);
      await OK('tannia_partida_verificar', { ...p, codigo: 'L1' });
      await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
      const x = await OK('tannia_presupuesto_generar', p); const m = await OK('tannia_informe_generar', p);
      const esperado = oraculo([[E.q, 8000], [2, 50000]], 10, 5, 19);
      assert.equal(x.total, esperado.TOTAL);
      // misma explicación y política en ventana, Excel y PDF
      const cub = await hojaCubicacion(path.join(root, x.archivo)); const pdf = textoPdf(path.join(root, m.archivo));
      assert.ok(Math.abs(cub.M1.cantidad - E.q) < 1e-9);
      for (const frag of [...E.desc, E.alcance]) { assert.ok(ventanaM1.includes(frag), `ventana sin «${frag}»`); assert.ok(`${cub.M1.calculo} ${cub.M1.origen}`.includes(frag), `Excel sin «${frag}»`); assert.ok(pdf.includes(frag), `PDF sin «${frag}»`); }
      // recálculo real con varias partidas
      if (MOTOR) { const rc = await recalcular(path.join(root, x.archivo)); for (const [k, v] of Object.entries(esperado)) assert.equal(rc.filas[k], v, `recálculo ${k}`); }
      else t.diagnostic('PENDIENTE: sin LibreOffice');
      // aprobación y manifiesto
      await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }); await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
      const ex = await OK('tannia_entregable_exportar', p);
      const man = JSON.parse(fs.readFileSync(path.join(root, ex.carpeta, 'manifiesto-entrega.json'), 'utf8'));
      assert.equal(man.resumen.total, esperado.TOTAL); assert.ok(Math.abs(man.resumen.partidas.find((q) => q.codigo === 'M1').cantidad - E.q) < 1e-9);
      // cambio de IVA y de cantidad: el libro regenerado recalcula bien
      await OK('tannia_presupuesto_config', { ...p, iva_pct: 10 });
      const x2 = await OK('tannia_presupuesto_generar', p); const esp2 = oraculo([[E.q, 8000], [2, 50000]], 10, 5, 10);
      assert.equal(x2.total, esp2.TOTAL);
      if (MOTOR) { const rc = await recalcular(path.join(root, x2.archivo)); for (const [k, v] of Object.entries(esp2)) assert.equal(rc.filas[k], v, `recálculo IVA 10 ${k}`); }
    } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
  });
}
