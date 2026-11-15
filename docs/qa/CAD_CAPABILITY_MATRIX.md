# Matriz de capacidades CAD (entidad × operación × backend)

> Generado por `scripts/gen-docs.mjs` desde `src/cad/capabilities.js`. No editar a mano.

Estados: **SUPPORTED** = hay evidencia ejecutada de ese backend; **UNSUPPORTED** = no soportado o no aplica; **UNVERIFIED** = contrato implementado, sin verificación real.

## Backend `dxf_archivo`

Lector DXF propio (solo lectura) de Tannia Workspace. **Entorno de evidencia:** Fixtures sintéticos generados con ezdxf (DXF R2010). NO se probó con DXF reales exportados por AutoCAD.  
**Versión probada:** DXF R2010 (AC1024) sintético

| Entidad | detectar | leer | longitud | superficie | volumen | editar_en_copia | exportar |
|---|---|---|---|---|---|---|---|
| LINE | SUPPORTED | SUPPORTED | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| LWPOLYLINE | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| ARC | SUPPORTED | SUPPORTED | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| CIRCLE | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| BLOCK/INSERT | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| 3DPOLY | SUPPORTED | SUPPORTED | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| 3DSOLID | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| REGION | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| SURFACE | SUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED | UNSUPPORTED |
| MESH | SUPPORTED | SUPPORTED | UNSUPPORTED | SUPPORTED | SUPPORTED | UNSUPPORTED | UNSUPPORTED |

## Backend `autocad_com`

Automatización COM de AutoCAD (PowerShell) — contrato + pruebas con ejecutor simulado. **Entorno de evidencia:** Contrato probado con ejecutor simulado y AutoCAD simulado en PowerShell (CI). Contra AutoCAD real solo hay evidencia aportada por el usuario para las celdas marcadas (ver `real`); sin artefactos de log adjuntos aún.  
**Versión probada:** AutoCAD 2027 español R26.0 (sesión 26.0s), Windows — SOLO las celdas con evidencia real indicada; el resto, ninguna

| Entidad | detectar | leer | longitud | superficie | volumen | editar_en_copia | exportar |
|---|---|---|---|---|---|---|---|
| LINE | UNVERIFIED | UNVERIFIED | SUPPORTED | UNSUPPORTED | UNSUPPORTED | SUPPORTED | UNVERIFIED |
| LWPOLYLINE | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNSUPPORTED | UNVERIFIED | UNVERIFIED |
| ARC | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNSUPPORTED | UNSUPPORTED | UNVERIFIED | UNVERIFIED |
| CIRCLE | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNSUPPORTED | UNVERIFIED | UNVERIFIED |
| BLOCK/INSERT | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 3DPOLY | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 3DSOLID | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| REGION | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNSUPPORTED | UNVERIFIED | UNVERIFIED |
| SURFACE | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| MESH | UNVERIFIED | UNVERIFIED | UNSUPPORTED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |

## Evidencia y notas de las celdas SUPPORTED (dxf_archivo)

- LINE · detectar: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- LINE · leer: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- LINE · longitud: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- LWPOLYLINE · detectar: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- LWPOLYLINE · leer: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- LWPOLYLINE · longitud: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas` — Incluye arcos por bulge.
- LWPOLYLINE · superficie: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas` — Solo cerradas; autointersección → needs_review.
- ARC · detectar: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- ARC · leer: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- ARC · longitud: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- CIRCLE · detectar: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- CIRCLE · leer: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- CIRCLE · longitud: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas` — Circunferencia (perímetro).
- CIRCLE · superficie: `test/tw01_dxf.test.js :: longitudes, perímetros y áreas`
- BLOCK/INSERT · detectar: `test/tw01_dxf.test.js :: bloques: transformaciones`
- BLOCK/INSERT · leer: `test/tw01_dxf.test.js :: bloques: transformaciones`
- BLOCK/INSERT · longitud: `test/tw01_dxf.test.js :: bloques: transformaciones` — Por expansión con transformación; escala no uniforme con curvas → needs_review.
- BLOCK/INSERT · superficie: `test/tw01_dxf.test.js :: bloques: transformaciones`
- 3DPOLY · detectar: `test/tw06a_3d.test.js :: MESH: pirámide`
- 3DPOLY · leer: `test/tw06a_3d.test.js :: MESH: pirámide`
- 3DPOLY · longitud: `test/tw06a_3d.test.js :: MESH: pirámide`
- 3DSOLID · detectar: `test/tw06a_3d.test.js :: 3DSOLID/REGION/SURFACE` — Se detecta el tipo; el contenido ACIS es opaco.
- REGION · detectar: `test/tw06a_3d.test.js :: 3DSOLID/REGION/SURFACE`
- SURFACE · detectar: `test/tw06a_3d.test.js :: 3DSOLID/REGION/SURFACE`
- MESH · detectar: `test/tw06a_3d.test.js :: MESH: pirámide`
- MESH · leer: `test/tw06a_3d.test.js :: MESH: pirámide`
- MESH · superficie: `test/tw06a_3d.test.js :: 3DFACE: cubo`
- MESH · volumen: `test/tw06a_3d.test.js :: MESH: pirámide` — Solo malla CERRADA y orientada; si no, needs_review sin volumen. También 3DFACE agrupadas por capa y POLYFACE.

## Evidencia REAL contra AutoCAD (autocad_com)

- LINE · longitud: AutoCAD 2027 español R26.0 (sesión 26.0s), extensión 0.1.0-rc.2, 2026-11-15. Length leído por COM en 4 líneas (6000, 4000, 6000, 4000 mm). Fuente: issue #8, comentario 6902750822 (reporte del usuario; artefactos de log pendientes). Reproducible en CI: no.
- LINE · editar_en_copia: AutoCAD 2027 español R26.0 (sesión 26.0s), extensión 0.1.0-rc.2, 2026-11-15. AddLine en una copia de 03 Trabajo, con capa nueva, handles 39A–39D; original íntegro (hash). Fuente: issue #8, comentario 6902750822 (reporte del usuario; artefactos de log pendientes). Reproducible en CI: no.

## Notas de las celdas UNSUPPORTED relevantes (dxf_archivo)

- 3DSOLID · leer: Datos ACIS/SAT cifrados: no se interpretan.
- 3DSOLID · longitud: Requiere AutoCAD.
- 3DSOLID · superficie: Requiere AutoCAD (propiedades de masa).
- 3DSOLID · volumen: Requiere AutoCAD (propiedades de masa): NO se infiere desde el DXF.
- REGION · leer: Datos ACIS opacos.
- REGION · longitud: Requiere AutoCAD.
- REGION · superficie: Requiere AutoCAD.
- SURFACE · leer: Datos ACIS opacos.
- SURFACE · longitud: Requiere AutoCAD.
- SURFACE · superficie: Requiere AutoCAD.
- SURFACE · volumen: No definido para superficies abiertas.

## autocad_com

Solo las celdas listadas arriba como SUPPORTED tienen evidencia real (reportada por el usuario). Todas las demás operaciones con sentido geométrico siguen **UNVERIFIED**: el adaptador existe como contrato y está probado con ejecutores simulados (`test/tw06_cad.test.js`, `test/tw09_windows_powershell.test.js`). Pendiente de la siguiente repetición real: lectura de `StartPoint`/`EndPoint`, cierre del rectángulo y persistencia tras reabrir (`tannia_cad_verificar_contorno`, `tannia_cad_verificar_persistencia`). Se marcarán SUPPORTED únicamente tras ejecutar `docs/qa/MANUAL_TESTS_TANNIA_PC.md` en un AutoCAD real, registrando versión y resultado.

