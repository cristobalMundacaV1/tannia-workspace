# TANNIA WORKSPACE — TW-10
## Investigación profesional y auditoría del motor arquitectónico
**Fecha:** 16 de noviembre de 2026  
**Estado:** Directiva de producto aprobada por el PO; diseño y ejecución sujetos a gates  
**Repositorio:** `cristobalMundacaV1/tannia-workspace`  
**Baseline auditado:** `eb767891fe2dacbb4d3070653b1353ebde245243`, PR #11 (draft, apilado sobre `feat/tw-modelo-3d`)  
**Alcance:** investigación y especificación, sin modificación de código ni PR en esta entrega.

## 1. Decisión de producto

**TW-10 transforma Tannia Workspace de un generador paramétrico de planta única a un asistente de diseño arquitectónico asistido por razonamiento, basado en datos, alternativas, restricciones y trazabilidad.** El núcleo comprende el *encargo humano*, el *lugar*, el *clima*, los *recorridos*, la *experiencia espacial*, la *seguridad*, la *factibilidad constructiva*, los *costos relativos* y las *compensaciones*. El sol y el viento son dimensiones de análisis, no el centro del producto.

No se pretende que una IA sea un arquitecto legalmente habilitado ni que decida la seguridad o la conformidad de una obra. El sistema formulará propuestas de **anteproyecto**, con supuestos explícitos y revisión de una persona profesional responsable. La meta es que una persona diga: «Quiero una casa en L, con un patio que vea desde la cocina y el living fresco en verano, sin perder el sol de invierno» y reciba diseños distintos, sustentados en hechos disponibles, sin inventar orientación de lote ni clima.

## 2. Investigación de herramientas y decisión de integración

| Herramienta / referencia | Capacidades verificadas | Aplicación realista en TW-10 | Restricción/decisión |
|---|---|---|---|
| **Autodesk Forma** | Análisis temprano de horas de sol, potencial de luz natural, viento y microclima; análisis de emplazamiento y contexto. | Referente de producto: comparar escenarios y evidenciar clima/sombra al momento de diseñar. | Producto/plataforma independiente; **no asumir API, licencia, ejecución embebida ni conexión con AutoCAD**. Usar como benchmark, no dependencia MVP. |
| **Ladybug Tools** | EPW, trayectoria solar, sombras, radiación, rosas de viento, clima, confort adaptativo, vistas. | Benchmark técnico y posible adaptador opcional para interpretación de EPW y verificaciones. | Ecosistema mayormente Python/Grasshopper. `ladybug-core` con licencia **AGPL-3.0** en el repositorio consultado: revisar obligaciones antes de redistribuir e incluir dentro de `.mcpb`. No copiar código ciegamente. |
| **Honeybee** | Simulaciones de iluminación natural con Radiance y energía con OpenStudio/EnergyPlus. | Referente y futuro adaptador experto para evaluar días/horas de luz, deslumbramiento y demanda energética. | No presentar estos resultados si no se ejecutó el motor. Dependencias técnicas y validación propias. No imprescindible para el primer MVP. |
| **ClimateStudio (Solemma)** | Daylight, glare, energía, radiación, confort y vistas sobre Rhino. | Benchmark de métricas y visualización comparativa. | Comercial y requiere Rhino; no es plug-in gratuito embebible en Tannia Workspace. |
| **TestFit / herramientas de factibilidad** | Análisis de predio, normativa, entorno, viabilidad y generación de opciones. | Benchmark de evaluación temprana; distinguir restricciones urbanísticas de preferencias. | No asumir integración ni datos locales actualizados; el Chile regulatorio exige CIP/PRC y fuentes oficiales. |
| **NREL/NLR Solar Position Algorithm (SPA)** | Referencia documentada para calcular posición del sol a partir de fecha, hora y ubicación. | Oráculo independiente para pruebas de trayectoria solar en Chile y distintas latitudes. | Elegir implementación compatible con Node, revisar su licencia; el algoritmo no calcula por sí solo edificios vecinos, clima ni luz interior. |
| **pvlib-python** | Cálculos solares y energéticos con licencia BSD-3-Clause. | Candidato para un adaptador posterior o validación cruzada. | Requiere Python y dependencias científicas: **no añadir runtime Python al `.mcpb` sin ADR, build Windows real y empaquetado probado**. |
| **EPW / EnergyPlus** | Datos climáticos de año meteorológico y motor de simulación energética especializado. | Estándar de intercambio de clima; futuro análisis de energía, tras validar entradas, límites y licencias. | Un EPW no es clima medido en el terreno; registrar estación, periodo, cobertura y procedencia. EnergyPlus no viene con el MCP actual. |
| **Open-Meteo Historical API (ERA5/ERA5-Land)** | Series horarias históricas de temperatura, viento, humedad y radiación. | Adaptador opcional de clima regional; generar rosas de viento por estación y perfiles horarios trazables. | Datos reanalizados, no medición microclimática del predio. Revisar atribución y términos/plan comercial antes de usar en producto distribuido. Sin red debe funcionar con EPW validado o declarar ausencia. |
| **MINVU (OGUC, nueva RT, manuales DITEC, CVS)** | Marco regulatorio, zonificación térmica, referencias de diseño y sustentabilidad de viviendas. | Fuentes de restricciones y banderas de revisión; generar lista de antecedentes pendientes por predio. | Normativa depende de fecha, predio, comuna, IPT, altitud y caso. **No certificar cumplimiento sin documentos, cálculo especializado y profesional**. |
| **RIBA Plan of Work; AIA Framework for Design Excellence** | Modelos profesionales de briefing, conceptos, coordinación, evaluación integrada y revisión durante el ciclo de vida. | Orden de la capa de razonamiento; separar objetivos, opciones, evaluación, iteración y responsabilidad. | Marco de proceso; no son algoritmos de planta ni sustituyen reglas chilenas. |

