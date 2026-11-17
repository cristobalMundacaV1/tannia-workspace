# Tannia Workspace — Arquitectura profesional consolidada v1

**Fecha:** 2026-11-17. **Estado:** propuesta técnica sometida a revisión del Product Owner y de profesionales competentes; NO implementación aprobada ni aceptación de producto. **Base:** PR #21 @ 2f4cdd07, apilado sobre #20/#19. **Ámbito:** AutoCAD 2D y 3D geométrico, cubicaciones y APU, documentación, consulta de normativa chilena. **Fuera de alcance actual:** BIM/IFC, diseño estructural certificado, proyectos de permisos y conformidad normativa automática.

## 1. Misión de producto y nivel de autonomía

Ayudar a una profesional a **transformar antecedentes reales en trabajo técnico revisable**, disminuyendo operaciones repetitivas sin perder trazabilidad ni su autoridad. El éxito no se mide en número de herramientas ni calidad de la conversación, sino en (a) reducción verificable de tiempo, (b) corrección reproducible, (c) conservación de originales, (d) claridad de incertidumbres, (e) entregables editables y coherentes, y (f) utilidad sin consola.

Tannia es el sujeto que encarga y revisa. Claude interpreta, propone, coordina y explica. El backend valida unidades, geometrías, datos, método, permisos y evidencia; **los números técnicos salen de operaciones ejecutadas**, nunca de la generación libre del modelo. Los profesionales competentes deciden aceptación, firma y responsabilidad dentro de su disciplina.

**Modos:** consulta; borrador reversible; ejecución con autorización; entrega para revisión; entrega aprobada por humano. Un modo académico puede ofrecer ejemplos didácticos E1, pero no se convierte en modo profesional cambiando una etiqueta. Se conserva la política epistémica TW-11 E0–E3 / N0–N3 con significados independientes:
- N0: diseñado/documentado; N1: probado con simulador, fixtures y CI; N2: demostrado en AutoCAD/Desktop reales; N3: revisión por profesional competente con evidencia.
- E0: operación propuesta; E1: didáctica; E2: método determinista probado y con hipótesis; E3: aceptado para un ámbito profesional acotado y documentado. Un N2 no implica E3, y E2 no implica N3.

## 2. Arquitectura canónica y responsabilidades

```text
Tannia → Claude Desktop (lenguaje natural, vista de aprobaciones humanas)
         │
         └── Extensión MCP local de Tannia Workspace (.mcpb)
                 ├─ Fachada de encargos/intenciones y catálogo de capacidades
                 ├─ Motor de políticas y aprobaciones FUERA del control de Claude
                 ├─ Registro de proyectos / revisiones / originales / transacciones
                 ├─ Construction Intelligence Core (CIC)
                 │   ├─ Interpretation + Planner DAG + Executor + Verifier
                 │   ├─ Evidence/Knowledge Registry + citas/edición/vigencia/licencias
                 │   ├─ Claims/Quantity Ledger + reglas/métodos versionados
                 │   └─ Document/Delivery Ledger + invalidación de dependencias
                 ├─ Motores deterministas
                 │   ├─ Geometría DXF/PDF, unidades, tolerancias y topología
                 │   ├─ CADAdapter: COM hoy; .NET solo si gate de investigación lo justifica
                 │   ├─ Cubicación profesional: MethodCard + partidas + descuentos
                 │   ├─ APU/presupuestos, programación y control de costos
                 │   └─ DrawingModel/Sheet Composer/QA de impresión
                 └─ Almacenamiento local, versiones, hashes y auditoría
```

La interfaz de usuario es **Claude Desktop**; las Skills de Claude Code sirven al proceso de ingeniería, no se presumen ejecutables automáticamente en Desktop. Los procedimientos de usuario se transmiten mediante instrucciones de servidor, catálogo de flujos y capacidades del cliente, sin depender de que un archivo .claude/skills sea leído por Claude Desktop.

