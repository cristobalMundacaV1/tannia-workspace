# Modelo 3D arquitectónico en AutoCAD (rama `feat/tw-modelo-3d`)

**Estado:** implementado y probado con servidor COM simulado y PowerShell simulado. **NO VERIFICADO EN AUTOCAD REAL** hasta ejecutar `PRUEBA_REAL_MODELO_3D.md`.
Es capacidad **general**: el motor no contiene ninguna vivienda ni coordenadas fijas; todo sale del modelo estructurado que diseña Claude Desktop (o del anteproyecto 2D que elija).

## Capacidades (herramientas MCP `tannia_3d_*`)
| Necesidad | Herramienta |
|---|---|
| Generar geometría 3D desde un modelo estructurado o desde un anteproyecto 2D | `tannia_3d_crear` |
| Muros con altura/espesor configurables; vanos (puerta, ventana, paso); losas; cubiertas plana / un agua / dos aguas; niveles | modelo estructurado + operaciones |
| Modificar con nuevas instrucciones (14 operaciones, todo o nada, versión nueva) y resincronizar con el 2D | `tannia_3d_modificar` |
| Ver estructura, supuestos y coherencia con el 2D | `tannia_3d_ver`, `tannia_3d_historial` |
| Crear sólidos 3DSOLID en AutoCAD y guardar DWG 3D independiente | `tannia_3d_a_autocad` |
| Vistas isométricas/planta/alzados, estilo visual, capas (cubierta oculta/visible) | `tannia_3d_vista` |
| Inspeccionar y manipular sólidos | `tannia_3d_inspeccionar`, `tannia_3d_solido_transformar` |
| Verificar cada sólido, capas y coherencia 3D↔2D; cerrar/reabrir | `tannia_3d_verificar`, `tannia_cad_verificar_persistencia` |

## Decisiones técnicas
- Sólidos: `AddBox` (muros, vanos, losas, cubiertas planas) y `AddWedge` (cubiertas inclinadas); muros inclinados por rotación en Z. Sin operaciones booleanas (más robusto): los vanos se resuelven partiendo el muro en prismas disjuntos (tramos, antepechos, dinteles).
- Muros ortogonales: unión por compresión de coordenadas → prismas **sin solapes**. Muros inclinados: un prisma por tramo; los encuentros pueden solaparse (se advierte).
- Convenciones COM no verificadas (centro de `AddBox`, orientación de `AddWedge`): el script lee `Centroid`/`GetBoundingBox` y se **autocorrige**; después Node compara cada sólido (volumen, centroide, caja envolvente, capa) con el valor analítico. Si AutoCAD no informa la caja envolvente → `no_concluyente`, no aprobado.
- Vista: `ActiveViewport.Direction` + `ZoomExtents`; el estilo visual va por comando (`VSCURRENT`) y **requiere confirmación visual**.
- DWG nuevo (`Documents.Add` + `SaveAs`) en `03 Trabajo/Modelos3D/<nombre>/<versión>_3D.dwg`; nunca sobrescribe, no toca el DWG 2D ni originales; ante fallo cierra solo el documento nuevo sin guardar.

## Supuestos y límites (explícitos)
- Alturas de nivel/muro, espesores de losa/cubierta y **pendientes** son datos del modelo: la pendiente es obligatoria y no se asume; la altura por defecto 2 400 mm solo existe al levantar un anteproyecto y se lista como *supuesto a confirmar*. No son valores normativos.
- Contornos de losa/cubierta ortogonales; cubiertas inclinadas rectangulares; cubierta = sólido macizo de visualización (oculta por defecto).
- Sin estructura (vigas, pilares, fundaciones), escaleras, mobiliario, materiales ni render. No apto para construcción ni cálculo; criterios chilenos solo como orientación (`tannia_conocimiento_consultar`).

## Evidencia automatizada
`test/tw16_arq3d.test.js` (12 pruebas: 25 recintos aleatorios con volumen analítico y sin solapes, planta en L de dos niveles, muro a 45°, 3 tipos de cubierta, validaciones, operaciones atómicas, versiones, coherencia 2D con 3 programas distintos, AutoCAD simulado, MCP) y `tw09` (PowerShell simulado con convenciones COM alternativas, en CI Windows).
