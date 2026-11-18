// Lectura SEGURA de archivos comprimidos (G03 / issue #31, contrato C-02 de TW-PRO-E2E).
//
// ZIP: lector propio del directorio central (no se confía en la cabecera local ni en una librería que extraiga a disco).
//   Cada entrada se valida ANTES de descomprimir: ruta (sin «..», absolutas, unidades, ADS, caracteres de control), enlaces
//   simbólicos Unix, cifrado, método, tamaños declarados y cuotas, rangos de datos superpuestos (técnica de «zip bomb» por
//   solapamiento) y, al descomprimir, tope duro de salida (`maxOutputLength`) + CRC-32.
// RAR: no hay motor propio. Se lee la CABECERA (RAR4 y RAR5) para inventariar nombres, tamaños y cifrado sin depender de un
//   tercero (libarchive 3.7.2 ignora la marca de cifrado de RAR4 «stored» y entrega los bytes como si fueran válidos), y la
//   extracción se delega al `tar` del sistema SOLO si es bsdtar/libarchive (Windows 10 1803+ trae tar.exe; RAR desde
//   Windows 11 23H2). Si no existe, el RAR queda inventariado como NO LEÍDO con una alternativa simple: nunca se simula.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

export const LIMITES = Object.freeze({
  entradas: 5000, // por expediente (todos los niveles)
  bytes_por_archivo: 200 * 1024 * 1024,
  bytes_totales: 2 * 1024 * 1024 * 1024,
  profundidad: 2, // ZIP dentro de ZIP: se abre 1 nivel anidado; más profundo queda inventariado sin abrir
  razon_sospechosa: 1000, // tamaño/comprimido por entrada (solo informativo: el tope duro es el tamaño declarado)
});

export class ErrorContenedor extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ---------- Rutas internas ----------

const RESERVADO_WIN = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)(\..*)?$/i;

/**
 * Valida una ruta interna de un comprimido. Devuelve { segmentos, avisos } o lanza ErrorContenedor si es hostil.
 * Hostil = absoluta, con unidad, UNC, con «..», con caracteres de control o con flujo alterno NTFS (`a.txt:zone`).
 * Nombres reservados de Windows o con punto/espacio final no son hostiles: se renombran y se informa.
 */
export function validarRutaInterna(nombre) {
  const crudo = String(nombre);
  if (!crudo || crudo.length > 1024) throw new ErrorContenedor('RUTA_INVALIDA', 'Nombre vacío o demasiado largo.');
  if (/[\u0000-\u001f\u007f]/.test(crudo)) throw new ErrorContenedor('RUTA_INVALIDA', 'El nombre contiene caracteres de control.');
  const n = crudo.replace(/\\/g, '/');
  if (n.startsWith('/') || /^[a-zA-Z]:/.test(n) || n.startsWith('//')) throw new ErrorContenedor('RUTA_ABSOLUTA', 'Ruta absoluta dentro del comprimido (intentaría escribir fuera de la carpeta).');
  const segmentos = n.split('/').filter((s) => s !== '' && s !== '.');
  if (segmentos.some((s) => s === '..')) throw new ErrorContenedor('RUTA_FUERA_DEL_DESTINO', 'La ruta contiene «..» (intentaría escribir fuera de la carpeta).');
  if (segmentos.some((s) => s.includes(':'))) throw new ErrorContenedor('RUTA_INVALIDA', 'La ruta contiene «:» (flujo alterno de Windows o unidad).');
  if (!segmentos.length) throw new ErrorContenedor('RUTA_INVALIDA', 'Ruta vacía.');
  const avisos = [];
  const limpios = segmentos.map((s) => {
    let t = s.normalize('NFC').replace(/[*?"<>|]/g, '_');
    if (/[. ]$/.test(t)) { t = t.replace(/[. ]+$/, '') || '_'; avisos.push(`«${s}» termina en punto o espacio (no válido en Windows): se guardó como «${t}».`); }
    if (RESERVADO_WIN.test(t)) { avisos.push(`«${s}» es un nombre reservado de Windows: se guardó como «_${t}».`); t = `_${t}`; }
    if (t !== s.normalize('NFC') && !avisos.length) avisos.push(`«${s}» contenía caracteres no válidos en Windows: se guardó como «${t}».`);
    const { name, ext } = path.parse(t); return `${name.slice(0, 120)}${ext.slice(0, 20)}`;
  });
  return { segmentos: limpios, avisos };
}

// ---------- Firmas ----------

export function tipoContenedor(buf) {
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) return 'zip';
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x06054b50) return 'zip'; // ZIP vacío
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]))) return 'rar5';
  if (buf.length >= 7 && buf.subarray(0, 7).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]))) return 'rar4';
  if (buf.length >= 6 && buf.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))) return '7z';
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) return 'gzip';
  return null;
}

