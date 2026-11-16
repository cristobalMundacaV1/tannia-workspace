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
import { gzipSync } from 'node:zlib';
import { UserError } from '../mcp/util.js';
import { FOLDERS, isInside } from '../security/sandbox.js';
import { sanitizar } from './sanitize.js';
import { analizarContornoDeLineas } from './geometry_check.js';
import { compararLecturas, coherenciaInterna, firmasDesdeDxf, firmasDesdeCom, compararFidelidad, clasificarTextos, compararSolidos } from './fidelidad.js';
import { parseDxf } from '../dxf/reader.js';
import { dxfDecode } from '../design/salidas.js';
import { sha256File } from '../security/sandbox.js';

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
function DNum($v) { if ($null -eq $v) { return $null }; try { return [double]$v } catch { return $null } }
function DArr($v) { if ($null -eq $v) { return $null }; try { return @([double[]]$v) } catch { return $null } }
function DBool($v) { if ($null -eq $v) { return $null }; try { return [bool]$v } catch { return $null } }
# Lectura TIPADA: solo propiedades que EXISTEN para ese tipo de entidad. Una propiedad inexistente queda $null (nunca 0):
# [double]$null es 0 en PowerShell, y esa conversión daba "longitud 0" en arcos, textos y polilíneas.
function LeerEnt($e, $h) {
  $tipo = [string]$e.ObjectName
  $o = @{ handle = [string]$h; tipo = $tipo; capa = [string]$e.Layer }
  switch ($tipo) {
    'AcDbLine' { $o.inicio = DArr $e.StartPoint; $o.fin = DArr $e.EndPoint; $o.longitud = DNum $e.Length }
    'AcDbArc' { $o.centro = DArr $e.Center; $o.radio = DNum $e.Radius; $o.angulo_inicio = DNum $e.StartAngle; $o.angulo_fin = DNum $e.EndAngle; $o.longitud_arco = DNum $e.ArcLength; $o.inicio = DArr $e.StartPoint; $o.fin = DArr $e.EndPoint }
    'AcDbCircle' { $o.centro = DArr $e.Center; $o.radio = DNum $e.Radius; $o.area = DNum $e.Area }
    'AcDbPolyline' { $o.coordenadas = DArr $e.Coordinates; $o.cerrada = DBool $e.Closed; $o.longitud = DNum $e.Length; $o.area = DNum $e.Area }
    'AcDb2dPolyline' { $o.coordenadas = DArr $e.Coordinates; $o.cerrada = DBool $e.Closed; $o.longitud = DNum $e.Length; $o.area = DNum $e.Area }
    'AcDbText' { $o.texto = [string]$e.TextString; $o.posicion = DArr $e.InsertionPoint; $o.alineacion = DNum $e.Alignment; $o.punto_alineacion = DArr $e.TextAlignmentPoint; $o.altura = DNum $e.Height; $o.rotacion = DNum $e.Rotation }
    'AcDbMText' { $o.texto = [string]$e.TextString; $o.posicion = DArr $e.InsertionPoint; $o.altura = DNum $e.Height; $o.rotacion = DNum $e.Rotation }
    'AcDb3dSolid' { $o.volumen = DNum $e.Volume; $o.centroide = DArr $e.Centroid; $mn = $null; $mx = $null; try { $e.GetBoundingBox([ref]$mn, [ref]$mx); $o.bbox_min = DArr $mn; $o.bbox_max = DArr $mx } catch { } }
    default { $o.sin_propiedades_conocidas = $true }
  }
  return $o
}
$raw = $env:TANNIA_IN
if ($env:TANNIA_IN_STDIN -eq '1') { $ms = New-Object IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($ms); $raw = [Text.Encoding]::ASCII.GetString($ms.ToArray()).Trim() }
$in = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($raw)) | ConvertFrom-Json
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
$doc = $null
`;
// Resolución del documento de trabajo: por RUTA esperada cuando se indica (no depende de cuál esté activo) y, si no, el activo.
// Los scripts que crean o abren dibujos (SIN_DOCUMENTO_PREVIO) no lo necesitan: funcionan con AutoCAD abierto y cero documentos.
export const PS_DOC = `function NormRuta($p) { try { return [IO.Path]::GetFullPath([string]$p).TrimEnd([char]92) } catch { return [string]$p } }
if ($in.ruta_esperada) {
  # IDENTIDAD DOCUMENTAL: se localiza EXACTAMENTE ese documento por su ruta; si no está abierto se FALLA. Jamás se recurre al documento activo.
  $esperada = NormRuta $in.ruta_esperada; $doc = $null
  $nd0 = [int]$acad.Documents.Count
  for ($i0 = 0; $i0 -lt $nd0; $i0++) { $d0 = $acad.Documents.Item($i0); if ((NormRuta $d0.FullName) -ieq $esperada) { $doc = $d0; break } }
  if ($null -eq $doc) { Emit @{ ok = $false; etapa = 'localizar_documento'; codigo = 'DOCUMENTO_NO_ABIERTO'; abiertos = $nd0 }; exit 0 }
} else {
  if ($null -eq $doc) { try { $doc = $acad.ActiveDocument } catch { $doc = $null } }
  if ($null -eq $doc) { Emit @{ ok = $false; etapa = 'documento_activo'; codigo = 'SIN_DOCUMENTO' }; exit 0 }
}
`;
export const SIN_DOCUMENTO_PREVIO = new Set(['construir_3d', 'abrir_copia', 'dxf_a_dwg', 'estado']);
// Solo las lecturas pueden reintentarse si AutoCAD está ocupado: una escritura repetida podría duplicar o alterar el dibujo.
export const REINTENTO_SEGURO = new Set(['estado', 'listar', 'medir', 'leer_lote', 'enumerar', 'resumen']);

// Cuerpos estáticos: los datos del usuario viajan SOLO en $in, nunca interpolados en el script.
export const SCRIPTS = {
  estado: `$nd = [int]$acad.Documents.Count
if ($null -eq $doc) { try { $doc = $acad.ActiveDocument } catch { $doc = $null } }
if ($null -eq $doc) { Emit @{ ok = $true; data = @{ version = [string]$acad.Version; nombre = [string]$acad.Name; progid = $usado; documento = $null; ruta = $null; guardado = $null; documentos = $nd; sin_documento = $true } }; exit 0 }
$ruta = [string]$doc.FullName
Emit @{ ok = $true; data = @{ documentos = $nd; version = [string]$acad.Version; nombre = [string]$acad.Name; progid = $usado; documento = [string]$doc.Name; ruta = $ruta; guardado = [bool]$doc.Saved; unidades_insunits = $doc.GetVariable('INSUNITS') } }`,
  listar: `$total = [int]$doc.ModelSpace.Count; $items = @(); $n = 0; $trunc = $false
for ($i = 0; $i -lt $total; $i++) {
  $e = $doc.ModelSpace.Item($i)
  if ($in.capa -and ([string]$e.Layer -ne [string]$in.capa)) { continue }
  if ($n -ge $in.maximo) { $trunc = $true; break }
  $it = @{ handle = [string]$e.Handle; tipo = [string]$e.ObjectName; capa = [string]$e.Layer }
  if ($in.medidas) { $r = LeerEnt $e $e.Handle; foreach ($k in 'longitud', 'longitud_arco', 'area', 'radio') { if ($null -ne $r[$k]) { $it[$k] = $r[$k] } } }
  $items += $it; $n++
}
Emit @{ ok = $true; data = @{ entidades = $items; truncado = $trunc; total_en_dibujo = $total } }`,
  medir: `$e = $doc.HandleToObject([string]$in.handle)
$o = LeerEnt $e $in.handle
# claves históricas (rc.2 las informó con evidencia real): solo si existen, nunca 0 por ausencia
if ($null -ne $o['longitud']) { $o['Length'] = $o['longitud'] }
if ($null -ne $o['inicio']) { $o['StartPoint'] = $o['inicio'] }
if ($null -ne $o['fin']) { $o['EndPoint'] = $o['fin'] }
if ($null -ne $o['area']) { $o['Area'] = $o['area'] }
if ($null -ne $o['radio']) { $o['Radius'] = $o['radio'] }
$tt = DNum $e.TotalAngle; if ($null -ne $tt) { $o['TotalAngle'] = $tt }
if ($e.ObjectName -eq 'AcDb3dSolid' -or $e.ObjectName -eq 'AcDbRegion') { $vv = DNum $e.Volume; if ($null -ne $vv) { $o['Volume'] = $vv }; $o['Centroid'] = DArr $e.Centroid; $aa = DNum $e.Area; if ($null -ne $aa) { $o['Area'] = $aa } }
Emit @{ ok = $true; data = $o }`,
  abrir_copia: `$d = $acad.Documents.Open([string]$in.ruta, $false)
