// TW-11 G0: línea base de herramientas MCP (nombres, hash de esquema, tamaño de tools/list). Uso: node scripts/tw11-baseline.mjs [--escribir] [--cic]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function medirHerramientas({ cic = false, entry = path.join(ROOT, 'src', 'main.js') } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tw11-base-'));
  const env = { ...process.env, TANNIA_HOME: home }; if (cic) env.TANNIA_CIC = 'on'; else delete env.TANNIA_CIC;
  const client = new Client({ name: 'baseline', version: '1' }); const t0 = Date.now();
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env, stderr: 'pipe' })); const arranque_ms = Date.now() - t0;
  try {
    const { tools } = await client.listTools(); const json = JSON.stringify(tools);
    const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
    return { cic, total: tools.length, bytes_tools_list: Buffer.byteLength(json), tokens_estimados: Math.ceil(json.length / 4), arranque_ms,
      herramientas: tools.map((t) => ({ nombre: t.name, sha256_esquema: sha(t.inputSchema), sha256_descripcion: sha(t.description) })).sort((a, b) => a.nombre.localeCompare(b.nombre)) };
  } finally { await client.close(); fs.rmSync(home, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await medirHerramientas({ cic: process.argv.includes('--cic') });
  if (process.argv.includes('--escribir')) { const f = path.join(ROOT, 'fixtures', 'tw11', process.argv.includes('--cic') ? 'tools_cic.json' : 'tools_baseline.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(r, null, 2)); console.log('escrito', f); }
  console.log(JSON.stringify({ total: r.total, bytes: r.bytes_tools_list, tokens: r.tokens_estimados, arranque_ms: r.arranque_ms }));
}
