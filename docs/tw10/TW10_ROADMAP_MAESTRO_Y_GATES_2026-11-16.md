# TANNIA WORKSPACE — TW-10
## Roadmap maestro: Motor de Razonamiento y Diseño Arquitectónico Asistido
**Aprobación de alcance:** Product Owner, 2026-11-16  
**Estado técnico:** por implementar · **Baseline de análisis:** `eb76789`, PR #11 draft  
**Total planificado:** **11 subfases, 45 historias, 11 gates** (`G0` a `G10`).

## Objetivo principal

Que Tannia pueda pedir, por ejemplo, «diseña una casa de 90 m² en L, con living luminoso, jardín protegido de los vientos, vista a la piscina desde la cocina y aleros para verano», y obtener **múltiples partidos arquitectónicos físicamente distintos y razonados**, un análisis honesto por familias de criterios, planos 2D/DWG y volúmenes 3D coherentes, sin inventar contexto del terreno ni declaraciones normativas.

El motor debe poder trabajar **sin terreno conocido** con alternativas conceptuales claramente etiquetadas como tales. Para presentar evaluación climática real exige latitud/longitud, norte verificado, fechas/horas y fuente. Para emitir restricciones urbanísticas exige CIP/IPT o fuente oficial confirmada. Nunca confundir propuesta arquitectónica, precisión geométrica, persistencia CAD y autorización profesional.

## Dependencias y reglas de trabajo

- Branch independiente propuesta: `feat/tw10-architectural-reasoning`, en worktree separado. Basar en cabeza revisada de TW-09 con PR apilado; si TW-09 cambió, revalidar contratos y stack antes de comenzar. No usar `main` como base ficticia.
- No modificar PR #11, rama de un implementador activo ni proyectos reales; proyecto descartable en carpeta temporal para QA.
- Preservar compatibilidad con modelos y proyectos v1; nuevas alternativas `scheme/2` con migración por copia, nunca destructiva.
- No alterar el motor COM de TW-09 salvo defectos bloqueantes reproducidos y autorizados; separar sus incidencias del alcance arquitectónico.
- Tests de diseño + integración DXF/3D + CI Windows/Ubuntu + prueba Claude Desktop/AutoCAD en equipo real; no autosellar gates de campo.
- La importación de documentos no acredita contenido ni normativas; documentar permisos, licencia y fuente. Arquitecto/ingeniero humano mantiene responsabilidad.

## G0 — TW10-00: baseline, contratos y diseño de pruebas (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-00-01 | Confirmar HEAD, PR #11, árbol y suites reales; matrices `generador→derivar→coherencia→salidas→puente3d→CAD`, con archivos/versión. |
| TW10-00-02 | Baselines de regresión con fixtures TW-09: Casa Los Robles, Prueba 3D, geometría/vanos, seguridad y transacciones; no escribir en esos proyectos reales. |
| TW10-00-03 | Contratos Zod `brief/1`, `site/1`, `weather/1`, `scheme/2`, `decision/1`, `analysis/1`; política de dato confirmado/supuesto/no conocido. |
| TW10-00-04 | ADR de dependencias y licencias: Node nativo vs librerías solares, clima EPW/ERA5 opcional, Python solo tras decisión y empaquetado. |

**Gate G0:** baseline reproducible; regresiones antiguas verdes; schemas versionados, fixtures y matriz de compatibilidad; cero pruebas de hardware falsamente aprobadas.

## G1 — TW10-01: brief funcional y vida cotidiana (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-01-01 | `ArchitecturalBriefV1`: espacios, usuarios/actividades, prioridades, presupuesto indicativo, acceso, objetivos cualitativos. |
| TW10-01-02 | Gramática y clasificación del encargo: hechos, deseos, requisitos duros, preferencias negociables, incógnitas, prohibiciones. |
| TW10-01-03 | Grafo de relaciones: privacidad, cercanía funcional, circulación, relación cocina-living-patio, visual piscina, acústica, adaptación futura. |
| TW10-01-04 | Persistencia por proyecto, versionado y validación del brief; cambios en conversación explican qué restricciones se modificaron. |

**Gate G1:** pruebas de frases libres frente a brief tipado, sin inventar tamaños/emplazamiento; inputs ambiguos generan pregunta esencial, no plantilla disfrazada de análisis.

