// Auditoría PR #11 — P1: identidad documental COM. Con `ruta_esperada` se localiza exactamente ese documento o se FALLA; nunca se
// recurre a ActiveDocument. Defensa en profundidad: Node exige que la respuesta confirme la ruta del documento leído.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AutoCadCom, buildScript, PS_DOC } from '../src/cad/autocad_com.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { servidorSimulado, servidorMultiDoc } from './helpers_com.js';
import { tmpHome } from './helpers.js';

function entorno() {
  const home = tmpHome("Tannia ñ 'ident "); const sb = new Sandbox(home); createProject(sb, 'P'); const root = path.join(home, 'Proyectos', 'P'); const dir = path.join(root, '03 Trabajo', 'Modelos3D', 'M'); fs.mkdirSync(dir, { recursive: true });
  const A = path.join(dir, 'A_3D.dwg'); const B = path.join(dir, 'B_3D.dwg'); for (const f of [A, B]) fs.writeFileSync(f, Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(3000, 9)]));
  fs.writeFileSync(A.replace('.dwg', '.dxf'), '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n');
  return { home, sb, root, A, B, relA: '03 Trabajo/Modelos3D/M/A_3D.dwg', relB: '03 Trabajo/Modelos3D/M/B_3D.dwg', done: () => fs.rmSync(home, { recursive: true, force: true }) };
}
// Dos dibujos con LOS MISMOS handles y el MISMO conteo (coincidencia accidental) pero contenido distinto (volúmenes)
const dibujo = (vol) => [...Array.from({ length: 12 }, (_, i) => ({ tipo: 'AcDb3dSolid', capa: i % 2 ? 'TW3D_MURO_INT' : 'TW3D_MURO_EXT', props: { Volume: vol + i, Centroid: [i * 100, 0, 1000], BBoxMin: [i * 100 - 50, -50, 0], BBoxMax: [i * 100 + 50, 50, 2000] } })), { tipo: 'AcDbText', capa: 'TW3D_NOTAS', props: { TextString: 'n', InsertionPoint: [0, 0, 0], Height: 200, Alignment: 0 } }];
const prims = (vol) => dibujo(vol).slice(0, 12).map((e, i) => ({ id: `S${i + 1}`, capa: e.capa, esperado: { volumen: e.props.Volume, centroide: e.props.Centroid, bbox_min: e.props.BBoxMin, bbox_max: e.props.BBoxMax } }));
const com = (e, runner) => new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner });

test('contrato del script: con ruta_esperada se localiza el documento o se falla; la rama con ruta NO contiene ActiveDocument', () => {
  const [conRuta, sinRuta] = PS_DOC.split('} else {');
  assert.ok(conRuta.includes('ruta_esperada') && conRuta.includes("codigo = 'DOCUMENTO_NO_ABIERTO'") && conRuta.includes('exit 0'), 'falla explícitamente si no está abierto');
  assert.ok(!/ActiveDocument/.test(conRuta), 'jamás recurre al documento activo cuando se indicó una ruta');
  assert.ok(/ActiveDocument/.test(sinRuta), 'sin ruta se usa el activo (comportamiento documentado)');
  for (const n of ['leer_lote', 'enumerar', 'resumen', 'listar', 'medir', 'vista_3d', 'transformar_solido', 'cerrar_reabrir', 'agregar_lineas']) { const s = buildScript(n); assert.ok(s.includes(conRuta.trim().slice(0, 40)), `${n} resuelve el documento por ruta`); }
  for (const n of ['construir_3d', 'dxf_a_dwg', 'estado']) assert.ok(!buildScript(n).includes('localizar_documento'), `${n} no exige documento previo`);
});

test('defensa en Node: si el script devolviera datos de OTRO documento (defecto antiguo), todas las verificaciones fallan con DOCUMENTO_DISTINTO', async () => {
  const e = entorno();
  try {
    // activo = B; se pide A; el "PowerShell defectuoso" ignora la ruta y lee B (mismos handles y mismo conteo que A)
    const defectuoso = servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9), [e.B]: dibujo(2e9) }, activo: e.A, ignorarRuta: true });
    const c = com(e, defectuoso);
    // El documento ACTIVO es A (por eso pasa #copiaActiva); luego el defecto lee desde B tras un "cambio de foco"
    const nuevoCambiaFoco = () => { let focos = 0; return servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9), [e.B]: dibujo(2e9) }, activo: e.A, ignorarRuta: true, alLlamar: (n, _i, st) => { if (n !== 'estado' && ++focos === 1) st.activo = e.B; } }); };
    for (const f of [
      () => com(e, nuevoCambiaFoco()).verificarPersistencia('P', { archivo: e.relA }), () => com(e, nuevoCambiaFoco()).verificarSolidos('P', { dwgRel: e.relA, primitivas: prims(1e9) }),
      () => com(e, nuevoCambiaFoco()).verificarDwg('P', { dxfRel: e.relA.replace('.dwg', '.dxf'), dwgRel: e.relA }), () => com(e, nuevoCambiaFoco()).inspeccionarSolidos('P', {}),
    ]) await assert.rejects(f, (x) => x.code === 'DOCUMENTO_DISTINTO', 'rechaza datos de otro documento');
    void c;
    // respuesta sin confirmación de ruta: tampoco se acepta
    const sinEco = async (script, input) => { const r = JSON.parse(await servidorSimulado(dibujo(1e9), { activePath: e.A })(script, input)); if (r.data && !('progid' in r.data)) delete r.data.ruta; return JSON.stringify(r); };
    await assert.rejects(() => com(e, sinEco).verificarPersistencia('P', { archivo: e.relA }), (x) => x.code === 'DOCUMENTO_NO_CONFIRMADO');
  } finally { e.done(); }
});

