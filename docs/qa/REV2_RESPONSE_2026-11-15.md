# Segunda auditoría PR #2 — Resolución de observaciones de diseño

**Fuente:** dictamen del auditor aportado por el Product Owner sobre commit `2d2b7a9123cb`. Calificación: **APROBADO CON OBSERVACIONES** para documentos; **sin pruebas funcionales verificadas**.

> Este archivo documenta decisiones. No cierra pruebas ni valida ejecución real.

| Observación P2 | Resolución adoptada | Evidencia pendiente |
|---|---|---|
| REV2-01 Instalación mínima de TW-00A | Incorporar paquete provisional reproducible `.mcpb` (si viable), dependencias fijas, diagnóstico, instalación y reversión; no confundirlo con TW-05 definitivo | Instalación real y conexión Claude Desktop en Windows |
| REV2-02 Piloto 2D antes de 3D | Separar **TW-07A** (piloto 2D tras TW-06) de **TW-07B** (piloto 3D final). Si falta acceso a Tannia/AutoCAD, continuar trabajo técnico y mantener el piloto pendiente. | Validación de Tannia con sus archivos |
| REV2-03 Matriz CAD por entidad | Añadir matriz por tipo de entidad × operación × estado `SUPPORTED/UNSUPPORTED/UNVERIFIED`, versión y evidencia en TW-06/TW-06A. No asumir soporte en MCP de terceros. | Pruebas reales por versión AutoCAD |

## Directiva del PO interpretada del contexto
El objetivo es completar **toda la ingeniería técnicamente verificable con los recursos disponibles**, sin usar la falta de AutoCAD del desarrollador como razón para paralizar el desarrollo. Un **release candidate** con limitaciones honestas puede estar listo para ser enviado al PC de Tannia. El trabajo no puede etiquetarse **validado en AutoCAD real** ni **aceptado por Tannia** sin esas pruebas.

## Gobernanza
- PR #2: candidato a aprobación documental según dictamen externo; **merge no autorizado implícitamente por la auditoría**. Solo el PO puede decidirlo.
- Claude Code puede implementar fases y corregir pruebas en ramas con PR.
- Auditor externo: revisor de seguridad, funcionalidad y experiencia; no sustituye datos reales.
