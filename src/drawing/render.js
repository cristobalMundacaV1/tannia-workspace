// Raster QA is evidence in addition to, never a substitute for, physical/vector checks.
import { UserError } from '../mcp/util.js';
export async function renderPdf(buffer, { dpi = 144 } = {}) {
  if (!Number.isFinite(dpi) || dpi < 72 || dpi > 300) throw new UserError('DPI_INVALIDO', 'Resolución de revisión inválida.');
  const canvas = await import('@napi-rs/canvas');
  Object.assign(globalThis, { DOMMatrix: canvas.DOMMatrix, ImageData: canvas.ImageData, Path2D: canvas.Path2D });
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const doc = await lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n); const view = page.getViewport({ scale: dpi / 72 });
      const surface = canvas.createCanvas(Math.ceil(view.width), Math.ceil(view.height)); const context = surface.getContext('2d');
      await page.render({ canvasContext: context, viewport: view }).promise;
      const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
      let ink = 0; let edgeInk = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 230 || pixels[i + 1] < 230 || pixels[i + 2] < 230) {
          ink++; const p = i / 4; const x = p % surface.width; const y = Math.floor(p / surface.width);
          if (x < 2 || y < 2 || x >= surface.width - 2 || y >= surface.height - 2) edgeInk++;
        }
      }
      const ratio = ink / (surface.width * surface.height);
      pages.push({ page: n, png: surface.toBuffer('image/png'), qa: { ok: ratio > 0.003 && ratio < 0.5 && edgeInk === 0, inkRatio: ratio, edgeInk, width: surface.width, height: surface.height, dpi, human_review: 'PENDING' } });
    }
    return pages;
  } finally { await doc.destroy(); }
}
