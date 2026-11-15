// Genera ejemplos de resultados con DATOS FICTICIOS (fixtures sintéticos, precios "TEST") ejecutando el flujo MCP real.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createServer } = await import(pathToFileURL(path.join(root, 'src', 'server.js')).href);
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tannia-ejemplo-'));
const { server } = createServer({ home });
const [a, b] = InMemoryTransport.createLinkedPair(); const c = new Client({ name: 'ejemplos', version: '1' });
await Promise.all([server.connect(a), c.connect(b)]);
const T = async (name, args) => { const r = await c.callTool({ name, arguments: args }); if (r.isError) throw new Error(`${name}: ${r.content[0].text}`); return r.structuredContent; };

await T('tannia_proyecto_crear', { nombre: 'Ejemplo ficticio' });
const base = path.join(home, 'Proyectos', 'Ejemplo ficticio');
fs.copyFileSync(path.join(root, 'fixtures', 'dxf', 'simple_m.dxf'), path.join(base, '02 Originales', 'plano_ejemplo.dxf'));
await T('tannia_originales_registrar', { proyecto: 'Ejemplo ficticio' });
const med = await T('tannia_dxf_medir', { proyecto: 'Ejemplo ficticio', archivo: '02 Originales/plano_ejemplo.dxf', unidad_confirmada: 'm', incluir_detalle: true });
await T('tannia_cubicar_dxf', { proyecto: 'Ejemplo ficticio', archivo: '02 Originales/plano_ejemplo.dxf', unidad_confirmada: 'm', codigo: '1', descripcion: 'Losa (espesor de EJEMPLO 0,10 m)', capas: ['LOSA'], regla: 'area_por_espesor', parametros: { espesor_m: 0.1 }, apu: 'A1' });
await T('tannia_apu_definir', { proyecto: 'Ejemplo ficticio', codigo: 'A1', descripcion: 'Losa — APU FICTICIO', unidad: 'm3', insumos: [
  { tipo: 'material', descripcion: 'Hormigón (precio ficticio)', unidad: 'm3', cantidad: 1.05, precio_unitario: 1000, fuente_precio: 'TEST-ficticio', fecha_precio: '2026-01-01' },
  { tipo: 'mano_obra', descripcion: 'Cuadrilla (precio ficticio)', unidad: 'jornada', rendimiento: 5, cuadrilla: 1, precio_unitario: 5000, fuente_precio: 'TEST-ficticio', fecha_precio: '2026-01-01' }] });
await T('tannia_presupuesto_config', { proyecto: 'Ejemplo ficticio', gastos_generales_pct: 10, utilidades_pct: 5 });
await T('tannia_presupuesto_generar', { proyecto: 'Ejemplo ficticio' });
await T('tannia_informe_generar', { proyecto: 'Ejemplo ficticio' });

const out = path.join(root, 'examples', 'ejemplo-ficticio'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const [dir, ext, name] of [['05 Presupuestos', '.xlsx', 'presupuesto_BORRADOR.xlsx'], ['06 Informes', '.pdf', 'memoria_BORRADOR.pdf']]) {
  const f = fs.readdirSync(path.join(base, dir)).find((x) => x.endsWith(ext)); fs.copyFileSync(path.join(base, dir, f), path.join(out, name));
}
fs.writeFileSync(path.join(out, 'mediciones_plano_ejemplo.json'), JSON.stringify({ ...med, mediciones: med.mediciones.slice(0, 12) }, null, 2));
fs.writeFileSync(path.join(out, 'LEEME.txt'), 'DATOS FICTICIOS. Plano sintético, espesor y precios de EJEMPLO ("TEST"): solo muestran el formato de los resultados.\nEstos archivos son BORRADOR: la cantidad no fue verificada por una persona, por eso el presupuesto no es final.\n');
await c.close(); fs.rmSync(home, { recursive: true, force: true });
console.log('ejemplos OK ->', out);
