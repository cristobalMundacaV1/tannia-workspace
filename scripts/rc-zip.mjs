// Construye el ZIP de instalación versionado de Tannia Workspace (candidato de lanzamiento) para Windows x64.
//   node scripts/rc-zip.mjs            → dist/rc/Tannia-Workspace-<ver>-windows-x64.zip (+ .sha256)
// Contenido: extensión .mcpb (formato oficial de Claude Desktop), lanzador INSTALAR.cmd (comprueba requisitos e integridad y
// abre la extensión en Claude Desktop), DIAGNOSTICO.cmd, guía breve, recuperación/desinstalación, versión y compatibilidad,
// licencias y avisos de terceros, manifiesto de archivos y sumas SHA-256. El ZIP es determinista (orden y fechas fijas).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { validarManifest, validarRutasPaquete } from './lib/nombres.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.TANNIA_TARGET || 'win32-x64';
const distDir = path.join(root, 'dist', 'rc');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const shaF = (f) => sha(fs.readFileSync(f));
const CLI = path.join(root, 'node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
const FIJA = new Date('2026-01-01T00:00:00Z');
const crlf = (t) => t.replace(/\r?\n/g, '\r\n');

fs.rmSync(distDir, { recursive: true, force: true }); fs.mkdirSync(distDir, { recursive: true });
// 1) bundle del servidor para la plataforma DESTINO (binario nativo verificado contra package-lock)
execFileSync(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { cwd: root, stdio: 'inherit', env: { ...process.env, TANNIA_TARGET: target, TANNIA_DIST_DIR: distDir } });
const { VERSION } = await import(new URL('../src/version.js', import.meta.url));
let commit = 'desconocido'; let limpio = false;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); limpio = execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts', 'package.json', 'package-lock.json'], { cwd: root, encoding: 'utf8' }).trim() === ''; } catch { /* sin git */ }

// 2) manifiesto de la extensión
const origen = path.join(distDir, 'mcpb');
const base = JSON.parse(fs.readFileSync(path.join(origen, 'manifest.json'), 'utf8'));
const destino = JSON.parse(fs.readFileSync(path.join(distDir, 'destino.json'), 'utf8'));
const m = {
  ...base, name: 'tannia-workspace', display_name: 'Tannia Workspace', version: VERSION,
  description: 'Asistente local para planos DXF/PDF, AutoCAD (Windows), cubicaciones, presupuestos/APU y entregas aprobadas por una persona. CANDIDATO NO VALIDADO.',
  long_description: 'Servidor MCP local. Trabaja solo dentro de la carpeta de Tannia Workspace, protege los originales, exige confirmación de una persona para verificar cantidades y aprobar entregas, y entrega exactamente los archivos aprobados. Candidato de lanzamiento: el uso con AutoCAD real y en Claude Desktop no ha sido validado por la usuaria ni por un profesional.',
  compatibility: { platforms: destino.platforms, runtimes: { node: '>=20.0.0' } },
};
const v = validarManifest(m); if (v.errores.length) throw new Error(`Manifiesto no válido:\n - ${v.errores.join('\n - ')}`);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-rc-mcpb-')); fs.cpSync(origen, stage, { recursive: true }); fs.writeFileSync(path.join(stage, 'manifest.json'), `${JSON.stringify(m, null, 2)}\n`);
const fijar = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) fijar(f); fs.utimesSync(f, FIJA, FIJA); } fs.utimesSync(d, FIJA, FIJA); }; fijar(stage);
const rutas = []; const walk = (d, rel = '') => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else rutas.push(r); } }; walk(stage);
const er = validarRutasPaquete(rutas); if (er.length) throw new Error(`Rutas no válidas: ${er.join('; ')}`);
execFileSync(process.execPath, [CLI, 'validate', path.join(stage, 'manifest.json')], { stdio: 'pipe' });
const nombreMcpb = `tannia-workspace-${VERSION}.mcpb`;
const mcpbTmp = path.join(distDir, nombreMcpb);
execFileSync(process.execPath, [CLI, 'pack', stage, mcpbTmp], { stdio: 'pipe' });
// Contenido REAL de la extensión empaquetada (el empaquetador oficial puede omitir archivos, p. ej. tipos .d.ts)
const { unzipSync } = await import('fflate');
const contenidoExtension = Object.fromEntries(Object.entries(unzipSync(new Uint8Array(fs.readFileSync(mcpbTmp)))).filter(([n]) => !n.endsWith('/')).map(([n, d]) => [n, sha(d)]).sort(([a], [b]) => a.localeCompare(b)));
const omitidos = rutas.filter((r) => !(r in contenidoExtension));
fs.rmSync(stage, { recursive: true, force: true });
const shaMcpb = shaF(mcpbTmp);

