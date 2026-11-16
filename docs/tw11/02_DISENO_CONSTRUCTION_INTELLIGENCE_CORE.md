# TW-11 · 02 — Diseño del Construction Intelligence Core (CIC)
## 0. Tesis
Un encargo desconocido se trata como **problema de composición**, no como búsqueda de plantilla. El CIC es un servicio de dominio **determinista** (registrar, validar, planificar, ejecutar, verificar) con Claude como interlocutor que **interpreta, propone y explica**, pero **nunca** produce las cifras: las cifras salen de operaciones del catálogo y quedan como *claims* con procedencia. Es la misma regla de TW-10 («código calcula, Claude explica»), generalizada.

## 1. Ciclo de resolución (contrato de 11 pasos → componentes)
| Paso (directiva) | Componente CIC | Salida persistida |
|---|---|---|
| 1 Interpretar problema y entregables | `Engagement` (interpretación) | `engagement/1` |
| 2 Clasificar disciplinas | `DisciplineMap` (léxico+registro de especializaciones, multi-etiqueta, `no_clasificado` permitido) | `engagement.disciplines[]` |
| 3 Recuperar antecedentes | `Knowledge.retrieve` + inventario del proyecto | `evidence_pack/1` |
| 4 Magnitudes, unidades, variables, desconocidos | `QuantityLedger` (dimensional) | `engagement.magnitudes[]`, `unknowns[]` |
| 5 Métodos, herramientas, fuentes | `CapabilityRegistry` + `MethodCards` | `method_selection[]` |
| 6 Plan técnico | `Planner` | `workplan/1` (DAG con huecos explícitos) |
| 7 Ejecutar cálculos y operaciones | `Executor` | `artifact/1` + `claim/1` |
| 8 Verificar coherencia | `Verifier` (dimensional, geométrica, documental) | `verification/1` |
| 9 Contradicciones/incertidumbre | `ConsistencyChecker` | `issue/1` |
| 10 Entregables y explicaciones | `Deliverables` (plantillas editables) + `Explain` (resúmenes por sección) | archivos versionados |
| 11 Historial, procedencia, decisiones | `Memory` (versiones transaccionales + ledger) | `03 Trabajo/Ingenieria/<encargo>/vNNN.json` |

