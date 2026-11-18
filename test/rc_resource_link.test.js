// Revisión PR #30: los resource_link MCP solo publican archivos regulares de la carpeta del proyecto (sin escape ni enlaces) y
// cumplen la forma del contrato (type, uri file://, name, mimeType, size). Que Claude Desktop los muestre como descarga NO se afirma.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome } from './helpers.js';
import { conArchivos, ok } from '../src/mcp/util.js';

test('resource_link: forma válida y contención estricta (.., absoluta, enlace, inexistente)', () => {
  const home = tmpHome('RL ñ '); const raiz = path.join(home, 'Proyecto'); fs.mkdirSync(path.join(raiz, '07 Entregables'), { recursive: true });
  fs.writeFileSync(path.join(raiz, '07 Entregables', 'a.pdf'), '%PDF-1.4'); fs.writeFileSync(path.join(home, 'fuera.pdf'), 'x');
  try {
    const r = conArchivos(ok('x', {}), { raiz, carpeta: '07 Entregables', archivos: ['07 Entregables/a.pdf'] });
    const rl = r.content.find((c) => c.type === 'resource_link');
    assert.match(rl.uri, /^file:\/\//); assert.equal(rl.name, 'a.pdf'); assert.equal(rl.mimeType, 'application/pdf'); assert.equal(rl.size, 8);
    assert.match(r.structuredContent.entrega.vinculos_mcp, /NO VERIFICADA/);
    for (const malo of ['../fuera.pdf', path.join(home, 'fuera.pdf')]) assert.throws(() => conArchivos(ok('x', {}), { raiz, carpeta: '.', archivos: [malo] }), (e) => e.code === 'ENTREGA_FUERA_DEL_PROYECTO');
    assert.throws(() => conArchivos(ok('x', {}), { raiz, carpeta: '.', archivos: ['07 Entregables/no.pdf'] }), (e) => e.code === 'ENTREGA_ARCHIVO_INEXISTENTE');
    try { fs.symlinkSync(path.join(home, 'fuera.pdf'), path.join(raiz, '07 Entregables', 'enlace.pdf')); } catch { return; }
    assert.throws(() => conArchivos(ok('x', {}), { raiz, carpeta: '.', archivos: ['07 Entregables/enlace.pdf'] }), (e) => e.code === 'ENTREGA_FUERA_DEL_PROYECTO');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
