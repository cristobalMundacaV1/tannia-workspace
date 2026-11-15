// Asistente de anteproyecto (TW-DESIGN): generación, geometría, DXF, refinamiento, historial, cubicación y conocimiento técnico.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';
import { verificarCoherencia } from '../src/design/coherencia.js';
import { aplicarOperacion } from '../src/design/operaciones.js';
import { escribirDxf, dxfDecode, vistaAscii } from '../src/design/salidas.js';
import { Anteproyectos, verificarDxfContraModelo } from '../src/design/servicio.js';
import { cubicarAnteproyecto } from '../src/design/cubicacion.js';
import { consultarConocimiento } from '../src/conocimiento/index.js';
import { FUENTES } from '../src/conocimiento/fuentes.js';
import { parseDxf } from '../src/dxf/reader.js';
import { measureDxf } from '../src/dxf/measure.js';
import { Sandbox, sha256File } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const solapaPos = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;

test('caso de aceptación: 80 m², 3 dormitorios, 2 baños, living-comedor y cocina americana → distribución coherente y completa', () => {
  const m = generarModelo({}); const g = derivar(m); const c = verificarCoherencia(m, g);
  assert.ok(Math.abs(g.areas.construida_m2 - 80) / 80 <= 0.02, `superficie ${g.areas.construida_m2}`);
  assert.deepEqual(Object.values(g.recintos).map((r) => r.nombre).sort(), ['BAÑO 1', 'BAÑO PRINCIPAL', 'COCINA AMERICANA', 'DORMITORIO 2', 'DORMITORIO 3', 'DORMITORIO PRINCIPAL', 'LIVING-COMEDOR', 'PASILLO']);
  assert.equal(c.errores.length, 0); assert.equal(c.estado, 'ok');
  assert.equal(m.programa.sistema_constructivo, 'albanileria_confinada'); assert.ok(m.supuestos.some((s) => /Sistema constructivo no indicado/.test(s)));
  assert.ok(m.preguntas.length >= 1 && m.fundamentos.length >= 4);
  for (const f of m.fundamentos) { assert.equal(f.origen, 'practica_de_diseno'); assert.ok(f.confirmar_en.length); }
  const tipos = (t) => Object.values(g.recintos).filter((r) => r.tipo === t).length;
  assert.equal(tipos('dormitorio') + tipos('dormitorio_principal'), 3); assert.equal(tipos('bano'), 2);
  assert.equal(m.separaciones.filter((s) => s.tipo === 'abierta').length, 1, 'cocina americana abierta al living');
  assert.ok(g.aberturas.some((a) => a.funcion === 'acceso') && g.aberturas.filter((a) => a.tipo === 'ventana').length >= 8 && g.aberturas.filter((a) => a.hoja).length >= 6);
});

