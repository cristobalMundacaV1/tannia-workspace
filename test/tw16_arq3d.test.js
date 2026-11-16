// Motor 3D general: geometría con casos SINTÉTICOS (ninguna vivienda codificada), operaciones, versiones, coherencia con el 2D,
// construcción en AutoCAD (servidor COM simulado) y herramientas MCP. Los valores esperados se calculan analíticamente en el test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { construirPrimitivas, validarModelo, rectangulosDePoligono } from '../src/arq3d/geometria.js';
import { aplicarOperaciones3d, CATALOGO_3D } from '../src/arq3d/operaciones.js';
import { modeloDesdeGeo, coherenciaConGeo } from '../src/arq3d/desde_anteproyecto.js';
import { Modelos3d } from '../src/arq3d/servicio.js';
import { Anteproyectos } from '../src/design/servicio.js';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';
import { AutoCadCom, prepararLlamada, buildScript, LIMITE_COMANDO } from '../src/cad/autocad_com.js';
import { gunzipSync } from 'node:zlib';
import { compararSolidos, compararLecturas } from '../src/cad/fidelidad.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { servidorSimulado } from './helpers_com.js';
import { tmpHome, startClient, call, data } from './helpers.js';

const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const vol = (p) => p.esperado.volumen;
const inter = (a, b) => { const o = [0, 1, 2].map((i) => Math.min(a.esperado.bbox_max[i], b.esperado.bbox_max[i]) - Math.max(a.esperado.bbox_min[i], b.esperado.bbox_min[i])); return o.every((v) => v > 1e-6) ? o[0] * o[1] * o[2] : 0; };
const dentro = (prims, x, y, z) => prims.some((p) => x > p.esperado.bbox_min[0] && x < p.esperado.bbox_max[0] && y > p.esperado.bbox_min[1] && y < p.esperado.bbox_max[1] && z > p.esperado.bbox_min[2] && z < p.esperado.bbox_max[2]);
const NIV = [{ id: 'N1', cota_mm: 0, altura_mm: 2500 }];
let sem = 12345; const rnd = () => { sem = (sem * 1103515245 + 12345) % 2147483648; return sem / 2147483648; };
const paso = (a, b, p = 100) => a + Math.floor(rnd() * ((b - a) / p + 1)) * p;

/** Recinto rectangular sintético generado desde parámetros (no hay medidas fijas). */
function recinto(W, D, t, H, vanos = {}) {
  const x0 = 0; const y0 = 0;
  const m = (id, p1, p2, v = []) => ({ id, nivel: 'N1', tipo: 'ext', espesor_mm: t, p1, p2, vanos: v });
  return {
    niveles: [{ id: 'N1', cota_mm: 0, altura_mm: H }],
    muros: [m('S', [x0, y0], [x0 + W, y0], vanos.S), m('E', [x0 + W, y0], [x0 + W, y0 + D], vanos.E), m('N', [x0 + W, y0 + D], [x0, y0 + D], vanos.N), m('O', [x0, y0 + D], [x0, y0], vanos.O)],
    losas: [], cubiertas: [],
  };
}

test('geometría: recintos rectangulares aleatorios — volumen analítico, sin solapes, vanos realmente abiertos y huella exacta', () => {
  for (let k = 0; k < 25; k++) {
    const W = paso(3000, 12000); const D = paso(2500, 9000); const t = paso(100, 300, 50); const H = paso(2200, 3600);
    const ancho = paso(600, 1200, 100); const alto = paso(1800, 2100, 100); const pos = paso(Math.ceil(ancho / 2) + 100, W - Math.ceil(ancho / 2) - 100, 100);
    const antepecho = paso(600, 1000, 100); const wv = paso(800, 1600, 100);
    const m = recinto(W, D, t, H, { S: [{ id: 'P', tipo: 'puerta', posicion_mm: pos, ancho_mm: ancho, alto_mm: alto }], N: [{ id: 'V', tipo: 'ventana', posicion_mm: W / 2, ancho_mm: wv, alto_mm: 1200, antepecho_mm: antepecho }] });
    const r = construirPrimitivas(m); const pr = r.primitivas;
    // volumen analítico = (huella exterior − hueco interior) × H − vanos (ancho × espesor × alto del vano)
    const huella = (W + t) * (D + t) - (W - t) * (D - t);
    const esperado = huella * H - ancho * t * alto - wv * t * 1200;
    near(pr.filter((p) => ['muro_ext', 'muro_int', 'antepecho', 'dintel'].includes(p.clase)).reduce((a, p) => a + vol(p), 0), esperado, 1);
    for (let i = 0; i < pr.length; i++) for (let j = i + 1; j < pr.length; j++) assert.equal(inter(pr[i], pr[j]), 0, `solape entre ${pr[i].id} y ${pr[j].id} (caso ${k})`);
    // el vano está abierto (centro del vano, a media altura) y el muro continuo cerca está lleno
    assert.equal(dentro(pr, pos, 0, alto / 2), false, 'puerta abierta'); assert.equal(dentro(pr, W / 2, D, antepecho + 600), false, 'ventana abierta');
    assert.equal(dentro(pr, pos, 0, alto + (H - alto) / 2 > alto ? alto + 10 : alto - 10), alto < H, 'dintel sobre la puerta');
    assert.equal(dentro(pr, W / 2, D, antepecho / 2), true, 'antepecho bajo la ventana'); assert.equal(dentro(pr, pos > W / 2 ? 100 : W - 100, D, 500), true, 'muro lleno');
    const env = r.resumen.envolvente_mm; assert.deepEqual([env.min[0], env.min[1], env.max[0], env.max[1], env.max[2]], [-t / 2, -t / 2, W + t / 2, D + t / 2, H]);
  }
});

