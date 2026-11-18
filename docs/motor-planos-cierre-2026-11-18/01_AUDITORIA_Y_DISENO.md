# TANNIA WORKSPACE — AUDITORÍA MAESTRA Y DISEÑO DE CIERRE DEL MOTOR DE PLANOS

**Fecha:** 2026-11-18  
**Repositorio:** `cristobalMundacaV1/tannia-workspace`  
**Línea base examinada:** PR #37, `astra/consolidacion-uat`, `1c8849084eb99f436f74bfbf9d2b511a06a43ead`  
**Pruebas aportadas:** `UAT-PLANOS-RESULTADOS.zip` (revisión `r-cce021d7623efbf0a162`, geometría túnel académico) y referencia gráfica de Tannia.  
**Rol del documento:** contrato de diseño + backlog ejecutable, NO implementación ni certificación.  
**Dictamen:** No-GO para **cierre profesional del motor de planos**. GO para implementar una macrofase acotada de consolidación. El paquete `0.3.0-rc.4` sigue siendo un candidato de ensayos, no un lanzamiento profesional.

## A. Resumen de evidencia contrastada

1. El ZIP de UAT contiene cinco láminas A3, PDF conjunto, PNG, modelo, cantidades, manifiesto y DXF; el informe precedente revisó 19 archivos de una revisión sin discrepancias SHA-256.
2. Caso geométrico de referencia: túnel 150 m; luz 5,5 m; hastial 2,5 m; bóveda semicircular R=2,75 m; revestimiento elegido 8 cm; fortificación declarada (2,4 m, paso 1,5 × 1,5 m, malla y 10% de traslapo). Oráculos geométricos: excavación 3844,372083 m³; revestimiento 162,164593 m³; 1010 pernos; malla 2234,946783 m². Son **hipótesis de prueba**, no una ingeniería geotécnica validada.
3. `PLANOS-COMPLETOS.dxf` **contiene geometría, pero en AutoCAD fue informado como aparentemente vacío**. Inspección propia del DXF de 74.505 bytes, SHA-256 `dd971a870fe2065757a2d5f251f2d139f913afdaef2dedb70112755747d41005`: AC1024, 47 entidades en modelo (33 LINE, 4 ARC, 10 DIMENSION), layouts Model + TW12-01...TW12-05, `ezdxf` detectó 0 errores y 0 correcciones. **Esto no acredita que AutoCAD renderice correctamente el archivo**.
4. El DXF inspeccionado no declara `$EXTMIN`, `$EXTMAX`, `$VIEWCTR` ni `$VIEWSIZE`; declara `$TILEMODE=1`. El escritor (`src/drawing/dxf.js`) tampoco emite una tabla `VPORT` completa: el lector `ezdxf` expone un `*Active` prácticamente sin atributos de encuadre. Las vistas se distribuyen en Y ≈ 0, 1000, 2000, 3000, 4000, 5000; la extensión global llega a Y=5007,49. Hipótesis plausible: vista inicial y/o layouts no están configurados para una apertura útil, o fallo del importador CAD. No es una causa única demostrada; exige UAT real.
5. El plano de Tannia usado como referencia dispone una gramática documental **integrada**: secciones asociadas, D1–D4, globos y líderes, tablas geométricas/materiales/pernos, convenciones gráficas, símbolos, trama de malla, notas, referencias cruzadas, retícula, revisión y cajetín. El motor actual no reproduce esas relaciones.
6. El CI `1c884908` aprobó Windows/Ubuntu y el paquete `0.3.0-rc.4` (gates 5b/5c), **pero eso solo prueba los contratos automáticos que existían**, no apertura AutoCAD ni calidad documental.

## B. Hallazgos de código y prioridad de remediación

