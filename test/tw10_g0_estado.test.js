// El estado persistente TW10_STATE.json respeta la plantilla fija y las reglas de la directiva.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const leer = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const plantilla = leer('docs/tw10/TW10_STATE_TEMPLATE.json');
const estado = leer('docs/agent-continuity/TW10_STATE.json');

test('estado: mismas claves que la plantilla (raíz y gates)', () => {
  assert.deepEqual(Object.keys(estado).sort(), Object.keys(plantilla).sort());
  assert.deepEqual(Object.keys(estado.gates), ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10']);
  for (const g of Object.values(estado.gates)) assert.deepEqual(Object.keys(g).sort(), ['blockers', 'evidence', 'sha', 'status']);
});
test('estado: rama correcta, base verificada, y el agente jamás marca ACEPTADO_POR_PO ni da por real lo no ejecutado', () => {
  assert.equal(estado.branch, 'feat/tw10-architectural-reasoning');
  assert.match(estado.base_sha_verified, /^[0-9a-f]{40}$/);
  assert.notEqual(estado.overall_status, 'ACEPTADO_POR_PO');
  assert.ok(estado.external_required.includes('AutoCAD 2027 real'));
  assert.notEqual(estado.gates.G10.status, 'APROBADA');
});
