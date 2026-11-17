# Matriz de ejecución E01–E30 y gates G0–G9 — Tannia Workspace 0.2.0-rc.1

Fuente: [ASTRA 06](../astra/ASTRA_06_FINAL_MASTER_ROADMAP_AND_GATES.md) (propuesta en PR #24, `b9292ef`). Rama `claude/sharp-gates-r4rbu5`, base `b9292ef` (código = PR #21 `2f4cdd0`). Fecha: 2026-11-17.

**Estados.** `pendiente` · `en curso` · `implementado` (código y pruebas automatizadas N1 en el repositorio) · `validado` (criterio de aceptación del gate cumplido con la evidencia del nivel exigido) · `bloqueado` (depende de un recurso externo nombrado). Implementado ≠ validado. N0 documentado · N1 automatizado/fixture · N2 software/hardware/cliente real · N3 validación profesional competente.

Evidencia común: `npm test` Linux Node 22 (`evidence/02-suite-*.tap`), CI Ubuntu+Windows del PR, verificador del ZIP final (`evidence/03-*`), reproducción antes/después (`evidence/01-reproduccion-antes-despues.md`).

## Historias

| ID | Alcance y criterio de aceptación | Dep. | Archivos / módulos | Pruebas y evidencia | Estado |
|---|---|---|---|---|---|
| E01 | Baseline reproducible: SHA, lock, suite y herramientas | — | `evidence/00-baseline-b9292ef-linux-node22.tap` | baseline 463 pruebas: 444 ok, 0 fallos, 19 omitidas (16 PowerShell, 2 ezdxf, 1 permisos como root); CI de cada push | **validado** (N1) |
| E02 | Expediente real anonimizado + línea base humana | E01 | — | no hay expediente autorizado en el repositorio ni acceso a uno | **bloqueado**: D02/D03 (PO designa revisor y autoriza ≥3 expedientes) |
| E03 | Aprobación no suplantable para partidas y proyecto | E01 | `src/autoridad/{recibos,autorizacion,revision}.js`, `src/tools/index.js` (avanzar, partida_verificar), `src/cic/aprobacion_humana.js` | `test/rc_autoridad_entrega.test.js` (A-01 en perfiles BASE/CIC/INGENIERÍA; JSON y registro de recibos falsificados; estado «aprobado» escrito a mano; rechazo humano); `evidence/01` antes/después | **implementado**; N1 validado; N2 (ventana real en Claude Desktop/Windows) **bloqueado**: sin Claude Desktop en este entorno |
| E04 | Entregar artefactos exactos de UNA revisión | E03 | `src/autoridad/entrega.js`, `src/project/store.js` (revisiones, version_id), herramientas generar/exportar/`tannia_entrega_estado` | A-02 100→900 (oráculo 10.710), cambios post-aprobación (precio, XLSX editado, parámetro), A→B→A, exportación transaccional, un solo uso; verificador ZIP pasos 6–9 | **implementado**; N1 validado |
| E05 | Aislamiento del canal humano | E03 | canal de archivo desactivado para autorizaciones profesionales; HMAC con clave fuera de proyectos; WPF/elicitación | pruebas de recibos firmados/falsos; frontera declarada en DECISIONES D-SEC-01 | **implementado** (parcial por diseño: proceso del mismo usuario fuera de frontera); POC-CONSENT N2 **bloqueado** (Claude Desktop) |
| E06 | Diagnóstico real CAD-OPEN-02 | E01 | sin cambios funcionales (código de PR #21 conservado) | protocolo `docs/tw12/PROCEDIMIENTO_PRUEBA_DXF_AUTOCAD_2027.md` | **bloqueado**: requiere AutoCAD completo en Windows (D04) |
| E07 | Comparador CAD detecta topología/metadatos | E01 | `src/cad/fidelidad.js`, lectura COM de bulges/elevación en `src/cad/autocad_com.js` | `test/rc_fidelidad_contrato.test.js` (AC13: lazo cruzado, capa, sentido, orden, bulge, elevación, OCS, tipos sin comparador ⇒ no concluyente); `evidence/01` | **implementado**; N1 validado; lectura COM nueva N2 **bloqueada** (AutoCAD) |
| E08 | Decidir COM vs .NET con el mismo corpus | E06/E07 | — | POC-CAD | **bloqueado** (AutoCAD + corpus, D04/D07) |
| E09 | Timeout/caída y cambio concurrente recuperables | E03/E07 | journal CAD existente (PR #21) + exportación transaccional nueva | verificador ZIP paso 9 (SIGKILL del servidor ⇒ sin entrega a medias, JSON legibles); suites tw12_cad_timeout/tw26 existentes | **implementado** para datos/entregas; CAD real **bloqueado** |
| E10 | Inventario de dependencias/escala | E01 | existente (inspect/measure, INSUNITS no basta) | suites existentes; procedimiento tw-auditar-cad | **implementado** (sin cambios); XREF real **bloqueado** (POC-XREF) |
| E11 | Procedencia común legacy/CIC sin doble escritura | E04/E10 | partidas con `version_id`, verificación derivada de recibos, revisiones compartidas por herramientas legacy | rc_autoridad_entrega; tw04 actualizado | **en curso**: legacy cubierto; CIC conserva su versionado propio por caso (no unificado; ver D-ARQ-03) |
| E12 | MC01 muros/vanos | E02/E11 | `src/metodos/tarjetas.js`, `tannia_metodo` | `test/rc_arquitectura.test.js` (5×2,4−2=10; caras; umbral; vano fuera; solape; sin posición; supuesto ⇒ needs_review) | **implementado** (N1); N3 **bloqueado** (E02/D02) |
| E13 | MC02 losa/radier por zona | E02/E11 | idem | 1,8 m³; hueco mayor/fuera; zonas solapadas; contiguas válidas | **implementado** (N1); N3 **bloqueado** |
| E14 | MC04 conteo físico | E10/E11 | idem | 3 planta + 3 elevación = 3; leyenda excluida; sin identidad ⇒ needs_review | **implementado** (N1); adaptador automático desde bloques DXF **pendiente**; N3 **bloqueado** |
| E15 | MC03 terminaciones y consumo separado | E12/E14 | — | — | **pendiente** (siguiente según línea base E02) |
| E16 | Política económica explícita única | E11 | `src/budget/calc.js`, `xlsx.js`, `report/memoria.js`, `store.config()` | rc_autoridad_entrega, tw02 existentes; ausente ≠ 0, bloquea final | **implementado** en legacy (CIC ya exigía explícito); redondeo por etapa sin cambio (D-ARQ-04) |
| E17 | XLSX y memoria de la misma revisión | E04/E16 | rótulo de revisión en XLSX/PDF, registro de artefactos | verificador ZIP paso 7 (TOTAL del XLSX entregado = oráculo; PDF válido); Excel real **no** probado | **implementado**; recálculo en Excel real **bloqueado** (Windows+Office) |
| E18 | Editar un objeto sin perder plano ajeno | E08/E09/E10 | — | — | **bloqueado** (AutoCAD real + E08) |
| E19 | Planta/corte/lámina de edificación | E18 | planos TW-12 movidos a `06 Informes/Planos` (no son entregas) | tw12_qty_traza actualizado | **pendiente/bloqueado** por E18 |
| E20 | Fuentes aplicables y obsolescencia | E01 | `src/normativa/referencias.js` (fuente, versión observada, fecha, ámbito, límites, licencia); CIC existente para vigencia | rc_arquitectura (campos y «NO EVALUADO») | **implementado** (N1); revisión competente N3 **bloqueada** (D08) |
| E21 | EETT/memoria/RFI revisables | E11/E20 | memoria existente | — | **pendiente** |
| E22 | Planificación acotada | E16 | CIC existente | — | **pendiente** (P2 diferible, sin cambios) |
| E23 | Borrador estado de pago | E17/E21 | — | — | **pendiente** (P2 diferible) |
| E24 | Skills y procedimientos Desktop medidos | E03/E11 | `src/procedimientos/index.js` (5 prompts MCP), `.claude/skills/*` (7, generadas), `scripts/gen-skills.mjs` | rc_arquitectura (prompts y herramientas referidas existen); rc_skills (sin deriva); verificador ZIP paso 5 lista los procedimientos | **implementado**; evaluación de 30 tareas × 3 **bloqueada** (Claude Desktop + revisor) |
| E25 | Paquete usuario estándar recuperable | E03/E04 | `scripts/rc-zip.mjs`, `packaging/zip/*`, `scripts/rc-verificar-zip.mjs`, `scripts/rc-probar-instalador.mjs`, CI | ZIP probado en Linux (checkout limpio) y en CI Ubuntu+Windows (mismo artefacto); lanzadores .cmd en Windows real de CI | **implementado**; instalación por doble clic en Claude Desktop **bloqueada** |
| E26 | Seguridad/privacidad/distribución | E05/E25 | logs sin rutas personales; avisos y licencias de terceros en el ZIP; sin privilegios | AVISOS_DE_TERCEROS.md; 9 paquetes sin archivo de licencia propio listados | **en curso**: SBOM formal, firma de editor y revisión legal **pendientes** (D09) |
| E27 | Migración/rollback sin perder evidencia | E11/E17/E25 | `src/autoridad/migracion.js`, `tannia_proyecto_migracion` | rc_arquitectura (respaldo byte a byte, aprobación sin recibo anulada, idempotencia, reversión, esquema futuro intacto); verificador ZIP pasos 10–11 | **implementado** (N1) |
| E28 | Evaluación ciega con expediente real | E02, G1–G7 | — | — | **bloqueado** (E02, D02, D03) |
| E29 | Release por ámbito y soporte | E28 | — | — | **bloqueado** (E28, decisión PO) |
| E30 | 3D/lineal/terceros según evidencia | G9 | sin cambios | — | **pendiente** (diferido por diseño) |

## Gates

| Gate | Criterio (ASTRA 06 §3) | Evidencia disponible | Estado |
|---|---|---|---|
| G0 | inventario por SHA, CI Windows+Ubuntu, corpus y propósito | baseline + CI del PR; corpus no definido | **parcial**: N1 cumplido; corpus **bloqueado** (D03) |
| G1 | A-01/A-02 denegadas; 0 aprobaciones sin canal humano; replay/cancel rechazados; archivos de la misma revisión; diálogo/elicitación real | N1 completo (rc_autoridad_entrega, evidence/01, verificador ZIP) | **N1 aprobado; N2 pendiente** (ventana real en Claude Desktop/Windows) ⇒ gate **no aprobado** |
| G2a | originales intactos 100%; documento personal intacto; fallo/timeout sin duplicar | suites PR #21 + rc; sin AutoCAD | **no aprobado** (N2 AutoCAD bloqueado) |
| G2b | DWG útil reabierto | — | **bloqueado** |
| G3 | MethodCards revisadas; 100% trazables; errores dentro de tolerancia; 0 omisiones críticas | MC01/02/04 N1 | **no aprobado** (N3 bloqueado) |
| G4 | sin precio/config ⇒ sin total final; Excel recalculado = política | N1 (parámetros explícitos; XLSX con caché verificado contra oráculo) | **no aprobado** (Excel real y especialista de costos) |
| G5 | edición y planos revisables | — | **bloqueado** |
| G6 | toda observación normativa con fuente/fecha/aplicabilidad/licencia | registro de referencias N1 | **no aprobado** (revisión competente) |
| G7 | instalar/actualizar/rollback/desinstalar como usuario estándar sin consola; Unicode; 0 pérdida | ZIP verificado (Linux+Windows CI): extracción en ruta con ñ, perfil limpio, MCP, actualización, desinstalación sin pérdida; lanzador real en Windows | **N1/N2-parcial**: falta Claude Desktop real y QA ajeno ⇒ **no aprobado** |
| G8 | ≥3 expedientes, ≥20 tareas retenidas, ≥5 adversariales | — | **bloqueado** |
| G9 | decisión de release acotado | — | **bloqueado** (PO) |

**Ningún gate de liberación está aprobado.** El paquete es un **candidato no validado**: apto para probar con copias en el equipo objetivo, no para uso profesional.