// 3) licencias y avisos de terceros: texto de licencia de cada dependencia de producción incluida en el bundle
const ls = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ls', '--omit=dev', '--all', '--parseable'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
const deps = [...new Set(ls.split(/\r?\n/).filter((d) => d && path.resolve(d) !== root && fs.existsSync(path.join(d, 'package.json'))))];
// Módulos nativos copiados al bundle para la plataforma DESTINO (pueden no estar instalados en la máquina que construye).
const nativos = path.join(origen, 'server', 'node_modules', '@napi-rs');
for (const n of fs.existsSync(nativos) ? fs.readdirSync(nativos) : []) { const d = path.join(nativos, n); if (fs.existsSync(path.join(d, 'package.json')) && !deps.some((x) => path.basename(x) === n)) deps.push(d); }
const licencias = {}; const filas = []; const sinTexto = []; const vistos = new Set();
for (const d of deps) {
  const pj = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'));
  if (vistos.has(`${pj.name}@${pj.version}`)) continue; vistos.add(`${pj.name}@${pj.version}`);
  if (/^@napi-rs\/canvas-/.test(pj.name) && !fs.existsSync(path.join(nativos, pj.name.split('/')[1]))) continue; // binario de otra plataforma: no viaja en el paquete
  const lic = typeof pj.license === 'string' ? pj.license : pj.license?.type || 'NO DECLARADA';
  const f = fs.readdirSync(d).find((n) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(n));
  filas.push(`| ${pj.name} | ${pj.version} | ${lic} | ${f ? `LICENCIAS/${pj.name.replace('/', '__')}@${pj.version}.txt` : 'sin archivo de licencia en el paquete'} |`);
  if (f) licencias[`LICENCIAS/${pj.name.replace('/', '__')}@${pj.version}.txt`] = fs.readFileSync(path.join(d, f)); else sinTexto.push(`${pj.name}@${pj.version} (${lic})`);
}
licencias['LICENCIAS/fuente-dibujo-planos.txt'] = fs.readFileSync(path.join(root, 'src', 'drawing', 'FONT_LICENSE.txt'));
const avisos = ['# Licencias y avisos de terceros', '', `Tannia Workspace ${VERSION}. El producto propio se distribuye como **UNLICENSED** (uso interno autorizado por el Product Owner; decisión de licencia de producto pendiente, D09).`, 'Este paquete incluye, empaquetado en `server/index.js` y `server/node_modules`, código de las siguientes dependencias de producción. Sus textos de licencia están en `LICENCIAS/`.', '', 'No incluye: AutoCAD, Claude Desktop, Microsoft Office, normas INN ni otros productos propietarios; cada uno se usa bajo su propia licencia, adquirida por la usuaria.', '', '| Paquete | Versión | Licencia declarada | Texto |', '|---|---|---|---|', ...filas.sort(), '', sinTexto.length ? `Paquetes sin archivo de licencia propio (revisión legal pendiente): ${sinTexto.join(', ')}.` : 'Todos los paquetes incluyen su archivo de licencia.', '', 'La fuente tipográfica de los planos tiene su licencia en `LICENCIAS/fuente-dibujo-planos.txt`.', ''].join('\n');