test('geometría: planta en L con tabique interior, dos niveles, losas ortogonales y alturas distintas por nivel', () => {
  const m = {
    niveles: [{ id: 'N1', cota_mm: 0, altura_mm: 2600 }, { id: 'N2', cota_mm: 2800, altura_mm: 2400 }],
    muros: [
      ...[[[0, 0], [8000, 0]], [[8000, 0], [8000, 3000]], [[8000, 3000], [4000, 3000]], [[4000, 3000], [4000, 6000]], [[4000, 6000], [0, 6000]], [[0, 6000], [0, 0]]].map(([p1, p2], i) => ({ id: `E${i}`, nivel: 'N1', tipo: 'ext', espesor_mm: 250, p1, p2 })),
      { id: 'T1', nivel: 'N1', tipo: 'int', espesor_mm: 100, p1: [0, 3000], p2: [4000, 3000], vanos: [{ id: 'PT', tipo: 'puerta', posicion_mm: 1000, ancho_mm: 800, alto_mm: 2100 }] },
      { id: 'U1', nivel: 'N2', tipo: 'ext', espesor_mm: 200, p1: [0, 0], p2: [8000, 0] },
    ],
    losas: [{ id: 'LP', nivel: 'N1', espesor_mm: 150, contorno: [[0, 0], [8000, 0], [8000, 3000], [4000, 3000], [4000, 6000], [0, 6000]] }, { id: 'LE', nivel: 'N2', espesor_mm: 180, contorno: [[0, 0], [8000, 0], [8000, 3000], [0, 3000]] }],
    cubiertas: [],
  };
  const r = construirPrimitivas(m); const pr = r.primitivas;
  assert.equal(pr.filter((p) => p.clase === 'losa').length, 3, 'la L se descompone en 2 prismas + 1 losa de entrepiso');
  near(pr.filter((p) => p.ref === 'LP').reduce((a, p) => a + vol(p), 0), (8000 * 3000 + 4000 * 3000) * 150, 1);
  near(pr.filter((p) => p.ref === 'LE').reduce((a, p) => a + vol(p), 0), 8000 * 3000 * 180, 1);
  assert.equal(Math.min(...pr.filter((p) => p.ref === 'LE').map((p) => p.esperado.bbox_max[2])), 2800, 'la losa de entrepiso queda bajo la cota del nivel 2');
  assert.ok(pr.filter((p) => p.capa === 'TW3D_MURO_EXT' && p.esperado.bbox_min[2] === 2800).every((p) => p.esperado.bbox_max[2] === 5200), 'muros del nivel 2 de 2400 mm sobre la cota 2800');
  for (let i = 0; i < pr.length; i++) for (let j = i + 1; j < pr.length; j++) assert.equal(inter(pr[i], pr[j]), 0, `solape ${pr[i].id}/${pr[j].id}`);
  assert.equal(rectangulosDePoligono([[0, 0], [8000, 0], [8000, 3000], [4000, 3000], [4000, 6000], [0, 6000]]).length, 2);
});

test('geometría: muro inclinado (45°) — volumen, centroide y caja envolvente analíticos y aviso de solapes', () => {
  const m = { niveles: NIV, muros: [{ id: 'D', nivel: 'N1', tipo: 'int', espesor_mm: 200, p1: [0, 0], p2: [3000, 3000] }], losas: [], cubiertas: [] };
  const r = construirPrimitivas(m); assert.equal(r.primitivas.length, 1); const q = r.primitivas[0]; const L = 3000 * Math.SQRT2;
  near(vol(q), L * 200 * 2500, 1); assert.deepEqual(q.esperado.centroide, [1500, 1500, 1250]); assert.equal(q.rot_deg, 45);
  const ext = (L / 2) * Math.SQRT1_2 + (200 / 2) * Math.SQRT1_2; near(q.esperado.bbox_min[0], 1500 - ext, 1e-3); near(q.esperado.bbox_max[1], 1500 + ext, 1e-3);
  assert.ok(r.advertencias.some((a) => /inclinados/.test(a)));
});

