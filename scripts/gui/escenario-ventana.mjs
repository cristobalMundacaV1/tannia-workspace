// Escenario para la prueba de INTERFAZ REAL (Windows UI Automation): servidor MCP real, proyecto temporal aislado y ventana
// WPF real abierta por tannia_partida_verificar. El driver (tools/gui/prueba_ventana_wpf.py) interactúa con la ventana; este
// proceso registra qué devolvió la herramienta y el estado PERSISTIDO después.
//   node scripts/gui/escenario-ventana.mjs <escenario> <salida.json> [--escala 1.25] [--timeout 6] [--politica descontar_todos]
// Las confirmaciones hechas por el driver son SIMULADAS: no son aceptación humana.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [escenario, salida] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const politica = arg('politica', 'descontar_todos');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'GUI Tannia ñ '));
const env = { ...process.env, TANNIA_HOME: home }; delete env.CI; delete env.TANNIA_SIN_DIALOGO; delete env.GITHUB_ACTIONS;
if (arg('escala')) env.TANNIA_GUI_PRUEBA_ESCALA = arg('escala');
if (arg('timeout')) env.TANNIA_GUI_PRUEBA_TIMEOUT_S = arg('timeout');
const c = new Client({ name: 'gui-sin-elicitacion', version: '1' }); // sin capacidad de elicitación: obliga a la ventana del SO
await c.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'src', 'main.js')], env, stderr: 'pipe' }));
const T = async (n, a) => { const r = await c.callTool({ name: n, arguments: a }); return { error: r.isError ? r.structuredContent : null, datos: r.isError ? null : r.structuredContent }; };
const p = { proyecto: 'GUI Prueba' };
const out = { escenario, politica, escala: arg('escala') || '1', etiqueta: 'AUTORIZACIONES SIMULADAS POR UI AUTOMATION — NO SON ACEPTACIÓN HUMANA' };
try {
  await T('tannia_proyecto_crear', { nombre: p.proyecto });
  const pol = politica === 'descontar_mayores_a' ? { tipo: politica, umbral_m2: 2.5, origen: 'decision_profesional' } : { tipo: politica, origen: 'decision_profesional' };
  const m = await T('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: { tramos: [{ longitud_m: 5, origen: 'declarado_usuaria' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ descripcion: 'puerta', ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: pol }, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A' } });
  out.cantidad = m.datos?.cantidad;
  fs.writeFileSync(`${salida}.listo`, 'abriendo ventana');
  const llamadas = escenario === 'concurrencia' ? [T('tannia_partida_verificar', { ...p, codigo: 'M1' }), new Promise((r) => setTimeout(r, 1500)).then(() => T('tannia_partida_verificar', { ...p, codigo: 'M1' }))] : [T('tannia_partida_verificar', { ...p, codigo: 'M1' })];
  const res = await Promise.all(llamadas);
  out.resultados = res.map((r) => (r.error ? { error: r.error.error, resultado_codigo: r.error.detalle?.resultado_codigo ?? null, ventana_mostrada: r.error.detalle?.ventana_mostrada ?? null, efecto: r.error.detalle?.efecto ?? null } : { ok: true, recibo: r.datos.recibo, canal: r.datos.canal }));
  out.verificada_persistida = (await T('tannia_partidas_listar', p)).datos.partidas[0].verificada;
  const rec = (await T('tannia_recibos_verificar', p)).datos;
  out.recibos_verificacion = rec.recibos.filter((r) => r.accion === 'verificar_partida').length;
  out.recibos_lineas_invalidas = rec.lineas_invalidas;
} catch (e) { out.excepcion = String(e?.message || e); } finally {
  await c.close(); fs.rmSync(home, { recursive: true, force: true });
  fs.writeFileSync(salida, JSON.stringify(out, null, 2));
}