Emit @{ ok = $true; data = @{ documento = [string]$d.Name; ruta = [string]$d.FullName } }`,
  leer_lote: `$res = @()
foreach ($h in $in.handles) {
  try { $e = $doc.HandleToObject([string]$h); $res += (LeerEnt $e $h) }
  catch { $res += @{ handle = [string]$h; error = 'no_encontrada' } }
}
Emit @{ ok = $true; data = @{ entidades = $res; unidades_insunits = $doc.GetVariable('INSUNITS'); documento = [string]$doc.Name; ruta = [string]$doc.FullName } }`,
  enumerar: `$total = [int]$doc.ModelSpace.Count; $ini = [int]$in.offset; $lim = [int]$in.limite; $items = @(); $i = $ini
while ($i -lt $total -and $items.Count -lt $lim) {
  $e = $doc.ModelSpace.Item($i); $i++
  if ($in.capa -and ([string]$e.Layer -ne [string]$in.capa)) { continue }
  $items += @{ handle = [string]$e.Handle; tipo = [string]$e.ObjectName; capa = [string]$e.Layer }
}
$sig = $null; if ($i -lt $total) { $sig = $i }
Emit @{ ok = $true; data = @{ total = $total; entidades = $items; siguiente = $sig; ruta = [string]$doc.FullName } }`,
  resumen: `$nCap = [int]$doc.Layers.Count; $capas = @(); for ($i = 0; $i -lt $nCap; $i++) { $capas += [string]$doc.Layers.Item($i).Name }
$total = [int]$doc.ModelSpace.Count; $porCapa = @{}; $porTipo = @{}
for ($i = 0; $i -lt $total; $i++) {
  $e = $doc.ModelSpace.Item($i); $c = [string]$e.Layer; $t = [string]$e.ObjectName
  if ($porCapa.ContainsKey($c)) { $porCapa[$c] = $porCapa[$c] + 1 } else { $porCapa[$c] = 1 }
  if ($porTipo.ContainsKey($t)) { $porTipo[$t] = $porTipo[$t] + 1 } else { $porTipo[$t] = 1 }
}
Emit @{ ok = $true; data = @{ documento = [string]$doc.Name; ruta = [string]$doc.FullName; guardado = [bool]$doc.Saved; entidades = $total; capas = $capas; entidades_por_capa = $porCapa; entidades_por_tipo = $porTipo; unidades_insunits = $doc.GetVariable('INSUNITS') } }`,
  cerrar_reabrir: `$objetivo = $null
$nd = [int]$acad.Documents.Count
for ($i = 0; $i -lt $nd; $i++) { $d = $acad.Documents.Item($i); if ($d.FullName -eq $in.ruta_esperada) { $objetivo = $d; break } }
if ($null -eq $objetivo) { Emit @{ ok = $false; etapa = 'localizar'; codigo = 'DOCUMENTO_NO_ABIERTO' }; exit 0 }
if (-not $objetivo.Saved) { Emit @{ ok = $false; etapa = 'verificar_guardado'; codigo = 'CAMBIOS_SIN_GUARDAR' }; exit 0 }
$ruta = [string]$objetivo.FullName
try { $objetivo.Close($false) } catch { Fail 'cerrar' $_; exit 0 }
Start-Sleep -Milliseconds 400
try { $nuevo = $acad.Documents.Open($ruta, $false) } catch { $ex = Inner $_.Exception; Emit @{ ok = $false; etapa = 'reabrir'; codigo = 'REAPERTURA_FALLIDA'; hresult = (HR $ex) }; exit 0 }
try { $nuevo.Activate() } catch { }
# Instrumentación: el conteo del espacio modelo puede tardar en estar disponible tras abrir; se registra el valor inicial, el final y la espera.
$esperadas = 0; if ($null -ne $in.esperadas) { $esperadas = [int]$in.esperadas }
$inicial = [int]$nuevo.ModelSpace.Count; $final = $inicial; $espera = 0
while ($final -ne $esperadas -and $espera -lt 6000) { Start-Sleep -Milliseconds 300; $espera += 300; $final = [int]$nuevo.ModelSpace.Count }
Emit @{ ok = $true; data = @{ documento = [string]$nuevo.Name; ruta = [string]$nuevo.FullName; guardado = [bool]$nuevo.Saved; entidades = $final; conteo_inicial_tras_abrir = $inicial; espera_ms = $espera; unidades_insunits = $nuevo.GetVariable('INSUNITS') } }`,
  dxf_a_dwg: `$d = $acad.Documents.Open([string]$in.dxf, $false)
try { $d.SetVariable('INSUNITS', 4) } catch { }
# Normaliza textos: si AutoCAD dejó secuencias \\U+XXXX sin decodificar, se sustituyen por el carácter real (ñ, Ñ, tildes)
$norm = 0; $nm = [int]$d.ModelSpace.Count
for ($i = 0; $i -lt $nm; $i++) {
  $e = $d.ModelSpace.Item($i); $tt = [string]$e.ObjectName
  if ($tt -eq 'AcDbText' -or $tt -eq 'AcDbMText') {
    $s = [string]$e.TextString
    if ($s -match '\\\\U\\+[0-9A-Fa-f]{4}') { $e.TextString = [regex]::Replace($s, '\\\\U\\+([0-9A-Fa-f]{4})', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 16) }); $norm++ }
  }
}
try { $d.SaveAs([string]$in.dwg, 64) } catch { $d.SaveAs([string]$in.dwg) }
$nCap = [int]$d.Layers.Count; $capas = @(); for ($i = 0; $i -lt $nCap; $i++) { $capas += [string]$d.Layers.Item($i).Name }
$total = [int]$d.ModelSpace.Count; $porCapa = @{}
for ($i = 0; $i -lt $total; $i++) { $c = [string]$d.ModelSpace.Item($i).Layer; if ($porCapa.ContainsKey($c)) { $porCapa[$c] = $porCapa[$c] + 1 } else { $porCapa[$c] = 1 } }
Emit @{ ok = $true; data = @{ documento = [string]$d.Name; ruta = [string]$d.FullName; entidades = $total; capas = $capas; entidades_por_capa = $porCapa; textos_normalizados = $norm; unidades_insunits = $d.GetVariable('INSUNITS') } }`,
  // ---- Modelo 3D: sólidos (AddBox / AddWedge), vista y transformación. Los datos viajan SOLO en $in. ----
  construir_3d: `function P3($x, $y, $z) { $a = New-Object 'double[]' 3; $a[0] = [double]$x; $a[1] = [double]$y; $a[2] = [double]$z; return ,$a }
