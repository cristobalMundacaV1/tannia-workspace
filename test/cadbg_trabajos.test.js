// CAD-BG (ejecución no intrusiva en segundo plano). Pruebas automatizables en Linux; las de escritorio Windows real y AutoCAD 2027
// quedan en tools/gui/prueba_no_interferencia.py (CI Windows) y en docs/cad-bg/PROTOCOLO_AUTOCAD_2027.md (NO EJECUTADO).
// El «AutoCAD sin interfaz» de estas pruebas es un SIMULADOR (test/proc/accoreconsole_simulado.mjs): prueba el manejo del coordinador,
// NO la fidelidad real de AutoCAD.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tmpHome, startClient, call, data, ROOT } from './helpers.js';
import { createServer } from '../src/server.js';
import { Coordinador, limitesPorHardware, procesoVivo, mensajeParaPersona } from '../src/trabajos/coordinador.js';
import { guionConvertir, guionReleer, rutaParaGuion, decodificarSalida, detectarCoreConsole } from '../src/trabajos/coreconsole.js';
// Nota: el simulador reproduce la convención de acadbp (/i + _.SAVEAS); no prueba que AutoCAD 2027 la acepte.
import { seleccionarModalidad, OPERACIONES } from '../src/trabajos/modalidades.js';

const TUNEL = { length: 150, width: 5.5, wall: 3, selected: 0.06, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 } };
const FINAL = new Set(['TERMINADO', 'REQUIERE_INTERVENCIÓN', 'FALLÓ', 'CANCELADO']);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const BAJA = os.constants.priority.PRIORITY_BELOW_NORMAL;

function hogar(config = {}) { const home = tmpHome(); fs.mkdirSync(path.join(home, '.tannia-trabajos'), { recursive: true }); fs.writeFileSync(path.join(home, '.tannia-trabajos', 'config.json'), JSON.stringify({ memoria_libre_minima_mb: 0, ...config })); return home; }
/** Simulador ejecutable (como lo invocaría spawn con accoreconsole.exe). */
function simulador(dir, modo = 'normal') {
  const exe = path.join(dir, 'accoreconsole-simulado'); const ctl = path.join(dir, 'modo.txt'); const log = path.join(dir, 'invocaciones.jsonl');
  fs.writeFileSync(exe, `#!/bin/sh\nexec "${process.execPath}" "${path.join(ROOT, 'test', 'proc', 'accoreconsole_simulado.mjs')}" "$@"\n`, { mode: 0o755 }); fs.writeFileSync(ctl, modo);
  return { exe, ctl, log, modo: (m) => fs.writeFileSync(ctl, m), invocaciones: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => !x.fin) : []), env: { TANNIA_ACCORECONSOLE: exe, TANNIA_SIM_ACC_CTL: ctl, TANNIA_SIM_ACC_LOG: log, TANNIA_ACCORECONSOLE_VERSION: 'SIMULADOR' } };
}
async function sesion(home, env = {}) {
  const c = await startClient(home, undefined, { TANNIA_AVISOS: 'off', ...env });
  const T = async (n, a, falla = false) => { const r = await call(c.client, n, a); if (!falla) assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return r; };
  const hasta = async (id, cond = (e) => FINAL.has(e.estado_interno), maxMs = 90000) => { const t0 = Date.now(); for (;;) { const e = data(await T('tannia_trabajos', { accion: 'estado', trabajo: id })); if (cond(e)) return e; if (Date.now() - t0 > maxMs) throw new Error(`tiempo agotado esperando ${id}: ${JSON.stringify(e).slice(0, 400)}`); await esperar(300); } };
  return { c, T, hasta, close: () => c.close() };
}
const leerTrabajo = (home, id) => JSON.parse(fs.readFileSync(path.join(home, '.tannia-trabajos', `${id}.json`), 'utf8'));
const preparaciones = (home, P) => { const d = path.join(home, 'Proyectos', P, '03 Trabajo', 'CAD', 'modelos'); if (!fs.existsSync(d)) return []; return fs.readdirSync(d).flatMap((h) => fs.readdirSync(path.join(d, h)).filter((x) => x.startsWith('.preparando'))); };

