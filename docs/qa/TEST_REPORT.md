# Reporte de pruebas y cobertura

> Generado por `scripts/qa-report.mjs` el 2026-11-15T21:34:40.930Z.

- **SHA:** `85f58b3e7ccc2afcc175c66571c44e6f55d66063` (con cambios sin commitear)
- **Entorno:** Linux 6.18.44-fc-v470 x64 · Node v22.23.4
- **Comando:** `node --test --test-concurrency=1 --experimental-test-coverage test/security.test.js test/tw00a_package.test.js test/tw00a_protocol.test.js test/tw01_dxf.test.js test/tw02_budget.test.js test/tw03_pdf.test.js test/tw03_report.test.js test/tw04_workflow.test.js test/tw05_install.test.js test/tw06_cad.test.js test/tw06a_3d.test.js`
- **Duración:** 38.6 s · **exit code:** 0
- **Resultado:** 53 pruebas · 52 OK · 0 fallas · 1 omitidas

## Omitidas

- "carpeta sin permiso de escritura" se omite al ejecutar como root/Windows (no hay evidencia de esa prueba en este entorno).

## Cobertura de líneas (cobertura experimental de Node, solo `src/` y `test/`)

```
start of coverage report
------------------------------------------------------------------
file              | line % | branch % | funcs % | uncovered lines
------------------------------------------------------------------
src               |        |          |         | 
 budget           |        |          |         | 
  calc.js         | 100.00 |    85.71 |  100.00 | 
  xlsx.js         |  96.90 |    86.96 |   83.33 | 125-128
 cad              |        |          |         | 
  autocad_com.js  |  94.12 |    92.11 |   90.00 | 42-47
  capabilities.js | 100.00 |   100.00 |  100.00 | 
  detect.js       | 100.00 |    85.00 |   83.33 | 
 config.js        | 100.00 |   100.00 |  100.00 | 
 dxf              |        |          |         | 
  geometry.js     | 100.00 |    98.04 |  100.00 | 
  inspect.js      | 100.00 |    68.75 |  100.00 | 
  measure.js      |  99.55 |    87.83 |  100.00 | 163
  mesh3d.js       | 100.00 |    85.29 |  100.00 | 
  reader.js       |  99.05 |    94.92 |  100.00 | 22-23
 main.js          | 100.00 |   100.00 |   66.67 | 
 mcp              |        |          |         | 
  util.js         | 100.00 |   100.00 |   83.33 | 
 normativa        |        |          |         | 
  index.js        | 100.00 |    75.00 |  100.00 | 
 pdf              |        |          |         | 
  pdf.js          | 100.00 |    88.04 |   76.00 | 
 project          |        |          |         | 
  projects.js     | 100.00 |    66.67 |  100.00 | 
  store.js        |  97.78 |    78.85 |   96.00 | 60-61 99
 quantities       |        |          |         | 
  engine.js       | 100.00 |    94.52 |  100.00 | 
 report           |        |          |         | 
  memoria.js      | 100.00 |    57.58 |  100.00 | 
 security         |        |          |         | 
  sandbox.js      | 100.00 |    92.31 |  100.00 | 
 server.js        | 100.00 |   100.00 |   66.67 | 
 tools            |        |          |         | 
  cad.js          | 100.00 |    66.67 |   71.43 | 
  index.js        |  98.69 |    66.19 |   89.06 | 62-63 206-208
 version.js       | 100.00 |   100.00 |  100.00 | 
------------------------------------------------------------------
all files         |  99.07 |    85.38 |   92.47 | 
------------------------------------------------------------------
```

## Salida de pruebas