### Prioridades de integración

1. **Primero, motores propios deterministas ligeros y testables en Node:** coordenadas de emplazamiento, norte verdadero, geometría ortogonal/escena, trayectoria solar calculada y contrastada, sombras por rayos, adyacencia/circulación, visibilidad, matriz de decisión. No introducir un gran SDK ni servicios pagos para poder empezar.
2. **Segundo, clima importable o consultable por adaptadores:** EPW y, opcionalmente, Open-Meteo (sujeto a permiso de red, atribución y condiciones de uso). El cálculo de viento será **exposición/potencial**, no CFD ni una estimación de renovación de aire validada.
3. **Tercero, simulación especializada opcional:** Radiance/Honeybee/EnergyPlus, solo después de demostrar exportación fiel, contratos reproducibles, dependencias, licencias y comparación con resultados de referencia. No bloquear la autonomía local ni el diseño base.
4. **Nunca inferir datos urbanos verificables del nombre de una comuna**, ni generar una supuesta ficha CIP/PRC oficial. El usuario debe aportar documento válido o consultar fuente oficial identificada.

## 3. Qué considera una persona arquitecta en un proyecto real

La arquitectura no es maximizar insolación. Es **negociar condicionantes** y crear una experiencia espacial habitable, segura y construible. TW-10 debe examinar, por lo menos, las siguientes 17 familias:

