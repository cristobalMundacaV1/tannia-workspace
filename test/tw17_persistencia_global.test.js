// TW09-01: la persistencia no puede certificarse con contradicciones globales (caso real: 51 entidades antes y 0 tras reabrir
// con SHA idéntico). Servidor COM simulado con interruptores; cada defecto debe producir un estado NO "verificada".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AutoCadCom, comprobarGlobal, REINTENTO_SEGURO, SIN_DOCUMENTO_PREVIO, buildScript } from '../src/cad/autocad_com.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { servidorSimulado } from './helpers_com.js';
import { tmpHome } from './helpers.js';

function entorno() {
  const home = tmpHome("Tannia ñ 'pers "); const sb = new Sandbox(home); createProject(sb, 'P'); const root = path.join(home, 'Proyectos', 'P');
  const dir = path.join(root, '03 Trabajo', 'Modelos3D', 'M'); fs.mkdirSync(dir, { recursive: true }); const dwg = path.join(dir, 'v001_3D.dwg'); fs.writeFileSync(dwg, Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(3000, 5)]));
  fs.writeFileSync(path.join(root, '02 Originales', 'o.dwg'), 'ORIGINAL');
  return { home, sb, root, dwg, rel: '03 Trabajo/Modelos3D/M/v001_3D.dwg', done: () => fs.rmSync(home, { recursive: true, force: true }) };
}
const solidos = (n) => Array.from({ length: n }, (_, i) => ({ tipo: 'AcDb3dSolid', capa: i % 2 ? 'TW3D_MURO_INT' : 'TW3D_MURO_EXT', props: { Volume: 1e9 + i, Centroid: [i * 100, 0, 1000], BBoxMin: [i * 100 - 50, -50, 0], BBoxMax: [i * 100 + 50, 50, 2000] } }));
const textoNota = { tipo: 'AcDbText', capa: 'TW3D_NOTAS', props: { TextString: 'n', InsertionPoint: [0, 0, 0], Height: 200, Alignment: 0 } };
const ents = [...solidos(50), textoNota];
const com = (e, o = {}) => new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(ents, { activePath: e.dwg, ...o }) });

test('REPRODUCCIÓN del caso real: 51 entidades antes y 0 tras reabrir con SHA idéntico NUNCA es "verificada"', async () => {
  const e = entorno();
  try {
    const r = await com(e, { reaperturaConteoCero: true }).verificarPersistencia('P', { archivo: e.rel });
    assert.equal(r.archivo_en_disco.sin_cambios_por_el_cierre_y_reapertura, true, 'el SHA es idéntico (como en el ensayo real)');
    assert.equal(r.entidades_leidas, 51); assert.equal(r.entidades_tras_reabrir, 0);
    assert.equal(r.persistencia, 'fallida'); assert.equal(r.verificacion_global.estado, 'fallida');
    const tipos = r.verificacion_global.problemas.map((p) => p.problema); assert.ok(tipos.includes('reapertura_sin_entidades') && tipos.includes('conteo_global_distinto') && tipos.includes('handles_ausentes_tras_reabrir'));
    assert.match(r.aviso, /NO prueba la persistencia/);
    // también con un subconjunto de handles: el conteo global manda
    const sub = await com(e, { reaperturaConteoCero: true }).verificarPersistencia('P', { archivo: e.rel, handles: ['100', '101'] }); assert.equal(sub.persistencia, 'fallida');
    // el caso sano sigue verificándose, ahora con evidencia global
    const ok = await com(e).verificarPersistencia('P', { archivo: e.rel }); assert.equal(ok.persistencia, 'verificada'); assert.deepEqual(ok.verificacion_global.conteos, { antes_resumen: 51, antes_enumerado: 51, despues_reapertura: 51, despues_resumen: 51, despues_enumerado: 51 });
    assert.equal(ok.verificacion_global.documento_identico, true); assert.equal(ok.verificacion_global.handles.ausentes + ok.verificacion_global.handles.nuevos, 0);
  } finally { e.done(); }
});

test('persistencia: entidad nueva fuera de la lista previa, handle perdido, otro documento reabierto y conteo por capa se detectan en ambos sentidos', async () => {
  const e = entorno();
  try {
    const nueva = await com(e, { alReabrir: (x) => [...x, { tipo: 'AcDbLine', capa: 'TW3D_EXTRA', props: { StartPoint: [0, 0, 0], EndPoint: [1, 0, 0], Length: 1 }, handle: 'ABCD' }] }).verificarPersistencia('P', { archivo: e.rel });
    assert.equal(nueva.persistencia, 'fallida'); assert.ok(nueva.verificacion_global.problemas.some((p) => p.problema === 'handles_nuevos_tras_reabrir'));
    assert.ok(nueva.verificacion_global.problemas.some((p) => p.problema === 'conteo_por_capa_distinto'));
    const perdida = await com(e, { alReabrir: (x) => x.filter((_, i) => i !== 7) }).verificarPersistencia('P', { archivo: e.rel }); assert.equal(perdida.persistencia, 'fallida'); assert.ok(perdida.verificacion_global.problemas.some((p) => p.problema === 'handles_ausentes_tras_reabrir'));
    await assert.rejects(() => com(e, { rutaReabierta: path.join(e.root, '03 Trabajo', 'otro.dwg') }).verificarPersistencia('P', { archivo: e.rel }), (x) => x.code === 'DOCUMENTO_REABIERTO_DISTINTO', 'otro documento tras reabrir: falla explícita, no se lee');
    const g = comprobarGlobal({ resumenAntes: { entidades: 3 }, todosAntes: [{ handle: 'A' }, { handle: 'B' }, { handle: 'C' }], resumenDespues: {}, todosDespues: [{ handle: 'A' }, { handle: 'B' }, { handle: 'C' }], cierre: { entidades: 3 }, rutaEsperada: 'C:\\a.dwg', rutaDespues: 'c:\\A.dwg' });
    assert.equal(g.estado, 'no_concluyente', 'un conteo no informado no se da por bueno'); assert.equal(g.documento_identico, true, 'rutas equivalentes en Windows (mayúsculas)');
  } finally { e.done(); }
});

