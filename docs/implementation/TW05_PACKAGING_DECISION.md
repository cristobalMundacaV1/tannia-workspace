# TW-05 — Decisión de empaquetado

**Decisión:** distribuir **solo `.mcpb`** (extensión de Claude Desktop). **No se crea instalador `.exe`.**

## Por qué `.mcpb` resuelve la necesidad (evidencia)
| Necesidad | Cómo se cubre | Evidencia |
|---|---|---|
| Sin Python/Node/Docker en el PC de Tannia | El servidor es Node; Claude Desktop trae su propio runtime de Node para extensiones. El paquete es **un único archivo JS** (0 `node_modules`) | `test/tw00a_package.test.js`: desempaquetado limpio sin `node_modules` |
| Sin editar JSON ni consola | Instalación por doble clic / arrastrar en Claude Desktop; la carpeta de proyectos se elige en un cuadro de configuración (`user_config`) | `manifest.json` (`user_config.carpeta_tannia`); **UI real: NO VERIFICADO** |
| No sobrescribir la configuración de Claude | Tannia Workspace **no escribe** `claude_desktop_config.json`; la gestiona Claude Desktop | revisión de código: ningún acceso a esa ruta |
| Actualización | Reemplazar la extensión; los datos viven fuera (`Documents/Tannia Workspace`) | `test/tw05_install.test.js` (0.1.0 → 0.2.0 conserva proyectos y huellas) |
| Desinstalación / rollback | Quitar la extensión; los proyectos permanecen. Reinstalar la versión anterior `.mcpb` revierte | idem |
| Ruta con espacios/acentos | Pruebas con `ext instalada ñ`, `Datos Tannia`, `Obra Ñ` | idem |
| Diagnóstico y reparación | `tannia_diagnostico`, `tannia_proyecto_reparar` (restaura JSON desde `.bak`, recrea carpetas) | `test/tw05_install.test.js` |
| Logs sin datos privados | stderr solo emite eventos genéricos | `test/tw05_install.test.js` (log no contiene nombre de proyecto, ruta ni contenido) |
| Sin red | El código propio no importa módulos de red | `test/tw05_install.test.js` |

## Por qué no `.exe`
Un instalador añadiría un binario sin firma (SmartScreen/antivirus), requisitos de firma de código y una segunda superficie de mantenimiento, sin resolver ninguna necesidad no cubierta por `.mcpb`. **Reabrir esta decisión** si en el PC de Tannia ocurre: (a) su Claude Desktop no admite extensiones `.mcpb`; (b) la integración COM con AutoCAD exige un componente nativo que Node no pueda alcanzar; (c) políticas corporativas bloquean extensiones.

## Límites NO VERIFICADOS (solo comprobables en Windows con Claude Desktop)
- Instalación real desde la interfaz de Claude Desktop y aparición de las herramientas.
- Permisos de usuario estándar en Windows y rutas largas > 260 caracteres.
- Compatibilidad con la versión concreta de Claude Desktop de Tannia (el manifest declara `manifest_version 0.3`, Node ≥ 18).
- Pruebas automatizadas en Windows: ver CI `windows-latest` (evidencia en `EVIDENCE_MATRIX.md`).
