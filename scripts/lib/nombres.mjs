// Validación de nombres y rutas de un paquete .mcpb compatibles con Windows y con el administrador de extensiones de Claude Desktop.
// Incidente real: un nombre visible con "/" ("H4/H5") se interpretó como separador de rutas y Claude Desktop informó "path escape".
// Estas reglas se ejecutan ANTES de empaquetar (scripts/pack.mjs, scripts/paquete-prueba.mjs) y en las pruebas.
import path from 'node:path';

const RESERVADOS_WIN = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
// Nombre visible: letras (Unicode), dígitos, espacio y . _ ( ) + # - ; NUNCA separadores de ruta ni caracteres inválidos en Windows.
const VISIBLE_PERMITIDO = /^[\p{L}\p{N} ._()+#-]+$/u;
export const MAX_NOMBRE_VISIBLE = 80;

/** ¿Sirve como UN segmento de ruta? (modelo de la comprobación que hizo fallar al instalador: basename(nombre) === nombre) */
export function esSegmentoSeguro(nombre) {
  const s = String(nombre);
  return s.length > 0 && path.posix.basename(s) === s && path.win32.basename(s) === s && !s.includes('..') && !/[\\/:*?"<>|]/.test(s) && !CONTROL.test(s) && !/[. ]$/.test(s) && !/^[. ]/.test(s) && !RESERVADOS_WIN.test(s);
}

export function validarNombreVisible(n) {
  const e = [];
  if (typeof n !== 'string' || !n.trim()) return ['display_name vacío'];
  if (n.length > MAX_NOMBRE_VISIBLE) e.push(`display_name de ${n.length} caracteres (máx. ${MAX_NOMBRE_VISIBLE})`);
  const malos = [...new Set([...n].filter((c) => /[\\/:*?"<>|]/.test(c)))];
  if (malos.length) e.push(`display_name contiene caracteres inválidos o separadores de ruta: ${malos.map((c) => `"${c}"`).join(' ')}`);
  if (CONTROL.test(n)) e.push('display_name contiene caracteres de control');
  if (/^[. ]|[. ]$/.test(n)) e.push('display_name no puede empezar ni terminar con punto o espacio');
  if (RESERVADOS_WIN.test(n.trim())) e.push('display_name es un nombre reservado de Windows');
  if (!malos.length && !VISIBLE_PERMITIDO.test(n)) e.push(`display_name usa caracteres fuera del conjunto seguro (letras, dígitos, espacio y . _ ( ) + # -): ${[...new Set([...n].filter((c) => !VISIBLE_PERMITIDO.test(c)))].map((c) => `"${c}"`).join(' ')}`);
  return e;
}

/** Valida el manifiesto completo. Devuelve { errores, avisos }. */
export function validarManifest(m) {
  const errores = []; const avisos = [];
  if (!m || typeof m !== 'object') return { errores: ['manifiesto ilegible'], avisos };
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(m.name ?? ''))) errores.push(`name "${m.name}" debe ser un identificador en minúsculas (a-z, 0-9, "-"), de 2 a 64 caracteres, sin "/" ni espacios`);
  errores.push(...validarNombreVisible(m.display_name));
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(m.version ?? ''))) errores.push(`version "${m.version}" no es una versión válida (p. ej. 0.1.0-tw09.fc48937.r2)`);
  for (const k of ['description', 'long_description']) if (m[k] != null && (typeof m[k] !== 'string' || CONTROL.test(m[k].replace(/[\n\t]/g, '')))) errores.push(`${k} contiene caracteres de control`);
  const entry = m.server?.entry_point; if (!entry || path.isAbsolute(entry) || /\.\./.test(entry) || /\\/.test(entry)) errores.push(`server.entry_point "${entry}" debe ser una ruta relativa interna con "/"`);
  const args = m.server?.mcp_config?.args ?? []; if (!args.some((a) => String(a).startsWith('${__dirname}/'))) avisos.push('mcp_config.args no usa ${__dirname}/…: el servidor podría no encontrarse al instalar');
  const nombres = (m.tools ?? []).map((t) => t.name); const dup = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  if (dup.length) errores.push(`herramientas repetidas: ${[...new Set(dup)].join(', ')}`);
  for (const n of nombres) if (!/^[A-Za-z0-9_-]{1,64}$/.test(n)) errores.push(`nombre de herramienta no válido: "${n}"`);
  return { errores, avisos };
}

/** Rutas internas del paquete (entradas del zip): relativas, con "/", sin traversal, compatibles con Windows y sin colisiones de mayúsculas. */
export function validarRutasPaquete(rutas, { maxLargo = 180 } = {}) {
  const errores = []; const vistos = new Map();
  for (const r0 of rutas) {
    const r = String(r0);
    if (!r || r.startsWith('/') || /^[A-Za-z]:/.test(r) || r.includes('\\')) { errores.push(`ruta no relativa o con "\\": ${r}`); continue; }
    if (r.length > maxLargo) errores.push(`ruta demasiado larga (${r.length}): ${r.slice(0, 60)}…`);
    for (const seg of r.split('/').filter(Boolean)) {
      if (seg === '..' || seg === '.') errores.push(`segmento "${seg}" no permitido: ${r}`);
      else if (/[<>:"|?*\u0000-\u001f]/.test(seg)) errores.push(`caracteres inválidos en Windows en "${seg}" (${r})`);
      else if (/[. ]$/.test(seg)) errores.push(`segmento con punto o espacio final: "${seg}" (${r})`);
      else if (RESERVADOS_WIN.test(seg)) errores.push(`nombre reservado de Windows: "${seg}" (${r})`);
    }
    const k = r.normalize('NFC').toLowerCase().replace(/\/$/, ''); if (vistos.has(k) && vistos.get(k) !== r) errores.push(`colisión por mayúsculas/minúsculas: "${r}" y "${vistos.get(k)}"`); vistos.set(k, r);
  }
  return errores;
}
