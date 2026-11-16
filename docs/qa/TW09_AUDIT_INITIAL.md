# TW-09 — Auditoría inicial: hallazgos y su resolución

Fuente: `docs/implementation/TW09_AUDITORIA_Y_MACROFASE_FINAL_2026-11-16.md` (análisis estático del baseline `16a7bd7` + ensayo real reportado por el PO). **Causa comprobada** = reproducida con una prueba que falla sin la corrección.

| Hallazgo | Causa | Estado de la causa | Corrección y prueba |
|---|---|---|---|
| F01 `persistencia=verificada` con 51 leídas y 0 tras reabrir | `persistencia` salía solo de comparar propiedades por handle; `entidades_tras_reabrir` era informativo | **Comprobada** en código y reproducida en simulación | verificación global (conteos de 5 fuentes, re‑enumeración, handles en ambos sentidos, capas, ruta); `tw17` |
| F01b por qué AutoCAD informó `ModelSpace.Count=0` | — | **NO establecida** (hipótesis: conteo aún no disponible tras `Open`, documento no activo, enumeración COM) | instrumentación: conteo inicial/final y espera en la reapertura (`reapertura` en el resultado) para diagnosticar en la próxima prueba real |
| F02 2D 2500 vs 3D 2400/2600 “coherente” | `coherenciaConGeo` solo comparaba huella y vanos; altura 3D por defecto fija 2400 | **Comprobada** | facetas con semántica libre/bruta, altura tomada del plano 2D, supuestos derivados del modelo final; `tw18` |
| F03 `AUTOCAD_SIN_DOCUMENTO` | todos los scripts exigían `ActiveDocument` antes de ejecutar | Dependencia **comprobada**; la falla real **no reproducida** | conexión a la aplicación sin documento; resolución por ruta; `construir_3d`/`abrir_copia`/`dxf_a_dwg`/`estado` sin documento previo; `tw17`, `tw09` |
| F03b reintentos de mutaciones con AutoCAD ocupado | `#exec` reintentaba cualquier script | **Comprobada** | solo lecturas se reintentan; `tw17` |
| F04 semántica de vanos | `ancla`/`distancia_mm` mide el centro; el catálogo no lo decía | **Comprobada** | descriptores, inspección con tramos libres, candidatos y previsualización; `tw19` |
| F05 ingreso manual de documentos | no había identidad, resolución ni importación | **Comprobada** | `tannia_proyecto_resolver/resumen/importar`; `tw20` |
| F06 generador 2D limitado | un piso, rectangular, 2–3 dorm., 55–130 m² | **Comprobada** (documentada) | enrutador de capacidades y límites a comunicar; `tw22` |
| F07 escritura de versiones en pasos separados | historial al final, archivos antes | **Comprobada** | transacción + reconciliación + manifiesto con hashes; `tw21` |
| F07b exportaciones reemplazaban archivos | `copyFileSync` sobre destino existente; sello de segundo | **Comprobada** | `escribirSinSobrescribir`; `tw21` |
| F08 respuestas con todo el JSON; instrucción “preguntar siempre” | `ok()` sin tope; reglas del servidor | **Comprobada** | tope de texto, política de 4 categorías; `tw22` |
| F09 `originales ok` con 0 originales | `ok:true` sin distinguir | **Comprobada** | estado `sin_originales_que_verificar`, `proteccion_validada`; `tw20` |
| F10 esquemas MCP / reintentos / docs envejecidas | `z.tuple` (corregido en `e9084a0`); reintento mutante; encabezado desactualizado | **Comprobada** | prueba recursiva de esquemas (`tw16`); reintentos (`tw17`) |
| F11 riesgos de integración (concurrencia, Unicode, junctions…) | — | **Hipótesis** | cubiertos parcialmente en `tw23`; ACL/junctions/rutas largas reales: pendientes (HW) |

Hipótesis descartadas por prueba: ninguna descartada definitivamente en este turno (F01b y la falla real de F03 siguen abiertas).
