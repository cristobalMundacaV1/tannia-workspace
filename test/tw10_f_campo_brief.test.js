// Auditoría de campo G10 — F02 (necesidades perdidas) y F03 (continuidad del brief). Fixtures aislados; no tocan proyectos reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { interpretarEncargo, detectarVistas } from '../src/architect/briefing.js';
import { Estudios } from '../src/architect/servicio.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures_tw10/${n}`, import.meta.url), 'utf8');
const ROBLES = fx('encargo_los_robles.txt'); const CAMPO = fx('encargo_los_robles_variante_campo.txt');
const kinds = (b) => b.objectives.map((o) => o.kind);
const dur = (b) => Object.fromEntries(b.hard_constraints.map((h) => [h.kind, h.value ?? true]));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

for (const [nombre, texto] of [['mensaje de prueba entregado', ROBLES], ['variante con las palabras del campo', CAMPO]]) {
  test(`F02 — ${nombre}: registra visual cocina→piscina, iluminación, frescura, circulación, patio y ahorro`, () => {
    const r = interpretarEncargo(texto, { projectId: 'p' }); const k = kinds(r.brief);
    for (const x of ['sightline', 'daylight_preference', 'summer_cooling', 'circulation_minimal', 'courtyard', 'cost_saving']) assert.ok(k.includes(x), `${x} ∈ ${k}`);
    const s = r.brief.objectives.find((o) => o.kind === 'sightline'); assert.equal(s.from, 'R-COC'); assert.equal(s.to, 'pool_play_zone'); assert.equal(s.priority, 'high'); assert.equal(s.status, 'confirmed');
    assert.ok(r.brief.objectives.some((o) => o.kind === 'pool_supervision' && o.status === 'assumed'));
    assert.equal(dur(r.brief).area_target, 90); assert.equal(dur(r.brief).bedrooms, 3); assert.equal(dur(r.brief).bathrooms, 2); assert.deepEqual(r.ambiguedades, []);
  });
}

test('F02 — expresiones equivalentes razonables (visual, luz, presupuesto)', () => {
  const vis = ['Quiero ver a mis hijos desde la cocina, juegan en la piscina.', 'Desde la cocina quiero poder vigilar la piscina.', 'La piscina tiene que verse desde la cocina.', 'Quiero la cocina con vista a la piscina.', 'Mis niños juegan en el patio y quiero tenerlos a la vista desde el living.', 'Que desde la cocina se vea el patio.'];
  for (const t of vis) { const r = interpretarEncargo(`Casa de 90 m2. ${t}`); assert.ok(r.brief.objectives.some((o) => o.kind === 'sightline'), t); }
  assert.equal(interpretarEncargo('Casa de 90 m2. Mis niños juegan en el patio y quiero tenerlos a la vista desde el living.').brief.objectives.find((o) => o.kind === 'sightline').from, 'R-LIV');
  for (const t of ['mucha iluminación natural', 'entre mucha luz', 'casa muy luminosa', 'ventanales grandes']) assert.ok(kinds(interpretarEncargo(`Casa de 90 m2, ${t}`).brief).includes('daylight_preference'), t);
  for (const t of ['cuidar el presupuesto', 'hay que cuidar la plata', 'presupuesto ajustado', 'quiero ahorrar', 'no pasarme del presupuesto', 'costos bajos']) assert.ok(kinds(interpretarEncargo(`Casa de 90 m2, ${t}`).brief).includes('cost_saving'), t);
  const b = interpretarEncargo('Casa de 90 m2, mi presupuesto es de 80 millones').brief; assert.equal(b.budget.status, 'confirmed'); assert.ok(!b.unknowns.includes('budget')); assert.ok(!kinds(b).includes('cost_saving'), 'un monto no es una orden de ahorrar');
});

test('F02 — referencias ambiguas generan PREGUNTA, no inferencia', () => {
  for (const [t, cod] of [['Quiero verlos desde la cocina.', 'VISTA_OBJETO_AMBIGUO'], ['Quiero ver a mis hijos desde la cocina.', 'VISTA_OBJETO_AMBIGUO'], ['Tengo patio y piscina y quiero ver ambos desde la cocina.', 'VISTA_OBJETO_AMBIGUO'], ['Quiero ver el patio desde un dormitorio.', 'VISTA_DORMITORIO_AMBIGUO']]) {
    const r = interpretarEncargo(`Casa de 90 m2. ${t}`); assert.ok(!kinds(r.brief).includes('sightline'), t); assert.ok(r.ambiguedades.some((a) => a.codigo === cod), `${t} → ${JSON.stringify(r.ambiguedades)}`); assert.ok(r.preguntas.some((q) => /\?/.test(q)));
  }
  assert.equal(detectarVistas('hola').vistas.length, 0);
});

test('F03 — actualización incremental conserva requisitos, prioridades y antecedentes; el original no cambia', () => {
  const a = interpretarEncargo(ROBLES, { projectId: 'p' }).brief;
  const r = interpretarEncargo('Cambia a 4 dormitorios y quiero además privacidad en los dormitorios.', { projectId: 'p', previo: a }); assert.equal(r.modo, 'actualizar'); const b = r.brief;
  assert.equal(dur(b).bedrooms, 4); assert.equal(dur(b).area_target, 90); assert.equal(dur(b).bathrooms, 2); assert.equal(dur(b).footprint_class, 'L_con_patio'); assert.ok(dur(b).one_story);
  for (const x of kinds(a)) assert.ok(kinds(b).includes(x), `se perdió ${x}`); assert.ok(kinds(b).includes('privacy'));
  assert.equal(b.request_original, a.request_original); assert.equal(b.version, 2); assert.deepEqual(b.request_updates.map((u) => u.version), [2]);
  assert.equal(b.objectives.find((o) => o.kind === 'sightline').id, a.objectives.find((o) => o.kind === 'sightline').id, 'ids estables');
  assert.equal(a.version, 1); assert.equal(dur(a).bedrooms, 3, 'el brief previo no se mutó');
});

