// MODO B (CAD-BG): procesamiento DWG SIN interfaz con AutoCAD Core Console (accoreconsole.exe), en un PROCESO PROPIO que no se
// conecta a la sesión de AutoCAD de la persona (no usa COM, ni GetActiveObject, ni ActiveDocument, ni Documents.Add, ni Activate).
//
// Estado de la evidencia: el mecanismo (detección, guion, ejecución oculta y de baja prioridad, tiempos, cancelación, preparación
// aislada, relectura como DXF y comparación determinista contra el modelo) está implementado y PROBADO con un SIMULADOR de consola en
// Linux. La compatibilidad real con AutoCAD 2027 (apertura de DXF con /i, SAVEAS DWG y DXF, AUDIT en Core Console, licencia, rutas Unicode,
// diálogos) es NO VERIFICADA hasta ejecutar docs/cad-bg/PROTOCOLO_AUTOCAD_2027.md en un equipo con AutoCAD.
//
// Regla de publicación: el DWG se escribe en una carpeta de preparación; solo se publica (rename) si (1) existe con cabecera AC10xx,
// (2) Core Console lo vuelve a abrir y lo guarda como DXF de relectura, y (3) esa relectura se compara entidad por entidad con el modelo.
// Si la comparación no es concluyente o hay diferencias, el DWG NO se publica como fiel: queda como «con diferencias», nunca «verificado».
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { verificarDxfContraModelo } from '../drawing/dxf_verificar.js';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

/** Localiza accoreconsole.exe sin abrir AutoCAD: variable de soporte, registro de Windows (AcadLocation) y rutas habituales. */
export function detectarCoreConsole({ platform = process.platform, env = process.env, existe = fs.existsSync, reg = (args) => execFileSync('reg', args, { encoding: 'utf8', timeout: 15000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }) } = {}) {
  const base = { verificado_en_autocad_real: false, nota: 'Detectar el ejecutable no prueba que Core Console procese DWG en este equipo (licencia, versión, rutas).' };
  if (env.TANNIA_MODO_B === 'off') return { ...base, disponible: false, motivo: 'Procesamiento sin interfaz desactivado por configuración.' };
  if (env.TANNIA_ACCORECONSOLE) {
    const r = path.resolve(env.TANNIA_ACCORECONSOLE);
    return existe(r) ? { ...base, disponible: true, ruta: r, origen: 'variable_de_soporte', version: env.TANNIA_ACCORECONSOLE_VERSION || 'desconocida' } : { ...base, disponible: false, motivo: 'La ruta configurada para Core Console no existe.' };
  }
  if (platform !== 'win32') return { ...base, disponible: false, motivo: 'AutoCAD Core Console solo existe en Windows.' };
  const candidatos = [];
  for (const rama of ['HKLM\\SOFTWARE\\Autodesk\\AutoCAD', 'HKCU\\SOFTWARE\\Autodesk\\AutoCAD']) {
    let out = ''; try { out = reg(['query', rama, '/s', '/v', 'AcadLocation']); } catch { continue; }
    let clave = null;
    for (const linea of out.split(/\r?\n/)) {
      if (/^HKEY_/.test(linea.trim())) { clave = linea.trim(); continue; }
      const m = linea.match(/^\s+AcadLocation\s+REG_(?:EXPAND_)?SZ\s+(.+)$/); if (!m || !clave) continue;
      const release = (clave.match(/\\R(\d+)\.(\d+)\\/) || []).slice(1).map(Number);
      candidatos.push({ carpeta: m[1].trim(), release: release.length ? release : [0, 0], clave });
    }
  }
  for (const anio of [2027, 2026, 2025]) candidatos.push({ carpeta: `C:\\Program Files\\Autodesk\\AutoCAD ${anio}`, release: [0, anio], clave: 'ruta_habitual' });
  candidatos.sort((a, b) => b.release[0] - a.release[0] || b.release[1] - a.release[1]);
  for (const c of candidatos) {
    const exe = path.win32.join(c.carpeta, 'accoreconsole.exe');
    if (existe(exe)) return { ...base, disponible: true, ruta: exe, origen: c.clave === 'ruta_habitual' ? 'ruta_habitual' : 'registro', version: path.win32.basename(c.carpeta) };
  }
  return { ...base, disponible: false, motivo: 'No se encontró AutoCAD Core Console (accoreconsole.exe). AutoCAD LT no lo incluye.' };
}

