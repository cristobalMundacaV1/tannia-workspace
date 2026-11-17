// Exportación XLSX con FÓRMULAS vivas (precios editables). Los resultados en caché se calculan con calc.js
// y se verifican de forma independiente recalculando con LibreOffice en las pruebas.
import ExcelJS from 'exceljs';
import { apuUnitCost, computeBudget, TIPOS_INSUMO } from './calc.js';
import { explicarPartida } from '../metodos/explicar.js';

const CLP = '#,##0';
const bold = { bold: true };
const fillWarn = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
const fillHead = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const fillInput = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

export async function buildBudgetWorkbook({ proyecto, partidas, apus, config, cache = true, generado = new Date().toISOString(), revision = null, origen_economico = null, aviso_modalidad = null }) {
  const B = computeBudget({ partidas, apus, config });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tannia Workspace'; wb.created = new Date(generado);
  const val = (formula, result) => (cache && result !== null && result !== undefined ? { formula, result } : { formula });

  // --- Parámetros
  const wp = wb.addWorksheet('Parametros');
  wp.columns = [{ width: 34 }, { width: 14 }, { width: 60 }];
  wp.addRow(['Parámetro', 'Valor', 'Nota']).font = bold;
  const nd = 'NO DEFINIDO: se calcula con 0 solo como borrador; indique el valor antes de entregar.';
  wp.addRow(['Gastos generales (%)', B.config.gastos_generales_pct ?? 0, B.config.gastos_generales_pct == null ? nd : 'Editable. Valor indicado explícitamente.']);
  wp.addRow(['Utilidades (%)', B.config.utilidades_pct ?? 0, B.config.utilidades_pct == null ? nd : 'Editable. Valor indicado explícitamente.']);
  wp.addRow(['IVA (%)', B.config.iva_pct ?? 0, B.config.iva_pct == null ? nd : 'Editable. Valor indicado explícitamente; tasa legal vigente: VERIFICAR antes de entregar.']);
  for (const r of [2, 3, 4]) wp.getCell(`B${r}`).fill = fillInput;
  // Nombres estables: las fórmulas no dependen de la posición de filas informativas (incidente R5–R8: IVA leía texto en B4).
  wb.definedNames.add('Parametros!$B$2', 'PCT_GG'); wb.definedNames.add('Parametros!$B$3', 'PCT_UTILIDAD'); wb.definedNames.add('Parametros!$B$4', 'PCT_IVA');
  wp.addRow([]);
  wp.addRow(['Política económica', 'GG y utilidades sobre costo directo; IVA sobre costo directo + GG + utilidades; cada total redondeado a peso (ROUND).', '']);
  if (aviso_modalidad) wp.addRow(['Modalidad / originales', aviso_modalidad, 'Protección de originales: no aplica (sin originales registrados).']);
  if (origen_economico) wp.addRow(['Origen de precios y porcentajes', origen_economico, 'Tannia no puede acreditar quién aportó estos valores.']);

  // --- APU
  const wa = wb.addWorksheet('APU');
  wa.columns = [{ width: 12 }, { width: 44 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 28 }, { width: 14 }, { width: 16 }];
  const apuCell = {};
  let r = 1;
  for (const apu of apus) {
    const calc = apuUnitCost(apu);
    wa.getRow(r).values = [`APU ${apu.codigo}`, apu.descripcion || '', apu.unidad];
    wa.getRow(r).font = bold; wa.getRow(r).fill = fillHead; r++;
    wa.getRow(r).values = ['Tipo', 'Insumo', 'Unidad', 'Cantidad / rend.', 'Precio unit. CLP', 'Fuente del precio', 'Fecha precio', 'Subtotal CLP'];
    wa.getRow(r).font = bold; r++;
    const first = r;
    for (const l of calc.lineas) {
      const row = wa.getRow(r);
      const useRend = l.rendimiento != null;
      row.getCell(1).value = l.tipo; row.getCell(2).value = l.descripcion; row.getCell(3).value = l.unidad || '';
      if (useRend) {
        row.getCell(4).value = val(`${l.cuadrilla ?? 1}/${l.rendimiento}`, l.cantidad_efectiva);
        row.getCell(2).value = `${l.descripcion} (rend. ${l.rendimiento}/jornada, cuadrilla ${l.cuadrilla ?? 1})`;
      } else row.getCell(4).value = l.cantidad;
      if (l.precio_unitario == null) { row.getCell(5).value = null; row.getCell(5).fill = fillWarn; row.getCell(6).value = 'PRECIO PENDIENTE'; row.getCell(8).value = 'PENDIENTE'; }
      else {
        row.getCell(5).value = l.precio_unitario; row.getCell(5).fill = fillInput;
        row.getCell(6).value = l.fuente_precio || ''; row.getCell(7).value = l.fecha_precio || '';
        row.getCell(8).value = val(`D${r}*E${r}`, l.subtotal);
      }
      row.getCell(5).numFmt = CLP; row.getCell(8).numFmt = CLP;
      r++;
    }
    const last = r - 1;
    wa.getRow(r).getCell(7).value = 'Costo unitario';
    wa.getRow(r).getCell(7).font = bold;
    if (calc.incompleto) { wa.getRow(r).getCell(8).value = 'INCOMPLETO'; wa.getRow(r).getCell(8).fill = fillWarn; }
    else wa.getRow(r).getCell(8).value = val(`ROUND(SUM(H${first}:H${last}),0)`, calc.costo_unitario);
    wa.getRow(r).getCell(8).numFmt = CLP; wa.getRow(r).getCell(8).font = bold;
    apuCell[apu.codigo] = { ref: `APU!H${r}`, incompleto: calc.incompleto };
    r += 2;
  }

  // --- Presupuesto
  const ws = wb.addWorksheet('Presupuesto', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.columns = [{ width: 10 }, { width: 50 }, { width: 8 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 44 }];
  ws.getCell('A1').value = `Presupuesto — ${proyecto}`; ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = B.estado_final_posible ? `CANDIDATO A ENTREGA${revision ? ` — revisión ${revision}` : ''}: válido solo si su huella coincide con el manifiesto aprobado` : 'BORRADOR — NO FINAL: hay precios o cantidades pendientes (ver hoja Alertas)';
  if (aviso_modalidad) { ws.getCell('A3').value = `ATENCIÓN: ${aviso_modalidad}`; ws.getCell('A3').font = { bold: true, color: { argb: 'FFC00000' } }; }
  ws.getCell('A2').font = { bold: true, color: { argb: B.estado_final_posible ? 'FF2E7D32' : 'FFC00000' } };
  ws.getRow(4).values = ['Código', 'Partida', 'Unidad', 'Cantidad', 'P. unitario CLP', 'Total CLP', 'Estado de la cantidad'];
  ws.getRow(4).font = bold; ws.getRow(4).fill = fillHead;
  let pr = 5; const firstP = pr;
  for (const l of B.lineas) {
    const p = partidas.find((x) => x.codigo === l.codigo);
    const row = ws.getRow(pr);
    row.getCell(1).value = l.codigo; row.getCell(2).value = l.descripcion; row.getCell(3).value = l.unidad;
    row.getCell(4).value = l.cantidad; row.getCell(4).numFmt = '#,##0.000'; row.getCell(4).fill = fillInput;
    const ac = apuCell[l.apu];
    const unitOk = !l.problemas.some((x) => x.includes('unidad de partida') || x.includes('sin APU'));
    if (ac && !ac.incompleto && unitOk) {
      row.getCell(5).value = val(ac.ref, l.precio_unitario);
      row.getCell(6).value = val(`ROUND(D${pr}*E${pr},0)`, l.total);
    } else { row.getCell(5).value = 'PENDIENTE'; row.getCell(6).value = 'PENDIENTE'; row.getCell(5).fill = fillWarn; row.getCell(6).fill = fillWarn; }
    row.getCell(5).numFmt = CLP; row.getCell(6).numFmt = CLP;
    row.getCell(7).value = p.cantidad_verificada ? 'verificada' : (p.estado_revision === 'needs_review' ? 'NEEDS_REVIEW' : 'no verificada');
    if (!p.cantidad_verificada) row.getCell(7).fill = fillWarn;
    pr++;
  }
  const lastP = pr - 1; pr++;
  const sumRow = (label, formula, result, boldIt = false) => {
    ws.getRow(pr).getCell(2).value = label; ws.getRow(pr).getCell(6).value = val(formula, result);
    ws.getRow(pr).getCell(6).numFmt = CLP; if (boldIt) { ws.getRow(pr).font = bold; }
    pr++; return pr - 1;
  };
  const rDir = pr; sumRow('Costo directo', `SUM(F${firstP}:F${lastP})`, B.costo_directo);
  const rGG = pr; sumRow('Gastos generales', `ROUND(F${rDir}*PCT_GG/100,0)`, B.gastos_generales);
  const rUt = pr; sumRow('Utilidades', `ROUND(F${rDir}*PCT_UTILIDAD/100,0)`, B.utilidades);
  const rNeto = pr; sumRow('Neto', `F${rDir}+F${rGG}+F${rUt}`, B.neto, true);
  const rIva = pr; sumRow('IVA', `ROUND(F${rNeto}*PCT_IVA/100,0)`, B.iva);
  sumRow('TOTAL', `F${rNeto}+F${rIva}`, B.total, true);
  if (B.parcial) { ws.getRow(pr + 1).getCell(2).value = 'TOTAL PARCIAL: excluye partidas con PENDIENTE.'; ws.getRow(pr + 1).getCell(2).font = { bold: true, color: { argb: 'FFC00000' } }; }

  // --- Cubicación (trazabilidad)
  const wc = wb.addWorksheet('Cubicacion');
  wc.columns = [{ width: 10 }, { width: 36 }, { width: 8 }, { width: 14 }, { width: 50 }, { width: 40 }, { width: 50 }];
  wc.getRow(1).values = ['Código', 'Partida', 'Unidad', 'Cantidad', 'Cálculo', 'Origen y alcance', 'Advertencias'];
  wc.getRow(1).font = bold; wc.getRow(1).fill = fillHead;
  for (const p of partidas) {
    const e = explicarPartida(p); wc.addRow([p.codigo, p.descripcion, p.unidad, p.cantidad, e.calculo.join(' '), [e.origen, e.alcance, p.fuente ? `${p.fuente.archivo} · SHA-256 ${p.fuente.sha256 || 's/hash'}` : null].filter(Boolean).join(' '), e.advertencias.join(' | ')]);
  }
  // --- Alertas
  const wl = wb.addWorksheet('Alertas');
  wl.columns = [{ width: 120 }];
  wl.addRow([B.bloqueos.length ? 'Pendientes que impiden declarar el presupuesto FINAL:' : 'Sin pendientes automáticos (la revisión profesional sigue siendo necesaria).']).font = bold;
  for (const b of B.bloqueos) wl.addRow([b]);
  wl.addRow([]); wl.addRow(['Redondeo: ' + B.redondeo]);
  wl.addRow(['Este archivo es una herramienta de apoyo: precios, rendimientos y cantidades deben ser revisados por un profesional responsable.']);
  for (const w of wb.worksheets) w.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  return { workbook: wb, budget: B };
}

export async function writeBudgetXlsx(file, input) {
  const { workbook, budget } = await buildBudgetWorkbook(input);
  await workbook.xlsx.writeFile(file);
  return budget;
}
void TIPOS_INSUMO;
