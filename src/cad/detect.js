// Detección de AutoCAD por registro de Windows (solo lectura). Es INFORMATIVA: un fallo aquí NO prueba que AutoCAD
// no esté disponible; la conexión COM se intenta de forma independiente (ver autocad_com.js).
import { execFileSync } from 'node:child_process';
import os from 'node:os';

export function parseRegQuery(out) {
  const res = [];
  let cur = null;
  for (const line of out.split(/\r?\n/)) {
    if (/^HKEY_/.test(line.trim())) { cur = { clave: line.trim(), producto: null }; res.push(cur); continue; }
    const m = line.match(/^\s+ProductName\s+REG_SZ\s+(.+)$/);
    if (m && cur) cur.producto = m[1].trim();
  }
  return res.filter((r) => r.producto).map((r) => ({
    producto: r.producto,
    es_lt: /\bLT\b/i.test(r.producto),
    release: (r.clave.match(/\\(R\d+\.\d+)\\/) || [])[1] || null,
  }));
}

const QUERIES = [
  ['HKLM\\SOFTWARE\\Autodesk\\AutoCAD', '/s', '/v', 'ProductName'],
  ['HKCU\\SOFTWARE\\Autodesk\\AutoCAD', '/s', '/v', 'ProductName'],
];

/** Clasifica el fallo de `reg query` sin exponer su salida. */
function clasificarFallo(e) {
  if (e && e.code === 'ENOENT') return 'reg_no_encontrado';
  if (e && (e.code === 'ETIMEDOUT' || e.killed)) return 'tiempo_agotado';
  if (e && e.status === 1) return 'clave_no_existe'; // reg.exe devuelve 1 si la clave no existe (mensaje localizado)
  return `fallo_reg_${e && e.status != null ? e.status : 'desconocido'}`;
}

export function detectarAutoCad({ platform = os.platform(), run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 15000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }) } = {}) {
  const base = { verificado_en_autocad_real: false, nota: 'Informativo: la detección por registro no sustituye a la conexión COM.' };
  if (platform !== 'win32') return { ...base, instalado: false, estado: 'no_windows', motivo: 'No es Windows: la integración con AutoCAD (COM) solo existe en Windows.' };
  const productos = []; const consultas = [];
  for (const q of QUERIES) {
    try { productos.push(...parseRegQuery(run('reg', ['query', ...q]))); consultas.push({ rama: q[0].split('\\')[0], resultado: 'ok' }); }
    catch (e) { consultas.push({ rama: q[0].split('\\')[0], resultado: clasificarFallo(e) }); }
  }
  if (productos.length) {
    const completos = productos.filter((p) => !p.es_lt);
    return { ...base, instalado: true, estado: 'instalado', productos, compatible: completos.length > 0, advertencia: completos.length ? null : 'Solo se detectó AutoCAD LT: no admite automatización COM; use exportación DXF.', consultas };
  }
  const errores = consultas.filter((c) => c.resultado !== 'ok' && c.resultado !== 'clave_no_existe');
  if (errores.length) {
    return { ...base, instalado: null, estado: 'desconocido', motivo: 'No se pudo consultar el registro; no implica que AutoCAD falte. Se intentará la conexión COM igualmente.', consultas };
  }
  return { ...base, instalado: false, estado: 'no_encontrado', motivo: 'No se encontró AutoCAD en el registro (puede estar instalado de otra forma; se intentará COM igualmente).', consultas };
}
