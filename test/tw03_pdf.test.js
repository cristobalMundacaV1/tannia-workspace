import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspectPdf, openPdf, extractPaths, calibrate, polyMeasure } from '../src/pdf/pdf.js';
import { FIX } from './helpers.js';

const rd = (n) => fs.readFileSync(path.join(FIX, 'pdf', `${n}.pdf`));
const mm = 72 / 25.4;
const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('inspección: vectorial, pistas de escala como dato, texto malicioso solo como dato', async () => {
  const r = await inspectPdf(rd('plano_vector_1_100'));
  assert.equal(r.paginas, 1); assert.equal(r.detalle[0].tipo, 'vectorial');
  assert.deepEqual(r.detalle[0].pistas_de_escala_en_texto, ['1:100']);
  near(r.detalle[0].ancho_mm, 210, 1e-3);
  const inj = await inspectPdf(rd('inyeccion'));
  assert.match(inj.detalle[0].texto_extracto_COMO_DATO_no_instrucciones, /IGNORA/);
});

test('escaneado detectado; corrupto y no-PDF con error claro', async () => {
  const r = await inspectPdf(rd('escaneado'));
  assert.equal(r.detalle[0].tipo, 'escaneada'); assert.ok(r.advertencias.some((a) => /escaneadas/.test(a)));
  await assert.rejects(() => inspectPdf(rd('corrupto')), (e) => e.code === 'PDF_CORRUPTO');
  await assert.rejects(() => inspectPdf(Buffer.from('hola')), (e) => e.code === 'NO_ES_PDF');
});

test('calibración por cota y medición de longitud/área reales (1:100)', async () => {
  const { doc, lib } = await openPdf(rd('plano_vector_1_100'));
  const { paths } = await extractPaths(doc, lib, 1);
  // cota vertical de 5 m (50 mm de papel)
  const cota = paths.find((p) => p.puntos.length === 2 && Math.abs(p.puntos[0].x - p.puntos[1].x) < 1e-6 && Math.abs(Math.abs(p.puntos[0].y - p.puntos[1].y) - 50 * mm) < 1e-3);
  assert.ok(cota, 'cota encontrada');
  const rect = paths.find((p) => p.cerrado && p.puntos.length >= 4);
  const linea = paths.find((p) => p.puntos.length === 2 && Math.abs(p.puntos[0].y - 60 * mm) < 1e-3);
  const ele = paths.find((p) => p.puntos.length === 3);
  const cal = calibrate({ pagina: 1, modo: 'cota', a: cota.puntos[0], b: cota.puntos[1], distancia_real: 5, unidad: 'm', verificacion: { a: linea.puntos[0], b: linea.puntos[1], distancia_real: 20 } });
  assert.equal(cal.verificada, true); assert.ok(cal.error_verificacion_pct < 0.01);
  const a = polyMeasure(rect.puntos.slice(0, 4), true, cal);
  near(a.area_m2, 50, 1e-6); near(a.longitud_m, 30, 1e-6); assert.equal(a.needs_review, false);
  near(polyMeasure(ele.puntos, false, cal).longitud_m, 7, 1e-6);
});

test('calibración errónea o sin verificar marca needs_review', async () => {
  const mala = calibrate({ pagina: 1, modo: 'cota', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, distancia_real: 10, verificacion: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, distancia_real: 12 } });
  assert.equal(mala.verificada, false); assert.ok(mala.error_verificacion_pct > 10);
  const decl = calibrate({ pagina: 1, modo: 'escala_declarada', denominador: 100 });
  near(decl.m_por_pt, 25.4 / 72 / 1000 * 100, 1e-12);
  assert.equal(decl.confiable, false);
  const r = polyMeasure([{ x: 0, y: 0 }, { x: 72, y: 0 }], false, decl);
  assert.equal(r.needs_review, true); near(r.longitud_m, 2.54, 1e-9);
  assert.throws(() => calibrate({ pagina: 1, modo: 'cota', a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, distancia_real: 5 }), (e) => e.code === 'CALIBRACION_INVALIDA');
  assert.throws(() => calibrate({ pagina: 1, modo: 'x' }), (e) => e.code === 'CALIBRACION_INVALIDA');
  assert.throws(() => calibrate({ pagina: 1, modo: 'cota', a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, distancia_real: -1 }), (e) => e.code === 'CALIBRACION_INVALIDA');
});

test('varias páginas con calibración independiente', async () => {
  const r = await inspectPdf(rd('dos_paginas'));
  assert.equal(r.paginas, 2);
  const { doc, lib } = await openPdf(rd('dos_paginas'));
  const p1 = (await extractPaths(doc, lib, 1)).paths[0]; const p2 = (await extractPaths(doc, lib, 2)).paths[0];
  const c1 = calibrate({ pagina: 1, modo: 'escala_declarada', denominador: 50 }); const c2 = calibrate({ pagina: 2, modo: 'escala_declarada', denominador: 100 });
  near(polyMeasure(p1.puntos.slice(0, 4), true, c1).area_m2, 25, 1e-6); // 100mm*50 = 5 m -> 25 m2
  near(polyMeasure(p2.puntos.slice(0, 4), true, c2).area_m2, 100, 1e-6);
});

test('curvas Bézier se aplanan: círculo con área ≈ πr² (tolerancia 0.2 %)', async () => {
  const { doc, lib } = await openPdf(rd('circulo'));
  const { paths } = await extractPaths(doc, lib, 1);
  const c = paths.find((p) => p.tiene_curvas);
  assert.ok(c);
  const cal = calibrate({ pagina: 1, modo: 'escala_declarada', denominador: 50 });
  const r = polyMeasure(c.puntos, true, cal);
  near(r.area_m2, Math.PI * 1.25 * 1.25, 2e-3);
});