test('cubiertas: plana, a un agua y a dos aguas — volúmenes, centroides y alturas de cumbrera analíticos; pendiente obligatoria', () => {
  const base = (c) => ({ ...recinto(6000, 4000, 200, 2500), cubiertas: [c] });
  const env = { x0: -100, x1: 6100, y0: -100, y1: 4100 }; const W = env.x1 - env.x0; const D = env.y1 - env.y0;
  let r = construirPrimitivas(base({ id: 'C', nivel: 'N1', tipo: 'plana', espesor_mm: 120 })); const pl = r.primitivas.filter((p) => p.clase === 'cubierta'); near(pl.reduce((a, p) => a + vol(p), 0), W * D * 120, 1); assert.equal(pl[0].esperado.bbox_min[2], 2500);
  r = construirPrimitivas(base({ id: 'C', nivel: 'N1', tipo: 'plana', espesor_mm: 120, voladizo_mm: 500 })); near(r.primitivas.filter((p) => p.clase === 'cubierta').reduce((a, p) => a + vol(p), 0), (W + 1000) * (D + 1000) * 120, 1);
  r = construirPrimitivas(base({ id: 'C', nivel: 'N1', tipo: 'un_agua', pendiente_pct: 20, direccion: '+x' })); let c = r.primitivas.filter((p) => p.clase === 'cubierta');
  assert.equal(c.length, 1); assert.equal(c[0].tipo, 'cuna'); assert.equal(c[0].alto_lado, '-x'); near(c[0].dz, W * 0.2, 1e-6); near(vol(c[0]), (W * D * c[0].dz) / 2, 1e-3);
  near(c[0].esperado.centroide[0], env.x0 + W / 3, 1e-3); near(c[0].esperado.centroide[2], 2500 + c[0].dz / 3, 1e-3);
  r = construirPrimitivas(base({ id: 'C', nivel: 'N1', tipo: 'dos_aguas', pendiente_pct: 30, eje_cumbrera: 'x' })); c = r.primitivas.filter((p) => p.clase === 'cubierta');
  assert.equal(c.length, 2); near(c[0].dz, (D / 2) * 0.3, 1e-6); assert.deepEqual(c.map((p) => p.alto_lado).sort(), ['+y', '-y']); near(c.reduce((a, p) => a + vol(p), 0), (W * D * c[0].dz) / 2, 1e-3);
  assert.throws(() => construirPrimitivas(base({ id: 'C', nivel: 'N1', tipo: 'dos_aguas', eje_cumbrera: 'x' })), (e) => e.code === 'PENDIENTE_REQUERIDA');
  assert.throws(() => construirPrimitivas(base({ id: 'C', nivel: 'N1', tipo: 'un_agua', pendiente_pct: 10 })), (e) => e.code === 'CUBIERTA_INVALIDA');
});

test('validación: no se inventan alturas, antepechos ni pendientes; vanos imposibles y contornos no ortogonales se rechazan con código claro', () => {
  const ok = recinto(5000, 4000, 200, 2500);
  const cod = (mut, code) => { const m = structuredClone(ok); mut(m); assert.throws(() => validarModelo(m), (e) => e.code === code, code); };
  cod((m) => { delete m.niveles[0].altura_mm; }, 'ALTURA_INVALIDA');
  cod((m) => { m.muros[0].espesor_mm = 5; }, 'ESPESOR_INVALIDO');
  cod((m) => { m.muros[0].nivel = 'N9'; }, 'NIVEL_NO_EXISTE');
  cod((m) => { m.muros[0].vanos = [{ id: 'V', tipo: 'ventana', posicion_mm: 2000, ancho_mm: 1000, alto_mm: 1200 }]; }, 'VANO_INVALIDO');
  cod((m) => { m.muros[0].vanos = [{ id: 'V', tipo: 'puerta', posicion_mm: 200, ancho_mm: 900, alto_mm: 2100 }]; }, 'VANO_FUERA_DEL_MURO');
  cod((m) => { m.muros[0].vanos = [{ id: 'A', tipo: 'puerta', posicion_mm: 1000, ancho_mm: 900, alto_mm: 2100 }, { id: 'B', tipo: 'puerta', posicion_mm: 1500, ancho_mm: 900, alto_mm: 2100 }]; }, 'VANOS_SOLAPADOS');
  cod((m) => { m.muros[1].id = 'S'; }, 'ID_INVALIDO');
  cod((m) => { m.losas = [{ id: 'L', nivel: 'N1', espesor_mm: 150, contorno: [[0, 0], [4000, 0], [2000, 3000]] }]; }, 'CONTORNO_NO_ORTOGONAL');
  cod((m) => { m.cubiertas = [{ id: 'C', nivel: 'N1', tipo: 'inventada' }]; }, 'CUBIERTA_INVALIDA');
  // un vano más alto que el muro no se recorta en silencio: se advierte
  const m = structuredClone(ok); m.muros[0].vanos = [{ id: 'P', tipo: 'puerta', posicion_mm: 2000, ancho_mm: 900, alto_mm: 2700 }];
  assert.ok(construirPrimitivas(m).advertencias.some((a) => /supera la altura/.test(a)));
});

