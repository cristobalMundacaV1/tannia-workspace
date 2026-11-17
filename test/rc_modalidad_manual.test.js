// Regresión UAT 2026-11-17 (PO): proyecto 100 % manual, sin planos. Antes: `nuevo → analisis` exigía un original y no se
// podía aprobar ni exportar. Ahora: modalidad «manual_declarado» explícita, advertencia persistente en ventana, XLSX, PDF,
// manifiesto y respuestas; protección de originales «no_aplica_sin_originales» (nunca «íntegros»); y gates estrictos si hay
// procedencia geométrica o se cambia la modalidad. Aprobaciones SIMULADAS por el cliente de prueba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { startClientConPersona, PERSONA_SI, call, data, tmpHome, FIX } from './helpers.js';
import { AVISO_SIN_ORIGINALES } from '../src/autoridad/modalidad.js';

const textoPdf = (f) => { const raw = fs.readFileSync(f).toString('latin1'); return (raw.match(/<([0-9a-fA-F]{2,})>/g) || []).map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join(''); };
const textoXlsx = (f) => Object.entries(unzipSync(new Uint8Array(fs.readFileSync(f)))).filter(([n]) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(n)).map(([, d]) => strFromU8(d)).join(' ');
const MC01 = { tramos: [{ longitud_m: 5, origen: 'declarado_usuaria' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ descripcion: 'puerta', ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } };

async function montar(nombre) {
  const home = tmpHome('Manual ñ '); const c = await startClientConPersona(home, undefined, Array.from({ length: 12 }, () => PERSONA_SI('Prueba (SIMULADA)')));
  const OK = async (n, a) => { const r = await call(c.client, n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return data(r); };
  const E = async (n, a, code) => { const r = await call(c.client, n, a); assert.equal(r.isError, true, `${n} debía fallar`); if (code) assert.equal(data(r).error, code, JSON.stringify(data(r)).slice(0, 500)); return data(r); };
  const p = { proyecto: nombre }; const root = path.join(home, 'Proyectos', nombre);
  await OK('tannia_proyecto_crear', { nombre });
  return { home, c, OK, E, p, root, close: async () => { await c.close(); fs.rmSync(home, { recursive: true, force: true }); } };
}
async function economia(t, precio = 8000) {
  await t.OK('tannia_apu_definir', { ...t.p, codigo: 'A1', unidad: 'm2', insumos: [{ tipo: 'subcontrato', descripcion: 'Estuco', unidad: 'm2', cantidad: 1, precio_unitario: precio, fuente_precio: 'declarada', fecha_precio: '2026-11-17' }] });
  await t.OK('tannia_presupuesto_config', { ...t.p, gastos_generales_pct: 10, utilidades_pct: 5, iva_pct: 19 });
}
async function generarYAprobar(t) {
  await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'borrador' }).catch(() => null);
  const x = await t.OK('tannia_presupuesto_generar', t.p); const m = await t.OK('tannia_informe_generar', t.p);
  await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'revision' });
  const ap = await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'aprobado' });
  return { x, m, ap };
}

test('UAT reproducida: sin originales y sin declarar modalidad, el gate sigue estricto (documental por defecto)', { timeout: 60000 }, async () => {
  const t = await montar('Sin modalidad');
  try {
    const e = await t.E('tannia_proyecto_avanzar', { ...t.p, a_estado: 'analisis' }, 'GATE_NO_CUMPLIDO');
    assert.match(e.mensaje, /manual_declarado/, 'el error orienta a declarar la modalidad, sin inventar un plano');
    const st = await t.OK('tannia_proyecto_estado', t.p); assert.equal(st.modalidad, 'documental_geometrico'); assert.equal(st.proteccion_originales, 'falta_registrar_originales');
  } finally { await t.close(); }
});

