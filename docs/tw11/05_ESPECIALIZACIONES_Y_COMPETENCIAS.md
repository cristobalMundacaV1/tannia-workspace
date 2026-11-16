# TW-11 · 05 — Mapa de disciplinas, competencias y modelo de especializaciones
## 1. Contrato de especialización (`tw.cic.specialization/1`, archivo `specializations/<id>/spec.json`)
```jsonc
{ "id":"obras_civiles.tuneles","version":"0.1.0","parent":"obras_civiles","status":"draft|active|deprecated",
  "concepts":[{"term":"sostenimiento","definition_source":"src-…|null","synonyms":["soporte"]}],
  "inputs":[{"name":"seccion_tipo","kind":"geometry|document|datum","required":true}],
  "deliverables":[{"kind":"perfil_longitudinal","template":"tpl-…","editable":true}],
  "methods":[{"method_card":"mc-tunel-cubicacion-excavacion","operations":["geo.section.horseshoe.area","geo.sweep.volume"]}],
  "knowledge":{"source_classes":["A","B"],"indexes":["tuneles"],"golden_queries":"test/spec/tuneles.queries.json"},
  "automation_limits":["no dimensiona sostenimiento","no evalúa estabilidad","no interpreta clasificación geomecánica"],
  "required_validation":[{"what":"dimensionamiento geotécnico","by":"ingeniero geotécnico competente"}],
  "competencies":["…"],"modes":{"academic":{…},"professional":{…}},
  "gaps":[{"need":"solver de sostenimiento","resolution":"external_professional"}] }
```
Reglas: una especialización **solo declara**: conceptos, entradas, entregables, métodos (por id de operación del núcleo), fuentes y límites. **No duplica** el núcleo (no define su propio planner, ledger ni almacenamiento). Se carga desde disco y se valida con Zod; una especialización inválida se desactiva sin tumbar el servidor. Se versiona, se prueba con su propio *golden file* y se retira sin afectar otras. `MethodCard` (`mc-*`): procedimiento paso a paso con operaciones, datos requeridos y errores típicos; redactado por el repositorio con fuentes citadas, nunca copiado de obras licenciadas.

## 2. Mapa de disciplinas (nivel de soporte propuesto al cierre de TW-11)
Leyenda: **O** orquestación+geometría/cantidades (sin juicio de ingeniería) · **C** cálculo determinista E2 · **K** conocimiento indexado · **X** requiere profesional/solver externo (solo `gap`).
| Disciplina | Soporte objetivo TW-11 | Entregables posibles | Límites duros |
|---|---|---|---|
| Edificación/arquitectura (TW-09/10) | **C+O** (existente, migrada como especialización `vivienda`) + `departamentos` (G10) | anteproyecto, 3D, cuantías | no apto para construcción |
| Obras civiles generales | O+K | cubicaciones, planos tipo, planificación | sin diseño estructural |
| Túneles | O+K+C (secciones tipo, volúmenes de excavación/revestimiento por sección declarada) | planta/perfil/secciones, cubicación, procedimiento académico | **X**: sostenimiento, geomecánica, ventilación, seguridad |
| Carreteras/vías | O+C (alineamiento, rasante, volumen por secciones) | planta/perfil, tabla de movimiento de tierras | **X**: diseño geométrico normativo (velocidad de diseño, radios mínimos) sin fuente aportada |
| Topografía | O (importar puntos/LandXML, TIN, perfiles, volúmenes) | planos, curvas, perfiles | datos del levantamiento los aporta la usuaria |
| Estructuras | O (modelo geométrico, cuantías de hormigón/acero con parámetros dados) | cubicaciones | **X** todo cálculo/verificación |
| Materiales | K (+ cuantías con parámetros dados) | fichas con fuente | no se asignan propiedades por defecto |
| Instalaciones (sanitarias/eléctricas/gas) | O+K (inventario, metrados con reglas dadas) | listas, trazados esquemáticos | **X** diseño, cumplimiento de reglamentos |
| Hidráulica/hidrología | K+E1 (Manning etc. solo académico) | ejercicios resueltos | **X** diseño profesional |
| Cubicaciones | **C** (extender `quantities`) | cuantías con trazabilidad | parámetros del usuario |
| Presupuestos | **C** (existente) | APU, presupuesto XLSX | precios del usuario |
| Planificación y control | **C** (CPM, curva S, valor ganado) | cronograma XLSX/PDF, informe de avance | duraciones/recursos del usuario |
| Medio ambiente / seguridad en obra / geotecnia | K (solo recuperación de apuntes) | resúmenes con fuente | **X** |
| Disciplina no listada | flujo general (siempre disponible; sin puerta de disciplina) | estrategia + brechas | ver Caso C |

## 3. Competencias profesionales que el sistema NO reemplaza (registro `required_validation`)
Ingeniero civil estructural/geotécnico/hidráulico/vial/de túneles, arquitecto patrocinante, topógrafo, prevencionista, revisor independiente de proyecto, ITO. El sistema **señala** quién debe validar cada claim con `requires_review_by` y refleja la aprobación solo como evidencia aportada por el PO/revisor (campo manual), nunca la «concede».

## 4. Competencias de apoyo a Tannia (modo académico)
Interpretar enunciados y rúbricas, descomponer en pasos, explicar fórmulas y supuestos, verificar coherencia dimensional, generar planos/cuantías/informes editables, indicar qué parte del ejercicio **debe** hacer ella, mantener un registro de asistencia (`assistance_log`). Plantilla: «qué se pidió → qué se sabe → qué falta → plan → cálculo → verificación → qué debes revisar tú».

## 5. Evolución independiente
Cada especialización avanza `draft → active` solo con: golden queries (G3), operaciones ≥ su madurez declarada (G5/G6), casos de aceptación propios (≥3 de desarrollo + ≥2 retenidos externos evaluados por el revisor) y revisión de contenido por la persona competente (registro manual). Retirar una especialización no cambia el núcleo ni otras.
