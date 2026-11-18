// G05/G06/G07 (TW-PRO-E2E, PL-09): planos → cantidades medidas → partidas → presupuesto, con la MISMA revisión y con invalidación.
// Oráculos calculados a mano (independientes del motor): sección = rectángulo (ancho × hastial) + semicírculo (π r² / 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { tmpHome, startClientConPersona, PERSONA_SI, call, data } from './helpers.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { DrawingService } from '../src/drawing/service.js';
import { cantidadPartida } from '../src/drawing/cantidades_contrato.js';

const TUNEL = (length) => ({ length, width: 5, wall: 3, selected: 0.06, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 } });
const AREA = (w, h) => w * h + Math.PI * (w / 2) ** 2 / 2; // oráculo de sección (bóveda semicircular sobre hastiales)
const cerca = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

function proyecto() { const home = tmpHome(); const sb = new Sandbox(home); sb.ensureHome(); createProject(sb, 'Túnel G06'); return { home, sb, svc: new DrawingService(sb) }; }

test('A→B→A en planos: volver a generar A deja A como revisión vigente (antes quedaba B)', async () => {
  const { svc } = proyecto();
  const a = await svc.generate('Túnel G06', { model: TUNEL(150) }); const b = await svc.generate('Túnel G06', { model: TUNEL(120) });
  assert.notEqual(a.revision, b.revision); assert.equal(svc.status('Túnel G06').head, b.revision);
  const a2 = await svc.generate('Túnel G06', { model: TUNEL(150) });
  assert.equal(a2.revision, a.revision); assert.equal(a2.reused, true);
  assert.equal(svc.status('Túnel G06').head, a.revision, 'la revisión vigente debe volver a A');
  assert.equal(svc.status('Túnel G06').integrity.estado, 'integra');
});

test('túnel: las cantidades salen en tw.cantidades/1 (solo la alternativa elegida es sumable) y coinciden con el oráculo', async () => {
  const { home, svc } = proyecto(); const r = await svc.generate('Túnel G06', { model: TUNEL(150) });
  const f = r.files.find((x) => x.endsWith('-cantidades.json')); assert.ok(f, 'debe emitir cantidades.json');
  const doc = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', 'Túnel G06', '06 Informes', 'Planos', f), 'utf8'));
  assert.equal(doc.schema, 'tw.cantidades/1'); assert.equal(doc.revision, r.revision); assert.equal(doc.apto_presupuesto, true);
  const exc = cantidadPartida(doc, 'Excavación de túnel'); cerca(exc.valor, AREA(5, 3) * 150); assert.equal(exc.unidad, 'm3');
  const ri = 2.5 - 0.06; const rev = cantidadPartida(doc, 'Revestimiento shotcrete e = 6 cm'); cerca(rev.valor, (AREA(5, 3) - (2 * ri * 3 + Math.PI * ri ** 2 / 2)) * 150); assert.equal(rev.unidad, 'm3');
  assert.throws(() => cantidadPartida(doc, 'Revestimiento shotcrete e = 8 cm'), /sin detalle/, 'la alternativa no elegida NO es sumable');
  assert.ok(doc.alternativas_no_sumables.some((x) => x.thickness_m === 0.08));
  const pernos = cantidadPartida(doc, 'Pernos de anclaje'); assert.equal(pernos.unidad, 'u');
  const P = 2 * 3 + Math.PI * 2.5; const nAnillo = Math.ceil(P / 1.5 - 1e-9); const anillos = Math.ceil(150 / 1.5 - 1e-9) + 1; assert.equal(pernos.valor, nAnillo * anillos);
  const malla = cantidadPartida(doc, 'Malla de acero'); cerca(malla.valor, (2 * 3 + Math.PI * (2.5 - 0.03)) * 150 * 1.1, 1e-9);
  for (const x of doc.detalle) { assert.equal(x.fila, 'detalle'); assert.ok(x.formula && x.metodo && x.procedencia, JSON.stringify(x)); }
  // G08: el cuadro de pernos IMPRESO en la lámina dice el mismo total que la cubicación (una sola autoridad) y los pernos van rotulados
  const modelo = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', 'Túnel G06', '06 Informes', 'Planos', r.files.find((x) => x.endsWith('-modelo.json'))), 'utf8'));
  const vf = modelo.views.find((v) => v.id === 'fortificacion'); const cuadro = vf.notes.find((t) => /^CUADRO DE PERNOS/.test(t));
  assert.match(cuadro, new RegExp(`TOTAL ${pernos.valor} pernos`)); assert.equal(vf.labels.length, nAnillo); assert.equal(vf.labels[0].text, 'P1');
  assert.ok(modelo.views.find((v) => v.id === 'seccion').notes.some((t) => /^CUADRO GEOMÉTRICO: ancho 5,00 m · hastial 3,00 m · radio de bóveda 2,50 m/.test(t)));
});

