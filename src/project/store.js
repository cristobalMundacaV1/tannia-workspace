// Persistencia de proyecto: escritura atómica con respaldo, máquina de estados y verificación de originales.
import fs from 'node:fs';
import path from 'node:path';
import { FOLDERS, sha256File } from '../security/sandbox.js';
import { UserError } from '../mcp/util.js';
import { clasificarOriginal, dibujoDelBloqueo } from './originals_policy.js';
import { huella, idAleatorio } from '../autoridad/canonico.js';
import { contenidoPartida, revisionVigente } from '../autoridad/revision.js';

/** Parámetros económicos SIN valor por defecto (Astra A-04): ausente = desconocido, nunca 0 ni 19 implícitos. */
export const CONFIG_ECONOMICA_VACIA = Object.freeze({ gastos_generales_pct: null, utilidades_pct: null, iva_pct: null });

export const ESTADOS = ['nuevo', 'analisis', 'borrador', 'revision', 'aprobado', 'entregable'];

const igual = (a, b) => (process.platform === 'win32' ? String(a).toLowerCase() === String(b).toLowerCase() : a === b);
/**
 * CONTENCIÓN CANÓNICA: `objetivo` debe quedar dentro de `raiz` y ningún componente existente entre ambos puede ser un enlace
 * (symlink/junction) ni resolverse a otra ruta. Se llama ANTES de toda escritura (y de lecturas de metadatos internos).
 */
export function verificarContencion(raiz, objetivo) {
  const falla = (codigo, msg) => new UserError(codigo, msg, 'No se escribe para no salir del proyecto. Revise esa carpeta (no debe ser un acceso directo/enlace).');
  let raizReal; try { raizReal = fs.realpathSync.native(raiz); } catch { throw falla('DESTINO_NO_CANONICO', 'La carpeta del proyecto no se puede resolver.'); }
  const rel = path.relative(raiz, objetivo);
  if (rel === '') return raizReal;
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw falla('DESTINO_FUERA_DE_RAIZ', 'El destino está fuera de la carpeta del proyecto.');
  let actual = raiz; let esperado = raizReal;
  for (const parte of rel.split(path.sep)) {
    actual = path.join(actual, parte); let l; try { l = fs.lstatSync(actual); } catch { return raizReal; } // lo que aún no existe se creará bajo un ancestro ya verificado
    if (l.isSymbolicLink()) throw falla('DESTINO_ENLAZADO', `"${parte}" es un enlace (symlink/junction).`);
    esperado = path.join(esperado, parte);
    if (!igual(fs.realpathSync.native(actual), esperado)) throw falla('DESTINO_NO_CANONICO', `La ruta real de "${parte}" no es la esperada dentro del proyecto.`);
  }
  return raizReal;
}

/** Abre `file` (flags) y confirma que el descriptor es el archivo que está DENTRO de la raíz (descarta una sustitución entre comprobar y abrir). */
function abrirDentro(raiz, file, flags) {
  const fd = fs.openSync(file, flags);
  try {
    const raizReal = fs.realpathSync.native(raiz); const real = fs.realpathSync.native(file); const rel = path.relative(raizReal, real);
    const a = fs.fstatSync(fd); const b = fs.statSync(real);
    if (rel.startsWith('..') || path.isAbsolute(rel) || a.ino !== b.ino || a.dev !== b.dev) throw new UserError('DESTINO_CAMBIO_DURANTE_ESCRITURA', 'El destino cambió mientras se escribía (posible enlace); se descartó lo escrito.');
    return fd;
  } catch (e) { fs.closeSync(fd); try { fs.rmSync(file, { force: true }); } catch { /* ya no existe */ } throw e; }
}

