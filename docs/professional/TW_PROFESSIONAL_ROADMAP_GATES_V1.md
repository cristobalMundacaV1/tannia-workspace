# Tannia Workspace — Roadmap profesional y criterios de gates v1

**Fecha:** 2026-11-17. **Estado:** propuesta documental para PO y revisores profesionales; no autoriza merges, cambios funcionales ni despliegues. **Base:** PR #21 SHA 2f4cdd07. Complementa TW-00→TW-12, no sustituye evidencias anteriores.

## 1. Objetivo medible del primer piloto

Una profesional, en un PC Windows de usuario estándar con AutoCAD real y Claude Desktop, completa un encargo de edificación: abrir una copia DWG/DXF, auditar, cubicar un conjunto de partidas, generar memoria, presupuesto Excel y láminas, revisar, corregir y entregar con advertencias; todo sin terminal, sin tocar originales y sin cifras no sustentadas.

Sin esta demostración no anunciar «nivel profesional validado», «apto para construcción» ni «compatibilidad AutoCAD garantizada». Una aprobación técnica de construcción nunca es automática.

## 2. Gates bloqueantes y medibles

| Gate | Prioridad | Entrega | Evidencia de aprobación | Responsable |
|---|---|---|---|---|
| PRO-G0 Baseline | P0 | Estado y contratos canónicos por SHA, inventario de herramientas | Snapshot de tools/list, CI Windows+Ubuntu en SHA, matriz factual, documentos vigentes | PO + revisor técnico |
| PRO-G1 Consentimiento | P0 de salida | Aprobación humana fuera del control del modelo para partida, presupuesto, plano y entrega | Boolean/nombre desde Claude no aprueba; rechazo/cierre/timeout fallan cerrado; aprobación de SHA A no sirve para B ni para revisión alterada | Seguridad + PO |
| PRO-G2 CAD real | P1 bloqueante | Abrir, guardar, cerrar y reabrir DWG seguro | AutoCAD 2027 real con Dibujo1 intacto, hashes originales iguales, 4 layouts, 5 viewports, 9 cotas, XDATA, texto, escala; fallo no entrega DWG como verificado | CAD + usuaria |
| PRO-G3 Cubicación Chile | P1 | Autoridad única Measurement→MethodCard→Claim→Partida | Al menos 3 expedientes anonimizados reales con oráculo humano; test vanos, bloques, unidades, duplicados, descuentos; reglas y contratos identificados | Especialista cubicaciones |
| PRO-G4 Presupuestos | P1 | APU por partida/claim y porcentajes confirmados | 0 cifras finales sin precio/fuente/fecha; GG/utilidad/IVA explícitos en modo profesional; Excel recalculado contra motor; invalidación por cambio de plano | Especialista costos |
| PRO-G5 Láminas | P1 | DrawingDocument y compositor común | Vivienda y túnel académico con las mismas abstracciones; cotas/escala/layout verificables, PDF legible, DXF revisado y DWG validado real | Arquitectura + CAD |
| PRO-G6 Conocimiento | P1 | Normativa con vigencia, citas y aplicabilidad | LGUC/OGUC versionadas, NCh con licencia/autorización; fuentes retiradas/citas falsas bloqueadas; no declaración automática de cumplimiento | Revisor normativo |
| PRO-G7 Distribución | P1 | .mcpb seguro, útil y recuperable | Instalación/actualización/rollback/desinstalación usuario estándar sin consola, NTFS/Unicode/OneDrive, Claude Desktop real, privacidad | QA/UX/seguridad |
| PRO-G8 Pruebas retenidas | P0 de salida | Evaluación ciega profesional independiente | >=20 casos externos al repo, >=5 adversariales; 0 alteración de originales, 0 aprobaciones falsas, 0 números técnicos críticos inventados, tolerancias por método | Revisor independiente + usuaria |
| PRO-G9 Release | P0 de distribución | RC, manifiesto y soporte por ámbito | Matriz N2/N3 donde se promete, SHA/SBOM/licencias, riesgos residuales, protocolo rollback, decisión PO escrita | PO + especialistas |

**El cierre de un gate exige:** SHA exacto, artefactos, entorno, fecha, método, evidencia anexada, identidad del ejecutor y estado NO VERIFICADO para cualquier requisito no ejecutado. N1 (fixtures y CI) no acredita N2 (AutoCAD/Desktop real) ni N3 (validación profesional). Las pruebas retenidas no deben ser conocidas por el implementador antes de la evaluación.

## 3. Paquetes de ejecución sin tiempos ficticios

### Paquete A — Confianza e interoperabilidad (G0–G2)

A01. Congelar el baseline del PR #21, schemas y feature flags.  
A02. Reutilizar AprobacionHumana para aprobación de partidas/proyectos/presupuestos y entrega con SHA, acción, vigencia, identidad de la persona y rechazo predeterminado.  
A03. Ejecutar CAD-OPEN-01 real, probar Unicode, sesión, modal, conflicto, timeout, XDATA y fidelidad; fallo cerrado. Si Import(DXF) falla, investigar por ADR un plugin .NET basado en Database.DxfIn, sin bypass improvisado.  
A04. Registrar capturas, logs, versiones, hash y errores en docs/qa/ sin compartir información sensible.

**Cierre A:** no hay ruta model-writable para aprobar; DWG verificado real o error seguro y reproducible.

### Paquete B — Ahorro real de trabajo (G3–G4)

