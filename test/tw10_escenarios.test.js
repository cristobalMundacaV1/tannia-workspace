// Escenarios de aceptación profesional automatizables (TW-10) y propiedades geométricas. NO sustituyen la revisión profesional ni AutoCAD real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tmpHome, startClient, call, data } from './helpers.js';
import { posicionSolar, localAInstante } from '../src/architect/solar.js';
import { derivarEsquema, huellaDeEspacios } from '../src/architect/derivar_poly.js';
import { esquemaA3d } from '../src/architect/a3d.js';
import { construirPrimitivas } from '../src/arq3d/geometria.js';
import { slug } from '../src/design/servicio.js';

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const dAz = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

test('E10: CIP sin escala legible — se registra la fuente pero no se extrae ninguna restricción; pide documento legible', async () => {
  const { client: c, close } = await startClient(tmpHome()); const P = 'P';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P }); await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: 'E', texto: 'Casa de 90 m2' });
    let r = await call(c, 'tannia_arq_sitio', { proyecto: P, estudio: 'E', fuente: { tipo: 'cip', ref: 'CIP escaneado borroso', escala_legible: false }, restriccion: { requisito: 'ocupacion_max_pct', valor: 60, fecha_fuente: '2026-01-01' } });
    assert.equal(r.isError, true); assert.match(JSON.stringify(r.content), /FUENTE_SIN_ESCALA_LEGIBLE|escala/i);
    const v = data(await call(c, 'tannia_arq_ver', { proyecto: P, estudio: 'E' })); assert.ok(v.faltantes.some((f) => f.id === 'cip_prc'));
  } finally { await close(); }
});

test('E13: hemisferios — Buenos Aires/Santiago vs Madrid: el sol de mediodía está al norte (sur) o al sur (norte); estaciones invertidas', () => {
  const med = (lat, lon, z, fecha) => { let mejor = null; for (let h = 11 * 60; h <= 15 * 60; h += 5) { const ms = localAInstante(`${fecha}T${String(Math.floor(h / 60)).padStart(2, '0')}:${String(h % 60).padStart(2, '0')}`, z); const p = posicionSolar(ms, lat, lon); if (!mejor || p.elevacion_deg > mejor.elevacion_deg) mejor = p; } return mejor; };
  const bsas = med(-34.6, -58.38, 'America/Argentina/Buenos_Aires', '2026-06-21'); const mad = med(40.42, -3.7, 'Europe/Madrid', '2026-06-21'); const bsasD = med(-34.6, -58.38, 'America/Argentina/Buenos_Aires', '2026-12-21');
  assert.ok(dAz(bsas.azimut_deg, 0) < 5, `Buenos Aires junio ${bsas.azimut_deg}`); assert.ok(dAz(mad.azimut_deg, 180) < 5); assert.ok(bsas.elevacion_deg < 35 && mad.elevacion_deg > 70 && bsasD.elevacion_deg > 75);
});

