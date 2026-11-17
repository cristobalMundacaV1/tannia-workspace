// Registro de artefactos y manifiesto de entrega (E04/E17, Astra A-02). Una entrega se arma SOLO con artefactos generados
// desde la revisión vigente, cuyos bytes siguen idénticos; nunca con «el último archivo de la carpeta».
// La aprobación humana cubre el manifiesto exacto (huella) y se consume al exportar. Cualquier cambio posterior la invalida.
import fs from 'node:fs';
import path from 'node:path';
import { huella, idAleatorio } from './canonico.js';
import { revisionVigente } from './revision.js';
import { Recibos } from './recibos.js';
import { sha256File, FOLDERS } from '../security/sandbox.js';
import { UserError } from '../mcp/util.js';
import { copiarDentro, verificarContencion } from '../project/store.js';
import { unzipSync, strFromU8 } from 'fflate';

// Frases EXACTAS que emiten los generadores (mayúsculas): un nombre de proyecto como «R7 borrador» no es una marca.
const MARCAS_NO_FINALES = /BORRADOR [—\x97-]|BORRADOR DESACTUALIZADO|NO FINAL|TOTAL PARCIAL|DESACTUALIZADA/;
/** Revisa el CONTENIDO real del archivo (no solo metadatos): un documento que se declara borrador no puede ser entrega final. */
export function marcasNoFinales(abs) {
  const b = fs.readFileSync(abs);
  try {
    if (/\.pdf$/i.test(abs)) { const raw = b.toString('latin1'); const texto = raw + (raw.match(/<([0-9a-fA-F]{2,})>/g) || []).map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join(''); const m = texto.match(MARCAS_NO_FINALES); return m ? [m[0]] : []; }
    if (/\.xlsx$/i.test(abs)) { const z = unzipSync(new Uint8Array(b), { filter: (f) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(f.name) }); const out = []; for (const [n, d] of Object.entries(z)) { const m = strFromU8(d).match(MARCAS_NO_FINALES); if (m) out.push(`${m[0]} (${n})`); } return out; }
  } catch { return ['contenido ilegible']; }
  return [];
}

const ARCHIVO_ARTEFACTOS = ['.tannia', 'artefactos.json'];
export const ROLES_ENTREGA = { presupuesto_xlsx: 'Presupuesto (Excel)', memoria_pdf: 'Memoria de cálculo (PDF)' };

/** Mensaje de acción para fallos de archivo (abierto en otro programa, sin permiso, disco lleno). */
export function errorDeArchivo(e, rel, accion) {
  const que = { EBUSY: 'está abierto o bloqueado por otro programa', EPERM: 'no se puede usar (permiso denegado o abierto en otro programa)', EACCES: 'no tiene permisos suficientes', ENOSPC: 'no cabe: el disco está lleno', ENOENT: 'no existe (fue movido o borrado)' }[e?.code];
  if (!que) return e;
  return new UserError(`ARCHIVO_${e.code}`, `${accion}: «${rel}» ${que}.`, 'Cierre el archivo en Excel/visor/AutoCAD (o libere espacio) y vuelva a intentarlo. No se entregó nada a medias.');
}

export function leerArtefactos(pr) { return pr.leer(pr.p(...ARCHIVO_ARTEFACTOS), []); }

/** Registra un archivo generado y lo liga a la revisión vigente en el momento de generarlo. */
export function registrarArtefacto(pr, { tipo, rel, datos = {} }) {
  const rev = revisionVigente(pr);
  const abs = pr.p(...rel.split('/'));
  const reg = { id: idAleatorio('art'), tipo, rel, sha256: sha256File(abs), bytes: fs.statSync(abs).size, revision: rev.n, snapshot: rev.snapshot, creado: new Date().toISOString(), datos };
  const todos = leerArtefactos(pr); todos.push(reg); pr.escribir(pr.p(...ARCHIVO_ARTEFACTOS), todos.slice(-500));
  return { ...reg, revision_id: rev.id };
}

/** Estado de cada artefacto frente a la revisión vigente: vigente | de_otra_revision | modificado | faltante. */
export function estadoArtefactos(pr, rev = revisionVigente(pr)) {
  return leerArtefactos(pr).map((a) => {
    let sha = null; try { sha = sha256File(pr.p(...a.rel.split('/'))); } catch { sha = null; }
    const estado = sha === null ? 'faltante' : sha !== a.sha256 ? 'modificado' : (a.revision !== rev.n || a.snapshot !== rev.snapshot) ? 'de_otra_revision' : 'vigente';
    return { ...a, estado };
  });
}

