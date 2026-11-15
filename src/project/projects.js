import fs from 'node:fs';
import path from 'node:path';
import { FOLDERS } from '../security/sandbox.js';
import { UserError } from '../mcp/util.js';
import { VERSION } from '../version.js';

export function createProject(sandbox, name, meta = {}) {
  const n = sandbox.projectName(name);
  sandbox.ensureHome();
  const root = path.join(sandbox.proyectos, n);
  if (fs.existsSync(root)) throw new UserError('PROYECTO_EXISTE', `Ya existe un proyecto llamado "${n}".`, 'Elija otro nombre o abra el existente.');
  fs.mkdirSync(root);
  for (const f of Object.values(FOLDERS)) fs.mkdirSync(path.join(root, f));
  fs.mkdirSync(path.join(root, '.tannia'));
  const now = new Date().toISOString();
  const project = { nombre: n, creado: now, version_app: VERSION, estado: 'nuevo', historial: [{ estado: 'nuevo', fecha: now }], ...meta };
  fs.writeFileSync(path.join(root, '.tannia', 'project.json'), JSON.stringify(project, null, 2));
  return { nombre: n, carpetas: Object.values(FOLDERS), ruta_local: root };
}

export function listProjects(sandbox) {
  if (!fs.existsSync(sandbox.proyectos)) return [];
  return fs.readdirSync(sandbox.proyectos, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(sandbox.proyectos, d.name, '.tannia', 'project.json')))
    .map((d) => {
      try { return JSON.parse(fs.readFileSync(path.join(sandbox.proyectos, d.name, '.tannia', 'project.json'), 'utf8')); }
      catch { return { nombre: d.name, estado: 'ilegible' }; }
    });
}
