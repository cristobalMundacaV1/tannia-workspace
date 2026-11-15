# EVIDENCE_MATRIX

Entorno de desarrollo (único donde se ejecutaron pruebas): Linux 6.18 x64, Node v22.23.4, Python 3.13 (solo oráculos), LibreOffice. **Sin AutoCAD, sin Windows, sin Claude Desktop.**
La columna SHA indica el commit que **introdujo** la capacidad y su prueba; la **suite completa** se ejecutó de nuevo sobre el SHA final indicado en `docs/qa/TEST_REPORT.md` (y por CI Linux/Windows, ver sección CI). Estados: ver `docs/implementation/TW_FULL_DELIVERY_MACROPHASE.md` §5.

| ID | Capacidad | Estado | Comando / evidencia | SHA |
|---|---|---|---|---|
| E-00A-1 | Protocolo MCP stdio: listar herramientas, crear proyecto, inspeccionar DXF | TEST_INTEGRACIÓN_APROBADO | `npm test` → `test/tw00a_protocol.test.js` | b62f813 |
| E-00A-2 | `.mcpb` construido con CLI oficial, validado, desempaquetado en ruta con espacios/acentos sin `node_modules` y ejecutado | TEST_INTEGRACIÓN_APROBADO | `test/tw00a_package.test.js` | b62f813 |
| E-00A-3 | Sandbox: traversal, absolutas, UNC, ADS, nombres reservados, symlinks, proyecto enlazado, escritura en originales | TEST_AUTOMATIZADO_APROBADO | `test/security.test.js` (symlinks POSIX; uniones/junction de Windows NO VERIFICADO) | b62f813 |
| E-00A-4 | Uso desde Claude Desktop (UI) | NO VERIFICADO | Requiere Claude Desktop en Windows/macOS; procedimiento en `docs/qa/MANUAL_TESTS_TANNIA_PC.md` | — |
| E-01-1 | Longitud/perímetro/área por capa (LINE, ARC, CIRCLE, LWPOLYLINE con bulge) vs valores analíticos | TEST_AUTOMATIZADO_APROBADO | `test/tw01_dxf.test.js` | c2cfc43 |
| E-01-2 | INSERT: escala, rotación, espejo, arreglos, anidado, recursivo, inexistente | TEST_AUTOMATIZADO_APROBADO | idem | c2cfc43 |
| E-01-3 | Duplicados excluidos, abiertas, autointersección, unidades ausentes/discrepantes → needs_review/bloqueo | TEST_AUTOMATIZADO_APROBADO | idem | c2cfc43 |
| E-01-4 | DXF corrupto/binario/no-DXF/vacío con error codificado | TEST_AUTOMATIZADO_APROBADO | idem | c2cfc43 |
| E-01-5 | Compatibilidad con DXF reales de AutoCAD (todas las versiones) | NO VERIFICADO | Fixtures sintéticos generados con ezdxf R2010; DXF real de Tannia pendiente | — |
| E-02-1 | APU/presupuesto CLP: totales calculados a mano (GG, utilidades, IVA, redondeo) | TEST_AUTOMATIZADO_APROBADO | `test/tw02_budget.test.js` (precios ficticios `TEST`, solo aritmética) | c29c248 |
| E-02-2 | XLSX con fórmulas vivas; recalculado SIN caché por LibreOffice 24.x headless == cálculo JS | TEST_INTEGRACIÓN_APROBADO | idem | c29c248 |
| E-02-3 | Bloqueo de estado FINAL: precio faltante, cantidad no verificada, unidad distinta, sin APU, needs_review | TEST_AUTOMATIZADO_APROBADO | idem | c29c248 |
| E-02-4 | Apertura del XLSX en Microsoft Excel real | NO VERIFICADO | Solo exceljs + LibreOffice | — |
| E-02-5 | Precios/rendimientos de mercado chilenos | NO INCLUIDO | Nunca se inventan; los aporta la usuaria con fuente y fecha | — |
| E-03-1 | PDF vectorial: extracción de trazos, calibración por cota con verificación cruzada, longitud/área reales (1:100), curvas Bézier (círculo ≈ πr²), varias páginas | TEST_AUTOMATIZADO_APROBADO | `test/tw03_pdf.test.js` (fixtures reportlab) | fd2fb16 |
| E-03-2 | PDF escaneado / corrupto / no-PDF / texto con instrucciones maliciosas tratado como dato | TEST_AUTOMATIZADO_APROBADO | idem | fd2fb16 |
| E-03-3 | Memoria PDF: reabrible, acentos, paginación, trazabilidad, BORRADOR | TEST_AUTOMATIZADO_APROBADO | `test/tw03_report.test.js` | fd2fb16 |
| E-03-4 | Planos PDF reales de Tannia (escaneos, escalas mixtas, capas OCG) | NO VERIFICADO | Solo fixtures sintéticos | — |
| E-03-5 | Evaluación OpenTakeoff: licencia AGPL-3.0 confirmada; código no auditado | DOCUMENTADO | `docs/evaluations/THIRD_PARTY_EVALUATION.md` | fd2fb16 |
| E-04-1 | Flujo completo (crear → originales → copia → cubicar → APU → XLSX → verificar → aprobar → exportar) por MCP stdio, contra código fuente y contra el bundle `.mcpb` | TEST_INTEGRACIÓN_APROBADO | `test/tw04_workflow.test.js` | f82c4b0 |
| E-04-2 | Gates: salto de estado, aprobación sin confirmación explícita, cantidades sin verificar, datos modificados invalidan aprobación | TEST_INTEGRACIÓN_APROBADO | idem | f82c4b0 |
| E-04-3 | Persistencia tras reinicio del servidor; recuperación de `project.json` dañado desde `.bak` | TEST_INTEGRACIÓN_APROBADO | idem | f82c4b0 |
| E-04-4 | Texto malicioso en DXF/PDF devuelto como DATO; originales intactos; rutas fuera de proyecto rechazadas | TEST_INTEGRACIÓN_APROBADO | idem + `tw03_pdf` | f82c4b0 |
| E-04-5 | Resistencia a prompt injection del modelo real (Claude) | NO VERIFICADO | Las defensas son estructurales (herramientas, gates); el comportamiento del modelo no se midió | — |
| E-04-6 | Enlaces BCN en índice normativo | NO VERIFICADO | BCN devolvió HTTP 401 al proxy del entorno; MINVU/SEC/INN/MOP 200 | — |
| E-05-1 | Actualización 0.1.0→0.2.0 conserva proyectos y huellas; desinstalar no borra datos; reinstalar recupera | TEST_INTEGRACIÓN_APROBADO | `test/tw05_install.test.js` | da75965 |
| E-05-2 | Logs sin rutas/nombres/contenido; código propio sin módulos de red; reparación de proyecto | TEST_AUTOMATIZADO_APROBADO | idem | da75965 |
| E-05-3 | Carpeta sin permiso de escritura → diagnóstico claro | NO EJECUTADO en este entorno (corre como root; test se omite) | `test/tw05_install.test.js` (skip si root/Windows) | — |
| E-05-4 | Instalación desde la UI de Claude Desktop; usuario estándar Windows; rutas >260 caracteres | NO VERIFICADO | `docs/implementation/TW05_PACKAGING_DECISION.md` | — |
| E-06-1 | Matriz entidad×operación×backend con integridad automática (cada SUPPORTED apunta a un test existente; `autocad_com` sin SUPPORTED) y doc generado al día | TEST_AUTOMATIZADO_APROBADO | `test/tw06_cad.test.js` → `docs/qa/CAD_CAPABILITY_MATRIX.md` | (commit TW-06/06A) |
| E-06-2 | Adaptador COM: scripts sin comandos destructivos, entrada solo por JSON base64, edición únicamente en copias de `03 Trabajo`, inyección en handle/capa rechazada, errores traducidos | TEST_AUTOMATIZADO_APROBADO (ejecutor simulado) | idem | (commit TW-06/06A) |
| E-06-3 | **Comportamiento real del adaptador COM en AutoCAD** (listar, medir, abrir copia, agregar línea) por versión | NO VERIFICADO EN AUTOCAD REAL | `docs/qa/MANUAL_TESTS_TANNIA_PC.md` | — |
| E-06-4 | Detección de AutoCAD/LT por registro (parser) | TEST_AUTOMATIZADO_APROBADO (salida de `reg query` simulada) | idem | (commit TW-06/06A) |
| E-06A-1 | 3DFACE (cubo 2×3×4: V=24, A=52), MESH (pirámide V=1/3), POLYFACE (prisma V=2, A=10), POLYLINE3D L=17 vs oráculo analítico | TEST_AUTOMATIZADO_APROBADO | `test/tw06a_3d.test.js` | (commit TW-06/06A) |
| E-06A-2 | Malla abierta/orientación inconsistente/duplicada → sin volumen + needs_review; normales invertidas con aviso; espejo correcto; conversión cúbica de unidades | TEST_AUTOMATIZADO_APROBADO | idem | (commit TW-06/06A) |
| E-06A-3 | Volumen/área de 3DSOLID, REGION, SURFACE | NO SOPORTADO en DXF; `UNVERIFIED` vía COM | matriz | — |
| E-07A-1 | Piloto 2D con Tannia | PILOTO TANNIA NO EJECUTADO | protocolo en `docs/pilot/PILOTO_2D_TW07A.md` | — |
| E-07B-1 | Piloto 3D con Tannia / AutoCAD real | PILOTO TANNIA NO EJECUTADO | protocolo en `docs/pilot/PILOTO_3D_TW07B.md` | — |
| E-08-1 | Paquete RC (`.mcpb`), `SHA256SUMS.txt` verificado con `sha256sum -c`, contenido interno idéntico entre compilaciones | VERIFICADO (local) | `scripts/release.mjs` | (ver commit final) |
| E-08-2 | Licencias: 289 paquetes; 0 copyleft fuerte (jszip dual MIT/GPL → MIT); `buffers@0.1.1` sin licencia declarada | PARCIAL | `docs/LICENSES.md` | (ver commit final) |
| E-08-3 | `npm audit --omit=dev`: zod (alto) corregido con 4.6.7; `uuid` (moderado, vía exceljs) aceptado como P3 | DOCUMENTADO | `docs/KNOWN_LIMITATIONS.md` | (ver commit final) |

