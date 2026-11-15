# EVIDENCE_MATRIX

Entorno de desarrollo (único donde se ejecutaron pruebas): Linux 6.18 x64, Node v22.23.4, Python 3.13 (solo oráculos), LibreOffice. **Sin AutoCAD, sin Windows, sin Claude Desktop.**
Cada fila indica el SHA sobre el que se ejecutó. Estados: ver `docs/implementation/TW_FULL_DELIVERY_MACROPHASE.md` §5.

| ID | Capacidad | Estado | Comando / evidencia | SHA |
|---|---|---|---|---|
| E-00A-1 | Protocolo MCP stdio: listar herramientas, crear proyecto, inspeccionar DXF | TEST_INTEGRACIÓN_APROBADO | `npm test` → `test/tw00a_protocol.test.js` | (ver commit) |
| E-00A-2 | `.mcpb` construido con CLI oficial, validado, desempaquetado en ruta con espacios/acentos sin `node_modules` y ejecutado | TEST_INTEGRACIÓN_APROBADO | `test/tw00a_package.test.js` | (ver commit) |
| E-00A-3 | Sandbox: traversal, absolutas, UNC, ADS, nombres reservados, symlinks, proyecto enlazado, escritura en originales | TEST_AUTOMATIZADO_APROBADO | `test/security.test.js` (symlinks POSIX; uniones/junction de Windows NO VERIFICADO) | (ver commit) |
| E-00A-4 | Uso desde Claude Desktop (UI) | NO VERIFICADO | Requiere Claude Desktop en Windows/macOS; procedimiento en `docs/qa/MANUAL_TESTS_TANNIA_PC.md` | — |