| ID | Prioridad | Evidencia / origen en el código | Déficit o riesgo | Contrato de reparación |
|---|---|---|---|---|
| PL-C01 | **P0** | `src/drawing/dxf.js`, `$TILEMODE=1`, vista inicial sin extents, Y diferida por 1000 m; UAT informa visualización vacía | DXF técnicamente poblado, no utilizable al abrir | Vista inicial, layouts y viewports válidos en AutoCAD; abrir/REGEN/ZOOM/plot con contenido visible; rechazar exportación que no alcance ese gate |
| PL-C02 | P1 | `src/drawing/model.js::LAYERS`, `compose`; `pdf.js::sceneForSheet` | Leyenda solo como frase, sin muestras reales | Leyenda vectorial generada desde los símbolos/patrones *utilizados*; muestras y descripciones verificables |
| PL-C03 | P1 | `pdf.js::buildSheetsPdf` fuerza `strokeColor('black')` | El estilo ACI/color de la capa no se refleja en PDF | Política explícita color/acromático, pesos, trazo, impresión, PDF/DXF equivalentes |
| PL-C04 | P1 | `especificacion.js::entidades` acepta solo línea, polilínea segmentada, rectángulo, arco, círculo | No existen regiones con material semántico, relleno ni HATCH | Regiones cerradas con pattern/material/ref/fuente; PDF vectorial + DXF HATCH o representación explícitamente declarada y verificada |
| PL-C05 | P1 | `model.js::details`: pares de líneas 6/8 cm; UAT lámina 04 | D1–D4 ausentes | Componentes parametrizados y referenciados con datos declarados; omitir geometría no respaldada y mantener PENDIENTE |
| PL-C06 | P1 | `model.js::fortificacionVista`: líneas P1..Pn y malla como línea | Sin representación estructurada de perno, placa, malla, shotcrete, cabezal, traslapo | Símbolos y conjuntos CAD compuestos, representación no prescriptiva de atributos desconocidos |
| PL-C07 | P1 | `pdf.js::sceneForSheet`: texto libre en notas y leyenda | Sin tablas técnicas ni cuadro dinámico real | Tipos `table`, `note-panel`, `legend-panel` con columnas, unidades, wrapping, pie y referencias a cantidad/fuente |
| PL-C08 | P1 | `model.js::compose`: reparto fijo 1-3 vistas, margen/salto y franja inferior fija | No organiza detalles + secciones + tablas por importancia; espacio desaprovechado | Motor de paneles con restricciones, jerarquía, reservas y crecimiento por lámina (nunca escala arbitraria) |
| PL-C09 | P1 | PDF usa escena papel; DXF la consume parcialmente | Paridad de presentación no probada; no hay modelo intermedio único para símbolos/hatch/tablas | `Drawing IR` único, mismo grafo de primitives+semántica para PDF y DXF; oráculo independiente sobre ambos |
| PL-C10 | P1 | `dxf_verificar.js` verifica entidades geométricas/cotas/linetypes, no símbolos/tables/hatch/paper complete | Gate verde pese a diferencia visual estructural | Verificador exhaustivo de elementos visibles/semánticos en modelo y papel, tolerancias y conteo/ref |
| PL-C11 | P1 | `model.js` identifica algunas fuentes y elementos físicos | Referencias entre vista, detalle, símbolo, cantidad y partida insuficientes | Identidad física global; el mismo elemento en varias vistas no genera doble conteo; cambios invalidan derivados |
| PL-C12 | P1 | PNG/PDF pequeña tipografía de notas/cajetín; `validateScene` mínimo 2,2 mm | PDF formalmente válido pero ilegible en formato real | Perfil tipográfico de publicación, auditoría de límites/contraste/colisiones, impresión a tamaño real |
| PL-C13 | P1 | el render PDF muestra todas las capas en negro; `pdf.js` no representa sombreado de materiales | El plano no comunica estratos ni composición | Patrones repetibles vectoriales, leyendas accesibles, significado independiente de color |
| PL-C14 | P1 | `dxf.js::DIMENSION` y reader externo discrepan en tres cotas verticales | Posible incompatibilidad de anotación/cotas | AutoCAD real: REGEN, medición, SAVEAS, reabrir, cotas físicas con acotación del perfil exagerado |
| PL-C15 | P2 | `FORTIFICACION-MOTOR.csv` contiene `[object Object]` | Exportación de campo anidado incomprensible | CSV tabular tipado, columnas planas con valores/unidades/fórmulas y sidecar JSON |
| PL-C16 | P1 producto | No existe ingestión topográfica/geotécnica en la UAT de túnel | Planta/perfil hipotéticos pueden parecer reales | Advertencias visibles, panel de pendientes, no inventar rasante/terreno/materiales/capacidades |
| PL-C17 | P1 proceso | `rc-zip-windows` verifica generación 5 láminas, no visualización AutoCAD | Empaquetado verde sin usuario capaz de abrir el DXF | Gate automático de DXF/viewport + UAT Windows AutoCAD de apertura visual obligatoria antes de aceptación de producto |
| PL-C18 | P1 proceso | Un solo plano de túnel no prueba motor genérico | Posible sobreajuste a referencia | Segundo corpus de edificación con muro, vanos, materiales, cotas y tablas, mismos contratos |