function Centrar($s, $obj) {
  $cen = DArr $s.Centroid
  if ($null -eq $cen) { return $false }
  if ([math]::Abs($obj[0] - $cen[0]) -gt 1e-6 -or [math]::Abs($obj[1] - $cen[1]) -gt 1e-6 -or [math]::Abs($obj[2] - $cen[2]) -gt 1e-6) { $s.Move((P3 $cen[0] $cen[1] $cen[2]), (P3 $obj[0] $obj[1] $obj[2])) }
  return $true
}
function CajaEnv($s) { $mn = $null; $mx = $null; $s.GetBoundingBox([ref]$mn, [ref]$mx); return @((DArr $mn), (DArr $mx)) }
function CrearCuna($ms, $p) {
  $horiz = ($p.alto_lado -eq '-x' -or $p.alto_lado -eq '+x')
  $A = [double]$p.dy; $B = [double]$p.dx; if ($horiz) { $A = [double]$p.dx; $B = [double]$p.dy }
  $c0 = P3 $p.centro_inicial[0] $p.centro_inicial[1] $p.centro_inicial[2]
  $s = $ms.AddWedge($c0, $A, $B, [double]$p.dz)
  $ev = CajaEnv $s; $cen = DArr $s.Centroid
  $hx = $cen[0] - ($ev[0][0] + $ev[1][0]) / 2; $hy = $cen[1] - ($ev[0][1] + $ev[1][1]) / 2
  if ([math]::Abs($hy) -gt [math]::Abs($hx)) {
    $s.Delete(); $s = $ms.AddWedge($c0, $B, $A, [double]$p.dz)
    $ev = CajaEnv $s; $cen = DArr $s.Centroid
    $hx = $cen[0] - ($ev[0][0] + $ev[1][0]) / 2; $hy = $cen[1] - ($ev[0][1] + $ev[1][1]) / 2
  }
  $have = 0; if ([math]::Abs($hx) -ge [math]::Abs($hy)) { if ($hx -lt 0) { $have = 180 } } else { if ($hy -ge 0) { $have = 90 } else { $have = 270 } }
  $want = 0; if ($p.alto_lado -eq '-x') { $want = 180 } elseif ($p.alto_lado -eq '+y') { $want = 90 } elseif ($p.alto_lado -eq '-y') { $want = 270 }
  $giro = (($want - $have) % 360 + 360) % 360
  if ($giro -ne 0) { $s.Rotate((P3 (($ev[0][0] + $ev[1][0]) / 2) (($ev[0][1] + $ev[1][1]) / 2) 0), $giro * [math]::PI / 180) }
  return $s
}
$d = $null
try {
  $d = $acad.Documents.Add()
  try { $d.SetVariable('INSUNITS', 4) } catch { }
  foreach ($c in $in.capas) { $l = $d.Layers.Add([string]$c.nombre); try { $l.color = [int]$c.color } catch { } }
  $ms = $d.ModelSpace; $mapa = @(); $lect = @(); $centrado = $true
  foreach ($p in $in.primitivas) {
    if ($p.tipo -eq 'cuna') { $s = CrearCuna $ms $p }
    else { $s = $ms.AddBox((P3 $p.centro_inicial[0] $p.centro_inicial[1] $p.centro_inicial[2]), [double]$p.dx, [double]$p.dy, [double]$p.dz) }
    $ok = Centrar $s (P3 $p.centro_inicial[0] $p.centro_inicial[1] $p.centro_inicial[2])
    if (-not $ok) { $centrado = $false }
    if ($p.tipo -eq 'caja' -and [double]$p.rot_deg -ne 0) { $s.Rotate((P3 $p.rot_centro[0] $p.rot_centro[1] 0), [double]$p.rot_deg * [math]::PI / 180) }
    if ($p.tipo -eq 'cuna') { $null = Centrar $s (P3 $p.esperado.centroide[0] $p.esperado.centroide[1] $p.esperado.centroide[2]) }
    $s.Layer = [string]$p.capa
    $mapa += @{ id = [string]$p.id; handle = [string]$s.Handle }
    $lect += (LeerEnt $s ([string]$s.Handle))
  }
  $t = $ms.AddText([string]$in.nota, (P3 $in.nota_pos[0] $in.nota_pos[1] $in.nota_pos[2]), 200.0); $t.Layer = 'TW3D_NOTAS'
  foreach ($c in $in.capas) { if (-not $c.visible) { $d.Layers.Item([string]$c.nombre).LayerOn = $false } }
  $vista = @{ aplicada = $false }
  try {
    $vp = $d.ActiveViewport; $vp.Direction = (P3 $in.vista_dir[0] $in.vista_dir[1] $in.vista_dir[2]); $d.ActiveViewport = $vp
    $acad.ZoomExtents(); $dir = DArr $d.ActiveViewport.Direction; $vista = @{ aplicada = $true; direccion = $dir }
  } catch { $vista = @{ aplicada = $false; error = [string](Inner $_.Exception).Message } }
  $estilo = 'no_solicitado'
  if ($in.estilo_cmd) { try { $d.SendCommand([string]$in.estilo_cmd); $estilo = 'solicitado' } catch { $estilo = 'fallo' } }
  try { $d.SaveAs([string]$in.dwg, 64) } catch { $d.SaveAs([string]$in.dwg) }
} catch {
  $err = $_
  try { if ($null -ne $d) { $d.Close($false) } } catch { }
  Fail 'construir_3d' $err; exit 0
}
$nCap = [int]$d.Layers.Count; $capas = @(); for ($i = 0; $i -lt $nCap; $i++) { $capas += [string]$d.Layers.Item($i).Name }
$total = [int]$d.ModelSpace.Count; $porCapa = @{}
for ($i = 0; $i -lt $total; $i++) { $cc = [string]$d.ModelSpace.Item($i).Layer; if ($porCapa.ContainsKey($cc)) { $porCapa[$cc] = $porCapa[$cc] + 1 } else { $porCapa[$cc] = 1 } }
Emit @{ ok = $true; data = @{ documento = [string]$d.Name; ruta = [string]$d.FullName; entidades = $total; capas = $capas; entidades_por_capa = $porCapa; mapa = $mapa; lecturas = $lect; centroide_informado = $centrado; vista = $vista; estilo = $estilo; unidades_insunits = $d.GetVariable('INSUNITS') } }`,
  vista_3d: `if ($doc.FullName -ne $in.ruta_esperada) { Emit @{ ok = $false; etapa = 'verificar_documento'; codigo = 'DOCUMENTO_CAMBIO' }; exit 0 }
foreach ($n in $in.mostrar) { $doc.Layers.Item([string]$n).LayerOn = $true }
foreach ($n in $in.ocultar) { $doc.Layers.Item([string]$n).LayerOn = $false }
$vp = $doc.ActiveViewport; $vp.Direction = [double[]]@([double]$in.dir[0], [double]$in.dir[1], [double]$in.dir[2]); $doc.ActiveViewport = $vp
$acad.ZoomExtents()
$estilo = 'no_solicitado'
if ($in.estilo_cmd) { try { $doc.SendCommand([string]$in.estilo_cmd); $estilo = 'solicitado' } catch { $estilo = 'fallo' } }
$dir = DArr $doc.ActiveViewport.Direction
$nCap = [int]$doc.Layers.Count; $vis = @{}; for ($i = 0; $i -lt $nCap; $i++) { $l = $doc.Layers.Item($i); $vis[[string]$l.Name] = [bool]$l.LayerOn }
Emit @{ ok = $true; data = @{ documento = [string]$doc.Name; direccion_vista = $dir; estilo = $estilo; capas_visibles = $vis } }`,
  transformar_solido: `if ($doc.FullName -ne $in.ruta_esperada) { Emit @{ ok = $false; etapa = 'verificar_documento'; codigo = 'DOCUMENTO_CAMBIO' }; exit 0 }
