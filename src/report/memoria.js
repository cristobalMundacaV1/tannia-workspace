// Memoria de cálculo / informe PDF. Todo dato proviene del proyecto; nada se completa por inferencia.
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';

const clp = (n) => (n === null || n === undefined ? 'PENDIENTE' : `$${Math.round(n).toLocaleString('es-CL')}`);
const num = (n, d = 3) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }));

// Las fuentes PDF estándar solo cubren WinAnsi (Latin-1 + algunos signos). Se translitera lo demás para no producir texto corrupto.
const MAP = { 'Σ': 'Suma de', '×': 'x', '−': '-', '–': '-', 'π': 'pi', '≈': '~', '≤': '<=', '≥': '>=', '→': '->', '·': '·', '≠': '!=', 'Δ': 'delta', 'θ': 'theta', '∑': 'Suma de', 'ø': 'diam.', 'Ø': 'diam.' };
const WIN = new Set('—–‘’“”•…€™'.split(''));
export function latin(s) {
  return String(s).replace(/[^\u0000-\u00ff]/gu, (ch) => (MAP[ch] !== undefined ? MAP[ch] : WIN.has(ch) ? ch : '?'));
}

/**
 * data: {proyecto, generado, partidas[], presupuesto?, archivos[], advertencias[], estado}
 */
export function buildMemoriaPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false, size: 'A4', margin: 50, info: { Title: `Memoria de cálculo — ${data.proyecto}`, Author: 'Tannia Workspace', Creator: 'Tannia Workspace' }, bufferPages: true });
    const rawText = doc.text.bind(doc); doc.text = (t, ...r) => rawText(typeof t === 'string' ? latin(t) : t, ...r);
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const H = (t) => { doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor('#1F3864').text(t).moveDown(0.3).fillColor('black').font('Helvetica').fontSize(10); };
    // Estado del DOCUMENTO por su contenido (no por el estado del flujo): evita la circularidad aprobar→exportar→«final».
    // 'candidato' = completo y verificado; su validez como entrega depende del manifiesto aprobado (huellas exactas).
    const candidato = data.estado_documento === 'candidato';

    doc.font('Helvetica-Bold').fontSize(18).text('Memoria de cálculo y cubicación');
    doc.font('Helvetica').fontSize(11).text(`Proyecto: ${data.proyecto}`).text(`Generado: ${data.generado}`).text(`Revisión de datos: ${data.revision || 'no informada'}`);
    if (candidato) doc.moveDown(0.5).font('Helvetica-Bold').fillColor('#1F3864').text(`CANDIDATO A ENTREGA — revisión ${data.revision}. Solo es entrega válida si sus huellas SHA-256 coinciden con el manifiesto aprobado por una persona. No es una certificación profesional.`).fillColor('black').font('Helvetica');
    else doc.moveDown(0.5).font('Helvetica-Bold').fillColor('#C00000').text('BORRADOR — no es un documento final ni una certificación profesional.').fillColor('black').font('Helvetica');

    H('1. Trazabilidad');
    doc.font('Helvetica-Bold').text('1.1 Originales registrados en el proyecto (protegidos, huella al registrarlos)').font('Helvetica');
    if (!data.originales?.length) doc.text('Ninguno.');
    for (const a of data.originales || []) doc.text(`• ${a.archivo}  —  SHA-256: ${a.sha256}`, { width: 495 });
    doc.font('Helvetica-Bold').text('1.2 Fuentes geométricas vinculadas a partidas').font('Helvetica');
    if (!data.archivos?.length) doc.text('Ninguna partida tiene fuente geométrica (cantidades manuales o por método sin archivo).');
    for (const a of data.archivos || []) doc.text(`• ${a.archivo}  —  SHA-256 usado en el cálculo: ${a.sha256 || 'no registrado'}  —  partidas: ${(a.partidas || []).join(', ')}`, { width: 495 });

    H('2. Partidas y cantidades');
    for (const p of data.partidas || []) {
      doc.font('Helvetica-Bold').text(`${p.codigo}  ${p.descripcion}`).font('Helvetica');
      doc.text(`Cantidad: ${num(p.cantidad)} ${p.unidad}   ·   Estado: ${p.cantidad_verificada ? 'verificada por una persona' : p.estado_revision === 'needs_review' ? 'NEEDS_REVIEW' : 'NO verificada'}`);
      if (p.formula) doc.text(`Fórmula: ${p.formula}`, { width: 495 });
      if (p.fuente) doc.text(`Fuente: ${p.fuente.archivo} · capas ${(p.fuente.capas || []).join(', ')} · unidad confirmada: ${p.fuente.unidad_confirmada || 'no'}`, { width: 495 });
      for (const s of p.supuestos || []) doc.text(`Supuesto: ${s}`, { width: 495 });
      for (const w of p.advertencias || []) doc.fillColor('#C00000').text(`Advertencia: ${w}`, { width: 495 }).fillColor('black');
      doc.moveDown(0.4);
      if (doc.y > 720) doc.addPage();
    }
    if (data.presupuesto) {
      const B = data.presupuesto;
      H('3. Resumen de presupuesto (CLP)');
      doc.text(`Costo directo: ${clp(B.costo_directo)}`).text(`Gastos generales (${B.config.gastos_generales_pct ?? 'NO DEFINIDO'}%): ${clp(B.gastos_generales)}`).text(`Utilidades (${B.config.utilidades_pct ?? 'NO DEFINIDO'}%): ${clp(B.utilidades)}`).text(`Neto: ${clp(B.neto)}`).text(`IVA (${B.config.iva_pct ?? 'NO DEFINIDO'}%): ${clp(B.iva)}`);
      doc.font('Helvetica-Bold').text(`TOTAL${B.parcial ? ' PARCIAL (excluye partidas pendientes)' : ''}: ${clp(B.total)}`).font('Helvetica');
      doc.text(B.redondeo, { width: 495 });
      if (data.origen_economico) doc.text(`Origen de precios y porcentajes: ${data.origen_economico}`, { width: 495 });
    }
    H('4. Advertencias, pendientes y límites');
    const adv = [...(data.advertencias || []), ...(data.presupuesto?.bloqueos || [])];
    if (!adv.length) doc.text('Sin advertencias automáticas. La revisión profesional sigue siendo necesaria.');
    for (const a of [...new Set(adv)]) doc.text(`• ${a}`, { width: 495 });
    doc.moveDown().fontSize(9).fillColor('#555555').text('Documento generado por Tannia Workspace como apoyo. Las medidas provienen de la geometría de los archivos indicados; las partidas, parámetros constructivos, precios y la conformidad normativa deben ser revisados y aprobados por un profesional responsable.', { width: 495 });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); doc.fontSize(8).fillColor('#777777').text(`Tannia Workspace · ${data.proyecto} · página ${i + 1} de ${range.count}`, 50, 800, { width: 495, align: 'center', lineBreak: false }); }
    doc.end();
  });
}
