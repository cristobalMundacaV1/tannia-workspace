// Auditoría de campo G10 — F01 (respuestas compactas), F04 (métricas interpretadas), F05 (alertas recuperables), lectura sin versiones.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tmpHome, startClient, call, data } from './helpers.js';
import { MAX_JSON_TEXTO } from '../src/mcp/util.js';
import { SECCIONES } from '../src/architect/respuestas.js';
import { generarAlternativas } from '../src/architect/alternativas.js';
import { interpretarEncargo, programaDeBrief } from '../src/architect/briefing.js';
import { evaluarEsquema } from '../src/architect/evaluacion.js';

const ROBLES = fs.readFileSync(new URL('./fixtures_tw10/encargo_los_robles.txt', import.meta.url), 'utf8');
const texto = (r) => r.content.map((c) => c.text).join('\n');
const jsonDelTexto = (r) => { const m = /```json\n([\s\S]*?)\n```/.exec(texto(r)); return m ? m[1] : ''; };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

async function preparar() {
  const home = tmpHome('Tannia ñ campo '); const cli = await startClient(home); const c = cli.client; const P = 'Fixture Aislado Robles'; const E = 'Estudio Robles';
  await call(c, 'tannia_proyecto_crear', { nombre: P });
  let r = await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: ROBLES }); assert.ok(!r.isError);
  r = await call(c, 'tannia_arq_generar_alternativas', { proyecto: P, estudio: E }); assert.ok(!r.isError, texto(r).slice(0, 300));
  return { home, cli, c, P, E, dir: path.join(home, 'Proyectos', P, '03 Trabajo', 'Arquitectura', E) };
}

test('F01/F04/F05 — resumen por defecto: cabe sin truncar y trae alertas exactas, m² y % de circulación, índice de envolvente y TODOS los objetivos', async () => {
  const { cli, c, P, E } = await preparar();
  try {
    const r = await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio' }); assert.ok(!r.isError); const d = data(r); const t = texto(r);
    assert.ok(!t.includes('(recortado)') && !t.includes('Detalle truncado'), 'el texto no debe recortarse'); assert.ok(jsonDelTexto(r).length < MAX_JSON_TEXTO - 500, `JSON del texto ${jsonDelTexto(r).length}`);
    assert.equal(d.seccion, 'resumen'); assert.ok(JSON.stringify(d).length < 7000, `datos ${JSON.stringify(d).length}`);
    // alertas críticas EXACTAS con código, texto y acción (F05), en datos y en el texto visible
    const crit = d.alertas_criticas; assert.ok(crit.length >= 2); for (const a of crit) { assert.match(a.codigo, /^[A-Za-z_0-9-]+$/); assert.ok(a.texto.length > 20); assert.ok(a.accion_recomendada.length > 20); assert.ok(t.includes(a.texto), `falta en el texto: ${a.codigo}`); assert.ok(!/\bcumple\b|es segura\b/i.test(a.texto + a.accion_recomendada.replace(/no declarar seguridad/gi, ''))); }
    assert.ok(crit.some((a) => a.codigo === 'piscina_barrera') && crit.some((a) => /^puerta_directa_/.test(a.codigo)));
    // circulación (F04): m², %, fórmula, límites
    assert.equal(typeof d.circulacion.superficie_m2, 'number'); assert.equal(typeof d.circulacion.porcentaje_de_superficie_util, 'number'); assert.match(d.circulacion.formula, /÷ superficie útil neta/); assert.match(t, new RegExp(`${String(d.circulacion.superficie_m2).replace('.', ',')} m²`)); assert.match(d.circulacion.limites, /no mide flujo real/);
    // índice de envolvente (F04): valor + fórmula + NO es costo
    assert.equal(typeof d.indice_envolvente.valor, 'number'); assert.match(d.indice_envolvente.formula, /perímetro/); assert.match(d.indice_envolvente.lectura, /NO significa 35 % más costo|NO significa .* más costo/); assert.match(t, /más costo/);
    // objetivos esenciales: todos y con estado
    const k = d.objetivos.map((o) => o.objetivo); for (const x of ['sightline', 'daylight_preference', 'summer_cooling', 'circulation_minimal', 'courtyard', 'cost_saving']) assert.ok(k.includes(x), x);
    for (const o of d.objetivos) { assert.ok(['evaluado', 'parcial', 'no_evaluado', 'alerta'].includes(o.estado)); if (o.estado !== 'no_evaluado' && o.estado !== 'alerta') assert.equal(typeof o.indice, 'number'); assert.ok(t.includes(o.objetivo)); }
    assert.match(d.escala_indice_objetivos, /No es un porcentaje de satisfacción/); assert.match(t, /NO significa seguridad infantil/);
    assert.ok(d.como_ver_mas.includes('seccion'));
  } finally { await cli.close(); }
});

