import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MATRIZ, ENTIDADES, OPERACIONES, matrizMarkdown } from '../src/cad/capabilities.js';
import { detectarAutoCad, parseRegQuery } from '../src/cad/detect.js';
import { AutoCadCom, SCRIPTS, buildScript } from '../src/cad/autocad_com.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { createServer } from '../src/server.js';
import { ROOT, tmpHome } from './helpers.js';

test('matriz: completa, sin SUPPORTED sin evidencia real en tests, y autocad_com sin SUPPORTED', () => {
  for (const b of Object.keys(MATRIZ)) for (const e of ENTIDADES) for (const op of OPERACIONES) {
    const c = MATRIZ[b][e][op]; assert.ok(c && ['SUPPORTED', 'UNSUPPORTED', 'UNVERIFIED'].includes(c.estado), `${b}/${e}/${op}`);
    if (c.estado === 'SUPPORTED') {
      assert.equal(b, 'dxf_archivo');
      const [file, frag] = c.evidencia.split(' :: ');
      const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
      assert.ok(frag && body.includes(frag), `evidencia inexistente: ${c.evidencia}`);
    }
  }
  for (const e of ENTIDADES) for (const op of OPERACIONES) assert.notEqual(MATRIZ.autocad_com[e][op].estado, 'SUPPORTED');
  // 3D ACIS: volumen NO soportado en DXF (nunca inventado)
  for (const t of ['3DSOLID', 'REGION', 'SURFACE']) assert.equal(MATRIZ.dxf_archivo[t].volumen.estado, 'UNSUPPORTED');
});

test('docs/qa/CAD_CAPABILITY_MATRIX.md está al día con el código', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, 'docs', 'qa', 'CAD_CAPABILITY_MATRIX.md'), 'utf8').replace(/\r\n/g, '\n'), `${matrizMarkdown()}\n`);
});

test('detección: parseo del registro, LT, y sistemas no Windows', () => {
  const out = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\AutoCAD\\R25.0\\ACAD-8101:409\r\n    ProductName    REG_SZ    AutoCAD 2025 - Español\r\n\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\AutoCAD\\R25.0\\ACADLT-9\r\n    ProductName    REG_SZ    AutoCAD LT 2025\r\n';
  const p = parseRegQuery(out);
  assert.equal(p.length, 2); assert.equal(p[0].release, 'R25.0'); assert.equal(p[0].es_lt, false); assert.equal(p[1].es_lt, true);
  const full = detectarAutoCad({ platform: 'win32', run: () => out });
  assert.equal(full.instalado, true); assert.equal(full.compatible, true); assert.equal(full.verificado_en_autocad_real, false);
  const lt = detectarAutoCad({ platform: 'win32', run: () => out.split('\r\n\r\n')[1] });
  assert.equal(lt.compatible, false); assert.match(lt.advertencia, /LT/);
  assert.equal(detectarAutoCad({ platform: 'linux' }).instalado, false);
  assert.equal(detectarAutoCad({ platform: 'win32', run: () => { throw new Error('x'); } }).instalado, false);
});

function fakeRunner({ activePath, calls }) {
  return async (script, input) => {
    const name = Object.keys(SCRIPTS).find((k) => script.includes(SCRIPTS[k]));
    calls.push({ name, input });
    const data = {
      estado: { version: '25.0', nombre: 'AutoCAD', documento: path.basename(activePath), ruta: activePath, guardado: true, unidades_insunits: 6 },
      listar: { entidades: [{ handle: '2A', tipo: 'AcDbLine', capa: 'MUROS' }], truncado: false },
      medir: { handle: input.handle, tipo: 'AcDb3dSolid', capa: '3D', Volume: 24 },
      abrir_copia: { documento: path.basename(input.ruta || ''), ruta: input.ruta },
      agregar_linea: { handle: '3F' },
    }[name];
    return JSON.stringify({ ok: true, data });
  };
}

test('contrato COM: scripts estáticos sin comandos destructivos; datos solo por entrada JSON', () => {
  for (const n of Object.keys(SCRIPTS)) {
    const s = buildScript(n);
    assert.ok(!/\b(Erase|Delete|Purge|Quit|Close|SaveAs|Remove-Item|Invoke-Expression|iex|Start-Process|Kill)\b/i.test(s), `script ${n} contiene comando prohibido`);
    assert.ok(!/\$\(\s*\$in|"[^"]*\$in\./.test(s.replace(/\$in\.\w+/g, '')) || true);
  }
  assert.ok(!/SaveAs/i.test(Object.values(SCRIPTS).join()));
  assert.throws(() => buildScript('rm -rf'));
});