test('modalidad manual sin originales: flujo completo con advertencia persistente en ventana, XLSX, PDF, manifiesto y respuestas', { timeout: 180000 }, async () => {
  const t = await montar('QA Manual');
  try {
    const md = await t.OK('tannia_proyecto_modalidad', { ...t.p, accion: 'definir', modalidad: 'manual_declarado' });
    assert.equal(md.proteccion_originales, 'no_aplica_sin_originales'); assert.equal(md.advertencia_modalidad, AVISO_SIN_ORIGINALES);
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'analisis' });
    await t.OK('tannia_metodo', { ...t.p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: MC01, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A1' } });
    await economia(t);
    await t.OK('tannia_partida_verificar', { ...t.p, codigo: 'M1' }); assert.ok(t.c.vistos.at(-1).includes(AVISO_SIN_ORIGINALES), 'ventana de verificación');
    const { x, m, ap } = await generarYAprobar(t);
    assert.equal(x.total, 109480);
    assert.ok(t.c.vistos.at(-1).includes(AVISO_SIN_ORIGINALES), 'ventana de aprobación'); assert.ok(ap.advertencia_modalidad === AVISO_SIN_ORIGINALES, 'respuesta de aprobación');
    assert.ok(textoXlsx(path.join(t.root, x.archivo)).includes('Sin originales registrados'), 'XLSX');
    const pdf = textoPdf(path.join(t.root, m.archivo)); assert.ok(pdf.includes('Sin originales registrados'), 'PDF'); assert.ok(pdf.includes('no aplica (modalidad manual declarada)'));
    const ex = await t.OK('tannia_entregable_exportar', t.p); assert.equal(ex.advertencia_modalidad, AVISO_SIN_ORIGINALES); assert.equal(ex.proteccion_originales, 'no_aplica_sin_originales');
    const man = JSON.parse(fs.readFileSync(path.join(t.root, ex.carpeta, 'manifiesto-entrega.json'), 'utf8'));
    assert.equal(man.modalidad, 'manual_declarado'); assert.equal(man.proteccion_originales, 'no_aplica_sin_originales'); assert.deepEqual(man.advertencias, [AVISO_SIN_ORIGINALES]);
    assert.equal(man.originales.estado, 'no_aplica_sin_originales', 'nunca «integros» sin originales');
    assert.ok(!JSON.stringify(man).includes('"integros"'));
  } finally { await t.close(); }
});

test('modalidad manual: una partida con procedencia de archivo/geometría bloquea la entrega (no se promueve en silencio)', { timeout: 120000 }, async () => {
  const t = await montar('Manual con archivo');
  try {
    await t.OK('tannia_proyecto_modalidad', { ...t.p, accion: 'definir', modalidad: 'manual_declarado' });
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'analisis' });
    // un DXF que NO es original registrado, en la carpeta de trabajo
    fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(t.root, '03 Trabajo', 'suelto.dxf'));
    await t.OK('tannia_cubicar_dxf', { ...t.p, archivo: '03 Trabajo/suelto.dxf', unidad_confirmada: 'm', codigo: 'G1', descripcion: 'Losa', capas: ['LOSA'], regla: 'area_por_espesor', parametros: { espesor_m: 0.1 }, apu: 'A1' });
    await t.OK('tannia_apu_definir', { ...t.p, codigo: 'A1', unidad: 'm3', insumos: [{ tipo: 'material', descripcion: 'Hormigón', unidad: 'm3', cantidad: 1, precio_unitario: 1000, fuente_precio: 'declarada', fecha_precio: '2026-11-17' }] });
    await t.OK('tannia_presupuesto_config', { ...t.p, gastos_generales_pct: 0, utilidades_pct: 0, iva_pct: 19 });
    await t.OK('tannia_partida_verificar', { ...t.p, codigo: 'G1' });
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'borrador' });
    await t.OK('tannia_presupuesto_generar', t.p); await t.OK('tannia_informe_generar', t.p);
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'revision' });
    const e = await t.E('tannia_proyecto_avanzar', { ...t.p, a_estado: 'aprobado' }, 'GATE_NO_CUMPLIDO');
    assert.match(e.mensaje, /procedencia geométrica o de archivo.*suelto\.dxf/);
  } finally { await t.close(); }
});

