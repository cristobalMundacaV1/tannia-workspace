// Regresión Astra A-03 / AC13: el comparador DXF → DWG no acepta como «fiel» un cambio de topología, orden, sentido, capa,
// bulge o elevación, ni declara fidelidad sobre entidades que no sabe comparar (bloques, cotas, sombreados).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compararFidelidad, firmasDesdeDxf, firmasDesdeCom, secuenciaCanonica } from '../src/cad/fidelidad.js';

const poli = (verts, { layer = 'A', closed = true, elevation = 0, bulges = [] } = {}) => ({ type: 'LWPOLYLINE', layer, closed, elevation, extrusion: { x: 0, y: 0, z: 1 }, verts: verts.map(([x, y], i) => ({ x, y, bulge: bulges[i] || 0 })) });
const dxf = (...entities) => firmasDesdeDxf({ entities });
const CUADRADO = [[0, 0], [2, 0], [2, 2], [0, 2]];
/** Lectura COM simulada de una LWPOLYLINE con todas las propiedades del contrato. */
const com = (verts, { capa = 'A', cerrada = true, elevacion = 0, bulges, handle = '1F' } = {}) => ({ handle, tipo: 'AcDbPolyline', capa, cerrada, elevacion, coordenadas: verts.flat(), bulges: bulges ?? verts.map(() => 0) });