**P0 es prioridad de corrección para la vía CAD.** No reinterpretar «archivo contiene entidades» como «archivo abre y se ve». Las funciones PDF/DXF académicas pueden seguir en investigación, pero el flujo profesional no se acepta.

## C. Arquitectura de consolidación propuesta

### C1. Contrato intermedio `tw.drawing-ir/2` (additive + compatibilidad con /1)

`source model (identidad física, parámetros, procedencia)` → `normalized geometry/quantity model` → **`Drawing IR`** → `sheet composer` → **PDF / DXF** → `independent validation` → `manifest of revision`.

El IR debe ser determinista y serializable. Cada primitiva visible debe llevar: `id`, `view_id`, `role`, `layer`, `source_ref`, `physical_element_ref` o estado `unbound`, `symbol_ref` cuando aplique, `quantity_ref` cuando aplique, `revision` y coordenadas con unidad explícita (`m` modelo, `mm` papel). **Separar significado del elemento de su presentación** y conservar la revisión única.

Módulos sugeridos (no existentes actualmente):

- `src/drawing/ir/schema.js`: validación exhaustiva, compatibilidad de versión.
- `src/drawing/styles/registry.js`: estilos semánticos/paleta/roles y linestyles.
- `src/drawing/symbols/registry.js`: bloques y símbolos reutilizables, versiones.
- `src/drawing/hatches/geometry.js`: contornos, agujeros, orientación, clipping y patrón.
- `src/drawing/annotations/references.js`: líderes, globo, secciones, detalles, anclas y backrefs.
- `src/drawing/tables/engine.js`: filas/celdas tipadas, cantidades/propiedades, fuentes.
- `src/drawing/sheets/solver.js`: paneles, restricciones, medición de texto, paginación y fallback.
- `src/drawing/export/pdf.js` + `src/drawing/export/dxf.js`: adaptadores del **mismo** IR.
- `src/drawing/qa/parity.js`, `qa/visibility.js`, `qa/semantic.js`: oráculos independientes del escritor.

Migrar por adaptador desde `tw.drawing/1`; no romper cubicaciones, `a_partidas`, `history`, `manifest` ni seguridad del sandbox. Los símbolos gráficos y las entidades de detalle deben distinguirse claramente de las **fuentes medibles**, para evitar duplicar metros o unidades en varias vistas.

### C2. Sistema de estilos y simbología — `tw.symbol-catalog/1`

Catálogo versionado, no plantillas copiadas de una fotografía. Cada entrada: `symbol_id`, `category`, `meaning`, `geometry`, `scale_policy`, `color_policy`, `lineweight_mm`, `dash_mm`, `hatch_id`, `legend_label`, `source_ref`, `discipline`, `status` (`DEFINIDO`, `PROPUESTO`, `PENDIENTE`). Los patrones son candidatos de representación gráfica, **no convenciones normativas certificadas** hasta revisión del profesional.

Roles mínimos diseñados:

| ID | Objeto/área | Representación conceptual | Clave de lectura |
|---|---|---|---|
| `EXCAVATION_CONTOUR` | Borde excavado | línea continua de jerarquía alta (0,50 mm propuesta) | contorno físico, no material en sí |
| `INNER_LINING_FACE` | Cara interior revestimiento | línea continua media (0,25 mm propuesta) | diferenciar cara y espesor |
| `SHOTCRETE_REGION` | Revestimiento proyectado | región cerrada con tramado oblicuo sobrio y color opcional | material declarado, espesor y source-ref; patrón por contrato, no por estética |
| `WIRE_MESH_REGION` | Zona de malla | trama cruzada con paso de papel controlado, distinta de shotcrete | superficie, traslapo y origen |
| `ROCK_MASS_BOUNDARY` | Terreno/macizo | contorno de interfaz; relleno solo con caracterización explícita | nunca inferir calidad geotécnica |
| `ROCK_BOLT` | Perno | eje lineal + punto/placa estilizados en detalle, orientación geométrica | identificador Pn, longitud y estado de datos |
| `ANCHOR_HEAD` | Cabeza/placa | bloque simbólico reusable, dimensiones solo declaradas | llamadas de detalle y variante |
| `CENTERLINE` | Eje | trazo-punto visible en escala papel | alineamiento y progresivas |
| `SECTION_CUT` | Plano de corte | línea de corte + flechas y etiqueta A–A | vincula vista de origen con destino |
| `DETAIL_CALLOUT` | Referencia D1–D4 | burbuja numerada + líder con `detail_ref` | un clic lógico/trace a detalle y vuelta |
| `DIMENSION` | Cota | cota nativa editable en modelo, texto físico correcto | mismo valor PDF/DXF/revisión |
| `PENDING_TECHNICAL_DATA` | Dato no confirmado | indicación explícita, no se dibuja especificación ficticia | bloqueo de aprobación final |

