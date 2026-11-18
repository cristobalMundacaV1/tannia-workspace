// Prueba REAL en Windows de los lanzadores del ZIP (cmd.exe): integridad correcta, paquete alterado y diagnóstico.
//   node scripts/rc-probar-instalador.mjs <zip> [--salida informe.json]
// En otros sistemas informa «omitido» (los .cmd solo existen en Windows). No abre Claude Desktop (TANNIA_INSTALADOR_SIN_ABRIR=1).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';

const zip = path.resolve(process.argv[2] || ''); const iS = process.argv.indexOf('--salida');
const salida = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(path.dirname(zip), 'prueba-instalador.json');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const inf = { zip: path.basename(zip), zip_sha256: sha(fs.readFileSync(zip)), plataforma: `${os.platform()} ${os.release()}`, casos: [] };
if (process.platform !== 'win32') { inf.resultado = 'OMITIDO (requiere Windows)'; fs.writeFileSync(salida, JSON.stringify(inf, null, 2)); console.log(inf.resultado); process.exit(0); }
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'Instalador ñ '));
const extraer = (dest) => { for (const [n, d] of Object.entries(unzipSync(new Uint8Array(fs.readFileSync(zip))))) { if (n.endsWith('/')) continue; const f = path.join(dest, ...n.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, d); } return path.join(dest, fs.readdirSync(dest)[0]); };
const env = { ...process.env, TANNIA_INSTALADOR_SIN_ABRIR: '1', TANNIA_INSTALADOR_SIN_PAUSA: '1', LOCALAPPDATA: path.join(base, 'LocalAppData perfil') };
const correr = (dir, archivo) => { const r = spawnSync('cmd.exe', ['/d', '/c', archivo], { cwd: dir, env, encoding: 'latin1', windowsHide: true, timeout: 120000 }); return { codigo: r.status, salida: `${r.stdout}${r.stderr}` }; };
let fallos = 0; const caso = (nombre, ok, d) => { inf.casos.push({ caso: nombre, ok, ...d }); if (!ok) fallos++; console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}`); };
try {
  const a = extraer(path.join(base, 'Extraído A'));
  const r1 = correr(a, 'INSTALAR.cmd');
  // Sin Claude Desktop en la máquina de CI se espera código 3 tras verificar integridad; con Claude Desktop, 0.
  caso('INSTALAR.cmd: integridad verificada y requisitos comprobados', [0, 3].includes(r1.codigo) && /Integridad verificada/.test(r1.salida), { codigo: r1.codigo, salida: r1.salida.slice(-900) });
  const log = path.join(env.LOCALAPPDATA, 'Tannia Workspace', 'instalador.log');
  caso('INSTALAR.cmd: registro en LOCALAPPDATA del usuario (sin administrador)', fs.existsSync(log), { registro: fs.existsSync(log) ? fs.readFileSync(log, 'latin1').slice(-600) : null });
  const b = extraer(path.join(base, 'Extraído B alterado'));
  const mcpb = fs.readdirSync(b).find((n) => n.endsWith('.mcpb')); fs.appendFileSync(path.join(b, mcpb), 'x');
  const r2 = correr(b, 'INSTALAR.cmd');
  caso('INSTALAR.cmd: paquete alterado ⇒ no instala (código 2)', r2.codigo === 2 && /danado o fue modificado/.test(r2.salida), { codigo: r2.codigo, salida: r2.salida.slice(-600) });
  fs.rmSync(path.join(b, mcpb));
  const r3 = correr(b, 'INSTALAR.cmd');
  caso('INSTALAR.cmd: paquete incompleto ⇒ no instala (código 2)', r3.codigo === 2 && /Falta el archivo/.test(r3.salida), { codigo: r3.codigo });
  const r4 = correr(a, 'DIAGNOSTICO.cmd'); const rep = path.join(os.tmpdir(), 'Diagnostico-Tannia-Workspace.txt');
  const txt = fs.existsSync(rep) ? fs.readFileSync(rep, 'latin1') : '';
  caso('DIAGNOSTICO.cmd: informe de solo lectura con huella del paquete', r4.codigo === 0 && /Integridad del paquete/.test(txt) && /Esperado:/.test(txt), { codigo: r4.codigo, extracto: txt.slice(0, 800) });
  // PROBAR_PLANOS.cmd (UAT PO rc.6: «no se detecta en Claude Desktop»): usa el .mcpb del ZIP, sin depender de la ruta de instalación.
  const destP = path.join(base, 'Prueba planos ñ'); const envP = { ...env, TANNIA_PRUEBA_DESTINO: destP, TANNIA_NODE: process.execPath, APPDATA: path.join(base, 'AppData sin Claude') };
  const r5 = spawnSync('cmd.exe', ['/d', '/c', 'PROBAR_PLANOS.cmd'], { cwd: a, env: envP, encoding: 'latin1', windowsHide: true, timeout: 600000 });
  const infP = path.join(destP, 'INFORME-PRUEBA-PLANOS.json'); const okP = r5.status === 0 && fs.existsSync(infP) && JSON.parse(fs.readFileSync(infP, 'utf8')).ok === true;
  caso('PROBAR_PLANOS.cmd: sin extensión instalada genera los 2 corpus desde el paquete del ZIP (gates verdes)', okP && /No se encontro una instalacion/.test(r5.stdout), { codigo: r5.status, salida: String(r5.stdout).slice(-900) });
  const c = extraer(path.join(base, 'Extraído C alterado')); fs.appendFileSync(path.join(c, fs.readdirSync(c).find((n) => n.endsWith('.mcpb'))), 'x');
  const r6 = spawnSync('cmd.exe', ['/d', '/c', 'PROBAR_PLANOS.cmd'], { cwd: c, env: { ...envP, TANNIA_PRUEBA_DESTINO: path.join(base, 'Prueba alterada') }, encoding: 'latin1', windowsHide: true, timeout: 120000 });
  caso('PROBAR_PLANOS.cmd: paquete alterado ⇒ no ejecuta nada (código 2)', r6.status === 2 && /danado o fue modificado/.test(r6.stdout) && !fs.existsSync(path.join(base, 'Prueba alterada')), { codigo: r6.status, salida: String(r6.stdout).slice(-500) });
} catch (e) { fallos++; inf.error = String(e.message).slice(0, 400); } finally {
  inf.resultado = fallos ? 'FALLA' : 'OK'; fs.writeFileSync(salida, JSON.stringify(inf, null, 2)); fs.rmSync(base, { recursive: true, force: true }); process.exit(fallos ? 1 : 0);
}
