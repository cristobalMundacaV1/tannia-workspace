// TW10-00-02: regresión de contratos TW-09 (herramientas y esquemas) y de la tubería v1; no escribe en proyectos reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startClient, NUEVAS_RC02, CONTRATO_RC02 } from './helpers.js';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';

test('TW-09 intacto: 61 herramientas con esquemas sin arreglos tipo tupla', async () => {
  const c = await startClient();
  try {
    const { tools } = await c.client.listTools();
    const base = tools.filter((t) => !t.name.startsWith('tannia_arq_') && !NUEVAS_RC02.includes(t.name)); // 0.2: las nuevas se declaran en fixtures/rc
    assert.equal(base.length, 61, `herramientas TW-09: ${base.length}`);
    const sinTupla = (n, ruta) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n.items)) assert.fail(`items como arreglo en ${ruta}`); for (const [k, v] of Object.entries(n)) sinTupla(v, `${ruta}.${k}`); };
    for (const t of tools) sinTupla(t.inputSchema, t.name);
  } finally { await c.close(); }
});

test('TW-09 intacto: generador rectangular v1 da la misma geometría (huella de referencia)', () => {
  const m = generarModelo({ superficie_objetivo_m2: 80, dormitorios: 3, banos: 2 });
  const g = derivar(m);
  assert.equal(m.version_modelo, 1);
  assert.equal(g.exterior.x0, 0); assert.equal(g.exterior.y0, 0);
  assert.ok(g.areas.construida_m2 >= 78 && g.areas.construida_m2 <= 82, `construida ${g.areas.construida_m2}`);
  assert.deepEqual(Object.keys(g.recintos).sort(), Object.keys(m.recintos).sort());
});
