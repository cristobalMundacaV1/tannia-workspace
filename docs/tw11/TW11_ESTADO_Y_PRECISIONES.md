# TW-11 — Registro de precisiones P01–P03 y convenciones de implementación
Registradas al iniciar la implementación (directiva maestra de ejecución autónoma). No detienen la macrofase.
## P01 — Volúmenes y geometría
Se verifican **por separado**: áreas medias, prismoidal, extrusión, barrido y Pappus. Una cuña de sección variable **no** se usa como prueba de equivalencia con la extrusión de sección constante: la extrusión se contrasta solo con prismas/cilindros de sección constante (`test/tw11_g1_units_ops.test.js`). Pappus aparece como caso particular del barrido (centroide), y se prueba que difiere de A·L_eje cuando el centroide está fuera del eje.
## P02 — Fuentes y citas
Estados separados en el contrato `tw.cic.source/1`: **fuente registrada** (`state`), **fuente aprobada** (`approval`), **contenido disponible** (`content.available/storage`), **extracto comprobado** (`content.verified_by_server`, hash del pasaje), **cita verificable** (la cita coincide con el texto de un pasaje almacenado; un hash aislado NO valida una cita literal) y **afirmación de Claude no verificada** (`model_asserted`). Ver G3.
## P03 — Gate de departamentos
Un plan con brechas es una respuesta útil cuando faltan datos, pero **no satisface G8**: G8 exige los artefactos geométricos del caso B (doc 06).
## Convenciones de implementación
- Flag `TANNIA_CIC` (`on|1|true|si`) apagado por defecto: con el flag apagado el servidor expone exactamente las 72 herramientas de rc3 (snapshot `fixtures/tw11/tools_baseline.json`, test `tw11_g0_contratos`).
- Línea base medida en G0 (`scripts/tw11-baseline.mjs`): 72 herramientas, 79 386 bytes de `tools/list` (~19 757 tokens estimados) — insumo para D7.
- Los casos de evaluación retenidos pertenecen al revisor independiente: no existen en este repositorio.
- Las pruebas viven en `test/tw11_*.test.js` (el glob de `npm test` es `test/*.test.js`).