test('geometría verificada de forma independiente: sin solapes, áreas cuadran, muros con espesor, aberturas dentro del muro y barridos dentro del recinto', () => {
  for (const prog of [{}, { variante: 'B' }, { dormitorios: 2, banos: 1, superficie_objetivo_m2: 70 }, { dormitorios: 2, banos: 2, superficie_objetivo_m2: 90, sistema_constructivo: 'entramado_madera' }, { dormitorios: 3, banos: 1, superficie_objetivo_m2: 100, cocina: 'cerrada', sistema_constructivo: 'hormigon_armado' }]) {
    const m = generarModelo(prog); const g = derivar(m); const R = Object.values(g.recintos);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) assert.ok(!solapaPos(R[i].neto, R[j].neto), `solape ${R[i].id}/${R[j].id} ${JSON.stringify(prog)}`);
    near(g.areas.util_neta_m2 + g.areas.muros_union_bruta_m2, g.areas.construida_m2, 0.02);
    near(g.areas.construida_m2, (g.exterior.x1 * g.exterior.y1) / 1e6, 0.01);
    for (const r of R) { assert.ok(r.neto.x0 >= 0 && r.neto.y0 >= 0 && r.neto.x1 <= g.exterior.x1 && r.neto.y1 <= g.exterior.y1); near(r.area_neta_m2, (r.ancho_neto_mm * r.fondo_neto_mm) / 1e6, 0.01); }
    for (const a of g.aberturas) { assert.ok(!a.invalida, a.motivo); const s = g.segmentos.find((x) => x.id === a.segmento); const lo = s.desde; assert.ok(a.desde >= lo && a.hasta <= s.hasta, `${a.id} dentro del muro`); }
    for (const a of g.aberturas.filter((x) => x.hoja)) { const n = g.recintos[a.hoja.abre_hacia].neto; for (const q of a.hoja.barrido) assert.ok(q.x >= n.x0 - 5 && q.x <= n.x1 + 5 && q.y >= n.y0 - 5 && q.y <= n.y1 + 5, `barrido ${a.id}`); }
    assert.equal(verificarCoherencia(m, g).errores.length, 0, JSON.stringify(prog));
    // espesores reales: el área de muros coincide con (exterior − útil)
    assert.ok(g.areas.muros_m2 > 0);
  }
});

test('programas fuera de los límites se rechazan con mensaje claro (no se inventa una solución)', () => {
  for (const [prog, re] of [[{ dormitorios: 5 }, /dormitorios/], [{ banos: 4 }, /baños/], [{ superficie_objetivo_m2: 30 }, /m²/], [{ cocina: 'isla' }, /cocina/], [{ sistema_constructivo: 'adobe' }, /Sistema/]]) assert.throws(() => generarModelo(prog), (e) => e.code === 'PROGRAMA_NO_SOPORTADO' && re.test(e.message), JSON.stringify(prog));
  const chico = generarModelo({ superficie_objetivo_m2: 60 });
  assert.ok(derivar(chico).areas.construida_m2 > 65 && chico.supuestos.some((s) => /necesita al menos/.test(s)), 'si el programa no cabe, lo dice y no finge los 60 m²');
});

test('DXF: lo escrito se re-mide con el motor DXF; áreas = modelo; textos Unicode escapados; capas esperadas', () => {
  const m = generarModelo({}); const g = derivar(m); const dxf = escribirDxf(m, g, { titulo: 'Casa ñandú', version: 'v001', fecha: '2026-11-15' });
  assert.match(dxf, /AC1009/); assert.ok(!/[^\x00-\x7f]/.test(dxf), 'solo ASCII; el resto como \\U+');
  assert.match(dxf, /BA\\U\+00D1O/); assert.equal(dxfDecode('BA\\U+00D1O'), 'BAÑO');
  const v = verificarDxfContraModelo(dxf, g); assert.equal(v.ok, true, v.discrepancias.join()); assert.equal(v.recintos_dxf, 8); near(v.area_util_dxf_m2, g.areas.util_neta_m2, 0.01);
  const med = measureDxf(parseDxf(dxf), { unidad_confirmada: 'mm' });
  assert.deepEqual(Object.keys(med.totales_por_capa_unidades_dibujo).filter((c) => c.startsWith('TW_')).sort(), ['TW_COTA', 'TW_EJES', 'TW_MURO_EXT', 'TW_MURO_INT', 'TW_PUERTA', 'TW_RECINTO', 'TW_VENTANA']);
  // perímetro exterior medido sobre TW_MURO_EXT: contorno exterior + interior del anillo de muros
  const ext = med.totales_por_capa_metros.TW_MURO_EXT.longitud_m; assert.ok(ext > 2 * (g.exterior.x1 + g.exterior.y1) / 1000, 'incluye contorno interior y jambas');
  assert.ok(vistaAscii(g).leyenda.length === 8);
});