async function preparar(home, respuestas = []) {
  const c = await startClientConPersona(home, undefined, respuestas);
  const T = async (n, a, debeFallar = false) => { const r = await call(c.client, n, a); if (!debeFallar) assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return r; };
  await T('tannia_proyecto_crear', { nombre: 'Túnel PL-09' });
  return { c, T };
}

test('PL-09: tannia_planos a_partidas crea partidas trazadas a la revisión de planos; un cambio de planos las deja DESACTUALIZADAS y bloquea la entrega hasta regenerarlas; A→B→A reproduce A', async () => {
  const home = tmpHome(); const { c, T } = await preparar(home);
  try {
    const A = data(await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'generar_tunel', datos: TUNEL(150) }));
    const pA = data(await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'a_partidas', asignaciones: [{ partida: 'Pernos de anclaje', codigo: 'F-01' }] }));
    assert.equal(pA.revision_planos, A.revision); assert.equal(pA.creadas.length, 4);
    const lista = data(await T('tannia_partidas_listar', { proyecto: 'Túnel PL-09' })).partidas;
    const f01 = lista.find((p) => p.codigo === 'F-01'); assert.ok(f01); assert.equal(f01.unidad, 'u'); assert.equal(f01.regla, 'plano:tw.cantidades/1');
    const excA = lista.find((p) => /Excavación/.test(p.descripcion)).cantidad; cerca(excA, AREA(5, 3) * 150);
    assert.ok(lista.every((p) => !p.desactualizada));

    // Cambio de geometría (B): las partidas derivadas de A quedan desactualizadas y no pueden verificarse ni entregarse
    const B = data(await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'generar_tunel', datos: TUNEL(120) }));
    const trasB = data(await T('tannia_partidas_listar', { proyecto: 'Túnel PL-09' })).partidas;
    assert.ok(trasB.length === 4 && trasB.every((p) => p.estado_revision === 'needs_review' && p.advertencias.some((a) => /planos cambiaron/.test(a))), JSON.stringify(trasB[0]));
    const est = data(await T('tannia_entrega_estado', { proyecto: 'Túnel PL-09' }));
    assert.ok(est.pendientes.some((x) => /planos cambiaron|desactualizad/i.test(x)), JSON.stringify(est.pendientes));
    const v = await T('tannia_partida_verificar', { proyecto: 'Túnel PL-09', codigo: 'F-01' }, true); assert.equal(v.isError, true); assert.equal(data(v).error, 'PARTIDA_DESACTUALIZADA');

    // Regenerar partidas desde B: nuevas cantidades, mismos códigos, APU conservado
    const pB = data(await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'a_partidas', asignaciones: [{ partida: 'Pernos de anclaje', codigo: 'F-01' }] }));
    assert.equal(pB.revision_planos, B.revision);
    const excB = data(await T('tannia_partidas_listar', { proyecto: 'Túnel PL-09' })).partidas.find((p) => /Excavación/.test(p.descripcion)).cantidad; cerca(excB, AREA(5, 3) * 120);

    // Volver a A: mismas cantidades lógicas que A
    await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'generar_tunel', datos: TUNEL(150) });
    const pA2 = data(await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'a_partidas', asignaciones: [{ partida: 'Pernos de anclaje', codigo: 'F-01' }] }));
    assert.equal(pA2.revision_planos, A.revision);
    const final = data(await T('tannia_partidas_listar', { proyecto: 'Túnel PL-09' })).partidas;
    cerca(final.find((p) => /Excavación/.test(p.descripcion)).cantidad, excA); assert.equal(final.find((p) => p.codigo === 'F-01').cantidad, lista.find((p) => p.codigo === 'F-01').cantidad);
  } finally { await c.close(); }
});

