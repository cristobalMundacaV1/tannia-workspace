# Corrección de defectos de confianza en el DWG (rama `fix/tw-dwg-confianza`)

**Estado:** corregido y probado con servidor COM simulado y PowerShell simulado. **NO VERIFICADO EN AUTOCAD REAL** hasta repetir la prueba en el equipo del PO (ver «Repetición real»). No se tocó el plano de prueba ni ningún original.

| # | Defecto reportado | Causa raíz | Corrección | Evidencia (reproducible con `npm test`) |
|---|---|---|---|---|
| 1 | Persistencia comparaba propiedades inexistentes como `null` = `null` y "pasaba" | Lectura genérica única (`Length`, `StartPoint`…) para todo tipo | Lectura **tipada** por entidad (LINE, ARC, CIRCLE, 2D/LW polilínea, TEXT, MTEXT) y comparación solo de las propiedades requeridas de cada tipo; lo no informado → `no_verificable`, estado `no_concluyente` (nunca "verificada") | `tw15` tests 1–2, 10 |
| 2 | Timeouts con conjuntos grandes | Una sola llamada COM leía todo | Lotes de 150 handles (máx. 400), timeout proporcional por lote, enumeración paginada (500) por índice, un solo cierre/reapertura | `tw15` test 9 (2000 entidades; ninguna llamada supera el lote) |
| 3 | `capas: []` en `tannia_diseno_a_autocad` | `foreach` sobre `Layers` COM no enumera de forma fiable | Recorrido por índice (`Count`/`Item(i)`); si las capas vienen vacías la verificación de estructura **falla** (`capas_no_informadas`); conteos por capa contra el DXF | `tw15` tests 7–8, 11; `tw09` (PS) |
| 4 | Arcos de puerta con longitud 0 | `IAcadArc` **no tiene `Length`** (usa `ArcLength`) y `[double]$null` = 0 en PowerShell | `ArcLength` + radio/ángulos (radianes); coherencia interna `ArcLength = r × barrido`; longitud 0 → `no_concluyente` en vez de pasar | `tw15` test 3; `tw09` (causa raíz con arco sin `Length`) |
| 5 | Ñ/tildes en AutoCAD | El DXF R12 escapa `\U+00D1`; no estaba comprobado cómo queda en el DWG | `\U+XXXX` se normaliza a Unicode al abrir el DXF; `tannia_diseno_verificar_dwg` clasifica cada texto: **exacto / `\U+` sin decodificar / corrupto**, con puntos de código | `tw15` tests 4–5, 11; `tw09` (Ñ por PowerShell) |
| 6 | Regresión y evidencias | — | `tw15_dwg_confianza.test.js`, `helpers_com.js`, tw06/tw09/tw12 adaptados | 94 pass / 0 fail / 14 skip (PowerShell real: solo Windows → CI) |

## Herramienta nueva
`tannia_diseno_verificar_dwg` (solo lectura, solo sobre la copia activa en `03 Trabajo`): compara el DWG abierto con su DXF de origen por firmas de geometría (LINE, ARC, POLYLINE, TEXT), capas y conteos por capa; estados `fiel` / `con_diferencias` / `no_concluyente`.

## Repetición real (pendiente, la ejecuta el PO)
1. `tannia_diseno_a_autocad` → `capas` no vacías y `verificacion_estructura.ok: true`.
2. `tannia_diseno_verificar_dwg` → `fidelidad: fiel`, 232 entidades; `textos.ok: true` con ≥2 nombres con Ñ.
3. `tannia_cad_verificar_persistencia` sin handles → `verificada`, `no_verificables_total: 0`, `inconsistencias_total: 0`.
Si alguno reporta `no_concluyente`, enviar el JSON completo: indica exactamente qué propiedad no informó AutoCAD.

## Límites
No verificado: comportamiento real de `\U+` en `TextString`, `SaveAs(…,64)`, nombres de propiedades por entidad en AutoCAD 2027. El estado `no_concluyente` existe precisamente para no aprobar por omisión.
