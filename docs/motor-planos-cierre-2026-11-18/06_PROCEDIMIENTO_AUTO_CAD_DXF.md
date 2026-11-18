# DIAGNÓSTICO DE APERTURA DEL DXF APARENTEMENTE VACÍO — UAT CONTROLADA

**Archivo del caso:** `PLANOS-COMPLETOS.dxf` de la corrida `UAT-PLANOS-RESULTADOS.zip` (74.505 bytes; SHA-256 `dd971a870fe2065757a2d5f251f2d139f913afdaef2dedb70112755747d41005`).

## Sin modificar ni sobrescribir el original

1. Copiar el DXF en una carpeta de prueba con nombre identificable y capturar su SHA-256. Abrir la **copia** mediante AutoCAD 2027 completo (no LT, si se van a ensayar Core Console/COM luego). Registrar la pantalla inicial y el nombre del dibujo que aparece en el título de la aplicación.
2. Determinar si AutoCAD abrió el DXF, un nuevo `Dibujo1`/`Drawing1` vacío o una ventana de aviso de importación. Registrar el texto del aviso y la línea de comandos.
3. En el espacio **Modelo/Model**, escribir `_.ZOOM`, Enter, `_Extents`, Enter (o `_.ZOOM`↵`_E`↵). Registrar si aparecen entidades. Esta es una **prueba diagnóstica**, no la solución final.
4. Cambiar a las presentaciones `TW12-01`, `TW12-02`, `TW12-03`, `TW12-04` y `TW12-05`, capturando al menos dos. Ejecutar `_.REGENALL` y comprobar que los viewport muestran sección/planta/perfil y anotaciones de papel.
5. En **copia**, ejecutar `_.AUDIT`; si propone corregir, permitirlo solo en la copia de prueba y conservar registro. Comprobar cantidad/calidad de entidades/cotas, layers on/off/frozen, y que los textos no desaparecen.
6. Guardar una nueva copia DWG mediante `SAVEAS`, cerrar y reabrir esa copia; verificar modelo, layouts, escalas, color, cotas y trazado a PDF.
7. Registrar: `VERSION_AUTOCAD`, `VERSION_WINDOWS`, `ARCHIVO_SHA`, `VENTANA_INICIAL`, `ZOOM_EXTENTS_VISIBLES`, `LAYOUTS_VISIBLES`, `REGEN_RESULTADO`, `AUDIT_RESULTADO`, `DWG_REAPERTURA`, `PDF_TRAZADO`, `CAPTURAS`.

## Interpretación prudente

- Si **Zoom Extents** revela las entidades: probable falla de estado de vista inicial y/o extensión de modelo, que debe corregir el escritor DXF, no la persona manualmente.
- Si Modelo se ve pero `TW12-01..05` no: investigar ownership de LAYOUT/BLOCK_RECORD/VIEWPORT, escalas, display, paper/margin/plot, capas y UCS.
- Si AutoCAD carga un documento nuevo en lugar del DXF, o emite error: investigar asociación del archivo/importación/parsing; guardar log, no cambiar el programa al azar.
- Si los objetos aparecen pero son diminutos: la separación artificial en Y ≈ 0–5007,49 m está ampliando demasiado la extensión global; revisar estrategia de vistas y encuadre.
- Si el DXF está visible pero algunas cotas no: caso separado DIMENSION/REGEN/DIMLFAC y render CAD; no inventar medidas.

**Resultado actual:** NO EJECUTADO en AutoCAD 2027 por este revisor. El DXF tiene 47 entidades y un parser independiente no encuentra errores estructurales, pero la UX real del usuario demuestra que eso no basta para cerrar el gate.

**Referencia Autodesk:** https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-Core/files/GUID-66E7DB72-B2A7-4166-9970-9E19CC06F739.htm .