B01. Unificar Measurement/ClaimLedger y adaptadores de rutas legacy + CIC con pruebas A→B→A, invalidación y equivalencia.  
B02. MethodCards revisadas para familias iniciales: muros/vanos, radieres/losas, revestimientos y carpinterías/bloques. Ajustar selección con usuaria; no inventar umbrales NCh.  
B03. Contrastar con expedientes anonimizados que tengan plano, EETT y memoria humana independiente.  
B04. Ligar APU a cantidad y revisión; porcentajes, moneda, precios, fecha, fuente y merma explícitos. Excel real contrastado con cálculo backend.

**Cierre B:** cada cifra es reconstruible desde el archivo exacto, la regla, el método, sus parámetros y revisión; un cambio de geometría invalida el presupuesto afectado.

### Paquete C — Documentación y normativa (G5–G6)

C01. Separar el tunnelModel del compositor y crear contrato DrawingDocument genérico; adapter vivienda sin duplicar el motor.  
C02. Verificar escala física, cotas, viewports, PDF, estilos, fuentes, DWG, XDATA y cajetines con captura humana.  
C03. Fortalecer registro de fuentes: fuente oficial, edición y exigibilidad por territorio/contrato/uso; cita exacta y licencia.  
C04. Plantillas de memoria, EETT e informes con datos generados desde claims y DocumentRevision, no libre redacción numérica.

**Cierre C:** dos dominios distintos producen documentos legibles, coherentes y auditables, sin anunciar aptitud estructural/normativa.

### Paquete D — Productización (G7–G9)

D01. Medir selección real de herramientas (72 vs 84/85) en Claude Desktop, no únicamente bytes de tools/list; mejorar fachada sin romper schemas.  
D02. Agregar Skills para Claude Code y un contrato equivalente de procedimientos en el MCP para Desktop. Tests de riesgo y no-invención.  
D03. Pruebas ciegas externas, rendimiento, ahorro de tiempo de usuaria y recuperación de fallos.  
D04. Cerrar SBOM, privacidad, licencias, firma/checksums, actualización/rollback, soporte, matriz de compatibilidad y decisión formal del PO.

**Cierre D:** release candidate trazable con ámbito acotado de uso y evidencia independiente, no sólo kit técnico.

## 4. Casos de aceptación: diseño, todavía NO ejecutados

| Caso | Entrada | Éxito | Fallo duro |
|---|---|---|---|
| AC-01 | DWG en original + copia trabajo + documento personal abierto | Solo modifica copia; reabre y compara propiedades/entidades; SHA originales igual | Guardar original |
| AC-02 | DXF con layouts, viewports, cotas y XDATA | DWG íntegro o error IMPORTACION_DXF_INCOMPLETA antes de guardar | Presentar éxito pese a pérdida |
| Q-01 | Muros con vanos y dos revisiones | Cantidad y descuentos con método, procedencia e invalidación | Altura inferida como hecho |
| Q-02 | Bloques anidados, duplicados y unidad dudosa | needs_review y pregunta mínima, sin falso total | Unidad/conteo sin evidencia |
| B-01 | Partida sin fuente de precio o GG/utilidad pendiente | Excel BORRADOR con campos pendientes | Total final «verificado» |
| N-01 | Texto normativo viejo y contradictorio | Citas y versión, aplicabilidad condicionada | «Cumple OGUC» sin prueba |
| SEC-01 | Modelo envía aprobado_por y confirmo_revision_profesional=true | Rechazado si falta acto humano independiente | Escalada a aprobado |
| SEC-02 | Archivo de aprobación generado por otro MCP | Denegación o límite explícito sin asumir identidad humana | Secreto en carpeta accesible al agente |
| UX-01 | «Cubica los muros y prepara el presupuesto» | Flujo claro en español; archivos y pendientes localizables | Exigir JSON, rutas internas o consola |
| REC-01 | AutoCAD deja operación en estado incierto | Reconciliar, no duplicar escritura | Reintentar a ciegas |

## 5. Métricas y umbrales

Medir tiempo de trabajo manual base versus tiempo con asistente **incluida revisión/corrección**; calidad de resultados; errores por severidad; cobertura de entidades; tasa de documentos editables en AutoCAD; comprensión de advertencias; errores de selección de herramientas; recuperabilidad y número de pasos técnicos que realiza la usuaria.

No fijar promesas de ahorro porcentual antes de la línea base. Establecer tolerancias por operación, unidad y fuente con oráculo independiente **antes** de correr los casos retenidos; no aceptar un porcentaje global arbitrario. Umbral de errores críticos de seguridad, falsos aprobados o números técnicos inventados: **cero**.

## 6. Responsables y gobierno

- Product Owner: alcance, aceptación, merge y publicación.
- Claude Code implementador: desarrolla y prueba, no aprueba su propio trabajo.
- Revisor independiente: inspecciona diffs/CI/logs, reproduce hallazgos, mantiene casos retenidos.
- Especialistas de cubicación/costos/arquitectura: métodos y entregables dentro de su competencia.
- Usuaria piloto: utilidad, claridad y experiencia sin asistencia de desarrollo.

Antes de añadir tecnología recuperar y reutilizar src/cic/, src/quantities/, src/budget/, src/drawing/, src/cad/ y src/project/. Ningún gate nuevo justifica duplicar motores o introducir BIM/IFC.

## 7. Criterios de no-go

No distribuir como profesional si la aprobación es model-writable; DXF→DWG pierde datos presentados como íntegros; la cantidad contractual usa reglas no verificadas; se desconoce qué revisión se midió; no se reproduce un cálculo; no se probó el flujo con AutoCAD y Claude Desktop reales; faltan revisiones humanas competentes para el ámbito anunciado; o privacidad/licencias siguen sin decisión explícita.

**Esta propuesta no aprueba implementaciones previas, no modifica main, y no concede autorización de release.**
