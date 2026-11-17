// Pruebas de regresión del issue #8 que ejecutan PowerShell REAL (Windows PowerShell 5.1 en CI windows-latest):
// codificación Unicode de extremo a extremo, scripts reales del adaptador contra un "AutoCAD" simulado en PowerShell
// (objetos con la misma superficie COM: Layers, ModelSpace, ActiveLayer, Save, …) y conexión real sin AutoCAD.
// Lo simulado es SOLO el servidor COM; los scripts, la codificación, el transporte y las guardas son los de producción.
// Se omiten donde no hay powershell.exe (Linux/macOS). NO sustituyen la prueba con AutoCAD real.
import test from 'node:test';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';
import { escribirDxf } from '../src/design/salidas.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dataImportado } from './helpers_dxf_import.js';
import { AutoCadCom, runPowerShell, buildScript } from '../src/cad/autocad_com.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';

const HAS_PS = process.platform === 'win32' && spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], { windowsHide: true }).status === 0;
const opts = { skip: HAS_PS ? false : 'requiere Windows PowerShell (powershell.exe)', timeout: 120000 };

// AutoCAD simulado (PowerShell). Registra cada escritura en $env:TANNIA_TEST_LOG para inspeccionarla después.
const MOCK_CONNECT = `# Proceso acad simulado SOLO cuando la prueba lo pide: la sesión estricta del producto exige exactamente un proceso (no se relaja en producción).
if ($env:TANNIA_TEST_ACAD_PROC -eq '1') { function global:Get-Process { [CmdletBinding()] param($Name) [pscustomobject]@{ Id = 4242 } } }
$global:TW_LOG = $env:TANNIA_TEST_LOG
$global:TW_FAILAT = 0; if ($env:TANNIA_TEST_FAILAT) { $global:TW_FAILAT = [int]$env:TANNIA_TEST_FAILAT }
$global:TW_LAYERFAIL = ($env:TANNIA_TEST_LAYERFAIL -eq '1')
$global:TW_SAVEFAIL = ($env:TANNIA_TEST_SAVEFAIL -eq '1')
$global:TW_N = 0
$global:TW_LAYERS = @{ '0' = 1 }
$global:TW_MS = New-Object System.Collections.ArrayList
function global:TW-ClearAdds { $k = @(Get-Content -LiteralPath $global:TW_LOG -Encoding UTF8 | Where-Object { $_ -and ($_ -notlike 'ADD *') }); if ($k.Count) { Set-Content -LiteralPath $global:TW_LOG -Value $k -Encoding UTF8 } else { Set-Content -LiteralPath $global:TW_LOG -Value '' } }
$global:TW_LOST = (Test-Path -LiteralPath ($env:TANNIA_TEST_LOG + '.lost'))
function global:TW-L($m) { Add-Content -LiteralPath $global:TW_LOG -Value $m -Encoding UTF8 }
function global:TW-Layer($n) {
  $o = New-Object PSObject -Property @{ Name = $n }
  Add-Member -InputObject $o -MemberType ScriptMethod -Name Delete -Value { TW-L ('DELLAYER ' + $this.Name); $global:TW_LAYERS.Remove($this.Name) }
  return $o
}
$global:TW_ACTIVE = TW-Layer '0'
$acad = New-Object PSObject -Property @{ Version = '26.0s (simulado)'; Name = 'AutoCAD' }
$usado = 'AutoCAD.Application.26'
$layersObj = New-Object PSObject
Add-Member -InputObject $layersObj -MemberType ScriptMethod -Name Item -Value { param($n) if ($n -is [int]) { $k = @($global:TW_LAYERS.Keys)[$n]; if ($null -eq $k) { throw 'indice fuera de rango' }; return (TW-Layer $k) }; if (-not $global:TW_LAYERS.ContainsKey($n)) { throw 'capa inexistente' }; return (TW-Layer $n) }
Add-Member -InputObject $layersObj -MemberType ScriptProperty -Name Count -Value { $global:TW_LAYERS.Count }
Add-Member -InputObject $layersObj -MemberType ScriptMethod -Name Add -Value { param($n) if ($global:TW_LAYERFAIL) { throw 'sin permiso para crear capa' }; $global:TW_LAYERS[$n] = 1; TW-L ('ADDLAYER ' + $n); return (TW-Layer $n) }
Add-Member -InputObject $global:TW_MS -MemberType ScriptMethod -Name AddLine -Value {
  param($a, $b)
  $global:TW_N++
  if ($global:TW_FAILAT -gt 0 -and $global:TW_N -eq $global:TW_FAILAT) { throw 'fallo simulado al dibujar' }
  $len = [math]::Sqrt([math]::Pow($b[0] - $a[0], 2) + [math]::Pow($b[1] - $a[1], 2))
  $e = New-Object PSObject -Property @{ Handle = ('{0:X}' -f (26 + $global:TW_N)); ObjectName = 'AcDbLine'; Layer = $global:TW_ACTIVE.Name; Length = $len; StartPoint = $a; EndPoint = $b }
  Add-Member -InputObject $e -MemberType ScriptMethod -Name Delete -Value { TW-L ('DEL ' + $this.Handle); $global:TW_MS.Remove($this) }
  [void]$global:TW_MS.Add($e); TW-L ('ADD ' + $e.Handle + ' ' + $e.Layer + ' ' + $len)
  return $e
}
$doc = New-Object PSObject -Property @{ Name = [IO.Path]::GetFileName($env:TANNIA_TEST_DOC); FullName = $env:TANNIA_TEST_DOC; Saved = ($env:TANNIA_TEST_DIRTY -ne '1'); Layers = $layersObj; ModelSpace = $global:TW_MS }
Add-Member -InputObject $doc -MemberType ScriptProperty -Name ActiveLayer -Value { $global:TW_ACTIVE } -SecondValue { $global:TW_ACTIVE = $args[0] }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name HandleToObject -Value { param($h) foreach ($x in $global:TW_MS) { if ($x.Handle -eq $h) { return $x } }; throw 'handle inexistente' }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name GetVariable -Value { param($n) return 4 }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name StartUndoMark -Value { TW-L 'UNDO_START' }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name EndUndoMark -Value { TW-L 'UNDO_END' }
$global:TW_DOC = $doc
$global:TW_DOCS = New-Object System.Collections.ArrayList
[void]$global:TW_DOCS.Add($doc)
Add-Member -InputObject $acad -MemberType NoteProperty -Name Documents -Value $global:TW_DOCS
Add-Member -InputObject $doc -MemberType ScriptMethod -Name SaveAs -Value { param($p, $t) if ($t -ne 64 -and $null -ne $t) { throw 'tipo inválido' }; [IO.File]::WriteAllBytes($p, ([Text.Encoding]::ASCII.GetBytes('AC1032') + (New-Object byte[] 3000))); TW-L ('SAVEAS ' + $t) }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name SetVariable -Value { param($n, $v) TW-L ('SETVAR ' + $n + ' ' + $v) }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name Activate -Value { }
Add-Member -InputObject $global:TW_DOCS -MemberType ScriptMethod -Name Open -Value { param($p, $ro) if ($env:TANNIA_TEST_REOPENFAIL -eq '1') { throw 'no se pudo reabrir' }; TW-L 'OPEN'; if ($env:TANNIA_TEST_LOSE -eq '1') { $global:TW_MS.Clear(); Set-Content -LiteralPath ($env:TANNIA_TEST_LOG + '.lost') -Value '1' }; if ($p -and ($p -ine $global:TW_DOC.FullName)) { $global:TW_DOC.FullName = $p; $global:TW_DOC.Name = [IO.Path]::GetFileName($p) }; [void]$global:TW_DOCS.Add($global:TW_DOC); $global:TW_DOC.Saved = $true; return $global:TW_DOC }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name Close -Value { param($guardar) TW-L ('CLOSE ' + $guardar); $global:TW_DOCS.Remove($this) }
if ($env:TANNIA_TEST_RECT -and -not $global:TW_LOST) { $rp = $env:TANNIA_TEST_RECT -split ','; $w = [double]$rp[0]; $h = [double]$rp[1]; $null = $global:TW_MS.AddLine(@(0.0, 0.0, 0.0), @($w, 0.0, 0.0)); $null = $global:TW_MS.AddLine(@($w, 0.0, 0.0), @($w, $h, 0.0)); $null = $global:TW_MS.AddLine(@($w, $h, 0.0), @(0.0, $h, 0.0)); $null = $global:TW_MS.AddLine(@(0.0, $h, 0.0), @(0.0, 0.0, 0.0)); $global:TW_N = 0; TW-ClearAdds }
if ($env:TANNIA_TEST_ARCS -and -not $global:TW_LOST) { foreach ($k in 1..[int]$env:TANNIA_TEST_ARCS) { $global:TW_N++; $r = 800.0 * $k; $arc = New-Object PSObject -Property @{ Handle = ('{0:X}' -f (26 + $global:TW_N)); ObjectName = 'AcDbArc'; Layer = 'TW_PUERTA'; Center = @(0.0, 0.0, 0.0); Radius = $r; StartAngle = 0.0; EndAngle = [math]::PI / 2; ArcLength = $r * [math]::PI / 2; StartPoint = @($r, 0.0, 0.0); EndPoint = @(0.0, $r, 0.0) }; [void]$global:TW_MS.Add($arc) }; $txt = New-Object PSObject -Property @{ Handle = ('{0:X}' -f (27 + [int]$env:TANNIA_TEST_ARCS)); ObjectName = 'AcDbText'; Layer = 'TW_TEXTO'; TextString = 'BA' + [char]0xD1 + 'O'; InsertionPoint = @(1.0, 2.0, 0.0); Height = 170.0; Alignment = 0; TextAlignmentPoint = @(0.0, 0.0, 0.0); Rotation = 0.0 }; [void]$global:TW_MS.Add($txt); $global:TW_N = 0; TW-ClearAdds }
if ($env:TANNIA_TEST_PREPOP -and -not $global:TW_LOST) { foreach ($len in ($env:TANNIA_TEST_PREPOP -split ',')) { $null = $global:TW_MS.AddLine(@(0.0, 0.0, 0.0), @([double]$len, 0.0, 0.0)) }; $global:TW_N = 0; TW-ClearAdds }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name Save -Value { if ($env:TANNIA_TEST_SAVEFAIL -eq '1') { throw 'no se pudo guardar' }; TW-L 'SAVE' }
`;


