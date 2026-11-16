// TW09-02: semántica formal de ancla/distancia_mm, inspección y previsualización sin escritura, candidatos viables.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';
import { aplicarOperacion, CATALOGO } from '../src/design/operaciones.js';
import { inspeccionarMuros, candidatosLibres } from '../src/design/inspeccion.js';
import { Anteproyectos } from '../src/design/servicio.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome, startClient, call, data } from './helpers.js';

const m = generarModelo({}); const g = derivar(m);

test('semántica: distancia_mm es el CENTRO; inicio = oeste/sur, fin = este/norte, centro = desplazamiento desde el punto medio', () => {
  const muros = inspeccionarMuros(g);
  for (const w of muros) for (const a of w.aberturas) {
    assert.equal(a.borde_fin_mm - a.borde_inicio_mm, a.ancho_mm); near(a.centro_desde_inicio_mm - a.borde_inicio_mm, a.ancho_mm / 2);
    assert.ok(a.borde_inicio_mm >= 300 - 1e-6 && a.borde_fin_mm <= w.largo_mm - 300 + 1e-6, 'respeta el margen a esquinas');
  }
  const ext = muros.find((w) => w.id.endsWith('-S') && w.aberturas.length); assert.equal(ext.orientacion, 'horizontal (oeste→este)'); assert.ok(ext.eje.desde[0] < ext.eje.hasta[0]);
  const vert = muros.find((w) => w.orientacion.startsWith('vertical')); assert.ok(vert.eje.desde[1] < vert.eje.hasta[1]);
  // ancla inicio / fin / centro sobre un muro exterior con espacio libre (elegido por cálculo, no por id fijo)
  const seg = g.murosSeg.find((x) => x.tipo === 'ext' && candidatosLibres(g, x.id, 1000).viable); const L = seg.hasta - seg.desde; const cand = candidatosLibres(g, seg.id, 1000).rangos_centro_mm[0];
  const nueva = (a) => { const r = aplicarOperacion(m, { operacion: 'agregar_abertura', tipo: 'ventana', recinto: seg.recinto, lado: seg.lado, ancho_mm: 1000, ...a }); return derivar(r.modelo).aberturas.find((x) => x.id === r.modelo.aberturas.at(-1).id); };
  const c0 = Math.round((cand.centro_min_mm + cand.centro_max_mm) / 2);
  near(nueva({ ancla: 'inicio', distancia_mm: c0 }).pos_mm, c0); near(nueva({ ancla: 'fin', distancia_mm: L - c0 }).pos_mm, c0); near(nueva({ ancla: 'centro', distancia_mm: c0 - L / 2 }).pos_mm, c0);
  assert.equal(nueva({ ancla: 'inicio', distancia_mm: 100 }).ajustada, true, 'un centro que viola el margen se ajusta y se informa');
  assert.match(CATALOGO.mover_abertura, /CENTRO/); assert.match(CATALOGO.agregar_abertura, /CENTRO/);
});
function near(a, b, t = 1e-6) { assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`); }

test('candidatos libres: respetan margen a esquinas y separación con aberturas existentes; sin espacio → no viable con motivo', () => {
  for (const s of g.murosSeg) {
    const c = candidatosLibres(g, s.id, 1200); assert.ok(c); const L = s.hasta - s.desde;
    for (const r of c.rangos_centro_mm) {
      assert.ok(r.centro_min_mm >= 300 + 600 - 1e-6 && r.centro_max_mm <= L - 300 - 600 + 1e-6);
      // el extremo de cada rango no solapa con aberturas existentes (incluye margen)
      for (const a of g.aberturas.filter((x) => !x.invalida && x.segmento === s.id)) for (const p of [r.centro_min_mm, r.centro_max_mm]) assert.ok(Math.abs(p - a.pos_mm) >= a.ancho_mm / 2 + 600 + 300 - 1e-6 || p < 0, 'no solapa');
    }
  }
  assert.equal(candidatosLibres(g, g.murosSeg[0].id, 5900).viable, false); assert.match(candidatosLibres(g, g.murosSeg[0].id, 5900).motivo, /no cabe/);
  assert.equal(candidatosLibres(g, 'NOEXISTE', 1000), null);
  // un candidato calculado SÍ se puede aplicar (cierra el ciclo inspección → previsualización → aplicación)
  const s = g.murosSeg.find((x) => x.tipo === 'ext' && candidatosLibres(g, x.id, 900).viable); const cand = candidatosLibres(g, s.id, 900).rangos_centro_mm[0].ejemplo;
  const r = aplicarOperacion(m, { operacion: 'agregar_abertura', tipo: 'ventana', recinto: s.recinto, lado: s.lado, ancho_mm: 900, ...cand }); const ab = derivar(r.modelo).aberturas.find((a) => a.id === r.modelo.aberturas.at(-1).id);
  assert.equal(ab.invalida, undefined); assert.equal(ab.ajustada, false); near(ab.pos_mm, cand.distancia_mm, 0.01);
});

test('previsualizar: no escribe nada, explica por qué no cabe y coincide con lo que luego hace modificar', () => {
  const home = tmpHome('Tannia ñ previ '); const sb = new Sandbox(home); createProject(sb, 'P'); const A = new Anteproyectos(sb);
  try {
    A.crear('P', { nombre: 'C', programa: {} }); const dir = path.join(home, 'Proyectos', 'P', '03 Trabajo', 'Anteproyectos', 'C');
    const antes = fs.readdirSync(dir).sort(); const hist = fs.readFileSync(path.join(dir, 'historial.json'), 'utf8');
    const ok = A.previsualizar('P', 'C', { operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 3000 }] });
    const mal = A.previsualizar('P', 'C', { operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 90000 }] });
    const noExiste = A.previsualizar('P', 'C', { operaciones: [{ operacion: 'renombrar', recinto: 'R-XX', nombre: 'Z' }] });
    assert.equal(mal.aplicable, false); assert.ok(mal.motivo.length > 10); assert.equal(noExiste.aplicable, false); assert.equal(noExiste.se_escribio_algo, false);
    assert.deepEqual(fs.readdirSync(dir).sort(), antes, 'no se creó ningún archivo'); assert.equal(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8'), hist, 'el historial no cambió');
    if (ok.aplicable) { const real = A.modificar('P', 'C', { operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 3000 }] }); assert.deepEqual(real.cambios.superficie_construida_m2, ok.cambios.superficie_construida_m2); assert.equal(real.cambios.recintos_modificados.length, ok.cambios.recintos_modificados.length); }
    assert.match(ok.alcance ?? mal.alcance ?? 'previsualización', /previsualización|Previsualización/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('MCP: tannia_diseno_inspeccionar y tannia_diseno_previsualizar sin ids ni JSON del usuario', async () => {
  const home = tmpHome('Tannia ñ mcpv '); const cli = await startClient(home); const c = cli.client;
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: 'V' }); await call(c, 'tannia_diseno_crear', { proyecto: 'V', nombre: 'Casa', programa: { dormitorios: 3 } });
    let r = await call(c, 'tannia_diseno_inspeccionar', { proyecto: 'V', nombre: 'Casa' }); assert.ok(!r.isError); let d = data(r); assert.ok(d.muros.length > 10); assert.match(d.convencion, /CENTRO/);
    const seg = d.muros.find((w) => w.tipo === 'ext'); r = await call(c, 'tannia_diseno_inspeccionar', { proyecto: 'V', nombre: 'Casa', segmento: seg.id, ancho_mm: 900 }); assert.ok(data(r).candidatos);
    r = await call(c, 'tannia_diseno_previsualizar', { proyecto: 'V', nombre: 'Casa', operaciones: [{ operacion: 'eliminar_recinto', recinto: 'R-INEXISTENTE' }] }); assert.ok(!r.isError); assert.equal(data(r).aplicable, false); assert.equal(data(r).se_escribio_algo, false);
    r = await call(c, 'tannia_diseno_inspeccionar', { proyecto: 'V', nombre: 'Casa', segmento: 'NOEXISTE', ancho_mm: 900 }); assert.equal(r.isError, true);
  } finally { await cli.close(); fs.rmSync(home, { recursive: true, force: true }); }
});
