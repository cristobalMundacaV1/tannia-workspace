// Adaptador del enrutador (migración M3): NO cambia la salida de evaluarEncargo; solo AGREGA una ruta hacia el CIC. Las especializaciones son sugerencias informativas.
import { listarEspecializaciones } from './especializaciones.js';
import { listarOperaciones } from './ops/index.js';
import { cargarIntegradas } from './especializaciones/index.js';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function adaptarEnrutador(r, texto) {
  cargarIntegradas(); const t = norm(texto);
  const sug = listarEspecializaciones().map((e) => ({ id: e.id, titulo: e.title, coincidencias: e.concepts.filter((c) => [c.term, ...c.synonyms].some((x) => t.includes(norm(x)))).map((c) => c.term) })).filter((x) => x.coincidencias.length).sort((a, b) => b.coincidencias.length - a.coincidencias.length);
  const base = ['tannia_cic_catalogo', 'tannia_cic_conocimiento', 'tannia_cic_encargo', 'tannia_cic_calcular', 'tannia_cic_geometria', 'tannia_cic_entregable'];
  return {
    ruta: r.capacidad === 'no_soportado' ? 'tannia_cic_encargo' : 'opcional',
    mensaje: r.capacidad === 'no_soportado' ? 'Esta categoría no tiene generador dedicado, pero NO diga «no soportado»: use tannia_cic_catalogo y tannia_cic_encargo para comprender el problema, recuperar antecedentes, ejecutar lo calculable (geometría, cubicación, presupuesto, programa), generar entregables editables y declarar las brechas que requieren un profesional.' : 'Las capacidades transversales del CIC están disponibles también para este encargo (tannia_cic_catalogo).',
    especializaciones_sugeridas: sug.slice(0, 3), operaciones_disponibles: listarOperaciones().length, herramientas_cic: base,
    nota: 'Sugerencias informativas: ninguna disciplina condiciona el acceso a las capacidades; ningún resultado de ingeniería queda validado por este adaptador.',
  };
}
