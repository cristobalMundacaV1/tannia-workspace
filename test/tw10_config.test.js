import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describeHome, defaultHome } from '../src/config.js';
import { startClient, call, data, tmpHome } from './helpers.js';

test('TANNIA_HOME: origen, valores inválidos y advertencias (apóstrofo, carpeta hermana)', () => {
  assert.deepEqual([describeHome({}).origen, describeHome({ TANNIA_HOME: '  ' }).origen], ['predeterminada', 'predeterminada']);
  assert.equal(describeHome({ TANNIA_HOME: '${user_config.carpeta_tannia}' }).home, defaultHome());
  assert.match(describeHome({ TANNIA_HOME: '${user_config.carpeta_tannia}' }).advertencias[0], /sin resolver/);
  const rel = describeHome({ TANNIA_HOME: 'carpeta/relativa' }); assert.equal(rel.home, defaultHome()); assert.match(rel.advertencias[0], /absoluta/);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'Documentos ñ '));
  fs.mkdirSync(path.join(base, 'Tannia Workspace', 'Proyectos'), { recursive: true });
  const apos = describeHome({ TANNIA_HOME: path.join(base, "'Tannia Workspace") });
  assert.equal(apos.origen, 'configuracion_de_la_extension');
  assert.ok(apos.advertencias.some((a) => /apóstrofo/.test(a)), 'avisa del apóstrofo inicial');
  assert.ok(apos.advertencias.some((a) => /otra carpeta "Tannia Workspace"/.test(a)), 'avisa de la carpeta hermana con proyectos');
  assert.equal(describeHome({ TANNIA_HOME: path.join(base, 'Tannia Workspace') }).advertencias.length, 0);
  fs.rmSync(base, { recursive: true, force: true });
});

test('TANNIA_HOME: al reiniciar con otra carpeta el servidor usa la nueva; la anterior queda intacta; el diagnóstico lo muestra', async () => {
  const a = tmpHome("'Tannia A ñ "); const b = tmpHome('Tannia B ó ');
  try {
    let c = await startClient(a);
    await call(c.client, 'tannia_proyecto_crear', { nombre: 'Obra A' });
    const d1 = data(await call(c.client, 'tannia_diagnostico')); await c.close();
    assert.equal(d1.carpeta_tannia, a); assert.equal(d1.origen_carpeta, 'configuracion_de_la_extension');
    assert.ok(d1.advertencias_configuracion.some((x) => /apóstrofo/.test(x)) || !path.basename(a).startsWith("'"), 'la carpeta con apóstrofo inicial se señala');
    c = await startClient(b);
    const d2 = data(await call(c.client, 'tannia_diagnostico'));
    assert.equal(d2.carpeta_tannia, b); assert.equal(d2.proyectos, 0);
    assert.notEqual(d2.servidor_iniciado, null); assert.notEqual(d2.pid_servidor, d1.pid_servidor);
    assert.equal(data(await call(c.client, 'tannia_listar_proyectos')).proyectos.length, 0, 'no ve los proyectos de la carpeta anterior');
    await call(c.client, 'tannia_proyecto_crear', { nombre: 'Obra B' }); await c.close();
    c = await startClient(a);
    assert.deepEqual(data(await call(c.client, 'tannia_listar_proyectos')).proyectos.map((p) => p.nombre), ['Obra A'], 'datos previos intactos al volver');
    await c.close();
    assert.ok(fs.existsSync(path.join(b, 'Proyectos', 'Obra B')));
  } finally { fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(b, { recursive: true, force: true }); }
});
