import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseDxf } from '../src/dxf/reader.js';
import { measureDxf } from '../src/dxf/measure.js';
import { analyzeSurface } from '../src/dxf/mesh3d.js';
import { computeQuantity } from '../src/quantities/engine.js';
import { FIX } from './helpers.js';

const expected = JSON.parse(fs.readFileSync(path.join(FIX, 'expected.json'), 'utf8'));
const load = (n) => parseDxf(fs.readFileSync(path.join(FIX, 'dxf', `${n}.dxf`)));
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('3DFACE: cubo 2x3x4 de 6 caras -> volumen 24 y área 52 (oráculo analítico)', () => {
  const r = measureDxf(load('malla_3d'), { unidad_confirmada: 'm' });
  const g = r.mediciones.filter((m) => m.tipo_geometria === '3DFACE_GRUPO');
  near(g.find((m) => m.magnitud === 'volumen').valor, expected.malla_3d.cube_volume);
  near(g.find((m) => m.magnitud === 'area').valor, expected.malla_3d.cube_area);
  assert.equal(g.find((m) => m.magnitud === 'volumen').estado, 'ok');
});

test('MESH: pirámide de base 1x1 y altura 1 -> V=1/3; POLYLINE 3D longitud 17', () => {
  const r = measureDxf(load('malla_3d'), { unidad_confirmada: 'm' });
  const m = r.mediciones.filter((x) => x.tipo_geometria === 'MESH');
  near(m.find((x) => x.magnitud === 'volumen').valor, expected.malla_3d.pyramid_volume);
  near(r.mediciones.find((x) => x.tipo_geometria === 'POLYLINE3D').valor, expected.malla_3d.poly3d_length);
  near(r.totales_por_capa_metros['3D'].volumen_m3, 24 + 1 / 3);
});

test('malla abierta: sin volumen y needs_review; normales invertidas: valor absoluto con aviso', () => {
  const P = (x, y, z) => ({ x, y, z });
  const v = [P(0,0,0),P(1,0,0),P(1,1,0),P(0,1,0),P(0,0,1),P(1,0,1),P(1,1,1),P(0,1,1)];
  const f = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map((q) => q.map((i) => v[i]));
  const ok = analyzeSurface(f); near(ok.volumen, 1); assert.equal(ok.cerrada, true);
  const open = analyzeSurface(f.slice(0, 5)); assert.equal(open.volumen, null); assert.equal(open.necesita_revision, true); assert.match(open.advertencias.join(), /ABIERTA/);
  const inv = analyzeSurface(f.map((q) => [...q].reverse())); near(inv.volumen, 1); assert.match(inv.advertencias.join(), /invertida/);
  const mixed = analyzeSurface([...f.slice(0, 5), [...f[5]].reverse()]); assert.equal(mixed.volumen, null);
  const dup = analyzeSurface([...f, f[0]]); assert.equal(dup.volumen, null);
});

test('3DSOLID/REGION/SURFACE: detectados pero SIN volumen inventado', () => {
  const r = measureDxf(load('solido_acis'), { unidad_confirmada: 'm' });
  assert.equal(Object.keys(r.entidades_no_soportadas).length, 4);
  assert.ok(!r.mediciones.some((m) => m.magnitud === 'volumen'));
  assert.match(r.advertencias.join(), /no medidas/);
});

test('cantidad de volumen solo desde mallas cerradas, con conversión cúbica (mm→m)', () => {
  const m = measureDxf(load('malla_3d'), { unidad_confirmada: 'mm' });
  const q = computeQuantity({ medicion: m, archivo: 'a', capas: ['3D'], regla: 'directa_volumen' });
  near(q.cantidad, (24 + 1 / 3) * 1e-9, 1e-9); assert.equal(q.unidad, 'm3');
});

test('transformación con espejo (escala -1) conserva volumen positivo y sin falso aviso de normales', () => {
  const faces = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  const verts = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const dxf = `0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nCUBO\n10\n0\n20\n0\n0\n${faces.map((q) => `3DFACE\n8\n0\n${q.map((i, k) => `${10 + k}\n${verts[i][0]}\n${20 + k}\n${verts[i][1]}\n${30 + k}\n${verts[i][2]}\n`).join('')}0\n`).join('')}ENDBLK\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n2\nCUBO\n8\n0\n41\n-2\n42\n2\n43\n2\n0\nENDSEC\n0\nEOF\n`;
  const r = measureDxf(parseDxf(dxf), { unidad_confirmada: 'm' });
  const v = r.mediciones.find((m) => m.magnitud === 'volumen');
  near(v.valor, 8); assert.equal(v.estado, 'ok'); assert.ok(!/invertida/.test(v.advertencias.join()));
});

test('POLYFACE (POLYLINE bit 64): prisma 1x1x2 -> V=2, A=10', () => {
  const r = measureDxf(load('malla_3d'), { unidad_confirmada: 'm' });
  const pf = r.mediciones.filter((m) => m.tipo_geometria === 'POLYFACE');
  near(pf.find((m) => m.magnitud === 'volumen').valor, expected.malla_3d.polyface_volume);
  near(pf.find((m) => m.magnitud === 'area').valor, expected.malla_3d.polyface_area);
});
