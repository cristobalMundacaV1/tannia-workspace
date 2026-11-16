// F10 — «tres partidos pero solo dos elegibles»: tercera alternativa realmente diferenciada y conteo honesto de elegibles (sin rebajar requisitos duros).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generarAlternativas } from '../src/architect/alternativas.js';
import { generarPartido, transformarEsquema } from '../src/architect/partidos.js';
import { firmaTopologica, conjuntoDiverso } from '../src/architect/diversidad.js';
import { evaluarEsquema } from '../src/architect/evaluacion.js';
import { interpretarEncargo, programaDeBrief } from '../src/architect/briefing.js';
import { predioRectangular } from '../src/architect/sitio.js';
import { derivarEsquema } from '../src/architect/derivar_poly.js';
import { esquemaA3d } from '../src/architect/a3d.js';
import { construirPrimitivas } from '../src/arq3d/geometria.js';
import { coherenciaConGeo } from '../src/arq3d/desde_anteproyecto.js';
import { validar } from '../src/architect/schemas.js';
import { tmpHome, startClient, call, data } from './helpers.js';

const RC2 = fs.readFileSync(new URL('./fixtures_tw10/encargo_rc2_reconstruido.txt', import.meta.url), 'utf8');
const texto = (r) => r.content.map((c) => c.text).join('\n');
const evaluar = (g, brief) => g.alternativas.map((a) => ({ a, e: evaluarEsquema({ esq: a.esquema, geo: a.geo, brief }) }));
const fallos = (e) => e.analisis.hard_gates.filter((x) => !x.passed && x.id !== 'clase_de_huella').map((x) => x.id);

test('F10 — a 90 m² (3 dorm., 2 baños) hay 4 partidos generados y EXACTAMENTE 3 elegibles; dos_alas queda bloqueada por superficie y no se cuenta como viable', () => {
  const { brief } = interpretarEncargo(RC2, { projectId: 'p' }); const g = generarAlternativas({ programa: programaDeBrief(brief) }); const ev = evaluar(g, brief);
  assert.equal(ev.length, 4); const elegibles = ev.filter((x) => !x.e.bloqueada).map((x) => x.a.concepto).sort(); assert.deepEqual(elegibles, ['L_con_patio', 'compacta', 'lineal']);
  const dos = ev.find((x) => x.a.concepto === 'dos_alas'); assert.ok(dos.e.bloqueada); assert.deepEqual(fallos(dos.e), ['superficie_objetivo']); assert.ok(dos.a.area_m2 > 104);
  for (const { a, e } of ev.filter((x) => !x.e.bloqueada)) { assert.ok(Math.abs(a.area_m2 - 90) / 90 <= 0.035, `${a.concepto} ${a.area_m2}`); assert.deepEqual(e.analisis.hard_gates.filter((x) => !x.passed && x.id !== 'clase_de_huella'), []); assert.deepEqual(a.geo.errores, []); assert.equal(Object.values(a.geo.recintos).filter((r) => r.tipo === 'dormitorio' || r.tipo === 'dormitorio_principal').length, 3); assert.equal(Object.values(a.geo.recintos).filter((r) => r.tipo === 'bano').length, 2); }
  assert.equal(brief.hard_constraints.find((h) => h.kind === 'area_target').value, 90, 'los requisitos duros no se rebajaron');
});

