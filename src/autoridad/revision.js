// Revisiones del expediente (E04/E11): número monótono + huella de contenido. Cualquier cambio de partidas, APU, parámetros
// económicos, calibraciones, originales registrados, bytes de archivos de origen o verificaciones crea una revisión NUEVA.
// Volver a un contenido anterior (A → B → A) también crea un número nuevo: nada de B ni de la primera A se reutiliza por coincidir.
import fs from 'node:fs';
import { huella } from './canonico.js';
import { sha256File } from '../security/sandbox.js';
import { Recibos } from './recibos.js';

const CAMPOS_DE_REVISION_HUMANA = ['version_id', 'cantidad_verificada', 'verificada_por', 'verificada_en', 'resolucion_needs_review', 'verificacion', 'desactualizada'];

/** Contenido de una partida que una verificación respalda (sin los campos de la propia verificación ni el id de versión). */
export function contenidoPartida(p) {
  const c = { ...p }; for (const k of CAMPOS_DE_REVISION_HUMANA) delete c[k]; return c;
}
export const huellaPartida = (p) => huella(contenidoPartida(p));

/** Verificaciones humanas VIGENTES: recibo firmado de la misma partida, misma versión y misma huella de contenido. */
export function verificacionesVigentes(pr, partidas = pr.partidas(), lectura = new Recibos(pr.sandbox).leer(pr)) {
  const m = new Map();
  for (const p of partidas) {
    const h = huellaPartida(p);
    const r = lectura.recibos.filter((x) => x.accion === 'verificar_partida' && x.objetivo === p.codigo && x.objetivo_version === p.version_id && x.objetivo_hash === h).at(-1);
    if (r) m.set(p.codigo, r);
  }
  return m;
}

/**
 * Proyecta la autoridad real sobre las partidas: `cantidad_verificada` solo es true si existe un recibo humano vigente.
 * Un `true` heredado de versiones anteriores o escrito a mano en partidas.json queda como "verificación heredada sin recibo".
 */
export function conVerificacion(pr, partidas, vig = verificacionesVigentes(pr, partidas)) {
  return partidas.map((p) => {
    const r = vig.get(p.codigo);
    const { cantidad_verificada: declarada, verificada_por: _vp, verificada_en: _ve, ...resto } = p;
    const out = { ...resto, cantidad_verificada: !!r };
    if (r) { out.verificada_por = r.declarado_por || `persona en este equipo (${r.canal === 'human_dialog' ? 'diálogo del sistema' : 'confirmación del cliente'})`; out.verificada_en = r.emitido; out.verificacion = { recibo: r.id, canal: r.canal }; }
    else if (declarada === true) out.advertencias = [...(p.advertencias || []), 'Verificación heredada SIN recibo de una persona: debe verificarse de nuevo.'];
    return out;
  });
}

export function contenidoRevision(pr) {
  const partidas = pr.partidas();
  const fuentes = {};
  for (const p of partidas) {
    const a = p.fuente?.archivo; if (!a || fuentes[a]) continue;
    try { fuentes[a] = sha256File(pr.sandbox.resolve(pr.name, a).abs); } catch { fuentes[a] = 'faltante'; }
  }
  const originales = Object.fromEntries(Object.entries(pr.originales()).map(([k, v]) => [k, v.sha256]));
  const verificaciones = [...verificacionesVigentes(pr, partidas).values()].map((r) => r.id).sort();
  return { partidas: partidas.map((p) => ({ ...contenidoPartida(p), version_id: p.version_id ?? null })), apus: pr.apus(), config: pr.configGuardada(), calibraciones: pr.calibraciones(), originales, fuentes_actuales: fuentes, verificaciones };
}

/** Revisión vigente. Si el contenido cambió (por herramienta o por fuera), crea una revisión nueva con su motivo. */
export function revisionVigente(pr, motivo = 'Cambio detectado en los datos o en los archivos de origen.') {
  const f = pr.p('.tannia', 'revision.json');
  const snapshot = huella(contenidoRevision(pr));
  let st = null; try { st = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { st = null; }
  if (st && st.snapshot === snapshot && Number.isInteger(st.n)) return { n: st.n, snapshot, id: `R${st.n}` };
  const n = (Number.isInteger(st?.n) ? st.n : 0) + 1;
  const historial = [...(Array.isArray(st?.historial) ? st.historial : []), { n, snapshot, motivo: st ? motivo : 'Primera revisión registrada (incluye proyectos creados con versiones anteriores).', t: new Date().toISOString() }].slice(-300);
  pr.escribir(f, { schema: 'tw.revision/1', n, snapshot, historial });
  return { n, snapshot, id: `R${n}` };
}