1. **Personas y vida cotidiana:** habitantes, edades, necesidades de movilidad, rutinas, teletrabajo, visitas, mascotas, expectativas futuras, conflictos y jerarquía de deseos; evitar datos personales innecesarios.
2. **Programa y jerarquía:** espacios requeridos, tamaños aproximados, privacidad, relación día/noche, frecuencia de uso, posibilidad de usos mixtos y ampliaciones.
3. **Relaciones y secuencias:** proximidad cocina-comedor, baño-dormitorios, ropa-lavado, llegada del auto, compras, basura, visitas; recorridos sin cruces innecesarios.
4. **Calidad espacial:** proporciones, altura, luz, visuales, amplitud percibida, escala, umbrales, patios, transición interior/exterior, secuencias de apertura y recogimiento.
5. **Emplazamiento:** forma y tamaño real, pendientes, niveles, suelo, vegetación, árboles patrimoniales, accesos, vistas, vecinos, ruidos, servidumbres, riesgos y redes de servicios.
6. **Normativa y planificación:** CIP, PRC/IPT aplicable, uso de suelo, ocupación, constructibilidad, rasantes, distancias, alturas, accesibilidad cuando corresponda, derechos y afectaciones; estado de verificación por documento y fecha.
7. **Asoleamiento y sombra:** recorrido solar de verano/invierno, orientación real, ventanas por azimut, protecciones, árboles y obstrucciones, penetración de sol, deslumbramiento potencial y compromiso entre luz/calor.
8. **Clima y confort térmico:** temperatura horaria/estacional, radiación, humedad, inercia, envolvente, aislación, ventilación mecánica/natural, riesgo de condensación y mantenimiento; no confundir sombra con demanda energética.
9. **Viento y ventilación:** rosa estacional, oportunidad de ventilación cruzada, aperturas practicables, protección de patios y accesos; topografía y edificios pueden cambiar el viento local.
10. **Agua y paisaje:** pendiente/escorrentía, inundación, infiltración, manejo de aguas lluvia, sequía, jardines, suelo permeable, vegetación y requerimientos hídricos.
11. **Acústica y privacidad:** dormitorios lejos de ruido, vistas cruzadas entre vecinos y recintos, intimidad desde el acceso, olores y extracciones.
12. **Seguridad y cuidado:** evacuación, accesos seguros, niños, piscinas, incendios y rutas accesibles según contexto; línea de visión a piscina **no sustituye barreras y supervisión activa**.
13. **Materialidad y sistema constructivo:** disponibilidad local, estructura compatible con forma, puentes térmicos, durabilidad, mantenibilidad y coordinación con especialidades.
14. **Constructibilidad:** complejidad de cubierta, encuentros, cantos, impermeabilización, longitudes de ductos, disposición de muros, fundaciones y secuencia de obra.
15. **Economía y valor:** superficie útil/neta, perímetro expuesto por m², complejidad de cubierta, cantidad de quiebres, costo **relativo** si faltan precios reales, operación y mantención.
16. **Inclusión y resiliencia:** autonomía de diferentes usuarios, envejecimiento en casa, posibilidad de adaptación, riesgos climáticos, cortes de energía y condiciones de vida futuras.
17. **Proceso de diseño:** alternativas suficientemente diferentes, explicación, evaluación, negociación de compensaciones, feedback de usuario y revisión coordinada de arquitectura/estructura/especialidades.

### Matriz del razonamiento (ejemplos)

