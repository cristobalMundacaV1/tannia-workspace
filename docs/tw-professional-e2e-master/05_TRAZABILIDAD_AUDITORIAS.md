# 05 — Trazabilidad de auditorías y plan de cierre

**Propósito:** evitar perder hallazgos y volver a descubrir defectos al integrar módulos. Esta es una **matriz de traducción** de informes anteriores a la macrofase, **no una afirmación de que todos los hallazgos sigan abiertos**. El implementador debe verificar el estado **del SHA vigente** antes de cambiar código. Conservar historia, fechas y evidencia.

## 1. Auditoría independiente Astra

| Hallazgo fuente | Problema demostrado o pendiente según auditoría | Gate destino | Evidencia de cierre |
|---|---|---|---|
| Astra A-01 / TW-PRO-01 | aprobación de partida/proyecto manipulable por parámetros MCP (P0) | G01/G09/G11 | token/receipt de canal humano fuera del modelo, adversarial sin posibilidad de suplantación |
| Astra A-02 | exportación de XLSX/PDF viejo tras cambiar precio/datos (P0) | G02/G07/G09 | una revisión/manifiesto/hash y cambio invalida artefactos/aprobación |
| Astra A-03 | comparador de fidelidad pierde topología/capa aunque conserve vértices (P1) | G05/G10 | invariantes geométricos con orden/bulge/OCS/capa/XDATA y readback real |
| Astra A-04 / TW-PRO-05 | GG/utilidad/IVA implícitos en ruta legacy; CIC exige explicitud (P1) | G07 | política económica única; null ≠ 0; Excel y motor equivalentes |
| Astra A-05 / TW-PRO-02 | DXF→DWG real con AutoCAD no acreditado en el flujo actual; historial de apertura fallida | G05/G10/G11 | documento aislado, Import/DxfIn según PoC, guardar/cerrar/reabrir, comparar y plot |
| Astra A-06 / TW-PRO-09 | fuentes documentales y estados de capacidades contradictorios | G00/G12 | registro vivo por SHA, operación y entorno con N0–N3 y fecha |
| Astra A-07 / TW-PRO-08/10 | adopción y selección de herramientas/procedimientos sin UAT retenida | G04/G10/G11 | medición con tareas reales, habilidades versionadas, interfaz sin jerga |

## 2. Auditoría profesional TW-PRO

| Hallazgo | Gate destino | Criterio mínimo |
|---|---|---|
| TW-PRO-03 métodos normativos ausentes | G06/G08 | MethodCards por especialidad y revisión competente |
| TW-PRO-04 dos rutas de cifras | G02/G06/G07 | una autoridad, compatibilidad, migración y A→B→A |
| TW-PRO-06 compositor acoplado a túnel | G05/G08 | modelo genérico y dos perfiles con mismos motores |
| TW-PRO-07 controlador COM monolítico | G05 | contratos operativos y pruebas de error/timeout |
| TW-PRO-11 falta de casos externos y profesional | G11/G12 | N2/N3 retenidos, no solo pruebas CI |
| TW-PRO-12 privacidad/distribución | G01/G03/G10 | consentimiento, permisos, licencias y rollback |

## 3. Incidentes UAT y PR de planos (posteriores a auditoría base)

| Registro | Evidencia conocida | Lo que falta verificar en el SHA final |
|---|---|---|
| Issue #31 | un adjunto ZIP de Claude Desktop no se importaba automáticamente; herramienta pedía rutas individuales y \`.zip\` no era formato del importador | G03: puente/fallback de una ruta, ZIP/RAR reales, pruebas adversariales |
| Issue #32 / PR #33 G0 | \`TANNIA_ENGINEERING\` apagado ocultaba \`tannia_planos\` en RC2 previo; verificador Windows 5b posterior generó cinco láminas desde paquete instalado | G00/G10: build final catalogado, versión nueva, misma configuración de usuario |
| PR #33 G1 | DXF writer/verifier: CIRCLE nativo, trazos, XDATA, anclajes, rechazo arcos exagerados; tests de mutación | G05: AutoCAD real, layouts, styles, plot y perfil profesional completo |
| PR #33 G3 | \`tw.cantidades/1\`, identidad física y descuentos; se añadieron R-01/R-02 tras revisión; alternativas de túnel no completamente unificadas | G06/G07: consumo por partidas/APU real, garantías por elemento, revisión A→B→A |
| UAT-02 R2 | importación de fuentes protegida reportada; sin planos/DWG en RC anterior; dibujo ajeno preservado; datos de altura faltantes | G03/G05/G08/G11: rerun del MISMO expediente con nuevo candidato y oráculos |
| Visuales de túnel PO | ocho imágenes de referencia: cuadros, geometría, corona, hastial, perno–malla–shotcrete, traslapo y simbología | G08: calidad visual y estructural de plano; contenido académico no implica diseño aprobado |

