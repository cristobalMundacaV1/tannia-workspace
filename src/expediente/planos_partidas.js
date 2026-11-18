// PL-09 / G06–G07 de TW-PRO-E2E: la revisión VIGENTE de planos es la autoridad de las cantidades del presupuesto.
// planos (tw.drawing/1) → cantidades.json (tw.cantidades/1, solo DETALLE sumable) → partidas (con huella de la revisión de planos)
// → APU → presupuesto → memoria → manifiesto. Un cambio de planos deja DESACTUALIZADAS las partidas derivadas (no las borra) y la
// entrega queda bloqueada hasta regenerarlas; volver a la geometría anterior (A→B→A) reproduce las cantidades de A.
import fs from 'node:fs';
import path from 'node:path';
import { UserError } from '../mcp/util.js';
import { sha256File } from '../security/sandbox.js';
import { verificarManifiesto } from '../project/transaccion.js';
import { cantidadPartida, ESQUEMA_CANTIDADES } from '../drawing/cantidades_contrato.js';

export const DIR_PLANOS = ['06 Informes', 'Planos'];
export const REGLA_PLANOS = `plano:${ESQUEMA_CANTIDADES}`;

/** Revisión vigente de planos del proyecto, o null si no hay planos. No lanza si falta: la ausencia es un estado válido. */
export function planosVigentes(pr) {
  const dir = pr.p(...DIR_PLANOS); const hf = path.join(dir, 'historial.json');
  if (!fs.existsSync(hf)) return null;
  const h = pr.leer(hf, null); if (!h?.head) return null;
  const v = (h.versiones || []).find((x) => x.id === h.head); if (!v) return { head: h.head, integridad: 'sin_version', archivos: [] };
  const integ = verificarManifiesto(dir, h.head);
  const rel = (n) => [...DIR_PLANOS, n].join('/');
  const archivos = v.files.map((n) => ({ nombre: n, rel: rel(n) }));
  const cant = v.files.find((n) => n.endsWith('-cantidades.json'));
  return { head: h.head, model_sha256: v.model_sha256 || null, integridad: integ.estado, problemas: integ.problemas || [], archivos, cantidades: cant ? rel(cant) : null };
}

/** Lo que identifica a los planos dentro de la revisión de datos (solo si existen: proyectos sin planos no cambian de huella). */
export function huellaPlanos(pr) { const p = planosVigentes(pr); return p ? { head: p.head, model_sha256: p.model_sha256, integridad: p.integridad } : null; }

/** ¿La partida deriva de una revisión de planos que ya no es la vigente? Devuelve el motivo o null. */
export function obsolescenciaPorPlanos(pr, p, vig = planosVigentes(pr)) {
  if (p.regla !== REGLA_PLANOS || !p.fuente?.plano_revision) return null;
  if (!vig) return 'Los planos de los que salió esta cantidad ya no están en el proyecto.';
  if (vig.head !== p.fuente.plano_revision) return `Los planos cambiaron (revisión ${p.fuente.plano_revision} → ${vig.head}): la cantidad está DESACTUALIZADA. Vuelva a generar las partidas desde los planos vigentes.`;
  if (vig.integridad !== 'integra') return 'Los archivos de la revisión de planos fueron alterados fuera de Tannia: la cantidad no es confiable.';
  return null;
}

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

/**
 * Crea o actualiza partidas desde la revisión VIGENTE de planos. `asignaciones`: [{ partida, codigo?, apu? }] para fijar códigos/APU.
 * Las filas NEEDS_REVIEW, mezcladas o sin detalle no se convierten (bloqueadas, con el motivo). Devuelve { creadas, bloqueadas }.
 * `guardar(partida)` es el upsert del llamador (conserva el APU ya asignado y versiona la partida).
 */