| Deseo | Decisión espacial candidata | Evidencia y prueba | Conflicto relevante | No afirmar sin más datos |
|---|---|---|---|---|
| «Living con mucha luz, pero sin calor intenso en verano» | Orientar vanos según sol real; diseñar alero ajustable por estación; reconsiderar poniente | Posición solar por fecha/hora/lat-lon, sombra propia/contexto, horas estimadas de sol directo | Ganancia invernal vs sobrecalentamiento, vistas, presupuesto | «Confort térmico garantizado», «sin deslumbramiento», «ahorro energético» |
| «Casa en L que proteja patio» | Volúmenes en dos alas, patio orientado a viento/vistas | Geometría L auténtica, sombras estacionales, campo de visión | Mayor envolvente, cubiertas más complejas, posibles irregularidades sísmicas | «Es más sismorresistente» o «cumple rasantes» |
| «Desde cocina quiero ver piscina y niños» | Abertura/ubicación de cocina con línea visual al exterior | Ray-casting desde altura de ojo a zona de piscina; obstáculos, distancia, ángulos | Privacidad, radiación, circulación; seguridad infantil | «Piscina segura» solo por tener visual |
| «Ventilación natural en verano, sin viento frío en invierno» | Pares de vanos practicables y resguardo de accesos | Rosa de viento regional estacional y grafo de aperturas | Ruido, privacidad, higiene del aire, lluvia | «Ventilación cruzada eficaz cuantificada» sin modelo físico |
| «Pocos pasillos, más espacios útiles» | Compactar circulaciones con acceso claro a recintos | % superficie de circulación, grafo de puertas, rutas accesibles y distancias | Privacidad, acústica, iluminación interior | «Mejor planta» sin evaluar los demás objetivos |
| «Quiero gastar poco» | Comparar compacto vs L, simplificación de cubierta | m² brutos/útiles, perímetro por m², quiebres, materialidad preliminar | Espacios exteriores protegidos y expansión futura | Precio en CLP sin cubicación, materiales y precios confirmados |

### Precaución para hemisferio sur

En Chile la referencia de sol predominante al mediodía suele estar hacia el **norte geográfico**, no hacia el sur como en los diagramas del hemisferio norte. La posición precisa depende de **latitud, fecha, hora y orientación real del predio**. No se deben copiar heurísticas de libros/diagramas del hemisferio norte invirtiéndolas sin cálculo. Las estaciones se prueban en torno a solsticio de **junio (invierno austral)** y **diciembre (verano austral)**. Una fachada «norte» de un plano sin norte verificado no demuestra orientación solar efectiva.

## 4. Auditoría de código: hechos, efecto y ruta de mejora

