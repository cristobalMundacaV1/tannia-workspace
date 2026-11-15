# Changelog

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
