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
import { verificarBundle } from './lib/verificar_bundle.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(raiz, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
export async function crearPaquetePrueba({ etiqueta, revision, id = 'tannia-workspace-tw09', nombre, descripcion, salida, esperadas, fase = 'tw09' }) {
  if (!/^[a-z0-9]+$/.test(fase)) throw new Error('--fase solo admite minúsculas y dígitos (ej. tw10)');
  if (!etiqueta || !/^[0-9A-Za-z._-]+$/.test(etiqueta)) throw new Error('--etiqueta es obligatoria y solo admite letras, dígitos . _ -');
  const origen = path.join(raiz, 'dist', 'mcpb'); if (!fs.existsSync(path.join(origen, 'manifest.json'))) throw new Error('Falta dist/mcpb: ejecute `npm run build` primero.');
  const base = JSON.parse(fs.readFileSync(path.join(origen, 'manifest.json'), 'utf8'));
  const m = { ...base, name: id, version: `0.1.0-${fase}.${etiqueta}${revision ? `.${revision}` : ''}`, display_name: nombre ?? `Tannia Workspace - PRUEBA ${etiqueta}`, description: descripcion ?? `PAQUETE DE PRUEBA (código del commit ${etiqueta}). No sustituye a rc.3. No verificado en AutoCAD ni Claude Desktop reales.` };
  const v = validarManifest(m); if (v.errores.length) throw new Error(`Manifiesto no válido, no se empaqueta:\n - ${v.errores.join('\n - ')}`);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'paquete-prueba ')); fs.cpSync(origen, stage, { recursive: true }); fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(m, null, 2));
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
  crearPaquetePrueba({ etiqueta: arg('etiqueta'), revision: arg('revision'), id: arg('id'), nombre: arg('nombre'), salida: arg('salida'), esperadas: arg('esperadas') ? Number(arg('esperadas')) : undefined, fase: arg('fase') })
    .then((r) => { console.log(JSON.stringify({ archivo: r.archivo, sha256: r.sha256, ...r.manifiesto, ok: r.verificacion.ok, herramientas: r.verificacion.datos.herramientas, problemas: r.verificacion.problemas }, null, 2)); process.exit(r.verificacion.ok ? 0 : 1); })
    .catch((e) => { console.error(String(e.message)); process.exit(2); });
}