| ID | Hallazgo verificado en baseline | Consecuencia real | Respuesta de TW-10 |
|---|---|---|---|
| A01 | `src/design/generador.js` fija tres franjas y un pasillo entre zonas; A/B son espejo. | Distintos encargos con mismo programa crean prácticamente el mismo plano. | Generador de **topologías arquitectónicas diferentes**, búsqueda por restricciones y diversidad real. |
| A02 | `src/design/servicio.js::crear()` guarda `solicitud` como texto de trazabilidad pero llama `generarModelo(programa)` sin objetivos cualitativos. | Deseos como luz, supervisión, patio o privacidad no alteran la planta de forma causal. | Brief tipado con prioridades, restricciones, procedencia y objetivos verificables. |
| A03 | `src/design/modelo.js` usa árbol de divisiones de **un rectángulo**; `calcularRects` genera recintos rectangulares. | No expresa fielmente una planta con vacío exterior/patio en L ni un solar irregular. | Modelo de huella poligonal ortogonal y descomposición topológica; migración del formato v1 sin alterarlo. |
| A04 | `src/design/derivar.js` computa contorno exterior con `AX + te`, `AY + te`, sobre una caja rectangular. | Área y perímetro actuales no describen una casa L o patios. | Geometría de huella poligonal, límites, áreas, perímetros, muro exterior y vacíos calculados desde polígonos. |
| A05 | `src/design/salidas.js` usa `geo.exterior` rectangular para límites, ejes, cotas y SVG/ASCII. | No se puede representar integralmente una L en el flujo 2D actual. | Refactor de renderers DXF/SVG y plano de ubicación a partir del modelo espacial genérico. |
| A06 | `src/arq3d/geometria.js` **sí soporta losas con contorno ortogonal y las descompone en prismas**; también muros/vano por ejes. | Hay potencial para casa en L si el modelo 2D genera contorno/losas/muros válidos. | Reusar motor 3D y probar extremo a extremo; cubiertas inclinadas no rectangulares requieren estrategia propia. |
| A07 | `src/arq3d/desde_anteproyecto.js` toma contorno de **bbox** de `geo.rectsMuro` para una losa. | Convertir una planta L a 3D mediante el puente actual taparía su patio con una losa rectangular. | Losa según huella real, no bbox; pruebas de vacíos, área, volumen y aberturas. |
| A08 | `src/design/coherencia.js` comprueba solapes, áreas, vano, barridos y acceso; las advertencias de diseño son heurísticas básicas. | Buena base de QA geométrica, pero insuficiente para calidad espacial, clima, vistas, costo, seguridad o normativa. | Validadores por familias, separados en restricciones duras y análisis consultivos. |
| A09 | `src/conocimiento/criterios.js` contiene espesores, dimensiones mínimas de práctica, relación vano/piso y aviso de no normativo. | Conocimiento valioso, pero sin versión por jurisdicción, fuentes por decisión, incertidumbre o cargas climáticas. | Registro versionado de criterios con vigencia, fuente, ámbito, método y severidad. |
| A10 | `src/design/operaciones.js` edita recintos/vanos/separaciones dentro de árbol y mantiene versiones. | Las operaciones de refinamiento son útiles, pero no permiten cambios globales de partido como rectangular→L. | Comandos de composición espacial por alternativas, plus adaptador de operaciones v1; nunca sobrescribir v001. |
| A11 | `src/project/gestion.js` aporta proyectos, identidad, importación local y manifiesto. | Buen soporte para archivos de terreno/CIP; **importar no equivale a comprender ni validar** su contenido. | Intake con extracción asistida, revisión de fuentes, controles de origen, no inferir información sin evidencia. |
| A12 | `src/politica/autonomia.js` gestiona actuar/suponer/preguntar/detenerse, pero enrutador está centrado en vivienda rectangular y modelo 3D. | La conversación puede sonar autónoma aunque no haya análisis de diseño real. | Enrutador de diseño arquitectónico con gates de predio, prioridades, posibilidad de estudio conceptual sin datos, y reporte de incertidumbre. |
| A13 | No se observa un módulo explícito de predio georreferenciado, clima, norte real, sol, vientos, sombra de obstáculos, privacidad, visibilidad o comparación multiobjetivo en el árbol auditado. | No existe el fundamento de la «capa de arquitecto». | Nuevos servicios con entradas tipadas, resultados medidos y trazabilidad. |
| A14 | `src/cad/autocad_com.js` y TW-09 ya ofrecen DWG 2D/3D, versiones, persistencia, verificación y límites de seguridad. | La infraestructura de ejecución existe; reescribir CAD distraería de la mejora arquitectónica. | Reutilizar esas APIs y mantener gates de TW-09 sin declararlos aprobados donde falta AutoCAD real. |

**Precisión:** no se ejecutó ni modificó código en esta auditoría. Los hallazgos son estáticos y reproducibles por lectura de los archivos citados; la compatibilidad de una futura planta L completa en AutoCAD necesita pruebas, no puede declararse resuelta porque el 3D admita polígonos ortogonales.

## 5. Hipótesis profesionales y riesgos críticos

