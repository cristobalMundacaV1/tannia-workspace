// TW-11 G4: interpretación propuesta por Claude y validada por el backend, planificador DAG con brechas, ejecutor reanudable, modos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome, startClient, call, data } from './helpers.js';
import { docx } from './helpers_tw11.js';
import { validarInterpretacion } from '../src/cic/interpretacion.js';
import { ejecutarPlan } from '../src/cic/ejecutor.js';
import { InterpretacionSchema } from '../src/cic/schemas.js';
const V = (i, ctx) => validarInterpretacion(InterpretacionSchema.parse(i), ctx);

const M = (value, unit = 'm') => ({ value, unit });
const base = (o = {}) => ({ schema: 'tw.cic.interpretation/1', mode: 'academic', restatement: 'Canal revestido de 1,2 km con cubicación y plan de trabajo', intents: [{ kind: 'plan', text: 'plan' }, { kind: 'compute', text: 'cubicar' }], ...o });
const HERR = ['tannia_cic_calcular', 'tannia_cic_conocimiento', 'tannia_dxf_medir', 'tannia_informe_generar'];
const ctxMin = (extra = {}) => ({ modo: 'academic', herramientas: HERR, conocimiento: null, proyecto: 'P', ...extra });
const caso = 'Canal de riego ñ';

test('T16: la etiqueta de disciplina (ninguna, correcta, absurda, varias) NO cambia las capacidades accesibles ni el plan', () => {
  const pasos = [{ id: 's1', goal: 'área de sección', capability_id: 'op.geo.polygon.properties', inputs: { vertices: M([[0, 0], [2, 0], [2, 1], [0, 1]]) } }, { id: 's2', goal: 'volumen', capability_id: 'op.geo.solid.extrude', inputs: { area: { ref: 'step:s1.area' }, length: M(1200), section_plane: { value: 'normal_to_path', unit: null } } }];
  const planes = [[], [{ tag: 'canales de riego' }], [{ tag: 'zzz inexistente' }], [{ tag: 'hidráulica' }, { tag: 'topografía' }, { tag: 'planificación' }]].map((d) => V(base({ disciplines_proposed: d, proposed_steps: pasos }), ctxMin()));
  const firma = (v) => JSON.stringify(v.plan.steps.map((s) => [s.id, s.capability_id, s.status, s.kind, s.depends_on]));
  for (const v of planes) { assert.equal(firma(v), firma(planes[0])); assert.equal(v.outcome, 'accepted'); }
  assert.deepEqual(planes[3].disciplinas_informativas.map((d) => d.tag), ['hidráulica', 'topografía', 'planificación']);
});

test('validación: DAG, duplicados, dependencias inexistentes → rechazo; capacidad inexistente o ausente → BRECHA (no rechazo); entradas faltantes → pregunta', () => {
  const s = (id, extra = {}) => ({ id, goal: id, capability_id: null, inputs: {}, depends_on: [], ...extra });
  assert.equal(V(base({ proposed_steps: [s('a', { depends_on: ['b'] }), s('b', { depends_on: ['a'] })] }), ctxMin()).outcome, 'rejected');
  assert.equal(V(base({ proposed_steps: [s('a'), s('a')] }), ctxMin()).outcome, 'rejected');
  assert.equal(V(base({ proposed_steps: [s('a', { depends_on: ['zz'] })] }), ctxMin()).outcome, 'rejected');
  const v = V(base({ proposed_steps: [s('a', { goal: 'diseño hidráulico del canal' }), s('b', { capability_id: 'op.no.existe' }), s('c', { capability_id: 'op.geo.section.circle' })] }), ctxMin());
  assert.equal(v.outcome, 'accepted_with_gaps'); assert.deepEqual(v.plan.steps.map((x) => x.status), ['blocked_gap', 'blocked_gap', 'planned']); assert.equal(v.gaps.length, 2); assert.ok(v.preguntas.some((q) => /faltan: radio/.test(q)));
  assert.ok(v.gaps.every((g) => g.resolution === 'new_tool'));
});

