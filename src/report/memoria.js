// Memoria de cálculo / informe PDF. Todo dato proviene del proyecto; nada se completa por inferencia.
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { explicarPartida } from '../metodos/explicar.js';

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
    if (data.aviso_modalidad) doc.moveDown(0.5).font('Helvetica-Bold').fillColor('#C00000').text(`ATENCIÓN: ${data.aviso_modalidad}`).fillColor('black').font('Helvetica');
    if (candidato) doc.moveDown(0.5).font('Helvetica-Bold').fillColor('#1F3864').text(`CANDIDATO A ENTREGA — revisión ${data.revision}. Solo es entrega válida si sus huellas SHA-256 coinciden con el manifiesto aprobado por una persona. No es una certificación profesional.`).fillColor('black').font('Helvetica');
    else doc.moveDown(0.5).font('Helvetica-Bold').fillColor('#C00000').text('BORRADOR — no es un documento final ni una certificación profesional.').fillColor('black').font('Helvetica');

    H('1. Trazabilidad');
    doc.font('Helvetica-Bold').text('1.1 Originales registrados en el proyecto (protegidos, huella al registrarlos)').font('Helvetica');
    if (!data.originales?.length) doc.text(data.proteccion_originales === 'no_aplica_sin_originales' ? 'Ninguno. Protección de originales: no aplica (modalidad manual declarada).' : 'Ninguno.');
    for (const a of data.originales || []) doc.text(`• ${a.archivo}  —  SHA-256: ${a.sha256}`, { width: 495 });
    doc.font('Helvetica-Bold').text('1.2 Fuentes geométricas vinculadas a partidas').font('Helvetica');
    if (!data.archivos?.length) doc.text('Ninguna partida tiene fuente geométrica (cantidades manuales o por método sin archivo).');
    for (const a of data.archivos || []) doc.text(`• ${a.archivo}  —  SHA-256 usado en el cálculo: ${a.sha256 || 'no registrado'}  —  partidas: ${(a.partidas || []).join(', ')}`, { width: 495 });

    if (data.planos) {
      doc.font('Helvetica-Bold').text('1.3 Planos de los que salen las cantidades').font('Helvetica');
      doc.text(`Revisión de planos ${data.planos.revision} (huella del modelo ${String(data.planos.model_sha256 || '').slice(0, 16)}…). Archivos: ${data.planos.archivos.join(', ')}.`, { width: 495 });
      doc.text('Estado: borrador para revisión humana. El DXF y el PDF salen del mismo modelo que las cantidades; la apertura y guardado en AutoCAD (DWG) NO está verificada.', { width: 495 });
    }

    H('2. Partidas y cantidades');
    for (const p of data.partidas || []) {
      doc.font('Helvetica-Bold').text(`${p.codigo}  ${p.descripcion}`).font('Helvetica');
      doc.text(`Cantidad: ${num(p.cantidad)} ${p.unidad}   ·   Estado: ${p.cantidad_verificada ? 'verificada por una persona' : p.estado_revision === 'needs_review' ? 'NEEDS_REVIEW' : 'NO verificada'}`);
      const e = explicarPartida(p);
      for (const l of e.calculo) doc.text(l, { width: 495 });
      doc.text(`Origen: ${e.origen}`, { width: 495 }); if (e.alcance) doc.text(`Alcance: ${e.alcance}`, { width: 495 });
      if (p.fuente) doc.text(`Archivo: ${p.fuente.archivo} · capas ${(p.fuente.capas || []).join(', ') || '—'}`, { width: 495 });
      for (const sp of e.supuestos) doc.text(`Supuesto: ${sp}`, { width: 495 });
      for (const w of e.advertencias) doc.fillColor('#C00000').text(`Advertencia: ${w}`, { width: 495 }).fillColor('black');
      doc.moveDown(0.4);
      if (doc.y > 720) doc.addPage();
    }
    if (data.presupuesto) {
      const B = data.presupuesto;
      H('3. Resumen de presupuesto (CLP)');
      doc.text(`Costo directo: ${clp(B.costo_directo)}`).text(`Gastos generales (${B.config.gastos_generales_pct ?? 'NO DEFINIDO'}%): ${clp(B.gastos_generales)}`).text(`Utilidades (${B.config.utilidades_pct ?? 'NO DEFINIDO'}%): ${clp(B.utilidades)}`).text(`Neto: ${clp(B.neto)}`).text(`IVA (${B.config.iva_pct ?? 'NO DEFINIDO'}%): ${clp(B.iva)}`);
      doc.font('Helvetica-Bold').text(`${B.etiqueta_total || 'TOTAL'}: ${clp(B.total)}`, { width: 495 }).font('Helvetica');
      for (const w of B.advertencias || []) doc.fillColor('#C00000').text(`Advertencia: ${w}`, { width: 495 }).fillColor('black');
      doc.text(B.redondeo, { width: 495 });
      if (data.origen_economico) doc.text(`Origen de precios y porcentajes: ${data.origen_economico}`, { width: 495 });
    }
    H('4. Pendientes, advertencias y límites');
    const bloq = [...new Set(data.presupuesto?.bloqueos || [])];
    const advs = [...new Set([...(data.advertencias || []), ...(data.partidas || []).flatMap((p) => explicarPartida(p).advertencias.map((a) => `${p.codigo}: ${a}`))])];
    const lims = [...new Set((data.partidas || []).flatMap((p) => explicarPartida(p).limites.map((l) => `${p.codigo}: ${l}`)))];
    doc.font('Helvetica-Bold').text('4.1 Pendientes que impiden aprobar').font('Helvetica');
    if (!bloq.length) doc.text('Sin pendientes que bloqueen la entrega.'); for (const a of bloq) doc.text(`• ${a}`, { width: 495 });
    doc.font('Helvetica-Bold').text('4.2 Advertencias que permanecen').font('Helvetica');
    if (!advs.length) doc.text('Ninguna.'); for (const a of advs) doc.text(`• ${a}`, { width: 495 });
    doc.font('Helvetica-Bold').text('4.3 Límites de los métodos empleados').font('Helvetica');
    if (!lims.length) doc.text('Sin límites adicionales declarados.'); for (const a of lims) doc.text(`• ${a}`, { width: 495 });
    const tipos = new Set((data.partidas || []).map((p) => explicarPartida(p).tipo_origen));
    const origenTxt = tipos.size === 1 && tipos.has('manual') ? 'Todas las cantidades fueron proporcionadas en la conversación; ninguna se midió en los planos.' : tipos.size === 1 && tipos.has('geometrico') ? 'Las cantidades se midieron en la geometría de los archivos indicados en cada partida.' : 'Hay cantidades medidas en planos y otras proporcionadas en la conversación; el origen se indica en cada partida.';
    doc.moveDown().fontSize(9).fillColor('#555555').text(`Documento generado por Tannia Workspace como apoyo. ${origenTxt} Registrar un archivo y comprobar su huella no acredita su autoridad técnica; confirmar una cantidad manual no la convierte en medición geométrica. Partidas, parámetros, precios y conformidad normativa deben ser revisados por un profesional competente.`, { width: 495 }).fillColor('black');

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); doc.page.margins.bottom = 0; /* el pie va bajo el margen: sin esto PDFKit agrega una página casi vacía (UAT-01) */ doc.fontSize(8).fillColor('#777777').text(`Tannia Workspace · ${data.proyecto} · página ${i + 1} de ${range.count}`, 50, 800, { width: 495, align: 'center', lineBreak: false }); }
    doc.end();
  });
}
