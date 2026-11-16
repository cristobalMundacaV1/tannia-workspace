// G5: partidos alternativos genuinamente distintos, deterministas, factibles y con motivos; espejo ≠ alternativa nueva.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generarPartido, transformarEsquema } from '../src/architect/partidos.js';
import { generarAlternativas } from '../src/architect/alternativas.js';
import { firmaTopologica, sonDistintos, conjuntoDiverso } from '../src/architect/diversidad.js';
import { derivarEsquema } from '../src/architect/derivar_poly.js';
import { esquemaA3d } from '../src/architect/a3d.js';
import { esquemaDesdeV1 } from '../src/architect/convertir.js';
import { construirPrimitivas } from '../src/arq3d/geometria.js';
import { coherenciaConGeo } from '../src/arq3d/desde_anteproyecto.js';
import { validar } from '../src/architect/schemas.js';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';

const prog = { superficie_m2: 90, dormitorios: 3, banos: 2, cocina: 'americana', piscina: true };

test('tres partidos para 90 m²: factibles, dentro de ±3 % de superficie, esquema válido Zod y sin errores geométricos', () => {
  for (const c of ['compacta', 'L_con_patio', 'dos_alas', 'lineal']) {
    const r = generarPartido(c, prog); assert.ok(r.factible, `${c}: ${r.motivo}`);
    assert.ok(Math.abs(r.desviacion_pct) <= 3.5 || r.supuestos.some((x) => /más de lo pedido/.test(x)), `${c} ${r.area_m2}: fuera de tolerancia sin aviso`);
    assert.deepEqual(r.geo.errores, []);
    const z = validar('scheme', r.esquema); assert.ok(z.ok, JSON.stringify(z));
    assert.ok(r.esquema.rationale.length > 50);
  }
});

test('diversidad real: huellas rectangular / L / C / lineal y topologías distintas; ninguna repetida', () => {
  const a = generarAlternativas({ programa: prog, semilla: 0 });
  assert.equal(a.alternativas.length, 4);
  assert.equal(a.diversidad.clases_de_huella, 4); assert.equal(a.diversidad.topologias_distintas, 4); assert.ok(a.diversidad.todos_distintos); assert.ok(a.minimo_cumplido);
  assert.deepEqual(a.alternativas.map((x) => x.concepto).sort(), ['L_con_patio', 'compacta', 'dos_alas', 'lineal']);
  const clases = a.diversidad.firmas.map((f) => f.huella.clase).sort(); assert.deepEqual(clases, ['C', 'L', 'lineal', 'rectangular']);
});

test('espejo y rotación NO son alternativas distintas (mismo concepto, 8 simetrías ⇒ misma firma)', () => {
  for (const c of ['compacta', 'L_con_patio', 'dos_alas', 'lineal']) {
    const claves = new Set();
    for (let k = 0; k < 8; k++) { const r = generarPartido(c, prog, { simetria: k }); assert.ok(r.factible, `${c} k=${k}`); claves.add(firmaTopologica(r.esquema, r.geo).clave); }
    assert.equal(claves.size, 1, `${c}: ${[...claves]}`);
  }
  // las variantes A/B del generador v1 (espejo) tampoco cuentan
  const mA = generarModelo({ superficie_objetivo_m2: 90, variante: 'A' }); const mB = generarModelo({ superficie_objetivo_m2: 90, variante: 'B' });
  const eA = esquemaDesdeV1(mA, derivar(mA)); const eB = esquemaDesdeV1(mB, derivar(mB));
  assert.ok(!sonDistintos(firmaTopologica(eA), firmaTopologica(eB)), 'A y B de v1 deben ser equivalentes');
});

test('determinismo: misma entrada y semilla ⇒ mismas opciones; la semilla solo reordena la presentación', () => {
  const a1 = generarAlternativas({ programa: prog, semilla: 0 }); const a2 = generarAlternativas({ programa: prog, semilla: 0 }); const a3 = generarAlternativas({ programa: prog, semilla: 1 });
  assert.equal(JSON.stringify(a1.alternativas.map((x) => x.esquema)), JSON.stringify(a2.alternativas.map((x) => x.esquema)));
  assert.equal(a1.entrada_hash, a2.entrada_hash); assert.notEqual(a1.entrada_hash, a3.entrada_hash);
  assert.deepEqual(a1.alternativas.map((x) => x.concepto).sort(), a3.alternativas.map((x) => x.concepto).sort());
});

