# Memoria de cálculo y procedimiento — Túnel OC2

> **EJERCICIO ACADÉMICO — no apto para ejecución ni como proyecto de ingeniería aprobado.**

Modo: académico · Caso: Túnel OC2 (v004) · Generado: 2026-11-16 · Tannia Workspace CIC 0.1.0-tw11.

## 1. Encargo

Túnel carretero en herradura del ejercicio de Obras Civiles II: planta, perfil, tres secciones, cubicación de excavación y revestimiento, y memoria.

- planta (confirmado)
- perfil_longitudinal (confirmado)
- secciones_transversales (confirmado)
- cubicacion (confirmado)
- memoria (confirmado)

Disciplinas (informativas): túneles, topografía, cubicaciones.

## 2. Antecedentes y fuentes

| Fuente | Clase | Carácter | Estado | Aprobada por | Contenido verificado por el servidor |
|---|---|---|---|---|---|
| Apuntes OC2 | B | didactic | registered | system_import | sí |
| Enunciado Trabajo 2 | B | didactic | registered | system_import | sí |

- src-apuntes-oc2-70034539 — método de cubicación
- src-apuntes-oc2-70034539 — revestimiento
- src-enunciado-trabajo-2-084900ce — límite del ejercicio

## 3. Datos de entrada

| Dato | Valor | Unidad | Origen | Estado |
|---|---|---|---|---|
| luz_interior | 9 | m | aportado por la usuaria | user_stated |
| altura_hastial | 2,5 | m | aportado por la usuaria | user_stated |
| espesor_revestimiento | 0,4 | m | aportado por la usuaria | user_stated |
| progresiva_inicial | 2000 | m | aportado por la usuaria | user_stated |

Datos DESCONOCIDOS (no se inventaron): clase_de_roca, parametros_geotecnicos.

## 4. Supuestos

- El revestimiento no incluye solera ni contrabóveda (según el enunciado: solo hastiales y bóveda). (editable; requiere confirmación)
- La excavación coincide con el trasdós del revestimiento (sin sobreexcavación). (editable; requiere confirmación)

## 5. Procedimiento

### Sección en herradura con revestimiento de espesor constante (interior, excavación y revestimiento) (geo.section.horseshoe_lined v1.0.0, madurez E2)

Fórmula: A_i = b·h + π(b/2)²/2 ; A_e = (b+2e)·h + π(b/2+e)²/2 ; A_rev = A_e − A_i

- Hipótesis: bóveda semicircular concéntrica; hastiales verticales de igual altura; revestimiento de espesor constante SOLO en hastiales y bóveda (sin solera/contrabóveda); el espesor es un DATO aportado (no se asume)
- Rango de validez: luz>0, altura_hastial≥0, espesor>0
- Cota de error: exacto (geometría); el espesor estructural no se verifica

### Volumen de una sección en herradura (opcionalmente con espesor de revestimiento exterior) barrida a lo largo de una alineación (geo.sweep.volume_arch v1.0.0, madurez E2)

Fórmula: V = A·L_eje (centroide en el eje); A de geo.section.horseshoe_lined

- Hipótesis: misma que geo.sweep.volume (alineación horizontal, sección vertical normal al eje); sección simétrica respecto del eje (centroide sobre el eje: V = A·L_eje); con espesor_exterior: se barre la sección EXCAVADA (luz+2e, bóveda concéntrica); sin él, la interior
- Rango de validez: radio de cada arco > semiancho de la sección (sin auto-solape)
- Cota de error: exacto bajo las hipótesis

### Resta de volúmenes (p. ej. excavación − volumen interior = volumen de revestimiento) (geo.volume.subtract v1.0.0, madurez E2)

Fórmula: D = V1 − V2

- Hipótesis: volúmenes calculados con el mismo método y la misma alineación; el interior está contenido en la excavación
- Rango de validez: minuendo ≥ sustraendo ≥ 0
- Cota de error: exacto

### Volumen por áreas medias entre secciones (geo.volume.average_end_area v1.0.0, madurez E2)

Fórmula: V = Σ (A_i + A_{i+1})/2 · Δs_i

- Hipótesis: A(s) lineal entre secciones consecutivas; secciones perpendiculares al eje de referencia de s; Δs a lo largo de ese eje
- Rango de validez: ≥2 secciones; progresivas estrictamente crecientes; áreas ≥0; si hay cruce corte/relleno, partir las secciones en el cruce
- Cota de error: Si A(s)=a·s²+b·s+c en un tramo de longitud L: V_AEA − V_exacto = a·L³/6 (sobrestima si a>0). Cono/pirámide desde el vértice: AEA = A·L/2 frente a A·L/3 exacto.

