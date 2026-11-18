# UAT de planos en AutoCAD 2027 — Tannia Workspace {{VERSION}}

**Estado del candidato:** CANDIDATO PARA UAT CONTROLADA. **No** es un producto profesionalmente aprobado.
Paquete `{{MCPB}}` · commit `{{COMMIT}}`.

Esta prueba **no necesita Claude**. Usa los planos de referencia incluidos en este ZIP (`PLANOS-PRUEBA/`) o los que genera
`PROBAR_PLANOS.cmd`. Trabaje siempre sobre **copias**: no abra ni guarde encima de los archivos originales.

## Qué se va a comprobar
| Paso | Comprobación | Resultado esperado |
|---|---|---|
| A | Abrir `PLANOS-PRUEBA/Prueba planos tunel UAT/…-planos.dxf` (copia) en AutoCAD 2027 completo | Abre el dibujo (no un «Dibujo1» vacío) y se **ve la geometría sin usar ZOOM** |
| B | Pestaña **Modelo** | Planta, perfil, sección, detalles y fortificación visibles y encuadrados |
| C | Pestañas `TW12-01` … `TW12-06` | Cada una muestra su lámina: marco, cajetín, cuadros, leyenda y la vista dentro del viewport |
| D | `_.REGENALL` | Cotas, tramas (shotcrete, malla), símbolos y llamadas D1–D4 siguen visibles; cotas con valor y unidad «m» |
| E | `_.AUDIT` (en la COPIA) | Registrar el resumen («errores encontrados / corregidos») |
| F | `_.SAVEAS` a DWG (copia), cerrar y reabrir | Mismo contenido en Modelo y presentaciones |
| G | Trazar `TW12-05` y `TW12-06` a PDF («DWG To PDF.pc3», escala 1:1) | Comparable con `…-lamina-05.pdf` y `…-lamina-06.pdf` del motor |
| H | Repetir A–D con `PLANOS-PRUEBA/Prueba planos edificacion/…-planos.dxf` | Presentaciones `EDI-01` y `EDI-02` visibles |

## Registro (complete y devuelva al Product Owner)
```
VERSION_AUTOCAD:
VERSION_WINDOWS:
ARCHIVO_SHA (certutil -hashfile <copia.dxf> SHA256):
VENTANA_INICIAL (pestaña activa y qué se ve, sin zoom):
ZOOM_EXTENTS_NECESARIO (sí/no):
LAYOUTS_VISIBLES (TW12-01..06):
REGEN_RESULTADO:
AUDIT_RESULTADO:
DWG_REAPERTURA:
PDF_TRAZADO (comparación con el PDF del motor):
TRAMAS_Y_SIMBOLOS (se ven / no se ven):
CAPTURAS (nombres de archivo):
OBSERVACIONES_PROFESIONALES:
```

## Interpretación
- Si en el paso A **hace falta ZOOM Extensión** para ver algo, el defecto P0 **no** está cerrado: informar con captura.
- Si Modelo se ve pero una presentación aparece vacía: anotar cuál, y si `_.REGENALL` lo corrige.
- `ezdxf` y los verificadores automáticos del paquete **no acreditan** AutoCAD real: este registro es la evidencia del gate G11.
- Los datos marcados **PENDIENTE** en los planos (placa, tuerca, diámetro, lechada, solera, drenaje, ancho de paño, especificaciones
  técnicas) **no fueron declarados** y no deben completarse en el dibujo sin un antecedente.
- La simbología es un perfil **PROPUESTO** (`tw.symbol-catalog/1`), no una convención normativa certificada.
