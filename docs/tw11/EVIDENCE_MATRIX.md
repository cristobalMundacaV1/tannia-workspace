# TW-11 — Matriz de evidencia
Niveles de evidencia: **N0** documentado · **N1** implementado y probado con simuladores/fixtures/oráculos (CI) · **N2** validado en herramienta real por la PO · **N3** revisado por profesional competente. Madurez de operación: E0–E3. **Nada aquí es N2/N3.**
Suite local en el último SHA de código: **375 pruebas, 358 pasan, 0 fallan, 17 omitidas** (PowerShell real; corren solo en CI Windows).

| Gate | Estado | SHA de código | Pruebas | CI Windows+Ubuntu | Evidencia principal | Limitaciones / pendiente |
|---|---|---|---|---|---|---|
| G0 Baseline y contratos | superado (N1) | `5982018` | `tw11_g0_contratos` | ✅ run 43945926639 | snapshot de esquemas de las 72; flag apagado = rc3; contratos Zod | línea base D7 medida |
| G1 Unidades y operaciones | superado (N1) | `5982018` | `tw11_g1_units_ops` | ✅ | oráculos analíticos, malla+divergencia, property y mutación; P01 | E2 = oráculos del repo, sin E3 |
| G2 Claims y roles numéricos | superado (N1) | `5982018` | `tw11_g2_claims` | ✅ | ids deterministas; T10/T10b (0 falsos bloqueos) | cifras sin unidad en prosa no se detectan |
| G3 Conocimiento | superado (N1) | `3786d1b` | `tw11_g3_conocimiento` | ✅ run 43947384730 | extractores, BM25, citas verificables (P02), aprobación humana (ADR-003), T7/T8/T18/T19 | elicitación probada solo con cliente simulado; sin OCR; sin embeddings (ADR-004) |
| G4 Interpretación y plan | superado (N1) | `3786d1b` | `tw11_g4_interpretacion` | ✅ | validación determinista, T16, brechas, ejecutor reanudable | la validación verifica propiedades, no «comprensión» |
| G5 Geometría lineal | superado (N1) | `c264dbc` | `tw11_g5_geometria_lineal` | ✅ run 43949392711 | alineamientos, perfil, TIN exacto, LandXML (ADR-005), DXF releído + ezdxf | sin clotoides; barrido horizontal |
| GV1 Túnel extremo a extremo | superado (N1, datos sintéticos) | `c264dbc` | `tw11_gv1_tunel` | ✅ | los 12 puntos de la directiva; coherencia DXF↔claims↔XLSX↔PDF; `examples/tw11/gv1_tunel/` | **no** es aptitud profesional ni AutoCAD real |
| G6 Cantidades, presupuesto, programa | superado (N1) | `dcc658b` | `tw11_g6_cadena` | ✅ run 43954370335 | Caso D; bud.rollup contrastado con computeBudget; CPM/curva S/EVM con soluciones cerradas; recomputación y bloqueo de base desactualizada | precios/rendimientos los aporta la usuaria |
| G7 Especializaciones y migración | superado (N1) | `dcc658b` | `tw11_g7_especializaciones` | ✅ run 43954370335 | 6 especializaciones declarativas; carga segura (T13); adaptador ≥200 frases sin cambiar la salida; 72 intactas | enrutador activo solo con flag |
| G8 Departamentos / edificación transversal | superado (N1) | `dcc658b` | `tw11_g8_departamentos` | ✅ run 43954370335 | artefactos del caso B: entrepiso compartido, medianeros, acceso por núcleo, terraza, sin lote; contraste casa/depto (≥6 diferencias); oficina/local | generador por franjas; sin estructura ni normativa |
| G9 Paquete y experiencia | superado (N1) | `cab78cd` | `tw11_g9_paquete` | ✅ run 43954614508 | `.mcpb` CIC apagado (72) y CIC activado (83) verificados desde el bundle desempaquetado; el verificador usa el entorno del manifiesto | Claude Desktop real pendiente; presupuesto de herramientas D7 **excedido** (+31,7 % vs propuesta de +25 %): decide la PO |
| G10 Evaluación | ejecutor listo; **APROBACIÓN PENDIENTE** | `cab78cd` | `tw11_g10_eval` | ✅ (solo el ejecutor) | `scripts/tw11-eval.mjs` con umbrales absolutos, hash de compromiso y casos de desarrollo | **requiere revisor independiente y casos retenidos externos: no existen** |
| G11 Auditoría independiente | pendiente (externo) | — | — | — | expediente `entrega/AUDITORIA_TRANSFER.md` | persona |
| G12 Decisión del PO | pendiente (humano) | — | — | — | — | persona |

## Métricas de línea base (D7)
| | rc3 (CIC apagado) | CIC activado |
|---|---|---|
| Herramientas | 72 | 83 |
| `tools/list` bytes | 79 386 | 104 578 (+31,7 %) |
| Tokens estimados | 19 757 | 26 016 (+31,7 %) |
| Arranque (ms, local) | ~608 | ~593 |
| RSS del servidor (kB) | 150 492 | 146 120 |
| `.mcpb` (bytes) | 2 450 471 (rc3) | 2 450 543 (off) · 2 453 095 (on) |
Precisión de selección de herramienta: **no medida** (requiere un cliente con modelo; pendiente en Claude Desktop).

## Pendientes humanos (no aprobados)
AutoCAD real · Claude Desktop real · evaluación retenida independiente (G10) · revisión profesional por especialidad · taller con Tannia · decisión de aceptación del PO · merge y distribución.

## Candidato de prueba entregado
ZIP `TW11-entrega-cab78cd.zip` SHA-256 `0dddfec760f6101d96faf81b85effe81f61b809ea42bd2a40a16415cfc5f5b03`; `.mcpb` CIC apagado `a0c73654c38ab05e68c34a372f683c5edc5bfae2195b09725724d49c3d6c1557` (72 herramientas); `.mcpb` CIC activado `679f9ebfab302e93cbf561367d50d32bd07f0ae08f036375483f74e1c71be9e9` (83). Sin validación real.
