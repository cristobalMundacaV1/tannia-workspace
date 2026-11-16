# TW-10 — Matriz del pipeline TW-09 y compatibilidad (G0, TW10-00-01)

Baseline `eb76789`. Cadena actual: **generador → derivar → coherencia → salidas → puente 3D → CAD**.

| Etapa | Archivo | Entrada | Salida | Limitación para TW-10 (hallazgo) | Respuesta TW-10 |
|---|---|---|---|---|---|
| generador | `src/design/generador.js` | programa (m², dorm, baños) | árbol de particiones de **un rectángulo** | A01/A03: una topología, A/B espejo; 55–130 m², 2–3 dorm | Se conserva intacto (v1). Nuevo `src/architect/partidos/*` genera huellas poligonales. |
| derivar | `src/design/derivar.js` | modelo árbol | recintos netos, muros, vanos, cotas | A04: contorno `AX+te` rectangular | `src/architect/geometria/derivar_poly.js` desde polígonos de recinto. |
| coherencia | `src/design/coherencia.js` | modelo + geo | solapes/áreas/vanos | A08: sin clima/vistas/seguridad | Nuevo evaluador por familias (`src/architect/evaluacion`). |
| salidas | `src/design/salidas.js` | modelo + geo | DXF R12 / SVG / ASCII con `geo.exterior` | A05: bbox | Nuevo emisor DXF/SVG poligonal reutilizando capas y `textoDxf`. |
| puente 3D | `src/arq3d/desde_anteproyecto.js` | geo | modelo 3D (muros por ejes, **losa = bbox**) | A07: tapa un patio | Compilador `schemeA3d` con losa por huella real (varias losas ortogonales). |
| motor 3D | `src/arq3d/geometria.js` | modelo 3D | primitivas cajas/cuñas (`rectangulosDePoligono`) | A06: ya soporta contornos ortogonales | Reutilizado. |
| CAD | `src/cad/autocad_com.js` | primitivas | DWG verificado (TW-09) | — | Sin cambios; AutoCAD real = pendiente de hardware. |

## Compatibilidad
- Modelos v1 (`version_modelo:1`) y 3D (`esquema:1`) se leen sin migración; `scheme/2` es un formato **nuevo y aparte**; conversión v1→v2 solo por copia (G4-05).
- Las 61 herramientas TW-09 conservan sus esquemas (prueba de regresión de contrato en `test/tw10_g0_regresion.test.js`).
