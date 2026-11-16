# TANNIA WORKSPACE — TW-10
## Contrato v1 del Motor de Razonamiento Arquitectónico Asistido (MRAA)
**Fecha:** 2026-11-16 · **Tipo:** contrato propuesto de ingeniería/producto · **Estado:** aprobado como alcance, pendiente de implementación y gates

## 0. Principio no negociable

> **No generar geometría para después inventarle una justificación; modelar el encargo, contrastar restricciones y alternativas, evaluar evidencias y solo entonces elaborar una propuesta arquitectónica.**

La «capa de razonamiento de arquitecto» es una **metodología computable de diseño asistido**, no un personaje, un prompt omnipotente ni un sustituto de arquitectos habilitados. Claude Desktop interpreta la conversación y explica decisiones; código determinista valida modelo, clima, restricciones, métricas y versiones. La profesional acepta, edita o rechaza cada solución, y recibe fuente, alcance y riesgo.

## 1. Ciclo de decisión profesional

1. **Escuchar / descubrir:** para quién se diseña, qué quieren sentir y hacer, qué les preocupa, cómo usan el día, presupuesto de orden de magnitud, necesidades futuras. Diferenciar hechos de preferencias y de propuestas.
2. **Leer el lugar:** norte verdadero, límites, pendiente, acceso, vecinos, sombras externas, árboles, vientos, riesgos, fuente oficial urbana, vistas favorables y desfavorables.
3. **Convertir palabras en objetivos:** «quiero ver a los niños desde la cocina» → objetivo de intervisibilidad cocina↔zona de juego, acompañado de alerta de barreras físicas de seguridad; «quiero mucha luz» → objetivo de sol útil/luz natural, pero con control de ganancias solares y deslumbramiento.
4. **Escribir el partido:** concepto espacial (compacta, L con patio, dos alas, patio central, etc.) y relaciones entre áreas. Cada partido debe tener motivo, limitaciones y posibilidad geométrica.
5. **Producir alternativas estructuralmente distintas:** distintas topologías de huella y/o grafos de adyacencia, no espejos con diferente nombre. Verificar factibilidad antes de evaluar.
6. **Analizar:** funcionamiento, recorridos, visuales, orientación, sol y sombras, clima, privacidad, constructibilidad, costos relativos, riesgos y mantenimiento.
7. **Negociar compensaciones:** un partido en L puede mejorar patio protegido y relación interior-exterior, pero penalizar perímetro y complejidad; uno compacto puede ahorrar área de cerramiento, pero sacrificar separación funcional.
8. **Elegir con razones trazables:** documentar objetivo, hecho de soporte, métrica o juicio cualitativo, alternativas descartadas, incertidumbre y profesional pendiente.
9. **Iterar sin destruir:** permitir refinar un único objetivo (p. ej. «menos sol de tarde en living») con recálculo de métricas afectadas, nuevas versiones, diff y salvaguarda de originales.
10. **Aprender del feedback sin entrenar irresponsablemente:** guardar preferencias y decisiones aceptadas a nivel de proyecto, no convertirlas en normativa ni generalizarlas automáticamente a otros clientes.

## 2. Contratos de entrada y salidas (schemas conceptuales)

Todos los contratos reales se implementarán con Zod/JSON Schema y tests; los ejemplos siguientes son ilustrativos y **no interfaces ya existentes**.

### 2.1 `ArchitecturalBriefV1`

```json
{
  "schema": "tw.arch.brief/1",
  "project_id": "<uuid-del-proyecto>",
  "request_original": "Casa de 90 m2, 3 dormitorios, living iluminado y piscina visible desde cocina",
  "program": [{"id":"living","usage":"social","target_area_m2":22},{"id":"kitchen","usage":"cocinar"},{"id":"bedrooms","quantity":3}],
  "household": {"needs":["supervision_infantil","teletrabajo"]},
  "objectives": [
    {"id":"o1","kind":"daylight_preference","target":"living","priority":"high","evidence":"user_statement","status":"confirmed"},
    {"id":"o2","kind":"sightline","from":"kitchen","to":"pool_play_zone","priority":"high","evidence":"user_statement","status":"confirmed"}
  ],
  "hard_constraints": [{"id":"h1","kind":"one_story","status":"confirmed"}],
  "preferences": [],
  "unknowns": ["site_dimensions","site_true_north","site_coordinates","budget"],
  "review_required": ["child_pool_access_barriers","site_urban_rules"]
}
```

