# Reporte de pruebas y cobertura

> Generado por `scripts/qa-report.mjs` el 2026-11-15T22:35:18.389Z.

- **SHA:** `ef061bf63e3a6d836bdfe1f695cc5bbc121223f1`
- **Entorno:** Linux 6.18.44-fc-v470 x64 · Node v22.23.4
- **Comando:** `node --test --test-concurrency=1 --experimental-test-coverage test/security.test.js test/tw00a_package.test.js test/tw00a_protocol.test.js test/tw01_dxf.test.js test/tw02_budget.test.js test/tw03_pdf.test.js test/tw03_report.test.js test/tw04_workflow.test.js test/tw05_install.test.js test/tw06_cad.test.js test/tw06a_3d.test.js test/tw09_windows_powershell.test.js test/tw10_config.test.js`
- **Duración:** 39.5 s · **exit code:** 0
- **Resultado:** 70 pruebas · 59 OK · 0 fallas · 11 omitidas

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
  autocad_com.js  |  89.20 |    85.05 |   80.00 | 110-136 224-227
  capabilities.js | 100.00 |   100.00 |  100.00 | 
  detect.js       | 100.00 |    91.18 |   87.50 | 
  sanitize.js     | 100.00 |    80.00 |  100.00 | 
 config.js        | 100.00 |    88.89 |  100.00 | 
 dxf              |        |          |         | 
  geometry.js     | 100.00 |    98.04 |  100.00 | 
  inspect.js      | 100.00 |    68.75 |  100.00 | 
  measure.js      |  99.55 |    87.83 |  100.00 | 163
  mesh3d.js       | 100.00 |    85.29 |  100.00 | 
  reader.js       |  99.05 |    94.92 |  100.00 | 22-23
 main.js          | 100.00 |   100.00 |   66.67 | 
 mcp              |        |          |         | 
  util.js         | 100.00 |    93.33 |   83.33 | 
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
 server.js        | 100.00 |    75.00 |   66.67 | 
 tools            |        |          |         | 
  cad.js          | 100.00 |    69.23 |   62.50 | 
  index.js        |  99.22 |    64.83 |   90.77 | 209-211
 version.js       | 100.00 |   100.00 |  100.00 | 
