// G1 (issue #32, PL-03..07): núcleo DXF frente a un verificador independiente y pruebas de MUTACIÓN.
// Cada mutación deliberada (escala, entidad, cota, tipo de línea, duplicado) debe ser detectada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tunnelModel, compose, LAYERS } from '../src/drawing/model.js';
import { modeloDesdeEspecificacion } from '../src/drawing/especificacion.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { verificarDxfContraModelo, analizarDxf } from '../src/drawing/dxf_verificar.js';

const F = { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 };
const tunel = () => compose(tunnelModel({ fortificacion: F }));
const code = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };
const espec = (extra = {}) => ({
  codigo: 'G1', especialidad: 'edificación', proyecto: 'Prueba G1', capas: { MURO: { color: 7, grosor: 0.35, leyenda: 'Muro' }, EJE2: { color: 1, grosor: 0.18, leyenda: 'Eje', trazo: [6, 2, 1, 2] } },
  vistas: [{ id: 'planta', titulo: 'Planta', tipo: 'planta', escala: 50, elementos: [{ tipo: 'rectangulo', capa: 'MURO', origen: [0, 0], ancho: 4, alto: 3 }, { tipo: 'circulo', capa: 'MURO', centro: [2, 1.5], radio: 0.4 }, { tipo: 'linea', capa: 'EJE2', a: [-0.5, 1.5], b: [4.5, 1.5] }], cotas: [{ tipo: 'lineal', a: [0, 0], b: [4, 0], desfase: 8 }] }],
  laminas: [{ id: '01', titulo: 'Planta', vistas: ['planta'] }], ...extra,
});

test('túnel UAT-02: el DXF coincide entidad por entidad con el modelo, sin cotas duplicadas en el papel', () => {
  const c = tunel(); const dxf = buildDrawingDxf(c); const v = verificarDxfContraModelo(dxf, c);
  assert.deepEqual(v.problemas, []); assert.ok(v.resumen.entidades_modelo >= 30 && v.resumen.cotas >= 9, JSON.stringify(v.resumen));
});

test('PL-07: cota vertical del perfil exagerado (1:500 H / 1:100 V) muestra el valor físico vía DIMLFAC = 1/5', () => {
  const c = tunel(); const S = analizarDxf(buildDrawingDxf(c)); const perfil = c.model.views.find((v) => v.id === 'perfil');
  const vertical = perfil.dimensions.find((d) => d.kind === 'linear' && Math.abs(d.a[1] - d.b[1]) > 1e-9);
  assert.ok(vertical, 'el perfil tiene una cota vertical');
  const dims = S.ENTITIES.filter((e) => e.tipo === 'DIMENSION'); const con = dims.filter((e) => e.codigos.some(([k, x]) => k === 1070 && Number(x) === 144));
  assert.ok(con.length >= 1, 'al menos una cota con DIMLFAC');
  const i = con[0].codigos.findIndex(([k, x]) => k === 1070 && Number(x) === 144); assert.ok(Math.abs(Number(con[0].codigos[i + 1][1]) - 0.2) < 1e-12, 'DIMLFAC = 100/500');
});

test('PL-05: un círculo de la especificación es CIRCLE nativo (no ARC 0–360)', () => {
  const c = compose(modeloDesdeEspecificacion(espec())); const dxf = buildDrawingDxf(c); const S = analizarDxf(dxf);
  assert.equal(S.ENTITIES.filter((e) => e.tipo === 'CIRCLE').length, 1); assert.equal(S.ENTITIES.filter((e) => e.tipo === 'ARC').length, 0);
  assert.deepEqual(verificarDxfContraModelo(dxf, c).problemas, []);
});

