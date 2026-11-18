// Regresión de las inconsistencias detectadas en la entrega R7 (prueba de campo 0.2.0-rc.1):
// documentos «BORRADOR» exportados como finales, circularidad aprobar→exportar→final, trazabilidad del PDF, estado de
// verificación contradictorio, auditoría de recibos y origen no acreditado de precios/porcentajes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { startClientConPersona, PERSONA_SI, call, data, tmpHome, FIX } from './helpers.js';
import { marcasNoFinales } from '../src/autoridad/entrega.js';

const textoPdf = (f) => { const raw = fs.readFileSync(f).toString('latin1'); return raw + (raw.match(/<([0-9a-fA-F]{2,})>/g) || []).map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join(''); };
const textoXlsx = (f) => Object.entries(unzipSync(new Uint8Array(fs.readFileSync(f)))).filter(([n]) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(n)).map(([, d]) => strFromU8(d)).join(' ');
const apu = (precio) => ({ codigo: 'A', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: precio, fuente_precio: 'cotización prueba', fecha_precio: '2026-11-17' }] });

async function montar(nombre, respuestas = 12) {
  const home = tmpHome('rc R7 ñ ');
  const c = await startClientConPersona(home, undefined, Array.from({ length: respuestas }, () => PERSONA_SI('Tannia')));
  const OK = async (n, a) => { const r = await call(c.client, n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return data(r); };
  const E = async (n, a, code) => { const r = await call(c.client, n, a); assert.equal(r.isError, true, `${n} debía fallar`); assert.equal(data(r).error, code, JSON.stringify(data(r)).slice(0, 400)); return data(r); };
  const p = { proyecto: nombre }; const root = path.join(home, 'Proyectos', nombre);
  await OK('tannia_proyecto_crear', { nombre });
  fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(root, '02 Originales', 'planta.dxf'));
  await OK('tannia_originales_registrar', p); await OK('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
  await OK('tannia_metodo', { ...p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: { tramos: [{ longitud_m: 5, origen: 'declarado_usuaria' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } }, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A' } });
  await OK('tannia_apu_definir', { ...p, ...apu(8000) });
  await OK('tannia_presupuesto_config', { ...p, gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 });
  return { home, root, c, OK, E, p, close: async () => { await c.close(); fs.rmSync(home, { recursive: true, force: true }); } };
}
async function aprobado(t) {
  await t.OK('tannia_partida_verificar', { ...t.p, codigo: 'M1' });
  await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'borrador' }).catch(() => null);
  const x = await t.OK('tannia_presupuesto_generar', t.p); const m = await t.OK('tannia_informe_generar', t.p);
  await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'revision' }); const ap = await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'aprobado' });
  return { x, m, ap };
}

test('R7-1/2: un documento BORRADOR no puede entrar en una entrega; el candidato aprobado se exporta con los MISMOS bytes y sin marca de borrador', { timeout: 120000 }, async () => {
  const t = await montar('R7 borrador');
  try {
    // generado ANTES de verificar ⇒ borrador por contenido
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'borrador' });
    const xb = await t.OK('tannia_presupuesto_generar', t.p); const mb = await t.OK('tannia_informe_generar', t.p);
    assert.ok(marcasNoFinales(path.join(t.root, mb.archivo)).length > 0, 'la memoria borrador se detecta por contenido');
    assert.ok(marcasNoFinales(path.join(t.root, xb.archivo)).length > 0, 'el XLSX borrador se detecta por contenido');
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'revision' });
    await t.E('tannia_proyecto_avanzar', { ...t.p, a_estado: 'aprobado' }, 'GATE_NO_CUMPLIDO');
    const { x, m, ap } = await aprobado(t);
    for (const f of [x.archivo, m.archivo]) assert.deepEqual(marcasNoFinales(path.join(t.root, f)), [], `${f} sin marcas de borrador`);
    assert.match(textoPdf(path.join(t.root, m.archivo)), /CANDIDATO A ENTREGA/);
    assert.match(textoXlsx(path.join(t.root, x.archivo)), /CANDIDATO A ENTREGA/);
    const ex = await t.OK('tannia_entregable_exportar', t.p);
    const aprobados = Object.fromEntries(ap.archivos.map((a) => [path.basename(a.archivo), a.sha256]));
    for (const a of ex.archivos) assert.equal(a.sha256, aprobados[path.basename(a.archivo)], 'se exportan los bytes aprobados, sin regenerar ni editar');
  } finally { await t.close(); }
});