/** Escritura atómica con respaldo. Con `{ raiz }` valida la contención ANTES de cada paso y confirma el destino tras escribir. */
export function atomicWriteJson(file, obj, { raiz } = {}) {
  const dir = path.dirname(file); const tmp = `${file}.${process.pid}.tmp`; const datos = JSON.stringify(obj, null, 2);
  if (!raiz) { fs.mkdirSync(dir, { recursive: true }); if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`); fs.writeFileSync(tmp, datos); fs.renameSync(tmp, file); return; }
  verificarContencion(raiz, dir); fs.mkdirSync(dir, { recursive: true }); verificarContencion(raiz, dir);
  if (fs.existsSync(file)) { verificarContencion(raiz, file); verificarContencion(raiz, `${file}.bak`); fs.copyFileSync(file, `${file}.bak`); }
  verificarContencion(raiz, tmp); const fd = abrirDentro(raiz, tmp, 'wx');
  try { fs.writeSync(fd, datos); } finally { fs.closeSync(fd); }
  verificarContencion(raiz, dir);
  fs.renameSync(tmp, file);
  try { verificarContencion(raiz, file); } catch (e) { try { fs.rmSync(file, { force: true }); } catch { /* ya no existe */ } throw e; }
}

/** Añade una línea a un archivo dentro de la raíz (auditoría) con las mismas garantías de contención. */
export function adjuntarLinea(raiz, file, linea) {
  verificarContencion(raiz, path.dirname(file)); verificarContencion(raiz, file);
  const fd = abrirDentro(raiz, file, 'a');
  try { fs.writeSync(fd, linea); } finally { fs.closeSync(fd); }
}

/** Copia sin sobrescribir `origen` → `destino` (dentro de la raíz): comprueba antes y confirma después; si falla, elimina lo creado. */
export function copiarDentro(raiz, origen, destino) {
  verificarContencion(raiz, path.dirname(destino)); verificarContencion(raiz, destino);
  fs.copyFileSync(origen, destino, fs.constants.COPYFILE_EXCL);
  try { verificarContencion(raiz, destino); } catch (e) { try { fs.rmSync(destino, { force: true }); } catch { /* ya no existe */ } throw e; }
}

/** Lee JSON; si está dañado recupera el respaldo .bak; si no hay, devuelve `def`. Con `{ raiz }` la recuperación también valida la contención. */
export function readJson(file, def, { raiz } = {}) {
  const tryRead = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  if (raiz) verificarContencion(raiz, file);
  if (!fs.existsSync(file)) return def;
  try { return tryRead(file); } catch {
    if (fs.existsSync(`${file}.bak`)) {
      try { const v = tryRead(`${file}.bak`); atomicWriteJson(file, v, { raiz }); return v; } catch (e) { if (e instanceof UserError && e.code?.startsWith('DESTINO_')) throw e; }
    }
    throw new UserError('ARCHIVO_DE_PROYECTO_DANADO', `El archivo interno "${path.basename(file)}" está dañado y no hay respaldo utilizable.`, 'Restaure desde una copia de seguridad del proyecto.');
  }
}

export class Project {
  constructor(sandbox, name) {
    this.sandbox = sandbox;
    this.root = sandbox.projectRoot(name);
    this.name = sandbox.projectName(name);
  }
  p(...parts) { return path.join(this.root, ...parts); }
  meta() { return this.leer(this.p('.tannia', 'project.json'), null); }
  saveMeta(m) { this.escribir(this.p('.tannia', 'project.json'), m); }
  partidas() { return this.leer(this.p(FOLDERS.cubicaciones, 'partidas.json'), []); }
  /**
   * Guarda partidas asignando `version_id`: se conserva solo si el contenido no cambió; cualquier cambio (aunque vuelva a un
   * valor anterior, A → B → A) crea una versión nueva, de modo que una verificación humana antigua no reaparece.
   */
  savePartidas(x, { revisar = false } = {}) {
    const previas = new Map(this.partidas().map((p) => [p.codigo, { h: huella(contenidoPartida(p)), v: p.version_id }]));
    const out = x.map((p) => { const prev = previas.get(p.codigo); const h = huella(contenidoPartida(p)); const { cantidad_verificada: _cv, verificada_por: _vp, verificada_en: _ve, verificacion: _vr, ...limpio } = p; return { ...limpio, version_id: prev && prev.h === h && prev.v ? prev.v : idAleatorio('pv') }; }); // la verificación vive SOLO en los recibos (sin campo contradictorio en disco)
    this.escribir(this.p(FOLDERS.cubicaciones, 'partidas.json'), out); this.cambio('Se modificaron las partidas.');
    if (!revisar) this.invalidateApproval('Se modificaron las partidas.');
  }
  apus() { return this.leer(this.p(FOLDERS.presupuestos, 'apus.json'), []); }
  saveApus(x) { this.escribir(this.p(FOLDERS.presupuestos, 'apus.json'), x); this.cambio('Se modificaron los APU.'); this.invalidateApproval('Se modificaron los APU.'); }
  /** Lo guardado tal cual (para la huella de revisión). */
  configGuardada() { return this.leer(this.p(FOLDERS.presupuestos, 'config.json'), {}); }
  /** Política económica efectiva: lo no indicado queda null (desconocido). */
  config() { return { ...CONFIG_ECONOMICA_VACIA, ...this.configGuardada() }; }
  saveConfig(x) { this.escribir(this.p(FOLDERS.presupuestos, 'config.json'), x); this.cambio('Se modificaron los parámetros económicos.'); this.invalidateApproval('Se modificó la configuración del presupuesto.'); }
  calibraciones() { return this.leer(this.p('.tannia', 'calibraciones.json'), []); }
  saveCalibraciones(x) { this.escribir(this.p('.tannia', 'calibraciones.json'), x); this.cambio('Se modificaron calibraciones de PDF.'); }
  /** Registra el cambio como revisión nueva si el contenido difiere de la revisión vigente (no crea revisiones vacías). */
  cambio(motivo) { if (this.meta()) revisionVigente(this, motivo); }
  revision() { return revisionVigente(this); }
  /** Manifiesto v2 {version, archivos, migrados}. Un manifiesto antiguo (mapa plano) se normaliza en memoria SIN perder hashes. */
  manifiesto() {
    const raw = this.leer(this.p('.tannia', 'originales.json'), {});
    if (raw && raw.version === 2) return { version: 2, archivos: raw.archivos || {}, migrados: raw.migrados || [] };
    const archivos = {}; const migrados = [];
    for (const [rel, info] of Object.entries(raw || {})) {
      const c = clasificarOriginal(path.posix.basename(rel));
      if (c.incluir) archivos[rel] = info;
      else migrados.push({ archivo: rel, sha256: info.sha256 || null, bytes: info.bytes ?? null, registrado: info.registrado || null, motivo: c.motivo, politica: c.id, migrado_en: new Date().toISOString() });
    }
    return { version: 2, archivos, migrados };
  }
  saveManifiesto(m) { this.escribir(this.p('.tannia', 'originales.json'), m); this.cambio('Cambió el registro de originales.'); }
  originales() { return this.manifiesto().archivos; }

  /** Reparación segura: recrea carpetas faltantes y valida/recupera los JSON internos. No toca originales. */
  repair() {
    const acciones = [];
    for (const f of [...Object.values(FOLDERS), '.tannia']) verificarContencion(this.root, this.p(f)); // carpetas enlazadas: no se repara a ciegas
    for (const f of Object.values(FOLDERS)) if (!fs.existsSync(this.p(f))) { fs.mkdirSync(this.p(f), { recursive: true }); acciones.push(`Carpeta recreada: ${f}`); }
    fs.mkdirSync(this.p('.tannia'), { recursive: true });
    const files = [[this.p('.tannia', 'project.json'), null], [this.p('.tannia', 'originales.json'), {}], [this.p('.tannia', 'calibraciones.json'), []], [this.p(FOLDERS.cubicaciones, 'partidas.json'), []], [this.p(FOLDERS.presupuestos, 'apus.json'), []], [this.p(FOLDERS.presupuestos, 'config.json'), {}]];
    const problemas = [];
    for (const [file, def] of files) {
      if (!fs.existsSync(file)) continue;
      const bak = fs.existsSync(`${file}.bak`);
      try { JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
        if (bak) { try { JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')); fs.copyFileSync(`${file}.bak`, file); acciones.push(`Restaurado desde respaldo: ${path.basename(file)}`); continue; } catch { /* sigue */ } }
        problemas.push(`${path.basename(file)} dañado y sin respaldo utilizable`); void def;
      }
    }
    try { const m0 = this.manifiesto(); if (m0.migrados.length) { this.saveManifiesto(m0); acciones.push(`Manifiesto de originales migrado: ${m0.migrados.length} residuo(s) transitorio(s) apartados (hashes de originales intactos)`); } } catch { /* se informa en verifyOriginals */ }
    const integ = this.verifyOriginals();
    if (!integ.ok) problemas.push(`Originales alterados: ${integ.problemas.map((x) => `${x.archivo} (${x.problema})`).join(', ')}`);
    this.audit('reparacion', { acciones: acciones.length, problemas: problemas.length });
    return { acciones, problemas, originales_ok: integ.ok };
  }

  audit(evento, datos = {}) {
    adjuntarLinea(this.root, this.p('.tannia', 'auditoria.jsonl'), `${JSON.stringify({ t: new Date().toISOString(), evento, ...datos })}\n`);
  }
  /** `.tannia` debe ser una carpeta real dentro del proyecto (no un enlace). Se exige antes de leer o escribir metadatos. */
  verificarTannia() { verificarContencion(this.root, this.p('.tannia')); }
  leer(file, def) { return readJson(file, def, { raiz: this.root }); }
  escribir(file, obj) { atomicWriteJson(file, obj, { raiz: this.root }); }

  setEstado(estado, nota) {
    const m = this.meta();
    m.estado = estado; m.historial.push({ estado, fecha: new Date().toISOString(), nota: nota || null });
    this.saveMeta(m); this.audit('estado', { estado, nota });
  }

  /** Cualquier cambio de datos tras aprobar vuelve el proyecto a borrador (la aprobación deja de valer). */
  invalidateApproval(motivo) {
    const m = this.meta();
    if (m && (m.estado === 'aprobado' || m.estado === 'entregable' || m.estado === 'revision')) this.setEstado('borrador', `Aprobación/revisión invalidada: ${motivo}`);
  }

  /** ¿Hay un bloqueo de AutoCAD (.dwl/.dwl2) junto a este dibujo? (el dibujo podría estar abierto) */
  #hayBloqueo(full) {
    // AutoCAD nombra los bloqueos con el nombre del dibujo SIN extensión: "plano.dwg" -> "plano.dwl", "plano.dwl2"
    const stem = path.basename(full, path.extname(full)).toLowerCase();
    try { return fs.readdirSync(path.dirname(full)).some((n) => dibujoDelBloqueo(n) === stem); } catch { return false; }
  }

  /**
   * Registra originales (hash + solo lectura) SOLO de archivos admitidos por la política (originals_policy.js).
   * Residuos transitorios (.dwl, .dwl2, .bak, temporales…) se ignoran: no se hashean ni se les cambian permisos.
   * Migra de forma segura manifiestos anteriores que los hubieran registrado.
   */
  registerOriginals() {
    const dir = this.p(FOLDERS.originales);
    const man = this.manifiesto();
    const nuevos = []; const cambiados = []; const ignorados = []; const advertencias = []; const permisosRestaurados = [];
    // Migración: los residuos registrados antes se apartan (conservando su hash como evidencia histórica) y se
    // les devuelve el permiso de escritura que este producto les había quitado (AutoCAD debe poder borrar sus bloqueos).
    for (const m of man.migrados) {
      if (m.permisos_restaurados) continue;
      const full = this.p(...m.archivo.split('/'));
      try { if (fs.existsSync(full)) { fs.chmodSync(full, 0o644); m.permisos_restaurados = true; permisosRestaurados.push(m.archivo); } } catch { /* sin permiso: se informa abajo */ }
    }
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isSymbolicLink()) continue; // enlaces se ignoran por seguridad
        if (e.isDirectory()) { walk(full); continue; }
        const rel = path.relative(this.root, full).split(path.sep).join('/');
        const c = clasificarOriginal(e.name);
        if (!c.incluir) { ignorados.push({ archivo: rel, politica: c.id, motivo: c.motivo }); if (c.advertencia) advertencias.push(`${rel}: ${c.advertencia}`); continue; }
        const st = fs.statSync(full); const sha = sha256File(full);
        if (!man.archivos[rel]) {
          const inestable = this.#hayBloqueo(full);
          man.archivos[rel] = { sha256: sha, bytes: st.size, mtime_ms: Math.round(st.mtimeMs), registrado: new Date().toISOString(), ...(inestable ? { captura_inestable: true } : {}) };
          nuevos.push(rel);
          if (inestable) advertencias.push(`${rel}: CAPTURA INESTABLE — existe un bloqueo de AutoCAD (.dwl): el dibujo puede estar abierto y su contenido en disco puede cambiar al guardarlo. La huella registrada NO garantiza un respaldo inmutable; cierre el dibujo y vuelva a registrar.`);
          try { fs.chmodSync(full, 0o444); } catch { /* Windows */ }
        } else if (man.archivos[rel].sha256 !== sha) cambiados.push(rel);
      }
    };
    walk(dir);
    this.saveManifiesto(man);
    this.audit('originales_registrados', { nuevos: nuevos.length, cambiados: cambiados.length, ignorados: ignorados.length, migrados: man.migrados.length });
    return { nuevos, cambiados, ignorados, advertencias, migrados_de_versiones_anteriores: man.migrados.map((m) => ({ archivo: m.archivo, politica: m.politica })), permisos_restaurados: permisosRestaurados, total: Object.keys(man.archivos).length };
  }

  /** Verifica por hash (autoridad). Los residuos transitorios nunca cuentan; tampoco su presencia/ausencia. */
  verifyOriginals() {
    const man = this.manifiesto();
    const problemas = []; const notas = []; const abiertos = [];
    for (const [rel, info] of Object.entries(man.archivos)) {
      const full = this.p(...rel.split('/'));
      if (!fs.existsSync(full)) { problemas.push({ archivo: rel, problema: 'faltante' }); continue; }
      const st = fs.statSync(full);
      if (sha256File(full) !== info.sha256) {
        problemas.push({ archivo: rel, problema: 'modificado', ...(info.captura_inestable ? { nota: 'se registró con el dibujo posiblemente abierto en AutoCAD (captura inestable): puede ser un cambio legítimo previo al cierre; compare con su respaldo' } : {}) });
      } else if (info.mtime_ms != null && Math.round(st.mtimeMs) !== info.mtime_ms) notas.push({ archivo: rel, nota: 'contenido idéntico (hash) pero cambió la fecha de modificación' });
      if (this.#hayBloqueo(full)) abiertos.push(rel);
    }
    const verificados = Object.keys(man.archivos).length;
    // 0 originales verificados solo prueba que no hay NADA que comparar: no es evidencia de que la protección funcione
    const estado = problemas.length ? 'comprometidos' : verificados === 0 ? 'sin_originales_que_verificar' : 'integros';
    return { ok: problemas.length === 0, estado, proteccion_validada: estado === 'integros', verificados, problemas, metadatos: notas, posiblemente_abiertos_en_autocad: abiertos, ignorados_por_politica: man.migrados.length };
  }

  /** Copia un original (o antecedente) a 03 Trabajo comprobando el hash; nunca devuelve ruta del original para escritura. */
  copyToWork(rel) {
    const { abs, root } = this.sandbox.resolve(this.name, rel);
    const st = fs.statSync(abs);
    if (!st.isFile()) throw new UserError('NO_ES_ARCHIVO', 'La ruta indicada no es un archivo.');
    const clase = clasificarOriginal(path.basename(abs));
    if (!clase.incluir) throw new UserError('ARCHIVO_TRANSITORIO', 'Ese archivo es un residuo transitorio (bloqueo/temporal) y no se copia.', clase.motivo);
    const inestable = this.#hayBloqueo(abs);
    const base = path.basename(abs); const ext = path.extname(base);
    let dest = path.join(root, FOLDERS.trabajo, `${path.basename(base, ext)} - copia de trabajo${ext}`);
    for (let i = 2; fs.existsSync(dest); i++) dest = path.join(root, FOLDERS.trabajo, `${path.basename(base, ext)} - copia de trabajo ${i}${ext}`);
    fs.copyFileSync(abs, dest, fs.constants.COPYFILE_EXCL);
    const a = sha256File(abs); const b = sha256File(dest);
    if (a !== b) { fs.unlinkSync(dest); throw new UserError('COPIA_CORRUPTA', 'La copia no coincide con el original; se descartó.'); }
    try { fs.chmodSync(dest, 0o644); } catch { /* */ }
    this.audit('copia_trabajo', { origen: path.relative(root, abs), destino: path.relative(root, dest) });
    return { copia: path.relative(root, dest).split(path.sep).join('/'), sha256: a, ...(inestable ? { advertencia: 'CAPTURA INESTABLE: el dibujo está (o estuvo) abierto en AutoCAD (existe un bloqueo .dwl). La copia refleja lo guardado en disco, no los cambios sin guardar; los bloqueos no se tocaron.' } : {}) };
  }
}
