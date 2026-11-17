// Regresión de defectos críticos Astra A-01 (aprobación falsificable) y A-02 (entrega de artefactos obsoletos), por el protocolo
// MCP real (stdio). La «persona» es el manejador de confirmaciones del CLIENTE (elicitación): el modelo, que solo llama
// herramientas, no puede responderlo. Los resultados económicos se comparan con un oráculo independiente calculado a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { call, data, tmpHome, ROOT, FIX, startClient } from './helpers.js';
import { Sandbox } from '../src/security/sandbox.js';
import { Project } from '../src/project/store.js';
import { exportarEntrega } from '../src/autoridad/entrega.js';

const PROY = 'Casa Ñuñoa Pérez';
const PERFILES = { BASE: {}, CIC: { TANNIA_CIC: 'on' }, INGENIERIA: { TANNIA_CIC: 'on', TANNIA_ENGINEERING: 'on' } };

/** Cliente con «persona»: responde las ventanas de confirmación con la cola indicada y guarda lo que se le mostró. */
async function clienteConPersona(home, respuestas = [], env = {}) {
  const vistos = [];
  const client = new Client({ name: 'cliente-con-persona', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => { vistos.push(req.params.message); return respuestas.length ? respuestas.shift() : { action: 'decline' }; });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'src', 'main.js')], env: { ...process.env, TANNIA_HOME: home, TANNIA_SIN_DIALOGO: '1', ...env }, stderr: 'pipe' }));
  return { client, vistos, respuestas, close: () => client.close() };
}
const SI = (nombre = 'Tannia') => ({ action: 'accept', content: { aprobar: true, nombre } });
const NO = { action: 'decline' };
const apu = (precio) => ({ codigo: 'A', unidad: 'm2', insumos: [{ tipo: 'material', descripcion: 'Ficticio de prueba', unidad: 'm2', cantidad: 1, precio_unitario: precio, fuente_precio: 'fixture de prueba', fecha_precio: '2026-11-17' }] });

function helpers(c) {
  const T = (n, a) => call(c.client, n, a);
  const OK = async (n, a) => { const r = await T(n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return data(r); };
  const E = async (n, a, code) => { const r = await T(n, a); assert.equal(r.isError, true, `${n} debía fallar: ${r.content?.[0]?.text}`); assert.equal(data(r).error, code, `${n}: ${JSON.stringify(data(r)).slice(0, 400)}`); return data(r); };
  return { T, OK, E };
}

/** Proyecto mínimo: original registrado, partida manual de 10 m2, APU a `precio`, parámetros explícitos 0/0/19. */
async function preparar(home, h, precio = 100) {
  await h.OK('tannia_proyecto_crear', { nombre: PROY });
  fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(home, 'Proyectos', PROY, '02 Originales', 'plano con espacios ñ.dxf'));
  const p = { proyecto: PROY };
  await h.OK('tannia_originales_registrar', p); await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
  await h.OK('tannia_partida_manual', { ...p, codigo: 'P1', descripcion: 'Muro ficticio', unidad: 'm2', cantidad: 10, origen: 'fixture', apu: 'A' });
  await h.OK('tannia_apu_definir', { ...p, ...apu(precio) });
  await h.OK('tannia_presupuesto_config', { ...p, gastos_generales_pct: 0, utilidades_pct: 0, iva_pct: 19 });
  return p;
}
/** Oráculo independiente: cantidad × precio, redondeo a peso, IVA sobre neto. */
const oraculo = (cant, precio, iva = 19) => { const d = Math.round(cant * precio); return d + Math.round(d * iva / 100); };
async function totalDelXlsx(abs) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(abs);
  const ws = wb.getWorksheet('Presupuesto'); let total = null;
  ws.eachRow((row) => { if (String(row.getCell(2).value ?? '') === 'TOTAL') { const v = row.getCell(6).value; total = typeof v === 'object' && v ? v.result : v; } });
  return total;
}