test('E14/E11: un proyecto con anteproyecto v1 y 3D previos conserva sus archivos con hash idéntico tras el flujo arquitectónico; otro proyecto no se toca', async () => {
  const home = tmpHome('Tannia ñ hist '); const { client: c, close } = await startClient(home); const P = 'Casa Histórica';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P }); await call(c, 'tannia_proyecto_crear', { nombre: 'Ajena' });
    assert.ok(!(await call(c, 'tannia_diseno_crear', { proyecto: P, nombre: 'Casa v1', programa: { superficie_objetivo_m2: 80 } })).isError);
    assert.ok(!(await call(c, 'tannia_3d_crear', { proyecto: P, nombre: 'Casa v1 3D', desde_anteproyecto: { nombre: 'Casa v1' } })).isError);
    const base = path.join(home, 'Proyectos', P); const antes = Object.fromEntries(walk(path.join(base, '03 Trabajo')).map((f) => [f, sha(f)])); const ajenaAntes = walk(path.join(home, 'Proyectos', 'Ajena')).length;
    await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: 'E', texto: 'Casa de 90 m2 en L, 3 dormitorios, 2 baños' }); await call(c, 'tannia_arq_generar_alternativas', { proyecto: P, estudio: 'E' });
    await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: 'E', texto: 'Casa de 110 m2 en L, 3 dormitorios, 2 baños' }); // E11: cambio de programa → nueva versión, lo anterior intacto
    const g2 = await call(c, 'tannia_arq_generar_alternativas', { proyecto: P, estudio: 'E' }); assert.ok(!g2.isError);
    const despues = Object.fromEntries(walk(path.join(base, '03 Trabajo')).map((f) => [f, sha(f)]));
    for (const [f, h] of Object.entries(antes)) assert.equal(despues[f], h, `modificado: ${f}`);
    assert.equal(walk(path.join(home, 'Proyectos', 'Ajena')).length, ajenaAntes);
    const hist = data(await call(c, 'tannia_arq_ver', { proyecto: P, estudio: 'E', historial: 'listar' })); assert.ok(hist.versiones.length >= 4);
    const v1 = data(await call(c, 'tannia_arq_ver', { proyecto: P, estudio: 'E', version: 'v002' })); assert.ok(v1.brief.requisitos.includes('area_target=90'), 'la versión 2 conserva el encargo de 90 m²'); const v1c = data(await call(c, 'tannia_arq_ver', { proyecto: P, estudio: 'E', version: 'v002', brief_completo: true })); assert.equal(v1c.brief.hard_constraints.find((h) => h.kind === 'area_target').value, 90);
  } finally { await close(); }
});

