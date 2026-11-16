# TW-11 · 02 — Diseño del Construction Intelligence Core (CIC)
## 0. Tesis
Un encargo desconocido se trata como **problema de composición**, no como búsqueda de plantilla. El CIC es un servicio de dominio **determinista** (registrar, validar, planificar, ejecutar, verificar) con Claude como interlocutor que **interpreta, propone y explica**, pero **nunca** produce las cifras: las cifras salen de operaciones del catálogo y quedan como *claims* con procedencia. Es la misma regla de TW-10 («código calcula, Claude explica»), generalizada.

## 0.1 Interpretación propuesta y validación por el backend (revisión CIC-01)
**Principio:** el backend **no comprende** encargos; **verifica propiedades verificables** de una interpretación que propone Claude. No existe clasificador léxico en el camino crítico. Ninguna capacidad transversal (unidades, geometría, cantidades, claims, conocimiento, cronograma, entregables) exige una disciplina para usarse: su acceso depende **solo de las precondiciones de la capacidad** (entradas, modo, permisos, riesgo).
```jsonc
// tw.cic.interpretation/1  — la escribe Claude; el servidor la valida
{ "schema":"tw.cic.interpretation/1","engagement_id":"eng-…|null","mode":"academic|professional|unspecified",
  "restatement":"…",                                   // lo que Claude entendió, para confirmar con la usuaria
  "intents":[{"kind":"deliver_artifact|answer_question|research|compute|verify|teach|plan","text":"…"}],  // varias a la vez
  "research_questions":[{"id":"q1","text":"…","needed_for":["d1"],"status":"open|answered|unanswerable_with_sources"}],
  "deliverables":[{"id":"d1","kind":"…libre…","status":"confirmed|assumed|unknown"}],
  "disciplines_proposed":[{"tag":"túneles","registry_id":null,"rationale":"…"}],   // 0..n, multi-disciplina, SIN efecto de acceso
  "antecedents":[{"ref":"psg-…|src-…","quote":"extracto literal","use":"…"}],       // verificados contra el almacén
  "magnitudes":[{"name":"…","value":null,"unit":null,"origin":"user|source|assumed|unknown","ref":null}],
  "methods_proposed":[{"operation_id":"…|null","free_text":"…","source_ref":"…|null","why":"…"}],
  "assumptions":[{"text":"…","editable":true}],
  "unknowns":[{"what":"…","blocks":["d1"],"resolution":"ask_user|retrieve|research_external|external_professional"}],
  "risk_flags_proposed":["…"],                        // Claude solo puede AGREGAR restricciones (invariante I2)
  "proposed_steps":[{"id":"s1","goal":"…","capability_id":"…|null","inputs":{},"depends_on":[]}] }
```
**Validación determinista (`tannia_cic_encargo` con `interpretacion`; modo `solo_validar` disponible):**
| Chequeo | Falla ⇒ |
|---|---|
| Esquema Zod, ids únicos, DAG sin ciclos | `rejected(schema)` |
| Cada `antecedent` existe en el almacén y `quote` coincide con el texto/hash del pasaje (anti-cita inventada) | el antecedente se marca `unverified_citation` y **no** sustenta claims |
| Cada `operation_id` existe; dimensiones/unidades de entradas compatibles; entradas disponibles | el paso pasa a `gap` (`new_tool` o `ask_user`), **no** se rechaza el encargo |
| `magnitudes` sin unidad con dimensión | pregunta pendiente, nunca suposición |
| `method.free_text` sin `operation_id` | se conserva como *método propuesto no ejecutable* + `gap` |
| Permisos del modo (E-level mínimo, `risk_class` de la capacidad) | paso `blocked_policy` con razón |
| Disciplinas propuestas | **sin chequeo de acceso**; si hay especialización instalada, se *ofrece* como ayuda (plantillas, métodos, límites), nunca se exige |
Resultados posibles: `accepted | accepted_with_gaps | needs_input | rejected` (este último solo por esquema/seguridad, nunca por «dominio no reconocido»).
**Invariantes:** **I1** lo que Claude afirma y el servidor no puede verificar se guarda como `model_asserted` y nunca eleva madurez, vigencia ni nivel de evidencia. **I2** metadatos propuestos por Claude (riesgo, restricciones, revisión requerida) solo pueden **agregar** restricciones, no levantarlas. **I3** el nivel de riesgo efectivo de un paso es `max(risk_class de la capacidad, propuesto)`. **I4** un encargo sin disciplina, multi-disciplina, solo de investigación o incompleto es **válido**; produce plan con brechas y preguntas.
**Degradación:** si el cliente no envía interpretación estructurada, el backend devuelve ≤3 preguntas y una plantilla vacía de `interpretation/1`; un extractor léxico opcional (reuso de cláusulas TW-10) puede **sugerir** campos, siempre marcados `lexical_hint` y sin efecto de acceso.
**Pruebas (G4):** proyectos con jerga inventada y sin especialización (mutación de vocabulario) obtienen asistencia equivalente; una interpretación con cita falsa se detecta; una con disciplina «incorrecta» **no** cambia el acceso a capacidades (test de invarianza: mismas capacidades accesibles con cualquier etiqueta).