// Edificación (piloto 2): muro con puerta y ventana, identidad física declarada (misma forma que g3_cantidades_geometria).
const EDIF = (ventana = 1.2, identidad = true) => ({
  codigo: 'ED-01', especialidad: 'edificación', proyecto: 'Edificio piloto', capas: { MUROS: { color: 7, grosor: 0.5, leyenda: 'Muros' }, VANOS: { color: 3, grosor: 0.25, leyenda: 'Vanos' } },
  vistas: [{ id: 'elev', titulo: 'Elevación eje A', tipo: 'elevacion', escala: 50, elementos: [
    { id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: 6, alto: 2.4 },
    { id: 'puerta', tipo: 'rectangulo', capa: 'VANOS', origen: [1, 0], ancho: 0.9, alto: 2.0 },
    { id: 'ventana', tipo: 'rectangulo', capa: 'VANOS', origen: [3.5, 1.0], ancho: ventana, alto: 1.0 },
  ] }],
  laminas: [{ id: '01', titulo: 'Elevación eje A', vistas: ['elev'] }],
  mediciones: [
    { id: 'bruto', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/muro'], unidad: 'm2' },
    { id: 'vano-p', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/puerta'], signo: -1 },
    { id: 'vano-v', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/ventana'], signo: -1 },
    { id: 'vanos', partida: 'Vanos', metodo: 'conteo', fuentes: ['elev/puerta', 'elev/ventana'] },
  ],
  ...(identidad ? { elementos_fisicos: [{ id: 'M1', tipo: 'muro', fuentes: ['elev/muro'] }, { id: 'P1', tipo: 'puerta', fuentes: ['elev/puerta'] }, { id: 'V1', tipo: 'ventana', fuentes: ['elev/ventana'] }] } : {}),
});

test('C-04 edificación: cambiar UN vano en B produce el delta exacto solo en la partida del muro (oráculo a mano)', async () => {
  const home = tmpHome(); const { c, T } = await preparar(home);
  try {
    await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'generar', especificacion: EDIF(1.2) });
    const a = data(await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'a_partidas', asignaciones: [{ partida: 'Muro M1', codigo: 'M-01' }, { partida: 'Vanos', codigo: 'V-01' }] }));
    assert.deepEqual(a.creadas.map((x) => x.codigo).sort(), ['M-01', 'V-01']);
    const A = Object.fromEntries(data(await T('tannia_partidas_listar', { proyecto: 'Túnel PL-09' })).partidas.map((p) => [p.codigo, p.cantidad]));
    cerca(A['M-01'], 6 * 2.4 - 0.9 * 2.0 - 1.2 * 1.0); assert.equal(A['V-01'], 2);
    await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'generar', especificacion: EDIF(1.5) });
    await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'a_partidas', asignaciones: [{ partida: 'Muro M1', codigo: 'M-01' }, { partida: 'Vanos', codigo: 'V-01' }] });
    const B = Object.fromEntries(data(await T('tannia_partidas_listar', { proyecto: 'Túnel PL-09' })).partidas.map((p) => [p.codigo, p.cantidad]));
    cerca(A['M-01'] - B['M-01'], 0.3 * 1.0); assert.equal(B['V-01'], A['V-01']);
  } finally { await c.close(); }
});

test('PL-09 / R-01: mediciones sin identidad física (NEEDS_REVIEW) NO se convierten en partidas; se explica por qué', async () => {
  const home = tmpHome(); const { c, T } = await preparar(home);
  try {
    await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'generar', especificacion: EDIF(1.2, false) });
    const r = await T('tannia_planos', { proyecto: 'Túnel PL-09', accion: 'a_partidas' }, true);
    assert.equal(r.isError, true); const d = data(r); assert.equal(d.error, 'SIN_PARTIDAS_PRESUPUESTABLES');
    assert.ok(d.detalle.bloqueadas.length === 2 && d.detalle.bloqueadas.every((b) => b.codigo === 'PROCEDENCIA_NO_AUTORIZADA'), JSON.stringify(d).slice(0, 500));
    assert.equal(data(await T('tannia_partidas_listar', { proyecto: 'Túnel PL-09' })).partidas.length, 0);
  } finally { await c.close(); }
});

