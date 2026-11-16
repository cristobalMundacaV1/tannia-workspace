// Proceso hijo: ejecuta una modificación REAL del servicio 2D o 3D con pausa/corte en un paso de la transacción.
import fs from 'node:fs';
import { Sandbox } from '../../src/security/sandbox.js';
import { Anteproyectos } from '../../src/design/servicio.js';
import { Modelos3d } from '../../src/arq3d/servicio.js';

const a = JSON.parse(process.argv[2]); const sb = new Sandbox(a.home); const A = new Anteproyectos(sb); const M = new Modelos3d(sb, A);
const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const svc = a.tipo === '3d' ? M : A; if (a.esperaMs != null) svc.esperaMs = a.esperaMs;
if (a.paso) svc.hook = (p) => { if (p !== a.paso) return; if (a.modo === 'kill') process.kill(process.pid, 'SIGKILL'); fs.writeFileSync(a.listo, p); const fin = Date.now() + 30000; while (!fs.existsSync(a.sigue) && Date.now() < fin) dormir(25); };
try {
  const r = a.tipo === '3d'
    ? M.modificar(a.proyecto, a.nombre, { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: a.altura } }] })
    : A.modificar(a.proyecto, a.nombre, { operaciones: [{ operacion: 'espesores', ext_mm: a.ext, int_mm: 120 }] });
  process.stdout.write(JSON.stringify({ ok: true, version: r.version }) + '\n');
} catch (e) { process.stdout.write(JSON.stringify({ ok: false, code: e.code ?? null, mensaje: String(e.message).slice(0, 160) }) + '\n'); process.exitCode = 3; }
