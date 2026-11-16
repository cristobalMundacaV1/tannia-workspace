// TW-11 G2: ledger de claims, verificación por roles numéricos (T10/T10b) y herramientas MCP del núcleo (flag ON).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome, startClient, call, data } from './helpers.js';
import { Ledger, claimsDeOperacion, claimDeDato, claimPendiente, claimSupuesto } from '../src/cic/claims.js';
import { verificarEntregable, candidatosNumericos } from '../src/cic/verificador.js';
import { ejecutarOperacion } from '../src/cic/ops/index.js';

const M = (value, unit = 'm') => ({ value, unit });
const vol = () => ejecutarOperacion('geo.volume.average_end_area', { stations: M([0, 10, 20]), areas: M([2, 6, 10], 'm2') });

test('claims: ids deterministas/reproducibles, procedencia completa y cascada stale', () => {
  const r1 = vol(); const r2 = vol(); const a = claimsDeOperacion(r1, { etiqueta: 'Excavación' }); const b = claimsDeOperacion(r2, { etiqueta: 'Excavación' });
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id)); const cv = a.find((c) => c.statement.includes('→ volume'));
  assert.equal(cv.value, 120); assert.equal(cv.unit, 'm3'); assert.equal(cv.method_ref.maturity, 'E2'); assert.equal(cv.method_ref.input_hash, r1.input_hash); assert.equal(cv.kind, 'calculation');
  const L = new Ledger(); a.forEach((c) => L.add(c));
  const derivado = { ...claimsDeOperacion(ejecutarOperacion('geo.solid.extrude', { area: M(6, 'm2'), length: M(10), section_plane: { value: 'normal_to_path', unit: null } }))[0], id: 'clm-derivado', depends_on: [cv.id] }; L.add(derivado);
  const afect = L.invalidar([cv.id]); assert.ok(afect.includes('clm-derivado')); assert.equal(L.get('clm-derivado').status, 'stale'); assert.equal(L.get(cv.id).status, 'stale');
  assert.throws(() => L.add({ ...cv, kind: 'otro' })); const p = claimPendiente({ statement: 'Sostenimiento', requires_review_by: ['ingeniero_geotecnico'] }); assert.equal(p.status, 'not_computed'); assert.equal(claimSupuesto({ statement: 'Δs=10 m' }).status, 'assumed_editable');
});

test('T10: números técnicos sin respaldo se bloquean (slot sin claim, claim stale, valor distinto, cifra con unidad en texto)', () => {
  const L = new Ledger(); const cv = claimsDeOperacion(vol()).find((c) => c.statement.includes('→ volume')); L.add(cv);
  const ok = verificarEntregable({ slots: [{ id: 'vol', role: 'technical_result', value: 120, unit: 'm3', claim_id: cv.id }] }, { claims: L }); assert.ok(ok.ok, JSON.stringify(ok));
  let r = verificarEntregable({ slots: [{ id: 'vol', role: 'technical_result', value: 120, unit: 'm3' }] }, { claims: L }); assert.equal(r.bloqueos[0].codigo, 'SIN_CLAIM');
  r = verificarEntregable({ slots: [{ id: 'vol', role: 'technical_result', value: 999, unit: 'm3', claim_id: cv.id }] }, { claims: L }); assert.equal(r.bloqueos[0].codigo, 'VALOR_NO_COINCIDE');
  r = verificarEntregable({ slots: [{ id: 'vol', role: 'technical_result', value: 120000, unit: 'l', claim_id: cv.id }] }, { claims: L }); assert.ok(r.ok, 'conversión de unidades: 120 m3 = 120000 l');
  r = verificarEntregable({ texto: 'El volumen de excavación es 1.234,5 m³.' }, { claims: L }); assert.equal(r.bloqueos[0].codigo, 'NUMERO_SIN_RESPALDO');
  r = verificarEntregable({ texto: 'El volumen total es 120 m³ y 120,0 m3.' }, { claims: L }); assert.ok(r.ok, JSON.stringify(r.bloqueos));
  const sup = claimSupuesto({ statement: 'supuesto', value: 5, unit: 'm' }); L.add(sup); r = verificarEntregable({ slots: [{ id: 'x', role: 'technical_result', value: 5, unit: 'm', claim_id: sup.id }] }, { claims: L }); assert.equal(r.bloqueos[0].codigo, 'CLAIM_TIPO_INCORRECTO');
  const dato = claimDeDato({ statement: 'largo dado', value: 100, unit: 'm' }); L.add(dato);
  r = verificarEntregable({ slots: [{ id: 'x', role: 'technical_result', value: 100, unit: 'm', claim_id: dato.id }] }, { claims: L }); assert.equal(r.bloqueos[0].codigo, 'DATO_NO_ES_RESULTADO');
  assert.ok(verificarEntregable({ slots: [{ id: 'x', role: 'input_parameter', value: 100, unit: 'm', claim_id: dato.id }] }, { claims: L }).ok);
  r = verificarEntregable({ slots: [{ id: 'x', role: 'source_datum', value: 100, unit: 'm', claim_id: dato.id }] }, { claims: L }); assert.equal(r.bloqueos[0].codigo, 'SIN_FUENTE');
  L.invalidar([cv.id]); r = verificarEntregable({ slots: [{ id: 'vol', role: 'technical_result', value: 120, unit: 'm3', claim_id: cv.id }] }, { claims: L }); assert.equal(r.bloqueos[0].codigo, 'CLAIM_NO_VIGENTE');
});

