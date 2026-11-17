@echo off
rem Tannia Workspace {{VERSION}} - lanzador de instalacion (Windows x64, usuario estandar, sin administrador).
rem Comprueba sistema, integridad (SHA-256) y Claude Desktop; luego abre la extension .mcpb en Claude Desktop,
rem donde la persona pulsa "Instalar". No cambia politicas de seguridad ni toca configuraciones ajenas.
rem Codigos de salida: 0 listo | 2 paquete danado o incompleto | 3 falta Claude Desktop | 4 sistema no compatible | 5 no se pudo abrir
setlocal EnableExtensions EnableDelayedExpansion
title Tannia Workspace {{VERSION}} - Instalacion
cd /d "%~dp0"
set "MCPB={{MCPB}}"
set "ESPERADO={{SHA_MCPB}}"
set "CODIGO=0"
set "LOGDIR=%LOCALAPPDATA%\Tannia Workspace"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
set "LOG=%LOGDIR%\instalador.log"
call :log "Inicio del instalador {{VERSION}} (commit {{COMMIT}})"
echo.
echo  ==========================================================
echo   Tannia Workspace {{VERSION}}
echo   CANDIDATO NO VALIDADO - lea LEEME_PRIMERO.txt
echo  ==========================================================
echo.
rem ---- 1. Sistema
set "ARQ=%PROCESSOR_ARCHITECTURE%"
if defined PROCESSOR_ARCHITEW6432 set "ARQ=%PROCESSOR_ARCHITEW6432%"
if /i not "%ARQ%"=="AMD64" (
  echo  [X] Este paquete es para Windows de 64 bits ^(x64^). Su equipo informa: %ARQ%.
  call :log "ERROR arquitectura %ARQ%"
  set "CODIGO=4"
  goto :fin
)
echo  [OK] Windows de 64 bits.
rem ---- 2. Integridad del paquete
if not exist "%MCPB%" (
  echo  [X] Falta el archivo %MCPB%. Extraiga el ZIP completo antes de instalar.
  call :log "ERROR falta %MCPB%"
  set "CODIGO=2"
  goto :fin
)
set "HASH="
for /f "skip=1 tokens=* delims=" %%H in ('certutil -hashfile "%MCPB%" SHA256 2^>nul') do if not defined HASH set "HASH=%%H"
if defined HASH set "HASH=!HASH: =!"
if /i not "!HASH!"=="%ESPERADO%" (
  echo  [X] El archivo de la extension esta danado o fue modificado. No se instala.
  echo      Descargue de nuevo el ZIP. Detalle en: %LOG%
  call :log "ERROR integridad: esperado %ESPERADO% obtenido !HASH!"
  set "CODIGO=2"
  goto :fin
)
echo  [OK] Integridad verificada ^(SHA-256 coincide^).
call :log "OK integridad %ESPERADO%"
rem ---- 3. Claude Desktop
set "CLAUDE="
if exist "%LOCALAPPDATA%\AnthropicClaude\claude.exe" set "CLAUDE=%LOCALAPPDATA%\AnthropicClaude"
if not defined CLAUDE if exist "%LOCALAPPDATA%\Programs\Claude\Claude.exe" set "CLAUDE=%LOCALAPPDATA%\Programs\Claude"
if not defined CLAUDE reg query "HKCU\Software\Classes\.mcpb" >nul 2>&1 && set "CLAUDE=asociacion de archivos .mcpb"
if not defined CLAUDE reg query "HKCR\.mcpb" >nul 2>&1 && set "CLAUDE=asociacion de archivos .mcpb"
if not defined CLAUDE dir /b /ad "%LOCALAPPDATA%\Packages\Claude_*" >nul 2>&1 && set "CLAUDE=Claude de Microsoft Store"
if not defined CLAUDE (
  echo  [X] No se encontro Claude Desktop en este usuario.
  echo      Instalelo desde https://claude.ai/download , inicie sesion y vuelva a ejecutar INSTALAR.cmd.
  echo      Si ya lo tiene instalado en otra ubicacion, ejecute:  INSTALAR.cmd /forzar
  call :log "ERROR Claude Desktop no encontrado"
  set "CODIGO=3"
  if /i not "%~1"=="/forzar" goto :fin
  set "CODIGO=0"
)
if defined CLAUDE echo  [OK] Claude Desktop: !CLAUDE!
rem ---- 4. AutoCAD (informativo)
reg query "HKLM\SOFTWARE\Autodesk\AutoCAD" >nul 2>&1
if errorlevel 1 (
  echo  [i] AutoCAD no detectado: puede trabajar con DXF, PDF, cubicaciones, presupuestos y entregas.
) else (
  echo  [i] AutoCAD detectado: las funciones de dibujo estaran disponibles ^(NO validadas en este candidato^).
)
rem ---- 5. Datos de la usuaria
echo  [i] Sus proyectos quedan en la carpeta que elija en Claude Desktop ^(sugerida: Documentos\Tannia Workspace^).
echo      Reinstalar, actualizar o desinstalar la extension NO borra esa carpeta.
if /i "%TANNIA_INSTALADOR_SIN_ABRIR%"=="1" (
  echo  [i] Modo de prueba: no se abre Claude Desktop.
  call :log "OK modo prueba sin abrir"
  goto :fin
)
echo.
echo  Se abrira Claude Desktop con la extension. Pulse "Instalar",
echo  elija la carpeta de proyectos y deje la extension ACTIVADA.
echo.
start "" "%CD%\%MCPB%"
if errorlevel 1 (
  echo  [X] Windows no pudo abrir la extension automaticamente.
  echo      Abra Claude Desktop - Configuracion - Extensiones - Instalar extension, y elija:
  echo      %CD%\%MCPB%
  call :log "ERROR start fallo"
  set "CODIGO=5"
  goto :fin
)
call :log "OK extension abierta en Claude Desktop"
:fin
echo.
if "%CODIGO%"=="0" (
  echo  Siguiente paso: en una conversacion NUEVA de Claude escriba:
  echo  "Ejecuta el diagnostico de Tannia Workspace"
) else (
  echo  Instalacion detenida ^(codigo %CODIGO%^). Ejecute DIAGNOSTICO.cmd y lea
  echo  documentos\RECUPERACION_Y_DESINSTALACION.md
)
call :log "Fin con codigo %CODIGO%"
if /i not "%TANNIA_INSTALADOR_SIN_PAUSA%"=="1" pause
exit /b %CODIGO%

:log
>>"%LOG%" echo [%date% %time%] %~1
exit /b 0