test('operaciones: todas o ninguna; cada operación del catálogo modifica solo lo indicado', () => {
  const m = validarModelo({ ...recinto(6000, 4000, 200, 2500), losas: [{ id: 'L', nivel: 'N1', espesor_mm: 150, contorno: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]] }] });
  const r = aplicarOperaciones3d(m, [
    { operacion: 'agregar_vano', muro: 'S', vano: { id: 'P1', tipo: 'puerta', posicion_mm: 1500, ancho_mm: 900, alto_mm: 2100 } },
    { operacion: 'agregar_vano', muro: 'N', vano: { id: 'V1', tipo: 'ventana', posicion_mm: 3000, ancho_mm: 1500, alto_mm: 1200, antepecho_mm: 900 } },
    { operacion: 'modificar_vano', id: 'P1', cambios: { ancho_mm: 1000 } },
    { operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 2700 } },
    { operacion: 'agregar_muro', muro: { id: 'T', nivel: 'N1', tipo: 'int', espesor_mm: 100, p1: [3000, 0], p2: [3000, 4000] } },
    { operacion: 'definir_cubierta', cubierta: { id: 'C', nivel: 'N1', tipo: 'dos_aguas', pendiente_pct: 25, eje_cumbrera: 'y' } },
    { operacion: 'mostrar_cubierta', visible: true },
  ]);
  assert.equal(r.modelo.muros.find((w) => w.id === 'S').vanos[0].ancho_mm, 1000); assert.equal(r.modelo.niveles[0].altura_mm, 2700); assert.equal(r.modelo.opciones.cubierta_visible, true);
  assert.equal(m.muros.length, 4, 'el modelo de entrada no se muta');
  const p = construirPrimitivas(r.modelo); assert.ok(p.primitivas.some((q) => q.tipo === 'cuna')); assert.equal(p.capas.find((c) => c.nombre === 'TW3D_CUBIERTA').visible, true);
  const r2 = aplicarOperaciones3d(r.modelo, [{ operacion: 'eliminar_vano', id: 'V1' }, { operacion: 'eliminar_muro', id: 'T' }, { operacion: 'eliminar_cubierta', id: 'C' }, { operacion: 'modificar_muro', id: 'S', cambios: { espesor_mm: 250 } }, { operacion: 'modificar_losa', id: 'L', cambios: { espesor_mm: 200 } }, { operacion: 'eliminar_losa', id: 'L' }]);
  assert.equal(r2.modelo.muros.length, 4); assert.equal(r2.modelo.losas.length, 0);
  // atomicidad: una operación inválida (la 2.ª) rechaza el lote completo
  assert.throws(() => aplicarOperaciones3d(m, [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 3000 } }, { operacion: 'agregar_vano', muro: 'S', vano: { id: 'X', tipo: 'puerta', posicion_mm: 100, ancho_mm: 900, alto_mm: 2100 } }]), (e) => e.code === 'VANO_FUERA_DEL_MURO' && /Operación|vano/.test(e.message));
  assert.throws(() => aplicarOperaciones3d(m, [{ operacion: 'volar_casa' }]), (e) => e.code === 'OPERACION_DESCONOCIDA');
  assert.throws(() => aplicarOperaciones3d(m, [{ operacion: 'eliminar_muro', id: 'ZZ' }]), (e) => e.code === 'NO_EXISTE');
  assert.ok(Object.keys(CATALOGO_3D).length >= 14);
});

function entorno() {
  const home = tmpHome("Tannia ñ '3D "); const sb = new Sandbox(home); createProject(sb, 'Obra'); const root = path.join(home, 'Proyectos', 'Obra');
  fs.writeFileSync(path.join(root, '02 Originales', 'o.dwg'), 'ORIGINAL');
  return { home, sb, root, A: new Anteproyectos(sb), done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

test('2D → 3D con CUALQUIER anteproyecto: coherencia con el plano, desfase detectado y sincronización; versiones inmutables y deshacer', () => {
  const e = entorno();
  try {
    for (const [i, prog] of [{}, { dormitorios: 2, banos: 1, superficie_m2: 62 }, { dormitorios: 3, banos: 2, superficie_m2: 118, variante: 'B', cocina: 'cerrada' }].entries()) {
      const nom = `Casa ${i}`; e.A.crear('Obra', { nombre: nom, programa: prog }); const M = new Modelos3d(e.sb, e.A);
      const r = M.crear('Obra', { nombre: `3D ${nom}`, desde_anteproyecto: { nombre: nom }, parametros: { altura_muros_mm: 2500 } });
      const geo = e.A.cargar('Obra', nom).geo;
      assert.equal(r.reg.origen.version, 'v001'); assert.equal(M.coherencia2d('Obra', `3D ${nom}`).estado, 'coherente');
      assert.equal(r.reg.modelo.muros.length, geo.murosSeg.length); assert.deepEqual(r.reg.resumen_geometria.envolvente_mm.min.slice(0, 2), [0, 0]);
      near(r.reg.resumen_geometria.volumen_losas_m3, (geo.exterior.x1 * geo.exterior.y1 * 150) / 1e9, 1e-3);
      // las alturas son las pedidas (supuesto explícito) y el supuesto queda listado para confirmar
      assert.equal(r.reg.modelo.niveles[0].altura_mm, 2500); assert.ok(r.reg.supuestos_lista.length === 1 && /2500/.test(r.reg.supuestos_lista[0]));
    }
  } finally { e.done(); }
});

test('2D → 3D: tras modificar el anteproyecto el 3D avisa del desfase y actualizar_desde_anteproyecto lo sincroniza; historial y versiones', () => {
  const e = entorno();
  try {
    e.A.crear('Obra', { nombre: 'Casa X', programa: {} }); const M = new Modelos3d(e.sb, e.A);
    const c1 = M.crear('Obra', { nombre: 'M', desde_anteproyecto: { nombre: 'Casa X' }, parametros: { altura_muros_mm: 2600, cubierta: { tipo: 'un_agua', pendiente_pct: 15, direccion: '+y' }, cubierta_visible: true } });
    const catalogo = Object.keys(e.A.cargar('Obra', 'Casa X').modelo.recintos);
    const v2 = e.A.modificar('Obra', 'Casa X', { operaciones: [{ operacion: 'espesores', ext_mm: 250, int_mm: 150 }] });
    assert.ok(catalogo.length > 3 && v2.version === 'v002');
    let coh = M.coherencia2d('Obra', 'M'); assert.equal(coh.hay_version_2d_mas_reciente, true); assert.match(coh.nota, /actualizar_desde_anteproyecto/);
    const m2 = M.modificar('Obra', 'M', { actualizar_desde_anteproyecto: {} });
    assert.equal(m2.version, 'v002'); assert.equal(m2.reg.origen.version, 'v002'); assert.equal(m2.reg.modelo.niveles[0].altura_mm, 2600, 'conserva la altura del 3D'); assert.equal(m2.reg.modelo.cubiertas[0].pendiente_pct, 15, 'conserva la cubierta'); assert.equal(m2.reg.modelo.opciones.cubierta_visible, true);
    assert.equal(M.coherencia2d('Obra', 'M').estado, 'coherente');
    // el espesor de muros cambia con el sistema → la huella 3D cambia con él (nada fijo)
    assert.notEqual(c1.reg.resumen_geometria.volumen_muros_m3, m2.reg.resumen_geometria.volumen_muros_m3);
    // versiones inmutables + historial
    const m3 = M.modificar('Obra', 'M', { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 2800 } }] }); assert.equal(m3.version, 'v003');
    assert.equal(M.historial('Obra', 'M', 'deshacer').head, 'v002'); assert.equal(M.cargar('Obra', 'M').reg.modelo.niveles[0].altura_mm, 2600);
    assert.equal(M.cargar('Obra', 'M', 'v003').reg.modelo.niveles[0].altura_mm, 2800, 'v003 sigue en disco'); assert.equal(M.historial('Obra', 'M', 'rehacer').head, 'v003');
    assert.throws(() => M.crear('Obra', { nombre: 'M', modelo: recinto(3000, 3000, 200, 2500) }), (x) => x.code === 'MODELO3D_EXISTE');
    assert.throws(() => M.crear('Obra', { nombre: 'Z', modelo: recinto(3000, 3000, 200, 2500), desde_anteproyecto: { nombre: 'Casa X' } }), (x) => x.code === 'FUENTE_AMBIGUA');
    assert.throws(() => M.modificar('Obra', 'M', { operaciones: [{ operacion: 'eliminar_muro', id: 'NOEXISTE' }] }), (x) => x.code === 'NO_EXISTE');
    assert.equal(M.cargar('Obra', 'M').h.versiones.length, 3, 'una operación inválida no crea versión');
    // un modelo estructurado (sin 2D) no tiene coherencia 2D aplicable
    M.crear('Obra', { nombre: 'Libre', modelo: recinto(4000, 3000, 150, 2400) }); assert.equal(M.coherencia2d('Obra', 'Libre').estado, 'no_aplica');
    assert.throws(() => M.modificar('Obra', 'Libre', { actualizar_desde_anteproyecto: {} }), (x) => x.code === 'SIN_ORIGEN_2D');
    assert.equal(fs.readFileSync(path.join(e.root, '02 Originales', 'o.dwg'), 'utf8'), 'ORIGINAL');
  } finally { e.done(); }
});

