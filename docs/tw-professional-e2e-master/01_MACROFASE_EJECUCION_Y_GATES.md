# 01 — Macrofase TW-PRO-E2E: ejecución, dependencias y gates

**Objeto:** hacer que el sistema resuelva un encargo completo de construcción, no crear módulos independientes. **Estatus:** backlog prescriptivo; cada historia requiere comparación con implementación real antes de programar. Los controles que ya estén probados se **reutilizan y se marcan cerrados con SHA**, no se reescriben.

## 1. Regla de ejecución

**Cadena vertical obligatoria (mismo proyecto, misma revisión):**

\`Adjunto/carpeta/ZIP/RAR → inventario e importación protegida → lectura e identificación de datos → alcance y preguntas → geometría/planos → mediciones verificables → partidas/APU → presupuesto → memoria/EETT → aprobación humana → manifiesto → entrega y cambios\`.

El encargo conserva su estado entre sesiones; cualquier cambio de geometría, método, precio, configuración o aprobación invalida los derivados afectados. El sistema conserva revisiones anteriores, permite rollback seguro y explica al usuario el trabajo pendiente.

### Priorización no negociable

| Ola | Gates | Dependencia y criterio de avance |
|---|---|---|
| A — Producto confiable | G00, G01, G02 | Baseline; control de acceso, autoridad humana y una revisión coherente |
| B — Entrada y ejecución natural | G03, G04 | Puente de archivos seguro; plan de trabajo y preguntas mínimas |
| C — Núcleo técnico profesional | G05, G06, G07 | Modelo CAD verificable, medidas/partidas, presupuesto completo y versionado |
| D — Documentación y entrega | G08, G09 | Planos de especialidad, documentos, aprobaciones y manifiesto reconciliados |
| E — Producto distribuible y útil | G10, G11, G12 | Windows/AutoCAD/Claude reales, pruebas retenidas y decisión de release |

G03/G04 pueden construirse en paralelo con los estudios CAD y normativos, pero **ningún gate posterior puede anunciarse como completo antes de sus dependencias críticas**. Continuar la implementación cuando falte hardware; dejar N2 marcado NO EJECUTADO.

## 2. Historias ejecutables

### G00 — Base integrada y estado reproducible [P0]
- **E2E-001:** resolver el estado actual de \`main\`, PR #29/#30/#33 y otros PR apilados, contratos AGENTS/CLAUDE/continuidad, herramientas MCP visibles, dependencia de flags, artefactos Windows y matríz de evidencias. Registrar SHA/versión por cada ruta; eliminar ambigüedad de RC con igual nombre y distintos bytes.
- **E2E-002:** mapa completo de herramientas, procedimientos, permisos y productores/consumidores de datos. Marcar duplicados legacy↔CIC, tareas sin entrada real, capacidades con función pero no expuestas por instalador.
- **E2E-003:** baseline de una tarea retenida (túnel) y una de edificación; conservar fixture, oráculos y expectativas humanas fuera del control del implementador.
- **Gate:** commit y matriz actualizados; \`tools/list\` del paquete instalado coincide con catálogo esperado; cada motor tiene estado N0–N3 con evidencia y limitación. No modificar \`main\`.

### G01 — Autoridad humana, privacidad y seguridad [P0]
- **E2E-010:** ninguna herramienta MCP puede verificar partidas, aprobar cantidades, plano, presupuesto o entrega mediante nombres, booleanos o texto que Claude controle. Recibo de aprobación de canal humano independiente, ligado a \`project/revision/input_hash/artifact_hash/action/purpose/expiry\`.
- **E2E-011:** rechazos, cancelaciones, expiraciones, modificaciones y repetición de recibos fallan cerrado; acceso a datos, permisos de lectura/escritura y rutas fuera del proyecto bajo política explícita.
- **E2E-012:** archivos y texto hostiles son **datos**, no instrucciones. Logs redactados; minimización de datos que sale del PC a Claude; advertencia clara antes de compartir contenido confidencial.
- **Gate:** ataques A-01/TW-PRO-01 y bypass con otro MCP rechazados; original inmutable; pruebas de cancel/timeout/replay/doble ejecución/mutaciones; evidencia de controles reales, no solo prompt.

### G02 — Revisión única y entrega consistente [P0]
- **E2E-020:** contrato \`DocumentRevision\` con fuente/snapshot, dependencias y hashes. Una revisión es la autoridad de sus planos, medidas, partida, presupuesto, Excel, PDF, memoria, RFI y manifest; no seleccionar «el archivo más reciente» por fecha/nombre.
- **E2E-021:** estado \`PENDIENTE → BORRADOR → PREPARADO PARA REVISIÓN → REVISADO HUMANAMENTE → APROBADO PARA EL ALCANCE → ENTREGADO\`; las transiciones críticas requieren recibo auténtico. Un cambio invalida derivados, no la evidencia histórica.
- **E2E-022:** ledger de cambios y recuperación A→B→A, crasheo antes/durante/después de escritura, no sobrescritura y rollback transaccional.
- **Gate:** repetir reproducción A-02 (precio 100→900 tras Excel antiguo): exportación antigua se rechaza; todos los archivos de un manifiesto corresponden al mismo hash de revisión; ninguna aprobación se hereda tras cambios.

### G03 — Recepción de antecedentes sin fricción [P0 de experiencia]
- **E2E-030:** un único archivo local, carpeta, ZIP o RAR autorizado se convierte en inventario completo; importar originales individualmente bajo el capó sin pedir veinte rutas. PDF/DWG/DXF/XLSX/DOCX/CSV/imagen/MD según soporte declarado.
- **E2E-031:** investigar puente Claude Desktop→MCP local sin suponer acceso a adjuntos; si el host no expone bytes, pedir **una sola ruta local** y automatizar extracción, listado, integridad, clasificación y lectura. No prometer acceso que no existe.
- **E2E-032:** extracción segura contra \`../\`, rutas absolutas, enlaces, bomb ZIP, descompresión recursiva ilimitada, extensión ambigua, colisión de nombres, archivos cifrados, tamaño y cuotas. RAR solo con motor/licencia/compatibilidad comprobados; fallback claro si no existe.
- **E2E-033:** índice \`DocumentSource\`: hash original, fuente, tipo, página/capa/hoja, revisión, confianza/legibilidad, dependencia y estado \`LEÍDO/NO_LEÍDO/PENDIENTE\`. Documentos escaneados requieren interpretación con contraste, no OCR inventado.
- **Gate:** un ZIP y un RAR con varios niveles se importan desde una ruta; originales idénticos byte a byte; inventario exhaustivo; contraseñas/daños y contenido no soportado informados; no omisiones silenciosas; ataques de extracción rechazados.

### G04 — Orquestación conversacional del encargo [P0 de experiencia]
- **E2E-040:** contrato \`WorkOrder\` derivado del objetivo y \`DocumentSource\`; plan de trabajo por resultados (planos, cantidades, costos, documentos), dependencias y responsables, no por nombres de herramientas MCP.
- **E2E-041:** preguntas en una sola ronda inicial indispensable; cada pregunta identifica dato faltante, efecto en la obra y alternativa segura. No preguntar lo que está en antecedentes ni inventar parámetros de ingeniería. Replanificar cuando llegan nuevos antecedentes sin reiniciar el encargo.
- **E2E-042:** seleccionar herramientas reales habilitadas, detectar fallos, reintentar solo acciones idempotentes, reconciliar escrituras inciertas; informar progreso y limitaciones brevemente.
- **E2E-043:** UI y autorizaciones expresadas como «¿Qué se hará? ¿Por qué? ¿Qué cambia? ¿Qué no cambia? ¿Qué pasa si rechazo?». Sin lenguaje de MCP, JSON, rutas técnicas o tokenización a usuaria.
- **Gate:** 30 tareas pareadas y 3 corridas cuando haya entorno; medir preguntas superfluas, repetición, selección de herramienta, pasos manuales, corrección y localización de archivos. No hay autorización genérica ni silenciosa.

### G05 — Núcleo CAD/DXF/DWG profesional [P1 bloqueante del alcance CAD]
- **E2E-050:** una sola autoridad de \`DrawingDocument/View/Sheet/Element/Annotation/Dimension/Layout/Revision\`; reutilizar \`src/drawing\`, \`src/design\`, \`src/cad\` y \`src/geo\`. No confundir representación (línea) con elemento físico (muro, perno).
- **E2E-051:** DXF correcto para LINE/CIRCLE/ARC, polilíneas (orden/bulge/OCS), bloques/INSERT, capas/linetypes, HATCH, cotas, MTEXT/MLEADER, XDATA, layouts/viewports, escalas y plot, **por perfil de especialidad y evidencia**. Bloquear operaciones no soportadas, no crear una apariencia falsa.
- **E2E-052:** flujo \`DXF→AutoCAD documento aislado→DWG→cerrar→reabrir→auditar\` con comparación geométrica y semántica por entidad, más impresión en papel. Original y dibujo ajeno sin guardar intactos. COM vs .NET mediante PoC del mismo corpus, no migración especulativa.
- **E2E-053:** operación reversible A→B→A en plano con edición de objeto/cota/bloque y cambio de medidas derivadas. \`fidelidad_geometrica: NO_VERIFICADA\` hasta readback real.
- **Gate:** 5 láminas de túnel + expediente edificación con estilos/entidades/cotas/layouts; prueba adversarial capa/topología/XDATA/longitud/escala; AutoCAD 2027 real necesario para estado N2 DWG.

### G06 — Medición, reglas y catálogo de partidas [P1]
- **E2E-060:** \`Measurement/PhysicalElement/MethodCard/Claim/ConstructionItem\` con identidad física obligatoria para cantidades aptas para presupuesto; rechazar doble conteo entre planta/elevación, signos incompatibles, superposición, contornos inválidos, unidades incorrectas.
- **E2E-061:** integrar **sin duplicación** \`tw.cantidades/1\` con \`src/quantities\` y CIC; detalle sumable vs totales solo control; preservar el adaptador túnel (pernos/malla/revestimientos) y autorizar su uso según fuente/método.
- **E2E-062:** reglas versionadas y revisadas por familia de obra: muros/vanos, losas/radier, bloques/carpinterías, revestimientos/terminaciones y túnel/fortificación según datos comprobados. Fuentes normativas/contractuales con edición, cláusula disponible y aplicabilidad; sin declarar cumplimiento NCh automáticamente.
- **E2E-063:** cambio geométrico/método/inclusión de vano invalida partida y downstream; registro \`NEEDS_REVIEW\` para representación sin identidad o unidad incierta.
- **Gate:** oráculo humano independiente en casos reales anonimizados; 0 valores físicos sin procedencia usados como «verificados»; A→B→A reproduce cantidades; no suma doble de totales.

### G07 — APU, presupuesto y planillas [P1]
- **E2E-070:** partidas consumen \`cantidadPartida\` y hash de revisión, sin duplicar mediciones ni confiar en filas de total. APU desglosa materiales, mano de obra, equipos, rendimientos, mermas, subcontratos y fechas/fuentes cuando sean aportados.
- **E2E-071:** política económica única legacy/CIC: \`desconocido\` ≠ \`0\`, GG/utilidad/impuestos confirmados según alcance fiscal/contrato, moneda y tipo de cambio solo con fecha y fuente. Precios 2010/2019 históricos quedan referenciales y no vigentes.
- **E2E-072:** Excel XLSX abierto, con fórmulas correctas, celdas protegidas/editables según rol, subtotales/sumas, formato chileno y moneda; verificar valores recalculados con oráculo independiente.
- **E2E-073:** revisión de geometría recalcula cantidades y **obliga a regenerar** APU/Excel/PDF/manifest; preservar las anteriores y bloquear aprobación de revisión obsoleta.
- **Gate:** prueba A-02 precio 100→900, partida con vano, múltiples impuestos/escenarios; 0 «total final» no sustentado; misma suma y etiqueta de alcance en respuesta, Excel, PDF y manifiesto.

### G08 — Documentación profesional por disciplina [P1]
- **E2E-080:** sistema de plantillas por obra/mandante, conservando términos, unidades, títulos, cajetín, escalas, firmas pendientes, revisión e índice. Especialidades se declaran \`SUPPORTED/PARTIAL/UNVERIFIED\` individualmente.
- **E2E-081:** túnel piloto: geometría de excavación; cuadro geométrico; fortificación portal/interior; detalle de corona, hastial y pie; perno-malla-shotcrete; traslape de malla; cuadro calculado de pernos; materiales/EETT; hipótesis y pendientes; referencias y simbología/espesores de línea; jamás confundir esquema académico con diseño geotécnico aprobado.
- **E2E-082:** edificación piloto: plantas, cortes, elevaciones, ejes, vanos, cuadros, detalles, materiales, notas, escala/layout; conectar muros/losas/vanos a cantidades; no afirmar proyecto de permiso ni diseño estructural aprobado.
- **E2E-083:** memoria de cálculo/EETT/informe técnico/PDF/Word editable cuando esté soportado, con fuentes y tablas del mismo ledger de cifras y revisión. No redactar cifras de construcción desde texto libre del modelo sin fuente.
- **Gate:** comparación física CAD vs PDF y tablas; evaluación de legibilidad, tipografía, dibujos recortados, láminas, colores, grosores y detalles por profesional; entregas comprensibles y editables.

### G09 — Aprobación, entrega y cambios [P0 de salida]
- **E2E-090:** paquete íntegro: carpeta del proyecto, resumen legible, originales protegidos, versión de planos, DXF/DWG si verificado, PDFs, cantidades, XLSX, memorias, EETT, pendientes, informes y manifiesto SHA.
- **E2E-091:** cada documento lleva estatus \`BORRADOR/REVISIÓN HUMANA PENDIENTE/APROBADO PARA ALCANCE\`; nunca copiar una firma desde metadatos del modelo; sistema no declara «listo para construcción» por sí solo.
- **E2E-092:** un cambio en proyecto activa análisis de impacto en costos, planos, aprobaciones y documentos, pide autorización humana cuando afecta entrega aprobada, conserva revisiones y recupera tras error.
- **Gate:** trazabilidad bidireccional plano↔cantidad↔partida↔costo↔documento↔manifest y comparación cruzada; 0 entregas con revisiones mezcladas; usuario encuentra cada archivo en un clic/ruta entendible.

### G10 — Distribución y operación Windows [P1]
- **E2E-100:** instalador y \`.mcpb\` con catálogo coherente, dependencias/licencias, firma o checksum, número de versión/hash únicos; jamás otro ZIP diferente rotulado con el mismo RC.
- **E2E-101:** usuario estándar Windows 10/11, rutas con ñ, espacios, OneDrive/junctions, permisos; instalación, actualización, rollback, desinstalación sin terminal ni perder proyectos.
- **E2E-102:** diagnóstico expresado en castellano profesional; no mostrar comandos al usuario final salvo soporte técnico solicitado; controlar privacidad del informe.
- **Gate:** prueba del ZIP **real** con manifiesto y 5 láminas en Windows; Claude Desktop real; rollback y no edición de dibujos ajenos. CI Linux no sustituye binarios Windows.

### G11 — Evaluación integral retenida [P0 de aceptación]
- **E2E-110:** corpus externo ≥20 casos, ≥5 adversariales y al menos 3 expedientes de obra anonimizados con cálculo humano de referencia; oráculos definidos por revisor, no por implementador.
- **E2E-111:** UAT Tannia de túnel + edificación + revisión A→B→A + ZIP/RAR + incidente AutoCAD + autorización rechazada + interrupción/recuperación, **misma cadena sin bypass**.
- **E2E-112:** medir tiempo manual vs asistido incluyendo correcciones, preguntas, claridad, coherencia y retrabajo; tolerancias por operación/método antes de pruebas, no promesas porcentuales arbitrarias.
- **Gate:** 0 alteraciones de originales, 0 aprobaciones falsas, 0 cifras técnicas críticas inventadas, 0 entregas obsoletas; evidencia N2/N3 del alcance que se anuncia.

### G12 — Decisión formal de alcance y release [P0 de distribución]
- **E2E-120:** matriz de capacidades realmente soportadas por especialidad y tipo de operación; N0–N3, entorno y limitación explícitos. No prometer «toda construcción» sin perfiles validados.
- **E2E-121:** candidato instalable distinto, changelog, SHA, SBOM/licencias, rollback, guía de una página, documentación y soporte.
- **E2E-122:** auditoría independiente y dictamen de PO: \`ACEPTAR / ACEPTAR ALCANCE LIMITADO / RECHAZAR\`; sin merges ni releases automáticos.
- **Gate:** ninguna capacidad no verificada se anuncia como profesional; decisión escrita y versión de paquete coincidente con el UAT ejecutado.

## 3. Riesgos bloqueantes de salida

**P0:** aprobación humana falsificable; documentos exportados de revisión vieja; originales alterados; autorización ausente; cambios silenciosos; datos técnicos críticos inventados.

**P1:** DWG sin fidelidad real presentada como correcta; cantidades duplicadas; pérdida de XDATA/cotas/layouts; Excel inconsistente; ZIP con omisiones; flujo incapaz de continuar; materiales/factores normativos sin procedencia.

**P2:** detalles visuales y lenguaje operativo que causan fricción sin alterar seguridad; corregirlos de acuerdo con evidencia y experiencia de usuario.

## 4. Estrategia de implementación y autonomía

1. Primer corte vertical: caso de túnel o edificación en **una única revisión completa**, aunque todos los documentos aún estén marcados de borrador. Crear oráculo y pruebas, no desplazar los datos faltantes con supuestos.
2. Reutilizar y adaptar capacidades existentes, en PRs manejables con gates; no reemplazar grandes motores sin un test comparativo que lo justifique.
3. Conservar el trabajo de Claude que siga activo; no rebasar ni sobrescribir ramas ajenas. Para cada historia abrir tarea verificable con módulo, dependencias, pruebas y estado.
4. **No paralizar ingeniería** por hardware externo: dejar pruebas de AutoCAD/UI real \`PENDIENTE EXTERNO\` y continuar otros gates, pero bloquear afirmaciones profesionales dependientes de ellas.
5. Al cerrar cada gate: SHA exacto, casos primero-falla/luego-pasa, CI Windows/Ubuntu, diferencias de output, artefactos, pendientes, riesgo y solicitud explícita de revisión independiente. Astra audita **entrega declarada final**, no cada commit intermedio.

## 5. Definition of Done global

El mismo expediente y snapshot original producen planos, cantidades, partidas, APU, XLSX, memoria y manifiesto sin contradicciones. Un cambio único invalida todos los derivados afectados, el sistema no ejecuta acciones humanas por proxy, el usuario realiza **el mínimo trabajo manual**, se prueba AutoCAD en hardware real cuando se anuncia DWG y los especialistas revisan la disciplina pertinente. Un workflow verde de CI jamás sustituye esos gates.
