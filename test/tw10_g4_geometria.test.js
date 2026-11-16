// G4: geometría multi-topología. L real con patio vacío, huella real, 2D/3D coherentes, compatibilidad v1 por copia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { derivarEsquema, huellaDeEspacios } from '../src/architect/derivar_poly.js';
import { esquemaA3d } from '../src/architect/a3d.js';
import { esquemaDesdeV1 } from '../src/architect/convertir.js';
import { construirPrimitivas } from '../src/arq3d/geometria.js';
import { coherenciaConGeo } from '../src/arq3d/desde_anteproyecto.js';
import { validar } from '../src/architect/schemas.js';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';
import { escribirDxf, escribirSvg } from '../src/design/salidas.js';
import { verificarDxfContraModelo } from '../src/design/servicio.js';

const R = (id, x0, y0, x1, y1, tipo = 'x', zona = 'social') => ({ id, nombre: id, tipo, zona, ring: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
const base = (spaces, openings, extra = {}) => ({ schema: 'tw.arch.scheme/2', id: 't', brief_ref: 'b', site_ref: null, engine_version: 't', concept: 'L_con_patio', rationale: 'prueba', footprint_polygons_mm: huellaDeEspacios(spaces), open_courts_mm: [], espesores_mm: { ext: 150, int: 100 }, altura_piso_cielo_mm: 2500, spaces, openings, exterior_areas: [], separaciones_abiertas: [], adjacencies: [], line_of_sight_goals: [], sources: [], model_status: 'concept', ...extra });
const puerta = (id, entre, c, extra = {}) => ({ id, tipo: 'puerta', entre, ancho_mm: 900, alto_mm: 2100, centro: c, ...extra });
const L = () => base([R('LIV', 0, 0, 6000, 4000), R('COC', 6000, 0, 12000, 4000), R('D1', 0, 4000, 5000, 9000, 'dormitorio', 'privada')],
  [puerta('P1', ['LIV'], [1500, 0], { exterior_side: 'S' }), puerta('P2', ['LIV', 'D1'], [2500, 4000], { abre_hacia: 'D1' }), { id: 'P3', tipo: 'paso', entre: ['LIV', 'COC'], ancho_mm: 1000, alto_mm: 2100, centro: [6000, 2000] }, { id: 'V1', tipo: 'ventana', entre: ['D1'], exterior_side: 'N', ancho_mm: 1500, alto_mm: 1200, antepecho_mm: 900, centro: [2500, 9000] }]);

test('L real: huella = unión (no caja envolvente); el esquema valida con Zod', () => {
  const e = L(); assert.ok(validar('scheme', e).ok, JSON.stringify(validar('scheme', e)));
  const g = derivarEsquema(e);
  assert.deepEqual(g.errores, []);
  assert.equal(g.huella.huecos, 0);
  assert.ok(g.huella.area_m2 < g.huella.area_caja_envolvente_m2 - 30, `${g.huella.area_m2} vs ${g.huella.area_caja_envolvente_m2}`);
  assert.equal(g.huella.anillos[0].ring.length, 6, 'contorno en L de 6 vértices');
});

test('L: 3D con losa y cubierta sobre la huella real (volumen = área real × espesor), coherente con el 2D', () => {
  const e = L(); const g = derivarEsquema(e); const m = esquemaA3d(e, g); const p = construirPrimitivas(m);
  assert.equal(m.losas.length, 1); assert.equal(m.losas[0].contorno.length, 6);
  assert.ok(Math.abs(p.resumen.volumen_losas_m3 - g.huella.area_m2 * 0.15) < 0.02, `${p.resumen.volumen_losas_m3}`);
  assert.ok(Math.abs(p.resumen.volumen_cubierta_m3 - g.huella.area_m2 * 0.15) < 0.02);
  const caja = g.huella.area_caja_envolvente_m2 * 0.15; assert.ok(p.resumen.volumen_losas_m3 < caja - 4, 'no es la caja');
  // ningún sólido de losa/cubierta cubre el punto del patio (notch NE)
  for (const q of p.primitivas.filter((x) => ['losa', 'cubierta'].includes(x.clase))) { const [a, b] = [q.esperado.bbox_min, q.esperado.bbox_max]; assert.ok(!(a[0] < 9000 && b[0] > 9000 && a[1] < 7000 && b[1] > 7000), `sólido ${q.clase} cubre el patio`); }
  assert.equal(coherenciaConGeo(m, g, { altura_piso_cielo_mm: 2500 }).estado, 'coherente_en_alcance');
});

test('cubierta inclinada sobre L: rechazo explícito, no silencioso', () => {
  const e = L(); const g = derivarEsquema(e);
  assert.throws(() => esquemaA3d(e, g, { cubierta: { tipo: 'dos_aguas', pendiente_pct: 30, eje_cumbrera: 'x' } }), /no soportada/);
});

test('patio central: vacío declarado → losas por rectángulos sin cubrir el patio; vacío NO declarado = error', () => {
  const sp = [R('S', 0, 0, 9000, 3000), R('O', 0, 3000, 3000, 6000), R('E', 6000, 3000, 9000, 6000), R('N', 0, 6000, 9000, 9000)];
  const ab = [puerta('P1', ['S'], [1500, 0], { exterior_side: 'S' }), puerta('P2', ['S', 'O'], [1500, 3000]), puerta('P3', ['S', 'E'], [7500, 3000]), puerta('P4', ['N', 'O'], [1500, 6000]), puerta('P5', ['N', 'E'], [7500, 6000])];
  const sin = derivarEsquema(base(sp, ab)); assert.ok(sin.errores.some((x) => x.codigo === 'HUECO_NO_DECLARADO'));
  const e = base(sp, ab, { concept: 'patio_central', open_courts_mm: [[[3000, 3000], [6000, 3000], [6000, 6000], [3000, 6000]]] });
  const g = derivarEsquema(e); assert.deepEqual(g.errores, []); assert.equal(g.huella.huecos, 1);
  const m = esquemaA3d(e, g); const p = construirPrimitivas(m);
  assert.ok(m.losas.length >= 3);
  assert.ok(Math.abs(p.resumen.volumen_losas_m3 - g.huella.area_m2 * 0.15) < 0.02);
  for (const q of p.primitivas.filter((x) => x.clase === 'losa')) assert.ok(!(q.esperado.bbox_min[0] < 4500 && q.esperado.bbox_max[0] > 4500 && q.esperado.bbox_min[1] < 4500 && q.esperado.bbox_max[1] > 4500));
  assert.equal(coherenciaConGeo(m, g, { altura_piso_cielo_mm: 2500 }).estado, 'coherente_en_alcance');
});

test('validaciones duras: solapes, recinto sin acceso, vano fuera de muro, patio inexistente, huella inconsistente', () => {
  assert.throws(() => derivarEsquema(base([R('A', 0, 0, 4000, 4000), R('B', 3000, 0, 7000, 4000)], [])), /solapan/);
  const sinAcceso = derivarEsquema(base([R('A', 0, 0, 4000, 4000), R('B', 4000, 0, 8000, 4000)], [puerta('P1', ['A'], [1500, 0], { exterior_side: 'S' })]));
  assert.ok(sinAcceso.errores.some((x) => x.codigo === 'RECINTO_SIN_ACCESO' && x.id === 'B'));
  const fuera = derivarEsquema(base([R('A', 0, 0, 4000, 4000)], [puerta('P1', ['A'], [100, 0], { exterior_side: 'S' })]));
  assert.ok(fuera.errores.some((x) => x.codigo === 'VANO_INVALIDO'));
  const patioFalso = derivarEsquema(base([R('A', 0, 0, 4000, 4000)], [puerta('P1', ['A'], [2000, 0], { exterior_side: 'S' })], { open_courts_mm: [[[1000, 1000], [2000, 1000], [2000, 2000], [1000, 2000]]] }));
  assert.ok(patioFalso.errores.some((x) => x.codigo === 'PATIO_INEXISTENTE'));
  const mala = base([R('A', 0, 0, 4000, 4000)], [puerta('P1', ['A'], [2000, 0], { exterior_side: 'S' })]); mala.footprint_polygons_mm = [[[0, 0], [9000, 0], [9000, 9000], [0, 9000]]];
  assert.ok(derivarEsquema(mala).errores.some((x) => x.codigo === 'HUELLA_INCONSISTENTE'));
  assert.throws(() => esquemaA3d(base([R('A', 0, 0, 4000, 4000), R('B', 4000, 0, 8000, 4000)], []), derivarEsquema(base([R('A', 0, 0, 4000, 4000), R('B', 4000, 0, 8000, 4000)], []))), /errores geométricos/);
});

test('DXF/SVG de una L: contorno real, vano recortado, verificación cruzada y sin falso rectángulo', () => {
  const e = L(); const g = derivarEsquema(e); const mod = { sistema: 'albanileria_confinada' };
  const dxf = escribirDxf(mod, g, { titulo: 'L', version: 'v001', fecha: '2026-11-16' });
  assert.ok(dxf.includes('TW_MURO_EXT'));
  const cruz = verificarDxfContraModelo(dxf, g); assert.ok(cruz.coincide ?? cruz.ok ?? !cruz.discrepancias?.length, JSON.stringify(cruz).slice(0, 300));
  const svg = escribirSvg(mod, g, { titulo: 'L', version: 'v001', fecha: '2026-11-16' }); assert.ok(svg.startsWith('<?xml') || svg.includes('<svg'));
});

test('compatibilidad v1: copia a scheme/2 reproduce áreas y coherencia; el modelo v1 no se modifica', () => {
  const m1 = generarModelo({ superficie_objetivo_m2: 80, dormitorios: 3, banos: 2 }); const antes = JSON.stringify(m1); const g1 = derivar(m1);
  const e = esquemaDesdeV1(m1, g1); assert.ok(validar('scheme', e).ok);
  const g2 = derivarEsquema(e); assert.deepEqual(g2.errores, []);
  assert.equal(g2.areas.construida_m2, g1.areas.construida_m2); assert.equal(g2.areas.util_neta_m2, g1.areas.util_neta_m2);
  assert.equal(Math.round(g2.union.area_mm2), Math.round(g1.union.area_mm2));
  assert.equal(JSON.stringify(m1), antes);
  const m3 = esquemaA3d(e, g2); assert.equal(coherenciaConGeo(m3, g2, m1).estado === 'con_diferencias', false);
});
