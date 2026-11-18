// F06–F10 por MCP (como lo usa Claude Desktop): encargo rc2 completo, idempotencia, retirada contextual, resumen sin viento, versiones y compatibilidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tmpHome, startClient, call, data, NUEVAS_RC02, CONTRATO_RC02 } from './helpers.js';

const RC2 = fs.readFileSync(new URL('./fixtures_tw10/encargo_rc2_reconstruido.txt', import.meta.url), 'utf8');
const texto = (r) => r.content.map((c) => c.text).join('\n');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('rc2 completo por MCP: 6 objetivos pedidos (+ supervisión asumida), sin viento ni duplicados; notas «no inventar»; las otras 3 respuestas siguen compactas', async () => {
  const home = tmpHome('Tannia ñ f06mcp '); const cli = await startClient(home); const c = cli.client; const P = 'Prueba rc3 aislada'; const E = 'E';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P });
    let r = await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: RC2 }); assert.ok(!r.isError); const d = data(r);
    assert.deepEqual(d.brief.objectives.map((o) => o.kind).sort(), ['circulation_minimal', 'cost_saving', 'courtyard', 'daylight_preference', 'pool_supervision', 'sightline', 'summer_cooling']);
    assert.ok(d.brief.assistant_notes.some((n) => n.kind === 'no_inventar' && n.topics.includes('viento'))); assert.deepEqual(d.ambiguedades, []);
    assert.ok(!/viento/.test(JSON.stringify(d.brief.objectives)), 'nada de viento entre los objetivos'); assert.ok(d.brief.unknowns.includes('site_true_north'));
    r = await call(c, 'tannia_arq_generar_alternativas', { proyecto: P, estudio: E }); assert.equal(data(r).n_elegibles, 3);
    const ev = texto(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio' })); assert.ok(!/wind_shelter/.test(ev), 'el resumen no menciona un objetivo de viento'); assert.match(ev, /visual geométrica PRELIMINAR/);
    // idempotencia: repetir el mismo mensaje no crea versión ni duplica
    const dir = path.join(home, 'Proyectos', P, '03 Trabajo', 'Arquitectura', E); const antes = fs.readdirSync(dir).length;
    r = await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: RC2 }); assert.equal(data(r).sin_cambios, true); assert.equal(fs.readdirSync(dir).length, antes);
    // retirada contextual y exclusión sin alterar el resto (versión nueva; la anterior intacta)
    const v2 = path.join(dir, 'v002.json'); const h2 = sha(v2);
    r = await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: 'No quiero priorizar el viento, pero sí un patio protegido de los vecinos.' }); assert.ok(!r.isError); const u = data(r); assert.equal(u.modo, 'actualizar'); assert.ok(u.brief.excluded_objectives.includes('wind_shelter')); assert.ok(u.brief.objectives.length >= 7);
    assert.equal(sha(v2), h2, 'versión anterior intacta');
    r = await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: 'Dime qué viento domina; no inventes nada.' }); assert.ok(!data(r).brief?.objectives?.some((o) => o.kind === 'wind_shelter'));
    assert.equal((await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'nada' })).isError, true);
    assert.equal((await cli.client.listTools()).tools.length, 72 + NUEVAS_RC02.length);
  } finally { await cli.close(); }
});

test('proyectos históricos intactos: ninguna operación F06–F10 toca archivos de otro proyecto ni versiones previas del mismo estudio', async () => {
  const home = tmpHome('Tannia ñ f06iso '); const cli = await startClient(home); const c = cli.client;
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: 'Prueba TW10 rc2 (histórico simulado)' }); await call(c, 'tannia_arq_encargo', { proyecto: 'Prueba TW10 rc2 (histórico simulado)', estudio: 'H', texto: RC2 });
    const hist = path.join(home, 'Proyectos', 'Prueba TW10 rc2 (histórico simulado)'); const foto = () => Object.fromEntries(walk(hist).filter((f) => !f.endsWith('auditoria.jsonl')).map((f) => [f, sha(f)])); const antes = foto();
    await call(c, 'tannia_proyecto_crear', { nombre: 'Nuevo rc3' });
    for (const t of [RC2, 'No quiero priorizar el viento.', 'Agrega un dormitorio más.']) await call(c, 'tannia_arq_encargo', { proyecto: 'Nuevo rc3', estudio: 'N', texto: t });
    await call(c, 'tannia_arq_generar_alternativas', { proyecto: 'Nuevo rc3', estudio: 'N' });
    assert.deepEqual(foto(), antes, 'el proyecto histórico no cambió ni un byte');
  } finally { await cli.close(); }
});
