# Caso demostrable — "Diseña una casa de ~80 m²"

> Datos ficticios. ANTEPROYECTO: no apto para construcción. Generado por `scripts/demo-anteproyecto.mjs` ejecutando las herramientas MCP reales.

## 1. Tannia: «Diseña una propuesta de casa de un piso de aproximadamente 80 m², tres dormitorios, dos baños, living-comedor y cocina americana».

Herramienta: `tannia_diseno_crear`

```
Anteproyecto "Casa 80" — v001 · ANTEPROYECTO (no apto para construcción)
Superficie construida 79.75 m² · útil 68.11 m² · Albañilería confinada (ladrillo cerámico, pilares y cadenas de hormigón armado)

| Recinto | Medidas útiles (m) | Superficie |
|---|---|---|
| BAÑO 1 | 1.43 × 2.93 | 4.19 m² |
| BAÑO PRINCIPAL | 1.56 × 2.68 | 4.18 m² |
| COCINA AMERICANA | 2.93 × 2.93 | 8.58 m² |
| DORMITORIO 2 | 2.76 × 2.68 | 7.40 m² |
| DORMITORIO 3 | 2.73 × 2.68 | 7.32 m² |
| DORMITORIO PRINCIPAL | 3.13 × 2.68 | 8.39 m² |
| LIVING-COMEDOR | 6.10 × 2.93 | 17.87 m² |
| PASILLO | 10.60 × 0.96 | 10.18 m² |

```
####======#####====####=======####=======###
#FFFFFFFFFFFF+BBBBBB#DDDDDDDDDD##EEEEEEEEEE#
#FFFFFFFFFFFF+BBBBBB#DDDDDDDDDD##EEEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDD##EEEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDD##EEEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDD##EEEEEEEEEE#
#++++################++++########++++#######
#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#
###########     #######################+++##
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
###++++#####===========#####======#####===##
```
A = BAÑO 1 (4.19 m²) · B = BAÑO PRINCIPAL (4.18 m²) · C = COCINA AMERICANA (8.58 m²) · D = DORMITORIO 2 (7.40 m²) · E = DORMITORIO 3 (7.32 m²) · F = DORMITORIO PRINCIPAL (8.39 m²) · G = LIVING-COMEDOR (17.87 m²) · H = PASILLO (10.18 m²)
1 carácter = 250 mm en X, 500 mm en Y; # muro, + puerta, = ventana, espacio = paso libre (arriba = norte)

Supuestos: Sistema constructivo no indicado: se parte con albañilería confinada (el más habitual en vivienda de un piso); es modificable.
Preguntas para Tannia: ¿Dimensiones, forma y orientación del terreno, y comuna? (determinan retranqueos, rasantes, coeficientes y zona térmica) / ¿Prefiere otro sistema constructivo (hormigón armado, entramado de madera)?

Archivos: 03 Trabajo/Anteproyectos/Casa 80/v001.svg (ábralo en el navegador) · 03 Trabajo/Anteproyectos/Casa 80/v001.dxf (AutoCAD; use tannia_diseno_a_autocad para guardarlo como DWG).

```json
{
  "anteproyecto": "Casa 80",
  "version": "v001",
  "archivos": {
    "dxf": "03 Trabajo/Anteproyectos/Casa 80/v001.dxf",
    "svg": "03 Trabajo/Anteproyectos/Casa 80/v001.svg"
  },
  "recintos": [
    {
      "id": "R-BC",
      "recinto": "BAÑO 1",
      "ancho_m": 1.43,
      "fondo_m": 2.93,
      "area_m2": 4.19
    },
    {
      "id": "R-BP",
      "recinto": "BAÑO PRINCIPAL",
      "ancho_m": 1.56,
      "fondo_m": 2.68,
```

## 2. Tannia: «El dormitorio 2 me queda chico, hazlo más ancho, unos 3 metros».

Herramienta: `tannia_diseno_modificar`

```
Anteproyecto "Casa 80" — v002 · ANTEPROYECTO (no apto para construcción)
Superficie construida 79.75 m² · útil 68.10 m² · Albañilería confinada (ladrillo cerámico, pilares y cadenas de hormigón armado)

| Recinto | Medidas útiles (m) | Superficie |
|---|---|---|
| BAÑO 1 | 1.43 × 2.93 | 4.19 m² |
| BAÑO PRINCIPAL | 1.56 × 2.68 | 4.18 m² |
| COCINA AMERICANA | 2.93 × 2.93 | 8.58 m² |
| DORMITORIO 2 | 3.00 × 2.68 | 8.04 m² |
| DORMITORIO 3 | 2.49 × 2.68 | 6.67 m² |
| DORMITORIO PRINCIPAL | 3.13 × 2.68 | 8.39 m² |
| LIVING-COMEDOR | 6.10 × 2.93 | 17.87 m² |
| PASILLO | 10.60 × 0.96 | 10.18 m² |

```
####======#####====####=======#####=======##
#FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#++++################++++#########++++######
#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#
###########     #######################+++##
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
###++++#####===========#####======#####===##
```
A = BAÑO 1 (4.19 m²) · B = BAÑO PRINCIPAL (4.18 m²) · C = COCINA AMERICANA (8.58 m²) · D = DORMITORIO 2 (8.04 m²) · E = DORMITORIO 3 (6.67 m²) · F = DORMITORIO PRINCIPAL (8.39 m²) · G = LIVING-COMEDOR (17.87 m²) · H = PASILLO (10.18 m²)
1 carácter = 250 mm en X, 500 mm en Y; # muro, + puerta, = ventana, espacio = paso libre (arriba = norte)

A tener presente:
• DORMITORIO 3: 6.67 m², bajo el criterio inicial de 7 m² (práctica de diseño; confirmar el valor aplicable).

Cambió: DORMITORIO 2: ancho útil 2.76 → 3.00 m; compensa DORMITORIO 3
Recintos sin cambios: 6.
Se puede volver atrás con tannia_diseno_historial (deshacer).

Archivos: 03 Trabajo/Anteproyectos/Casa 80/v002.svg (ábralo en el navegador) · 03 Trabajo/Anteproyectos/Casa 80/v002.dxf (AutoCAD; use tannia_diseno_a_autocad para guardarlo como DWG).

```json
{
  "anteproyecto": "Casa 80",
  "version": "v002",
  "padre": "v001",
  "cambios": {
    "recintos_modificados": [
      {
        "recinto": "R-D2",
        "nombre": "DORMITORIO 2",
        "cambio": "modificado",
        "antes": {
          "ancho_m": 2.76,
          "fondo_m": 2.68,
          "area_m2": 7.4
        },
        "despues": {
```

## 3. Tannia: «Agrégale una ventana por el lado oeste al dormitorio principal y llama escritorio al dormitorio 3».

Herramienta: `tannia_diseno_modificar`

```
Anteproyecto "Casa 80" — v003 · ANTEPROYECTO (no apto para construcción)
Superficie construida 79.75 m² · útil 68.10 m² · Albañilería confinada (ladrillo cerámico, pilares y cadenas de hormigón armado)

| Recinto | Medidas útiles (m) | Superficie |
|---|---|---|
| BAÑO 1 | 1.43 × 2.93 | 4.19 m² |
| BAÑO PRINCIPAL | 1.56 × 2.68 | 4.18 m² |
| COCINA AMERICANA | 2.93 × 2.93 | 8.58 m² |
| DORMITORIO 2 | 3.00 × 2.68 | 8.04 m² |
| ESCRITORIO | 2.49 × 2.68 | 6.67 m² |
| DORMITORIO PRINCIPAL | 3.13 × 2.68 | 8.39 m² |
| LIVING-COMEDOR | 6.10 × 2.93 | 17.87 m² |
| PASILLO | 10.60 × 0.96 | 10.18 m² |

```
####======#####====####=======#####=======##
=FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
=FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
=FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
=FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#++++################++++#########++++######
#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#
###########     #######################+++##
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
###++++#####===========#####======#####===##
```
A = BAÑO 1 (4.19 m²) · B = BAÑO PRINCIPAL (4.18 m²) · C = COCINA AMERICANA (8.58 m²) · D = DORMITORIO 2 (8.04 m²) · E = ESCRITORIO (6.67 m²) · F = DORMITORIO PRINCIPAL (8.39 m²) · G = LIVING-COMEDOR (17.87 m²) · H = PASILLO (10.18 m²)
1 carácter = 250 mm en X, 500 mm en Y; # muro, + puerta, = ventana, espacio = paso libre (arriba = norte)

A tener presente:
• ESCRITORIO: 6.67 m², bajo el criterio inicial de 7 m² (práctica de diseño; confirmar el valor aplicable).

Cambió: Se agrega ventana V-9 (1500 mm) en DORMITORIO PRINCIPAL, lado O; DORMITORIO 3 → ESCRITORIO
Recintos sin cambios: 7.
Aberturas agregadas: V-9.
Se puede volver atrás con tannia_diseno_historial (deshacer).

Archivos: 03 Trabajo/Anteproyectos/Casa 80/v003.svg (ábralo en el navegador) · 03 Trabajo/Anteproyectos/Casa 80/v003.dxf (AutoCAD; use tannia_diseno_a_autocad para guardarlo como DWG).

```json
{
  "anteproyecto": "Casa 80",
  "version": "v003",
  "padre": "v002",
  "cambios": {
    "recintos_modificados": [
      {
        "recinto": "R-D3",
        "nombre": "ESCRITORIO",
        "cambio": "renombrado/modificado",
        "antes": {
          "ancho_m": 2.49,
          "fondo_m": 2.68,
          "area_m2": 6.67
        },
```

## 4. Tannia: «Quiero un walk-in closet en el dormitorio principal, de 1,2 m de fondo, hacia el norte».

Herramienta: `tannia_diseno_modificar`

```
Anteproyecto "Casa 80" — v004 · ANTEPROYECTO (no apto para construcción)
Superficie construida 79.75 m² · útil 67.66 m² · Albañilería confinada (ladrillo cerámico, pilares y cadenas de hormigón armado)

| Recinto | Medidas útiles (m) | Superficie |
|---|---|---|
| BAÑO 1 | 1.43 × 2.93 | 4.19 m² |
| BAÑO PRINCIPAL | 1.56 × 2.68 | 4.18 m² |
| COCINA AMERICANA | 2.93 × 2.93 | 8.58 m² |
| DORMITORIO 2 | 3.00 × 2.68 | 8.04 m² |
| ESCRITORIO | 2.49 × 2.68 | 6.67 m² |
| DORMITORIO PRINCIPAL | 3.13 × 1.51 | 4.73 m² |
| LIVING-COMEDOR | 6.10 × 2.93 | 17.87 m² |
| PASILLO | 10.60 × 0.96 | 10.18 m² |
| WALK-IN CLOSET | 3.13 × 1.03 | 3.22 m² |

```
###############====####=======#####=======##
#IIIIIIIIIIII#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#####++++#####BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#++++################++++#########++++######
#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#
###########     #######################+++##
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
###++++#####===========#####======#####===##
```
A = BAÑO 1 (4.19 m²) · B = BAÑO PRINCIPAL (4.18 m²) · C = COCINA AMERICANA (8.58 m²) · D = DORMITORIO 2 (8.04 m²) · E = ESCRITORIO (6.67 m²) · F = DORMITORIO PRINCIPAL (4.73 m²) · G = LIVING-COMEDOR (17.87 m²) · H = PASILLO (10.18 m²) · I = WALK-IN CLOSET (3.22 m²)
1 carácter = 250 mm en X, 500 mm en Y; # muro, + puerta, = ventana, espacio = paso libre (arriba = norte)

A tener presente:
• ESCRITORIO: 6.67 m², bajo el criterio inicial de 7 m² (práctica de diseño; confirmar el valor aplicable).
• DORMITORIO PRINCIPAL sin ventana al exterior.
• DORMITORIO PRINCIPAL: 4.73 m², bajo el criterio inicial de 8 m² (práctica de diseño; confirmar el valor aplicable).
• DORMITORIO PRINCIPAL: lado menor 1.51 m, bajo el criterio inicial de 2.6 m.
• DORMITORIO PRINCIPAL: proporción 2.07:1, alargada para el uso (criterio inicial 2:1).
• WALK-IN CLOSET sin ventana al exterior.

Cambió: DORMITORIO PRINCIPAL se divide: nuevo WALK-IN CLOSET de 1200 mm (con puerta). Se retiraron aberturas que ya no tienen muro: ventana V-5 (El recinto R-DP no tiene muro exterior en el lado N.); ventana V-9 (La abertura de 1500 mm no cabe en un muro de 1650 mm.)
Recintos sin cambios: 7.
Aberturas agregadas: P-8.
Aberturas eliminadas: V-5, V-9.
Se puede volver atrás con tannia_diseno_historial (deshacer).

Archivos: 03 Trabajo/Anteproyectos/Casa 80/v004.svg (ábralo en el navegador) · 03 Trabajo/Anteproyectos/Casa 80/v004.dxf (AutoCAD; use tannia_diseno_a_autocad para guardarlo como DWG).

```json
{
  "anteproyecto": "Casa 80",
  "version": "v004",
  "padre": "v003",
  "cambios": {
    "recintos_modificados": [
      {
        "recinto": "R-DP",
```

## 5. Tannia: «Mmm, no me convence el closet. Vuelve atrás un paso».

Herramienta: `tannia_diseno_historial`

```
Se deshizo el último cambio. Versión actual: v003.

| Recinto | Medidas útiles (m) | Superficie |
|---|---|---|
| BAÑO 1 | 1.43 × 2.93 | 4.19 m² |
| BAÑO PRINCIPAL | 1.56 × 2.68 | 4.18 m² |
| COCINA AMERICANA | 2.93 × 2.93 | 8.58 m² |
| DORMITORIO 2 | 3.00 × 2.68 | 8.04 m² |
| ESCRITORIO | 2.49 × 2.68 | 6.67 m² |
| DORMITORIO PRINCIPAL | 3.13 × 2.68 | 8.39 m² |
| LIVING-COMEDOR | 6.10 × 2.93 | 17.87 m² |
| PASILLO | 10.60 × 0.96 | 10.18 m² |

```json
{
  "head": "v003",
  "redo": [
    "v004"
  ],
  "accion": "deshacer",
  "archivos": {
    "version": "v003",
    "dxf": "03 Trabajo/Anteproyectos/Casa 80/v003.dxf",
    "svg": "03 Trabajo/Anteproyectos/Casa 80/v003.svg",
    "abs_dxf": "/tmp/tannia-demo-dAiX3m/Proyectos/Casa demo/03 Trabajo/Anteproyectos/Casa 80/v003.dxf",
    "abs_svg": "/tmp/tannia-demo-dAiX3m/Proyectos/Casa demo/03 Trabajo/Anteproyectos/Casa 80/v003.svg"
  },
  "recintos": [
    {
      "id": "R-BC",
      "recinto": "BAÑO 1",
      "ancho_m": 1.43,
      "fondo_m": 2.93,
      "area_m2": 4.19
    },
    {
      "id": "R-BP",
      "recinto": "BAÑO PRINCIPAL",
      "ancho_m": 1.56,
      "fondo_m": 2.68,
      "area_m2": 4.18
    },
    {
      "id": "R-COC",
      "recinto": "COCINA AMERICANA",
      "ancho_m": 2.93,
      "fondo_m": 2.93,
      "area_m2": 8.58
    },
    {
      "id": "R-D2",
      "recinto": "DORMITORIO 2",
      "ancho_m": 3,
      "fondo_m": 2.68,
      "area_m2": 8.04
    },
    {
      "id": "R-D3",
      "recinto": "ESCRITORIO",
      "ancho_m": 2.49,
```

## 6. Tannia: «Cambiemos a hormigón armado».

Herramienta: `tannia_diseno_modificar`

```
Anteproyecto "Casa 80" — v005 · ANTEPROYECTO (no apto para construcción)
Superficie construida 79.75 m² · útil 67.80 m² · Muros de hormigón armado

| Recinto | Medidas útiles (m) | Superficie |
|---|---|---|
| BAÑO 1 | 1.43 × 2.92 | 4.17 m² |
| BAÑO PRINCIPAL | 1.55 × 2.67 | 4.15 m² |
| COCINA AMERICANA | 2.92 × 2.92 | 8.56 m² |
| DORMITORIO 2 | 2.99 × 2.67 | 8.00 m² |
| ESCRITORIO | 2.48 × 2.67 | 6.65 m² |
| DORMITORIO PRINCIPAL | 3.13 × 2.67 | 8.36 m² |
| LIVING-COMEDOR | 6.10 × 2.92 | 17.84 m² |
| PASILLO | 10.60 × 0.95 | 10.07 m² |

```
####======#####====####=======#####=======##
=FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
=FFFFFFFFFFFF+BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
=FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
=FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#FFFFFFFFFFFF#BBBBBB#DDDDDDDDDDD##EEEEEEEEE#
#++++################++++#########++++######
#HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#
###########     #######################+++##
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
=GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
#GGGGGGGGGGGGGGGGGGGGGGGGCCCCCCCCCCCC#AAAAA#
###++++#####===========#####======#####===##
```
A = BAÑO 1 (4.17 m²) · B = BAÑO PRINCIPAL (4.15 m²) · C = COCINA AMERICANA (8.56 m²) · D = DORMITORIO 2 (8.00 m²) · E = ESCRITORIO (6.65 m²) · F = DORMITORIO PRINCIPAL (8.36 m²) · G = LIVING-COMEDOR (17.84 m²) · H = PASILLO (10.07 m²)
1 carácter = 250 mm en X, 500 mm en Y; # muro, + puerta, = ventana, espacio = paso libre (arriba = norte)

A tener presente:
• ESCRITORIO: 6.65 m², bajo el criterio inicial de 7 m² (práctica de diseño; confirmar el valor aplicable).

Cambió: Sistema constructivo: Muros de hormigón armado (muros 200/150 mm). Requiere proyecto de cálculo estructural.
Recintos sin cambios: 0.
Se puede volver atrás con tannia_diseno_historial (deshacer).

Archivos: 03 Trabajo/Anteproyectos/Casa 80/v005.svg (ábralo en el navegador) · 03 Trabajo/Anteproyectos/Casa 80/v005.dxf (AutoCAD; use tannia_diseno_a_autocad para guardarlo como DWG).

```json
{
  "anteproyecto": "Casa 80",
  "version": "v005",
  "padre": "v003",
  "cambios": {
    "recintos_modificados": [
      {
        "recinto": "R-BC",
        "nombre": "BAÑO 1",
        "cambio": "modificado",
        "antes": {
          "ancho_m": 1.43,
          "fondo_m": 2.93,
          "area_m2": 4.19
        },
        "despues": {
```

## 7. Tannia: «¿Qué debo revisar sobre el diseño sísmico?»

Herramienta: `tannia_conocimiento_consultar`

```
Criterio inicial y dónde confirmarlo (no evalúa cumplimiento).

```json
{
  "consulta": "sistema sísmico muros hormigón",
  "temas": [
    {
      "tema": "Sistema constructivo y contexto sísmico",
      "criterio_inicial_usado": [
        "Sistema: Muros de hormigón armado",
        "Espesores iniciales: exterior 200 mm, interior 150 mm",
        "Espesores totales iniciales; los define el proyecto de cálculo.",
        "Muros continuos y alineados favorecen el comportamiento sísmico.",
        "Planta regular y ortogonal, muros alineados, aberturas moderadas en muros resistentes, distribución de muros equilibrada en ambas direcciones"
      ],
      "origen": "practica_de_diseno",
      "advertencia_breve": "Valor inicial de práctica de diseño, NO normativo: confirmar el valor vigente en la fuente indicada antes de fijarlo.",
      "donde_confirmar": [
        {
          "id": "nch433",
          "nombre": "NCh433 — Diseño sísmico de edificios",
          "url_base": "https://www.inn.cl/",
          "acceso_verificado": true,
          "nota": "Se aplica con las modificaciones oficiales vigentes; verificar la versión exigida por la OGUC."
        },
        {
          "id": "nch2123",
          "nombre": "NCh2123 — Albañilería confinada: requisitos de diseño y cálculo",
          "url_base": "https://www.inn.cl/",
          "acceso_verificado": true,
          "nota": "Verificar la versión exigida por la OGUC."
        },
        {
          "id": "nch430",
          "nombre": "NCh430 — Hormigón armado: requisitos de diseño y cálculo",
          "url_base": "https://www.inn.cl/",
          "acceso_verificado": true,
          "nota": "Verificar la versión exigida por la OGUC."
        },
        {
          "id": "nch1198",
          "nombre": "NCh1198 — Madera: construcciones en madera, cálculo",
          "url_base": "https://www.inn.cl/",
          "acceso_verificado": true,
          "nota": "Verificar la versión exigida por la OGUC."
        },
        {
          "id": "nch1537",
          "nombre": "NCh1537 — Diseño estructural: cargas permanentes y sobrecargas de uso",
          "url_base": "https://www.inn.cl/",
          "acceso_verificado": true,
          "nota": "Verificar la versión exigida por la OGUC."
        },
        {
          "id": "nch3171",
          "nombre": "NCh3171 — Diseño estructural: disposiciones generales y combinaciones de cargas",
          "url_base": "https://www.inn.cl/",
          "acceso_verificado": true,
          "nota": "Verificar la versión exigida por la OGUC."
        },
```

## 8. Tannia: «Dame las cantidades con muros de 2,4 m».

Herramienta: `tannia_diseno_cubicar`

```
26 partidas AP-* guardadas desde Casa 80 v005 (altura de muros 2.4 m).

```json
{
  "version": "v005",
  "partidas": [
    {
      "codigo": "AP-PISO-BC",
      "descripcion": "Superficie útil BAÑO 1",
      "unidad": "m2",
      "cantidad": 4.17
    },
    {
      "codigo": "AP-PISO-BP",
      "descripcion": "Superficie útil BAÑO PRINCIPAL",
      "unidad": "m2",
      "cantidad": 4.15
    },
    {
      "codigo": "AP-PISO-COC",
      "descripcion": "Superficie útil COCINA AMERICANA",
      "unidad": "m2",
      "cantidad": 8.56
    },
    {
      "codigo": "AP-PISO-D2",
      "descripcion": "Superficie útil DORMITORIO 2",
      "unidad": "m2",
      "cantidad": 8
    },
    {
      "codigo": "AP-PISO-D3",
      "descripcion": "Superficie útil ESCRITORIO",
      "unidad": "m2",
      "cantidad": 6.65
    },
    {
      "codigo": "AP-PISO-DP",
      "descripcion": "Superficie útil DORMITORIO PRINCIPAL",
      "unidad": "m2",
      "cantidad": 8.36
    },
    {
      "codigo": "AP-PISO-LIV",
      "descripcion": "Superficie útil LIVING-COMEDOR",
      "unidad": "m2",
      "cantidad": 17.84
    },
    {
      "codigo": "AP-PISO-PAS",
      "descripcion": "Superficie útil PASILLO",
      "unidad": "m2",
      "cantidad": 10.07
    },
    {
      "codigo": "AP-PISO-TOTAL",
      "descripcion": "Superficie útil total",
      "unidad": "m2",
      "cantidad": 67.8
    },
```

## 9. Tannia: «Muéstrame la lista de versiones».

Herramienta: `tannia_diseno_historial`

```
Versiones de "Casa 80":
v001: Versión inicial generada a partir de la solicitud
v002 ← v001: Dormitorio 2 más ancho (~3 m)
v003 ← v002: Ventana oeste en dormitorio principal; dormitorio 3 → escritorio
v004 ← v003: Walk-in closet en el dormitorio principal
v005 ← v003  (actual): Sistema constructivo: hormigón armado

```json
{
  "head": "v005",
  "redo": [],
  "versiones": [
    {
      "id": "v001",
      "padre": null,
      "creada": "2026-11-15T23:25:44.593Z",
      "descripcion": "Versión inicial generada a partir de la solicitud",
      "resumen": "Versión inicial",
      "construida_m2": 79.75
    },
    {
      "id": "v002",
      "padre": "v001",
      "creada": "2026-11-15T23:25:44.627Z",
      "descripcion": "Dormitorio 2 más ancho (~3 m)",
      "resumen": "DORMITORIO 2: ancho útil 2.76 → 3.00 m; compensa DORMITORIO 3",
      "construida_m2": 79.75
    },
    {
      "id": "v003",
      "padre": "v002",
      "creada": "2026-11-15T23:25:44.654Z",
      "descripcion": "Ventana oeste en dormitorio principal; dormitorio 3 → escritorio",
      "resumen": "Se agrega ventana V-9 (1500 mm) en DORMITORIO PRINCIPAL, lado O; DORMITORIO 3 → ESCRITORIO",
      "construida_m2": 79.75
    },
    {
      "id": "v004",
      "padre": "v003",
      "creada": "2026-11-15T23:25:44.675Z",
      "descripcion": "Walk-in closet en el dormitorio principal",
      "resumen": "DORMITORIO PRINCIPAL se divide: nuevo WALK-IN CLOSET de 1200 mm (con puerta). Se retiraron aberturas que ya no tienen muro: ventana V-5 (El recinto R-DP no tiene muro exterior en el lado N.); ventana V-9 (La abertura de 1500 mm no cabe en un muro de 1650 mm.)",
      "construida_m2": 79.75
    },
    {
      "id": "v005",
      "padre": "v003",
      "creada": "2026-11-15T23:25:44.691Z",
      "descripcion": "Sistema constructivo: hormigón armado",
      "resumen": "Sistema constructivo: Muros de hormigón armado (muros 200/150 mm). Requiere proyecto de cálculo estructural.",
      "construida_m2": 79.75
    }
  ],
  "arbol": [
    "v001: Versión inicial generada a partir de la solicitud",
    "v002 ← v001: Dormitorio 2 más ancho (~3 m)",
    "v003 ← v002: Ventana oeste en dormitorio principal; dormitorio 3 → escritorio",
    "v004 ← v003: Walk-in closet en el dormitorio principal",
    "v005 ← v003  (actual): Sistema constructivo: hormigón armado"
  ]
```