test('reproducción A-03: cuadrado vs polilínea cruzada con los MISMOS vértices ⇒ con_diferencias (antes: fiel)', () => {
  const r = compararFidelidad(dxf(poli(CUADRADO)), dxf(poli([[0, 0], [2, 2], [2, 0], [0, 2]])));
  assert.equal(r.fiel, false); assert.equal(r.estado, 'con_diferencias');
});
test('reproducción A-03: cambio de capa A → B con la misma geometría ⇒ con_diferencias (antes: fiel)', () => {
  const r = compararFidelidad(dxf(poli([[0, 0], [2, 0], [2, 2]], { layer: 'A' })), dxf(poli([[0, 0], [2, 0], [2, 2]], { layer: 'B' })));
  assert.equal(r.fiel, false); assert.equal(r.estado, 'con_diferencias');
});
test('contrato de polilínea: otro vértice inicial en cerrada es equivalente; sentido invertido, orden abierto, bulge y elevación NO', () => {
  const base = dxf(poli(CUADRADO));
  assert.equal(compararFidelidad(base, dxf(poli([[2, 2], [0, 2], [0, 0], [2, 0]]))).estado, 'fiel', 'rotación del inicio');
  assert.equal(compararFidelidad(base, dxf(poli([[0, 0], [0, 2], [2, 2], [2, 0]]))).estado, 'con_diferencias', 'sentido invertido');
  const abierta = dxf(poli([[0, 0], [2, 0], [2, 2]], { closed: false }));
  assert.equal(compararFidelidad(abierta, dxf(poli([[2, 0], [0, 0], [2, 2]], { closed: false }))).estado, 'con_diferencias', 'orden de abierta');
  assert.equal(compararFidelidad(base, dxf(poli(CUADRADO, { bulges: [0.5] }))).estado, 'con_diferencias', 'bulge (arco) agregado');
  assert.equal(compararFidelidad(base, dxf(poli(CUADRADO, { elevation: 3 }))).estado, 'con_diferencias', 'elevación');
  assert.equal(compararFidelidad(base, dxf(poli(CUADRADO, { closed: false }))).estado, 'con_diferencias', 'abierta vs cerrada');
});
test('lectura COM: con bulges y elevación informados se verifica; sin ellos el resultado es NO CONCLUYENTE, nunca fiel', () => {
  const esperadas = dxf(poli(CUADRADO, { bulges: [0, 0.25, 0, 0] }));
  const okCom = firmasDesdeCom([com(CUADRADO, { bulges: [0, 0.25, 0, 0] })]);
  assert.equal(compararFidelidad(esperadas, okCom.firmas).estado, 'fiel');
  const sinBulge = firmasDesdeCom([{ ...com(CUADRADO), bulges: null }]);
  const r = compararFidelidad(esperadas, sinBulge.firmas);
  assert.equal(r.estado, 'no_concluyente'); assert.equal(r.no_verificables.length, 1); assert.deepEqual(r.no_verificables[0].falta_informar, ['bulges']);
  const cruzadaSinBulge = firmasDesdeCom([{ ...com([[0, 0], [2, 2], [2, 0], [0, 2]]), bulges: null }]);
  assert.equal(compararFidelidad(esperadas, cruzadaSinBulge.firmas).estado, 'con_diferencias', 'una lectura incompleta no cubre otra topología');
  const capaCom = firmasDesdeCom([com(CUADRADO, { capa: 'B', bulges: [0, 0.25, 0, 0] })]);
  assert.equal(compararFidelidad(esperadas, capaCom.firmas).estado, 'con_diferencias');
});
test('entidades sin comparador (bloque, cota, sombreado) ⇒ no_concluyente aunque el conteo coincida', () => {
  const e = dxf({ type: 'INSERT', layer: 'X', name: 'PUERTA', extrusion: { x: 0, y: 0, z: 1 } }, { type: 'DIMENSION', layer: 'COTAS', extrusion: { x: 0, y: 0, z: 1 } });
  const r = compararFidelidad(e, []);
  assert.equal(r.fiel, false); assert.equal(r.estado, 'no_concluyente'); assert.equal(r.sin_comparador.length, 2);
});
test('OCS no estándar (extrusión distinta de +Z) no se compara como si fuera plano', () => {
  const e = [{ ...poli(CUADRADO), extrusion: { x: 0, y: 0, z: -1 } }];
  assert.equal(compararFidelidad(firmasDesdeDxf({ entities: e }), []).estado, 'no_concluyente');
});
test('líneas, arcos, círculos y textos: capa y geometría forman parte del contrato; rotación de texto también', () => {
  const L = (layer, b = { x: 5, y: 0 }) => ({ type: 'LINE', layer, a: { x: 0, y: 0 }, b, extrusion: { x: 0, y: 0, z: 1 } });
  assert.equal(compararFidelidad(dxf(L('A')), dxf({ ...L('A'), a: { x: 5, y: 0 }, b: { x: 0, y: 0 } })).estado, 'fiel', 'línea invertida es la misma línea');
  assert.equal(compararFidelidad(dxf(L('A')), dxf(L('B'))).estado, 'con_diferencias');
  const C = (r) => ({ type: 'CIRCLE', layer: 'A', c: { x: 1, y: 1 }, r, extrusion: { x: 0, y: 0, z: 1 } });
  assert.equal(compararFidelidad(dxf(C(1)), firmasDesdeCom([{ handle: '2', tipo: 'AcDbCircle', capa: 'A', centro: [1, 1, 0], radio: 1 }]).firmas).estado, 'fiel');
  assert.equal(compararFidelidad(dxf(C(1)), dxf(C(1.5))).estado, 'con_diferencias');
  const T = (rot) => ({ type: 'TEXT', layer: 'T', text: 'Baño Ñandú', p: { x: 0, y: 0 }, altura: 0.2, rot, just: 0, extrusion: { x: 0, y: 0, z: 1 } });
  assert.equal(compararFidelidad(dxf(T(0)), dxf(T(90))).estado, 'con_diferencias');
});
test('secuencia canónica: determinista e independiente del vértice inicial en cerradas', () => {
  const v = CUADRADO.map(([x, y]) => ({ x, y, b: 0 }));
  assert.equal(secuenciaCanonica(v, true), secuenciaCanonica([...v.slice(2), ...v.slice(0, 2)], true));
  assert.notEqual(secuenciaCanonica(v, true), secuenciaCanonica([...v].reverse(), true));
});
