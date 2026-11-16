// Incidente real en Claude Desktop (Windows): el paquete TW-09 H4/H5 apareció instalado pero con advertencia «path escape: <nombre visible>».
// Causa probable (no confirmada en el código de Claude Desktop): el nombre visible incluía "/" ("H4/H5") y se trató como ruta.
// Estas pruebas reproducen el caso, fijan las reglas de nombres/rutas y verifican el bundle como lo haría un cliente MCP.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { esSegmentoSeguro, validarNombreVisible, validarManifest, validarRutasPaquete } from '../scripts/lib/nombres.mjs';
import { verificarBundle } from '../scripts/lib/verificar_bundle.mjs';
import { crearPaquetePrueba } from '../scripts/paquete-prueba.mjs';
import { ROOT, mcpb } from './helpers.js';

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const construir = () => execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
const MALO = 'Tannia Workspace — PRUEBA TW-09 H4/H5 (fc48937)'; const SEGURO = 'Tannia Workspace - TW09 H4-H5 (fc48937)';

test('REPRODUCCIÓN: "H4/H5" es un separador de ruta; "H4-H5" no — y el validador oficial de mcpb NO detecta el problema', () => {
  assert.equal(esSegmentoSeguro(MALO), false, 'con "/" el nombre ya no es un único segmento (modelo del "path escape")');
  assert.equal(esSegmentoSeguro(SEGURO), true); assert.equal(esSegmentoSeguro('Tannia Workspace - PRUEBA H4/H5'), false); assert.equal(esSegmentoSeguro('Tannia Workspace - PRUEBA H4-H5'), true);
  const e = validarNombreVisible(MALO); assert.ok(e.some((x) => /separadores de ruta/.test(x) && x.includes('"/"')), e.join(' | '));
  assert.deepEqual(validarNombreVisible(SEGURO), []); assert.deepEqual(validarNombreVisible('Tannia Workspace - TW09 H4-H5 (fc48937)'), []);
  // La validación OFICIAL (mcpb validate) acepta el manifiesto con "/": por eso hace falta nuestra validación previa
  construir(); const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'mcpb', 'manifest.json'), 'utf8')); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mf '));
  try {
    const f = path.join(tmp, 'manifest.json'); fs.writeFileSync(f, JSON.stringify({ ...base, name: 'tannia-workspace-tw09', display_name: MALO, version: '0.1.0-tw09.fc48937' }));
    assert.doesNotThrow(() => mcpb(['validate', f]), 'mcpb validate NO rechaza el nombre con "/"');
    assert.ok(validarManifest({ ...base, display_name: MALO, name: 'tannia-workspace-tw09', version: '0.1.0-tw09.fc48937' }).errores.length >= 1, 'nuestra validación sí');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('reglas de nombres: separadores, reservados de Windows, puntos/espacios finales, largo, control, ids internos y versiones', () => {
  for (const mal of ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', ' a', 'a ', 'a.', 'CON', 'nul', 'a\tb', 'x'.repeat(81), '', '  ', 'a — b', 'a ¿b?']) assert.ok(validarNombreVisible(mal).length >= 1, `debe rechazar ${JSON.stringify(mal)}`);
  for (const bien of ['Tannia Workspace', 'Tannia Workspace - TW09 H4-H5 (fc48937)', 'Casa Ñandú 2', 'Prueba_1.2 (rc+3) #4']) assert.deepEqual(validarNombreVisible(bien), [], bien);
  const m = (o) => ({ name: 'tannia-workspace-tw09', display_name: 'Tannia Workspace', version: '0.1.0-rc.3', server: { entry_point: 'server/index.js', mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'] } }, tools: [{ name: 'a_b' }], ...o });
  assert.deepEqual(validarManifest(m({})).errores, []);
  for (const o of [{ name: 'Tannia/WS' }, { name: 'tannia ws' }, { name: 'X' }, { version: 'v1' }, { version: '0.1.0/x' }, { tools: [{ name: 'a' }, { name: 'a' }] }, { tools: [{ name: 'a/b' }] }, { server: { entry_point: '../x.js', mcp_config: { args: [] } } }, { server: { entry_point: 'C:\\x.js', mcp_config: { args: [] } } }]) assert.ok(validarManifest(m(o)).errores.length >= 1, JSON.stringify(o));
  assert.ok(validarManifest(m({ server: { entry_point: 'server/index.js', mcp_config: { command: 'node', args: ['server/index.js'] } } })).avisos.length >= 1);
});

test('rutas internas del paquete: traversal, absolutas, barra invertida, caracteres de Windows, reservados, largo y colisiones de mayúsculas', () => {
  assert.deepEqual(validarRutasPaquete(['manifest.json', 'server/index.js', 'server/package.json', 'LICENSE-THIRD-PARTY.txt', 'sub dir/ñandú.txt']), []);
  for (const mal of [['../x'], ['/abs'], ['C:/x'], ['a\\b'], ['a/../b'], ['a/b:c'], ['a/con.txt'], ['a/b.'], ['a/b '], ['a/b?'], ['x'.repeat(200)], ['A.txt', 'a.TXT']]) assert.ok(validarRutasPaquete(mal).length >= 1, JSON.stringify(mal).slice(0, 60));
});

test('el manifiesto generado por el build del producto cumple las reglas, y un nombre inseguro NO se empaqueta (falla antes de crear nada)', async () => {
  construir(); const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'mcpb', 'manifest.json'), 'utf8')); const v = validarManifest(m); assert.deepEqual(v.errores, [], v.errores.join(' | ')); assert.deepEqual(v.avisos, []);
  const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'salida ñ '));
  try {
    await assert.rejects(() => crearPaquetePrueba({ etiqueta: 'fc48937', nombre: MALO, salida }), /Manifiesto no válido[\s\S]*separadores de ruta/);
    await assert.rejects(() => crearPaquetePrueba({ etiqueta: 'a/b', salida }), /--etiqueta/); await assert.rejects(() => crearPaquetePrueba({ etiqueta: 'x', id: 'Tannia/WS', salida }), /name/);
    assert.deepEqual(fs.readdirSync(salida), [], 'no se creó ningún archivo');
  } finally { fs.rmSync(salida, { recursive: true, force: true }); }
});