No almacenar biografías íntimas, edad detallada de niños ni detalles familiares que no sean indispensables para el proyecto. Preferencias pueden ser anónimas y modificables.

### 2.2 `SiteContextV1`

```json
{
  "schema": "tw.arch.site/1",
  "coordinates": null,
  "timezone": null,
  "true_north_deg_from_local_plus_y_clockwise": null,
  "parcel_polygon_mm": null,
  "street_access": [],
  "terrain": {"level_points":[],"source":"unknown"},
  "context_obstacles": [],
  "vegetation": [],
  "view_targets": [],
  "noise_sources": [],
  "urban_constraints": [],
  "sources": [],
  "status": "insufficient_for_real_solar_study"
}
```

**Sistema de referencia:** +X derecha del plano, +Y arriba, +Z altura; azimut solar geográfico desde norte verdadero en sentido horario. Transformar azimut hacia ejes locales usando `true_north_deg_from_local_plus_y_clockwise`. No confundir norte dibujado con norte real. Predio/huella/obstrucciones usan las mismas unidades y transformaciones. En perfiles tipo Chile, zona horaria geográfica se representa con nombre IANA y timestamps absolutos, sin fijar UTC−3 para todo el año.

### 2.3 `WeatherContextV1`

```json
{
  "schema": "tw.arch.weather/1",
  "source_kind": "epw|open_meteo_era5|user_observation|none",
  "source_ref": null,
  "source_sha256": null,
  "station_or_grid": null,
  "geospatial_resolution": null,
  "coverage_period": null,
  "variables": ["temperature","wind_speed_10m","wind_direction_10m","radiation"],
  "missingness": null,
  "license_note": null,
  "representativeness": "unknown",
  "status": "not_loaded"
}
```

Una rosa de viento por estación informa **patrones regionales**. No declarar velocidad dentro del patio ni ventilación de interiores sin modelado adecuado. La ventilación potencial exige ventanas operables, trayectoria espacial y evaluación de conflicto ruido/privacidad.

### 2.4 `ArchitecturalSchemeV2`

```json
{
  "schema":"tw.arch.scheme/2",
  "id":"alt-L-001",
  "brief_ref":"<sha-del-brief>",
  "site_ref":"<sha-del-contexto>",
  "concept":"dos_alas_forman_patio_de_uso_diario",
  "footprint_polygons_mm":[[[0,0],[12000,0],[12000,4000],[5000,4000],[5000,9000],[0,9000]]],
  "open_courts_mm":[],
  "spaces":[],
  "walls":[],
  "openings":[],
  "roofs":[],
  "exterior_areas": [{"id":"patio","use":"family"},{"id":"pool_play_zone","use":"recreation","access_control":"needs_review"}],
  "adjacencies":[],
  "line_of_sight_goals":[],
  "sources":[],
  "model_status":"concept"
}
```

Este polígono es **ilustrativo** y no debe usarse como proyecto de una usuaria. Normalización: anillos sin autointersección, orientación definida, límites válidos, sin solapes de recintos, sin vacíos mal tipados. El compilador 2D→3D toma **la unión de polígonos** de huella, nunca la caja envolvente, para que un patio de una L no se convierta en losa maciza. Para casas con patios completamente interiores se modelan agujeros expresos.

### 2.5 `DesignDecisionV1`

```json
{
  "schema":"tw.arch.decision/1",
  "id":"d-023",
  "goal_id":"o1",
  "decision":"alero_ajustado_en_fachada_de_living",
  "candidate_ids":["alt-L-001","alt-C-001"],
  "selected":"alt-L-001",
  "evidence":[{"type":"calculation","metric":"sun_access_sampled_hours","value":null,"status":"not_computed"}],
  "tradeoffs":["menor_sol_directo_en_verano","posible_menor_sol_en_invierno","costo_y_mantenimiento_del_alero"],
  "uncertainty":["sin_norte_geografico_verificado"],
  "status":"proposed_pending_evidence",
  "requires_professional_review":true
}
```

