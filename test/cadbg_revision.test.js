// Revisión independiente del PR #36 (SHA b1b3f914): BG-R01, BG-R02, BG-R03 y observación de AUDIT. Pruebas NEGATIVAS escritas antes de
// corregir: fallan en b1b3f91 y pasan con la corrección. El «AutoCAD sin interfaz» es un SIMULADOR; el COM es un espía (sin AutoCAD).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tmpHome } from './helpers.js';
import { TUNEL, hogar, simulador, sesion, leerTrabajo, esperar } from './helpers_cadbg.js';
import { createServer } from '../src/server.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { AutoCadCom, SCRIPTS } from '../src/cad/autocad_com.js';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- BG-R01
test('BG-R01: un DWG ya publicado solo se reutiliza si su huella, la del DXF, la revisión y el registro siguen íntegros; si no, se aparta y se vuelve a convertir', { timeout: 300000 }, async () => {
  const home = hogar(); const sim = simulador(); const s = await sesion(home, sim.env); const P = 'Túnel R01';
  try {
    await s.T('tannia_proyecto_crear', { nombre: P });
    const pl = await s.hasta(await s.crear({ proyecto: P, tipo: 'planos', datos: TUNEL })); const rev = pl.pasos[0].resultado.revision_planos;
    const d1 = await s.hasta(await s.crear({ proyecto: P, tipo: 'dwg' })); assert.equal(d1.estado_interno, 'TERMINADO');
    const dir = path.join(home, 'Proyectos', P, '03 Trabajo', 'CAD', 'modelos', rev); const dwg = path.join(dir, 'planos.dwg'); const reg = path.join(dir, 'dwg-verificacion.json');
    // Íntegro: se reutiliza sin volver a convertir
    const r0 = await s.hasta(await s.crear({ proyecto: P, tipo: 'dwg' })); assert.equal(r0.pasos[0].resultado.reutilizado, true); assert.equal(sim.invocaciones().length, 2);
    const casos = [
      ['un byte del DWG cambió', () => { const b = fs.readFileSync(dwg); b[b.length - 1] ^= 0xff; fs.writeFileSync(dwg, b); }, /DWG/],
      ['el registro dice otra revisión', () => { const r = JSON.parse(fs.readFileSync(reg, 'utf8')); r.revision_planos = 'r-00000000000000000000'; fs.writeFileSync(reg, JSON.stringify(r)); }, /revisi[oó]n/],
      ['el registro fue editado (fidelidad)', () => { const r = JSON.parse(fs.readFileSync(reg, 'utf8')); r.fidelidad.autocad_real_verificado = true; fs.writeFileSync(reg, JSON.stringify(r)); }, /registro/],
      ['el registro cita otro DXF', () => { const r = JSON.parse(fs.readFileSync(reg, 'utf8')); r.dxf_sha256 = '0'.repeat(64); fs.writeFileSync(reg, JSON.stringify(r)); }, /DXF|registro/],
    ];
    for (const [nombre, mutar, motivo] of casos) {
      mutar(); const antes = sim.invocaciones().length;
      const e = await s.hasta(await s.crear({ proyecto: P, tipo: 'dwg' }));
      assert.equal(e.estado_interno, 'TERMINADO', nombre); const res = e.pasos[0].resultado;
      assert.notEqual(res.reutilizado, true, `${nombre}: NO debe reutilizarse`);
      assert.equal(sim.invocaciones().length, antes + 2, `${nombre}: se vuelve a convertir y releer`);
      assert.ok(res.reconciliado && res.reconciliado.motivos.some((m) => motivo.test(m)), `${nombre}: ${JSON.stringify(res.reconciliado)}`);
      assert.ok(fs.existsSync(path.join(path.dirname(dwg), ...res.reconciliado.apartado.split('/').slice(-2))) || fs.existsSync(path.join(home, 'Proyectos', P, ...res.reconciliado.apartado.split('/'))), `${nombre}: lo alterado se conserva aparte`);
      const nuevo = JSON.parse(fs.readFileSync(reg, 'utf8')); assert.equal(nuevo.sha256, sha(fs.readFileSync(dwg))); assert.equal(nuevo.revision_planos, rev); assert.equal(nuevo.fidelidad.autocad_real_verificado, false);
    }
  } finally { await s.close(); }
});

