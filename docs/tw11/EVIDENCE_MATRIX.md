# TW-11 — Matriz de evidencia
Niveles de evidencia: **N0** documentado · **N1** implementado y probado con simuladores/fixtures/oráculos (CI) · **N2** validado en herramienta real por la PO · **N3** revisado por profesional competente. Madurez de operación: E0–E3. **Nada aquí es N2/N3.**
Suite local en el último SHA de código (`9858ae1`): **398 pruebas, 381 pasan, 0 fallan, 17 omitidas** (PowerShell real; corren solo en CI Windows).

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
| **Hardening H1–H5** | superado (N1) — 5/5 pruebas fallaban en `92d5d19` y pasan | `aed57ae` | `tw11_h_hardening` | ✅ run 43957962608 | `docs/tw11/HARDENING.md` | la selección real de herramientas del modelo no se prueba aquí (protocolo C15) |
| **P1 consentimiento humano** (auditoría sobre #19) | superado (N1): el código era recuperable con herramientas (reproducido en `3a066a4`); ahora no existe ningún secreto en rutas accesibles | `329c8dd` | `tw11_seguridad_aprobacion` (+ regresión en `g3`/`h`) | ✅ run 43962157216 (PR, `329c8dd`) y 43962236250 (push, `0c50520`) | `HARDENING.md`, `adr/ADR-003` | diálogo del SO y elicitación en Claude Desktop real **no probados** (N0 de hardware); canal de archivo falsificable si el agente tuviera otra herramienta de escritura en la carpeta del usuario |
| **SEC-01 / SEC-02** (observaciones sobre la corrección P1) | superado (N1): ambos reproducidos antes de corregir (un symlink padre importó `nota.txt`; contenido extra aprobaba) | `9858ae1` | `tw11_seguridad_sec01_sec02` | ⏳ (ver estado) | `HARDENING.md`, `adr/ADR-003` | los symlinks/junctions se omiten si el SO no permite crearlos; Windows real no probado |
| **Contrato de comunicación** | servidor verificado (N1); **conducta del modelo NO verificada** | `aed57ae` | `tw11_comunicacion` | ✅ run 43957962608 | preferencia persistente (global/proyecto), precedencia, advertencias en el texto, datos estructurados intactos; `tannia_comunicacion` | requiere `entrega/PROTOCOLO_COMUNICACION_DESKTOP.md` en Claude Desktop real |
| G11 Auditoría independiente | pendiente (externo) | — | — | — | expediente `entrega/AUDITORIA_TRANSFER.md` | persona |
| G12 Decisión del PO | pendiente (humano) | — | — | — | — | persona |

## Métricas de línea base (D7)
| | rc3 (CIC apagado) | CIC activado |
|---|---|---|
| Herramientas | 72 | 84 (83 antes del hardening) |
| `tools/list` bytes | 79 386 | 107 690 (+35,7 %) |
| Tokens estimados | 19 757 | 26 788 (+35,6 %) |
| Arranque (ms, local) | ~608 | ~593 |
| RSS del servidor (kB) | 150 492 | 146 120 |
| `.mcpb` (bytes) | 2 450 471 (rc3) | 2 450 543 (off) · 2 453 095 (on) |
Precisión de selección de herramienta: **no medida** (requiere un cliente con modelo; pendiente en Claude Desktop).

## Pendientes humanos (no aprobados)
AutoCAD real · Claude Desktop real · evaluación retenida independiente (G10) · revisión profesional por especialidad · taller con Tannia · decisión de aceptación del PO · merge y distribución.

CI Windows+Ubuntu verde: `aed57ae` (run 43957962608) y `2597296` (runs 43958068584 push y 43958101455 pull_request).

## Candidato de prueba vigente (SEC-01/SEC-02)
ZIP `TW11-entrega-9858ae1.zip`; `.mcpb` CIC apagado `fc506e6fa9a19fb7422496f0f7dce12ad97ba19c34acfa41a426641c6d8ce1cf` (72 herramientas); `.mcpb` CIC activado `87b8bb0eaee6b238e4dab59830cbb8df590442caebb9639dd4a36b839f80b4fd` (84). Los candidatos `cab78cd`, `aed57ae` y `329c8dd` quedan **superados**. Sin validación real. Plan del piloto: `entrega/PILOTO_REAL_TANNIA.md` (no iniciado).

## Pendientes humanos (no aprobados)
AutoCAD real · Claude Desktop real · evaluación retenida independiente (G10) · revisión profesional por especialidad · taller con Tannia · decisión de aceptación del PO · merge y distribución.

CI Windows+Ubuntu verde: `aed57ae` (run 43957962608) y `2597296` (runs 43958068584 push y 43958101455 pull_request).

## Candidato de prueba vigente (P1 consentimiento)
ZIP `TW11-entrega-329c8dd.zip`; `.mcpb` CIC apagado `268293f27cb3bbbdd7d6ed92516f4d74d9593f67ac47e3a5641ea1ede82d0dfe` (72 herramientas); `.mcpb` CIC activado `b5e2760ca99a3d0c766f2c7b2a8193edbe852be98fff2c8ac76bd201792503d3` (84). Los candidatos `cab78cd` y `aed57ae` quedan **superados** (el segundo conservaba el defecto P1). Sin validación real.

## Pendientes humanos (no aprobados)
AutoCAD real · Claude Desktop real · evaluación retenida independiente (G10) · revisión profesional por especialidad · taller con Tannia · decisión de aceptación del PO · merge y distribución.

CI Windows+Ubuntu verde: `aed57ae` (run 43957962608) y `2597296` (runs 43958068584 push y 43958101455 pull_request).

## Candidato de prueba vigente (hardening)
ZIP `TW11-entrega-aed57ae.zip`; `.mcpb` CIC apagado `774d4b454da8339f699f8701a9628bfceeb8389a0950fce1c965a2bbb0a0b762` (72 herramientas); `.mcpb` CIC activado `88219fa7c3c4849e4bbe2f06407622442e10c01e6cdcc46daee6136c8b9e75f5` (84). El candidato anterior (`cab78cd`, ZIP `0dddfec7…5b03`) queda **superado**. Sin validación real.

## Pendientes humanos (no aprobados)
AutoCAD real (`entrega/PROTOCOLO_AUTOCAD_REAL.md`) · Claude Desktop real (incl. seguridad §S y comunicación; índice `entrega/PROTOCOLO_CAMPO_TW11.md`) · evaluación retenida independiente (G10) · revisión profesional · taller con Tannia · decisión de aceptación (incl. D7) · merge y distribución.