## G2 — TW10-02: terreno y regulación contextual (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-02-01 | Modelo de predio: polígono, acceso, deslindes, calles, cotas, pendientes, árboles, vecinos, obstáculos 3D y puntos de vista; unidades y referencia local. |
| TW10-02-02 | Referencia geográfica, norte verdadero, lat/lon, elevación opcional, zona horaria IANA, orientación de dibujo y transformaciones reproducibles. |
| TW10-02-03 | Repositorio de evidencias: CIP/PRC y fuentes oficiales versionadas, dato/no conocido/interpretado/confirmado; extracción solo con validación. |
| TW10-02-04 | Validadores de huella, acceso, topografía y requisitos urbanísticos **solo cuando exista fuente aplicable**; lista de antecedentes faltantes. |

**Gate G2:** polígono real y contexto referenciados; si falta CIP no se dice «cumple»; si falta norte no se dan horas solares del predio; archivos fuente intactos.

## G3 — TW10-03: clima e interpretación solar de base (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-03-01 | Motor solar con referencias NREL SPA y tests cruzados: latitud, longitud, fecha, UTC, verano/invierno austral, azimut/elevación y polaridad cardinal. |
| TW10-03-02 | Importador EPW con fuente, cobertura, año, estación, valores ausentes, clima horario y representatividad declarada. |
| TW10-03-03 | Adaptador opcional Open-Meteo/ERA5: permiso, atribución/plan comercial, caché local, sin dependencia obligatoria de Internet. |
| TW10-03-04 | Perfiles por estación de T, humedad, viento y radiación; rosa de vientos y distinción viento regional vs microclima de sitio. |

**Gate G3:** exactitud astronómica razonablemente contrastada con fuente independiente; timezones y DST probados; clima ausente/no representativo ≠ clima validado.

## G4 — TW10-04: modelo espacial y geometría multi-topología (5 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-04-01 | `ArchitecturalSchemeV2`: huella poligonal ortogonal, patios, vacíos, recintos, redes de muros, puertas/ventanas y relación con lote. |
| TW10-04-02 | Algoritmos robustos de unión/recorte y asignación: rectangular, L real, doble ala, patio; áreas, límites y no solapamiento. |
| TW10-04-03 | Integración `derivar/coherencia/salidas` genérica: DXF/SVG con muros, cotas, aberturas, recintos y perímetros exactos, sin bbox falso. |
| TW10-04-04 | Puente 2D→3D con losa basada en **huella real**, aberturas y alturas; la cubierta plana poligonal queda soportada, inclinadas L requieren solución válida o rechazo explícito. |
| TW10-04-05 | Compatibilidad v1, convertidor por copia, test de versiones/rollback y no intervención de dibujos antiguos. |

**Gate G4:** L 2D/3D con **patio vacío real**, cotas, área y volumen correctos; DXF legible; al menos un fixture L y uno rectangular antiguos; el techo no puede tapar ni cambiar huella sin aviso; no se usan falsos rectángulos.

## G5 — TW10-05: generación de partidos alternativos (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-05-01 | Gramáticas de partido: compacto, L con patio, dos alas, patio/pabellones si el predio permite; cada una con lógica espacial. |
| TW10-05-02 | Generación determinista reproducible por semilla y constraints: circulación, relaciones, áreas y límites de sitio; sin reintentos aleatorios ilimitados. |
| TW10-05-03 | Criterio formal de **diversidad real**: clase de huella, topología de conexiones y distribución de recintos; espejo no cuenta como opción nueva. |
| TW10-05-04 | Selección/edición por «partido», no solo mover ventanas; emitir >=3 alternativas cuando factibles o error razonado si no. |

**Gate G5:** para fixture plausible Casa Los Robles con sitio conocido, 3 alternativas válidas y al menos 2 conceptos de huella/topología genuinamente distintos; cada una difiere por decisiones, no etiquetas; no afirmar que son igualmente apropiadas.

## G6 — TW10-06: análisis ambiental y estrategias pasivas (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-06-01 | Sombra por ray-casting: sol de invierno/verano, fachada/patio/aberturas, obstáculos y aleros con reloj y norte correctos. |
| TW10-06-02 | Sugerencias y estudio de aleros, profundidad y posición; comparar verano/invierno sin tratar luz solar como iluminancia o desempeño energético. |
| TW10-06-03 | Exposición a viento y potencial de ventilación según rosa estacional, pares de vanos practicables y privacidad/ruido; no CFD. |
| TW10-06-04 | Resumen ambiental con pérdidas/incertidumbre y oportunidades de materialidad/envolvente; conectores avanzados solo opcionales mediante ADR. |

