// TW-11 G0: línea base de herramientas (72 intactas), flag apagado por defecto, contratos versionados.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, tmpHome, startClient } from './helpers.js';
import { cicActivo } from '../src/cic/flag.js';
import * as S from '../src/cic/schemas.js';

const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'tw11', 'tools_baseline.json'), 'utf8'));

test('flag TANNIA_CIC: apagado por defecto y solo "on/1/true/si" lo enciende', () => {
  assert.equal(cicActivo({}), false); assert.equal(cicActivo({ TANNIA_CIC: 'off' }), false); assert.equal(cicActivo({ TANNIA_CIC: '' }), false);
  for (const v of ['on', 'ON', '1', 'true', 'si', 'sí']) assert.equal(cicActivo({ TANNIA_CIC: v }), true, v);
});

test('línea base: con el flag apagado el servidor expone EXACTAMENTE las 72 herramientas de rc3 (nombres y esquemas idénticos)', async () => {
  const { client, close } = await startClient(tmpHome(), undefined, { TANNIA_CIC: 'off' });
  try {
    const { tools } = await client.listTools(); assert.equal(tools.length, 72); assert.equal(base.total, 72);
    const crypto = await import('node:crypto'); const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
    const act = new Map(tools.map((t) => [t.name, sha(t.inputSchema)])); const b = new Map(base.herramientas.map((h) => [h.nombre, h.sha256_esquema]));
    assert.deepEqual([...act.keys()].sort(), [...b.keys()].sort()); for (const [n, h] of b) assert.equal(act.get(n), h, `esquema cambió: ${n}`);
    assert.ok(!tools.some((t) => t.name.startsWith('tannia_cic_')));
  } finally { await close(); }
});

test('con el flag encendido las 72 previas permanecen idénticas y se AGREGAN solo tannia_cic_* y tannia_comunicacion', async () => {
  const { client, close } = await startClient(tmpHome(), undefined, { TANNIA_CIC: 'on' });
  try {
    const { tools } = await client.listTools(); const crypto = await import('node:crypto'); const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
    const nuevas = tools.filter((t) => t.name.startsWith('tannia_cic_') || t.name === 'tannia_comunicacion'); assert.ok(nuevas.length >= 4); assert.equal(tools.length, 72 + nuevas.length);
    for (const h of base.herramientas) { const t = tools.find((x) => x.name === h.nombre); assert.ok(t, h.nombre); assert.equal(sha(t.inputSchema), h.sha256_esquema, h.nombre); }
    for (const t of nuevas) { assert.equal(t.inputSchema.type, 'object'); const bad = (x) => { if (x && typeof x === 'object') { assert.ok(!Array.isArray(x.items), `${t.name}: items como arreglo`); Object.values(x).forEach(bad); } }; bad(t.inputSchema); }
  } finally { await close(); }
});

test('contratos Zod: ida y vuelta, versionado obligatorio y rechazo de inválidos', () => {
  const ahora = '2026-11-16T00:00:00.000Z';
  const claim = { schema: 'tw.cic.claim/1', id: 'clm-abc', kind: 'calculation', statement: 'x', value: 1, unit: 'm3', dimension: 'L3', source_refs: [], method_ref: { operation_id: 'o', version: '1', input_hash: 'h', maturity: 'E2' }, depends_on: [], status: 'computed', requires_review_by: [], created_at: ahora };
  assert.ok(S.parse(S.ClaimSchema, claim).ok); assert.ok(!S.parse(S.ClaimSchema, { ...claim, schema: 'tw.cic.claim/2' }).ok); assert.ok(!S.parse(S.ClaimSchema, { ...claim, kind: 'opinion' }).ok); assert.ok(!S.parse(S.ClaimSchema, { ...claim, extra: 1 }).ok);
  const interp = { schema: 'tw.cic.interpretation/1', mode: 'academic', restatement: 'Túnel de prueba', intents: [{ kind: 'plan', text: 'planificar' }] };
  const r = S.parse(S.InterpretacionSchema, interp); assert.ok(r.ok); assert.deepEqual(r.value.disciplines_proposed, []); // 0..n disciplinas: una interpretación SIN disciplinas es válida
  assert.ok(!S.parse(S.InterpretacionSchema, { ...interp, intents: [] }).ok);
  const fuente = { schema: 'tw.cic.source/1', id: 'src-1', class: 'B', title: 'Apuntes', origin: { kind: 'file', path_or_url: 'a.pdf', retrieved_by: 'user' }, sha256: 'a'.repeat(64), state: 'candidate', approval: { approved: false, by: 'none', at: null }, content: { available: true, storage: 'excerpt', chars: 10, verified_by_server: true }, license: { status: 'unknown', quote_limit_chars: 300 }, binding: 'didactic', disciplines: [] };
  assert.ok(S.parse(S.FuenteSchema, fuente).ok); assert.ok(!S.parse(S.FuenteSchema, { ...fuente, sha256: 'xyz' }).ok);
  assert.ok(!S.parse(S.PlanSchema, { schema: 'tw.cic.workplan/1', engagement_ref: 'e', revision: 0, mode: 'academic', steps: [], gaps: [] }).ok);
  assert.deepEqual(S.ROLES_EXENTOS.sort(), ['doc_numbering', 'identifier', 'math_constant', 'metadata']);
});