test('PL-06: tipo de línea declarado → LTYPE con los mismos elementos que el PDF; capa continua = Continuous (nombre canónico de AutoCAD)', () => {
  const c = compose(modeloDesdeEspecificacion(espec())); const S = analizarDxf(buildDrawingDxf(c));
  const lt = S.TABLES.find((e) => e.tipo === 'LTYPE' && e.codigos.some(([k, x]) => k === 2 && x === 'TW_EJE2'));
  assert.ok(lt, 'existe TW_EJE2'); assert.deepEqual(lt.codigos.filter(([k]) => k === 49).map(([, x]) => Number(x)), [6, -2, 1, -2]);
  const capa = (nm) => S.TABLES.find((e) => e.tipo === 'LAYER' && e.codigos.some(([k, x]) => k === 2 && x === nm)).codigos.find(([k]) => k === 6)[1];
  assert.equal(capa('EJE2'), 'TW_EJE2'); assert.equal(capa('MURO'), 'Continuous');
  const t = tunel(); const St = analizarDxf(buildDrawingDxf(t)); const eje = St.TABLES.find((e) => e.tipo === 'LTYPE' && e.codigos.some(([k, x]) => k === 2 && x === 'TW_EJE'));
  assert.deepEqual(eje.codigos.filter(([k]) => k === 49).map(([, x]) => Number(x)), LAYERS.EJE.dash.map((x, i) => (i % 2 ? -x : x)), 'oráculo: patrón declarado en LAYERS');
  assert.ok(buildDrawingDxf(t).includes('$PSLTSCALE\n70\n1'), 'PSLTSCALE = 1');
  const malo = espec(); malo.capas.EJE2.trazo = [6, 2, 1]; assert.equal(code(() => modeloDesdeEspecificacion(malo)), 'TRAZO_INVALIDO');
});

test('PL-04: arcos o cotas radiales en un perfil con exageración vertical se rechazan (spec y escritor)', () => {
  const s = espec({ vistas: [{ id: 'p', titulo: 'Perfil', tipo: 'perfil', escala: 500, escala_vertical: 100, elementos: [{ tipo: 'arco', capa: 'MURO', centro: [10, 0], radio: 5, inicio: 0, fin: 180 }] }], laminas: [{ id: '01', titulo: 'P', vistas: ['p'] }] });
  assert.equal(code(() => modeloDesdeEspecificacion(s)), 'GEOMETRIA_NO_SOPORTADA');
  const c = tunel(); const perfil = c.model.views.find((v) => v.id === 'perfil');
  perfil.entities.push({ kind: 'arc', layer: 'EJE', center: [10, 0], radius: 5, start: 0, end: 90 });
  assert.equal(code(() => buildDrawingDxf(c)), 'ARCO_EN_PERFIL_EXAGERADO');
});

