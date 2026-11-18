# Changelog


## 0.2.0-rc.2 — 2026-11-17 (candidato; no aceptado)
- Moneda como dimensión tipada; conversión de divisas solo con tasa, fuente y fecha (antes CLP→USD 1:1).
- Una sola política de redondeo para el CIC, el presupuesto y el Excel (antes diferían con precios decimales).
- Memoria PDF sin página final vacía.
- Motor genérico de planos (planta, corte, elevación, perfil, sección y detalle) y segundo dominio de edificación.
- Túnel: lámina de fortificación con pernos y malla dibujados y cubicados por el mismo motor.
- Presupuesto con alcance completo o parcial y advertencia de precios no vigentes.
- Ventanas de autorización como pregunta con seis respuestas; detalles técnicos plegados.
- Archivos entregados como vínculos MCP, con nombres y carpeta comprensibles.
- Procedimiento «Desarrollar un proyecto completo».
- Limitaciones: AutoCAD real, WPF en Windows y presentación de archivos en Claude Desktop NO VERIFICADOS. Ver docs/auditoria-integral-2026-11-17.

## 0.2.0-rc.1 (candidato NO validado — remodelación Astra: autoridad, entrega y paquete)
- **A-01 cerrado (N1):** verificar cantidades y aprobar entregas exige una ventana respondida por una persona (formulario del cliente o diálogo del SO); el modelo no puede hacerlo con nombres ni booleanos. Recibos HMAC ligados a acción, objeto, versión, huella y revisión. Canal de archivo desactivado para estas acciones.
- **A-02 cerrado (N1):** revisiones monótonas del expediente; artefactos ligados a la revisión; la aprobación cubre un manifiesto exacto y se consume al exportar; exportación transaccional a `07 Entregables/Entrega R<n> …` con manifiesto y huellas. Nunca «el último archivo».
- **A-03 cerrado (N1):** comparador DXF→DWG por contrato (capa, orden/sentido, bulge, elevación, OCS, círculos); tipos sin comparador o lecturas incompletas ⇒ no concluyente.
- **A-04 cerrado:** gastos generales, utilidades e IVA ya no se suponen.
- MethodCards MC01/MC02/MC04 (`tannia_metodo`) con origen de cada dato; migración segura de proyectos (`tannia_proyecto_migracion`); `tannia_entrega_estado`; 5 procedimientos para Claude Desktop (prompts MCP) y Skills de Claude Code; referencias normativas con fuente/versión/fecha/ámbito/límites.
- ZIP de instalación para Windows x64 con `INSTALAR.cmd`, diagnóstico, guía, recuperación, licencias y SHA-256; verificador del artefacto final en CI (Ubuntu y Windows).
- NO probado en Claude Desktop real, AutoCAD real ni con revisión profesional. Ver `docs/release-candidate/`.

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
