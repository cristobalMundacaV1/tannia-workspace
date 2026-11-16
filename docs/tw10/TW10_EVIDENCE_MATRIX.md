# TW-10 — Matriz de evidencia (45 historias, 11 gates)
Estados: `PASA_LOCAL` (prueba automatizada local) · `PASA_CI` (CI Windows+Ubuntu en el SHA indicado en `TW10_STATE.json`) · `PARCIAL` · `EXTERNO` (requiere hardware/persona; **no ejecutado**).
Las pruebas viven en `test/tw10_*.test.js`. Ninguna fila `EXTERNO` está aprobada.

| Historia | Evidencia | Estado |
|---|---|---|
| 00-01 baseline | `TW10_MATRIZ_COMPATIBILIDAD.md`; baseline 192/175/0/17 reproducido; CI verde en `eb76789` | PASA_CI |
| 00-02 regresión TW-09 | `tw10_g0_regresion`, `tw10_g9_mcp` (61 herramientas previas presentes), `tw10_escenarios` E14 (hashes de `03 Trabajo` intactos) | PASA_CI |
| 00-03 contratos Zod | `src/architect/schemas.js`; `tw10_g0_contratos`, `tw10_g0_estado` | PASA_CI |
| 00-04 ADR | `TW10_ADR_DEPENDENCIAS.md` (sin runtime Python; pvlib solo dev) | PASA_LOCAL (revisión PO pendiente) |
| 01-01 brief | `briefing.js`; `tw10_g1_brief` | PASA_CI |
| 01-02 gramática del encargo | hechos/deseos/duros/incógnitas/prohibiciones; `tw10_g1_brief` | PASA_CI (léxico en español; límites en KNOWN_LIMITATIONS_TW10) |
| 01-03 grafo de relaciones | `grafoRelaciones`; `tw10_g1_brief` | PASA_CI |
| 01-04 persistencia/versionado/diff | `servicio.js` (`Estudios`), `tw10_g9_mcp`, `tw10_escenarios` | PASA_CI |
| 02-01 modelo de predio | `sitio.js`; `tw10_g2_sitio` | PASA_CI (predio ortogonal) |
| 02-02 norte/lat-lon/IANA | `solar.js`, `sitio.js`; `tw10_g3_solar`, `tw10_g2_sitio` | PASA_CI |
| 02-03 evidencias CIP/PRC | fuentes con hash/fecha/escala legible; `tw10_g2_sitio`, `tw10_escenarios` E10 | PASA_CI (sin OCR/extracción automática por diseño) |
| 02-04 validadores de sitio | `verificarContraSitio` (nunca «cumple»); `tw10_g2_sitio` | PASA_CI |
| 03-01 motor solar | 149 casos vs NREL SPA (pvlib), err. máx. 0,024°/0,006°; `tw10_g3_solar` | PASA_CI |
| 03-02 EPW | `clima.js`; `tw10_g3_clima` | PASA_CI (EPW sintético; **sin EPW real de la usuaria**) |
| 03-03 Open-Meteo/ERA5 | solo caché local importable; **sin consultas de red** (ADR) | PARCIAL por decisión |
| 03-04 perfiles y rosa | `perfilesClima`; `tw10_g3_clima` | PASA_CI |
| 04-01 scheme/2 | `schemas.js`, `derivar_poly.js`; `tw10_g4_geometria` | PASA_CI |
| 04-02 L/U/patio robustos | `poligonos.js`; `tw10_g4_geometria`; propiedad 150 casos en `tw10_escenarios` | PASA_CI |
| 04-03 DXF/SVG genéricos | reutiliza `escribirDxf/Svg` con geo poligonal; `tw10_g4_geometria`, `tw10_g9_mcp` | PASA_CI |
| 04-04 puente 3D huella real | `a3d.js` (losa/cubierta por huella; inclinada = rechazo explícito) | PASA_CI |
| 04-05 compat. v1 por copia | `convertir.js`; `tw10_g4_geometria`, E14 | PASA_CI |
| 05-01 gramáticas de partido | compacta, L con patio, dos alas (patio central: geometría soportada y probada; **sin generador**) | PARCIAL |
| 05-02 determinismo | `tw10_g5_partidos` | PASA_CI |
| 05-03 diversidad real | `diversidad.js` (huella + WL); espejo no cuenta | PASA_CI |
| 05-04 ≥3 alternativas o error razonado | `alternativas.js`; `tw10_g5_partidos`, `tw10_g9_mcp` | PASA_CI |
| 06-01 sombras ray casting | `sombras.js`; `tw10_g6_sombras` (oráculo geométrico, invarianza por rotación) | PASA_CI |
| 06-02 aleros | `estudioAlero`; monotonía probada | PASA_CI |
| 06-03 viento/ventilación | `evaluacion.js` (abrigo regional + potencial geométrico, sin CFD) | PASA_CI |
| 06-04 resumen ambiental | `tannia_arq_evaluar`; conectores avanzados NO incluidos (ADR) | PARCIAL |
| 07-01 recorridos | `habitabilidad.js`; `tw10_g7_habitabilidad` | PASA_CI |
| 07-02 visuales/privacidad | idem | PASA_CI |
| 07-03 seguridad/uso | piscina: alerta crítica siempre; `seguridad_demostrada=false` | PASA_CI |
| 07-04 constructibilidad relativa | índice de envolvente; sin CLP | PASA_CI |
| 08-01 Evaluator | `evaluacion.js`; `tw10_g8_evaluacion` | PASA_CI |
| 08-02 multiobjetivo | Pareto/pesos/sensibilidad | PASA_CI |
| 08-03 DecisionLedger | `decisionesDe` (decision/1 válida) | PASA_CI |
| 08-04 modo crítico | `criticar` | PASA_CI |
| 09-01 herramientas y enrutador | 11 `tannia_arq_*`, router; `tw10_g9_mcp` | PASA_CI |
| 09-02 comparación visual | `hojaComparativa` + sombras SVG; `tw10_g9_mcp` | PASA_CI |
| 09-03 refinar | aleros/prioridad/seleccionar; geometría intacta | PASA_CI (cambios de programa = `encargo`+regenerar) |
| 09-04 publicación | DXF+SVG+informe+3D versionado; `a_autocad` vía adaptador existente | PASA_CI; **DWG real = EXTERNO** |
| 10-01 CI/propiedades/fuzz | CI Windows/Ubuntu; propiedad 150 huellas; fuzz de nombres | PASA_CI |
| 10-02 AutoCAD 2027 real | `TW10_FIELD_VALIDATION.md` §A | **EXTERNO — NO EJECUTADO** |
| 10-03 taller Tannia + revisor | `TW10_FIELD_VALIDATION.md` §B | **EXTERNO — NO EJECUTADO** |
| 10-04 dossier y decisión PO | este documento + HANDOFF | PARCIAL (falta evidencia de campo y decisión PO) |

