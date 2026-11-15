import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startClient, call, data, tmpHome, ROOT, FIX, mcpb } from './helpers.js';

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const build = (version) => {
  // Construye una "versión" distinta cambiando el manifest empaquetado (simula actualización)
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
  const mf = path.join(ROOT, 'dist', 'mcpb', 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8')); m.version = version; fs.writeFileSync(mf, JSON.stringify(m, null, 2));
  const out = path.join(os.tmpdir(), `tannia-${version}-${process.pid}.mcpb`);
  mcpb(['pack', path.join(ROOT, 'dist', 'mcpb'), out]);
  return out;
};
const unpack = (pkg, dest) => mcpb(['unpack', pkg, dest]);

test('TW-05: actualización conserva datos del usuario; desinstalar no borra proyectos; reinstalar los recupera', { timeout: 180000 }, async () => {
  const home = tmpHome('Datos Tannia ');
  const inst = fs.mkdtempSync(path.join(os.tmpdir(), 'ext instalada ñ '));
  const v1 = build('0.1.0'); const v2 = build('0.2.0');
  try {
    unpack(v1, inst);
    let c = await startClient(home, path.join(inst, 'server', 'index.js'));
    await call(c.client, 'tannia_proyecto_crear', { nombre: 'Obra Ñ' });
    fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(home, 'Proyectos', 'Obra Ñ', '02 Originales', 'p.dxf'));
    await call(c.client, 'tannia_originales_registrar', { proyecto: 'Obra Ñ' });
    await c.close();
    // actualizar: reemplazar el directorio de la extensión (los datos viven fuera)
    fs.rmSync(inst, { recursive: true, force: true }); fs.mkdirSync(inst); unpack(v2, inst);
    assert.equal(JSON.parse(fs.readFileSync(path.join(inst, 'manifest.json'), 'utf8')).version, '0.2.0');
    c = await startClient(home, path.join(inst, 'server', 'index.js'));
    const st = data(await call(c.client, 'tannia_proyecto_estado', { proyecto: 'Obra Ñ' }));
    assert.equal(st.integridad_originales.ok, true); assert.equal(st.integridad_originales.verificados, 1);
    await c.close();
    // desinstalar = eliminar la extensión: datos intactos
    fs.rmSync(inst, { recursive: true, force: true });
    assert.ok(fs.existsSync(path.join(home, 'Proyectos', 'Obra Ñ', '02 Originales', 'p.dxf')));
    // reinstalar
    fs.mkdirSync(inst); unpack(v1, inst);
    c = await startClient(home, path.join(inst, 'server', 'index.js'));
    assert.equal(data(await call(c.client, 'tannia_listar_proyectos')).proyectos[0].nombre, 'Obra Ñ');
    await c.close();
  } finally { fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(inst, { recursive: true, force: true }); fs.rmSync(v1, { force: true }); fs.rmSync(v2, { force: true }); execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' }); }
});

test('TW-05: los registros del servidor no contienen rutas, nombres de proyecto ni contenido', { timeout: 60000 }, async () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
  const home = tmpHome('Privado Secreto ');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const t = new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'dist', 'mcpb', 'server', 'index.js')], env: { ...process.env, TANNIA_HOME: home }, stderr: 'pipe' });
  let err = ''; t.stderr.on('data', (d) => { err += d; });
  const cl = new Client({ name: 't', version: '1' }); await cl.connect(t);
  await cl.callTool({ name: 'tannia_proyecto_crear', arguments: { nombre: 'ClienteConfidencial' } });
  await cl.callTool({ name: 'tannia_dxf_inspeccionar', arguments: { proyecto: 'ClienteConfidencial', archivo: '../../etc/passwd' } });
  fs.writeFileSync(path.join(home, 'Proyectos', 'ClienteConfidencial', '03 Trabajo', 'x.dxf'), 'basura confidencial');
  await cl.callTool({ name: 'tannia_dxf_inspeccionar', arguments: { proyecto: 'ClienteConfidencial', archivo: '03 Trabajo/x.dxf' } });
  await cl.close();
  for (const s of ['ClienteConfidencial', 'Privado Secreto', 'basura confidencial', 'passwd']) assert.ok(!err.includes(s), `log filtra: ${s}`);
  fs.rmSync(home, { recursive: true, force: true });
});

test('TW-05: reparar recrea carpetas y restaura JSON dañado; sin red en el código del producto', async () => {
  const home = tmpHome();
  const { client, close } = await startClient(home);
  try {
    await call(client, 'tannia_proyecto_crear', { nombre: 'R' });
    const root = path.join(home, 'Proyectos', 'R');
    fs.rmSync(path.join(root, '06 Informes'), { recursive: true });
    await call(client, 'tannia_presupuesto_config', { proyecto: 'R', iva_pct: 19 }); await call(client, 'tannia_presupuesto_config', { proyecto: 'R', iva_pct: 19 });
    fs.writeFileSync(path.join(root, '05 Presupuestos', 'config.json'), '{roto');
    const r = data(await call(client, 'tannia_proyecto_reparar', { proyecto: 'R' }));
    assert.ok(r.acciones.some((a) => /06 Informes/.test(a))); assert.ok(r.acciones.some((a) => /config\.json/.test(a)));
    assert.ok(fs.existsSync(path.join(root, '06 Informes')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '05 Presupuestos', 'config.json'), 'utf8')).iva_pct, 19);
  } finally { await close(); fs.rmSync(home, { recursive: true, force: true }); }
  const srcAll = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.js')) srcAll.push(fs.readFileSync(f, 'utf8')); } };
  walk(path.join(ROOT, 'src'));
  assert.ok(!srcAll.some((s) => /\bfetch\(|node:https?|require\('https?'\)|XMLHttpRequest|node:net'/.test(s)), 'el código propio no abre conexiones de red');
});

test('TW-05: carpeta sin permiso de escritura se reporta con mensaje claro', { skip: isRoot || process.platform === 'win32' }, async () => {
  const home = tmpHome('solo lectura '); fs.mkdirSync(path.join(home, 'Proyectos')); fs.chmodSync(home, 0o555); fs.chmodSync(path.join(home, 'Proyectos'), 0o555);
  const { client, close } = await startClient(home);
  try {
    const r = await call(client, 'tannia_diagnostico'); assert.equal(data(r).carpeta_escribible, false); assert.match(r.content[0].text, /PROBLEMA/);
  } finally { await close(); fs.chmodSync(home, 0o755); fs.chmodSync(path.join(home, 'Proyectos'), 0o755); fs.rmSync(home, { recursive: true, force: true }); }
});
