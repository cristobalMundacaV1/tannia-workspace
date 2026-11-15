// Empaqueta dist/mcpb en dist/tannia-workspace-<version>.mcpb con el CLI oficial y escribe SHA-256.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'dist', 'mcpb');
const mf = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const cli = path.join(root, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
const mcpb = (args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });
mcpb(['validate', path.join(dir, 'manifest.json')]);
const outFile = path.join(root, 'dist', `tannia-workspace-${mf.version}.mcpb`);
mcpb(['pack', dir, outFile]);
const sha = crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
fs.writeFileSync(`${outFile}.sha256`, `${sha}  ${path.basename(outFile)}\n`);
console.log(`${path.basename(outFile)} sha256=${sha}`);
