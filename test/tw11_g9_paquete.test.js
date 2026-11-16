// TW-11 G9: paquetes reproducibles desde el bundle desempaquetado: CIC APAGADO (72, idéntico a rc3) y candidato con CIC ACTIVADO (72 + tannia_cic_*).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './helpers.js';
import { crearPaquetePrueba } from '../scripts/paquete-prueba.mjs';

test('paquete CIC apagado = 72 herramientas; candidato CIC activado = 72 + tannia_cic_*; identidades distintas; el CIC NO se activa solo en el paquete base', async () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { stdio: 'pipe', cwd: ROOT });
  const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'Salida ñ tw11 ')); const previo = process.env.TANNIA_CIC; process.env.TANNIA_CIC = 'on'; // el verificador NO debe heredarlo
  try {
    const off = await crearPaquetePrueba({ etiqueta: 'g9test', revision: 'cicoff', id: 'tannia-workspace-tw11', nombre: 'Tannia Workspace - TW11 CIC APAGADO (g9test)', salida, fase: 'tw11', esperadas: 72 });
    assert.equal(off.verificacion.ok, true, JSON.stringify(off.verificacion.problemas)); assert.equal(off.verificacion.datos.herramientas, 72);
    const on = await crearPaquetePrueba({ etiqueta: 'g9test', revision: 'cicon', id: 'tannia-workspace-tw11-cic', nombre: 'Tannia Workspace - TW11 CIC ACTIVADO (g9test)', salida, fase: 'tw11', cic: true, esperadas: 83 });
    assert.equal(on.verificacion.ok, true, JSON.stringify(on.verificacion.problemas)); assert.equal(on.verificacion.datos.herramientas, 83);
    assert.notEqual(off.sha256, on.sha256); assert.equal(off.verificacion.datos.identidad_paquete.id, 'tannia-workspace-tw11'); assert.equal(on.verificacion.datos.identidad_paquete.id, 'tannia-workspace-tw11-cic'); assert.match(on.verificacion.datos.identidad_paquete.version, /cicon$/);
    assert.ok(fs.existsSync(`${off.archivo}.sha256`) && fs.existsSync(`${on.archivo}.verificacion.json`));
  } finally { if (previo === undefined) delete process.env.TANNIA_CIC; else process.env.TANNIA_CIC = previo; }
});
