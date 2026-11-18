// Identidad del PAQUETE instalado, separada de la versión del servidor y del motor (F08). Se lee el manifest.json que acompaña al bundle
// (<extensión>/manifest.json, con el servidor en <extensión>/server/index.js). Ejecutando desde el código fuente no hay paquete.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_MANIFEST = 256 * 1024;
export function identidadPaquete(entrada = process.argv[1]) {
  try {
    if (!entrada) return { origen: 'no_disponible', motivo: 'sin ruta de entrada' };
    const f = path.resolve(path.dirname(entrada), '..', 'manifest.json');
    if (!fs.existsSync(f)) return { origen: 'no_disponible', motivo: 'ejecución desde el código fuente (sin manifest.json junto al servidor)' };
    if (fs.statSync(f).size > MAX_MANIFEST) return { origen: 'no_disponible', motivo: 'manifest.json demasiado grande' };
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (typeof m?.name !== 'string' || typeof m?.version !== 'string') return { origen: 'no_disponible', motivo: 'manifest.json sin name/version' };
    // R-03: qué bytes exactos se están ejecutando: commit de compilación y huella SHA-256 del servidor instalado.
    let compilacion = { origen: 'no_disponible' };
    try { const c = JSON.parse(fs.readFileSync(path.join(path.dirname(entrada), 'compilacion.json'), 'utf8')); compilacion = { origen: 'compilacion.json', version: String(c.version).slice(0, 40), commit: String(c.commit).slice(0, 64), arbol_limpio: c.arbol_limpio === true }; } catch { /* paquete antiguo sin compilacion.json */ }
    let huella = null; try { huella = crypto.createHash('sha256').update(fs.readFileSync(entrada)).digest('hex'); } catch { /* no legible */ }
    return { origen: 'manifest.json', id: m.name.slice(0, 80), version: m.version.slice(0, 80), nombre_visible: String(m.display_name ?? m.name).slice(0, 120), compilacion, huella_servidor_sha256: huella };
  } catch (e) { return { origen: 'no_disponible', motivo: `no se pudo leer manifest.json: ${String(e.message).slice(0, 80)}` }; }
}
