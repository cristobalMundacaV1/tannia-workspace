// Empaqueta dist/mcpb en dist/tannia-workspace-<version>.mcpb con el CLI oficial y escribe SHA-256.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validarManifest, validarRutasPaquete } from './lib/nombres.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'dist', 'mcpb');
const mf = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const cli = path.join(root, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
const mcpb = (args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
// Nombres y rutas compatibles con Windows/Claude Desktop ANTES de empaquetar (incidente "path escape" por "/" en el nombre visible)
const val = validarManifest(mf); const rutas = []; const walk = (d, rel = '') => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else rutas.push(r); } }; walk(dir);
const errores = [...val.errores, ...validarRutasPaquete(rutas)]; if (errores.length) { console.error(`Paquete no válido, no se empaqueta:\n - ${errores.join('\n - ')}`); process.exit(2); }
mcpb(['validate', path.join(dir, 'manifest.json')]);
const outFile = path.join(root, 'dist', `tannia-workspace-${mf.version}.mcpb`);
mcpb(['pack', dir, outFile]);
const sha = crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
fs.writeFileSync(`${outFile}.sha256`, `${sha}  ${path.basename(outFile)}\n`);
console.log(`${path.basename(outFile)} sha256=${sha}`);
