// GV1 — Túnel académico «Obras Civiles II» con antecedentes SINTÉTICOS. Los datos del enunciado son del ejercicio (no del mundo real).
import fs from 'node:fs';
import path from 'node:path';
import { docx } from '../helpers_tw11.js';
import { APUNTES } from './corpus_tuneles.js';
import { call, data } from '../helpers.js';

export const ENUNCIADO = [
  { h: 1, t: 'Trabajo 2 — Túnel carretero (Obras Civiles II)' },
  { p: 'Se pide planificar y cubicar un túnel carretero de sección en herradura con las siguientes características del ejercicio.' },
  { p: 'Luz interior de 9 m, altura de hastiales de 2,5 m y bóveda semicircular. Espesor de revestimiento de hormigón de 0,4 m, solo en hastiales y bóveda.' },
  { p: 'Trazado en planta desde la progresiva 2+000: recta de 250 m, curva circular a la izquierda de 400 m de radio y 15 grados de deflexión, y recta final de 150 m.' },
  { p: 'Entregar planta, perfil longitudinal, al menos tres secciones transversales, cubicación de excavación y de revestimiento, y una memoria de procedimiento y cálculo.' },
  { p: 'No se entregan datos geotécnicos del macizo. El dimensionamiento del sostenimiento no forma parte de este trabajo.' },
];
const M = (value, unit = 'm') => ({ value, unit });
export const PATH = [{ type: 'straight', length: 250 }, { type: 'arc', radius: 400, angle_deg: 15, turn: 'left' }, { type: 'straight', length: 150 }];
export const LARGO = 250 + (400 * 15 * Math.PI) / 180 + 150;

