// Empaqueta dist/mcpb en dist/tannia-workspace-<version>.mcpb con el CLI oficial y escribe SHA-256.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'dist', 'mcpb');
const mf = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const mcpb = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'mcpb.cmd' : 'mcpb');
execFileSync(mcpb, ['validate', path.join(dir, 'manifest.json')], { stdio: 'inherit', shell: process.platform === 'win32' });
const outFile = path.join(root, 'dist', `tannia-workspace-${mf.version}.mcpb`);
execFileSync(mcpb, ['pack', dir, outFile], { stdio: 'inherit', shell: process.platform === 'win32' });
const sha = crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
fs.writeFileSync(`${outFile}.sha256`, `${sha}  ${path.basename(outFile)}\n`);
console.log(`${path.basename(outFile)} sha256=${sha}`);
