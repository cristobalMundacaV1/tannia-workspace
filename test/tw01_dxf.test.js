import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseDxf, DxfError } from '../src/dxf/reader.js';
import { measureDxf } from '../src/dxf/measure.js';
import { FIX } from './helpers.js';

const load = (n) => parseDxf(fs.readFileSync(path.join(FIX, 'dxf', `${n}.dxf`)));
const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'expected.json'), 'utf8'));
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('simple: longitudes, perímetros y áreas coinciden con el oráculo analítico', () => {
  const r = measureDxf(load('simple_m'), { unidad_confirmada: 'm' });
  const t = r.totales_por_capa_unidades_dibujo;
  const e = expected.simple_m.layers;
  near(t.MUROS.longitud, e.MUROS.length);
  near(t.LOSA.area, e.LOSA.area);
  near(t.LOSA.perimetro, e.LOSA.length);
  near(t.COL.area, e.COL.area); near(t.COL.perimetro, e.COL.length);
  near(t.ARCOS.longitud, e.ARCOS.length);
  assert.equal(r.unidades.conversion, 'aplicada');
  near(r.totales_por_capa_metros.LOSA.area_m2, e.LOSA.area);
});

test('bloques: transformaciones, arreglos, anidamiento y espejo', () => {
  const r = measureDxf(load('bloques'), { unidad_confirmada: 'm' });
  near(r.totales_por_capa_unidades_dibujo.COL.area, expected.bloques.COL_area, 1e-9);
  assert.equal(r.mediciones.filter((m) => m.magnitud === 'area').length, expected.bloques.inserts_expanded);
  assert.ok(r.mediciones.some((m) => m.bloque === 'PORTICO > PILAR'));
});

test('duplicados excluidos de totales y reportados; abiertas y autointersección marcadas', () => {
  const r = measureDxf(load('duplicados_abiertas'), { unidad_confirmada: 'm' });
  near(r.totales_por_capa_unidades_dibujo.DUP.longitud, expected.duplicados_abiertas.DUP_length_unique);
  assert.equal(r.mediciones.filter((m) => m.estado === 'duplicada').length, expected.duplicados_abiertas.duplicates);
  near(r.totales_por_capa_unidades_dibujo.ABIERTA.longitud, 6);
  assert.ok(!('area' in r.totales_por_capa_unidades_dibujo.ABIERTA) || r.totales_por_capa_unidades_dibujo.ABIERTA.area === 0);
  const bow = r.mediciones.find((m) => m.capa === 'LOSA' && m.magnitud === 'area');
  assert.equal(bow.estado, 'needs_review');
  assert.match(bow.advertencias.join(' '), /Autointersecci/);
  assert.equal(r.necesita_revision, true);
});

test('unidades: mm confirmado convierte; sin unidades bloquea; discrepancia advierte', () => {
  const mm = measureDxf(load('mm'), { unidad_confirmada: 'mm' });
  near(mm.totales_por_capa_unidades_dibujo.LOSA.area, expected.mm.area_mm2);
  near(mm.totales_por_capa_metros.LOSA.area_m2, expected.mm.area_m2);
  const sin = measureDxf(load('sin_unidades'));
  assert.equal(sin.unidades.conversion, 'bloqueada');
  assert.equal(sin.totales_por_capa_metros, null);
  assert.equal(sin.necesita_revision, true);
  const sinDecl = measureDxf(load('mm'));          // declara mm pero no confirmado -> bloqueado igual
  assert.equal(sinDecl.unidades.conversion, 'bloqueada');
  const mal = measureDxf(load('mm'), { unidad_confirmada: 'm' });  // declara mm, usuario dice m
  assert.equal(mal.unidades.discrepancia, true);
  assert.equal(mal.necesita_revision, true);
});

test('archivos corruptos o no-DXF lanzan DxfError con código', () => {
  for (const [n, code] of [['corrupto', 'DXF_CORRUPTO'], ['no_es_dxf', 'NO_ES_DXF']]) {
    assert.throws(() => load(n), (e) => e instanceof DxfError && e.code === code, n);
  }
  assert.throws(() => parseDxf(''), (e) => e.code === 'DXF_VACIO');
  assert.throws(() => parseDxf('AutoCAD Binary DXF\r\n\x1a\0'), (e) => e.code === 'DXF_BINARIO');
  assert.throws(() => parseDxf('0\nSECTION\n2\nENTITIES\n0\nLINE\n'), (e) => e.code === 'DXF_CORRUPTO');
});

test('entidades no soportadas se listan (no se inventan cantidades)', () => {
  const r = measureDxf(load('solido_acis'), { unidad_confirmada: 'm' });
  assert.deepEqual(Object.keys(r.entidades_no_soportadas).sort(), ['3DSOLID', 'BODY', 'REGION', 'SURFACE']);
  assert.equal(r.mediciones.length, 0);
});

test('INSERT con bloque inexistente o recursivo -> needs_review sin colgarse', () => {
  const dxf = parseDxf(`0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nA\n10\n0\n20\n0\n0\nINSERT\n2\nA\n8\n0\n0\nENDBLK\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n2\nA\n8\n0\n0\nINSERT\n2\nXREF\n8\n0\n0\nENDSEC\n0\nEOF\n`);
  const r = measureDxf(dxf, { unidad_confirmada: 'm' });
  assert.ok(r.mediciones.some((m) => m.estado === 'needs_review' && /recursivo|no está definido/.test(m.advertencias.join())));
});

test('escala no uniforme con círculos/arcos no inventa valores', () => {
  const dxf = parseDxf(`0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nB\n10\n0\n20\n0\n0\nCIRCLE\n8\n0\n10\n0\n20\n0\n40\n1\n0\nENDBLK\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n2\nB\n8\n0\n41\n2\n42\n1\n0\nENDSEC\n0\nEOF\n`);
  const r = measureDxf(dxf, { unidad_confirmada: 'm' });
  const c = r.mediciones.find((m) => m.tipo_geometria === 'CIRCLE');
  assert.equal(c.valor, null); assert.equal(c.estado, 'needs_review');
});

import { startClient, call, data, tmpHome } from './helpers.js';
test('MCP tannia_dxf_medir: bloquea conversión sin unidad y la aplica al confirmar', async () => {
  const home = tmpHome();
  const { client, close } = await startClient(home);
  try {
    await call(client, 'tannia_proyecto_crear', { nombre: 'M' });
    fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(home, 'Proyectos', 'M', '03 Trabajo', 'a.dxf'));
    const a = data(await call(client, 'tannia_dxf_medir', { proyecto: 'M', archivo: '03 Trabajo/a.dxf' }));
    assert.equal(a.totales_por_capa_metros, null); assert.equal(a.necesita_revision, true);
    const b = data(await call(client, 'tannia_dxf_medir', { proyecto: 'M', archivo: '03 Trabajo/a.dxf', unidad_confirmada: 'm', incluir_detalle: true }));
    near(b.totales_por_capa_metros.LOSA.area_m2, expected.simple_m.layers.LOSA.area);
    assert.ok(b.mediciones.length > 5);
  } finally { await close(); fs.rmSync(home, { recursive: true, force: true }); }
});