// AutoCAD 3D simulado (PowerShell): sólidos con convenciones DISTINTAS a las supuestas (centro de la base en AddBox; pendiente de la cuña a lo largo de Y)
// para comprobar que el script real se autocorrige con Centroid/GetBoundingBox. Estado en memoria: cada llamada es un proceso nuevo.
const MOCK_3D = `$global:BOXBASE = ($env:TANNIA_TEST_BOXCONV -eq 'base'); $global:WEDGEY = ($env:TANNIA_TEST_WEDGEY -eq '1'); $global:NS = 0
function global:Rot2($x, $y, $a) { $r = $a * [math]::PI / 180; return @(($x * [math]::Cos($r) - $y * [math]::Sin($r)), ($x * [math]::Sin($r) + $y * [math]::Cos($r))) }
function global:Sol($kind, $c, $d, $hi) {
  $global:NS++
  $o = New-Object PSObject -Property @{ Handle = ('{0:X}' -f (200 + $global:NS)); ObjectName = 'AcDb3dSolid'; Layer = '0'; Kind = $kind; C = $c; D = $d; Ang = 0.0; Hi = $hi }
  Add-Member -InputObject $o -MemberType ScriptProperty -Name Volume -Value { $v = $this.D[0] * $this.D[1] * $this.D[2]; if ($this.Kind -eq 'wedge') { $v / 2 } else { $v } }
  Add-Member -InputObject $o -MemberType ScriptProperty -Name Centroid -Value {
    $cx = $this.C[0]; $cy = $this.C[1]; $cz = $this.C[2]
    if ($this.Kind -eq 'wedge') { $off = Rot2 ($this.Hi[0] * $this.D[0] / 6) ($this.Hi[1] * $this.D[1] / 6) $this.Ang; $cx += $off[0]; $cy += $off[1]; $cz = $this.C[2] - $this.D[2] / 2 + $this.D[2] / 3 }
    return ,@($cx, $cy, $cz) }
  Add-Member -InputObject $o -MemberType ScriptMethod -Name GetBoundingBox -Value { param($mn, $mx)
    $xs = @(); $ys = @(); foreach ($sx in -1, 1) { foreach ($sy in -1, 1) { $p = Rot2 ($sx * $this.D[0] / 2) ($sy * $this.D[1] / 2) $this.Ang; $xs += ($this.C[0] + $p[0]); $ys += ($this.C[1] + $p[1]) } }
    $mn.Value = [double[]]@((($xs | Measure-Object -Minimum).Minimum), (($ys | Measure-Object -Minimum).Minimum), ($this.C[2] - $this.D[2] / 2))
    $mx.Value = [double[]]@((($xs | Measure-Object -Maximum).Maximum), (($ys | Measure-Object -Maximum).Maximum), ($this.C[2] + $this.D[2] / 2)) }
  Add-Member -InputObject $o -MemberType ScriptMethod -Name Move -Value { param($a, $b) $this.C = @(($this.C[0] + $b[0] - $a[0]), ($this.C[1] + $b[1] - $a[1]), ($this.C[2] + $b[2] - $a[2])) }
  Add-Member -InputObject $o -MemberType ScriptMethod -Name Rotate -Value { param($base, $ang) $g = $ang * 180 / [math]::PI; $r = Rot2 ($this.C[0] - $base[0]) ($this.C[1] - $base[1]) $g; $this.C = @(($base[0] + $r[0]), ($base[1] + $r[1]), $this.C[2]); $this.Ang = $this.Ang + $g }
  Add-Member -InputObject $o -MemberType ScriptMethod -Name Delete -Value { [void]$global:MS3.Remove($this) }
  return $o
}
$global:MS3 = New-Object System.Collections.ArrayList
Add-Member -InputObject $global:MS3 -MemberType ScriptMethod -Name AddBox -Value { param($c, $l, $w, $h) $cz = $c[2]; if ($global:BOXBASE) { $cz += $h / 2 }; $s = Sol 'box' @($c[0], $c[1], $cz) @($l, $w, $h) $null; [void]$global:MS3.Add($s); return $s }
Add-Member -InputObject $global:MS3 -MemberType ScriptMethod -Name AddWedge -Value { param($c, $l, $w, $h) $cz = $c[2]; if ($global:BOXBASE) { $cz += $h / 2 }; $hi = @(-1.0, 0.0); if ($global:WEDGEY) { $hi = @(0.0, -1.0) }; $s = Sol 'wedge' @($c[0], $c[1], $cz) @($l, $w, $h) $hi; [void]$global:MS3.Add($s); return $s }
Add-Member -InputObject $global:MS3 -MemberType ScriptMethod -Name AddText -Value { param($t, $p, $h) $o = New-Object PSObject -Property @{ Handle = 'FF1'; ObjectName = 'AcDbText'; Layer = '0'; TextString = $t }; [void]$global:MS3.Add($o); return $o }
$global:LAY = New-Object System.Collections.ArrayList
function global:NuevaCapa($n) { $l = New-Object PSObject -Property @{ Name = $n; color = 7; LayerOn = $true }; [void]$global:LAY.Add($l); return $l }
$null = NuevaCapa '0'
$layers3 = New-Object PSObject
Add-Member -InputObject $layers3 -MemberType ScriptMethod -Name Add -Value { param($n) return (NuevaCapa $n) }
Add-Member -InputObject $layers3 -MemberType ScriptMethod -Name Item -Value { param($n) if ($n -is [int]) { return $global:LAY[$n] }; foreach ($l in $global:LAY) { if ($l.Name -eq $n) { return $l } }; throw 'capa inexistente' }
Add-Member -InputObject $layers3 -MemberType ScriptProperty -Name Count -Value { $global:LAY.Count }
$vp3 = New-Object PSObject -Property @{ Direction = @(0.0, 0.0, 1.0) }
$nuevo = New-Object PSObject -Property @{ Name = 'Dibujo1.dwg'; FullName = 'Dibujo1.dwg'; Saved = $false; Layers = $layers3; ModelSpace = $global:MS3; ActiveViewport = $vp3 }
Add-Member -InputObject $nuevo -MemberType ScriptMethod -Name SetVariable -Value { param($n, $v) }
Add-Member -InputObject $nuevo -MemberType ScriptMethod -Name GetVariable -Value { param($n) return 4 }
Add-Member -InputObject $nuevo -MemberType ScriptMethod -Name SendCommand -Value { param($c) Add-Content -LiteralPath $env:TANNIA_TEST_LOG -Value ('CMD ' + $c) -Encoding UTF8 }
Add-Member -InputObject $nuevo -MemberType ScriptMethod -Name Close -Value { param($g) Add-Content -LiteralPath $env:TANNIA_TEST_LOG -Value ('CLOSE ' + $g) -Encoding UTF8 }
Add-Member -InputObject $nuevo -MemberType ScriptMethod -Name SaveAs -Value { param($p, $t) [IO.File]::WriteAllBytes($p, ([Text.Encoding]::ASCII.GetBytes('AC1032') + (New-Object byte[] 3000))); $this.FullName = $p; $this.Name = [IO.Path]::GetFileName($p); $this.Saved = $true }
$docs3 = New-Object PSObject
Add-Member -InputObject $docs3 -MemberType ScriptMethod -Name Add -Value { return $nuevo }
$acad = New-Object PSObject -Property @{ Version = '26.0s (simulado)'; Name = 'AutoCAD'; Documents = $docs3 }
Add-Member -InputObject $acad -MemberType ScriptMethod -Name ZoomExtents -Value { Add-Content -LiteralPath $env:TANNIA_TEST_LOG -Value 'ZOOM' -Encoding UTF8 }
$usado = 'AutoCAD.Application.26'
$doc = New-Object PSObject -Property @{ Name = 'previo.dwg'; FullName = $env:TANNIA_TEST_DOC; Saved = $true }
`;