### 2.1 La autoridad se coloca donde se puede verificar

| Autoridad | Puede | No puede |
|---|---|---|
| Claude | Entender encargos, proponer interpretación, pedir aclaraciones, explicar alternativas, solicitar herramientas | Declarar resultado técnico sin operación, aprobar en nombre de una persona, desbloquear políticas |
| MCP / policy engine | Validar esquemas, rutas, permisos, tipos, dependencias y evidencia; detener operaciones | Conceder responsabilidad profesional o confirmar la verdad de un documento por su hash |
| Núcleo determinista | Medir, calcular, transformar, validar geometría, recomputar | Suponer dimensiones, precios, propiedades de material o obligatoriedad normativa |
| Profesional humano | Confirmar supuestos, reglas y revisiones; aprobar artefactos y su uso | Convertir automáticamente en válidas otras revisiones que no ha evaluado |

Toda etiqueta propuesta por Claude puede agregar riesgos o restricciones, **nunca rebajar** el riesgo mínimo impuesto por el backend.

### 2.2 Herramientas MCP orientadas a intenciones

Mantener retrocompatibilidad de las 72 herramientas de TW-10 y el flag del CIC, pero preferir una fachada pequeña de encargos: iniciar/continuar encargo, inspeccionar antecedentes, planificar, previsualizar, ejecutar operación autorizada, revisar resultados, preparar entregables y consultar estado. No borrar, renombrar ni ocultar de golpe herramientas preexistentes; introducir adapters y gates de selección medidos. La clasificación de disciplina es **informativa**, no impide usar una capacidad transversal. Para proyectos complejos, las herramientas finas siguen disponibles bajo registro con esquemas y autorización.

## 3. Modelo de datos profesional único (versionado y comprobable)

Todos los contratos usan identificador estable, schema-version, project_id, revision_id, actor/source y reloj, hash de contenido cuando sea aplicable, unidad/tolerancia, estado de revisión, procedencia y lista de dependencias.

| Entidad | Campos innegociables | Propósito |
|---|---|---|
| Project | id, nombre, carpeta autorizada, responsables, disciplina, estado | Aislamiento y permisos |
| DocumentRevision | id, proyecto, archivo, formato, sha256, revision, origen, fecha, estado | Nunca confundir original, copia y revisión |
| CADObject | document_revision, handle/identifier, backend, espacio, capa, tipo, geometría, unidades, transformaciones | Referencia verificable, incluso bloques anidados |
| Measurement | id, CADObject refs o página+calibración, magnitud, valor, unidad, tolerancia, método, estado | Separa medida geométrica de partida |
| ConstructionItem | código, descripción, especificación, unidad de pago, clasificación, reglas aprobadas | Identidad estable de partida |
| MethodCard | id, version, ámbito, regla/algoritmo, inputs, exclusiones, descuentos, referencia técnica, restricciones, tests | Método profesional auditable; sin copiar normas licenciadas |
| Claim | resultado/dato/supuesto, valor, unidad, hashes, dependencias, fuente, madurez, requiere_revision | Afirmación reproducible e invalidable |
| BudgetLine/APU | item+claim, recursos, rendimientos, precio/fuente/fecha, bases GG/utilidad/IVA, moneda | Presupuesto derivado, no texto inventado |
| DrawingDocument | model_revision, sheets, views, annotations, dimensions, print_profile, hashes | Modelo universal de láminas |
| Approval | actor humano, canal independiente, acción, document_sha, revision, contexto, fecha, expiración | Aprobación acotada al artefacto concreto |
| DeliveryManifest | archivos y sha256, source_revision, claims, approvals, advertencias, estado | Handoff íntegro e históricamente verificable |

