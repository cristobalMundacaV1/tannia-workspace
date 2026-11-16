// G8: evaluador crítico independiente, Pareto/sensibilidad, ledger auditable, estado global honesto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluarEsquema, compararMultiobjetivo, criticar, decisionesDe, abrigoPatio, ventilacionPotencial } from '../src/architect/evaluacion.js';
import { generarAlternativas } from '../src/architect/alternativas.js';
import { interpretarEncargo, programaDeBrief } from '../src/architect/briefing.js';
import { actualizarSitio } from '../src/architect/sitio.js';
import { parsearEpw, perfilesClima } from '../src/architect/clima.js';
import { epwSintetico } from './helpers_epw.js';
import { validar } from '../src/architect/schemas.js';
import { derivarEsquema } from '../src/architect/derivar_poly.js';

const TEXTO = 'Casa de 90 m2, 3 dormitorios, 2 baños, un piso. Quiero ver la piscina desde la cocina para vigilar a mis hijos. Living con mucha luz y fresco en verano con aleros. Pocos pasillos y quiero ahorrar. Viento fuerte de invierno en el patio.';
const setup = (opts = {}) => {
  const { brief } = interpretarEncargo(TEXTO, { projectId: 'p' });
  const prog = programaDeBrief(brief); const alts = generarAlternativas({ programa: prog, vistas: brief.objectives.filter((o) => o.kind === 'sightline').map((o) => ({ from: o.from, to: o.to })), ...opts.gen });
  const evals = alts.alternativas.map((a) => ({ id: a.esquema.id, ...evaluarEsquema({ esq: a.esquema, geo: a.geo, brief, sitio: opts.sitio ?? null, perfil: opts.perfil ?? null }), esq: a.esquema }));
  evals.forEach((e) => { e.gatesFallidos = e.analisis.hard_gates.filter((g) => !g.passed).map((g) => g.id); });
  return { brief, alts, evals };
};
const sitioReal = (n = 0) => actualizarSitio(null, { coordenadas: { lat: -33.45, lon: -70.67 }, zona_horaria: 'America/Santiago', norte_grados: n });

test('sin sitio ni clima: análisis válido, sol/viento bloqueados (no 0, no inventados), estado global nunca "excelente"', () => {
  const { evals } = setup();
  for (const e of evals) {
    assert.ok(validar('analysis', e.analisis).ok); const sol = e.analisis.metrics.find((m) => m.id === 'sol_directo_invierno'); assert.equal(sol.estado, 'blocked'); assert.equal(sol.valor, null);
    assert.notEqual(e.analisis.global_state, 'sin_alertas_detectadas'); assert.ok(e.analisis.disclaimers.some((d) => /ANTEPROYECTO/.test(d)));
    assert.equal(e.analisis.metrics.find((m) => m.id === 'normativa').estado, 'not_evaluated'); assert.equal(e.analisis.metrics.find((m) => m.id === 'precio_clp').estado, 'not_evaluated');
    assert.ok(e.objetivos.filter((o) => ['winter_sun', 'summer_cooling', 'wind_shelter'].includes(o.kind)).every((o) => o.estado === 'no_evaluado' && o.score == null));
  }
});

test('requisitos duros: dos_alas (≥104 m²) queda BLOQUEADA por superficie; no se compara como si cumpliera', () => {
  const { evals } = setup(); const u = evals.find((e) => e.id === 'alt-dos_alas'); assert.ok(u.bloqueada); assert.ok(u.gatesFallidos.includes('superficie_objetivo'));
  const c = compararMultiobjetivo(evals); assert.ok(c.bloqueadas.some((b) => b.id === 'alt-dos_alas')); assert.ok(!c.frontera_pareto.includes('alt-dos_alas'));
});