// ---------------------------------------------------------------- BG-R02
test('BG-R02: aunque el equipo admita 2 trabajos, nunca hay dos AutoCAD sin interfaz a la vez (proyectos distintos); un bloqueo de un proceso muerto no deja la cola detenida', { timeout: 300000 }, async () => {
  const home = hogar({ trabajos_simultaneos: 2 }); const sim = simulador(undefined, 'pausa'); const s = await sesion(home, sim.env);
  try {
    for (const P of ['Obra A', 'Obra B']) { await s.T('tannia_proyecto_crear', { nombre: P }); await s.hasta(await s.crear({ proyecto: P, tipo: 'planos', datos: TUNEL })); }
    const [a, b] = [await s.crear({ proyecto: 'Obra A', tipo: 'dwg' }), await s.crear({ proyecto: 'Obra B', tipo: 'dwg' })];
    const [ea, eb] = [await s.hasta(a), await s.hasta(b)];
    assert.equal(ea.estado_interno, 'TERMINADO'); assert.equal(eb.estado_interno, 'TERMINADO');
    const iv = sim.intervalos(); assert.equal(iv.length, 4); assert.ok(iv.every((x) => x.fin));
    for (let i = 0; i < iv.length; i++) for (let j = i + 1; j < iv.length; j++) assert.ok(iv[i].fin <= iv[j].ini || iv[j].fin <= iv[i].ini, `dos Core Console a la vez: ${JSON.stringify([iv[i], iv[j]])}`);
    assert.ok([a, b].some((id) => leerTrabajo(home, id).eventos.some((x) => x.evento === 'esperando_cad')), 'uno de los dos esperó su turno');
    // Bloqueo abandonado por un proceso que ya no existe: se recupera solo
    fs.writeFileSync(path.join(home, '.tannia-trabajos', 'cad.lock'), JSON.stringify({ trabajo: 'trb-000000000000', pid: 2 ** 22 + 12345, pid_cad: null, t: new Date().toISOString() }));
    sim.modo('normal');
    await s.T('tannia_proyecto_crear', { nombre: 'Obra C' }); await s.hasta(await s.crear({ proyecto: 'Obra C', tipo: 'planos', datos: TUNEL }));
    const c = await s.hasta(await s.crear({ proyecto: 'Obra C', tipo: 'dwg' })); assert.equal(c.estado_interno, 'TERMINADO');
    assert.ok(!fs.existsSync(path.join(home, '.tannia-trabajos', 'cad.lock')), 'el bloqueo se libera al terminar');
  } finally { await s.close(); }
});

// ---------------------------------------------------------------- BG-R03
function espia({ activo }) {
  const llamadas = [];
  const runner = async (script, input) => {
    const name = Object.keys(SCRIPTS).find((k) => script.includes(SCRIPTS[k])); llamadas.push({ name, input });
    const data = { estado: { version: '26', nombre: 'AutoCAD', progid: 'AutoCAD.Application.26', documento: path.basename(activo), ruta: activo, guardado: true, unidades_insunits: 6, documentos: 2 }, agregar_lineas: { handles: (input.lineas || []).map((_, i) => `H${i}`), capa_creada: false }, abrir_copia: { documento: path.basename(input.ruta || ''), ruta: input.ruta } }[name];
    return JSON.stringify(data ? { ok: true, data } : { ok: false, codigo: 'AUTOCAD_NO_ABIERTO', intentos: [] });
  };
  return { runner, llamadas };
}
const INTERRUMPEN = ['importar_dxf_aislado', 'abrir_copia', 'laminas_a_dwg', 'dxf_a_dwg', 'agregar_lineas', 'cerrar_reabrir', 'construir_3d', 'vista_3d', 'transformar_solido'];
const interrupciones = (ll) => ll.filter((x) => INTERRUMPEN.includes(x.name));
function obra() {
  const home = tmpHome(); const sb = new Sandbox(home); sb.ensureHome(); createProject(sb, 'Obra COM'); const root = path.join(home, 'Proyectos', 'Obra COM');
  const copia = path.join(root, '03 Trabajo', 'Planta copia.dwg'); fs.writeFileSync(copia, 'AC1032 copia de trabajo sintética'); const otra = path.join(root, '03 Trabajo', 'Otra copia.dwg'); fs.writeFileSync(otra, 'AC1032 otra');
  return { home, sb, root, copia, otra };
}

