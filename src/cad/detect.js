// Detección de AutoCAD (solo lectura del registro de Windows). En otros sistemas: no disponible.
import { execFileSync } from 'node:child_process';
import os from 'node:os';

export function parseRegQuery(out) {
  // Líneas "    ProductName    REG_SZ    AutoCAD 2025" dentro de claves .../AutoCAD/R25.0/ACAD-XXXX:409
  const res = [];
  let cur = null;
  for (const line of out.split(/\r?\n/)) {
    if (/^HKEY_/.test(line.trim())) { cur = { clave: line.trim(), producto: null }; res.push(cur); continue; }
    const m = line.match(/^\s+ProductName\s+REG_SZ\s+(.+)$/);
    if (m && cur) cur.producto = m[1].trim();
  }
  return res.filter((r) => r.producto).map((r) => ({
    producto: r.producto,
    es_lt: /\bLT\b/i.test(r.producto),
    release: (r.clave.match(/\\(R\d+\.\d+)\\/) || [])[1] || null,
  }));
}

export function detectarAutoCad({ platform = os.platform(), run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 8000, windowsHide: true }) } = {}) {
  if (platform !== 'win32') return { instalado: false, motivo: 'No es Windows: la integración con AutoCAD (COM) solo existe en Windows.', verificado_en_autocad_real: false };
  try {
    const out = run('reg', ['query', 'HKLM\\SOFTWARE\\Autodesk\\AutoCAD', '/s', '/v', 'ProductName']);
    const productos = parseRegQuery(out);
    if (!productos.length) return { instalado: false, motivo: 'No se encontró AutoCAD en el registro.', verificado_en_autocad_real: false };
    const completos = productos.filter((p) => !p.es_lt);
    return {
      instalado: true, productos,
      compatible: completos.length > 0,
      advertencia: completos.length ? null : 'Solo se detectó AutoCAD LT: no admite automatización COM; use exportación DXF.',
      verificado_en_autocad_real: false,
      nota: 'Detección por registro; la conexión real no se ha probado.',
    };
  } catch (e) {
    return { instalado: false, motivo: 'No se pudo consultar el registro (o no hay AutoCAD).', verificado_en_autocad_real: false };
  }
}