**Línea de procedencia:** Archivo original → objeto geométrico → medición → clasificación de partida → método de cubicación → claim → APU/presupuesto/lamina → revisión/aprobación → manifiesto. Si cambia cualquier antecedente, invalida en cascada los derivados y bloquea estados finales; no invalida por mera redacción sin cambio de significado técnico, siempre que el verificador pueda demostrar la equivalencia.

**Versionado:** nunca editar un original ni sobrescribir una revisión; hash y auditoría en transacción. Si una conversión DXF↔DWG pierde entidades/espacios/dimensiones/escala, marcar parcial/no verificable y no producir un «DWG validado».

## 4. Flujo profesional end-to-end

1. **Recepción**: proyecto, objetivos, destinatario, nivel de revisión, DWG/DXF/PDF/EETT, edición y versión; licencias y sensibilidad; crear inventario de archivos y manifest.
2. **Diagnóstico geométrico**: unidades reales corroboradas, escala, referencia de cotas, XREF, capas, bloques, geometría abierta/duplicada, sistemas de coordenadas, modelos/papel y disponibilidad de métodos.
3. **Interpretación**: Claude propone hechos, solicitudes, supuestos y preguntas mínimas. El servidor valida citas, unidades y capacidades; no usa etiquetas de disciplina como puerta.
4. **Plan**: DAG de medidas, clasificación, cálculos, presupuesto, documentación y revisiones; exposición explícita de ausencias, riesgo y método.
5. **Ejecución**: cálculos deterministas, copias reversibles, progreso, registro de operación e idempotencia; ninguna escritura incierta se reintenta a ciegas.
6. **Verificación**: geometría con oráculos, suma por partidas, descuentos, coherencia entre planos, láminas, claims, presupuesto y memoria; calidad legible del PDF; advertencias bloqueantes tipadas.
7. **Aprobación**: mostrar diff y evidencia al humano; confirmación fuera del control del modelo, vinculada al SHA; posibilidad de rechazar y solicitar cambios.
8. **Entrega**: archivos DWG/DXF (solo si validados), XLSX editable con fórmulas, PDF, memoria y manifiesto. Un resultado académico o de anteproyecto nunca se rotula «apto para construir».

### 4.1 Operación CAD: frontera estricta

Contrato estable CADAdapter = detectar/capacidades, enumerar_documentos, leer, inspeccionar, abrir_copia, previsualizar_cambio, aplicar_cambio_autorizado, guardar, cerrar/reabrir, verificar_persistencia, exportar, reconciliar. Cada operación devuelve soporte por entidad, backend, versión AutoCAD, evidencia y estado (SUPPORTED/UNVERIFIED/UNSUPPORTED).

COM-PowerShell es el backend actual, sometido a límites de una sola sesión, ruta/documento exacto, preflight modal, timeout y no reintento de escrituras. Separar transporte, sesión, documento y fidelidad en módulos probables. El flujo Documents.Add + Import(DXF) del PR #21 es **experimental**; demostrar si retiene layouts, cotas y XDATA. Si falla, investigar el uso de Database.DxfIn en un plugin .NET, con aislamiento y los mismos gates; un cambio de tecnología NO sustituye pruebas reales.

### 4.2 Motor universal de planos

Desacoplar el modelado geométrico del dibujo de presentación. Contrato DrawingDocument → Sheet → View (planta, corte, elevación, detalle, perfil, sección) → Annotation/Dimension/Revision/PrintProfile. Cada especialización produce geometría y reglas de representación, **no otro compositor ni otro exportador**. Validación: escala física, región visible, cotas asociadas a geometría, composición, legibilidad, layers, fonts, viewports, fidelidad DXF↔DWG↔PDF y revisión técnica. Caso de prueba mínimo: **vivienda** y **túnel académico** usando el mismo motor; si la arquitectura solo soporta túnel, no declararla universal.

## 5. Método de cubicación y costos para Chile

**Regla:** medida geométrica != cubicación contractual != consumo con mermas != precio presupuestario.