test('coherencia 2D detecta manipulaciones: muro movido o vano desplazado en el 3D', () => {
  const g = derivar(generarModelo({})); const m = modeloDesdeGeo(g, {});
  assert.equal(coherenciaConGeo(m, g).estado, 'coherente');
  const v = structuredClone(m); const w = v.muros.find((x) => x.vanos.length); w.vanos[0].posicion_mm += 50;
  assert.equal(coherenciaConGeo(v, g).estado, 'con_diferencias');
  const h = structuredClone(m); h.muros.find((x) => x.tipo === 'int' && !x.vanos.length).espesor_mm += 40;
  assert.equal(coherenciaConGeo(h, g).diferencias[0].aspecto, 'huella_de_muros');
});

test('comparación de sólidos: volumen, centroide, capa y caja envolvente; sin caja envolvente el resultado es no concluyente', () => {
  const r = construirPrimitivas(recinto(5000, 4000, 200, 2500)); const esp = r.primitivas.map((p) => ({ id: p.id, capa: p.capa, ...p.esperado, centro: p.esperado.centroide, min: p.esperado.bbox_min, max: p.esperado.bbox_max }));
  const lect = r.primitivas.map((p, i) => ({ handle: `H${i}`, tipo: 'AcDb3dSolid', capa: p.capa, volumen: p.esperado.volumen, centroide: p.esperado.centroide, bbox_min: p.esperado.bbox_min, bbox_max: p.esperado.bbox_max }));
  assert.equal(compararSolidos(esp, lect).estado, 'fiel');
  assert.equal(compararSolidos(esp, lect.map(({ bbox_min, bbox_max, ...x }) => x)).estado, 'no_concluyente');
  const mal = structuredClone(lect); mal[0].volumen *= 1.01; mal[1].capa = 'OTRA'; mal[2].bbox_max[2] += 5; const c = compararSolidos(esp, mal);
  assert.equal(c.estado, 'con_diferencias'); assert.deepEqual(c.distintos.map((d) => d.problemas[0].problema).sort(), ['caja_envolvente_distinta', 'capa_distinta', 'volumen_distinto']);
  const sin = compararSolidos(esp, lect.slice(1)); assert.equal(sin.faltan.length, 1); const mas = compararSolidos(esp, [...lect, { ...lect[0], handle: 'X', centroide: [1, 1, 1] }]); assert.equal(mas.sobran.length, 1);
  // la persistencia (cerrar y reabrir) también compara sólidos
  assert.equal(compararLecturas(lect, structuredClone(lect)).estado, 'verificada'); assert.equal(compararLecturas(lect, lect.map((x) => ({ ...x, volumen: x.volumen * 1.01 }))).estado, 'fallida');
});

