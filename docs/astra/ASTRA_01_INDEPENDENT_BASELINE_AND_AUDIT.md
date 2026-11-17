# ASTRA 01 — Diagnóstico independiente, pasada A

Fecha de inspección: 2026-11-17 (America/Santiago). Auditor: Astra, agente de análisis; no sustituye revisión profesional humana. Base exacta: `2f4cdd07a4a24ee76e993bedf56e4e0f02630db2`, head de PR #21 consultado en GitHub. Rama propia `docs/astra-independent-master-design`. **Documento creado antes de abrir contenido, diff o documentación del PR #22.** Las modificaciones posteriores, si necesarias, se registrarán en otros documentos; este diagnóstico queda congelado en su primer commit.

## Método y alcance observado

Leídos AGENTS.md, CLAUDE.md, manifiesto/lockfile, workflow Windows/Ubuntu, arquitectura, riesgos, limitaciones, matrices TW-11/TW-12, protocolos de campo, issues #1/#3/#4/#8/#9/#10 y mandato #23. Inspección focalizada de herramientas MCP, almacenamiento, presupuesto, CIC, consentimiento, CAD, dibujo, cantidades y pruebas. No se afirma revisión línea a línea de las 111 mil líneas añadidas respecto de main. No se ha ejecutado AutoCAD, Claude Desktop gráfico ni una revisión de cubicación con Tannia en esta misión.

`main = 115baec105fff5ffe0fbaf182f40bc62666280be`: no contiene la implementación acumulada de la rama auditada. Inventario reproducible de PR #2, #7, #11–#20, SHA completos, diff estadístico, estado y CI en [github-baseline.json](evidence/github-baseline.json). Todos abiertos, draft y sin merge al consultar. Cada base de esos PR es ancestro de su head. #11 depende de `feat/tw-modelo-3d`, por lo que los números de PR solicitados no describen por sí solos toda la historia intermedia. No proponer merge directo de #21 a main.

PR #21: base `21b4ae957ccfa7f843dc7f104f1490318d252228`; head `2f4cdd07a4a24ee76e993bedf56e4e0f02630db2`. Seis commits; la descripción todavía menciona `e136b66` y ausencia de CI integral, pero la API acredita [run 44077443232](https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/44077443232) con ambos jobs Ubuntu/Windows success, incluidos npm ci/test/build/pack. El código funcional más reciente es `97109eb`; el último commit agrega evidencia documental. Esta distinción evita repetir un bloqueo de CI ya superado. No atribuir éxito de AutoCAD al job Windows: los tests usan dobles para AutoCAD.

Entorno propio: Linux, Node v24.22.1; `npm ci` completó con dependencias reales. `npm test` iniciado con salida persistida; resultado definitivo se registrará en ASTRA 07 al terminar. CI usa Node 22: el resultado local no sustituye esa matriz.

## Arquitectura efectiva y capacidades

Un servidor Node ESM MCP local expone herramientas de proyecto, DXF/PDF, cantidades, APU/XLSX/memoria, CAD por PowerShell/COM y diseño. `TANNIA_CIC` activa el registro de operaciones, unidades, claims, fuentes y planificación; `TANNIA_ENGINEERING` añade planos TW-12. Son capas coexistentes, no una única cadena transaccional de entrega. El CIC no ejecuta directamente todos los pasos CAD: `cic/ejecutor.js` delega escrituras inciertas y evita reintentos automáticos. El modelo de planos TW-12 genera una vertical de túnel; el motor previo de vivienda y su edición existen y no deben desaparecer por generalizar TW-12.

| Área | Hecho implementado | Límite probado/documental |
|---|---|---|
| DXF | lector, unidades, longitudes/áreas, bloques, duplicados, mallas; `src/dxf` | fixtures; curvas/OCS/XREF/ACIS y entidad no soportada requieren abstención explícita |
| Cantidades | separación medida/regla, fuente hash, descuentos, parámetros; `quantities` | interpretar capa como material/partida sigue siendo decisión técnica; ausencia de medidas no equivale a cantidad nula verificada |
| Presupuesto | APU con fuente/fecha, redondeo y XLSX; `budget` | aceptación humana y vínculo artefacto–revisión incompletos |
| Vivienda | modelos, cambios y coherencia 2D/3D; `design`, `architect`, `arq3d` | anteproyecto acotado; no proyecto de permiso ni cálculo estructural |
| CAD | copia, identidad de documento, diario durable, timeout y reconciliación | estado N2 por operación y versión; no conversión universal acreditada |
| CIC | unidades/operaciones/claims/fuentes con localizador/invalidation | N1 construido por prefijo en `cic/capacidades.js`, no certificación individual ni evidencia N3 |
| Dibujo TW-12 | layouts/viewports/cotas/trazas y PDF del túnel | plantillas y reglas concretas, no motor transversal de producción |
| Normativa | índice y almacenamiento con citas locales | coincidencia de cita local no verifica autoridad, vigencia ni aplicación territorial |
| Skills | instrucciones, procedimientos, registry y descripciones de herramientas | no se encontró SKILL.md ni catálogo instalable Claude Code; eso no significa ausencia de metodología |

## Hallazgos propios

Severidades: H0 = bloqueo de promoción por falta de evidencia externa; P0 = vía reproducible a aprobación/entrega engañosa o pérdida crítica; P1 = resultado técnico incorrecto o flujo principal bloqueado; P2 = deuda acotada. P0 aquí bloquea entrega profesional, no afirma ataque remoto ni explotación observada.

### A-01 / P0 — suplantación de revisión humana mediante MCP