test('R7-3/6: el PDF separa originales registrados de fuentes geométricas por partida y declara «origen no acreditado» de precios y porcentajes', { timeout: 120000 }, async () => {
  const t = await montar('R7 trazabilidad');
  try {
    const { x, m } = await aprobado(t);
    const pdf = textoPdf(path.join(t.root, m.archivo));
    assert.match(pdf, /Originales registrados en el proyecto/); assert.match(pdf, /02 Originales\/planta\.dxf/);
    assert.match(pdf, /Fuentes geom.tricas vinculadas a partidas/); assert.match(pdf, /Ninguna partida tiene fuente geom.trica/, 'M1 es por método sin archivo: el DXF registrado NO se presenta como su fuente');
    assert.match(pdf, /ORIGEN NO ACREDITADO/); assert.match(textoXlsx(path.join(t.root, x.archivo)), /ORIGEN NO ACREDITADO/);
    assert.doesNotMatch(pdf, /aportad[oa]s? por la usuaria/i);
  } finally { await t.close(); }
});

test('R7-4/5: estado de verificación único (sin campo contradictorio en disco) y auditoría de recibos: integridad, canal, identidad declarada, vigencia y consumo, sin exponer la clave', { timeout: 120000 }, async () => {
  const t = await montar('R7 recibos');
  try {
    const { x } = await aprobado(t);
    const enDisco = JSON.parse(fs.readFileSync(path.join(t.root, '04 Cubicaciones', 'partidas.json'), 'utf8'))[0];
    assert.equal('cantidad_verificada' in enDisco, false, 'partidas.json no guarda un estado que contradiga los recibos');
    assert.equal((await t.OK('tannia_partidas_listar', t.p)).partidas[0].verificada, true);
    assert.match(textoXlsx(path.join(t.root, x.archivo)), /verificada/);
    let a = await t.OK('tannia_recibos_verificar', t.p);
    const v = a.recibos.find((r) => r.accion === 'verificar_partida'); const ap = a.recibos.find((r) => r.accion === 'aprobar_entrega');
    assert.equal(v.vigente, true); assert.equal(ap.vigente, true); assert.equal(ap.consumido, false);
    assert.equal(v.integridad, 'firma HMAC válida'); assert.match(v.identidad, /NO autenticada/); assert.match(v.canal_consentimiento, /cliente MCP/);
    const clave = fs.readFileSync(path.join(t.home, '.tannia-config', 'clave-recibos')).toString('hex');
    assert.ok(!JSON.stringify(a).includes(clave), 'la clave no se expone');
    await t.OK('tannia_entregable_exportar', t.p);
    a = await t.OK('tannia_recibos_verificar', t.p);
    assert.equal(a.recibos.find((r) => r.accion === 'aprobar_entrega').consumido, true);
    fs.appendFileSync(path.join(t.root, '.tannia', 'recibos.jsonl'), '{"tipo":"recibo","recibo":{"id":"rec-falso","hmac":"00"}}\n');
    assert.equal((await t.OK('tannia_recibos_verificar', t.p)).lineas_invalidas, 1);
  } finally { await t.close(); }
});

test('R7-7: proyecto separado — aprobar, cambiar el precio y exportar con la aprobación anterior: bloqueado; y A → B → A tras aprobar: bloqueado', { timeout: 120000 }, async () => {
  const t = await montar('R7 precio');
  try {
    await aprobado(t);
    await t.OK('tannia_apu_definir', { ...t.p, ...apu(9000) });
    const pj = path.join(t.root, '.tannia', 'project.json'); const forzar = () => { const m = JSON.parse(fs.readFileSync(pj, 'utf8')); m.estado = 'aprobado'; fs.writeFileSync(pj, JSON.stringify(m)); };
    await t.E('tannia_entregable_exportar', t.p, 'NO_APROBADO'); // el cambio devolvió el proyecto a borrador
    forzar(); await t.E('tannia_entregable_exportar', t.p, 'APROBACION_NO_VIGENTE'); // ni forzando el estado
    // A → B → A: volver a 8000 tampoco revive la aprobación
    await t.OK('tannia_apu_definir', { ...t.p, ...apu(8000) }); forzar();
    const e = await t.E('tannia_entregable_exportar', t.p, 'APROBACION_NO_VIGENTE'); assert.match(JSON.stringify(e), /cambiaron/);
    assert.deepEqual(fs.readdirSync(path.join(t.root, '07 Entregables')), [], 'nada exportado');
    const a = await t.OK('tannia_recibos_verificar', t.p);
    assert.equal(a.recibos.find((r) => r.accion === 'aprobar_entrega').vigente, false);
  } finally { await t.close(); }
});
