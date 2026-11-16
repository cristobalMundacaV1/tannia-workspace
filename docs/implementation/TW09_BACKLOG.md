# TW-09 — Backlog y estado por historia (verificado sobre el código de la rama `feat/tw09-autonomia`)

Leyenda: **HECHO** = implementado + pruebas automatizadas verdes (CI Windows/Ubuntu) · **PARCIAL** = implementado en parte (se indica qué falta) · **PENDIENTE** = no iniciado o requiere hardware/usuaria · **HW** = su gate requiere AutoCAD/Claude Desktop real y queda **NO VERIFICADO**.

| Historia | Estado | Evidencia / qué falta |
|---|---|---|
| 09-001 Baseline, matriz C/E/H | HECHO | `docs/qa/TW09_AUDIT_INITIAL.md`, `TW09_EVIDENCE_MATRIX.md` |
| 09-002 Reproducir 51→0, 2500/2400, vanos, SIN_DOCUMENTO | PARCIAL | 51→0 **reproducido en simulación** (`tw17`); causa real del `ModelSpace.Count=0` **no establecida** (se instrumentó la reapertura: conteo inicial/final y espera); 2500/2400/2600 reproducido y corregido (`tw18`); semántica de vanos aclarada (`tw19`); `AUTOCAD_SIN_DOCUMENTO` transitorio: **no reproducido** (hipótesis de dependencia del documento activo, mitigada) |
| 09-003 Gate de compatibilidad del `.mcpb` | PARCIAL | prueba recursiva de esquemas de las herramientas + smoke del bundle (`tw16`); **instalación en Claude Desktop real: HW pendiente** |
| 09-004 Persistencia: conteos globales, extraños, doble enumeración, identidad | HECHO | `tw17`, `tw15` (51→0 ya no es `verificada`) |
| 09-005 Ciclo de vida COM (cero/múltiples documentos, ruta, foco) | PARCIAL | cero documentos, lecturas por ruta, documento reabierto por ruta (`tw17`, `tw09` PS). Falta: serialización explícita de transiciones y modo multi‑dibujo probado en AutoCAD real (HW) |
| 09-006 Sin reintento mutante | HECHO | `REINTENTO_SEGURO` solo lecturas (`tw17`) |
| 09-007 Diagnóstico de `AUDIT` y diferencias | PENDIENTE | `AUDIT` sigue siendo comprobación visual del usuario; no se automatiza vía `SendCommand` (asíncrono, no verificable) |
| 09-008 Contrato semántico de alturas 2D↔3D por facetas | HECHO | `tw18` |
| 09-009 Unificar semántica centro/borde/ancla de vanos | HECHO | `tw19`; descriptores del catálogo actualizados |
| 09-010 Inspección, previsualización pura, candidatos libres | HECHO | `tannia_diseno_inspeccionar`, `tannia_diseno_previsualizar` (`tw19`) |
| 09-011 Resincronización 2D→3D conserva decisiones y supuestos | HECHO | `tw18`, `tw16` |
| 09-012 Identidad estable y migración | HECHO | `asegurarId`, copia `project.pre-id.json` (`tw20`) |
| 09-013 Creación idempotente / nombres Windows Unicode | PARCIAL | colisión por nombres equivalentes (`PROYECTO_PARECIDO`), resolver/resumen para reanudar; crear un proyecto existente falla con mensaje (no “reanuda” solo) |
| 09-014 Importación local segura | PARCIAL | `tannia_proyecto_importar` (hash, manifiesto, sin sobrescribir, dedupe, límites) — `tw20`. **Qué entrega Claude Desktop de los adjuntos: HW/UI pendiente**; el producto no simula lecturas |
| 09-015 Resumen por proyecto | HECHO | `tannia_proyecto_resumen` (`tw20`) |
| 09-016 Transacciones de versión 2D/3D | PARCIAL | staging+journal+manifiesto+reconciliación con corte inyectado en cada paso (`tw21`) para 2D y 3D; el DWG no tiene aún manifiesto propio |
| 09-017 Sin sobrescritura en exportaciones y artefactos | HECHO | `escribirSinSobrescribir` (memoria PDF, entregables, huellas) (`tw21`) |
| 09-018 Recuperación de interrupciones | PARCIAL | reconciliación y apartado a `.huerfanos` (`tw21`); sin pruebas de reinicio de equipo ni disco lleno reales |
| 09-019 Enrutador de capacidad | HECHO | `tannia_encargo_evaluar` (`tw22`) |
| 09-020 Flujo completo nuevo proyecto → antecedentes → 2D/3D → AutoCAD | PARCIAL | recorrido automatizado hasta el límite de AutoCAD (`tw24`); **construcción real en AutoCAD: HW** |
| 09-021 Trabajo sobre documentos reales | PARCIAL | el router declara qué se puede extraer y los límites (DWG/PDF/imagen); no se añadió extracción nueva |
| 09-022 Política de autonomía | PARCIAL | política en instrucciones del servidor + `tannia_politica_autonomia` + enrutador; no hay control de autorización por herramienta (las destructivas ya no sobrescriben) |
| 09-023 Respuestas compactas | PARCIAL | tope del JSON en texto (6 000 car.; detalle completo en `structuredContent`) y mensajes breves en herramientas nuevas; herramientas antiguas conservan su formato |
| 09-024 Continuidad entre sesiones | HECHO | resolver + resumen, reinicio de servidor (`tw24`) |
| 09-025 Recuperación por caminos seguros | PARCIAL | errores claros, no reintento mutante, reconciliación; sin transcripciones reales |
| 09-026 Pruebas de originales (ACL, locks, junctions, Unicode, rutas largas) | PARCIAL | archivos reales sintéticos, Unicode, nombres hostiles, hash/mtime intactos (`tw23`); ACL reales de Windows, junctions y rutas >260: HW |
| 09-027 Seguridad de archivos aportados | PARCIAL | formatos, tamaño (200 MB), enlaces, origen dentro de proyectos, contenido como dato (`tw20`, `tw23`); sin escaneo de contenido |
| 09-028 Rendimiento y resistencia | PARCIAL | lotes (2 000 entidades), dos sesiones simultáneas (`tw15`, `tw23`), límites de línea de comandos Windows; sin dataset real grande |
| 09-029 Matriz Claude Desktop/Windows/AutoCAD 2027 | PENDIENTE (HW) | protocolo `docs/qa/PRUEBA_REAL_TW09.md` |
| 09-030 Aceptación con la usuaria (15 encargos) | PENDIENTE (usuaria) | no ejecutado |
| 09-031 Informe final, manual, PR draft | PARCIAL | este backlog, matriz, informe de regresión, PR draft; manual de 1 página y dossier de release no regenerados |

**Gates:** G0 parcial · G1 automatizado cumplido, real HW pendiente · G2 cumplido · G3 cumplido (importación real HW) · G4 automatizado parcial · G5 parcial · G6 parcial (sin transcripciones reales) · G7 parcial · G8 **no alcanzado** (sin piloto ni validación real).