// Dos dibujos abiertos con LOS MISMOS handles y conteo (A y B); el ACTIVO es B. Sirve para demostrar que, con ruta esperada, el script
// real localiza exactamente ese documento o falla, y que nunca cae al documento activo.
const MOCK_MULTI = `function global:NuevoDoc($ruta, $capa) {
  $ms = New-Object System.Collections.ArrayList
  foreach ($k in 1..3) { [void]$ms.Add((New-Object PSObject -Property @{ Handle = [string](100 + $k); ObjectName = 'AcDbLine'; Layer = $capa; StartPoint = @(0.0, 0.0, 0.0); EndPoint = @(1.0, 0.0, 0.0); Length = 1.0 })) }
  $lay = New-Object PSObject -Property @{ L = (New-Object System.Collections.ArrayList) }
  foreach ($n in '0', $capa) { [void]$lay.L.Add((New-Object PSObject -Property @{ Name = $n })) }
  Add-Member -InputObject $lay -MemberType ScriptProperty -Name Count -Value { $this.L.Count }
  Add-Member -InputObject $lay -MemberType ScriptMethod -Name Item -Value { param($i) return $this.L[$i] }
  $d = New-Object PSObject -Property @{ Name = [IO.Path]::GetFileName($ruta); FullName = $ruta; Saved = $true; Layers = $lay; ModelSpace = $ms }
  Add-Member -InputObject $d -MemberType ScriptMethod -Name HandleToObject -Value { param($h) foreach ($x in $this.ModelSpace) { if ($x.Handle -eq $h) { return $x } }; throw 'handle inexistente' }
  Add-Member -InputObject $d -MemberType ScriptMethod -Name GetVariable -Value { param($n) return 4 }
  return $d
}
$docA = NuevoDoc 'C:\\Dibujos\\Casa A.dwg' 'CAPA_A'; $docB = NuevoDoc 'C:\\Dibujos\\Casa B.dwg' 'CAPA_B'
$docs = New-Object System.Collections.ArrayList; [void]$docs.Add($docA); [void]$docs.Add($docB)
$acad = New-Object PSObject -Property @{ Version = '26.0s (simulado)'; Name = 'AutoCAD'; Documents = $docs; ActiveDocument = $docB }
$usado = 'AutoCAD.Application.26'
`;
function entorno(prefix = "'Tannia Workspace ó ñ ") {
  const home = tmpHome(prefix); const sb = new Sandbox(home);
  const P = "Prueba de integración AutoCAD ñ'"; createProject(sb, P);
  const root = path.join(home, 'Proyectos', P);
  const orig = path.join(root, '02 Originales', 'Dibujo2 - integración.dwg');
  const work = path.join(root, '03 Trabajo', 'Dibujo2 - integración - copia de trabajo.dwg');
  fs.writeFileSync(orig, 'ORIGINAL'); fs.writeFileSync(work, 'COPIA');
  const log = path.join(home, 'comandos.log'); fs.writeFileSync(log, '');
  return { home, sb, P, root, orig, work, log };
}
const leer = (log) => fs.readFileSync(log, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
const adaptador = (env, active, extraEnv = {}, runnerEnvOverride) => new AutoCadCom({
  sandbox: env.sb, platform: 'win32', connect: MOCK_CONNECT,
  runner: (script, input) => runPowerShell(script, input, { env: { TANNIA_TEST_DOC: active, TANNIA_TEST_LOG: env.log, ...extraEnv, ...(runnerEnvOverride ? runnerEnvOverride(input) : {}) } }),
});
const H = (n) => Array.from({ length: n }, (_, i) => (27 + i).toString(16).toUpperCase()); // handles hex del AutoCAD simulado
const L4 = [{ x1: 0, y1: 0, x2: 6000, y2: 0 }, { x1: 6000, y1: 0, x2: 6000, y2: 4000 }, { x1: 6000, y1: 4000, x2: 0, y2: 4000 }, { x1: 0, y1: 4000, x2: 0, y2: 0 }];

test('PowerShell real: ruta con ó ñ espacios y apóstrofo viaja Node→PowerShell→Node idéntica byte a byte', opts, async () => {
  const e = entorno();
  try {
    const st = await adaptador(e, e.work).estado();
    assert.equal(st.ruta, e.work, 'FullName intacta');
    assert.equal(Buffer.from(st.ruta, 'utf8').toString('hex'), Buffer.from(e.work, 'utf8').toString('hex'));
    assert.ok(!st.ruta.includes('�'));
    assert.ok(fs.existsSync(st.ruta), 'la ruta devuelta existe en disco');
    assert.equal(st.documento, path.basename(e.work));
    assert.equal(st.unidades_insunits, 4);
    // entrada Unicode: el script recibe el handle/capa sin alteraciones (eco mediante la capa creada)
    const r = await adaptador(e, e.work).agregarLineas(e.P, { lineas: [L4[0]], capa: 'TW_PRUEBA' });
    assert.equal(r.cantidad, 1);
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: salida con caracteres no ASCII no depende de la página de códigos de la consola', opts, async () => {
  const marca = 'integración ñ ó ü € — \u{1F600}';
  const out = await runPowerShell(`${buildScript('estado', { connect: `$acad = New-Object PSObject -Property @{ Version = 'x'; Name = 'y' }; $usado = 'z'; $doc = New-Object PSObject -Property @{ Name = 'n'; FullName = $env:TANNIA_TEST_DOC; Saved = $true }; Add-Member -InputObject $doc -MemberType ScriptMethod -Name HandleToObject -Value { param($h) foreach ($x in $global:TW_MS) { if ($x.Handle -eq $h) { return $x } }; throw 'handle inexistente' }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name GetVariable -Value { param($n) return 4 }\n` })}`, {}, { env: { TANNIA_TEST_DOC: marca } });
  assert.equal(JSON.parse(out).data.ruta, marca);
});

test('PowerShell real: 4 líneas 6000×4000 mm en capa TW_PRUEBA inexistente (se crea antes), handles, longitudes y original intacto', opts, async () => {
  const e = entorno();
  try {
    const shaAntes = fs.readFileSync(e.orig).toString('hex');
    const com = adaptador(e, e.work);
    const r = await com.agregarLineas(e.P, { lineas: L4, capa: 'TW_PRUEBA' });
    assert.equal(r.cantidad, 4); assert.equal(r.capa_creada, true); assert.deepEqual(r.handles, H(4));
    const log = leer(e.log);
    assert.deepEqual(log.filter((x) => !x.startsWith('ADD ')), ['ADDLAYER TW_PRUEBA', 'UNDO_START', 'UNDO_END', 'SAVE'], 'orden: capa → marca → líneas → fin → guardar una vez');
    assert.ok(log.indexOf('ADDLAYER TW_PRUEBA') < log.findIndex((x) => /^ADD [0-9A-F]+ /.test(x)));
    assert.deepEqual(log.filter((x) => x.startsWith('ADD ')).map((x) => x.split(' ').slice(1).join(' ')), [`${H(1)[0]} TW_PRUEBA 6000`, `${H(2)[1]} TW_PRUEBA 4000`, `${H(3)[2]} TW_PRUEBA 6000`, `${H(4)[3]} TW_PRUEBA 4000`]);
    // capa ya existente: se selecciona, no se vuelve a crear
    fs.writeFileSync(e.log, '');
    const r2 = await adaptador(e, e.work).agregarLineas(e.P, { lineas: [L4[0]] }); // sin capa: no toca capas
    assert.equal(r2.capa_creada, false); assert.ok(!leer(e.log).some((x) => x.includes('LAYER')));
    assert.equal(fs.readFileSync(e.orig).toString('hex'), shaAntes, 'el original no cambió');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: listar con medidas (4 líneas 6000/4000), filtro por capa y medir por handle', opts, async () => {
  const e = entorno();
  try {
    const com = adaptador(e, e.work, { TANNIA_TEST_PREPOP: '6000,4000,6000,4000' });
    const lista = await com.listarEntidades({ medidas: true });
    assert.equal(lista.truncado, false);
    assert.deepEqual(lista.entidades.map((x) => [x.handle, x.tipo, x.capa, x.longitud]), [[H(1)[0], 'AcDbLine', '0', 6000], [H(2)[1], 'AcDbLine', '0', 4000], [H(3)[2], 'AcDbLine', '0', 6000], [H(4)[3], 'AcDbLine', '0', 4000]]);
    assert.equal((await com.listarEntidades({ capa: 'NOEXISTE' })).entidades.length, 0);
    assert.equal((await com.listarEntidades({ maximo: 2 })).truncado, true);
    const m = await com.medirEntidad(H(2)[1]);
    assert.equal(m.Length, 4000); assert.equal(m.tipo, 'AcDbLine');
    assert.equal((await com.listarEntidades({})).entidades[0].longitud, undefined, 'sin con_medidas no se piden longitudes');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: fallo al dibujar la 3.ª línea revierte las 2 creadas y la capa nueva (sin escrituras parciales ni guardado)', opts, async () => {
  const e = entorno();
  try {
    await assert.rejects(() => adaptador(e, e.work, { TANNIA_TEST_FAILAT: '3' }).agregarLineas(e.P, { lineas: L4, capa: 'TW_PRUEBA' }),
      (x) => x.code === 'DIBUJO_REVERTIDO' && x.detalle.revertido === true && x.detalle.capa_revertida === true && x.detalle.etapa === 'dibujar');
    const log = leer(e.log);
    assert.deepEqual(log.filter((x) => /^DEL/.test(x)).sort(), [`DEL ${H(1)[0]}`, `DEL ${H(2)[1]}`, 'DELLAYER TW_PRUEBA']);
    assert.ok(!log.includes('SAVE'), 'no se guardó nada');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: si no se puede crear la capa no se dibuja nada', opts, async () => {
  const e = entorno();
  try {
    await assert.rejects(() => adaptador(e, e.work, { TANNIA_TEST_LAYERFAIL: '1' }).agregarLineas(e.P, { lineas: L4, capa: 'TW_PRUEBA' }), (x) => x.code === 'CAPA_NO_DISPONIBLE');
    assert.deepEqual(leer(e.log), [], 'cero efectos');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: guardado fallido se informa con los handles (las líneas siguen en la copia, nunca en el original)', opts, async () => {
  const e = entorno();
  try {
    await assert.rejects(() => adaptador(e, e.work, { TANNIA_TEST_SAVEFAIL: '1' }).agregarLineas(e.P, { lineas: [L4[0]], capa: 'TW_PRUEBA' }), (x) => x.code === 'GUARDADO_FALLO' && x.detalle.handles.length === 1);
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: original activo => ORIGINAL_PROTEGIDO sin escribir; el documento activo que cambia entre estado y dibujo => DOCUMENTO_CAMBIO sin escribir', opts, async () => {
  const e = entorno();
  try {
    await assert.rejects(() => adaptador(e, e.orig).agregarLineas(e.P, { lineas: L4, capa: 'TW_PRUEBA' }), (x) => x.code === 'ORIGINAL_PROTEGIDO');
    assert.deepEqual(leer(e.log), []);
    // estado ve la copia; al dibujar, el "usuario" ya cambió a otro dibujo (el original)
    const com = adaptador(e, e.work, {}, (input) => (input.ruta_esperada ? { TANNIA_TEST_DOC: e.orig } : {}));
    await assert.rejects(() => com.agregarLineas(e.P, { lineas: L4, capa: 'TW_PRUEBA' }), (x) => x.code === 'DOCUMENTO_NO_ABIERTO');
    assert.deepEqual(leer(e.log), [], 'la re-verificación dentro de PowerShell impidió escribir');
    assert.equal(fs.readFileSync(e.orig, 'utf8'), 'ORIGINAL');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: sin AutoCAD, el script de conexión REAL informa AUTOCAD_NO_ABIERTO con los intentos (sin rutas)', opts, async () => {
  const sb = new Sandbox(tmpHome());
  const com = new AutoCadCom({ sandbox: sb, platform: 'win32' }); // runner y conexión reales
  await assert.rejects(() => com.estado(), (x) => ['AUTOCAD_NO_ABIERTO', 'AUTOCAD_ACCESO_DENEGADO'].includes(x.code) && Array.isArray(x.detalle.intentos) && x.detalle.intentos.length >= 1 && /^AutoCAD\.Application/.test(x.detalle.intentos[0]) && !/[A-Za-z]:\\/.test(JSON.stringify(x.detalle)));
});

test('PowerShell real: un script con error de sintaxis o excepción produce una clase de fallo segura, no un cuelgue', opts, async () => {
  await assert.rejects(() => runPowerShell('if (', {}), (x) => ['powershell_fallo', 'sin_respuesta'].includes(x.clase));
  await assert.rejects(() => runPowerShell('Start-Sleep -Seconds 20', {}, { timeoutMs: 1500 }), (x) => x.clase === 'tiempo_agotado');
});


test('PowerShell real: StartPoint/EndPoint por COM y verificación independiente del cierre del rectángulo 6000×4000', opts, async () => {
  const e = entorno();
  try {
    const com = adaptador(e, e.work, { TANNIA_TEST_RECT: '6000,4000' });
    const g = await com.leerGeometria(H(4));
    assert.deepEqual(g.entidades.map((x) => [x.inicio, x.fin]), [[[0, 0, 0], [6000, 0, 0]], [[6000, 0, 0], [6000, 4000, 0]], [[6000, 4000, 0], [0, 4000, 0]], [[0, 4000, 0], [0, 0, 0]]]);
    const v = await com.verificarContorno(H(4), { ancho: 6000, alto: 4000 });
    assert.equal(v.analisis.estado, 'ok'); assert.equal(v.analisis.cerrado, true); assert.equal(v.analisis.area, 24e6);
    const abierto = await adaptador(e, e.work, { TANNIA_TEST_RECT: '6000,4000' }).verificarContorno(H(3), { ancho: 6000, alto: 4000 });
    assert.equal(abierto.analisis.cerrado, false); assert.equal(abierto.analisis.estado, 'needs_review');
    const m = await com.medirEntidad(H(2)[1]); assert.deepEqual([m.StartPoint, m.EndPoint, m.Length], [[6000, 0, 0], [6000, 4000, 0], 4000]);
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: persistencia por cierre y reapertura (Close($false) + Open), con detección de pérdida, cambios pendientes y reapertura fallida', opts, async () => {
  const e = entorno();
  try {
    const f = { archivo: `03 Trabajo/${path.basename(e.work)}`, handles: H(4), creado_en: new Date(Date.now() - 5000).toISOString() };
    const hash0 = fs.readFileSync(e.work).toString('hex');
    const r = await adaptador(e, e.work, { TANNIA_TEST_RECT: '6000,4000' }).verificarPersistencia(e.P, f);
    assert.equal(r.persistencia, 'verificada'); assert.equal(r.entidades_leidas, 4); assert.deepEqual(r.diferencias, []); assert.equal(r.no_verificables_total, 0);
    assert.equal(r.archivo_en_disco.sin_cambios_por_el_cierre_y_reapertura, true); assert.equal(r.guardado_posterior_a_la_creacion, true);
    assert.deepEqual(leer(e.log).filter((x) => /^(CLOSE|OPEN)/.test(x)), ['CLOSE False', 'OPEN'], 'se cierra SIN guardar y se reabre');
    // las entidades se pierden al reabrir => FALLIDA con las 4 diferencias
    fs.writeFileSync(e.log, '');
    const perdida = await adaptador(e, e.work, { TANNIA_TEST_RECT: '6000,4000', TANNIA_TEST_LOSE: '1' }).verificarPersistencia(e.P, f);
    assert.equal(perdida.persistencia, 'fallida'); assert.equal(perdida.diferencias_total, 4); fs.rmSync(`${e.log}.lost`, { force: true });
    // cambios sin guardar => no se cierra
    fs.writeFileSync(e.log, '');
    await assert.rejects(() => adaptador(e, e.work, { TANNIA_TEST_RECT: '6000,4000', TANNIA_TEST_DIRTY: '1' }).verificarPersistencia(e.P, f), (x) => x.code === 'CAMBIOS_SIN_GUARDAR');
    assert.ok(!leer(e.log).some((x) => x.startsWith('CLOSE')), 'no se cerró con cambios pendientes');
    // reapertura fallida: se informa; el archivo en disco no cambió
    fs.writeFileSync(e.log, '');
    await assert.rejects(() => adaptador(e, e.work, { TANNIA_TEST_RECT: '6000,4000', TANNIA_TEST_REOPENFAIL: '1' }).verificarPersistencia(e.P, f), (x) => x.code === 'REAPERTURA_FALLIDA' && x.detalle.lecturas_previas.length === 4);
    assert.equal(fs.readFileSync(e.work).toString('hex'), hash0);
    // original activo o copia distinta: jamás se cierra
    fs.writeFileSync(e.log, '');
    await assert.rejects(() => adaptador(e, e.orig, { TANNIA_TEST_RECT: '6000,4000' }).verificarPersistencia(e.P, f), (x) => x.code === 'ORIGINAL_PROTEGIDO');
    assert.deepEqual(leer(e.log), [], 'sin Close ni Open'); assert.equal(fs.readFileSync(e.orig, 'utf8'), 'ORIGINAL');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});


test('PowerShell real: causa raíz — arcos SIN Length leen ArcLength (no 0), el texto conserva Ñ y las capas se recorren por índice', opts, async () => {
  const e = entorno();
  try {
    const com = adaptador(e, e.work, { TANNIA_TEST_ARCS: '3' });
    const l = await com.leerLote(['1B', '1C', '1D', '1E']);
    const a = l.entidades[0]; assert.equal(a.tipo, 'AcDbArc'); assert.equal(a.longitud, undefined, 'sin Length no se informa longitud (antes: 0)');
    assert.ok(Math.abs(a.longitud_arco - 800 * Math.PI / 2) < 1e-6); assert.ok(Math.abs(a.angulo_fin - Math.PI / 2) < 1e-9); assert.deepEqual(a.centro, [0, 0, 0]);
    assert.equal(l.entidades[3].texto, 'BAÑO', 'la Ñ viaja PowerShell→Node sin corromperse');
    const r = await com.verificarPersistencia(e.P, { archivo: `03 Trabajo/${path.basename(e.work)}` });
    assert.equal(r.persistencia, 'verificada'); assert.equal(r.cobertura.AcDbArc.verificadas, 3); assert.equal(r.cobertura.AcDbText.verificadas, 1);
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: construir_3d con convenciones de AutoCAD distintas a las supuestas (cajas por la base, cuña inclinada en Y) se autocorrige y verifica cada sólido', opts, async () => {
  const { construirPrimitivas } = await import('../src/arq3d/geometria.js');
  const e = entorno();
  try {
    const muro = (id, p1, p2, v = []) => ({ id, nivel: 'N1', tipo: 'ext', espesor_mm: 200, p1, p2, vanos: v });
    const modelo = { niveles: [{ id: 'N1', cota_mm: 0, altura_mm: 2600 }], muros: [muro('A', [0, 0], [6000, 0], [{ id: 'P', tipo: 'puerta', posicion_mm: 1500, ancho_mm: 900, alto_mm: 2100 }, { id: 'W', tipo: 'ventana', posicion_mm: 4000, ancho_mm: 1500, alto_mm: 1200, antepecho_mm: 900 }]), muro('B', [6000, 0], [6000, 4000]), muro('C', [6000, 4000], [0, 4000]), muro('D', [0, 4000], [0, 0]), { id: 'X', nivel: 'N1', tipo: 'int', espesor_mm: 100, p1: [0, 0], p2: [3000, 3000] }], losas: [{ id: 'L', nivel: 'N1', espesor_mm: 150, contorno: [[-100, -100], [6100, -100], [6100, 4100], [-100, 4100]] }],
      cubiertas: [{ id: 'C1', nivel: 'N1', tipo: 'dos_aguas', pendiente_pct: 30, eje_cumbrera: 'x' }, { id: 'C2', nivel: 'N1', tipo: 'un_agua', pendiente_pct: 10, direccion: '-x', contorno: [[7000, 0], [9000, 0], [9000, 3000], [7000, 3000]] }] };
    const r = construirPrimitivas(modelo); assert.ok(r.primitivas.some((p) => p.tipo === 'cuna') && r.primitivas.some((p) => p.rot_deg));
    const env = r.resumen.envolvente_mm;
    for (const conv of [{}, { TANNIA_TEST_BOXCONV: 'base' }, { TANNIA_TEST_WEDGEY: '1' }, { TANNIA_TEST_BOXCONV: 'base', TANNIA_TEST_WEDGEY: '1' }]) {
      fs.writeFileSync(e.log, '');
      const dwgRel = `03 Trabajo/Modelos3D/Prueba ñ'/v${Object.keys(conv).length}${conv.TANNIA_TEST_BOXCONV || 'c'}${conv.TANNIA_TEST_WEDGEY || '0'}_3D.dwg`;
      const com = new AutoCadCom({ sandbox: e.sb, platform: 'win32', connect: MOCK_3D, runner: (script, input) => runPowerShell(script, input, { env: { TANNIA_TEST_DOC: e.work, TANNIA_TEST_LOG: e.log, ...conv } }) });
      const out = await com.construir3d(e.P, { dwgRel, primitivas: r.primitivas, capas: r.capas, nota: r.nota, nota_pos: [env.min[0], env.min[1] - 1500, 0], vista: 'iso_se', estilo: 'conceptual' });
      assert.equal(out.verificacion_solidos.estado, 'fiel', `${JSON.stringify(conv)} ${JSON.stringify(out.verificacion_solidos)}`);
      assert.equal(out.verificacion_solidos.coinciden, r.primitivas.length); assert.equal(out.archivo_dwg.cabecera_dwg_valida, true); assert.equal(out.verificacion_estructura.ok, true);
      assert.deepEqual(out.vista.direccion, [1, -1, 1]); assert.equal(out.estilo, 'solicitado'); assert.equal(out.entidades, r.primitivas.length + 1);
      const log = leer(e.log); assert.deepEqual(log.filter((x) => /^CLOSE/.test(x)), [], 'el documento nuevo no se cierra si todo va bien'); assert.ok(log.includes('CMD _.VSCURRENT _Conceptual '));
    }
    assert.equal(fs.readFileSync(e.orig, 'utf8'), 'ORIGINAL'); assert.equal(fs.readFileSync(e.work, 'utf8'), 'COPIA', 'el dibujo previo no se toca');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: con ruta esperada se localiza EXACTAMENTE ese documento (dos dibujos con los mismos handles y conteo); si no está abierto falla y nunca lee el activo', opts, async () => {
  const e = entorno();
  try {
    const A = 'C:\\Dibujos\\Casa A.dwg'; const B = 'C:\\Dibujos\\Casa B.dwg';
    const com = new AutoCadCom({ sandbox: e.sb, platform: 'win32', connect: MOCK_MULTI, runner: (script, input) => runPowerShell(script, input, { env: {} }) });
    // sin ruta: el activo (B)
    const sinRuta = await com.leerLote(['101']); assert.equal(sinRuta.entidades[0].capa, 'CAPA_B');
    // con ruta A: A, aunque B sea el activo y tenga los mismos handles y conteo
    const rA = await com.resumenDocumento(A); assert.deepEqual(rA.capas, ['0', 'CAPA_A']); assert.equal(rA.entidades, 3); assert.equal(rA.ruta, A);
    assert.ok((await com.enumerarHandles({ ruta: A })).entidades.every((x) => x.capa === 'CAPA_A'));
    assert.equal((await com.leerLote(['101', '102'], { ruta: A })).entidades.every((x) => x.capa === 'CAPA_A'), true);
    assert.equal((await com.leerLote(['101'], { ruta: B })).entidades[0].capa, 'CAPA_B');
    // mayúsculas y barra final: misma identidad en Windows
    assert.equal((await com.resumenDocumento('c:\\dibujos\\CASA A.DWG')).capas[1], 'CAPA_A');
    // documento esperado cerrado: falla explícita, jamás se lee el activo (B)
    for (const f of [() => com.resumenDocumento('C:\\Dibujos\\Casa C.dwg'), () => com.enumerarHandles({ ruta: 'C:\\Dibujos\\Casa C.dwg' }), () => com.leerLote(['101'], { ruta: 'C:\\Dibujos\\Casa C.dwg' })]) await assert.rejects(f, (x) => x.code === 'DOCUMENTO_NO_ABIERTO');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});

test('PowerShell real: DXF→DWG en ruta con ó ñ y apóstrofo — el DXF se importa en un documento aislado (contrato en tw12_*) y el GUARDADO se ejecuta con PowerShell real: INSUNITS=4, SaveAs, cabecera verificada en disco', opts, async () => {
  const e = entorno();
  try {
    const dir = path.join(e.root, '03 Trabajo', 'Anteproyectos', "Casa ñ'"); fs.mkdirSync(dir, { recursive: true });
    const dxf = path.join(dir, 'v001.dxf'); const texto = escribirDxf(generarModelo({}), derivar(generarModelo({})), { titulo: 'Casa', version: 'v001', fecha: '2026-11-16' }); fs.writeFileSync(dxf, texto);
    // Documents.Add + Import: simulado a nivel de runner (sin PowerShell) con la medición perfecta del propio DXF; el guardado SÍ corre en PowerShell real
    // contra un AutoCAD simulado cuyo único documento es el aislado «Drawing2.dwg» (sin ruta en disco). Sesión estricta: un proceso acad simulado.
    const adaptadorAislado = () => new AutoCadCom({
      sandbox: e.sb, platform: 'win32', connect: MOCK_CONNECT,
      runner: (script, input) => (/Documents\.Add\(/.test(script)
        ? Promise.resolve(JSON.stringify({ ok: true, data: dataImportado(texto) }))
        : runPowerShell(script, input, { env: { TANNIA_TEST_DOC: 'Drawing2.dwg', TANNIA_TEST_LOG: e.log, TANNIA_TEST_ACAD_PROC: '1' } })),
    });
    const r = await adaptadorAislado().dxfADwg(e.P, `03 Trabajo/Anteproyectos/Casa ñ'/v001.dxf`);
    assert.equal(r.archivo_dwg.cabecera_dwg_valida, true); assert.equal(r.archivo_dwg.cabecera, 'AC1032'); assert.ok(fs.existsSync(path.join(dir, 'v001.dwg')));
    assert.deepEqual(leer(e.log).filter((x) => /^(SETVAR|SAVEAS)/.test(x)), ['SETVAR INSUNITS 4', 'SAVEAS 64']);
    await assert.rejects(() => adaptadorAislado().dxfADwg(e.P, `03 Trabajo/Anteproyectos/Casa ñ'/v001.dxf`), (x) => x.code === 'DWG_YA_EXISTE');
    assert.equal(fs.readFileSync(e.orig, 'utf8'), 'ORIGINAL');
  } finally { fs.rmSync(e.home, { recursive: true, force: true }); }
});
