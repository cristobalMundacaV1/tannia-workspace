# TW-DESIGN — Asistente de anteproyecto arquitectónico editable (macrofase)

**Estado:** propuesta + implementación incremental en rama `feat/tw-design-assistant` (apilada sobre el PR #7). No hay merge ni despliegue sin el PO.
**Principio rector (PO):** Tannia trabaja como un *Product Owner* con un agente: pide un resultado, recibe una **primera versión funcional**, la revisa y la **refina por conversación**. Tannia no describe líneas, muros ni puertas. Tannia es la profesional responsable y tiene la autoridad.

## 1. Qué se construye (y qué no)
**Sí:** un motor que, a partir de un *programa* ("casa de un piso de ~80 m², 3 dormitorios, 2 baños, living-comedor y cocina americana"), produce una **distribución coherente** con supuestos explícitos, la **dibuja en 2D real y editable** (muros con espesor, divisiones, puertas, ventanas, recintos, capas, cotas), la guarda como archivo de trabajo (DXF → DWG en AutoCAD), muestra una **vista comprensible**, y permite **refinar con lenguaje natural** conservando lo no afectado, con **historial, deshacer y recuperación de versiones**.

**Con criterio técnico integrado (precisión del PO):** el asistente decide *como lo haría un profesional chileno*: sistema constructivo y espesores coherentes, planta regular y ortogonal, muros alineados, aberturas razonables en muros resistentes, dimensiones y proporciones habitables, ventilación/iluminación de recintos, circulación, contexto sísmico. Esto es **conocimiento de diseño aplicado al generar y al editar**, no un informe de cumplimiento.

**No:** un motor de evaluación/certificación normativa (tipo "Carbono Zero"); diseño estructural definitivo sin cálculo; presentar el anteproyecto como documento apto para construcción; inventar valores normativos; reemplazar al arquitecto/ingeniero.

## 2. Capa de conocimiento técnico (en lugar de auditoría)
Tres piezas pequeñas, usadas *durante* la generación y la edición:

| Pieza | Qué es | Garantía de honestidad |
|---|---|---|
| **Criterios de diseño** (`src/conocimiento/criterios.js`) | Valores iniciales de práctica de diseño por tipo de recinto, sistema constructivo y proporciones. Alimentan al generador y a las ediciones. | Cada valor lleva `origen: practica_de_diseno` y `confirmar_en: [instrumentos]`. **Nunca** se presenta como valor normativo. Editables por Tannia y persistidos con el diseño (la persistencia transversal de criterios aprobados es la futura **TW-04K**). |
| **Registro de fuentes** (`src/conocimiento/fuentes.js`) | LGUC, OGUC, NCh pertinentes (sísmica, hormigón, albañilería, madera, cargas, térmica), RIDAA, instalaciones eléctricas/gas, DITEC/MINVU, BCN, INN… con emisor, URL base, estado de verificación de acceso y para qué decisiones sirven. | Solo **instrumento y tema**; **sin números de artículo ni valores citados de memoria**. Se marca `valores_normativos: "consultar vigente"`. |
| **Consulta guiada** (`tannia_conocimiento_consultar`) | Dado un tema ("altura de piso a cielo", "sistema sísmico albañilería confinada", "ventilación de baños"), devuelve: el criterio inicial usado, **dónde confirmar** el valor vigente y a **qué profesional** corresponde. El agente (Claude) puede abrir la fuente oficial con sus propias herramientas web; el servidor local **no abre conexiones de red**. | Advertencia breve solo cuando una decisión requiere información adicional o revisión profesional. |

Cada decisión relevante del diseño queda en `fundamentos[]` (decisión → criterio → dónde confirmar), visible pero breve.

## 3. Arquitectura
```
Lenguaje natural (Tannia) ─► Claude ─► herramientas MCP de diseño (pocas, de alto nivel)
                                         │
   programa + criterios + sistema ──► GENERADOR (árbol de particiones ortogonales, determinista)
                                         │  modelo de diseño versionado (JSON, unidades mm)
        ┌────────────────────────────────┼─────────────────────────────────┐
   DERIVACIÓN geométrica         COHERENCIA geométrica              SALIDAS
 (muros, aberturas, recintos)   (solapes, cierre, accesos,     DXF editable · SVG · vista ASCII
                                 barridos de puertas, áreas)    → AutoCAD COM: abrir DXF y guardar DWG
        └──────────── OPERACIONES de edición (catálogo) ──► nueva versión (historial, deshacer, restaurar)
```
- **Modelo:** recintos = hojas de un árbol de particiones (`h`/`v`) con medidas a ejes; muros y aberturas son **derivados** (identificadores estables), de modo que editar un recinto *recalcula* muros, aberturas y cotas sin tocar lo no afectado.
- **Aberturas** referenciadas a *recinto/lado* o *frontera entre recintos* (no a coordenadas): sobreviven a los cambios de tamaño.
- **Salida DXF** (formato AC1009/R12, el más tolerante): capas `TW_MURO_EXT`, `TW_MURO_INT`, `TW_PUERTA`, `TW_VENTANA`, `TW_RECINTO` (polilíneas cerradas útiles para área), `TW_TEXTO`, `TW_COTA`, `TW_EJES`; muros como **unión** (sin líneas internas en encuentros) con vanos recortados. DWG: AutoCAD abre el DXF y lo guarda en `03 Trabajo` (guardas de ruta; NO VERIFICADO hasta correrlo en AutoCAD real).
- **Coherencia (no cumplimiento):** una sola pasada interna que impide entregar geometría rota (recintos solapados, aberturas fuera del muro o superpuestas, barridos de puerta que chocan, recintos sin acceso, áreas que no cuadran con el DXF). Resultado: *advertencias breves* y correcciones automáticas cuando son obvias.
- **Versiones:** cada operación crea `vNNN` inmutable (+ DXF/SVG); `deshacer`/`rehacer`/`restaurar` mueven el puntero sin borrar nada; todo bajo `03 Trabajo` (los originales nunca se tocan).

## 4. Herramientas MCP (pocas y de alto nivel)
| Herramienta | Para qué |
|---|---|
| `tannia_diseno_crear` | Del programa a la v001: distribución, supuestos, fundamentos, preguntas esenciales, DXF + SVG + vista |
| `tannia_diseno_modificar` | Catálogo de operaciones (redimensionar, intercambiar, renombrar, aberturas, separación abierta/cerrada, dividir/eliminar recinto, espesores, sistema constructivo) → nueva versión con *qué cambió* |
| `tannia_diseno_ver` | Resumen, tabla de recintos, vista ASCII, rutas de SVG/DXF |
| `tannia_diseno_historial` | listar · deshacer · rehacer · restaurar |
| `tannia_diseno_a_autocad` | Abrir el DXF en AutoCAD y guardar el **DWG** de trabajo (guardas de ruta) |
| `tannia_diseno_cubicar` | Cantidades derivadas de la geometría realmente construida (pisos, muros, aberturas) con parámetros que entrega Tannia |
| `tannia_conocimiento_consultar` | Criterio inicial + dónde confirmar + a quién consultar |

## 5. Historias de usuario (criterios de aceptación resumidos)
| ID | Historia | Aceptación |
|---|---|---|
| D-01 | Como Tannia pido una casa de 80 m², 3D/2B, living-comedor y cocina americana y recibo una v001 sin dibujar nada | Distribución coherente; supuestos y preguntas esenciales listados; ~80 m² construidos (±2 %) |
| D-02 | Quiero un plano 2D real y editable | DXF con muros de espesor, divisiones, puertas, ventanas, rótulos de recinto, capas y cotas; re-medido con el motor DXF: áreas = modelo |
| D-03 | Quiero ver el anteproyecto de forma comprensible | SVG + tabla de superficies + vista ASCII |
| D-04 | Pido cambios en lenguaje natural | Operaciones del catálogo; lo no afectado queda idéntico (probado); *qué cambió* explícito |
| D-05 | Quiero deshacer y volver a una versión | `deshacer/rehacer/restaurar` sin pérdida (árbol de versiones) |
| D-06 | Necesito que cada cambio detecte inconsistencias | Coherencia tras cada versión (solapes, aberturas, accesos, barridos, áreas) |
| D-07 | Quiero abrirlo en AutoCAD y guardar DWG | DXF → DWG por COM con guardas; **NO VERIFICADO** hasta AutoCAD real |
| D-08 | Más adelante 3D, cubicación y presupuesto | Cubicación desde la geometría construida (esta fase); elevación 3D = siguiente incremento |
| D-09 | Criterio técnico chileno integrado | Sistema constructivo → espesores/advertencias; sísmica: planta regular, densidad y balance de muros como indicador; fundamentos con dónde confirmar; sin valores normativos inventados |
| D-10 | Honestidad | Todo entregable marcado **ANTEPROYECTO — no apto para construcción**; sin soluciones estructurales definitivas |

## 6. Dependencias
Reutiliza: sandbox de rutas y protección de originales; versionado/estados de proyecto; lector/medidor DXF (verificación cruzada de áreas); adaptador COM (abrir/guardar/leer/persistencia); XLSX/PDF (cubicación). Nuevo: generador, derivación, escritor DXF, SVG, operaciones, versiones, conocimiento técnico.
**Externas / pendientes:** AutoCAD real (DXF→DWG, apertura del DXF R12 con capas y textos Unicode `\U+`); definición de la futura **TW-04K** (persistencia transversal de criterios aprobados); confirmación de valores de diseño por Tannia.

## 7. Gates
1. **No romper lo existente:** suite completa verde en Linux y Windows.
2. **Originales intactos**; todo se escribe bajo `03 Trabajo` (guardas de ruta ya existentes).
3. **Geometría verificable de forma independiente:** el DXF generado se vuelve a leer con el motor DXF *y* (si está disponible) con un oráculo externo (ezdxf); áreas del modelo = áreas medidas.
4. **Refinamiento sin regresiones:** pruebas de que una edición solo cambia lo declarado.
5. **Sin invenciones:** ningún valor normativo citado; criterios marcados `practica_de_diseno`; fuentes sin números de artículo.
6. **Distinción anteproyecto / construcción** en cada salida.
7. **Aceptación real:** abrir el DXF/DWG en AutoCAD 2027 de Tannia — pendiente hasta ejecutarla.

## 8. Límites de la primera entrega (declarados)
Plantas rectangulares de un piso (sin L/U, sin pendientes); programa: 2–4 dormitorios, 1–2 baños, living-comedor, cocina abierta o cerrada; sin mobiliario ni equipamiento sanitario dibujado; sin terreno/retranqueos/rasantes (se **preguntan**); sin 3D todavía; sin cálculo estructural ni térmico/acústico. Cotas como geometría editable (no entidades DIMENSION asociativas).