Cada símbolo debe definirse **una sola vez** y renderizarse a muestra de leyenda y escena real desde la misma geometría declarativa. Probar modo color y monocromo (no depender únicamente de rojo/verde).

### C3. Regiones y tramas CAD/PDF

Modelo `region`: `outer_loop`, `holes[]`, `material_ref`, `pattern_ref`, `physical_element_ref`, `source_ref`, `geometry_revision`, `measurable:false` por defecto. Validar cierre, aristas, orientación, no autointersección, agujeros dentro del contorno, sin rellenos fuera de región y unidades. La **geometría de hatch** no genera una segunda superficie para cubicación.

PDF: clipping vectorial al contorno, patrón en mm de papel, igual fase/origen y densidad declarada. DXF: `HATCH` compatible con AC1024 o una aproximación explícita documentada; verificar área, contornos, islas y visualización tras apertura AutoCAD. No dar por equivalente un raster o líneas estéticas no editables. Registrar si el material es `DEFINIDO`, `DECLARADO_SIN_VALIDAR` o `PENDIENTE`.

### C4. Leyendas, líderes, referencias, anotación y tablas

**Leyenda:** generada de `symbolsUsed(sheet)` / estilos usados realmente en cada lámina, orden estable, muestra vectorial real con grosor/trazo/trama, título, leyenda corta, material, unidad, estado, pies. Bloquear símbolo usado sin entrada en catálogo o entrada sin muestra renderizable. Escalable a varias columnas y a paneles secundarios.

**Referencias:** `callout { id, source_view, target_ref, target_sheet, anchor_entity, leader_geometry, bubble_label, content_ref, source_ref }`. Validación bidireccional: el globo refiere a un detalle existente, y el detalle cita su vista madre; rechazar IDs repetidos, refs huérfanas y líderes cruzando cotas. `D1` a `D4` son identificadores, no autorización para inventar contenido.

**Tablas:** `table { id, title, source: 'quantities|properties|materials|pending', columns:[{key,label,unit,format}], rows:[{id,refs,values}], footnotes, revision, provenance }`. Solo valores y fórmulas tipados; `PENDIENTE` si falta valor. Oráculo: valores de pernos/áreas/espesores tienen una única fuente y coinciden con la cubicación y el reporte. Probar saltos, anchos, mm, UTF8, filas largas, estilos y exactitud al reabrir el DXF.

**Tipografía:** establecer perfil mínimo por formato y jerarquía de título/subtítulo/texto/tables/nota; ensayos de impresión a 100% en A3/A1; no interpretar 2,2 mm como aprobación automática. El PDF/DXF deben conservar fuentes o reemplazarlas sin cuadrados/cortes.

### C5. Compositor de láminas por restricciones

`sheet` deja de tener solo `views[]`; acepta paneles semánticos ordenados: `main_section`, `alternate_section`, `detail_grid`, `geometry_table`, `materials_table`, `bolts_table`, `legend`, `notes`, `revision`, `title_block`.

- Área real de papel A3/A2/A1; retícula y recuadros como opción de plantilla.
- Reglas para escala fija, número de vistas, aspecto, pesos de información, dimensiones mínimas de lectura y paneles con crecimiento.
- No reescalar geometría a escondidas, no truncar notas, no permitir texto encima de líderes/cotas ni detalles sin cuadro.
- Si no cabe: dividir en láminas explícitas y conectar referencias, o error `COMPOSICION_INSUFICIENTE`. Nunca maquillar el problema con una reducción arbitraria de texto.
- Layouts separados con paper space funcional y vistas que correspondan exactamente a las láminas PDF. `MODEL` no debe aparecer vacío al abrir, y cada `TW12-XX` debe mostrar entidades relevantes.
- Debe soportar **más de tres vistas por hoja** mediante paneles de detalle, sin límite artificial de `especificacion.js` incompatible con la referencia, dentro de límites de complejidad/rendimiento configurados.

