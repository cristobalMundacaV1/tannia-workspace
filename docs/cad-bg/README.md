# CAD-BG — Ejecución no intrusiva y trabajo en segundo plano

**Base:** PR #35 `074c66485e0f0c00e9042ec0acc0134bce18c0a8` (macrofase TW-PRO-E2E, PR #34). **Rama:** `claude/cad-bg-segundo-plano`.
**Entorno de esta sesión:** Linux x64, Node 22.23.5, sin Windows gráfico, sin Claude Desktop, sin AutoCAD. **Nivel máximo alcanzado aquí: N1.**
**Objetivo:** que una persona con una sola pantalla pida planos y siga trabajando; Tannia no se apropia de la ventana, el teclado, el cursor ni los dibujos abiertos.

Documentos: [investigación y decisión (G-BG0)](INVESTIGACION_MODALIDADES.md) · [protocolo real AutoCAD 2027](PROTOCOLO_AUTOCAD_2027.md) · [instrucciones para la persona](INSTRUCCIONES_PERSONA.md).

## 1. Arquitectura implementada

```
Claude Desktop ──MCP──► servidor Tannia ──► tannia_trabajos «crear» ──► Coordinador (cola en <Tannia>\.tannia-trabajos)
                         (responde en ms)                                   │ inicio exclusivo, límites del equipo, latido
                                                                            ▼
                               mismo ejecutable con --trabajo <id>  (oculto, prioridad «por debajo de lo normal»)
                               ├─ Modo A: herramientas reales por MCP en memoria; plataforma «sin CAD» (COM imposible), sin ventanas
                               └─ Modo B: accoreconsole.exe oculto: /i + _.SAVEAS → relectura → comparación → publicación atómica
Modo C (COM en la sesión de la persona): SOLO tannia_planos «exportar_dwg_interactivo», tras su autorización explícita.
```

| Módulo | Función |
|---|---|
| `src/trabajos/coordinador.js` | Estados `PENDIENTE → PREPARANDO → PROCESANDO → VERIFICANDO → TERMINADO` + `REQUIERE_INTERVENCIÓN / FALLÓ / CANCELADO`; cola FIFO; 1 trabajo activo por proyecto; máx. 1–2 trabajos según CPU/RAM y 1 CAD; espera si hay < 512 MB libres; reclamo atómico (dos servidores no duplican); vigilancia de latido y tiempo; reanudación que no repite pasos y detiene procesos CAD huérfanos; mensajes sencillos |
| `src/trabajos/worker.js` | Proceso de fondo (el mismo `server/index.js` del paquete con `--trabajo`); pasos `planos`, `a_partidas`, `presupuesto`, `memoria`, `dwg`; verificación final de que todo pertenece a la revisión vigente de planos; registro de CPU/memoria/prioridad |
| `src/trabajos/coreconsole.js` | Modo B: detección por registro (`AcadLocation`), guiones ASCII (`/i` + `_.SAVEAS`, relectura `_.SAVEAS DXF`), ejecución oculta, prioridad baja, tiempo máximo, cancelación, carpeta de preparación por intento, publicación sin sobrescribir **solo** si la relectura coincide con el modelo |
| `src/trabajos/modalidades.js` | Inventario A/B/C de operaciones con su justificación en el código; C nunca se selecciona automáticamente |
| `src/trabajos/avisos.js` | Notificación de Windows al terminar (no toma el foco) — NO VERIFICADA en Windows real |
| `src/tools/trabajos.js` | `tannia_trabajos` (crear / estado / cancelar / capacidades) |
| `src/tools/drawing.js` | `exportar_dwg` ya **no** usa COM en silencio: modo B en segundo plano o «requiere intervención» con qué/por qué/qué queda intacto/qué pasa si se pospone; `exportar_dwg_interactivo` exige autorización humana |

## 2. Estado de los gates

| Gate | Estado | Evidencia |
|---|---|---|
| G-BG0 Investigación | **IMPLEMENTADO** (decisión documentada; capacidades de Core Console en 2027 **A VERIFICAR**) | [INVESTIGACION_MODALIDADES.md](INVESTIGACION_MODALIDADES.md); `scripts/cadbg-comparativa.mjs` (corrido solo contra el simulador: [evidencia](evidencia/comparativa-SIMULADOR-linux.json)) |
| G-BG1 Ejecución aislada | **PROBADO AUTOMÁTICAMENTE** (Linux; paquete CommonJS incluido) | `test/cadbg_trabajos.test.js`; paso 5c del verificador del ZIP |
| G-BG2 Protección del escritorio | **PROBADO AUTOMÁTICAMENTE** en lo que el software garantiza; prueba de foco/teclado/ventanas en **CI Windows** añadida (resultado en el CI del PR); con la persona: **NO EJECUTADO** | auditoría estática, espía COM (0 llamadas sin autorización), plataforma «sin CAD»; `tools/gui/prueba_no_interferencia.py` |
| G-BG3 Fidelidad CAD | **PROBADO AUTOMÁTICAMENTE contra un SIMULADOR** (publicación solo con relectura coincidente; 5 casos adversariales); con AutoCAD 2027: **NO EJECUTADO** | `CAD-BG-06` |
| G-BG4 Flujo profesional | **PROBADO AUTOMÁTICAMENTE**: túnel y edificación en segundo plano bajo una misma revisión; se detiene solo en la operación que exige a la persona | `CAD-BG-01`, `CAD-BG-08` |
| G-BG5 Windows + AutoCAD 2027 real | **NO EJECUTADO** (no se declara desde Linux ni desde un simulador) | [PROTOCOLO_AUTOCAD_2027.md](PROTOCOLO_AUTOCAD_2027.md) |

