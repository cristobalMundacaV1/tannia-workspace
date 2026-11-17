// Migración segura de proyectos creados con versiones anteriores (E27). Idempotente, con respaldo byte a byte y reversión.
// Reglas conservadoras: una aprobación o verificación antigua NUNCA se convierte en recibo válido; los entregables previos
// quedan registrados como «importados sin verificar»; los datos (partidas, APU, parámetros) no se reescriben.
import fs from 'node:fs';
import path from 'node:path';
import { FOLDERS, sha256File } from '../security/sandbox.js';
import { verificarContencion } from '../project/store.js';
import { UserError } from '../mcp/util.js';

export const ESQUEMA_ACTUAL = 2;
const ARCHIVOS = [['.tannia', 'project.json'], [FOLDERS.cubicaciones, 'partidas.json'], [FOLDERS.presupuestos, 'apus.json'], [FOLDERS.presupuestos, 'config.json'], ['.tannia', 'originales.json'], ['.tannia', 'calibraciones.json']];
const archivoEsquema = (pr) => pr.p('.tannia', 'esquema.json');

export function leerEsquema(pr) { try { return JSON.parse(fs.readFileSync(archivoEsquema(pr), 'utf8')); } catch { return null; } }

/** Aplica la migración si hace falta. Devuelve null si ya estaba al día. */
export function asegurarMigracion(pr) {
  const actual = leerEsquema(pr);
  if (actual?.version >= ESQUEMA_ACTUAL) {
    if (actual.version > ESQUEMA_ACTUAL) throw new UserError('ESQUEMA_FUTURO', 'Este proyecto fue guardado por una versión MÁS NUEVA de Tannia Workspace.', 'Actualice Tannia Workspace; esta versión no lo modifica para no dañar datos que no comprende.');
    return null;
  }
  const meta = pr.meta(); if (!meta) return null;
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const respaldoRel = path.posix.join('.tannia', `respaldo-migracion-${sello}`);
  const respaldo = pr.p(...respaldoRel.split('/'));
  verificarContencion(pr.root, respaldo); fs.mkdirSync(respaldo, { recursive: true });
  const copiados = [];
  for (const partes of ARCHIVOS) {
    const f = pr.p(...partes); if (!fs.existsSync(f)) continue;
    const dest = path.join(respaldo, partes.join('__'));
    fs.copyFileSync(f, dest, fs.constants.COPYFILE_EXCL);
    if (sha256File(dest) !== sha256File(f)) throw new UserError('MIGRACION_RESPALDO_FALLIDO', 'No se pudo respaldar el proyecto antes de actualizarlo; no se cambió nada.');
    copiados.push({ archivo: partes.join('/'), respaldo: `${respaldoRel}/${partes.join('__')}`, sha256: sha256File(f) });
  }
  const acciones = [];
  const verificadasHeredadas = pr.partidas().filter((p) => p.cantidad_verificada === true).map((p) => p.codigo);
  if (verificadasHeredadas.length) acciones.push(`Verificaciones heredadas SIN recibo (deben repetirse con la usuaria): ${verificadasHeredadas.join(', ')}.`);
  const cfg = pr.configGuardada();
  const faltan = ['gastos_generales_pct', 'utilidades_pct', 'iva_pct'].filter((k) => cfg[k] == null);
  if (faltan.length) acciones.push(`Parámetros económicos que antes se suponían (0 % / IVA 19 %) y ahora quedan SIN DEFINIR: ${faltan.join(', ')}.`);
  const entregables = [];
  const dirE = pr.p(FOLDERS.entregables);
  const walk = (d) => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const f = path.join(d, e.name); if (e.isSymbolicLink()) continue; if (e.isDirectory()) walk(f); else entregables.push({ archivo: path.relative(pr.root, f).split(path.sep).join('/'), sha256: sha256File(f), estado: 'importado_sin_verificar' }); } };
  walk(dirE);
  if (entregables.length) acciones.push(`${entregables.length} archivo(s) en «${FOLDERS.entregables}» de versiones anteriores quedan como «importados sin verificar» (se conservan intactos).`);
  const estadoPrevio = meta.estado;
  if (['revision', 'aprobado', 'entregable'].includes(estadoPrevio)) {
    pr.setEstado('borrador', `Migración a esquema ${ESQUEMA_ACTUAL}: la aprobación/revisión anterior no tenía recibo de una persona; debe aprobarse de nuevo.`);
    acciones.push(`Estado «${estadoPrevio}» → «borrador»: la aprobación anterior no tenía recibo de una persona.`);
  }
  const reg = { schema: 'tw.project_schema/1', version: ESQUEMA_ACTUAL, desde: actual?.version ?? 1, migrado: new Date().toISOString(), estado_previo: estadoPrevio, respaldo: respaldoRel, archivos_respaldados: copiados, entregables_heredados: entregables, acciones };
  pr.escribir(archivoEsquema(pr), reg);
  pr.audit('migracion_esquema', { desde: reg.desde, hasta: ESQUEMA_ACTUAL, acciones: acciones.length });
  return reg;
}

/**
 * Revierte la última migración restaurando BYTE A BYTE los archivos respaldados (para volver a usar una versión anterior del
 * programa). No borra recibos ni artefactos nuevos; deja constancia en la auditoría. Una versión anterior seguirá sin recibos.
 */
export function revertirMigracion(pr) {
  const reg = leerEsquema(pr);
  if (!reg?.respaldo) throw new UserError('SIN_MIGRACION', 'Este proyecto no tiene una migración que revertir.');
  const restaurados = [];
  for (const c of reg.archivos_respaldados) {
    const origen = pr.p(...c.respaldo.split('/')); const destino = pr.p(...c.archivo.split('/'));
    verificarContencion(pr.root, destino);
    if (sha256File(origen) !== c.sha256) throw new UserError('RESPALDO_ALTERADO', `El respaldo de «${c.archivo}» no coincide con su huella; no se restauró nada más.`);
    const tmp = `${destino}.restaurando`; fs.copyFileSync(origen, tmp); fs.renameSync(tmp, destino); restaurados.push(c.archivo);
  }
  fs.renameSync(archivoEsquema(pr), pr.p('.tannia', `esquema.revertido-${Date.now()}.json`));
  pr.audit('migracion_revertida', { restaurados: restaurados.length });
  return { restaurados, nota: 'Se restauraron los datos previos a la migración. Al volver a abrir el proyecto con esta versión se migrará de nuevo (con nuevo respaldo).' };
}