/**
 * Dentro de un guion .scr solo van NOMBRES de archivo ASCII simples, nunca rutas: AutoCAD lee el guion con la página de códigos del
 * sistema (la herramienta abierta acadbp obliga a configurarla), así que una ruta con «ñ» o tildes podría romperse. Los archivos viven
 * en la carpeta de preparación (la del dibujo abierto con /i, que Windows recibe en UTF-16 como argumento) y se nombran sin acentos.
 */
export function nombreParaGuion(n, ext) {
  const s = String(n);
  if (!/^[A-Za-z0-9_-]+\.[a-z]{3}$/.test(s)) throw Object.assign(new Error('Nombre de archivo no apto para un guion de AutoCAD.'), { code: 'RUTA_NO_VALIDA' });
  if (ext && !s.toLowerCase().endsWith(ext)) throw Object.assign(new Error(`Se esperaba ${ext}.`), { code: 'RUTA_NO_VALIDA' });
  return s;
}
/** Compatibilidad: valida una ruta absoluta (argumento /i, nunca dentro del guion). */
export function rutaParaGuion(p, ext) {
  const s = String(p);
  if (!(path.isAbsolute(s) || path.win32.isAbsolute(s))) throw Object.assign(new Error('Ruta no absoluta para Core Console.'), { code: 'RUTA_NO_VALIDA' });
  if (/["\r\n;]/.test(s) || /[\u0000-\u001f]/.test(s)) throw Object.assign(new Error('La ruta contiene caracteres no válidos.'), { code: 'RUTA_NO_VALIDA' });
  if (ext && !s.toLowerCase().endsWith(ext)) throw Object.assign(new Error(`Se esperaba ${ext}.`), { code: 'RUTA_NO_VALIDA' });
  return s;
}

/**
 * Guiones .scr ESTÁTICOS (patrón usado en producción por la herramienta abierta acadbp: entrada con /i y _.SAVEAS). FILEDIA/CMDDIA en 0
 * evitan cuadros de diálogo; nada de AutoLISP interactivo, NETLOAD ni comandos que esperen un clic. Cada espacio o salto es «Enter».
 *  - convertir: se abre el DXF con /i y se guarda como DWG 2018 con un nombre ASCII en la misma carpeta de preparación.
 *  - releer: se abre el DWG preparado con /i, AUDIT solo informa (N = no corrige) y se guarda una copia DXF 2018 de 16 decimales.
 */
export function guionConvertir({ dwg }) {
  return ['FILEDIA', '0', 'CMDDIA', '0', '_.SAVEAS', '2018', nombreParaGuion(dwg, '.dwg'), ''].join('\r\n');
}
export function guionReleer({ dxfSalida }) {
  return ['FILEDIA', '0', 'CMDDIA', '0', '_.AUDIT', 'N', '_.SAVEAS', 'DXF', 'P', 'N', 'V', '2018', '16', nombreParaGuion(dxfSalida, '.dxf'), ''].join('\r\n');
}

/** La consola de AutoCAD escribe UTF-16LE; un simulador o una versión futura podría escribir UTF-8. */
export function decodificarSalida(buf) {
  if (!buf?.length) return '';
  let ceros = 0; for (let i = 1; i < Math.min(buf.length, 400); i += 2) if (buf[i] === 0) ceros++;
  const t = ceros > Math.min(buf.length, 400) / 8 ? buf.toString('utf16le') : buf.toString('utf8');
  return t.replace(/\u0000/g, '');
}

/**
 * Ejecuta Core Console OCULTO (windowsHide → CREATE_NO_WINDOW), con prioridad BAJO LO NORMAL, sin entrada estándar (no puede quedar
 * esperando a la persona), con tiempo máximo y cancelación. Nunca se conecta a la sesión de AutoCAD abierta.
 */
export function ejecutarCoreConsole(motor, { dwgEntrada = null, guion, carpeta, timeoutMs = 600000, cancelado = () => false, alIniciar = () => {} }) {
  return new Promise((resolve) => {
    const scr = path.join(carpeta, `guion-${crypto.randomBytes(4).toString('hex')}.scr`);
    if (/[^\x20-\x7e\r\n]/.test(guion)) { resolve({ ok: false, clase: 'guion_no_ascii', ms: 0 }); return; }
    fs.writeFileSync(scr, guion, { flag: 'wx', encoding: 'latin1' });
    const args = [...(dwgEntrada ? ['/i', dwgEntrada] : []), '/s', scr, '/l', 'en-US'];
    const t0 = Date.now(); let out = []; let err = []; let fin = null; let child;
    try { child = spawn(motor.ruta, args, { cwd: carpeta, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('TANNIA_IN'))) }); }
    catch (e) { resolve({ ok: false, clase: 'no_inicia', detalle: String(e.message).slice(0, 200), ms: 0 }); return; }
    try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* sin permiso: se informa abajo */ }
    alIniciar(child.pid);
    child.stdout.on('data', (d) => { if (out.length < 400) out.push(d); }); child.stderr.on('data', (d) => { if (err.length < 100) err.push(d); });
    const terminar = (clase) => { if (fin) return; fin = clase; try { child.kill(); } catch { /* ya terminó */ } };
    const reloj = setTimeout(() => terminar('tiempo_agotado'), timeoutMs);
    const sondeo = setInterval(() => { if (cancelado()) terminar('cancelado'); }, 250);
    child.on('error', (e) => { fin = fin || 'no_inicia'; err.push(Buffer.from(String(e.message))); });
    child.on('close', (code) => {
      clearTimeout(reloj); clearInterval(sondeo);
      const salida = decodificarSalida(Buffer.concat(out)).slice(-4000);
      resolve({ ok: !fin && code === 0, clase: fin || (code === 0 ? null : 'codigo_salida'), codigo: code, ms: Date.now() - t0, salida, errores: decodificarSalida(Buffer.concat(err)).slice(-1000), auditoria: resumirAudit(salida) });
    });
  });
}