test('cada partido se compila a 3D con losa/cubierta sobre la huella real y coherencia 2D↔3D', () => {
  for (const c of ['compacta', 'L_con_patio', 'dos_alas', 'lineal']) {
    const r = generarPartido(c, prog); const m = esquemaA3d(r.esquema, r.geo); const p = construirPrimitivas(m);
    assert.ok(Math.abs(p.resumen.volumen_losas_m3 - r.geo.huella.area_m2 * 0.15) < 0.03, `${c} losa`);
    assert.equal(coherenciaConGeo(m, r.geo, { altura_piso_cielo_mm: 2500 }).estado, 'coherente_en_alcance', c);
    if (c === 'L_con_patio' || c === 'dos_alas') assert.ok(r.geo.huella.area_caja_envolvente_m2 > r.geo.huella.area_m2 + 10, `${c}: la caja envolvente debe ser mayor que la huella`);
  }
});

test('superficie pequeña: se entrega el mínimo con aviso explícito, no una cifra inventada', () => {
  const r = generarPartido('dos_alas', { superficie_m2: 60, dormitorios: 3, banos: 2 });
  assert.ok(r.factible); assert.ok(r.area_m2 > 60 * 1.1); assert.ok(r.supuestos.some((s) => /más de lo pedido/.test(s)));
});

test('sin superficie: error pidiendo el dato; fuera de rango: error claro', () => {
  assert.throws(() => generarPartido('L_con_patio', { dormitorios: 3 }), /superficie/i);
  assert.throws(() => generarPartido('L_con_patio', { superficie_m2: 90, dormitorios: 9 }), /dormitorios/);
  assert.throws(() => generarPartido('hexagono', prog), /no soportado/);
});

test('predio 12×28 con acceso por un extremo: cada alternativa que cabe respeta el predio y el acceso; las que no, se explican', () => {
  const predio = { ring: [[0, 0], [12000, 0], [12000, 28000], [0, 28000]] };
  const a = generarAlternativas({ programa: prog, predio, acceso: 'S', semilla: 0 });
  assert.ok(a.alternativas.length >= 2);
  for (const alt of a.alternativas) { assert.ok(alt.encaje.cabe, alt.concepto); const g = alt.geo; assert.ok(Math.min(...g.huella.anillos[0].ring.map((p) => p[1])) >= 0 && Math.max(...g.huella.anillos[0].ring.map((p) => p[0])) <= 12000); const acc = alt.esquema.openings.find((o) => o.funcion === 'acceso'); assert.ok(acc, 'hay puerta de acceso'); assert.ok(acc.centro[1] <= Math.min(...g.huella.anillos[0].ring.map((p) => p[1])) + 400, 'el acceso queda hacia el frente (sur)'); }
  const estrecho = generarAlternativas({ programa: { ...prog, superficie_m2: 200 }, predio: { ring: [[0, 0], [8000, 0], [8000, 12000], [0, 12000]] }, acceso: 'S' });
  assert.equal(estrecho.alternativas.length, 0); assert.ok(estrecho.descartadas.length >= 1 && estrecho.minimo_cumplido === false);
});

test('norte conocido: el patio del L se orienta hacia el norte verdadero en el hemisferio sur', () => {
  const a = generarAlternativas({ programa: prog, conceptos: ['L_con_patio'], norte_deg: 0, hemisferio: 'S' });
  const r = a.alternativas[0]; const patio = r.esquema.exterior_areas.find((e) => e.id === 'patio'); const ys = r.geo.huella.anillos[0].ring.map((p) => p[1]);
  const cy = (Math.min(...patio.ring.map((p) => p[1])) + Math.max(...patio.ring.map((p) => p[1]))) / 2; assert.ok(cy > (Math.min(...ys) + Math.max(...ys)) / 2 - 1, 'patio en la mitad norte');
  const b = generarAlternativas({ programa: prog, conceptos: ['L_con_patio'], norte_deg: 90, hemisferio: 'S' }).alternativas[0]; // norte verdadero hacia +X local
  const pb = b.esquema.exterior_areas.find((e) => e.id === 'patio'); const xs = b.geo.huella.anillos[0].ring.map((p) => p[0]);
  const cx = (Math.min(...pb.ring.map((p) => p[0])) + Math.max(...pb.ring.map((p) => p[0]))) / 2; assert.ok(cx > (Math.min(...xs) + Math.max(...xs)) / 2 - 1, 'patio hacia el este local cuando el norte está a 90°');
});
