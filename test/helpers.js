import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIX = path.join(ROOT, 'fixtures');
// Se invoca el CLI de mcpb con node directamente (evita shell/.cmd y problemas con espacios en rutas de Windows)
export const MCPB_JS = path.join(ROOT, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
export const mcpb = (args, opts = {}) => execFileSync(process.execPath, [MCPB_JS, ...args], { stdio: 'pipe', ...opts });
export const tmpHome = (prefix = 'tannia test ñ ') => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

export async function startClient(home, entry = path.join(ROOT, 'src', 'main.js')) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { ...process.env, TANNIA_HOME: home }, stderr: 'pipe' });
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}
export const call = async (c, name, args = {}) => c.callTool({ name, arguments: args });
export const data = (r) => r.structuredContent;
