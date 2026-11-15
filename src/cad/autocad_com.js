// Adaptador de AutoCAD por COM (PowerShell). Verificado por el usuario en AutoCAD 2027 solo para conexión/lectura
// de estado (issue #8); el resto sigue NO VERIFICADO EN AUTOCAD REAL. Reglas de seguridad aplicadas en código ANTES de llamar:
//  - lectura: siempre permitida sobre el documento activo;
//  - escritura: solo si el documento activo está en "03 Trabajo" del proyecto autorizado (ruta real, sin enlaces) y se
//    RE-VERIFICA dentro de PowerShell que el documento activo no cambió justo antes de dibujar;
//  - ningún script contiene Erase/Purge/Quit/Close/SaveAs/SendCommand; Delete solo para revertir lo creado en la misma llamada.
//
// Transporte: la ENTRADA viaja como JSON UTF-8 en base64 (variable de entorno) y la SALIDA como una línea
// `TANNIA_OUT:<base64 de JSON UTF-8>`; así la página de códigos de la consola no puede corromper rutas Unicode.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { UserError } from '../mcp/util.js';
import { FOLDERS, isInside } from '../security/sandbox.js';
import { sanitizar } from './sanitize.js';

const PS_PRELUDE = `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Emit($o) {
  $json = ConvertTo-Json -InputObject $o -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  [Console]::Out.WriteLine('TANNIA_OUT:' + [Convert]::ToBase64String($bytes))
}
function Inner($ex) { while ($null -ne $ex.InnerException) { $ex = $ex.InnerException }; return $ex }
function HR($ex) { try { return ('0x{0:X8}' -f [int]$ex.HResult) } catch { return '' } }
function Fail($etapa, $err) {
  $ex = Inner $err.Exception
  Emit @{ ok = $false; etapa = $etapa; hresult = (HR $ex); tipo = $ex.GetType().Name; msg = [string]$ex.Message }
}
$in = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:TANNIA_IN)) | ConvertFrom-Json
`;

// Conexión: prueba el ProgID sin versión y luego los versionados (AutoCAD.Application.<release>), porque el sin versión
// puede apuntar a otra versión instalada distinta de la que está abierta.
export const PS_CONNECT = `$acad = $null; $usado = $null; $intentos = @()
$progids = @('AutoCAD.Application')
foreach ($v in 40..20) { $progids += ('AutoCAD.Application.' + $v) }
foreach ($p in $progids) {
  try { $acad = [Runtime.InteropServices.Marshal]::GetActiveObject($p); $usado = $p; break }
  catch { $intentos += ($p + '=' + (HR (Inner $_.Exception))) }
}
if ($null -eq $acad) { Emit @{ ok = $false; etapa = 'conectar'; codigo = 'AUTOCAD_NO_ABIERTO'; intentos = @($intentos | Select-Object -First 4) }; exit 0 }
try { $doc = $acad.ActiveDocument } catch { Fail 'documento_activo' $_; exit 0 }
if ($null -eq $doc) { Emit @{ ok = $false; etapa = 'documento_activo'; codigo = 'SIN_DOCUMENTO' }; exit 0 }
`;

