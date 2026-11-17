# TW-12 — Matriz de evidencia (candidato para revisión independiente)

Base: `wip/tw12-astra-recovery` (6c64f36, WIP de Astra, NO VALIDADO) sobre `49c2ae8` (head de PR #19). Rama: `feat/tw12-workspace`.
Estados permitidos: `PASS_AUTOMATIZADO`, `PENDIENTE_EXTERNO`. Nada aquí está aprobado por AutoCAD real, Claude Desktop real, revisor independiente ni Tannia.

| Capacidad | Evidencia | Estado |
|---|---|---|
| Rescate íntegro de los 17 archivos de Astra | rama recuperada, diff 6c64f36 vs 49c2ae8; archivo espurio `tra - NO VALIDADO` eliminado (restos de un commit mal citado en PowerShell) | PASS_AUTOMATIZADO |
| Registro durable de operaciones CAD (idempotencia, checkpoint, conflicto, escritura parcial) | `test/tw12_workspace.test.js` 1–4 | PASS_AUTOMATIZADO |
| Controles de sesión COM (`SESION_AMBIGUA`, `DOCUMENTO_CAMBIO`, hash esperado, solo lectura) | scripts estáticos + contrato `tw06_cad` (corregido para `laminas_a_dwg`); inspección con `DNum` (sin conversión a 0) | PASS_AUTOMATIZADO (script) / PENDIENTE_EXTERNO (AutoCAD 2027 real) |
| Modelo de dibujo independiente de GUI; cotas verificadas contra geometría | `verifyDimensions`, tests | PASS_AUTOMATIZADO |
| Gate de legibilidad (vista diminuta, solape, glifo dañado, escala/región, viewport recortado) | test 5 + validateScene | PASS_AUTOMATIZADO |
| Escala física 1:50: 5,5 m = 110 mm | test «physical 1:50» (medido sobre la escena PDF) | PASS_AUTOMATIZADO |
| Cuatro PDF A3 renderizados (no vacíos, sin tinta en el borde) | `renderPdf` + revisión visual de los PNG en esta sesión | PASS_AUTOMATIZADO; revisión humana PENDIENTE_EXTERNO |
| Corte A-A en planta, tabla de revisiones, altura en el perfil, etiquetas de cotas cortas sin tocar geometría | correcciones de auditoría + test «audit» | PASS_AUTOMATIZADO |
| DXF: 4 layouts, 5 viewports, 9 cotas; lector independiente ezdxf: 0 errores, view_height == alto·escala | test oráculo ezdxf | PASS_AUTOMATIZADO (DWG real PENDIENTE_EXTERNO) |
| Consentimiento: Guía hash / https://x.invalid / unknown / licensed bloqueado en todos los canales; cierre/rechazo nunca aprueba; ventanas simultáneas deduplicadas | tests 8–9 + suite TW-11 | PASS_AUTOMATIZADO |
| Entregables inmutables con manifiesto SHA-256 y detección de alteración | test 7 | PASS_AUTOMATIZADO |
| AutoCAD 2027 real (DWG, layouts, viewports, escalas) | `PROTOCOLO_AUTOCAD_2027_TW12.md` | PENDIENTE_EXTERNO |
| Claude Desktop real, revisión profesional, piloto con Tannia | protocolos TW-11 vigentes | PENDIENTE_EXTERNO |

## Limitaciones
- Ejercicio académico: sin geotecnia, sostenimiento, topografía ni normativa. Los campos institución/autor/fecha quedan `PENDIENTE` hasta que el usuario los confirme.
- Cada detalle es la geometría del espesor (6 y 8 cm), no un diseño de revestimiento.
- El PDF se genera desde el modelo, no desde un DWG guardado.

## Auditoría PR #20 — hallazgo P1 (viewports) y cierre
- `guardarLaminas` ya no usa `some()` sobre escalas. `src/drawing/layouts_check.js` verifica cada layout: identidad y duplicados, cantidad exacta de viewports (tolera como máximo un viewport global del tamaño de la lámina), asignación uno a uno por centro y tamaño en papel, escala, bloqueo y región del modelo. Rechaza faltantes, sobrantes, duplicados, desplazados, sin bloqueo y asociados a otra vista.
- El mismo verificador se aplica (a) al DXF generado, leído con un parser independiente de códigos de grupo (`LAYOUTS_INVALIDOS` si falla) y (b) a la inspección que devuelve AutoCAD sobre el DWG guardado.
- Pruebas: oráculo DXF, mocks positivos y 16 negativos, test de `guardarLaminas` con runner simulado. El resultado siempre incluye `dwg_validado_autocad_real: false`.
- **Límite declarado:** la región del modelo (`ViewCenter`) se verifica en el DXF; en el DWG solo si AutoCAD la expone por COM. Si no, el nivel es `parcial_sin_region_modelo`. Que el DWG real conserve centros, escala y bloqueo sigue **PENDIENTE_EXTERNO** (AutoCAD 2027).
- La suma de escalas coincidentes NO acredita un DWG válido.

## Auditoría de Trust & Consent UX
- Orden de canales: confirmación MCP (elicitación) → ventana nativa estructurada → archivo fuera de banda. Rechazo, cierre o tiempo agotado = no.
- Se bloquea antes de abrir cualquier canal: URL explícita inválida/reservada (`.invalid`, `.test`, `.local`, `localhost`, credenciales en la URL, sin dominio), licencia `licensed` sin evidencia, extracto ausente, fuente vencida o no candidata. Caso negativo `Guía hash / https://x.invalid / unknown / licensed` probado.
- Un origen local o no informado NO se bloquea: se muestra «No informado» y la decisión es de la persona (antes del ajuste bloqueaba toda fuente manual).
- Una solicitud idéntica simultánea no abre dos ventanas. Ningún secreto en rutas accesibles al agente (TW-11 P1/SEC-02 intactos).
- Pendiente: usabilidad real del diálogo WPF en Windows (accesibilidad, lectores de pantalla) — **PENDIENTE_EXTERNO**.

## Alcance
La generación de planos de TW-12 está **especializada en el túnel académico de herradura** (`tunnelModel`). No hay soporte general de proyectos ni de otras geometrías; ampliar requiere modelos y pruebas representativas adicionales.

## Candidato empaquetado (código 0c74735)
Suite local en 954780f: 414 pruebas, 397 pasan, 0 fallan, 17 omitidas (PowerShell real requiere Windows). `0c74735` solo añade `scripts/build.mjs` (binario nativo win32-x64 verificado contra `package-lock.json`).
Los paquetes se verifican como cliente MCP desde el bundle desempaquetado.

| Paquete | Herramientas | SHA-256 del .mcpb | SHA-256 del contenido |
|---|---|---|---|
| BASE | 72 | cd8191824156f476f13b64fcb2a1cfa9c2449f6e3588d416298f3dd96bcd5cd7 | 1dcb28485393134c21cc0e98d5bb38342c5bb2165fafddcd9e3539e9f985f559 |
| INGENIERIA (`TANNIA_ENGINEERING=on`) | 85 | e84abd88ac601593194e71dca05902ffb02e4122c42ddc403087414288057276 | 59e6ef5226d07ced121afa8b680e4fcff571c55349960cb99943582135005462 |

**Reproducibilidad:** dos compilaciones del mismo SHA dan contenido idéntico (`diff -r` vacío); el hash del `.mcpb` varía por marcas de tiempo del contenedor ZIP. Por eso se publica el hash del contenido. No se declara reproducibilidad byte a byte.
**CI Windows/Ubuntu sobre 0c74735:** en el momento de este registro, en curso; el resultado se anota en el PR. Ejecución anterior sobre a29cc52: falló (5 pruebas, corregidas en 954780f).

## Corrección P1 de empaquetado Windows (código 6dc6f6a) — reemplaza el candidato 0c74735
**Defecto reproducido:** el paquete INGENIERÍA 0c74735 declaraba `compatibility.platforms: ["linux"]` (tomaba `process.platform` del constructor), por lo que Claude Desktop en Windows 11 mostraba «Esta extensión requiere Linux». El paquete 0c74735 queda **retirado**.
**Corrección en el sistema de empaquetado (sin editar manifiestos a mano):** `scripts/lib/destino.mjs` resuelve el destino por `TANNIA_TARGET`; `build.mjs` incluye únicamente el binario nativo del destino, verificado contra el sha512 de `package-lock.json`, y registra `dist/destino.json`; `paquete-prueba.mjs` declara las plataformas desde el destino y se niega si lo construido no coincide o si el binario nativo no es exactamente uno.
**Regresión:** `test/tw12_empaquetado_destino.test.js` construye en Linux un paquete `win32-x64` y comprueba: manifiesto `["win32"]`, 85 herramientas, solo `canvas-win32-x64-msvc`, binario PE (`MZ`), versión e integridad según lockfile, y el rechazo de un destino distinto.
**Verificación:** 85 herramientas por cliente MCP desde el bundle desempaquetado (el cliente corre en Linux; el binario Windows no se ejecuta aquí).
**NO verificado:** instalación en Claude Desktop real sobre Windows 11 y ejecución del binario `skia.win32-x64.msvc.node` en Windows — **PENDIENTE_EXTERNO**. El CI de Windows (runner real) ejecuta la suite con el binario nativo del runner, no con este `.mcpb`.

| Paquete | plataformas | Herramientas | SHA-256 del .mcpb | SHA-256 del contenido |
|---|---|---|---|---|
| BASE | win32, darwin, linux (sin dependencia nativa en uso) | 72 | c70fad0ccd546a3f2e812f6a171a32111b1c3a267ffbaf4340ab53d3203f7507 | ver HASHES_CONTENIDO.txt |
| INGENIERIA-WINDOWS | win32 | 85 | bd8cb38eae2d105ba435d91b50573ef485478e5af43ef3c9977a110e011ea28c | ver HASHES_CONTENIDO.txt |

## CAD-OPEN-01 — `tannia_cad_abrir_copia` falló dos veces con `AUTOCAD_ERROR` (prueba real, AutoCAD 2027, Dibujo1 sin guardar)
**Qué se sabe (evidencia del usuario):** conexión COM correcta, una sola instancia, copia DXF creada en `03 Trabajo`, originales intactos, `Dibujo1.dwg` abierto y sin guardar. Se conserva `AUTOCAD_ERROR` sin etapa útil.
**Causa: NO CONFIRMADA.** No se dispone del HRESULT ni del mensaje reales. Hipótesis de trabajo, derivada del código y no probada en AutoCAD: el script `abrir_copia` (introducido en el WIP de Astra) recorría `Documents` normalizando `FullName` con `[IO.Path]::GetFullPath(...)` sin protección; un dibujo nuevo sin guardar no tiene ruta en disco y esa llamada puede lanzar una excepción antes de llegar a `Documents.Open`. El resto de scripts usaba un normalizador con `try/catch`. Otras causas posibles que NO se descartan: cuadro modal/comando activo, rechazo del DXF por AutoCAD, `Documents.Open` con el segundo argumento.
**Cambios (diagnóstico primero, luego robustez):**
- `Fail` informa la etapa real (`preparar`, `enumerar_documentos`, `abrir_documento`, `verificar_apertura`, `activar_documento`) y un diagnóstico (`diag`) que llega saneado a `structuredContent.detalle` junto con HRESULT, tipo de excepción y operación.
- Clasificación: `AUTOCAD_CUADRO_MODAL` (CMDACTIVE & 8), `AUTOCAD_COMANDO_ACTIVO`, `AUTOCAD_OCUPADO`, `SESION_AMBIGUA`, `AUTOCAD_RPC`, `AUTOCAD_COM_FALLO` (enumerar/activar), `APERTURA_FALLIDA` (AutoCAD rechazó abrir), `DXF_INVALIDO`/`DWG_INVALIDO`/`ARCHIVO_NO_LEGIBLE` (validado en Node antes de tocar AutoCAD), `RUTA_NO_VALIDA`, y para `exportar_dwg` `CAMBIOS_SIN_GUARDAR`/`DOCUMENTO_SOLO_LECTURA`/`DOCUMENTO_CAMBIO` por separado.
- Los documentos sin ruta (Dibujo1) se listan como `con_ruta_en_disco:false` y `sin_guardar`; no se tocan ni se comparan por ruta. Un documento ya abierto se reutiliza y se activa; jamás se lanza otra instancia (conexión `GetActiveObject`, sesión estricta).
- Un único `Documents.Open`; si AutoCAD lanza, se hace UNA comprobación de si el archivo quedó abierto (`recuperado_tras_error`), nunca un segundo `Open`. `abrir_copia` no está en `REINTENTO_SEGURO`.
**Pruebas:** `test/tw12_cad_open.test.js` (contrato del script, Dibujo1 sin guardar, fallo con detalle sin rutas, 11 clasificaciones con una sola llamada, DXF inválido sin invocar AutoCAD, originales protegidos, recuperación abrir → DXF→DWG una sola vez e idempotente, y los tres rechazos previos al guardado).
**Límite de la validación:** los scripts PowerShell no se ejecutaron aquí; el runner simula las respuestas. Que `abrir_copia` y `exportar_dwg` funcionen con AutoCAD 2027 real, y cuál era la causa, **sigue PENDIENTE_EXTERNO**: repetir con la prueba real y adjuntar `structuredContent.detalle`.

### Candidato con CAD-OPEN-01 (código 8ff5f95) — reemplaza a 6dc6f6a
Suite local: 425 pruebas, 408 pasan, 0 fallan, 17 omitidas. Paquetes con destino win32-x64; 85 y 72 herramientas por cliente MCP.
| Paquete | SHA-256 del .mcpb |
|---|---|
| BASE (72) | ccbcda6bb3f29a0e380bb6362c99544f4d637928bf18375780edda47e0eba472 |
| INGENIERIA-WINDOWS (85, platforms win32) | ec019c1247c459a439d680a072843bec419772e1131930631dcbe5b65887b43a |
ZIP de entrega: 3abc666b3ca0be865384ef36316cbdadc511d5869c1f33063e004652271de843. Hashes del contenido en HASHES_CONTENIDO.txt del ZIP.

## CAD-OPEN-01 — segunda incidencia real: `AUTOCAD_ERROR / tiempo_agotado` en `tannia_cad_abrir_copia`
**Hecho (reportado):** el cliente COM conecta, pero `abrir_copia` agota el tiempo de 30 s de `runPowerShell`; el diagnóstico de etapa se emitía solo en el JSON final, así que no se sabía dónde quedó bloqueada la operación. **La etapa exacta del bloqueo sigue SIN identificar** hasta repetir la prueba real con esta versión.
**Cambios (sin aumentar el timeout y sin reintentos):**
1. *Progreso por etapas*: los scripts escriben y vacían una línea `TANNIA_ETAPA` antes y después de cada operación potencialmente bloqueante: `conexion_com`, `consulta_ocupacion`, `enumerar_documentos`, `abrir_documento` (inicio/ok/error), `activar_documento`, `guardar_como_dwg`.
2. *Recuperación de la última etapa*: `runPowerShell` conserva esas líneas aunque haya que terminar el proceso (probado con un proceso real que se bloquea tras emitir tres etapas) y ya no espera indefinidamente el cierre de las tuberías tras el `kill` (defecto encontrado con esa misma prueba).
3. *Texto visible*: `ERROR AUTOCAD_ERROR: AutoCAD no respondió en 30 s en «abrir_copia». Última etapa alcanzada: abrir_documento (iniciada, SIN terminar, a los N ms). Duración: X s. Resultado INCIERTO…`; `structuredContent.detalle` conserva `etapa`, `estado_etapa`, `estado_incierto`, `duracion_ms`, `timeout_ms`, la traza de etapas y la reconciliación, saneados.
4. *Una sola lógica de apertura*: `AbrirPorRuta` (misma ocupación, enumeración protegida, único `Documents.Open`, activación) la comparten `abrir_copia`, `laminas_a_dwg` y `dxf_a_dwg` (antes eran tres bloques con controles distintos).
5. *Reconciliación tras timeout*: se ejecuta un script de solo lectura (`reconciliar_apertura`, límite propio de 15 s) que dice si el DXF quedó abierto. Si lo está: `apertura_tardia:true`, sin repetir `Open`. Si no se puede verificar, queda una marca pendiente en `03 Trabajo/CAD/operaciones/` y la siguiente llamada solo reconcilia: devuelve `OPERACION_PENDIENTE_INCIERTA` hasta confirmar un estado limpio; solo entonces una llamada explícita puede abrir.
6. *exportar_dwg*: la apertura ocurre antes del diario de operaciones; un timeout al abrir no deja una «escritura incierta» que nunca se despachó, y un guardado verificado no vuelve a tocar AutoCAD.
7. `Dibujo1` sin guardar solo se observa (se lista como `guardado:false`, `con_ruta_en_disco:false`); nunca se abre, activa ni guarda. No se lanza otra instancia (conexión por `GetActiveObject`, sesión estricta).
**Pruebas nuevas:** `test/tw12_cad_timeout.test.js` (6): proceso real con kill, texto visible/estructurado, apertura tardía, estado incierto persistente y recuperación, `exportar_dwg` con timeout y reanudación, unicidad de la lógica de apertura.
**Criterio de aceptación NO cumplido todavía:** «identificar la etapa exacta del bloqueo y demostrar apertura y conversión DXF→DWG en AutoCAD 2027 real» requiere la prueba real. Los mocks no acreditan integración. **PENDIENTE_EXTERNO.**

### Candidato con CAD-OPEN-01 (2.ª incidencia), código d8cf79a — reemplaza a 8ff5f95
Suite local: 431 pruebas, 414 pasan, 0 fallan, 17 omitidas. Paquetes destino win32-x64, 72 y 85 herramientas por cliente MCP.
| Paquete | SHA-256 del .mcpb |
|---|---|
| BASE (72) | 47458bd2502932d77345825caa285a170233e13807977d8d0090ce5088742c17 |
| INGENIERIA-WINDOWS (85, platforms win32) | 7aa32816059828a84eb012e7fb9f6fa50e4c669ff1983971820fe1b27823bac6 |
ZIP de entrega: 01683e7fa72b8a84b4a02c550b473eb37a21af9c756056503df06b7a451eaabf.
