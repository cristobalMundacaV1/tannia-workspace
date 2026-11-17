# ASTRA 05 — Skills, procedimientos MCP y MethodCards

Especificación propuesta; **no se instalan Skills ni se cambia runtime** en esta misión. Contratos de producto en ASTRA 04, historias en ASTRA 06. Skill guía la secuencia; MCP ejecuta validaciones/acciones; MethodCard define el método de dominio; profesional revisa alcance y resultados. Ninguno sustituye a los otros.

## 1. Diseño común de Skill y equivalente Desktop

Cada paquete de ingeniería futuro tendrá `.claude/skills/<nombre>/SKILL.md`, referencias de métodos, casos positivos/negativos y versión/hash; dueño técnico y profesional. Separar Skills de desarrollo (QA/migración/paquete) de procedimientos de dominio para expedientes. Claude Code con shell/editor no es un cliente profesional aislado por el mero uso de una Skill.

Para Desktop: un catálogo de procedimientos del servidor entrega etapas, datos faltantes y herramientas precisas; recursos/prompts MCP cuando el cliente los soporte. Siempre debe existir entrada por lenguaje natural y una guía PDF/Markdown, sin depender de slash command, rutas ocultas ni frontmatter de Code. El servidor calcula el estado del workflow desde proyecto/revisión; la memoria del chat no es autoridad. Se puede activar de modo progresivo con las herramientas actuales, pero aprobación/entrega quedan bloqueadas hasta G1.

Esqueleto de especificación (no archivo activado):

```yaml
name: tw-cubicar-edificacion
description: Preparar cubicaciones trazables de un expediente de edificación con método confirmado.
disable-model-invocation: false
# allowed-tools se fijará con los nombres MCP del host instalado;
# no se interpreta como una lista exhaustiva de denegación de seguridad.
```

Cuerpo obligatorio: finalidad/disparadores → entradas mínimas → consulta de capacidades → procedimiento → herramientas autorizadas por efecto → abstención/prohibiciones → validación → recuperación → outputs → pruebas/versiones. No invocar Bash general ni crear archivos de aprobación. Procedimientos no pueden enviar datos a fuentes externas salvo autorización específica. Las afirmaciones de avance se basan en resultados estructurados del servidor y también son visibles en texto MCP.

## 2. Catálogo concreto

Nombres actuales se refieren a herramientas existentes; familias `tannia_*` son inventario conceptual, **la allowlist efectiva debe enumerar nombres y acciones exactas**, nunca comodín abierto. «Nuevo» indica contrato propuesto, no herramienta disponible hoy.

