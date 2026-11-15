# TW-07A — Piloto 2D con Tannia (protocolo preparado, NO ejecutado)

**Estado: PENDIENTE (requiere a Tannia). El desarrollo 3D no depende de este piloto.**

## Preparación (equipo de desarrollo)
- Paquete RC instalado (`INSTALACION.md`) y diagnóstico OK.
- Una obra real pequeña con: 1 plano DXF/DWG (exportable a DXF), 1 PDF, y las alturas/espesores/precios que ella entregará.
- Observador **sin intervenir** salvo bloqueo; cronómetro por trabajo.

## Trabajos (sin ayuda técnica)
| Trabajo | Qué pide Tannia | Criterio de éxito |
|---|---|---|
| T1 Abrir/inspeccionar plano | «Revisa este plano y dime qué contiene» | Resumen correcto de capas/entidades; entiende advertencias; ≤ 10 min |
| T2 Cubicación y presupuesto | «Cubica muros y losa; arma el presupuesto con estos precios» | Cantidades coinciden con su cálculo manual (tolerancia que ella fije); Claude pregunta alturas/espesores/unidades en vez de suponerlos; Excel abre y recalcula |
| T3 Memoria y entrega | «Genera la memoria y deja los entregables» | PDF legible; entrega solo tras su aprobación explícita |

## Registro por trabajo
Duración · intervenciones del observador · errores/mensajes confusos · cantidades vs referencia (valor y diferencia %) · ¿hubo cifra inventada? (debe ser NO) · satisfacción (1–5) · ¿lo usaría en una obra real?

## Criterios de aprobación del piloto 2D
Sin cifras inventadas; diferencia ≤ tolerancia acordada; sin pérdida/modificación de originales; ningún bloqueo que requiera consola; Tannia completa T1–T3 sola. Resultado → `docs/qa/PILOT_2D_RESULT.md` (solo si se ejecuta). Estado hasta entonces: **PILOTO TANNIA NO EJECUTADO**.