export function interpretacionTunel(src) {
  return {
    schema: 'tw.cic.interpretation/1', mode: 'academic', restatement: 'Túnel carretero en herradura del ejercicio de Obras Civiles II: planta, perfil, tres secciones, cubicación de excavación y revestimiento, y memoria.',
    intents: [{ kind: 'deliver_artifact', text: 'planta, perfil, secciones, cubicación y memoria' }, { kind: 'compute', text: 'volúmenes' }, { kind: 'teach', text: 'explicar el procedimiento' }],
    deliverables: ['planta', 'perfil_longitudinal', 'secciones_transversales', 'cubicacion', 'memoria'].map((k, i) => ({ id: `d${i + 1}`, kind: k, status: 'confirmed' })),
    disciplines_proposed: [{ tag: 'túneles', rationale: 'enunciado' }, { tag: 'topografía' }, { tag: 'cubicaciones' }],
    antecedents: [{ ref: src.apuntes, quote: 'El volumen de excavación entre secciones se estima con el método de áreas medias', use: 'método de cubicación' }, { ref: src.apuntes, quote: 'El volumen de revestimiento de hormigón se obtiene como la diferencia entre el área de excavación y el área interior terminada', use: 'revestimiento' }, { ref: src.enunciado, quote: 'No se entregan datos geotécnicos del macizo', use: 'límite del ejercicio' }],
    research_questions: [{ id: 'q1', text: 'criterios de dimensionamiento del sostenimiento de túneles en roca', status: 'open' }],
    magnitudes: [{ name: 'luz_interior', value: 9, unit: 'm', origin: 'user', ref: src.enunciado }, { name: 'altura_hastial', value: 2.5, unit: 'm', origin: 'user', ref: src.enunciado }, { name: 'espesor_revestimiento', value: 0.4, unit: 'm', origin: 'user', ref: src.enunciado }, { name: 'progresiva_inicial', value: 2000, unit: 'm', origin: 'user' }, { name: 'clase_de_roca', value: null, unit: null, origin: 'unknown' }, { name: 'parametros_geotecnicos', value: null, unit: null, origin: 'unknown' }],
    assumptions: [{ text: 'El revestimiento no incluye solera ni contrabóveda (según el enunciado: solo hastiales y bóveda).' }, { text: 'La excavación coincide con el trasdós del revestimiento (sin sobreexcavación).' }],
    unknowns: [{ what: 'Clasificación geomecánica y parámetros del macizo', blocks: ['s7'], resolution: 'external_professional' }, { what: 'Dimensionamiento del sostenimiento primario y secundario', blocks: ['s7'], resolution: 'external_professional' }, { what: 'Ventilación y seguridad en operación', blocks: [], resolution: 'external_professional' }],
    methods_proposed: [{ operation_id: 'geo.volume.average_end_area', source_ref: src.apuntes, why: 'método de cubicación del curso' }, { operation_id: 'geo.sweep.volume_arch', why: 'barrido de la sección sobre el eje curvo' }],
    proposed_steps: [
      { id: 's1', goal: 'Áreas de la sección (interior, excavación y revestimiento)', capability_id: 'op.geo.section.horseshoe_lined', inputs: { luz_interior: { ref: 'magnitude:luz_interior' }, altura_hastial: { ref: 'magnitude:altura_hastial' }, espesor_revestimiento: { ref: 'magnitude:espesor_revestimiento' } } },
      { id: 's2', goal: 'Volumen de excavación del trazado completo', capability_id: 'op.geo.sweep.volume_arch', inputs: { path: M(PATH), luz_interior: { ref: 'magnitude:luz_interior' }, altura_hastial: { ref: 'magnitude:altura_hastial' }, espesor_exterior: { ref: 'magnitude:espesor_revestimiento' } } },
      { id: 's3', goal: 'Volumen interior terminado del trazado completo', capability_id: 'op.geo.sweep.volume_arch', inputs: { path: M(PATH), luz_interior: { ref: 'magnitude:luz_interior' }, altura_hastial: { ref: 'magnitude:altura_hastial' } } },
      { id: 's4', goal: 'Volumen de revestimiento de hormigón (excavación − interior)', capability_id: 'op.geo.volume.subtract', inputs: { minuendo: { ref: 'step:s2.volume' }, sustraendo: { ref: 'step:s3.volume' } } },
      { id: 's5', goal: 'Control cruzado: excavación por áreas medias entre las tres secciones', capability_id: 'op.geo.volume.average_end_area', inputs: { stations: M([2000, 2260, 2504]), areas: { refs: ['step:s1.area_excavacion', 'step:s1.area_excavacion', 'step:s1.area_excavacion'] } } },
      { id: 's6', goal: 'Longitud del eje', capability_id: 'op.geo.alignment.length', inputs: { path: M(PATH) } },
      { id: 's7', goal: 'Dimensionar el sostenimiento y verificar la estabilidad', capability_id: null, inputs: {} },
      { id: 's8', goal: 'Generar planta, perfil y secciones en DXF', capability_id: 'tool.tannia_cic_geometria', inputs: {} },
      { id: 's9', goal: 'Generar memoria y planilla de cantidades', capability_id: 'tool.tannia_cic_entregable', inputs: {}, depends_on: ['s4', 's8'] },
    ],
  };
}
export const ARGS_DXF = (P, N) => ({ proyecto: P, caso: N, accion: 'generar_lineal', nombre: 'tunel_oc2', titulo: 'Túnel OC2 — ejercicio', tramos: PATH, inicio: { x: 0, y: 0, azimut_deg: 0, progresiva: 2000 }, pivs: [{ s: 2000, z: 100 }, { s: 2260, z: 102.6, curva: 80 }, { s: 2504, z: 101.5 }], secciones: [2000, 2260, 2504].map((s, i) => ({ progresiva: s, nombre: `S${i + 1}`, tipo: 'herradura_revestida', luz: 9, altura_hastial: 2.5, espesor: 0.4 })), exageracion_vertical: 10 });

export async function correrTunel(c, home, P, N = 'Túnel OC2') {
  const dir = path.join(home, 'Proyectos', P, '01 Antecedentes'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'enunciado.docx'), docx(ENUNCIADO)); fs.writeFileSync(path.join(dir, 'apuntes.docx'), docx(APUNTES));
  const reg = async (ruta, titulo) => data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'registrar_archivo', ruta, clase: 'B', binding: 'didactic', titulo, disciplinas: ['tuneles'] })).id;
  const src = { enunciado: await reg('01 Antecedentes/enunciado.docx', 'Enunciado Trabajo 2'), apuntes: await reg('01 Antecedentes/apuntes.docx', 'Apuntes OC2') };
  const busq = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'buscar', consultas: ['cómo se calcula el volumen de revestimiento', 'método de áreas medias'], limite: 4 }));
  const enc = await call(c, 'tannia_cic_encargo', { proyecto: P, caso: N, interpretacion: interpretacionTunel(src) });
  const ejec = await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N });
  const geo = await call(c, 'tannia_cic_geometria', ARGS_DXF(P, N));
  const ent = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N });
  return { src, busq, enc, ejec, geo, ent, N };
}