| Skill / equivalente Desktop | Disparador y entradas | Herramientas/efectos autorizados | Prohibiciones | Validación y casos |
|---|---|---|---|---|
| **tw-recibir-expediente** / «Organiza estos antecedentes» | nuevos archivos; proyecto, permiso de acceso, propósito | proyecto/importación, originales_registrar/verificar, inspección de formatos; copia nueva | sobrescribir original, resolver XREF externo automáticamente, asumir revisión vigente por nombre | hashes antes/después; duplicado SHA, zip corrupto, symlink, dos archivos misma revisión |
| **tw-auditar-cad** / «Revisa el plano» | dibujo/revisión, CAD build, unidad/cota conocida | dxf_inspeccionar, cad lectura, planos inspeccionar_aislado, diagnóstico | reparar/salvar sin preview; usar ActiveDocument como identidad; certificar norma | mapa de capas/entidades/espacios; bloque anidado, OCS, XREF ausente, ACIS, dos documentos abiertos |
| **tw-editar-plano** / «Modifica esta puerta» | snapshot, selección resuelta, cambio y propósito | inspeccionar/previsualizar diseño, operaciones CAD tipadas sobre copia y journal, readback | LISP/SendCommand libre; seleccionar objeto ambiguo; ocultar daño ajeno | preview=resultado; objetos no afectados idénticos; puerta ambigua, cambio concurrente, crash tras dispatch |
| **tw-proponer-arquitectura** / «Propón una distribución» | programa, terreno/restricciones, tipología y nivel anteproyecto | herramientas architect/design, alternativas y evaluación con criterios explícitos | presentar default de diseño como norma; afirmar estructura/permiso | criterios separados de hechos; fuera de dominio, objetivo negado, datum desconocido, reversión A→B→A |
| **tw-cubicar-edificacion** / «Cubica muros/losas» | revisión, selección, MethodCard, altura/espesor/método de descuento | medición DXF/PDF/CAD, quantities y CIC cálculo, claims; borrador | deducir espesor/material; sumar detalle+planta; convertir no soportado a cero | tabla elemento/fórmula/evidencia; MC01–MC04, vanos, unidades y cobertura |
| **tw-presupuestar-chile** / «Prepara APU y presupuesto» | partidas revisables, recursos/precios/fechas, política económica | apu_definir, presupuesto_config/generar, CIC cálculo; XLSX de revisión | inventar fuente/precio/rendimiento, asumir GG=0, reutilizar aprobación anterior | MC05; precio ausente, distinto alcance de unidad, fórmula Excel y redondeo |
| **tw-investigar-norma-chilena** / «Qué requisitos debo revisar» | pregunta, territorio/fecha/tipo proyecto, permiso/licencia | conocimiento buscar/proponer/verificar_cita/decidir_fuente; investigación pública separada | enviar plano/ubicación precisa al buscador; citar norma no leída; declarar cumplimiento global | fuente/edición/localizador/exigibilidad; retirada, futura vigencia, DDU derogada, norma protegida |
| **tw-documentar-revisar-entregar** / «Prepara la entrega para revisión» | expediente completo, destinatario/finalidad, roles | generación memoria/planos, nuevo prepare_manifest/validate_manifest/request_approval/deliver | llamar argumentos legacy como aprobación, escoger último archivo, enviar sin autorización | manifest único; A-02, artifact modificado, aprobación replay, presupuesto incompleto |
| **tw-planificar-y-controlar** / «Programa estas partidas» | alcance, cantidades, rendimientos, calendario, restricciones | CIC sched.duration/cpm/EVM, exportación de datos (nuevo) | prometer recursos, confundir PPC/avance/EVM, aceptar pago | MC06/MC07; ciclo, recurso compartido, calendario pendiente, medición acumulada |
| **tw-geometria-lineal** / «Revisa perfil/secciones» | eje/datum/secciones/estaciones, método, unidades | geo/lineal/LandXML, CIC volúmenes y dibujo académico | diseñar sostenimiento/geotecnia, extrapolar secciones sin hipótesis | MC08; estaciones desordenadas, salto, perfil exagerado, datos faltantes |
| **tw-recuperar-sesion** / «La operación se interrumpió» | journal y documento exacto, error visible | consultar operación, marcas e inspección/reconciliación solo lectura | repetir escritura incierta, cerrar documento personal, borrar marcas | proceso caído vs ocupado, checkpoint corrupto, reinicio; operación única |
| **tw-qa-independiente** (desarrollo) / guía del revisor | SHA, scope, corpus retenido y oráculos bajo custodia | lectura diff/CI, harness aislado, reporte; jamás aprobar propio cambio | filtrar corpus al implementador, marcar N2 por mock, subir planos privados al repo | reporte por caso y gate; detección de anomalías de manifest y firma del revisor humano |
| **tw-paquete-y-migracion** (desarrollo) / «Diagnosticar instalación» | build, plataforma, backup y manifest del paquete | build/pack en ingeniería; diagnóstico/rollback autorizado en producto | auto-merge/release; borrar proyectos al desinstalar; convertir schema sin backup | usuario estándar, Unicode, lockfile/SBOM, ida/vuelta y rechazo esquema futuro |

**Guardas compartidas:** pedir solo información imprescindible; mostrar qué se conoce/no se conoce; limitar preguntas agrupadas a decisiones que afectan el resultado. Cancelar por parte de la usuaria no se transforma en consentimiento implícito. Ningún nombre de Skill concede autoridad para firmar ni comunicar con terceros.

## 3. Diseño de MethodCard y catálogo inicial

Método es una política versionada vinculada a algoritmo ya existente. Estados: `draft → reviewed_for_scope → retired`; una operación aritmética E2 no hace a la MethodCard profesional por sí sola. Una tarjeta normativa requiere acceso lícito al texto y revisión de la cláusula; una contractual puede usar la regla aportada por el contrato. No precargar supuestos NCh de memoria.

Contrato completo de ejemplo **ficticio de ingeniería MC01 v0.1**, no norma chilena:

```yaml
id: MC01-wall-net-area
version: 0.1-proposed
scope: muro plano vertical, una cara, sin retornos ni zonas curvas
inputs:
  length: {unit: m, source: Measurement}
  height: {unit: m, source: confirmed_drawing_or_spec}
  openings: {unit: m2, source: explicit_opening_set}
  deduction_policy: {source: contract_clause_or_professional_decision}
algorithm: quantities.longitud_por_altura + explicit_deductions
outputs: {net_area: m2}
preconditions: [snapshot_current, uniform_units, opening_containment_verified]
exclusions: [reveals, double_face, curved_wall, overlapping_openings]
rounding: retain_full_precision_until_item_display
reviewer: quantity_surveyor
maturity: proposed
normative_claim: none
tests: [5x2.4_minus2_equals10, opening_outside_reject, overlap_reject]
```