### C6. Componentes D1–D4 (piloto túnel) y segundo dominio

**Sección transversal / fortificación:** dos secciones trazables (portal y tramo interior si se aportaron diferencias), cotas, pernos Pn, capas y llamadas D1–D4; diferencias solo con fuente. Cuadros de áreas, materiales y pernos generados de datos tipados.

- `D1 CORONA`: relación declarada del contorno de excavación, revestimiento y malla; anclaje solo con especificación/posición conocida.
- `D2 HASTIAL Y PIE`: encuentro de capas y transición; no añadir drenaje, solera, fundación o pernos especiales sin antecedente.
- `D3 PERNO–MALLA–SHOTCRETE`: corte esquemático parametrizado de sistema, dimensiones y placas/tuercas solo si se declaran; si no, representación parcial + `PENDIENTE` destacado.
- `D4 TRASLAPE DE MALLA`: representación de zona superpuesta derivada de dimensión **declarada** o porcentaje con base geométrica; el porcentaje no se convierte automáticamente en una longitud sin un ancho de paño.

No adoptar los datos de la imagen de referencia como instrucciones de ingeniería ni trasladar su cálculo a otra obra. Segundo corpus obligatorio: edificación con muro y vanos, secciones, hatch de material, tabla y detalle constructivo condicionado a datos disponibles.

### C7. Cierre del DXF que abre aparentemente vacío — P0

**Evidencia:** existe geometría; el defecto reportado es la visualización real. Se requiere reproducir la operación con captura y registrar: aplicación y versión, apertura de `PLANOS-COMPLETOS.dxf`, pestaña activa, resultado de `_.ZOOM` `_Extents`, `_.REGENALL`, alternar Model/TW12-01…05, `_.AUDIT`, guardado de COPIA y reapertura; no alterar originales. No declarar que faltan entidades si existen.

**Corrección de arquitectura:** generar la vista inicial de model space y extents coherentes (`VPORT *ACTIVE`, valores de vista y extents aplicables); definir política de pestaña inicial (modelo enmarcado útil o layout de primera lámina); validar `BLOCK_RECORD`/`LAYOUT`/VIEWPORT, modo papel, estado de capas, textos, contexto plot, unidades, escala, nombres y vínculo de propietario; reducir la separación artificial de vistas si afecta navegación/precisión. Usar un DXF mínimo de control, luego corpus real. **No depender de que la persona ejecute Zoom Extents cada vez.**

Pruebas diferenciadas:
1. El DXF contiene entidades verificadas con `ezdxf` u oráculo independiente.
2. `Model` y `TW12-01..05` tienen una vista útil guardada y no están vacíos.
3. AutoCAD 2027 abre el archivo en una vista comprensible *sin instrucciones manuales de recuperación*.
4. `REGENALL` no rompe cotas, hatch, patrones, BLOQUES o referencias; `AUDIT` aceptable y documentado.
5. DWG obtenido se guarda y reabre en copia; trazado de las cinco láminas a PDF se compara con PDFs del motor y referencia humana.

**Separar evidencia automática de UAT humana:** un CI hosted Windows sin AutoCAD no puede acreditar (3)–(5). Mantener gate de aceptación externo `CAD-REAL` en estado pendiente hasta obtener evidencia real.

## D. CI, puertas de aceptación y estrategia de ZIP

