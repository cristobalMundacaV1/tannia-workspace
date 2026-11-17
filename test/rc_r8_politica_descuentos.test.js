// Regresión independiente R8: una partida puede informar vanos que el método NO descuenta.
// La explicación se publica en ventana de verificación, Excel y PDF; no debe contradecir el kernel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mc01 } from '../src/metodos/tarjetas.js';
import { explicarPartida, textoExplicacion } from '../src/metodos/explicar.js';

const datos = (tipo, umbral_m2) => ({
  tramos: [{ longitud_m: 5, origen: 'declarado_usuaria' }],
  altura: { valor_m: 2.4, origen: 'declarado_usuaria' },
  vanos: [
    { descripcion: 'puerta', ancho_m: 1, alto_m: 2, tramo: 0, posicion_m: 0, origen: 'declarado_usuaria' },
    { descripcion: 'rejilla', ancho_m: 0.5, alto_m: 0.5, tramo: 0, posicion_m: 3, origen: 'declarado_usuaria' },
  ],
  politica_descuento: { tipo, ...(umbral_m2 ? { umbral_m2 } : {}), origen: 'decision_profesional' },
});
const explicar = (d) => {
  const r = mc01(d);
  const e = explicarPartida({
    codigo: 'M1', descripcion: 'Muro eje A', unidad: r.unidad, cantidad: r.cantidad,
    regla: 'metodo:MC01-muro-area-neta', metodo: r.metodo, datos_metodo: d,
    desglose: r.desglose, entradas: r.entradas, supuestos: r.supuestos,
    exclusiones: r.exclusiones, advertencias: r.advertencias,
  });
  return { r, e, texto: textoExplicacion({}, e) };
};

test('R8: no_descontar mantiene 12 m² y nunca presenta un descuento inexistente', () => {
  const { r, e, texto } = explicar(datos('no_descontar'));
  assert.equal(r.cantidad, 12);
  assert.equal(r.desglose.vanos_descontados, 0);
  assert.equal((texto.match(/Vano informado NO descontado por la política/g) || []).length, 2);
  assert.doesNotMatch(texto, /Descuento por puerta|Descuento por rejilla/);
  assert.match(e.alcance, /No se descontó ningún vano informado/);
  assert.match(texto, /Superficie neta: 12 − 0 = 12 m²/);
});

test('R8: descontar_mayores_a descuenta puerta, pero no rejilla menor al umbral', () => {
  const { r, e, texto } = explicar(datos('descontar_mayores_a', 1));
  assert.equal(r.cantidad, 10);
  assert.equal(r.desglose.vanos_descontados, 1);
  assert.match(texto, /Descuento por puerta: 1 m × 2 m = 2 m²/);
  assert.match(texto, /Vano informado NO descontado por la política: rejilla/);
  assert.doesNotMatch(texto, /Descuento por rejilla/);
  assert.match(e.alcance, /Se descontaron 1 de 2 vanos informados/);
});

test('R8: descontar_todos conserva la explicación de ambos descuentos', () => {
  const { r, e, texto } = explicar(datos('descontar_todos'));
  assert.equal(r.cantidad, 9.75);
  assert.equal(r.desglose.vanos_descontados, 2);
  assert.match(texto, /Descuento por puerta/);
  assert.match(texto, /Descuento por rejilla/);
  assert.doesNotMatch(texto, /NO descontado/);
  assert.match(e.alcance, /Se descontaron los vanos informados/);
  assert.match(texto, /Superficie neta: 12 − 2,25 = 9,75 m²/);
});
