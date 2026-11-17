// Genera evidencia de cierre en docs/release-candidate/evidence/cierre/: Excel y PDF de UNA revisión, manifiesto exportado,
// recálculo real del Excel (LibreOffice, sin caché) y huellas. La aprobación la responde un CLIENTE DE PRUEBA: queda rotulada
// como SIMULADA y no es evidencia de aceptación humana.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { recalcular } from './lib/recalcular_xlsx.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'release-candidate', 'evidence', 'cierre'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'evidencia cierre ñ '));
const vistos = [];
const c = new Client({ name: 'evidencia', version: '1' }, { capabilities: { elicitation: {} } });
c.setRequestHandler(ElicitRequestSchema, async (r) => { vistos.push(r.params.message); return { action: 'accept', content: { aprobar: true, nombre: 'CLIENTE DE PRUEBA (simulado)' } }; });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'src', 'main.js')], env: { ...process.env, TANNIA_HOME: home, TANNIA_SIN_DIALOGO: '1' }, stderr: 'pipe' }));
const T = async (n, a) => { const r = await c.callTool({ name: n, arguments: a }); if (r.isError) throw new Error(`${n}: ${r.content[0].text}`); return r.structuredContent; };
const P = 'Evidencia Cierre'; const p = { proyecto: P };
try {
  await T('tannia_proyecto_crear', { nombre: P });
  fs.copyFileSync(path.join(root, 'fixtures', 'dxf', 'simple_m.dxf'), path.join(home, 'Proyectos', P, '02 Originales', 'planta.dxf'));
  await T('tannia_originales_registrar', p); await T('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
  await T('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: { tramos: [{ longitud_m: 5, origen: 'declarado_usuaria' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ descripcion: 'puerta', ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } }, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A1' } });
  await T('tannia_apu_definir', { ...p, codigo: 'A1', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: 8000, fuente_precio: 'fuente declarada en prueba', fecha_precio: '2026-11-17' }] });
  await T('tannia_presupuesto_config', { ...p, gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 });
  await T('tannia_partida_verificar', { ...p, codigo: 'M1' });
  await T('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
  await T('tannia_presupuesto_generar', p); await T('tannia_informe_generar', p);
  await T('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }); const ap = await T('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
  const ex = await T('tannia_entregable_exportar', p);
  const dir = path.join(home, 'Proyectos', P, ex.carpeta);
  for (const n of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, n), path.join(out, n));
  const xlsx = fs.readdirSync(out).find((n) => n.endsWith('.xlsx'));
  const rc = await recalcular(path.join(out, xlsx));
  const man = JSON.parse(fs.readFileSync(path.join(out, 'manifiesto-entrega.json'), 'utf8'));
  const coherencia = man.archivos.map((a) => ({ archivo: path.basename(a.rel), sha256_manifiesto: a.sha256, sha256_archivo: sha(path.join(out, path.basename(a.rel))), bytes_manifiesto: a.bytes, bytes_archivo: fs.statSync(path.join(out, path.basename(a.rel))).size }));
  fs.writeFileSync(path.join(out, 'ventanas-mostradas.txt'), vistos.map((v, i) => `--- Ventana ${i + 1} (respondida por CLIENTE DE PRUEBA, no por una persona) ---\n${v}\n`).join('\n'));
  fs.writeFileSync(path.join(out, 'evidencia.json'), `${JSON.stringify({ advertencia: 'Aprobación y verificación SIMULADAS por el cliente de prueba. No son evidencia de aceptación humana.', revision: ap.revision, recibo: ap.recibo, recalculo: rc ?? 'PENDIENTE: sin motor de recálculo', esperado: { 'Costo directo': 80000, 'Gastos generales': 8000, Utilidades: 4000, Neto: 92000, IVA: 17480, TOTAL: 109480 }, recalculo_coincide: rc ? ['Costo directo', 'Gastos generales', 'Utilidades', 'Neto', 'IVA', 'TOTAL'].every((k) => rc.filas[k] === { 'Costo directo': 80000, 'Gastos generales': 8000, Utilidades: 4000, Neto: 92000, IVA: 17480, TOTAL: 109480 }[k]) : null, coherencia_manifiesto: coherencia, total_manifiesto: man.resumen.total }, null, 2)}\n`);
  console.log(JSON.stringify({ revision: ap.revision, recalculo: rc?.filas, coherencia }, null, 1));
} finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