| Gate | Trabajo | Criterio de salida | Evidencia mínima |
|---|---|---|---|
| G0 Base | Fijar SHA, corpus, oráculos, alcance y errores antes | baseline y regresiones congeladas | SHA + reporte UAT + tests primero falla |
| G1 DXF-P0 | Reparar apertura/visibilidad + roundtrip básico | `Model`/layouts visibles, extents coherentes, sin pérdida de entidades | tests con parser independiente + script AutoCAD real preparado |
| G2 Semántica | IR aditivo y catálogo de símbolos | refs/estilos con IDs válidos y estables; compatibilidad anterior | fixtures + validación schema/refs |
| G3 Tramas | Regiones/materiales, PDF/DXF hatch | contornos coherentes y apariencia consistente | topología + análisis DXF + imágenes goldens |
| G4 Anotación | Leyenda, D1-D4, globos, líderes, notas | referencias resueltas, muestra real, sin fuentes inventadas | test de enlace 100%, oráculos por detalle |
| G5 Tablas | Cuadros calculados, planos→cantidades | cuadro = fuente física = cubicaciones, sin doble conteo | pruebas adversariales de cambios A→B→A |
| G6 Composición | Panel layout A3/A2/A1 y tipografía | 0 recortes/colisiones, escala honesta, revisiones claras | visores rasterizados + inspección en papel |
| G7 Paridad | mismo IR→PDF/DXF | mismos símbolos, detalles, áreas, tablas y refs; tolerancias | verificador independiente + comparativas PNG |
| G8 Dominios | túnel + edificación | dos casos con todos los elementos declarados; pendientes honestos | 2 corpus, medidas y páginas trazables |
| G9 E2E | proyectos, manifiestos, seguridad, recuperación | sin regresión en encargo→partidas→presupuesto; originales intactos | Ubuntu/Windows + negativos + ZIP instalado |
| G10 Candidato | versionado, build determinista, paquete y CI | **todos los tests automatizables verdes sobre un SHA**, ZIP único con SHA-256 | `rc-zip`, `rc-zip-windows`, 5b/5c, nuevos 5d/5e |
| G11 AutoCAD real | ensayo de apertura, plotting, sesiones, R/W | no hoja vacía, no corrupción, no interferencia ni datos inventados | registro Windows/AutoCAD 2027 + capturas + archivo reabierto |
| G12 Profesional | examen de láminas de referencia | profesional acepta utilidad documental; data pending visible | acta humana. Sin esto: `BORRADOR PARA REVISIÓN` |

**Regla de liberación:** G0–G10 son condición de **nuevo ZIP apto para UAT controlada**, no de aceptación profesional. G11 y G12 no pueden simularse. No merge, release, instalación ni autoaprobación por el implementador. Una revisión independiente debe verificar P0/P1 y gates automáticos antes de solicitar autorización al PO.

### Nuevas verificaciones CI propuestas

- `test:draw-ir` y `test:cad-visibility` (todos los commits): multi-layout, extents, `VPORT`, `$TILEMODE`, BTR, capas encendidas, objetos visibles, notación y cota nativa.
- `test:graphics-parity` (Ubuntu + Windows): PDF y DXF del mismo IR; vector/tables/hatches/symbols/refs sin omisiones; página y límites; raster visual golden con tolerancia y **revisión de cambios golden**.
- `test:cross-domain` (Ubuntu + Windows): túnel y edificación, alteración deliberada de un símbolo, tabla, dibujo y revisión debe romper el gate correspondiente.
- `rc-zip-windows` paso **5d**: generar e inspeccionar `PLANOS-COMPLETOS.dxf` desde **ZIP instalado**, comprobar entidades + extensiones + layouts + objetos/paneles de la lámina de referencia.
- `rc-zip-windows` paso **5e**: validar PDF/PNG/CSV/JSON/manifiesto de ambas especialidades y evidencia de no interferencia del servidor, preservando 5b/5c.
- `cad-real-autocad-2027`: **gate manual externo**, no marcado verde por CI sin AutoCAD; registrar import/REGEN/AUDIT/SAVEAS/plot en un equipo autorizado.
- Política de versiones: el actual `0.3.0-rc.4` es inmutable; candidato nuevo con siguiente versión libre (p. ej. `0.3.0-rc.5` **si aún está libre**), sincronizar `src/version.js`, `package.json`, `package-lock.json`, manifest y nombre ZIP; nunca reutilizar un nombre para bytes distintos.
- Artefacto publicado: un único ZIP asociado a SHA, fecha, test matrix y SHA-256 (dos hashes distintos: ZIP de instalación interior y artefacto contenedor de GitHub Actions). Incluye instrucciones sin Claude para producir y abrir los planos.

## E. Plan ordenado en PR apilados (no mezclar con ramas de implementación anteriores)

**P0 / PR-A (bloqueante):** reproducir DXF aparentemente vacío; definir y corregir model/viewports/layouts/extents y cotas; gate DXF-P0. Mantener DXF original para comparación. Este PR puede probarse y revisarse independientemente de estilo.

**PR-B (fundación):** IR v2 + registry estilos y símbolos con capa de compatibilidad `/1`; tests de refs y rendimiento; sin cambios silenciosos de cantidades.

