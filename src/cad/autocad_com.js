// Adaptador de AutoCAD por COM (PowerShell). ESTADO: contrato + pruebas con ejecutor simulado.
// NO VERIFICADO EN AUTOCAD REAL. Reglas de seguridad aplicadas en código ANTES de cualquier llamada:
//  - lectura: siempre permitida sobre el documento activo;
//  - escritura: solo si el documento activo está dentro de "03 Trabajo" del proyecto autorizado y NO es un original;
//  - ningún script contiene Erase/Delete/Purge/Quit/Close sin guardar ni SaveAs sobre rutas de originales.
import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { UserError } from '../mcp/util.js';
import { FOLDERS, isInside } from '../security/sandbox.js';

const PS_HEAD = `$ErrorActionPreference='Stop'
$in = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:TANNIA_IN)) | ConvertFrom-Json
try { $acad = [Runtime.InteropServices.Marshal]::GetActiveObject('AutoCAD.Application') } catch { @{ok=$false;error='AUTOCAD_NO_ABIERTO'} | ConvertTo-Json -Compress; exit 0 }
$doc = $acad.ActiveDocument
`;
const PS_OK = `\n@{ok=$true;data=$out} | ConvertTo-Json -Depth 6 -Compress\n`;

// Cuerpos estáticos: los datos del usuario viajan SOLO en $in (JSON base64), nunca interpolados en el script.
export const SCRIPTS = {
  estado: `$out = @{ version=$acad.Version; nombre=$acad.Name; documento=$doc.Name; ruta=$doc.FullName; guardado=$doc.Saved; unidades_insunits=$doc.GetVariable('INSUNITS') }`,
  listar: `$items=@(); $n=0
foreach ($e in $doc.ModelSpace) { if ($n -ge $in.maximo) { break }; if ($in.capa -and $e.Layer -ne $in.capa) { continue }
  $items += @{ handle=$e.Handle; tipo=$e.ObjectName; capa=$e.Layer }; $n++ }
$out = @{ entidades=$items; truncado=($n -ge $in.maximo) }`,
  medir: `$e = $doc.HandleToObject($in.handle); $o=@{ handle=$in.handle; tipo=$e.ObjectName; capa=$e.Layer }
foreach ($p in 'Length','Area','Radius','TotalAngle') { try { $o[$p] = $e.$p } catch {} }
if ($e.ObjectName -eq 'AcDb3dSolid' -or $e.ObjectName -eq 'AcDbRegion') { try { $o['Volume'] = $e.Volume } catch {}; try { $o['Centroid'] = @($e.Centroid) } catch {} }
$out = $o`,
  abrir_copia: `$d = $acad.Documents.Open($in.ruta, $false); $out = @{ documento=$d.Name; ruta=$d.FullName }`,
  agregar_linea: `$p1 = New-Object 'double[]' 3; $p2 = New-Object 'double[]' 3
$p1[0]=$in.x1; $p1[1]=$in.y1; $p2[0]=$in.x2; $p2[1]=$in.y2
$l = $doc.ModelSpace.AddLine($p1,$p2); if ($in.capa) { $l.Layer = $in.capa }; $doc.Save(); $out = @{ handle=$l.Handle }`,
};

export function buildScript(name) {
  if (!SCRIPTS[name]) throw new Error(`script desconocido ${name}`);
  return PS_HEAD + SCRIPTS[name] + PS_OK;
}

export function defaultRunner(script, input) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      env: { ...process.env, TANNIA_IN: Buffer.from(JSON.stringify(input), 'utf8').toString('base64') }, timeout: 30000, windowsHide: true, maxBuffer: 20 * 1024 * 1024,
    }, (err, stdout) => { if (err) reject(err); else resolve(stdout); });
  });
}

const HANDLE = /^[0-9A-Fa-f]{1,16}$/;
const LAYER = /^[^\\/:*?"<>|\0\r\n']{1,255}$/;

export class AutoCadCom {
  constructor({ sandbox, runner = defaultRunner, platform = process.platform } = {}) { this.sandbox = sandbox; this.runner = runner; this.platform = platform; }

  async #exec(name, input = {}) {
    if (this.platform !== 'win32') throw new UserError('AUTOCAD_NO_DISPONIBLE', 'La conexión con AutoCAD solo existe en Windows con AutoCAD completo.', 'Use la exportación DXF para medir sin AutoCAD.');
    let out;
    try { out = await this.runner(buildScript(name), input); } catch (e) { throw new UserError('AUTOCAD_ERROR', 'No se pudo comunicar con AutoCAD.', 'Verifique que AutoCAD (no LT) esté abierto con un dibujo y que no haya un cuadro de diálogo abierto.'); }
    let r; try { r = JSON.parse(String(out).trim()); } catch { throw new UserError('AUTOCAD_RESPUESTA_INVALIDA', 'AutoCAD respondió de forma inesperada.', 'Reintente; si persiste, ejecute el diagnóstico.'); }
    if (!r.ok) {
      if (r.error === 'AUTOCAD_NO_ABIERTO') throw new UserError('AUTOCAD_NO_ABIERTO', 'No se encontró una sesión de AutoCAD abierta.', 'Abra AutoCAD y el dibujo que desea consultar.');
      throw new UserError('AUTOCAD_ERROR', 'AutoCAD no pudo completar la operación.', 'Revise que el dibujo esté activo y sin comandos en curso.');
    }
    return r.data;
  }

  async estado() { return this.#exec('estado'); }

  async listarEntidades({ capa, maximo = 500 } = {}) {
    if (capa !== undefined && !LAYER.test(capa)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido.');
    return this.#exec('listar', { capa: capa || null, maximo: Math.min(Math.max(1, maximo | 0), 5000) });
  }

  async medirEntidad(handle) {
    if (!HANDLE.test(String(handle))) throw new UserError('DATO_INVALIDO', 'Handle no válido.');
    return this.#exec('medir', { handle: String(handle) });
  }

  /** Verifica (por código) que `abs` sea una copia de trabajo escribible del proyecto. */
  #assertWorkCopy(project, abs) {
    const root = this.sandbox.projectRoot(project);
    const real = fs.existsSync(abs) ? fs.realpathSync.native(abs) : abs;
    if (!isInside(path.join(root, FOLDERS.trabajo), real)) throw new UserError('ORIGINAL_PROTEGIDO', 'Solo se pueden abrir y editar copias dentro de "03 Trabajo". Cree una con tannia_copia_trabajo.');
    if (!/\.(dwg|dxf)$/i.test(real)) throw new UserError('TIPO_NO_PERMITIDO', 'Solo se abren archivos .dwg o .dxf.');
    return real;
  }

  async abrirCopia(project, rel) {
    const { abs } = this.sandbox.resolve(project, rel);
    const real = this.#assertWorkCopy(project, abs);
    return this.#exec('abrir_copia', { ruta: real });
  }

  /** Edición de ejemplo (AddLine) permitida SOLO si el documento activo es una copia de trabajo del proyecto. */
  async agregarLinea(project, { x1, y1, x2, y2, capa }) {
    for (const v of [x1, y1, x2, y2]) if (!Number.isFinite(v)) throw new UserError('DATO_INVALIDO', 'Coordenadas no válidas.');
    if (capa !== undefined && !LAYER.test(capa)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido.');
    const st = await this.estado();
    this.#assertWorkCopy(project, st.ruta); // el documento ACTIVO debe ser copia de trabajo
    return this.#exec('agregar_linea', { x1, y1, x2, y2, capa: capa || null });
  }
}