test('F10 — la lineal es realmente distinta: clase de huella propia, topología distinta, invariante a giros/espejos, una sola crujía con espina de circulación', () => {
  const lin = generarPartido('lineal', { superficie_m2: 90, piscina: true }); const com = generarPartido('compacta', { superficie_m2: 90 });
  const fl = firmaTopologica(lin.esquema, lin.geo); const fc = firmaTopologica(com.esquema, com.geo);
  assert.equal(fl.huella.clase, 'lineal'); assert.equal(fc.huella.clase, 'rectangular'); assert.notEqual(fl.clave, fc.clave); assert.notEqual(fl.topologia, fc.topologia);
  const claves = new Set(); for (let k = 0; k < 8; k++) { const r = generarPartido('lineal', { superficie_m2: 90, piscina: true }, { simetria: k }); assert.ok(r.factible, `k=${k}`); claves.add(firmaTopologica(r.esquema, r.geo).clave); } assert.equal(claves.size, 1, 'giros y espejos no crean alternativas nuevas');
  const b = lin.geo.huella.anillos[0].ring; const xs = b.map((p) => p[0]); const ys = b.map((p) => p[1]); const prop = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); assert.ok(prop >= 3.2, `proporción ${prop}`);
  const dorm = lin.esquema.openings.filter((o) => o.tipo === 'ventana' && /^V-R-D/.test(o.id)); assert.ok(dorm.length >= 3 && new Set(dorm.map((o) => o.exterior_side)).size === 1, 'todos los dormitorios comparten fachada');
  const pas = lin.geo.recintos['R-PAS']; assert.ok(pas.ancho_neto_mm / pas.fondo_neto_mm > 10, 'pasillo-galería continuo');
  const conj = conjuntoDiverso([lin, com, generarPartido('L_con_patio', { superficie_m2: 90 })].map((x) => ({ esquema: x.esquema, geo: x.geo }))); assert.equal(conj.topologias_distintas, 3); assert.equal(conj.clases_de_huella, 3);
});

test('F10 — geometría de la lineal: esquema válido Zod, sin errores, 2D↔3D coherente, losa = huella real, jardín fuera de la huella y circulación sin recintos incomunicados', () => {
  const r = generarPartido('lineal', { superficie_m2: 90, piscina: true }); assert.ok(validar('scheme', r.esquema).ok, JSON.stringify(validar('scheme', r.esquema)).slice(0, 300)); assert.deepEqual(r.geo.errores, []);
  const m = esquemaA3d(r.esquema, r.geo); const p = construirPrimitivas(m); assert.ok(Math.abs(p.resumen.volumen_losas_m3 - r.geo.huella.area_m2 * 0.15) < 0.03); assert.equal(coherenciaConGeo(m, r.geo, { altura_piso_cielo_mm: 2500 }).estado, 'coherente_en_alcance');
  const e = evaluarEsquema({ esq: r.esquema, geo: r.geo, brief: interpretarEncargo(RC2, { projectId: 'p' }).brief }); assert.deepEqual(e.detalle.recorridos.recintos_sin_ruta, []); assert.ok(r.esquema.exterior_areas.some((a) => a.id === 'patio') && r.esquema.exterior_areas.some((a) => a.id === 'pool_play_zone'));
  const v = e.detalle.visuales[0]; assert.notEqual(v.estado, 'no_evaluado', 'la cocina abre al jardín: la visual a la zona de piscina se puede evaluar'); assert.equal(v.conclusion, 'visual_geometrica_preliminar');
  const acc = r.esquema.openings.find((o) => o.funcion === 'acceso'); assert.equal(acc.exterior_side, 'O', 'entrada por el testero');
});

test('F10 — sitio: la lineal entra en 16×30 y en 12×28 con acceso por el frente (entrada por el testero girada); no en 10×20; las zonas exteriores también deben caber', () => {
  const prog = { superficie_m2: 90, dormitorios: 3, banos: 2, piscina: true };
  const a = generarAlternativas({ programa: prog, predio: { ring: predioRectangular(16000, 30000) }, acceso: 'S' }); assert.ok(a.alternativas.some((x) => x.concepto === 'lineal' && x.encaje.cabe));
  const lin = a.alternativas.find((x) => x.concepto === 'lineal'); const acc = lin.esquema.openings.find((o) => o.funcion === 'acceso'); const ys = lin.geo.huella.anillos[0].ring.map((p) => p[1]); assert.ok(acc.centro[1] <= Math.min(...ys) + 400, 'la entrada queda hacia el frente (sur)');
  for (const ar of lin.esquema.exterior_areas) for (const [x, y] of ar.ring) assert.ok(x >= 0 && x <= 16000 && y >= 0 && y <= 30000, `${ar.id} fuera del predio`);
  const b = generarAlternativas({ programa: prog, predio: { ring: predioRectangular(12000, 28000) }, acceso: 'S' }); assert.deepEqual(b.alternativas.map((x) => x.concepto).sort(), ['L_con_patio', 'compacta', 'lineal']); assert.ok(b.descartadas.some((d) => d.concepto === 'dos_alas' && /No cabe/.test(d.motivo)));
  const c = generarAlternativas({ programa: prog, predio: { ring: predioRectangular(10000, 20000) }, acceso: 'S' }); assert.equal(c.alternativas.length, 0); assert.equal(c.minimo_cumplido, false);
  const d = generarAlternativas({ programa: prog, predio: { ring: predioRectangular(10000, 24000) }, acceso: 'S' }); assert.deepEqual(d.alternativas.map((x) => x.concepto), ['lineal'], 'un terreno angosto y largo solo admite la lineal');
});