test('F03 — A→B→A: volver al valor original restituye el encargo sin pérdidas', () => {
  const A = interpretarEncargo(ROBLES, { projectId: 'p' }).brief; const B = interpretarEncargo('Ahora quiero 110 m² y 4 dormitorios.', { projectId: 'p', previo: A }).brief; const A2 = interpretarEncargo('Mejor vuelve a 90 m² y a 3 dormitorios.', { projectId: 'p', previo: B }).brief;
  assert.deepEqual(dur(A2), dur(A)); assert.deepEqual(kinds(A2).sort(), kinds(A).sort()); assert.equal(A2.version, 3); assert.equal(A2.request_original, A.request_original); assert.equal(dur(B).area_target, 110);
  assert.deepEqual(A2.objectives.map((o) => [o.kind, o.priority]).sort(), A.objectives.map((o) => [o.kind, o.priority]).sort());
});

test('F03 — retiro explícito sí elimina; cambios relativos o sin reconocer NO cambian nada y preguntan', () => {
  const A = interpretarEncargo(ROBLES, { projectId: 'p' }).brief;
  const sin = interpretarEncargo('Ya no quiero la piscina.', { projectId: 'p', previo: A }).brief; assert.ok(!sin.program.some((p) => p.id === 'piscina')); assert.ok(!kinds(sin).includes('sightline') && !kinds(sin).includes('pool_supervision')); assert.equal(dur(sin).area_target, 90); assert.ok(kinds(sin).includes('courtyard'));
  const rel = interpretarEncargo('Agrega un dormitorio más.', { projectId: 'p', previo: A }); assert.equal(rel.sin_cambios, true); assert.equal(dur(rel.brief).bedrooms, 3); assert.ok(rel.ambiguedades.some((x) => x.codigo === 'CAMBIO_RELATIVO'));
  const nada = interpretarEncargo('Gracias, se ve bien.', { projectId: 'p', previo: A }); assert.equal(nada.sin_cambios, true);
  const amb = interpretarEncargo('Ya no quiero eso.', { projectId: 'p', previo: A }); assert.equal(amb.sin_cambios, true); assert.ok(amb.ambiguedades.some((x) => x.codigo === 'RETIRO_AMBIGUO'));
});

test('F03 — reemplazar es explícito: nuevo encargo integral, el anterior solo queda en el historial', () => {
  const A = interpretarEncargo(ROBLES, { projectId: 'p' }).brief; const r = interpretarEncargo('Casa de 60 m2, 2 dormitorios, 1 baño.', { projectId: 'p', previo: A, modo: 'reemplazar' });
  assert.equal(r.modo, 'reemplazar'); assert.match(r.nota, /REEMPLAZO/); assert.equal(dur(r.brief).area_target, 60); assert.ok(!kinds(r.brief).includes('sightline')); assert.equal(r.brief.version, 2); assert.deepEqual(r.brief.request_updates, []);
});

test('F03 (servicio) — A→B→A por MCP/servicio: 3 versiones inmutables; leer no crea versiones; sin cambios no versiona', () => {
  const home = tmpHome('Tannia ñ f03 '); const sb = new Sandbox(home); createProject(sb, 'Fixture Aislado'); const E = new Estudios(sb);
  const c = E.crear('Fixture Aislado', { nombre: 'E', texto: ROBLES }); assert.equal(c.version, 'v001');
  const dir = path.join(home, 'Proyectos', 'Fixture Aislado', '03 Trabajo', 'Arquitectura', 'E'); const h1 = sha(path.join(dir, 'v001.json'));
  const b = E.encargo('Fixture Aislado', 'E', { texto: 'Ahora 110 m² y 4 dormitorios', modo: 'actualizar' }); assert.equal(b.version, 'v002'); assert.equal(b.modo, 'actualizar'); assert.ok(b.preservado.requisitos.includes('bathrooms')); assert.ok(b.preservado.objetivos.includes('sightline'));
  const h2 = sha(path.join(dir, 'v002.json'));
  const a2 = E.encargo('Fixture Aislado', 'E', { texto: 'Vuelve a 90 m² y 3 dormitorios' }); assert.equal(a2.version, 'v003');
  const antes = fs.readdirSync(dir).length;
  const nada = E.encargo('Fixture Aislado', 'E', { texto: 'Gracias.' }); assert.equal(nada.sin_cambios, true); assert.equal(nada.version, 'v003'); assert.equal(fs.readdirSync(dir).length, antes);
  const v1 = E.cargar('Fixture Aislado', 'E', 'v001').estado.brief; const v3 = E.cargar('Fixture Aislado', 'E', 'v003').estado.brief;
  assert.deepEqual(dur(v3), dur(v1)); assert.equal(sha(path.join(dir, 'v001.json')), h1); assert.equal(sha(path.join(dir, 'v002.json')), h2);
  const rep = E.encargo('Fixture Aislado', 'E', { texto: 'Casa de 60 m2, 2 dormitorios, 1 baño.', modo: 'reemplazar' }); assert.equal(rep.version, 'v004'); assert.ok(rep.perdidos.restricciones_quitadas.length >= 1 || rep.perdidos.objetivos_quitados.length >= 1);
  assert.equal(E.cargar('Fixture Aislado', 'E', 'v003').estado.brief.hard_constraints.find((x) => x.kind === 'area_target').value, 90, 'el anterior sigue en el historial');
});
