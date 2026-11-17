# Changelog

## Sin publicar — fix CAD-OPEN-01 (3.ª incidencia): DXF por `Import`, no por `Documents.Open`
- `Documents.Open` solo recibe `.dwg` (guardia en PowerShell y `viaApertura` en Node). Un `.dxf` se importa en un documento nuevo y aislado (`Documents.Add` + `Document.Import`); `Dibujo1` y otros documentos no se tocan.
- Puerta de verificación antes de guardar cualquier DWG: layouts, viewports, cotas, XDATA `TANNIA_TRACE`, textos del cajetín y conteos por capa se miden en AutoCAD y se comparan con el DXF; si algo falta no se guarda nada (`IMPORTACION_DXF_INCOMPLETA`).
- Se conservan: tiempo límite por defecto, instancia única, reconciliación tras tiempo agotado y estado incierto (marca `importacion-*.pendiente.json`).
- NO VERIFICADO en AutoCAD real; la causa del tiempo agotado no se atribuye a este defecto sin esa prueba. Ver `docs/tw12/PROCEDIMIENTO_PRUEBA_DXF_AUTOCAD_2027.md`.

## 0.1.0-rc.3 (candidato — cierra issue #9 y prepara la validación 2D final; no validado por Tannia)
- Originales: política allow/deny explícita; `.dwl/.dwl2/.bak/temporales` no se registran ni se protegen; manifiesto v2 con migración segura; advertencia de captura inestable.
- COM: `tannia_cad_leer_geometria`, `tannia_cad_verificar_contorno` (cierre/rectángulo), `tannia_cad_verificar_persistencia` (cierre y reapertura segura).
- Matriz de capacidades con la evidencia real aportada (AutoCAD 2027, rc.2) y solo para las celdas ejecutadas.

## 0.1.0-rc.2 (candidato — corrige issue #8; no validado por Tannia)
- Unicode PowerShell↔Node: salida en base64 UTF-8 (`TANNIA_OUT`), `-EncodedCommand`; rutas con `ó ñ`, espacios y apóstrofo.
- Autorización de copia con causas separadas y re-verificación dentro de PowerShell; originales siguen protegidos.
- `tannia_cad_estado`: registro y COM independientes; diagnóstico por etapa/HRESULT saneado; reintento si AutoCAD está ocupado; ProgIDs versionados.
- Capa creada/seleccionada antes de dibujar; nueva `tannia_cad_agregar_lineas` (todo o nada, con reversión).
- `tannia_cad_listar_entidades` con longitudes (`con_medidas`).
- `tannia_diagnostico`: origen de la carpeta, hora/PID del servidor y advertencias de configuración.
- Pruebas de regresión con PowerShell real en CI Windows (AutoCAD simulado).

## 0.1.0-rc.1 (candidato de lanzamiento técnico — no validado por Tannia)
- TW-00A: servidor MCP local (Node, stdio), lector DXF, sandbox de rutas, paquete `.mcpb`.
- TW-01: medición DXF 2D (líneas, arcos, círculos, polilíneas con arcos, bloques transformados), unidades bloqueadas hasta confirmar, duplicados y `needs_review`.
- TW-02: reglas de cantidad sin valores por defecto, APU, presupuesto CLP, XLSX con fórmulas verificado por LibreOffice.
- TW-03: PDF calibrado (vectorial), detección de escaneados, memoria PDF; evaluación de OpenTakeoff (AGPL, no incorporado).
- TW-04: flujo de producto con estados y gates, huellas de originales, copias de trabajo, partidas desactualizadas, normativa orientativa.
- TW-05: decisión `.mcpb` sin `.exe`, reparación, actualización/rollback/desinstalación probados.
- TW-06/06A: adaptador AutoCAD COM (contrato), matriz de capacidades, mallas 3D con volumen verificado.
- TW-08: paquete RC, dossier de QA y handoff.
