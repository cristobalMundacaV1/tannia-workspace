# Expediente de transferencia para la revisión independiente — TW-11
Estado: **READY_FOR_INDEPENDENT_REVIEW** para lo automatizable; **ESPERA_VALIDACION_EXTERNA** para G10 y los gates de hardware/persona.
## Cómo reproducir
1. Clonar el SHA indicado en `docs/tw11/TW11_STATE.json` de la rama de PR-6; `npm ci`.
2. `npm test` (las pruebas TW-11 son `test/tw11_*.test.js`). 17 pruebas se omiten por ser PowerShell real (solo CI Windows).
3. `node scripts/tw11-baseline.mjs` (línea base de herramientas) y `node scripts/tw11-baseline.mjs --cic`.
4. `node scripts/ejemplos-tw11.mjs` regenera los ejemplos sintéticos (`examples/tw11/gv1_tunel/`).
5. `node scripts/tw11-eval.mjs --casos <carpeta del revisor> [--compromiso hashes.txt] [--rubrica rubrica.json]`.
## Qué inspeccionar (mapa de código)
| Área | Archivos |
|---|---|
| Contratos y política | `src/cic/schemas.js`, `politica.js`, `claims.js`, `verificador.js` |
| Cálculo y oráculos | `src/cic/units.js`, `src/cic/ops/*.js`, `test/tw11_g1_*`, `test/tw11_g6_*` |
| Geometría | `src/geo/*.js`, `test/tw11_g5_*` |
| Conocimiento y fuentes | `src/cic/conocimiento/*`, `test/tw11_g3_*` (ADR-003) |
| Interpretación, plan, ejecutor | `src/cic/interpretacion.js`, `ejecutor.js`, `test/tw11_g4_*` |
| Especializaciones y router | `src/cic/especializaciones/*`, `enrutador.js`, `test/tw11_g7_*` |
| Edificación | `src/cic/edificacion/*`, `test/tw11_g8_*` |
| Herramientas MCP | `src/tools/cic.js` (solo con `TANNIA_CIC=on`) |
## Qué puede intentar romper el revisor (superficie de ataque)
Aprobar una fuente sin persona; citas inventadas; documentos con instrucciones hostiles; ZIP bomba; LandXML con entidades; cifras sin respaldo en entregables; unidades mezcladas; barrido con auto-solape; encargos de jerga nueva o sin disciplina; cambios de un dato con base desactualizada; interrupciones durante escrituras; interpretación de un departamento como casa.
## Mapa de la batería adversarial (T1–T20) → pruebas
T1 `tw11_gv1_tunel`; T2/T8/T17 `tw11_g3_*`/`g4`; T3 binding (contrato `tw.cic.source/1`); T4 `g1`; T5/T19 `g3`; T6 (meaning no se infiere: sin etiquetado por forma, `g4`/`g5`); T7 `g3`; T9 (anti-sobreajuste: casos retenidos externos); T10/T10b `g2`; T11 `g1`; T12 `tw11_g4` (modo/marca); T13 `g7`; T14 `g4`; T15 regresión de seguridad existente + `g3` (ZIP); T16 `g4`/`g7`; T18 `g3`; T20 `g1`.
## Defectos conocidos que el revisor debe considerar
Ver `LIMITACIONES_CONOCIDAS.md`. Deuda técnica: clotoides; calendarios/recursos en CPM; GeoJSON/CSV/OBJ/STL; OCR; embeddings (ADR-004); selección de herramienta con 81+ herramientas (medir con banco real en Desktop).
## Lo que este expediente NO afirma
Validación en AutoCAD real, en Claude Desktop real, por Tannia o por un profesional; aprobación de G10; conformidad normativa.