## 2. Contratos (Zod/JSON Schema; todos con `schema` versionado y `status` epistémico)
```jsonc
// tw.cic.engagement/1
{ "schema":"tw.cic.engagement/1","id":"eng-…","project_id":"…","mode":"academic|professional",
  "statement":{"original":"<texto íntegro, como dato>","language":"es","attachments":[{"source_id":"src-…","role":"enunciado|antecedente|pauta|rubrica"}]},
  "deliverables":[{"id":"d1","kind":"plano|perfil|seccion|cuantia|presupuesto|programa|informe|memoria|ejercicio_resuelto","status":"confirmed|assumed|unknown"}],
  "disciplines":[{"id":"obras_civiles.tuneles","confidence":0.0,"evidence":["quote|source_ref"],"origin":"user|classifier|assistant_proposal"}],
  "magnitudes":[{"name":"longitud_tunel","value":null,"unit":"m","dimension":"L","status":"unknown","source_ref":null}],
  "constraints":[{"id":"c1","text":"…","status":"confirmed","source_ref":"src-…"}],
  "unknowns":[{"id":"u1","what":"…","blocks":["d1"],"resolution":"ask_user|retrieve|external_professional"}],
  "assistant_notes":[{"kind":"no_inventar|dato_desconocido|pregunta|excluido","topics":["…"],"text":"…"}],   // reusa F06
  "risk_flags":["safety_critical","normative_claim_risk","licensed_material"] }

// tw.cic.workplan/1  (DAG validado por código)
{ "schema":"tw.cic.workplan/1","engagement_ref":"eng-…","revision":1,
  "steps":[{"id":"s1","goal":"Calcular áreas de sección…","capability_id":"geo.section.area.horseshoe|null",
            "inputs":{"r_mm":{"ref":"magnitude:radio"},"ancho":{"ref":"claim:c12"}},"depends_on":[],
            "kind":"compute|retrieve|generate_cad|generate_doc|ask_user|external",
            "expected":{"artifact_kind":"claim","unit":"m2"},"verification":["dimension:L2","oracle:circle_area"],
            "status":"planned|ready|blocked_gap|running|done|failed|skipped"}],
  "gaps":[{"id":"g1","need":"Dimensionamiento del sostenimiento","why":"No existe operación validada; exige geotecnia","resolution":"external_professional|new_tool|ask_user","blocks":["s7"]}] }

// tw.cic.claim/1  (la unidad mínima de afirmación técnica)
{ "schema":"tw.cic.claim/1","id":"clm-…","kind":"data|inference|assumption|calculation|pending",
  "statement":"…","value":null,"unit":null,"dimension":null,
  "source_refs":[{"source_id":"src-…","locator":{"page":12,"section":"3.2"}}],
  "method_ref":{"operation_id":"…","version":"…","input_hash":"…"},"depends_on":["clm-…"],
  "status":"computed|reported_by_source|user_stated|assumed_editable|not_computed",
  "requires_review_by":["ingeniero_geotecnico"],"valid_until":null }

// tw.cic.capability/1  (registro; incluye las 72 herramientas actuales)
{ "schema":"tw.cic.capability/1","id":"cad.dwg.persistence.verify","kind":"tool|operation|generator|retrieval|document",
  "mcp_tool":"tannia_cad_verificar_persistencia|null","disciplines":["transversal"],
  "inputs":[{"name":"…","dimension":"L","unit":"mm","required":true}],"outputs":[…],
  "preconditions":["autocad_activo","documento_por_ruta"],"side_effects":"read|write_copy|write_project",
  "validation":{"level":"N1","evidence":["test/tw17…","real: pending"]},"limits":["…"],"cost":"fast|slow" }
```
Reglas: (i) un `workplan` **no se acepta** si un paso referencia una capacidad inexistente (debe ser `gap`), si hay ciclos o si las unidades/dimensiones no encajan; (ii) todo número que aparezca en un entregable debe provenir de un `claim` (el generador de entregables rechaza literales numéricos sin claim); (iii) un `claim.kind='calculation'` exige `method_ref` con hash de entradas (igual que `decision/1`); (iv) `pending` nunca se imprime como resultado.

## 3. Cómo se compone sin plantillas
- **Registro por capacidades, no por proyectos.** `CapabilityRegistry` se construye al arrancar desde: (a) el catálogo de 72 herramientas (envoltorio automático con nivel N1/N0 declarado en un manifiesto versionado), (b) operaciones de cálculo (§ doc 04), (c) especializaciones (doc 05).
- **Planner en dos capas.** Claude propone un plan en lenguaje; el servidor lo **traduce a `workplan/1` y lo valida** (`tannia_cic_plan`). El servidor además sugiere pasos por *coincidencia de entradas/salidas* (grafo de tipos: «tengo un eje + secciones» → «volumen por secciones»), no por nombre de proyecto.
- **Brechas como ciudadanos de primera clase.** Un paso sin capacidad pasa a `gap` con resolución (`ask_user`, `new_tool`, `external_professional`) y **no bloquea** los pasos independientes.
- **Estrategia para dominio desconocido** (`engagement.disciplines=[no_clasificado]`): se activa el flujo general: (1) preguntar/recuperar el *tipo de entregable*, (2) buscar `MethodCards` por entregable, (3) inventariar datos de entrada faltantes, (4) ejecutar lo geométrico/dimensional/documental que sea común, (5) emitir plan con brechas y qué evidencia las cerraría.
- **Recuperación ante errores:** cada paso es idempotente y versionado; fallo → estado `failed` con causa tipificada; `retry` solo para pasos de lectura/cálculo puro (misma regla que el adaptador COM: nunca reintentar escrituras).

