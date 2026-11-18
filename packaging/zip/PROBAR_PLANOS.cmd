@echo off
rem Tannia Workspace {{VERSION}} - prueba AUTONOMA de planos, sin Claude ni conversacion.
rem Usa la extension INCLUIDA en este ZIP ({{MCPB}}), verificada por su huella; NO depende de donde
rem Claude Desktop instale las extensiones. Escribe solo en una carpeta NUEVA (Documentos o TANNIA_PRUEBA_DESTINO).
rem No modifica proyectos existentes, no abre AutoCAD ni Claude, no usa internet.
rem Codigos: 0 listo | 1 la prueba fallo | 2 paquete danado o incompleto | 4 falta Node.js
setlocal EnableExtensions
cd /d "%~dp0"
set "DEST=%TANNIA_PRUEBA_DESTINO%"
if not defined DEST set "DEST=%USERPROFILE%\Documents\Tannia Workspace - Prueba de planos %RANDOM%%RANDOM%"
set "TMPX=%TEMP%\tannia-prueba-planos-%RANDOM%%RANDOM%"
echo [1/4] Paquete incluido: {{MCPB}}
if not exist "{{MCPB}}" ( echo Falta el archivo {{MCPB}} en esta carpeta. Extraiga TODO el ZIP. & set "RC=2" & goto :fin )
set "HUELLA="
for /f "skip=1 delims=" %%H in ('certutil -hashfile "{{MCPB}}" SHA256 ^| findstr /r "^[0-9a-fA-F ]*$"') do if not defined HUELLA set "HUELLA=%%H"
set "HUELLA=%HUELLA: =%"
if /i not "%HUELLA%"=="{{SHA_MCPB}}" ( echo El paquete esta danado o fue modificado: huella %HUELLA% distinta de la esperada. & set "RC=2" & goto :fin )
echo       Integridad verificada.
echo [2/4] Diagnostico de la extension instalada en Claude Desktop (solo informativo):
set "INST="
for %%R in ("%APPDATA%\Claude" "%LOCALAPPDATA%\Claude" "%LOCALAPPDATA%\AnthropicClaude") do if exist %%R (
  for /f "delims=" %%M in ('dir /s /b "%%~R\manifest.json" 2^>nul ^| findstr /i "Extensions"') do findstr /m /i "tannia-workspace" "%%M" >nul 2>nul && if not defined INST set "INST=%%~dpM"
)
if defined INST ( echo       Instalada en: %INST% ) else ( echo       No se encontro una instalacion en las rutas conocidas. La prueba usa el paquete del ZIP, asi que puede continuar. )
echo [3/4] Buscando Node.js:
set "NODE=%TANNIA_NODE%"
if defined NODE if not exist "%NODE%" set "NODE="
if not defined NODE for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE for %%R in ("%LOCALAPPDATA%\AnthropicClaude" "%LOCALAPPDATA%\Programs\Claude" "%ProgramFiles%\nodejs") do if exist %%R for /f "delims=" %%N in ('dir /s /b "%%~R\node.exe" 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE (
  echo       No encontre Node.js ^(revise PATH o instale Node.js 20 o superior^).
  echo       Puede abrir igualmente los planos de referencia en la carpeta PLANOS-PRUEBA de este ZIP.
  set "RC=4" & goto :fin
)
echo       %NODE%
echo [4/4] Generando planos de prueba en: %DEST%
mkdir "%TMPX%" >nul 2>nul
copy /y "{{MCPB}}" "%TMPX%\extension.zip" >nul
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath (Join-Path $env:TMPX 'extension.zip') -DestinationPath (Join-Path $env:TMPX 'extension') -Force" >nul
if not exist "%TMPX%\extension\server\index.js" ( echo No se pudo preparar la extension incluida en %TMPX%. & set "RC=2" & goto :fin )
"%NODE%" "%TMPX%\extension\server\index.js" --planos-prueba "%DEST%"
if errorlevel 1 ( echo La prueba NO termino bien. Revise el mensaje anterior; no se modifico ningun proyecto. & set "RC=1" & goto :fin )
echo Listo. Abra los PDF y el archivo *-planos.dxf siguiendo documentos\UAT-PLANOS-AUTOCAD-2027.md
if /i not "%TANNIA_INSTALADOR_SIN_ABRIR%"=="1" explorer "%DEST%"
set "RC=0"
:fin
if defined TMPX if exist "%TMPX%" rmdir /s /q "%TMPX%" >nul 2>nul
if /i not "%TANNIA_INSTALADOR_SIN_PAUSA%"=="1" pause
exit /b %RC%