test('G02/G09/NEG-03: la aprobación cubre planos + cantidades + Excel + memoria de UNA revisión; un cambio de planos la anula y bloquea planos A con partidas B', async () => {
  const home = tmpHome(); const { c, T } = await preparar(home, Array.from({ length: 10 }, () => PERSONA_SI()));
  const P = 'Túnel PL-09';
  try {
    const exp = fs.mkdtempSync(path.join(os.tmpdir(), 'exp g06 ')); fs.writeFileSync(path.join(exp, 'enunciado.md'), '# Túnel 150 m\nAncho 5 m, hastial 3 m (datos del enunciado).');
    await T('tannia_expediente_recibir', { proyecto: P, ruta: exp });
    const A = data(await T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: TUNEL(150) }));
    await T('tannia_planos', { proyecto: P, accion: 'a_partidas' });
    const ps = data(await T('tannia_partidas_listar', { proyecto: P })).partidas;
    for (const u of [...new Set(ps.map((p) => p.unidad))]) await T('tannia_apu_definir', { proyecto: P, codigo: `APU-${u}`, unidad: u, insumos: [{ tipo: 'material', descripcion: 'Precio de prueba', unidad: u, cantidad: 1, precio_unitario: 1000, fuente_precio: 'fixture de prueba', fecha_precio: '2026-11-18' }] });
    for (const p of ps) await T('tannia_partida_asignar_apu', { proyecto: P, codigo: p.codigo, apu: `APU-${p.unidad}` });
    for (const p of ps) await T('tannia_partida_verificar', { proyecto: P, codigo: p.codigo });
    await T('tannia_presupuesto_config', { proyecto: P, gastos_generales_pct: 0, utilidades_pct: 0, iva_pct: 19, alcance: 'parcial', alcance_descripcion: 'excavación, revestimiento y fortificación' });
    for (const e of ['analisis', 'borrador']) await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: e });
    await T('tannia_presupuesto_generar', { proyecto: P }); await T('tannia_informe_generar', { proyecto: P });
    await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'revision' });
    const ap = data(await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'aprobado' }));
    const roles = ap.archivos.map((a) => a.archivo);
    assert.ok(roles.some((x) => x.endsWith(`${A.revision}-conjunto.pdf`)) && roles.some((x) => x.endsWith(`${A.revision}-planos.dxf`)) && roles.some((x) => x.endsWith(`${A.revision}-cantidades.json`)), roles.join('\n'));
    // Un cambio de geometría después de aprobar: la aprobación deja de valer (no se exporta nada de la revisión anterior)
    await T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: TUNEL(120) });
    const ex = await T('tannia_entregable_exportar', { proyecto: P }, true); assert.equal(ex.isError, true); assert.equal(data(ex).error, 'APROBACION_NO_VIGENTE');
    // NEG-03: planos B vigentes con partidas de A (aunque se regeneren Excel y memoria) → la entrega no se puede aprobar
    const est = data(await T('tannia_entrega_estado', { proyecto: P })); assert.ok(est.pendientes.some((x) => /planos cambiaron/.test(x)), JSON.stringify(est.pendientes));
    await T('tannia_presupuesto_generar', { proyecto: P }); await T('tannia_informe_generar', { proyecto: P });
    await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'revision' });
    const re = await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'aprobado' }, true);
    assert.equal(re.isError, true); assert.equal(data(re).error, 'GATE_NO_CUMPLIDO'); assert.match(JSON.stringify(data(re)), /otra revisión de planos/);
    // Regenerar partidas desde B y re-verificar permite aprobar de nuevo: la entrega lleva los planos B
    await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'borrador' });
    await T('tannia_planos', { proyecto: P, accion: 'a_partidas' });
    for (const p of data(await T('tannia_partidas_listar', { proyecto: P })).partidas) await T('tannia_partida_verificar', { proyecto: P, codigo: p.codigo });
    await T('tannia_presupuesto_generar', { proyecto: P }); await T('tannia_informe_generar', { proyecto: P });
    await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'revision' });
    const B = data(await T('tannia_planos', { proyecto: P, accion: 'estado' })).head;
    const ap2 = data(await T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'aprobado' }));
    assert.ok(ap2.archivos.some((a) => a.archivo.endsWith(`${B}-cantidades.json`)) && !ap2.archivos.some((a) => a.archivo.includes(A.revision)));
    const ex2 = data(await T('tannia_entregable_exportar', { proyecto: P }));
    const carpeta = path.join(home, 'Proyectos', P, ...ex2.carpeta.split('/'));
    const man = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto-entrega.json'), 'utf8'));
    assert.equal(man.planos.revision, B); assert.match(man.planos.estado, /NO VERIFICADA/);
    for (const a of man.archivos) assert.ok(fs.existsSync(path.join(carpeta, path.basename(a.rel))), a.rel);
  } finally { await c.close(); }
});
