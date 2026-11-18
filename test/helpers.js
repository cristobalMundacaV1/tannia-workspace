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

export async function startClient(home, entry = path.join(ROOT, 'src', 'main.js'), extraEnv = {}) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { ...process.env, TANNIA_HOME: home, ...extraEnv }, stderr: 'pipe' });
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}
export const call = async (c, name, args = {}) => c.callTool({ name, arguments: args });
export const data = (r) => r.structuredContent;

/**
 * Cliente MCP con una «persona» que responde las ventanas de confirmación (elicitación) del cliente. Simula la interacción
 * humana fuera del alcance del modelo: el modelo llama herramientas, no puede responder estas ventanas.
 */
export async function startClientConPersona(home, entry = path.join(ROOT, 'src', 'main.js'), respuestas = [], extraEnv = {}) {
  const { ElicitRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
  const vistos = [];
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { ...process.env, TANNIA_HOME: home, TANNIA_SIN_DIALOGO: '1', ...extraEnv }, stderr: 'pipe' });
  const client = new Client({ name: 'test-persona', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => { vistos.push(req.params.message); return respuestas.length ? respuestas.shift() : { action: 'decline' }; });
  await client.connect(transport);
  return { client, vistos, respuestas, close: () => client.close() };
}
export const PERSONA_SI = (nombre = 'Tannia') => ({ action: 'accept', content: { aprobar: true, nombre } });

/** Delta de contrato de herramientas 0.2.0-rc.1 respecto de rc.3: nuevas y esquemas cambiados A PROPÓSITO (fixtures/rc). */
export const CONTRATO_RC02 = JSON.parse(fs.readFileSync(path.join(FIX, 'rc', 'contrato_herramientas_0.2.json'), 'utf8'));
export const NUEVAS_RC02 = Object.keys(CONTRATO_RC02.nuevas);
