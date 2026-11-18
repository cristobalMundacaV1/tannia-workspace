#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { describeHome } from './config.js';
import { ejecutarTrabajo } from './trabajos/worker.js';

// stdout es el canal del protocolo: los logs van a stderr y sin datos de usuario.
import os from 'node:os';
// Redacción: nunca se registran rutas personales completas (carpeta del usuario → «~»).
const HOME = os.homedir();
const redactar = (v) => (typeof v === 'string' && HOME && HOME.length > 3 ? v.split(HOME).join('~') : v);
const log = (evento, datos) => process.stderr.write(`${JSON.stringify({ evento, ...Object.fromEntries(Object.entries(datos || {}).map(([k, v]) => [k, redactar(v)])) })}\n`);

async function main() {
  // CAD-BG: el mismo ejecutable corre un trabajo en segundo plano (proceso oculto, sin canal MCP con Claude Desktop).
  const iT = process.argv.indexOf('--trabajo');
  if (iT > 0) { await ejecutarTrabajo(process.argv[iT + 1], process.env.TANNIA_HOME); setTimeout(() => process.exit(), 50).unref(); return; }
  // Prueba autónoma de planos (sin Claude): node server/index.js --planos-prueba "C:\\ruta\\nueva"
  const iP = process.argv.indexOf('--planos-prueba');
  if (iP > 0) {
    const { pruebaAutonomaPlanos } = await import('./drawing/prueba_autonoma.js');
    try { const r = await pruebaAutonomaPlanos(process.argv[iP + 1]); process.stdout.write(`${JSON.stringify({ ok: r.ok, version: r.version, proyectos: r.proyectos.map((p) => ({ nombre: p.nombre, revision: p.revision, laminas: p.laminas, gates: p.gates, carpeta: p.carpeta })) }, null, 2)}\n`); process.exitCode = r.ok ? 0 : 2; }
    catch (e) { process.stderr.write(`No se pudo completar la prueba de planos: ${e.message}\n`); process.exitCode = 1; }
    setTimeout(() => process.exit(), 50).unref(); return;
  }
  const info = describeHome();
  const { server } = createServer({ home: info.home, homeInfo: info, log });
  await server.connect(new StdioServerTransport());
  log('servidor_iniciado', {});
}
main().catch((e) => { log('fallo_arranque', { mensaje: String(e && e.message) }); process.exit(1); });
