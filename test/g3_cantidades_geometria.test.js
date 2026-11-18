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
  const m = modeloDesdeEspecificacion(base()); const t = m.quantity_totals.find((q) => q.id === 'total-Muro M1');
  assert.ok(Math.abs(t.valor - (6 * 2.4 - 0.9 * 2.0 - 1.2 * 1.0)) < 1e-9, String(t.valor)); assert.equal(t.unidad, 'm2');
  assert.match(m.quantities.find((q) => q.id === 'vano-p').formula, /^DESCUENTO/);
  assert.equal(m.quantities.find((q) => q.id === 'vanos').valor, 2);
  assert.ok(m.quantities.every((q) => /MEDIDA/.test(q.naturaleza) && /TW-MED\/1/.test(q.metodo) && q.fila === 'detalle'));
  // Ítem 5 de la revisión: el detalle y los totales están SEPARADOS; sumar el detalle de una partida reproduce su total.
  assert.ok(!m.quantities.some((q) => q.fila === 'total') && m.quantity_totals.every((q) => q.fila === 'total'));
  assert.ok(Math.abs(m.quantities.filter((q) => q.partida === 'Muro M1').reduce((a, q) => a + q.valor, 0) - t.valor) < 1e-12);
});

test('cambio geométrico (L 6 → 6,35 m) cambia la cantidad y la huella del modelo', () => {
  const a = modeloDesdeEspecificacion(base()); const b = modeloDesdeEspecificacion(base(6.35));
  const t = (m) => m.quantity_totals.find((q) => q.id === 'total-Muro M1').valor;
  assert.ok(Math.abs(t(b) - t(a) - 0.35 * 2.4) < 1e-9); assert.notEqual(digest(a), digest(b));
});

test('cantidades inventadas, unidades incompatibles, fuentes inexistentes y duplicados se rechazan', () => {
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { cantidades: [{ partida: 'Muro', cantidad: 999, unidad: 'm2' }] }))), 'CANTIDADES_NO_DERIVADAS');
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'x', metodo: 'area', fuentes: ['elev/muro'], unidad: 'm3' }] }))), 'UNIDAD_INCOMPATIBLE');
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'x', metodo: 'longitud', fuentes: ['elev/fantasma'] }] }))), 'FUENTE_INEXISTENTE');
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'a', partida: 'P', metodo: 'area', fuentes: ['elev/muro'] }, { id: 'b', partida: 'P', metodo: 'area', fuentes: ['elev/muro'] }] }))), 'MEDICION_DUPLICADA');
  // Un descuento de área mayor que el contorno medido no está contenido en él (rechazo topológico) …
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'a', partida: 'P', metodo: 'area', fuentes: ['elev/puerta'] }, { id: 'b', partida: 'P', metodo: 'area', fuentes: ['elev/muro'], signo: -1 }] }))), 'DESCUENTO_FUERA_DEL_CONTORNO');
  // … y en longitudes, descuentos que superan lo medido siguen dando MEDICION_INVALIDA.
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { mediciones: [{ id: 'a', partida: 'P', metodo: 'longitud', fuentes: ['elev/puerta'] }, { id: 'b', partida: 'P', metodo: 'longitud', fuentes: ['elev/muro'], signo: -1 }] }))), 'MEDICION_INVALIDA');
});

test('cantidad declarada: exige origen y queda rotulada como NO medida desde el plano; no se mezcla con medidas', () => {
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { cantidades_declaradas: [{ partida: 'Excavación', cantidad: 12, unidad: 'm3' }] }))), 'DATOS_INVALIDOS');
  const m = modeloDesdeEspecificacion(base(6, 2.4, { cantidades_declaradas: [{ partida: 'Excavación', cantidad: 12, unidad: 'm3', origen: 'EETT del mandante, partida 2.1' }] }));
  const d = m.quantities.find((q) => q.partida === 'Excavación'); assert.equal(d.metodo, 'DECLARADA'); assert.match(d.naturaleza, /no medida desde el plano.*EETT/);
  assert.equal(code(() => modeloDesdeEspecificacion(base(6, 2.4, { cantidades_declaradas: [{ partida: 'Muro M1', cantidad: 1, unidad: 'm2', origen: 'x' }] }))), 'ORIGEN_MEZCLADO');
});

