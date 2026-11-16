// Contrato de comunicación (directiva final §3). Estas pruebas verifican el SERVIDOR (preferencia, precedencia, persistencia, advertencias en el texto, instrucciones).
// NO demuestran que Claude Desktop responda breve: eso se comprueba en campo con docs/tw11/entrega/PROTOCOLO_COMUNICACION_DESKTOP.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpHome, startClient, call, data } from './helpers.js';
import { advertenciasCriticas, GUIA, NIVELES } from '../src/cic/comunicacion.js';

const M = (value, unit = 'm') => ({ value, unit });
const calc = (c, extra = {}) => call(c, 'tannia_cic_calcular', { operacion: 'earth.volume_estimate', entradas: { stations: M([0, 20, 40]), cut_areas: M([10, 30, 20], 'm2'), fill_areas: M([0, 0, 5], 'm2'), cut_to_fill_factor: { value: 0.9, unit: null } }, ...extra });
const nivel = (c, args) => call(c, 'tannia_comunicacion', args);

test('1–3: breve por defecto; cambio a normal y a detallado; una solicitud explícita del mensaje actual prevalece sobre la preferencia persistente', async () => {
  const { client: c, close } = await startClient(tmpHome('Tannia ñ com '), undefined, { TANNIA_CIC: 'on' });
  try {
    let d = data(await nivel(c, { accion: 'ver' })); assert.deepEqual([d.nivel, d.origen], ['breve', 'predeterminado']); assert.match(d.guia, /30–100 palabras/); assert.deepEqual(d.precedencia.length, 4);
    let r = await nivel(c, { accion: 'establecer', nivel: 'normal' }); assert.ok(!r.isError); assert.match(r.content[0].text, /NORMAL/); assert.ok(r.content[0].text.split('\n\n')[0].length < 140, 'la confirmación es de una frase');
    d = data(await nivel(c, { accion: 'ver' })); assert.deepEqual([d.nivel, d.origen], ['normal', 'global']);
    await nivel(c, { accion: 'establecer', nivel: 'detallado' }); d = data(await nivel(c, { accion: 'ver' })); assert.equal(d.nivel, 'detallado'); assert.match(d.guia, /sin límite artificial/i);
    await nivel(c, { accion: 'establecer', nivel: 'breve' });
    d = data(await nivel(c, { accion: 'ver', solicitado: 'detallado' })); assert.deepEqual([d.nivel, d.origen], ['solicitud_actual', 'solicitud_actual'].map((x, i) => (i ? x : 'detallado')), 'una petición puntual detallada gana sobre la preferencia breve');
    assert.equal(d.global, 'breve'); // y NO cambió la preferencia persistente
    d = data(await nivel(c, { accion: 'restablecer' })); assert.equal(d.origen, 'predeterminado');
    assert.equal((await nivel(c, { accion: 'establecer' })).isError, true); assert.equal((await nivel(c, { accion: 'establecer', nivel: 'normal', alcance: 'proyecto' })).isError, true);
  } finally { await close(); }
});