test('magnitudes: valor sin unidad y unidad desconocida generan preguntas, nunca suposiciones; desconocidos → brechas con su resolución', () => {
  const v = V(base({ magnitudes: [{ name: 'longitud', value: 1200, unit: null, origin: 'user' }, { name: 'caudal', value: 3, unit: 'furlongs', origin: 'user' }, { name: 'pendiente', value: null, unit: null, origin: 'unknown' }], unknowns: [{ what: 'Estabilidad del talud', blocks: ['s9'], resolution: 'external_professional' }, { what: 'Normativa de riego vigente', blocks: [], resolution: 'research_external' }, { what: '¿Cuál es el caudal de diseño?', blocks: [], resolution: 'ask_user' }] }), ctxMin());
  assert.deepEqual(v.magnitudes.map((m) => m.estado), ['sin_unidad', 'unidad_desconocida', 'desconocida']); assert.ok(v.preguntas.some((q) => /unidad.*longitud/.test(q))); assert.ok(v.preguntas.includes('¿Cuál es el caudal de diseño?'));
  assert.deepEqual(v.gaps.map((g) => g.resolution), ['external_professional', 'research_external']);
});

test('modos como política: profesional bloquea E1 (edu.*), académico lo permite; modo no indicado = profesional', () => {
  const st = [{ id: 'h', goal: 'Manning', capability_id: 'op.edu.hydraulics.manning_rectangular_channel', inputs: {} }];
  assert.equal(V(base({ mode: 'professional', proposed_steps: st }), ctxMin({ modo: 'professional' })).plan.steps[0].status, 'blocked_policy');
  assert.equal(V(base({ proposed_steps: st }), ctxMin({ modo: 'academic' })).plan.steps[0].status, 'planned');
});

test('ejecutor: cadena por referencias, error tipificado sin cálculo parcial, ramas independientes continúan, idempotencia y recomputación con stale', () => {
  const v = V(base({
    magnitudes: [{ name: 'longitud_canal', value: 1200, unit: 'm', origin: 'user' }],
    proposed_steps: [
      { id: 's1', goal: 'área de la sección', capability_id: 'op.geo.polygon.properties', inputs: { vertices: M([[0, 0], [2, 0], [2, 1], [0, 1]]) }, depends_on: [] },
      { id: 's2', goal: 'volumen de excavación', capability_id: 'op.geo.solid.extrude', inputs: { area: { ref: 'step:s1.area' }, length: { ref: 'magnitude:longitud_canal' }, section_plane: { value: 'normal_to_path', unit: null } } },
      { id: 's3', goal: 'rama que falla', capability_id: 'op.geo.section.arch', inputs: { luz: M(8), altura_hastial: M(0), flecha: M(5) } },
      { id: 's4', goal: 'depende de la que falla', capability_id: 'op.geo.solid.extrude', inputs: { area: { ref: 'step:s3.area' }, length: M(10), section_plane: { value: 'normal_to_path', unit: null } } },
      { id: 's5', goal: 'rama independiente', capability_id: 'op.geo.section.circle', inputs: { radio: M(1) } },
    ],
  }), ctxMin({ modo: 'academic' }));
  assert.equal(v.outcome, 'accepted');
  const doc = { mode: 'academic', plan: v.plan, claims: [], magnitudes: [{ name: 'longitud_canal', value: 1200, unit: 'm' }] };
  let inf = ejecutarPlan(doc, { modo: 'academic' });
  const est = Object.fromEntries(doc.plan.steps.map((s) => [s.id, s.status])); assert.deepEqual(est, { s1: 'done', s2: 'done', s3: 'failed', s4: 'blocked_dependency', s5: 'done' });
  assert.equal(doc.plan.steps[2].error.code, 'OUT_OF_RANGE'); assert.equal(inf.fallidos[0].id, 's3'); assert.ok(!doc.claims.some((c) => c.statement.includes('s3') || c.statement.includes('rama que falla')), 'sin claims del paso fallido');
  const vol = doc.claims.find((c) => c.statement.includes('volumen de excavación')); assert.equal(vol.value, 2400); assert.equal(vol.unit, 'm3'); assert.deepEqual(vol.depends_on, []);
  const ids1 = doc.claims.map((c) => c.id).sort();
  inf = ejecutarPlan(doc, { modo: 'academic' }); assert.deepEqual(doc.claims.map((c) => c.id).sort(), ids1, 'idempotente: mismos claims'); assert.ok(inf.omitidos.some((o) => o.id === 's1' && /idempotente/.test(o.razon)));
  // cambia una entrada → recalcula y deja desactualizado lo que dependía
  doc.magnitudes[0].value = 1000; inf = ejecutarPlan(doc, { modo: 'academic' }); assert.ok(inf.recomputados.includes('s2')); assert.equal(doc.claims.find((c) => c.statement.includes('volumen de excavación') && c.status === 'computed' && c.value === 2000).value, 2000);
  assert.ok(doc.claims.some((c) => c.status === 'stale' && c.value === 2400), 'el resultado anterior queda stale');
});