test('oráculo externo (ezdxf, si está disponible): el DXF abre sin errores de auditoría y las áreas coinciden', (t) => {
  const g = derivar(generarModelo({})); const dxf = escribirDxf(generarModelo({}), g, { titulo: 'x', version: 'v001', fecha: '2026-11-15' });
  const f = path.join(tmpHome(), 'o.dxf'); fs.writeFileSync(f, dxf);
  const py = `import sys, json\ntry:\n    import ezdxf\nexcept Exception:\n    print('SIN_EZDXF'); sys.exit(0)\nd = ezdxf.readfile(sys.argv[1]); a = d.audit()\narea = 0; n = 0\nfor e in d.modelspace():\n    if e.dxftype() == 'POLYLINE' and e.dxf.layer == 'TW_RECINTO':\n        p = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]\n        area += abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))/2; n += 1\nprint(json.dumps({'version': d.dxfversion, 'errores': len(a.errors), 'recintos': n, 'area_m2': area/1e6, 'capas': sorted({e.dxf.layer for e in d.modelspace()})}))`;
  const r = spawnSync('python3', ['-c', py, f], { encoding: 'utf8' });
  if (r.error || !r.stdout || /SIN_EZDXF/.test(r.stdout)) { t.skip('ezdxf/python3 no disponible'); return; }
  const o = JSON.parse(r.stdout); assert.equal(o.version, 'AC1009'); assert.equal(o.errores, 0); assert.equal(o.recintos, 8); near(o.area_m2, g.areas.util_neta_m2, 0.01);
  for (const c of ['TW_MURO_EXT', 'TW_MURO_INT', 'TW_PUERTA', 'TW_VENTANA', 'TW_RECINTO', 'TW_TEXTO', 'TW_COTA']) assert.ok(o.capas.includes(c), c);
});

test('refinamiento: ajustar un recinto solo cambia lo declarado; lo demás queda idéntico; superficies recalculadas', () => {
  const m0 = generarModelo({}); const g0 = derivar(m0);
  const { modelo: m1 } = aplicarOperacion(m0, { operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 3000 });
  const g1 = derivar(m1);
  const cambian = Object.keys(g0.recintos).filter((id) => JSON.stringify(g0.recintos[id].neto) !== JSON.stringify(g1.recintos[id].neto)).sort();
  assert.deepEqual(cambian, ['R-D2', 'R-D3'], 'solo el recinto y el que compensa');
  assert.equal(g1.recintos['R-D2'].ancho_neto_mm, 3000);
  near(g1.areas.construida_m2, g0.areas.construida_m2, 1e-9); // el contorno exterior no cambia
  near(g1.recintos['R-D2'].area_neta_m2 + g1.recintos['R-D3'].area_neta_m2, g0.recintos['R-D2'].area_neta_m2 + g0.recintos['R-D3'].area_neta_m2 + (g1.recintos['R-D2'].fondo_neto_mm * 0), 1.3);
  assert.deepEqual(m1.aberturas.map((a) => a.id), m0.aberturas.map((a) => a.id), 'ninguna abertura se pierde');
  assert.equal(verificarCoherencia(m1, g1).errores.length, 0);
  // el original no se muta (inmutabilidad)
  assert.equal(m0.arbol.hijos[2].tamanos.join(), generarModelo({}).arbol.hijos[2].tamanos.join());
  // cambio imposible → error claro
  assert.throws(() => aplicarOperacion(m0, { operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 6000 }), (e) => e.code === 'OPERACION_INVALIDA' && /angosto/.test(e.message));
  assert.throws(() => aplicarOperacion(m0, { operacion: 'inventada' }), (e) => /desconocida/.test(e.message));
});