test('5–6: la preferencia sobrevive al cierre y reapertura; la preferencia de proyecto prevalece sobre la global; otro proyecto usa la global', async () => {
  const home = tmpHome('Tannia ñ com2 '); let s = await startClient(home, undefined, { TANNIA_CIC: 'on' });
  try { await call(s.client, 'tannia_proyecto_crear', { nombre: 'Obra A' }); await call(s.client, 'tannia_proyecto_crear', { nombre: 'Obra B' }); await nivel(s.client, { accion: 'establecer', nivel: 'detallado' }); await nivel(s.client, { accion: 'establecer', nivel: 'breve', alcance: 'proyecto', proyecto: 'Obra A' }); } finally { await s.close(); }
  s = await startClient(home, undefined, { TANNIA_CIC: 'on' });
  try {
    assert.match(s.client.getInstructions(), /Preferencia global de comunicación vigente al iniciar: DETALLADO/); // el servidor nuevo ya la conoce
    let d = data(await nivel(s.client, { accion: 'ver' })); assert.deepEqual([d.nivel, d.origen], ['detallado', 'global']);
    d = data(await nivel(s.client, { accion: 'ver', proyecto: 'Obra A' })); assert.deepEqual([d.nivel, d.origen, d.proyecto, d.global], ['breve', 'proyecto', 'breve', 'detallado']);
    d = data(await nivel(s.client, { accion: 'ver', proyecto: 'Obra B' })); assert.deepEqual([d.nivel, d.origen], ['detallado', 'global']);
    d = data(await nivel(s.client, { accion: 'ver', proyecto: 'Obra A', solicitado: 'normal' })); assert.deepEqual([d.nivel, d.origen], ['normal', 'solicitud_actual']);
    // las respuestas de las herramientas CIC indican el nivel vigente del PROYECTO consultado
    const r = await calc(s.client, { proyecto: 'Obra A', caso: 'c1' }); assert.match(r.content[0].text, /\[Nivel de respuesta: breve \(proyecto\)/); const r2 = await calc(s.client, { proyecto: 'Obra B', caso: 'c1' }); assert.match(r2.content[0].text, /\[Nivel de respuesta: detallado \(global\)/);
  } finally { await s.close(); }
  // el archivo de preferencia no ensucia los originales ni los proyectos ajenos: vive en la carpeta de configuración global o en .tannia del proyecto
  const fs = await import('node:fs'); const path = await import('node:path'); assert.ok(fs.existsSync(path.join(home, '.tannia-config', 'comunicacion.json'))); assert.ok(fs.existsSync(path.join(home, 'Proyectos', 'Obra A', '.tannia', 'comunicacion.json'))); assert.ok(!fs.existsSync(path.join(home, 'Proyectos', 'Obra B', '.tannia', 'comunicacion.json')));
});

test('8–9: las advertencias críticas aparecen en el TEXTO en los tres niveles, agrupadas en una línea, y los datos estructurados son idénticos (sin pérdida)', async () => {
  const { client: c, close } = await startClient(tmpHome('Tannia ñ com3 '), undefined, { TANNIA_CIC: 'on' }); const salidas = {};
  try {
    for (const n of NIVELES) { await nivel(c, { accion: 'establecer', nivel: n }); const r = await calc(c); assert.ok(!r.isError); salidas[n] = r; const t = r.content[0].text; assert.match(t, /⚠ Atención:.*revisión de: ingeniero_vial_o_civil/, n); assert.match(t, /mixta|transición|ESTIMACIÓN|estimación/i, 'la advertencia técnica no se oculta'); assert.equal((t.match(/⚠ Atención/g) || []).length, 1, 'una sola línea agrupada'); assert.match(t, new RegExp(`\\[Nivel de respuesta: ${n} `)); assert.ok(t.includes('```json'), 'el detalle estructurado sigue en el texto'); }
    const quitar = (r) => { const { nivel_respuesta, ...resto } = r.structuredContent; return resto; };
    assert.deepEqual(quitar(salidas.breve), quitar(salidas.normal)); assert.deepEqual(quitar(salidas.breve), quitar(salidas.detallado));
    assert.equal(salidas.breve.structuredContent.resultados.net_balance.valor !== undefined, true); assert.ok(salidas.breve.structuredContent.input_hash); assert.ok(salidas.breve.structuredContent.claims.length >= 4, 'hashes, unidades y claims completos aunque el nivel sea breve');
  } finally { await close(); }
  // agrupación: no se repiten diez advertencias parecidas
  const g = advertenciasCriticas({ advertencias: Array.from({ length: 10 }, (_, i) => `aviso ${i}`), fallidos: [{ codigo: 'X' }, { codigo: 'X' }], claims_desactualizados: ['a', 'b'], fuentes_no_vigentes: [{ motivo: 'retirada' }, { motivo: 'retirada' }] }); assert.ok(g.length <= 4); assert.ok(g.some((x) => /2 paso\(s\) fallaron \(X\)/.test(x)) && g.some((x) => /2 resultado\(s\) desactualizado/.test(x)) && g.some((x) => /retirada/.test(x)));
});

test('7: ninguna respuesta de herramienta narra («voy a…», «procederé…», «a continuación…») y las instrucciones lo prohíben; errores sin repetir causas inventadas', async () => {
  const { client: c, close } = await startClient(tmpHome('Tannia ñ com4 '), undefined, { TANNIA_CIC: 'on' }); const NARRA = /\b(voy a|procederé|a continuación|ahora consultaré|ya casi|déjame|permíteme)\b/i;
  try {
    const t = c.getInstructions(); assert.match(t, /no narre herramientas/i); assert.match(t, /voy a revisar/i); assert.match(t, /español de Chile/); assert.match(t, /30–100 palabras/); assert.match(t, /advertencias críticas/i); assert.match(t, /tannia_comunicacion/);
    await call(c, 'tannia_proyecto_crear', { nombre: 'P' }); const respuestas = [await calc(c), await call(c, 'tannia_cic_catalogo', { tipo: 'operaciones' }), await call(c, 'tannia_comunicacion', { accion: 'ver' }), await call(c, 'tannia_cic_calcular', { operacion: 'no.existe', entradas: {} }), await call(c, 'tannia_cic_conocimiento', { proyecto: 'P', accion: 'buscar', consultas: ['algo que no existe'] }), await call(c, 'tannia_cic_edificacion', { proyecto: 'P', caso: 'd', accion: 'generar_unidad', programa: { tipologia: 'departamento', nombre: 'D', superficie_m2: 60, nivel: { indice: 3 } } })];
    for (const r of respuestas) { const cab = r.content[0].text.split('\n\n```json')[0]; assert.ok(!NARRA.test(cab), cab); }
    const err = respuestas[3]; assert.equal(err.isError, true); assert.match(err.content[0].text, /OPERACION_DESCONOCIDA/); assert.ok(!/\[Nivel de respuesta/.test(err.content[0].text), 'los errores no se adornan');
  } finally { await close(); }
});

test('10: compatibilidad — con CIC apagado no existe la herramienta ni cambia nada; con CIC activado las herramientas anteriores no cambian su salida (solo se agregan las nuevas)', async () => {
  const off = await startClient(tmpHome('Tannia ñ off2 '), undefined, { TANNIA_CIC: 'off' }); const on = await startClient(tmpHome('Tannia ñ on2 '), undefined, { TANNIA_CIC: 'on' });
  try {
    assert.ok(!(await off.client.listTools()).tools.some((t) => t.name === 'tannia_comunicacion')); assert.equal((await off.client.listTools()).tools.length, 72); assert.equal((await on.client.listTools()).tools.length, 84);
    for (const nombre of ['tannia_diagnostico', 'tannia_politica_autonomia']) { const a = await call(off.client, nombre, {}); const b = await call(on.client, nombre, {}); assert.ok(!/Nivel de respuesta/.test(b.content[0].text), 'las herramientas anteriores no se tocan'); if (nombre === 'tannia_politica_autonomia') assert.deepEqual(data(a), data(b)); }
    await nivel(on.client, { accion: 'establecer', nivel: 'detallado' }); const e = await call(on.client, 'tannia_encargo_evaluar', { solicitud: 'casa de 90 m2 con 3 dormitorios' }); assert.ok(!/Nivel de respuesta/.test(e.content[0].text));
  } finally { await off.close(); await on.close(); }
  assert.ok(GUIA.breve && GUIA.normal && GUIA.detallado);
});
