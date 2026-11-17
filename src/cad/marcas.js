// Registro PERSISTENTE y de solo-adición de ejecuciones CAD parciales o inciertas (CAD-OPEN-02).
// Una marca `*.pendiente.json` NUNCA se borra ni se reescribe: se resuelve añadiendo una entrada a `*.resolucion.json` con la evidencia
// (reconciliación de solo lectura por COM). Mientras exista una marca de importación sin resolver, no se inicia otra importación.
import fs from 'node:fs';
import path from 'node:path';

const RE = /^(apertura|importacion)-([0-9a-f]{16})(?:-([0-9TZ-]+))?\.pendiente\.json$/;
export const dirOperaciones = (root) => path.join(root, '03 Trabajo', 'CAD', 'operaciones');
const resolucionDe = (file) => file.replace(/\.pendiente\.json$/, '.resolucion.json');
const leerJson = (f, defecto) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return defecto; } };

export function listarMarcas(dir) {
  let nombres; try { nombres = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const n of nombres.sort()) {
    const m = RE.exec(n); if (!m) continue;
    const file = path.join(dir, n); const d = leerJson(file, null); const res = leerJson(resolucionDe(file), []);
    const entradas = Array.isArray(res) ? res : [];
    const ilegible = !d || typeof d !== 'object';
    const creada = ilegible ? null : (d.creada ?? null);
    // Fail-closed: una marca ilegible NO se considera resuelta por una resolución anterior ajena.
    const resuelta = !ilegible && entradas.some((e) => e && e.marca_creada === creada);
    out.push({ id: n, tipo: m[1], hash: m[2], file, creada, ilegible, resuelta, resoluciones: entradas.length,
      ultima_etapa: d?.ultima_etapa ?? null, tipo_fallo: d?.tipo_fallo ?? (d?.estado === 'incierto' ? 'tiempo_agotado' : null), codigo: d?.codigo ?? null, hresult: d?.hresult ?? null,
      tipo_excepcion: d?.tipo_excepcion ?? null, nombre_aislado: d?.nombre_aislado ?? null, entidades_vistas: d?.entidades_aislado_tras_error ?? null });
  }
  return out;
}

/** Crea una marca NUEVA (flag wx: jamás sobrescribe una existente). */
export function escribirMarca(dir, tipo, hash, datos) {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 5; i++) {
    const ts = new Date(Date.now() + i).toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${tipo}-${hash}-${ts}.pendiente.json`);
    try { fs.writeFileSync(file, JSON.stringify({ schema: 'tw.cad.ejecucion_parcial/1', tipo, creada: new Date().toISOString(), ...datos }, null, 2), { flag: 'wx' }); return file; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw new Error('No se pudo crear una marca única');
}

/** Resolución de solo-adición: conserva la marca original intacta. */
export function resolverMarca(marca, evidencia) {
  const f = resolucionDe(marca.file); const previas = leerJson(f, []); const lista = Array.isArray(previas) ? previas : [];
  lista.push({ marca_creada: marca.creada, resuelta: new Date().toISOString(), por: 'reconciliacion_solo_lectura', evidencia });
  const tmp = `${f}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(lista, null, 2)); fs.renameSync(tmp, f);
}