### Longitud de una alineación horizontal (rectas y arcos) (geo.alignment.length v1.0.0, madurez E2)

Fórmula: L = Σ L_recta + Σ R·θ

- Hipótesis: tramos {type:"straight",length} y {type:"arc",radius,angle_deg,turn}; la continuidad geométrica (tangencia) la garantiza el encadenamiento por construcción
- Rango de validez: longitudes y radios positivos; ángulos en grados > 0
- Cota de error: exacto

### Área, perímetro y centroide de un polígono (con arcos y huecos) (geo.polygon.properties v1.0.0, madurez E2)

Fórmula: Shoelace + Σ segmentos circulares ½r²(θ−sinθ); huecos se restan

- Hipótesis: contorno cerrado, plano, simple (sin auto-intersección); bulge con convención DXF (positivo = arco antihorario)
- Rango de validez: ≥3 vértices (o 2 con bulge); huecos contenidos y disjuntos
- Cota de error: exacto (fórmulas cerradas); error de redondeo de punto flotante

| Paso | Objetivo | Estado |
|---|---|---|
| s1 | Áreas de la sección (interior, excavación y revestimiento) | done |
| s2 | Volumen de excavación del trazado completo | done |
| s3 | Volumen interior terminado del trazado completo | done |
| s4 | Volumen de revestimiento de hormigón (excavación − interior) | done |
| s5 | Control cruzado: excavación por áreas medias entre las tres secciones | done |
| s6 | Longitud del eje | done |
| s7 | Dimensionar el sostenimiento y verificar la estabilidad | blocked_gap |
| s8 | Generar planta, perfil y secciones en DXF | planned |
| s9 | Generar memoria y planilla de cantidades | planned |

## 6. Resultados

