// Construye dist/mcpb/: bundle único (sin node_modules) + manifest.json generado desde las herramientas reales.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolverDestino } from './lib/destino.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = process.env.TANNIA_DIST_DIR ? path.resolve(process.env.TANNIA_DIST_DIR) : path.join(root, 'dist');
const out = path.join(distDir, 'mcpb');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'server'), { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'main.js')],
  outfile: path.join(out, 'server', 'index.js'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node18', minify: false, legalComments: 'none',
  external: ['@napi-rs/canvas'],
  logLevel: 'warning',
});

// Native raster backend for the DESTINATION platform (TANNIA_TARGET), never the builder's: when it differs from the
// builder the exact lockfile version is downloaded and verified against the lockfile sha512.
const nativeRoot = path.join(root, 'node_modules', '@napi-rs');
const nativeOut = path.join(out, 'server', 'node_modules', '@napi-rs');
const destino = resolverDestino();
const lockPackages = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages;
const lock = lockPackages[`node_modules/${destino.native}`];
if (!lock) throw new Error(`package-lock.json no contiene ${destino.native}`);
fs.mkdirSync(nativeOut, { recursive: true });
fs.cpSync(path.join(nativeRoot, 'canvas'), path.join(nativeOut, 'canvas'), { recursive: true });
const installed = path.join(nativeRoot, destino.nativeDir);
if (fs.existsSync(installed) && JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8')).version === lock.version) {
  fs.cpSync(installed, path.join(nativeOut, destino.nativeDir), { recursive: true });
} else {
  const crypto = await import('node:crypto'); const cp = await import('node:child_process'); const os = await import('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-native-'));
  cp.execFileSync('npm', ['pack', `${destino.native}@${lock.version}`, '--pack-destination', tmp, '--silent'], { stdio: 'inherit', shell: process.platform === 'win32' });
  const tgz = path.join(tmp, fs.readdirSync(tmp).find(f => f.endsWith('.tgz')));
  const [algo, expected] = lock.integrity.split('-'); const actual = crypto.createHash(algo).update(fs.readFileSync(tgz)).digest('base64');
  if (actual !== expected) throw new Error(`Integridad de ${destino.native} no coincide con package-lock.json`);
  cp.execFileSync('tar', ['-xzf', tgz, '-C', tmp], { stdio: 'inherit' });
  fs.cpSync(path.join(tmp, 'package'), path.join(nativeOut, destino.nativeDir), { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}
fs.writeFileSync(path.join(distDir, 'destino.json'), JSON.stringify({ target: destino.target, platforms: destino.platforms, native: destino.native, native_version: lock.version, native_integrity: lock.integrity }, null, 2));

fs.writeFileSync(path.join(out, 'server', 'package.json'), '{"type":"commonjs"}\n');
const { createServer } = await import(pathToFileURL(path.join(root, 'src', 'server.js')).href);
const { VERSION } = await import(pathToFileURL(path.join(root, 'src', 'version.js')).href);
const tmp = fs.mkdtempSync(path.join(root, '.tmp-build-'));
const { server } = createServer({ home: tmp });
const [a, b] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'build', version: '1' });
await Promise.all([server.connect(a), client.connect(b)]);
const tools = (await client.listTools()).tools.map((t) => ({ name: t.name, description: t.description }));
// PL-01: un build sin el motor de planos no es un candidato válido (prueba negativa en test/rc_pl01_habilitacion.test.js).
if (!tools.some((t) => t.name === 'tannia_planos')) { console.error('build: el catálogo no incluye tannia_planos'); process.exit(1); }
await client.close(); fs.rmSync(tmp, { recursive: true, force: true });

const manifest = {
  manifest_version: '0.3',
  name: 'tannia-workspace',
  display_name: 'Tannia Workspace',
  version: VERSION.replace(/-rc\.(\d+)$/, '-rc.$1'),
  description: 'Asistente local para AutoCAD 2D/3D, cubicaciones, presupuestos/APU, informes y normativa chilena. Sin BIM/IFC.',
  long_description: 'Servidor MCP local. Trabaja solo con proyectos de la carpeta Tannia Workspace, protege los originales y entrega resultados en Excel y PDF. Candidato de lanzamiento: el uso con AutoCAD real no ha sido validado.',
  author: { name: 'Tannia Workspace' },
  license: 'UNLICENSED',
  server: {
    type: 'node',
    entry_point: 'server/index.js',
    mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'], env: { TANNIA_HOME: '${user_config.carpeta_tannia}', TANNIA_ENGINEERING: 'on' } },
  },
  tools,
  tools_generated: false,
  user_config: {
    carpeta_tannia: {
      type: 'directory', title: 'Carpeta de Tannia Workspace',
      description: 'Aquí se guardan los proyectos (Proyectos/<nombre>). Puede dejar la sugerida.',
      default: '${HOME}/Documents/Tannia Workspace', required: true,
    },
  },
  compatibility: { platforms: ['win32', 'darwin', 'linux'], runtimes: { node: '>=18.0.0' } },
};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
// R-03: identidad de compilación visible en el diagnóstico (qué código exacto se instaló). Sin fecha, para conservar la reproducibilidad.
{ const { execFileSync: ex } = await import('node:child_process'); let commit = 'desconocido'; let arbol_limpio = false;
  try { commit = ex('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); arbol_limpio = ex('git', ['status', '--porcelain', '--', 'src', 'scripts', 'package.json', 'package-lock.json'], { cwd: root, encoding: 'utf8' }).trim() === ''; } catch { /* sin git: se declara desconocido */ }
  fs.writeFileSync(path.join(out, 'server', 'compilacion.json'), JSON.stringify({ schema: 'tw.compilacion/1', version: VERSION, commit, arbol_limpio }, null, 2)); }
fs.copyFileSync(path.join(root, 'src', 'drawing', 'FONT_LICENSE.txt'), path.join(out, 'FONT_LICENSE.txt'));
for (const f of ['LICENSE-THIRD-PARTY.txt']) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
// Reproducibilidad: fechas fijas para que el .mcpb sea idéntico bit a bit con las mismas entradas.
const FIXED = new Date('2026-01-01T00:00:00Z');
const fix = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) fix(f); fs.utimesSync(f, FIXED, FIXED); } fs.utimesSync(d, FIXED, FIXED); };
fix(out);
console.log(`build OK -> ${out} (${tools.length} herramientas, ${(fs.statSync(path.join(out, 'server', 'index.js')).size / 1024).toFixed(0)} KB)`);
