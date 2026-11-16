# Limitaciones conocidas del RC técnico

## Bloqueantes de "VALIDADO FINAL" (no de la entrega técnica)
| ID | Límite | Estado |
|---|---|---|
| L-01 | Contra AutoCAD real solo se observó (issue #8) conexión COM y lectura de estado en AutoCAD 2027; edición, capas, lote, sólidos y DWG siguen sin verificar. rc.2 corrige los defectos del issue #8 pendientes de repetir la prueba | NO VERIFICADO EN AUTOCAD REAL (parcial) |
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

## Asistente de anteproyecto (TW-DESIGN, primera entrega)
- **Es un anteproyecto**: sin cálculo estructural, térmico ni acústico; sin proyecto de instalaciones; **no apto para construcción**. Los espesores por sistema constructivo, tamaños de recintos, anchos de puerta, alturas y relaciones ventana/piso son **criterios iniciales de práctica de diseño** (editables), no valores normativos. No se citan artículos ni valores de la OGUC/NCh: el servidor no tiene red y no pudo verificar el texto vigente (BCN devolvió HTTP 401 desde el entorno de desarrollo).
- **Alcance geométrico:** planta rectangular de un piso; 2–3 dormitorios, 1–2 baños, 55–130 m²; muros ortogonales; sin L/U, pendientes, terreno, retranqueos, rasantes ni orientación solar (se preguntan). Sin mobiliario ni equipamiento sanitario/cocina dibujado. Cotas como geometría (no entidades DIMENSION asociativas). Muros como contorno de líneas (no polilíneas cerradas por muro).
- **Edición:** catálogo de operaciones acotado; la interpretación del lenguaje natural la hace Claude y puede equivocarse: por eso cada cambio muestra *qué cambió* y se puede deshacer.
- **DXF/DWG en AutoCAD real: NO VERIFICADO.** El DXF es AC1009 (R12) y se validó con el motor DXF propio y con ezdxf; la unidad (mm) se fija al guardar el DWG por COM (`INSUNITS`). `SaveAs` con el tipo 64 (DWG 2018) no se ejecutó contra AutoCAD real.
- **Indicadores sísmicos** (densidad y balance de muros): referencia de anteproyecto sin umbral normativo.

## TW-09 (actualización 2026-11-16)
- **Verificado en AutoCAD real (ensayos del PO):** DXF→DWG, persistencia por lotes de 232 entidades y modelo 3D de 50 sólidos. **No verificado:** causa del conteo 0 tras reabrir en el último ensayo (instrumentada), `AUDIT` automatizado, ACL/junctions de Windows, rutas >260.
- **Adjuntos del chat:** el servidor solo puede importar archivos por ruta local; si Claude Desktop no entrega la ruta del adjunto, la importación no es posible (el producto lo informa, no lo simula).
- **Diseño 2D:** generador de un piso, planta rectangular, 2–3 dormitorios, 1–2 baños, 55–130 m². Otros encargos: modelo 3D estructurado, sin estructura ni mobiliario; BIM/IFC, cálculo estructural, instalaciones y planos de permiso: no soportados.
- **Coherencia 2D↔3D:** compara huella, vanos, altos/antepechos, espesores y altura libre; no es una verificación estructural ni normativa.
- **Versiones:** transaccionales con reconciliación; el DWG aún no tiene manifiesto propio.
- **Exclusión entre procesos:** el bloqueo de versiones asume sistema de archivos local; no hay garantías en carpetas de red ni se probó con OneDrive/antivirus activos. La recuperación de un bloqueo con pid reutilizado espera al vencimiento del latido (10 min); nunca pierde datos.
- **Identidad documental:** verificada con PowerShell simulado y CI Windows; no contra la normalización real de rutas de AutoCAD 2027.
- **Bloqueo de versiones (H5):** un dueño vivo nunca se interviene; una escritura realmente colgada (proceso vivo que no avanza) exige cerrar esa aplicación. La identidad de proceso para pid reutilizado se consulta con `ps`/PowerShell y no se probó en Windows real.
- **Contención de escrituras (H4):** se valida antes y después de cada escritura y por descriptor, pero queda una ventana mínima entre la última comprobación y la apertura del archivo (inherente al sistema de archivos).

