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
