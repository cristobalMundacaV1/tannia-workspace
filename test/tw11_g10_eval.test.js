// TW-11 G10 (ejecutor): el ejecutor de evaluación funciona sobre casos PÚBLICOS DE DESARROLLO. NO aprueba G10: los retenidos son del revisor independiente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './helpers.js';
import { evaluarCarpeta, consolidar, UMBRALES } from '../scripts/tw11-eval.mjs';

const DEV = path.join(ROOT, 'fixtures', 'tw11', 'eval', 'dev');
test('ejecutor: caso de desarrollo reproducible, métricas calculadas y veredicto automático que NUNCA equivale a aprobación (falta la rúbrica del revisor)', async () => {
  const inf = await evaluarCarpeta(DEV); assert.equal(inf.casos.length, 1); assert.equal(inf.casos[0].reproducible, true); assert.equal(inf.metricas.precision_numerica, 1); assert.equal(inf.metricas.valores_criticos_inventados, 0); assert.equal(inf.metricas.reproducibilidad, 1); assert.equal(inf.metricas.fallos_de_paso, 0);
  assert.equal(inf.veredicto_automatico, 'NO_CUMPLE_O_INCOMPLETO'); assert.ok(inf.incumple.some((x) => /rúbrica del revisor/.test(x)), 'sin rúbrica humana no hay veredicto de utilidad'); assert.match(inf.nota, /NO es una aprobación/);
  const con = consolidar(inf.casos.map((c) => ({ ...c, ids_claims: [], fallos_de_paso: 0, pasos: [] })), { utilidad: { 'dev-001': 4.2 } }); assert.equal(con.veredicto_automatico, 'CUMPLE_UMBRALES_AUTOMATICOS'); assert.match(con.nota, /solo la concede el revisor/);
});

test('ejecutor: detecta valor numérico erróneo, valor crítico inventado y casos manipulados (hash de compromiso); mal desempeño uniforme NO aprueba', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval ñ ')); const caso = JSON.parse(fs.readFileSync(path.join(DEV, 'dev-001-circulo.json'), 'utf8')); caso.esperados[0].valor = 99; fs.writeFileSync(path.join(dir, 'malo.json'), JSON.stringify(caso));
  let inf = await evaluarCarpeta(dir, {}); assert.ok(inf.incumple.includes('precision_numerica') && inf.incumple.includes('errores_criticos')); assert.equal(inf.veredicto_automatico, 'NO_CUMPLE_O_INCOMPLETO');
  const caso2 = JSON.parse(fs.readFileSync(path.join(DEV, 'dev-001-circulo.json'), 'utf8')); caso2.esperados.push({ tipo: 'prohibido', id: 'prohibida_cualquier_area', regex: 'area' }); fs.writeFileSync(path.join(dir, 'malo.json'), JSON.stringify(caso2)); inf = await evaluarCarpeta(dir, {}); assert.ok(inf.incumple.some((x) => /FALLA DURA/.test(x)));
  // compromiso del revisor: si el caso cambia, no se evalúa
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'malo.json'))).digest('hex'); const comp = path.join(dir, 'compromiso.txt'); fs.writeFileSync(comp, `${h}  malo.json\n`); assert.equal((await evaluarCarpeta(dir, { compromiso: comp })).problemas_de_integridad.length, 0);
  fs.writeFileSync(path.join(dir, 'malo.json'), JSON.stringify({ ...caso2, id: 'manipulado' })); inf = await evaluarCarpeta(dir, { compromiso: comp }); assert.ok(inf.problemas_de_integridad[0].includes('no coincide con el compromiso')); assert.equal(inf.casos.length, 0);
  assert.equal(UMBRALES.valores_criticos_inventados, 0); assert.ok(UMBRALES.utilidad_media >= 3.8);
});

test('los casos retenidos NO existen en el repositorio: solo el ejecutor y casos públicos de desarrollo', () => {
  const lista = fs.readdirSync(path.join(ROOT, 'fixtures', 'tw11', 'eval'), { recursive: true }).map(String); assert.ok(lista.every((f) => !/retenid/i.test(f))); assert.ok(lista.some((f) => /dev/.test(f)));
});