test('BG-R03: el adaptador COM, usado directamente y sin política, NO ejecuta ninguna operación que interrumpa el escritorio (falla cerrado)', async () => {
  const o = obra(); const e = espia({ activo: o.copia });
  const com = new AutoCadCom({ sandbox: o.sb, platform: 'win32', runner: e.runner, sleep: async () => {} });
  await assert.rejects(com.agregarLineas('Obra COM', { lineas: [{ x1: 0, y1: 0, x2: 1, y2: 0 }] }), (x) => x.code === 'AUTORIZACION_INTERACTIVA_REQUERIDA');
  await assert.rejects(com.abrirCopia('Obra COM', '03 Trabajo/Planta copia.dwg'), (x) => x.code === 'AUTORIZACION_INTERACTIVA_REQUERIDA');
  assert.deepEqual(interrupciones(e.llamadas), [], JSON.stringify(e.llamadas.map((x) => x.name)));
  const { SCRIPTS_INTERACTIVOS, SCRIPTS_LECTURA } = await import('../src/cad/politica_interactiva.js');
  for (const k of Object.keys(SCRIPTS)) assert.ok(SCRIPTS_INTERACTIVOS.has(k) !== SCRIPTS_LECTURA.has(k), `script sin clasificar o doble: ${k}`);
  for (const k of INTERRUMPEN) assert.ok(SCRIPTS_INTERACTIVOS.has(k), k);
});

test('BG-R03: herramientas COM antiguas (abrir copia, agregar línea/s) piden autorización humana específica del documento; sin ella o rechazada, 0 operaciones; con ella, solo sobre ese documento', { timeout: 120000 }, async () => {
  const prev = process.env.TANNIA_SIN_DIALOGO; process.env.TANNIA_SIN_DIALOGO = '1';
  try {
    const o = obra(); const e = espia({ activo: o.copia }); const vistos = [];
    const conectar = async (respuesta) => {
      const { server } = createServer({ home: o.home, platform: 'win32', cadRunner: e.runner }); const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b);
      const cli = new Client({ name: 't', version: '1' }, respuesta ? { capabilities: { elicitation: {} } } : {});
      if (respuesta) cli.setRequestHandler(ElicitRequestSchema, async (req) => { vistos.push(req.params.message); return respuesta; });
      await cli.connect(a); return cli;
    };
    const L = { proyecto: 'Obra COM', x1: 0, y1: 0, x2: 1, y2: 0 };
    const LL = { proyecto: 'Obra COM', lineas: [{ x1: 0, y1: 0, x2: 1, y2: 0 }] };
    let cli = await conectar(null);
    for (const [n, a] of [['tannia_cad_agregar_linea', L], ['tannia_cad_agregar_lineas', LL], ['tannia_cad_abrir_copia', { proyecto: 'Obra COM', archivo: '03 Trabajo/Planta copia.dwg' }]]) {
      const r = await cli.callTool({ name: n, arguments: a }); assert.equal(r.isError, true, n); assert.equal(r.structuredContent.error, 'AUTORIZACION_INTERACTIVA_REQUERIDA', `${n}: ${r.content[0].text}`);
    }
    assert.deepEqual(interrupciones(e.llamadas), [], 'sin canal humano: ninguna operación interactiva'); await cli.close();
    cli = await conectar({ action: 'decline' });
    const r2 = await cli.callTool({ name: 'tannia_cad_agregar_lineas', arguments: LL }); assert.equal(r2.structuredContent.error, 'INTERVENCION_POSPUESTA'); assert.deepEqual(interrupciones(e.llamadas), []);
    assert.match(vistos.at(-1), /Planta copia\.dwg/); assert.match(vistos.at(-1), /no se guardan|quedan intactos|Queda intacto/i); await cli.close();
    cli = await conectar({ action: 'accept', content: { aprobar: true, nombre: 'Persona de prueba' } }); const n0 = vistos.length;
    const ok1 = await cli.callTool({ name: 'tannia_cad_agregar_lineas', arguments: LL }); assert.ok(!ok1.isError, ok1.content[0].text);
    const ok2 = await cli.callTool({ name: 'tannia_cad_agregar_linea', arguments: L }); assert.ok(!ok2.isError, ok2.content[0].text);
    assert.equal(vistos.length, n0 + 2, 'cada solicitud necesita consentimiento; el lote completo usa una ventana');
    assert.equal(interrupciones(e.llamadas).length, 2); assert.ok(interrupciones(e.llamadas).every((x) => x.input.ruta_esperada === o.copia));
    await cli.close();
  } finally { if (prev === undefined) delete process.env.TANNIA_SIN_DIALOGO; else process.env.TANNIA_SIN_DIALOGO = prev; }
});

