// Escenario para la prueba de NO INTERFERENCIA en Windows (tools/gui/prueba_no_interferencia.py): crea un proyecto y ejecuta un
// expediente completo con el coordinador REAL (proceso de fondo oculto, prioridad baja). Escribe el resultado en <salida>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Sandbox } from '../../src/security/sandbox.js';
import { createProject } from '../../src/project/projects.js';
import { Coordinador } from '../../src/trabajos/coordinador.js';

const salida = path.resolve(process.argv[2]);
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'Tannia fondo ñ '));
const sb = new Sandbox(home); sb.ensureHome(); createProject(sb, 'Obra en segundo plano');
fs.mkdirSync(path.join(home, '.tannia-trabajos'), { recursive: true }); fs.writeFileSync(path.join(home, '.tannia-trabajos', 'config.json'), JSON.stringify({ memoria_libre_minima_mb: 0 }));
const C = new Coordinador({ home });
const t = C.crear({ proyecto: 'Obra en segundo plano', pasos: ['planos', 'a_partidas', 'presupuesto', 'memoria', 'dwg'].map((tipo) => ({ tipo, args: tipo === 'planos' ? { datos: { length: 150, width: 5.5, wall: 3, selected: 0.06, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 } } } : {} })) });
const t0 = Date.now(); C.programar();
fs.writeFileSync(`${salida}.iniciado`, String(Date.now()));
for (;;) {
  await new Promise((r) => setTimeout(r, 300));
  const x = C.leer(t.id);
  if (['TERMINADO', 'REQUIERE_INTERVENCIÓN', 'FALLÓ', 'CANCELADO'].includes(x.estado) || Date.now() - t0 > 240000) {
    fs.writeFileSync(salida, JSON.stringify({ estado: x.estado, mensaje: x.mensaje, pasos: x.pasos.map((p) => ({ tipo: p.tipo, estado: p.estado })), recursos: x.recursos, duracion_ms: Date.now() - t0, prioridad_esperada: os.constants.priority.PRIORITY_BELOW_NORMAL }, null, 2));
    break;
  }
}
