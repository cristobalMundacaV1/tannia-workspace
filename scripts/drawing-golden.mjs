// Regenera las firmas golden de PL-VISUAL-01. SOLO tras revisar visualmente los PNG nuevos: el cambio del golden es una aprobación.
// Uso: node scripts/drawing-golden.mjs [--png carpeta]   (escribe test/fixtures_drawing/golden_firmas.json)
import fs from 'node:fs'; import path from 'node:path';
import { tunnelModel, compose } from '../src/drawing/model.js';
import { modeloDesdeEspecificacion, muroConVanoEspecificacion } from '../src/drawing/especificacion.js';
import { buildIR } from '../src/drawing/ir.js'; import { buildSheetsPdf } from '../src/drawing/pdf.js'; import { renderPdf } from '../src/drawing/render.js';
import { firmaRaster } from '../src/drawing/golden.js';
const F = { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 };
const casos = { tunel: () => tunnelModel({ length: 150, width: 5.5, wall: 2.5, selected: 0.08, fortificacion: F }), edi: () => modeloDesdeEspecificacion(muroConVanoEspecificacion()) };
const i = process.argv.indexOf('--png'); const dirPng = i > 0 ? process.argv[i + 1] : null; const out = {};
for (const [n, crear] of Object.entries(casos)) {
  const c = compose(crear()); const ir = buildIR(c); const pdf = await buildSheetsPdf(c, null, { ir });
  out[n] = (await renderPdf(pdf, { dpi: 72, pixels: true })).map((p) => firmaRaster(p.pixels));
  if (dirPng) { fs.mkdirSync(dirPng, { recursive: true }); for (const p of await renderPdf(pdf, { dpi: 110 })) fs.writeFileSync(path.join(dirPng, `${n}-lamina-${p.page}.png`), p.png); fs.writeFileSync(path.join(dirPng, `${n}.pdf`), pdf); }
}
fs.writeFileSync(path.join(import.meta.dirname, '..', 'test', 'fixtures_drawing', 'golden_firmas.json'), JSON.stringify(out));
console.log('golden escrito:', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
