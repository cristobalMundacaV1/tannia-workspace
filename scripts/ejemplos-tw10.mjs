// Genera ejemplos reproducibles de resultados TW-10 (proyecto descartable) en examples/tw10/: hoja comparativa, sombras, DXF/SVG de la L e informe.
// Uso: node scripts/ejemplos-tw10.mjs  (usa el servidor por MCP, como el agente). Datos de terreno/clima SINTÉTICOS.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js'; import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const out = path.join(raiz, 'examples', 'tw10');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tannia ejemplos '));
const t = new StdioClientTransport({ command: process.execPath, args: [path.join(raiz, 'src', 'main.js')], env: { ...process.env, TANNIA_HOME: home }, stderr: 'pipe' }); const c = new Client({ name: 'ejemplos', version: '1' }); await c.connect(t);
const call = async (n, a) => { const r = await c.callTool({ name: n, arguments: a }); if (r.isError) throw new Error(`${n}: ${JSON.stringify(r.content)}`); return r.structuredContent; };
const P = 'Ejemplo TW10'; const E = 'Estudio ejemplo';
await call('tannia_proyecto_crear', { nombre: P });
await call('tannia_arq_encargo', { proyecto: P, estudio: E, texto: 'Casa de 90 m2, 3 dormitorios, 2 baños, un piso, en L. Quiero ver la piscina desde la cocina porque mis hijos juegan ahí. Living con mucha luz y fresco en verano con aleros. Pocos pasillos, quiero ahorrar.' });
const sinTerreno = await call('tannia_arq_generar_alternativas', { proyecto: P, estudio: E });
await call('tannia_arq_sitio', { proyecto: P, estudio: E, predio_ancho_mm: 16000, predio_fondo_mm: 30000, acceso_lado: 'S', latitud: -33.45, longitud: -70.67, zona_horaria: 'America/Santiago', norte_grados: 0, norte_confirmado: true });
const conTerreno = await call('tannia_arq_generar_alternativas', { proyecto: P, estudio: E });
await call('tannia_arq_refinar', { proyecto: P, estudio: E, operacion: 'seleccionar', alternativa: 'alt-L_con_patio' });
const pub = await call('tannia_arq_publicar', { proyecto: P, estudio: E });
const ev = await call('tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio' });
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const dir = path.join(home, 'Proyectos', P, '03 Trabajo', 'Arquitectura', E);
for (const f of fs.readdirSync(dir)) if (/(comparacion|sombras-invierno|p001)\.(svg|dxf)$|p001-informe\.json$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join(out, f.replace(/^v\d+-/, (m) => `${m}`)));
fs.writeFileSync(path.join(out, 'evaluacion-alt-L_con_patio.json'), JSON.stringify(ev, null, 2));
fs.writeFileSync(path.join(out, 'LEEME.md'), `# Ejemplos TW-10 (sintéticos)\nGenerados con \`node scripts/ejemplos-tw10.mjs\` sobre un proyecto descartable. Terreno 16×30 m, norte arriba, Santiago: **datos de ejemplo, no de una usuaria**.\n- \`*-comparacion.svg\`: hoja comparativa (con terreno).\n- \`*-sombras-invierno.svg\`: sombras del 21 de junio (sol directo geométrico).\n- \`*-p001.dxf/.svg\`: plano publicado de la alternativa en L; \`*-p001-informe.json\`: hashes, alertas y avisos.\n- \`evaluacion-alt-L_con_patio.json\`: análisis (estado global: ${ev.analisis.global_state}).\nSin terreno: ${sinTerreno.alternativas.length} alternativas conceptuales, sol \`blocked\`. Con terreno: ${conTerreno.alternativas.length}. **ANTEPROYECTO — no apto para construcción; no verificado en AutoCAD real.** Publicación: ${pub.publicacion}.\n`);
await c.close(); console.log('ejemplos en', out, fs.readdirSync(out));
