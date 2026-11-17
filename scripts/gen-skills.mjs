// Genera .claude/skills/<nombre>/SKILL.md desde src/procedimientos (fuente única Desktop/Code) + Skills de desarrollo.
// Uso: node scripts/gen-skills.mjs [--check]  (--check falla si los archivos difieren de lo generado).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PROCEDIMIENTOS, textoProcedimiento } = await import(pathToFileURL(path.join(root, 'src', 'procedimientos', 'index.js')).href);

const DESARROLLO = [
  { nombre: 'tw-qa-independiente', descripcion: 'Guía del revisor independiente: verificar un SHA, ejecutar suites y gates, y reportar sin aprobar el propio cambio.', cuerpo: ['Registre SHA, árbol, lockfile, Node/OS y perfil de flags (BASE/CIC/ENGINEERING).', 'Ejecute `npm ci`, `npm test` y `npm run rc:zip`; adjunte TAP y hashes.', 'Ejecute las pruebas adversariales de autoridad (test/rc_autoridad_entrega.test.js) y fidelidad (test/rc_fidelidad_contrato.test.js).', 'Gates N2/N3 (AutoCAD, Claude Desktop, revisión profesional) solo se marcan con evidencia real: operador, build, fecha y archivos.', 'Prohibido: filtrar corpus retenido al implementador, marcar N2 por un mock, subir planos privados al repositorio, aprobar el propio cambio.'] },
  { nombre: 'tw-paquete-y-migracion', descripcion: 'Construir el ZIP de instalación, verificarlo extraído y probar migración/reversión de proyectos.', cuerpo: ['Construya desde checkout limpio: `npm ci && npm run rc:zip`.', 'Verifique `SHA256SUMS.txt` y `release-manifest.json` del ZIP extraído en otra ruta (con espacios y ñ).', 'Ejecute `node scripts/rc-verificar-zip.mjs <zip>`: instala en un perfil temporal, conecta por MCP al servidor extraído y corre un flujo de extremo a extremo.', 'Migración: un proyecto antiguo se respalda antes de actualizarse; `tannia_proyecto_migracion revertir` restaura bytes exactos.', 'Prohibido: auto-merge, release pública, borrar proyectos al desinstalar, convertir esquemas sin respaldo.'] },
];
const fm = (n, d) => `---\nname: ${n}\ndescription: ${d}\n---\n\n`;
const archivos = {};
for (const p of PROCEDIMIENTOS) archivos[p.nombre] = `${fm(p.nombre, `${p.descripcion} (Procedimiento de dominio de Tannia Workspace; equivalente al prompt MCP «${p.titulo}» en Claude Desktop.)`)}# ${p.titulo}\n\n> Generado desde src/procedimientos/index.js por scripts/gen-skills.mjs. No editar a mano.\n\n${textoProcedimiento(p).split('\n').slice(1).join('\n')}\n`;
for (const d of DESARROLLO) archivos[d.nombre] = `${fm(d.nombre, d.descripcion)}# ${d.nombre}\n\n> Skill de DESARROLLO (no se distribuye a la usuaria). Generado por scripts/gen-skills.mjs.\n\n${d.cuerpo.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
const check = process.argv.includes('--check'); const difs = [];
for (const [n, txt] of Object.entries(archivos)) {
  const f = path.join(root, '.claude', 'skills', n, 'SKILL.md');
  if (check) { if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== txt) difs.push(n); continue; }
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt);
}
if (check && difs.length) { console.error(`Skills desactualizadas: ${difs.join(', ')} (ejecute node scripts/gen-skills.mjs)`); process.exit(1); }
console.log(check ? 'skills al día' : `${Object.keys(archivos).length} skills generadas`);
