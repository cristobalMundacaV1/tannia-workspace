// Motor genérico de planos (TW-PRO-06) y fortificación dentro del motor geométrico (UAT-02).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tunnelModel, compose, cantidadesFortificacion, verifyDimensions } from '../src/drawing/model.js';
import { modeloDesdeEspecificacion, recintoEspecificacion, cantidadesRecinto } from '../src/drawing/especificacion.js';
import { sceneForSheet, validateScene, buildSheetsPdf, verifyPdf } from '../src/drawing/pdf.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { verifyLayouts, viewportsFromDxf, expectedLayouts } from '../src/drawing/layouts_check.js';

const F = { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 };
const code = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };
async function gates(model, opts = {}) {
  const c = compose(model);
  for (const s of c.sheets) assert.deepEqual(validateScene(sceneForSheet(c, s), s).issues, [], `legibilidad lámina ${s.id}`);
  const dxf = buildDrawingDxf(c);
  assert.ok(verifyLayouts(viewportsFromDxf(dxf), expectedLayouts(c)).ok, 'layouts/viewports');
  assert.match(dxf, /\$ACADVER\n1\nAC1024/); assert.match(dxf, /\$INSUNITS\n70\n6/);
  const pdf = await buildSheetsPdf(c); const q = await verifyPdf(pdf, c.sheets, opts);
  assert.deepEqual(q.issues, []); assert.equal(q.pages, c.sheets.length);
  return { c, dxf };
}

test('túnel UAT-02 con fortificación: 5 láminas, pernos y malla dibujados y cubicados desde la geometría', async () => {
  const m = tunnelModel({ fortificacion: F });
  assert.ok(verifyDimensions(m).ok);
  const { dxf } = await gates(m);
  const filas = cantidadesFortificacion(m);
  const pernos = filas.find((f) => f.partida === 'Pernos de anclaje');
  // Oráculo independiente: desarrollo P = 2·2,5 + π·2,75 = 13,6394 m; n = ceil(P/1,5) = 10; anillos = 150/1,5 + 1 = 101.
  const P = 2 * 2.5 + Math.PI * 2.75; assert.equal(Math.ceil(P / 1.5), 10);
  assert.equal(pernos.cantidad, 1010); assert.ok(Math.abs(pernos.longitud_total_m - 1010 * 2.4) < 1e-9);
  const malla = filas.find((f) => f.partida === 'Malla de acero');
  assert.ok(Math.abs(malla.cantidad - P * 150 * 1.1) < 1e-6);
  assert.equal((dxf.match(/\nPERNOS\n/g) || []).length >= 10, true, 'los pernos son entidades del DXF en su capa');
  assert.match(dxf, /elemento=pernos/);
  // Cada perno sale perpendicular al contorno y mide exactamente la longitud declarada.
  for (const e of m.views.find((v) => v.id === 'fortificacion').entities.filter((x) => x.layer === 'PERNOS')) assert.ok(Math.abs(Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) - 2.4) < 1e-9);
});

test('fortificación sin datos declarados se rechaza (no se suponen espaciamientos ni traslapos)', () => {
  assert.equal(code(() => tunnelModel({ fortificacion: { ...F, espaciamiento_transversal: undefined } })), 'DATOS_INVALIDOS');
  assert.equal(code(() => tunnelModel({ fortificacion: { ...F, traslapo_malla_pct: undefined } })), 'DATOS_INVALIDOS');
  assert.equal(cantidadesFortificacion(tunnelModel()), null);
  assert.equal(compose(tunnelModel()).sheets.length, 4, 'sin fortificación se conserva el juego de 4 láminas');
});

test('segundo dominio (edificación): planta, corte y elevación con el MISMO compositor, DXF y PDF', async () => {
  const m = modeloDesdeEspecificacion(recintoEspecificacion({ largo: 8, ancho: 5, espesor_muro: 0.2, altura: 2.4, proyecto: 'Casa' }));
  assert.deepEqual(m.views.map((v) => v.type), ['planta', 'corte', 'elevacion']);
  const { dxf } = await gates(m, { prefijo: 'REC', marca: 'DOCUMENTO DE TRABAJO' });
  assert.match(dxf, /\nREC-01\n/); assert.match(dxf, /\nMUROS\n/);
  const [q] = cantidadesRecinto(m, 2.4);
  assert.ok(Math.abs(q.area_planta_m2 - (8 * 5 - 7.6 * 4.6)) < 1e-9); assert.ok(Math.abs(q.volumen_m3 - 5.04 * 2.4) < 1e-9);
});

test('especificación genérica: validación estricta (escala normalizada, capa declarada, cotas ortogonales, vistas sin lámina)', () => {
  const base = () => ({ codigo: 'DET', especialidad: 'obras civiles', capas: { EJE: { leyenda: 'eje' } }, vistas: [{ id: 'd', titulo: 'Detalle', tipo: 'detalle', escala: 20, elementos: [{ tipo: 'rectangulo', capa: 'EXCAVACION', origen: [0, 0], ancho: 1, alto: 0.5 }], cotas: [{ tipo: 'lineal', a: [0, 0], b: [1, 0] }] }], laminas: [{ id: '01', titulo: 'Detalle', vistas: ['d'] }] });
  assert.ok(modeloDesdeEspecificacion(base()));
  const mut = (f) => { const b = base(); f(b); return code(() => modeloDesdeEspecificacion(b)); };
  assert.equal(mut((b) => { b.vistas[0].escala = 33; }), 'ESCALA_INVALIDA');
  assert.equal(mut((b) => { b.vistas[0].elementos[0].capa = 'NOEXISTE'; }), 'CAPA_NO_DECLARADA');
  assert.equal(mut((b) => { b.vistas[0].cotas[0].b = [1, 1]; }), 'COTA_NO_SOPORTADA');
  assert.equal(mut((b) => { b.vistas.push({ ...b.vistas[0], id: 'x' }); }), 'VISTA_SIN_LAMINA');
  assert.equal(mut((b) => { b.vistas[0].elementos[0].ancho = -1; }), 'GEOMETRIA_INVALIDA');
  assert.equal(mut((b) => { b.capas.PAPEL = {}; }), 'CAPA_RESERVADA');
  // Una vista que no cabe NO se reescala: falla.
  const grande = base(); grande.vistas[0].elementos[0].ancho = 50; grande.vistas[0].cotas[0].b = [50, 0];
  assert.equal(code(() => compose(modeloDesdeEspecificacion(grande))), 'VISTA_NO_CABE');
});
