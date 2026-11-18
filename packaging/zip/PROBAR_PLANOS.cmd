@echo off
rem Tannia Workspace {{VERSION}} - prueba AUTONOMA de planos, sin Claude ni conversacion.
rem Genera los planos de prueba (tunel UAT y muro con vano) en una carpeta NUEVA de Documentos y la abre.
rem No modifica proyectos existentes, no abre AutoCAD y no se conecta a internet.
setlocal EnableExtensions
set "DEST=%USERPROFILE%\Documents\Tannia Workspace - Prueba de planos %RANDOM%%RANDOM%"
set "SRV="
for /d %%D in ("%APPDATA%\Claude\Claude Extensions\*tannia*") do if exist "%%D\server\index.js" set "SRV=%%D\server\index.js"
if not defined SRV (
  echo No encontre Tannia Workspace instalado en Claude Desktop.
  echo Puede abrir directamente los planos de referencia de esta version en la carpeta PLANOS-PRUEBA de este ZIP.
  goto :fin
)
set "NODE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE for /r "%LOCALAPPDATA%\AnthropicClaude" %%N in (node.exe) do if not defined NODE if exist "%%N" set "NODE=%%N"
if not defined NODE for /r "%LOCALAPPDATA%\Programs\Claude" %%N in (node.exe) do if not defined NODE if exist "%%N" set "NODE=%%N"
if not defined NODE (
  echo No encontre Node.js en este computador para ejecutar la prueba sin Claude.
  echo Los planos de referencia de esta version estan en la carpeta PLANOS-PRUEBA de este ZIP (mismo commit {{COMMIT}}).
  goto :fin
)
echo Generando planos de prueba en:
echo   %DEST%
"%NODE%" "%SRV%" --planos-prueba "%DEST%"
if errorlevel 1 (
  echo La prueba NO termino bien. Revise el mensaje anterior; no se modifico ningun proyecto.
  goto :fin
)
echo Listo. Abra los PDF y el archivo *-planos.dxf siguiendo documentos\UAT-PLANOS-AUTOCAD-2027.md
explorer "%DEST%"
:fin
if /i not "%TANNIA_INSTALADOR_SIN_PAUSA%"=="1" pause
exit /b 0