- Medida: geometría, unidad, escala, inclusiones/exclusiones y error conocido.
- Cubicación: selección de partida, regla de medición, deducciones por vanos, solapes, neto/bruto, umbral, límites y norma/contrato.
- APU: cantidades por unidad de partida, rendimiento, cuadrilla, equipo, desperdicios, merma, fuente de precio, fecha, moneda y supuestos.
- Presupuesto: costo directo, GG/utilidad explícitos, régimen tributario/IVA confirmado, subtotal y total, fecha y revisión.
- Normativa: LGUC/OGUC, NCh353:2018, NCh1156:2018 y normas de especialidad **según exigibilidad documentada**. Registrar edición, versión, artículo/cláusula licenciada, instrumento que la hace exigible, contrato de obra y vigencia territorial/temporal. Ninguna NCh se trata por defecto como obligatoria universal.
- Las MethodCards se autorizarán con revisión de especialista en cubicaciones/inspector competente y ejemplos de cálculos independientes; si falta la licencia del texto normativo, mantener referencia bibliográfica y casos derivados lícitos, no incorporar reproducción íntegra.

**Contraste obligatorio:** al menos una cuantificación real de cada familia de partidas debe compararse con cómputo humano independiente; pruebas con geometría conflictiva, vanos, unidades mezcladas, referencias externas, planos de distintas revisiones y partidas duplicadas.

## 6. Conocimiento, normativa y evidencia

Preservar src/cic/conocimiento: fuentes candidatas vs aprobadas, contenido extraído vs verificado, cita validada contra pasaje, índices locales y control de vigencia/licencia. src/normativa/index.js es actualmente **orientador de portales**, no un motor normativo. Un nuevo servicio de consultas (opcional y consentido) debe:
- Recuperar **documento oficial identificado** con versión y fecha, y cache/huella; origen externo es candidato hasta aprobación humana.
- Resolver si texto aplicable es ley/reglamento/norma contractual/guía/recomendación y el alcance por comuna, uso, especialidad y fecha.
- Mostrar contradicción de fuentes sin desempate silencioso, y derivar a profesional cuando la interpretación sea jurídica o de seguridad.
- Rechazar la frase «cumple la OGUC» si falta prueba específica y validación de profesional; permitir «observaciones preliminares con referencias».
- Respetar licencias INN y privacidad de planos, EETT y contratos de clientes. El MCP local **no significa IA sin red**: Claude puede transmitir fragmentos; usar minimización y consentimiento para datos sensibles.

## 7. Seguridad y aprobación fuera del modelo

Un consentimiento de herramienta no es una firma técnica. Antes de pasar a aprobado, la aplicación debe mostrar nombre de proyecto, revisión, archivos, sha256, cambios, resultados y advertencias, y solicitar autorización **en un canal no controlable por Claude**. Debe ser de rechazo predeterminado, de un uso, con expiración, actor y acción. El backend debe verificar el hash al ejecutar. Falla cerrado si el cliente no soporta elicitación ni existe diálogo OS confiable. Evitar cualquier canal de archivo legible/escribible por otros MCP; documentar el límite del fallback fuera de banda.

Usar permisos mínimos de lectura/escritura, sandbox canónico, restricciones NTFS, no enlaces/junctions fuera de proyecto, registros redactados, políticas de borrado y conservación, soporte de recuperación post fallo, y auditoría de dependencias/licencias por release. No ejecutar scripts, fragmentos normativos o instrucciones dentro de DXF/PDF como comandos.

## 8. Capacidades y Skills profesionales

**Distinguir tres objetos:**
1. **MCP tools:** hacen acciones, con schema/validación/backend.
2. **Especializaciones CIC:** procedimientos y métodos declarativos de dominio, independientes del LLM.
3. **Skills Claude Code:** guías para que el implementador/revisor use herramientas y orqueste la construcción del software; no son prueba de competencia profesional ni se asumen cargadas en Claude Desktop.