// 4) documentos para la usuaria (español) y lanzadores
const leer = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const plantilla = (t) => t.replaceAll('{{VERSION}}', VERSION).replaceAll('{{MCPB}}', nombreMcpb).replaceAll('{{SHA_MCPB}}', shaMcpb).replaceAll('{{COMMIT}}', commit);
const compat = { producto: 'Tannia Workspace', version: VERSION, estado: 'CANDIDATO NO VALIDADO (no probado por la usuaria, ni en AutoCAD real, ni en Claude Desktop real)', commit, arbol_limpio: limpio, plataforma: { sistema: 'Windows 10/11 de 64 bits (x64)', destino_binario_nativo: destino.native, version_nativo: destino.native_version }, requisitos: { claude_desktop: 'instalado y con sesión iniciada (descarga: https://claude.ai/download)', node: 'no hace falta instalarlo: Claude Desktop usa su propio Node.js para extensiones (manifiesto: node >= 20)', permisos: 'usuario estándar; no requiere administrador', internet: 'Claude Desktop requiere conexión con el servicio de Claude; el instalador no descarga nada', autocad: 'opcional: AutoCAD completo para Windows (no LT) para funciones de dibujo; sin AutoCAD funcionan DXF, PDF, cubicaciones, presupuestos y entregas' }, autocad_probado: 'NINGUNA versión probada con este candidato', claude_desktop_probado: 'NO probado con este candidato', herramientas: m.tools.length, procedimientos: 5 };
const docs = {
  'LEEME_PRIMERO.txt': crlf(plantilla(leer('packaging/zip/LEEME_PRIMERO.txt'))),
  'INSTALAR.cmd': crlf(plantilla(leer('packaging/zip/INSTALAR.cmd'))),
  'DIAGNOSTICO.cmd': crlf(plantilla(leer('packaging/zip/DIAGNOSTICO.cmd'))),
  'documentos/GUIA_RAPIDA.md': plantilla(leer('packaging/zip/GUIA_RAPIDA.md')),
  'documentos/RECUPERACION_Y_DESINSTALACION.md': plantilla(leer('packaging/zip/RECUPERACION_Y_DESINSTALACION.md')),
  'documentos/LIMITACIONES_Y_ESTADO.md': plantilla(leer('packaging/zip/LIMITACIONES_Y_ESTADO.md')),
  'VERSION_Y_COMPATIBILIDAD.json': `${JSON.stringify(compat, null, 2)}\n`,
  'AVISOS_DE_TERCEROS.md': avisos,
};

// 5) ensamblado: archivos, SHA256SUMS y manifiesto de la entrega
const archivos = { [nombreMcpb]: fs.readFileSync(mcpbTmp), ...Object.fromEntries(Object.entries(docs).map(([k, t]) => [k, Buffer.from(t, 'utf8')])), ...licencias };
const sums = Object.keys(archivos).sort().map((k) => `${sha(archivos[k])}  ${k}`).join('\n') + '\n';
archivos['SHA256SUMS.txt'] = Buffer.from(sums);
const manifiesto = { schema: 'tw.release_manifest/1', producto: 'Tannia Workspace', version: VERSION, estado: compat.estado, commit, arbol_limpio: limpio, construido_en: `${os.platform()}-${os.arch()} node ${process.version}`, destino: target, extension: { archivo: nombreMcpb, sha256: shaMcpb, archivos_omitidos_por_el_empaquetador: omitidos, contenido_sha256: contenidoExtension, nota: 'El contenido interno es reproducible; el .mcpb lleva fechas fijas.' }, archivos: Object.keys(archivos).sort().length, entrada_de_instalacion: 'INSTALAR.cmd' };
archivos['release-manifest.json'] = Buffer.from(`${JSON.stringify(manifiesto, null, 2)}\n`);
const carpeta = `Tannia-Workspace-${VERSION}-windows-x64`;
const entradas = {}; for (const k of Object.keys(archivos).sort()) entradas[`${carpeta}/${k}`] = [new Uint8Array(archivos[k]), { mtime: FIJA, level: k.endsWith('.mcpb') ? 0 : 9 }];
const zip = Buffer.from(zipSync(entradas));
const zipPath = path.join(distDir, `${carpeta}.zip`);
fs.writeFileSync(zipPath, zip); const shaZip = sha(zip);
fs.writeFileSync(`${zipPath}.sha256`, `${shaZip}  ${path.basename(zipPath)}\n`);
fs.writeFileSync(path.join(distDir, 'rc-zip.json'), `${JSON.stringify({ zip: path.basename(zipPath), sha256: shaZip, bytes: zip.length, mcpb_sha256: shaMcpb, commit, arbol_limpio: limpio, version: VERSION, herramientas: m.tools.length }, null, 2)}\n`);
console.log(`ZIP: ${zipPath}\nsha256=${shaZip}\nmcpb sha256=${shaMcpb}\ncommit=${commit}${limpio ? '' : ' (ÁRBOL CON CAMBIOS SIN COMMIT)'}`);
