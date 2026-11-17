// G3 (issue #32, PL-02): las cantidades de una especificación se MIDEN sobre la geometría o se rotulan DECLARADAS.
// Una cantidad inventada no supera el gate; un cambio geométrico cambia la cantidad y la huella del modelo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { modeloDesdeEspecificacion } from '../src/drawing/especificacion.js';
import { digest } from '../src/cad/operations.js';

const code = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };
const base = (L = 6, H = 2.4, extra = {}) => ({
  codigo: 'G3', especialidad: 'edificación', proyecto: 'Prueba G3', capas: { MUROS: { color: 7, grosor: 0.5, leyenda: 'Muros' }, VANOS: { color: 3, grosor: 0.25, leyenda: 'Vanos' } },
  vistas: [{ id: 'elev', titulo: 'Elevación', tipo: 'elevacion', escala: 50, elementos: [
    { id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: L, alto: H },
    { id: 'puerta', tipo: 'rectangulo', capa: 'VANOS', origen: [1, 0], ancho: 0.9, alto: 2.0 },
    { id: 'ventana', tipo: 'rectangulo', capa: 'VANOS', origen: [3.5, 1.0], ancho: 1.2, alto: 1.0 },
  ] }],
  laminas: [{ id: '01', titulo: 'Elevación', vistas: ['elev'] }],
  mediciones: [
    { id: 'bruto', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/muro'], unidad: 'm2' },
    { id: 'vano-p', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/puerta'], signo: -1 },
    { id: 'vano-v', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/ventana'], signo: -1 },
    { id: 'vanos', partida: 'Vanos', metodo: 'conteo', fuentes: ['elev/puerta', 'elev/ventana'] },
  ], ...extra,
});

test('muro con vanos: área neta medida = L·H − 0,9·2,0 − 1,2·1,0 (oráculo a mano) y conteo de vanos', () => {
  const m = modeloDesdeEspecificacion(base()); const t = m.quantities.find((q) => q.id === 'total-Muro M1');
  assert.ok(Math.abs(t.valor - (6 * 2.4 - 0.9 * 2.0 - 1.2 * 1.0)) < 1e-9, String(t.valor)); assert.equal(t.unidad, 'm2');
  assert.match(m.quantities.find((q) => q.id === 'vano-p').formula, /^DESCUENTO/);
  assert.equal(m.quantities.find((q) => q.id === 'vanos').valor, 2);
  assert.ok(m.quantities.every((q) => /MEDIDA/.test(q.naturaleza) && /TW-MED\/1/.test(q.metodo)));
});

test('cambio geométrico (L 6 → 6,35 m) cambia la cantidad y la huella del modelo', () => {
  const a = modeloDesdeEspecificacion(base()); const b = modeloDesdeEspecificacion(base(6.35));
  const t = (m) => m.quantities.find((q) => q.id === 'total-Muro M1').valor;
  assert.ok(Math.abs(t(b) - t(a) - 0.35 * 2.4) < 1e-9); assert.notEqual(digest(a), digest(b));
});

test('cantidades inventadas, unidades incompatibles, fuentes inexistentes y duplicados se rechazan', () => {
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { cantidades: [{ partida: 'Muro', cantidad: 999, unidad: 'm2' }] }))), 'CANTIDADES_NO_DERIVADAS');
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'x', metodo: 'area', fuentes: ['elev/muro'], unidad: 'm3' }] }))), 'UNIDAD_INCOMPATIBLE');
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'x', metodo: 'longitud', fuentes: ['elev/fantasma'] }] }))), 'FUENTE_INEXISTENTE');
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'a', partida: 'P', metodo: 'area', fuentes: ['elev/muro'] }, { id: 'b', partida: 'P', metodo: 'area', fuentes: ['elev/muro'] }] }))), 'MEDICION_DUPLICADA');
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'a', partida: 'P', metodo: 'area', fuentes: ['elev/puerta'] }, { id: 'b', partida: 'P', metodo: 'area', fuentes: ['elev/muro'], signo: -1 }] }))), 'MEDICION_INVALIDA');
});

test('cantidad declarada: exige origen y queda rotulada como NO medida desde el plano; no se mezcla con medidas', () => {
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { cantidades_declaradas: [{ partida: 'Excavación', cantidad: 12, unidad: 'm3' }] }))), 'DATOS_INVALIDOS');
  const m = modeloDesdeEspecificacion(base(6, 2.4, { cantidades_declaradas: [{ partida: 'Excavación', cantidad: 12, unidad: 'm3', origen: 'EETT del mandante, partida 2.1' }] }));
  const d = m.quantities.find((q) => q.partida === 'Excavación'); assert.equal(d.metodo, 'DECLARADA'); assert.match(d.naturaleza, /no medida desde el plano.*EETT/);
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { cantidades_declaradas: [{ partida: 'Muro M1', cantidad: 1, unidad: 'm2', origen: 'x' }] }))), 'ORIGEN_MEZCLADO');
});
