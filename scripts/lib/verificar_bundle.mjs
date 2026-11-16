// Verifica un .mcpb como lo haría un cliente MCP: lo desempaqueta en una carpeta con espacios y Unicode, lanza `node server/index.js`
// con el mismo comando/argumentos del manifiesto, hace `initialize`, lista las herramientas y las contrasta con el manifiesto.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { validarManifest, validarRutasPaquete } from './nombres.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(raiz, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function esquemasInvalidos(tools) {
  const malos = []; const visitar = (n, r, t) => {
    if (Array.isArray(n)) return n.forEach((x, i) => visitar(x, `${r}[${i}]`, t));
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n.items) || n.prefixItems) malos.push(`${t} ${r}`);
    for (const [k, x] of Object.entries(n)) visitar(x, `${r}.${k}`, t);
  };
  for (const t of tools) { if (t.inputSchema?.type !== 'object') malos.push(`${t.name} (inputSchema sin type=object)`); visitar(t.inputSchema, 'inputSchema', t.name); }
  return malos;
}

/** @returns { ok, problemas[], datos } — nunca lanza por un fallo del paquete: lo informa. */
export async function verificarBundle(mcpbPath, { esperadas } = {}) {
  const problemas = []; const datos = { archivo: path.basename(mcpbPath), sha256: sha(mcpbPath), bytes: fs.statSync(mcpbPath).size };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'Verif bundle ñ '));
  const dir = path.join(tmp, 'Extensión instalada'); let cliente = null;
  try {
    execFileSync(process.execPath, [CLI, 'unpack', mcpbPath, dir], { stdio: 'pipe' });
    const archivos = []; const walk = (d, rel = '') => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else archivos.push(r); } }; walk(dir);
    problemas.push(...validarRutasPaquete(archivos).map((x) => `ruta: ${x}`)); datos.archivos = archivos.length;
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); const v = validarManifest(manifest);
    problemas.push(...v.errores.map((x) => `manifiesto: ${x}`)); datos.manifiesto = { name: manifest.name, display_name: manifest.display_name, version: manifest.version }; datos.avisos = v.avisos;
    const entrada = path.join(dir, ...String(manifest.server.entry_point).split('/'));
    if (!fs.existsSync(entrada)) problemas.push(`no existe el punto de entrada ${manifest.server.entry_point}`); else datos.server_index_js_sha256 = sha(entrada);
    // Mismo comando y argumentos que el manifiesto (con ${__dirname} sustituido por la carpeta de instalación)
    const cfg = manifest.server.mcp_config; const args = cfg.args.map((a) => String(a).replace('${__dirname}', dir));
    const home = path.join(tmp, 'Carpeta Tannia ñ'); fs.mkdirSync(home);
    const transporte = new StdioClientTransport({ command: cfg.command === 'node' ? process.execPath : cfg.command, args, env: { ...process.env, TANNIA_HOME: home }, stderr: 'pipe' });
    cliente = new Client({ name: 'verificador-de-paquete', version: '1.0.0' });
    await cliente.connect(transporte); // realiza `initialize`
    const info = cliente.getServerVersion(); datos.initialize = { servidor: info?.name, version: info?.version, instrucciones: !!cliente.getInstructions(), capacidades: Object.keys(cliente.getServerCapabilities() ?? {}) };
    if (!info?.name) problemas.push('initialize no devolvió serverInfo');
    const tools = (await cliente.listTools()).tools; datos.herramientas = tools.length;
    const publicadas = tools.map((t) => t.name).sort(); const declaradas = (manifest.tools ?? []).map((t) => t.name).sort();
    if (JSON.stringify(publicadas) !== JSON.stringify(declaradas)) problemas.push(`las herramientas publicadas (${publicadas.length}) no coinciden con las del manifiesto (${declaradas.length}): ${publicadas.filter((n) => !declaradas.includes(n)).concat(declaradas.filter((n) => !publicadas.includes(n))).slice(0, 8).join(', ')}`);
    if (esperadas != null && tools.length !== esperadas) problemas.push(`se esperaban exactamente ${esperadas} herramientas y se publicaron ${tools.length}`);
    const malos = esquemasInvalidos(tools); datos.esquemas_invalidos = malos.length; if (malos.length) problemas.push(`esquemas inválidos: ${malos.slice(0, 5).join(' | ')}`);
    const diag = await cliente.callTool({ name: 'tannia_diagnostico', arguments: {} }); datos.diagnostico = diag.isError ? 'ERROR' : 'ok'; if (diag.isError) problemas.push('tannia_diagnostico devolvió error');
    else { const v = diag.structuredContent?.versiones; datos.identidad_paquete = v?.paquete ?? null; datos.motor_arquitectonico = v?.motor_arquitectonico ?? null; if (v?.paquete?.origen !== 'manifest.json' || v.paquete.version !== manifest.version || v.paquete.id !== manifest.name) problemas.push(`el diagnóstico no informa la identidad del paquete instalado (esperado ${manifest.name} ${manifest.version}; obtenido ${JSON.stringify(v?.paquete ?? null)})`); }
  } catch (e) { problemas.push(`el paquete no inicia o no responde: ${String(e.message).split('\n')[0].slice(0, 200)}`); }
  finally { try { await cliente?.close(); } catch { /* cerrado */ } fs.rmSync(tmp, { recursive: true, force: true }); }
  return { ok: problemas.length === 0, problemas, datos };
}
