# TW-11 · 09 — Riesgos, supuestos y decisiones que requiere el PO
## Riesgos
| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | El «motor integral» se interpreta como competencia de ingeniería real | Alta | Muy alto | Madurez E0–E3, `requires_review_by`, gaps explícitos, textos obligatorios |
| R2 | Sobreajuste a fixtures (túnel de ejemplo) | Alta | Alto | Retenidos/mutación, gap ≤10 pp, test de literales |
| R3 | Calidad de conocimiento (corpus sin licencia/obsoleto) | Media | Alto | Clases A–D, vigencia, `binding`, citas limitadas, actualización controlada |
| R4 | Ampliar herramientas satura el contexto de Claude | Media | Medio | Medición, `catalogo` agrupado, ADR |
| R5 | Geometría nueva sin AutoCAD real | Alta | Medio | Marcar UNVERIFIED; validar DXF con lectores independientes; gate externo |
| R6 | Retrieval semántico sin red/GPU | Media | Medio | BM25+RRF primero; embeddings solo con ADR |
| R7 | Rebase conflictivo con TW-10 tras auditoría | Media | Medio | Mantener aditivo; merge, no fuerza |
| R8 | Tamaño del bundle/instalación | Baja | Medio | Presupuesto +30 %, sin nativos |
| R9 | Integridad académica | Media | Medio | `assistance_log`, énfasis en explicar, rúbrica |
| R10 | Deriva de alcance a BIM/IFC | Media | Medio | Fuera de alcance explícito; ADR de rechazo |
## Decisiones solicitadas al PO (el plan avanza con el *valor recomendado* si no hay respuesta, salvo D1/D2 que bloquean)
| # | Decisión | Recomendación |
|---|---|---|
| D1 | Aprobar el plan TW-11 y autorizar implementación (¿por gates con PR borrador apilado?) | Sí, por gates |
| D2 | ¿Corpus A/B real de Tannia (apuntes «Obras Civiles II», pauta)? Sin él se usa corpus sintético | Aportar 1 curso piloto (privado) |
| D3 | ¿Nivel de asistencia académica deseado/política de la universidad? | Registro de asistencia activado |
| D4 | Embeddings locales: ¿explorar ADR-004? | Sí, solo ADR |
| D5 | Revisor independiente para casos retenidos (ingeniero civil) | Sí; hasta entonces, mutación |
| D6 | Orden de especializaciones tras el vertical túnel/lineal (¿carreteras o edificación multi-nivel primero?) | Lineal primero (reusa G5) |
| D7 | Tope de crecimiento de herramientas (81) | Aceptar con medición |
## Supuestos
Node 22 sin nativos; Windows+Ubuntu en CI; sin AutoCAD/Desktop reales en el entorno de ingeniería; la red del servidor sigue deshabilitada.
