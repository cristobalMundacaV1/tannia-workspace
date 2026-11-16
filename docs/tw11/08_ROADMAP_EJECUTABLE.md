# TW-11 · 08 — Roadmap ejecutable: historias, dependencias, gates y criterios
**Estimaciones** en jornadas de implementación asistida (S ≤1 · M 2–3 · L 4–6 · XL 7+). Son orientativas, no compromisos. **Orden por dependencia y riesgo:** primero el vertical delgado que prueba el CIC extremo a extremo con un dominio nuevo, luego se ensancha.
## Fase 0 — Vertical delgado (G0–G2)
**G0 Baseline y contratos** (S/M)
- TW11-01 Snapshot de `tools/list` y suite base con SHA; test «72 intactas».
- TW11-02 ADR-001 (arquitectura CIC), ADR-002 (política epistémica/claims), ADR-003 (sin red; fuentes externas por `registrar_fuente`).
- TW11-03 Zod: `engagement`, `workplan`, `claim`, `capability`, `source`, `passage`, `operation`, `specialization`, `verification`, `issue` + versionado y migración.
- TW11-04 `TW11_STATE.json` y matriz de evidencia.
**Gate G0:** contratos con tests de ida/vuelta y rechazo de inválidos; snapshot verde; CI Windows+Ubuntu en SHA identificado.
**G1 Núcleo dimensional y operaciones (S1)** (M/L)
- TW11-05 Motor de unidades/dimensiones (tabla cerrada, conversiones, errores).
- TW11-06 Registro de operaciones + 5 operaciones P0 (área de polígono con arcos, secciones herradura/circular, áreas medias, Pappus) con oráculos.
- TW11-07 `tannia_cic_calcular` y `tannia_cic_catalogo` (lectura).
**Gate G1:** E2 con oráculos analíticos y property tests (invariancia unidad/traslación); mutation test detecta fórmula corrupta; fuera de rango ⇒ error tipificado.
**G2 Claims y ledger (S/M)**
- TW11-08 Ledger de claims versionado (`claims.jsonl` + hash), `tannia_cic_claims`.
- TW11-09 Verificador «sin número sin claim» para entregables (texto/XLSX/PDF).
**Gate G2:** T10 y T3 pasan; reproducibilidad por hash.
## Fase 1 — Conocimiento y planificación (G3–G4)
**G3 Conocimiento (L/XL)**
- TW11-10 Extractores PDF-texto/DOCX/PPTX/XLSX/MD sin nativos; fixtures sintéticos propios.
- TW11-11 Índice BM25 + facetas + sinónimos por disciplina; RRF multi-consulta.
- TW11-12 `source/passage`, políticas de licencia/binding/vigencia, `registrar_fuente`.
- TW11-13 `tannia_cic_conocimiento`; ADR-004 embeddings locales (decisión informada, puede resultar «no»).
**Gate G3:** métricas del doc 03 §5 con conjunto retenido; T2, T8, T9 y T7 pasan.
**G4 Encargo, plan y ejecución (L)**
- TW11-14 Interpretación de encargo: clasificación multi-disciplina con `no_clasificado`, extracción de magnitudes/desconocidos/preguntas (reusa cláusulas TW-10/F06), `tannia_cic_encargo`.
- TW11-15 `Planner`: validación de DAG, grafo de tipos para sugerir pasos, `gap` como estado; `tannia_cic_plan`.
- TW11-16 `Executor` idempotente con reanudación; `tannia_cic_ejecutar`.
- TW11-17 Modos académico/profesional como política.
**Gate G4:** caso C (dev y mutado) pasa; T1, T4, T5, T6, T12, T14.
## Fase 2 — Geometría general y especializaciones (G5–G7)
**G5 Geometría general (XL)**
- TW11-18 `src/geo/` primitivas, booleanos 2D con tolerancia, offset, intersecciones, bulge.
- TW11-19 `Alignment/Profile/Station/SectionAt`, volúmenes por secciones, barrido a malla, `mass_haul_table`.
- TW11-20 Exportadores DXF (planta, perfil, secciones) verificados con lector independiente y `ezdxf`.
- TW11-21 Importadores LandXML/CSV/GeoJSON con reporte de pérdidas (ADR-005; IFC fuera).
**Gate G5:** operaciones E2 contra oráculos; DXF válido; cero afirmaciones normativas.
**G6 Cálculo de cantidades y planificación (L)**
- TW11-22 Extender `quantities` (reglas por sección/tasa por metro/perímetro×altura) con regresión de las 9 existentes.
- TW11-23 `sched.cpm`, curva S, valor ganado con casos de libro.
- TW11-24 Entregables editables (XLSX con fórmulas, PDF, MD, DXF) vía `tannia_cic_entregable`.
**Gate G6:** casos D (cadena) y regresión de presupuesto; recompute con `stale`.
**G7 Especializaciones y migración (L)**
- TW11-25 Cargador de especializaciones + validación + desactivación segura.
- TW11-26 Especializaciones `vivienda`, `arquitectura_razonada` (declarativas) y `tuneles`, `lineal_vial`, `cubicaciones`, `planificacion` (primeras).
- TW11-27 Adaptador de enrutador con equivalencia (≥200 frases históricas) + flag `TANNIA_CIC`.
**Gate G7:** caso A (dev y mutado) y caso C; equivalencia con el enrutador antiguo ≥ 99 % en el corpus histórico; flag off = rc3 exacto.
## Fase 3 — Departamentos, empaquetado y evaluación (G8–G11)
**G8 Departamentos/multi-nivel (XL)**
- TW11-28 Representación de programa independiente de tipología (espacios, adyacencias, niveles, núcleos).
- TW11-29 Generador de unidad de departamento sobre `arq3d`; contraste con casa (T-B).
**Gate G8:** caso B dev y retenido (oficina/local); sin rastro de vivienda unifamiliar.
**G9 Paquete y experiencia de uso (M)**
- TW11-30 Paquete `.mcpb` `tw11` con la misma identidad; verificador de bundle (≥81 herramientas, identidad, ruta con espacios/ñ), instrucciones de 1 página, mensajes de error.
- TW11-31 Protocolo de validación de campo para PO/Tannia (sin AutoCAD obligatorio).
**G10 Evaluación adversarial y anti-sobreajuste (M)**
- TW11-32 Suite T1–T15, medición doc 06 §4, reporte dev↔retenido.
**G11 Auditoría independiente** — traspaso, sin autoaprobación.
**G12 Decisión del PO** — aceptación/fusión/distribución solo con autorización explícita.
## Matriz de dependencias
G0→G1→G2; G2→G3; G1,G2,G3→G4; G1→G5; G2,G5→G6; G3,G4,G5,G6→G7; G7→G8; G7,G8→G9→G10→G11→G12. G3 y G5 pueden ir en paralelo.
## Estrategia de desarrollo autónomo incremental
1. Un PR (borrador) por gate, apilado; CI Win+Ubuntu en el SHA exacto; evidencia en `docs/tw11/EVIDENCE_MATRIX.md`.
2. Sin avanzar de gate con pruebas rojas; sin saltarse ni silenciar tests.
3. `TW11_STATE.json` actualizado por commit (gate, SHA, pendientes externos).
4. Cada gate cierra con: pruebas, ejemplos, doc actualizada, matriz de evidencia y lista explícita de lo **no** validado (hardware, Desktop, profesional).
5. Los gates con hardware (AutoCAD real, Claude Desktop real, taller con Tannia) son **externos y pendientes**; no frenan el RC de ingeniería pero impiden prometer funcionamiento real.
## Criterios de aprobación (por quien revisa, no por el código)
- Reproducibilidad: clonar SHA ⇒ `npm ci && npm test` verde, ejemplos regenerables con hash idéntico.
- Honestidad: la matriz distingue N1/N2/N3; ninguna capacidad marcada N2/N3 sin evidencia adjunta.
- Anti-sobreajuste: gap dev→retenido ≤ 10 pp.
- Seguridad: sin red nueva, sin escritura fuera del proyecto, originales intactos.
