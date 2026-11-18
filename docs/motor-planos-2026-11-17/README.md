# Motor de planos profesional — gates G0–G5 (respuesta al issue #32)

**Rama:** `claude/sharp-gates-r4rbu5`, apilada sobre el SHA auditado `2abddddb65d0c02d64ec5b71ff3f128daed3219b` (PR #30, que no se modifica).
**Entorno de esta sesión:** contenedor Linux x64, Node 22, sin Windows gráfico, sin AutoCAD y sin Claude Desktop.
**Leyenda de estados:** IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE (Linux) · PROBADO EN CI WINDOWS · PROBADO EN AUTOCAD REAL · REVISADO PROFESIONALMENTE · PENDIENTE.
Ningún gate de AutoCAD real ni de revisión profesional se ha ejecutado. CI verde no equivale a aptitud profesional.

## 1. Diagnóstico y causa raíz del bloqueo de UAT-02 R2

- `src/tools/index.js` registraba `tannia_planos` solo con `TANNIA_ENGINEERING=on`.
- `scripts/build.mjs` generaba el manifiesto sin esa variable.
- `scripts/rc-verificar-zip.mjs` borraba la variable antes de arrancar el paquete.
- `test/tw31` la encendía a mano.

Por eso, el CI aprobaba dos configuraciones, y ninguna era la que se distribuye. El `.mcpb` de 0.2.0-rc.2 **no publicaba** el motor de planos, y en UAT-02 R2 el asistente no tuvo herramienta para generar los planos del túnel.

**Corrección (G0):**
- El motor de planos es parte del producto. Solo `TANNIA_ENGINEERING=off` explícito lo desactiva.
- El manifiesto declara `TANNIA_ENGINEERING: 'on'`.
- `build.mjs` aborta si el catálogo no contiene `tannia_planos`.
- El verificador del ZIP (paso **5b**) arranca el paquete **instalado** con el entorno del manifiesto. Exige que `tannia_planos` aparezca en el manifiesto y en el servidor, y genera el túnel de 150 m con fortificación: 5 láminas, DXF AC1024 con cotas `DIMENSION`. No usa ningún servidor de desarrollo ni un segundo servidor antiguo.

**Defecto encontrado por el propio gate G0:** el ZIP lleva el binario gráfico nativo `win32-x64`. En otro sistema fallaba con «ERROR_INTERNO». Ahora devuelve `COMPONENTE_GRAFICO_NO_DISPONIBLE` con un mensaje claro. En Linux, el paso 5b exige ese error claro. La generación completa de las 5 láminas desde el ZIP se exige en el job `rc-zip-windows`, con el mismo artefacto.

## 2. Matriz de cumplimiento del issue #32

| ID | Estado | Qué se hizo | Evidencia |
|---|---|---|---|
| PL-01 | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE · CI Windows pendiente de este SHA | Activación de producción en el manifiesto, build negativo, gate 5b desde el paquete | `test/rc_pl01_habilitacion.test.js`; `scripts/rc-verificar-zip.mjs` 5b |
| PL-02 | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE | Se rechazan las cantidades ya calculadas (`CANTIDADES_NO_DERIVADAS`). `mediciones` TW-MED/1 (longitud, área de Gauss, conteo, descuentos) sobre las entidades dibujadas. `cantidades_declaradas` con origen obligatorio y rótulo «no medida desde el plano». Detecta duplicados, unidades incompatibles, fuentes inexistentes y descuentos mayores que la cantidad medida | `test/g3_cantidades_geometria.test.js` |
| PL-03 | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE | En CAD, las cotas son solo `DIMENSION` nativas en el modelo. El dibujo de cotas del PDF lleva `role: 'dimension'` y no se copia al papel | `test/g1_dxf_nucleo.test.js` (incluye la mutación «cota duplicada en el papel») |
| PL-04 | IMPLEMENTADO (opción de rechazo) | Se rechazan arcos, círculos y cotas radiales en vistas con exageración vertical: `GEOMETRIA_NO_SOPORTADA` en la especificación y `ARCO_EN_PERFIL_EXAGERADO` en el escritor. La alternativa ELLIPSE queda pendiente: el comparador de fidelidad COM aún no la tipa | idem |
| PL-05 | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE · AutoCAD PENDIENTE | Un círculo completo se emite como `CIRCLE` nativo | idem |
| PL-06 | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE · trazado real PENDIENTE | `patronLinea()` es la definición única: el PDF usa el patrón completo y el DXF un `LTYPE` con los mismos elementos; `$PSLTSCALE=1`, `$LTSCALE=1` | idem |
| PL-07 | PARCIAL | Cotas verticales de perfiles exagerados: grupo 42 = distancia dibujada y `DIMLFAC = 1/ex` por XDATA `ACAD/DSTYLE`, para que AutoCAD muestre el valor físico al recalcular. `$DIMASSOC=1` declara las cotas **no asociativas**. La asociatividad y el ensayo stretch/REGEN quedan PENDIENTES en AutoCAD real | idem |
| PL-08 | PARCIAL · AutoCAD PENDIENTE | El escritor DXF se contrasta entidad por entidad con el modelo antes de entregar (`DXF_DIVERGE_DEL_MODELO`). En el paso DWG, el gate sigue comparando conteos, capas, cotas, XDATA y layouts: su resultado se rotula ahora `fidelidad_geometrica: NO_VERIFICADA` y no se presenta como fidelidad probada. Falta conectar `verificarDwg` (comparador por coordenadas, que ya existe) al DWG reabierto, más AUDIT y trazado | `src/drawing/dxf_verificar.js`; `src/cad/autocad_com.js` |
| PL-09 | PENDIENTE (parcial) | Las cantidades del plano ya son medidas trazables (ref de entidad, método, huella del modelo). No existe todavía una partida/APU alimentada automáticamente desde una revisión de planos con invalidación al cambiar la geometría | — |
| PL-10 | PENDIENTE | No hay bloques/INSERT, MTEXT/MLEADER, hatches, XREF, DWT ni capas por disciplina. El motor es un generador de láminas geométricas, no documentación constructiva integral | ver §4 |
| PL-11 | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE | Servidor sin flags expone y ejecuta el motor; gate 5b sobre el paquete distribuido | `test/rc_pl01_habilitacion.test.js` |
| PL-12 | PENDIENTE | Cajetín académico con firmas PENDIENTE. No hay plantillas de mandante, sellos ni revisión A→B comparativa | — |

**Contrato de sección del túnel (G5):** `generar_tunel` solo dibuja una bóveda semicircular (radio = ancho/2) sobre hastiales verticales, con revestimiento de 0,06 o 0,08 m. La descripción de la herramienta y el procedimiento «Desarrollar un proyecto completo» lo dicen ahora de forma explícita. El asistente no debe ofrecer formas que la herramienta rechaza, y debe preguntar la altura de hastial y la fortificación cuando no están en los antecedentes.

## 2b. Correcciones tras la revisión independiente de PR #33 (SHA `20a6566`)

| Ítem | Corrección | Prueba |
|---|---|---|
| 1. Doble conteo entre vistas | `elementos_fisicos[].representaciones` declara las vistas que dibujan el mismo elemento. Una representación no se mide (`MEDICION_NO_AUTORIZADA`), y un elemento físico se mide una sola vez por partida y método (`MEDICION_DUPLICADA`), aunque tenga fuentes en varias vistas | `test/g3_cantidades_geometria.test.js` |
| 2. Trazabilidad XDATA | La firma de cada entidad incluye `elemento/vista/rol/ref` de `TANNIA_TRACE`. Un ref o rol alterado, o una traza eliminada, con geometría idéntica, falla | `test/g1_dxf_nucleo.test.js` |
| 3. Anclajes de cota | Los puntos 13/23 y 14/24 (lineal) y 10/20 y 15/25 (radial) se comparan con los del modelo transformados, por vista y orden. Una traslación conjunta que conserva la distancia falla | idem |
| 4. Topología | Además, **huecos**: cada descuento de área debe quedar contenido en un contorno medido de la misma partida (`DESCUENTO_FUERA_DEL_CONTORNO`, incluido el entrante de un muro en L), y dos descuentos no pueden superponerse (`DESCUENTOS_SUPERPUESTOS`). El área exige un polígono simple: ≥ 3 vértices distintos, sin autointersección (`geo/geom.js::autoIntersecta`), sin retrocesos colineales y con superficie no nula (`CONTORNO_NO_SIMPLE`). Hay casos adversariales y un oráculo de polígono en L | `test/g3_cantidades_geometria.test.js` |
| 5. Detalle frente a total | **Contrato `tw.cantidades/1`** (`src/drawing/cantidades_contrato.js`): `detalle[]` (`fila: detalle`) es lo único sumable. `totales[]` (`fila: total`) es de control y debe ser igual a la suma del detalle. `cantidadPartida()` rechaza filas total o mixtas, unidades mezcladas, la mezcla de medido y declarado, y un total de control que no coincide. Se emite como `cantidades.json` (con `modelo_sha256` y revisión), además de `cantidades.csv` y `cantidades-totales.csv`. Condición previa para PL-09, que sigue PENDIENTE. Las alternativas de revestimiento del túnel aún no siguen este contrato (PENDIENTE) | `test/g3_cantidades_geometria.test.js` (ítem 5) |
| 6. G2 | Sin cambios: sigue **PENDIENTE** de AutoCAD 2027 real | — |

### Evidencia «primero falla, luego pasa»

- `evidencia/reproduccion-20a6566.txt`: con el SHA auditado, las pruebas nuevas de los ítems 1, 2+3, 4 y 5 **fallan**.
- `evidencia/reproduccion-31bb249.txt`: con `31bb249`, las pruebas de huecos mal definidos, del entrante en L y del contrato `tw.cantidades/1` **fallan**.
- `evidencia/suite-local.txt`: suite completa del árbol final (Linux x64, Node 22): 541 pruebas, 522 aprobadas, 0 fallos, 19 omitidas (Windows/AutoCAD).
- ZIP reconstruido y verificado localmente: pasos 1–11 y 5b OK. En Windows, 5b genera las 5 láminas desde el ZIP instalado: CI `rc-zip-windows` sobre `31bb249`, run 44203299736. El SHA final se informa en el PR.

## 2c. Segunda revisión independiente (SHA `2e9fd21`): R-01, R-02, R-03

| Hallazgo | Corrección en el motor | Prueba (primero falla: `evidencia/reproduccion-2e9fd21-R01-R02.txt`) |
|---|---|---|
| R-01: identidad física optativa | Cada fila de detalle lleva `estado` y `procedencia`. Es `TRAZADA` solo si todas sus entidades son **fuentes** de un elemento físico declarado. Sin identidad queda `NEEDS_REVIEW` / `geometria_sin_identidad_fisica`, con una advertencia de posible doble medición cuando la misma partida y método se miden en varias vistas. El plano y la lectura exploratoria se generan igual, pero el contrato `tw.cantidades/1` (`cantidadPartida`) **bloquea** esas filas para partidas y presupuesto (`PROCEDENCIA_NO_AUTORIZADA`, `apto_presupuesto: false`) | `test/g3_cantidades_geometria.test.js` (R-01) |
| R-02: exclusividad de identidad | `ID_DUPLICADO` para IDs físicos repetidos. `IDENTIDAD_AMBIGUA` cuando una entidad (también por prefijo, por ejemplo un rectángulo y uno de sus lados) es reclamada por dos elementos o con dos roles, sin importar el orden de declaración. `FUENTE_INEXISTENTE` para una identidad que apunta a una entidad no dibujada | idem (R-02) |
| R-03: identidad del candidato | Versión **0.2.0-rc.3**: no se reutiliza el nombre rc.2, que ya se instaló con otros bytes. El paquete incluye `server/compilacion.json` (versión, commit, árbol limpio). `tannia_diagnostico` muestra `versiones.paquete.compilacion` y `huella_servidor_sha256`. El verificador del ZIP exige que coincidan con el `release-manifest.json` y con el servidor instalado | `test/tw10_f_campo2_version.test.js`; `rc-verificar-zip` paso 5 |

## 3. Arquitectura y contratos

- **Modelo canónico único:** `tw.drawing/1` (`src/drawing/model.js`, `especificacion.js`). El PDF (`pdf.js`), el DXF (`dxf.js`) y las cantidades leen las mismas entidades.
- **Verificador independiente:** `dxf_verificar.js` tiene su propio analizador DXF y compara multiconjuntos de firmas (tipo, capa, coordenadas con precisión de 1e-6). Comprueba cotas (distancia dibujada × DIMLFAC = valor físico), que no haya cotas duplicadas en el papel y tipos de línea. Es un gate obligatorio en `DrawingService.generate` y queda registrado en `verificacion.json`.
- **Mediciones:** método `TW-MED/1`. Cada fila lleva la ref de la entidad, la fórmula, la unidad y su naturaleza (MEDIDA o DECLARADA). No se suman cantidades medidas con declaradas.
- **Identidad:** cada entidad conserva `ref` (vista/id) y su elemento físico en XDATA `TANNIA_TRACE`, igual que antes.

## 4. Evaluación AutoCAD COM frente a .NET (sin ejecución real)

| Vía | A favor | En contra | Decisión |
|---|---|---|---|
| COM (actual, PowerShell) | Ya implementado. Documentos aislados, diario de operaciones y lectura por lotes. Sin compilación ni carga en el proceso de AutoCAD | Lento por entidad. `Documents.Import` no garantiza conservar estilos ni XDATA. Sin transacciones de base de datos. Sensible a diálogos modales | Mantener como vía principal hasta medir en AutoCAD 2027 |
| .NET (AcCoreMgd/AcDbMgd, NETLOAD) | Transacciones, `Database.ReadDwgFile`/`DxfIn` sin documento visible, lectura completa y rápida de geometría, asociatividad de cotas | Requiere compilar contra la versión de AutoCAD, firmar y cargar un ensamblado (seguridad TRUSTEDPATHS) e instalar algo más en el PC de Tannia | Prueba mínima de viabilidad (DxfIn → SaveAs → ReadDwgFile → comparar) solo con AutoCAD real disponible |
| AutoCAD Core Console (accoreconsole.exe) | Sin interfaz, en lote y aislado de los dibujos abiertos | Sin COM. Scripts .scr o .NET. Licencia y presencia según la instalación | Candidata para el gate de fidelidad DXF→DWG→reapertura |

No se migra la arquitectura sin antes comprobar la viabilidad en AutoCAD real.

## 5. Matriz de capacidades profesionales (estado actual)

| Capacidad | Estado |
|---|---|
| Plantas, cortes, elevaciones, perfiles, secciones y detalles (geometría 2D: líneas, arcos, círculos, polilíneas) | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE |
| Cotas lineales ortogonales y radiales nativas | IMPLEMENTADO; asociatividad PENDIENTE |
| Layouts, viewports y escalas normalizadas | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE (estructura); trazado real PENDIENTE |
| Tipos de línea y grosores por capa | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE |
| Ejes y niveles semánticos, bloques/simbología, sombreados, puertas y ventanas como objetos, tablas, MTEXT/MLEADER, DWT, XREF | PENDIENTE |
| Revisión documental (historial inmutable por revisión) | IMPLEMENTADO; comparación A→B visual y firma humana PENDIENTES |
| Cubicación desde la geometría (longitud, área, conteo, descuentos) | IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE; cumplimiento normativo (p. ej. NCh353) **no atribuido** |

## 6. Pruebas ejecutadas (Linux x64, Node 22)

- Suite completa: ver el comentario del PR con el SHA exacto.
- `rc:zip` + `rc-verificar-zip` sobre el ZIP construido localmente: pasos 1 a 11 y 5b **OK**. La generación de 5 láminas desde el ZIP **no se ejecutó en Linux** (binario win32); se exige en `rc-zip-windows`.

## 7. Plan pendiente por gate

1. **G2 (AutoCAD 2027 real):** ejecutar `docs/auditoria-integral-2026-11-17/PROTOCOLO_UAT-02_R2.md`, Anexo A, y conectar `verificarDwg` al DWG reabierto. Hasta entonces, **NO EJECUTADO**.
2. **PL-09:** acción que cree o actualice partidas desde una revisión de planos, con huella del modelo e invalidación automática del presupuesto y la entrega.
3. **PL-10/PL-12:** perfil mínimo de la obra piloto: bloques de simbología, hatch de revestimiento, MTEXT de notas, plantilla de mandante y revisión A→B.
4. **G5:** repetir UAT-02 R2 con este paquete en el PC de Tannia (requiere autorización del PO). Luego, el segundo caso de edificación con mediciones de muros y vanos.
