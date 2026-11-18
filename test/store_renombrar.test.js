// CI Windows (BG-R01): rename del registro de un trabajo falló con EPERM mientras otro proceso lo leía. Reintento acotado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome } from './helpers.js';
import { renombrarConReintento, atomicWriteJson } from '../src/project/store.js';

test('renombrarConReintento: EPERM/EACCES/EBUSY transitorios se reintentan; otros errores y bloqueos persistentes se propagan', () => {
  const dir = tmpHome('ren '); const a = path.join(dir, 'a.tmp'); const b = path.join(dir, 'b.json'); const real = fs.renameSync;
  try {
    for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
      fs.writeFileSync(a, code); let fallos = 2; fs.renameSync = (x, y) => { if (fallos-- > 0) throw Object.assign(new Error(code), { code }); return real(x, y); };
      renombrarConReintento(a, b); assert.equal(fs.readFileSync(b, 'utf8'), code);
    }
    fs.writeFileSync(a, 'x'); fs.renameSync = () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); };
    assert.throws(() => renombrarConReintento(a, b), { code: 'EPERM' }, 'un bloqueo persistente no se oculta');
    fs.renameSync = () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); }; let n = 0; const orig = fs.renameSync; fs.renameSync = (...q) => { n++; return orig(...q); };
    assert.throws(() => renombrarConReintento(a, b), { code: 'ENOENT' }); assert.equal(n, 1, 'otros errores no se reintentan');
    fs.renameSync = real; let f = 1; fs.renameSync = (x, y) => { if (f-- > 0) throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); return real(x, y); };
    atomicWriteJson(path.join(dir, 'reg.json'), { ok: 1 }, { raiz: dir }); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'reg.json'), 'utf8')), { ok: 1 });
  } finally { fs.renameSync = real; }
});