Nunca llenar `value` con un número ilustrativo y presentarlo como calculado. Guardar método, hash de entrada, fecha, configuración, versión de motor y procedencia por métrica.

## 3. Conocimiento por capas (no simular conocimiento legal)

- **A. Marco fijo de diseño:** principios como recorridos, jerarquía espacial, relación público-privado, diversidad, aprovechamiento de área, flexibilidad, vistas; criterios como heurísticas versionadas, editables y no normativas.
- **B. Contexto humano:** deseos expresados, prioridades ordenadas, rutina; todo trazado a solicitud confirmada, no a estereotipos.
- **C. Contexto de sitio:** geometría y restricciones territoriales verificadas; `unknown` hasta adquirir evidencia confiable. Importación de CIP en `01 Antecedentes`, con referencia a archivo y páginas revisadas, sin equiparar OCR/inferencia a autoridad.
- **D. Datos climáticos:** coordenadas, zona horaria, fuente EPW/ERA5, estación, versión, cobertura, resolución y validez.
- **E. Motor geométrico/físico:** predio, intersecciones, colisiones, huella, sombras y ray casting, visuales, conectividad, adyacencia, recorridos, métricas de envolvente.
- **F. Crítico/revisor:** evalúa alternativas y compensaciones, busca problemas de circulación, privacidad, accesibilidad y constructibilidad; niega puntaje global si existen riesgos críticos pendientes.
- **G. Profesional humano:** valida objetivos, acepta partido, resuelve sistemas, norma, estructura, higiene, instalaciones, licencias/planos para DOM.

## 4. Arquitectura propuesta de implementación

**No empezar creando agentes autónomos que se hablan indefinidamente.** Emplear un servicio de dominio determinista, con Claude como interlocutor/orquestador y responsabilidades comprobables.

```
Claude Desktop (lenguaje natural)
   │ -> MCP tools con schemas estables
   ▼
src/architect/
  briefing/   brief-parser-contract, priorities, usage-scenarios
  site/       parcel, north, levels, constraints, context-scene
  climate/    adapters EPW/ERA5 optional, provenance, seasonal wind
  solar/      astronomical solver, samples, ray-shadows, overhang-analysis
  space/      graph adjacency, paths, sightlines, privacy, acoustic heuristics
  geometry/   footprints, 2D polygons/rooms, wall network, 2D-3D compiler
  variants/   concept grammar (compact, L, zones, courtyard if feasible)
  review/     hard gates, soft metrics, Pareto/trade-offs, counterfactuals
  decisions/  evidence ledger, scores with uncertainty, rationale
  reporting/  comparative sheets, annotated SVG/DXF, editable versioned models
   │
   ├── design/ (compatibilidad modelos v1; sin modificación de históricos)
   ├── arq3d/ (contornos, sólidos y capas verificadas)
   ├── project/ (identidad, fuentes, versiones, seguridad, .tannia)
   └── cad/ (exportaciones y verificación AutoCAD existentes)
```

**Abstracción:** `AlternativeGenerator` produce modelos válidos, `Evaluator` da métricas verificables y advertencias, `DecisionExplainer` compara. La IA puede sugerir alternativas y explicar, pero nunca modificar los números de evaluaciones deterministas. Los cálculos no provienen del texto del modelo.

### Interfaz de herramientas prevista (NO existentes aún)

