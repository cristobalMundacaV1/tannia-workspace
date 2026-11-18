#!/usr/bin/env node
// G-BG0 — Prueba técnica comparativa con el MISMO corpus: motor interno (A) vs AutoCAD Core Console (B) [vs COM (C), opcional].
// Corpus: láminas del túnel (5) y de edificación generadas por el motor; cada DXF se convierte a DWG y se relee; se compara con el modelo.
//
// Uso en el equipo con AutoCAD 2027 (ver docs/cad-bg/PROTOCOLO_AUTOCAD_2027.md):
//   node scripts/cadbg-comparativa.mjs <carpeta_salida>                 → modos A y B
//   node scripts/cadbg-comparativa.mjs <carpeta_salida> --incluir-com   → además C (abre un dibujo NUEVO en el AutoCAD abierto: solo con
//                                                                         autorización de la persona que hace la prueba)
// Sin AutoCAD (Linux/CI) solo corre con TANNIA_ACCORECONSOLE=<simulador> y el informe lo rotula como SIMULADOR (no es evidencia de AutoCAD).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tunnelModel, compose } from '../src/drawing/model.js';
import { modeloDesdeEspecificacion } from '../src/drawing/especificacion.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { detectarCoreConsole, convertirDxfADwgSinInterfaz } from '../src/trabajos/coreconsole.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'cadbg-comparativa ')));
const incluirCom = process.argv.includes('--incluir-com');
fs.mkdirSync(salida, { recursive: true });

const corpus = [
  { id: 'tunel-150m-fortificacion', modelo: tunnelModel({ length: 150, width: 5.5, wall: 3, selected: 0.06, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 } }) },
  { id: 'edificacion-muro-vanos', modelo: modeloDesdeEspecificacion({ codigo: 'ED-01', especialidad: 'edificación', proyecto: 'Comparativa CAD-BG', capas: { MUROS: { color: 7, grosor: 0.5, leyenda: 'Muros' }, VANOS: { color: 3, grosor: 0.25, leyenda: 'Vanos' } }, vistas: [{ id: 'elev', titulo: 'Elevación', tipo: 'elevacion', escala: 50, elementos: [{ id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: 6, alto: 2.4 }, { id: 'puerta', tipo: 'rectangulo', capa: 'VANOS', origen: [1, 0], ancho: 0.9, alto: 2.0 }, { id: 'ventana', tipo: 'rectangulo', capa: 'VANOS', origen: [3.5, 1.0], ancho: 1.2, alto: 1.0 }] }], laminas: [{ id: '01', titulo: 'Elevación', vistas: ['elev'] }], mediciones: [{ id: 'bruto', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/muro'] }], elementos_fisicos: [{ id: 'M1', tipo: 'muro', fuentes: ['elev/muro'] }] }) },
];

const cc = detectarCoreConsole();
const informe = { prueba: 'G-BG0 comparativa motor interno / Core Console / COM', equipo: { so: `${os.platform()} ${os.release()}`, cpus: os.cpus().length, memoria_gb: +(os.totalmem() / 2 ** 30).toFixed(1) }, inicio: new Date().toISOString(), core_console: cc, es_simulador: cc.origen === 'variable_de_soporte', casos: [] };
for (const c of corpus) {
  const comp = compose(c.modelo, { paper: 'A3', orientation: 'landscape', margin: 12 });
  const t0 = performance.now(); const dxfTxt = buildDrawingDxf(comp); const msA = performance.now() - t0;
  const dir = path.join(salida, c.id); fs.mkdirSync(dir, { recursive: true }); const dxf = path.join(dir, 'planos.dxf'); fs.writeFileSync(dxf, dxfTxt);
  const caso = { id: c.id, entidades: comp.sheets.length, modo_A: { ms: Math.round(msA), dxf_bytes: dxfTxt.length, requiere_autocad: false } };
  if (cc.disponible) {
    const t1 = performance.now(); const u0 = process.cpuUsage();
    const r = await convertirDxfADwgSinInterfaz({ motor: cc, dxf, destino: path.join(dir, 'B-planos.dwg'), composicion: comp, preparacion: path.join(dir, '.prep-B'), timeoutMs: 15 * 60000 });
    caso.modo_B = { ms: Math.round(performance.now() - t1), estado: r.estado, codigo: r.codigo || null, comparacion: r.comparacion ? { ok: r.comparacion.ok, problemas: (r.comparacion.problemas || []).slice(0, 20), resumen: r.comparacion.resumen } : null, auditoria: r.auditoria || null, ejecucion: (r.ejecucion || []).map((e) => ({ ok: e.ok, clase: e.clase, codigo: e.codigo, ms: e.ms })), cpu_nodo_ms: Math.round(process.cpuUsage(u0).user / 1000) };
    fs.rmSync(path.join(dir, '.prep-B'), { recursive: true, force: true });
  } else caso.modo_B = { estado: 'NO_EJECUTADO', motivo: cc.motivo };
  if (incluirCom) {
    if (process.platform !== 'win32') caso.modo_C = { estado: 'NO_EJECUTADO', motivo: 'COM solo en Windows con AutoCAD abierto.' };
    else caso.modo_C = { estado: 'MANUAL', instruccion: 'Ejecute en Claude Desktop «exportar_dwg_interactivo» sobre un proyecto con estas mismas láminas y registre aquí: ventana activa antes/después, pestaña creada, tiempo, resultado de verificarDwg. No se automatiza para no actuar sobre la sesión de la persona sin su autorización explícita.' };
  }
  informe.casos.push(caso);
}
informe.fin = new Date().toISOString();
fs.writeFileSync(path.join(salida, 'comparativa.json'), JSON.stringify(informe, null, 2));
process.stdout.write(`${JSON.stringify(informe.casos.map((c) => ({ caso: c.id, A_ms: c.modo_A.ms, B: c.modo_B.estado, B_ms: c.modo_B.ms ?? null })), null, 1)}\n${informe.es_simulador ? 'ATENCIÓN: Core Console SIMULADO — esto no es evidencia de AutoCAD.\n' : ''}Informe: ${path.join(salida, 'comparativa.json')}\n`);