$e = $doc.HandleToObject([string]$in.handle)
if ([string]$e.ObjectName -ne 'AcDb3dSolid') { Emit @{ ok = $false; etapa = 'verificar_entidad'; codigo = 'NO_ES_SOLIDO' }; exit 0 }
$antes = LeerEnt $e $in.handle
$doc.StartUndoMark()
try {
  if ($in.operacion -eq 'mover') { $e.Move((New-Object 'double[]' 3), [double[]]@([double]$in.dx, [double]$in.dy, [double]$in.dz)) }
  elseif ($in.operacion -eq 'rotar_z') { $e.Rotate([double[]]@([double]$in.cx, [double]$in.cy, 0.0), [double]$in.grados * [math]::PI / 180) }
} finally { $doc.EndUndoMark() }
$despues = LeerEnt $e $in.handle
if ($in.guardar) { $doc.Save() }
Emit @{ ok = $true; data = @{ antes = $antes; despues = $despues; guardado = [bool]$in.guardar; guardado_en_disco = [bool]$doc.Saved } }`,
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
  return `${PS_PRELUDE}${connect}${SIN_DOCUMENTO_PREVIO.has(name) ? '' : PS_DOC}try {\n${SCRIPTS[name]}\n} catch { Fail 'operacion_${name}' $_; exit 0 }\n`;
}

const MARCA = /TANNIA_OUT:([A-Za-z0-9+/=]+)/g;

/** Ejecuta PowerShell y devuelve el JSON (texto) emitido por el script. Errores con `clase` segura y diagnóstico saneado. */
// Límites de Windows: la línea de comandos admite ~32 767 caracteres y cada variable de entorno también. Los scripts 3D y las entradas
// grandes (cientos de sólidos) los superan: el script va comprimido (gzip+base64) en una variable y se ejecuta con un arranque fijo;
// una entrada grande viaja por la entrada estándar (base64 ASCII). Los scripts pequeños siguen yendo como -EncodedCommand directo.
export const LIMITE_COMANDO = 12000; export const LIMITE_ENTRADA_ENV = 12000;
const ARRANQUE = "$b=[Convert]::FromBase64String($env:TANNIA_SCRIPT_GZ);$m=New-Object IO.MemoryStream(,$b);$g=New-Object IO.Compression.GZipStream($m,[IO.Compression.CompressionMode]::Decompress);$r=New-Object IO.StreamReader($g,[Text.Encoding]::UTF8);$s=$r.ReadToEnd();. ([scriptblock]::Create($s))";
export function prepararLlamada(script, input) {
  const entradaB64 = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
  let comando = Buffer.from(script, 'utf16le').toString('base64'); const env = {};
  if (comando.length > LIMITE_COMANDO) { env.TANNIA_SCRIPT_GZ = gzipSync(Buffer.from(script, 'utf8'), { level: 9 }).toString('base64'); comando = Buffer.from(ARRANQUE, 'utf16le').toString('base64'); }
  let stdin = null;
  if (entradaB64.length > LIMITE_ENTRADA_ENV) { env.TANNIA_IN_STDIN = '1'; stdin = entradaB64; } else env.TANNIA_IN = entradaB64;
  return { comando, env, stdin };
}
export function runPowerShell(script, input, { exe = 'powershell.exe', env = {}, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const llamada = prepararLlamada(script, input);
    let child;
    try {
      child = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', llamada.comando], {
        env: { ...process.env, ...env, ...llamada.env },
        windowsHide: true, stdio: [llamada.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      });
      if (llamada.stdin) { child.stdin.on('error', () => { /* el proceso pudo terminar antes de leer */ }); child.stdin.end(llamada.stdin); }
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

const MAX_ENTIDADES = 20000;
/** Direcciones de vista (vector del objetivo hacia la cámara, como VPOINT). */
export const VISTAS = { iso_so: [-1, -1, 1], iso_se: [1, -1, 1], iso_ne: [1, 1, 1], iso_no: [-1, 1, 1], planta: [0, 0, 1], frontal: [0, -1, 0], lateral_derecha: [1, 0, 0], posterior: [0, 1, 0], lateral_izquierda: [-1, 0, 0] };
/** Comandos de estilo visual (se envían como comando; no es verificable por COM: se pide confirmación visual). */
export const ESTILOS = { conceptual: '_.VSCURRENT _Conceptual ', realista: '_.VSCURRENT _Realistic ', oculto: '_.VSCURRENT _Hidden ', alambre: '_.VSCURRENT _Wireframe ', '2d': '_.VSCURRENT _2dwireframe ' };

/** Entidades del DXF por capa (el reader entrega 1 por POLYLINE, igual que ModelSpace.Count en AutoCAD). */
export function conteoPorCapa(dxf) { const c = {}; for (const e of dxf.entities) c[e.layer] = (c[e.layer] || 0) + 1; return c; }

/** Capas y conteos esperados (DXF) frente a lo informado por AutoCAD. Una lista de capas vacía se considera NO informada. */
export function verificarEstructura(esperado, r) {
  const informadas = r.entidades_por_capa || {}; const capas = r.capas || [];
  const faltantes = Object.keys(esperado).filter((c) => !capas.includes(c));
  const dif = [];
  for (const c of new Set([...Object.keys(esperado), ...Object.keys(informadas)])) { if (c === '0') continue; if ((esperado[c] || 0) !== (informadas[c] || 0)) dif.push({ capa: c, esperadas: esperado[c] || 0, informadas: informadas[c] || 0 }); }
  const totalE = Object.values(esperado).reduce((a, b) => a + b, 0); const totalI = r.entidades ?? Object.values(informadas).reduce((a, b) => a + b, 0);
  return { ok: capas.length > 0 && !faltantes.length && !dif.length && totalE === totalI, capas_informadas: capas, capas_no_informadas: capas.length === 0, capas_faltantes: faltantes, diferencias_conteo: dif, total_esperado: totalE, total_informado: totalI };
}

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

/** Normaliza una ruta de Windows devuelta por AutoCAD (prefijo \\?\, barras) sin cambiar su contenido. */
export function normalizarRuta(p) {
  let t = String(p);
  if (t.startsWith('\\\\?\\UNC\\')) t = `\\\\${t.slice(8)}`;
  else if (t.startsWith('\\\\?\\')) t = t.slice(4);
  return t.normalize('NFC');
}

/** Exige que la respuesta CONFIRME haber leído el documento pedido (defensa en profundidad frente a un script que lea otro dibujo). */
function confirmarRuta(r, esperada, accion) {
  if (!esperada) return r;
  if (!r || typeof r.ruta !== 'string' || !r.ruta) throw new UserError('DOCUMENTO_NO_CONFIRMADO', `AutoCAD no confirmó de qué documento leyó (${accion}); por seguridad no se acepta el resultado.`, 'Repita; si persiste, ejecute el diagnóstico y reporte este error.');
  if (normalizarRuta(r.ruta).toLowerCase() !== normalizarRuta(esperada).toLowerCase()) throw new UserError('DOCUMENTO_DISTINTO', `La lectura (${accion}) provino de un documento distinto del pedido; se descarta para no mezclar dibujos.`, 'Active la copia indicada y repita.', { documento_leido: path.basename(normalizarRuta(r.ruta)).slice(0, 80), documento_esperado: path.basename(normalizarRuta(esperada)).slice(0, 80) });
  return r;
}
const mismaRuta = (a, b) => normalizarRuta(String(a || '')).toLowerCase() === normalizarRuta(String(b || '')).toLowerCase();
/**
 * Comprobación GLOBAL de una reapertura: ningún conteo informado puede contradecir a otro y el espacio modelo debe ser el mismo en
 * ambos sentidos (nada falta, nada nuevo). Un `SHA` idéntico o la lectura correcta de algunos handles NO sustituyen esto.
 */
export function comprobarGlobal({ resumenAntes, todosAntes, resumenDespues, todosDespues, cierre, rutaEsperada, rutaDespues }) {
  const problemas = []; const noVerif = [];
  const n = (v) => (Number.isInteger(v) ? v : null);
  const conteos = { antes_resumen: n(resumenAntes.entidades), antes_enumerado: todosAntes.length, despues_reapertura: n(cierre.entidades), despues_resumen: n(resumenDespues.entidades), despues_enumerado: todosDespues.length };
  const base = conteos.antes_enumerado;
  for (const [k, v] of Object.entries(conteos)) {
    if (v === null) { noVerif.push({ aspecto: `conteo_${k}`, motivo: 'AutoCAD no informó el valor' }); continue; }
    if (v !== base) problemas.push({ problema: 'conteo_global_distinto', fuente: k, esperado: base, informado: v });
  }
  if (base > 0 && todosDespues.length === 0) problemas.push({ problema: 'reapertura_sin_entidades', antes: base, despues: 0 });
  if (!mismaRuta(rutaDespues, rutaEsperada)) problemas.push({ problema: 'documento_reabierto_distinto', esperado: 'ruta del documento cerrado', informado: 'otra ruta' });
  const A = new Set(todosAntes.map((e) => String(e.handle).toUpperCase())); const D = new Set(todosDespues.map((e) => String(e.handle).toUpperCase()));
  const faltan = [...A].filter((h) => !D.has(h)); const nuevos = [...D].filter((h) => !A.has(h));
  if (faltan.length) problemas.push({ problema: 'handles_ausentes_tras_reabrir', total: faltan.length, muestra: faltan.slice(0, 20) });
  if (nuevos.length) problemas.push({ problema: 'handles_nuevos_tras_reabrir', total: nuevos.length, muestra: nuevos.slice(0, 20) });
  const ca = resumenAntes.entidades_por_capa || {}; const cd = resumenDespues.entidades_por_capa || {};
  const dif = [...new Set([...Object.keys(ca), ...Object.keys(cd)])].filter((c) => (ca[c] || 0) !== (cd[c] || 0)).map((c) => ({ capa: c, antes: ca[c] || 0, despues: cd[c] || 0 }));
  if (dif.length) problemas.push({ problema: 'conteo_por_capa_distinto', capas: dif.slice(0, 20) });
  const estado = problemas.length ? 'fallida' : noVerif.length ? 'no_concluyente' : 'verificada';
  return { estado, conteos, problemas, no_verificables: noVerif, handles: { antes: A.size, despues: D.size, ausentes: faltan.length, nuevos: nuevos.length }, documento_identico: mismaRuta(rutaDespues, rutaEsperada) };
}

export class AutoCadCom {
  constructor({ sandbox, runner, platform = process.platform, connect, sleep = sleepReal } = {}) {
    this.sandbox = sandbox; this.platform = platform; this.connect = connect; this.sleep = sleep;
    this.runner = runner || ((script, input, opts) => runPowerShell(script, input, opts));
  }

  async #exec(name, input = {}, opts = {}) {
    if (this.platform !== 'win32') throw new UserError('AUTOCAD_NO_DISPONIBLE', 'La conexión con AutoCAD solo existe en Windows con AutoCAD completo.', 'Use la exportación DXF para medir sin AutoCAD.');
    const script = buildScript(name, this.connect ? { connect: this.connect } : undefined);
    for (let intento = 0; ; intento++) {
      let out;
      try { out = await this.runner(script, input, opts); }
      catch (e) { throw this.#errorProceso(e); }
      let r; try { r = JSON.parse(String(out).trim()); } catch { throw new UserError('AUTOCAD_RESPUESTA_INVALIDA', 'AutoCAD respondió de forma inesperada.', 'Reintente; si persiste, ejecute el diagnóstico.', { etapa: 'interpretar_respuesta' }); }
      if (r.ok) return r.data;
      if (BUSY.has(String(r.hresult).toUpperCase().replace(/^0X/, '0x')) && intento < 2 && REINTENTO_SEGURO.has(name)) { await this.sleep(700 * (intento + 1)); continue; }
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
    if (r.codigo === 'CAMBIOS_SIN_GUARDAR') return new UserError('CAMBIOS_SIN_GUARDAR', 'La copia tiene cambios sin guardar: no se cierra para no perderlos.', 'Guárdela en AutoCAD y repita.', detalle);
    if (r.codigo === 'DOCUMENTO_NO_ABIERTO') return new UserError('DOCUMENTO_NO_ABIERTO', 'La copia indicada no está abierta en AutoCAD.', 'Ábrala con tannia_cad_abrir_copia.', detalle);
    if (r.codigo === 'REAPERTURA_FALLIDA') return new UserError('REAPERTURA_FALLIDA', 'Se cerró la copia pero no se pudo reabrir. El archivo en disco no se modificó.', 'Ábrala manualmente desde 03 Trabajo y repita la verificación.', { ...detalle, lecturas_previas: r.antes || [] });
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
  /** Estado exigiendo un dibujo abierto (las operaciones sobre el dibujo no tienen sentido con AutoCAD abierto y cero documentos). */
  async #estadoDoc() {
    const st = await this.estado();
    if (st.sin_documento) throw new UserError('AUTOCAD_SIN_DOCUMENTO', 'AutoCAD está abierto pero no tiene ningún dibujo abierto.', 'Abra la copia de trabajo con tannia_cad_abrir_copia (o un dibujo en AutoCAD) y repita.', { documentos_abiertos: st.documentos ?? 0 });
    return st;
  }

  /** Estado + clasificación de la ubicación del documento (sin devolver rutas fuera de Tannia Workspace). */
  async estadoSeguro() {
    const st = await this.estado();
    const { ruta, ...resto } = st;
    return { ...resto, ubicacion_documento: st.sin_documento ? { clase: 'sin_documento', guardado_en_disco: false } : this.clasificarDocumento(ruta) };
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
    const st = await this.#estadoDoc();
    return this.#exec('listar', { capa: capa || null, maximo: Math.min(Math.max(1, maximo | 0), 5000), medidas: !!medidas, ruta_esperada: st.ruta });
  }

  async medirEntidad(handle) {
    if (!HANDLE.test(String(handle))) throw new UserError('DATO_INVALIDO', 'Handle no válido.');
    const st = await this.#estadoDoc();
    return this.#exec('medir', { handle: String(handle), ruta_esperada: st.ruta });
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
    const st = await this.#estadoDoc();
    this.#assertWorkCopy(project, st.ruta); // el documento ACTIVO debe ser copia de trabajo (verificación 1, en Node)
    const r = await this.#exec('agregar_lineas', { lineas: lineas.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 })), capa: capa || null, ruta_esperada: st.ruta }); // verificación 2, en PowerShell
    const handles = r.handles || [];
    return { ...r, handles, cantidad: handles.length, creado_en: new Date().toISOString() };
  }

  /**
   * Lectura TIPADA por lotes (evita timeouts con muchas entidades): cada lote es una llamada COM independiente con su propio
   * tiempo límite proporcional. Devuelve solo propiedades que existen para cada tipo (nunca 0 por ausencia).
   */
  async leerLote(handles, { tam = 150, ruta } = {}) {
    if (!Array.isArray(handles) || !handles.every((h) => HANDLE.test(String(h)))) throw new UserError('DATO_INVALIDO', 'Handles no válidos (hexadecimales).');
    if (handles.length > MAX_ENTIDADES) throw new UserError('DEMASIADAS_ENTIDADES', `Máximo ${MAX_ENTIDADES} entidades por verificación.`);
    const tamano = Math.min(Math.max(10, tam | 0), 400); const entidades = []; let lotes = 0; let unidades = null;
    for (let i = 0; i < handles.length; i += tamano) {
      const trozo = handles.slice(i, i + tamano).map(String);
      const r = confirmarRuta(await this.#exec('leer_lote', { handles: trozo, ruta_esperada: ruta || null }, { timeoutMs: 30000 + trozo.length * 80 }), ruta, 'leer_lote');
      entidades.push(...r.entidades); unidades = r.unidades_insunits; lotes++;
    }
    return { entidades, lotes, tam_lote: tamano, unidades_insunits: unidades };
  }

  /** Enumera handles del espacio modelo por páginas (índices, no `foreach` COM). */
  async enumerarHandles({ capa, pagina = 500, ruta } = {}) {
    if (capa !== undefined && capa !== null && !LAYER.test(capa)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido.');
    const entidades = []; let offset = 0; let total = 0;
    for (let n = 0; n < 1000; n++) {
      const r = confirmarRuta(await this.#exec('enumerar', { capa: capa || null, offset, limite: pagina, ruta_esperada: ruta || null }, { timeoutMs: 60000 }), ruta, 'enumerar');
      total = r.total; entidades.push(...r.entidades);
      if (entidades.length > MAX_ENTIDADES) throw new UserError('DEMASIADAS_ENTIDADES', `El dibujo tiene más de ${MAX_ENTIDADES} entidades en el alcance pedido; acote por capa.`);
      if (r.siguiente == null) break; offset = r.siguiente;
    }
    return { total_en_dibujo: total, entidades };
  }

  /** Lee StartPoint/EndPoint/Length/capa (y las propiedades propias de cada tipo) de las entidades indicadas (solo lectura). */
  /** Resumen del documento (conteos y capas) localizado por ruta y confirmado. */
  async resumenDocumento(ruta) { return confirmarRuta(await this.#exec('resumen', { ruta_esperada: ruta || null }, { timeoutMs: 60000 }), ruta, 'resumen'); }

  async leerGeometria(handles) {
    if (!Array.isArray(handles) || handles.length < 1 || handles.length > 200 || !handles.every((h) => HANDLE.test(String(h)))) throw new UserError('DATO_INVALIDO', 'Indique de 1 a 200 handles válidos (hexadecimales).');
    const st = await this.#estadoDoc(); // se lee el documento activo en este momento, confirmado por ruta (un cambio de foco a mitad de camino se detecta)
    return this.leerLote(handles, { ruta: st.ruta });
  }

  /** Lee los extremos desde AutoCAD y comprueba cierre/rectangularidad/medidas con un cálculo independiente en Node. */
  async verificarContorno(handles, { ancho, alto, tolerancia } = {}) {
    const lectura = await this.leerGeometria(handles);
    const noLineas = lectura.entidades.filter((e) => !e.error && e.tipo && !/Line$/i.test(e.tipo));
    const analisis = analizarContornoDeLineas(lectura.entidades, { tol: tolerancia ?? 1e-6, ancho, alto });
    if (noLineas.length) { analisis.discrepancias.push(`Entidades que no son líneas: ${noLineas.map((e) => `${e.handle}=${e.tipo}`).join(', ')}.`); analisis.estado = 'needs_review'; }
    return { unidades_insunits: lectura.unidades_insunits, lecturas: lectura.entidades, analisis };
  }

  /** Autoriza la copia pedida y exige que sea el documento ACTIVO (ambos en 03 Trabajo, nunca originales). */
  async #copiaActiva(project, archivo) {
    const { abs } = this.sandbox.resolve(project, archivo);
    const objetivo = this.#assertWorkCopy(project, abs);
    const st = await this.#estadoDoc();
    const activo = this.#assertWorkCopy(project, st.ruta);
    if (activo !== objetivo) throw new UserError('DOCUMENTO_ACTIVO_DISTINTO', 'El dibujo activo en AutoCAD no es la copia indicada; no se cierra nada.', 'Active la copia de trabajo indicada y repita.');
    return { objetivo, st };
  }

  /**
   * Comprobación INDEPENDIENTE de persistencia por LOTES: con la copia de trabajo activa y guardada lee las entidades
   * (tipadas, en lotes), CIERRA el documento sin guardar (se exige Saved=true), lo REABRE desde disco y vuelve a leer por
   * lotes. Compara cada tipo según SUS propiedades reales; lo que AutoCAD no informa queda `no_verificable` (no se
   * compara null contra null). `handles` opcional: sin él se verifica TODO el espacio modelo (o la capa indicada).
   */
  async verificarPersistencia(project, { archivo, handles, capa, creado_en, tolerancia = 1e-6, tam_lote = 150 }) {
    if (handles !== undefined && (!Array.isArray(handles) || handles.length < 1 || !handles.every((h) => HANDLE.test(String(h))))) throw new UserError('DATO_INVALIDO', 'Los handles deben ser hexadecimales.');
    if (capa !== undefined && capa !== null && !LAYER.test(capa)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido.');
    const { objetivo, st } = await this.#copiaActiva(project, archivo);
    const stat = (f) => { const s0 = fs.statSync(f); return { bytes: s0.size, modificado: new Date(s0.mtimeMs).toISOString(), mtime_ms: s0.mtimeMs, sha256: sha256File(f) }; };
    const disco0 = stat(objetivo);
    if (creado_en && !(disco0.mtime_ms + 2000 >= Date.parse(creado_en))) {
      throw new UserError('NO_GUARDADO_EN_DISCO', 'El archivo en disco es anterior a la creación de las líneas: los cambios NO están guardados en el DWG.', 'Guarde la copia en AutoCAD y repita.', { archivo_modificado: disco0.modificado, creado_en });
    }
    const alcance = handles ? 'handles' : capa ? `capa ${capa}` : 'todo el espacio modelo';
    const ruta = st.ruta;
    // Fotografía GLOBAL antes de cerrar: conteo, capas y todos los handles (aunque solo se verifique un subconjunto)
    const resumenAntes = await this.resumenDocumento(ruta);
    const todosAntes = (await this.enumerarHandles({ ruta })).entidades;
    const lista = handles ? handles.map(String) : capa ? todosAntes.filter((e) => e.capa === capa).map((e) => e.handle) : todosAntes.map((e) => e.handle);
    if (!lista.length) throw new UserError('SIN_ENTIDADES', 'No hay entidades que verificar en ese alcance.');
    const antes = await this.leerLote(lista, { tam: tam_lote, ruta });
    let cierre;
    try { cierre = await this.#exec('cerrar_reabrir', { ruta_esperada: ruta, esperadas: todosAntes.length }, { timeoutMs: 120000 }); }
    catch (e) {
      if (e.detalle?.codigo === 'CAMBIOS_SIN_GUARDAR' || e.code === 'CAMBIOS_SIN_GUARDAR') throw new UserError('CAMBIOS_SIN_GUARDAR', 'La copia tiene cambios sin guardar: no se cierra para no perderlos.', 'Guárdela en AutoCAD y repita.');
      if (e.code === 'REAPERTURA_FALLIDA') e.detalle = { ...(e.detalle || {}), lecturas_previas: antes.entidades.slice(0, 50) };
      throw e;
    }
    // Fotografía GLOBAL después de reabrir, tomada del documento reabierto (por ruta) y re-enumerada: nada se da por supuesto
    const rutaDespues = cierre.ruta || ruta;
    if (!mismaRuta(rutaDespues, ruta)) throw new UserError('DOCUMENTO_REABIERTO_DISTINTO', 'Tras cerrar y reabrir, AutoCAD informó un documento distinto del verificado; no se lee ni se certifica nada.', 'Repita la verificación con la copia de trabajo activa.', { esperado: path.basename(normalizarRuta(ruta)).slice(0, 80), informado: path.basename(normalizarRuta(rutaDespues)).slice(0, 80) });
    const resumenDespues = await this.resumenDocumento(rutaDespues);
    const todosDespues = (await this.enumerarHandles({ ruta: rutaDespues })).entidades;
    const despues = await this.leerLote(lista, { tam: tam_lote, ruta: rutaDespues });
    const disco1 = stat(objetivo);
    const cmp = compararLecturas(antes.entidades, despues.entidades, { tol: tolerancia });
    const global = comprobarGlobal({ resumenAntes, todosAntes, resumenDespues, todosDespues, cierre, rutaEsperada: ruta, rutaDespues });
    const estadoFinal = cmp.estado === 'fallida' || global.estado === 'fallida' ? 'fallida' : (cmp.estado === 'no_concluyente' || global.estado === 'no_concluyente') ? 'no_concluyente' : 'verificada';
    const archivoIntacto = disco0.sha256 === disco1.sha256;
    return {
      persistencia: estadoFinal, alcance, entidades_leidas: lista.length, entidades_tras_reabrir: todosDespues.length,
      verificacion_global: global,
      cobertura: cmp.cobertura, diferencias: cmp.diferencias.slice(0, 50), diferencias_total: cmp.diferencias.length,
      no_verificables: cmp.no_verificables.slice(0, 50), no_verificables_total: cmp.no_verificables.length,
      inconsistencias_internas: cmp.inconsistencias_internas.slice(0, 50), inconsistencias_total: cmp.inconsistencias_internas.length,
      lotes: { antes: antes.lotes, despues: despues.lotes, tam_lote: antes.tam_lote },
      archivo_en_disco: { antes: { bytes: disco0.bytes, modificado: disco0.modificado, sha256: disco0.sha256 }, despues: { bytes: disco1.bytes, modificado: disco1.modificado, sha256: disco1.sha256 }, sin_cambios_por_el_cierre_y_reapertura: archivoIntacto },
      guardado_posterior_a_la_creacion: creado_en ? disco0.mtime_ms + 2000 >= Date.parse(creado_en) : null,
      unidades_insunits: cierre.unidades_insunits,
      reapertura: { conteo_inicial_tras_abrir: cierre.conteo_inicial_tras_abrir ?? null, espera_ms: cierre.espera_ms ?? null },
      aviso: 'Un SHA-256 idéntico del archivo en disco NO prueba la persistencia: la prueba es la reapertura (conteo global, capas, handles y propiedades).',
      independencia: 'Releído desde el DWG en disco tras cerrar y reabrir en AutoCAD (documento localizado por ruta y re-enumerado), comparando cada tipo por sus propiedades reales y el estado global del espacio modelo. El contenido del DWG no se interpreta fuera de AutoCAD.',
    };
  }

  /**
   * Abre un DXF GENERADO (en 03 Trabajo) en AutoCAD y lo guarda como DWG nuevo junto a él. Nunca sobrescribe: el DWG no debe existir.
   * Verificación independiente: el archivo .dwg debe existir en disco con cabecera "AC10xx" (la escribe solo AutoCAD) y las
   * capas y conteos por capa informados por AutoCAD deben coincidir con los del DXF.
   */
  async dxfADwg(project, dxfRel) {
    const { abs, root } = this.sandbox.resolve(project, dxfRel);
    if (!/\.dxf$/i.test(abs)) throw new UserError('TIPO_NO_PERMITIDO', 'Se espera un archivo .dxf generado por Tannia Workspace.');
    if (!isInside(path.join(root, FOLDERS.trabajo), abs)) throw new UserError('ORIGEN_FUERA_DE_TRABAJO', 'Solo se convierten archivos de "03 Trabajo".');
    const dwgAbs = abs.replace(/\.dxf$/i, '.dwg');
    const dwgRel = path.relative(root, dwgAbs).split(path.sep).join('/');
    this.sandbox.resolveWritable(project, dwgRel); // debe quedar en una carpeta de escritura y nunca en originales
    if (fs.existsSync(dwgAbs)) throw new UserError('DWG_YA_EXISTE', 'Ya existe un DWG de esa versión; no se sobrescribe.', 'Genere una nueva versión del anteproyecto o renombre el DWG existente.');
    const esperado = conteoPorCapa(parseDxf(fs.readFileSync(abs)));
    const r = await this.#exec('dxf_a_dwg', { dxf: abs, dwg: dwgAbs }, { timeoutMs: 120000 });
    let cabecera = null; let bytes = 0;
    try { const st = fs.statSync(dwgAbs); bytes = st.size; const fd = fs.openSync(dwgAbs, 'r'); const b = Buffer.alloc(6); fs.readSync(fd, b, 0, 6, 0); fs.closeSync(fd); cabecera = b.toString('latin1'); } catch { /* se informa abajo */ }
    const valido = !!cabecera && /^AC10\d\d$/.test(cabecera) && bytes > 1000;
    const estructura = verificarEstructura(esperado, r);
    return { ...r, dwg: dwgRel, archivo_dwg: { bytes, cabecera, cabecera_dwg_valida: valido, sha256: valido ? sha256File(dwgAbs) : null }, verificacion_estructura: estructura, verificacion: valido ? (estructura.ok ? 'El DWG existe en disco con cabecera de AutoCAD y sus capas/conteos coinciden con el DXF.' : 'El DWG existe, pero ATENCIÓN: capas o conteos no coinciden con el DXF (ver verificacion_estructura).') : 'ATENCIÓN: AutoCAD respondió, pero el .dwg no está en disco o no tiene cabecera válida.' };
  }

  /**
   * Fidelidad DXF → DWG: con el DWG activo (copia en 03 Trabajo), lee TODAS las entidades por lotes y compara, por multiconjuntos
   * de firmas tipadas (LINE, ARC, POLYLINE, TEXT), contra el DXF de origen; clasifica los textos (ñ/Ñ/tildes) y detecta lecturas
   * incoherentes (p. ej. arcos con longitud 0). Solo lectura.
   */
  async verificarDwg(project, { dxfRel, dwgRel, tam_lote = 150 }) {
    const { st } = await this.#copiaActiva(project, dwgRel);
    const dxfAbs = this.sandbox.resolve(project, dxfRel).abs;
    const dxf = parseDxf(fs.readFileSync(dxfAbs));
    const ruta = st.ruta; const resumen = await this.resumenDocumento(ruta);
    const lista = (await this.enumerarHandles({ ruta })).entidades.map((e) => e.handle);
    const lect = await this.leerLote(lista, { tam: tam_lote, ruta });
    const { firmas, ilegibles } = firmasDesdeCom(lect.entidades);
    const fid = compararFidelidad(firmasDesdeDxf(dxf), firmas);
    const textos = clasificarTextos(dxf.entities.filter((e) => e.type === 'TEXT').map((e) => dxfDecode(e.text)), lect.entidades.filter((e) => e.tipo === 'AcDbText').map((e) => e.texto));
    const inconsistencias = lect.entidades.flatMap((e) => (e.error ? [] : coherenciaInterna(e).map((x) => ({ handle: e.handle, tipo: e.tipo, ...x }))));
    const estructura = verificarEstructura(conteoPorCapa(dxf), resumen);
    const diferencias = !fid.fiel || !textos.ok || !estructura.ok;
    const estado = diferencias ? 'con_diferencias' : (inconsistencias.length || ilegibles.length) ? 'no_concluyente' : 'fiel';
    return {
      fidelidad: estado, documento: resumen.documento, unidades_insunits: resumen.unidades_insunits,
      entidades: { en_dxf: fid.esperadas, leidas_en_dwg: lect.entidades.length, interpretadas: fid.informadas, ilegibles: ilegibles.length },
      comparacion_geometrica: { fiel: fid.fiel, faltan_en_dwg: fid.faltan_en_dwg.slice(0, 20), sobran_en_dwg: fid.sobran_en_dwg.slice(0, 20), faltan_por_tipo: fid.faltan_por_tipo, sobran_por_tipo: fid.sobran_por_tipo },
      textos: { ok: textos.ok, exactos: textos.exactos, con_acentos_correctos: textos.con_acentos_correctos, escape_sin_decodificar: textos.escape_sin_decodificar.slice(0, 10), corruptos: textos.corruptos.slice(0, 10), faltantes: textos.faltantes.slice(0, 10), sobrantes: textos.sobrantes.slice(0, 10) },
      estructura, inconsistencias_internas: inconsistencias.slice(0, 30), inconsistencias_total: inconsistencias.length, ilegibles: ilegibles.slice(0, 20),
      lotes: lect.lotes, tam_lote: lect.tam_lote,
      independencia: 'Lectura COM de todas las entidades del DWG comparada con el DXF de origen; el contenido del DWG no se interpreta fuera de AutoCAD.',
    };
  }

  // ================= Modelo 3D =================
  /**
   * Crea un DWG 3D NUEVO (documento nuevo; no toca ningún dibujo abierto, ni originales ni el DWG 2D) con los sólidos indicados y lo
   * guarda en `dwgRel` (debe estar en "03 Trabajo" y no existir). Verifica en disco la cabecera y por capa los conteos informados.
   * @param primitivas [{id,tipo:'caja'|'cuna',capa,...}] de src/arq3d/geometria.js
   */
  async construir3d(project, { dwgRel, primitivas, capas, nota, nota_pos = [0, -1500, 0], vista = 'iso_so', estilo = 'conceptual' }) {
    if (!Array.isArray(primitivas) || primitivas.length < 1 || primitivas.length > 2000) throw new UserError('DATO_INVALIDO', 'Indique entre 1 y 2000 sólidos.');
    if (!VISTAS[vista]) throw new UserError('DATO_INVALIDO', `Vista no válida. Use: ${Object.keys(VISTAS).join(', ')}.`);
    if (estilo !== null && !ESTILOS[estilo]) throw new UserError('DATO_INVALIDO', `Estilo no válido. Use: ${Object.keys(ESTILOS).join(', ')}.`);
    for (const c of capas) if (!LAYER.test(c.nombre)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido.');
    const { abs: dwgAbs, root } = this.sandbox.resolveWritable(project, dwgRel);
    if (!/\.dwg$/i.test(dwgAbs)) throw new UserError('TIPO_NO_PERMITIDO', 'El modelo 3D se guarda como .dwg.');
    if (!isInside(path.join(root, FOLDERS.trabajo), dwgAbs)) throw new UserError('DESTINO_FUERA_DE_TRABAJO', 'El DWG 3D solo se guarda en "03 Trabajo".');
    if (fs.existsSync(dwgAbs)) throw new UserError('DWG_YA_EXISTE', 'Ya existe un DWG 3D de esa versión; no se sobrescribe.', 'Modifique el modelo (nueva versión) o use otro nombre.');
    fs.mkdirSync(path.dirname(dwgAbs), { recursive: true }); // AutoCAD no crea carpetas: SaveAs falla si no existe (destino ya validado dentro de 03 Trabajo)
    const esperado = {}; for (const p of primitivas) esperado[p.capa] = (esperado[p.capa] || 0) + 1; esperado.TW3D_NOTAS = 1;
    const r = await this.#exec('construir_3d', { dwg: dwgAbs, primitivas, capas, nota, nota_pos, vista_dir: VISTAS[vista], estilo_cmd: estilo ? ESTILOS[estilo] : null }, { timeoutMs: 90000 + primitivas.length * 600 });
    let cabecera = null; let bytes = 0;
    try { const st = fs.statSync(dwgAbs); bytes = st.size; const fd = fs.openSync(dwgAbs, 'r'); const b = Buffer.alloc(6); fs.readSync(fd, b, 0, 6, 0); fs.closeSync(fd); cabecera = b.toString('latin1'); } catch { /* se informa abajo */ }
    const valido = !!cabecera && /^AC10\d\d$/.test(cabecera) && bytes > 1000;
    const estructura = verificarEstructura(esperado, r);
    // Lectura inmediata de cada sólido creado (volumen, centroide, caja envolvente) frente al valor analítico del modelo
    const { lecturas, ...resto } = r;
    const cmp = compararSolidos(primitivas.map((p) => ({ id: p.id, capa: p.capa, ...p.esperado, centro: p.esperado.centroide, min: p.esperado.bbox_min, max: p.esperado.bbox_max })), lecturas || []);
    const verificacionSolidos = { estado: cmp.estado, esperados: cmp.esperados, leidos: cmp.leidos, coinciden: cmp.coinciden, faltan: cmp.faltan.slice(0, 20), distintos: cmp.distintos.slice(0, 20), sobran: cmp.sobran.slice(0, 20), caja_envolvente: cmp.caja_envolvente };
    const todoBien = valido && estructura.ok && cmp.estado === 'fiel';
    return { ...resto, dwg: dwgRel, archivo_dwg: { bytes, cabecera, cabecera_dwg_valida: valido, sha256: valido ? sha256File(dwgAbs) : null }, verificacion_estructura: estructura, verificacion_solidos: verificacionSolidos,
      verificacion: todoBien ? 'DWG 3D guardado en disco con cabecera de AutoCAD; capas, conteos y CADA sólido (volumen, centroide, caja envolvente) coinciden con el modelo. Compruebe a ojo la vista y confirme el cierre/reapertura con tannia_cad_verificar_persistencia.' : `ATENCIÓN: verificación no concluyente o con diferencias (archivo ${valido ? 'ok' : 'NO válido'}; estructura ${estructura.ok ? 'ok' : 'con diferencias'}; sólidos ${cmp.estado}). Revise verificacion_estructura y verificacion_solidos.` };
  }

  /** Vista 3D del documento activo (copia en 03 Trabajo): dirección isométrica/planta/alzado, zoom a la extensión, estilo visual y capas visibles. */
  async vista3d(project, { vista = 'iso_so', estilo = null, mostrar = [], ocultar = [] } = {}) {
    if (!VISTAS[vista]) throw new UserError('DATO_INVALIDO', `Vista no válida. Use: ${Object.keys(VISTAS).join(', ')}.`);
    if (estilo !== null && !ESTILOS[estilo]) throw new UserError('DATO_INVALIDO', `Estilo no válido. Use: ${Object.keys(ESTILOS).join(', ')}.`);
    for (const c of [...mostrar, ...ocultar]) if (!LAYER.test(c)) throw new UserError('DATO_INVALIDO', 'Nombre de capa no válido.');
    const st = await this.#estadoDoc(); this.#assertWorkCopy(project, st.ruta);
    const r = await this.#exec('vista_3d', { dir: VISTAS[vista], estilo_cmd: estilo ? ESTILOS[estilo] : null, mostrar, ocultar, ruta_esperada: st.ruta }, { timeoutMs: 60000 });
    return { ...r, vista, estilo_solicitado: estilo, nota: 'La vista no se guarda en el DWG hasta que lo guarde en AutoCAD. El estilo visual se solicita por comando: confírmelo en pantalla.' };
  }

  /** Inspección de solo lectura: sólidos 3D del dibujo activo (volumen, centroide, caja envolvente) por capa. */
  async inspeccionarSolidos(project, { capa, max = 400, tam_lote = 100 } = {}) {
    const st = await this.#estadoDoc(); this.#assertWorkCopy(project, st.ruta);
    const lista = (await this.enumerarHandles({ capa, ruta: st.ruta })).entidades; const sol = lista.filter((e) => e.tipo === 'AcDb3dSolid');
    const tomar = sol.slice(0, Math.min(max, MAX_ENTIDADES)); const lect = await this.leerLote(tomar.map((e) => e.handle), { tam: tam_lote, ruta: st.ruta });
    const porCapa = {}; for (const e of lect.entidades) { if (e.error) continue; const c = (porCapa[e.capa] ||= { solidos: 0, volumen_mm3: 0 }); c.solidos++; c.volumen_mm3 += e.volumen || 0; }
    const bb = lect.entidades.filter((e) => Array.isArray(e.bbox_min) && Array.isArray(e.bbox_max));
    const envolvente = bb.length ? { min: [0, 1, 2].map((i) => Math.min(...bb.map((e) => e.bbox_min[i]))), max: [0, 1, 2].map((i) => Math.max(...bb.map((e) => e.bbox_max[i]))) } : null;
    return { documento: st.documento, total_entidades: lista.length, total_solidos: sol.length, leidos: lect.entidades.length, truncado: sol.length > tomar.length, por_capa: porCapa, envolvente_mm: envolvente, solidos: lect.entidades.map((e) => (e.error ? e : { handle: e.handle, capa: e.capa, volumen_mm3: e.volumen, centroide: e.centroide, bbox_min: e.bbox_min ?? null, bbox_max: e.bbox_max ?? null })), lotes: lect.lotes };
  }

  /** Mueve o rota (eje Z) UN sólido del dibujo activo (copia en 03 Trabajo). Deja una marca de deshacer. No guarda salvo guardar=true. */
  async transformarSolido(project, { handle, operacion, dx = 0, dy = 0, dz = 0, grados = 0, centro = [0, 0], guardar = false }) {
    if (!HANDLE.test(String(handle))) throw new UserError('DATO_INVALIDO', 'Handle no válido.');
    if (!['mover', 'rotar_z'].includes(operacion)) throw new UserError('DATO_INVALIDO', 'operacion debe ser mover o rotar_z.');
    for (const v of [dx, dy, dz, grados, centro[0], centro[1]]) if (!Number.isFinite(v)) throw new UserError('DATO_INVALIDO', 'Valores numéricos no válidos.');
    if (Math.abs(dx) > 1e6 || Math.abs(dy) > 1e6 || Math.abs(dz) > 1e6) throw new UserError('DATO_INVALIDO', 'Desplazamiento fuera de rango (máx. 1 000 000 mm).');
    const st = await this.#estadoDoc(); this.#assertWorkCopy(project, st.ruta);
    const r = await this.#exec('transformar_solido', { handle: String(handle), operacion, dx, dy, dz, grados, cx: centro[0], cy: centro[1], guardar: !!guardar, ruta_esperada: st.ruta }, { timeoutMs: 60000 });
    return { ...r, aviso: 'El DWG ya NO coincide con el modelo 3D guardado: la modificación manual no actualiza el modelo. Para cambios que deban persistir en el modelo use tannia_3d_modificar.' };
  }

  /** Compara CADA sólido del DWG activo con los esperados del modelo 3D (volumen, centroide, caja envolvente, capa) y las capas/conteos. */
  async verificarSolidos(project, { dwgRel, primitivas, tam_lote = 100 }) {
    const { st } = await this.#copiaActiva(project, dwgRel);
    const ruta = st.ruta; const resumen = await this.resumenDocumento(ruta);
    const lista = (await this.enumerarHandles({ ruta })).entidades.filter((e) => e.tipo === 'AcDb3dSolid');
    const lect = await this.leerLote(lista.map((e) => e.handle), { tam: tam_lote, ruta });
    const cmp = compararSolidos(primitivas.map((p) => ({ id: p.id, capa: p.capa, ...p.esperado, centro: p.esperado.centroide, min: p.esperado.bbox_min, max: p.esperado.bbox_max })), lect.entidades);
    const esperado = {}; for (const p of primitivas) esperado[p.capa] = (esperado[p.capa] || 0) + 1; esperado.TW3D_NOTAS = 1;
    const estructura = verificarEstructura(esperado, resumen);
    const estado = cmp.estado === 'con_diferencias' || !estructura.ok ? 'con_diferencias' : cmp.estado;
    return { estado, documento: st.documento, solidos: { esperados: cmp.esperados, leidos: cmp.leidos, coinciden: cmp.coinciden, faltan: cmp.faltan.slice(0, 20), distintos: cmp.distintos.slice(0, 20), sobran: cmp.sobran.slice(0, 20), caja_envolvente: cmp.caja_envolvente }, estructura, lotes: lect.lotes,
      independencia: 'Cada sólido leído de AutoCAD (volumen, centroide y caja envolvente) se compara con el valor calculado analíticamente desde el modelo estructurado.' };
  }

  agregarLinea(project, { x1, y1, x2, y2, capa }) { return this.agregarLineas(project, { lineas: [{ x1, y1, x2, y2 }], capa }); }
}