/**
 * Prepara (sin aprobar) el manifiesto de la revisión vigente. Lanza GATE_NO_CUMPLIDO con todos los bloqueos si no es entregable.
 * `presupuesto` es computeBudget de las partidas ya proyectadas con verificaciones reales; `integridad` = verifyOriginals().
 */
export function prepararManifiesto(pr, { presupuesto, integridad, partidas, bloqueosExtra = [], modalidad = null, proteccion_originales = null, aviso = null }) {
  const rev = revisionVigente(pr); const bloqueos = [];
  const arts = estadoArtefactos(pr, rev);
  const elegido = {};
  for (const tipo of Object.keys(ROLES_ENTREGA)) {
    const vig = arts.filter((a) => a.tipo === tipo && a.estado === 'vigente');
    if (!vig.length) {
      const viejos = arts.filter((a) => a.tipo === tipo).length;
      bloqueos.push(`${ROLES_ENTREGA[tipo]}: no hay uno generado desde la revisión vigente ${rev.id}${viejos ? ' (los existentes corresponden a datos anteriores o fueron modificados)' : ''}. Vuelva a generarlo.`);
    } else {
      const a = vig.at(-1); elegido[tipo] = a;
      if (a.datos?.estado_documento !== 'candidato') bloqueos.push(`${ROLES_ENTREGA[tipo]} «${a.rel}» se generó como BORRADOR. Regenérelo cuando no haya pendientes.`);
      const marcas = marcasNoFinales(pr.p(...a.rel.split('/')));
      if (marcas.length) bloqueos.push(`${ROLES_ENTREGA[tipo]} «${a.rel}» contiene marcas de documento no final (${marcas.join(', ')}); no puede exportarse como entrega final.`);
    }
  }
  if (!presupuesto?.estado_final_posible) bloqueos.push(...(presupuesto?.bloqueos?.length ? presupuesto.bloqueos.slice(0, 15) : ['Presupuesto no apto para estado final.']));
  if (!integridad?.ok) bloqueos.push('Integridad de originales comprometida.');
  bloqueos.push(...bloqueosExtra);
  const desact = (partidas || []).filter((p) => p.desactualizada).map((p) => p.codigo);
  if (desact.length) bloqueos.push(`Partidas desactualizadas respecto de su archivo de origen: ${desact.join(', ')}.`);
  if (bloqueos.length) throw new UserError('GATE_NO_CUMPLIDO', `No se puede preparar la entrega: ${[...new Set(bloqueos)].join(' | ')}`, 'Resuelva los pendientes indicados y vuelva a generar los archivos si cambió algún dato.', { bloqueos: [...new Set(bloqueos)], revision: rev.id });
  const manifiesto = {
    schema: 'tw.delivery_manifest/1', id: idAleatorio('ent'), proyecto: pr.name, proyecto_id: pr.meta()?.id || null,
    revision: rev.n, revision_id: rev.id, snapshot: rev.snapshot,
    archivos: Object.entries(elegido).map(([rol, a]) => ({ rol, rel: a.rel, sha256: a.sha256, bytes: a.bytes, artefacto: a.id })),
    resumen: { total: presupuesto.total, costo_directo: presupuesto.costo_directo, moneda: presupuesto.moneda, politica_economica: presupuesto.config, partidas: partidas.map((p) => ({ codigo: p.codigo, cantidad: p.cantidad, unidad: p.unidad, recibo_verificacion: p.verificacion?.recibo || null })) },
    modalidad, proteccion_originales, advertencias: aviso ? [aviso] : [],
    originales: { estado: proteccion_originales === 'no_aplica_sin_originales' ? 'no_aplica_sin_originales' : integridad.estado, verificados: integridad.verificados },
    creado: new Date().toISOString(),
  };
  const f = pr.p('.tannia', 'entregas', `${manifiesto.id}.json`);
  verificarContencion(pr.root, path.dirname(f)); fs.mkdirSync(path.dirname(f), { recursive: true });
  pr.escribir(f, manifiesto);
  return { manifiesto, huella: huella(manifiesto), revision: rev };
}

export function leerManifiesto(pr, id) {
  if (!/^ent-[0-9a-f]{16}$/.test(String(id))) return null;
  try { return pr.leer(pr.p('.tannia', 'entregas', `${id}.json`), null); } catch { return null; }
}

