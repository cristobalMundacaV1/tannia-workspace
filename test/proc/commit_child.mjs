// Proceso hijo para pruebas de concurrencia y cortes REALES: confirma una versión con una pausa/corte en el paso indicado.
// Uso: node commit_child.mjs '<json>'  json = { dir, id, contenido, paso?, modo?: 'pausa'|'kill', listo?, sigue?, esperaMs? }
import fs from 'node:fs';
import path from 'node:path';
import { commitVersion } from '../../src/project/transaccion.js';

const a = JSON.parse(process.argv[2]); const histF = path.join(a.dir, 'historial.json');
const leerH = () => (fs.existsSync(histF) ? JSON.parse(fs.readFileSync(histF, 'utf8')) : { versiones: [] });
const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const hook = (p) => {
  if (p !== a.paso) return;
  if (a.modo === 'kill') process.kill(process.pid, 'SIGKILL');
  if (a.modo === 'pausa') { fs.writeFileSync(a.listo, p); const fin = Date.now() + 30000; while (!fs.existsSync(a.sigue) && Date.now() < fin) dormir(25); }
};
try {
  commitVersion({ dir: a.dir, id: a.id, archivos: [{ nombre: `${a.id}.json`, contenido: a.contenido ?? `contenido de ${a.id}` }], hook, ...(a.esperaMs != null ? { esperaMs: a.esperaMs } : {}),
    idsEnHistorial: () => leerH().versiones.map((v) => v.id),
    actualizarHistorial: () => { const h = leerH(); h.versiones.push({ id: a.id, por: process.pid }); fs.writeFileSync(histF, JSON.stringify(h)); } });
  process.stdout.write(JSON.stringify({ ok: true }) + '\n');
} catch (e) { process.stdout.write(JSON.stringify({ ok: false, code: e.code ?? null, mensaje: String(e.message).slice(0, 120) }) + '\n'); process.exitCode = 3; }