test('reanudación: un paso de cálculo interrumpido (running) se recalcula; uno de ESCRITURA no se reintenta (RESULTADO_INCIERTO)', () => {
  const plan = { schema: 'tw.cic.workplan/1', engagement_ref: 'e', revision: 1, mode: 'academic', gaps: [], steps: [
    { id: 'c', goal: 'círculo', capability_id: 'op.geo.section.circle', kind: 'compute', inputs: { radio: M(2) }, depends_on: [], status: 'running', result_claims: [], input_hash: null, error: null },
    { id: 'w', goal: 'DXF', capability_id: 'tool.tannia_cad_agregar_lineas', kind: 'generate_cad', inputs: {}, depends_on: [], status: 'running', result_claims: [], input_hash: null, error: null },
    { id: 'd', goal: 'informe', capability_id: 'tool.tannia_informe_generar', kind: 'generate_doc', inputs: {}, depends_on: [], status: 'ready', result_claims: [], input_hash: null, error: null }] };
  const doc = { plan, claims: [] }; const inf = ejecutarPlan(doc, { modo: 'academic' });
  assert.equal(plan.steps[0].status, 'done'); assert.equal(plan.steps[1].status, 'failed'); assert.equal(plan.steps[1].error.code, 'RESULTADO_INCIERTO'); assert.equal(inf.delegados.length, 1); assert.equal(inf.delegados[0].herramienta, 'tannia_informe_generar');
});

