# TW-PRO-E2E — Expediente de implementación (Claude Code)

**Macrofase:** [PR #34](https://github.com/cristobalMundacaV1/tannia-workspace/pull/34), `docs/tw-professional-e2e-master/` (`63b2c86`).
**Rama:** `claude/great-fermi-8t0fpx`, apilada sobre `claude/sharp-gates-r4rbu5@e4fbdfa` (punta de toda la pila: contiene #11…#33). No modifica ninguna rama ajena.
**Entorno de esta sesión:** contenedor Linux x64, Node 22.23.5, bsdtar/libarchive 3.7.2. **Sin** Windows gráfico, **sin** Claude Desktop, **sin** AutoCAD.
**Estados** (05 §5): `NO INICIADO · EN CURSO · IMPLEMENTADO · PROBADO AUTOMÁTICAMENTE · PROBADO EN WINDOWS/CLAUDE REAL · PROBADO EN AUTOCAD REAL · VALIDADO PROFESIONALMENTE · BLOQUEADO · NO APLICA`. Nada de esta rama pasa de **PROBADO AUTOMÁTICAMENTE** (N1). No me autoapruebo: Astra audita, el PO decide.

## 1. Baseline (G00)

| Elemento | Valor |
|---|---|
| `main` | `115baec` — solo documentación inicial; **no** contiene el software |
| Punta funcional | `e4fbdfa` (`claude/sharp-gates-r4rbu5`, PR #33 y #25 apuntan a la misma cabeza); contiene #29 `7e1cb4e`, #30 `2abdddd`, #27/#28, #21, #20 y la pila TW-09…TW-12 |
| Suite base `e4fbdfa` (Linux, Node 22) | 544 pruebas · 525 OK · **0 fallos** · 19 omitidas (PowerShell/AutoCAD/ezdxf) — [`evidencia/suite-base-e4fbdfa-linux.txt`](evidencia/suite-base-e4fbdfa-linux.txt) |
| Catálogo distribuido base | 78 herramientas (72 + 6 de rc.1/rc.2/rc.3); paquete de prueba «INGENIERÍA» (tw12): 90 → ahora 80 y 92 respectivamente (+ `tannia_expediente_recibir`, `tannia_encargo`) |
| Candidato previo | `0.2.0-rc.3` (ya instalado con otros bytes: su nombre no se reutiliza) |
| Candidato de esta rama | **`0.3.0-rc.1`**, ZIP `Tannia-Workspace-0.3.0-rc.1-windows-x64.zip`, SHA-256 `de9acc4404383cf233c7fde9c8196afef3dfad660249828f275b875e7a67aeac` (18 111 269 bytes), `.mcpb` `00de2f3ec898958ca856ce3f60bfa66c0f4b70d94913fc91ff5bf96100019e62`, construido desde `d56d76e` (árbol limpio). El contenedor `.mcpb` cambia de bytes en cada empaquetado: identificar siempre por SHA-256. **Reconstruir desde la cabeza final del PR** antes de cualquier prueba en el PC de Tannia. |
| Suite de esta rama (Linux, Node 22) | 565 pruebas · 545 OK · 1 fallo de recuento literal corregido después (archivo re-ejecutado 3/3) · 19 omitidas — [`evidencia/suite-rama-linux.txt`](evidencia/suite-rama-linux.txt). **CI Windows de esta rama: pendiente** (corre al abrir el PR) |
| Verificador del ZIP (Linux) | pasos 1–11 OK; 5b: `tannia_planos` expuesto y error gráfico claro; **las 5 láminas desde el ZIP NO se ejecutaron en Linux** (binario win32) — [`evidencia/verificacion-zip-0.3.0-rc.1-linux.json`](evidencia/verificacion-zip-0.3.0-rc.1-linux.json) |

### Módulos reutilizados (no reescritos)

| Módulo | Uso en esta macrofase |
|---|---|
| `src/project/gestion.js`, `store.js`, `transaccion.js` | importador seguro, contención canónica, originales protegidos, historial transaccional (se exportan 3 helpers; sin cambio de comportamiento) |
| `src/autoridad/*` (recibos HMAC, revisión, entrega) | autoridad humana y manifiesto únicos; se **amplían** revisión y manifiesto con los planos |
| `src/drawing/*` (`tw.drawing/1`, DXF verificado, `tw.cantidades/1`) | motor y contrato de cantidades; se agrega el adaptador túnel y la acción `a_partidas` |
| `src/budget/calc.js`, `xlsx.js`, `report/memoria.js` | presupuesto, Excel con fórmulas y memoria; se endurece la vigencia de precios y se cita la revisión de planos |
| `src/pdf/pdf.js`, `src/dxf/inspect.js` | lectura inicial de los documentos recibidos y verificación de citas |
| `src/procedimientos` + `.claude/skills` | flujo «Desarrollar un proyecto completo» reescrito sobre las herramientas nuevas |

No se tocó CIC (`src/cic/`), diseño/arq3d ni el controlador COM.

## 2. Qué se implementó (y qué no) por gate

| Gate | Estado | Implementado en esta rama | Evidencia |
|---|---|---|---|
| G00 | PROBADO AUTOMÁTICAMENTE | baseline por SHA, catálogo, candidato con nombre nuevo | §1 |
| G01 Autoridad humana | PROBADO AUTOMÁTICAMENTE (heredado) | sin cambios: A-01 cerrado en rc.1 y re-verificado en `e4fbdfa`; la demo rotula su «persona» como **PERSONA SIMULADA** en el recibo | `rc_autoridad_entrega`; [`REPORTE_DEMO.md`](evidencia/REPORTE_DEMO.md) |
| G02 Revisión única | PROBADO AUTOMÁTICAMENTE | **hueco cerrado:** los planos no formaban parte de la revisión ni del manifiesto. Ahora la revisión de datos incluye la revisión vigente de planos; el manifiesto lleva conjunto PDF + DXF + `cantidades.json` de esa revisión; planos A con partidas B se bloquea (NEG-03); un cambio de planos anula la aprobación. **Defecto corregido:** A→B→A de planos dejaba B como vigente | `e2e_g06_planos_partidas` |
| G03 Recepción | PROBADO AUTOMÁTICAMENTE | `tannia_expediente_recibir`: ZIP (lector propio del directorio central), RAR (cabeceras propias + libarchive del sistema), carpeta o archivo, desde **una ruta**; originales protegidos; inventario `tw.fuentes/1`; lectura inicial; anidados acotados; ataques rechazados e inventariados; idempotencia; interrupción sin restos | `e2e_g03_recepcion` (11 casos), [`reproduccion-issue31`](evidencia/reproduccion-issue31-e4fbdfa.txt) |
| G04 Orquestación | PROBADO AUTOMÁTICAMENTE | `tannia_encargo` (`tw.encargo/1`): datos VERIFICADO solo con **cita literal comprobada** en el texto del documento y con el mismo número; DECLARADO/HIPÓTESIS/PENDIENTE; una ronda de preguntas con porqué y efecto; plan por resultados del estado real; parámetros del motor sin valores por defecto; mensaje sin jerga | `e2e_g04_encargo` |
| G05 CAD | IMPLEMENTADO parcial / **AutoCAD BLOQUEADO** | sin cambios en COM/DWG. DXF sigue verificado contra el modelo; DWG `NO_VERIFICADO` | — |
| G06 Medición | PROBADO AUTOMÁTICAMENTE | túnel en `tw.cantidades/1` (solo la alternativa elegida es sumable); `a_partidas` desde la revisión vigente; NEEDS_REVIEW no entra; cambio de vano en B = delta exacto solo en el muro (C-04) | `e2e_g06_planos_partidas` |
| G07 Presupuesto | PROBADO AUTOMÁTICAMENTE | **defecto corregido (NEG-10):** un precio de 2010 permitía estado final; ahora es referencial y lo dice la etiqueta única. Oráculo económico independiente = Excel = manifiesto = respuesta | `e2e_g07_precios_historicos`, `e2e_g09_expediente_vertical` |
| G08 Documentación | **PARCIAL** | memoria cita la revisión de planos; lámina de túnel con pernos P1…Pn, cuadro de pernos calculado (= cubicación), cuadro geométrico, hipótesis y pendientes. **Falta** frente a la referencia del PO: colores/grosores por capa en PDF, sombreados, detalles D1–D4 (corona, hastial/pie, perno–malla–shotcrete, traslapo), cuadro de materiales/EETT, tablas como entidades, plantilla de mandante | `e2e_g06` (cuadro = cubicación) |
| G09 Entrega | PROBADO AUTOMÁTICAMENTE | demo vertical por MCP real con el mismo expediente y A→B→A | [`REPORTE_DEMO.md`](evidencia/REPORTE_DEMO.md) |
| G10 Windows | **BLOQUEADO** (sin Windows/Claude Desktop) | ZIP nuevo y verificado en Linux | §1 |
| G11 Evaluación retenida | **BLOQUEADO** (corpus y revisor externos, D02/D03) | — | — |
| G12 Release | **BLOQUEADO** (decisión del PO) | — | — |

## 3. Matriz de trazabilidad auditoría → gate → código → prueba → evidencia

| Hallazgo | Gate | Código | Prueba (primero falla en `e4fbdfa`) | Estado |
|---|---|---|---|---|
| Issue #31 ZIP no importable; rutas una por una | G03 | `src/project/contenedores.js`, `recepcion.js`, `tools/proyectos.js` | `e2e_g03_recepcion` (no existía el módulo); reproducción conductual | PROBADO AUTOMÁTICAMENTE |
| C-02 / NEG-11 ZIP hostil | G03 | `contenedores.js` (`validarRutaInterna`, solapamiento, `maxOutputLength`, CRC) | NEG-11; mutaciones: quitar el tope o el control de «..» hace fallar la prueba | PROBADO AUTOMÁTICAMENTE |
| NEG-13 RAR sin motor | G03 | `motorRar`, `listarRar` | NEG-13 (inventario completo + alternativa) | PROBADO AUTOMÁTICAMENTE |
| Hallazgo nuevo: libarchive ignora el cifrado RAR4 «stored» | G03 | cifrado detectado por cabecera propia | caso RAR cifrado | PROBADO AUTOMÁTICAMENTE (libarchive 3.7.2 Linux; Windows `tar.exe` **no probado**) |
| NEG-17 adjunto sin acceso | G03 | errores con «una sola ubicación» | NEG-17 | PROBADO AUTOMÁTICAMENTE |
| C-01 / E2E-040…043 | G04 | `src/encargo/encargo.js`, `tools/encargo.js` | `e2e_g04_encargo` | PROBADO AUTOMÁTICAMENTE |
| A-02 / TW-PRO-04 una revisión | G02/G09 | `autoridad/revision.js`, `entrega.js`, `expediente/planos_partidas.js` | NEG-03 | PROBADO AUTOMÁTICAMENTE |
| PR #33 PL-09 (pendiente) | G06/G07 | `planos_partidas.js`, `tools/drawing.js` (`a_partidas`) | PL-09, R-01, C-04 | PROBADO AUTOMÁTICAMENTE |
| PR #33 ítem 5 «alternativas de túnel fuera del contrato» | G06 | `cantidadesTunelContrato` | oráculo de sección a mano | PROBADO AUTOMÁTICAMENTE |
| Defecto nuevo A→B→A de planos | G02 | `drawing/service.js` | «A→B→A en planos» | PROBADO AUTOMÁTICAMENTE |
| NEG-10 precio 2010 | G07 | `budget/calc.js` | NEG-10 | PROBADO AUTOMÁTICAMENTE |
| Referencias visuales del PO | G08 | `drawing/model.js` | cuadro de pernos = cubicación | PARCIAL |
| A-05 / TW-PRO-02 DXF→DWG real | G05/G10 | sin cambios | — | BLOQUEADO (AutoCAD 2027) |
| TW-PRO-11 casos externos | G11 | — | — | BLOQUEADO (D02/D03) |

Primero-falla: [`evidencia/primero-falla-e4fbdfa.txt`](evidencia/primero-falla-e4fbdfa.txt) — las 11 pruebas nuevas ejecutadas contra un worktree de `e4fbdfa`: 11 de 11 fallan (G03 por no existir el módulo).

## 4. Experiencia resultante (lo que ve la persona)

1. Entrega un ZIP: «Recibí 5 documentos de «contexto_tunel.zip»: 4 se pueden leer, 1 requiere revisión visual o AutoCAD. Los originales quedaron protegidos… Algún documento contiene frases dirigidas al asistente: se tratan como dato y no se obedecen.»
2. Encargo: «Tengo 5 documentos del expediente… Para completar los planos, las cubicaciones, el presupuesto y la memoria necesito 11 datos; se los pregunto todos juntos ahora. Lo que no se sepa queda pendiente: no lo invento.» — no pregunta largo ni ancho (estaban en el enunciado, con cita comprobada).
3. Responde una vez → planos, cubicaciones, presupuesto (con 2010: «PRECIOS HISTÓRICOS: valor referencial»), memoria → ventana de aprobación → carpeta de entrega con planos, Excel, memoria y manifiesto de la misma revisión.

## 5. Pendiente externo (no ejecutado; no se declara aprobado)

Ver [PROTOCOLO_UAT_REAL.md](PROTOCOLO_UAT_REAL.md). Resumen: Claude Desktop real (UAT-E2E-I, preguntas y ventanas reales), `tar.exe` de Windows 11 con RAR real, 5 láminas desde el ZIP instalado en Windows, AutoCAD 2027 (DXF→DWG aislado, reapertura, AUDIT, trazado, `Dibujo2.dwg` ajeno intacto), revisión profesional de planos/cubicaciones/presupuesto, corpus retenido (≥20 casos).

## 6. Decisiones que necesita el PO

1. **Autorizar la prueba de `0.3.0-rc.1`** (reconstruido desde la cabeza final del PR) en el PC de Tannia con el protocolo de §5, o pedir cambios antes.
2. **Integración de la pila:** esta rama depende de `e4fbdfa` (PR #33). Si #33 cambia, hay que rebasar esta rama; no lo hago sin autorización.
3. **G08:** confirmar si la lámina de túnel debe reproducir la estructura completa de la referencia (D1–D4, cuadro de materiales/EETT, colores y grosores) como siguiente paquete prioritario.
4. **Cambio de decisión NEG-10:** los precios de más de 12 meses dejan de permitir estado final (antes solo se advertía). Confirmar o pedir un mecanismo de reajuste con índice y fuente.