## 3. Pruebas CAD-BG

| Prueba | Automatizada aquí | Pendiente real |
|---|---|---|
| CAD-BG-01 sin AutoCAD | Sí: expediente completo en segundo plano; `crear` responde en ms; otra herramienta responde durante el trabajo; ningún DWG ni COM de reemplazo | AutoCAD cerrado en el PC (sin `acad.exe` ni `accoreconsole.exe`) |
| CAD-BG-02 una pantalla | Garantías de software + prueba CI Windows con Bloc de notas activo (foco, ventanas de procesos de Tannia, cursor, teclado, latencia) | Word/Excel con la persona; grabación |
| CAD-BG-03 AutoCAD minimizado | Política: sin modo B → «requiere intervención», nunca interactivo silencioso (espía COM) | Ventana de AutoCAD no restaurada con Core Console real |
| CAD-BG-04 dibujo sin guardar | Modo A/B no pueden tocar la sesión (sin COM); modo C solo crea documentos propios (código heredado auditado) | `Dibujo2.dwg` con cambios pendientes intactos |
| CAD-BG-05 cancelación y recuperación | Sí: cancelar en pleno CAD; caída del proceso de fondo con SIGKILL → reanudación automática, consola huérfana detenida, pasos no repetidos, sin carpetas de preparación | Cierre de Claude Desktop y Administrador de tareas en Windows |
| CAD-BG-06 coherencia | Sí, contra simulador: pérdida de capa, DWG corrupto, relectura fallida, consola colgada, fallo de proceso ⇒ nada publicado | DWG real de AutoCAD 2027 + AUDIT + trazado |
| CAD-BG-07 carga | Medido aquí: proceso de fondo ~270 MB máx., ~3 s de CPU para un expediente, prioridad 10 («bajo lo normal») | Monitor de recursos en el PC; umbral acordado con la persona |
| CAD-BG-08 flujo integral | Sí: túnel (expediente) y edificación (muro con vanos, oráculo a mano) | Con expedientes reales |

## 4. Resultados de esta sesión

- Suite completa sobre `b398ba2`: **575 pruebas, 556 OK, 0 fallos, 19 omitidas** (Windows/AutoCAD) — [evidencia](evidencia/suite-b398ba2-linux.txt). Pruebas CAD-BG: 11/11.
- Mutaciones detectadas: quitar `windowsHide`, publicar sin comparar la relectura y caer a COM sin autorización hacen fallar las pruebas.
- Verificador del ZIP `0.3.0-rc.1` (Linux): pasos 1–11, 5b y **5c (segundo plano desde el paquete instalado)** OK — [evidencia](evidencia/verificacion-zip-linux.json). En Linux los planos del paquete no se generan (binario gráfico win32); se exigen en `rc-zip-windows`.

**Defectos encontrados y corregidos durante la implementación**
1. El paquete se compila en CommonJS: `import.meta.url` no existe y el servidor empaquetado **se caía al arrancar** (detectado por la suite existente). El proceso de fondo es ahora el mismo punto de entrada con `--trabajo` y está probado desde el bundle.
2. Un proceso de Core Console podía quedar **huérfano** tras la caída del proceso de fondo y escribir en la carpeta del reintento: la reanudación lo detiene y cada intento usa su propia carpeta.
3. Dos trabajos del mismo proyecto creados en el mismo milisegundo podían ejecutarse **fuera de orden**: cola FIFO con secuencia.
4. En Linux, un proceso terminado sin recoger («zombi») se veía vivo: `procesoVivo` lo distingue.
5. El guion `.scr` con rutas con «ñ» podía romperse (AutoCAD lo lee con la página de códigos del sistema): dentro del guion solo van nombres ASCII.

## 5. Limitaciones explícitas

- **Core Console no se ha ejecutado nunca en esta implementación.** La secuencia `/i` + `_.SAVEAS` sigue el uso publicado de acadbp; que AutoCAD 2027 la acepte (incluido abrir un DXF con `/i`), su licencia y su comportamiento con rutas Unicode están por verificar.
- `-PLOT` sin interfaz: investigado, **no implementado**.
- Las herramientas COM directas existentes (`tannia_cad_*`, `tannia_diseno_a_autocad`, `tannia_3d_a_autocad`) siguen siendo modo C sin la ventana de autorización del coordinador; solo se usan cuando la persona lo pide en la conversación. Migrarlas al flujo autorizado es el siguiente paso recomendado.
- El aviso de escritorio (notificación de Windows) no está verificado en Windows real.
- La cancelación es cooperativa: un paso del modo A en curso termina antes de detenerse; si no responde en 15 s, se termina el proceso (las escrituras de planos son transaccionales).
- El coordinador vive dentro del servidor MCP: si Claude Desktop está cerrado, un trabajo ya iniciado termina, pero los pendientes esperan a la próxima apertura.

## 6. Decisión que necesita el PO

1. Autorizar el [protocolo real](PROTOCOLO_AUTOCAD_2027.md) en el PC de Tannia (AutoCAD 2027 completo), empezando por CAD-BG-06 (¿acepta Core Console la secuencia?) y CAD-BG-02/04.
2. Confirmar que, sin Core Console, el DWG queda como operación **autorizada por la persona** (modo C) y no se automatiza.
3. Priorizar la migración de las herramientas COM directas al flujo autorizado.
