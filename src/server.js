import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import os from 'node:os';
import fs from 'node:fs';
import { NAME, VERSION } from './version.js';
import { Sandbox } from './security/sandbox.js';
import { ok, guard } from './mcp/util.js';
import { createProject, listProjects } from './project/projects.js';
import { readDxfFile, summarize } from './dxf/inspect.js';

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createServer({ home, log = () => {} }) {
  const sandbox = new Sandbox(home);
  const server = new McpServer({ name: NAME, version: VERSION });
  const g = (fn) => guard(fn, log);

  server.registerTool('tannia_diagnostico', {
    title: 'Diagnóstico de Tannia Workspace',
    description: 'Verifica que Tannia Workspace funciona: versión, carpeta de proyectos y permisos. Úselo si algo falla.',
    inputSchema: {}, annotations: RO,
  }, g(async () => {
    sandbox.ensureHome();
    let escritura = true;
    try { const t = `${sandbox.home}/.tannia-escritura-prueba`; fs.writeFileSync(t, 'x'); fs.unlinkSync(t); } catch { escritura = false; }
    const data = {
      version: VERSION, sistema: `${os.platform()} ${os.release()} (${os.arch()})`, node: process.version,
      carpeta_tannia: sandbox.home, carpeta_escribible: escritura, proyectos: listProjects(sandbox).length,
      privacidad: 'Los archivos se procesan localmente, pero lo que Claude lee de ellos pasa al servicio de Claude.',
    };
    return ok(escritura ? 'Todo en orden.' : 'PROBLEMA: no se puede escribir en la carpeta de Tannia Workspace.', data);
  }));

  server.registerTool('tannia_listar_proyectos', {
    title: 'Listar proyectos', description: 'Muestra los proyectos de Tannia Workspace disponibles.',
    inputSchema: {}, annotations: RO,
  }, g(async () => {
    const p = listProjects(sandbox);
    return ok(p.length ? `Hay ${p.length} proyecto(s).` : 'Aún no hay proyectos. Cree uno con tannia_proyecto_crear.', { proyectos: p.map((x) => ({ nombre: x.nombre, estado: x.estado })) });
  }));

  server.registerTool('tannia_proyecto_crear', {
    title: 'Crear proyecto', description: 'Crea un proyecto con la estructura estándar de carpetas (originales protegidos en "02 Originales").',
    inputSchema: { nombre: z.string().min(1).max(80).describe('Nombre del proyecto') },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, g(async ({ nombre }) => {
    const r = createProject(sandbox, nombre);
    return ok(`Proyecto "${r.nombre}" creado. Copie sus planos originales a "02 Originales".`, r);
  }));

  server.registerTool('tannia_dxf_inspeccionar', {
    title: 'Inspeccionar DXF (solo lectura)',
    description: 'Lee un archivo DXF del proyecto y resume capas, tipos de entidad y unidades declaradas. No modifica nada.',
    inputSchema: {
      proyecto: z.string().describe('Nombre del proyecto'),
      archivo: z.string().describe('Ruta relativa dentro del proyecto, ej. "02 Originales/plano.dxf"'),
    }, annotations: RO,
  }, g(async ({ proyecto, archivo }) => {
    const { abs } = sandbox.resolve(proyecto, archivo);
    const dxf = readDxfFile(abs);
    return ok(`DXF leído: ${Object.values(summarize(dxf).entidades_por_tipo).reduce((a, b) => a + b, 0)} entidades.`, summarize(dxf));
  }));

  return { server, sandbox };
}