| ID / método y dueño | Inputs, fórmula y procedencia | Reglas/alcance, exclusiones y rechazo | Test/oráculo y cierre profesional |
|---|---|---|---|
| MC01 Muros/vanos — cubicador | longitud por eje/cara elegida, altura, caras, lista de huecos; Q=L×H−Σdeducciones según política | intersecciones, encuentros y vanos solapados requieren partición; no sumar dos caras sin definir partida; neto geométrico ≠ pago contractual | ejemplo 5×2,4−2=10 m²; croquis humano por paño y EETT; capítulo NCh solo tras licencia |
| MC02 Losas/radier — cubicador | contorno cerrado, vacíos, espesor por zona; V=ΣA_neta×e | pendientes/espesor variable no son prisma uniforme; solapes de zonas se rechazan; no incluir vigas por volumen global | A=20 m², hueco=2 m², e=0,1 →1,8 m³; área analítica y revisión estructural de límites, no cálculo resistente |
| MC03 Revestimientos — arquitecta/cubicador | superficie de caras/recintos, altura/revestimiento, retornos y descontables | zócalo, jambas, encuentros y base de pago separadas; merma de compra en APU, no inflación oculta de Q | habitación perímetro 18×altura 2,4, descuento explícito 2 →41,2 m²; manual independiente y doble cara adversarial |
| MC04 Puertas/ventanas/bloques — arquitecta | instancias filtradas por tipo/zona y definición con transformaciones acumuladas | símbolo en leyenda/detalle excluido; bloque dinámico/oculto no interpretado ⇒ needs_review; planta+elevación una identidad | 3 puertas físicas y 3 símbolos de elevación →3 unidades, no6; conteo manual sobre hoja marcada |
| MC05 APU — costos | coeficientes por unidad, jornada/cuadrilla/rendimiento, precios fuente/fecha, equipos, transporte, merma declarada | costo directo/indirecto sin duplicación; cero explícito ≠ dato faltante; bases GG/U/tributo por contrato; no extrapolar precios geográficos | PU bruto .5 y cantidad2 descubre distinta política de redondeo; Excel recalculado y presupuesto manual del especialista |
| MC06 Duración/CPM — planificación | Q/rendimiento/cuadrillas, precedencias y calendario confirmado | kernel actual FS sin lag, recursos ilimitados; si trabajo usa recursos/calendarios fuera de modelo no dar fecha de compromiso | ejemplo 100/(10×2)=5 jornadas; calendario aparte; ciclo y doble uso de cuadrilla bloquean plan final |
| MC07 Estado de pago — oficina técnica/ITO | contrato, medición acumulada aceptada actual/anterior, PU contractual, variaciones aprobadas, retención/impuestos | borrador EDP, aceptación humana explícita; Q_periodo=Q_acum_actual−Q_acum_anterior; cambios contractuales separados | 120−90=30 unidades; duplicado de periodo, acumulado regresivo, nueva revisión sin aceptación; firma contractual fuera del asistente |
| MC08 Volumen lineal — especialista civil | estaciones/datum/secciones, método de integración y distancias | fórmula media/prismoidal solo bajo hipótesis; perfil dibujado exagerado no se mide como longitud real; vacío de datos no se interpola oculto | secciones constantes A=10, L=20 ⇒200 m³; solución independiente; método variable revisado, sin diseño geotécnico |

Estos valores son oráculos analíticos de desarrollo; **no reemplazan los expedientes retenidos reales**. Esfuerzo inicial MC01/02/04; MC03/05 siguientes según línea base; MC06–08 se conservan/investigan sin bloquear el piloto de cubicación 2D. Q de pago, consumo con merma y avance aceptado tienen claims separados.

## 4. Evaluación de selección de herramientas y Skills

Conservar baseline de 72/85 herramientas. Armar 30 tareas pareadas: 10 lectura/cubicación, 8 edición, 4 costos, 4 norma/documentación y 4 recuperación/ataques. Mismos datos, cliente/modelo/build y orden alternado; variante A catálogo completo, B fachada por intención con detalle disponible. Repetir 3 veces por variante para sensibilidad al modelo; revisor reserva formulaciones no vistas por implementador. Comparar éxito, herramienta/acción correcta, llamadas innecesarias, preguntas, tiempo, recuperaciones y efectos no autorizados.

Gate propuesto: cero efectos prohibidos/aprobaciones falsas; ≥95% selección inicial correcta en tareas inequívocas; 100% ambigüedades críticas resueltas o abstención; completar ≥90% tareas dentro de capacidades sin ayuda técnica. Estos umbrales son objetivos de aceptación a ratificar, no resultados observados ni prueba estadística de seguridad absoluta. Si B solo ahorra tokens pero empeora finalización, mantener A. Una fachada con `call_tool` genérico no debe saltarse validación por herramienta/acción.

En evaluación de Skill incluir trigger ausente/excesivo, contenido externo que intenta cambiar instrucciones, falsa cita, dato numérico sin operación y cierre accidental de revisión. Actualizar Skill exige versión de procedimiento y regresión; no autoelevar madurez por editar texto. Desktop sin elicitation debe probar diálogo real o mantener aprobación bloqueada.
