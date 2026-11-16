import test from 'node:test';
import assert from 'node:assert/strict';
import { analizarContornoDeLineas } from '../src/cad/geometry_check.js';
import { compararLecturas } from '../src/cad/fidelidad.js';

const L = (h, a, b) => ({ handle: h, inicio: a, fin: b });
const rect = (w, h, z = 0) => [L('A', [0, 0, z], [w, 0, z]), L('B', [w, 0, z], [w, h, z]), L('C', [w, h, z], [0, h, z]), L('D', [0, h, z], [0, 0, z])];

test('rectángulo 6000×4000: cerrado, ángulos 90°, área 24e6, perímetro 20000, dimensiones esperadas', () => {
  const r = analizarContornoDeLineas(rect(6000, 4000), { ancho: 6000, alto: 4000 });
  assert.equal(r.cerrado, true); assert.equal(r.es_rectangulo, true); assert.equal(r.estado, 'ok');
  assert.equal(r.area, 24e6); assert.equal(r.perimetro, 20000); assert.deepEqual(r.bbox, { ancho: 6000, alto: 4000 });
  assert.ok(r.angulos_grados.every((g) => Math.abs(g - 90) < 1e-9)); assert.equal(r.dimensiones_coinciden_con_lo_esperado, true);
  assert.equal(analizarContornoDeLineas(rect(6000, 4000), { ancho: 4000, alto: 6000 }).estado, 'ok', 'orientación indiferente');
});

test('robusto al orden y sentido de las líneas', () => {
  const l = rect(6000, 4000); const mezcla = [l[2], { ...l[0], inicio: l[0].fin, fin: l[0].inicio }, l[3], { ...l[1], inicio: l[1].fin, fin: l[1].inicio }];
  const r = analizarContornoDeLineas(mezcla, { ancho: 6000, alto: 4000 }); assert.equal(r.cerrado, true); assert.equal(r.es_rectangulo, true); assert.equal(r.area, 24e6); assert.equal(r.estado, 'ok');
});

test('detecta huecos, líneas sueltas, tres líneas, duplicados, longitud cero y cotas distintas', () => {
  const hueco = rect(6000, 4000); hueco[3] = L('D', [0, 4000, 0], [0, 0.5, 0]);
  let r = analizarContornoDeLineas(hueco); assert.equal(r.cerrado, false); assert.equal(r.estado, 'needs_review'); assert.match(r.discrepancias.join(), /NO cierra/);
  assert.equal(analizarContornoDeLineas(hueco, { tol: 1 }).cerrado, true, 'la tolerancia es explícita');
  r = analizarContornoDeLineas([...rect(6000, 4000), L('X', [10, 10, 0], [20, 10, 0])]); assert.equal(r.cerrado, false); assert.match(r.discrepancias.join(), /no forman parte/);
  r = analizarContornoDeLineas(rect(6000, 4000).slice(0, 3)); assert.equal(r.cerrado, false);
  r = analizarContornoDeLineas([...rect(6000, 4000), L('Z', [0, 0, 0], [6000, 0, 0])]); assert.equal(r.estado, 'needs_review', 'línea duplicada');
  r = analizarContornoDeLineas([L('Z', [1, 1, 0], [1, 1, 0])]); assert.match(r.discrepancias.join(), /longitud cero/);
  r = analizarContornoDeLineas(rect(6000, 4000).map((l, i) => (i === 1 ? { ...l, fin: [6000, 4000, 100], } : i === 2 ? { ...l, inicio: [6000, 4000, 100] } : l))); assert.equal(r.coplanar_z, false); assert.equal(r.estado, 'needs_review');
  assert.equal(analizarContornoDeLineas([]).estado, 'needs_review');
  r = analizarContornoDeLineas([L('A', [0, 0, 0], [1, 0, 0]), { handle: 'Q', error: 'no_encontrada' }]); assert.match(r.discrepancias.join(), /Q/);
});

test('cierra pero no es rectángulo (paralelogramo, triángulo) y dimensiones que no coinciden', () => {
  const par = [L('A', [0, 0, 0], [6000, 0, 0]), L('B', [6000, 0, 0], [7000, 4000, 0]), L('C', [7000, 4000, 0], [1000, 4000, 0]), L('D', [1000, 4000, 0], [0, 0, 0])];
  let r = analizarContornoDeLineas(par); assert.equal(r.cerrado, true); assert.equal(r.es_rectangulo, false); assert.equal(r.estado, 'needs_review'); assert.match(r.discrepancias.join(), /90/);
  r = analizarContornoDeLineas([L('A', [0, 0, 0], [3, 0, 0]), L('B', [3, 0, 0], [0, 4, 0]), L('C', [0, 4, 0], [0, 0, 0])]); assert.equal(r.cerrado, true); assert.equal(r.es_rectangulo, false); assert.equal(r.area, 6);
  r = analizarContornoDeLineas(rect(6000, 4000), { ancho: 6000, alto: 4500 }); assert.equal(r.dimensiones_coinciden_con_lo_esperado, false); assert.equal(r.estado, 'needs_review');
});

test('comparar lecturas antes/después de reabrir', () => {
  const a = rect(6000, 4000).map((l) => ({ ...l, tipo: 'AcDbLine', capa: 'TW_PRUEBA' }));
  assert.equal(compararLecturas(a, structuredClone(a)).estado, 'verificada');
  const d = structuredClone(a); d[0].capa = 'OTRA'; d[1].fin = [6000, 4001, 0]; d.pop();
  assert.deepEqual(compararLecturas(a, d).diferencias.map((x) => x.problema).sort(), ['capa_distinta', 'desaparecio_tras_reabrir', 'fin_distinto']);
  assert.deepEqual(compararLecturas([{ handle: 'A', error: 'no_encontrada' }], []).diferencias.map((x) => x.problema), ['no_existia_antes_de_cerrar']);
});