test('BG-R03: el permiso queda ligado al documento — un script interactivo sobre otro documento se rechaza aunque haya permiso', async () => {
  const { exigirAlcance } = await import('../src/cad/politica_interactiva.js');
  const o = obra(); const { crearPermiso } = await import('../src/cad/politica_interactiva.js'); const permiso = crearPermiso({ proyecto: 'Obra COM', operacion: 'agregar_lineas', documentos: [o.copia], cambios: { agregar_lineas: { ruta_esperada: o.copia } }, canal: 'prueba' });
  assert.doesNotThrow(() => exigirAlcance(permiso, 'agregar_lineas', { ruta_esperada: o.copia }));
  assert.throws(() => exigirAlcance(permiso, 'agregar_lineas', { ruta_esperada: o.otra }), (x) => x.code === 'FUERA_DEL_ALCANCE_AUTORIZADO');
  assert.throws(() => exigirAlcance(permiso, 'abrir_copia', { ruta: o.copia }), (x) => x.code === 'FUERA_DEL_ALCANCE_AUTORIZADO');
  assert.throws(() => exigirAlcance({ ...permiso, expira: Date.now() - 1 }, 'agregar_lineas', { ruta_esperada: o.copia }), (x) => x.code === 'AUTORIZACION_INTERACTIVA_REQUERIDA');
  assert.throws(() => exigirAlcance(null, 'agregar_lineas', { ruta_esperada: o.copia }), (x) => x.code === 'AUTORIZACION_INTERACTIVA_REQUERIDA');
});

// ---------------------------------------------------------------- Observación: AUDIT
test('Observación AUDIT: con errores detectados no se publica; con informe no interpretable no se declara relectura completa', { timeout: 240000 }, async () => {
  const home = hogar(); const sim = simulador(); const s = await sesion(home, sim.env); const P = 'Túnel AUDIT';
  try {
    await s.T('tannia_proyecto_crear', { nombre: P }); const pl = await s.hasta(await s.crear({ proyecto: P, tipo: 'planos', datos: TUNEL }));
    const dwg = path.join(home, 'Proyectos', P, '03 Trabajo', 'CAD', 'modelos', pl.pasos[0].resultado.revision_planos, 'planos.dwg');
    sim.modo('audit_errores'); const e1 = await s.hasta(await s.crear({ proyecto: P, tipo: 'dwg' }));
    assert.equal(e1.estado_interno, 'FALLÓ'); assert.equal(leerTrabajo(home, e1.trabajo).pasos[0].error, 'AUDIT_CON_ERRORES'); assert.ok(!fs.existsSync(dwg));
    sim.modo('audit_ilegible'); const e2 = await s.hasta(await s.crear({ proyecto: P, tipo: 'dwg' }));
    assert.equal(e2.estado_interno, 'TERMINADO'); const f = e2.pasos[0].resultado.fidelidad;
    assert.equal(f.estado, 'RELECTURA_COINCIDE_AUDIT_NO_INTERPRETABLE'); assert.match(f.nota, /AUDIT/);
    assert.match(e1.mensaje_para_la_persona, /AutoCAD/); assert.doesNotMatch(e1.mensaje_para_la_persona, /nada a medias/);
  } finally { await s.close(); }
});

test('Observación: la cancelación no afirma absolutos («no quedó nada a medias»)', async () => {
  const { mensajeParaPersona } = await import('../src/trabajos/coordinador.js');
  const m = mensajeParaPersona({ proyecto: 'X', estado: 'CANCELADO', pasos: [] });
  assert.doesNotMatch(m, /nada a medias/); assert.match(m, /no se public/);
  void esperar; void os;
});
