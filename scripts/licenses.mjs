// Inventario de licencias de dependencias de PRODUCCIÓN (las que entran en el bundle). Falla si hay copyleft fuerte.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ls', '--omit=dev', '--all', '--parseable', '--long'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 50 * 1024 * 1024 });
const dirs = [...new Set(out.split(/\r?\n/).map((l) => l.split(':')[0]).filter((d) => d && d !== root && fs.existsSync(path.join(d, 'package.json'))))];
const OVERRIDES = { 'png-js': 'MIT (declarada en el archivo LICENSE del paquete; package.json no la indica)' };
const rows = []; const bad = []; const pend = [];
for (const d of dirs) {
  const pj = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'));
  let lic = typeof pj.license === 'string' ? pj.license : pj.license?.type || (pj.licenses ? pj.licenses.map((l) => l.type).join(' OR ') : 'DESCONOCIDA');
  if (OVERRIDES[pj.name]) lic = OVERRIDES[pj.name];
  rows.push([pj.name, pj.version, lic]);
  const dualMit = /\bMIT\b.*\bOR\b|\bOR\b.*\bMIT\b/.test(lic); // licencia dual con opción MIT: se elige MIT
  if (/\b(A?GPL|SSPL|BUSL|CC-BY-NC)/i.test(lic) && !/LGPL/i.test(lic) && !dualMit) bad.push(`${pj.name}@${pj.version}: ${lic}`);
  if (lic === 'DESCONOCIDA') pend.push(`${pj.name}@${pj.version}: no declara licencia (ni en package.json ni en LICENSE); NO VERIFICADA`);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));
const byLic = {}; for (const r of rows) byLic[r[2]] = (byLic[r[2]] || 0) + 1;
const md = ['# Licencias de dependencias de producción', '', '> Generado por `scripts/licenses.mjs` (`npm ls --omit=dev --all`). Revisión automática de la **declaración** de licencia en `package.json`; no sustituye una revisión legal.', '', `Total: ${rows.length} paquetes.`, '', '## Resumen', '', ...Object.entries(byLic).sort((a, b) => b[1] - a[1]).map(([l, n]) => `- ${l}: ${n}`), '', (bad.length ? `## ⚠ Copyleft: requiere revisión\n\n${bad.map((b) => `- ${b}`).join('\n')}\n` : '## Sin copyleft fuerte detectado (las licencias duales con opción MIT se acogen a MIT)') + (pend.length ? `\n## Pendiente de revisión legal (transitivas sin licencia declarada)\n\n${pend.map((b) => `- ${b}`).join('\n')}\n` : ''), '', '## Detalle', '', '| Paquete | Versión | Licencia |', '|---|---|---|', ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`), ''].join('\n');
fs.writeFileSync(path.join(root, 'docs', 'LICENSES.md'), md);
console.log(`licencias: ${rows.length} paquetes; copyleft: ${bad.length}; sin licencia declarada: ${pend.length}`);
if (bad.length) { console.error(bad.join('\n')); process.exit(2); }