------------------------------------------------------------------
all files         |  98.24 |    84.83 |   91.88 | 
------------------------------------------------------------------
```

## Salida de pruebas

```
✔ rutas maliciosas rechazadas (traversal, absolutas, UNC, ADS, reservados) (7.940073ms)
✔ symlink hacia fuera del proyecto es rechazado (3.044349ms)
✔ proyecto enlazado fuera de Proyectos y carpetas no-proyecto rechazados (3.218019ms)
✔ escritura: originales y antecedentes denegados; trabajo permitido (2.606182ms)
✔ sha256File estable (2.935931ms)
✔ TW-00A: .mcpb se empaqueta, valida y funciona desde instalación limpia (7313.605784ms)
✔ TW-00A: manifest declara carpeta configurable y herramientas reales (0.454757ms)
✔ TW-00A: placeholder sin sustituir cae a la carpeta por defecto (1.231027ms)
✔ TW-00A: vertical MCP stdio -> proyecto -> DXF -> respuesta (666.381105ms)
✔ TW-00A: archivo fuera del proyecto y DXF corrupto dan error claro (568.243468ms)
✔ simple: longitudes, perímetros y áreas coinciden con el oráculo analítico (6.956915ms)
✔ bloques: transformaciones, arreglos, anidamiento y espejo (2.509235ms)
✔ duplicados excluidos de totales y reportados; abiertas y autointersección marcadas (1.707617ms)
✔ unidades: mm confirmado convierte; sin unidades bloquea; discrepancia advierte (4.643614ms)
✔ archivos corruptos o no-DXF lanzan DxfError con código (0.832194ms)
✔ entidades no soportadas se listan (no se inventan cantidades) (1.905755ms)
✔ INSERT con bloque inexistente o recursivo -> needs_review sin colgarse (0.385634ms)
✔ escala no uniforme con círculos/arcos no inventa valores (0.229425ms)
✔ MCP tannia_dxf_medir: bloquea conversión sin unidad y la aplica al confirmar (807.394765ms)
✔ APU y presupuesto: valores calculados a mano (2.693893ms)
✔ bloqueos: precio faltante, cantidad no verificada, unidad distinta, sin APU (1.231894ms)
✔ XLSX: fórmulas presentes, archivo reabrible y recalculado por LibreOffice == cálculo JS (1142.810259ms)
✔ XLSX borrador con pendientes: marca PENDIENTE y no entrega total final (25.798672ms)
✔ cantidades: reglas exigen parámetros, sin valores por defecto (5.368339ms)
✔ cantidades: unidad no confirmada, needs_review y discrepancia (8.633253ms)
✔ inspección: vectorial, pistas de escala como dato, texto malicioso solo como dato (149.731903ms)
✔ escaneado detectado; corrupto y no-PDF con error claro (10.694597ms)
✔ calibración por cota y medición de longitud/área reales (1:100) (2.532142ms)
✔ calibración errónea o sin verificar marca needs_review (0.30047ms)
✔ varias páginas con calibración independiente (6.082728ms)
✔ curvas Bézier se aplanan: círculo con área ≈ πr² (tolerancia 0.2 %) (2.488701ms)
✔ memoria PDF: válida, reabrible, con acentos, trazabilidad, advertencias y BORRADOR (400.223164ms)
✔ latin(): transliteración de símbolos fuera de WinAnsi (0.195219ms)
✔ TW-04 flujo completo de producto [fuente] (1830.206865ms)
✔ TW-04 flujo completo de producto [bundle .mcpb] (1304.930403ms)
✔ TW-05: actualización conserva datos del usuario; desinstalar no borra proyectos; reinstalar los recupera (15671.923516ms)
✔ TW-05: los registros del servidor no contienen rutas, nombres de proyecto ni contenido (1568.467724ms)
✔ TW-05: reparar recrea carpetas y restaura JSON dañado; sin red en el código del producto (637.34521ms)
﹣ TW-05: carpeta sin permiso de escritura se reporta con mensaje claro (0.153516ms) # SKIP
✔ matriz: completa, sin SUPPORTED sin evidencia real en tests, y autocad_com sin SUPPORTED (2.247641ms)
✔ docs/qa/CAD_CAPABILITY_MATRIX.md está al día con el código (0.64504ms)
✔ detección: parseo del registro, LT, no Windows y fallos que NO prueban ausencia (1.092485ms)
✔ saneamiento: sin rutas, usuarios ni correos (1.13689ms)
✔ normalizarRuta: prefijo \\?\ y NFC sin alterar el contenido Unicode (0.272547ms)
✔ contrato COM: scripts estáticos; sin comandos destructivos; Delete/Save solo donde corresponde (1.477274ms)
✔ autorización: copia en 03 Trabajo con ó, ñ, espacios y apóstrofo SÍ; originales, enlaces y rutas ilegibles NO (fallan cerrado) (6.933764ms)
✔ validación de entradas (capa, handle, coordenadas, tamaño del lote) antes de tocar AutoCAD (2.729626ms)
✔ contrato COM: errores por etapa, causas separadas, reintento si AutoCAD está ocupado, sin datos sensibles (1.775682ms)
✔ escritura todo-o-nada: capa no creada, dibujo revertido, documento cambiado y guardado fallido se informan por separado (2.516564ms)
✔ MCP: estado separa registro y COM (registro fallido + COM vivo => conectado); COM caído => causa separada; sin rutas ajenas (33.642076ms)
✔ MCP: herramientas CAD (matriz, listado, lote) y validación de esquema (16.479535ms)
✔ 3DFACE: cubo 2x3x4 de 6 caras -> volumen 24 y área 52 (oráculo analítico) (6.471611ms)
✔ MESH: pirámide de base 1x1 y altura 1 -> V=1/3; POLYLINE 3D longitud 17 (1.592331ms)
✔ malla abierta: sin volumen y needs_review; normales invertidas: valor absoluto con aviso (0.705201ms)
✔ 3DSOLID/REGION/SURFACE: detectados pero SIN volumen inventado (1.084473ms)
✔ cantidad de volumen solo desde mallas cerradas, con conversión cúbica (mm→m) (2.320705ms)
✔ transformación con espejo (escala -1) conserva volumen positivo y sin falso aviso de normales (0.882621ms)
✔ POLYFACE (POLYLINE bit 64): prisma 1x1x2 -> V=2, A=10 (1.607116ms)
﹣ PowerShell real: ruta con ó ñ espacios y apóstrofo viaja Node→PowerShell→Node idéntica byte a byte (1.001124ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: salida con caracteres no ASCII no depende de la página de códigos de la consola (0.143047ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: 4 líneas 6000×4000 mm en capa TW_PRUEBA inexistente (se crea antes), handles, longitudes y original intacto (0.074356ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: listar con medidas (4 líneas 6000/4000), filtro por capa y medir por handle (0.060166ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: fallo al dibujar la 3.ª línea revierte las 2 creadas y la capa nueva (sin escrituras parciales ni guardado) (0.057898ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: si no se puede crear la capa no se dibuja nada (0.055954ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: guardado fallido se informa con los handles (las líneas siguen en la copia, nunca en el original) (0.126516ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: original activo => ORIGINAL_PROTEGIDO sin escribir; el documento activo que cambia entre estado y dibujo => DOCUMENTO_CAMBIO sin escribir (0.108386ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: sin AutoCAD, el script de conexión REAL informa AUTOCAD_NO_ABIERTO con los intentos (sin rutas) (0.06025ms) # requiere Windows PowerShell (powershell.exe)
﹣ PowerShell real: un script con error de sintaxis o excepción produce una clase de fallo segura, no un cuelgue (0.057469ms) # requiere Windows PowerShell (powershell.exe)
✔ TANNIA_HOME: origen, valores inválidos y advertencias (apóstrofo, carpeta hermana) (4.650314ms)
✔ TANNIA_HOME: al reiniciar con otra carpeta el servidor usa la nueva; la anterior queda intacta; el diagnóstico lo muestra (2096.027471ms)
```
