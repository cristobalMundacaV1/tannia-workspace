import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startClient, call, data, tmpHome, FIX } from './helpers.js';

test('TW-00A: vertical MCP stdio -> proyecto -> DXF -> respuesta', async () => {
  const home = tmpHome();
  const { client, close } = await startClient(home);
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    for (const n of ['tannia_diagnostico', 'tannia_proyecto_crear', 'tannia_dxf_inspeccionar']) assert.ok(tools.includes(n), n);

    const d = data(await call(client, 'tannia_diagnostico'));
    assert.equal(d.carpeta_escribible, true);

    const created = await call(client, 'tannia_proyecto_crear', { nombre: 'Casa Peñalolén' });
    assert.ok(!created.isError);
    fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(home, 'Proyectos', 'Casa Peñalolén', '02 Originales', 'plano.dxf'));

    const r = await call(client, 'tannia_dxf_inspeccionar', { proyecto: 'Casa Peñalolén', archivo: '02 Originales/plano.dxf' });
    assert.ok(!r.isError);
    const s = data(r);
    assert.equal(s.entidades_por_tipo.LINE, 1);
    assert.equal(s.entidades_por_tipo.CIRCLE, 1);
    assert.equal(s.unidades_declaradas, 'm');
    assert.equal(s.unidades_verificadas, false);
  } finally { await close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('TW-00A: archivo fuera del proyecto y DXF corrupto dan error claro', async () => {
  const home = tmpHome();
  const { client, close } = await startClient(home);
  try {
    await call(client, 'tannia_proyecto_crear', { nombre: 'P1' });
    for (const bad of ['../../etc/passwd', '/etc/passwd', 'C:\\Windows\\win.ini']) {
      const r = await call(client, 'tannia_dxf_inspeccionar', { proyecto: 'P1', archivo: bad });
      assert.equal(r.isError, true, bad);
      assert.match(data(r).error, /RUTA_/);
    }
    fs.copyFileSync(path.join(FIX, 'dxf', 'corrupto.dxf'), path.join(home, 'Proyectos', 'P1', '03 Trabajo', 'c.dxf'));
    const r = await call(client, 'tannia_dxf_inspeccionar', { proyecto: 'P1', archivo: '03 Trabajo/c.dxf' });
    assert.equal(r.isError, true);
    assert.equal(data(r).error, 'DXF_CORRUPTO');
  } finally { await close(); fs.rmSync(home, { recursive: true, force: true }); }
});
