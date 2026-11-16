// Contrato de comunicación (docs: directiva final §3): niveles breve/normal/detallado, preferencia persistente global y por proyecto, precedencia explícita.
// El servidor NO controla lo que Claude escribe: entrega la preferencia, la guía y las advertencias críticas; el comportamiento del modelo se verifica en campo.
import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteJson, readJson } from '../project/store.js';

export const NIVELES = ['breve', 'normal', 'detallado'];
export const GUIA = {
  breve: 'MODO BREVE: 30–100 palabras (1–4 frases). Responda directo: qué hizo o encontró, la ruta del archivo y SOLO las advertencias/pendientes importantes. No repita el encargo ni liste herramientas; sin recomendaciones no pedidas.',
  normal: 'MODO NORMAL: ~100–200 palabras. Resultado, metodología resumida y recomendaciones pertinentes; comparaciones si ayudan a decidir; fuentes y cálculos importantes sin desplegar el expediente.',
  detallado: 'MODO DETALLADO: explicación técnica completa (procedimiento, fórmulas con sustitución y unidades, hipótesis, métodos, límites de validez, fuentes, tablas y decisiones). Sin límite artificial.',
};
export const PRECEDENCIA = ['solicitud explícita del mensaje actual', 'preferencia del proyecto', 'preferencia global', 'predeterminado (breve)'];
const archivoGlobal = (home) => path.join(home, '.tannia-config', 'comunicacion.json');

export class Comunicacion {
  constructor(sandbox) { this.sandbox = sandbox; }
  leerGlobal() { const f = archivoGlobal(this.sandbox.home); try { const o = readJson(f, null, { raiz: this.sandbox.home }); return NIVELES.includes(o?.nivel) ? o.nivel : null; } catch { return null; } }
  leerProyecto(project) { try { const f = path.join(this.sandbox.projectRoot(project), '.tannia', 'comunicacion.json'); const o = readJson(f, null, { raiz: this.sandbox.projectRoot(project) }); return NIVELES.includes(o?.nivel) ? o.nivel : null; } catch { return null; } }
  establecer(alcance, nivel, project = null) {
    const o = { schema: 'tw.comunicacion/1', nivel, actualizado: new Date().toISOString() };
    if (alcance === 'global') { const f = archivoGlobal(this.sandbox.home); fs.mkdirSync(path.dirname(f), { recursive: true }); atomicWriteJson(f, o, { raiz: this.sandbox.home }); }
    else { const raiz = this.sandbox.projectRoot(project); const f = path.join(raiz, '.tannia', 'comunicacion.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); atomicWriteJson(f, o, { raiz }); }
    return o;
  }
  restablecer(alcance, project = null) { const f = alcance === 'global' ? archivoGlobal(this.sandbox.home) : path.join(this.sandbox.projectRoot(project), '.tannia', 'comunicacion.json'); try { fs.rmSync(f); return true; } catch { return false; } }
  /** Precedencia: solicitud explícita > proyecto > global > breve. `solicitado` lo declara Claude a partir del mensaje actual. */
  resolver({ solicitado = null, project = null } = {}) {
    if (solicitado && NIVELES.includes(solicitado)) return { nivel: solicitado, origen: 'solicitud_actual' };
    const pr = project ? this.leerProyecto(project) : null; if (pr) return { nivel: pr, origen: 'proyecto' };
    const g = this.leerGlobal(); if (g) return { nivel: g, origen: 'global' };
    return { nivel: 'breve', origen: 'predeterminado' };
  }
}

/** Advertencias que NUNCA se ocultan (§3.5): se extraen de los datos estructurados de la respuesta y se agrupan en una sola línea del texto. */
export function advertenciasCriticas(d) {
  if (!d || typeof d !== 'object') return [];
  const out = []; const n = (x) => (Array.isArray(x) ? x.length : 0);
  if (n(d.fallidos)) out.push(`${d.fallidos.length} paso(s) fallaron (${[...new Set(d.fallidos.map((f) => f.codigo))].join(', ')})`);
  if (n(d.bloqueos)) out.push(`${d.bloqueos.length} cifra(s) sin respaldo`);
  if (d.ok === false && !n(d.bloqueos)) out.push('no verificado');
  if (n(d.claims_desactualizados)) out.push(`${d.claims_desactualizados.length} resultado(s) desactualizado(s)`);
  if (n(d.fuentes_no_vigentes)) out.push(`fuente(s) no vigente(s): ${[...new Set(d.fuentes_no_vigentes.map((f) => f.motivo))].join(', ')}`);
  if (n(d.contradicciones_abiertas)) out.push(`${d.contradicciones_abiertas.length} contradicción(es) sin resolver`);
  if (d.plan?.brechas) { const prof = d.plan.brechas.filter((g) => g.se_resuelve_con === 'external_professional').length; if (prof) out.push(`${prof} punto(s) requieren revisión de un profesional`); }
  if (n(d.requiere_revision_de)) out.push(`requiere revisión de: ${d.requiere_revision_de.join(', ')}`);
  if (n(d.advertencias)) out.push(d.advertencias.slice(0, 2).join(' · '));
  if (d.entrega_valida === false) out.push('NO es una entrega válida (borrador desactualizado)');
  if (n(d.problemas)) { const u = d.problemas.filter((p) => p.tipo === 'unverified_citation').length; if (u) out.push(`${u} cita(s) sin verificar`); }
  if (d.resultado === 'needs_confirmation') out.push('hay cambios que requieren confirmación de la usuaria');
  return out;
}