test('T10b: entregable correcto con numeración, ids, π, versiones, fechas y conteos NO se bloquea (0 falsos bloqueos)', () => {
  const L = new Ledger(); const cv = claimsDeOperacion(vol()).find((c) => c.statement.includes('→ volume')); L.add(cv);
  const texto = [
    'MEMORIA DE CÁLCULO — Plano N° 4, Hoja 2 de 7, página 12. Revisión v003 (2026-11-16).',
    'Partida 03.02.015 "Excavación en terreno"; ítem 4.3; código CP-12; Anexo B-2.',
    'Se usaron 3 secciones y 2 tramos; la fórmula V = Σ (A₁+A₂)/2 · Δs incluye el factor 1/2 y π = 3,14159 en las secciones circulares.',
    'Volumen total de excavación: 120 m³ (claim reproducible). Versión del método 1.0.0, SHA 0f3a9c.',
  ].join('\n');
  const r = verificarEntregable({ texto, slots: [{ id: 'pag', role: 'doc_numbering', value: 12 }, { id: 'pi', role: 'math_constant', value: 3.14159 }, { id: 'id', role: 'identifier', value: '03.02.015' }, { id: 'meta', role: 'metadata', value: 1 }, { id: 'v', role: 'technical_result', value: 120, unit: 'm3', claim_id: cv.id }] }, { claims: L });
  assert.ok(r.ok, JSON.stringify(r.bloqueos)); assert.equal(r.stats.exentos, 4); assert.ok(r.avisos.length >= 1, 'los números sin unidad solo avisan'); assert.equal(r.bloqueos.length, 0);
  // sin respaldo en un entregable con muchas cifras sin unidad: nunca bloquea por ellas
  assert.ok(verificarEntregable({ texto: 'Se revisaron 12 planos, 4 secciones y 300 páginas. Plano 7. Item 3.1.' }, { claims: new Ledger() }).ok);
  assert.deepEqual(candidatosNumericos('1.234'), [1.234, 1234]); assert.deepEqual(candidatosNumericos('1.234,5'), [1234.5]);
});

