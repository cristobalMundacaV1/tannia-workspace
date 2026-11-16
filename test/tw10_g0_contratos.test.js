// TW10-00-03: contratos Zod versionados y política epistémica.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validar, sitioVacio, climaVacio, SCHEMA_IDS, desconocido, supuesto, dato } from '../src/architect/schemas.js';
import { z } from 'zod';

const brief = () => ({ schema: SCHEMA_IDS.brief, project_id: 'p1', version: 1, request_original: 'Casa de 90 m2, 3 dormitorios', program: [{ id: 'living', usage: 'social', target_area_m2: 22 }], household: { needs: ['teletrabajo'] },
  objectives: [{ id: 'o1', kind: 'sightline', from: 'cocina', to: 'piscina', priority: 'high', evidence: 'user_statement', status: 'confirmed' }], hard_constraints: [{ id: 'h1', kind: 'one_story', status: 'confirmed' }], preferences: [], unknowns: ['site_dimensions'], review_required: ['child_pool_access_barriers'] });

test('brief/1 válido y estricto (campos desconocidos rechazados)', () => {
  assert.ok(validar('brief', brief()).ok);
  const r = validar('brief', { ...brief(), edad_hijos: [3, 5] }); assert.equal(r.ok, false);
  assert.equal(validar('brief', { ...brief(), schema: 'tw.arch.brief/2' }).ok, false);
});

test('site/1 y weather/1 vacíos son válidos y no contienen datos inventados', () => {
  const s = sitioVacio(); assert.ok(validar('site', s).ok);
  assert.equal(s.coordinates, null); assert.equal(s.parcel_polygon_mm, null); assert.equal(s.true_north_deg_from_local_plus_y_clockwise, null);
  assert.equal(s.status, 'insufficient_for_real_solar_study');
  assert.ok(validar('weather', climaVacio()).ok);
});

test('política epistémica: unknown no lleva valor; confirmed/assumed lo exigen', () => {
  const D = dato(z.number());
  assert.ok(D.safeParse(desconocido()).success);
  assert.ok(D.safeParse(supuesto(10, 'supuesto editable')).success);
  assert.equal(D.safeParse({ valor: 5, estado: 'unknown' }).success, false);
  assert.equal(D.safeParse({ valor: null, estado: 'confirmed' }).success, false);
});

test('decision/1: nunca un número ilustrativo como calculado', () => {
  const d = (ev) => ({ schema: SCHEMA_IDS.decision, id: 'd1', goal_id: 'o1', decision: 'alero', candidate_ids: ['a'], selected: 'a', evidence: [ev], tradeoffs: [], uncertainty: [], status: 'proposed_pending_evidence', requires_professional_review: true });
  assert.ok(validar('decision', d({ type: 'calculation', metric: 'sol', value: null, status: 'not_computed' })).ok);
  assert.equal(validar('decision', d({ type: 'calculation', metric: 'sol', value: 4.5, status: 'not_computed' })).ok, false);
  assert.equal(validar('decision', d({ type: 'calculation', metric: 'sol', value: 4.5, status: 'computed' })).ok, false); // sin método/hash
  assert.ok(validar('decision', d({ type: 'calculation', metric: 'sol', value: 4.5, status: 'computed', method: 'raycast', input_hash: 'abc' })).ok);
});

test('weather/1: un clima de archivo nunca es "validated"; EPW cargado exige hash', () => {
  const w = { ...climaVacio(), source_kind: 'epw', status: 'loaded', representativeness: 'regional', source_sha256: null };
  assert.equal(validar('weather', w).ok, false);
  assert.ok(validar('weather', { ...w, source_sha256: 'a'.repeat(64) }).ok);
  assert.equal(validar('weather', { ...w, source_sha256: 'a'.repeat(64), representativeness: 'validated' }).ok, false);
});

test('analysis/1: métrica no calculada no puede traer valor; estado global sin "excelente"', () => {
  const a = { schema: SCHEMA_IDS.analysis, scheme_id: 's', input_hash: 'x', engine_version: 'e', hard_gates: [], metrics: [{ id: 'm', familia: 'sol', estado: 'inconclusive', valor: 3, metodo: 'x', limites: 'y' }], alerts: [], global_state: 'no_conclusive', disclaimers: ['anteproyecto'] };
  assert.equal(validar('analysis', a).ok, false);
  a.metrics[0].valor = null; assert.ok(validar('analysis', a).ok);
  assert.equal(validar('analysis', { ...a, global_state: 'excelente' }).ok, false);
});
