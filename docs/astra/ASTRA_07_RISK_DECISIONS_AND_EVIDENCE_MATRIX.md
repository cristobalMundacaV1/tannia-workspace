# ASTRA 07 — Riesgos, decisiones, evidencia y cobertura del mandato

Estado al 17-11-2026: misión de auditoría/diseño documental; propuesta no aceptada automáticamente. No se modificó código de producto. Referencia congelada A en `c732f23`; investigación previa en `b78a281`; comparación con PR #22 `3139a04`. Base de código `2f4cdd07a4a24ee76e993bedf56e4e0f02630db2`, reconfirmada antes de publicación.

## 1. Evidencia ejecutada y límites

| ID | Acción / resultado observado | Evidencia | Qué NO demuestra |
|---|---|---|---|
| EV01 | checkout limpio de código #21, rama documental propia; inventario de ramas y PRs | [inventario PR2/7/11–20](evidence/github-baseline.json), [PR21](evidence/pr21-baseline.json) | aceptación/merge de stack |
| EV02 | npm ci real, luego npm test Linux Node24.22.1: 463 tests, 447 pass, 0 fail, 16 skip; 379,4s | [log completo](evidence/local-tests.txt) | AutoCAD/Windows/Desktop real; los 16 skip requieren powershell.exe |
| EV03 | GitHub CI #21 run44077443232 success; Ubuntu y Windows npm ci/test/build/pack/upload | [run](https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/44077443232), jobs134019009549/134019009703 | COM con AutoCAD instalado: sus dobles no son programa real |
| EV04 | A-01 y A-02 reproducidos por cliente MCP sin persona, proyecto temporal ficticio | [registro](evidence/independent-reproduction.json), [script reproducible](evidence/reproduction-procedure.md) | explotación en datos de usuario; no se tocaron |
| EV05 | comparador puro acepta cambio de conectividad/capa | [reproducción A-03](evidence/fidelity-reproduction.md) | bypass de todos los validadores CAD en conjunto |
| EV06 | tools/list del código fuente con perfiles explícitos y hash de esquemas | [snapshot](evidence/tools-snapshot.json) | selección correcta del modelo, instalación UI o evidencia N2 |
| EV07 | fuentes primarias y licencias README/LICENSE consultadas; comparativa de opciones | ASTRA02 R01–R29, suplemento abajo | integración PoC, licencia para redistribuir normas ni auditoría completa de terceros |
| EV08 | documentos PR22 leídos después de dos commits independientes | historial Git + ASTRA03 | que otro auditor o profesional humano haya aprobado este diseño |
| EV09 | antecedente histórico de campo: COM/ensayos previos y fallo Add+Import | docs/tw12/EVIDENCE_MATRIX.md, docs/KNOWN_LIMITATIONS.md, issues8/10 | prueba propia de Astra; reportes históricos tienen scope/build limitado |

La suite verde y las reproducciones fallidas no se contradicen: la suite actual prueba los contratos actuales, incluso permite aprobación por argumentos en test/tw04_workflow.test.js. Los nuevos requisitos deben tener tests negativos adicionales. No se «arreglaron» hallazgos para hacer pasar una auditoría documental.

Los logs de pruebas son sobre fixtures del repositorio, no planos de clientes. Resultados locales Node24 no sustituyen Node22 CI. No se construyó un instalador destinado al usuario ni se distribuyó un paquete; algunos tests generan y validan bundles temporalmente. No se realizó pentest integral ni revisión jurídica de contratos de licencias. La evaluación humana independiente queda abierta y no impide terminar el diseño documental.

## 2. Suplemento de investigación después del contraste

Para fijar candidatos MCP se verificaron también heads públicos y mensajes/diffs de commit. Este suplemento **no modifica la investigación congelada previa**:

| Repositorio | HEAD observado | Actividad observada / límite |
|---|---|---|
| U-C4N/Autocad-MCP | `6f6a538255ca9f885232e845ac32f10b4433fe3e` | último commit corrige lanes CI, tests COM omitidos, timeout process tree y paths Windows; evidencia de mantenimiento en esa revisión, no garantía de madurez ni SLA |
| ACKaraca/AutoCAD_MCP | `7e3f2513dc23018d9245a0c388cb6f9a1cb53116` | corrige manejo de excepciones y colección Documents vacía; mensaje mantiene AutoCAD real no verificado |
| Porta048/AutoCad-MCP | `ea45dd8069be8b482a70561c5aacdc51576aa859` | cambios README/LICENSE/URL; no demuestra actividad de tests/hardware |

No se extrajo una serie temporal de commits, tiempo de respuesta de maintainers ni fecha de último release firmado; actividad sostenible y compatibilidad siguen criterios de PoC. No se instala código de estos repositorios. Licencias MIT verificadas no equivalen a adopción aprobada.

