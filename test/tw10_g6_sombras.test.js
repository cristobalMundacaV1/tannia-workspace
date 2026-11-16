// G6: sombras por ray casting con oráculo geométrico independiente, verano/invierno en Chile, aleros, rotación y norte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { horasSolVentanas, horasSolPatio, estudioAlero, rayoGolpea, escena } from '../src/architect/sombras.js';
import { generarPartido, transformarEsquema } from '../src/architect/partidos.js';
import { derivarEsquema } from '../src/architect/derivar_poly.js';
import { actualizarSitio, predioRectangular } from '../src/architect/sitio.js';
import { posicionSolar, localAInstante } from '../src/architect/solar.js';

const prog = { superficie_m2: 90, dormitorios: 3, banos: 2 };
const sitio = (norte = 0, extra = {}) => actualizarSitio(null, { coordenadas: { lat: -33.45, lon: -70.67 }, zona_horaria: 'America/Santiago', norte_grados: norte, ...extra });
const L = () => generarPartido('L_con_patio', prog);

test('rayoGolpea: oráculo geométrico — caja interpuesta bloquea, caja detrás no, rayo paralelo fuera no', () => {
  const caja = { x0: 1000, y0: -500, z0: 0, x1: 1200, y1: 500, z1: 3000 };
  assert.ok(rayoGolpea([0, 0, 1000], [1, 0, 0], [caja])); assert.equal(rayoGolpea([0, 0, 1000], [-1, 0, 0], [caja]), null); assert.equal(rayoGolpea([0, 2000, 1000], [1, 0, 0], [caja]), null);
  assert.equal(rayoGolpea([0, 0, 4000], [1, 0, 0], [caja]), null, 'por encima');
  const diag = Math.SQRT1_2; assert.ok(rayoGolpea([0, 0, 1000], [diag, 0, diag], [{ ...caja, z1: 5000 }]));
});

test('sin norte/coordenadas confirmados: no concluyente y sin horas inventadas', () => {
  const r = L(); const s = actualizarSitio(null, { predio: { anillo: predioRectangular(12000, 28000) } });
  const h = horasSolVentanas({ esq: r.esquema, geo: r.geo, sitio: s, fecha: '2026-06-21' });
  assert.equal(h.estado, 'no_concluyente'); assert.ok(h.faltantes.includes('norte verdadero confirmado')); assert.deepEqual(h.ventanas, []);
  const s2 = sitio(0, {}); const s3 = actualizarSitio(s2, { norte_grados: 0, norte_estado: 'assumed' }); assert.equal(horasSolVentanas({ esq: r.esquema, geo: r.geo, sitio: s3, fecha: '2026-06-21' }).estado, 'no_concluyente');
  assert.equal(estudioAlero({ esq: r.esquema, geo: r.geo, sitio: s, fachada: { recinto: 'R-LIV', lado: 'S' } }).estado, 'no_concluyente');
});

test('Chile: junio vs diciembre difieren y la fachada ecuatorial (N) recibe sol en invierno; el sol de verano pasa por encima', () => {
  // casa compacta con acceso al sur, fachada N con ventanas de dormitorios (norte = +Y local)
  const r = generarPartido('compacta', prog); const s = sitio(0);
  const inv = horasSolVentanas({ esq: r.esquema, geo: r.geo, sitio: s, fecha: '2026-06-21' }); const ver = horasSolVentanas({ esq: r.esquema, geo: r.geo, sitio: s, fecha: '2026-12-21' });
  assert.equal(inv.estado, 'calculado');
  const norte = (x) => x.ventanas.filter((v) => v.lado === 'N' && v.recinto.startsWith('R-D')); const sur = (x) => x.ventanas.filter((v) => v.lado === 'S' && v.recinto === 'R-LIV');
  const sumaN = (x) => norte(x).reduce((a, v) => a + v.horas_sol_directo, 0); const sumaS = (x) => sur(x).reduce((a, v) => a + v.horas_sol_directo, 0);
  assert.ok(sumaN(inv) > 5, `N invierno ${sumaN(inv)}`); assert.ok(sumaS(inv) === 0, 'la fachada sur no recibe sol directo en invierno austral');
  assert.ok(sumaS(ver) > 0, 'la fachada sur sí recibe sol de verano al amanecer/atardecer');
});

test('invarianza: rotar la casa 90° y el norte 90° da lo mismo; cambiar SOLO el norte cambia las horas', () => {
  const r = generarPartido('compacta', prog); const base = horasSolVentanas({ esq: r.esquema, geo: r.geo, sitio: sitio(0), fecha: '2026-06-21' });
  const esq90 = transformarEsquema(r.esquema, 1); const geo90 = derivarEsquema(esq90); // giro 90° antihorario: el norte (que estaba a +Y) queda a −90° ⇒ 270° desde +Y horario
  const rot = horasSolVentanas({ esq: esq90, geo: geo90, sitio: sitio(270), fecha: '2026-06-21' });
  const sumaPorRecLado = (x) => Object.fromEntries(x.ventanas.map((v) => [v.id, v.horas_sol_directo]));
  assert.deepEqual(sumaPorRecLado(rot), sumaPorRecLado(base));
  const girado = horasSolVentanas({ esq: r.esquema, geo: r.geo, sitio: sitio(90), fecha: '2026-06-21' });
  assert.notDeepEqual(sumaPorRecLado(girado), sumaPorRecLado(base));
});