**Gate G6:** verano/invierno Chile, aleros, orientación, autosombra y patio probados en fixtures con oráculo independiente; resultados insuficientes bloquean conclusión. Pruebas de regresión por rotar la casa y por cambiar solo orientación del norte.

## G7 — TW10-07: habitabilidad, seguridad y experiencias (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-07-01 | Recorridos y proximidades: trayectos libres y útiles; acceso del exterior, cocina-comedor, baños, dormitorios, compras/lavado; obstáculos y puertas. |
| TW10-07-02 | Vistas/visibilidad y privacidad: cocina→piscina, living→jardín, vecinos→dormitorios, según escenas con alturas y ocultaciones. |
| TW10-07-03 | Reglas de uso y seguridad: piscina = alerta de barrera y supervisión, puertas no bloqueadas, rutas de emergencia preliminares, accesibilidad y calidad acústica **sin suplantar acreditación normativa**. |
| TW10-07-04 | Constructibilidad/costo relativo: perímetro/área, quiebres, complejidad cubierta, instalaciones, agua lluvia, mantenimiento, estructuras irregulares como advertencia. |

**Gate G7:** vista de piscina comprobada/obstruida con rayos; mostrar vista nunca anula advertencia de barrera; variante L trae ventaja y desventaja; no presupuesto ni resistencia sísmica inventados.

## G8 — TW10-08: motor crítico y bitácora de decisiones (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-08-01 | `Evaluator`: hard constraints, soft preferences, no evaluados; diagnóstico independiente de la plantilla generadora. |
| TW10-08-02 | Evaluación multiobjetivo: ponderaciones visibles, Pareto y conflictos, sensibilidad a peso/preferencia, no puntaje mágico 100%. |
| TW10-08-03 | `DecisionLedger`: «decisión→objetivo→fuente/cálculo→alternativas→tradeoff→confianza→quién revisa», sha/método/fecha/versión. |
| TW10-08-04 | Modo crítico («abogado del diablo»): explicar falla espacial, normativa pendiente, condiciones donde otra opción gana, counterfactuales sin inventar datos. |

**Gate G8:** auditable por tercero; cambio de prioridad puede reordenar alternativas o explicar por qué no cambia; sin fuente la evaluación queda no concluyente. No se aprueba solo por texto convincente.

## G9 — TW10-09: experiencia conversacional y publicación CAD (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-09-01 | MCP tools arquitectónicas y enrutador: naturalidad, mínimo de preguntas esenciales, errores con contexto, respuestas breves. |
| TW10-09-02 | Comparación visual de tres esquemas con croquis SVG, diagramas sol/sombra, matrices y notas, almacenadas como versiones editables. |
| TW10-09-03 | `refinar` por objetivo: nuevas versiones sin mutar alternativas anteriores; cambios causales y análisis afectado recalculado. |
| TW10-09-04 | Publicación opción elegida: DXF/SVG/DWG 2D y DWG 3D, referencias de modelo, anteproyecto y estudio, versiones inmutables. |

**Gate G9:** encargos libres sin JSON, modelos y dibujos coherentes, 61 herramientas anteriores sin regresión de esquema, empaquetado `.mcpb` correcto Windows Unicode, nunca reemplaza versiones existentes.

## G10 — TW10-10: QA de campo y revisión arquitectónica independiente (4 historias)

| Historia | Resultado exigido |
|---|---|
| TW10-10-01 | CI completo Windows/Ubuntu, pruebas deterministas, property-based para polígonos, fuzz de rutas, proceso real/locks; seguridad de originales. |
| TW10-10-02 | En AutoCAD 2027 real: al menos una propuesta L + compacta con 2D/3D, contornos, losas, sólidos, capas, guardado, cierre/reapertura y `AUDIT`. |
| TW10-10-03 | Taller con Tannia y profesional de arquitectura independiente: >=15 encargos contrastantes, puntajes cualitativos por criterio, rechazo documentado y sin confundir estética con geometría. |
| TW10-10-04 | Dossier final: límites, fuentes, versiones, evidencia de uso real, pendientes y decisión explícita del PO; sin merge/despliegue automático. |

