// Auditoría de campo G10 rc2 — F06 (negación, intención y prioridad contextual) y F07 (objetivos duplicados).
// NOTA: el texto literal enviado por Claude Desktop en rc2 no está disponible en este entorno; `encargo_rc2_reconstruido.txt` lo reconstruye
// a partir de lo reportado (seis prioridades reiteradas + frases de «no inventes»). Debe sustituirse/complementarse con el literal (v001.json → request_original).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { interpretarEncargo } from '../src/architect/briefing.js';
import { evaluarEsquema, compararMultiobjetivo } from '../src/architect/evaluacion.js';
import { generarAlternativas } from '../src/architect/alternativas.js';
import { programaDeBrief } from '../src/architect/briefing.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures_tw10/${n}`, import.meta.url), 'utf8');
const RC2 = fx('encargo_rc2_reconstruido.txt');
const kinds = (b) => b.objectives.map((o) => o.kind);
const base = 'Casa de 90 m2, 3 dormitorios, 2 baños. ';
const obj = (t, previo) => interpretarEncargo(base + t, { projectId: 'p', ...(previo ? { previo } : {}) });

test('F06 — «No inventes orientación, normativa, viento ni datos del terreno» NO es un objetivo: es una instrucción de incertidumbre', () => {
  const r = obj('No inventes orientación, normativa, viento ni datos del terreno.');
  assert.ok(!kinds(r.brief).includes('wind_shelter'), `objetivos: ${kinds(r.brief)}`);
  const n = r.brief.assistant_notes.find((x) => x.kind === 'no_inventar'); assert.ok(n); for (const t of ['orientacion', 'normativa', 'viento', 'terreno']) assert.ok(n.topics.includes(t), t);
  assert.ok(r.brief.objectives.every((o) => o.evidence !== 'user_statement' || o.kind !== 'wind_shelter'), 'nada atribuido al usuario sobre el viento');
});

test('F06 — contraste: «Quiero proteger el patio del viento» SÍ es un objetivo explícito del usuario', () => {
  for (const t of ['Quiero proteger el patio del viento.', 'Necesito abrigar el patio del viento del sur.', 'Que el viento fuerte de invierno no moleste en el patio.', 'Quiero un patio resguardado del viento.']) {
    const w = obj(t).brief.objectives.find((o) => o.kind === 'wind_shelter'); assert.ok(w, t); assert.equal(w.evidence, 'user_statement'); assert.equal(w.status, 'confirmed'); assert.equal(w.target, 'patio');
  }
});

test('F06 — «No quiero priorizar el viento» es exclusión/retirada, no incorporación; con un objetivo previo lo retira', () => {
  const r = obj('No quiero priorizar el viento.'); assert.ok(!kinds(r.brief).includes('wind_shelter')); assert.ok(r.brief.excluded_objectives.includes('wind_shelter')); assert.ok(r.brief.assistant_notes.some((x) => x.kind === 'excluido' && x.topics.includes('viento')));
  const a = obj('Quiero proteger el patio del viento.').brief; assert.ok(kinds(a).includes('wind_shelter'));
  const b = interpretarEncargo('No quiero priorizar el viento.', { projectId: 'p', previo: a }).brief; assert.ok(!kinds(b).includes('wind_shelter'), 'retirada contextual'); assert.ok(b.excluded_objectives.includes('wind_shelter')); assert.equal(b.hard_constraints.find((h) => h.kind === 'area_target').value, 90);
  const c = interpretarEncargo('Ahora sí quiero proteger el patio del viento.', { projectId: 'p', previo: b }).brief; assert.ok(kinds(c).includes('wind_shelter')); assert.ok(!c.excluded_objectives.includes('wind_shelter'), 'volver a pedirlo quita la exclusión');
});

test('F06 — prioridad LOCAL: «Necesito mucha luz, pero el viento es un dato desconocido» → luz alta; el viento ni objetivo ni prioridad', () => {
  const r = obj('Necesito mucha luz, pero el viento es un dato desconocido.'); const luz = r.brief.objectives.find((o) => o.kind === 'daylight_preference');
  assert.equal(luz.priority, 'high'); assert.ok(!kinds(r.brief).includes('wind_shelter')); assert.ok(r.brief.assistant_notes.some((x) => x.kind === 'dato_desconocido' && x.topics.includes('viento')));
  const s = obj('Quiero un poco de luz, pero necesito que el viento no entre al patio.'); assert.equal(s.brief.objectives.find((o) => o.kind === 'daylight_preference').priority, 'medium', 'la urgencia del viento no contagia a la luz'); assert.equal(s.brief.objectives.find((o) => o.kind === 'wind_shelter').priority, 'high');
});

test('F06 — adversarial: menciones, preguntas, advertencias e instrucciones al asistente nunca son preferencias', () => {
  for (const t of ['¿Qué viento domina en invierno?', 'Dime si el viento es un problema.', 'El viento no lo conozco todavía.', 'Sin inventar nada sobre el viento.', 'Explícame cómo afecta el viento a una casa.', 'No supongas el viento ni el sol.', 'Pregúntame lo que necesites del viento.', 'Evita suponer datos de viento.']) {
    const r = obj(t); assert.ok(!kinds(r.brief).includes('wind_shelter'), `«${t}» → ${kinds(r.brief)}`);
  }
  for (const t of ['No quiero ventanales grandes.', 'Sin piscina por ahora.', 'No quiero patio.', 'No me importa el ahorro.']) { const r = obj(t); for (const k of ['daylight_preference', 'courtyard', 'cost_saving']) assert.ok(!(t.includes('ventanales') && k === 'daylight_preference') && !(t.includes('patio') && k === 'courtyard') && !(t.includes('ahorro') && k === 'cost_saving') || !kinds(r.brief).includes(k), `«${t}» creó ${k}`); assert.ok(!r.brief.program.some((p) => /piscina/.test(t) && p.id === 'piscina'), `«${t}» creó piscina`); }
  assert.equal(obj('No quiero piscina.').brief.program.some((p) => p.id === 'piscina'), false);
});

