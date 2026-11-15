import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function defaultHome() {
  return path.join(os.homedir(), 'Documents', 'Tannia Workspace');
}

/**
 * Resuelve la carpeta de Tannia Workspace y explica de dónde salió (para el diagnóstico).
 * TANNIA_HOME lo fija Claude Desktop al INICIAR el servidor: si se cambia en la configuración de la extensión,
 * el servidor debe reiniciarse (desactivar/activar la extensión) para verlo; `tannia_diagnostico` muestra el valor vigente.
 */
export function describeHome(env = process.env) {
  const v = env.TANNIA_HOME;
  const adv = [];
  let home; let origen;
  if (!v || !v.trim()) { home = defaultHome(); origen = 'predeterminada'; }
  else if (v.includes('${')) { home = defaultHome(); origen = 'predeterminada'; adv.push('La configuración de la extensión llegó sin resolver ("${...}"); se usa la carpeta predeterminada.'); }
  else if (!(path.win32.isAbsolute(v) || path.isAbsolute(v))) { home = defaultHome(); origen = 'predeterminada'; adv.push('La carpeta configurada no es una ruta absoluta; se ignoró y se usa la predeterminada.'); }
  else { home = path.resolve(v); origen = 'configuracion_de_la_extension'; }
  const nombre = path.basename(home);
  if (/^['"`]|['"`]$/.test(nombre)) adv.push(`El nombre de la carpeta comienza o termina con una comilla/apóstrofo ("${nombre}"). Si no fue intencional, corríjalo en Configuración → Extensiones → Tannia Workspace y reinicie la extensión.`);
  if (/\s$/.test(nombre)) adv.push('El nombre de la carpeta termina en espacio.');
  try {
    const hermana = path.join(path.dirname(home), 'Tannia Workspace');
    if (path.resolve(hermana).toLowerCase() !== home.toLowerCase() && fs.existsSync(path.join(hermana, 'Proyectos'))) adv.push('Existe otra carpeta "Tannia Workspace" con proyectos junto a la configurada: verifique que esta es la que quiere usar.');
  } catch { /* informativo */ }
  return { home, origen, advertencias: adv };
}

export function resolveHome(env = process.env) { return describeHome(env).home; }
