import os from 'node:os';
import path from 'node:path';

export function defaultHome() {
  return path.join(os.homedir(), 'Documents', 'Tannia Workspace');
}

export function resolveHome(env = process.env) {
  const v = env.TANNIA_HOME;
  // Claude Desktop sustituye ${user_config.*}; si quedó sin sustituir, usar el valor por defecto.
  if (!v || v.includes('${')) return defaultHome();
  return path.resolve(v);
}
