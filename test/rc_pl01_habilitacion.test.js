// G0 / PL-01 + PL-11 (issue #32): el motor de planos es parte del producto distribuido, sin flags manuales de la usuaria.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, tmpHome, startClient, call, data } from './helpers.js';
import { motorPlanosActivo } from '../src/tools/index.js';

const sinFlags = () => { const e = { ...process.env }; delete e.TANNIA_ENGINEERING; delete e.TANNIA_CIC; return e; };

test('configuración de producción: activo por defecto y solo «off» explícito lo desactiva', () => {
  assert.equal(motorPlanosActivo({}), true); assert.equal(motorPlanosActivo({ TANNIA_ENGINEERING: 'on' }), true);
  for (const v of ['off', 'OFF', '0', 'false', 'no']) assert.equal(motorPlanosActivo({ TANNIA_ENGINEERING: v }), false, v);
});

test('servidor SIN flags (entorno de la usuaria): publica tannia_planos y genera las 6 láminas del túnel con fortificación (5 originales + detalles D1–D4)', { timeout: 180000 }, async () => {
  const home = tmpHome('PL01 sin flags ñ '); const saved = process.env; process.env = sinFlags();
  const c = await startClient(home, undefined, {}); process.env = saved;
  try {
    const tools = (await c.client.listTools()).tools.map((t) => t.name); assert.ok(tools.includes('tannia_planos'), 'tannia_planos no publicado');
    assert.ok(!tools.some((t) => t.startsWith('tannia_cic_')), 'el CIC sigue apagado por defecto');
    await call(c.client, 'tannia_proyecto_crear', { nombre: 'Tunel PL01' });
    const r = await call(c.client, 'tannia_planos', { proyecto: 'Tunel PL01', accion: 'generar_tunel', datos: { length: 150, width: 5.5, wall: 2.5, selected: 0.06, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 } } });
    assert.ok(!r.isError, r.content?.[0]?.text); const d = data(r);
    assert.equal(d.files.filter((f) => /lamina-.*\.pdf$/.test(f)).length, 6);
    const ver = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', 'Tunel PL01', d.folder, d.files.find((f) => f.endsWith('verificacion.json'))), 'utf8'));
    assert.equal(ver.dxf_vs_modelo.ok, true, 'gate DXF↔modelo registrado en la evidencia');
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('TANNIA_ENGINEERING=off explícito oculta el motor (desactivación deliberada, no por omisión)', { timeout: 60000 }, async () => {
  const home = tmpHome('PL01 off '); const c = await startClient(home, undefined, { TANNIA_ENGINEERING: 'off' });
  try { assert.ok(!(await c.client.listTools()).tools.some((t) => t.name === 'tannia_planos')); } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('el manifiesto generado por build declara TANNIA_ENGINEERING=on y el build exige tannia_planos en el catálogo', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'build.mjs'), 'utf8');
  assert.match(src, /env: \{ TANNIA_HOME: '\$\{user_config\.carpeta_tannia\}', TANNIA_ENGINEERING: 'on' \}/);
  assert.match(src, /if \(!tools\.some\(\(t\) => t\.name === 'tannia_planos'\)\) \{[^}]*process\.exit\(1\)/);
  const ver = fs.readFileSync(path.join(ROOT, 'scripts', 'rc-verificar-zip.mjs'), 'utf8');
  assert.match(ver, /5b\. motor de planos del paquete/); assert.match(ver, /TANNIA_ENGINEERING === 'on'/);
});