test('CAD-BG-01 + G-BG4 (N1): sin AutoCAD, el expediente se prepara en segundo plano; el chat no se bloquea; se detiene SOLO en el DWG y pregunta', { timeout: 180000 }, async () => {
  const home = hogar(); const s = await sesion(home, { TANNIA_MODO_B: 'off' }); const P = 'Túnel Ñuble BG';
  try {
    await s.T('tannia_proyecto_crear', { nombre: P });
    const t0 = Date.now(); const r = data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'expediente', datos: TUNEL })); const msCrear = Date.now() - t0;
    assert.ok(msCrear < 2000, `crear debe responder de inmediato (${msCrear} ms)`); assert.match(r.mensaje_para_la_persona, /^Estoy preparando los planos de «Túnel Ñuble BG»\. Puedes seguir utilizando tu computador/);
    // Mientras el trabajo corre, otras herramientas responden (el servidor no queda ocupado)
    await s.hasta(r.trabajo, (e) => e.estado_interno === 'PROCESANDO' || FINAL.has(e.estado_interno));
    const t1 = Date.now(); await s.T('tannia_listar_proyectos', {}); assert.ok(Date.now() - t1 < 1500, 'otra consulta responde mientras el trabajo corre');
    const e = await s.hasta(r.trabajo);
    assert.equal(e.estado_interno, 'REQUIERE_INTERVENCIÓN', JSON.stringify(e).slice(0, 800));
    assert.deepEqual(e.pasos.map((p) => p.estado), ['hecho', 'hecho', 'hecho', 'hecho', 'requiere_intervencion']);
    assert.match(e.mensaje_para_la_persona, /^Los planos, las cubicaciones, el presupuesto y la memoria de «Túnel Ñuble BG» están listos\. Para guardar los planos en DWG necesito usar AutoCAD .*¿Autorizas abrirlo ahora\? Tus dibujos abiertos no se modifican/);
    assert.ok(!/tannia_|JSON|MCP|COM|PowerShell|trb-/.test(e.mensaje_para_la_persona));
    const rev = e.pasos[0].resultado.revision_planos; assert.equal(e.pasos[1].resultado.revision_planos, rev);
    const raiz = path.join(home, 'Proyectos', P);
    assert.ok(fs.existsSync(path.join(raiz, '06 Informes', 'Planos', `${rev}-planos.dxf`)) && fs.existsSync(path.join(raiz, ...e.pasos[2].resultado.archivo.split('/'))) && fs.existsSync(path.join(raiz, ...e.pasos[3].resultado.archivo.split('/'))));
    assert.ok(!fs.existsSync(path.join(raiz, '03 Trabajo', 'CAD', 'modelos', rev, 'planos.dwg')), 'sin modo B no hay DWG (ni COM de reemplazo)');
    const reg = leerTrabajo(home, r.trabajo); assert.equal(reg.recursos.prioridad, BAJA, 'el proceso de fondo corre con prioridad baja'); assert.ok(reg.recursos.memoria_max_mb > 0);
    assert.ok(reg.eventos.some((x) => x.evento === 'proceso_iniciado' && x.prioridad === BAJA));
  } finally { await s.close(); }
});

test('modo B (simulador de Core Console): DWG publicado SOLO tras relectura que coincide con el modelo; procesos ocultos y de prioridad baja; idempotente', { timeout: 180000 }, async () => {
  const home = hogar(); const sim = simulador(fs.mkdtempSync(path.join(os.tmpdir(), 'acc '))); const s = await sesion(home, sim.env); const P = 'Túnel B';
  try {
    await s.T('tannia_proyecto_crear', { nombre: P });
    const e = await s.hasta(data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'expediente', datos: TUNEL })).trabajo);
    assert.equal(e.estado_interno, 'TERMINADO', JSON.stringify(e.pasos).slice(0, 1200));
    const dwg = e.pasos[4].resultado; assert.equal(dwg.fidelidad.estado, 'RELECTURA_COINCIDE_CON_EL_MODELO'); assert.equal(dwg.fidelidad.autocad_real_verificado, false); assert.equal(dwg.motor.origen, 'variable_de_soporte');
    assert.equal(dwg.revision_planos, e.pasos[0].resultado.revision_planos);
    const abs = path.join(home, 'Proyectos', P, ...dwg.archivo.split('/')); assert.equal(fs.readFileSync(abs).subarray(0, 6).toString(), 'AC1032');
    const inv = sim.invocaciones(); assert.equal(inv.length, 2, 'convertir + releer');
    assert.ok(inv.every((x) => x.prioridad === BAJA && !x.stdin_tty), JSON.stringify(inv)); assert.ok(inv[0].args[inv[0].args.indexOf('/i') + 1].endsWith('entrada.dxf') && inv[1].args[inv[1].args.indexOf('/i') + 1].endsWith('planos.dwg'), 'entrada por /i, como acadbp');
    assert.deepEqual(preparaciones(home, P), [], 'sin carpetas de preparación');
    assert.match(e.mensaje_para_la_persona, /están listos para revisión\.$/);
    const e2 = await s.hasta(data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'dwg' })).trabajo);
    assert.equal(e2.estado_interno, 'TERMINADO'); assert.equal(e2.pasos[0].resultado.reutilizado, true); assert.equal(sim.invocaciones().length, 2, 'no se vuelve a escribir');
  } finally { await s.close(); }
});