test('MCP: proyecto DESCONOCIDO multidisciplinar, sin especialización: asistencia sustantiva (cálculos + brechas + investigación) y citas verificadas', async () => {
  const home = tmpHome('Tannia ñ g4 '); const { client: c, close } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Canal Riego ñ';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P });
    const f = path.join(home, 'Proyectos', P, '01 Antecedentes', 'apuntes.docx'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, docx([{ h: 1, t: 'Canales' }, { p: 'El revestimiento del canal se cubica como perímetro mojado por longitud y por espesor del revestimiento.' }]));
    const src = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'registrar_archivo', ruta: '01 Antecedentes/apuntes.docx', clase: 'B', binding: 'didactic' })).id;
    const interp = base({ mode: 'academic', disciplines_proposed: [{ tag: 'hidráulica de canales', rationale: 'término nuevo' }, { tag: 'cubicación' }],
      antecedents: [{ ref: src, quote: 'perímetro mojado por longitud y por espesor del revestimiento', use: 'método de cubicación' }, { ref: src, quote: 'el espesor mínimo normativo es 8 cm', use: 'inventada' }],
      research_questions: [{ id: 'q1', text: 'normativa de revestimiento de canales', status: 'open' }],
      magnitudes: [{ name: 'longitud', value: 1200, unit: 'm', origin: 'user' }, { name: 'espesor_revestimiento', value: null, unit: null, origin: 'unknown' }],
      unknowns: [{ what: 'Diseño hidráulico y estabilidad del talud', blocks: ['s3'], resolution: 'external_professional' }],
      proposed_steps: [
        { id: 's1', goal: 'área de la sección trapecial (ejemplo del enunciado)', capability_id: 'op.geo.polygon.properties', inputs: { vertices: M([[0, 0], [3, 0], [2.5, 1.2], [0.5, 1.2]]) } },
        { id: 's2', goal: 'volumen de excavación 1,2 km', capability_id: 'op.geo.solid.extrude', inputs: { area: { ref: 'step:s1.area' }, length: { ref: 'magnitude:longitud' }, section_plane: { value: 'normal_to_path', unit: null } } },
        { id: 's3', goal: 'dimensionar el revestimiento y verificar estabilidad', capability_id: null, inputs: {} },
        { id: 's4', goal: 'buscar método de cubicación en los apuntes', capability_id: 'tool.tannia_cic_conocimiento', inputs: { consultas: ['cubicación revestimiento de canal'] } },
      ] });
    let r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso, interpretacion: interp }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 400)); let d = data(r);
    assert.equal(d.resultado, 'accepted_with_gaps'); assert.equal(d.modo, 'academic'); assert.match(d.politica_modo.marca, /EJERCICIO ACADÉMICO/);
    assert.deepEqual(d.problemas.filter((p) => p.tipo === 'unverified_citation').length, 1, 'solo la cita inventada se marca'); assert.ok(d.plan.brechas.some((g) => g.se_resuelve_con === 'external_professional') && d.plan.brechas.some((g) => g.se_resuelve_con === 'new_tool'));
    assert.equal(d.plan.pasos.find((s) => s.id === 's3').estado, 'blocked_gap'); assert.deepEqual(d.disciplinas_informativas, ['hidráulica de canales', 'cubicación']);
    r = await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso }); d = data(r); assert.deepEqual(d.ejecutados.map((e) => e.id), ['s1', 's2']); assert.equal(d.delegados_a_claude[0].id, 's4');
    const cl = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso })); const vol = cl.claims.find((x) => x.texto.includes('volumen de excavación') && x.tipo === 'calculation'); assert.ok(vol.valor > 3000 && vol.valor < 4000);
    // el dato de la usuaria quedó como claim de dato, el desconocido NO se inventó
    assert.ok(cl.claims.some((x) => x.tipo === 'data' && x.texto === 'longitud' && x.valor === 1200)); assert.ok(!cl.claims.some((x) => x.texto === 'espesor_revestimiento'));
    // entregable con una cifra inventada se bloquea; con la verdadera y numeración, no
    let v = data(await call(c, 'tannia_cic_verificar', { proyecto: P, caso, texto: 'El volumen es 9.999 m³.' })); assert.equal(v.ok, false);
    v = data(await call(c, 'tannia_cic_verificar', { proyecto: P, caso, texto: `Plano 1, página 2. Longitud 1200 m. Volumen ${String(vol.valor.toFixed(2)).replace('.', ',')} m³.` })); assert.equal(v.ok, true, JSON.stringify(v.bloqueos));
    // plan visible y solo_validar no guarda
    const pl = data(await call(c, 'tannia_cic_plan', { proyecto: P, caso })); assert.equal(pl.plan.pasos.find((s) => s.id === 's2').estado, 'done');
    r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso, interpretacion: interp, solo_validar: true }); assert.match(r.content[0].text, /sin guardar/);
  } finally { await close(); }
});

test('MCP: encargo solo de investigación o incompleto es VÁLIDO (plan mínimo con búsquedas y preguntas); interpretación inválida se rechaza con causa', async () => {
  const home = tmpHome('Tannia ñ g4b '); const { client: c, close } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Invest';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P });
    let r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso: 'Solo investigación', interpretacion: base({ mode: 'unspecified', restatement: 'Entender cómo se diseña un sistema de drenaje de plataformas ferroviarias', intents: [{ kind: 'research', text: 'investigar' }], research_questions: [{ id: 'q1', text: 'criterios de drenaje de plataformas ferroviarias', status: 'open' }], unknowns: [{ what: '¿Cuál es el emplazamiento?', blocks: [], resolution: 'ask_user' }] }) });
    assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300)); let d = data(r); assert.equal(d.modo, 'professional'); assert.ok(d.aviso_modo); assert.ok(d.plan.pasos.some((s) => s.tipo === 'retrieve')); assert.ok(d.plan.pasos.some((s) => s.tipo === 'ask_user')); assert.ok(d.preguntas.length >= 1);
    r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso: 'Roto', interpretacion: base({ proposed_steps: [{ id: 'a', goal: 'a', capability_id: null, inputs: {}, depends_on: ['b'] }, { id: 'b', goal: 'b', capability_id: null, inputs: {}, depends_on: ['a'] }] }) });
    assert.equal(r.isError, true); assert.equal(data(r).error, 'INTERPRETACION_RECHAZADA'); assert.match(data(r).mensaje, /ciclo/);
    r = await call(c, 'tannia_cic_encargo', { proyecto: P, caso: 'X', interpretacion: { schema: 'tw.cic.interpretation/1', mode: 'academic' } }); assert.equal(r.isError, true);
  } finally { await close(); }
});
