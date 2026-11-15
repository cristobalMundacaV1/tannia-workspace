// Caso demostrable: Tannia pide una casa y la refina por conversación. Ejecuta el flujo MCP real (en memoria) y deja los
// archivos en examples/anteproyecto-casa-80/ (DXF, SVG y, si hay Chromium, PNG). Datos 100 % ficticios.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createServer } = await import(pathToFileURL(path.join(root, 'src', 'server.js')).href);
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tannia-demo-'));
const { server } = createServer({ home });
const [a, b] = InMemoryTransport.createLinkedPair(); const c = new Client({ name: 'demo', version: '1' });
await Promise.all([server.connect(a), c.connect(b)]);
const T = async (name, args) => { const r = await c.callTool({ name, arguments: args }); if (r.isError) throw new Error(`${name}: ${r.content[0].text}`); return r; };
const P = 'Casa demo'; const N = 'Casa 80';
await T('tannia_proyecto_crear', { nombre: P });

const guion = [];
const paso = async (tannia, nombre, args) => { const r = await T(nombre, { proyecto: P, ...args }); guion.push({ tannia, herramienta: nombre, respuesta: r.content[0].text.split('\n').slice(0, 60).join('\n'), datos: r.structuredContent }); return r; };

await paso('«Diseña una propuesta de casa de un piso de aproximadamente 80 m², tres dormitorios, dos baños, living-comedor y cocina americana».', 'tannia_diseno_crear', { nombre: N, solicitud: 'Diseña una propuesta de casa de un piso de aproximadamente 80 m², tres dormitorios, dos baños, living-comedor y cocina americana', programa: { superficie_objetivo_m2: 80, dormitorios: 3, banos: 2, cocina: 'americana' } });
await paso('«El dormitorio 2 me queda chico, hazlo más ancho, unos 3 metros».', 'tannia_diseno_modificar', { nombre: N, descripcion: 'Dormitorio 2 más ancho (~3 m)', operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 3000 }] });
await paso('«Agrégale una ventana por el lado oeste al dormitorio principal y llama escritorio al dormitorio 3».', 'tannia_diseno_modificar', { nombre: N, descripcion: 'Ventana oeste en dormitorio principal; dormitorio 3 → escritorio', operaciones: [{ operacion: 'agregar_abertura', tipo: 'ventana', recinto: 'R-DP', lado: 'O' }, { operacion: 'renombrar', recinto: 'R-D3', nombre: 'escritorio' }] });
await paso('«Quiero un walk-in closet en el dormitorio principal, de 1,2 m de fondo, hacia el norte».', 'tannia_diseno_modificar', { nombre: N, descripcion: 'Walk-in closet en el dormitorio principal', operaciones: [{ operacion: 'dividir_recinto', recinto: 'R-DP', nuevo: { id: 'R-WIC', nombre: 'walk-in closet', tipo: 'closet' }, eje: 'profundidad', tamano_nuevo_mm: 1200, lado_nuevo: 'N' }] });
await paso('«Mmm, no me convence el closet. Vuelve atrás un paso».', 'tannia_diseno_historial', { nombre: N, accion: 'deshacer' });
await paso('«Cambiemos a hormigón armado».', 'tannia_diseno_modificar', { nombre: N, descripcion: 'Sistema constructivo: hormigón armado', operaciones: [{ operacion: 'sistema_constructivo', sistema: 'hormigon_armado' }] });
await paso('«¿Qué debo revisar sobre el diseño sísmico?»', 'tannia_conocimiento_consultar', { consulta: 'sistema sísmico muros hormigón', sistema_constructivo: 'hormigon_armado' });
await paso('«Dame las cantidades con muros de 2,4 m».', 'tannia_diseno_cubicar', { nombre: N, altura_muros_m: 2.4 });
await paso('«Muéstrame la lista de versiones».', 'tannia_diseno_historial', { nombre: N, accion: 'listar' });

const origen = path.join(home, 'Proyectos', P, '03 Trabajo', 'Anteproyectos', N);
const out = path.join(root, 'examples', 'anteproyecto-casa-80'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(origen)) if (/\.(dxf|svg|json)$/.test(f) && !f.endsWith('.bak')) fs.copyFileSync(path.join(origen, f), path.join(out, f));
// PNG (opcional: requiere Playwright/Chromium)
try {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const br = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  for (const f of fs.readdirSync(out).filter((x) => x.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(out, f), 'utf8'); const m = svg.match(/width="(\d+)" height="(\d+)"/);
    const pg = await br.newPage({ viewport: { width: +m[1], height: +m[2] } }); await pg.setContent(`<html><body style="margin:0">${svg}</body></html>`); await pg.screenshot({ path: path.join(out, f.replace('.svg', '.png')), timeout: 60000 }); await pg.close();
  }
  await br.close();
} catch (e) { console.log('PNG omitido:', String(e.message).split('\n')[0]); }
const md = ['# Caso demostrable — "Diseña una casa de ~80 m²"', '', '> Datos ficticios. ANTEPROYECTO: no apto para construcción. Generado por `scripts/demo-anteproyecto.mjs` ejecutando las herramientas MCP reales.', '',
  ...guion.flatMap((g, i) => [`## ${i + 1}. Tannia: ${g.tannia}`, '', `Herramienta: \`${g.herramienta}\``, '', '```', g.respuesta, '```', ''])].join('\n');
fs.writeFileSync(path.join(out, 'CONVERSACION.md'), md);
await c.close(); fs.rmSync(home, { recursive: true, force: true });
console.log('demo OK ->', out, fs.readdirSync(out).join(', '));
