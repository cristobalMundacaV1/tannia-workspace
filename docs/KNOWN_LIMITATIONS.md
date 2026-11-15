# Limitaciones conocidas del RC técnico

## Bloqueantes de "VALIDADO FINAL" (no de la entrega técnica)
| ID | Límite | Estado |
|---|---|---|
| L-01 | Nunca se ejecutó contra AutoCAD real (COM, DWG, sólidos) | NO VERIFICADO EN AUTOCAD REAL |
| L-02 | Nunca se instaló desde la interfaz de Claude Desktop (solo protocolo MCP automatizado) | NO VERIFICADO |
| L-03 | No se probó con planos/DXF/PDF reales de Tannia (solo fixtures sintéticos) | PILOTO TANNIA PENDIENTE |
| L-04 | Pruebas en Windows: solo el CI de GitHub (`windows-latest`); no en el PC de Tannia ni con usuario estándar/rutas >260 | PARCIAL (ver EVIDENCE_MATRIX) |

## Funcionales
- **DXF binario** no soportado (error claro). **DWG** no se lee sin AutoCAD.
- Escala **no uniforme** con círculos/arcos/bulges: sin valor (needs_review). `ELLIPSE`, `SPLINE`, `HATCH`, `SOLID` 2D, `DIMENSION`, `XREF`: **no medidos**, listados como no soportados.
- Entidades con extrusión (OCS) distinta de +Z: sus longitudes y áreas no cambian (transformación rígida), pero su **posición** no se transforma; puede afectar la detección de duplicados y la ubicación de INSERT.
- **Autointersección** detectada de forma aproximada (arcos en 24 tramos).
- **3DSOLID/REGION/SURFACE:** sin volumen desde DXF. Mallas abiertas: sin volumen. Mallas poligonales (POLYLINE m×n) no medidas.
- **PDF:** la medición depende de la calibración; no detecta escalas mixtas dentro de una página; escaneados con precisión limitada; no extrae capas OCG.
- **Presupuesto:** no incluye catálogo de partidas, precios, rendimientos ni gastos de mercado: **todo lo entrega la usuaria con fuente y fecha**. IVA 19 % por defecto (verificar). Un APU no convierte unidades automáticamente.
- **XLSX** verificado con LibreOffice y exceljs, **no** con Microsoft Excel.
- **Normativa:** índice de fuentes oficiales; no cita artículos ni certifica cumplimiento. Los enlaces de BCN no pudieron comprobarse (HTTP 401 en el entorno de desarrollo).
- **Aprobación:** el código exige `aprobado_por` y confirmación explícita, pero una herramienta no puede garantizar que el modelo no complete esos campos sin preguntar. Defensa adicional: las instrucciones del servidor y el registro de auditoría `.tannia/auditoria.jsonl`.
- **Prompt injection:** defensa estructural (el contenido de archivos solo se devuelve como dato; las herramientas no ejecutan texto). El comportamiento del modelo ante textos maliciosos NO se midió.
- **Privacidad:** el contenido que Claude lee se envía al servicio de Claude.

## Dependencias
- `uuid` (vía `exceljs`): advisory GHSA-w5hq-g745-h8pq (moderado) en llamadas con `buf` explícito; el código del producto no lo usa → P3 aceptado.
- `buffers@0.1.1` (transitiva de `exceljs`): sin licencia declarada → pendiente de revisión legal (`docs/LICENSES.md`).
- La versión del paquete es `0.1.0-rc.1`; el ejecutable no está firmado.
- **Reproducibilidad:** el contenido interno del `.mcpb` es idéntico entre compilaciones (verificado), pero el hash del archivo `.mcpb` varía por marcas de tiempo del zip. Use `release-manifest.json → contenido_sha256` para comparar compilaciones; el hash del archivo entregado sí identifica esa entrega concreta.
