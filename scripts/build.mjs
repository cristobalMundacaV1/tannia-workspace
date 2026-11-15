// Construye dist/mcpb/: bundle único (sin node_modules) + manifest.json generado desde las herramientas reales.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'mcpb');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'server'), { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'main.js')],
  outfile: path.join(out, 'server', 'index.js'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node18', minify: false, legalComments: 'none',
  logLevel: 'warning',
});

const { createServer } = await import(path.join(root, 'src', 'server.js'));
const { VERSION } = await import(path.join(root, 'src', 'version.js'));
const tmp = fs.mkdtempSync(path.join(root, '.tmp-build-'));
const { server } = createServer({ home: tmp });
const [a, b] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'build', version: '1' });
await Promise.all([server.connect(a), client.connect(b)]);
const tools = (await client.listTools()).tools.map((t) => ({ name: t.name, description: t.description }));
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
    mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'], env: { TANNIA_HOME: '${user_config.carpeta_tannia}' } },
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
for (const f of ['LICENSE-THIRD-PARTY.txt']) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
console.log(`build OK -> ${out} (${tools.length} herramientas, ${(fs.statSync(path.join(out, 'server', 'index.js')).size / 1024).toFixed(0)} KB)`);