**PR-C (documentación):** regiones y hatch PDF/DXF, leyenda real, líderes/llamadas, tablas tipadas, perfiles color/monocromo y caja tipográfica. Test de equivalencia y fallos negativos.

**PR-D (composición/dominios):** compositor de paneles + plantilla académica de túnel con D1–D4 y plantilla de edificación, datos pendientes visibles, dossier visual reproducible.

**PR-E (QA/candidato):** independencia de QA, CI completo Windows/Ubuntu, 5b/5c/5d/5e, no regresión en G03–G09, hash/versión, ZIP para UAT, protocolo real AutoCAD 2027. En PR en borrador hasta revisión/decisión PO.

**Criterios no negociables:** no falsificar materialidad ni acreditación; no introducir cambios silenciosos de escala; no convertir representaciones en cantidades nuevas; no usar una imagen de referencia como única fuente normativa; no llamar “DWG verificado” a un DXF convertido sin AutoCAD real; no permitir publicar documentos con discrepancias de revisión.

## F. Acciones manuales inmediatas (sin modificar planos originales)

1. En AutoCAD completo, abrir una **copia** de `PLANOS-COMPLETOS.dxf` desde el explorador de archivos, registrar título de ventana y pestaña activa.
2. En línea de comandos, `_.ZOOM` + opción `_Extents`, o `_.ZOOM`↵`_E`↵. Registrar captura antes/después. Referencia: Autodesk, ZOOM Extents muestra objetos dentro de las extensiones calculadas.
3. Revisar pestañas `TW12-01…05`, ejecutar `_.REGENALL`, registrar si muestran papel, viñetas y cotas. En copia, `_.AUDIT` y aceptar reparación solo en esa copia; guardar resultado.
4. Si sigue vacío, registrar log del comando de apertura, ventana de errores/recuperación y versión exacta. **No** interpretar `ezdxf.audit` verde como prueba AutoCAD.
5. Añadir capturas y DXF conservado a PR-A con hash antes y después; no instalar aún nueva versión sobre proyecto personal.

## G. Referencias verificadas

- Código de PR #37 `1c884908`: `src/drawing/{model,pdf,dxf,especificacion,service,dxf_verificar,layouts_check}.js`.
- ZIP UAT real: `UAT-PLANOS-RESULTADOS.zip`, `PLANOS-COMPLETOS.dxf`, `MODELO-MOTOR.json`, `VERIFICACION-MOTOR.json`, 5 PDFs.
- Referencia visual aportada por el PO el 18 Nov 2026 (sección/fortificación; D1–D4; cuadros; simbología y grosores).
- Autodesk: DXF HEADER Variables y `TILEMODE`; `ZOOM` / `Extents`, `VPORT` views: https://help.autodesk.com/cloudhelp/2024/ESP/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm ; https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-Core/files/GUID-66E7DB72-B2A7-4166-9970-9E19CC06F739.htm .

## H. Marcos técnicos de referencia para diseño (sin declarar conformidad)

Revisar y adquirir/consultar las ediciones aplicables antes de certificar cumplimiento, diferenciando reglas generales de documentación y convenciones contractuales chilenas del mandante:

- **ISO 128-1:2020 / ISO 128-2:2022:** principios de representación y convenios básicos de líneas. Referencias: https://www.iso.org/standard/65296.html y https://www.iso.org/standard/83355.html.
- **ISO 129-1:2018** (y enmienda 2020): principios de presentación de cotas y tolerancias. https://www.iso.org/standard/64007.html.
- **ISO 13567-1:2017:** organización y nombres de capas CAD. https://www.iso.org/standard/70181.html.
- **ISO 7200:2004:** campos de datos de cajetín y encabezados. https://www.iso.org/standard/35446.html.
- **ISO 5457:** tamaños y disposición de las hojas de dibujo; comprobar edición y acuerdos del mandante antes de fijar márgenes/retícula. https://www.iso.org/obp/ui?_escaped_fragment_=iso%3Astd%3Aiso%3A5457%3Aed-2%3Av1%3Aen.

Estos documentos sirven para **diseñar perfiles verificables**, no para afirmar que el candidato los cumple ni para reconstruir el contenido íntegro de estándares de pago. Mantener las especificaciones particulares del mandante y requisitos chilenos pertinentes como perfiles configurables, confirmados por profesional.