// Regenera los ejemplos de TW-11 (datos SINTÉTICOS) en examples/tw11/. Uso: node scripts/ejemplos-tw11.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpHome, startClient, call, data } from '../test/helpers.js';
import { correrTunel } from '../test/fixtures_tw11/escenario_tunel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const OUT = path.join(ROOT, 'examples', 'tw11', 'gv1_tunel');
const home = tmpHome('tw11-ejemplos '); const { client: c, close } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Obra Civil II';
try {
  await call(c, 'tannia_proyecto_crear', { nombre: P }); const r = await correrTunel(c, home, P);
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const art = path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', r.N, 'artefactos'); for (const f of fs.readdirSync(art)) fs.copyFileSync(path.join(art, f), path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, 'LEEME.md'), '# GV1 — Túnel académico (datos SINTÉTICOS)\n\nSalida real de `scripts/ejemplos-tw11.mjs`. Ejercicio académico: **no es ingeniería validada**, no está revisada por un profesional ni verificada en AutoCAD real.\nArchivos: DXF (planta, perfil y 3 secciones), memoria (MD/PDF) y planilla de cantidades (XLSX), todos generados desde claims verificables.\nLos resultados geotécnicos, de sostenimiento y estructurales quedan como **brechas** en la memoria.\n');
  console.log('ejemplos escritos en', OUT, fs.readdirSync(OUT));
} finally { await close(); }