// ---- Regresiones de la revisión independiente de PR #33 ----
const conElemento = (mediciones) => base(6, 2.4, {
  vistas: [
    { id: 'planta', titulo: 'Planta', tipo: 'planta', escala: 50, elementos: [{ id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: 6, alto: 0.2 }] },
    { id: 'elev', titulo: 'Elevación', tipo: 'elevacion', escala: 50, elementos: [{ id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: 6, alto: 2.4 }] },
  ],
  laminas: [{ id: '01', titulo: 'Planta', vistas: ['planta'] }, { id: '02', titulo: 'Elevación', vistas: ['elev'] }],
  elementos_fisicos: [{ id: 'M1', tipo: 'muro', fuentes: ['elev/muro'], representaciones: ['planta/muro'] }], mediciones,
});

test('ítem 1: el mismo muro dibujado en planta y elevación no se mide dos veces (identidad física y rol fuente)', () => {
  assert.equal(code(() => modeloDesdeEspecificacion(conElemento([{ id: 'a', partida: 'Muro', metodo: 'area', fuentes: ['elev/muro'] }, { id: 'b', partida: 'Muro', metodo: 'area', fuentes: ['planta/muro'] }]))), 'MEDICION_NO_AUTORIZADA');
  const dos = conElemento([{ id: 'a', partida: 'Muro', metodo: 'area', fuentes: ['elev/muro'] }]);
  dos.elementos_fisicos = [{ id: 'M1', tipo: 'muro', fuentes: ['elev/muro', 'planta/muro'] }];
  dos.mediciones = [{ id: 'a', partida: 'Muro', metodo: 'area', fuentes: ['elev/muro'] }, { id: 'b', partida: 'Muro', metodo: 'area', fuentes: ['planta/muro'] }];
  assert.equal(code(() => modeloDesdeEspecificacion(dos)), 'MEDICION_DUPLICADA');
  dos.mediciones = [{ id: 'a', partida: 'Muro', metodo: 'area', fuentes: ['elev/muro', 'planta/muro'] }];
  assert.equal(code(() => modeloDesdeEspecificacion(dos)), 'MEDICION_DUPLICADA', 'una sola medición tampoco puede sumar dos vistas del mismo elemento');
  const ok = modeloDesdeEspecificacion(conElemento([{ id: 'a', partida: 'Muro', metodo: 'area', fuentes: ['elev/muro'] }]));
  assert.ok(Math.abs(ok.quantities[0].valor - 6 * 2.4) < 1e-12);
});

test('ítem 4: contornos autointersectantes, con retroceso, degenerados o con vértices repetidos no son superficie física', () => {
  const poli = (puntos) => base(6, 2.4, { vistas: [{ id: 'v', titulo: 'V', tipo: 'planta', escala: 50, elementos: [{ id: 'p', tipo: 'polilinea', capa: 'MUROS', puntos, cerrada: true }] }], laminas: [{ id: '01', titulo: 'V', vistas: ['v'] }], mediciones: [{ id: 'a', metodo: 'area', fuentes: ['v/p'] }] });
  assert.equal(code(() => modeloDesdeEspecificacion(poli([[0, 0], [4, 4], [4, 0], [0, 4]]))), 'CONTORNO_NO_SIMPLE', 'pajarita (Gauss daría 0 pero también caso general)');
  assert.equal(code(() => modeloDesdeEspecificacion(poli([[0, 0], [6, 0], [6, 3], [2, -1], [0, 3]]))), 'CONTORNO_NO_SIMPLE', 'autointersección con área de Gauss positiva');
  assert.equal(code(() => modeloDesdeEspecificacion(poli([[0, 0], [4, 0], [2, 0], [2, 3]]))), 'CONTORNO_NO_SIMPLE', 'retroceso colineal');
  assert.equal(code(() => modeloDesdeEspecificacion(poli([[0, 0], [4, 0], [4, 3], [4, 0], [0, 3]]))), 'CONTORNO_NO_SIMPLE', 'vértice repetido');
  assert.equal(code(() => modeloDesdeEspecificacion(poli([[0, 0], [2, 0], [4, 0]]))), 'CONTORNO_NO_SIMPLE', 'sin superficie');
  const L = modeloDesdeEspecificacion(poli([[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]])); assert.ok(Math.abs(L.quantities[0].valor - (4 * 1 + 1 * 2)) < 1e-12, 'polígono en L (no convexo, simple): área a mano');
});

