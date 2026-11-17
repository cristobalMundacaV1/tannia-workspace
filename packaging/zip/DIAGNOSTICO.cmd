@echo off
rem Tannia Workspace {{VERSION}} - diagnostico de instalacion. Solo lectura: no cambia nada.
rem Guarda un informe en %TEMP%\Diagnostico-Tannia-Workspace.txt (revise su contenido antes de compartirlo).
setlocal EnableExtensions
cd /d "%~dp0"
set "OUT=%TEMP%\Diagnostico-Tannia-Workspace.txt"
> "%OUT%" (
  echo Diagnostico de Tannia Workspace {{VERSION}} - %date% %time%
  echo Paquete: {{MCPB}}  commit {{COMMIT}}
  echo.
  echo [Sistema]
  ver
  echo Arquitectura: %PROCESSOR_ARCHITECTURE% %PROCESSOR_ARCHITEW6432%
  echo.
  echo [Integridad del paquete]
  certutil -hashfile "{{MCPB}}" SHA256
  echo Esperado: {{SHA_MCPB}}
  echo.
  echo [Claude Desktop]
  if exist "%LOCALAPPDATA%\AnthropicClaude\claude.exe" (echo Encontrado en LOCALAPPDATA\AnthropicClaude) else (echo No esta en LOCALAPPDATA\AnthropicClaude)
  if exist "%LOCALAPPDATA%\Programs\Claude\Claude.exe" (echo Encontrado en LOCALAPPDATA\Programs\Claude) else (echo No esta en LOCALAPPDATA\Programs\Claude)
  reg query "HKCU\Software\Classes\.mcpb" 2>&1
  echo.
  echo [Extensiones de Claude Desktop]
  if exist "%APPDATA%\Claude\Claude Extensions" (dir /b "%APPDATA%\Claude\Claude Extensions") else (echo Carpeta de extensiones no encontrada)
  echo.
  echo [AutoCAD]
  reg query "HKLM\SOFTWARE\Autodesk\AutoCAD" 2>&1
  echo.
  echo [Carpeta de proyectos sugerida]
  if exist "%USERPROFILE%\Documents\Tannia Workspace\Proyectos" (dir /b "%USERPROFILE%\Documents\Tannia Workspace\Proyectos") else (echo No existe Documentos\Tannia Workspace\Proyectos)
  echo.
  echo [Registro del instalador]
  if exist "%LOCALAPPDATA%\Tannia Workspace\instalador.log" (type "%LOCALAPPDATA%\Tannia Workspace\instalador.log") else (echo Sin registro)
)
echo Diagnostico guardado en: %OUT%
if /i not "%TANNIA_INSTALADOR_SIN_PAUSA%"=="1" start "" notepad "%OUT%"
exit /b 0
