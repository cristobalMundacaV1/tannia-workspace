# Auditoría integral y reingeniería — 2026-11-17 (continuidad de Astra)

**Base:** `claude/uat-modalidad-manual` @ `7e1cb4e` (contiene `claude/cierre-automatizado`; PR #29 no se modificó).
**Rama de trabajo:** `claude/brave-meitner-21e7ja`. **Candidato:** `0.2.0-rc.2`.
**Estado:** candidato de ingeniería para revisión independiente. **No** está aceptado, ni validado en AutoCAD real ni por Tannia.

## 1. Recuperación

| Fuente | Estado | Uso |
|---|---|---|
| `docs/astra/` (expediente A) | presente en la base | antecedente; contrastado con código vigente |
| `docs/professional/` en `docs/tw-professional-architecture-audit-2026-11-17` (expediente B) | solo en esa rama | leído; hallazgos TW-PRO-01…12 contrastados abajo |
| `docs/auditoria-integral-uat-2026-11-17` | rama **idéntica** a `7e1cb4e`: los seis documentos de Astra **no se publicaron** | confirmada la ausencia |
| `UAT-02_Entrega.zip`, `contexto_tunel.zip` | **no accesibles** en este entorno | se usaron evidencias documentadas y fixtures; los originales no se tocaron |

Suite base en `7e1cb4e` (Linux, Node 22): 501 pruebas, 482 aprobadas, 19 omitidas (Windows/AutoCAD), 0 fallos.
(Astra informó 485/16 en su entorno; la diferencia corresponde a pruebas omitidas por plataforma.)

## 2. Matriz de hallazgos (reproducidos antes de corregir)

| # | Hallazgo | Reproducción | Causa raíz | Estado | Prueba |
|---|---|---|---|---|---|
| A | Conversión CLP→USD 1:1 | `aUnidad(mag(1000,'CLP'),'USD') = 1000`; también CLP→% (×100 000) y UF+CLP=2 | moneda tratada como dimensión vacía `D()` | **Corregido**: moneda es una dimensión propia por código; `convertirMoneda` requiere una tasa positiva con fuente y fecha; las operaciones CIC rechazan mezclar monedas | `tw30` A |
| B | Diferencias entre motores económicos | 2 982 de 3 000 casos aleatorios difieren (p. ej. $7.606.050 vs $7.606.381) | `bud.rollup` no redondeaba el precio unitario; `computeBudget` y el XLSX sí | **Corregido**: una sola política (`subtotalPartida`, `rubros`) para las tres rutas, con equivalencia en 2 000 casos. UAT-01 = $109.480 se mantiene | `tw30` B |
| C | PDF con una página casi vacía (UAT-01) | memoria de UAT-01: 2 páginas, la 2.ª solo con «página 1 de 1» | el pie de página en y=800 cae bajo el margen inferior y PDFKit agrega una página | **Corregido** en la memoria y en los entregables CIC | `tw30` C |
| D | DXF R12 en UAT-02 | el motor vigente emite AC1024 con `$INSUNITS`=m, cotas `DIMENSION`, layouts y viewports | el DXF de UAT-02 **no** vino de este motor: los planos y la fortificación se hicieron con procesos externos | **Brecha cerrada en el motor**: fortificación dentro del motor; el procedimiento prohíbe generar planos fuera de él | `tw31` |
| E | Pernos y malla fuera del motor geométrico | — | `tunnelModel` no tenía fortificación | **Corregido**: lámina 05 con pernos (patrón declarado) y malla; cantidades contadas sobre la sección dibujada → `fortificacion.csv` | `tw31` |
| F | Motor de planos acoplado al túnel (TW-PRO-06) | `LAYERS` y `TW12-` fijos | — | **Corregido**: `especificacion.js` (planta, corte, elevación, perfil, sección y detalle); segundo dominio de edificación con el mismo compositor, DXF y PDF | `tw31` |
| G | Presupuesto parcial presentado como total; precios de 2019 | — | sin campo de alcance ni control de vigencia | **Corregido**: `alcance` completo/parcial (rótulo «PRESUPUESTO PARCIAL… no es el costo total»); advertencia para precios con más de 12 meses | `tw30` |
| H | Unidades pedidas para magnitudes adimensionales | — | — | Las entradas adimensionales siguen sin exigir unidad (probado); el procedimiento lo prohíbe | `tw30` A |
| I | Ventanas confusas | título «Aprobar la entrega…», con SHA en el cuerpo | — | **Rediseñado**: la ventana es una pregunta concreta con seis respuestas; los datos técnicos van en «Detalles para auditoría» | `tw32` + pruebas de cierre |
| J | Exceso de pasos visibles y respuestas con jerga | — | — | Procedimiento de entrada `tw-desarrollar-proyecto`; reglas: tuteo, resultado primero, sin SHA, HMAC ni IDs | `rc_arquitectura` |
| K | Entrega de archivos | solo rutas en JSON | — | `resource_link` MCP por archivo, nombres y tipos comprensibles, carpeta e instrucciones para abrir | `tw31` MCP |
| L | Exportación negativa con aprobación caducada | la aprobación **no** caduca por tiempo; deja de valer cuando cambian los datos (A→B→A sin reactivación) | — | Cubierto por pruebas existentes (`rc_r7_regresion` R7-7, `rc_autoridad_entrega` A→B→A), que siguen en verde. Una expiración por tiempo sería un cambio de alcance: queda para que decida el PO | existentes |
| M | Identidad humana no autenticada | — | el nombre es declarado | **Pendiente (alcance)**: requiere un proveedor de identidad; se mantiene «integridad ≠ identidad» | — |
| N | Errores de OCR en el APU escaneado y dos referencias sin analizar | sin los ZIP | — | **No verificable aquí**; el procedimiento exige marcar precios con lectura dudosa | — |

Hallazgos del expediente B: TW-PRO-01 ya estaba resuelto en la base (recibos HMAC y ventana del sistema operativo). TW-PRO-04 y 05 se cerraron con B y G. TW-PRO-06 se cerró con F. TW-PRO-02 y 07 siguen pendientes de AutoCAD real.

## 3. Decisiones de arquitectura

1. **Moneda tipada** (`C: {CLP:1}`) dentro del mismo motor dimensional, sin un sistema paralelo; `CLP/m2·m2 = CLP`.
2. **Una sola política económica** en `budget/calc.js`, que el CIC importa. No se fusionaron los motores: se unificó la regla y se agregó una prueba de equivalencia.
3. **Motor de planos = especificación → `tw.drawing/1`**. El túnel queda como un adaptador más. Si una vista no cabe en el papel, el sistema falla en vez de cambiar la escala.
4. **Única autoridad geométrica para cantidades derivadas**: se miden las entidades que se dibujan, no los parámetros.
5. **La seguridad no cambia**: recibos HMAC, consumo único, A→B→A, protección de originales y rechazo predeterminado se mantienen intactos, y todas sus pruebas pasan.

## 4. Evidencia de pruebas (SHA de esta rama; Linux)

- Suite completa: **516 pruebas, 497 aprobadas, 19 omitidas, 0 fallos** (las omitidas requieren Windows/AutoCAD/UIA).
- `rc:verificar` sobre `Tannia-Workspace-0.2.0-rc.2-windows-x64.zip`: **11/11 OK** (instalación en un perfil limpio simulado, MCP, flujo E2E, recuperación, actualización y desinstalación).
- CI de Windows/Ubuntu: lo ejecuta el PR; ver su estado allí.

## 4b. Revisión técnica del PR #30 (cierre)

| Hallazgo | Corrección | Prueba |
|---|---|---|
| `gui-windows` (run 44173057442): 4 ventanas de verificación no explicaban que confirmar una cantidad no aprueba la entrega; la ventana de entrega no mostraba neto, IVA, revisión ni origen | Texto «Qué estás autorizando» corregido; resumen económico completo en la ventana de entrega | `tools/gui/prueba_ventana_wpf.py`, con aserciones por sección (más exigentes que la búsqueda en todo el texto) |
| `B.parcial` (faltan datos) se mezclaba con el alcance parcial de la obra | Dos ejes: `alcance` y `calculo_incompleto`; una sola `etiqueta_total` en respuesta, ventana, Excel, PDF y manifiesto; `parcial` queda obsoleto | `test/rc_alcance_presupuesto.test.js` |
| `resource_link` sin contención | Solo archivos regulares dentro del proyecto; sin `..`, rutas absolutas externas ni enlaces simbólicos; incluye `size` | `test/rc_resource_link.test.js` |
| La malla se cubicaba con el radio teórico y no con la dibujada; los pernos no decían que son un patrón académico | Cubicación desde la capa MALLA; `naturaleza` y `distribucion` (anillos, paso real, extremos) | `test/tw31_motor_planos.test.js` (incluye L = 137,3 m y s = 1,4/1,7 m, que no son múltiplos) |

## 5. NO VERIFICADO (requiere hardware o uso real)

- AutoCAD 2027: apertura e importación de DXF, guardado DWG, cierre y reapertura, conservación de layouts y cotas (gate de TW-PRO-02).
- Ventanas WPF en Windows: renderizado de la plantilla «pregunta», escalado de 125/150 % y UI Automation (el driver existe: `tools/gui/prueba_ventana_wpf.py`).
- Claude Desktop: cómo muestra los `resource_link` (si como adjunto o como enlace). Si no los muestra, quedan la carpeta y los nombres en texto.
- Instalación real de la `.mcpb` en el PC de Tannia.
- Revisión profesional de la fortificación, los precios y la normativa.
