// Aceptación automatizada de cierre (cubicación manual, APU, presupuesto, verificación y entrega) — pasos 1–14 del encargo.
// La «persona» es el manejador de ventanas del cliente MCP de prueba: esto NO sustituye la comprobación humana de la
// ventana real en Claude Desktop/Windows, que queda pendiente de aceptación.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { call, data, tmpHome, ROOT, FIX } from './helpers.js';
import { recalcular, motorDisponible } from '../scripts/lib/recalcular_xlsx.mjs';
import { marcasNoFinales } from '../src/autoridad/entrega.js';

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const SI = { action: 'accept', content: { aprobar: true, nombre: 'Persona de prueba' } };
const ESPERADO = { 8000: { 'Costo directo': 80000, 'Gastos generales': 8000, Utilidades: 4000, Neto: 92000, IVA: 17480, TOTAL: 109480 }, 9000: { 'Costo directo': 90000, 'Gastos generales': 9000, Utilidades: 4500, Neto: 103500, IVA: 19665, TOTAL: 123165 } };
const MOTOR = motorDisponible();

test('aceptación de cierre: flujo completo M1 manual → APU → resultados de ventana → Excel recalculado → aprobación → exportación → cambios', { timeout: 600000 }, async (t) => {
  const home = tmpHome('Cierre ñ ');
  const cola = []; const vistos = [];
  const client = new Client({ name: 'aceptacion', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => { vistos.push(req.params.message); const r = cola.shift(); if (r === 'ERROR') throw new Error('fallo simulado del cliente'); return r ?? { action: 'cancel' }; });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'src', 'main.js')], env: { ...process.env, TANNIA_HOME: home, TANNIA_SIN_DIALOGO: '1' }, stderr: 'pipe' }));
  const OK = async (n, a) => { const r = await call(client, n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return data(r); };
  const E = async (n, a, code) => { const r = await call(client, n, a); assert.equal(r.isError, true, `${n} debía fallar: ${r.content?.[0]?.text}`); if (code) assert.equal(data(r).error, code, JSON.stringify(data(r)).slice(0, 400)); return data(r); };
  const P = 'Prueba Cierre'; const p = { proyecto: P }; const root = path.join(home, 'Proyectos', P);
  const verif = async () => (await OK('tannia_partidas_listar', p)).partidas.find((x) => x.codigo === 'M1').verificada;
  const recibos = async () => (await OK('tannia_recibos_verificar', p)).recibos;
  try {
    // 1–2. Proyecto, importación de DXF existente y ruta inexistente; registro y huella del original
    await OK('tannia_proyecto_crear', { nombre: P });
    const dxf = path.join(home, 'Planos de prueba ñ', 'planta.dxf'); fs.mkdirSync(path.dirname(dxf)); fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), dxf);
    const imp = await OK('tannia_proyecto_importar', { proyecto: P, archivos: [dxf], modo: 'original' }); assert.equal(imp.resumen.importados, 1);
    const malo = await call(client, 'tannia_proyecto_importar', { proyecto: P, archivos: [path.join(home, 'no existe', 'x.dxf')], modo: 'original' });
    assert.ok(malo.isError || data(malo).resumen.rechazados === 1, 'ruta inexistente: rechazada');
    await OK('tannia_originales_registrar', p); const io = await OK('tannia_originales_verificar', p); assert.equal(io.ok, true); assert.equal(io.verificados, 1);
    await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
    // 3–5. M1 manual 10 m² (puerta informada), A1 a $8.000, GG 10 / U 5 / IVA 19
    const m = await OK('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: { tramos: [{ longitud_m: 5, origen: 'declarado_usuaria' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ descripcion: 'puerta', ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } }, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A1' } });
    assert.ok(Math.abs(m.cantidad - 10) < 1e-12);
    const apu = (precio) => OK('tannia_apu_definir', { ...p, codigo: 'A1', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: precio, fuente_precio: 'fuente declarada en prueba', fecha_precio: '2026-11-17' }] });
    await apu(8000); await OK('tannia_presupuesto_config', { ...p, gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 });
    // 6. Resultados de la ventana y estado persistido tras cada uno
    const casos = [[{ action: 'decline' }, 'RECHAZADO_POR_LA_PERSONA'], [{ action: 'cancel' }, 'VENTANA_CERRADA_SIN_RESPUESTA'], ['ERROR', 'ERROR_TECNICO_VENTANA']];
    for (const [resp, codigo] of casos) { cola.push(resp); const e = await E('tannia_partida_verificar', { ...p, codigo: 'M1' }); assert.equal(e.detalle.resultado_codigo, codigo); assert.equal(await verif(), false, `${codigo}: no se crea verificación`); }
    cola.push(SI); await OK('tannia_partida_verificar', { ...p, codigo: 'M1' }); assert.equal(await verif(), true);
    const vent = vistos.at(-1);
    for (const frag of ['Cantidad que va a confirmar: 10 m²', 'Superficie del muro: 5 m × 2,4 m = 12 m²', 'Descuento por puerta: 1 m × 2 m = 2 m²', 'Superficie neta: 12 − 2 = 10 m²', 'no medidas en el plano', 'No se comprobó en el plano si existen otros vanos']) assert.ok(vent.includes(frag), `ventana: falta «${frag}»`);
    // rechazar DESPUÉS de una verificación vigente no la revoca
    cola.push({ action: 'decline' }); const e2 = await E('tannia_partida_verificar', { ...p, codigo: 'M1' }); assert.match(e2.detalle.efecto, /NO se revocan/); assert.equal(await verif(), true);
    // 7. Excel y PDF; recálculo real
    await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
    const x1 = await OK('tannia_presupuesto_generar', p); const pdf1 = await OK('tannia_informe_generar', p);
    assert.equal(x1.total, 109480);
    if (MOTOR) { const rc = await recalcular(path.join(root, x1.archivo)); assert.ok(rc.formulas_sin_cache >= 7); for (const [k, v] of Object.entries(ESPERADO[8000])) assert.equal(rc.filas[k], v, `recálculo ${k}`); }
    else t.diagnostic('PENDIENTE: sin motor de recálculo (LibreOffice) en este entorno');
    // 8. Aprobación y exportación; hashes, tamaños, recibo
    await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }); cola.push(SI);
    const ap1 = await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
    assert.match(vistos.at(-1), /TOTAL \$109\.480/); assert.match(vistos.at(-1), /Advertencias que permanecen/);
    const ex1 = await OK('tannia_entregable_exportar', p);
    const dir1 = path.join(root, ex1.carpeta); const man1 = JSON.parse(fs.readFileSync(path.join(dir1, 'manifiesto-entrega.json'), 'utf8'));
    for (const a of man1.archivos) { const f = path.join(dir1, path.basename(a.rel)); assert.equal(sha(f), a.sha256); assert.equal(fs.statSync(f).size, a.bytes); assert.deepEqual(marcasNoFinales(f), []); }
    assert.equal(man1.aprobacion.recibo, ap1.recibo); const huellas1 = fs.readdirSync(dir1).map((n) => [n, sha(path.join(dir1, n))]);
    // 13. Reintento de exportación: uso único, sin duplicados
    await E('tannia_entregable_exportar', p, 'NO_APROBADO'); assert.equal(fs.readdirSync(path.join(root, '07 Entregables')).length, 1);
    // 9. Precio $9.000: obsolescencia, la verificación de cantidad SIGUE vigente, nueva aprobación, total 123.165
    await apu(9000); assert.equal(await verif(), true, 'un cambio económico no invalida la verificación de la cantidad');
    const est = await OK('tannia_entrega_estado', p); assert.ok(est.archivos.every((a) => /DESACTUALIZADO/.test(a.estado)));
    const x2 = await OK('tannia_presupuesto_generar', p); await OK('tannia_informe_generar', p); assert.equal(x2.total, 123165);
    if (MOTOR) { const rc = await recalcular(path.join(root, x2.archivo)); for (const [k, v] of Object.entries(ESPERADO[9000])) assert.equal(rc.filas[k], v, `recálculo 9000 ${k}`); }
    await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }); cola.push(SI); await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
    // 12. Alterar una copia de archivo aprobado antes de exportar ⇒ discrepancia detectada
    const abs2 = path.join(root, x2.archivo); const orig = fs.readFileSync(abs2); fs.appendFileSync(abs2, 'x');
    await E('tannia_entregable_exportar', p, 'APROBACION_NO_VIGENTE'); fs.writeFileSync(abs2, orig);
    // 10. Volver a $8.000: ninguna entrega anterior queda vigente ni se reutiliza
    await apu(8000); const est2 = await OK('tannia_entrega_estado', p); assert.equal(est2.aprobacion.vigente, false);
    assert.ok((await recibos()).filter((r) => r.accion === 'aprobar_entrega').every((r) => !r.vigente));
    for (const [n, h] of huellas1) assert.equal(sha(path.join(dir1, n)), h, 'la entrega histórica no se modifica');
    // 11. Cambiar una medida: la verificación anterior no autoriza la nueva cantidad
    await OK('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: { tramos: [{ longitud_m: 6, origen: 'declarado_usuaria' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ descripcion: 'puerta', ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } }, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A1' } });
    assert.equal(await verif(), false);
    assert.equal((await recibos()).find((r) => r.accion === 'verificar_partida' && r.vigente), undefined);
    // 14. Procedencia y advertencias coherentes entre ventana, Excel, PDF y herramientas
    const pdfTxt = (() => { const raw = fs.readFileSync(path.join(root, pdf1.archivo)).toString('latin1'); return (raw.match(/<([0-9a-fA-F]{2,})>/g) || []).map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join(''); })();
    for (const frag of ['no medidas en el plano', 'Sin pendientes que bloqueen la entrega', 'Advertencias que permanecen', 'sin trazabilidad geom']) assert.ok(pdfTxt.includes(frag), `PDF: falta «${frag}»`);
    assert.ok(!pdfTxt.includes('Sin advertencias autom'), 'el PDF no dice «Sin advertencias» con una cantidad manual');
    assert.ok(!/provienen de la geometr.a de los archivos indicados/.test(pdfTxt), 'sin la frase fija sobre geometría');
  } finally { await client.close(); fs.rmSync(home, { recursive: true, force: true }); }
});
