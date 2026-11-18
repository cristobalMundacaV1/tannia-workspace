# Tannia Workspace — Macrofase maestra de ejecución profesional de extremo a extremo

**Estado:** contrato documental de implementación, **NO** aceptación profesional, release ni autorización de merge.  
**Destinatario:** Claude Code Opus 5.5 — ingeniero implementador. **Revisor:** Astra, independiente del implementador. **Autoridad final:** Product Owner y profesional competente en su disciplina.  
**Repositorio:** \`cristobalMundacaV1/tannia-workspace\`. **Fecha de corte de esta planificación:** 17–18 de noviembre de 2026.  
**Principio rector:** la unidad de producto es el **encargo completo de obra**, no la lista de herramientas.

## 1. Definición de éxito

La usuaria dice «Aquí están los antecedentes de esta obra; prepara planos, cubicaciones, presupuesto, memoria y carpeta de entrega». Tannia Workspace:

1. Recibe un archivo, carpeta o ZIP/RAR autorizados, conserva originales, inventaría, identifica versiones y distingue datos legibles de ausentes.
2. Entiende el objetivo y los requisitos aplicables; determina lo que puede hacer sin inventar dimensiones, materiales, métodos, normas, precios ni permisos.
3. Agrupa **una sola ronda inicial de preguntas indispensables** con opciones inteligibles; no repite datos existentes; avanza en tareas independientes.
4. Genera **planos técnicamente editables**, con cuadros, cotas, escalas, simbología, detalles y presentación apropiados a la especialidad y a los antecedentes.
5. Obtiene **mediciones deterministas** con unidades, fuentes y método; los resultados de múltiples vistas no duplican un mismo elemento.
6. Conecta cantidades → partidas → APU → presupuesto y produce Excel, memoria, EETT e informes **de una única revisión**.
7. Solicita autorización humana **solo donde corresponde**, explica qué hará, por qué, qué cambia, qué queda intacto y qué pasa si se rechaza.
8. Produce una **entrega verificable, coherente y localizable**; puede revisar cambios A→B→A y recuperarse de errores sin corrupción ni duplicación.
9. Reconoce límites reales: una maqueta académica no es un diseño de fortificación aprobado; CI Windows no prueba AutoCAD 2027, y un nombre ingresado por Claude no constituye firma humana.

La usuaria no necesita terminal, rutas individuales de 20 PDFs, variables de entorno, IDs técnicos, JSON ni elegir qué servidor tiene el motor.

## 2. Documentos ejecutables de esta macrofase

| Documento | Finalidad |
|---|---|
| [01 — Roadmap de implementación y gates](01_MACROFASE_EJECUCION_Y_GATES.md) | Secuencia, dependencias, historias y restricciones de ejecución |
| [02 — Contratos integrados](02_CONTRATOS_TRANSVERSALES.md) | Autoridad única de datos; expediente, aprobación, CAD, medidas y documentos |
| [03 — UAT integral y oráculos](03_UAT_INTEGRAL_Y_METRICAS.md) | Escenarios y criterios verificables de principio a fin |
| [04 — Prompt para Claude Code Opus 5.5](04_PROMPT_CLAUDE_CODE_OPUS_5_5.md) | Orden inmediata de ejecución, autonomía y gobernanza |
| [05 — Matriz de trazabilidad de auditoría](05_TRAZABILIDAD_AUDITORIAS.md) | Qué hallazgo motiva cada gate, fuentes y evidencia pendiente |

**Orden:** leer este README y el prompt; recuperar estado de ramas; aplicar primero gates de integridad/seguridad y flujo completo; especialidades y refinamiento posterior por dependencia.

## 3. Fuentes: evidencia vs planificación

Esta macrofase es una **consolidación propia**, no los bytes recuperados de la carpeta temporal \`/workspace/work/audit-deliverables\` que quedó sin publicar. Se fundamenta en:

- Astra, [auditoría independiente](https://github.com/cristobalMundacaV1/tannia-workspace/blob/docs/astra-independent-master-design/docs/astra/ASTRA_01_INDEPENDENT_BASELINE_AND_AUDIT.md) y [roadmap E01–E30](https://github.com/cristobalMundacaV1/tannia-workspace/blob/docs/astra-independent-master-design/docs/astra/ASTRA_06_FINAL_MASTER_ROADMAP_AND_GATES.md); baseline observado en PR #21 y hallazgos A-01…A-07.
- [Auditoría profesional TW-PRO-01…12](https://github.com/cristobalMundacaV1/tannia-workspace/blob/docs/tw-professional-architecture-audit-2026-11-17/docs/professional/TW_PROFESSIONAL_AUDIT_2026-11-17.md) y [gates PRO-G0…G9](https://github.com/cristobalMundacaV1/tannia-workspace/blob/docs/tw-professional-architecture-audit-2026-11-17/docs/professional/TW_PROFESSIONAL_ROADMAP_GATES_V1.md).
- [Expediente UAT-02 R2](https://github.com/cristobalMundacaV1/tannia-workspace/blob/claude/sharp-gates-r4rbu5/docs/auditoria-integral-2026-11-17/README.md), [motor de planos PR #33](https://github.com/cristobalMundacaV1/tannia-workspace/pull/33), [issue ZIP #31](https://github.com/cristobalMundacaV1/tannia-workspace/issues/31), [issue planos #32](https://github.com/cristobalMundacaV1/tannia-workspace/issues/32).
- Referencias visuales proporcionadas por el PO: ocho capturas de plano de túnel en el paquete \`ASTRA_Tannia_Auditoria_Integral_Referencias.zip\`. **No** constituyen validación del contenido estructural/geotécnico.

**Estado histórico importante:** \`main\` contiene documentación inicial y el desarrollo está distribuido en PRs apilados. No usar este PR documental como base del código funcional sin recuperar y acordar antes el SHA real. El PR #33 sigue siendo trabajo de ingeniería separado y puede cambiar. Toda cifra de pruebas/status debe actualizarse al SHA real que se ejecute.

## 4. Reglas de promoción

- **N0:** planeado / no implementado.
- **N1:** código y pruebas deterministas/CI.
- **N2:** probado en el paquete instalado, Claude Desktop y AutoCAD reales cuando se promete esa capacidad.
- **N3:** evaluado con casos retenidos, por especialista externo y usuaria final.

Una evidencia N1 no se reporta como N2/N3. El ingeniero no se autoaprueba. Sin N2 de una operación CAD, se entrega DXF/PDF como borrador si su ámbito lo permite, **nunca DWG con fidelidad verificada**. Sin autorización externa, el sistema no afirma que un plano esté aprobado ni apto para construcción.

## 5. Gobernanza y no duplicación

Claude Code **implementa** en su propia rama y PRs borrador; Astra **audita** cuando el implementador entrega un SHA explícito y gates cerrados; PO acepta o rechaza, decide merges/releases. Recuperar primero AGENTS.md, CLAUDE.md, estructura de PRs y contratos; no reimplementar \`src/project/\`, \`src/cic/\`, \`src/quantities/\`, \`src/budget/\`, \`src/drawing/\`, \`src/cad/\`, \`src/design/\` ni motores documentales si hay capacidades reutilizables. Mantener sin BIM/IFC en esta macrofase, salvo autorización separada.

**Definition of Done de la macrofase:** flujo continuo demostrado con el **mismo expediente y misma revisión**, pruebas adversariales, auditoría independiente, UAT Windows/AutoCAD real cuando corresponda y aceptación humana explícita. El código y el roadmap por sí solos nunca bastan.