test('F06 — la «prioridad alta» de una frase no se propaga a todo el encargo', () => {
  const r = obj('Es muy importante que la cocina vea la piscina. Me gustaría un patio. Quiero ahorrar un poco.'); const p = Object.fromEntries(r.brief.objectives.map((o) => [o.kind, o.priority]));
  assert.equal(p.sightline, 'high'); assert.equal(p.courtyard, 'medium'); assert.ok(['medium', 'high'].includes(p.cost_saving));
  const q = obj('Necesito mucha luz. Quiero pocos pasillos.').brief.objectives; assert.equal(q.find((o) => o.kind === 'daylight_preference').priority, 'high'); assert.equal(q.find((o) => o.kind === 'circulation_minimal').priority, 'medium');
});

test('F06/F07 — mensaje rc2 completo (reconstruido): exactamente los objetivos pedidos, sin viento, sin duplicados, con las notas al asistente', () => {
  const r = interpretarEncargo(RC2, { projectId: 'p' }); const b = r.brief; const k = kinds(b).sort();
  assert.deepEqual(k, ['circulation_minimal', 'cost_saving', 'courtyard', 'daylight_preference', 'pool_supervision', 'sightline', 'summer_cooling']);
  assert.equal(new Set(b.objectives.map((o) => `${o.kind}|${o.from ?? ''}|${o.to ?? ''}|${o.target ?? ''}`)).size, b.objectives.length);
  assert.equal(b.objectives.filter((o) => o.kind === 'sightline').length, 1); assert.equal(b.objectives.filter((o) => o.kind === 'pool_supervision').length, 1);
  const s = b.objectives.find((o) => o.kind === 'sightline'); assert.equal(s.from, 'R-COC'); assert.equal(s.to, 'pool_play_zone'); assert.equal(s.priority, 'high');
  assert.ok(b.assistant_notes.some((x) => x.kind === 'no_inventar' && ['orientacion', 'normativa', 'viento', 'terreno'].every((t) => x.topics.includes(t))));
  assert.deepEqual(r.ambiguedades, [], 'las repeticiones de la lista de prioridades no generan preguntas');
  assert.ok(b.hard_constraints.some((h) => h.kind === 'area_target' && h.value === 90));
});

test('F07 — repetir el encargo/una lista de confirmación al actualizar no duplica ni cambia el número de objetivos; procedencia y prioridad válidas se conservan', () => {
  const a = interpretarEncargo(RC2, { projectId: 'p' }).brief; const n0 = a.objectives.length;
  const b = interpretarEncargo('Confirmo: quiero ver a mis hijos desde la cocina, mucha iluminación natural, fresca en verano, pocos pasillos, patio y cuidar el presupuesto.', { projectId: 'p', previo: a });
  assert.equal(b.brief.objectives.length, n0, 'sin duplicados al actualizar'); assert.equal(b.brief.objectives.filter((o) => o.kind === 'sightline').length, 1);
  const s = b.brief.objectives.find((o) => o.kind === 'sightline'); assert.equal(s.priority, 'high'); assert.equal(s.status, 'confirmed'); assert.equal(s.id, a.objectives.find((o) => o.kind === 'sightline').id);
  const c = interpretarEncargo('Quiero ver la piscina desde la cocina y también ver el patio desde el living.', { projectId: 'p', previo: a }).brief; assert.equal(c.objectives.filter((o) => o.kind === 'sightline').length, 2, 'dos relaciones realmente distintas se conservan');
});

test('F07 — un brief heredado CON duplicados (como v002) se evalúa y se compara una sola vez por objetivo (sin alterar pesos/Pareto)', () => {
  const a = interpretarEncargo(RC2, { projectId: 'p' }).brief; const dup = structuredClone(a); dup.objectives = [...a.objectives, ...a.objectives.filter((o) => o.kind === 'sightline' || o.kind === 'pool_supervision').map((o, i) => ({ ...o, id: `o9${i}` }))];
  assert.equal(dup.objectives.length, a.objectives.length + 2);
  const g = generarAlternativas({ programa: programaDeBrief(a), vistas: [{ from: 'R-COC', to: 'pool_play_zone' }] });
  const ev = (br) => g.alternativas.map((x) => ({ id: x.esquema.id, ...evaluarEsquema({ esq: x.esquema, geo: x.geo, brief: br }), gatesFallidos: [] }));
  const e1 = ev(a); const e2 = ev(dup);
  for (let i = 0; i < e1.length; i++) { assert.equal(e2[i].objetivos.length, e1[i].objetivos.length); assert.deepEqual(e2[i].objetivos.map((o) => [o.kind, o.score, o.peso]), e1[i].objetivos.map((o) => [o.kind, o.score, o.peso])); }
  const c1 = compararMultiobjetivo(e1.map((x) => ({ ...x, bloqueada: false }))); const c2 = compararMultiobjetivo(e2.map((x) => ({ ...x, bloqueada: false })));
  assert.deepEqual(c2.frontera_pareto, c1.frontera_pareto); assert.deepEqual(c2.pesos_visibles, c1.pesos_visibles); assert.deepEqual(c2.dimensiones, c1.dimensiones);
});
