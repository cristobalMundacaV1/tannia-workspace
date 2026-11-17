// Genera un .mcpb DE PRUEBA reproducible desde dist/mcpb (resultado de `npm run build`): re-rotula el manifiesto con un nombre visible
// SEGURO, valida nombres y rutas, empaqueta con el CLI oficial, calcula SHA-256 y verifica el bundle como un cliente MCP.
//   node scripts/paquete-prueba.mjs --etiqueta fc48937 --revision r2 [--id tannia-workspace-tw09] [--nombre "Tannia Workspace - TW09 H4-H5 (fc48937)"] [--salida carpeta] [--esperadas 61]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validarManifest, validarRutasPaquete } from './lib/nombres.mjs';
import { resolverDestino } from './lib/destino.mjs';
import { verificarBundle } from './lib/verificar_bundle.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(raiz, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
/** Lista las herramientas que publica el bundle construido con el flag CIC encendido (para declararlas en el manifiesto del candidato CIC). */
async function herramientasConCic(origen, engineering = false) {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js'); const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cic-tools ')); const c = new Client({ name: 'cic-tools', version: '1' });
  await c.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(origen, 'server', 'index.js')], env: { ...process.env, TANNIA_HOME: home, TANNIA_CIC: 'on', TANNIA_ENGINEERING: engineering ? 'on' : 'off' }, stderr: 'pipe' }));
  try { return (await c.listTools()).tools.map((t) => ({ name: t.name, description: t.description })); } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
}
export async function crearPaquetePrueba({ etiqueta, revision, id = 'tannia-workspace-tw09', nombre, descripcion, salida, esperadas, fase = 'tw09', cic = false, engineering = false }) {
  if (!/^[a-z0-9]+$/.test(fase)) throw new Error('--fase solo admite minúsculas y dígitos (ej. tw10)');
  if (!etiqueta || !/^[0-9A-Za-z._-]+$/.test(etiqueta)) throw new Error('--etiqueta es obligatoria y solo admite letras, dígitos . _ -');
  const distDir = process.env.TANNIA_DIST_DIR ? path.resolve(process.env.TANNIA_DIST_DIR) : path.join(raiz, 'dist'); const origen = path.join(distDir, 'mcpb'); if (!fs.existsSync(path.join(origen, 'manifest.json'))) throw new Error('Falta dist/mcpb: ejecute `npm run build` primero.');
  const base = JSON.parse(fs.readFileSync(path.join(origen, 'manifest.json'), 'utf8'));
  const m = { ...base, name: id, version: `0.1.0-${fase}.${etiqueta}${revision ? `.${revision}` : ''}`, display_name: nombre ?? `Tannia Workspace - PRUEBA ${etiqueta}`, description: descripcion ?? `PAQUETE DE PRUEBA (código del commit ${etiqueta}). No sustituye a rc.3. No verificado en AutoCAD ni Claude Desktop reales.` };
  if (cic || engineering) { m.tools = await herramientasConCic(origen, engineering); m.server = { ...m.server, mcp_config: { ...m.server.mcp_config, env: { ...(m.server.mcp_config.env || {}), TANNIA_CIC: 'on', ...(engineering ? { TANNIA_ENGINEERING: 'on' } : {}) } } }; }
  if (engineering) {
    // La plataforma declarada es la de DESTINO (TANNIA_TARGET) y debe coincidir con el binario realmente incluido por build.mjs.
    const destino = resolverDestino(); const regDest = path.join(distDir, 'destino.json');
    const construido = fs.existsSync(regDest) ? JSON.parse(fs.readFileSync(regDest, 'utf8')) : null;
    if (!construido || construido.target !== destino.target) throw new Error(`El bundle se construyó para «${construido?.target ?? 'desconocido'}» y se pide «${destino.target}»: ejecute \`npm run build\` con el mismo TANNIA_TARGET.`);
    const nativas = fs.readdirSync(path.join(origen, 'server', 'node_modules', '@napi-rs')).filter(n => n.startsWith('canvas-'));
    if (nativas.length !== 1 || nativas[0] !== destino.nativeDir) throw new Error(`El paquete debe incluir exactamente ${destino.nativeDir}; contiene: ${nativas.join(', ') || 'ninguno'}`);
    const vNativa = JSON.parse(fs.readFileSync(path.join(origen, 'server', 'node_modules', '@napi-rs', nativas[0], 'package.json'), 'utf8')).version;
    if (vNativa !== construido.native_version) throw new Error('La versión del binario nativo no coincide con package-lock.json');
    m.compatibility = { platforms: destino.platforms, runtimes: { node: '>=20.0.0' } };
  }
  const v = validarManifest(m); if (v.errores.length) throw new Error(`Manifiesto no válido, no se empaqueta:\n - ${v.errores.join('\n - ')}`);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'paquete-prueba ')); fs.cpSync(origen, stage, { recursive: true }); fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(m, null, 2));
  const fixed = new Date('2026-01-01T00:00:00Z');
  const fixDates = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) fixDates(f); fs.utimesSync(f, fixed, fixed); } fs.utimesSync(d, fixed, fixed); }; fixDates(stage);
  const rutas = []; const walk = (d, rel = '') => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else rutas.push(r); } }; walk(stage);
  const er = validarRutasPaquete(rutas); if (er.length) throw new Error(`Rutas del paquete no válidas:\n - ${er.join('\n - ')}`);
  execFileSync(process.execPath, [CLI, 'validate', path.join(stage, 'manifest.json')], { stdio: 'pipe' });
  const dirOut = salida ?? path.join(raiz, 'dist', 'paquete-prueba'); fs.mkdirSync(dirOut, { recursive: true });
  const archivo = path.join(dirOut, `tannia-workspace-${fase}-${etiqueta}${revision ? `-${revision}` : ''}.mcpb`);
  execFileSync(process.execPath, [CLI, 'pack', stage, archivo], { stdio: 'pipe' }); fs.rmSync(stage, { recursive: true, force: true });
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex'); fs.writeFileSync(`${archivo}.sha256`, `${sha256}  ${path.basename(archivo)}\n`);
  const verificacion = await verificarBundle(archivo, { esperadas: esperadas ?? m.tools.length });
  fs.writeFileSync(`${archivo}.verificacion.json`, JSON.stringify({ manifiesto: { name: m.name, display_name: m.display_name, version: m.version }, sha256, ...verificacion }, null, 2));
  return { archivo, sha256, manifiesto: { name: m.name, display_name: m.display_name, version: m.version }, verificacion };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
  crearPaquetePrueba({ etiqueta: arg('etiqueta'), revision: arg('revision'), id: arg('id'), nombre: arg('nombre'), salida: arg('salida'), cic: process.argv.includes('--cic'), engineering: process.argv.includes('--engineering'), esperadas: arg('esperadas') ? Number(arg('esperadas')) : undefined, fase: arg('fase') })
    .then((r) => { console.log(JSON.stringify({ archivo: r.archivo, sha256: r.sha256, ...r.manifiesto, ok: r.verificacion.ok, herramientas: r.verificacion.datos.herramientas, problemas: r.verificacion.problemas }, null, 2)); process.exit(r.verificacion.ok ? 0 : 1); })
    .catch((e) => { console.error(String(e.message)); process.exit(2); });
}
