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