test('ítem 4 (huecos mal definidos): un descuento fuera del contorno o vanos superpuestos no restan superficie', () => {
  const muro = (vanos) => base(6, 2.4, { vistas: [{ id: 'elev', titulo: 'Elevación', tipo: 'elevacion', escala: 50, elementos: [{ id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: 6, alto: 2.4 }, ...vanos.map((v, i) => ({ id: `v${i}`, tipo: 'rectangulo', capa: 'VANOS', ...v }))] }],
    mediciones: [{ id: 'bruto', partida: 'Muro', metodo: 'area', fuentes: ['elev/muro'] }, ...vanos.map((_, i) => ({ id: `d${i}`, partida: 'Muro', metodo: 'area', fuentes: [`elev/v${i}`], signo: -1 }))] });
  assert.equal(code(() => modeloDesdeEspecificacion(muro([{ origen: [7, 0], ancho: 1, alto: 2 }]))), 'DESCUENTO_FUERA_DEL_CONTORNO', 'vano completamente fuera del muro');
  assert.equal(code(() => modeloDesdeEspecificacion(muro([{ origen: [5.5, 0], ancho: 1, alto: 2 }]))), 'DESCUENTO_FUERA_DEL_CONTORNO', 'vano que sobresale del muro');
  assert.equal(code(() => modeloDesdeEspecificacion(muro([{ origen: [1, 0], ancho: 1, alto: 2 }, { origen: [1.5, 0.5], ancho: 1, alto: 1 }]))), 'DESCUENTOS_SUPERPUESTOS', 'dos vanos superpuestos restarían dos veces');
  const ok = modeloDesdeEspecificacion(muro([{ origen: [1, 0], ancho: 0.9, alto: 2 }, { origen: [3.5, 1], ancho: 1.2, alto: 1 }]));
  assert.ok(Math.abs(ok.quantity_totals[0].valor - (6 * 2.4 - 1.8 - 1.2)) < 1e-12, 'vanos válidos (uno apoyado en el borde inferior) se descuentan');
});

test('ítem 4: vano en el entrante de un muro en L (dentro del rectángulo envolvente, fuera del muro) no se descuenta', () => {
  const s = base(6, 2.4, { vistas: [{ id: 'v', titulo: 'V', tipo: 'elevacion', escala: 50, elementos: [{ id: 'L', tipo: 'polilinea', capa: 'MUROS', puntos: [[0, 0], [6, 0], [6, 1], [2, 1], [2, 3], [0, 3]], cerrada: true }, { id: 'h', tipo: 'rectangulo', capa: 'VANOS', origen: [3, 1.5], ancho: 1, alto: 1 }] }],
    laminas: [{ id: '01', titulo: 'V', vistas: ['v'] }], mediciones: [{ id: 'a', partida: 'Muro', metodo: 'area', fuentes: ['v/L'] }, { id: 'b', partida: 'Muro', metodo: 'area', fuentes: ['v/h'], signo: -1 }] });
  assert.equal(code(() => modeloDesdeEspecificacion(s)), 'DESCUENTO_FUERA_DEL_CONTORNO');
});

test('ítem 5: contrato tw.cantidades/1 — se suma solo el detalle, el total es de control y una fila total o mixta se rechaza', async () => {
  const { documentoCantidades, cantidadPartida, ESQUEMA_CANTIDADES } = await import('../src/drawing/cantidades_contrato.js');
  const m = modeloDesdeEspecificacion(base()); const doc = documentoCantidades(m, { modelo_sha256: digest(m), revision: 'r-x' });
  assert.equal(doc.schema, ESQUEMA_CANTIDADES);
  const q = cantidadPartida(doc, 'Muro M1'); assert.ok(Math.abs(q.valor - (6 * 2.4 - 1.8 - 1.2)) < 1e-12); assert.deepEqual(q.filas, ['bruto', 'vano-p', 'vano-v']); assert.equal(q.modelo_sha256, digest(m));
  const contaminado = { ...doc, detalle: [...doc.detalle, ...doc.totales] }; assert.throws(() => cantidadPartida(contaminado, 'Muro M1'), /Solo se suman filas de detalle/);
  assert.throws(() => documentoCantidades({ quantities: [...m.quantities, ...m.quantity_totals], quantity_totals: [] }, {}), /mal clasificadas/);
  const alterado = { ...doc, totales: doc.totales.map((t) => ({ ...t, valor: t.valor + 1 })) }; assert.throws(() => cantidadPartida(alterado, 'Muro M1'), /no coincide con su total de control/);
});
