// Ensambla el dossier de release candidato: dist/release/tannia-workspace-<ver>-RC/ (+ .zip si existe `zip`) con hashes.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const run = (script) => execFileSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
run('build.mjs'); run('pack.mjs');
const ver = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'mcpb', 'manifest.json'), 'utf8')).version;
const name = `tannia-workspace-${ver}-RC`;
const out = path.join(root, 'dist', 'release', name);
fs.rmSync(path.join(root, 'dist', 'release'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const cp = (src, dest) => { fs.mkdirSync(path.dirname(path.join(out, dest)), { recursive: true }); fs.cpSync(path.join(root, src), path.join(out, dest), { recursive: true }); };
cp(`dist/tannia-workspace-${ver}.mcpb`, `tannia-workspace-${ver}.mcpb`); cp(`dist/tannia-workspace-${ver}.mcpb.sha256`, `tannia-workspace-${ver}.mcpb.sha256`);
const docs = ['user/INSTALACION.md', 'user/MANUAL_TANNIA.md', 'TANNIA_HANDOFF.md', 'KNOWN_LIMITATIONS.md', 'AUTOCAD_COMPATIBILITY.md', 'RISKS.md', 'LICENSES.md', 'qa/EVIDENCE_MATRIX.md', 'qa/CAD_CAPABILITY_MATRIX.md', 'qa/TEST_REPORT.md', 'qa/MANUAL_TESTS_TANNIA_PC.md', 'pilot/PILOTO_2D_TW07A.md', 'pilot/PILOTO_3D_TW07B.md', 'implementation/TW05_PACKAGING_DECISION.md', 'evaluations/THIRD_PARTY_EVALUATION.md'];
for (const d of docs) cp(`docs/${d}`, `documentos/${path.basename(d)}`);
cp('CHANGELOG.md', 'CHANGELOG.md'); cp('examples', 'ejemplos');
let commit = 'desconocido'; try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* */ }
fs.writeFileSync(path.join(out, 'LEEME_PRIMERO.txt'), `Tannia Workspace ${ver} — CANDIDATO DE LANZAMIENTO TÉCNICO\n\nNO validado por Tannia. NO probado con AutoCAD real. Ver documentos/TANNIA_HANDOFF.md.\n1) Verifique el hash (SHA256SUMS.txt)  2) documentos/INSTALACION.md  3) documentos/MANUAL_TANNIA.md\nCommit de origen: ${commit}\n`);
const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : files.push(f); } }; walk(out);
const lines = files.filter((f) => !f.endsWith('SHA256SUMS.txt')).map((f) => `${sh(f)}  ${path.relative(out, f).split(path.sep).join('/')}`).sort((a, b) => a.split('  ')[1].localeCompare(b.split('  ')[1]));
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
const contenido = { 'server/index.js': sh(path.join(root, 'dist', 'mcpb', 'server', 'index.js')), 'manifest.json': sh(path.join(root, 'dist', 'mcpb', 'manifest.json')) };
fs.writeFileSync(path.join(out, 'release-manifest.json'), JSON.stringify({ version: ver, contenido_sha256: contenido, nota_reproducibilidad: 'El contenido del .mcpb es idéntico entre compilaciones; el hash del archivo .mcpb varía porque el zip incluye marcas de tiempo. Compare contenido_sha256 de los archivos internos.', estado: 'RC técnico (no validado por Tannia; no probado en AutoCAD real)', commit, archivos: lines.length }, null, 2));
let zip = null;
try { zip = path.join(root, 'dist', 'release', `${name}.zip`); execFileSync('zip', ['-qr', zip, name], { cwd: path.join(root, 'dist', 'release') }); fs.writeFileSync(`${zip}.sha256`, `${sh(zip)}  ${name}.zip\n`); } catch { zip = null; }
console.log(`release OK: ${out}${zip ? `\nzip: ${zip} sha256=${sh(zip)}` : ' (sin zip)'}\nmcpb sha256=${sh(path.join(out, `tannia-workspace-${ver}.mcpb`))}`);