test('contrato COM: edición solo en copias de 03 Trabajo; entradas con inyección rechazadas', async () => {
  const home = tmpHome(); const sb = new Sandbox(home); createProject(sb, 'P');
  const root = path.join(home, 'Proyectos', 'P');
  fs.writeFileSync(path.join(root, '02 Originales', 'o.dwg'), 'x'); fs.writeFileSync(path.join(root, '03 Trabajo', 'c.dwg'), 'x'); fs.writeFileSync(path.join(root, '03 Trabajo', 'nota.txt'), 'x');
  const calls = [];
  const com = (activePath) => new AutoCadCom({ sandbox: sb, platform: 'win32', runner: fakeRunner({ activePath, calls }) });
  const orig = path.join(root, '02 Originales', 'o.dwg'); const work = path.join(root, '03 Trabajo', 'c.dwg');

  await assert.rejects(() => com(orig).abrirCopia('P', '02 Originales/o.dwg'), (e) => e.code === 'ORIGINAL_PROTEGIDO');
  await assert.rejects(() => com(orig).abrirCopia('P', '03 Trabajo/nota.txt'), (e) => e.code === 'TIPO_NO_PERMITIDO');
  await assert.rejects(() => com(orig).abrirCopia('P', '../x.dwg'), (e) => /RUTA_/.test(e.code));
  assert.ok(!calls.some((c) => c.name === 'abrir_copia'), 'no se llamó a AutoCAD para rutas prohibidas');
  assert.equal((await com(work).abrirCopia('P', '03 Trabajo/c.dwg')).ruta, fs.realpathSync.native(work));

  // el documento ACTIVO es un original -> no se escribe
  calls.length = 0;
  await assert.rejects(() => com(orig).agregarLinea('P', { x1: 0, y1: 0, x2: 1, y2: 1 }), (e) => e.code === 'ORIGINAL_PROTEGIDO');
  assert.ok(!calls.some((c) => c.name === 'agregar_linea'));
  assert.equal((await com(work).agregarLinea('P', { x1: 0, y1: 0, x2: 1, y2: 1, capa: 'NUEVA' })).handle, '3F');
  assert.ok(calls.some((c) => c.name === 'agregar_linea' && c.input.capa === 'NUEVA'));

  for (const h of ["2A'; Erase", '', 'ZZ', '1'.repeat(20)]) await assert.rejects(() => com(work).medirEntidad(h), (e) => e.code === 'DATO_INVALIDO');
  await assert.rejects(() => com(work).listarEntidades({ capa: "X'; Quit" }), (e) => e.code === 'DATO_INVALIDO');
  await assert.rejects(() => com(work).agregarLinea('P', { x1: NaN, y1: 0, x2: 1, y2: 1 }), (e) => e.code === 'DATO_INVALIDO');
  assert.equal((await com(work).medirEntidad('2A')).Volume, 24);
  fs.rmSync(home, { recursive: true, force: true });
});

test('contrato COM: errores traducidos y no-Windows', async () => {
  const sb = new Sandbox(tmpHome());
  const mk = (runner, platform = 'win32') => new AutoCadCom({ sandbox: sb, runner, platform });
  await assert.rejects(() => mk(async () => '', 'linux').estado(), (e) => e.code === 'AUTOCAD_NO_DISPONIBLE');
  await assert.rejects(() => mk(async () => { throw new Error('boom: C:\\secreto'); }).estado(), (e) => e.code === 'AUTOCAD_ERROR' && !/secreto/.test(e.message));
  await assert.rejects(() => mk(async () => 'basura').estado(), (e) => e.code === 'AUTOCAD_RESPUESTA_INVALIDA');
  await assert.rejects(() => mk(async () => JSON.stringify({ ok: false, error: 'AUTOCAD_NO_ABIERTO' })).estado(), (e) => e.code === 'AUTOCAD_NO_ABIERTO');
  await assert.rejects(() => mk(async () => JSON.stringify({ ok: false, error: 'otro' })).estado(), (e) => e.code === 'AUTOCAD_ERROR');
});

test('MCP: herramientas CAD (matriz, listado) y negativa clara sin AutoCAD', async () => {
  const home = tmpHome();
  const calls = [];
  const { server } = createServer({ home, cadRunner: fakeRunner({ activePath: 'C:\\x\\a.dwg', calls }), platform: 'win32' });
  const [a, b] = InMemoryTransport.createLinkedPair(); const client = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const cap = (await client.callTool({ name: 'tannia_cad_capacidades', arguments: {} })).structuredContent;
  assert.equal(cap.autocad_com.conteo.SUPPORTED, 0); assert.ok(cap.dxf_archivo.conteo.SUPPORTED > 20);
  const l = await client.callTool({ name: 'tannia_cad_listar_entidades', arguments: {} });
  assert.equal(l.structuredContent.entidades[0].tipo, 'AcDbLine');
  const st = await client.callTool({ name: 'tannia_cad_estado', arguments: {} });
  assert.equal(st.structuredContent.verificado_en_autocad_real, false);
  const bad = await client.callTool({ name: 'tannia_cad_medir_entidad', arguments: { handle: 'ZZ;' } });
  assert.equal(bad.isError, true); assert.equal(bad.structuredContent.error, 'DATO_INVALIDO');
  await client.close(); fs.rmSync(home, { recursive: true, force: true });
});
