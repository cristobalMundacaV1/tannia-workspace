// G2: sitio, norte verdadero, fuentes y restricciones: nada se infiere; sin norte no hay solar; sin CIP no hay «cumple».
import test from 'node:test';
import assert from 'node:assert/strict';
import { actualizarSitio, antecedentesFaltantes, agregarRestriccionUrbana, verificarContraSitio, predioRectangular, estadoSitio } from '../src/architect/sitio.js';
import { generarPartido } from '../src/architect/partidos.js';
import { sitioVacio } from '../src/architect/schemas.js';

const prog = { superficie_m2: 90, dormitorios: 3, banos: 2 };

test('sitio vacío: insuficiente para estudio solar y con lista concreta de antecedentes faltantes', () => {
  const s = sitioVacio(); assert.equal(estadoSitio(s), 'insufficient_for_real_solar_study');
  const f = antecedentesFaltantes(s).map((x) => x.id); for (const x of ['predio', 'acceso', 'coordenadas', 'zona_horaria', 'norte', 'cip_prc']) assert.ok(f.includes(x), x);
});

test('predio sin norte: parcel_known_only; con coordenadas+zona+norte confirmado: solar_study_possible; norte supuesto NO habilita', () => {
  let s = actualizarSitio(null, { predio: { anillo: predioRectangular(12000, 28000) } }); assert.equal(s.status, 'parcel_known_only');
  s = actualizarSitio(s, { coordenadas: { lat: -33.45, lon: -70.67 }, zona_horaria: 'America/Santiago', norte_grados: 20, norte_estado: 'assumed' }); assert.equal(s.status, 'parcel_known_only');
  s = actualizarSitio(s, { norte_grados: 20, norte_estado: 'confirmed', norte_fuente: 'levantamiento' }); assert.equal(s.status, 'solar_study_possible');
  assert.equal(s.true_north_deg_from_local_plus_y_clockwise.valor, 20);
  s = actualizarSitio(s, { norte_grados: -90 }); assert.equal(s.true_north_deg_from_local_plus_y_clockwise.valor, 270);
});

test('entradas inválidas: zona IANA falsa, polígono autointersectado, predio no ortogonal, 2 vértices', () => {
  assert.throws(() => actualizarSitio(null, { zona_horaria: 'Chile/Norte-Sur' }), /IANA/);
  assert.throws(() => actualizarSitio(null, { predio: { anillo: [[0, 0], [10000, 10000], [10000, 0], [0, 10000]] } }), /autointersecta|ortogonal/);
  assert.throws(() => actualizarSitio(null, { predio: { anillo: [[0, 0], [10000, 3000], [5000, 9000]] } }), /ortogonal/);
  assert.throws(() => actualizarSitio(null, { predio: { anillo: [[0, 0], [1, 1]] } }), /3 vértices/);
  assert.throws(() => predioRectangular(500, 500), /1 m/);
});

test('restricción urbana: exige fuente registrada y fecha; ocupación solo se verifica con fuente; nunca «cumple»', () => {
  let s = actualizarSitio(null, { predio: { anillo: predioRectangular(12000, 28000) } });
  assert.throws(() => agregarRestriccionUrbana(s, { requisito: 'ocupacion_max_pct', valor: 60, fuente_id: 'x', fecha_fuente: '2026-01-01' }), /fuente/);
  s = actualizarSitio(s, { fuentes: [{ id: 'cip1', tipo: 'cip', ref: 'CIP N°123 (páginas 1-2 revisadas)', sha256: 'a'.repeat(64) }] });
  assert.throws(() => agregarRestriccionUrbana(s, { requisito: 'ocupacion_max_pct', valor: 60, fuente_id: 'cip1' }), /fecha/);
  const geo = generarPartido('compacta', prog).geo;
  const sin = verificarContraSitio(geo, s); assert.equal(sin.verificaciones.find((v) => v.id === 'ocupacion').estado, 'no_evaluable');
  s = agregarRestriccionUrbana(s, { requisito: 'ocupacion_max_pct', valor: 20, fuente_id: 'cip1', fecha_fuente: '2026-03-01' });
  const con = verificarContraSitio(geo, s); const oc = con.verificaciones.find((v) => v.id === 'ocupacion');
  assert.ok(['consistente_con_dato', 'no_consistente'].includes(oc.estado)); assert.equal(oc.estado, 'no_consistente'); // 90/336 ≈ 27 % > 20 %
  const txt = JSON.stringify(con); assert.ok(!/"cumple"|cumple la norma/.test(txt)); assert.match(con.aviso, /no es certificación/);
});

test('el nombre de una comuna jamás produce restricciones: urban_constraints sigue vacío', () => {
  const s = actualizarSitio(null, { coordenadas: { lat: -33.45, lon: -70.67, fuente: 'comuna Providencia (dato de usuaria)' } });
  assert.deepEqual(s.urban_constraints, []); assert.ok(antecedentesFaltantes(s).some((x) => x.id === 'cip_prc'));
});

test('obstáculos de altura desconocida quedan unknown y piden dato', () => {
  const s = actualizarSitio(null, { obstaculos: [{ anillo: [[0, 0], [5000, 0], [5000, 5000], [0, 5000]] }] });
  assert.equal(s.context_obstacles[0].height_status, 'unknown'); assert.equal(s.context_obstacles[0].height_mm, null); assert.ok(antecedentesFaltantes(s).some((x) => x.id === 'alturas_vecinos'));
});