export function partidasDesdePlanos(pr, { asignaciones = [], guardar }) {
  const vig = planosVigentes(pr);
  if (!vig) throw new UserError('SIN_PLANOS', 'El proyecto aún no tiene planos generados.', 'Genere los planos primero; las cantidades del presupuesto salen de ellos.');
  if (vig.integridad !== 'integra') throw new UserError('PLANOS_ALTERADOS', 'Los archivos de la revisión vigente de planos no coinciden con su manifiesto.', 'Vuelva a generar los planos; no se crean partidas desde archivos alterados.', { problemas: vig.problemas });
  if (!vig.cantidades) throw new UserError('PLANOS_SIN_CANTIDADES', 'Esta revisión de planos no tiene cantidades medidas (tw.cantidades/1).', 'Incluya «mediciones» con elementos físicos en la especificación, o use el generador de túnel.');
  const abs = pr.p(...vig.cantidades.split('/')); const sha = sha256File(abs); const doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (doc.revision !== vig.head) throw new UserError('CANTIDADES_DE_OTRA_REVISION', 'El archivo de cantidades no corresponde a la revisión vigente de planos.');
  const asig = new Map(asignaciones.map((a) => [a.partida, a]));
  const nombres = [...new Set(doc.detalle.map((f) => f.partida))];
  const creadas = []; const bloqueadas = []; const usados = new Set();
  for (const nombre of nombres) {
    let c; try { c = cantidadPartida(doc, nombre); } catch (e) { bloqueadas.push({ partida: nombre, codigo: e.code || 'CANTIDAD_NO_PRESUPUESTABLE', motivo: e.message }); continue; }
    const filas = doc.detalle.filter((f) => f.partida === nombre);
    const a = asig.get(nombre) || {};
    let codigo = a.codigo || `PL-${slug(nombre)}`; let k = 1; while (usados.has(codigo)) codigo = `${a.codigo || `PL-${slug(nombre)}`}-${++k}`; usados.add(codigo);
    const naturalezas = [...new Set(filas.map((f) => f.naturaleza).filter(Boolean))];
    const partida = {
      codigo, descripcion: filas[0].descripcion && filas[0].descripcion !== nombre ? `${nombre} — ${filas[0].descripcion}` : nombre, unidad: c.unidad, cantidad: c.valor,
      regla: REGLA_PLANOS, formula: filas.map((f) => `${f.id}: ${f.formula}`).join(' | '),
      fuente: { archivo: vig.cantidades, sha256: sha, capas: [], plano_revision: vig.head, modelo_sha256: doc.modelo_sha256, filas: c.filas },
      desglose: filas.map((f) => ({ fila: f.id, valor: f.valor, unidad: f.unidad, metodo: f.metodo, fuentes: f.fuentes, elementos: f.elementos, estado: f.estado, procedencia: f.procedencia })),
      supuestos: naturalezas, advertencias: [...(c.naturaleza === 'DECLARADA' ? ['Cantidad DECLARADA con origen (no medida desde el plano).'] : []), ...naturalezas.filter((x) => /académic|NO es|no constituye|sin validación/i.test(x))],
      estado_revision: 'borrador', cantidad_verificada: false, creada: new Date().toISOString(),
      ...(a.apu ? { apu: a.apu } : {}),
    };
    guardar(partida); creadas.push({ codigo, partida: nombre, cantidad: c.valor, unidad: c.unidad, filas: c.filas });
  }
  return { revision_planos: vig.head, cantidades: { archivo: vig.cantidades, sha256: sha }, creadas, bloqueadas, alternativas_no_sumables: doc.alternativas_no_sumables || [] };
}

/** Archivos de planos que acompañan la entrega: lámina conjunta (PDF), DXF y cantidades de la revisión VIGENTE. */
export function archivosPlanosEntrega(pr) {
  const vig = planosVigentes(pr); if (!vig) return { vig: null, archivos: [], bloqueos: [] };
  const bloqueos = []; if (vig.integridad !== 'integra') bloqueos.push(`Planos ${vig.head}: los archivos no coinciden con su manifiesto (alterados fuera de Tannia). Vuelva a generarlos.`);
  const roles = [[/-conjunto\.pdf$/, 'planos_pdf'], [/-planos\.dxf$/, 'planos_dxf'], [/-cantidades\.json$/, 'cantidades_planos']];
  const archivos = [];
  for (const [re, rol] of roles) { const a = vig.archivos.find((x) => re.test(x.nombre)); if (!a) continue; const abs = pr.p(...a.rel.split('/')); let sha = null; let bytes = null; try { sha = sha256File(abs); bytes = fs.statSync(abs).size; } catch { bloqueos.push(`Falta ${a.rel}.`); continue; } archivos.push({ rol, rel: a.rel, sha256: sha, bytes, artefacto: `plano-${vig.head}` }); }
  return { vig, archivos, bloqueos };
}