/** Resumen de la salida de AUDIT (solo informativo; el texto exacto depende del idioma y versión de AutoCAD). */
export function resumirAudit(salida) {
  const m = String(salida).match(/Total errors found\s+(\d+)\s+fixed\s+(\d+)/i) || String(salida).match(/(\d+)\s+errors? found/i);
  return m ? { errores_encontrados: Number(m[1]), corregidos: m[2] != null ? Number(m[2]) : null } : { errores_encontrados: null, nota: 'No se reconoció el informe de AUDIT en la salida.' };
}

/**
 * DXF → DWG sin interfaz con verificación por relectura. `composicion` es la del modelo (verificador independiente del escritor).
 * Devuelve { estado: 'PUBLICADO_VERIFICADO' | 'NO_PUBLICADO', ... }. Nunca sobrescribe un DWG existente.
 */
export async function convertirDxfADwgSinInterfaz({ motor, dxf, destino, composicion, preparacion, timeoutMs = 600000, cancelado = () => false, alIniciar = () => {}, paso = () => {} }) {
  if (fs.existsSync(destino)) return { estado: 'NO_PUBLICADO', codigo: 'DESTINO_EXISTE', motivo: 'Ya existe un DWG en el destino; no se sobrescribe.' };
  fs.mkdirSync(preparacion, { recursive: true });
  const dxfCopia = path.join(preparacion, 'entrada.dxf'); fs.copyFileSync(dxf, dxfCopia, fs.constants.COPYFILE_EXCL);
  const shaEntrada = sha(fs.readFileSync(dxfCopia));
  const dwgPrep = path.join(preparacion, 'planos.dwg'); const relectura = path.join(preparacion, 'relectura.dxf');
  paso('convertir');
  const r1 = await ejecutarCoreConsole(motor, { dwgEntrada: dxfCopia, guion: guionConvertir({ dwg: 'planos.dwg' }), carpeta: preparacion, timeoutMs, cancelado, alIniciar });
  if (r1.clase === 'cancelado') return { estado: 'NO_PUBLICADO', codigo: 'CANCELADO', ejecucion: [r1] };
  const cab = fs.existsSync(dwgPrep) ? fs.readFileSync(dwgPrep).subarray(0, 6).toString('latin1') : null;
  if (!r1.ok || !cab || !/^AC10\d\d$/.test(cab)) return { estado: 'NO_PUBLICADO', codigo: r1.clase === 'tiempo_agotado' ? 'TIEMPO_AGOTADO' : 'CONVERSION_FALLIDA', motivo: r1.clase === 'tiempo_agotado' ? 'Core Console no terminó a tiempo; se detuvo y no se publicó nada.' : 'Core Console no produjo un DWG válido; no se publicó nada.', ejecucion: [r1] };
  if (sha(fs.readFileSync(dxfCopia)) !== shaEntrada) return { estado: 'NO_PUBLICADO', codigo: 'ENTRADA_ALTERADA', motivo: 'La copia del DXF cambió durante la conversión.', ejecucion: [r1] };
  paso('releer');
  const r2 = await ejecutarCoreConsole(motor, { dwgEntrada: dwgPrep, guion: guionReleer({ dxfSalida: 'relectura.dxf' }), carpeta: preparacion, timeoutMs, cancelado, alIniciar });
  if (r2.clase === 'cancelado') return { estado: 'NO_PUBLICADO', codigo: 'CANCELADO', ejecucion: [r1, r2] };
  if (!r2.ok || !fs.existsSync(relectura)) return { estado: 'NO_PUBLICADO', codigo: 'RELECTURA_FALLIDA', motivo: 'El DWG se generó pero no se pudo volver a leer: no se publica (fidelidad NO VERIFICADA).', ejecucion: [r1, r2] };
  paso('comparar');
  let comparacion; try { comparacion = verificarDxfContraModelo(fs.readFileSync(relectura, 'utf8'), composicion); } catch (e) { comparacion = { ok: false, problemas: [`relectura ilegible: ${String(e.message).slice(0, 120)}`] }; }
  if (!comparacion.ok) return { estado: 'NO_PUBLICADO', codigo: 'FIDELIDAD_NO_DEMOSTRADA', motivo: 'El DWG releído no coincide con el modelo (o no se pudo comparar): no se publica como fiel.', comparacion, ejecucion: [r1, r2] };
  if (fs.existsSync(destino)) return { estado: 'NO_PUBLICADO', codigo: 'DESTINO_EXISTE', motivo: 'Otro proceso publicó un DWG mientras se verificaba; no se sobrescribe.' };
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  publicarSinSobrescribir(dwgPrep, destino);
  return { estado: 'PUBLICADO_VERIFICADO', destino, sha256: sha(fs.readFileSync(destino)), entrada_sha256: shaEntrada, comparacion, auditoria: r2.auditoria, ejecucion: [r1, r2].map(({ salida: _s, ...x }) => x) };
}

/** Publica sin sobrescribir aunque otro proceso llegue en el mismo instante: el enlace duro falla si el destino existe. */
function publicarSinSobrescribir(origen, destino) {
  try { fs.linkSync(origen, destino); fs.rmSync(origen, { force: true }); }
  catch (e) { if (e.code === 'EEXIST') throw Object.assign(new Error('El destino ya existe.'), { code: 'DESTINO_EXISTE' }); fs.copyFileSync(origen, destino, fs.constants.COPYFILE_EXCL); fs.rmSync(origen, { force: true }); }
}