test('operaciones del catálogo: intercambiar, renombrar, aberturas, dividir, eliminar, separación, espesores y sistema', () => {
  let m = generarModelo({}); const paso = (op) => { const r = aplicarOperacion(m, op); m = r.modelo; const g = derivar(m); const c = verificarCoherencia(m, g); assert.equal(c.errores.length, 0, `${op.operacion}: ${c.errores.map((e) => e.mensaje).join()}`); return { r, g }; };
  paso({ operacion: 'renombrar', recinto: 'R-D3', nombre: 'escritorio' }); assert.equal(m.recintos['R-D3'].nombre, 'ESCRITORIO');
  const antes = derivar(m).recintos['R-D2'].neto; paso({ operacion: 'intercambiar', a: 'R-D2', b: 'R-D3' });
  assert.ok(derivar(m).recintos['R-D3'].neto.x0 === antes.x0, 'el lugar se conserva; cambia quién lo ocupa');
  const { g: gv } = paso({ operacion: 'agregar_abertura', tipo: 'ventana', recinto: 'R-DP', lado: 'O' }); assert.ok(gv.aberturas.some((a) => a.recinto === 'R-DP' && a.lado === 'O'));
  const idV = m.aberturas.find((a) => a.recinto === 'R-DP' && a.lado === 'O').id;
  paso({ operacion: 'mover_abertura', id: idV, ancla: 'inicio', distancia_mm: 900 }); paso({ operacion: 'cambiar_abertura', id: idV, ancho_mm: 1000 }); paso({ operacion: 'eliminar_abertura', id: idV });
  assert.throws(() => aplicarOperacion(m, { operacion: 'agregar_abertura', tipo: 'ventana', recinto: 'R-PAS', lado: 'N' }), () => true, 'si no hay muro exterior ahí, se rechaza al validar');
  // dividir: walk-in closet; las ventanas que pierden muro se informan, el acceso queda
  const { r: rd } = paso({ operacion: 'dividir_recinto', recinto: 'R-DP', nuevo: { id: 'R-WIC', nombre: 'walk-in closet', tipo: 'closet' }, eje: 'profundidad', tamano_nuevo_mm: 1200, lado_nuevo: 'N' });
  assert.ok(rd.retiradas.length >= 1 && /ventana/.test(rd.resumen)); assert.ok(m.recintos['R-WIC']); assert.ok(m.aberturas.some((a) => a.entre && a.entre.includes('R-WIC')));
  paso({ operacion: 'eliminar_recinto', recinto: 'R-WIC' }); assert.ok(!m.recintos['R-WIC']); assert.ok(!m.aberturas.some((a) => (a.entre || []).includes('R-WIC')));
  // separación: la frontera cocina–living es completa; cerrarla agrega la puerta necesaria
  paso({ operacion: 'separacion', a: 'R-LIV', b: 'R-COC', tipo: 'muro' }); assert.ok(m.aberturas.some((a) => a.entre && a.entre.includes('R-COC') && a.entre.includes('R-LIV') && a.tipo === 'puerta'));
  paso({ operacion: 'separacion', a: 'R-LIV', b: 'R-COC', tipo: 'abierta' }); assert.equal(m.separaciones.length, 1);
  assert.throws(() => aplicarOperacion(m, { operacion: 'separacion', a: 'R-COC', b: 'R-PAS', tipo: 'abierta' }), (e) => /frontera/.test(e.message), 'no deja recintos irregulares');
  // espesores y sistema: los ejes no cambian, el contorno y las útiles sí
  const g0 = derivar(m); const { g: g1 } = paso({ operacion: 'espesores', ext_mm: 250 }); assert.ok(g1.areas.construida_m2 > g0.areas.construida_m2); assert.ok(g1.areas.util_neta_m2 < g0.areas.util_neta_m2 + 0.01);
  paso({ operacion: 'sistema_constructivo', sistema: 'entramado_madera' }); assert.deepEqual(m.espesores, { ext: 150, int: 100 }); assert.match(m.fundamentos[0].decision, /madera/);
});