```
✔ rutas maliciosas rechazadas (traversal, absolutas, UNC, ADS, reservados) (4.662715ms)
✔ symlink hacia fuera del proyecto es rechazado (4.56219ms)
✔ proyecto enlazado fuera de Proyectos y carpetas no-proyecto rechazados (1.855279ms)
✔ escritura: originales y antecedentes denegados; trabajo permitido (1.893461ms)
✔ sha256File estable (2.113859ms)
✔ TW-00A: .mcpb se empaqueta, valida y funciona desde instalación limpia (7450.816795ms)
✔ TW-00A: manifest declara carpeta configurable y herramientas reales (0.392214ms)
✔ TW-00A: placeholder sin sustituir cae a la carpeta por defecto (1.000449ms)
✔ TW-00A: vertical MCP stdio -> proyecto -> DXF -> respuesta (621.289176ms)
✔ TW-00A: archivo fuera del proyecto y DXF corrupto dan error claro (565.332554ms)
✔ simple: longitudes, perímetros y áreas coinciden con el oráculo analítico (5.618173ms)
✔ bloques: transformaciones, arreglos, anidamiento y espejo (1.946581ms)
✔ duplicados excluidos de totales y reportados; abiertas y autointersección marcadas (1.382645ms)
✔ unidades: mm confirmado convierte; sin unidades bloquea; discrepancia advierte (3.800396ms)
✔ archivos corruptos o no-DXF lanzan DxfError con código (0.743089ms)
✔ entidades no soportadas se listan (no se inventan cantidades) (1.551612ms)
✔ INSERT con bloque inexistente o recursivo -> needs_review sin colgarse (0.312741ms)
✔ escala no uniforme con círculos/arcos no inventa valores (0.168768ms)
✔ MCP tannia_dxf_medir: bloquea conversión sin unidad y la aplica al confirmar (601.586965ms)
✔ APU y presupuesto: valores calculados a mano (2.152989ms)
✔ bloqueos: precio faltante, cantidad no verificada, unidad distinta, sin APU (1.161961ms)
✔ XLSX: fórmulas presentes, archivo reabrible y recalculado por LibreOffice == cálculo JS (1274.422129ms)
✔ XLSX borrador con pendientes: marca PENDIENTE y no entrega total final (18.423548ms)
✔ cantidades: reglas exigen parámetros, sin valores por defecto (4.351151ms)
✔ cantidades: unidad no confirmada, needs_review y discrepancia (7.802353ms)
✔ inspección: vectorial, pistas de escala como dato, texto malicioso solo como dato (133.449331ms)
✔ escaneado detectado; corrupto y no-PDF con error claro (10.619852ms)
✔ calibración por cota y medición de longitud/área reales (1:100) (2.634281ms)
✔ calibración errónea o sin verificar marca needs_review (0.2687ms)
✔ varias páginas con calibración independiente (5.584523ms)
✔ curvas Bézier se aplanan: círculo con área ≈ πr² (tolerancia 0.2 %) (2.248057ms)
✔ memoria PDF: válida, reabrible, con acentos, trazabilidad, advertencias y BORRADOR (444.435096ms)
✔ latin(): transliteración de símbolos fuera de WinAnsi (0.417429ms)
✔ TW-04 flujo completo de producto [fuente] (1890.520265ms)
✔ TW-04 flujo completo de producto [bundle .mcpb] (1339.605023ms)
✔ TW-05: actualización conserva datos del usuario; desinstalar no borra proyectos; reinstalar los recupera (16824.248725ms)
✔ TW-05: los registros del servidor no contienen rutas, nombres de proyecto ni contenido (1634.229597ms)
✔ TW-05: reparar recrea carpetas y restaura JSON dañado; sin red en el código del producto (850.261796ms)
﹣ TW-05: carpeta sin permiso de escritura se reporta con mensaje claro (0.21825ms) # SKIP
✔ matriz: completa, sin SUPPORTED sin evidencia real en tests, y autocad_com sin SUPPORTED (1.933156ms)
✔ docs/qa/CAD_CAPABILITY_MATRIX.md está al día con el código (0.499842ms)
✔ detección: parseo del registro, LT, y sistemas no Windows (1.012469ms)
✔ contrato COM: scripts estáticos sin comandos destructivos; datos solo por entrada JSON (0.828572ms)
✔ contrato COM: edición solo en copias de 03 Trabajo; entradas con inyección rechazadas (6.98038ms)
✔ contrato COM: errores traducidos y no-Windows (0.853454ms)
✔ MCP: herramientas CAD (matriz, listado) y negativa clara sin AutoCAD (32.002258ms)
✔ 3DFACE: cubo 2x3x4 de 6 caras -> volumen 24 y área 52 (oráculo analítico) (7.896081ms)
✔ MESH: pirámide de base 1x1 y altura 1 -> V=1/3; POLYLINE 3D longitud 17 (2.055347ms)
✔ malla abierta: sin volumen y needs_review; normales invertidas: valor absoluto con aviso (0.760291ms)
✔ 3DSOLID/REGION/SURFACE: detectados pero SIN volumen inventado (1.355265ms)
✔ cantidad de volumen solo desde mallas cerradas, con conversión cúbica (mm→m) (2.961917ms)
✔ transformación con espejo (escala -1) conserva volumen positivo y sin falso aviso de normales (1.03832ms)
✔ POLYFACE (POLYLINE bit 64): prisma 1x1x2 -> V=2, A=10 (2.118876ms)
```