test('AutoCAD (servidor COM simulado): construir DWG 3D nuevo, verificar cada sólido, vistas, inspección, transformación y persistencia', async () => {
  const e = entorno();
  try {
    const M = new Modelos3d(e.sb, e.A); const modelo = { ...recinto(7000, 5000, 200, 2600, { S: [{ id: 'P', tipo: 'puerta', posicion_mm: 1500, ancho_mm: 900, alto_mm: 2100 }], N: [{ id: 'V', tipo: 'ventana', posicion_mm: 3500, ancho_mm: 1800, alto_mm: 1200, antepecho_mm: 900 }] }), cubiertas: [{ id: 'C', nivel: 'N1', tipo: 'dos_aguas', pendiente_pct: 30, eje_cumbrera: 'x' }], losas: [{ id: 'L', nivel: 'N1', espesor_mm: 150, contorno: [[-100, -100], [7100, -100], [7100, 5100], [-100, 5100]] }] };
    const r = M.crear('Obra', { nombre: 'Prueba', modelo }); const rt = M.rutas('Obra', 'Prueba'); const dwgAbs = rt.abs_dwg;
    const escribe = (f) => { assert.ok(fs.existsSync(path.dirname(f)), 'la carpeta de destino existe antes de SaveAs (AutoCAD no la crea)'); fs.writeFileSync(f, Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(4000, 1)])); };
    const calls = []; const mk = (o = {}) => new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado([], { activePath: dwgAbs, escribeDwg: escribe, calls, ...o }) });
    const env = r.reg.resumen_geometria.envolvente_mm;
    const args = { dwgRel: rt.dwg, primitivas: r.reg.primitivas, capas: r.reg.capas, nota: r.reg.nota, nota_pos: [env.min[0], env.min[1] - 1500, 0] };
    const out = await mk().construir3d('Obra', args);
    assert.equal(out.archivo_dwg.cabecera_dwg_valida, true); assert.equal(out.verificacion_estructura.ok, true); assert.match(out.verificacion, /DWG 3D guardado/); assert.equal(out.verificacion_solidos.estado, 'fiel'); assert.equal(out.verificacion_solidos.coinciden, r.reg.primitivas.length); assert.equal(out.lecturas, undefined);
    const sinCaja = await mk({ sinBbox: true }).construir3d('Obra', { ...args, dwgRel: '03 Trabajo/Modelos3D/Prueba/sin_caja.dwg' }); assert.equal(sinCaja.verificacion_solidos.estado, 'no_concluyente'); assert.match(sinCaja.verificacion, /ATENCIÓN/);
    const malo = await mk({ defectoSolido: (q, i, props, capa) => ({ props: i === 2 ? { ...props, Volume: props.Volume * 2 } : props, capa }) }).construir3d('Obra', { ...args, dwgRel: '03 Trabajo/Modelos3D/Prueba/malo.dwg' }); assert.equal(malo.verificacion_solidos.estado, 'con_diferencias'); assert.equal(malo.verificacion_solidos.distintos[0].problemas[0].problema, 'volumen_distinto');
    assert.equal(out.entidades, r.reg.primitivas.length + 1); assert.deepEqual(out.vista.direccion, [-1, -1, 1]); assert.equal(out.entidades_por_capa.TW3D_NOTAS, 1);
    const enviado = calls.find((c) => c.name === 'construir_3d').input; assert.equal(enviado.estilo_cmd, '_.VSCURRENT _Conceptual '); assert.ok(enviado.capas.find((c) => c.nombre === 'TW3D_CUBIERTA').visible === false, 'cubierta oculta por defecto');
    assert.ok(/ñ/.test(dwgAbs), 'ruta con ñ y apóstrofo');
    // nunca sobrescribe; solo en 03 Trabajo
    await assert.rejects(() => mk().construir3d('Obra', args), (x) => x.code === 'DWG_YA_EXISTE');
    await assert.rejects(() => mk().construir3d('Obra', { ...args, dwgRel: '02 Originales/nuevo.dwg' }), (x) => ['ORIGINAL_PROTEGIDO', 'RUTA_NO_PERMITIDA', 'ESCRITURA_DENEGADA', 'DESTINO_FUERA_DE_TRABAJO'].includes(x.code) || /original/i.test(x.message));
    await assert.rejects(() => mk().construir3d('Obra', { ...args, dwgRel: '03 Trabajo/x.txt' }), (x) => x.code === 'TIPO_NO_PERMITIDO');
    await assert.rejects(() => mk().construir3d('Obra', { ...args, dwgRel: '03 Trabajo/otro.dwg', vista: 'nada' }), (x) => x.code === 'DATO_INVALIDO');
    // un fallo de AutoCAD no deja un DWG a medias
    fs.rmSync(dwgAbs); await assert.rejects(() => mk({ falloConstruir: true, escribeDwg: undefined }).construir3d('Obra', args), (x) => x.code === 'AUTOCAD_ERROR'); assert.equal(fs.existsSync(dwgAbs), false);
    escribe(dwgAbs);
    // verificación sólido a sólido
    const sim = (o) => { const base = r.reg.primitivas.map((p) => ({ tipo: 'AcDb3dSolid', capa: p.capa, props: { Volume: p.esperado.volumen, Centroid: [...p.esperado.centroide], ...(o.sinBbox ? {} : { BBoxMin: [...p.esperado.bbox_min], BBoxMax: [...p.esperado.bbox_max] }) } })); base.push({ tipo: 'AcDbText', capa: 'TW3D_NOTAS', props: { TextString: 'n', InsertionPoint: [0, 0, 0], Height: 200, Alignment: 0 } }); return new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(base, { activePath: dwgAbs, ...o }) }); };
    const v = await sim({}).verificarSolidos('Obra', { dwgRel: rt.dwg, primitivas: r.reg.primitivas }); assert.equal(v.estado, 'fiel'); assert.equal(v.solidos.coinciden, r.reg.primitivas.length); assert.equal(v.estructura.ok, true);
    const sb = await sim({ sinBbox: true }).verificarSolidos('Obra', { dwgRel: rt.dwg, primitivas: r.reg.primitivas }); assert.equal(sb.estado, 'no_concluyente'); assert.equal(sb.solidos.caja_envolvente.no_informada, r.reg.primitivas.length);
    // persistencia completa (cerrar y reabrir) con sólidos
    const pers = await sim({}).verificarPersistencia('Obra', { archivo: rt.dwg }); assert.equal(pers.persistencia, 'verificada'); assert.equal(pers.cobertura.AcDb3dSolid.verificadas, r.reg.primitivas.length); assert.equal(pers.no_verificables_total, 0);
    const perdida = await sim({ alReabrir: (ents) => ents.filter((x, i) => i !== 3) }).verificarPersistencia('Obra', { archivo: rt.dwg }); assert.equal(perdida.persistencia, 'fallida');
    // vista, inspección, transformación (solo copia de trabajo)
    const vi = await sim({}).vista3d('Obra', { vista: 'planta', estilo: 'oculto', ocultar: ['TW3D_CUBIERTA'] }); assert.deepEqual(vi.direccion_vista, [0, 0, 1]); assert.equal(vi.capas_visibles.TW3D_CUBIERTA, false); assert.match(vi.nota, /no se guarda/);
    const ins = await sim({}).inspeccionarSolidos('Obra', {}); assert.equal(ins.total_solidos, r.reg.primitivas.length); assert.ok(ins.por_capa.TW3D_LOSA.solidos >= 1); assert.deepEqual(ins.envolvente_mm.min.slice(0, 2), env.min.slice(0, 2));
    const tr = await sim({}).transformarSolido('Obra', { handle: ins.solidos[0].handle, operacion: 'mover', dx: 100, dy: 0, dz: 0 }); assert.equal(tr.despues.centroide[0], tr.antes.centroide[0] + 100); assert.match(tr.aviso, /NO coincide/);
    await assert.rejects(() => sim({}).transformarSolido('Obra', { handle: 'zz', operacion: 'mover' }), (x) => x.code === 'DATO_INVALIDO'); await assert.rejects(() => sim({}).transformarSolido('Obra', { handle: 'A1', operacion: 'escalar' }), (x) => x.code === 'DATO_INVALIDO');
    const activoOriginal = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado([], { activePath: path.join(e.root, '02 Originales', 'o.dwg') }) });
    await assert.rejects(() => activoOriginal.vista3d('Obra', {}), (x) => x.code === 'ORIGINAL_PROTEGIDO'); await assert.rejects(() => activoOriginal.transformarSolido('Obra', { handle: 'A1', operacion: 'mover' }), (x) => x.code === 'ORIGINAL_PROTEGIDO');
    assert.equal(fs.readFileSync(path.join(e.root, '02 Originales', 'o.dwg'), 'utf8'), 'ORIGINAL');
  } finally { e.done(); }
});