// ---------- ZIP ----------

// CP437 (0x80–0xFF): nombres de ZIP sin el bit UTF-8 (p. ej. «Enviar a carpeta comprimida» en Windows con nombres en español).
const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';
const deCp437 = (b) => { let s = ''; for (const c of b) s += c < 0x80 ? String.fromCharCode(c) : CP437[c - 0x80]; return s; };

function buscarEocd(buf) {
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) if (buf.readUInt32LE(i) === 0x06054b50) return i;
  return -1;
}

/**
 * Lista las entradas de un ZIP desde el DIRECTORIO CENTRAL. No descomprime nada.
 * Cada entrada: { nombre, directorio, enlace, cifrado, metodo, comprimido, tamano, crc, inicio_datos, fin_datos, problema }
 */
export function listarZip(buf) {
  const eocd = buscarEocd(buf);
  if (eocd < 0) throw new ErrorContenedor('ZIP_DANADO', 'No se encontró el índice del archivo ZIP (está incompleto o dañado).');
  let total = buf.readUInt16LE(eocd + 10); let cdSize = buf.readUInt32LE(eocd + 12); let cdOff = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdOff === 0xffffffff || cdSize === 0xffffffff) { // ZIP64
    const loc = eocd - 20; if (loc < 0 || buf.readUInt32LE(loc) !== 0x07064b50) throw new ErrorContenedor('ZIP_DANADO', 'ZIP64 sin localizador válido.');
    const z64 = Number(buf.readBigUInt64LE(loc + 8)); if (z64 + 56 > buf.length || buf.readUInt32LE(z64) !== 0x06064b50) throw new ErrorContenedor('ZIP_DANADO', 'ZIP64 dañado.');
    total = Number(buf.readBigUInt64LE(z64 + 32)); cdSize = Number(buf.readBigUInt64LE(z64 + 40)); cdOff = Number(buf.readBigUInt64LE(z64 + 48));
  }
  if (total > LIMITES.entradas) throw new ErrorContenedor('DEMASIADAS_ENTRADAS', `El comprimido declara ${total} archivos (máximo ${LIMITES.entradas}).`);
  if (cdOff + cdSize > buf.length) throw new ErrorContenedor('ZIP_DANADO', 'El índice del ZIP apunta fuera del archivo (incompleto o dañado).');
  const entradas = []; let p = cdOff;
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new ErrorContenedor('ZIP_DANADO', 'Índice del ZIP dañado.');
    const hecho = buf.readUInt16LE(p + 4); const flags = buf.readUInt16LE(p + 8); const metodo = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16); let comprimido = buf.readUInt32LE(p + 20); let tamano = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28); const xLen = buf.readUInt16LE(p + 30); const cLen = buf.readUInt16LE(p + 32);
    const ext = buf.readUInt32LE(p + 38); let local = buf.readUInt32LE(p + 42);
    const nb = buf.subarray(p + 46, p + 46 + nLen); const extra = buf.subarray(p + 46 + nLen, p + 46 + nLen + xLen);
    let nombre = flags & 0x800 ? nb.toString('utf8') : deCp437(nb);
    for (let q = 0; q + 4 <= extra.length;) { // extras: ZIP64 (0x0001) y ruta Unicode de Info-ZIP (0x7075)
      const id = extra.readUInt16LE(q); const sz = extra.readUInt16LE(q + 2); const d = extra.subarray(q + 4, q + 4 + sz);
      if (id === 0x0001) { let k = 0; if (tamano === 0xffffffff && k + 8 <= d.length) { tamano = Number(d.readBigUInt64LE(k)); k += 8; } if (comprimido === 0xffffffff && k + 8 <= d.length) { comprimido = Number(d.readBigUInt64LE(k)); k += 8; } if (local === 0xffffffff && k + 8 <= d.length) { local = Number(d.readBigUInt64LE(k)); k += 8; } }
      if (id === 0x7075 && d.length > 5 && d[0] === 1) nombre = d.subarray(5).toString('utf8');
      q += 4 + sz;
    }
    const modoUnix = (hecho >> 8) === 3 ? (ext >>> 16) & 0o170000 : 0;
    const directorio = nombre.endsWith('/') || nombre.endsWith('\\') || modoUnix === 0o040000 || (ext & 0x10) === 0x10;
    const e = { nombre, directorio, enlace: modoUnix === 0o120000, cifrado: !!(flags & 0x1), metodo, comprimido, tamano, crc, local, problema: null };
    if (!directorio) {
      if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) e.problema = { codigo: 'ZIP_DANADO', motivo: 'La entrada apunta a datos inexistentes o dañados.' };
      else { e.inicio_datos = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28); e.fin_datos = e.inicio_datos + comprimido; if (e.fin_datos > buf.length) e.problema = { codigo: 'ZIP_DANADO', motivo: 'Los datos de la entrada están incompletos (ZIP truncado).' }; }
    }
    entradas.push(e); p += 46 + nLen + xLen + cLen;
  }
  // Rangos superpuestos: dos entradas que comparten bytes comprimidos son una técnica de bomba de descompresión.
  const rangos = entradas.filter((e) => !e.directorio && !e.problema && e.comprimido > 0).sort((a, b) => a.local - b.local);
  for (let i = 1; i < rangos.length; i++) if (rangos[i].local < rangos[i - 1].fin_datos) throw new ErrorContenedor('ZIP_HOSTIL', 'Dos archivos del ZIP comparten los mismos datos comprimidos (técnica de «bomba de descompresión»). No se abre.');
  return entradas;
}