test('F10 — conteo honesto cuando NO hay tres: 60 m² con 3 dormitorios y 2 baños → los partidos exceden la superficie, quedan bloqueados y el veredicto lo dice; no se rebaja el requisito', async () => {
  const cli = await startClient(tmpHome('Tannia ñ f10 ')); const c = cli.client; const P = 'Fixture F10'; const E = 'E';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P }); await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: 'Casa de 60 m2, 3 dormitorios, 2 baños, un piso.' });
    const r = await call(c, 'tannia_arq_generar_alternativas', { proyecto: P, estudio: E }); assert.ok(!r.isError, texto(r).slice(0, 300)); const d = data(r);
    assert.ok(d.n_elegibles < 3, `elegibles ${d.n_elegibles}`); assert.equal(d.minimo_cumplido, false); assert.match(d.veredicto, /NO hay tres soluciones viables/); assert.match(d.veredicto, /No se rebajaron requisitos duros/); assert.ok(d.bloqueadas.length >= 1); assert.ok(d.bloqueadas.every((b) => b.motivos.some((m) => /superficie_objetivo/.test(m))));
    assert.match(texto(r), /NO hay tres soluciones viables/); assert.ok(!/3 alternativas ELEGIBLES/.test(texto(r)));
    assert.ok(d.alternativas.every((a) => a.elegible === !a.bloqueada)); assert.equal(d.alternativas.filter((a) => a.elegible).length, d.n_elegibles);
    const v = data(await call(c, 'tannia_arq_ver', { proyecto: P, estudio: E, brief_completo: true })); assert.equal(v.brief.hard_constraints.find((h) => h.kind === 'area_target').value, 60);
  } finally { await cli.close(); }
});

test('F10 (MCP) — con el encargo de Los Robles el veredicto afirma 3 elegibles de 4 y la hoja comparativa lo repite; ninguna bloqueada entra en la frontera de Pareto', async () => {
  const home = tmpHome('Tannia ñ f10b '); const cli = await startClient(home); const c = cli.client; const P = 'Fixture F10b'; const E = 'E';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P }); await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: E, texto: RC2 });
    const r = await call(c, 'tannia_arq_generar_alternativas', { proyecto: P, estudio: E }); const d = data(r);
    assert.equal(d.alternativas_generadas, 4); assert.equal(d.n_elegibles, 3); assert.deepEqual(d.elegibles.sort(), ['alt-L_con_patio', 'alt-compacta', 'alt-lineal']); assert.equal(d.minimo_cumplido, true); assert.deepEqual(d.bloqueadas.map((b) => b.id), ['alt-dos_alas']); assert.match(d.bloqueadas[0].motivos[0], /superficie_objetivo/);
    assert.ok(!d.comparacion.frontera_pareto.includes('alt-dos_alas')); assert.equal(d.diversidad.entre, 'elegibles');
    const f = d.archivos.find((a) => /comparacion\.svg$/.test(a)); const svg = fs.readFileSync(`${home}/Proyectos/${P}/${f}`, 'utf8'); assert.match(svg, /Alternativas elegibles: 3 de 4/); assert.match(svg, /BLOQUEADA: superficie_objetivo/);
  } finally { await cli.close(); }
});