test('F01 — cada sección es consultable, cabe sin truncar y trae evidencia, unidades y límites; "completo" conserva el contrato anterior', async () => {
  const { cli, c, P, E } = await preparar();
  try {
    for (const s of SECCIONES.filter((x) => !['resumen', 'completo'].includes(x))) {
      const r = await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: s }); assert.ok(!r.isError, `${s}: ${texto(r).slice(0, 200)}`);
      assert.equal(data(r).seccion, s); const len = jsonDelTexto(r).length; assert.ok(len < MAX_JSON_TEXTO, `${s}: ${len} caracteres`); assert.ok(!texto(r).includes('(recortado)'), `${s} recortada`);
    }
    const obj = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'objetivos' })); assert.ok(obj.objetivos.length >= 6); assert.ok(obj.objetivos.every((o) => 'evidencia' in o && 'estado' in o)); assert.match(obj.escala_indice, /null = no evaluado/);
    const cir = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'circulacion' })); assert.ok(cir.superficie_circulacion_m2 > 0); assert.ok(cir.porcentaje_de_superficie_util > 0); assert.ok(Object.keys(cir.distancias_desde_el_acceso_m).length >= 8);
    const met = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'metricas' })); for (const m of met.metricas) assert.ok('unidad' in m && 'limites' in m && 'formula' in m);
    const vent = met.metricas.find((m) => m.id === 'ventilacion_potencial'); assert.match(vent.lectura, /Un 0 no demuestra falta de ventilación/);
    const alt = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'alertas' })); assert.ok(alt.alertas.every((a) => a.codigo && a.texto && a.accion_recomendada)); assert.ok(alt.alertas.some((a) => a.severidad === 'critica')); assert.match(alt.nota, /No se afirma cumplimiento normativo/);
    const vis = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'visuales' })); assert.match(vis.aviso_seguridad, /NO significa seguridad infantil/); assert.ok(vis.visuales.length >= 1);
    const com = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'completo' })); assert.ok(com.analisis && com.objetivos && com.detalle && com.critica, 'contrato anterior intacto');
    const mal = await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'nada' }); assert.equal(mal.isError, true);
  } finally { await cli.close(); }
});

test('Visual→ray casting: la relación cocina→zona de piscina del brief produce una visual calculada en el L y "no evaluada" (con razón) en la compacta', async () => {
  const { cli, c, P, E } = await preparar();
  try {
    const v = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'visuales' })).visuales[0]; assert.equal(v.desde, 'R-COC'); assert.equal(v.hacia, 'pool_play_zone'); assert.ok(['visible', 'parcial', 'obstruida'].includes(v.estado)); assert.equal(typeof v.fraccion_visible_mejor_punto, 'number');
    const k = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-compacta', seccion: 'visuales' })).visuales[0]; assert.equal(k.estado, 'no_evaluado'); assert.ok(k.razon);
    const o = data(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: 'objetivos' })).objetivos.find((x) => x.objetivo === 'sightline'); assert.equal(typeof o.indice, 'number'); assert.match(o.aviso, /nunca acredita seguridad de la piscina/); assert.equal(o.estado, 'parcial');
  } finally { await cli.close(); }
});

