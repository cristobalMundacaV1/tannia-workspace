// Entregables EDITABLES generados SOLO desde claims (docs/tw11/02 §8): memoria (MD + PDF) y planilla de cantidades (XLSX).
// El texto se verifica con el verificador de roles numéricos ANTES de escribir: cifras con unidad sin respaldo bloquean la entrega.
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { latin } from '../report/memoria.js';
import { politicaDe } from './politica.js';
import { obtenerOperacion } from './ops/index.js';
import { Ledger } from './claims.js';
import { detectarContradicciones } from './contradicciones.js';
import { VERSION_CIC } from './flag.js';

const UNI = (u) => (u === 'm2' ? 'm²' : u === 'm3' ? 'm³' : u === 'm3/s' ? 'm³/s' : u || '');
export const fmtNum = (v) => (typeof v === 'number' ? (Number.isInteger(v) && Math.abs(v) < 1e9 ? String(v) : v.toFixed(Math.abs(v) < 1000 ? 4 : 3).replace(/0+$/, '').replace(/\.$/, '')).replace('.', ',') : String(v ?? '—'));
const corto = (h) => (h ? h.slice(0, 10) : '—');

/** Bloques estructurados de la memoria. Todo número técnico sale de claims o de entradas registradas. */
export function bloquesMemoria(doc, { fuentes = [], version_caso, paquete = VERSION_CIC, ahora = new Date().toISOString() } = {}) {
  const pol = politicaDe(doc.mode); const L = new Ledger(doc.claims); const cl = L.list(); const eng = doc.engagement; const B = [];
  const tabla = (head, rows) => ({ tabla: { head, rows } });
  B.push({ h: 1, t: `Memoria de cálculo y procedimiento — ${doc.nombre}` });
  B.push({ marca: pol.marca });
  B.push({ p: `Modo: ${doc.mode === 'academic' ? 'académico' : 'profesional'} · Caso: ${doc.nombre} (${version_caso}) · Generado: ${ahora.slice(0, 10)} · Tannia Workspace CIC ${paquete}.` });
  if (eng) { B.push({ h: 2, t: '1. Encargo' }); B.push({ p: eng.interpretation.restatement }); if (eng.interpretation.deliverables.length) B.push({ li: eng.interpretation.deliverables.map((d) => `${d.kind} (${d.status === 'confirmed' ? 'confirmado' : d.status === 'assumed' ? 'supuesto' : 'por definir'})`) }); if (eng.interpretation.disciplines_proposed.length) B.push({ p: `Disciplinas (informativas): ${eng.interpretation.disciplines_proposed.map((d) => d.tag).join(', ')}.` }); }
  B.push({ h: 2, t: '2. Antecedentes y fuentes' });
  if (fuentes.length) B.push(tabla(['Fuente', 'Clase', 'Carácter', 'Estado', 'Aprobada por', 'Contenido verificado por el servidor'], fuentes.map((f) => [f.title, f.class, f.binding, f.state, f.approval.by, f.content.verified_by_server ? 'sí' : 'no'])));
  else B.push({ p: 'No se registraron fuentes en este caso: ningún valor de este documento proviene de una fuente documental.' });
  const ant = eng?.interpretation.antecedents || []; if (ant.length) B.push({ li: ant.map((a) => `${a.ref}${a.use ? ` — ${a.use}` : ''}`) });
  B.push({ h: 2, t: '3. Datos de entrada' });
  const datos = cl.filter((c) => c.kind === 'data'); if (datos.length) B.push(tabla(['Dato', 'Valor', 'Unidad', 'Origen', 'Estado'], datos.map((c) => [c.statement, fmtNum(c.value), UNI(c.unit), c.status === 'user_stated' ? 'aportado por la usuaria' : 'fuente', c.status]))); else B.push({ p: 'Sin datos de entrada registrados.' });
  const desconocidas = (eng?.interpretation.magnitudes || []).filter((m) => m.origin === 'unknown' || m.value === null); if (desconocidas.length) B.push({ p: `Datos DESCONOCIDOS (no se inventaron): ${desconocidas.map((m) => m.name).join(', ')}.` });
  B.push({ h: 2, t: '4. Supuestos' });
  const sup = cl.filter((c) => c.kind === 'assumption'); B.push(sup.length ? { li: sup.map((c) => `${c.statement}${c.value !== null ? ` = ${fmtNum(c.value)} ${UNI(c.unit)}` : ''} (editable; requiere confirmación)`) } : { p: 'Sin supuestos registrados.' });
  B.push({ h: 2, t: '5. Procedimiento' });
  const ops = new Map(); for (const s of doc.plan?.steps || []) if (s.capability_id?.startsWith('op.')) ops.set(s.capability_id.slice(3), s); for (const c of cl) if (c.method_ref && !ops.has(c.method_ref.operation_id)) ops.set(c.method_ref.operation_id, null);
  for (const id of ops.keys()) { const m = obtenerOperacion(id); if (!m) continue; B.push({ h: 3, t: `${m.title} (${m.id} v${m.version}, madurez ${m.maturity})` }); B.push({ p: `Fórmula: ${m.formula}` }); B.push({ li: [`Hipótesis: ${m.applicability.assumptions.join('; ')}`, `Rango de validez: ${m.applicability.validity.join('; ')}`, `Cota de error: ${m.applicability.error_bound}`] }); }
  if (doc.plan) B.push(tabla(['Paso', 'Objetivo', 'Estado'], doc.plan.steps.map((s) => [s.id, s.goal, s.status])));
  B.push({ h: 2, t: '6. Resultados' });
  const res = cl.filter((c) => c.kind === 'calculation' && c.status !== 'stale'); if (res.length) B.push(tabla(['Resultado', 'Valor', 'Unidad', 'Método', 'Hash de entradas', 'Revisión requerida'], res.map((c) => [c.statement.replace(/ → /g, ': '), fmtNum(c.value), UNI(c.unit), `${c.method_ref.operation_id} v${c.method_ref.version} (${c.method_ref.maturity})`, corto(c.method_ref.input_hash), c.requires_review_by.join(', ') || '—']))); else B.push({ p: 'No hay resultados calculados vigentes.' });
  B.push({ h: 2, t: '7. Pendientes, brechas y verificación' });
  const pend = []; for (const g of doc.plan?.gaps || []) pend.push(`Brecha (${g.resolution === 'external_professional' ? 'requiere profesional competente' : g.resolution === 'new_tool' ? 'requiere nueva herramienta' : g.resolution === 'research_external' ? 'requiere investigación' : 'requiere dato de la usuaria'}): ${g.need}. ${g.why}`); for (const c of cl.filter((x) => x.kind === 'pending')) pend.push(`Pendiente: ${c.statement}${c.requires_review_by.length ? ` (revisa: ${c.requires_review_by.join(', ')})` : ''}`);
  for (const u of eng?.interpretation.unknowns || []) pend.push(`Desconocido: ${u.what}`); B.push(pend.length ? { li: pend } : { p: 'Sin pendientes registrados.' });
  const stale = cl.filter((c) => c.status === 'stale').length; const ctr = detectarContradicciones(cl).length + (doc.contradictions || []).filter((x) => x.status !== 'resolved').length;
  B.push({ p: `Estado de verificación: ${stale ? `${stale} claim(s) desactualizado(s); ` : 'sin claims desactualizados; '}${ctr ? `${ctr} contradicción(es) abierta(s)` : 'sin contradicciones abiertas'}.` });
  for (const a of doc.artifacts || []) B.push({ p: `Artefacto: ${a.rel} (SHA-256 ${corto(a.sha256)}…).` });
  B.push({ h: 2, t: '8. Alcance y responsabilidad' });
  B.push({ p: 'Este documento es ingeniería ASISTIDA generada a partir de datos y supuestos declarados. No reemplaza el juicio ni la revisión de un profesional competente. Los resultados geotécnicos, estructurales, hidráulicos de diseño y normativos no están calculados ni verificados por esta herramienta salvo que se indique expresamente.' });
  B.push({ p: pol.marca });
  return B;
}
export function bloquesATexto(B) {
  return B.map((b) => (b.h ? `${'#'.repeat(b.h)} ${b.t}` : b.marca ? `> **${b.marca}**` : b.p ? b.p : b.li ? b.li.map((x) => `- ${x}`).join('\n') : b.tabla ? [`| ${b.tabla.head.join(' | ')} |`, `|${b.tabla.head.map(() => '---').join('|')}|`, ...b.tabla.rows.map((r) => `| ${r.map((x) => String(x).replace(/\|/g, '/')).join(' | ')} |`)].join('\n') : '')).join('\n\n') + '\n';
}
export function bloquesAPdf(B, { marca }) {
  return new Promise((res, rej) => {
    const d = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: { Title: latin(B.find((b) => b.h === 1)?.t || 'Memoria'), Producer: 'Tannia Workspace CIC' } }); const ch = []; d.on('data', (c) => ch.push(c)); d.on('end', () => res(Buffer.concat(ch))); d.on('error', rej);
    const W = d.page.width - 100;
    for (const b of B) {
      if (b.h) { d.moveDown(b.h === 1 ? 0.2 : 0.7).font('Helvetica-Bold').fontSize(b.h === 1 ? 17 : b.h === 2 ? 13 : 11).fillColor('#000').text(latin(b.t), { width: W }); d.font('Helvetica').fontSize(10); }
      else if (b.marca) { d.moveDown(0.3).font('Helvetica-Bold').fontSize(10).fillColor('#a00').text(latin(b.marca), { width: W }); d.fillColor('#000').font('Helvetica').fontSize(10); }
      else if (b.p) d.moveDown(0.3).font('Helvetica').fontSize(10).fillColor('#000').text(latin(b.p), { width: W });
      else if (b.li) for (const x of b.li) d.moveDown(0.15).font('Helvetica').fontSize(10).text(`• ${latin(x)}`, { width: W, indent: 8 });
      else if (b.tabla) { d.moveDown(0.3).font('Helvetica-Bold').fontSize(8.5).text(latin(b.tabla.head.join('  |  ')), { width: W }); d.font('Helvetica').fontSize(8.5); for (const r of b.tabla.rows) d.text(latin(r.map((x) => String(x)).join('  |  ')), { width: W }); d.fontSize(10); }
    }
    const rango = d.bufferedPageRange(); for (let i = rango.start; i < rango.start + rango.count; i++) { d.switchToPage(i); d.font('Helvetica').fontSize(7.5).fillColor('#a00').text(latin(marca), 50, d.page.height - 38, { width: W, align: 'center', lineBreak: false }); d.fillColor('#777').text(`Página ${i + 1} de ${rango.count}`, 50, d.page.height - 26, { width: W, align: 'center', lineBreak: false }); }
    d.end();
  });
}
export async function planillaCantidades(doc, { fuentes = [], version_caso }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Tannia Workspace CIC'; const pol = politicaDe(doc.mode); const cl = doc.claims;
  const ws = wb.addWorksheet('Cantidades'); ws.addRow([pol.marca]); ws.addRow([`Caso ${doc.nombre} ${version_caso} · modo ${doc.mode}`]); ws.addRow([]);
  ws.addRow(['Ítem', 'Valor', 'Unidad', 'Operación', 'Versión op.', 'Madurez', 'Hash de entradas', 'Revisión requerida', 'Id del claim']).font = { bold: true };
  for (const c of cl.filter((x) => x.kind === 'calculation' && x.status !== 'stale')) ws.addRow([c.statement.replace(/ → /g, ': '), c.value, UNI(c.unit), c.method_ref.operation_id, c.method_ref.version, c.method_ref.maturity, c.method_ref.input_hash, c.requires_review_by.join(', '), c.id]);
  ws.columns = [{ width: 52 }, { width: 16 }, { width: 8 }, { width: 38 }, { width: 10 }, { width: 9 }, { width: 24 }, { width: 24 }, { width: 24 }];
  const wd = wb.addWorksheet('Datos y supuestos'); wd.addRow(['Tipo', 'Descripción', 'Valor', 'Unidad', 'Estado']).font = { bold: true }; for (const c of cl.filter((x) => ['data', 'assumption'].includes(x.kind))) wd.addRow([c.kind === 'data' ? 'Dato' : 'Supuesto (editable)', c.statement, c.value, UNI(c.unit), c.status]);
  const wp = wb.addWorksheet('Pendientes'); wp.addRow(['Tipo', 'Descripción', 'Resolución']).font = { bold: true }; for (const g of doc.plan?.gaps || []) wp.addRow(['Brecha', g.need, g.resolution]); for (const c of cl.filter((x) => x.kind === 'pending')) wp.addRow(['Pendiente', c.statement, c.requires_review_by.join(', ')]);
  const wf = wb.addWorksheet('Fuentes'); wf.addRow(['Fuente', 'Clase', 'Carácter', 'Estado', 'Aprobada por', 'Contenido verificado']).font = { bold: true }; for (const f of fuentes) wf.addRow([f.title, f.class, f.binding, f.state, f.approval.by, f.content.verified_by_server ? 'sí' : 'no']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
