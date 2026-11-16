// TW-11 G5: alineamientos, perfiles, secciones, TIN, LandXML y DXF verificable con lector independiente (y ezdxf cuando existe).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpHome, startClient, call, data } from './helpers.js';
import { Alineamiento, Perfil, TIN, seccionArco, seccionTrapecio, formatoProgresiva } from '../src/geo/lineal.js';
import { generarDxfLineal, verificarDxfLineal } from '../src/geo/dxf_lineal.js';
import { importarLandXml } from '../src/geo/landxml.js';
import { propiedades } from '../src/geo/geom.js';
import { ejecutarOperacion as run } from '../src/cic/ops/index.js';

const close = (a, b, rel = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${m} ${a} ≠ ${b}`);
const M = (value, unit = 'm') => ({ value, unit });

test('alineamiento: largo, continuidad de rumbo, posiciones analíticas, izquierda/derecha y fuera de rango', () => {
  const al = new Alineamiento([{ type: 'straight', length: 100 }, { type: 'arc', radius: 50, angle_deg: 90, turn: 'left' }, { type: 'straight', length: 50 }], { progresiva: 500 });
  close(al.largo, 100 + 25 * Math.PI + 50); close(al.s0, 500);
  let p = al.punto(600); close(p.x, 100); close(p.y, 0); close(p.heading, 0);
  p = al.punto(600 + 25 * Math.PI); close(p.x, 150, 1e-9); close(p.y, 50, 1e-9); close(p.heading, Math.PI / 2);          // fin de la curva: giro de 90° a la izquierda
  p = al.punto(al.s1); close(p.x, 150); close(p.y, 100, 1e-9);
  const r = new Alineamiento([{ type: 'arc', radius: 50, angle_deg: 90, turn: 'right' }]); p = r.punto(r.s1); close(p.x, 50, 1e-9); close(p.y, -50, 1e-9); close(p.heading, -Math.PI / 2);
  // continuidad (tangencia) entre tramos
  for (const t of al.tramos.slice(1)) { const prev = al.tramos[al.tramos.indexOf(t) - 1]; close(prev.x1, t.x0, 1e-9); close(prev.y1, t.y0, 1e-9); close(prev.h1, t.h0, 1e-12); }
  assert.throws(() => al.punto(499), (e) => e.code === 'OUT_OF_RANGE'); assert.throws(() => new Alineamiento([{ type: 'arc', radius: -1, angle_deg: 10, turn: 'left' }]), (e) => e.code === 'INVALID_INPUT');
  assert.equal(formatoProgresiva(1234.5), '1+234.50'); assert.equal(formatoProgresiva(80), '0+080.00');
  // concuerda con la operación verificada
  close(run('geo.alignment.length', { path: M([{ type: 'straight', length: 100 }, { type: 'arc', radius: 50, angle_deg: 90, turn: 'left' }, { type: 'straight', length: 50 }]) }).outputs.longitud.value, al.largo);
});

test('perfil: PIV con curva vertical coincide con la operación parabólica verificada; solape y progresiva fuera de rango', () => {
  const pf = new Perfil([{ s: 0, z: 100 }, { s: 500, z: 90, curva: 200 }, { s: 1000, z: 95 }]);
  // tramo recto previo a la curva: pendiente −2 %
  close(pf.cota(100), 98); close(pf.pendiente(100), -0.02, 1e-6);
  // dentro de la curva: contraste con geo.profile.vertical_curve (PVC en s=400, cota 100−0.02·400=92)
  for (const s of [400, 450, 500, 560, 600]) { const o = run('geo.profile.vertical_curve', { pvc_station: M(400), pvc_elevation: M(92), g1: M(-0.02, '1'), g2: M(0.01, '1'), length: M(200), station: M(s) }); close(pf.cota(s), o.outputs.elevation.value, 1e-9, `s=${s}`); }
  close(pf.cota(1000), 95); assert.throws(() => pf.cota(1001), (e) => e.code === 'OUT_OF_RANGE');
  assert.throws(() => new Perfil([{ s: 0, z: 0 }, { s: 100, z: 1, curva: 150 }, { s: 150, z: 0 }]), (e) => e.code === 'INVALID_INPUT'); assert.throws(() => new Perfil([{ s: 0, z: 0 }, { s: 0, z: 1 }]), (e) => e.code === 'NOT_MONOTONIC');
});

test('secciones tipo: áreas contra fórmulas y contra la operación geo.section.arch; rangos', () => {
  const a = propiedades(seccionArco({ luz: 10, altura_hastial: 3, flecha: 5 })).area; close(a, 30 + (Math.PI * 25) / 2);
  const o = run('geo.section.arch', { luz: M(10), altura_hastial: M(3), flecha: M(5) }); close(a, o.outputs.area.value);
  close(propiedades(seccionArco({ luz: 10, altura_hastial: 2, flecha: 1.5 })).area, run('geo.section.arch', { luz: M(10), altura_hastial: M(2), flecha: M(1.5) }).outputs.area.value);
  close(propiedades(seccionTrapecio(3, 1.5, 1.2)).area, (3 + (3 + 2 * 1.5 * 1.2)) / 2 * 1.2);
  assert.throws(() => seccionArco({ luz: 10, altura_hastial: 3, flecha: 6 }), (e) => e.code === 'OUT_OF_RANGE');
});

test('TIN: plano inclinado exacto, pirámide, cruce de plano con corte/relleno exactos, interpolación y errores', () => {
  const placa = new TIN([[0, 0, 0], [10, 0, 1], [10, 10, 1], [0, 10, 0], [5, 5, 0.5]]); // z = 0.1·x
  close(placa.volumenSobrePlano(0).sobre, 50); close(placa.z(7, 3), 0.7); assert.equal(placa.z(20, 20), null);
  const v = placa.volumenSobrePlano(0.5); close(v.sobre, 12.5); close(v.bajo, 12.5); close(v.neto, 0, 1e-9); close(v.area_planta, 100);
  const piramide = new TIN([[0, 0, 0], [6, 0, 0], [6, 6, 0], [0, 6, 0], [3, 3, 3]]); close(piramide.volumenSobrePlano(0).sobre, (36 * 3) / 3);          // V = A·h/3
  const r = run('geo.tin.volume_to_plane', { puntos: M([[0, 0, 0], [6, 0, 0], [6, 6, 0], [0, 6, 0], [3, 3, 3]]), cota_plano: M(0) }); close(r.outputs.sobre_plano.value, 36);
  assert.throws(() => run('geo.tin.volume_to_plane', { puntos: M([[0, 0, 0], [1, 1, 1], [2, 2, 2]]), cota_plano: M(0) }), (e) => e.code === 'INVALID_INPUT');
  assert.throws(() => run('geo.tin.volume_to_plane', { puntos: M([[0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]]), cota_plano: M(0) }), (e) => e.code === 'INVALID_INPUT');
});

const LANDXML = `<?xml version="1.0"?><LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2"><Units><Metric linearUnit="meter" areaUnit="squareMeter" volumeUnit="cubicMeter"/></Units>
<Surfaces><Surface name="Terreno"><Definition surfType="TIN"><Pnts><P id="1">0 0 100</P><P id="2">0 10 101</P><P id="3">10 10 102</P><P id="4">10 0 101</P></Pnts><Faces><F>1 2 3</F><F>1 3 4</F></Faces></Definition></Surface></Surfaces>
<Alignments><Alignment name="Eje-1" length="170" staStart="1000"><CoordGeom><Line><Start>0 0</Start><End>0 100</End></Line><Curve rot="ccw" radius="50" ><Start>0 100</Start><Center>50 100</Center><End>50 150</End></Curve></CoordGeom>
<Profile name="P"><ProfAlign name="Rasante"><PVI>1000 100</PVI><PVI>1100 103</PVI><CircCurve length="20">1100 103</CircCurve></ProfAlign></Profile></Alignment>
<Alignment name="Eje-2"><CoordGeom><Line><Start>0 0</Start><End>0 50</End></Line><Spiral length="30"><Start>0 50</Start><End>5 79</End></Spiral></CoordGeom></Alignment></Alignments><Parcels/></LandXML>`;
test('LandXML: alineamientos, perfiles y superficies importados; pérdidas declaradas; clotoide = alineamiento NO utilizable; DOCTYPE rechazado', () => {
  const r = importarLandXml(LANDXML); assert.equal(r.unidades.sistema, 'metrico'); assert.equal(r.alineamientos.length, 2);
  const a = r.alineamientos[0]; assert.equal(a.tramos[0].type, 'straight'); close(a.tramos[0].length, 100); assert.equal(a.tramos[1].type, 'arc'); close(a.tramos[1].angle_deg, 90); assert.equal(a.tramos[1].turn, 'left'); // LandXML: «norte este»; recta hacia el este y centro al norte (a la izquierda del avance) = ccw
  assert.deepEqual([a.inicio.x, a.inicio.y], [0, 0]); close(a.inicio.azimut_deg, 0);
  const al = new Alineamiento(a.tramos, a.inicio); close(al.largo, 100 + 25 * Math.PI, 1e-9);
  assert.equal(r.perfiles[0].pivs.length, 2); assert.ok(r.advertencias.some((x) => /curva\(s\) vertical/.test(x))); assert.equal(r.superficies[0].puntos.length, 4); assert.deepEqual(r.superficies[0].puntos[2], [10, 10, 102]);
  assert.equal(r.alineamientos[1].utilizable, false); assert.ok(r.no_soportado.some((x) => /Spiral/.test(x.elemento))); assert.ok(r.no_soportado.some((x) => x.elemento === 'Parcels'));
  assert.throws(() => importarLandXml('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><LandXML/>'), (e) => e.code === 'XML_PELIGROSO'); assert.throws(() => importarLandXml('<otra/>'), (e) => e.code === 'NO_ES_LANDXML');
  assert.ok(importarLandXml('<LandXML><Units><Imperial/></Units></LandXML>').advertencias.some((x) => /no métricas/.test(x)));
});

test('DXF lineal: planta, perfil con exageración declarada y secciones; releído con el lector del repo y con ezdxf (si existe); detecta manipulación', () => {
  const al = new Alineamiento([{ type: 'straight', length: 200 }, { type: 'arc', radius: 300, angle_deg: 20, turn: 'left' }, { type: 'straight', length: 150 }], { progresiva: 1000 });
  const pf = new Perfil([{ s: 1000, z: 100 }, { s: 1250, z: 104, curva: 60 }, { s: al.s1, z: 101 }]); const sec = seccionArco({ luz: 10, altura_hastial: 3, flecha: 5 });
  const { dxf, meta } = generarDxfLineal({ alineamiento: al, perfil: pf, terreno: [[1000, 112], [1200, 125], [al.s1, 110]], secciones: [1000, 1200, al.s1].map((s) => ({ progresiva: s, poligono: sec })), exageracion_vertical: 10 });
  const v = verificarDxfLineal(dxf, meta); assert.ok(v.ok, JSON.stringify(v.problemas)); assert.equal(v.unidades, 'm'); close(v.medidos.largo_eje_m, al.largo, 1e-6); v.medidos.areas_secciones_m2.forEach((x) => close(x, 30 + (Math.PI * 25) / 2));
  assert.match(dxf, /exageraci/); assert.match(dxf, /Ingenier.*asistida/);
  // manipulación: alterar el radio de una sección en el DXF → no coincide con el modelo
  const alterado = dxf.replace(/\n30\n0\n42\n1\n/, '\n30\n0\n42\n0.5\n'); assert.notEqual(alterado, dxf); assert.equal(verificarDxfLineal(alterado, meta).ok, false);
  assert.equal(verificarDxfLineal(dxf.replace(/\n8\nEJE\n/g, '\n8\nOTRA\n'), meta).ok, false);
  // ezdxf (opcional): lectura independiente de terceros y auditoría
  const py = spawnSync('python3', ['-c', 'import ezdxf,sys;d=ezdxf.read(open(sys.argv[1],encoding="utf-8"));a=d.audit();ms=d.modelspace();print(len(list(ms)),len(a.errors))', (() => { const f = path.join(tmpHome('dxf '), 'l.dxf'); fs.writeFileSync(f, dxf); return f; })()], { encoding: 'utf8' });
  if (py.status === 0) { const [n, e] = py.stdout.trim().split(' ').map(Number); assert.ok(n > 100); assert.equal(e, 0, 'ezdxf audit sin errores'); } else console.log('# ezdxf no disponible: se omitió la lectura de terceros');
});

test('MCP tannia_cic_geometria: generar_lineal (con claims y verificación), verificar_dxf, no sobrescribe, errores sin escribir, importar_landxml', async () => {
  const home = tmpHome('Tannia ñ g5 '); const { client: c, close: cerrar } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Túnel Prueba'; const N = 'Túnel OC2';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P });
    const args = { proyecto: P, caso: N, accion: 'generar_lineal', nombre: 'tunel', tramos: [{ type: 'straight', length: 200 }, { type: 'arc', radius: 300, angle_deg: 20, turn: 'left' }, { type: 'straight', length: 150 }], inicio: { x: 0, y: 0, azimut_deg: 0, progresiva: 1000 }, pivs: [{ s: 1000, z: 100 }, { s: 1300, z: 103 }, { s: 1454.719, z: 102 }], secciones: [1000, 1227, 1454.719].map((s, i) => ({ progresiva: s, nombre: `S${i + 1}`, tipo: 'arco', luz: 10, altura_hastial: 3, flecha: 5 })), exageracion_vertical: 10 };
    let r = await call(c, 'tannia_cic_geometria', args); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 400)); let d = data(r); assert.ok(d.verificacion.ok); close(d.verificacion.largo_eje_releido_m, 454.7197548, 1e-6); assert.equal(d.verificacion.areas_releidas_m2.length, 3);
    assert.ok(d.claims.some((x) => /Longitud del eje/.test(x.texto) && Math.abs(x.valor - 454.7197548) < 1e-4)); assert.equal(d.claims.filter((x) => /Área sección.*→ area$/.test(x.texto)).length, 3);
    const f = path.join(home, 'Proyectos', P, d.archivo); assert.ok(fs.existsSync(f)); const sha1 = d.sha256;
    r = await call(c, 'tannia_cic_geometria', { proyecto: P, caso: N, accion: 'verificar_dxf' }); assert.equal(data(r).ok, true);
    r = await call(c, 'tannia_cic_geometria', { ...args, exageracion_vertical: 20 }); d = data(r); assert.notEqual(d.archivo, `03 Trabajo/Ingenieria/${N}/artefactos/tunel.dxf`.replace(/\//g, '/')); assert.match(d.archivo, /tunel \(2\)\.dxf$/); assert.equal(fs.readFileSync(f).length > 0, true);
    assert.equal((await import('node:crypto')).createHash('sha256').update(fs.readFileSync(f)).digest('hex'), sha1, 'el original no se sobrescribió');
    // errores: fuera de rango y flecha excesiva, sin escribir nada nuevo
    const antes = fs.readdirSync(path.dirname(f)).length;
    r = await call(c, 'tannia_cic_geometria', { ...args, secciones: [{ progresiva: 99999, tipo: 'arco', luz: 10, altura_hastial: 3, flecha: 5 }] }); assert.equal(data(r).error, 'OUT_OF_RANGE');
    r = await call(c, 'tannia_cic_geometria', { ...args, secciones: [{ progresiva: 1000, tipo: 'arco', luz: 10, altura_hastial: 3, flecha: 6 }] }); assert.equal(data(r).error, 'OUT_OF_RANGE');
    assert.equal(fs.readdirSync(path.dirname(f)).length, antes);
    // LandXML
    const lx = path.join(home, 'Proyectos', P, '01 Antecedentes', 'eje.xml'); fs.mkdirSync(path.dirname(lx), { recursive: true }); fs.writeFileSync(lx, LANDXML);
    r = await call(c, 'tannia_cic_geometria', { proyecto: P, caso: N, accion: 'importar_landxml', ruta: '01 Antecedentes/eje.xml', nombre: 'eje' }); d = data(r); assert.equal(d.alineamientos.length, 2); assert.ok(d.perdidas.length >= 2);
    fs.writeFileSync(lx, '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "y">]><LandXML/>'); r = await call(c, 'tannia_cic_geometria', { proyecto: P, caso: N, accion: 'importar_landxml', ruta: '01 Antecedentes/eje.xml' }); assert.equal(data(r).error, 'XML_PELIGROSO');
  } finally { await cerrar(); }
});