| Herramienta sugerida | Propósito | Efecto |
|---|---|---|
| `tannia_arq_encargo` | Interpretar solicitud y crear/actualizar brief versionado (con propuesta de prioridades) | Escritura versionada al confirmar; análisis previo solo lectura |
| `tannia_arq_sitio` | Crear/leer contexto del predio, orientar norte, registrar fuentes y obstáculos | Escritura versionada |
| `tannia_arq_clima` | Importar EPW o consultar adaptador permitido; evaluar condiciones temporales con procedencia | Lectura/registro cacheado explícito |
| `tannia_arq_estudiar_sol` | Posición, sombras estacionales, aleros, escenarios de fecha/hora con estado de suficiencia | Solo lectura o reporte versionado |
| `tannia_arq_generar_alternativas` | Generar al menos 3 conceptos geométricamente/funcionalmente distintos cuando factibles | Nuevas versiones inmutables |
| `tannia_arq_evaluar` | QA geométrico, sitio, funciones, clima, vistas, costos proxy, seguridad y fuentes | Solo lectura / informe |
| `tannia_arq_comparar` | Matriz de diferencias, restricciones y frontera de Pareto; no escoger «ganador» opaco | Solo lectura |
| `tannia_arq_decisiones` | Mostrar por qué se hizo cada elección, evidencia, compromisos, preguntas profesionales | Solo lectura |
| `tannia_arq_refinar` | Aplicar orden natural de edición de objetivos/partido/ventanas/alero sin alterar otras versiones | Nueva versión |
| `tannia_arq_a_anteproyecto` | Publicar esquema escogido en modelo 2D/DXF/SVG y modelo 3D, sin sobrescribir | Nuevos artefactos bajo `03 Trabajo` |

Primero optimizar el número de herramientas y reutilizar las 61 existentes. No inflar el MCP innecesariamente; si una herramienta combina acciones, que las acciones destructivas/no destructivas se distingan sin ambigüedad.

## 5. Métodos de evaluación: qué se puede medir y qué no

| Dimensión | Cálculo MVP reproducible | Límite/verificación humana |
|---|---|---|
| Superficie | Unión de polígonos, área útil/construida, huella, perímetro/m² | Consideraciones de cómputo legal y tipologías especiales |
| Recorridos | Grafo de puertas/pasos, rutas transitables, distancias y cruces | Flujo real de personas y accesibilidad normativa |
| Adyacencias | Cumple/no cumple deseos explícitos; penalización por separaciones no deseadas | Jerarquía y calidad de transiciones espaciales |
| Luz solar directa | Solar azimut/elevación por coordenada, fecha y hora; intersección de rayos con volúmenes; muestra ventanas/patio | No equivale a iluminancia interior, glare, energía o norma de asoleamiento |
| Aleros | Geometría de proyección y sombreado estacional; comparar profundidad/días/horas | Confirmar fijaciones, carga de viento, mantenimiento, material y verano-invierno reales |
| Viento | Histograma estacional/hora de dirección y velocidad; exposición fachadas; potencial geométrico de aberturas | Sin CFD no predicción de caudales ni confort local de patio |
| Visuales | Ray-casting entre puntos de ojo y regiones objetivo; obstáculos reales modelados | La línea visual no sustituye presencia adulta, barreras y supervisión de niños |
| Privacidad | Evaluación geométrica ventanas-versus-vecinos/patios; vistas indeseadas | Juicio cultural, materiales, persianas y uso temporal |
| Economía | Índices: perímetro/área, nº quiebres y encuentros, cubierta compleja, recorridos sanitarios | Precio en CLP solo con APU/cubicación y precios reales verificados; no es presupuesto |
| Constructibilidad | Reglas: pendientes, solapes, desagües, losas, accesos, continuidad aproximada | Ingeniería estructural, proyecto hidráulico, suelos y cálculo profesional |
| Normativa | Matriz: requisito, fuente oficial, fecha, dato, verificable/no verificable | **Nunca «cumple»** sin profesional, documentos y método de acreditación adecuado |
| Calidad intangible | Observaciones y rationale: secuencia, intimidad, identidad, apropiación, percepción | Juicio de usuaria y profesional; no convertir en falso decimal 9,8/10 |

### No usar puntaje único sin contexto

* Separar **restricciones duras** (si fallan bloquean la alternativa) de **preferencias ponderadas** (negociables, con pesos conocidos) y de **aspectos no evaluados**.
* Comparar alternativas en una **frontera de Pareto** cuando hay conflictos, no escoger la que tenga una suma ponderada arbitraria. Si un objetivo no tiene métrica válida, no sumar cero ni cien: marcar `no_evaluado`.
* Un sistema con riesgos críticos pendientes no puede presentar estado global «excelente», «apto para construcción» o «cumple normativa».
* El modelo debe poder decir: «No puedo escoger entre la opción L y compacta sin conocer el tamaño del terreno; puedo mostrarte conceptos provisionales».