// Cuerpos estáticos: los datos del usuario viajan SOLO en $in, nunca interpolados en el script.
export const SCRIPTS = {
  estado: `$ruta = [string]$doc.FullName
Emit @{ ok = $true; data = @{ version = [string]$acad.Version; nombre = [string]$acad.Name; progid = $usado; documento = [string]$doc.Name; ruta = $ruta; guardado = [bool]$doc.Saved; unidades_insunits = $doc.GetVariable('INSUNITS') } }`,
  listar: `$items = @(); $n = 0; $trunc = $false
foreach ($e in $doc.ModelSpace) {
  if ($n -ge $in.maximo) { $trunc = $true; break }
  if ($in.capa -and ($e.Layer -ne $in.capa)) { continue }
  $it = @{ handle = [string]$e.Handle; tipo = [string]$e.ObjectName; capa = [string]$e.Layer }
  if ($in.medidas) { try { $it.longitud = [double]$e.Length } catch { } }
  $items += $it; $n++
}
Emit @{ ok = $true; data = @{ entidades = $items; truncado = $trunc } }`,
  medir: `$e = $doc.HandleToObject([string]$in.handle)
$o = @{ handle = [string]$in.handle; tipo = [string]$e.ObjectName; capa = [string]$e.Layer }
foreach ($p in 'Length', 'Area', 'Radius', 'TotalAngle') { try { $o[$p] = $e.$p } catch { } }
if ($e.ObjectName -eq 'AcDb3dSolid' -or $e.ObjectName -eq 'AcDbRegion') { try { $o['Volume'] = $e.Volume } catch { }; try { $o['Centroid'] = @($e.Centroid) } catch { } }
Emit @{ ok = $true; data = $o }`,
  abrir_copia: `$d = $acad.Documents.Open([string]$in.ruta, $false)
Emit @{ ok = $true; data = @{ documento = [string]$d.Name; ruta = [string]$d.FullName } }`,
  agregar_lineas: `if ($doc.FullName -ne $in.ruta_esperada) { Emit @{ ok = $false; etapa = 'verificar_documento'; codigo = 'DOCUMENTO_CAMBIO' }; exit 0 }
$capaObj = $null; $creada = $false
if ($in.capa) {
  try { $capaObj = $doc.Layers.Item([string]$in.capa) } catch { $capaObj = $null }
  if ($null -eq $capaObj) {
    try { $capaObj = $doc.Layers.Add([string]$in.capa); $creada = $true } catch { Fail 'preparar_capa' $_; exit 0 }
  }
}
$creados = @(); $prevLayer = $null; $marca = $false
try {
  $doc.StartUndoMark(); $marca = $true
  if ($null -ne $capaObj) { $prevLayer = $doc.ActiveLayer; $doc.ActiveLayer = $capaObj }
  foreach ($l in $in.lineas) {
    $p1 = New-Object 'double[]' 3; $p2 = New-Object 'double[]' 3
    $p1[0] = [double]$l.x1; $p1[1] = [double]$l.y1; $p2[0] = [double]$l.x2; $p2[1] = [double]$l.y2
    $creados += $doc.ModelSpace.AddLine($p1, $p2)
  }
  if ($null -ne $prevLayer) { $doc.ActiveLayer = $prevLayer }
  $doc.EndUndoMark(); $marca = $false
} catch {
  $err = $_
  foreach ($e in $creados) { try { $e.Delete() } catch { } }
  if ($null -ne $prevLayer) { try { $doc.ActiveLayer = $prevLayer } catch { } }
  if ($creada -and $null -ne $capaObj) { try { $capaObj.Delete() } catch { } }
  if ($marca) { try { $doc.EndUndoMark() } catch { } }
  $ex = Inner $err.Exception
  Emit @{ ok = $false; etapa = 'dibujar'; hresult = (HR $ex); tipo = $ex.GetType().Name; msg = [string]$ex.Message; revertido = $true; capa_revertida = $creada }
  exit 0
}
$handles = @(); foreach ($e in $creados) { $handles += [string]$e.Handle }
try { $doc.Save() } catch { Emit @{ ok = $false; etapa = 'guardar'; codigo = 'GUARDADO_FALLO'; handles = $handles; hresult = (HR (Inner $_.Exception)) }; exit 0 }
Emit @{ ok = $true; data = @{ handles = $handles; capa_creada = $creada } }`,
};

export function buildScript(name, { connect = PS_CONNECT } = {}) {
  if (!SCRIPTS[name]) throw new Error(`script desconocido ${name}`);
  return `${PS_PRELUDE}${connect}try {\n${SCRIPTS[name]}\n} catch { Fail 'operacion_${name}' $_; exit 0 }\n`;
}