test('MCP: flujo completo de herramientas 3D sin AutoCAD (crear, ver, modificar, historial) y herramientas de AutoCAD con mensajes claros fuera de Windows', async () => {
  const home = tmpHome("Tannia ñ mcp3d "); const cli = await startClient(home); const c = cli.client;
  try {
    const tools = (await c.listTools()).tools.map((t) => t.name); for (const n of ['tannia_3d_crear', 'tannia_3d_modificar', 'tannia_3d_ver', 'tannia_3d_historial', 'tannia_3d_a_autocad', 'tannia_3d_vista', 'tannia_3d_inspeccionar', 'tannia_3d_solido_transformar', 'tannia_3d_verificar']) assert.ok(tools.includes(n), n);
    await call(c, 'tannia_proyecto_crear', { nombre: 'Taller' });
    // encargo NUEVO (no es una vivienda del asistente): un galpón con puerta de acceso, ventana y cubierta a un agua
    const modelo = { niveles: [{ id: 'N1', cota_mm: 0, altura_mm: 3200 }], muros: [
      { id: 'M1', nivel: 'N1', tipo: 'ext', espesor_mm: 150, p1: [0, 0], p2: [9000, 0], vanos: [{ id: 'PORTON', tipo: 'puerta', posicion_mm: 4500, ancho_mm: 3000, alto_mm: 2800 }] },
      { id: 'M2', nivel: 'N1', tipo: 'ext', espesor_mm: 150, p1: [9000, 0], p2: [9000, 6000] }, { id: 'M3', nivel: 'N1', tipo: 'ext', espesor_mm: 150, p1: [9000, 6000], p2: [0, 6000], vanos: [{ id: 'VENT', tipo: 'ventana', posicion_mm: 4500, ancho_mm: 2000, alto_mm: 1000, antepecho_mm: 1200 }] },
      { id: 'M4', nivel: 'N1', tipo: 'ext', espesor_mm: 150, p1: [0, 6000], p2: [0, 0] }], losas: [{ id: 'L', nivel: 'N1', espesor_mm: 120, contorno: [[-75, -75], [9075, -75], [9075, 6075], [-75, 6075]] }], cubiertas: [{ id: 'C', nivel: 'N1', tipo: 'un_agua', pendiente_pct: 10, direccion: '+y', voladizo_mm: 300 }] };
    let r = await call(c, 'tannia_3d_crear', { proyecto: 'Taller', nombre: 'Galpon', modelo, solicitud: 'galpón de 9×6 m' }); assert.ok(!r.isError, JSON.stringify(r.content));
    let d = data(r); assert.equal(d.version, 'v001'); assert.equal(d.vanos, 2); assert.equal(d.cubiertas[0].tipo, 'un_agua'); assert.ok(d.por_clase.muro_ext >= 4); assert.equal(d.coherencia_2d, null); assert.match(d.aviso, /no apto para construcción/);
    r = await call(c, 'tannia_3d_modificar', { proyecto: 'Taller', nombre: 'Galpon', operaciones: [{ operacion: 'agregar_vano', muro: 'M2', vano: { id: 'V2', tipo: 'ventana', posicion_mm: 3000, ancho_mm: 1200, alto_mm: 1000, antepecho_mm: 1200 } }, { operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 3400 } }] });
    d = data(r); assert.equal(d.version, 'v002'); assert.equal(d.vanos, 3);
    r = await call(c, 'tannia_3d_modificar', { proyecto: 'Taller', nombre: 'Galpon', operaciones: [{ operacion: 'agregar_vano', muro: 'M2', vano: { id: 'V3', tipo: 'puerta', posicion_mm: 100, ancho_mm: 900, alto_mm: 2100 } }] }); assert.equal(r.isError, true); assert.match(JSON.stringify(r.content), /VANO_FUERA_DEL_MURO|no cabe/);
    r = await call(c, 'tannia_3d_ver', { proyecto: 'Taller' }); assert.equal(data(r).modelos[0].head, 'v002');
    r = await call(c, 'tannia_3d_ver', { proyecto: 'Taller', nombre: 'Galpon' }); d = data(r); assert.equal(d.modelo.muros.length, 4); assert.ok(Object.keys(d.operaciones_disponibles).includes('definir_cubierta'));
    r = await call(c, 'tannia_3d_historial', { proyecto: 'Taller', nombre: 'Galpon', accion: 'deshacer' }); assert.equal(data(r).head, 'v001');
    // sin pendiente no hay cubierta inclinada (no se inventa)
    r = await call(c, 'tannia_3d_crear', { proyecto: 'Taller', nombre: 'Sin pendiente', modelo: { ...modelo, cubiertas: [{ id: 'C', nivel: 'N1', tipo: 'un_agua', direccion: '+y' }] } }); assert.equal(r.isError, true); assert.match(JSON.stringify(r.content), /PENDIENTE_REQUERIDA/);
    // diseño 2D → 3D por MCP
    await call(c, 'tannia_diseno_crear', { proyecto: 'Taller', nombre: 'Casa', programa: { dormitorios: 3 } });
    r = await call(c, 'tannia_3d_crear', { proyecto: 'Taller', nombre: 'Casa 3D', desde_anteproyecto: { nombre: 'Casa' } }); d = data(r); assert.equal(d.coherencia_2d.estado, 'coherente'); assert.ok(d.supuestos_a_confirmar[0].includes('2400'));
    r = await call(c, 'tannia_3d_a_autocad', { proyecto: 'Taller', nombre: 'Casa 3D' }); assert.equal(r.isError, true); assert.match(JSON.stringify(r.content), /AUTOCAD_NO_DISPONIBLE|AUTOCAD_NO_ABIERTO|Windows/);
    assert.ok(fs.existsSync(path.join(home, 'Proyectos', 'Taller', '03 Trabajo', 'Modelos3D', 'Casa 3D', 'v001.json')));
    assert.ok(!fs.existsSync(path.join(home, 'Proyectos', 'Taller', '03 Trabajo', 'Modelos3D', 'Casa 3D', 'v001_3D.dwg')), 'sin AutoCAD no se inventa un DWG');
  } finally { await cli.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('límites de Windows: scripts 3D largos van comprimidos y entradas grandes por la entrada estándar (sin superar 32 767 caracteres)', () => {
  const script = buildScript('construir_3d'); const r = prepararLlamada(script, { primitivas: [], dwg: 'x' });
  assert.ok(r.comando.length < 4000 && r.env.TANNIA_SCRIPT_GZ, 'script largo: arranque fijo + script comprimido');
  assert.equal(gunzipSync(Buffer.from(r.env.TANNIA_SCRIPT_GZ, 'base64')).toString('utf8'), script, 'el script se recupera idéntico');
  const corto = prepararLlamada(buildScript('estado'), {}); assert.ok(corto.comando.length <= 32000);
  const grande = { primitivas: Array.from({ length: 2000 }, (_, i) => ({ id: `S${i}`, centro: [i, i, i], esperado: { volumen: 1e9, centroide: [1, 2, 3], bbox_min: [0, 0, 0], bbox_max: [1, 1, 1] } })) };
  const g = prepararLlamada(script, grande); assert.equal(g.env.TANNIA_IN_STDIN, '1'); assert.equal(g.env.TANNIA_IN, undefined); assert.deepEqual(JSON.parse(Buffer.from(g.stdin, 'base64').toString('utf8')), grande);
  for (const n of ['construir_3d', 'vista_3d', 'transformar_solido', 'enumerar', 'leer_lote', 'dxf_a_dwg', 'agregar_lineas']) { const l = prepararLlamada(buildScript(n), { handles: [], x: 1 }); assert.ok(l.comando.length < 32000 && Object.values(l.env).every((v) => v.length < 32000), n); }
  assert.ok(LIMITE_COMANDO < 32000);
});
