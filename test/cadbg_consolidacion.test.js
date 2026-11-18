import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PoliticaInteractiva } from '../src/cad/politica_interactiva.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';
import { hogar, simulador, sesion, TUNEL, esperar } from './helpers_cadbg.js';

function caso() {
  const sb = new Sandbox(tmpHome()); sb.ensureHome(); createProject(sb, 'Obra');
  const doc = path.join(sb.projectRoot('Obra'), '03 Trabajo', 'copia.dwg'); fs.writeFileSync(doc, 'AC1032 prueba');
  let pedidos = 0;
  const politica = new PoliticaInteractiva({ sandbox: sb, aprobacion: { decidir: async () => { pedidos++; return pedidos === 1 ? { por: 'human_dialog' } : { por: null, rechazado: true, resultado: 'rechazado' }; } } });
  return { doc, politica, pedidos: () => pedidos };
}
for (const operacion of ['agregar_lineas', 'transformar_solido']) test(`BG-R04: ${operacion}, un cambio B no hereda la aprobación de A`, async () => {
  const c = caso(); const base = { proyecto: 'Obra', operacion, documentos: [c.doc] };
  await c.politica.permiso({ ...base, cambios: { [operacion]: { dx: 1, lineas: [{ x1: 0, y1: 0, x2: 1, y2: 0 }] } } });
  await assert.rejects(c.politica.permiso({ ...base, cambios: { [operacion]: { dx: 2, lineas: [{ x1: 0, y1: 0, x2: 2, y2: 0 }] } } }), e => e.code === 'INTERVENCION_POSPUESTA');
  assert.equal(c.pedidos(), 2);
});
test('BG-R04: cambiar el documento mientras la persona responde invalida el consentimiento', async () => {
  const c = caso(); c.politica.aprobacion = { decidir: async () => { fs.appendFileSync(c.doc, ' modificado'); return { por: 'human_dialog' }; } };
  await assert.rejects(c.politica.permiso({ proyecto: 'Obra', operacion: 'agregar_lineas', documentos: [c.doc], cambios: { agregar_lineas: { lineas: [] } } }), e => e.code === 'DOCUMENTO_CAMBIO_DURANTE_AUTORIZACION');
});
test('BG-R05: un registro temporalmente ilegible no permite robar el turno CAD', { timeout: 120000 }, async () => {
  const home = hogar(); const sim = simulador(); const s = await sesion(home, sim.env);
  try {
    await s.T('tannia_proyecto_crear', { nombre: 'Obra' }); await s.hasta(await s.crear({ proyecto: 'Obra', tipo: 'planos', datos: TUNEL }));
    const lock = path.join(home, '.tannia-trabajos', 'cad.lock'); fs.writeFileSync(lock, '{"pid":');
    const id = await s.crear({ proyecto: 'Obra', tipo: 'dwg' });
    await esperar(3000);
    assert.equal(sim.invocaciones().length, 0, 'no debe iniciar CAD con propietario desconocido');
    assert.equal(fs.readFileSync(lock, 'utf8'), '{"pid":');
    // El propietario termina de publicar el registro; después libera su turno.
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, pid_cad: null, trabajo: 'otro' }));
    await esperar(500); assert.equal(sim.invocaciones().length, 0);
    fs.unlinkSync(lock);
    assert.equal((await s.hasta(id)).estado_interno, 'TERMINADO');
  } finally { await s.close(); }
});

test('BG-R04: el adaptador exige los parámetros aprobados, un solo uso y una vigencia válida', async () => {
  const { crearPermiso, exigirAlcance } = await import('../src/cad/politica_interactiva.js');
  const c = caso(); const input = { ruta_esperada: c.doc, lineas: [{ x1: 0, y1: 0, x2: 3, y2: 2 }], capa: 'MUROS' };
  const p = crearPermiso({ proyecto: 'Obra', operacion: 'agregar_lineas', documentos: [c.doc], cambios: { agregar_lineas: input }, canal: 'prueba' });
  assert.throws(() => exigirAlcance(p, 'agregar_lineas', { ...input, lineas: [{ x1: 0, y1: 0, x2: 99, y2: 2 }] }), e => e.code === 'FUERA_DEL_ALCANCE_AUTORIZADO');
  assert.doesNotThrow(() => exigirAlcance(p, 'agregar_lineas', input));
  assert.throws(() => exigirAlcance(p, 'agregar_lineas', input), e => e.code === 'FUERA_DEL_ALCANCE_AUTORIZADO');
  const vencido = crearPermiso({ proyecto: 'Obra', operacion: 'agregar_lineas', documentos: [c.doc], cambios: { agregar_lineas: input }, canal: 'prueba', vigenciaMs: -1 });
  assert.throws(() => exigirAlcance(vencido, 'agregar_lineas', input), e => e.code === 'AUTORIZACION_INTERACTIVA_REQUERIDA');
  assert.throws(() => exigirAlcance({ ...p }, 'agregar_lineas', input), e => e.code === 'FUERA_DEL_ALCANCE_AUTORIZADO');
});

test('BG-R05: actualizaciones no truncan al propietario; espera cancelable y recuperación de propietario muerto', async () => {
  const { tomarTurnoCad } = await import('../src/trabajos/bloqueo_cad.js');
  const archivo = path.join(tmpHome(), 'cad.lock');
  const opts = { archivo, trabajo: 'uno', intervaloMs: 5, timeoutMs: 1000 };
  const a = await tomarTurnoCad(opts); const original = fs.readFileSync(archivo, 'utf8');
  let cancelar = false; let entro = false;
  const b = tomarTurnoCad({ ...opts, trabajo: 'dos', cancelado: () => cancelar }).then(r => { entro = r !== null; return r; });
  for (let i = 0; i < 30; i++) { a.anotarCad(process.pid); assert.equal(fs.readFileSync(archivo, 'utf8'), original); await esperar(2); }
  assert.equal(entro, false); cancelar = true; assert.equal(await b, null);
  a.liberar();
  fs.writeFileSync(archivo, JSON.stringify({ pid: 2 ** 22 + 12345, trabajo: 'caido', pid_cad: null }));
  const siguientes = await Promise.all([tomarTurnoCad(opts), tomarTurnoCad({ ...opts, timeoutMs: 100 })]);
  assert.equal(siguientes.filter(x => typeof x === 'object').length, 1);
  siguientes.find(x => typeof x === 'object').liberar();
});
