#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { describeHome } from './config.js';

// stdout es el canal del protocolo: los logs van a stderr y sin datos de usuario.
import os from 'node:os';
// Redacción: nunca se registran rutas personales completas (carpeta del usuario → «~»).
const HOME = os.homedir();
const redactar = (v) => (typeof v === 'string' && HOME && HOME.length > 3 ? v.split(HOME).join('~') : v);
const log = (evento, datos) => process.stderr.write(`${JSON.stringify({ evento, ...Object.fromEntries(Object.entries(datos || {}).map(([k, v]) => [k, redactar(v)])) })}\n`);

async function main() {
  const info = describeHome();
  const { server } = createServer({ home: info.home, homeInfo: info, log });
  await server.connect(new StdioServerTransport());
  log('servidor_iniciado', {});
}
main().catch((e) => { log('fallo_arranque', { mensaje: String(e && e.message) }); process.exit(1); });