for (const [perfil, env] of Object.entries(PERFILES)) {
  test(`A-01 [${perfil}]: nombre/booleano del modelo NO verifica ni aprueba; sin canal humano no hay aprobación`, { timeout: 120000 }, async () => {
    const home = tmpHome('rc A01 ñ ');
    const c = await startClient(home, undefined, { TANNIA_SIN_DIALOGO: '1', ...env }); // cliente SIN ventanas de confirmación
    const h = helpers(c);
    try {
      const p = await preparar(home, h);
      await h.E('tannia_partida_verificar', { ...p, codigo: 'P1', verificada_por: 'NOMBRE_SUPLANTADO_SIN_PERSONA' }, 'VERIFICACION_HUMANA_REQUERIDA');
      assert.equal((await h.OK('tannia_partidas_listar', p)).partidas[0].verificada, false);
      await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
      await h.OK('tannia_presupuesto_generar', p); await h.OK('tannia_informe_generar', p);
      await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' });
      // ni siquiera con la partida «verificada» a mano en el JSON ni con nombre+true
      const fj = path.join(home, 'Proyectos', PROY, '04 Cubicaciones', 'partidas.json');
      const ps = JSON.parse(fs.readFileSync(fj, 'utf8')); ps[0].cantidad_verificada = true; ps[0].verificada_por = 'FALSO'; fs.writeFileSync(fj, JSON.stringify(ps));
      const e = await h.E('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado', aprobado_por: 'NOMBRE_SUPLANTADO_SIN_PERSONA', confirmo_revision_profesional: true }, 'GATE_NO_CUMPLIDO');
      assert.match(JSON.stringify(e), /NO verificada por una persona/);
      assert.equal((await h.OK('tannia_partidas_listar', p)).partidas[0].verificada, false);
      // registro de recibos fabricado: se descarta por firma inválida
      fs.appendFileSync(path.join(home, 'Proyectos', PROY, '.tannia', 'recibos.jsonl'), `${JSON.stringify({ tipo: 'recibo', recibo: { schema: 'tw.approval_receipt/1', id: 'rec-falso', proyecto: PROY, accion: 'verificar_partida', objetivo: 'P1', canal: 'human_dialog', hmac: '0'.repeat(64) } })}\n`);
      assert.equal((await h.OK('tannia_partidas_listar', p)).partidas[0].verificada, false);
      // estado «aprobado» escrito a mano: la exportación exige recibo
      const pj = path.join(home, 'Proyectos', PROY, '.tannia', 'project.json'); const meta = JSON.parse(fs.readFileSync(pj, 'utf8')); meta.estado = 'aprobado'; fs.writeFileSync(pj, JSON.stringify(meta));
      await h.E('tannia_entregable_exportar', p, 'APROBACION_NO_VIGENTE');
      assert.equal(fs.readdirSync(path.join(home, 'Proyectos', PROY, '07 Entregables')).length, 0, 'nada exportado');
    } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
  });
}