## 6. Contratos de pruebas invariantes

1. Misma solicitud+fuentes+semilla+versión de motor ⇒ mismas opciones y métricas (excluyendo metadatos temporales).
2. Distintos proyectos no comparten datos, preferencias, rutas ni decisiones; no se sobrescribe v001.
3. Las alternativas «A» y «B» espejadas **no cuentan** como topologías genuinamente distintas. Usar huella normalizada, grafo de adyacencia y concepto, no solo nombre o área.
4. Una casa L tiene área de huella real y una losa de 3D con **vacío sin material** en la zona de patio; su bbox puede ser mayor, su área NO puede calcularse como área de bbox.
5. Sin norte verdadero/latitud/longitud: ninguna afirmación numérica de horas de sol reales; informe de insuficiencia y modo hipótesis expresamente etiquetado.
6. Chile sur: junio vs diciembre con geometría solar distinta, azimut cardinal correcto y horario/DST IANA sin errores de signo.
7. Un alero adicional no puede por defecto reportar aumento de sol directo bajo las mismas geometrías y fechas; no confundir muestreo insuficiente con certeza.
8. Piscina visible desde cocina: comprobar línea visual con obstáculos y alerta de **barreras independientes**. Una puerta directa hacia piscina sin control de acceso debe bloquear «seguridad demostrada».
9. Si hay vecinos/obstáculos de altura desconocida, estimación de sombra de contexto = `no_concluyente`.
10. Ninguna alternativa con recinto sin acceso, vano invalidado, muro/losa con solape o geometría inestable llega a DWG.
11. `tannia_arq_refinar` cambia solo lo comprometido por la decisión; versiones de diseño, JSON, DXF, 3D y evidencia deben referenciar hashes consistentes.
12. Si un proveedor climático falla, funcionamiento offline preservado, sin invención de datos ni ejecución de scripts externos descargados.
13. Test de manipulación: un PDF/CIP no puede redefinir las instrucciones del agente ni provocar salida del sandbox.
14. Métodos y datos con incertidumbre conservan estado en exportación y no se convierten mágicamente en «verificados».
15. El QA profesional de 15+ encargos tiene criterios separados para uso, estética/espacio, geometría, ambiente, seguridad y comunicación, sin autovalidación del implementador.

## 7. UX ideal de una conversación real

**Solicitud:** «Quiero una casa en L. Mis hijos juegan cerca de la piscina y quiero verlos desde la cocina. Que el living se abra al jardín y tenga luz, pero sin que nos cocinemos en verano».

**Respuesta deseable sin terreno:** «Te preparé tres ideas distintas: una L que abraza el patio, una compacta y una de dos alas. La L facilita la relación cocina-patio, pero necesita revisar costos y cubiertas. Como no tengo orientación ni plano del terreno, no te voy a inventar el sol: puedo mostrar el esquema y, cuando me des la ubicación/norte, analizar aleros y sombras de invierno/verano. Respecto de la piscina, mirar desde la cocina ayuda a vigilar visualmente, pero no sustituye una barrera segura ni la supervisión activa».

**Respuesta con predio y datos válidos:** tabla breve de alternativas, 3 decisiones explicadas, 2 riesgos, 1 pregunta esencial; adjuntos DWG/SVG y reporte de evidencia con referencias. Debe ser capaz de decir «No sé» con precisión y de proponer qué evidencia obtener.

## 8. Reglas de modificación del sistema existente

- Mantener TW-09 PR #11 en draft; no sobrescribir su rama, ni `main`, ni alteraciones existentes de proyectos reales.
- Introducir esquema `tw.arch.scheme/2` con **lectura histórica v1 sin migraciones destructivas**; si hay migración, generar copia versionada y comparar resultados.
- Asegurar salida CAD por contratos y no por capturas de pantalla; priorizar estudios comprobables en Node, después prueba real AutoCAD.
- Prohibido afirmar que la capa razona *como un arquitecto habilitado*, que un plano ha sido revisado cuando no lo fue, o que una aproximación solar es una simulación validada de energía.
- Descomponer la implementación por gates; el auditor independiente revisa evidencia y defectos, no aprueba el autor sus propias entregas.