Propongo Skills versionadas, con SKILL.md, referencias, casos de aceptación y restricciones:
- cad-drawing-audit: intake DWG/DXF, XREF, escala, unidades, topología, defectos, matriz de capacidad.
- architectural-drafting-and-review: plantas/cortes/elevaciones/partidos, alternativas con límites, calidad de anotación y entregables.
- construction-quantity-surveying-chile: familias de partidas, método, descuentos, NCh353 de forma autorizada, evidencias.
- construction-cost-estimating-chile: APU, rendimientos, precios, impuestos y control de versiones.
- chilean-regulatory-research: LGUC/OGUC, NCh y fuentes locales, obligatoriedad, vigencia/cita.
- construction-document-control: original/copia/revisión, EETT, expediente, firmas y handoff.
- civil-linear-works: infraestructura vial/túneles desde métodos de cálculo acotados, jamás geotecnia o sostenimiento autónomo.
- engineering-qa-review: casos adversariales, validación independiente, regresión CAD, cierre de gates.
- desktop-ux-and-support: lenguaje sencillo, aprobación humana, recuperación sin consola.

Cada Skill debe explicitar **cuándo se usa, herramientas permitidas, datos mínimos, estados permitidos, método de verificación, modos de falla y límites de responsabilidad**. La política crítica no vive solo en la Skill: se impone mediante código, permisos y gate.

No es necesario crear un sistema multiagente paralelo de producto ahora. La coordinación interna puede usar un agente implementador y un revisor independiente; solo incorporar agentes separados por disciplina cuando los resultados y permisos aporten valor medido.

## 9. Migración sin destruir el trabajo

- Mantener main intacta hasta decisión PO y PR apilados; no hacer merge ni release por esta propuesta.
- Congelar contrato de herramientas TW-10 (72) y pruebas actuales; preservar TANNIA_CIC off por defecto hasta gate externo.
- Introducir una única vista canónica de fuentes/medidas/claims para rutas legacy y CIC; adaptadores traducen, tests de equivalencia con A→B→A.
- Priorizar la aprobación humana vinculada a artefacto y la interoperabilidad CAD; son bloqueantes antes de promover funciones de dominio.
- Refactor incremental de COM y motor universal de láminas con pruebas de frontera; no reescritura total.
- Sustituir docs preliminares con referencias al documento canónico **solo después de aprobación del PO**, preservando matriz de cambios/ADRs.
- Crear Skills después de fijar contratos; cada Skill debe incluir test de que sus afirmaciones no inventan hechos.
- Publicar un RC bajo feature flags y matrices de compatibilidad/limitaciones explícitas; validar 2D primero, 3D después y funcionalidades especiales por separado.

## 10. Decisiones para el PO y revisión profesional

**PO-D1**: ratificar enfoque «asistente técnico de trabajo profesional, no firmante ni certificador».  
**PO-D2**: priorizar edificación/arquitectura y cubicación chilena para el primer piloto; túnel y vialidad como competencias especializadas acotadas.  
**PO-D3**: decidir política de aprobación/consentimiento y alcance legal de cada documento antes de liberar.  
**PO-D4**: designar al menos un revisor de cubicaciones/costos y uno de documentación arquitectónica, con casos de prueba retenidos fuera del repositorio.  
**PO-D5**: decidir si se admite tratamiento remoto de fragmentos de planos/documentos de clientes con consentimiento y minimización.  
**PO-D6**: si COM→DWG no supera gate, autorizar un *spike* aislado .NET DxfIn contra AutoCAD real y decidir basado en evidencia.  
**PO-D7**: aprobar o reducir el presupuesto de exposición de herramientas (84–85) medido en el cliente real.

No se trata de decisiones tomadas; permanecen propuestas. El roadmap ejecutable y gates están en TW_PROFESSIONAL_ROADMAP_GATES_V1.md y la base factual en TW_PROFESSIONAL_AUDIT_2026-11-17.md.