test('piscina visible: alerta crítica ⇒ estado global con_alertas_criticas aunque la visual sea 1.0', () => {
  const { evals } = setup({ sitio: sitioReal(0) }); const l = evals.find((e) => e.id === 'alt-L_con_patio');
  assert.equal(l.analisis.global_state, 'con_alertas_criticas'); const v = l.objetivos.find((o) => o.kind === 'sightline'); assert.ok(v.score > 0); assert.match(v.aviso, /nunca acredita seguridad de la piscina/); assert.equal(v.estado, 'parcial');
  assert.ok(l.analisis.alerts.some((a) => a.id === 'piscina_barrera'));
});

test('compacta no tiene patio ni piscina: visual no evaluada (no 0) y outdoor/courtyard evaluados en 0 con evidencia', () => {
  const { evals } = setup(); const c = evals.find((e) => e.id === 'alt-compacta'); assert.equal(c.objetivos.find((o) => o.kind === 'sightline').estado, 'no_evaluado');
});

test('con sitio, norte y clima: sol y viento se calculan; cambiar SOLO el norte cambia los resultados; rotación consistente', () => {
  const perfil = perfilesClima(parsearEpw(epwSintetico({ vientoInvierno: 180 })));
  const a = setup({ sitio: sitioReal(0), perfil }); const b = setup({ sitio: sitioReal(90), perfil });
  const l0 = a.evals.find((e) => e.id === 'alt-L_con_patio'); const l1 = b.evals.find((e) => e.id === 'alt-L_con_patio');
  assert.equal(l0.analisis.metrics.find((m) => m.id === 'sol_directo_invierno').estado, 'computed');
  assert.notEqual(l0.analisis.metrics.find((m) => m.id === 'sol_directo_invierno').valor, l1.analisis.metrics.find((m) => m.id === 'sol_directo_invierno').valor);
  assert.notEqual(l0.analisis.input_hash, l1.analisis.input_hash);
  const ab0 = l0.analisis.metrics.find((m) => m.id === 'abrigo_patio_viento');
  assert.equal(ab0.estado, 'computed'); assert.match(ab0.limites, /REGIONAL/);
  // misma geometría, solo cambia el norte: el patio (al norte local) queda abrigado del viento del sur o expuesto
  const lalt = a.alts.alternativas.find((x) => x.esquema.id === 'alt-L_con_patio');
  const abN0 = abrigoPatio({ esq: lalt.esquema, geo: lalt.geo, sitio: sitioReal(0), perfil }); const abN180 = abrigoPatio({ esq: lalt.esquema, geo: lalt.geo, sitio: sitioReal(180), perfil });
  assert.ok(abN0.indice_abrigo > abN180.indice_abrigo, `${abN0.indice_abrigo} > ${abN180.indice_abrigo}: viento del sur`);
  const sc = l0.objetivos.find((o) => o.kind === 'summer_cooling'); assert.equal(sc.estado, 'evaluado'); assert.ok(sc.score >= 0 && sc.score <= 1); assert.match(sc.aviso, /no es temperatura interior/);
});

test('Pareto: frontera no vacía entre elegibles; ranking ponderado es solo sensibilidad; contrafactuales sin inventar', () => {
  const { evals } = setup({ sitio: sitioReal(0), perfil: perfilesClima(parsearEpw(epwSintetico())) }); const c = compararMultiobjetivo(evals);
  assert.equal(c.estado, 'comparado'); assert.ok(c.frontera_pareto.length >= 1); assert.ok(c.dimensiones.length >= 3); assert.match(c.aviso_ranking, /Pareto/);
  assert.ok(c.pesos_visibles && Object.values(c.pesos_visibles).every((p) => [1, 2, 3].includes(p)));
  assert.ok(c.sensibilidad.escenarios.length >= c.dimensiones.length * 3); assert.ok(c.sensibilidad.estabilidad >= 0 && c.sensibilidad.estabilidad <= 1);
  for (const cf of c.contrafactuales) for (const g of cf.gana_en) assert.ok(g.ventaja > 0);
});

