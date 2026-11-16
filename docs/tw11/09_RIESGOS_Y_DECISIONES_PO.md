# TW-11 · 09 — Riesgos, supuestos y decisiones que requiere el PO
## Riesgos
| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | El «motor integral» se interpreta como competencia de ingeniería real | Alta | Muy alto | Madurez E0–E3, `requires_review_by`, gaps explícitos, textos obligatorios |
| R2 | Sobreajuste a fixtures (túnel de ejemplo) | Alta | Alto | Retenidos externos confidenciales, umbrales absolutos (doc 06 §5), brecha ≤10 pp secundaria, test de literales |
| R3 | Calidad de conocimiento (corpus sin licencia/obsoleto) | Media | Alto | Clases A–D, vigencia, `binding`, citas limitadas, actualización controlada |
| R4 | Ampliar herramientas satura el contexto de Claude | Media | Medio | Medición, `catalogo` agrupado, ADR |
| R5 | Geometría nueva sin AutoCAD real | Alta | Medio | Marcar UNVERIFIED; validar DXF con lectores independientes; gate externo |
| R6 | Retrieval semántico sin red/GPU | Media | Medio | BM25+RRF primero; embeddings solo con ADR |
| R7 | Rebase conflictivo con TW-10 tras auditoría | Media | Medio | Mantener aditivo; merge, no fuerza |
| R8 | Tamaño del bundle/instalación | Baja | Medio | Presupuesto +30 %, sin nativos |
| R9 | Integridad académica | Media | Medio | `assistance_log`, énfasis en explicar, rúbrica |
| R10 | Deriva de alcance a BIM/IFC | Media | Medio | Fuera de alcance explícito; ADR de rechazo |
## Decisiones (estado tras la directiva de revisión arquitectónica)
| # | Decisión | Estado |
|---|---|---|
| D1 | Aprobar conceptualmente el CIC; **no iniciar implementación integral** antes de resolver los hallazgos CIC-01…07 (ver doc 11) | **Aprobada conceptualmente**; implementación **no autorizada** hasta la revisión de esta versión |
| D2 | Corpus sintético inicial; corpus académico real después | Adoptada |
| D3 | Asistencia académica trazable y **configurable** (`assistance_log`; política ajustable por la usuaria/curso) | Adoptada |
| D4 | Embeddings solo mediante ADR | Adoptada |
| D5 | Revisor independiente y casos retenidos **externos** (desconocidos para Claude Code) | Adoptada; **bloquea la aprobación de G10** hasta designar revisor |
| D6 | Geometría transversal primero, con casos funcionales de túnel y departamento | Adoptada |
| D7 | Presupuesto de herramientas basado en **mediciones** (doc 08, G0), no en una cifra fija | Adoptada |
Riesgos añadidos: **R11** dependencia de un revisor externo que aún no existe (mitigación: no aprobar G10 sin él; planificar su designación antes de PR-6); **R12** falsos bloqueos del verificador de números (mitigación: roles tipados, métrica 0 falsos bloqueos); **R13** hipótesis geométricas mal aplicadas (mitigación: `section_plane` y condiciones declaradas, oráculos independientes); **R14** la procedencia de investigación externa no es verificable por el servidor (limitación declarada, confirmación humana, cita verificable contra extracto).
## Supuestos
Node 22 sin nativos; Windows+Ubuntu en CI; sin AutoCAD/Desktop reales en el entorno de ingeniería; la red del servidor sigue deshabilitada.
