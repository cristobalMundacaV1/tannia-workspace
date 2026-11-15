import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startClient, call, data, tmpHome, ROOT, FIX, MCPB_BIN } from './helpers.js';

// Construye, empaqueta con el CLI oficial, DESCOMPRIME en un directorio limpio (sin node_modules,
// ruta con espacios y acentos) y ejecuta el protocolo MCP contra el bundle instalado.
test('TW-00A: .mcpb se empaqueta, valida y funciona desde instalación limpia', { timeout: 120000 }, async () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pack.mjs')], { cwd: ROOT, stdio: 'pipe' });
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'mcpb', 'manifest.json'), 'utf8'));
  const pkg = path.join(ROOT, 'dist', `tannia-workspace-${mf.version}.mcpb`);
  assert.ok(fs.existsSync(pkg));
  assert.match(fs.readFileSync(`${pkg}.sha256`, 'utf8'), /^[0-9a-f]{64}  /);

  const inst = fs.mkdtempSync(path.join(os.tmpdir(), 'Extensión instalada ñ '));
  execFileSync(MCPB_BIN, ['unpack', pkg, inst], { stdio: 'pipe', shell: process.platform === 'win32' });
  assert.ok(!fs.existsSync(path.join(inst, 'node_modules')));
  const entry = path.join(inst, 'server', 'index.js');
  assert.ok(fs.existsSync(entry));

  const home = tmpHome('Tannia Docs ');
  const { client, close } = await startClient(home, entry);
  try {
    assert.ok(!(await call(client, 'tannia_proyecto_crear', { nombre: 'Prueba' })).isError);
    fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(home, 'Proyectos', 'Prueba', '03 Trabajo', 'a.dxf'));
    const r = await call(client, 'tannia_dxf_inspeccionar', { proyecto: 'Prueba', archivo: '03 Trabajo/a.dxf' });
    assert.equal(data(r).entidades_por_tipo.CIRCLE, 1);
  } finally { await close(); fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(inst, { recursive: true, force: true }); }
});

test('TW-00A: manifest declara carpeta configurable y herramientas reales', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'mcpb', 'manifest.json'), 'utf8'));
  assert.equal(mf.server.type, 'node');
  assert.equal(mf.user_config.carpeta_tannia.type, 'directory');
  assert.ok(mf.tools.some((t) => t.name === 'tannia_diagnostico'));
});

test('TW-00A: placeholder sin sustituir cae a la carpeta por defecto', async () => {
  const { resolveHome } = await import('../src/config.js');
  assert.match(resolveHome({ TANNIA_HOME: '${user_config.carpeta_tannia}' }), /Tannia Workspace$/);
  assert.equal(resolveHome({ TANNIA_HOME: '/x/y' }), path.resolve('/x/y'));
});