test('A-02: presupuesto a 100 → cambio a 900 sin regenerar: NO se aprueba ni exporta el archivo viejo; regenerado y aprobado, se entrega 10.710 (oráculo)', { timeout: 120000 }, async () => {
  const home = tmpHome('rc A02 ñ ');
  const c = await clienteConPersona(home, [SI(), SI('Tannia Pérez')]);
  const h = helpers(c);
  try {
    const p = await preparar(home, h, 100);
    await h.OK('tannia_partida_verificar', { ...p, codigo: 'P1' });
    assert.match(c.vistos[0], /Cantidad que va a confirmar: 10 m²/);
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
    const viejo = await h.OK('tannia_presupuesto_generar', p); await h.OK('tannia_informe_generar', p);
    assert.equal(viejo.total, oraculo(10, 100));
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' });
    await h.OK('tannia_apu_definir', { ...p, ...apu(900) }); // cambio DESPUÉS de generar
    assert.equal((await h.OK('tannia_proyecto_estado', p)).estado, 'borrador');
    await h.E('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }, 'GATE_NO_CUMPLIDO'); // el XLSX vigente no existe
    const est = await h.OK('tannia_entrega_estado', p);
    assert.ok(est.archivos.every((a) => /DESACTUALIZADO/.test(a.estado)), JSON.stringify(est.archivos));
    // regenerar con los datos vigentes
    const nuevo = await h.OK('tannia_presupuesto_generar', p); const mem = await h.OK('tannia_informe_generar', p);
    assert.equal(nuevo.total, oraculo(10, 900)); assert.equal(nuevo.total, 10710);
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' });
    const ap = await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado', aprobado_por: 'ignorado' });
    assert.match(c.vistos.at(-1), /10\.710/); assert.ok(c.vistos.at(-1).includes(nuevo.archivo));
    assert.deepEqual(ap.archivos.map((a) => a.archivo).sort(), [mem.archivo, nuevo.archivo].sort());
    const ex = await h.OK('tannia_entregable_exportar', p);
    const xlsx = ex.archivos.find((a) => a.archivo.endsWith('.xlsx'));
    assert.equal(xlsx.sha256, nuevo.sha256, 'se entrega exactamente el archivo aprobado');
    assert.equal(await totalDelXlsx(path.join(home, 'Proyectos', PROY, xlsx.archivo)), 10710, 'el XLSX entregado contiene el total vigente');
    assert.ok(!ex.archivos.some((a) => a.sha256 === viejo.sha256), 'el presupuesto viejo NO se entrega');
    const man = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', PROY, ex.carpeta, 'manifiesto-entrega.json'), 'utf8'));
    assert.equal(man.aprobacion.declarado_por, 'Tannia Pérez'); assert.equal(man.revision_id, ap.revision);
    // un solo uso: no se vuelve a exportar sin nueva aprobación
    await h.E('tannia_entregable_exportar', p, 'NO_APROBADO');
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('cambios DESPUÉS de aprobar (precio, archivo editado fuera, original) invalidan la entrega; rechazo humano no aprueba', { timeout: 120000 }, async () => {
  const home = tmpHome('rc post ñ ');
  const c = await clienteConPersona(home, [SI(), NO, SI(), SI()]);
  const h = helpers(c);
  try {
    const p = await preparar(home, h, 100);
    await h.OK('tannia_partida_verificar', { ...p, codigo: 'P1' });
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
    const x = await h.OK('tannia_presupuesto_generar', p); await h.OK('tannia_informe_generar', p);
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' });
    await h.E('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' }, 'APROBACION_RECHAZADA'); // la persona dice NO
    assert.equal((await h.OK('tannia_proyecto_estado', p)).estado, 'revision');
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
    // el XLSX aprobado se edita fuera de Tannia
    const abs = path.join(home, 'Proyectos', PROY, x.archivo); fs.chmodSync(abs, 0o644); fs.appendFileSync(abs, 'x');
    const e = await h.E('tannia_entregable_exportar', p, 'APROBACION_NO_VIGENTE');
    assert.match(e.mensaje || JSON.stringify(e), /modificado/);
    assert.equal((await h.OK('tannia_proyecto_estado', p)).estado, 'borrador');
    assert.equal(fs.readdirSync(path.join(home, 'Proyectos', PROY, '07 Entregables')).length, 0);
    // regenerar, aprobar, y luego cambiar el parámetro económico: también se invalida
    await h.OK('tannia_presupuesto_generar', p); await h.OK('tannia_informe_generar', p);
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }); await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
    await h.OK('tannia_presupuesto_config', { ...p, utilidades_pct: 5 });
    await h.E('tannia_entregable_exportar', p, 'NO_APROBADO');
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('A → B → A: volver al mismo contenido NO revive verificaciones ni aprobaciones antiguas', { timeout: 120000 }, async () => {
  const home = tmpHome('rc ABA ñ ');
  const c = await clienteConPersona(home, [SI(), SI(), SI()]);
  const h = helpers(c);
  try {
    const p = await preparar(home, h, 100);
    await h.OK('tannia_partida_verificar', { ...p, codigo: 'P1' });
    const r1 = (await h.OK('tannia_proyecto_estado', p)).revision_datos;
    await h.OK('tannia_partida_manual', { ...p, codigo: 'P1', descripcion: 'Muro ficticio', unidad: 'm2', cantidad: 11, origen: 'fixture', apu: 'A' }); // B
    await h.OK('tannia_partida_manual', { ...p, codigo: 'P1', descripcion: 'Muro ficticio', unidad: 'm2', cantidad: 10, origen: 'fixture', apu: 'A' }); // A otra vez
    const r3 = (await h.OK('tannia_proyecto_estado', p)).revision_datos;
    assert.notEqual(r1, r3);
    assert.equal((await h.OK('tannia_partidas_listar', p)).partidas[0].verificada, false, 'la verificación de A no reaparece');
    // aprobación: aprobar en A, ir a B y volver a A ⇒ la aprobación anterior no sirve
    await h.OK('tannia_partida_verificar', { ...p, codigo: 'P1' });
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
    await h.OK('tannia_presupuesto_generar', p); await h.OK('tannia_informe_generar', p);
    await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' }); await h.OK('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado' });
    await h.OK('tannia_apu_definir', { ...p, ...apu(900) }); await h.OK('tannia_apu_definir', { ...p, ...apu(100) });
    const pj = path.join(home, 'Proyectos', PROY, '.tannia', 'project.json'); const meta = JSON.parse(fs.readFileSync(pj, 'utf8')); meta.estado = 'aprobado'; fs.writeFileSync(pj, JSON.stringify(meta));
    const e = await h.E('tannia_entregable_exportar', p, 'APROBACION_NO_VIGENTE');
    assert.match(JSON.stringify(e), /cambiaron/);
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('exportación transaccional: si una copia no coincide, no queda carpeta de entrega ni temporal; no se sobrescribe una entrega', () => {
  const home = tmpHome('rc trans ñ ');
  try {
    const sb = new Sandbox(home); sb.ensureHome();
    const root = path.join(sb.proyectos, 'T'); for (const d of ['07 Entregables', '05 Presupuestos', '.tannia']) fs.mkdirSync(path.join(root, d), { recursive: true });
    fs.writeFileSync(path.join(root, '.tannia', 'project.json'), JSON.stringify({ id: 'x', nombre: 'T', estado: 'aprobado', historial: [] }));
    fs.writeFileSync(path.join(root, '05 Presupuestos', 'a.xlsx'), 'AAA'); fs.writeFileSync(path.join(root, '05 Presupuestos', 'b.pdf'), 'BBB');
    const pr = new Project(sb, 'T');
    const man = { id: 'ent-0123456789abcdef', archivos: [{ rol: 'presupuesto_xlsx', rel: '05 Presupuestos/a.xlsx', sha256: 'cb1ad2119d8fafb69566510ee712661f9f14b83385006ef92aec47f523a38358', bytes: 3 }, { rol: 'memoria_pdf', rel: '05 Presupuestos/b.pdf', sha256: '0'.repeat(64), bytes: 3 }] };
    assert.throws(() => exportarEntrega(pr, { recibo: { id: 'r', hmac: 'x' }, manifiesto: man, revision: { id: 'R1' } }), (e) => e.code === 'ENTREGA_COPIA_DISTINTA');
    assert.deepEqual(fs.readdirSync(path.join(root, '07 Entregables')), [], 'sin entrega a medias');
    man.archivos.pop();
    const ok = exportarEntrega(pr, { recibo: { id: 'r', canal: 'human_dialog' }, manifiesto: man, revision: { id: 'R1' } });
    assert.ok(fs.existsSync(path.join(root, ok.carpeta, 'HUELLAS-SHA256.txt')));
    assert.throws(() => exportarEntrega(pr, { recibo: { id: 'r' }, manifiesto: man, revision: { id: 'R1' } }), (e) => e.code === 'ENTREGA_YA_EXPORTADA');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