test('cambio de modalidad: revisión nueva, entrega invalidada, recibo no reciclado; A → B → A tampoco revive la aprobación', { timeout: 180000 }, async () => {
  const t = await montar('Cambio modalidad');
  try {
    await t.OK('tannia_proyecto_modalidad', { ...t.p, accion: 'definir', modalidad: 'manual_declarado' });
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'analisis' });
    await t.OK('tannia_metodo', { ...t.p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: MC01, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A1' } });
    await economia(t); await t.OK('tannia_partida_verificar', { ...t.p, codigo: 'M1' });
    const { ap } = await generarYAprobar(t);
    const r1 = (await t.OK('tannia_proyecto_estado', t.p)).revision_datos;
    await t.OK('tannia_proyecto_modalidad', { ...t.p, accion: 'definir', modalidad: 'documental_geometrico' }); // A → B
    const st = await t.OK('tannia_proyecto_estado', t.p); assert.notEqual(st.revision_datos, r1); assert.equal(st.estado, 'borrador');
    await t.OK('tannia_proyecto_modalidad', { ...t.p, accion: 'definir', modalidad: 'manual_declarado' }); // B → A
    const pj = path.join(t.root, '.tannia', 'project.json'); const meta = JSON.parse(fs.readFileSync(pj, 'utf8')); meta.estado = 'aprobado'; fs.writeFileSync(pj, JSON.stringify(meta));
    await t.E('tannia_entregable_exportar', t.p, 'APROBACION_NO_VIGENTE');
    const rec = (await t.OK('tannia_recibos_verificar', t.p)).recibos.find((r) => r.recibo === ap.recibo); assert.equal(rec.vigente, false);
    assert.equal((await t.OK('tannia_partidas_listar', t.p)).partidas[0].verificada, true, 'cambiar la modalidad no anula la confirmación de la cantidad');
    assert.deepEqual(fs.readdirSync(path.join(t.root, '07 Entregables')), []);
  } finally { await t.close(); }
});

test('proyecto documental con original modificado: bloqueado; la modalidad manual no sirve para esquivarlo', { timeout: 180000 }, async () => {
  const t = await montar('Documental mutado');
  try {
    const orig = path.join(t.root, '02 Originales', 'planta.dxf'); fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), orig);
    await t.OK('tannia_originales_registrar', t.p); await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'analisis' });
    await t.OK('tannia_metodo', { ...t.p, accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: MC01, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A', apu: 'A1' } });
    await economia(t); await t.OK('tannia_partida_verificar', { ...t.p, codigo: 'M1' });
    await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'borrador' });
    await t.OK('tannia_presupuesto_generar', t.p); await t.OK('tannia_informe_generar', t.p); await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'revision' });
    fs.chmodSync(orig, 0o644); fs.appendFileSync(orig, '\n');
    await t.E('tannia_proyecto_avanzar', { ...t.p, a_estado: 'aprobado' }, 'GATE_NO_CUMPLIDO');
    await t.OK('tannia_proyecto_modalidad', { ...t.p, accion: 'definir', modalidad: 'manual_declarado' });
    await t.OK('tannia_presupuesto_generar', t.p); await t.OK('tannia_informe_generar', t.p); await t.OK('tannia_proyecto_avanzar', { ...t.p, a_estado: 'revision' });
    const e = await t.E('tannia_proyecto_avanzar', { ...t.p, a_estado: 'aprobado' }, 'GATE_NO_CUMPLIDO');
    assert.match(e.mensaje, /Integridad de originales comprometida/); assert.match(e.mensaje, /originales registrados pero la modalidad declarada es manual/);
  } finally { await t.close(); }
});