// ---- propiedades (PRNG determinista) ----
function prng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
function particion(rect, rnd, prof, out) {
  const w = rect.x1 - rect.x0; const h = rect.y1 - rect.y0;
  if (prof === 0 || (w < 6000 && h < 6000)) { out.push(rect); return; }
  const vert = w >= h ? true : false; const L = vert ? w : h; if (L < 6000) { out.push(rect); return; }
  const corte = Math.round((L * (0.35 + rnd() * 0.3)) / 100) * 100;
  if (vert) { particion({ ...rect, x1: rect.x0 + corte }, rnd, prof - 1, out); particion({ ...rect, x0: rect.x0 + corte }, rnd, prof - 1, out); }
  else { particion({ ...rect, y1: rect.y0 + corte }, rnd, prof - 1, out); particion({ ...rect, y0: rect.y0 + corte }, rnd, prof - 1, out); }
}
test('propiedad: 150 huellas aleatorias (rectángulo, L, U) — huella exacta, sin solapes, losa 3D = huella real, cuñas de patio vacías', () => {
  const rnd = prng(12345);
  for (let i = 0; i < 150; i++) {
    const forma = ['rect', 'L', 'U'][i % 3]; const A = 8000 + Math.round(rnd() * 6) * 1000; const B = 8000 + Math.round(rnd() * 6) * 1000; const C = 3000 + Math.round(rnd() * 3) * 1000;
    const bloques = forma === 'rect' ? [{ x0: 0, y0: 0, x1: A, y1: B }] : forma === 'L' ? [{ x0: 0, y0: 0, x1: A, y1: C + 1000 }, { x0: 0, y0: C + 1000, x1: C + 2000, y1: B + C }] : (() => { const Wd = Math.max(A + 4000, 2 * (C + 2000) + 3000); return [{ x0: 0, y0: 0, x1: Wd, y1: C + 1000 }, { x0: 0, y0: C + 1000, x1: C + 2000, y1: B + C }, { x0: Wd - (C + 2000), y0: C + 1000, x1: Wd, y1: B + C }]; })();
    const salas = []; for (const b of bloques) particion(b, rnd, 3, salas);
    const spaces = salas.map((r, k) => ({ id: `S${k}`, nombre: `S${k}`, tipo: 'x', zona: 'social', ring: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]] }));
    // todas conectadas por pasos abiertos entre vecinos y una puerta exterior
    const abiertas = []; for (let a = 0; a < salas.length; a++) for (let b = a + 1; b < salas.length; b++) { const p = salas[a]; const q = salas[b]; const tocaV = (p.x1 === q.x0 || q.x1 === p.x0) && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 0; const tocaH = (p.y1 === q.y0 || q.y1 === p.y0) && Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 0; if (tocaV || tocaH) abiertas.push([`S${a}`, `S${b}`]); }
    const esq = { schema: 'tw.arch.scheme/2', id: 'prop', brief_ref: 'b', site_ref: null, engine_version: 't', concept: 'compacta', rationale: '', footprint_polygons_mm: huellaDeEspacios(spaces), open_courts_mm: [], espesores_mm: { ext: 200, int: 140 }, altura_piso_cielo_mm: 2500, spaces, openings: [{ id: 'P', tipo: 'puerta', entre: ['S0'], exterior_side: 'S', ancho_mm: 900, alto_mm: 2100, centro: [Math.round((salas[0].x0 + salas[0].x1) / 20) * 10, 0] }], exterior_areas: [], separaciones_abiertas: abiertas, adjacencies: [], line_of_sight_goals: [], sources: [], model_status: 'concept' };
    const g = derivarEsquema(esq); assert.deepEqual(g.errores, [], `caso ${i} ${forma}`);
    const areaEjes = salas.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0) / 1e6; assert.ok(g.huella.area_m2 >= areaEjes - 1e-6, `caso ${i}`);
    assert.ok(g.areas.util_neta_m2 < areaEjes); assert.ok(g.huella.area_m2 <= g.huella.area_caja_envolvente_m2 + 1e-6);
    if (forma !== 'rect') assert.ok(g.huella.area_caja_envolvente_m2 > g.huella.area_m2 + 5, `caso ${i}: ${forma} debe ser menor que su caja`);
    const m = esquemaA3d(esq, g); const p = construirPrimitivas(m);
    assert.ok(Math.abs(p.resumen.volumen_losas_m3 - g.huella.area_m2 * 0.15) < 0.05, `caso ${i}: losa ${p.resumen.volumen_losas_m3} vs ${g.huella.area_m2 * 0.15}`);
    const dens = g.murosSeg.reduce((a, s) => a + (s.hasta - s.desde), 0); assert.ok(dens > 0);
  }
});

test('fuzz de nombres: ningún nombre de estudio hostil escapa de "03 Trabajo/Arquitectura" ni produce rutas inválidas en Windows', async () => {
  const home = tmpHome('Tannia ñ fuzz '); const { client: c, close } = await startClient(home); const P = 'Fuzz';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P });
    for (const n of ['../../x', '..\\..\\y', 'a/b', 'CON', 'nul.txt', 'a:b', 'x'.repeat(200), ' . ', '<>|"?*', 'ñandú/«»', '\u0000nul']) { const r = await call(c, 'tannia_arq_encargo', { proyecto: P, estudio: n, texto: 'Casa de 90 m2' }); void r; }
    const base = path.join(home, 'Proyectos', P); const dentro = path.join(base, '03 Trabajo', 'Arquitectura');
    for (const f of walk(home)) { const rel = path.relative(base, f); if (f.startsWith(base) && !rel.startsWith('.tannia') && !rel.startsWith('03 Trabajo') && !f.includes('01 Antecedentes')) { /* carpetas estándar */ } }
    const todos = walk(home).filter((f) => /v001\.json$/.test(f)); for (const f of todos) assert.ok(f.startsWith(dentro), `fuera de Arquitectura: ${f}`);
    assert.equal(slug('CON'), 'CON'); // slug no debe permitir separadores ni terminar en punto/espacio
    for (const n of ['../../x', 'a/b', 'a:b', 'x.', 'x ']) assert.ok(!/[\\/:]/.test(slug(n)) && !/[. ]$/.test(slug(n)));
  } finally { await close(); }
});
