# Handoff a Tannia — Tannia Workspace 0.1.0-rc.1

**Estado: RC TÉCNICO.** Probado con pruebas automatizadas y simulaciones; **NO "Validado por Tannia"** y **NO validado en AutoCAD real**. Úselo primero con copias de obras ya terminadas y compare con su cálculo manual.

## Qué recibe
`tannia-workspace-0.1.0-rc.1.mcpb` (+ `.sha256`) y esta carpeta de documentos. Verifique el hash antes de instalar:
```powershell
Get-FileHash .\tannia-workspace-0.1.0-rc.1.mcpb -Algorithm SHA256
```
Debe coincidir con `SHA256SUMS.txt` / el `.sha256`. *(El paquete no está firmado: Windows/Claude pueden pedir confirmación.)*

## Qué instala exactamente
Una extensión de Claude Desktop: un único archivo `server/index.js` (~9 MB, sin dependencias externas) + `manifest.json`. **No** instala servicios, no modifica el registro, no toca `claude_desktop_config.json`, no abre puertos ni accede a internet. Sus datos viven en `Documentos\Tannia Workspace\Proyectos\`.

## Qué debe tener usted
Windows 10/11 · **Claude Desktop** actualizado (con soporte de extensiones `.mcpb`) · para AutoCAD en vivo: **AutoCAD completo** (no LT) abierto. Para DXF/PDF no necesita AutoCAD.

## Primeros pasos
1. `docs/user/INSTALACION.md` (1 página). 2. `docs/user/MANUAL_TANNIA.md` (1 página, 6 ejemplos).

## Lo que SOLO puede comprobarse en su PC (pendiente, honesto)
Ver `docs/qa/MANUAL_TESTS_TANNIA_PC.md`: instalación desde la interfaz, AutoCAD real (COM, 3D/sólidos), DXF/PDF reales suyos, Excel de Microsoft, piloto 2D (`docs/pilot/PILOTO_2D_TW07A.md`) y 3D (`PILOTO_3D_TW07B.md`). Hasta ejecutarlas, cada capacidad figura como `NO VERIFICADO` en `docs/qa/EVIDENCE_MATRIX.md`.

## Cómo volver atrás
Quitar la extensión en Claude Desktop (sus proyectos no se borran) e instalar la versión anterior. Detalle en `INSTALACION.md`.

## Qué NO hace (resumen; ver `KNOWN_LIMITATIONS.md`)
No es BIM/IFC. No inventa alturas, espesores, unidades, escalas ni precios; no incluye catálogo de precios; no certifica cumplimiento normativo; no calcula volumen de sólidos ACIS desde DXF; no edita originales.

## Qué decide el Product Owner
Merge de los PR, distribución del paquete, publicación (no se hizo ninguna), y la aceptación tras el piloto.

## Soporte
Ejecute «Haz un diagnóstico de Tannia Workspace» y envíe el resultado (no contiene planos ni nombres de proyecto).
