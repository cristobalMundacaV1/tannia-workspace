// F09 — alcance real de la visual cocina→piscina: preliminar sin punto confirmado, evaluación explícita con punto confirmado, sin acreditar seguridad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { visual } from '../src/architect/habitabilidad.js';
import { evaluarEsquema } from '../src/architect/evaluacion.js';
import { generarPartido } from '../src/architect/partidos.js';
import { derivarEsquema } from '../src/architect/derivar_poly.js';
import { interpretarEncargo } from '../src/architect/briefing.js';
import { tmpHome, startClient, call, data } from './helpers.js';

const ROBLES = fs.readFileSync(new URL('./fixtures_tw10/encargo_los_robles.txt', import.meta.url), 'utf8');
const texto = (r) => r.content.map((c) => c.text).join('\n');
const L = () => generarPartido('L_con_patio', { superficie_m2: 90, piscina: true });

test('F09 — sin punto confirmado: visual geométrica PRELIMINAR; expone mejor/media/peor, punto usado, 9 muestras, obstrucciones y datos faltantes; el índice NO es el mejor punto', () => {
  for (const c of ['L_con_patio', 'dos_alas']) {
    const r = generarPartido(c, { superficie_m2: 90, piscina: true }); const v = visual(r.esquema, r.geo, { desde: 'R-COC', hacia: 'pool_play_zone' });
    assert.equal(v.conclusion, 'visual_geometrica_preliminar'); assert.equal(v.puntos_de_observacion_usados.length, 9); assert.equal(v.objetivo_muestras, 16);
    assert.ok(v.fraccion_visible_mejor_punto >= v.fraccion_visible_media_recinto && v.fraccion_visible_media_recinto >= v.fraccion_visible_peor_punto);
    assert.deepEqual(Object.keys(v.punto_observacion_mejor).sort(), ['fraccion_visible', 'x_mm', 'y_mm']); assert.equal(v.indice_usado.valor, v.fraccion_visible_media_recinto); assert.match(v.indice_usado.regla, /media de 9 muestras/);
    assert.ok(v.obstruyen.length >= 1 && v.obstruyen.every((o) => o.elemento && o.rayos_bloqueados > 0 && o.de === 144));
    const f = v.datos_faltantes.join(' | '); for (const x of ['Mobiliario, encimera', 'Posición real de trabajo', 'Altura real de los ojos']) assert.match(f, new RegExp(x));
    assert.match(v.limites, /NO acredita supervisión desde el lugar real/); assert.match(v.limites, /NUNCA acredita seguridad de la piscina/); assert.deepEqual(v.puntos_confirmados, []);
  }
  const u = generarPartido('dos_alas', { superficie_m2: 90, piscina: true }); const vu = visual(u.esquema, u.geo, { desde: 'R-COC', hacia: 'pool_play_zone' });
  assert.ok(vu.fraccion_visible_mejor_punto - vu.fraccion_visible_media_recinto > 0.3, 'caso donde el mejor punto sobrestima (mejor 0,56 vs media 0,12)');
});

test('F09 — en la evaluación el objetivo visual es «parcial» (preliminar) con el índice = media, nunca «evaluado» con el mejor punto', () => {
  const { brief } = interpretarEncargo(ROBLES, { projectId: 'p' }); const u = generarPartido('dos_alas', { superficie_m2: 90, piscina: true });
  const e = evaluarEsquema({ esq: u.esquema, geo: u.geo, brief }); const o = e.objetivos.find((x) => x.kind === 'sightline'); const v = e.detalle.visuales[0];
  assert.equal(o.estado, 'parcial'); assert.equal(o.score, v.fraccion_visible_media_recinto); assert.ok(o.score < v.fraccion_visible_mejor_punto); assert.match(o.evidencia[0], /PRELIMINAR/); assert.match(o.aviso, /nunca acredita seguridad de la piscina/);
  const m = e.analisis.metrics.find((x) => x.id === 'visual_R-COC_pool_play_zone'); assert.equal(m.valor, v.fraccion_visible_media_recinto); assert.match(m.metodo, /preliminar/);
});