## 4. Herramientas MCP nuevas (máximo 9; las 72 actuales no cambian)
| Herramienta | Efecto | Propósito |
|---|---|---|
| `tannia_cic_encargo` | escribe versión | Crear/actualizar `engagement` desde las palabras de la usuaria; modo académico/profesional; devuelve ≤3 preguntas |
| `tannia_cic_plan` | escribe versión | Registrar/validar `workplan`; devuelve pasos listos, brechas y siguiente acción |
| `tannia_cic_ejecutar` | escribe versión | Ejecutar pasos `ready` deterministas; devuelve claims y artefactos |
| `tannia_cic_conocimiento` | lectura (y registro) | Buscar pasajes con cita; `registrar_fuente` (incluye fuentes externas aportadas por Claude con procedencia) |
| `tannia_cic_calcular` | lectura | Ejecutar una operación del catálogo con unidades; devuelve claim |
| `tannia_cic_catalogo` | lectura | Listar capacidades/operaciones/especializaciones con nivel de validación |
| `tannia_cic_claims` | lectura | Recuperar afirmaciones con procedencia (por entregable/sección) |
| `tannia_cic_verificar` | lectura | Verificación dimensional/geométrica/documental y detección de contradicciones |
| `tannia_cic_entregable` | escribe artefacto | Generar entregable editable (XLSX/PDF/DXF/SVG/MD) **solo con claims** |
Todas con esquemas planos (sin tuplas), respuesta **resumen compacto + secciones** (lección F01) y notas `assistant_notes` (lección F06).

## 5. Modos académico y profesional (política, no solo tono)
| Aspecto | Académico | Profesional |
|---|---|---|
| Objetivo | Comprender, practicar, defender decisiones | Producir entregable revisable con trazabilidad |
| Entradas válidas | Enunciado, apuntes, pauta, valores del ejercicio (pueden ser ficticios) | Antecedentes verificables del proyecto; datos con fuente |
| Datos ficticios | Permitidos y **marcados** `exercise_value` | **Prohibidos** salvo `assumption` con revisión |
| Respuesta | Explica el *por qué*, muestra procedimiento, pide a Tannia anticipar el paso, compara con la rúbrica | Resumen + claims + riesgos + qué revisa quién |
| Entregable | Marca de agua «EJERCICIO ACADÉMICO — no apto para ejecución» | «Sujeto a revisión competente» + control documental (versión, fuente, permisos) |
| Límites | Puede usar fórmulas educativas nivel E1 con parámetros del enunciado | Solo operaciones ≥E2 o con `requires_review_by` |
| Integridad académica | Ayuda a *entender y desarrollar*; no suplanta autoría: registra cuánto fue asistido (`assistance_log`) y recuerda la política del curso si está en la pauta | n/a |
La conmutación es un campo del `engagement` (no un prompt) y cambia plantillas, umbrales y verificaciones; hay pruebas de que el mismo enunciado produce **entregables distintos** por modo.

## 6. Memoria y continuidad entre sesiones
Reutiliza `Estudios`/`commitConHistorial`: `03 Trabajo/Ingenieria/<encargo>/` con `historial.json`, versiones inmutables, `claims.jsonl` apéndice y manifiesto de artefactos con SHA-256. `tannia_cic_encargo(modo=reemplazar|actualizar)` hereda la semántica TW-10 (F03): actualizar conserva, reemplazar es explícito. Los claims de versiones previas siguen consultables.

## 7. Honestidad estructural (qué impide «texto genérico»)
1. El plan es **dato validado**, no prosa.
2. Los entregables rechazan números sin claim.
3. La clasificación admite `no_clasificado` y activa el flujo general.
4. Cada capacidad declara `validation.level`; el resumen para Claude lo incluye («ejecutable pero N1/simulado»).
5. Pruebas adversariales (doc 06) que fallan si aparecen resultados geotécnicos/estructurales sin operación E2+.