**Gate G10:** CI + validación real + revisión profesional independientes; sin retocar retroactivamente evidencias; si falla cualquiera, RC parcial y PR draft.

## Escenarios obligatorios de aceptación profesional

1. Casa 90 m² sin terreno: alternativas conceptuales **sin** prometer norte, sombra real o cumplimiento urbanístico.
2. Mismo programa con terreno 12×28 m y acceso por uno de los extremos: distribución responde a acceso y tamaños, y explica imposibilidad si existen constraints.
3. Terreno con norte verificado en Chile: estudio de junio/diciembre y alero con geometría cuantificable y fuente de solar position.
4. «Casa en L con patio»: recintos conectados, área correcta, vacío visible en 2D y 3D; cubierta resuelta o explícitamente no soportada.
5. «Quiero ver la piscina desde cocina»: visual real; si se bloquea con un muro, informe diferencia; nunca clasificar piscina segura solo con vista.
6. «Privacidad en dormitorios aunque haya vista»: analizar objetivos conflictivos, no crear vidrios enfrentados a vecinos sin advertir.
7. «Quiero pocas circulaciones»: disminuir área de pasillo sin perder acceso ni privacidad necesaria; justificar compensaciones.
8. «Vientos fuertes de invierno»: caracterizar fuente regional y proponer refugio, sin inventar viento local.
9. «Quiero ahorrar»: comparar índices de envolvente/cubierta y reconocer falta de precios sin CLP falsos.
10. «Tengo CIP sin escala legible»: abstenerse de afirmar condiciones/medidas; pedir documento o escala validada.
11. Cambio posterior del programa: conservar versiones/otros proyectos; recalcular solo lo afectado.
12. Cambio de orientación del terreno: recalcular solares/vistas coherentemente sin alterar geometría local por accidente.
13. Test de cambios de hemisferio: Buenos Aires/Santiago vs Madrid, estaciones/calendario y signos correctos.
14. Test proyecto histórico v1 y DWG previo: lectura completa y hash intacto.
15. Test contra instrucciones hostiles embebidas en PDF/EPW: no ejecutar comandos ni abandonar sandbox.

## Definición de MVP y corte de valor

**MVP de TW-10 = G0–G9 con verificación local y al menos un piloto G10 iniciado**, sin simular ambiente interior avanzado. Permite sitio, alternativas auténticas, sol/sombra geométricos, clima de referencia, recorridos/vistas y decisiones. Los conectores costosos de Radiance/EnergyPlus/Rhino/Forma no son dependencias del MVP; futuros módulos especializados solo con fuente, licencia y fixture.

**Release para uso profesional asistido = gate G10 completo** con Tannia, arquitecta/o revisor, AutoCAD real, original intacto, matriz de capacidades y autorización del PO. Incluso entonces: anteproyecto revisable; no documentación lista para construcción sin validaciones específicas.

## Riesgos de ejecución y mitigaciones

- **R01: salto brutal de geometría**. Mitigar con esquema v2, pipeline paralelo y compatibilidad v1; no refactor big-bang.
- **R02: decisiones AI persuasivas sin cálculo**. Mitigar con rationale estructurado, evidence ledger y valores solo desde herramientas.
- **R03: simulación climatológica falsa**. Mitigar con estados ausente/regional/estimado/validado y ejemplos negativos.
- **R04: dependencia en servicios de terceros**. Mitigar con adaptadores, caché verificable, modo offline y licencias validadas.
- **R05: retraso del 2D↔3D real**. Mitigar con gate L/patio antes de software experto; reuse del motor 3D existente.
- **R06: riesgo normativo/estructural**. Mitigar con bloqueo de lenguaje de certificación y revisión profesional por disciplina.
- **R07: «opciones distintas» solo cosméticas**. Mitigar con test de topología y motivación causal.
- **R08: complejidad demasiado grande para la usuaria**. Mitigar con respuesta breve + detalle bajo demanda + comparativa editorial de 3 alternativas.

## Criterios de independencia

La persona/agente implementador puede ejecutar pruebas y marcar que un *gate técnico automatizado* pasó, pero **no puede autoaprobar una auditoría profesional ni la validación AutoCAD real**. El Product Owner decide merges y releases. La entidad de revisión independiente verifica los archivos, CI, fixtures, metodología y, finalmente, las sesiones reales.