test('dos dibujos abiertos con handles y conteos idénticos: cada verificación lee el documento pedido, aunque el foco cambie', async () => {
  const e = entorno();
  try {
    const llamadas = [];
    const srv = servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9), [e.B]: dibujo(2e9) }, activo: e.A, alLlamar: (n, i, st) => { llamadas.push([n, i?.ruta_esperada ?? null, st.activo]); } });
    // A activo y se verifica A: correcto
    assert.equal((await com(e, srv).verificarSolidos('P', { dwgRel: e.relA, primitivas: prims(1e9) })).estado, 'fiel');
    // el foco cambia a B en mitad de la verificación (usuaria cambia de ventana): las lecturas siguen yendo a A por ruta
    const srv2 = servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9), [e.B]: dibujo(2e9) }, activo: e.A, alLlamar: (n, _i, st) => { if (n === 'enumerar') st.activo = e.B; } });
    const r = await com(e, srv2).verificarSolidos('P', { dwgRel: e.relA, primitivas: prims(1e9) }); assert.equal(r.estado, 'fiel', 'sigue leyendo A pese al cambio de foco');
    // con las primitivas de B contra A los volúmenes difieren: la lectura es realmente de A
    const mal = await com(e, servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9), [e.B]: dibujo(2e9) }, activo: e.A })).verificarSolidos('P', { dwgRel: e.relA, primitivas: prims(2e9) }); assert.equal(mal.estado, 'con_diferencias');
    // persistencia de A con B abierto y activo después de reabrir (la reapertura no activa nada): lee A por ruta
    const srv3 = servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9), [e.B]: dibujo(2e9) }, activo: e.A, alLlamar: (n, _i, st) => { if (n === 'cerrar_reabrir') st.activo = e.B; } });
    const p = await com(e, srv3).verificarPersistencia('P', { archivo: e.relA }); assert.equal(p.persistencia, 'verificada'); assert.equal(p.verificacion_global.documento_identico, true);
    assert.ok(llamadas.filter(([n]) => ['leer_lote', 'enumerar', 'resumen'].includes(n)).every(([, ruta]) => ruta === e.A), 'toda lectura indica su ruta');
  } finally { e.done(); }
});

test('dibujo esperado cerrado (o nunca abierto): falla explícita DOCUMENTO_NO_ABIERTO sin leer nada del otro dibujo', async () => {
  const e = entorno();
  try {
    const leyo = []; const srv = servidorMultiDoc({ abiertos: { [e.B]: dibujo(2e9) }, activo: e.B, alLlamar: (n, i) => { if (['leer_lote', 'enumerar', 'resumen'].includes(n)) leyo.push(i?.ruta_esperada); } });
    // el activo es B, se pide A (cerrado): #copiaActiva ya lo rechaza; y si se saltara, las lecturas por ruta fallan
    await assert.rejects(() => com(e, srv).verificarSolidos('P', { dwgRel: e.relA, primitivas: prims(1e9) }), (x) => x.code === 'DOCUMENTO_ACTIVO_DISTINTO');
    // A se cierra justo después de la comprobación del activo (carrera): la primera lectura por ruta falla explícitamente
    let cerrado = false; const carrera = servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9), [e.B]: dibujo(2e9) }, activo: e.A, alLlamar: (n, _i, st) => { if (n === 'resumen' && !cerrado) { cerrado = true; st.abiertos.delete(e.A); } } });
    await assert.rejects(() => com(e, carrera).verificarSolidos('P', { dwgRel: e.relA, primitivas: prims(1e9) }), (x) => x.code === 'DOCUMENTO_NO_ABIERTO');
    await assert.rejects(() => com(e, servidorMultiDoc({ abiertos: { [e.A]: dibujo(1e9) }, activo: e.A, alLlamar: (n, _i, st) => { if (n === 'cerrar_reabrir') st.abiertos.delete(e.A); } })).verificarPersistencia('P', { archivo: e.relA }), (x) => ['DOCUMENTO_NO_ABIERTO', 'REAPERTURA_FALLIDA'].includes(x.code));
    assert.deepEqual(leyo, [], 'no se leyó nada de B pese a ser el activo');
  } finally { e.done(); }
});
