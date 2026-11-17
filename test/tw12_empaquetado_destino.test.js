// Regresión P1: la plataforma declarada y el binario nativo dependen de TANNIA_TARGET, no del constructor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolverDestino } from '../scripts/lib/destino.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(raiz, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');

test('resolverDestino: usa TANNIA_TARGET, no la plataforma del constructor; rechaza destinos desconocidos', () => {
  const linux = { platform: 'linux', arch: 'x64' };
  assert.deepEqual(resolverDestino({ TANNIA_TARGET: 'win32-x64' }, linux).platforms, ['win32']);
  assert.equal(resolverDestino({ TANNIA_TARGET: 'win32-x64' }, linux).native, '@napi-rs/canvas-win32-x64-msvc');
  assert.deepEqual(resolverDestino({}, linux).platforms, ['linux']);
  assert.deepEqual(resolverDestino({}, { platform: 'win32', arch: 'x64' }).platforms, ['win32']);
  assert.throws(() => resolverDestino({ TANNIA_TARGET: 'plan9-x64' }, linux), /no soportado/);
});

function construir(target, dist, salida) {
  const env = { ...process.env, TANNIA_TARGET: target, TANNIA_DIST_DIR: dist };
  execFileSync(process.execPath, [path.join(raiz, 'scripts', 'build.mjs')], { env, stdio: 'pipe', cwd: raiz });
  const out = execFileSync(process.execPath, [path.join(raiz, 'scripts', 'paquete-prueba.mjs'), '--etiqueta', 'regresion', '--revision', 'r1', '--fase', 'tw12', '--engineering', '--salida', salida], { env, stdio: 'pipe', cwd: raiz }).toString();
  const mcpb = path.join(salida, 'tannia-workspace-tw12-regresion-r1.mcpb');
  const dest = path.join(salida, 'contenido'); execFileSync(process.execPath, [CLI, 'unpack', mcpb, dest], { stdio: 'pipe' });
  return { out, dest, mcpb };
}

test('paquete INGENIERÍA construido en este equipo con destino win32-x64: manifiesto «win32», binario nativo de Windows verificado contra el lockfile y 89 herramientas (85 + entrega_estado, proyecto_migracion, metodo, recibos_verificar)', { timeout: 300000 }, () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'tw12-dist ')); const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'tw12-out '));
  try {
    const { out, dest, mcpb } = construir('win32-x64', dist, salida);
    const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.compatibility.platforms, ['win32'], 'no debe heredar la plataforma del constructor');
    assert.ok(!manifest.compatibility.platforms.includes('linux') && !manifest.compatibility.platforms.includes('darwin'));
    assert.equal(manifest.server.mcp_config.env.TANNIA_ENGINEERING, 'on');
    assert.equal(manifest.tools.length, 89); assert.ok(manifest.tools.some(t => t.name === 'tannia_planos'));
    const nativeDir = path.join(dest, 'server', 'node_modules', '@napi-rs');
    assert.deepEqual(fs.readdirSync(nativeDir).sort(), ['canvas', 'canvas-win32-x64-msvc'], 'solo el binario del destino');
    const binario = path.join(nativeDir, 'canvas-win32-x64-msvc', 'skia.win32-x64-msvc.node');
    assert.ok(fs.statSync(binario).size > 1e6, 'binario nativo presente');
    assert.equal(fs.readFileSync(binario).subarray(0, 2).toString('latin1'), 'MZ', 'es un ejecutable de Windows (PE), no ELF');
    const lock = JSON.parse(fs.readFileSync(path.join(raiz, 'package-lock.json'), 'utf8')).packages['node_modules/@napi-rs/canvas-win32-x64-msvc'];
    assert.equal(JSON.parse(fs.readFileSync(path.join(nativeDir, 'canvas-win32-x64-msvc', 'package.json'), 'utf8')).version, lock.version);
    const registro = JSON.parse(fs.readFileSync(path.join(dist, 'destino.json'), 'utf8')); assert.equal(registro.native_integrity, lock.integrity);
    assert.match(out, /"herramientas": 89/); assert.match(out, /"ok": true/);
    assert.match(fs.readFileSync(`${mcpb}.sha256`, 'utf8'), /^[0-9a-f]{64} /);
  } finally { fs.rmSync(dist, { recursive: true, force: true }); fs.rmSync(salida, { recursive: true, force: true }); }
});

test('el empaquetado se niega a declarar un destino distinto del binario construido (sin editar el manifiesto a mano)', { timeout: 300000 }, () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'tw12-dist ')); const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'tw12-out '));
  try {
    execFileSync(process.execPath, [path.join(raiz, 'scripts', 'build.mjs')], { env: { ...process.env, TANNIA_TARGET: 'win32-x64', TANNIA_DIST_DIR: dist }, stdio: 'pipe', cwd: raiz });
    assert.throws(() => execFileSync(process.execPath, [path.join(raiz, 'scripts', 'paquete-prueba.mjs'), '--etiqueta', 'x', '--fase', 'tw12', '--engineering', '--salida', salida], { env: { ...process.env, TANNIA_TARGET: 'linux-x64', TANNIA_DIST_DIR: dist }, stdio: 'pipe', cwd: raiz }), /se construyó para «win32-x64»/);
  } finally { fs.rmSync(dist, { recursive: true, force: true }); fs.rmSync(salida, { recursive: true, force: true }); }
});
void crypto;