**Nota de conservación:** PR #33 puede seguir evolucionando. Una prueba Windows gate 5b verde sobre un commit anterior no es prueba del último commit; consultar CI y artefacto exactos antes de decidir.

## 4. Conservación de activos existentes

Los siguientes componentes deben auditarse para **reutilización**, no reemplazo automático:

| Módulo | Activo existente | Advertencia |
|---|---|---|
| \`src/project\` | sandbox, originales, SHA, historial y transacciones | comprobar contra enlaces/rutas y acceso de ZIP/RAR |
| \`src/dxf\` / \`src/geo\` | lectores y operaciones de geometría | límites DXF OCS/ACIS/XREF y fuentes |
| \`src/drawing\` | modelo de vistas, PDFs, DXF, layouts, verificación | calidad profesional de varias disciplinas aún parcial |
| \`src/cad\` | adaptador COM, operaciones, diagnóstico y recuperación | CAD real y comparación semántica final necesarios |
| \`src/quantities\` / CIC | medición, métodos parciales, claims y decisiones | identificar una sola autoridad |
| \`src/budget\` | APU, Excel, cálculo y memoria | reglas económicas explícitas e invalidación |
| \`src/design\` / \`src/arq3d\` | vivienda/anteproyecto y cambios | no presentar como diseño de permiso/estructura |
| \`src/procedimientos\` / tools | interacción MCP y skills | seleccionar por objetivo, no exponer complejidad a usuaria |

## 5. Registro del implementador (formato obligatorio)

Por historia/gate:

\`{id, sha_base, sha_nuevo, PR, estado, evidencia_previa, prueba_negativa_sha, prueba_corregida_sha, entorno, ci_url, artefacto_sha, inputs_sha[], outputs_sha[], limitacion, revisión_externa, decisión_PO}\`.

Estados exactos: \`NO INICIADO | EN CURSO | IMPLEMENTADO | PROBADO AUTOMÁTICAMENTE | PROBADO EN WINDOWS/CLAUDE REAL | PROBADO EN AUTOCAD REAL | VALIDADO PROFESIONALMENTE | BLOQUEADO | NO APLICA\`.

El estatus \`PROBADO AUTOMÁTICAMENTE\` no significa \`VALIDADO PROFESIONALMENTE\`. Lo no inspeccionado se declara desconocido, no correcto ni defectuoso.

## 6. Handoff y autonomía

Claude Code Opus 5.5 recibirá [04_PROMPT_CLAUDE_CODE_OPUS_5_5.md](04_PROMPT_CLAUDE_CODE_OPUS_5_5.md), leerá todos los documentos de esta macrofase, recuperará sus SHA reales y propondrá ejecución por paquetes acotados sin interrumpir ramas ajenas. Astra audita gates concluidos y protege los casos retenidos. Product Owner autoriza los actos reservados.

Esta macrofase **amplía** las auditorías, no borra sus expedientes ni revoca decisiones de alcance. **Fuera de alcance sin aprobación separada:** BIM/IFC y anuncio de soporte ilimitado para todas las especialidades de construcción.

## 7. Referencias

- [PR #24: Astra independiente](https://github.com/cristobalMundacaV1/tannia-workspace/pull/24)
- [PR #22: arquitectura profesional](https://github.com/cristobalMundacaV1/tannia-workspace/pull/22)
- [Issue #23: mandato Astra](https://github.com/cristobalMundacaV1/tannia-workspace/issues/23)
- [PR #29](https://github.com/cristobalMundacaV1/tannia-workspace/pull/29), [#30](https://github.com/cristobalMundacaV1/tannia-workspace/pull/30), [#33](https://github.com/cristobalMundacaV1/tannia-workspace/pull/33)
- [Issue #31 ZIP](https://github.com/cristobalMundacaV1/tannia-workspace/issues/31), [issue #32 motor de planos](https://github.com/cristobalMundacaV1/tannia-workspace/issues/32)
- \`docs/astra/\` de rama \`docs/astra-independent-master-design\`
- \`docs/professional/\` de rama \`docs/tw-professional-architecture-audit-2026-11-17\`