test('CAD-BG-06 / G-BG3: fidelidad no demostrada, DWG corrupto, relectura fallida o consola colgada ⇒ nada se publica y se explica en simple', { timeout: 240000 }, async () => {
  const home = hogar({ tiempo_maximo_ms: { dwg: 4000 } }); const sim = simulador(fs.mkdtempSync(path.join(os.tmpdir(), 'acc '))); const s = await sesion(home, sim.env); const P = 'Túnel adversarial';
  try {
    await s.T('tannia_proyecto_crear', { nombre: P });
    const pl = await s.hasta(data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'planos', datos: TUNEL })).trabajo); assert.equal(pl.estado_interno, 'TERMINADO');
    assert.match(pl.mensaje_para_la_persona, /Los planos de «Túnel adversarial» están listos para revisión\. Falta comprobar el archivo DWG en AutoCAD\./);
    const rev = pl.pasos[0].resultado.revision_planos; const dwg = path.join(home, 'Proyectos', P, '03 Trabajo', 'CAD', 'modelos', rev, 'planos.dwg');
    for (const [modo, codigo] of [['pierde_capa', 'FIDELIDAD_NO_DEMOSTRADA'], ['dwg_corrupto', 'CONVERSION_FALLIDA'], ['sin_relectura', 'RELECTURA_FALLIDA'], ['cuelga', 'TIEMPO_AGOTADO'], ['falla', 'CONVERSION_FALLIDA']]) {
      sim.modo(modo); const antes = sim.invocaciones().length;
      const e = await s.hasta(data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'dwg' })).trabajo);
      assert.equal(e.estado_interno, 'FALLÓ', modo); assert.equal(leerTrabajo(home, e.trabajo).pasos[0].error, codigo, modo);
      assert.ok(!fs.existsSync(dwg), `${modo}: no se publica un DWG`); assert.deepEqual(preparaciones(home, P), [], `${modo}: sin restos`);
      assert.match(e.mensaje_para_la_persona, /^No pude terminar el trabajo de «Túnel adversarial»: el archivo DWG — [a-záéíóúñ].*[^.]\. Lo que ya estaba listo sigue intacto y la versión anterior se conserva\.$/);
      if (modo === 'cuelga') { const pid = sim.invocaciones().slice(antes).at(-1).pid; await esperar(300); assert.equal(procesoVivo(pid), false, 'la consola colgada se detuvo'); }
    }
  } finally { await s.close(); }
});

