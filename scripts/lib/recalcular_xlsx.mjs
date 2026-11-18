// Recalcula un XLSX con un motor real (LibreOffice headless): elimina los valores en caché de TODAS las celdas con fórmula
// para que el motor deba calcularlas, convierte y devuelve los valores calculados. Si no hay motor, devuelve null (pendiente).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import ExcelJS from 'exceljs';

export function motorDisponible() { try { execFileSync(process.platform === 'win32' ? 'soffice.exe' : 'soffice', ['--version'], { stdio: 'pipe', timeout: 60000 }); return true; } catch { return false; } }

export async function recalcular(xlsxPath) {
  if (!motorDisponible()) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recalc-'));
  try {
    const z = unzipSync(new Uint8Array(fs.readFileSync(xlsxPath))); let formulas = 0;
    for (const n of Object.keys(z)) if (/^xl\/worksheets\/sheet\d+\.xml$/.test(n)) {
      const x = strFromU8(z[n]).replace(/(<f>[^<]*<\/f>)<v>[^<]*<\/v>/g, (_, f) => { formulas++; return f; });
      z[n] = strToU8(x);
    }
    const sinCache = path.join(tmp, 'sin-cache.xlsx'); fs.writeFileSync(sinCache, zipSync(z));
    const out = path.join(tmp, 'out'); fs.mkdirSync(out);
    execFileSync(process.platform === 'win32' ? 'soffice.exe' : 'soffice', [`-env:UserInstallation=file://${tmp.replace(/\\/g, '/')}/perfil`, '--headless', '--convert-to', 'xlsx', '--outdir', out, sinCache], { stdio: 'pipe', timeout: 180000 });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(out, 'sin-cache.xlsx'));
    const filas = {}; wb.getWorksheet('Presupuesto').eachRow((row) => { const k = String(row.getCell(2).value ?? ''); const v = row.getCell(6).value; if (k) filas[k] = typeof v === 'object' && v ? (v.result ?? v.error ?? null) : v; });
    return { formulas_sin_cache: formulas, filas };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
