// Persistencia de proyecto: escritura atómica con respaldo, máquina de estados y verificación de originales.
import fs from 'node:fs';
import path from 'node:path';
import { FOLDERS, sha256File } from '../security/sandbox.js';
import { UserError } from '../mcp/util.js';

export const ESTADOS = ['nuevo', 'analisis', 'borrador', 'revision', 'aprobado', 'entregable'];

export function atomicWriteJson(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

/** Lee JSON; si está dañado recupera el respaldo .bak; si no hay, devuelve `def`. */
export function readJson(file, def) {
  const tryRead = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!fs.existsSync(file)) return def;
  try { return tryRead(file); } catch {
    if (fs.existsSync(`${file}.bak`)) {
      try { const v = tryRead(`${file}.bak`); atomicWriteJson(file, v); return v; } catch { /* sigue */ }
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
  meta() { return readJson(this.p('.tannia', 'project.json'), null); }
  saveMeta(m) { atomicWriteJson(this.p('.tannia', 'project.json'), m); }
  partidas() { return readJson(this.p(FOLDERS.cubicaciones, 'partidas.json'), []); }
  savePartidas(x, { revisar = false } = {}) { atomicWriteJson(this.p(FOLDERS.cubicaciones, 'partidas.json'), x); if (!revisar) this.invalidateApproval('Se modificaron las partidas.'); }
  apus() { return readJson(this.p(FOLDERS.presupuestos, 'apus.json'), []); }
  saveApus(x) { atomicWriteJson(this.p(FOLDERS.presupuestos, 'apus.json'), x); this.invalidateApproval('Se modificaron los APU.'); }
  config() { return readJson(this.p(FOLDERS.presupuestos, 'config.json'), { gastos_generales_pct: 0, utilidades_pct: 0, iva_pct: 19 }); }
  saveConfig(x) { atomicWriteJson(this.p(FOLDERS.presupuestos, 'config.json'), x); this.invalidateApproval('Se modificó la configuración del presupuesto.'); }
  calibraciones() { return readJson(this.p('.tannia', 'calibraciones.json'), []); }
  saveCalibraciones(x) { atomicWriteJson(this.p('.tannia', 'calibraciones.json'), x); }
  originales() { return readJson(this.p('.tannia', 'originales.json'), {}); }

  /** Reparación segura: recrea carpetas faltantes y valida/recupera los JSON internos. No toca originales. */
  repair() {
    const acciones = [];
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
    const integ = this.verifyOriginals();
    if (!integ.ok) problemas.push(`Originales alterados: ${integ.problemas.map((x) => `${x.archivo} (${x.problema})`).join(', ')}`);
    this.audit('reparacion', { acciones: acciones.length, problemas: problemas.length });
    return { acciones, problemas, originales_ok: integ.ok };
  }

  audit(evento, datos = {}) {
    fs.appendFileSync(this.p('.tannia', 'auditoria.jsonl'), `${JSON.stringify({ t: new Date().toISOString(), evento, ...datos })}\n`);
  }

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

  /** Registra originales (hash + solo lectura). Idempotente; no re-registra archivos ya registrados con otro hash. */
  registerOriginals() {
    const dir = this.p(FOLDERS.originales);
    const man = this.originales();
    const nuevos = []; const cambiados = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isSymbolicLink()) continue; // enlaces se ignoran por seguridad
        if (e.isDirectory()) walk(full);
        else {
          const rel = path.relative(this.root, full).split(path.sep).join('/');
          const sha = sha256File(full);
          if (!man[rel]) { man[rel] = { sha256: sha, bytes: fs.statSync(full).size, registrado: new Date().toISOString() }; nuevos.push(rel); try { fs.chmodSync(full, 0o444); } catch { /* Windows */ } }
          else if (man[rel].sha256 !== sha) cambiados.push(rel);
        }
      }
    };
    walk(dir);
    atomicWriteJson(this.p('.tannia', 'originales.json'), man);
    this.audit('originales_registrados', { nuevos: nuevos.length, cambiados: cambiados.length });
    return { nuevos, cambiados, total: Object.keys(man).length };
  }

  verifyOriginals() {
    const man = this.originales();
    const problemas = [];
    for (const [rel, info] of Object.entries(man)) {
      const full = this.p(...rel.split('/'));
      if (!fs.existsSync(full)) problemas.push({ archivo: rel, problema: 'faltante' });
      else if (sha256File(full) !== info.sha256) problemas.push({ archivo: rel, problema: 'modificado' });
    }
    return { ok: problemas.length === 0, verificados: Object.keys(man).length, problemas };
  }

  /** Copia un original (o antecedente) a 03 Trabajo comprobando el hash; nunca devuelve ruta del original para escritura. */
  copyToWork(rel) {
    const { abs, root } = this.sandbox.resolve(this.name, rel);
    const st = fs.statSync(abs);
    if (!st.isFile()) throw new UserError('NO_ES_ARCHIVO', 'La ruta indicada no es un archivo.');
    const base = path.basename(abs); const ext = path.extname(base);
    let dest = path.join(root, FOLDERS.trabajo, `${path.basename(base, ext)} - copia de trabajo${ext}`);
    for (let i = 2; fs.existsSync(dest); i++) dest = path.join(root, FOLDERS.trabajo, `${path.basename(base, ext)} - copia de trabajo ${i}${ext}`);
    fs.copyFileSync(abs, dest, fs.constants.COPYFILE_EXCL);
    const a = sha256File(abs); const b = sha256File(dest);
    if (a !== b) { fs.unlinkSync(dest); throw new UserError('COPIA_CORRUPTA', 'La copia no coincide con el original; se descartó.'); }
    try { fs.chmodSync(dest, 0o644); } catch { /* */ }
    this.audit('copia_trabajo', { origen: path.relative(root, abs), destino: path.relative(root, dest) });
    return { copia: path.relative(root, dest).split(path.sep).join('/'), sha256: a };
  }
}