## 1. Ciclo de resolución (contrato de 11 pasos → componentes)
| Paso (directiva) | Componente CIC | Salida persistida |
|---|---|---|
| 1 Interpretar problema y entregables | **Claude propone** `interpretation/1`; el backend la **valida** (§0.1) y solo entonces se registra `Engagement` | `engagement/1` |
| 2 Identificar disciplinas | **Etiquetas propuestas por Claude** (0..n, texto libre + id de registro opcional), **informativas, nunca una puerta** (ver §0.1) | `interpretation.disciplines_proposed[]` |
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
Reglas: (i) un `workplan` **no se acepta** si un paso referencia una capacidad inexistente (debe ser `gap`), si hay ciclos o si las unidades/dimensiones no encajan; (ii) todo **número técnico del proyecto** que aparezca en un entregable debe provenir de un `claim` o de un parámetro de entrada registrado; los demás roles numéricos (constantes matemáticas, identificadores, numeración documental, metadatos) están **exentos por diseño** (§8 Roles numéricos); (iii) un `claim.kind='calculation'` exige `method_ref` con hash de entradas (igual que `decision/1`); (iv) `pending` nunca se imprime como resultado.

## 3. Cómo se compone sin plantillas
- **Registro por capacidades, no por proyectos.** `CapabilityRegistry` se construye al arrancar desde: (a) el catálogo de 72 herramientas (envoltorio automático con nivel N1/N0 declarado en un manifiesto versionado), (b) operaciones de cálculo (§ doc 04), (c) especializaciones (doc 05).
- **Planner en dos capas.** Claude propone un plan en lenguaje; el servidor lo **traduce a `workplan/1` y lo valida** (`tannia_cic_plan`). El servidor además sugiere pasos por *coincidencia de entradas/salidas* (grafo de tipos: «tengo un eje + secciones» → «volumen por secciones»), no por nombre de proyecto.
- **Brechas como ciudadanos de primera clase.** Un paso sin capacidad pasa a `gap` con resolución (`ask_user`, `new_tool`, `external_professional`) y **no bloquea** los pasos independientes.
- **Estrategia para dominio desconocido o sin especialización** (no es un estado especial: ocurre cuando `disciplines_proposed` está vacío o sin especialización instalada). El flujo general siempre está disponible: (1) preguntar/recuperar el *tipo de entregable*, (2) buscar `MethodCards` por entregable, (3) inventariar datos de entrada faltantes, (4) ejecutar lo geométrico/dimensional/documental que sea común, (5) emitir plan con brechas y qué evidencia las cerraría.
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
3. Ninguna capacidad transversal depende de una etiqueta de disciplina; encargos sin disciplina o sin especialización reciben el flujo general (§0.1).
4. Cada capacidad declara `validation.level`; el resumen para Claude lo incluye («ejecutable pero N1/simulado»).
5. Pruebas adversariales (doc 06) que fallan si aparecen resultados geotécnicos/estructurales sin operación E2+.

## 8. Roles numéricos y política de claims (revisión CIC-05)
Los entregables se generan desde **plantillas con ranuras tipadas**; cada número que entra a un entregable tiene un rol:
| Rol | Ejemplos | Exigencia |
|---|---|---|
| `technical_result` | volumen, área, costo, plazo, pendiente calculada | **claim `calculation`** con operación y entradas (bloquea si falta) |
| `input_parameter` | longitud dada por la usuaria, espesor del enunciado, precio unitario aportado | referencia a la **entrada registrada** (`user_stated`/`reported_by_source`) — no requiere cálculo |
| `source_datum` | valor citado de un documento | claim `data` con localizador |
| `math_constant` | π, 2, 1/2, factores de la fórmula mostrada | exento |
| `identifier` | código de partida, N.º de plano, id de nodo | exento |
| `doc_numbering` | página, sección, versión, fecha, N.º de revisión | exento (los genera el sistema) |
| `metadata` | tolerancia declarada, SHA, nombre de archivo | exento |
**Bloqueo vs advertencia:** bloquea (a) toda ranura `technical_result`/`source_datum` sin claim, (b) en **texto libre**, todo número **con unidad o símbolo de moneda** que no coincida con un claim/entrada registrada. Un número sin unidad en prosa libre (p. ej. «3 secciones», «ítem 4») produce **advertencia** en el reporte de verificación, nunca bloqueo. El verificador devuelve falsos positivos medidos: la métrica de G2 incluye **tasa de falsos bloqueos = 0** sobre un corpus de entregables correctos con numeración, constantes y ids.