`src/tools/index.js:251–263` acepta `verificada_por` y escribe `cantidad_verificada=true`; `:123–151` acepta `aprobado_por` + `confirmo_revision_profesional`. No hay llamada a AprobacionHumana en esas rutas. Reproducción propia mediante cliente MCP, con CIC e ingeniería encendidos y diálogos desactivados: una persona ficticia `NOMBRE_SUPLANTADO_SIN_PERSONA` verifica la partida y aprueba el proyecto. No se requiere manipular archivos internos ni instalar otro servidor. Véase [registro](evidence/independent-reproduction.json) y [procedimiento ejecutable](evidence/reproduction-procedure.md).

Cierre: todas las transiciones que declaren revisión humana exigen receipt emitido por canal humano fuera del modelo, ligado al hash de entrada, finalidad y artefactos; argumentos de herramientas no pueden crear ese receipt. Prueba adversarial MCP debe denegar la misma secuencia, también en perfil BASE.

Esto **no invalida todo consentimiento**: `cic/aprobacion_humana.js` sí implementa elicitación, diálogo y consumo de archivo; el archivo fuera de proyectos sigue siendo vulnerable si otro agente tiene permisos de escritura en el home. Debe definirse la frontera del sistema completo, no prometer aislamiento entre procesos con el mismo usuario.

### A-02 / P0 — exportación de presupuesto anterior a los datos aprobados

`src/tools/index.js:311–327`: exportar comprueba el estado y elige `.sort().pop()` de XLSX/PDF; no exige manifiesto ligado al cálculo aprobado. Reproducción: cantidad 10, precio 100 → XLSX/PDF total 1.190 CLP; actualizar APU a 900; pasar a revisión/aprobación sin regenerar; exportar. Resultado: se exportan los archivos antiguos aunque los datos actuales corresponden a 10.710 CLP. El registro contiene las llamadas y hashes. La suplantación A-01 facilita el ensayo, pero A-02 también ocurre con una persona que apruebe correctamente los datos nuevos.

Cierre: generar/validar un DeliveryManifest inmutable de una revisión única; cualquier cambio invalida artefactos y aprobación; no seleccionar por nombre/fecha; repetir con aprobador humano legítimo y exigir rechazo por desactualización.

### A-03 / P1 — comparación de fidelidad pierde topología y capa

`src/cad/fidelidad.js:90–135`: firma de polilínea ordena vértices; multiconjunto usa solo `firma`, descartando `capa`. Reproducción pura: cuadrado [(0,0),(2,0),(2,2),(0,2)] frente a polilínea cruzada [(0,0),(2,2),(2,0),(0,2)] devuelve `fiel:true`. También un cambio A→B de capa devuelve `fiel:true`. No prueba que toda conversión lo acepte: existen otros gates en `dxf_api` y `geometry_check`. Demuestra que este comparador no es oráculo suficiente; su caller `autocad_com.js:1233` debe auditarse como composición de validadores.

Cierre: identidad por revisión/objeto y firmas que preserven orden cíclico/orientación pertinente, bulge, elevación, OCS, capa y propiedades; casos adversariales que cambien conectividad conservando vértices/área/conteos. Conteo de DIMENSION no acredita asociatividad, valor ni estilo. XDATA TANNIA_TRACE no acredita todas las aplicaciones XDATA.

### A-04 / P1 — porcentajes de presupuesto no confirmados

`budget/calc.js:52`, `project/store.js:95`: GG=0, utilidad=0, IVA=19 si config falta. No son precios inventados; son supuestos económicos que pueden producir `estado_final_posible=true`. CIC `bud.rollup` exige porcentajes explícitos. Cierre: null = desconocido; cero explícito con origen válido; misma política en ambas rutas y equivalencia de redondeo acordada.

### A-05 / H0 — conversión de expediente DWG actual no acreditada

La evidencia TW-12 relata prueba real fallida: Add creó Dibujo2 vacío, APERTURA_FALLIDA; causa aún desconocida. `97109eb` agrega diagnóstico visible, marcas, inspección y bloqueo; no prueba que Import funcione. Los ensayos anteriores de 232 entidades/50 sólidos son evidencia histórica declarada para otras operaciones/versiones, no deben borrarse ni extrapolarse al nuevo importador. Cierre: ejecutar matriz real por versión/entidad/operación, reabrir DWG y comparar objeto, metadatos, layouts y representación impresa. No cambiar API por intuición sin PoC.

### A-06 / P1 — evidencia y capacidades tienen fuentes inconsistentes

`docs/KNOWN_LIMITATIONS.md` conserva afirmaciones históricas contradictorias con sus propios apéndices; `cic/capacidades.js` asigna N1 por prefijo y algunos side_effects genéricos. Cierre: registro por operación, build, entorno y prueba, con fecha/reemplazo; metadata no constituye autorización. No bloquear toda ingeniería por esto, sí toda afirmación de soporte profesional que no tenga evidencia.

### A-07 / P2 — distribución/procedimientos aún no prueban adopción

No Skills instalables encontrados; existen procedimientos de Desktop y guardas reales. La cantidad de 85 herramientas no es por sí sola un defecto. Medir selección correcta y recuperación con tareas retenidas, antes de reducir o reescribir herramientas. Firmas de paquete, licencias transitivas y Windows real siguen siendo trabajo de producto.

## Conclusión independiente previa a investigación externa

Conservar los motores deterministas, protección de originales, transacciones y claims. Corregir primero aprobación y entrega de artefactos de una revisión única; después fidelidad CAD por operación y un expediente real de edificación. Hipótesis de arquitectura a contrastar: núcleo común pequeño (identidad/evidencia/medidas/entrega) con métodos especializados; no sustituir lo existente por un motor universal ni usar el túnel como representación de toda construcción. Investigación externa y contraste del PR #22 aún NO realizados al guardar este documento.
