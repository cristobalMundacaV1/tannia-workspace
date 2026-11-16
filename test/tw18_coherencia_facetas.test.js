// TW09-02: coherencia 2D↔3D por facetas. Casos del ensayo real: altura 2D 2500 con 3D 2400 y 2600 NO pueden salir "coherente" sin matiz.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';
import { modeloDesdeGeo, coherenciaConGeo } from '../src/arq3d/desde_anteproyecto.js';
import { Modelos3d } from '../src/arq3d/servicio.js';
import { Anteproyectos } from '../src/design/servicio.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';

const m2 = generarModelo({}); const g = derivar(m2);
const con = (alturaMm, extra = {}) => { const m = modeloDesdeGeo(g, { altura_muros_mm: alturaMm, ...extra }); return coherenciaConGeo(m, g, m2); };

test('altura: 2D libre 2500 frente a 3D 2400 (discrepante), 2500 (verificado) y 2600 (revisar) — nunca un verde ambiguo', () => {
  const bajo = con(2400); assert.equal(bajo.estado, 'con_diferencias'); assert.equal(bajo.facetas.alturas.estado, 'discrepante'); assert.ok(bajo.diferencias.some((d) => d.aspecto === 'muro_mas_bajo_que_altura_libre'));
  const igual = con(2500); assert.equal(igual.estado, 'coherente_en_alcance'); assert.equal(igual.facetas.alturas.estado, 'verificado');
  const alto = con(2600); assert.equal(alto.estado, 'con_observaciones'); assert.equal(alto.facetas.alturas.estado, 'revisar'); assert.match(alto.facetas.alturas.motivo, /100 mm/);
  assert.deepEqual(igual.no_comparadas, ['cubierta_losa_niveles'], 'lo que el 2D no define se declara como NO comparado');
  assert.match(igual.alcance, /NO es una verificación estructural ni normativa/);
});

test('sin altura en el 2D la faceta queda "no_comparado" y todo lo comparado se declara', () => {
  const sin = { ...m2 }; delete sin.altura_piso_cielo_mm; const r = coherenciaConGeo(modeloDesdeGeo(g, { altura_muros_mm: 2500 }), g, sin);
  assert.equal(r.facetas.alturas.estado, 'no_comparado'); assert.ok(r.no_comparadas.includes('alturas')); assert.equal(r.estado, 'coherente_en_alcance');
});

test('facetas de vanos y espesores: alto, antepecho y espesor discrepantes se localizan por id', () => {
  const m = modeloDesdeGeo(g, { altura_muros_mm: 2500 });
  const w = m.muros.find((x) => x.vanos.some((v) => v.tipo === 'ventana')); const v = w.vanos.find((x) => x.tipo === 'ventana'); v.antepecho_mm += 100; v.alto_mm += 50;
  const e = m.muros.find((x) => x.id !== w.id); e.espesor_mm += 20;
  const r = coherenciaConGeo(m, g, m2); assert.equal(r.estado, 'con_diferencias');
  assert.equal(r.facetas.altos_y_antepechos.estado, 'discrepante'); assert.equal(r.facetas.espesores.estado, 'discrepante'); assert.equal(r.facetas.vanos_en_planta.estado, 'verificado');
  assert.deepEqual(r.diferencias.filter((d) => d.faceta === 'altos_y_antepechos').map((d) => d.aspecto).sort(), ['alto_de_vano', 'antepecho']); assert.ok(r.diferencias.some((d) => d.aspecto === 'espesor_de_muro' && d.id === e.id));
});

test('al crear desde un plano 2D la altura sale del plano (no de un 2400 fijo) y el registro de supuestos queda al día tras cada cambio', () => {
  const home = tmpHome('Tannia ñ facetas '); const sb = new Sandbox(home); createProject(sb, 'P'); const A = new Anteproyectos(sb); const M = new Modelos3d(sb, A);
  try {
    A.crear('P', { nombre: 'Casa', programa: {} });
    const c = M.crear('P', { nombre: 'M', desde_anteproyecto: { nombre: 'Casa' } });
    assert.equal(c.reg.modelo.niveles[0].altura_mm, 2500); assert.equal(c.reg.modelo.niveles[0].fuente_altura, 'plano_2d'); assert.match(c.reg.supuestos_lista[0], /2500 mm, tomada de la altura piso–cielo del plano 2D/);
    assert.equal(M.coherencia2d('P', 'M').estado, 'coherente_en_alcance');
    const u = M.crear('P', { nombre: 'U', desde_anteproyecto: { nombre: 'Casa' }, parametros: { altura_muros_mm: 2700 } }); assert.equal(u.reg.modelo.niveles[0].fuente_altura, 'indicada');
    const m = M.modificar('P', 'M', { operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 2400 } }] });
    assert.equal(m.reg.modelo.supuestos.niveles[0].altura_mm, 2400, 'el registro de supuestos refleja la altura actual');
    const co = M.coherencia2d('P', 'M'); assert.equal(co.estado, 'con_diferencias'); assert.equal(co.facetas.revision_origen.estado, 'verificado');
    A.modificar('P', 'Casa', { operaciones: [{ operacion: 'espesores', ext_mm: 220, int_mm: 120 }] });
    const co2 = M.coherencia2d('P', 'M'); assert.equal(co2.facetas.revision_origen.estado, 'revisar'); assert.ok(co2.nota);
    const sync = M.modificar('P', 'M', { actualizar_desde_anteproyecto: {} }); assert.equal(sync.reg.modelo.niveles[0].altura_mm, 2400, 'la sincronización conserva la decisión de altura del 3D'); assert.equal(sync.reg.modelo.supuestos.niveles[0].altura_mm, 2400);
    assert.equal(M.coherencia2d('P', 'M').facetas.espesores.estado, 'verificado');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
