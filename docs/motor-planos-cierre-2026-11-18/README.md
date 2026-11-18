# HANDOFF — Cierre del motor de planos de Tannia Workspace

**Estado:** documental, NO implementación. **Fecha:** 2026-11-18.
**Punta funcional auditada:** PR #37, `astra/consolidacion-uat`, SHA `1c8849084eb99f436f74bfbf9d2b511a06a43ead`.

## Instrucción de inicio para Claude Code Opus 5.5
Lee primero `02_PROMPT_EJECUCION_AGENTE.md`, luego `01_AUDITORIA_Y_DISENO.md`, `03_MATRIZ_GATES.csv`, `04_DIAGNOSTICO_DXF_UAT.json`, `05_CATALOGO_SIMBOLOS_PROPUESTO.json` y `06_PROCEDIMIENTO_AUTO_CAD_DXF.md`. No vuelvas a diseñar el roadmap.

**P0:** `PLANOS-COMPLETOS.dxf` abre aparentemente vacío en AutoCAD 2027, pese a contener 47 entidades CAD y cinco layouts. Investigar y corregir modelo/papel, extents, vistas iniciales, VPORT y cotas; el diagnóstico de parser NO acredita funcionamiento real en AutoCAD. No autorizar el siguiente ZIP sin pasar los gates automatizables.

**P1:** implementar Drawing IR v2 compartido PDF/DXF; simbología y catálogo; regiones/HATCH, leyenda gráfica autogenerada, referencias D1–D4, tablas técnicas, compositor flexible A1/A2/A3 y paridad gráfica. Preservar trazabilidad y evitar doble medición. No inventar datos constructivos o geotécnicos.

**Entregables:** regresiones negativas, casos túnel y edificación, CI Ubuntu/Windows en mismo SHA, gates 5b/5c + 5d/5e y nuevo ZIP Windows de versión distinta de rc.4, checksum y protocolo sin Claude. **Sin merge, release ni instalación sin permiso del Product Owner.**

## Restricciones de procedencia
Los archivos `04` y `05` son **diagnóstico y diseño propuesto**, respectivamente, NO código aceptado. Los binarios del UAT del usuario y el plano de Tannia no se suben automáticamente al repositorio: pueden contener propiedad de terceros; solicitar los originales al PO cuando sean necesarios. SHA-256 DXF: `dd971a870fe2065757a2d5f251f2d139f913afdaef2dedb70112755747d41005`. El fixture sintético se puede regenerar del código fijado de PR #37.

**Diferenciar aprobación CI de validación humana AutoCAD 2027 y aceptación profesional.** Mantener la revisión de ingeniería independiente del implementador.

Contexto: [PR #33](https://github.com/cristobalMundacaV1/tannia-workspace/pull/33) · [PR #35](https://github.com/cristobalMundacaV1/tannia-workspace/pull/35) · [PR #36](https://github.com/cristobalMundacaV1/tannia-workspace/pull/36) · [PR #37](https://github.com/cristobalMundacaV1/tannia-workspace/pull/37).
