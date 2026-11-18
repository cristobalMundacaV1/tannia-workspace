// G04 (TW-PRO-E2E) / C-01 WorkOrder / E2E-040…043: el encargo se resuelve por resultados, con UNA ronda de preguntas, sin preguntar
// lo que ya está en los antecedentes y sin aceptar procedencias inventadas por el modelo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tmpHome, FIX, startClient, call, data } from './helpers.js';

const JERGA = /tannia_|JSON|MCP|servidor|herramienta|source_id|\.tannia|elicit/i;

async function sesion() {
  const home = tmpHome(); const c = await startClient(home);
  const T = async (n, a, falla = false) => { const r = await call(c.client, n, a); if (!falla) assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return r; };
  return { home, c, T };
}

test('E2E-040/041: túnel — datos con cita comprobada, rechazos de procedencia inventada, una ronda de preguntas y plan que avanza con el estado real', async () => {
  const { c, T } = await sesion(); const P = 'Túnel Encargo';
  try {
    await T('tannia_proyecto_crear', { nombre: P });
    const exp = fs.mkdtempSync(path.join(os.tmpdir(), 'exp g04 '));
    fs.writeFileSync(path.join(exp, 'enunciado.md'), '# Enunciado\nSe proyecta un túnel de un largo de 150 m y un ancho de 5,5 m para acceso minero.\nLa fortificación se definirá con pernos.');
    fs.copyFileSync(path.join(FIX, 'pdf', 'escaneado.pdf'), path.join(exp, 'croquis escaneado.pdf'));
    const rec = data(await T('tannia_expediente_recibir', { proyecto: P, ruta: exp }));
    const sid = (n) => rec.documentos.find((d) => d.archivo === n).source_id;

    const ini = await T('tannia_encargo', { proyecto: P, accion: 'iniciar', objetivo: 'Necesito planos, cubicaciones, presupuesto y memoria del túnel de 150 m con su fortificación' });
    assert.equal(data(ini).perfil, 'tunel'); assert.ok(!JERGA.test(data(ini).mensaje_para_la_persona), data(ini).mensaje_para_la_persona);

    const r = data(await T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [
      { clave: 'largo_m', valor: 150, unidad: 'm', estado: 'VERIFICADO', origen: { source_id: sid('enunciado.md'), cita: 'un largo de 150 m' } },
      { clave: 'ancho_m', valor: 6, unidad: 'm', estado: 'VERIFICADO', origen: { source_id: sid('enunciado.md'), cita: 'un ancho de 6 m' } }, // cita inventada
      { clave: 'ancho_m', valor: 6, unidad: 'm', estado: 'VERIFICADO', origen: { source_id: sid('enunciado.md'), cita: 'un ancho de 5,5 m' } }, // cita real, valor distinto
      { clave: 'altura_hastial_m', valor: 3, estado: 'VERIFICADO', origen: { source_id: sid('croquis escaneado.pdf'), cita: 'hastial 3 m' } }, // escaneado: sin texto verificable
      { clave: 'altura_hastial_m', valor: 3, estado: 'VERIFICADO', origen: { source_id: 'src-inventado00', cita: 'hastial 3 m' } },
      { clave: 'espesor_revestimiento_m', valor: 0.07, estado: 'DECLARADO', origen: { declarado_por: 'usuaria' } },
      { clave: 'ancho_m', valor: 550, unidad: 'cm', estado: 'DECLARADO', origen: { declarado_por: 'usuaria' } },
      { clave: 'perno_longitud_m', valor: 2.4, estado: 'HIPOTESIS', origen: {} },
      { clave: 'sobreexcavacion_m', valor: 0.1, estado: 'DECLARADO', origen: { declarado_por: 'usuaria' } },
    ] })).registro;
    assert.deepEqual(r.aceptados.map((x) => x.clave), ['largo_m']);
    assert.deepEqual(r.rechazados.map((x) => x.codigo), ['CITA_NO_ENCONTRADA', 'CITA_NO_RESPALDA_VALOR', 'FUENTE_SIN_TEXTO', 'FUENTE_INEXISTENTE', 'NO_SOPORTADO_POR_EL_MOTOR', 'UNIDAD_INCOMPATIBLE', 'HIPOTESIS_SIN_MOTIVO', 'DATO_DESCONOCIDO']);

    // Cita correcta del ancho: aceptada. El plan NO pregunta largo ni ancho (están en los antecedentes) y agrupa el resto.
    await T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [{ clave: 'ancho_m', valor: 5.5, unidad: 'm', estado: 'VERIFICADO', origen: { source_id: sid('enunciado.md'), cita: 'un ancho de 5,5 m' } }] });
    let plan = data(await T('tannia_encargo', { proyecto: P, accion: 'plan' }));
    const claves = plan.preguntas.map((p) => p.clave);
    assert.ok(!claves.includes('largo_m') && !claves.includes('ancho_m'), claves.join());
    for (const k of ['altura_hastial_m', 'espesor_revestimiento_m', 'perno_longitud_m', 'malla', 'gastos_generales_pct', 'iva_pct', 'precios_partidas']) assert.ok(claves.includes(k), k);
    assert.ok(plan.preguntas.every((p) => p.por_que && p.si_no_se_sabe));
    assert.equal(plan.resultados.find((x) => x.resultado === 'Planos').estado, 'BLOQUEADO'); assert.equal(plan.parametros_motor, null, 'sin hastial no hay parámetros (nunca un valor por defecto)');
    assert.ok(!JERGA.test(plan.mensaje_para_la_persona), plan.mensaje_para_la_persona); assert.match(plan.mensaje_para_la_persona, /necesito \d+ datos; se los pregunto todos juntos/);
    await T('tannia_encargo', { proyecto: P, accion: 'preguntas_hechas', claves });
    assert.ok(data(await T('tannia_encargo', { proyecto: P, accion: 'plan' })).preguntas.every((p) => p.ya_preguntada));

    // Respuestas de la persona (DECLARADO) en la misma ronda → planos LISTO con parámetros EXACTOS
    await T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [
      { clave: 'altura_hastial_m', valor: 3, unidad: 'm', estado: 'DECLARADO', origen: { declarado_por: 'usuaria en la conversación' } },
      { clave: 'espesor_revestimiento_m', valor: 0.06, unidad: 'm', estado: 'DECLARADO', origen: { declarado_por: 'usuaria en la conversación' } },
      { clave: 'perno_longitud_m', valor: 2.4, estado: 'HIPOTESIS', origen: { motivo: 'recomendado para el ejercicio académico' } },
      { clave: 'espaciamiento_transversal_m', valor: 1.5, estado: 'DECLARADO', origen: { declarado_por: 'usuaria' } },
      { clave: 'espaciamiento_longitudinal_m', valor: 1.5, estado: 'DECLARADO', origen: { declarado_por: 'usuaria' } },
      { clave: 'malla', valor: false, estado: 'DECLARADO', origen: { declarado_por: 'usuaria' } },
    ] });
    plan = data(await T('tannia_encargo', { proyecto: P, accion: 'plan' }));
    assert.deepEqual(plan.parametros_motor, { length: 150, width: 5.5, wall: 3, selected: 0.06, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: false } });
    assert.ok(!plan.preguntas.some((p) => p.clave === 'traslapo_malla_pct'), 'sin malla no se pregunta traslapo');
    assert.equal(plan.hipotesis.length, 1); assert.match(plan.mensaje_para_la_persona, /hipótesis/);
    assert.equal(plan.resultados.find((x) => x.resultado === 'Planos').estado, 'LISTO');

    // El plan sigue el estado REAL: planos → cubicaciones → presupuesto parcial (sin precios) → desactualizado si cambia el largo
    await T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: plan.parametros_motor });
    plan = data(await T('tannia_encargo', { proyecto: P, accion: 'plan' }));
    assert.equal(plan.resultados.find((x) => x.resultado === 'Planos').estado, 'HECHO'); assert.equal(plan.resultados.find((x) => x.resultado === 'Cubicaciones').estado, 'LISTO');
    await T('tannia_planos', { proyecto: P, accion: 'a_partidas' });
    plan = data(await T('tannia_encargo', { proyecto: P, accion: 'plan' }));
    assert.equal(plan.resultados.find((x) => x.resultado === 'Cubicaciones').estado, 'HECHO'); assert.equal(plan.resultados.find((x) => x.resultado === 'Presupuesto (Excel)').estado, 'PARCIAL');
    assert.equal(plan.resultados.find((x) => x.resultado === 'Carpeta de entrega').estado, 'AUTORIZACION_PENDIENTE');
    await T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [{ clave: 'largo_m', valor: 120, unidad: 'm', estado: 'DECLARADO', origen: { declarado_por: 'usuaria: corrige el largo' } }] });
    await T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: data(await T('tannia_encargo', { proyecto: P, accion: 'plan' })).parametros_motor });
    plan = data(await T('tannia_encargo', { proyecto: P, accion: 'plan' }));
    assert.equal(plan.resultados.find((x) => x.resultado === 'Cubicaciones').estado, 'DESACTUALIZADO');
    assert.ok(plan.datos.largo_m.estado === 'DECLARADO' && plan.datos.largo_m.valor === 120);
  } finally { await c.close(); }
});

test('E2E-041: encargo de una especialidad sin perfil validado — se dice con honestidad, sin inventar planos', async () => {
  const { c, T } = await sesion();
  try {
    await T('tannia_proyecto_crear', { nombre: 'Alumbrado' });
    const p = data(await T('tannia_encargo', { proyecto: 'Alumbrado', accion: 'iniciar', objetivo: 'Diseña la red de alumbrado público de la villa' }));
    assert.equal(p.perfil, null); assert.ok(p.resultados.every((r) => r.estado === 'NO_SOPORTADO'));
    assert.match(p.mensaje_para_la_persona, /no tengo un generador de planos validado/); assert.ok(!JERGA.test(p.mensaje_para_la_persona));
  } finally { await c.close(); }
});