test('CAD-BG-05: cancelar en pleno proceso CAD y caída del proceso de fondo — sin archivos a medias, sin repetir lo hecho, reanudación segura', { timeout: 240000 }, async () => {
  const home = hogar(); const sim = simulador(fs.mkdtempSync(path.join(os.tmpdir(), 'acc ')), 'lento'); const s = await sesion(home, sim.env); const P = 'Túnel cancelación';
  try {
    await s.T('tannia_proyecto_crear', { nombre: P });
    // 1) Cancelación durante el paso DWG
    const id = data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'expediente', datos: TUNEL })).trabajo;
    await s.hasta(id, () => { const t = leerTrabajo(home, id); return t.pasos[4].estado === 'en_curso' && t.pasos[4].pid_cad; });
    const pidCad = leerTrabajo(home, id).pasos[4].pid_cad;
    await s.T('tannia_trabajos', { accion: 'cancelar', trabajo: id });
    const c = await s.hasta(id); assert.equal(c.estado_interno, 'CANCELADO'); assert.match(c.mensaje_para_la_persona, /^Detuve el trabajo de «Túnel cancelación»\. Lo que no alcanzó a terminar no se publicó/);
    await esperar(300); assert.equal(procesoVivo(pidCad), false); assert.deepEqual(preparaciones(home, P), []);
    const rev = c.pasos[0].resultado.revision_planos; assert.ok(!fs.existsSync(path.join(home, 'Proyectos', P, '03 Trabajo', 'CAD', 'modelos', rev, 'planos.dwg')));
    // 2) Caída abrupta del proceso de fondo durante el DWG: la reanudación detiene la consola huérfana y NO repite planos/partidas/documentos
    const id2 = data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'expediente', datos: TUNEL })).trabajo;
    await s.hasta(id2, () => { const t = leerTrabajo(home, id2); return t.pasos[4].estado === 'en_curso' && t.pasos[4].pid_cad; });
    const antes = leerTrabajo(home, id2); const huerfano = antes.pasos[4].pid_cad;
    sim.modo('normal'); process.kill(antes.pid, 'SIGKILL'); // el servidor detecta la caída por sí solo y reanuda
    await s.hasta(id2, () => leerTrabajo(home, id2).eventos.some((x) => x.evento === 'interrupcion_detectada'));
    await esperar(300); assert.equal(procesoVivo(huerfano), false, 'la consola huérfana se detuvo');
    const fin = await s.hasta(id2);
    assert.equal(fin.estado_interno, 'TERMINADO', JSON.stringify(fin.pasos).slice(0, 600));
    const d = leerTrabajo(home, id2); assert.equal(d.intentos, 2);
    for (let i = 0; i < 4; i++) assert.equal(d.pasos[i].inicio, antes.pasos[i].inicio, `paso ${d.pasos[i].tipo} no se repitió`);
    const presupuestos = fs.readdirSync(path.join(home, 'Proyectos', P, '05 Presupuestos')).filter((x) => x.endsWith('.xlsx')); assert.equal(presupuestos.length, 2, 'uno por trabajo, ninguno duplicado por la reanudación');
    assert.deepEqual(preparaciones(home, P), []);
  } finally { await s.close(); }
});

test('G-BG2 sin sustitución silenciosa: sin modo B, exportar_dwg NO toca AutoCAD; el modo interactivo exige autorización humana con qué/por qué/qué queda intacto', { timeout: 120000 }, async () => {
  const prev = { ...process.env }; process.env.TANNIA_MODO_B = 'off'; process.env.TANNIA_SIN_DIALOGO = '1';
  try {
    const home = hogar(); const llamadas = []; const espia = async (script, input) => { llamadas.push(input); return JSON.stringify({ ok: false, codigo: 'AUTOCAD_NO_ABIERTO', intentos: [] }); };
    const conectar = async (respuesta) => {
      const { server } = createServer({ home, platform: 'win32', cadRunner: espia }); const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b);
      const cli = new Client({ name: 't', version: '1' }, respuesta ? { capabilities: { elicitation: {} } } : {});
      if (respuesta) cli.setRequestHandler(ElicitRequestSchema, async () => respuesta);
      await cli.connect(a); return cli;
    };
    let cli = await conectar(null);
    await cli.callTool({ name: 'tannia_proyecto_crear', arguments: { nombre: 'Obra C' } });
    await cli.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Obra C', accion: 'generar_tunel', datos: TUNEL } });
    const r = await cli.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Obra C', accion: 'exportar_dwg' } });
    assert.equal(r.isError, true); const d = r.structuredContent; assert.equal(d.error, 'REQUIERE_INTERVENCION');
    assert.match(d.mensaje, /necesito usar AutoCAD con su ventana.*No abrí nada/); assert.ok(d.detalle.que_se_hara && d.detalle.que_queda_intacto && d.detalle.si_pospone);
    assert.equal(llamadas.length, 0, 'ninguna llamada a AutoCAD');
    const r2 = await cli.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Obra C', accion: 'exportar_dwg_interactivo' } });
    assert.equal(r2.structuredContent.error, 'AUTORIZACION_INTERACTIVA_REQUERIDA'); assert.equal(llamadas.length, 0); await cli.close();
    cli = await conectar({ action: 'decline' });
    const r3 = await cli.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Obra C', accion: 'exportar_dwg_interactivo' } });
    assert.equal(r3.structuredContent.error, 'INTERVENCION_POSPUESTA'); assert.match(r3.structuredContent.que_hacer, /DXF y PDF siguen disponibles/); assert.equal(llamadas.length, 0); await cli.close();
    cli = await conectar({ action: 'accept', content: { aprobar: true, nombre: 'Persona de prueba' } });
    await cli.callTool({ name: 'tannia_planos', arguments: { proyecto: 'Obra C', accion: 'exportar_dwg_interactivo' } });
    assert.ok(llamadas.length > 0, 'solo tras autorizar se usa AutoCAD'); await cli.close();
  } finally { for (const k of ['TANNIA_MODO_B', 'TANNIA_SIN_DIALOGO']) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
});