test('F09 — con un punto de observación CONFIRMADO se evalúa explícitamente (mínimo entre confirmados) y deja de ser preliminar; no se inventan muebles', () => {
  const r = L(); const n = r.geo.recintos['R-COC'].neto;
  const pto = (e, x, y) => ({ recinto: 'R-COC', etiqueta: e, x_mm: Math.round(x), y_mm: Math.round(y) });
  const sur = pto('junto al muro sur', (n.x0 + n.x1) / 2, n.y0 + 0.15 * (n.y1 - n.y0)); const norte = pto('junto a la ventana norte', (n.x0 + n.x1) / 2, n.y0 + 0.85 * (n.y1 - n.y0));
  const v = visual(r.esquema, r.geo, { desde: 'R-COC', hacia: 'pool_play_zone', observadores: [sur, norte] });
  assert.equal(v.conclusion, 'visual_en_punto_confirmado'); assert.equal(v.puntos_confirmados.length, 2); for (const c of v.puntos_confirmados) { assert.equal(typeof c.fraccion_visible, 'number'); assert.ok(['visible', 'parcial', 'obstruida'].includes(c.estado)); }
  assert.equal(v.indice_usado.valor, Math.min(...v.puntos_confirmados.map((c) => c.fraccion_visible))); assert.match(v.indice_usado.regla, /mínimo entre los puntos de observación CONFIRMADOS/);
  assert.ok(!v.datos_faltantes.some((d) => /^Posición real/.test(d))); assert.ok(v.datos_faltantes.some((d) => /Mobiliario, encimera/.test(d)), 'el mobiliario sigue sin modelarse');
  const fuera = visual(r.esquema, r.geo, { desde: 'R-COC', hacia: 'pool_play_zone', observadores: [pto('fuera', n.x0 - 5000, n.y0)] }); assert.equal(fuera.puntos_confirmados[0].estado, 'fuera_del_recinto'); assert.equal(fuera.conclusion, 'visual_geometrica_preliminar');
  const { brief } = interpretarEncargo(ROBLES, { projectId: 'p' }); const e = evaluarEsquema({ esq: r.esquema, geo: r.geo, brief, observadores: [sur] }); const o = e.objetivos.find((x) => x.kind === 'sightline');
  assert.equal(o.estado, 'evaluado'); assert.equal(o.score, e.detalle.visuales[0].puntos_confirmados[0].fraccion_visible); assert.match(o.evidencia[0], /punto confirmado «junto al muro sur»/); assert.ok(!/segur[ao]\b/i.test(o.evidencia.join(' ').replace(/seguridad/gi, '')));
});

test('F09 — obstrucción adversarial: sin ventana de cocina al patio la visual es obstruida y se nombra el elemento que obstruye con su conteo', () => {
  const r = L(); const sin = JSON.parse(JSON.stringify(r.esquema)); sin.openings = sin.openings.filter((o) => !(o.entre[0] === 'R-COC' && o.tipo === 'ventana')); const g = derivarEsquema(sin);
  const v = visual(sin, g, { desde: 'R-COC', hacia: 'pool_play_zone' }); assert.equal(v.estado, 'obstruida'); assert.equal(v.fraccion_visible_mejor_punto, 0); assert.equal(v.indice_usado.valor, 0);
  assert.ok(v.obstruyen.some((o) => /muro/.test(o.elemento) && o.rayos_bloqueados >= 100), JSON.stringify(v.obstruyen));
});

test('F09 (servicio/MCP) — «punto_observacion» crea versión nueva sin tocar la geometría, cambia el análisis de forma trazable y se puede quitar; entradas inválidas se rechazan', async () => {
  const cli = await startClient(tmpHome('Tannia ñ f09 ')); const c = cli.client; const P = 'Fixture F09'; const E = 'E';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P }); await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: ROBLES }); await call(c, 'tannia_arq_generar_alternativas', { proyecto: P, estudio: E });
    const vis = async () => data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'visuales' })).visuales[0];
    const antes = await vis(); assert.equal(antes.conclusion, 'visual_geometrica_preliminar');
    let r = await call(c, 'tannia_arq_refinar', { proyecto: P, estudio: E, operacion: 'punto_observacion', alternativa: 'alt-L_con_patio', recinto: 'R-COC', etiqueta: 'junto a la encimera', junto_a: 'N' }); assert.ok(!r.isError, texto(r).slice(0, 300));
    const ref = data(r); assert.ok(ref.cambios.every((x) => x.geometria_cambio === false)); assert.match(ref.descripcion, /confirmado «junto a la encimera»/);
    const dsp = await vis(); assert.equal(dsp.conclusion, 'visual_en_punto_confirmado'); assert.equal(dsp.puntos_confirmados[0].etiqueta, 'junto a la encimera'); assert.ok(dsp.datos_faltantes.every((d) => !/^Posición real/.test(d)));
    const res = texto(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio' })); assert.ok(/punto confirmado «junto a la encimera»/.test(res)); assert.ok(!/recortado/.test(res));
    r = await call(c, 'tannia_arq_refinar', { proyecto: P, estudio: E, operacion: 'punto_observacion', alternativa: 'alt-L_con_patio', recinto: 'R-COC', etiqueta: 'junto a la encimera', quitar: true }); assert.ok(!r.isError); assert.equal((await vis()).conclusion, 'visual_geometrica_preliminar');
    for (const a of [{ recinto: 'R-XX', etiqueta: 'x', junto_a: 'N' }, { recinto: 'R-COC', etiqueta: 'x' }, { recinto: 'R-COC', etiqueta: 'x', fx: 2, fy: 0.5 }, { recinto: 'R-COC', junto_a: 'N' }]) { r = await call(c, 'tannia_arq_refinar', { proyecto: P, estudio: E, operacion: 'punto_observacion', alternativa: 'alt-L_con_patio', ...a }); assert.equal(r.isError, true, JSON.stringify(a)); }
    const h = data(await call(c, 'tannia_arq_ver', { proyecto: P, estudio: E, historial: 'listar' })); assert.equal(h.versiones.length, 4, 'v001 encargo, v002 generar, v003 punto, v004 quitar');
  } finally { await cli.close(); }
});