| Resultado | Valor | Unidad | Método | Hash de entradas | Revisión requerida |
|---|---|---|---|---|---|
| Áreas de la sección (interior, excavación y revestimiento): geo.section.horseshoe_lined: area_interior | 54,3086 | m² | geo.section.horseshoe_lined v1.0.0 (E2) | c30b30b1bd | ingeniero_de_tuneles |
| Áreas de la sección (interior, excavación y revestimiento): geo.section.horseshoe_lined: area_excavacion | 62,2148 | m² | geo.section.horseshoe_lined v1.0.0 (E2) | c30b30b1bd | ingeniero_de_tuneles |
| Áreas de la sección (interior, excavación y revestimiento): geo.section.horseshoe_lined: area_revestimiento | 7,9062 | m² | geo.section.horseshoe_lined v1.0.0 (E2) | c30b30b1bd | ingeniero_de_tuneles |
| Áreas de la sección (interior, excavación y revestimiento): geo.section.horseshoe_lined: perimetro_interior_sin_solera | 19,1372 | m | geo.section.horseshoe_lined v1.0.0 (E2) | c30b30b1bd | ingeniero_de_tuneles |
| Volumen de excavación del trazado completo: geo.sweep.volume_arch: volume | 31401,049 | m³ | geo.sweep.volume_arch v1.0.0 (E2) | 539bcef47c | ingeniero_de_tuneles |
| Volumen de excavación del trazado completo: geo.sweep.volume_arch: section_area | 62,2148 | m² | geo.sweep.volume_arch v1.0.0 (E2) | 539bcef47c | ingeniero_de_tuneles |
| Volumen de excavación del trazado completo: geo.sweep.volume_arch: axis_length | 504,7198 | m | geo.sweep.volume_arch v1.0.0 (E2) | 539bcef47c | ingeniero_de_tuneles |
| Volumen interior terminado del trazado completo: geo.sweep.volume_arch: volume | 27410,636 | m³ | geo.sweep.volume_arch v1.0.0 (E2) | 067dff4b88 | ingeniero_de_tuneles |
| Volumen interior terminado del trazado completo: geo.sweep.volume_arch: section_area | 54,3086 | m² | geo.sweep.volume_arch v1.0.0 (E2) | 067dff4b88 | ingeniero_de_tuneles |
| Volumen interior terminado del trazado completo: geo.sweep.volume_arch: axis_length | 504,7198 | m | geo.sweep.volume_arch v1.0.0 (E2) | 067dff4b88 | ingeniero_de_tuneles |
| Volumen de revestimiento de hormigón (excavación − interior): geo.volume.subtract: diferencia | 3990,412 | m³ | geo.volume.subtract v1.0.0 (E2) | c21564497f | — |
| Control cruzado: excavación por áreas medias entre las tres secciones: geo.volume.average_end_area: volume | 31356,269 | m³ | geo.volume.average_end_area v1.0.0 (E2) | 0381ccb933 | — |
| Control cruzado: excavación por áreas medias entre las tres secciones: geo.volume.average_end_area: interval_volumes | 16175.853149649824,15180.416032748295 | m³ | geo.volume.average_end_area v1.0.0 (E2) | 0381ccb933 | — |
| Longitud del eje: geo.alignment.length: longitud | 504,7198 | m | geo.alignment.length v1.0.0 (E2) | c439668b65 | — |
| Longitud del eje: geo.alignment.length: longitud_rectas | 400 | m | geo.alignment.length v1.0.0 (E2) | c439668b65 | — |
| Longitud del eje: geo.alignment.length: longitud_curvas | 104,7198 | m | geo.alignment.length v1.0.0 (E2) | c439668b65 | — |
| Longitud del eje: geo.alignment.length: deflexion_total | 15 | deg | geo.alignment.length v1.0.0 (E2) | c439668b65 | — |
| Área excavada sección PK 2+504.00: geo.polygon.properties: area | 62,2148 | m² | geo.polygon.properties v1.0.0 (E2) | 6555a47686 | — |
| Área excavada sección PK 2+504.00: geo.polygon.properties: perimetro | 30,1938 | m | geo.polygon.properties v1.0.0 (E2) | 6555a47686 | — |
| Área excavada sección PK 2+504.00: geo.polygon.properties: centroide_x | 0 | m | geo.polygon.properties v1.0.0 (E2) | 6555a47686 | — |
| Área excavada sección PK 2+504.00: geo.polygon.properties: centroide_y | 3,2684 | m | geo.polygon.properties v1.0.0 (E2) | 6555a47686 | — |
| Área interior sección PK 2+504.00: geo.polygon.properties: area | 54,3086 | m² | geo.polygon.properties v1.0.0 (E2) | 89f8c98081 | — |
| Área interior sección PK 2+504.00: geo.polygon.properties: perimetro | 28,1372 | m | geo.polygon.properties v1.0.0 (E2) | 89f8c98081 | — |
| Área interior sección PK 2+504.00: geo.polygon.properties: centroide_x | 0 | m | geo.polygon.properties v1.0.0 (E2) | 89f8c98081 | — |
| Área interior sección PK 2+504.00: geo.polygon.properties: centroide_y | 3,1007 | m | geo.polygon.properties v1.0.0 (E2) | 89f8c98081 | — |

## 7. Pendientes, brechas y verificación

- Brecha (requiere profesional competente): Clasificación geomecánica y parámetros del macizo. Requiere criterio/validación de un profesional competente: el sistema no lo calcula ni lo infiere.
- Brecha (requiere profesional competente): Dimensionamiento del sostenimiento primario y secundario. Requiere criterio/validación de un profesional competente: el sistema no lo calcula ni lo infiere.
- Brecha (requiere profesional competente): Ventilación y seguridad en operación. Requiere criterio/validación de un profesional competente: el sistema no lo calcula ni lo infiere.
- Brecha (requiere nueva herramienta): Dimensionar el sostenimiento y verificar la estabilidad. No existe una capacidad registrada que lo ejecute.
- Desconocido: Clasificación geomecánica y parámetros del macizo
- Desconocido: Dimensionamiento del sostenimiento primario y secundario
- Desconocido: Ventilación y seguridad en operación

Estado de verificación: sin claims desactualizados; sin contradicciones abiertas.

Artefacto: 03 Trabajo/Ingenieria/Túnel OC2/artefactos/tunel_oc2.dxf (SHA-256 2f2f6b3f96…).

## 8. Alcance y responsabilidad

Este documento es ingeniería ASISTIDA generada a partir de datos y supuestos declarados. No reemplaza el juicio ni la revisión de un profesional competente. Los resultados geotécnicos, estructurales, hidráulicos de diseño y normativos no están calculados ni verificados por esta herramienta salvo que se indique expresamente.

EJERCICIO ACADÉMICO — no apto para ejecución ni como proyecto de ingeniería aprobado.