test('G-BG2: el proceso de fondo es físicamente incapaz de usar COM (plataforma «sin CAD») y no puede aprobar nada', async () => {
  const home = hogar(); const { server } = createServer({ home, platform: 'trabajo-sin-cad' }); const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b);
  const cli = new Client({ name: 't', version: '1' }); await cli.connect(a);
  const r = await cli.callTool({ name: 'tannia_cad_listar_entidades', arguments: {} }); assert.equal(r.isError, true); assert.equal(r.structuredContent.error, 'AUTOCAD_NO_DISPONIBLE');
  await cli.close();
});

test('G-BG2 auditoría estática: el código de segundo plano no contiene operaciones de escritorio ni COM; todo proceso se lanza oculto', () => {
  const dir = path.join(ROOT, 'src', 'trabajos'); const archivos = [...fs.readdirSync(dir).map((f) => path.join(dir, f)), path.join(ROOT, 'src', 'tools', 'trabajos.js')];
  const PROHIBIDO = /\b(Activate|SendKeys|AppActivate|SetForegroundWindow|ShowWindow|SetCursorPos|mouse_event|keybd_event|SendInput|GetActiveObject|ActiveDocument|WindowState|BringToFront|Documents\.Add|Documents\.Open|SendCommand|PostCommand)\b/;
  for (const f of archivos) {
    const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''"); // solo código: comentarios y textos descriptivos fuera
    assert.doesNotMatch(src, PROHIBIDO, path.basename(f)); assert.doesNotMatch(src, /autocad_com/, `${path.basename(f)} no importa el adaptador COM`);
    for (const m of src.matchAll(/\bspawn\(/g)) assert.match(src.slice(m.index, m.index + 500), /windowsHide:\s*true/, `${path.basename(f)}: spawn sin windowsHide`);
  }
  assert.match(fs.readFileSync(path.join(dir, 'worker.js'), 'utf8'), /createServer\(\{ home, platform: PLATAFORMA_SIN_CAD/, 'el proceso de fondo usa la plataforma sin CAD');
  const g = guionConvertir({ dwg: 'planos.dwg' }) + guionReleer({ dxfSalida: 'relectura.dxf' });
  assert.match(g, /^[\x20-\x7e\r\n]+$/, 'el guion es ASCII puro (sin rutas con ñ)');
  for (const malo of ['C:\\Users\\Tañia\\planos.dwg', 'planos ñ.dwg', '../planos.dwg', 'planos.dxf']) assert.throws(() => guionConvertir({ dwg: malo }), malo);
  assert.doesNotMatch(g, /NETLOAD|\(command|PLOT|CLOSE|QSAVE|ERASE|PURGE|OPEN|\bQUIT\b/i); assert.match(g, /FILEDIA\r\n0/);
  for (const mala of ['relativa.dxf', '/a/b".dxf', '/a/b\n.dxf', '/a/b;c.dxf', '/a/b.dwg']) assert.throws(() => rutaParaGuion(mala, '.dxf'), mala);
  assert.equal(decodificarSalida(Buffer.from('Comando: _.DXFIN', 'utf16le')), 'Comando: _.DXFIN');
});

test('G-BG1: límites según el equipo, cola por proyecto, espera por memoria y un solo inicio aunque haya dos coordinadores', async () => {
  assert.equal(limitesPorHardware({ cpus: 4, totalmem: 8 * 2 ** 30 }).trabajos_simultaneos, 1);
  assert.equal(limitesPorHardware({ cpus: 16, totalmem: 64 * 2 ** 30 }).trabajos_simultaneos, 2, 'nunca más de 2');
  assert.equal(limitesPorHardware({ cpus: 16, totalmem: 64 * 2 ** 30 }).cad_simultaneos, 1);
  const home = hogar(); fs.mkdirSync(path.join(home, 'Proyectos'), { recursive: true });
  const lanzados = []; const A = new Coordinador({ home, lanzar: (id) => { lanzados.push(id); return null; }, limites: limitesPorHardware({ cpus: 16, totalmem: 64 * 2 ** 30, sobre: { memoria_libre_minima_mb: 0 } }) });
  const B = new Coordinador({ home, lanzar: (id) => { lanzados.push(id); return null; }, limites: A.limites });
  const t1 = A.crear({ proyecto: 'Obra 1', pasos: [{ tipo: 'planos' }] }); const t2 = A.crear({ proyecto: 'Obra 1', pasos: [{ tipo: 'memoria' }] }); const t3 = A.crear({ proyecto: 'Obra 2', pasos: [{ tipo: 'planos' }] });
  A.programar(); B.programar();
  assert.deepEqual(lanzados.sort(), [t1.id, t3.id].sort(), 'un trabajo por proyecto y cada uno una sola vez');
  assert.equal(A.leer(t2.id).espera, 'cola'); assert.match(A.leer(t2.id).mensaje, /Hay otro trabajo en curso; empiezo con la memoria de «Obra 1» apenas termine/);
  const C = new Coordinador({ home: hogar(), lanzar: () => assert.fail('no debe lanzar con poca memoria'), memoriaLibre: () => 100 * 2 ** 20, limites: limitesPorHardware({ sobre: { memoria_libre_minima_mb: 512 } }) });
  const t4 = C.crear({ proyecto: 'Obra 3', pasos: [{ tipo: 'planos' }] }); C.programar(); assert.equal(C.leer(t4.id).espera, 'memoria'); assert.match(C.leer(t4.id).mensaje, /poca memoria libre/);
  assert.throws(() => A.crear({ proyecto: 'Obra 1', pasos: [{ tipo: 'aprobar_entrega' }] }), (e) => e.code === 'PASO_NO_PERMITIDO');
  const t5 = A.crear({ proyecto: 'Obra 4', pasos: [{ tipo: 'planos' }] }); // pendiente sin iniciar
  const lim = A.limites; A.limites = { ...lim, trabajos_simultaneos: 0 }; A.programar(); A.limites = lim;
  assert.equal(A.cancelar(t5.id).estado, 'CANCELADO', 'cancelar un pendiente no requiere proceso');
});

test('G-BG0: selección de modalidad — A sin AutoCAD; DWG solo B; C nunca se elige automáticamente', () => {
  assert.equal(seleccionarModalidad('planos').modo, 'A');
  assert.equal(seleccionarModalidad('dwg', { coreConsole: { disponible: true, origen: 'registro', version: 'AutoCAD 2027' } }).modo, 'B');
  const sinB = seleccionarModalidad('dwg', { coreConsole: { disponible: false, motivo: 'No se encontró AutoCAD Core Console.' } });
  assert.equal(sinB.modo, null); assert.equal(sinB.requiere_intervencion, true); assert.equal(sinB.alternativa, 'C');
  for (const op of Object.keys(OPERACIONES)) assert.notEqual(seleccionarModalidad(op, { coreConsole: { disponible: true } }).modo, 'C', op);
  assert.equal(detectarCoreConsole({ platform: 'linux', env: {} }).disponible, false);
  const det = detectarCoreConsole({ platform: 'win32', env: {}, existe: (p) => p === 'C:\\Program Files\\Autodesk\\AutoCAD 2027\\accoreconsole.exe', reg: () => 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\AutoCAD\\R25.2\\ACAD-B101:409\n    AcadLocation    REG_SZ    C:\\Program Files\\Autodesk\\AutoCAD 2027\n' });
  assert.equal(det.disponible, true); assert.equal(det.origen, 'registro'); assert.equal(det.verificado_en_autocad_real, false);
  assert.equal(mensajeParaPersona({ proyecto: 'X', estado: 'FALLÓ', motivo: 'el archivo DWG — no coincide', pasos: [] }), 'No pude terminar el trabajo de «X»: el archivo DWG — no coincide. Lo que ya estaba listo sigue intacto y la versión anterior se conserva.');
});

test('paquete (bundle CommonJS): el trabajo de fondo corre desde server/index.js instalado, sin archivos sueltos de src', { timeout: 240000 }, async () => {
  const { execFileSync } = await import('node:child_process');
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle bg '));
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, env: { ...process.env, TANNIA_DIST_DIR: dist }, stdio: 'pipe' });
  const entry = path.join(dist, 'mcpb', 'server', 'index.js'); assert.ok(fs.existsSync(entry), entry);
  const home = hogar(); const c = await startClient(home, entry, { TANNIA_MODO_B: 'off', TANNIA_AVISOS: 'off' });
  try {
    assert.ok(!(await call(c.client, 'tannia_proyecto_crear', { nombre: 'Obra paquete' })).isError);
    const id = data(await call(c.client, 'tannia_trabajos', { accion: 'crear', proyecto: 'Obra paquete', tipo: 'cubicaciones', datos: TUNEL })).trabajo;
    let e; for (let i = 0; i < 200; i++) { e = data(await call(c.client, 'tannia_trabajos', { accion: 'estado', trabajo: id })); if (FINAL.has(e.estado_interno)) break; await esperar(300); }
    assert.equal(e.estado_interno, 'TERMINADO', JSON.stringify(e).slice(0, 600)); assert.deepEqual(e.pasos.map((p) => p.estado), ['hecho', 'hecho']);
    assert.equal(leerTrabajo(home, id).recursos.prioridad, BAJA);
  } finally { await c.close(); }
});

test('CAD-BG-08 edificación (N1): especificación con muro y vanos → planos + cubicaciones en segundo plano, cantidades con oráculo a mano', { timeout: 120000 }, async () => {
  const home = hogar(); const s = await sesion(home, { TANNIA_MODO_B: 'off' }); const P = 'Edificio BG';
  const especificacion = { codigo: 'ED-01', especialidad: 'edificación', proyecto: P, capas: { MUROS: { color: 7, grosor: 0.5, leyenda: 'Muros' }, VANOS: { color: 3, grosor: 0.25, leyenda: 'Vanos' } }, vistas: [{ id: 'elev', titulo: 'Elevación eje A', tipo: 'elevacion', escala: 50, elementos: [{ id: 'muro', tipo: 'rectangulo', capa: 'MUROS', origen: [0, 0], ancho: 6, alto: 2.4 }, { id: 'puerta', tipo: 'rectangulo', capa: 'VANOS', origen: [1, 0], ancho: 0.9, alto: 2.0 }, { id: 'ventana', tipo: 'rectangulo', capa: 'VANOS', origen: [3.5, 1.0], ancho: 1.2, alto: 1.0 }] }], laminas: [{ id: '01', titulo: 'Elevación eje A', vistas: ['elev'] }], mediciones: [{ id: 'bruto', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/muro'] }, { id: 'vano-p', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/puerta'], signo: -1 }, { id: 'vano-v', partida: 'Muro M1', metodo: 'area', fuentes: ['elev/ventana'], signo: -1 }, { id: 'vanos', partida: 'Vanos', metodo: 'conteo', fuentes: ['elev/puerta', 'elev/ventana'] }], elementos_fisicos: [{ id: 'M1', tipo: 'muro', fuentes: ['elev/muro'] }, { id: 'P1', tipo: 'puerta', fuentes: ['elev/puerta'] }, { id: 'V1', tipo: 'ventana', fuentes: ['elev/ventana'] }] };
  try {
    await s.T('tannia_proyecto_crear', { nombre: P });
    const e = await s.hasta(data(await s.T('tannia_trabajos', { accion: 'crear', proyecto: P, tipo: 'cubicaciones', especificacion, asignaciones: [{ partida: 'Muro M1', codigo: 'M-01' }, { partida: 'Vanos', codigo: 'V-01' }] })).trabajo);
    assert.equal(e.estado_interno, 'TERMINADO', JSON.stringify(e).slice(0, 600)); assert.match(e.mensaje_para_la_persona, /^Los planos y las cubicaciones de «Edificio BG» están listos para revisión\. Falta comprobar el archivo DWG en AutoCAD\.$/);
    const ps = Object.fromEntries(data(await s.T('tannia_partidas_listar', { proyecto: P })).partidas.map((p) => [p.codigo, p.cantidad]));
    assert.ok(Math.abs(ps['M-01'] - (6 * 2.4 - 0.9 * 2.0 - 1.2 * 1.0)) < 1e-9); assert.equal(ps['V-01'], 2);
  } finally { await s.close(); }
});
