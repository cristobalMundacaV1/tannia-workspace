# Matriz de riesgos (RC técnico)

| ID | Riesgo | Prob. | Impacto | Mitigación implementada | Residual / pendiente |
|---|---|---|---|---|---|
| R-01 | Cantidad errónea por unidad/escala equivocada | Media | Alto | Conversión bloqueada hasta confirmar unidad; discrepancia INSUNITS↔confirmada → needs_review; calibración PDF con verificación cruzada | La usuaria debe confirmar con una cota real |
| R-02 | Cifra inventada (altura, espesor, precio) | Media | Alto | Reglas exigen parámetros explícitos; precios sin fuente/fecha bloquean FINAL; APU sin precio → PENDIENTE | Depende de que el modelo pregunte (instrucciones del servidor) |
| R-03 | Modificación de originales | Baja | Alto | Copia previa, huellas SHA-256, solo lectura, escritura denegada por código en `02 Originales` y `01 Antecedentes`, adaptador COM solo en `03 Trabajo` | Probado en POSIX/CI; permisos NTFS reales y COM sin verificar |
| R-04 | Salida de ruta (traversal, symlink, junction, ADS) | Baja | Alto | Validación de ruta + realpath; pruebas | Junctions de Windows no probadas en CI |
| R-05 | Prompt injection desde DXF/PDF | Media | Medio | Texto de archivos solo como dato; sin herramientas que ejecuten texto; gates de aprobación | Comportamiento del modelo no medido |
| R-06 | Aprobación sin revisión humana | Media | Alto | Gates + `aprobado_por` + confirmación + auditoría | El modelo podría completar los campos; mitigar con capacitación de uso |
| R-07 | AutoCAD real se comporta distinto del contrato | Alta | Medio | Matriz UNVERIFIED; manual de pruebas C | **Pendiente de hardware** |
| R-08 | `.mcpb` no instala en la versión de Claude Desktop de Tannia | Media | Alto | Manifest estándar 0.3; probado desempaquetado/ejecución | **Pendiente de prueba en su PC**; plan B: instalador (reabrir decisión TW-05) |
| R-09 | DXF reales con entidades no cubiertas | Alta | Medio | Entidades no soportadas listadas, nunca omitidas en silencio | Cobertura real desconocida hasta piloto |
| R-10 | Licencias de terceros | Baja | Medio | Inventario automático; OpenTakeoff (AGPL) no incorporado | `buffers@0.1.1` sin licencia declarada |
| R-11 | Privacidad de planos | Media | Medio | Procesamiento local, logs sin datos, aviso explícito | El contenido leído por Claude va al servicio remoto |
| R-12 | Excel calcula distinto al esperado | Baja | Medio | Verificación independiente con LibreOffice; redondeo explícito | Microsoft Excel no probado |