test('persistencia a gran escala (2000 entidades) y textos Unicode conservan el gate global', async () => {
  const e = entorno();
  try {
    const grande = [...solidos(2000), { tipo: 'AcDbText', capa: 'TW3D_NOTAS', props: { TextString: 'BAÑO ñandú', InsertionPoint: [0, 0, 0], Height: 200, Alignment: 0 } }];
    const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(grande, { activePath: e.dwg, maxHandles: 160 }) });
    const r = await c.verificarPersistencia('P', { archivo: e.rel }); assert.equal(r.persistencia, 'verificada'); assert.equal(r.verificacion_global.conteos.despues_enumerado, 2001);
    const mal = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(grande, { activePath: e.dwg, maxHandles: 160, reaperturaConteoCero: true }) });
    assert.equal((await mal.verificarPersistencia('P', { archivo: e.rel })).persistencia, 'fallida');
  } finally { e.done(); }
});

test('ciclo COM: cero documentos, lecturas por ruta, reintentos solo en lecturas y originales intactos', async () => {
  const e = entorno();
  try {
    // AutoCAD abierto sin ningún dibujo: el estado lo informa y las operaciones sobre el dibujo se niegan con un código claro
    const vacio = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado([], { activePath: null, sinDocumento: true }) });
    const st = await vacio.estadoSeguro(); assert.equal(st.sin_documento, true); assert.equal(st.documentos, 0); assert.equal(st.ubicacion_documento.clase, 'sin_documento'); assert.equal(st.ruta, undefined);
    for (const f of [() => vacio.verificarPersistencia('P', { archivo: e.rel }), () => vacio.vista3d('P', {}), () => vacio.inspeccionarSolidos('P', {}), () => vacio.transformarSolido('P', { handle: 'A1', operacion: 'mover' })]) await assert.rejects(f, (x) => x.code === 'AUTOCAD_SIN_DOCUMENTO');
    // las lecturas viajan con la ruta esperada: se resuelve el documento por ruta, no por "activo"
    const calls = []; const c = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(ents, { activePath: e.dwg, calls }) });
    await c.verificarPersistencia('P', { archivo: e.rel });
    const lecturas = calls.filter((x) => ['leer_lote', 'enumerar', 'resumen'].includes(x.name)); assert.ok(lecturas.length >= 6 && lecturas.every((x) => x.input.ruta_esperada === e.dwg), 'todas las lecturas indican la ruta del documento');
    const cierre = calls.find((x) => x.name === 'cerrar_reabrir').input; assert.equal(cierre.esperadas, 51);
    // los scripts que crean o abren dibujos no exigen documento previo; los de lectura/escritura sí lo resuelven
    assert.deepEqual([...SIN_DOCUMENTO_PREVIO].sort(), ['abrir_copia', 'construir_3d', 'dxf_a_dwg', 'estado']);
    assert.ok(!buildScript('construir_3d').includes("codigo = 'SIN_DOCUMENTO'") && buildScript('leer_lote').includes("codigo = 'SIN_DOCUMENTO'") && buildScript('leer_lote').includes('ruta_esperada'));
    // reintento seguro: una escritura con AutoCAD ocupado NO se repite; una lectura sí
    let intentos = 0; const ocupado = JSON.stringify({ ok: false, etapa: 'x', hresult: '0x8001010A' });
    const w = new AutoCadCom({ sandbox: e.sb, platform: 'win32', sleep: async () => {}, runner: async () => { intentos++; return ocupado; } });
    await assert.rejects(() => w.construir3d('P', { dwgRel: '03 Trabajo/Modelos3D/M/v9_3D.dwg', primitivas: [{ id: 'S1', capa: 'TW3D_LOSA', tipo: 'caja', esperado: {} }], capas: [], nota: 'n' })); assert.equal(intentos, 1, 'construir_3d no se reintenta');
    intentos = 0; await assert.rejects(() => w.estado()); assert.equal(intentos, 3, 'una lectura se reintenta (1 + 2)');
    assert.ok(REINTENTO_SEGURO.has('leer_lote') && !REINTENTO_SEGURO.has('agregar_lineas') && !REINTENTO_SEGURO.has('transformar_solido') && !REINTENTO_SEGURO.has('cerrar_reabrir'));
    assert.equal(fs.readFileSync(path.join(e.root, '02 Originales', 'o.dwg'), 'utf8'), 'ORIGINAL');
  } finally { e.done(); }
});
