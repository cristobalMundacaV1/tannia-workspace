// TW09-05/06: enrutador de capacidades honesto, política de autonomía y respuestas acotadas. Escenarios de conversación natural.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluarEncargo, POLITICA } from '../src/politica/autonomia.js';
import { INSTRUCCIONES } from '../src/server.js';
import { ok, MAX_JSON_TEXTO } from '../src/mcp/util.js';
import { tmpHome, startClient, call, data } from './helpers.js';

test('encargos: cada tipo se enruta a la capacidad REAL y lo no soportado se dice con honestidad (sin casa hardcodeada)', () => {
  const casa = evaluarEncargo({ solicitud: 'Quiero una casa de un piso de unos 80 m2 con 3 dormitorios y 2 baños, y verla en 3D', superficie_m2: 80, dormitorios: 3, banos: 2 });
  assert.equal(casa.capacidad, 'anteproyecto_vivienda'); assert.ok(casa.pasos_sugeridos.some((p) => /tannia_3d_crear/.test(p))); assert.deepEqual(casa.datos_esenciales_faltantes, []); assert.ok(casa.supuestos_permitidos.length);
  const galpon = evaluarEncargo({ solicitud: 'Un galpón de 20 por 10 metros con cubierta a un agua', tipo_edificacion: 'galpon', dimensiones_conocidas: true });
  assert.equal(galpon.capacidad, 'modelo_3d_estructurado'); assert.ok(galpon.datos_esenciales_faltantes.some((f) => /Pendiente/.test(f)) && galpon.datos_esenciales_faltantes.some((f) => /supuestos editables/.test(f)));
  const dosPisos = evaluarEncargo({ solicitud: 'casa de dos pisos', pisos: 2, dormitorios: 3 }); assert.equal(dosPisos.capacidad, 'modelo_3d_estructurado', 'el generador 2D es de un piso: no se promete'); assert.match(dosPisos.limites_a_comunicar.join(' '), /sin estructura|Motor 3D/); assert.ok(dosPisos.supuestos_permitidos.some((s) => /niveles/.test(s)));
  const grande = evaluarEncargo({ solicitud: 'casa', superficie_m2: 250, dormitorios: 3 }); assert.equal(grande.capacidad, 'modelo_3d_estructurado');
  const irreg = evaluarEncargo({ solicitud: 'casa con forma de L', forma: 'irregular' }); assert.equal(irreg.capacidad, 'modelo_3d_estructurado');
  for (const s of ['Hazme el modelo IFC en Revit', 'Calcula la estructura y dimensiona las vigas y pilares', 'Necesito los planos de permiso de edificación firmados', 'Diseña las instalaciones eléctricas']) { const r = evaluarEncargo({ solicitud: s }); assert.equal(r.capacidad, 'no_soportado', s); assert.equal(r.soportado, false); assert.ok(r.limites_a_comunicar.length && r.alternativas.length, s); }
  const mixto = evaluarEncargo({ solicitud: 'Haz un anteproyecto 3D de la casa, sin cálculo estructural', superficie_m2: 90, dormitorios: 3 }); assert.equal(mixto.capacidad, 'anteproyecto_vivienda'); assert.match(mixto.limites_a_comunicar.join(' '), /Fuera de alcance/);
  const antec = evaluarEncargo({ solicitud: 'Mide y cubica el plano que te adjunté', antecedentes: { dwg: true, pdf: true } }); assert.equal(antec.capacidad, 'trabajo_sobre_antecedentes'); assert.match(antec.limites_a_comunicar.join(' '), /DWG no se lee fuera de AutoCAD/); assert.match(antec.limites_a_comunicar.join(' '), /calibración/);
  assert.equal(evaluarEncargo({}).capacidad, 'anteproyecto_vivienda', 'sin datos se asume vivienda estándar pero se piden los datos esenciales'); assert.ok(evaluarEncargo({}).datos_esenciales_faltantes.length >= 1);
  assert.ok(casa.requiere_profesional.includes('cálculo estructural'));
});