test('MCP (flag ON): calcular → claims → verificar; unidades incompatibles y fuera de rango = error sin cálculo; versiones inmutables', async () => {
  const home = tmpHome('Tannia ñ cic '); const { client: c, close } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Obra Túnel ñ';
  try {
    assert.ok(!(await call(c, 'tannia_proyecto_crear', { nombre: P })).isError);
    let r = await call(c, 'tannia_cic_catalogo', { tipo: 'operaciones' }); assert.ok(!r.isError); assert.ok(data(r).operaciones.some((o) => o.id === 'geo.volume.prismoidal' && o.madurez === 'E2'));
    r = await call(c, 'tannia_cic_catalogo', { id: 'geo.sweep.volume' }); assert.ok(data(r).applicability.validity.some((v) => /1 − κ/.test(v)));
    r = await call(c, 'tannia_cic_calcular', { proyecto: P, caso: 'Excavación', operacion: 'geo.volume.average_end_area', entradas: { stations: M([0, 10, 20]), areas: M([2, 6, 10], 'm2') }, etiqueta: 'Volumen de excavación tramo 1' }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300));
    let d = data(r); assert.equal(d.resultados.volume.valor, 120); assert.equal(d.resultados.volume.unidad, 'm3'); assert.equal(d.caso_version, 'v002'); assert.ok(d.claims.length === 2);
    r = await call(c, 'tannia_cic_claims', { proyecto: P, caso: 'Excavación', tipo: 'calculation' }); d = data(r); assert.equal(d.claims.length, 2); assert.match(d.claims[0].metodo, /geo\.volume\.average_end_area@1\.0\.0 \(E2\)/);
    const vid = d.claims.find((x) => x.texto.includes('→ volume')).id;
    r = await call(c, 'tannia_cic_verificar', { proyecto: P, caso: 'Excavación', slots: [{ id: 'v', role: 'technical_result', value: 120, unit: 'm3', claim_id: vid }, { id: 'p', role: 'doc_numbering', value: 4 }], texto: 'Volumen: 120 m³ en la hoja 4.' }); assert.equal(data(r).ok, true, JSON.stringify(data(r)));
    r = await call(c, 'tannia_cic_verificar', { proyecto: P, caso: 'Excavación', texto: 'Volumen: 500 m³.' }); assert.equal(data(r).ok, false); assert.equal(data(r).bloqueos[0].codigo, 'NUMERO_SIN_RESPALDO');
    // errores tipificados SIN cálculo parcial
    r = await call(c, 'tannia_cic_calcular', { operacion: 'geo.volume.average_end_area', entradas: { stations: M([0, 10]), areas: M([2, 6], 'm') } }); assert.equal(r.isError, true); assert.equal(data(r).error, 'DIMENSION_INCOMPATIBLE');
    r = await call(c, 'tannia_cic_calcular', { operacion: 'geo.section.arch', entradas: { luz: M(8), altura_hastial: M(0), flecha: M(5) } }); assert.equal(data(r).error, 'OUT_OF_RANGE');
    r = await call(c, 'tannia_cic_calcular', { operacion: 'geo.section.circle', entradas: { radio: { value: 2 } } }); assert.equal(data(r).error, 'UNIDAD_FALTANTE');
    r = await call(c, 'tannia_cic_calcular', { operacion: 'inventada.x', entradas: {} }); assert.equal(data(r).error, 'OPERACION_DESCONOCIDA');
    // versiones inmutables: v001 (vacía), v002 (cálculo); un segundo cálculo crea v003 sin tocar v002
    const dir = path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', 'Excavación'); const h2 = fs.readFileSync(path.join(dir, 'v002.json'), 'utf8');
    r = await call(c, 'tannia_cic_calcular', { proyecto: P, caso: 'Excavación', operacion: 'geo.section.circle', entradas: { radio: M(2) } }); assert.equal(data(r).caso_version, 'v003'); assert.equal(fs.readFileSync(path.join(dir, 'v002.json'), 'utf8'), h2);
    assert.equal((await call(c, 'tannia_cic_claims', { proyecto: P, caso: 'Excavación', version: 'v002' })).structuredContent.claims.length, 2);
  } finally { await close(); }
});