1. **No confundir belleza con «un puntaje».** La calidad arquitectónica integra preferencias no cuantificables; la evaluación numérica es un soporte, no un juez.
2. **No confundir orientación esquemática con orientación geográfica.** Si no hay norte/cota/lote, se puede generar un concepto, pero no concluir asoleamiento real.
3. **No confundir asoleamiento directo con iluminación interior o confort térmico.** Para lo primero bastan rayos geométricos; para lo segundo hay que modelar cielo, materiales, vidrio, uso, cargas y clima con herramientas validadas.
4. **No confundir viento reanalizado con viento entre edificios.** Una rosa ERA5/EPW describe la región/estación, no el flujo en un patio o dentro de la casa.
5. **No equiparar línea visual a seguridad en piscinas.** Requerir barreras, control de acceso y supervisión efectiva, con normativa local verificada; la vista desde cocina es una preferencia adicional.
6. **No premiar casas en L automáticamente.** Pueden mejorar patios/zonificación, pero aumentan perímetro, puentes térmicos, encuentros de cubierta, costo y exigen especial cuidado sísmico.
7. **No inventar cumplimiento OGUC/RT.** MINVU indica vigencia de nueva Reglamentación Térmica desde noviembre 2025; normas térmicas y urbanísticas requieren versión y datos concretos, algunos dependientes de altitud o predio.
8. **No generar un falso CIF/IPT.** El Certificado de Informaciones Previas es un documento de la autoridad municipal; el producto solo puede analizar el archivo aportado y señalar campos pendientes.
9. **Privacidad:** fotos del terreno, direcciones, perfiles familiares y documentos jurídicos no deben circular a servicios externos sin autorización; ejecución offline con entradas opcionales es un requerimiento.
10. **Dependencias y licencias:** no incluir Ladybug/Honeybee, Cloud APIs, Rhino ni EnergyPlus en el instalador por referencia de capacidad. Cada integración requiere ADR técnico, de licencia, prueba Windows y modo sin red.

## 6. Bibliografía primaria y contrastes (consultados 2026-11-16)

1. Autodesk Forma, análisis de sol/viento/daylight y microclima: https://www.autodesk.com/products/forma/product-details y https://help.autodesk.com/cloudhelp/2027/ENU/Revit-FormaWorkflows/files/GUID-3B29DD28-5733-45EE-B2C2-3708F3DCE46F.htm
2. Ladybug: https://www.ladybug.tools/ladybug.html ; Honeybee: https://www.ladybug.tools/honeybee.html ; núcleo Python: https://github.com/ladybug-tools/ladybug ; licencia: https://github.com/ladybug-tools/ladybug/blob/master/LICENSE
3. ClimateStudio: https://www.solemma.com/climatestudio/ y https://docs.solemma.com/
4. TestFit, site analysis: https://www.testfit.io/feasibility-tools/site-analysis-checklist
5. RIBA Plan of Work: https://www.riba.org/work/insights-and-resources/riba-plan-of-work
6. AIA Framework Design Excellence: https://www.aia.org/design-excellence/aia-framework-for-design-excellence/introduction ; integration: https://www.aia.org/design-excellence/aia-framework-for-design-excellence/integration
7. NREL/NLR Solar Position Algorithm: https://midcdmz.nlr.gov/spa/ ; pvlib BSD-3: https://github.com/pvlib/pvlib-python/blob/main/LICENSE
8. Open-Meteo historical/weather reanalysis: https://open-meteo.com/en/docs/historical-weather-api
9. MINVU Reglamentación Térmica: https://www.minvu.gob.cl/nueva-reglamentacion-termica/ ; DITEC: https://www.minvu.gob.cl/ditec/manuales-tecnicos-ditec/
10. Biblioteca Congreso Nacional OGUC versión 2026: https://www.bcn.cl/leychile/navegar?idNorma=8201&idVersion=2026-10-02 ; MINVU formularios DOM/CIP: https://www.minvu.gob.cl/elementos-tecnicos/formularios-de-tramites-direcciones-de-obras-municipales-dom/
11. MINVU Certificación Vivienda Sustentable (guía de ámbitos; certificación externa): https://www.minvu.gob.cl/ditec/certificacion-vivienda-sustentable/
12. OMS prevención ahogamientos: https://www.who.int/es/news-room/fact-sheets/detail/drowning ; CDC medidas de cercado y supervisión: https://www.cdc.gov/healthy-swimming/safety/what-you-can-do-to-stay-healthy-in-swimming-pools.html

**Conclusión:** TW-10 no debe ser «otro prompt» para que Claude imagine plantas. El fundamento son un modelo de predio y personas, un generador multiconcepto, evaluadores verificables y una bitácora de decisiones. Claude interpreta, propone y comunica; los motores especializados **calculan y verifican**.
