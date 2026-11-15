// Control de rutas y protección de originales en la CAPA DE HERRAMIENTAS.
// Ninguna herramienta debe usar rutas del usuario/Claude sin pasar por aquí.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class SecurityError extends Error {
  constructor(code, message) { super(message); this.code = code; this.name = 'SecurityError'; }
}

export const FOLDERS = {
  antecedentes: '01 Antecedentes',
  originales: '02 Originales',
  trabajo: '03 Trabajo',
  cubicaciones: '04 Cubicaciones',
  presupuestos: '05 Presupuestos',
  informes: '06 Informes',
  entregables: '07 Entregables',
};
const WRITABLE = [FOLDERS.trabajo, FOLDERS.cubicaciones, FOLDERS.presupuestos, FOLDERS.informes, FOLDERS.entregables];
const WIN_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

export function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function validateRelative(rel) {
  if (typeof rel !== 'string' || rel.length === 0) throw new SecurityError('RUTA_INVALIDA', 'Falta el nombre del archivo.');
  if (rel.length > 400) throw new SecurityError('RUTA_INVALIDA', 'La ruta es demasiado larga.');
  if (rel.includes('\0')) throw new SecurityError('RUTA_INVALIDA', 'La ruta contiene caracteres no permitidos.');
  if (/^[a-zA-Z]:/.test(rel) || rel.startsWith('/') || rel.startsWith('\\') || rel.startsWith('//')) {
    throw new SecurityError('RUTA_FUERA_DEL_PROYECTO', 'Solo se permiten archivos dentro del proyecto seleccionado.');
  }
  const parts = rel.split(/[\\/]+/).filter(Boolean);
  for (const p of parts) {
    if (p === '..') throw new SecurityError('RUTA_FUERA_DEL_PROYECTO', 'No se permite salir de la carpeta del proyecto.');
    if (p.includes(':')) throw new SecurityError('RUTA_INVALIDA', 'La ruta contiene ":" (no permitido, incluye flujos alternos de Windows).');
    if (WIN_RESERVED.test(p)) throw new SecurityError('RUTA_INVALIDA', `Nombre reservado de Windows: ${p}.`);
    if (/[<>"|?*]/.test(p)) throw new SecurityError('RUTA_INVALIDA', 'La ruta contiene caracteres no permitidos.');
    if (/[. ]$/.test(p)) throw new SecurityError('RUTA_INVALIDA', 'Los nombres no pueden terminar en punto o espacio.');
  }
  return parts;
}

function realpathDeepest(p) {
  // realpath del ancestro existente más profundo + resto no existente
  let cur = path.resolve(p);
  const tail = [];
  for (;;) {
    try { const real = fs.realpathSync.native(cur); return path.join(real, ...tail.reverse()); }
    catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
      const parent = path.dirname(cur);
      if (parent === cur) throw e;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

export class Sandbox {
  constructor(home) {
    if (!home) throw new SecurityError('CONFIG', 'Carpeta Tannia no configurada.');
    this.home = path.resolve(home);
    this.proyectos = path.join(this.home, 'Proyectos');
  }

  ensureHome() { fs.mkdirSync(this.proyectos, { recursive: true }); }

  projectName(name) {
    if (typeof name !== 'string' || !name.trim()) throw new SecurityError('PROYECTO_INVALIDO', 'Falta el nombre del proyecto.');
    const n = name.trim();
    if (n.length > 80 || /[\\/:*?"<>|\0]/.test(n) || n === '.' || n === '..' || /[. ]$/.test(n) || WIN_RESERVED.test(n)) {
      throw new SecurityError('PROYECTO_INVALIDO', 'Nombre de proyecto no válido (sin / \\ : * ? " < > |).');
    }
    return n;
  }

  projectRoot(name) {
    const n = this.projectName(name);
    const root = path.join(this.proyectos, n);
    if (!fs.existsSync(root)) throw new SecurityError('PROYECTO_NO_EXISTE', `El proyecto "${n}" no existe.`);
    if (!fs.existsSync(path.join(root, '.tannia', 'project.json'))) {
      throw new SecurityError('PROYECTO_NO_AUTORIZADO', `La carpeta "${n}" no es un proyecto de Tannia Workspace.`);
    }
    const real = fs.realpathSync.native(root);
    if (!isInside(fs.realpathSync.native(this.proyectos), real)) {
      throw new SecurityError('RUTA_FUERA_DEL_PROYECTO', 'El proyecto apunta fuera de la carpeta autorizada (enlace/unión).');
    }
    return real;
  }

  /** Resuelve y valida una ruta relativa dentro del proyecto. Devuelve ruta real absoluta. */
  resolve(project, rel, { mustExist = true } = {}) {
    const root = this.projectRoot(project);
    const parts = validateRelative(rel);
    const target = path.join(root, ...parts);
    if (!isInside(root, target)) throw new SecurityError('RUTA_FUERA_DEL_PROYECTO', 'La ruta sale del proyecto.');
    const real = realpathDeepest(target);
    if (!isInside(root, real)) throw new SecurityError('RUTA_FUERA_DEL_PROYECTO', 'La ruta apunta fuera del proyecto mediante un enlace simbólico o unión.');
    if (mustExist && !fs.existsSync(real)) throw new SecurityError('ARCHIVO_NO_EXISTE', `No existe el archivo "${rel}" en el proyecto.`);
    return { root, abs: real, relParts: path.relative(root, real).split(path.sep) };
  }

  isOriginal(root, abs) {
    return isInside(path.join(root, FOLDERS.originales), abs);
  }

  /** Ruta autorizada para ESCRIBIR: nunca en 02 Originales ni en 01 Antecedentes ni fuera de carpetas de trabajo. */
  resolveWritable(project, rel) {
    const r = this.resolve(project, rel, { mustExist: false });
    const top = r.relParts[0];
    if (this.isOriginal(r.root, r.abs)) throw new SecurityError('ORIGINAL_PROTEGIDO', 'Los originales no se pueden modificar. Trabaje sobre una copia en "03 Trabajo".');
    if (!WRITABLE.includes(top)) throw new SecurityError('ESCRITURA_NO_PERMITIDA', `Solo se puede escribir en: ${WRITABLE.join(', ')}.`);
    return r;
  }
}

export function sha256File(file) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(1 << 20);
    for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) h.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}