test('Lectura sin versiones: ver / evaluar (todas las secciones) / comparar / decisiones no crean ni modifican archivos', async () => {
  const { home, cli, c, P, E, dir } = await preparar();
  try {
    const foto = () => Object.fromEntries(walk(path.join(home, 'Proyectos', P)).map((f) => [f, sha(f)])); const antes = foto(); const hist = fs.readFileSync(path.join(dir, 'historial.json'), 'utf8');
    await call(c, 'tannia_arq_ver', { proyecto: P, estudio: E }); await call(c, 'tannia_arq_ver', { proyecto: P }); await call(c, 'tannia_arq_comparar', { proyecto: P, estudio: E }); await call(c, 'tannia_arq_decisiones', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio' });
    for (const s of SECCIONES) await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', seccion: s });
    await call(c, 'tannia_arq_estudiar_sol', { proyecto: P, estudio: E, alternativa: 'alt-L_con_patio', recinto: 'R-LIV', lado: 'N' });
    const desp = foto(); const nuevos = Object.keys(desp).filter((f) => !(f in antes)); assert.deepEqual(nuevos, []); for (const [f, h] of Object.entries(antes)) if (!f.endsWith('auditoria.jsonl')) assert.equal(desp[f], h, `modificado: ${f}`);
    assert.equal(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8'), hist); assert.equal(JSON.parse(hist).versiones.length, 2);
  } finally { await cli.close(); }
});

test('Brief→evaluación: ninguna alternativa afirma cumplimiento normativo ni seguridad en alertas, acciones o resumen', async () => {
  const { cli, c, P, E } = await preparar();
  try {
    for (const id of ['alt-L_con_patio', 'alt-compacta', 'alt-dos_alas']) { const t = texto(await call(c, 'tannia_arq_evaluar', { proyecto: P, estudio: E, alternativa: id })); assert.ok(!/(cumple (con )?la norma|cumple oguc|es segura|apto para construcci[oó]n(?!\.| ni)|aprobad[oa])/i.test(t.replace(/no apto para construcci[oó]n/gi, '').replace(/NO significa seguridad/gi, '')), id); }
  } finally { await cli.close(); }
});

test('Compatibilidad: con el brief de campo (variante) la generación sigue dando 3 alternativas y la visual se conecta con el ray casting', () => {
  const { brief } = interpretarEncargo(fs.readFileSync(new URL('./fixtures_tw10/encargo_los_robles_variante_campo.txt', import.meta.url), 'utf8'), { projectId: 'p' });
  const g = generarAlternativas({ programa: programaDeBrief(brief), vistas: brief.objectives.filter((o) => o.kind === 'sightline').map((o) => ({ from: o.from, to: o.to })) }); assert.equal(g.alternativas.length, 3);
  const l = g.alternativas.find((a) => a.esquema.id === 'alt-L_con_patio'); const e = evaluarEsquema({ esq: l.esquema, geo: l.geo, brief }); assert.ok(e.detalle.visuales.length === 1 && e.detalle.visuales[0].estado !== 'no_evaluado');
});

test('F01 — ninguna herramienta de lectura/generación de TW-10 trunca su texto con el encargo de Los Robles (con y sin terreno)', async () => {
  const { cli, c, P, E } = await preparar();
  try {
    const sin = async (n, a) => { const r = await call(c, n, { proyecto: P, estudio: E, ...a }); assert.ok(!r.isError, `${n}: ${texto(r).slice(0, 200)}`); assert.ok(!/recortado|Detalle truncado/.test(texto(r)), `${n} truncada (${jsonDelTexto(r).length})`); };
    const todo = async () => { await sin('tannia_arq_ver', {}); await sin('tannia_arq_comparar', {}); await sin('tannia_arq_decisiones', { alternativa: 'alt-L_con_patio' }); await sin('tannia_arq_evaluar', { alternativa: 'alt-compacta' }); await sin('tannia_arq_evaluar', { alternativa: 'alt-dos_alas' }); await sin('tannia_arq_evaluar', { alternativa: 'alt-L_con_patio', seccion: 'critica' }); };
    await todo();
    await call(c, 'tannia_arq_sitio', { proyecto: P, estudio: E, predio_ancho_mm: 16000, predio_fondo_mm: 30000, acceso_lado: 'S', latitud: -33.45, longitud: -70.67, zona_horaria: 'America/Santiago', norte_grados: 0, norte_confirmado: true });
    await sin('tannia_arq_generar_alternativas', {}); await todo(); await sin('tannia_arq_evaluar', { alternativa: 'alt-L_con_patio', seccion: 'sol' }); await sin('tannia_arq_evaluar', { alternativa: 'alt-L_con_patio', seccion: 'metricas' });
  } finally { await cli.close(); }
});