test('política y instrucciones del servidor: cuatro categorías, nunca automático, sin "preguntar siempre", adjuntos y respuestas breves', () => {
  assert.deepEqual(Object.keys(POLITICA), ['actuar', 'suponer_y_declarar', 'preguntar', 'detenerse', 'nunca_automatico']); assert.ok(POLITICA.nunca_automatico.some((x) => /cumplimiento normativo/.test(x)) && POLITICA.nunca_automatico.some((x) => /adjunto/.test(x)));
  for (const k of ['ACTUAR', 'SUPONER Y DECLARAR', 'PREGUNTAR', 'DETENERSE', 'tannia_encargo_evaluar', 'tannia_proyecto_importar', 'DATO', 'no le pida ids']) assert.ok(INSTRUCCIONES.includes(k) || INSTRUCCIONES.toLowerCase().includes(k.toLowerCase()), k);
  assert.ok(!/pregunte a la usuaria\.$/m.test(INSTRUCCIONES.split('\n').find((l) => l.startsWith('2)')) || ''), 'ya no se ordena preguntar por todo');
  assert.match(INSTRUCCIONES, /Nunca invente precios, unidades, escalas ni cumplimiento normativo/); assert.match(INSTRUCCIONES, /artefacto generado, persistencia verificada, revisión profesional y cumplimiento normativo/);
});

test('respuestas: el JSON del texto se acota (detalle completo en structuredContent) y los resúmenes breves no se tocan', () => {
  const grande = { filas: Array.from({ length: 2000 }, (_, i) => ({ i, texto: 'x'.repeat(20) })) }; const r = ok('Listo.', grande);
  assert.ok(r.content[0].text.length < MAX_JSON_TEXTO + 800); assert.match(r.content[0].text, /recortado/); assert.equal(r.structuredContent.filas.length, 2000, 'el detalle completo se conserva');
  const chico = ok('Listo.', { a: 1 }); assert.doesNotMatch(chico.content[0].text, /recortado/); assert.equal(chico.structuredContent.a, 1);
});

test('MCP: tannia_encargo_evaluar y tannia_politica_autonomia disponibles; el flujo de encargos del producto no pide nada técnico a la usuaria', async () => {
  const home = tmpHome('Tannia ñ pol '); const cli = await startClient(home); const c = cli.client;
  try {
    const t = (await c.listTools()).tools; for (const n of ['tannia_encargo_evaluar', 'tannia_politica_autonomia']) assert.ok(t.some((x) => x.name === n), n);
    let r = await call(c, 'tannia_encargo_evaluar', { solicitud: 'Oye, crea un proyecto que se llame Casa Los Robles. Aquí tienes los antecedentes. Necesito una propuesta 3D', antecedentes: { pdf: true }, pide: ['3d'] }); assert.ok(!r.isError); assert.ok(['anteproyecto_vivienda', 'trabajo_sobre_antecedentes', 'modelo_3d_estructurado'].includes(data(r).capacidad)); assert.ok(data(r).limites_a_comunicar.length);
    r = await call(c, 'tannia_encargo_evaluar', { solicitud: 'hazme el IFC' }); assert.equal(data(r).capacidad, 'no_soportado'); assert.match(r.content[0].text, /No soportado/);
    r = await call(c, 'tannia_politica_autonomia', {}); assert.ok(data(r).actuar.ejemplos.length);
    // el proyecto de la prueba final se crea y se resuelve sin que la usuaria nombre herramientas ni ids
    await call(c, 'tannia_proyecto_crear', { nombre: 'Casa Los Robles' }); r = await call(c, 'tannia_proyecto_resolver', { texto: 'la casa los robles' }); assert.equal(data(r).estado, 'unico');
    const tools = t.filter((x) => /^tannia_(3d|diseno)_/.test(x.name)); assert.ok(tools.length >= 15);
  } finally { await cli.close(); fs.rmSync(home, { recursive: true, force: true }); }
});
