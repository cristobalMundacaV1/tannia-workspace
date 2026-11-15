import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Sandbox, SecurityError, validateRelative, sha256File } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';

function setup() {
  const home = tmpHome();
  const sb = new Sandbox(home);
  createProject(sb, 'Obra Ñuñoa');
  return { home, sb, root: path.join(home, 'Proyectos', 'Obra Ñuñoa') };
}
const code = (fn) => { try { fn(); } catch (e) { return e instanceof SecurityError ? e.code : `OTRO:${e.message}`; } return 'SIN_ERROR'; };

test('rutas maliciosas rechazadas (traversal, absolutas, UNC, ADS, reservados)', () => {
  const { sb, home } = setup();
  const bad = ['../x', 'a/../../x', '..\\x', '/etc/passwd', '\\\\server\\share\\x', 'C:\\x', 'c:/x', 'a.dxf:stream', 'CON', 'nul.txt', 'a\0b', 'a/b?.dxf', 'arch. '];
  for (const b of bad) assert.notEqual(code(() => sb.resolve('Obra Ñuñoa', b, { mustExist: false })), 'SIN_ERROR', JSON.stringify(b));
  assert.equal(code(() => validateRelative('')), 'RUTA_INVALIDA');
  fs.rmSync(home, { recursive: true, force: true });
});

test('symlink hacia fuera del proyecto es rechazado', (t) => {
  const { sb, home, root } = setup();
  const outside = path.join(home, 'secreto.txt');
  fs.writeFileSync(outside, 'secreto');
  try { fs.symlinkSync(outside, path.join(root, '03 Trabajo', 'enlace.txt')); fs.symlinkSync(home, path.join(root, '03 Trabajo', 'dir')); }
  catch { t.skip('symlinks no disponibles'); return; }
  assert.equal(code(() => sb.resolve('Obra Ñuñoa', '03 Trabajo/enlace.txt')), 'RUTA_FUERA_DEL_PROYECTO');
  assert.equal(code(() => sb.resolve('Obra Ñuñoa', '03 Trabajo/dir/secreto.txt')), 'RUTA_FUERA_DEL_PROYECTO');
  assert.equal(code(() => sb.resolve('Obra Ñuñoa', '03 Trabajo/dir/nuevo.txt', { mustExist: false })), 'RUTA_FUERA_DEL_PROYECTO');
  fs.rmSync(home, { recursive: true, force: true });
});

test('proyecto enlazado fuera de Proyectos y carpetas no-proyecto rechazados', (t) => {
  const { sb, home } = setup();
  fs.mkdirSync(path.join(home, 'Proyectos', 'Falso'));
  assert.equal(code(() => sb.projectRoot('Falso')), 'PROYECTO_NO_AUTORIZADO');
  assert.equal(code(() => sb.projectRoot('../Obra Ñuñoa')), 'PROYECTO_INVALIDO');
  const ext = path.join(home, 'externo'); fs.mkdirSync(path.join(ext, '.tannia'), { recursive: true }); fs.writeFileSync(path.join(ext, '.tannia', 'project.json'), '{}');
  try { fs.symlinkSync(ext, path.join(home, 'Proyectos', 'Enlazado')); } catch { t.skip('symlinks'); return; }
  assert.equal(code(() => sb.projectRoot('Enlazado')), 'RUTA_FUERA_DEL_PROYECTO');
  fs.rmSync(home, { recursive: true, force: true });
});

test('escritura: originales y antecedentes denegados; trabajo permitido', () => {
  const { sb, home } = setup();
  assert.equal(code(() => sb.resolveWritable('Obra Ñuñoa', '02 Originales/plano.dxf')), 'ORIGINAL_PROTEGIDO');
  assert.equal(code(() => sb.resolveWritable('Obra Ñuñoa', '02 Originales/sub/otro.dxf')), 'ORIGINAL_PROTEGIDO');
  assert.equal(code(() => sb.resolveWritable('Obra Ñuñoa', '01 Antecedentes/a.pdf')), 'ESCRITURA_NO_PERMITIDA');
  assert.equal(code(() => sb.resolveWritable('Obra Ñuñoa', '.tannia/project.json')), 'ESCRITURA_NO_PERMITIDA');
  assert.equal(code(() => sb.resolveWritable('Obra Ñuñoa', '03 Trabajo/copia.dxf')), 'SIN_ERROR');
  fs.rmSync(home, { recursive: true, force: true });
});

test('sha256File estable', () => {
  const { home } = setup();
  const f = path.join(home, 'a.bin'); fs.writeFileSync(f, 'hola');
  assert.equal(sha256File(f), 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79');
  fs.rmSync(home, { recursive: true, force: true });
});