## CI (GitHub Actions, ubuntu-latest y windows-latest)
Los resultados de cada ejecución se enlazan en el PR. Hallazgos reales de Windows corregidos durante el desarrollo: ruta `/D:/…` en helper de pruebas, `import()` con ruta absoluta, invocación de `mcpb.cmd` con espacios. Estado de la última ejecución: ver PR.

## Issue #8 (rc.2)
| ID | Capacidad | Estado | Evidencia | SHA |
|---|---|---|---|---|
| E-I8-1 | Ruta Unicode con apóstrofo viaja Node→PowerShell→Node idéntica (Windows PowerShell 5.1 real) | TEST_INTEGRACIÓN_APROBADO (CI windows-latest, run #20) | `test/tw09_windows_powershell.test.js` | ef061bf |
| E-I8-2 | Autorización de copia/ORIGINAL_PROTEGIDO con causas separadas; fallo cerrado; enlaces | TEST_AUTOMATIZADO_APROBADO (Linux local) + CI | `test/tw06_cad.test.js` | ef061bf |
| E-I8-3 | Registro fallido no impide COM; causas separadas | TEST_AUTOMATIZADO_APROBADO | `test/tw06_cad.test.js` | ef061bf |
| E-I8-4 | Capa antes de dibujar; todo-o-nada con reversión; sin guardado ante fallo (AutoCAD **simulado en PowerShell**, scripts reales) | TEST_INTEGRACIÓN_APROBADO (CI windows-latest, run #20) | `tw09` | ef061bf |
| E-I8-5 | `TANNIA_HOME`: reinicio con otra carpeta; advertencias | TEST_INTEGRACIÓN_APROBADO | `test/tw10_config.test.js` | ef061bf |
| E-I8-6 | Todo lo anterior contra **AutoCAD 2027 real** | NO VERIFICADO — aceptación pendiente | `docs/qa/ISSUE_8_FIX.md` | — |
| E-I8-7 | Cambio de `TANNIA_HOME` en la UI de Claude Desktop | NO VERIFICADO | `MANUAL_TESTS_TANNIA_PC.md` §H | — |

## Issue #9 y validación 2D (rc.3)
| ID | Capacidad | Estado | Evidencia |
|---|---|---|---|
| E-I9-1 | Política de originales: residuos excluidos, DWG/DXF/PDF nunca excluibles, locks sin hash/permisos, verificación sin falsos positivos, captura inestable, migración desde rc.2 | TEST_AUTOMATIZADO_APROBADO | `test/tw11_originals_policy.test.js` |
| E-I9-2 | Análisis de cierre/rectángulo desde extremos (huecos, sueltas, duplicadas, no rectángulo, orden/sentido) | TEST_AUTOMATIZADO_APROBADO | `test/tw12_geometry_check.test.js` |
| E-I9-3 | Lectura de StartPoint/EndPoint y persistencia (Close(false)+Open) con scripts reales en PowerShell 5.1 y AutoCAD simulado | VER CI Windows del SHA final | `test/tw09_windows_powershell.test.js` |
| E-I9-4 | LINE.longitud y LINE.editar_en_copia en AutoCAD 2027 real (rc.2) | EVIDENCIA REAL del usuario (sin logs adjuntos) | issue #8 comentario 6902750822 |
| E-I9-5 | Lectura real de extremos, cierre del rectángulo y persistencia tras reabrir en AutoCAD real | NO VERIFICADO — repetición final pendiente | `docs/qa/ISSUE_9_FIX.md` §Protocolo |