## Escenarios de aceptación (15)
| # | Escenario | Evidencia automatizada |
|---|---|---|
| 1 | 90 m² sin terreno | `tw10_g9_mcp` (alternativas conceptuales, sol `blocked`) |
| 2 | Terreno 12×28, acceso extremo | `tw10_g5_partidos` (predio 12×28) |
| 3 | Norte verificado, jun/dic y alero | `tw10_g6_sombras`, `tw10_g9_mcp` |
| 4 | L con patio: vacío real 2D/3D | `tw10_g4_geometria` |
| 5 | Piscina desde cocina | `tw10_g7_habitabilidad`, `tw10_g8_evaluacion` |
| 6 | Privacidad con vista | `tw10_g7_habitabilidad` (ventanas enfrentadas/deslindes) |
| 7 | Pocas circulaciones | `circulation_minimal` + cruces por zona social |
| 8 | Viento fuerte de invierno | `tw10_g8_evaluacion` (abrigo regional, sin viento local) |
| 9 | Ahorrar | índice de envolvente; precio `not_evaluated` |
| 10 | CIP sin escala legible | `tw10_escenarios` E10 |
| 11 | Cambio posterior del programa | `tw10_escenarios` E11/E14 |
| 12 | Cambio de orientación | `tw10_g6_sombras` (invarianza) |
| 13 | Hemisferios | `tw10_escenarios` E13, `tw10_g3_solar` |
| 14 | v1 y DWG previo intactos | `tw10_escenarios` E14 (DWG real: EXTERNO) |
| 15 | Instrucciones hostiles en PDF/EPW | `tw10_g3_clima`, `tw10_g9_mcp` |

## Expediente de revisión independiente
`docs/tw10/TW10_AUDIT_TRANSFER.md` (informe de transferencia), `docs/tw10/entrega/` (documentos del ZIP de entrega) y `TW10_CANDIDATE.md` (hashes). Ninguna fila `EXTERNO` está aprobada.

## Auditoría de campo G10 (F01–F05)
`TW10_FIELD_FINDINGS_F01_F05.md`: F01 respuestas compactas, F02 necesidades del lenguaje natural, F03 continuidad del brief, F04 métricas interpretadas, F05 alertas recuperables — `PASA_CI` (ver CANDIDATE). Repetición en Claude Desktop real: **EXTERNO / PENDIENTE**.

## Prueba real rc2 (F06–F10)
`TW10_FIELD_FINDINGS_F06_F10.md`: F06 negación/intención/prioridad local, F07 duplicados, F08 identidad servidor/motor/paquete, F09 alcance de la visual, F10 tercera alternativa y conteo de elegibles — `PASA_CI` (ver CANDIDATE). Patio central: `PARCIAL` (sin generador). Repetición en Claude Desktop real: **EXTERNO / PENDIENTE**.