## 3. Registro de riesgos

| Riesgo / severidad | Evidencia o incertidumbre | Mitigación y dueño | Gate / residual |
|---|---|---|---|
| RISK01 falsa revisión humana / P0 | A-01 reproducido | E03/E05 receipts, R seguridad | G1; proceso del mismo usuario fuera de frontera sin aislamiento |
| RISK02 entrega de versión equivocada / P0 | A-02 reproducido | E04 manifest + invalidación, líder técnico | G1/G4; edición externa detectada por hash |
| RISK03 falsa fidelidad CAD / P1 | A-03 + límites de count/propiedades | E07/E08 oráculos nativos/independientes, CAD | G2b/G5; cada entidad no cubierta queda no soportada |
| RISK04 importación sin resultado útil / H0 | fallo real reportado, causa no observada aquí | E06 PoC, CAD/PO decide backend | G2b; error seguro no cierra funcionalidad |
| RISK05 métodos contractuales ambiguos / P1 | norma/contrato no leídos por completo | MC y especialista, no copiar norma | G3; un método no se extrapola a otra partida |
| RISK06 defaults/cifras/rounding / P1 | A-04 + dos motores | E16 política única explícita | G4; precios siguen responsabilidad de fuente/fecha |
| RISK07 archivos/privacidad / P0 potencial | rutas protegidas pero permisos externos y transmisión host | E26, minimización/ACL/backup, PO datos | G2a/G7; proceso privilegiado no controlable por solo Node |
| RISK08 prompt injection / P1 alto | tests estructurales, comportamiento modelo no validado | intents tipados, scope mínimo, casos retenidos | G1/G8; variar modelo requiere reevaluar |
| RISK09 normativa caduca o inaplicable / P1 | territorio/fecha/edición no siempre representados | E20 y revisión competente | G6; no certificación automática |
| RISK10 dependencia comercial/licencia / P1 | full AutoCAD/Claude/Office/INN y transitivas | SBOM/contratos/plan soporte, PO | G9; proveedor puede cambiar API/precio |
| RISK11 falsa generalidad / P2 | túnel y vivienda acotados | perfiles por operación + vertical real | G3/G5/G8; rechazar encargos fuera de dominio |
| RISK12 regresión de stack/migración / P1 | producto fuera main en PR apilados | E01/E27 y pruebas árbol integrado | G0/G9; CI histórico no se transfiere por nombre |
| RISK13 UX requiere desarrollador / H0 | piloto objetivo no acreditado | E24/E25 con usuario estándar | G7/G8; no disfrazar intervención técnica de autonomía |
| RISK14 corpus contaminado / P1 evaluación | implementador conoce fixtures actuales | R retiene casos/ground truth fuera repo | G8; después de revelar caso pasa a regresión |

## 4. Decisiones concretas del Product Owner

No se requiere respuesta para publicar este PR documental autorizado. Estas decisiones habilitan implementación futura; **todas propuestas, ninguna ratificada por este informe**.

| ID | Decisión solicitada y recomendación | Alternativa/coste | Evidencia necesaria / dependencia |
|---|---|---|---|
| D01 | ratificar primer flujo: editar expediente de edificación + cubicar MC01/02/04 + presupuesto | priorizar diseño nuevo prolonga validación de trabajo existente | issue10, ASTRA02, entrevista/línea base E02 |
| D02 | asignar revisor independiente y profesionales CAD/cubicación/costos; custodio de casos | mismo implementador revisándose no acredita independencia | nombres/competencias/horas disponibles; G3/G8 |
| D03 | autorizar uso de ≥3 expedientes anónimos y conservar oráculos privados | sintéticos sirven N1, no piloto profesional | derechos, consentimiento, minimización; E02 |
| D04 | elegir perfil full AutoCAD Windows/builds y disponibilidad de máquina para QA | LT/PDF-only requiere promesa distinta, no COM equivalente | inventario licencias/versions y PoC G2 |
| D05 | aprobar política de revisión humana, receipt de snapshot, sin fallback archivo profesional | broker aislado tiene coste; sin él no prometer defensa contra otro proceso privilegiado | amenaza y demo de consentimiento G1 |
| D06 | permitir o prohibir fragmentos de datos de clientes hacia Claude; retención y terceros | prohibición total requiere perfil/arquitectura distinta, no basta MCP local | contrato/datos/asesoría legal; G7/G9 y transición 21.719 |
| D07 | presupuesto de PoC .NET si COM no conserva/edita corpus | limitar capacidad y operación manual supervisada | comparación E08; no API elegida por moda |
| D08 | licenciar NCh necesarias y revisar qué usos digitales permite contrato | tarjetas contractuales y referencias sin texto protegido | profesional/legal; G3/G6 |
| D09 | decidir licencias producto/distribución y firma/editor/soporte | uso interno limitado con registro de limitaciones | UNLICENSED actual, SBOM, editor; G9 |
| D10 | ratificar criterios de gate, tolerancias por partida y métricas | reducir alcance antes que relajar seguridad/verdad | corpus y oráculos antes del ensayo; G8 |
| D11 | determinar herramientas ya usadas (Excel/ONDAC/Bluebeam/Project) y compra vs integración | desarrollar duplicados sube mantenimiento | prueba comparativa y costo total; E17/E22/POC terceros |
| D12 | mantener BIM/IFC/SaaS fuera de implementación | expansión solo con caso de clientes/coste/competencia y aprobación separada | no bloquea roadmap actual |