/** Aprobación de entrega vigente: recibo firmado, no consumido, del manifiesto intacto, de la revisión vigente y con archivos idénticos. */
export function aprobacionVigente(pr) {
  const lect = new Recibos(pr.sandbox).leer(pr);
  const cand = lect.recibos.filter((r) => r.accion === 'aprobar_entrega' && !lect.consumidos.has(r.id)).at(-1);
  if (!cand) return { ok: false, motivo: 'No hay una aprobación de entrega dada por una persona (o ya se usó para exportar).' };
  const man = leerManifiesto(pr, cand.objetivo);
  if (!man || huella(man) !== cand.objetivo_hash) return { ok: false, motivo: 'El manifiesto aprobado falta o fue alterado.', recibo: cand };
  const rev = revisionVigente(pr);
  if (rev.n !== cand.revision || rev.snapshot !== man.snapshot || cand.snapshot !== man.snapshot) return { ok: false, motivo: `Los datos cambiaron después de la aprobación (aprobada ${`R${cand.revision}`}, vigente ${rev.id}).`, recibo: cand };
  for (const a of man.archivos) {
    let sha = null; try { sha = sha256File(pr.p(...a.rel.split('/'))); } catch { sha = null; }
    if (sha !== a.sha256) return { ok: false, motivo: `«${a.rel}» ${sha === null ? 'ya no existe' : 'fue modificado después de aprobarlo'}.`, recibo: cand };
  }
  return { ok: true, recibo: cand, manifiesto: man, revision: rev };
}

/**
 * Exporta EXACTAMENTE los archivos del manifiesto aprobado a una carpeta nueva de entrega. Transaccional: se prepara en una
 * carpeta temporal y solo se publica (rename) si todo se copió y verificó; si algo falla, no queda una entrega a medias.
 */
export function exportarEntrega(pr, { recibo, manifiesto, revision }) {
  const base = pr.p(FOLDERS.entregables);
  verificarContencion(pr.root, base);
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `Entrega ${revision.id} ${fecha} ${manifiesto.id.slice(4, 12)}`;
  const destino = path.join(base, nombre); const staging = path.join(base, `.preparando-${manifiesto.id}`);
  if (fs.existsSync(destino)) throw new UserError('ENTREGA_YA_EXPORTADA', `Ya existe «${FOLDERS.entregables}/${nombre}».`, 'No se sobrescribe una entrega. Si necesita otra, apruebe de nuevo.');
  fs.rmSync(staging, { recursive: true, force: true });
  verificarContencion(pr.root, staging); fs.mkdirSync(staging);
  try {
    const salida = [];
    for (const a of manifiesto.archivos) {
      const origen = pr.p(...a.rel.split('/')); const dest = path.join(staging, path.basename(a.rel));
      try { copiarDentro(pr.root, origen, dest); } catch (e) { throw errorDeArchivo(e, a.rel, 'No se pudo copiar a la entrega'); }
      const sha = sha256File(dest);
      if (sha !== a.sha256) throw new UserError('ENTREGA_COPIA_DISTINTA', `La copia de «${a.rel}» no coincide con lo aprobado.`, 'No se entregó nada. Revise el disco y vuelva a intentarlo.');
      salida.push({ archivo: path.basename(a.rel), rol: a.rol, sha256: sha, bytes: a.bytes });
    }
    const { hmac: _h, ...reciboPublico } = recibo;
    fs.writeFileSync(path.join(staging, 'manifiesto-entrega.json'), JSON.stringify({ ...manifiesto, aprobacion: { recibo: reciboPublico.id, canal: reciboPublico.canal, declarado_por: reciboPublico.declarado_por, emitido: reciboPublico.emitido }, exportado: new Date().toISOString() }, null, 2), { flag: 'wx' });
    fs.writeFileSync(path.join(staging, 'HUELLAS-SHA256.txt'), `${salida.map((o) => `${o.sha256}  ${o.archivo}`).join('\n')}\n`, { flag: 'wx' });
    verificarContencion(pr.root, destino);
    fs.renameSync(staging, destino);
    return { carpeta: `${FOLDERS.entregables}/${nombre}`, archivos: salida.map((o) => ({ ...o, archivo: `${FOLDERS.entregables}/${nombre}/${o.archivo}` })) };
  } catch (e) {
    try { fs.rmSync(staging, { recursive: true, force: true }); } catch { /* se informa el error original */ }
    throw e;
  }
}