/** Descomprime UNA entrada con tope duro de salida y CRC. Lanza ErrorContenedor con un motivo comprensible. */
export function extraerEntradaZip(buf, e) {
  if (e.cifrado) throw new ErrorContenedor('CIFRADO', 'Protegido con contraseña.');
  if (e.problema) throw new ErrorContenedor(e.problema.codigo, e.problema.motivo);
  if (e.tamano > LIMITES.bytes_por_archivo) throw new ErrorContenedor('ARCHIVO_MUY_GRANDE', `Declara ${Math.round(e.tamano / 1048576)} MB (máximo ${LIMITES.bytes_por_archivo / 1048576} MB por archivo).`);
  const datos = buf.subarray(e.inicio_datos, e.fin_datos); let out;
  if (e.metodo === 0) { if (e.comprimido !== e.tamano) throw new ErrorContenedor('ZIP_DANADO', 'Tamaños inconsistentes en una entrada sin compresión.'); out = Buffer.from(datos); }
  else if (e.metodo === 8) {
    try { out = zlib.inflateRawSync(datos, { maxOutputLength: Math.max(1, e.tamano) }); }
    catch (err) { if (err?.code === 'ERR_BUFFER_TOO_LARGE' || err instanceof RangeError) throw new ErrorContenedor('ZIP_HOSTIL', 'Descomprime más de lo que declara (posible bomba de descompresión).'); throw new ErrorContenedor('ZIP_DANADO', 'Los datos comprimidos están dañados.'); }
  } else throw new ErrorContenedor('METODO_NO_SOPORTADO', `Usa un método de compresión no soportado (${({ 9: 'Deflate64', 12: 'BZIP2', 14: 'LZMA', 93: 'Zstandard', 95: 'XZ', 99: 'AES' })[e.metodo] || e.metodo}). Vuelva a comprimir con «Enviar a → Carpeta comprimida» de Windows.`);
  if (out.length !== e.tamano) throw new ErrorContenedor('ZIP_DANADO', 'El tamaño descomprimido no coincide con el declarado.');
  if ((zlib.crc32(out) >>> 0) !== (e.crc >>> 0)) throw new ErrorContenedor('ZIP_DANADO', 'El contenido no coincide con su suma de control (archivo dañado).');
  return out;
}

// ---------- RAR (solo cabeceras) ----------

function vint(buf, p) { let v = 0; let mul = 1; for (let i = 0; i < 10; i++) { if (p + i >= buf.length) throw new ErrorContenedor('RAR_DANADO', 'Cabecera RAR incompleta.'); const b = buf[p + i]; v += (b & 0x7f) * mul; mul *= 128; if (!(b & 0x80)) return { v, n: i + 1 }; } throw new ErrorContenedor('RAR_DANADO', 'Cabecera RAR inválida.'); }

