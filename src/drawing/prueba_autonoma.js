// Prueba AUTÓNOMA de planos (sin Claude ni conversación): genera los dos corpus de aceptación —túnel UAT con fortificación y
// muro con vano— en una carpeta NUEVA y vacía, con los mismos gates que el servidor (inspección DXF 5d, paridad 5e), y escribe
// un informe con huellas SHA-256. No toca proyectos existentes ni abre AutoCAD.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Sandbox } from '../security/sandbox.js';
import { createProject } from '../project/projects.js';
import { DrawingService } from './service.js';
import { muroConVanoEspecificacion } from './especificacion.js';
import { VERSION } from '../version.js';

export const CORPUS = {
  'Prueba planos tunel UAT': { model: { length: 150, width: 5.5, wall: 2.5, selected: 0.08, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 } } },
  'Prueba planos edificacion': { especificacion: muroConVanoEspecificacion() },
};

export async function pruebaAutonomaPlanos(destino) {
  if (!destino || !path.isAbsolute(destino)) throw new Error('Indique una carpeta de destino absoluta.');
  if (fs.existsSync(destino) && fs.readdirSync(destino).length) throw new Error(`La carpeta ${destino} no está vacía: use una carpeta nueva (no se sobrescribe nada).`);
  fs.mkdirSync(destino, { recursive: true }); const sb = new Sandbox(destino); const svc = new DrawingService(sb); const informe = { version: VERSION, fecha: new Date().toISOString(), proyectos: [] };
  for (const [nombre, entrada] of Object.entries(CORPUS)) {
    createProject(sb, nombre); const g = await svc.generate(nombre, entrada); const dir = path.join(sb.projectRoot(nombre), g.folder);
    const v = JSON.parse(fs.readFileSync(path.join(dir, g.files.find((f) => f.endsWith('verificacion.json'))), 'utf8'));
    informe.proyectos.push({ nombre, revision: g.revision, carpeta: path.relative(destino, dir), laminas: g.files.filter((f) => /lamina-.*\.pdf$/.test(f)).length,
      gates: { dxf_apertura_5d: v.dxf_inspeccion.ok, paridad_dxf_5e: v.paridad.dxf.ok, paridad_pdf_5e: v.paridad.pdf.ok, dxf_vs_modelo: v.dxf_vs_modelo.ok, legibilidad: v.composition.every((x) => x.ok) },
      archivos: Object.fromEntries(g.files.map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex')])),
      pendiente: 'Abrir el DXF y los PDF en AutoCAD 2027 real siguiendo UAT-PLANOS-AUTOCAD-2027.md (NO VERIFICADO por esta prueba).' });
  }
  informe.ok = informe.proyectos.every((p) => Object.values(p.gates).every(Boolean));
  fs.writeFileSync(path.join(destino, 'INFORME-PRUEBA-PLANOS.json'), JSON.stringify(informe, null, 2));
  return informe;
}
