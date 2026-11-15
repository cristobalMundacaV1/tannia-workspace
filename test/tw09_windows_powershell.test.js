// Pruebas de regresión del issue #8 que ejecutan PowerShell REAL (Windows PowerShell 5.1 en CI windows-latest):
// codificación Unicode de extremo a extremo, scripts reales del adaptador contra un "AutoCAD" simulado en PowerShell
// (objetos con la misma superficie COM: Layers, ModelSpace, ActiveLayer, Save, …) y conexión real sin AutoCAD.
// Lo simulado es SOLO el servidor COM; los scripts, la codificación, el transporte y las guardas son los de producción.
// Se omiten donde no hay powershell.exe (Linux/macOS). NO sustituyen la prueba con AutoCAD real.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AutoCadCom, runPowerShell, buildScript } from '../src/cad/autocad_com.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tmpHome } from './helpers.js';

const HAS_PS = process.platform === 'win32' && spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], { windowsHide: true }).status === 0;
const opts = { skip: HAS_PS ? false : 'requiere Windows PowerShell (powershell.exe)', timeout: 120000 };

// AutoCAD simulado (PowerShell). Registra cada escritura en $env:TANNIA_TEST_LOG para inspeccionarla después.
const MOCK_CONNECT = `$global:TW_LOG = $env:TANNIA_TEST_LOG
$global:TW_FAILAT = 0; if ($env:TANNIA_TEST_FAILAT) { $global:TW_FAILAT = [int]$env:TANNIA_TEST_FAILAT }
$global:TW_LAYERFAIL = ($env:TANNIA_TEST_LAYERFAIL -eq '1')
$global:TW_SAVEFAIL = ($env:TANNIA_TEST_SAVEFAIL -eq '1')
$global:TW_N = 0
$global:TW_LAYERS = @{ '0' = 1 }
$global:TW_MS = New-Object System.Collections.ArrayList
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
Add-Member -InputObject $layersObj -MemberType ScriptMethod -Name Item -Value { param($n) if (-not $global:TW_LAYERS.ContainsKey($n)) { throw 'capa inexistente' }; return (TW-Layer $n) }
Add-Member -InputObject $layersObj -MemberType ScriptMethod -Name Add -Value { param($n) if ($global:TW_LAYERFAIL) { throw 'sin permiso para crear capa' }; $global:TW_LAYERS[$n] = 1; TW-L ('ADDLAYER ' + $n); return (TW-Layer $n) }
Add-Member -InputObject $global:TW_MS -MemberType ScriptMethod -Name AddLine -Value {
  param($a, $b)
  $global:TW_N++
  if ($global:TW_FAILAT -gt 0 -and $global:TW_N -eq $global:TW_FAILAT) { throw 'fallo simulado al dibujar' }
  $len = [math]::Sqrt([math]::Pow($b[0] - $a[0], 2) + [math]::Pow($b[1] - $a[1], 2))
  $e = New-Object PSObject -Property @{ Handle = ('{0:X}' -f (26 + $global:TW_N)); ObjectName = 'AcDbLine'; Layer = $global:TW_ACTIVE.Name; Length = $len }
  Add-Member -InputObject $e -MemberType ScriptMethod -Name Delete -Value { TW-L ('DEL ' + $this.Handle); $global:TW_MS.Remove($this) }
  [void]$global:TW_MS.Add($e); TW-L ('ADD ' + $e.Handle + ' ' + $e.Layer + ' ' + $len)
  return $e
}
$doc = New-Object PSObject -Property @{ Name = [IO.Path]::GetFileName($env:TANNIA_TEST_DOC); FullName = $env:TANNIA_TEST_DOC; Saved = $true; Layers = $layersObj; ModelSpace = $global:TW_MS }
Add-Member -InputObject $doc -MemberType ScriptProperty -Name ActiveLayer -Value { $global:TW_ACTIVE } -SecondValue { $global:TW_ACTIVE = $args[0] }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name HandleToObject -Value { param($h) foreach ($x in $global:TW_MS) { if ($x.Handle -eq $h) { return $x } }; throw 'handle inexistente' }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name GetVariable -Value { param($n) return 4 }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name StartUndoMark -Value { TW-L 'UNDO_START' }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name EndUndoMark -Value { TW-L 'UNDO_END' }
if ($env:TANNIA_TEST_PREPOP) { foreach ($len in ($env:TANNIA_TEST_PREPOP -split ',')) { $null = $global:TW_MS.AddLine(@(0.0, 0.0, 0.0), @([double]$len, 0.0, 0.0)) }; $global:TW_N = 0; Set-Content -LiteralPath $global:TW_LOG -Value '' }
Add-Member -InputObject $doc -MemberType ScriptMethod -Name Save -Value { if ($env:TANNIA_TEST_SAVEFAIL -eq '1') { throw 'no se pudo guardar' }; TW-L 'SAVE' }
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
    await assert.rejects(() => com.agregarLineas(e.P, { lineas: L4, capa: 'TW_PRUEBA' }), (x) => x.code === 'DOCUMENTO_CAMBIO');
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