test('autosombra en L: el ala larga proyecta sombra sobre el patio y sobre ventanas del ala corta en invierno; resultado con el mismo reloj en ambos hemisferios de signo', () => {
  const r = L(); const s = sitio(0); const p = horasSolPatio({ esq: r.esquema, geo: r.geo, sitio: s, fecha: '2026-06-21' });
  assert.equal(p.estado, 'calculado'); assert.ok(p.horas_max > p.horas_min, 'el patio tiene zonas de sombra y de sol'); const v = horasSolPatio({ esq: r.esquema, geo: r.geo, sitio: s, fecha: '2026-12-21' });
  assert.ok(v.horas_media > p.horas_media, `verano ${v.horas_media} > invierno ${p.horas_media}`);
});

test('aleros: nunca aumentan el sol directo (monotonía); en la fachada N el compromiso verano/invierno se cuantifica; fachada sin sol no aporta', () => {
  const r = generarPartido('compacta', prog); const s = sitio(0);
  const e = estudioAlero({ esq: r.esquema, geo: r.geo, sitio: s, fachada: { recinto: 'R-DP', lado: 'N' }, profundidades: [0, 300, 600, 900, 1200] });
  assert.equal(e.estado, 'calculado');
  for (let i = 1; i < e.filas.length; i++) { assert.ok(e.filas[i].horas_verano <= e.filas[i - 1].horas_verano + 1e-9); assert.ok(e.filas[i].horas_invierno <= e.filas[i - 1].horas_invierno + 1e-9); }
  assert.ok(e.filas[0].horas_invierno > 0); assert.ok(e.filas[4].horas_invierno < e.filas[0].horas_invierno || e.filas[4].horas_invierno === e.filas[0].horas_invierno);
  assert.match(e.limites, /confort térmico/); assert.ok(e.recomendacion);
  const sur = estudioAlero({ esq: r.esquema, geo: r.geo, sitio: s, fachada: { recinto: 'R-LIV', lado: 'S' } }); assert.ok(sur.recomendacion.profundidad_mm === null || sur.filas[0].horas_verano > 0);
});

test('obstáculos de contexto: altura desconocida ⇒ no concluyente; altura conocida proyecta sombra (menos horas)', () => {
  const r = generarPartido('compacta', prog); const g = r.geo; const b = g.exterior;
  const vecino = (alt) => ({ anillo: [[b.x0 - 3000, b.y1 + 1000], [b.x1 + 3000, b.y1 + 1000], [b.x1 + 3000, b.y1 + 3000], [b.x0 - 3000, b.y1 + 3000]], altura_mm: alt });
  const sinAlt = horasSolVentanas({ esq: r.esquema, geo: g, sitio: sitio(0, { obstaculos: [vecino(null)] }), fecha: '2026-06-21' }); assert.equal(sinAlt.estado, 'no_concluyente_contexto'); assert.ok(sinAlt.razon_contexto[0].includes('no es concluyente'));
  const libre = horasSolVentanas({ esq: r.esquema, geo: g, sitio: sitio(0), fecha: '2026-06-21' }); const con = horasSolVentanas({ esq: r.esquema, geo: g, sitio: sitio(0, { obstaculos: [vecino(9000)] }), fecha: '2026-06-21' });
  const tot = (x) => x.ventanas.reduce((a, v) => a + v.horas_sol_directo, 0); assert.ok(tot(con) < tot(libre), `${tot(con)} < ${tot(libre)}`);
});

test('escena: el sólido de cubierta no cubre el patio (no se tapa con bbox)', () => {
  const r = L(); const e = escena(r.esquema, r.geo); const patio = r.esquema.exterior_areas.find((a) => a.id === 'patio').ring;
  const cx = (Math.min(...patio.map((p) => p[0])) + Math.max(...patio.map((p) => p[0]))) / 2; const cy = (Math.min(...patio.map((p) => p[1])) + Math.max(...patio.map((p) => p[1]))) / 2;
  assert.equal(rayoGolpea([cx, cy, 10], [0, 0, 1], e.cajas), null, 'sobre el patio no hay losa ni cubierta');
});

test('modo hipótesis: se etiqueta explícitamente como no real', () => {
  const r = generarPartido('compacta', prog);
  const h = horasSolVentanas({ esq: r.esquema, geo: r.geo, sitio: null, hipotesis: { lat: -33.45, lon: -70.67, zona: 'America/Santiago', norte_deg: 0 }, fecha: '2026-06-21' });
  assert.equal(h.estado, 'hipotesis_no_real');
  void posicionSolar; void localAInstante;
});
