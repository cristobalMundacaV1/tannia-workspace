# Evaluación de componentes de terceros (TW-03 / TW-06)

Fecha: 2026-11-15. Método: lectura de `README` y `LICENSE` públicos vía `raw.githubusercontent.com` desde el entorno de desarrollo. **No se auditó el código fuente completo ni se ejecutó ningún binario de terceros.** Por tanto ningún componente se incorpora ni redistribuye en este RC.

## OpenTakeoff (`Kentucky-ai/opentakeoff`)
- Licencia confirmada en el archivo `LICENSE`: **GNU AGPL-3.0**. El README ofrece lienzo web y un servidor MCP (`opentakeoff-mcp`, ~69 herramientas, vía `npx`).
- Implicación: incorporar su código en el paquete de Tannia (o enlazarlo en un servicio) obliga a cumplir AGPL-3.0 sobre el conjunto derivado, incluida la oferta de código fuente a los usuarios de un servicio en red. Además `npx -y` descargaría código sin versión fijada en el PC de Tannia: contradice la regla de dependencias fijadas.
- **Decisión técnica de este RC: NO incorporar.** Se implementó medición PDF propia (`src/pdf/pdf.js`): extracción vectorial con `pdfjs-dist` (Apache-2.0), calibración explícita por cota con verificación cruzada y marcas `needs_review`.
- Pendiente (decisión del PO/jurídica): si se desea usar OpenTakeoff como herramienta **separada** que Tannia instale por su cuenta, requiere revisión de código, versión fija y evaluación de privacidad antes de recomendarla. Estado: `NO AUDITADO`.

## AutoCAD MCP (`ajaquin8/autocad-mcp`)
- README y LICENSE públicos: **MIT**; se adjunta a una sesión AutoCAD en ejecución vía COM (`GetActiveObject`); Windows con AutoCAD completo (no LT, no Mac); distribuido como `.mcpb`; incluye guardas de edición (solo dibujos creados por el servidor salvo `allow_edit_document`).
- No se revisó su código ni se probó (no hay AutoCAD ni Windows en el entorno). Sus capacidades 3D no están documentadas en lo leído.
- **Decisión técnica de este RC:** no se redistribuye. Se define un **adaptador propio con contrato** (`src/cad/`) cuya implementación COM queda `NO VERIFICADO EN AUTOCAD REAL`. Candidato para evaluación posterior en el PC de Tannia: instalarlo junto a Tannia Workspace es opción del PO tras auditar versión fija y permisos; Tannia Workspace funciona sin él para DXF/PDF.

## Dependencias empaquetadas (licencias)
Ver `docs/LICENSES.md` (generado en TW-08 a partir de `npm ls`).
