# Compatibilidad con AutoCAD

**Estado: NO VERIFICADO EN AUTOCAD REAL.** El desarrollo se hizo sin AutoCAD, sin Windows interactivo y sin Claude Desktop gráfico. Esta página separa lo probado de lo pendiente.

## Qué funciona SIN AutoCAD (probado con fixtures sintéticos)
- Lectura y medición de **DXF ASCII** (LINE, LWPOLYLINE con arcos, ARC, CIRCLE, INSERT con escala/rotación/espejo/arreglos/anidado, POLYLINE 3D, 3DFACE, MESH, POLYFACE). Fixtures generados con `ezdxf` (formato R2010). **No se ha probado con DXF reales exportados por AutoCAD de Tannia.**
- Lectura/medición de PDF vectorial con calibración; detección de escaneados.
- Presupuestos XLSX, APU, memoria PDF.

## Qué requiere AutoCAD real (implementado como contrato, UNVERIFIED)
- Adaptador COM (`src/cad/autocad_com.js`): estado, listar entidades, medir por handle (incluye `Volume` de 3DSOLID/REGION), abrir copia, agregar línea en copia.
- Requisitos: Windows, **AutoCAD completo** (no LT, no Mac), AutoCAD abierto con un dibujo activo. La detección usa el registro (`HKLM\SOFTWARE\Autodesk\AutoCAD`).
- Versiones: ninguna verificada. El adaptador usa `AutoCAD.Application` genérico (la ProgID sin versión); debe confirmarse en la versión de Tannia.

## 3D
Ver la matriz completa en `docs/qa/CAD_CAPABILITY_MATRIX.md` (generada desde el código y verificada por test).
- **DXF:** mallas cerradas (3DFACE agrupadas por capa, MESH, POLYFACE) → área y volumen. **3DSOLID / REGION / SURFACE:** solo se detectan; **no** se calcula volumen desde DXF (datos ACIS opacos).
- **COM (UNVERIFIED):** volumen de sólidos vía propiedades de AutoCAD.
- Un volumen es geometría, **no** una partida: Tannia debe indicar a qué elemento constructivo corresponde.

## DWG
No se lee DWG directamente. Para medir sin AutoCAD: exportar a **DXF ASCII**. Con AutoCAD abierto: adaptador COM (pendiente de verificación).

## Cómo cambiar un estado a SUPPORTED
Ejecutar `docs/qa/MANUAL_TESTS_TANNIA_PC.md` en el AutoCAD real, anotar versión y resultado, y actualizar `src/cad/capabilities.js` con la evidencia (el test de integridad lo exige).