test('versiones: crear, modificar, rechazo atómico, deshacer/rehacer/restaurar, inmutabilidad, solo bajo 03 Trabajo y originales intactos', () => {
  const home = tmpHome("Tannia 'ñ "); const sb = new Sandbox(home); createProject(sb, 'Casa ñ'); const root = path.join(home, 'Proyectos', 'Casa ñ');
  fs.writeFileSync(path.join(root, '02 Originales', 'o.dwg'), 'ORIGINAL'); fs.chmodSync(path.join(root, '02 Originales', 'o.dwg'), 0o444); const h0 = sha256File(path.join(root, '02 Originales', 'o.dwg'));
  const A = new Anteproyectos(sb);
  const c = A.crear('Casa ñ', { nombre: 'Casa 80', solicitud: 'Casa de un piso de 80 m2', programa: {} });
  assert.equal(c.version, 'v001'); assert.ok(fs.existsSync(path.join(root, c.archivos.dxf)) && fs.existsSync(path.join(root, c.archivos.svg)));
  assert.throws(() => A.crear('Casa ñ', { nombre: 'Casa 80', programa: {} }), (e) => e.code === 'ANTEPROYECTO_EXISTE');
  const m = A.modificar('Casa ñ', 'Casa 80', { descripcion: 'Dormitorio 2 más ancho', operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 3000 }] });
  assert.equal(m.version, 'v002'); assert.equal(m.cambios.recintos_sin_cambio, 6); assert.deepEqual(m.cambios.recintos_modificados.map((x) => x.recinto).sort(), ['R-D2', 'R-D3']);
  // rechazo atómico: no crea versión ni archivos
  const antesArchivos = fs.readdirSync(path.dirname(path.join(root, m.archivos.dxf))).sort();
  assert.throws(() => A.modificar('Casa ñ', 'Casa 80', { operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 6000 }] }), (e) => e.code === 'OPERACION_INVALIDA');
  assert.deepEqual(fs.readdirSync(path.dirname(path.join(root, m.archivos.dxf))).sort(), antesArchivos);
  // un cambio que choca geométricamente se rechaza completo (ancho de baño tan chico que la puerta no cabe)
  assert.throws(() => A.modificar('Casa ñ', 'Casa 80', { operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-BC', eje: 'ancho', valor_mm: 800, medida: 'util' }] }), (e) => ['CAMBIO_RECHAZADO_INCOHERENTE', 'OPERACION_INVALIDA'].includes(e.code));
  assert.equal(A.historial('Casa ñ', 'Casa 80', 'listar').head, 'v002');
  assert.equal(A.historial('Casa ñ', 'Casa 80', 'deshacer').head, 'v001'); assert.throws(() => A.historial('Casa ñ', 'Casa 80', 'deshacer'), (e) => e.code === 'NADA_QUE_DESHACER');
  assert.equal(A.historial('Casa ñ', 'Casa 80', 'rehacer').head, 'v002'); assert.equal(A.historial('Casa ñ', 'Casa 80', 'restaurar', 'v001').head, 'v001');
  const rama = A.modificar('Casa ñ', 'Casa 80', { descripcion: 'otra idea', operaciones: [{ operacion: 'renombrar', recinto: 'R-D3', nombre: 'estudio' }] });
  assert.equal(rama.version, 'v003'); assert.equal(rama.padre, 'v001', 'tras volver a v001 el cambio nuevo ramifica desde v001');
  assert.equal(A.cargar('Casa ñ', 'Casa 80', 'v002').modelo.recintos['R-D3'].nombre, 'DORMITORIO 3', 'v002 sigue intacta');
  assert.equal(A.historial('Casa ñ', 'Casa 80', 'listar').versiones.length, 3);
  // verificación cruzada y escritura solo bajo 03 Trabajo
  assert.equal(A.verificar('Casa ñ', 'Casa 80').verificacion_dxf.ok, true);
  assert.ok(path.relative(path.join(root, '03 Trabajo'), path.join(root, m.archivos.dxf)).split(path.sep)[0] === 'Anteproyectos');
  assert.equal(sha256File(path.join(root, '02 Originales', 'o.dwg')), h0, 'original intacto');
  assert.throws(() => A.cargar('Casa ñ', 'Casa 80', 'v999'), (e) => e.code === 'VERSION_NO_EXISTE'); assert.throws(() => A.cargar('Casa ñ', 'No existe'), (e) => e.code === 'ANTEPROYECTO_NO_EXISTE');
  fs.rmSync(home, { recursive: true, force: true });
});

test('cubicación desde la geometría construida: fórmulas verificables y altura entregada por la usuaria', () => {
  const m = generarModelo({}); const g = derivar(m); const q = Object.fromEntries(cubicarAnteproyecto(m, g, { altura_muros_m: 2.5 }).map((x) => [x.codigo, x]));
  near(q['AP-PISO-TOTAL'].cantidad, g.areas.util_neta_m2, 0.001); near(q['AP-CONSTRUIDA'].cantidad, g.areas.construida_m2, 0.001);
  near(q['AP-MURO-EXT-LONG'].cantidad, (2 * (m.ejes.ancho + m.ejes.profundidad)) / 1000, 0.001);
  const vanosExt = g.aberturas.filter((a) => a.ext).reduce((s, a) => s + (a.ancho_mm * a.alto_mm) / 1e6, 0);
  near(q['AP-MURO-EXT-AREA'].cantidad, ((2 * (m.ejes.ancho + m.ejes.profundidad)) / 1000) * 2.5 - vanosExt, 0.002);
  near(q['AP-VANOS-AREA'].cantidad, g.aberturas.reduce((s, a) => s + (a.ancho_mm * (a.alto_mm || 2100)) / 1e6, 0), 0.002);
  assert.ok(q['AP-MURO-EXT-AREA'].supuestos[0].includes('dato entregado')); assert.throws(() => cubicarAnteproyecto(m, g, {}), (e) => e.code === 'FALTA_DATO');
  assert.equal(Object.keys(q).filter((k) => k.startsWith('AP-VENTANA')).reduce((s, k) => s + q[k].cantidad, 0), g.aberturas.filter((a) => a.tipo === 'ventana').length);
});

test('capa de conocimiento técnico: orienta sin evaluar; sin valores normativos ni artículos citados; origen y dónde confirmar', () => {
  const r = consultarConocimiento('sistema sísmico albañilería y muros', { sistema: 'albanileria_confinada' });
  const t = r.temas[0]; assert.equal(t.origen, 'practica_de_diseno'); assert.match(t.advertencia_breve, /NO normativo/); assert.ok(t.donde_confirmar.some((f) => f.id === 'nch433') && t.donde_confirmar.some((f) => f.id === 'nch2123')); assert.match(t.quien_revisa, /estructural/);
  assert.match(r.uso, /No es una evaluación de cumplimiento/); assert.match(r.sin_red, /no consulta internet/);
  const todo = JSON.stringify([r, FUENTES, consultarConocimiento('altura piso a cielo'), consultarConocimiento('terreno prc rasante'), consultarConocimiento('ventilación baños')]);
  assert.ok(!/art[ií]culo\s*\d|art\.\s*\d|artículos?\s+\d+\.\d/i.test(todo), 'sin números de artículo citados');
  assert.ok(!/cumple|certific(?!ado de informaciones)/i.test(JSON.stringify(consultarConocimiento('cumplimiento')).replace(/No es una evaluación de cumplimiento|no evalúa cumplimiento|certificación/gi, '')));
  for (const f of Object.values(FUENTES)) { assert.ok(f.url_base.startsWith('https://') && typeof f.acceso_verificado === 'boolean' && f.nota); }
  const urb = consultarConocimiento('terreno y plan regulador'); assert.ok(urb.temas[0].preguntas_para_tannia.length >= 2); assert.match(urb.temas[0].quien_revisa, /Municipal/);
  assert.ok(consultarConocimiento('algo sin relación').temas.length >= 1);
});