const MARCA = /TANNIA_OUT:([A-Za-z0-9+/=]+)/g;

/** Ejecuta PowerShell y devuelve el JSON (texto) emitido por el script. Errores con `clase` segura y diagnóstico saneado. */
export function runPowerShell(script, input, { exe = 'powershell.exe', env = {}, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    let child;
    try {
      child = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
        env: { ...process.env, ...env, TANNIA_IN: Buffer.from(JSON.stringify(input), 'utf8').toString('base64') },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { reject(Object.assign(new Error('spawn'), { clase: 'powershell_no_encontrado' })); return; }
    const out = []; const err = []; let done = false; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { child.kill(); } catch { /* */ } }, timeoutMs);
    child.stdout.on('data', (d) => out.push(d)); child.stderr.on('data', (d) => err.push(d));
    child.on('error', (e) => { if (done) return; done = true; clearTimeout(timer); reject(Object.assign(new Error('spawn'), { clase: e.code === 'ENOENT' ? 'powershell_no_encontrado' : 'powershell_no_inicia' })); });
    child.on('close', (code) => {
      if (done) return; done = true; clearTimeout(timer);
      const stdout = Buffer.concat(out).toString('latin1'); // base64 es ASCII: latin1 no altera nada
      const stderr = sanitizar(Buffer.concat(err).toString('utf8'), 200);
      const marcas = [...stdout.matchAll(MARCA)];
      if (marcas.length) { resolve(Buffer.from(marcas[marcas.length - 1][1], 'base64').toString('utf8')); return; }
      let clase = timedOut ? 'tiempo_agotado' : code !== 0 ? 'powershell_fallo' : 'sin_respuesta';
      if (/execution ?policy|PSSecurityException|no está firmado|is not digitally signed/i.test(stderr)) clase = 'politica_ejecucion';
      else if (/ConstrainedLanguage|Constrained Language/i.test(stderr)) clase = 'modo_lenguaje_restringido';
      else if (/AMSI|malicious|virus|bloquead/i.test(stderr)) clase = 'bloqueado_antivirus';
      reject(Object.assign(new Error('powershell'), { clase, codigo_salida: code, stderr }));
    });
  });
}