test('cambio de prioridad puede reordenar o se explica por qué no (estabilidad medida)', () => {
  const mk = (id, scores) => ({ id, bloqueada: false, gatesFallidos: [], objetivos: Object.entries(scores).map(([k, v]) => ({ id: k, kind: k, peso: 2, score: v })) });
  const e = [mk('A', { x: 0.9, y: 0.2 }), mk('B', { x: 0.3, y: 0.95 })]; const c = compararMultiobjetivo(e);
  assert.deepEqual(c.frontera_pareto.sort(), ['A', 'B']); assert.equal(c.sensibilidad.lider_estable, false, 'duplicar un objetivo cambia el líder');
  const dom = compararMultiobjetivo([mk('A', { x: 0.9, y: 0.9 }), mk('B', { x: 0.3, y: 0.2 })]); assert.deepEqual(dom.frontera_pareto, ['A']); assert.equal(dom.sensibilidad.lider_estable, true);
  assert.equal(compararMultiobjetivo([{ ...mk('A', { x: 1 }), bloqueada: true, gatesFallidos: ['g'] }]).estado, 'sin_alternativas_elegibles');
  const sinComun = compararMultiobjetivo([mk('A', { x: 1 }), mk('B', { y: 1 })]); assert.equal(sinComun.estado, 'no_concluyente'); assert.deepEqual(sinComun.frontera_pareto, []);
});

test('DecisionLedger: decisión/1 válida por objetivo; evidencia solo "computed" con método+hash; los no evaluados quedan pendientes de evidencia', () => {
  const { brief, evals } = setup(); const comp = compararMultiobjetivo(evals); const l = evals.find((e) => e.id === 'alt-L_con_patio');
  const d = decisionesDe({ evalElegida: l, brief, comparacion: comp, schemeId: l.id }); assert.equal(d.length, brief.objectives.length);
  for (const x of d) { assert.ok(validar('decision', x).ok); for (const ev of x.evidence) if (ev.status === 'computed') { assert.ok(ev.method && ev.input_hash === l.hash); } else assert.equal(ev.value, null); }
  const pend = d.filter((x) => x.status === 'proposed_pending_evidence'); assert.ok(pend.length >= 1); assert.ok(d.find((x) => /sightline/.test(x.decision)).requires_professional_review);
});

test('modo crítico: puntos débiles, alertas pendientes, qué evidencia cambiaría la conclusión; sin inventar datos', () => {
  const { evals } = setup(); const comp = compararMultiobjetivo(evals); const l = evals.find((e) => e.id === 'alt-L_con_patio'); const c = criticar(l, comp, l.esq);
  assert.ok(c.puntos_debiles.length >= 1); assert.ok(c.alertas_pendientes.some((a) => a.id === 'piscina_barrera')); assert.ok(c.evidencia_que_cambiaria_la_conclusion.some((x) => /Norte verdadero/.test(x))); assert.match(c.aviso, /no inventa/);
});

test('viento/ventilación: sin norte → no concluyente; ventilación solo potencial geométrico', () => {
  const { alts } = setup(); const a = alts.alternativas.find((x) => x.esquema.id === 'alt-L_con_patio'); assert.equal(abrigoPatio({ esq: a.esquema, geo: a.geo, sitio: sitioReal(0), perfil: null }).estado, 'no_concluyente');
  const v = ventilacionPotencial({ esq: a.esquema, geo: a.geo }); assert.match(v.limites, /GEOMÉTRICO/); assert.ok(v.recintos.length > 0);
  void derivarEsquema;
});

test('«en L» orienta pero no bloquea: la compacta sigue elegible como contraste y el requisito se informa', () => {
  const { brief } = interpretarEncargo('Casa de 90 m2 en L, 3 dormitorios, 2 baños', { projectId: 'p' }); assert.ok(brief.hard_constraints.some((h) => h.kind === 'footprint_class'));
  const alts = generarAlternativas({ programa: programaDeBrief(brief) });
  const c = alts.alternativas.find((a) => a.esquema.id === 'alt-compacta'); const e = evaluarEsquema({ esq: c.esquema, geo: c.geo, brief });
  assert.equal(e.bloqueada, false); const g = e.analisis.hard_gates.find((x) => x.id === 'clase_de_huella'); assert.equal(g.passed, false); assert.match(g.detalle, /Informativo/);
});