/** Inventario de un RAR (4 o 5) leyendo solo cabeceras: { version, cabeceras_cifradas, entradas[{nombre,tamano,directorio,cifrado,enlace}] }. */
export function listarRar(buf) {
  const t = tipoContenedor(buf); const entradas = []; let cabecerasCifradas = false;
  if (t === 'rar4') {
    let p = 7;
    while (p + 7 <= buf.length) {
      const tipo = buf[p + 2]; const flags = buf.readUInt16LE(p + 3); const size = buf.readUInt16LE(p + 5); if (size < 7) throw new ErrorContenedor('RAR_DANADO', 'Cabecera RAR dañada.');
      let add = 0;
      if (tipo === 0x73 && (flags & 0x0080)) { cabecerasCifradas = true; break; }
      if (tipo === 0x74) {
        if (p + 32 > buf.length) throw new ErrorContenedor('RAR_DANADO', 'Cabecera de archivo RAR incompleta.');
        const pack = buf.readUInt32LE(p + 7); const unp = buf.readUInt32LE(p + 11); const host = buf[p + 15]; const nLen = buf.readUInt16LE(p + 26); const attr = buf.readUInt32LE(p + 28);
        const alto = flags & 0x0100; const hp = alto ? buf.readUInt32LE(p + 32) : 0; const hu = alto ? buf.readUInt32LE(p + 36) : 0;
        const nOff = p + 32 + (alto ? 8 : 0); let nb = buf.subarray(nOff, nOff + nLen); const z = nb.indexOf(0); if ((flags & 0x200) && z >= 0) nb = nb.subarray(0, z);
        add = pack + hp * 2 ** 32;
        entradas.push({ nombre: nb.toString((flags & 0x200) ? 'latin1' : 'latin1'), tamano: unp + hu * 2 ** 32, directorio: (flags & 0xe0) === 0xe0, cifrado: !!(flags & 0x04), enlace: host === 3 && ((attr >>> 0) & 0o170000) === 0o120000 });
      } else if (flags & 0x8000) add = buf.readUInt32LE(p + 7);
      if (tipo === 0x7b) break;
      p += size + add;
    }
    return { version: 4, cabeceras_cifradas: cabecerasCifradas, entradas };
  }
  if (t === 'rar5') {
    let p = 8;
    while (p + 7 <= buf.length) {
      const hs = vint(buf, p + 4); const inicio = p + 4 + hs.n; const fin = inicio + hs.v; if (fin > buf.length) throw new ErrorContenedor('RAR_DANADO', 'Cabecera RAR5 incompleta.');
      let q = inicio; const tipo = vint(buf, q); q += tipo.n; const hf = vint(buf, q); q += hf.n;
      let extra = 0; let datos = 0; if (hf.v & 1) { const x = vint(buf, q); extra = x.v; q += x.n; } if (hf.v & 2) { const x = vint(buf, q); datos = x.v; q += x.n; }
      if (tipo.v === 4) { cabecerasCifradas = true; break; }
      if (tipo.v === 2) {
        const ff = vint(buf, q); q += ff.n; const us = vint(buf, q); q += us.n; const at = vint(buf, q); q += at.n; if (ff.v & 2) q += 4; if (ff.v & 4) q += 4;
        const ci = vint(buf, q); q += ci.n; const os_ = vint(buf, q); q += os_.n; const nl = vint(buf, q); q += nl.n; const nombre = buf.subarray(q, q + nl.v).toString('utf8');
        let cifrado = false; let enlace = false; let r = fin - extra;
        while (r < fin) { const sz = vint(buf, r); const ty = vint(buf, r + sz.n); if (ty.v === 1) cifrado = true; if (ty.v === 5) enlace = true; r += sz.n + sz.v; }
        entradas.push({ nombre, tamano: us.v, directorio: !!(ff.v & 1), cifrado, enlace });
      }
      if (tipo.v === 5) break;
      p = fin + datos;
    }
    return { version: 5, cabeceras_cifradas: cabecerasCifradas, entradas };
  }
  throw new ErrorContenedor('NO_ES_RAR', 'No es un archivo RAR.');
}

// ---------- Motor RAR del sistema (libarchive) ----------

let motorCache;
/** bsdtar/libarchive del sistema: Windows `%SystemRoot%\System32\tar.exe`; otros sistemas `bsdtar`. GNU tar NO lee RAR. */
export function motorRar({ forzar = null } = {}) {
  if (forzar !== null) return forzar || null;
  if (process.env.TANNIA_MOTOR_RAR === 'off') return null;
  if (motorCache !== undefined) return motorCache;
  const candidatos = process.platform === 'win32' ? [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')] : ['/usr/bin/bsdtar', '/usr/local/bin/bsdtar', '/opt/homebrew/bin/bsdtar'];
  motorCache = null;
  for (const c of candidatos) {
    try { if (!fs.existsSync(c)) continue; const v = execFileSync(c, ['--version'], { encoding: 'utf8', timeout: 10000, windowsHide: true }); const m = v.match(/libarchive (\d+)\.(\d+)/); if (m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 6))) { motorCache = { ruta: c, version: v.trim().split('\n')[0] }; break; } } catch { /* siguiente */ }
  }
  return motorCache;
}

/**
 * Extrae un RAR a una carpeta temporal NUEVA fuera del proyecto, con libarchive (que rechaza «..», rutas absolutas y escritura a
 * través de enlaces por defecto). Devuelve la carpeta; quien llama la recorre con las mismas reglas que una carpeta y la borra.
 */
export function extraerRarConMotor(archivo, motor, { timeoutMs = 120000 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tannia-rar-'));
  try { execFileSync(motor.ruta, ['-x', '-f', archivo, '-C', dir], { timeout: timeoutMs, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); return { dir, error: null }; }
  catch (e) { return { dir, error: String(e?.stderr || e?.message || e).slice(0, 300) }; }
}
