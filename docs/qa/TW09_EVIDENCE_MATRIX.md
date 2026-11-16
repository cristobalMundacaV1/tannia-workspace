# TW-09 — Matriz de evidencias por historia/gate

Estados: `AUTOMATIZADO` (pruebas en CI Windows+Ubuntu sobre el SHA indicado) · `SIMULADO` (servidor COM / PowerShell simulados) · `NO VERIFICADO (HW)` (requiere AutoCAD/Claude Desktop real) · `NO VERIFICADO (usuaria)`.

| ID | Afirmación | Estado | Prueba |
|---|---|---|---|
| T9-01 | Persistencia 51→0 con SHA idéntico no es `verificada` | AUTOMATIZADO + SIMULADO | `test/tw17_persistencia_global.test.js` |
| T9-02 | Entidad nueva, handle perdido, otro documento y conteo por capa se detectan en ambos sentidos | AUTOMATIZADO | `tw17` |
| T9-03 | Lecturas por ruta; cero documentos; escrituras no se reintentan | AUTOMATIZADO + PowerShell simulado (CI Windows) | `tw17`, `tw06`, `tw09` |
| T9-04 | Causa real de `ModelSpace.Count=0` en AutoCAD | **NO VERIFICADO (HW)** — instrumentada | campo `reapertura` del resultado |
| T9-05 | Alturas 2D/3D por facetas; altura 3D sale del plano 2D | AUTOMATIZADO | `tw18` |
| T9-06 | Semántica de vanos, inspección, candidatos y previsualización sin escritura | AUTOMATIZADO | `tw19` |
| T9-07 | Identidad estable, resolver sin adivinar, resumen | AUTOMATIZADO | `tw20` |
| T9-08 | Importación con hash/manifiesto, sin sobrescribir ni rutas privadas en el manifiesto | AUTOMATIZADO | `tw20` |
| T9-09 | Adjuntos del chat accesibles para el servidor | **NO VERIFICADO (HW/UI)** | protocolo `PRUEBA_REAL_TW09.md` |
| T9-10 | Versiones transaccionales con corte en cada paso (2D y 3D) | AUTOMATIZADO | `tw21` |
| T9-11 | Exportaciones sin sobrescritura | AUTOMATIZADO | `tw21` |
| T9-12 | Enrutador de capacidades y política de autonomía | AUTOMATIZADO | `tw22` |
| T9-13 | Originales reales (DWG/DXF/PDF) intactos tras flujos completos; nombres hostiles; inyección como dato; 2 sesiones | AUTOMATIZADO | `tw23` |
| T9-14 | Flujo del encargo con continuidad entre sesiones hasta el límite de AutoCAD | AUTOMATIZADO | `tw24` |
| T9-15 | ACL de Windows, junctions, rutas >260, AutoCAD con original abierto | **NO VERIFICADO (HW)** | pendiente |
| T9-16 | Construcción 3D real, persistencia real y `AUDIT` | **NO VERIFICADO (HW)** | `PRUEBA_REAL_TW09.md` |
| T9-17 | Conversación natural con la usuaria (15 encargos) | **NO VERIFICADO (usuaria)** | pendiente |
| T9-18 | Cumplimiento normativo / aptitud estructural | **NUNCA afirmado**: fuera de alcance del producto | — |