const HANDLE = /^[0-9A-Fa-f]{1,16}$/;
const LAYER = /^[^\\/:*?"<>|\0\r\n';,=`]{1,255}$/;
const BUSY = new Set(['0x80010001', '0x8001010A']);   // llamada rechazada / reintentar luego (AutoCAD ocupado)
const GONE = new Set(['0x800706BA', '0x800706BE', '0x80010108', '0x800706BF']); // RPC no disponible / falló / servidor muerto
const ACCESO = '0x80070005';

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

/** Normaliza una ruta de Windows devuelta por AutoCAD (prefijo \\?\, barras) sin cambiar su contenido. */
export function normalizarRuta(p) {
  let t = String(p);
  if (t.startsWith('\\\\?\\UNC\\')) t = `\\\\${t.slice(8)}`;
  else if (t.startsWith('\\\\?\\')) t = t.slice(4);
  return t.normalize('NFC');
}

export class AutoCadCom {
  constructor({ sandbox, runner, platform = process.platform, connect, sleep = sleepReal } = {}) {
    this.sandbox = sandbox; this.platform = platform; this.connect = connect; this.sleep = sleep;
    this.runner = runner || ((script, input) => runPowerShell(script, input));
  }

  async #exec(name, input = {}) {
    if (this.platform !== 'win32') throw new UserError('AUTOCAD_NO_DISPONIBLE', 'La conexión con AutoCAD solo existe en Windows con AutoCAD completo.', 'Use la exportación DXF para medir sin AutoCAD.');
    const script = buildScript(name, this.connect ? { connect: this.connect } : undefined);
    for (let intento = 0; ; intento++) {
      let out;
      try { out = await this.runner(script, input); }
      catch (e) { throw this.#errorProceso(e); }
      let r; try { r = JSON.parse(String(out).trim()); } catch { throw new UserError('AUTOCAD_RESPUESTA_INVALIDA', 'AutoCAD respondió de forma inesperada.', 'Reintente; si persiste, ejecute el diagnóstico.', { etapa: 'interpretar_respuesta' }); }
      if (r.ok) return r.data;
      if (BUSY.has(String(r.hresult).toUpperCase().replace(/^0X/, '0x')) && intento < 2) { await this.sleep(700 * (intento + 1)); continue; }
      throw this.#errorScript(r, name);
    }
  }

  #errorProceso(e) {
    const clase = (e && e.clase) || 'desconocida';
    const hints = {
      powershell_no_encontrado: 'No se encontró Windows PowerShell (powershell.exe).',
      powershell_no_inicia: 'Windows PowerShell no pudo iniciarse.',
      tiempo_agotado: 'AutoCAD no respondió a tiempo: cierre cuadros de diálogo o comandos activos en AutoCAD y reintente.',
      politica_ejecucion: 'Una política de seguridad de Windows bloquea PowerShell: consulte al administrador de TI.',
      modo_lenguaje_restringido: 'PowerShell está en modo de lenguaje restringido (política de TI).',
      bloqueado_antivirus: 'Un antivirus bloqueó el script de conexión: permita la extensión o consulte a TI.',
      powershell_fallo: 'PowerShell terminó con error antes de contactar a AutoCAD.',
      sin_respuesta: 'PowerShell terminó sin entregar respuesta.',
    };
    return new UserError('AUTOCAD_ERROR', 'No se pudo comunicar con AutoCAD.', hints[clase] || 'Reintente y ejecute el diagnóstico.', { etapa: 'ejecutar_powershell', clase, codigo_salida: e?.codigo_salida ?? null, stderr: e?.stderr ? sanitizar(e.stderr) : null });
  }

  #errorScript(r, name) {
    const hr = r.hresult ? String(r.hresult) : null;
    const detalle = { etapa: r.etapa || null, operacion: name, hresult: hr, tipo_excepcion: r.tipo || null, mensaje: r.msg ? sanitizar(r.msg) : null };
    if (r.codigo === 'AUTOCAD_NO_ABIERTO') {
      const acceso = (r.intentos || []).some((s) => String(s).includes(ACCESO));
      return new UserError(acceso ? 'AUTOCAD_ACCESO_DENEGADO' : 'AUTOCAD_NO_ABIERTO',
        acceso ? 'AutoCAD está abierto pero Windows denegó el acceso.' : 'No se encontró una sesión de AutoCAD abierta.',
        acceso ? 'AutoCAD y Claude Desktop deben ejecutarse con el mismo nivel de permisos (ambos normales; no "como administrador").' : 'Abra AutoCAD y un dibujo. Si ya está abierto, puede estar ejecutándose "como administrador": ábralo normalmente.',
        { ...detalle, intentos: r.intentos || [] });
    }
    if (r.codigo === 'SIN_DOCUMENTO') return new UserError('AUTOCAD_SIN_DOCUMENTO', 'AutoCAD no tiene un dibujo activo.', 'Abra o cree un dibujo en AutoCAD.', detalle);
    if (r.codigo === 'DOCUMENTO_CAMBIO') return new UserError('DOCUMENTO_CAMBIO', 'El dibujo activo cambió antes de dibujar; no se escribió nada.', 'Deje activa la copia de trabajo y repita.', detalle);
    if (r.codigo === 'GUARDADO_FALLO') return new UserError('GUARDADO_FALLO', 'Las líneas se crearon en la copia pero no se pudo guardar.', 'Guarde manualmente la COPIA en AutoCAD (no el original). Handles creados en el detalle.', { ...detalle, handles: r.handles || [] });
    const up = hr ? hr.toUpperCase().replace(/^0X/, '0x') : '';
    if (BUSY.has(up)) return new UserError('AUTOCAD_OCUPADO', 'AutoCAD está ocupado (comando o cuadro de diálogo abierto).', 'Termine el comando activo (Esc) o cierre el diálogo y reintente.', detalle);
    if (GONE.has(up)) return new UserError('AUTOCAD_RPC', 'Se perdió la comunicación con AutoCAD (se cerró o dejó de responder).', 'Verifique que AutoCAD siga abierto y reintente.', detalle);
    if (r.etapa === 'dibujar') return new UserError('DIBUJO_REVERTIDO', 'No se pudo dibujar; se revirtió lo creado en esta operación (sin efectos parciales).', 'Revise el detalle y reintente.', { ...detalle, revertido: !!r.revertido, capa_revertida: !!r.capa_revertida });
    if (r.etapa === 'preparar_capa') return new UserError('CAPA_NO_DISPONIBLE', 'No se pudo crear ni seleccionar la capa; no se dibujó nada.', 'Pruebe otro nombre de capa o revise que el dibujo no esté bloqueado.', detalle);
    return new UserError('AUTOCAD_ERROR', 'AutoCAD no pudo completar la operación.', 'Revise que el dibujo esté activo y sin comandos en curso; el detalle indica la etapa.', detalle);
  }

  async estado() { return this.#exec('estado'); }

  /** Estado + clasificación de la ubicación del documento (sin devolver rutas fuera de Tannia Workspace). */
  async estadoSeguro() {
    const st = await this.estado();
    const { ruta, ...resto } = st;
    return { ...resto, ubicacion_documento: this.clasificarDocumento(ruta) };
  }

  clasificarDocumento(ruta) {
    const base = { guardado_en_disco: false };
    if (typeof ruta !== 'string' || !path.win32.isAbsolute(ruta) && !path.isAbsolute(ruta)) return { ...base, clase: 'sin_guardar' };
    const p = normalizarRuta(ruta);
    let real; try { real = fs.realpathSync.native(p); } catch { return { clase: 'no_resoluble', guardado_en_disco: false, contiene_caracter_reemplazo: p.includes('\uFFFD') }; }
    const home = this.sandbox.proyectos; let homeReal; try { homeReal = fs.realpathSync.native(home); } catch { return { clase: 'otra_ubicacion', guardado_en_disco: true }; }
    if (!isInside(homeReal, real)) return { clase: 'fuera_de_tannia', guardado_en_disco: true };
    const rel = path.relative(homeReal, real).split(path.sep);
    const [proyecto, carpeta, ...resto] = rel;
    const clase = carpeta === FOLDERS.originales ? 'original' : carpeta === FOLDERS.trabajo ? 'trabajo' : 'proyecto_otra_carpeta';
    return { clase, guardado_en_disco: true, proyecto, ruta_relativa: [carpeta, ...resto].join('/') };
  }

  async listarEntidades({ capa, maximo = 500, medidas = false } = {}) {
    if (capa !== undefined && !LAYER.test(capa)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido.');
    return this.#exec('listar', { capa: capa || null, maximo: Math.min(Math.max(1, maximo | 0), 5000), medidas: !!medidas });
  }

  async medirEntidad(handle) {
    if (!HANDLE.test(String(handle))) throw new UserError('DATO_INVALIDO', 'Handle no válido.');
    return this.#exec('medir', { handle: String(handle) });
  }

  /**
   * Autoriza una ruta de documento para abrir/escribir. Falla CERRADO. Devuelve la ruta real.
   * Códigos: ORIGINAL_PROTEGIDO (está en 02 Originales), DOCUMENTO_FUERA_DE_TRABAJO, DOCUMENTO_FUERA_DEL_PROYECTO,
   * DOCUMENTO_NO_GUARDADO, DOCUMENTO_NO_ENCONTRADO (incluye ruta ilegible/corrupta).
   */
  #assertWorkCopy(project, ruta) {
    const root = this.sandbox.projectRoot(project);
    if (typeof ruta !== 'string' || ruta.length === 0 || !(path.win32.isAbsolute(ruta) || path.isAbsolute(ruta))) {
      throw new UserError('DOCUMENTO_NO_GUARDADO', 'El dibujo activo todavía no está guardado en disco.', 'Guarde el dibujo como copia dentro de "03 Trabajo" (use tannia_copia_trabajo) y ábralo con tannia_cad_abrir_copia.');
    }
    const p = normalizarRuta(ruta);
    let real;
    try { real = fs.realpathSync.native(p); }
    catch {
      throw new UserError('DOCUMENTO_NO_ENCONTRADO', 'No se pudo ubicar en disco el dibujo activo; por seguridad no se escribe.', 'Si el nombre tiene caracteres especiales, reporte este error: es un defecto del producto, no renombre carpetas.',
        { motivo: 'ruta_no_resoluble', contiene_caracter_reemplazo: p.includes('\uFFFD'), contiene_no_ascii: /[^\u0000-\u007f]/.test(p), longitud: p.length });
    }
    const trabajo = path.join(root, FOLDERS.trabajo);
    if (isInside(path.join(root, FOLDERS.originales), real)) throw new UserError('ORIGINAL_PROTEGIDO', 'El dibujo activo es un original (o un enlace a uno): no se modifica. Trabaje sobre una copia en "03 Trabajo".', 'Cree una copia con tannia_copia_trabajo y ábrala con tannia_cad_abrir_copia.');
    if (!isInside(trabajo, real)) {
      if (isInside(root, real)) throw new UserError('DOCUMENTO_FUERA_DE_TRABAJO', 'El dibujo activo está dentro del proyecto pero no en "03 Trabajo".', 'Solo se editan copias de "03 Trabajo".');
      throw new UserError('DOCUMENTO_FUERA_DEL_PROYECTO', 'El dibujo activo no pertenece al proyecto indicado.', 'Abra con tannia_cad_abrir_copia una copia de este proyecto o indique el proyecto correcto.');
    }
    if (!/\.(dwg|dxf)$/i.test(real)) throw new UserError('TIPO_NO_PERMITIDO', 'Solo se abren archivos .dwg o .dxf.');
    return real;
  }

  async abrirCopia(project, rel) {
    const { abs } = this.sandbox.resolve(project, rel);
    const real = this.#assertWorkCopy(project, abs);
    return this.#exec('abrir_copia', { ruta: real });
  }

  async agregarLineas(project, { lineas, capa }) {
    if (!Array.isArray(lineas) || lineas.length < 1 || lineas.length > 100) throw new UserError('DATO_INVALIDO', 'Indique entre 1 y 100 líneas.');
    for (const l of lineas) for (const k of ['x1', 'y1', 'x2', 'y2']) if (!Number.isFinite(l?.[k])) throw new UserError('DATO_INVALIDO', 'Coordenadas no válidas.');
    if (capa !== undefined && capa !== null && !LAYER.test(capa)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido (sin \\ / : * ? " < > | ; , = \' `).');
    const st = await this.estado();
    this.#assertWorkCopy(project, st.ruta); // el documento ACTIVO debe ser copia de trabajo (verificación 1, en Node)
    const r = await this.#exec('agregar_lineas', { lineas: lineas.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 })), capa: capa || null, ruta_esperada: st.ruta }); // verificación 2, en PowerShell
    const handles = r.handles || [];
    return { ...r, handles, cantidad: handles.length };
  }

  agregarLinea(project, { x1, y1, x2, y2, capa }) { return this.agregarLineas(project, { lineas: [{ x1, y1, x2, y2 }], capa }); }
}
