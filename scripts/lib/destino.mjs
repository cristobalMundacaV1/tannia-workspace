// Plataforma DE DESTINO del paquete. Nunca se deduce de la plataforma que construye: se define por TANNIA_TARGET
// (ej. win32-x64) y, si falta, por la máquina que construye (solo para compilaciones locales).
export const DESTINOS = {
  'win32-x64': { platform: 'win32', native: '@napi-rs/canvas-win32-x64-msvc' },
  'linux-x64': { platform: 'linux', native: '@napi-rs/canvas-linux-x64-gnu' },
  'darwin-arm64': { platform: 'darwin', native: '@napi-rs/canvas-darwin-arm64' },
  'darwin-x64': { platform: 'darwin', native: '@napi-rs/canvas-darwin-x64' },
};
export function resolverDestino(env = process.env, host = { platform: process.platform, arch: process.arch }) {
  const target = (env.TANNIA_TARGET && String(env.TANNIA_TARGET).trim()) || `${host.platform}-${host.arch}`;
  const d = DESTINOS[target];
  if (!d) throw new Error(`TANNIA_TARGET no soportado: «${target}». Admitidos: ${Object.keys(DESTINOS).join(', ')}`);
  return { target, platforms: [d.platform], native: d.native, nativeDir: d.native.split('/')[1] };
}
