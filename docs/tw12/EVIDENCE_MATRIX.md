# TW-12 — Matriz de evidencia (candidato para revisión independiente)

Base: `wip/tw12-astra-recovery` (6c64f36, WIP de Astra, NO VALIDADO) sobre `49c2ae8` (head de PR #19). Rama: `feat/tw12-workspace`.
Estados permitidos: `PASS_AUTOMATIZADO`, `PENDIENTE_EXTERNO`. Nada aquí está aprobado por AutoCAD real, Claude Desktop real, revisor independiente ni Tannia.

| Capacidad | Evidencia | Estado |
|---|---|---|
| Rescate íntegro de los 17 archivos de Astra | rama recuperada, diff 6c64f36 vs 49c2ae8; archivo espurio `tra - NO VALIDADO` eliminado (restos de un commit mal citado en PowerShell) | PASS_AUTOMATIZADO |
| Registro durable de operaciones CAD (idempotencia, checkpoint, conflicto, escritura parcial) | `test/tw12_workspace.test.js` 1–4 | PASS_AUTOMATIZADO |
| Controles de sesión COM (`SESION_AMBIGUA`, `DOCUMENTO_CAMBIO`, hash esperado, solo lectura) | scripts estáticos + contrato `tw06_cad` (corregido para `laminas_a_dwg`); inspección con `DNum` (sin conversión a 0) | PASS_AUTOMATIZADO (script) / PENDIENTE_EXTERNO (AutoCAD 2027 real) |
| Modelo de dibujo independiente de GUI; cotas verificadas contra geometría | `verifyDimensions`, tests | PASS_AUTOMATIZADO |
| Gate de legibilidad (vista diminuta, solape, glifo dañado, escala/región, viewport recortado) | test 5 + validateScene | PASS_AUTOMATIZADO |
| Escala física 1:50: 5,5 m = 110 mm | test «physical 1:50» (medido sobre la escena PDF) | PASS_AUTOMATIZADO |
| Cuatro PDF A3 renderizados (no vacíos, sin tinta en el borde) | `renderPdf` + revisión visual de los PNG en esta sesión | PASS_AUTOMATIZADO; revisión humana PENDIENTE_EXTERNO |
| Corte A-A en planta, tabla de revisiones, altura en el perfil, etiquetas de cotas cortas sin tocar geometría | correcciones de auditoría + test «audit» | PASS_AUTOMATIZADO |
| DXF: 4 layouts, 5 viewports, 9 cotas; lector independiente ezdxf: 0 errores, view_height == alto·escala | test oráculo ezdxf | PASS_AUTOMATIZADO (DWG real PENDIENTE_EXTERNO) |
| Consentimiento: Guía hash / https://x.invalid / unknown / licensed bloqueado en todos los canales; cierre/rechazo nunca aprueba; ventanas simultáneas deduplicadas | tests 8–9 + suite TW-11 | PASS_AUTOMATIZADO |
| Entregables inmutables con manifiesto SHA-256 y detección de alteración | test 7 | PASS_AUTOMATIZADO |
| AutoCAD 2027 real (DWG, layouts, viewports, escalas) | `PROTOCOLO_AUTOCAD_2027_TW12.md` | PENDIENTE_EXTERNO |
| Claude Desktop real, revisión profesional, piloto con Tannia | protocolos TW-11 vigentes | PENDIENTE_EXTERNO |

## Limitaciones
- Ejercicio académico: sin geotecnia, sostenimiento, topografía ni normativa. Los campos institución/autor/fecha quedan `PENDIENTE` hasta que el usuario los confirme.
- Cada detalle es la geometría del espesor (6 y 8 cm), no un diseño de revestimiento.
- El PDF se genera desde el modelo, no desde un DWG guardado.

## Auditoría PR #20 — hallazgo P1 (viewports) y cierre
- `guardarLaminas` ya no usa `some()` sobre escalas. `src/drawing/layouts_check.js` verifica cada layout: identidad y duplicados, cantidad exacta de viewports (tolera como máximo un viewport global del tamaño de la lámina), asignación uno a uno por centro y tamaño en papel, escala, bloqueo y región del modelo. Rechaza faltantes, sobrantes, duplicados, desplazados, sin bloqueo y asociados a otra vista.
- El mismo verificador se aplica (a) al DXF generado, leído con un parser independiente de códigos de grupo (`LAYOUTS_INVALIDOS` si falla) y (b) a la inspección que devuelve AutoCAD sobre el DWG guardado.
- Pruebas: oráculo DXF, mocks positivos y 16 negativos, test de `guardarLaminas` con runner simulado. El resultado siempre incluye `dwg_validado_autocad_real: false`.
- **Límite declarado:** la región del modelo (`ViewCenter`) se verifica en el DXF; en el DWG solo si AutoCAD la expone por COM. Si no, el nivel es `parcial_sin_region_modelo`. Que el DWG real conserve centros, escala y bloqueo sigue **PENDIENTE_EXTERNO** (AutoCAD 2027).
- La suma de escalas coincidentes NO acredita un DWG válido.

## Auditoría de Trust & Consent UX
- Orden de canales: confirmación MCP (elicitación) → ventana nativa estructurada → archivo fuera de banda. Rechazo, cierre o tiempo agotado = no.
- Se bloquea antes de abrir cualquier canal: URL explícita inválida/reservada (`.invalid`, `.test`, `.local`, `localhost`, credenciales en la URL, sin dominio), licencia `licensed` sin evidencia, extracto ausente, fuente vencida o no candidata. Caso negativo `Guía hash / https://x.invalid / unknown / licensed` probado.
- Un origen local o no informado NO se bloquea: se muestra «No informado» y la decisión es de la persona (antes del ajuste bloqueaba toda fuente manual).
- Una solicitud idéntica simultánea no abre dos ventanas. Ningún secreto en rutas accesibles al agente (TW-11 P1/SEC-02 intactos).
- Pendiente: usabilidad real del diálogo WPF en Windows (accesibilidad, lectores de pantalla) — **PENDIENTE_EXTERNO**.

## Alcance
La generación de planos de TW-12 está **especializada en el túnel académico de herradura** (`tunnelModel`). No hay soporte general de proyectos ni de otras geometrías; ampliar requiere modelos y pruebas representativas adicionales.
