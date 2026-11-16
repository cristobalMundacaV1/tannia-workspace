// G7: recorridos, visuales con ray casting (piscina), seguridad, privacidad, constructibilidad relativa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recorridos, visual, seguridad, privacidad, constructibilidad } from '../src/architect/habitabilidad.js';
import { generarPartido } from '../src/architect/partidos.js';
import { derivarEsquema, huellaDeEspacios } from '../src/architect/derivar_poly.js';
import { actualizarSitio, predioRectangular } from '../src/architect/sitio.js';

const prog = { superficie_m2: 90, dormitorios: 3, banos: 2, piscina: true };
const L = () => generarPartido('L_con_patio', prog); const C = () => generarPartido('compacta', prog); const U = () => generarPartido('dos_alas', prog);

test('recorridos: todos los recintos alcanzables desde el acceso; distancias finitas; circulación % calculada; cruce social detectado donde corresponde', () => {
  for (const r of [L(), C(), U()]) { const rec = recorridos(r.esquema, r.geo); assert.deepEqual(rec.recintos_sin_ruta, []); assert.ok(rec.circulacion_pct >= 0); assert.ok(Object.values(rec.desde_acceso).every((v) => v.distancia_m > 0 || v.ruta?.length === 1 || v.distancia_m === 0)); assert.match(rec.limites, /no es flujo real/); }
  const c = recorridos(C().esquema, C().geo); assert.ok(c.cocina_a_living.distancia_m < 6, 'cocina americana junto al living');
  const l = recorridos(L().esquema, L().geo); assert.ok(l.circulacion_pct < c.circulacion_pct + 10);
});

test('visual cocina→piscina: en el L con patio la cocina ve la zona; con un muro interpuesto queda obstruida; siempre trae el límite de seguridad', () => {
  const r = L(); const v = visual(r.esquema, r.geo, { desde: 'R-COC', hacia: 'pool_play_zone' });
  assert.ok(['visible', 'parcial'].includes(v.estado), JSON.stringify(v)); assert.match(v.limites, /NUNCA acredita seguridad de la piscina/); assert.equal(v.conclusion, 'visual_geometrica_preliminar');
  // sin ventana de cocina al patio ni paso: la visual desaparece → obstruida
  const sin = JSON.parse(JSON.stringify(r.esquema)); sin.openings = sin.openings.filter((o) => !(o.entre[0] === 'R-COC' && o.tipo === 'ventana')); const g = derivarEsquema(sin);
  const vo = visual(sin, g, { desde: 'R-COC', hacia: 'pool_play_zone' }); assert.equal(vo.estado, 'obstruida'); assert.ok(vo.bloqueado_por.length >= 1);
});

test('visual: sin zona de piscina (compacta) o recinto inexistente → no evaluado con razón, nunca un número', () => {
  const c = C(); assert.equal(visual(c.esquema, c.geo, { desde: 'R-COC', hacia: 'pool_play_zone' }).estado, 'no_evaluado'); assert.equal(visual(c.esquema, c.geo, { desde: 'R-XX', hacia: 'pool_play_zone' }).estado, 'no_evaluado');
});

test('seguridad: piscina ⇒ alerta crítica de barrera y seguridad_demostrada=false aunque la visual sea buena; puerta directa sin control ⇒ crítica', () => {
  const r = L(); const s = seguridad(r.esquema, r.geo); assert.ok(s.alertas.some((a) => a.id === 'piscina_barrera' && a.severidad === 'critica')); assert.equal(s.seguridad_demostrada, false);
  assert.ok(s.alertas.some((a) => /^puerta_directa_/.test(a.id) && a.severidad === 'critica'), 'la puerta del living al patio con piscina sin control de acceso');
  const sin = seguridad(C().esquema, C().geo, { hayPiscina: false }); assert.ok(!sin.alertas.some((a) => a.id === 'piscina_barrera')); assert.equal(sin.seguridad_demostrada, false);
});

test('privacidad: ventanas enfrentadas entre zona privada y otra se detectan; deslinde cercano con predio; sin predio se declara no evaluado', () => {
  const R = (id, x0, y0, x1, y1, zona) => ({ id, nombre: id, tipo: 'x', zona, ring: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
  const sp = [R('A', 0, 0, 4000, 4000, 'social'), R('B', 9000, 0, 13000, 4000, 'privada')];
  const esq = { schema: 'tw.arch.scheme/2', id: 'p', brief_ref: 'b', site_ref: null, engine_version: 't', concept: 'dos_alas', rationale: '', footprint_polygons_mm: huellaDeEspacios(sp), open_courts_mm: [], espesores_mm: { ext: 200, int: 140 }, altura_piso_cielo_mm: 2500, spaces: sp, openings: [{ id: 'VA', tipo: 'ventana', entre: ['A'], exterior_side: 'E', ancho_mm: 1500, alto_mm: 1200, antepecho_mm: 900, centro: [4000, 2000] }, { id: 'VB', tipo: 'ventana', entre: ['B'], exterior_side: 'O', ancho_mm: 1500, alto_mm: 1200, antepecho_mm: 900, centro: [9000, 2000] }], exterior_areas: [], separaciones_abiertas: [], adjacencies: [], line_of_sight_goals: [], sources: [], model_status: 'concept' };
  const g = derivarEsquema(esq); const p = privacidad(esq, g); assert.ok(p.hallazgos.some((h) => h.tipo === 'ventanas_enfrentadas')); assert.equal(p.privacidad_vecinos, 'no_evaluado');
  const r = C(); const s = actualizarSitio(null, { predio: { anillo: predioRectangular(11000, 20000) } }); const pr = privacidad(r.esquema, r.geo, { sitio: s }); assert.equal(pr.privacidad_vecinos, 'evaluado');
});

test('constructibilidad: L y C tienen índice de envolvente mayor que la compacta y alertas de planta irregular; sin precios en pesos', () => {
  const c = constructibilidad(C().esquema, C().geo); const l = constructibilidad(L().esquema, L().geo); const u = constructibilidad(U().esquema, U().geo);
  assert.ok(l.indice_envolvente > c.indice_envolvente && u.indice_envolvente > c.indice_envolvente, `${c.indice_envolvente} < ${l.indice_envolvente}, ${u.indice_envolvente}`);
  assert.ok(l.alertas.some((a) => a.id === 'planta_irregular')); assert.equal(c.alertas.length, 0); assert.equal(c.precio.estado, 'no_estimado'); assert.ok(!/\$|CLP \d/.test(JSON.stringify(c)));
});