## 5. Trazabilidad completa al issue #23

| Obligación | Dónde se resuelve | Estado de misión / límites |
|---|---|---|
| A1 main/ramas/PRs/SHA/diff/CI, avance #21 | ASTRA01 + evidence JSON; reconfirmación ASTRA07 | inspeccionado; diffs estadísticos de stack y lectura focalizada del código acumulado, no auditoría exhaustiva de cada línea histórica |
| A2 instrucciones/estructura/tests/módulos/issues/matrices | ASTRA01/EV01–03/09 | realizado; evidencia histórica distinguida de propia |
| A3 defectos/severidades/reproducciones | A-01…A-07 + scripts/logs | 3 vías reproducidas, otros hallazgos estáticos/gates externos |
| A4 diagnóstico previo al PR22 | commit c732f23 | congelado, no reescrito |
| B CAD2026/27/API/LT/APS/MCP | ASTRA02 §2/3 R01–R07 | fuentes primarias; runtime .NET/COM no probado aquí |
| B ecosystem/licencias/mantenimiento/seguridad | ASTRA02 matriz + suplemento §2 | candidatos evaluados para decisión; no homologados |
| B industria/procesos/metodologías/competidores | ASTRA02 §1/3, ASTRA04 capacidades | documental primaria; entrevistas/piloto pendientes explícitos |
| B Chile/normativa/licencias/autoridad | ASTRA02 §4 R11–14/R25–29 | versión catálogo/portales; no normas completas licenciadas ni comuna concreta |
| C cuatro documentos y contraste crítico | ASTRA03 | lectura íntegra, acuerdos/desacuerdos/omisiones y pruebas |
| D1–3 misión/personas/capacidades/procesos | ASTRA04 §1/2/7 + ASTRA02 §1 | diseño completo propuesto |
| D4–5 módulos/contratos/procedencia | ASTRA04 §3–5 | diagramas, contratos, estados, autoridad |
| D6 Skills Code y equivalente Desktop | ASTRA05 | 13 procedimientos y 8 MethodCards; especificados, no instalados |
| D7 COM/.NET/fallback | ASTRA02 §2 + ASTRA04 §6 + POC-CAD | decisión condicionada a evidencia; sin falsa garantía |
| D8–9 UX/epistemología/seguridad/consentimiento | ASTRA04 §5/7/8 | sin consola/JSON, mínimo privilegio, recuperación |
| D10 evaluación independiente | ASTRA06 §3–6 | oráculos/corpus/umbrales/custodia; no afirmada ejecutada |
| D11–12 licencias/mantenimiento/migración | ASTRA04 §9/10 + ASTRA06 §7 | planes concretos; decisiones PO pendientes |
| E backlog/fases/dependencias/gates/prioridad/costo | ASTRA06 E01–E30 y G0–G9 | ejecutable por historias; esfuerzo relativo, sin plazos ficticios |
| E PoC/adversariales/vertical/RACI/métricas | ASTRA06 §4–8 | todos los casos solicitados cubiertos; criterios antes de ejecución |
| Gobierno docs-only/rama/draft/sin merge | README, historial y PR propio | publicación solicitada; no cambios de producto |
| Memo ejecutivo/decisiones | ASTRA_EXECUTIVE_DECISION_MEMO + D01–D12 | propuesta revisable, sin aceptación automática |

## 6. Criterio de terminado documental y trabajo pendiente de campo

El diseño documental se considera listo para revisión cuando los ocho documentos y evidencias estén en rama propia y PR DRAFT, links locales válidos, diff únicamente docs/astra y PR21 aún base auditada o divergencia explicada. No equivale a cierre de G1–G9 de producto. AutoCAD real, instalación Desktop, corpus real anónimo, revisión humana N3, licencias y decisiones PO quedan pendientes de los responsables designados. Esta misión los convierte en gates ejecutables; no inventa su ejecución.
