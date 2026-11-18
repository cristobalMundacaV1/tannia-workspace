// F08 — identidad del servidor, del motor y del PAQUETE instalado (separadas; TW-09 no se reetiqueta).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { identidadPaquete } from '../src/mcp/paquete.js';
import { VERSION } from '../src/version.js';
import { VERSION_MOTOR } from '../src/architect/version.js';
import { tmpHome, startClient, call, data, NUEVAS_RC02, CONTRATO_RC02 } from './helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mk = (manifest) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'Paquete ñ id ')); fs.mkdirSync(path.join(d, 'server')); fs.writeFileSync(path.join(d, 'server', 'index.js'), ''); if (manifest !== undefined) fs.writeFileSync(path.join(d, 'manifest.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest)); return path.join(d, 'server', 'index.js'); };

test('identidadPaquete: lee manifest.json junto al servidor; sin manifest o inválido ⇒ no_disponible con motivo (nunca inventa)', () => {
  const ok = identidadPaquete(mk({ name: 'tannia-workspace-tw10', version: '0.1.0-tw10.abc1234.rc3', display_name: 'Tannia Workspace - PRUEBA TW-10 (abc1234 rc3)' }));
  // R-03: además de name/version, la identidad declara la compilación (no disponible en paquetes antiguos) y la huella del servidor ejecutado.
  const huellaVacia = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // SHA-256 del index.js vacío del fixture
  assert.deepEqual(ok, { origen: 'manifest.json', id: 'tannia-workspace-tw10', version: '0.1.0-tw10.abc1234.rc3', nombre_visible: 'Tannia Workspace - PRUEBA TW-10 (abc1234 rc3)', compilacion: { origen: 'no_disponible' }, huella_servidor_sha256: huellaVacia });
  const conComp = mk({ name: 'tannia-workspace', version: '0.2.0-rc.3' }); fs.writeFileSync(path.join(path.dirname(conComp), 'compilacion.json'), JSON.stringify({ schema: 'tw.compilacion/1', version: '0.2.0-rc.3', commit: 'a'.repeat(40), arbol_limpio: true }));
  assert.deepEqual(identidadPaquete(conComp).compilacion, { origen: 'compilacion.json', version: '0.2.0-rc.3', commit: 'a'.repeat(40), arbol_limpio: true });
  for (const m of [undefined, '{no json', { name: 5 }, { name: 'x' }, 'x'.repeat(300 * 1024)]) { const r = identidadPaquete(mk(m)); assert.equal(r.origen, 'no_disponible', JSON.stringify(m)?.slice(0, 40)); assert.ok(r.motivo); assert.equal(r.version, undefined); }
  assert.equal(identidadPaquete('').origen, 'no_disponible');
});

test('diagnóstico (código fuente): servidor, motor y paquete por separado; el campo `version` heredado se conserva', async () => {
  const cli = await startClient(tmpHome()); try {
    const d = data(await call(cli.client, 'tannia_diagnostico', {}));
    assert.equal(d.version, VERSION, 'compatibilidad TW-09'); assert.equal(d.versiones.servidor, VERSION); assert.equal(d.versiones.motor_arquitectonico, VERSION_MOTOR); assert.match(d.versiones.motor_arquitectonico, /^mraa-\d+\.\d+\.\d+$/);
    assert.equal(d.versiones.paquete.origen, 'no_disponible'); assert.match(d.versiones.nota, /Para saber QUÉ candidato corre, use paquete\.version/);
    assert.notEqual(d.versiones.servidor, d.versiones.motor_arquitectonico);
  } finally { await cli.close(); }
});

test('diagnóstico (paquete real): informa id y versión del .mcpb instalado, distinta de la del servidor; el verificador lo exige', async () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { stdio: 'pipe', cwd: ROOT });
  const { crearPaquetePrueba } = await import('../scripts/paquete-prueba.mjs'); const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'Salida ñ rc '));
  const r = await crearPaquetePrueba({ etiqueta: 'f08test', revision: 'rc3', id: 'tannia-workspace-tw10', nombre: 'Tannia Workspace - PRUEBA F08', salida, fase: 'tw10' });
  assert.equal(r.verificacion.ok, true, JSON.stringify(r.verificacion.problemas));
  const ip = r.verificacion.datos.identidad_paquete; assert.equal(ip.origen, 'manifest.json'); assert.equal(ip.id, 'tannia-workspace-tw10'); assert.equal(ip.version, '0.1.0-tw10.f08test.rc3'); assert.notEqual(ip.version, VERSION);
  assert.match(r.verificacion.datos.motor_arquitectonico, /^mraa-/);
});

test('compatibilidad: el MCP sigue anunciando el nombre/versión del servidor (no se reetiqueta TW-09) y hay 72 herramientas', async () => {
  const cli = await startClient(tmpHome()); try { const i = cli.client.getServerVersion(); assert.equal(i.name, 'tannia-workspace'); assert.equal(i.version, VERSION); assert.equal((await cli.client.listTools()).tools.length, 72 + NUEVAS_RC02.length); } finally { await cli.close(); }
});