// ---- Mutaciones: el verificador debe detectar cada error deliberado ----
// Las mutaciones se aplican en la sección ENTITIES (espacio modelo), salvo que se indique otra cosa.
const mutar = (dxf, re, f) => { const i = dxf.indexOf('\nENTITIES\n'); const out = dxf.slice(0, i) + dxf.slice(i).replace(re, f); assert.notEqual(out, dxf, `la mutación ${re} no aplicó`); return out; };
test('mutaciones deliberadas (escala, entidad, cota, tipo de línea, duplicado, círculo como arco) son detectadas', () => {
  const c = tunel(); const dxf = buildDrawingDxf(c);
  const casos = {
    'coordenada desplazada 1 mm': mutar(dxf, /(\nLINE\n(?:[^\n]*\n)*?10\n)([-\d.]+)/, (_, a, x) => `${a}${Number(x) + 0.001}`),
    'escala ×1,01 en un radio': mutar(dxf, /(\nARC\n(?:[^\n]*\n)*?40\n)([\d.]+)/, (_, a, x) => `${a}${Number(x) * 1.01}`),
    'entidad eliminada': mutar(dxf, /\n0\nLINE\n(?:(?!\n0\n)[\s\S])*/, ''),
    'cota con punto movido': mutar(dxf, /(\nDIMENSION\n(?:[^\n]*\n)*?14\n)([-\d.]+)/, (_, a, x) => `${a}${Number(x) + 0.5}`),
    'capa sin su tipo de línea': dxf.replace( /(\n2\nEJE\n(?:[^\n]*\n)*?6\n)TW_EJE/, (_, a) => `${a}CONTINUOUS`),
    'DIMLFAC alterado': mutar(dxf, /(\n1070\n144\n1040\n)([\d.]+)/, (_, a) => `${a}1`),
  };
  for (const [nombre, m] of Object.entries(casos)) assert.equal(verificarDxfContraModelo(m, c).ok, false, `no detectó: ${nombre}`);
  // Duplicado en papel: se inyecta un texto de cota en un layout.
  const dup = dxf.replace(/(\n0\nENDBLK\n)/, `\n0\nTEXT\n5\nFFFF\n330\n1\n100\nAcDbEntity\n8\nPAPEL\n67\n1\n410\nX\n100\nAcDbText\n10\n0\n20\n0\n30\n0\n40\n2.5\n1\n5,50 m$1`);
  assert.equal(verificarDxfContraModelo(dup, c).ok, false, 'no detectó la cota duplicada en el papel');
  const cs = compose(modeloDesdeEspecificacion(espec())); const dc = buildDrawingDxf(cs);
  const comoArco = dc.replace('\n0\nCIRCLE\n', '\n0\nARC\n').replace('\n40\n0.4\n', '\n40\n0.4\n100\nAcDbArc\n50\n0\n51\n360\n'); assert.notEqual(comoArco, dc);
  assert.equal(verificarDxfContraModelo(comoArco, cs).ok, false, 'no detectó el círculo como ARC');
});

test('revisión #33 ítems 2 y 3: XDATA de identidad alterada y cota trasladada completa (mismo vector) son detectadas', () => {
  const c = tunel(); const dxf = buildDrawingDxf(c); assert.equal(verificarDxfContraModelo(dxf, c).ok, true);
  const i = dxf.indexOf('\nENTITIES\n'); const ent = dxf.slice(i);
  const refAlterada = dxf.slice(0, i) + ent.replace(/\n1000\nref=([^\n]+)/, (_, r) => `\n1000\nref=${r}X`); assert.notEqual(refAlterada, dxf);
  assert.equal(verificarDxfContraModelo(refAlterada, c).ok, false, 'ref alterado con geometría idéntica');
  const rolAlterado = dxf.slice(0, i) + ent.replace(/\n1000\nrol=([^\n]+)/, '\n1000\nrol=otro'); assert.equal(verificarDxfContraModelo(rolAlterado, c).ok, false, 'rol alterado');
  const sinTraza = dxf.slice(0, i) + ent.replace(/\n1001\nTANNIA_TRACE(\n1000\n[^\n]+)+/, ''); assert.equal(verificarDxfContraModelo(sinTraza, c).ok, false, 'traza eliminada');
  // Traslación conjunta de ambos anclajes (13/23 y 14/24) + 0,5 m: la distancia se conserva, pero los puntos ya no son los del modelo.
  const trasl = dxf.slice(0, i) + ent.replace(/(\nDIMENSION\n(?:[^\n]*\n)*?13\n)([-\d.]+)(\n23\n)([-\d.]+)(\n33\n[-\d.]+\n14\n)([-\d.]+)(\n24\n)([-\d.]+)/, (_, a, x1, b, y1, m, x2, d, y2) => `${a}${Number(x1) + 0.5}${b}${Number(y1) + 0.5}${m}${Number(x2) + 0.5}${d}${Number(y2) + 0.5}`);
  assert.notEqual(trasl, dxf, 'la mutación de anclajes aplicó');
  const r = verificarDxfContraModelo(trasl, c); assert.equal(r.ok, false); assert.ok(r.problemas.some((p) => /anclajes/.test(p)), r.problemas.join(' | '));
});
