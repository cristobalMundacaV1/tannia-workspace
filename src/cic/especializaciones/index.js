// Especializaciones declarativas (docs/tw11/05). Cada una SOLO declara; no duplica el núcleo ni puede bajar restricciones.
import fs from 'node:fs';
import path from 'node:path';
import { registrarEspecializacion, rechazarEspecializacion, especializacionesRechazadas } from '../especializaciones.js';
import { obtenerOperacion } from '../ops/index.js';
import tuneles from './tuneles.js';
import vial from './vial.js';
import cubicaciones from './cubicaciones.js';
import planificacion from './planificacion.js';
import { vivienda, unidades } from './edificacion.js';

let cargadas = false;
/** Valida referencias: toda operación citada debe existir; una especialización con operaciones inexistentes se rechaza (no se activa a medias). */
export function cargarEspecializacion(obj) {
  for (const m of obj?.methods || []) for (const op of m.operations || []) if (!obtenerOperacion(op)) return rechazarEspecializacion(obj.id ?? '(sin id)', `referencia inválida: la operación "${op}" no existe en el catálogo`);
  return registrarEspecializacion(obj);
}
export function cargarIntegradas() { if (cargadas) return; cargadas = true; for (const e of [tuneles, vial, cubicaciones, planificacion, vivienda, unidades]) cargarEspecializacion(e); }
/** Carga desde disco (carpeta del usuario): un JSON inválido se DESACTIVA con motivo; el servidor sigue. */
export function cargarDesdeDirectorio(dir) {
  const informe = []; if (!dir || !fs.existsSync(dir)) return informe;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try { const obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); const r = cargarEspecializacion(obj); informe.push({ archivo: f, ok: r.ok, errores: r.errores || [] }); }
    catch (e) { informe.push({ archivo: f, ok: false, errores: [`JSON ilegible: ${e.message}`] }); }
  }
  return informe;
}
export { especializacionesRechazadas };
