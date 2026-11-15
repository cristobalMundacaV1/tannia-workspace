import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMemoriaPdf } from '../src/report/memoria.js';
import { inspectPdf, openPdf } from '../src/pdf/pdf.js';
import { computeBudget } from '../src/budget/calc.js';

async function textOf(buf) {
  const { doc } = await openPdf(buf);
  let t = '';
  for (let n = 1; n <= doc.numPages; n++) t += `${(await (await doc.getPage(n)).getTextContent()).items.map((i) => i.str).join(' ')}\n`;
  return { t, pages: doc.numPages };
}

test('memoria PDF: válida, reabrible, con acentos, trazabilidad, advertencias y BORRADOR', async () => {
  const partidas = Array.from({ length: 30 }, (_, i) => ({ codigo: `${i + 1}`, descripcion: `Partida ñandú ${i + 1}`, unidad: 'm2', cantidad: 10.5 + i, estado_revision: 'needs_review', cantidad_verificada: false, formula: 'Σ áreas', fuente: { archivo: '02 Originales/plano.dxf', capas: ['LOSA'], unidad_confirmada: 'm' }, supuestos: ['espesor_m = 0.1 (dato entregado por la usuaria)'], advertencias: ['Autointersección'] }));
  const B = computeBudget({ partidas: [{ ...partidas[0], apu: 'X' }], apus: [], config: {} });
  const buf = await buildMemoriaPdf({ proyecto: 'Casa Peñalolén', generado: '2026-11-15', estado: 'borrador', partidas, presupuesto: B, archivos: [{ archivo: '02 Originales/plano.dxf', sha256: 'a'.repeat(64) }], advertencias: ['Unidad no confirmada'] });
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  const { t, pages } = await textOf(buf);
  assert.ok(pages >= 2, 'paginación');
  for (const s of ['Casa Peñalolén', 'ñandú', 'BORRADOR', 'aaaaaaaaaa', 'NEEDS_REVIEW', 'TOTAL PARCIAL', 'Unidad no confirmada', 'no es un documento final']) assert.ok(t.includes(s), s);
  assert.ok(/página 1 de/.test(t));
  const info = await inspectPdf(buf); assert.equal(info.paginas, pages);
});