test('paquete de prueba seguro: se genera, se verifica como cliente MCP (initialize + herramientas exactas + esquemas) y el servidor es idéntico al del build', async () => {
  construir(); const dist = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'mcpb', 'manifest.json'), 'utf8')); const salida = fs.mkdtempSync(path.join(os.tmpdir(), 'salida ñ '));
  try {
    const r = await crearPaquetePrueba({ etiqueta: 'fc48937', revision: 'r2', nombre: SEGURO, salida });
    assert.equal(r.manifiesto.name, 'tannia-workspace-tw09', 'el identificador interno se conserva (permite reemplazar la instalación anterior)'); assert.equal(r.manifiesto.display_name, SEGURO); assert.equal(r.manifiesto.version, '0.1.0-tw09.fc48937.r2');
    assert.equal(r.verificacion.ok, true, r.verificacion.problemas.join(' | ')); const d = r.verificacion.datos;
    assert.equal(d.herramientas, dist.tools.length); assert.equal(d.esquemas_invalidos, 0); assert.equal(d.diagnostico, 'ok'); assert.ok(d.initialize.servidor && d.initialize.instrucciones && d.initialize.capacidades.includes('tools'));
    assert.equal(d.server_index_js_sha256, sha(path.join(ROOT, 'dist', 'mcpb', 'server', 'index.js')), 'el servidor del paquete es byte a byte el del build (sin cambios de código)');
    assert.equal(fs.readFileSync(`${r.archivo}.sha256`, 'utf8').split(' ')[0], sha(r.archivo)); assert.ok(fs.existsSync(`${r.archivo}.verificacion.json`));
    // un nombre de archivo/etiqueta seguro; la verificación detecta una expectativa distinta
    const mal = await verificarBundle(r.archivo, { esperadas: dist.tools.length + 1 }); assert.equal(mal.ok, false); assert.match(mal.problemas.join(' '), /se esperaban exactamente/);
    // misma identidad interna con otra versión: reemplazable
    const r2 = await crearPaquetePrueba({ etiqueta: 'fc48937', revision: 'r3', nombre: SEGURO, salida }); assert.equal(r2.manifiesto.name, r.manifiesto.name); assert.notEqual(r2.manifiesto.version, r.manifiesto.version); assert.equal(r2.verificacion.ok, true);
  } finally { fs.rmSync(salida, { recursive: true, force: true }); }
});
