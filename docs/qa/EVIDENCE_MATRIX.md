# EVIDENCE_MATRIX

Entorno de desarrollo (único donde se ejecutaron pruebas): Linux 6.18 x64, Node v22.23.4, Python 3.13 (solo oráculos), LibreOffice. **Sin AutoCAD, sin Windows, sin Claude Desktop.**
Cada fila indica el SHA sobre el que se ejecutó. Estados: ver `docs/implementation/TW_FULL_DELIVERY_MACROPHASE.md` §5.

| ID | Capacidad | Estado | Comando / evidencia | SHA |
|---|---|---|---|---|
| E-00A-1 | Protocolo MCP stdio: listar herramientas, crear proyecto, inspeccionar DXF | TEST_INTEGRACIÓN_APROBADO | `npm test` → `test/tw00a_protocol.test.js` | (ver commit) |
| E-00A-2 | `.mcpb` construido con CLI oficial, validado, desempaquetado en ruta con espacios/acentos sin `node_modules` y ejecutado | TEST_INTEGRACIÓN_APROBADO | `test/tw00a_package.test.js` | (ver commit) |
| E-00A-3 | Sandbox: traversal, absolutas, UNC, ADS, nombres reservados, symlinks, proyecto enlazado, escritura en originales | TEST_AUTOMATIZADO_APROBADO | `test/security.test.js` (symlinks POSIX; uniones/junction de Windows NO VERIFICADO) | (ver commit) |
| E-00A-4 | Uso desde Claude Desktop (UI) | NO VERIFICADO | Requiere Claude Desktop en Windows/macOS; procedimiento en `docs/qa/MANUAL_TESTS_TANNIA_PC.md` | — |
| E-01-1 | Longitud/perímetro/área por capa (LINE, ARC, CIRCLE, LWPOLYLINE con bulge) vs valores analíticos | TEST_AUTOMATIZADO_APROBADO | `test/tw01_dxf.test.js` | (ver commit) |
| E-01-2 | INSERT: escala, rotación, espejo, arreglos, anidado, recursivo, inexistente | TEST_AUTOMATIZADO_APROBADO | idem | (ver commit) |
| E-01-3 | Duplicados excluidos, abiertas, autointersección, unidades ausentes/discrepantes → needs_review/bloqueo | TEST_AUTOMATIZADO_APROBADO | idem | (ver commit) |
| E-01-4 | DXF corrupto/binario/no-DXF/vacío con error codificado | TEST_AUTOMATIZADO_APROBADO | idem | (ver commit) |
| E-01-5 | Compatibilidad con DXF reales de AutoCAD (todas las versiones) | NO VERIFICADO | Fixtures sintéticos generados con ezdxf R2010; DXF real de Tannia pendiente | — |
| E-02-1 | APU/presupuesto CLP: totales calculados a mano (GG, utilidades, IVA, redondeo) | TEST_AUTOMATIZADO_APROBADO | `test/tw02_budget.test.js` (precios ficticios `TEST`, solo aritmética) | (ver commit) |
| E-02-2 | XLSX con fórmulas vivas; recalculado SIN caché por LibreOffice 24.x headless == cálculo JS | TEST_INTEGRACIÓN_APROBADO | idem | (ver commit) |
| E-02-3 | Bloqueo de estado FINAL: precio faltante, cantidad no verificada, unidad distinta, sin APU, needs_review | TEST_AUTOMATIZADO_APROBADO | idem | (ver commit) |
| E-02-4 | Apertura del XLSX en Microsoft Excel real | NO VERIFICADO | Solo exceljs + LibreOffice | — |
| E-02-5 | Precios/rendimientos de mercado chilenos | NO INCLUIDO | Nunca se inventan; los aporta la usuaria con fuente y fecha | — |
| E-03-1 | PDF vectorial: extracción de trazos, calibración por cota con verificación cruzada, longitud/área reales (1:100), curvas Bézier (círculo ≈ πr²), varias páginas | TEST_AUTOMATIZADO_APROBADO | `test/tw03_pdf.test.js` (fixtures reportlab) | (ver commit) |
| E-03-2 | PDF escaneado / corrupto / no-PDF / texto con instrucciones maliciosas tratado como dato | TEST_AUTOMATIZADO_APROBADO | idem | (ver commit) |
| E-03-3 | Memoria PDF: reabrible, acentos, paginación, trazabilidad, BORRADOR | TEST_AUTOMATIZADO_APROBADO | `test/tw03_report.test.js` | (ver commit) |
| E-03-4 | Planos PDF reales de Tannia (escaneos, escalas mixtas, capas OCG) | NO VERIFICADO | Solo fixtures sintéticos | — |
| E-03-5 | Evaluación OpenTakeoff: licencia AGPL-3.0 confirmada; código no auditado | DOCUMENTADO | `docs/evaluations/THIRD_PARTY_EVALUATION.md` | (ver commit) |
| E-04-1 | Flujo completo (crear → originales → copia → cubicar → APU → XLSX → verificar → aprobar → exportar) por MCP stdio, contra código fuente y contra el bundle `.mcpb` | TEST_INTEGRACIÓN_APROBADO | `test/tw04_workflow.test.js` | (ver commit) |
| E-04-2 | Gates: salto de estado, aprobación sin confirmación explícita, cantidades sin verificar, datos modificados invalidan aprobación | TEST_INTEGRACIÓN_APROBADO | idem | (ver commit) |
| E-04-3 | Persistencia tras reinicio del servidor; recuperación de `project.json` dañado desde `.bak` | TEST_INTEGRACIÓN_APROBADO | idem | (ver commit) |
| E-04-4 | Texto malicioso en DXF/PDF devuelto como DATO; originales intactos; rutas fuera de proyecto rechazadas | TEST_INTEGRACIÓN_APROBADO | idem + `tw03_pdf` | (ver commit) |
| E-04-5 | Resistencia a prompt injection del modelo real (Claude) | NO VERIFICADO | Las defensas son estructurales (herramientas, gates); el comportamiento del modelo no se midió | — |
| E-04-6 | Enlaces BCN en índice normativo | NO VERIFICADO | BCN devolvió HTTP 401 al proxy del entorno; MINVU/SEC/INN/MOP 200 | — |
| E-05-1 | Actualización 0.1.0→0.2.0 conserva proyectos y huellas; desinstalar no borra datos; reinstalar recupera | TEST_INTEGRACIÓN_APROBADO | `test/tw05_install.test.js` | (ver commit) |
| E-05-2 | Logs sin rutas/nombres/contenido; código propio sin módulos de red; reparación de proyecto | TEST_AUTOMATIZADO_APROBADO | idem | (ver commit) |
| E-05-3 | Carpeta sin permiso de escritura → diagnóstico claro | NO EJECUTADO en este entorno (corre como root; test se omite) | `test/tw05_install.test.js` (skip si root/Windows) | — |
| E-05-4 | Instalación desde la UI de Claude Desktop; usuario estándar Windows; rutas >260 caracteres | NO VERIFICADO | `docs/implementation/TW05_PACKAGING_DECISION.md` | — |
| E-06-1 | Matriz entidad×operación×backend con integridad automática (cada SUPPORTED apunta a un test existente; `autocad_com` sin SUPPORTED) y doc generado al día | TEST_AUTOMATIZADO_APROBADO | `test/tw06_cad.test.js` → `docs/qa/CAD_CAPABILITY_MATRIX.md` | (ver commit) |
| E-06-2 | Adaptador COM: scripts sin comandos destructivos, entrada solo por JSON base64, edición únicamente en copias de `03 Trabajo`, inyección en handle/capa rechazada, errores traducidos | TEST_AUTOMATIZADO_APROBADO (ejecutor simulado) | idem | (ver commit) |
| E-06-3 | **Comportamiento real del adaptador COM en AutoCAD** (listar, medir, abrir copia, agregar línea) por versión | NO VERIFICADO EN AUTOCAD REAL | `docs/qa/MANUAL_TESTS_TANNIA_PC.md` | — |
| E-06-4 | Detección de AutoCAD/LT por registro (parser) | TEST_AUTOMATIZADO_APROBADO (salida de `reg query` simulada) | idem | (ver commit) |
| E-06A-1 | 3DFACE (cubo 2×3×4: V=24, A=52), MESH (pirámide V=1/3), POLYFACE (prisma V=2, A=10), POLYLINE3D L=17 vs oráculo analítico | TEST_AUTOMATIZADO_APROBADO | `test/tw06a_3d.test.js` | (ver commit) |
| E-06A-2 | Malla abierta/orientación inconsistente/duplicada → sin volumen + needs_review; normales invertidas con aviso; espejo correcto; conversión cúbica de unidades | TEST_AUTOMATIZADO_APROBADO | idem | (ver commit) |
| E-06A-3 | Volumen/área de 3DSOLID, REGION, SURFACE | NO SOPORTADO en DXF; `UNVERIFIED` vía COM | matriz | — |
