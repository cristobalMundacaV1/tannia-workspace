# TW-09 — Matriz de evidencias por historia/gate

Estados: `AUTOMATIZADO` (pruebas en CI Windows+Ubuntu sobre el SHA indicado) · `SIMULADO` (servidor COM / PowerShell simulados) · `NO VERIFICADO (HW)` (requiere AutoCAD/Claude Desktop real) · `NO VERIFICADO (usuaria)`.

| ID | Afirmación | Estado | Prueba |
|---|---|---|---|
| T9-01 | Persistencia 51→0 con SHA idéntico no es `verificada` | AUTOMATIZADO + SIMULADO | `test/tw17_persistencia_global.test.js` |
| T9-02 | Entidad nueva, handle perdido, otro documento y conteo por capa se detectan en ambos sentidos | AUTOMATIZADO | `tw17` |
| T9-03 | Lecturas por ruta; cero documentos; escrituras no se reintentan | AUTOMATIZADO + PowerShell simulado (CI Windows) | `tw17`, `tw06`, `tw09` |
| T9-04 | Causa real de `ModelSpace.Count=0` en AutoCAD | **NO VERIFICADO (HW)** — instrumentada | campo `reapertura` del resultado |
| T9-05 | Alturas 2D/3D por facetas; altura 3D sale del plano 2D | AUTOMATIZADO | `tw18` |
| T9-06 | Semántica de vanos, inspección, candidatos y previsualización sin escritura | AUTOMATIZADO | `tw19` |
| T9-07 | Identidad estable, resolver sin adivinar, resumen | AUTOMATIZADO | `tw20` |
| T9-08 | Importación con hash/manifiesto, sin sobrescribir ni rutas privadas en el manifiesto | AUTOMATIZADO | `tw20` |
| T9-09 | Adjuntos del chat accesibles para el servidor | **NO VERIFICADO (HW/UI)** | protocolo `PRUEBA_REAL_TW09.md` |
| T9-10 | Versiones transaccionales con corte en cada paso (2D y 3D) | AUTOMATIZADO | `tw21` |
| T9-11 | Exportaciones sin sobrescritura | AUTOMATIZADO | `tw21` |
| T9-12 | Enrutador de capacidades y política de autonomía | AUTOMATIZADO | `tw22` |
| T9-13 | Originales reales (DWG/DXF/PDF) intactos tras flujos completos; nombres hostiles; inyección como dato; 2 sesiones | AUTOMATIZADO | `tw23` |
| T9-14 | Flujo del encargo con continuidad entre sesiones hasta el límite de AutoCAD | AUTOMATIZADO | `tw24` |
| T9-15 | ACL de Windows, junctions, rutas >260, AutoCAD con original abierto | **NO VERIFICADO (HW)** | pendiente |
| T9-16 | Construcción 3D real, persistencia real y `AUDIT` | **NO VERIFICADO (HW)** | `PRUEBA_REAL_TW09.md` |
| T9-17 | Conversación natural con la usuaria (15 encargos) | **NO VERIFICADO (usuaria)** | pendiente |
| T9-18 | Cumplimiento normativo / aptitud estructural | **NUNCA afirmado**: fuera de alcance del producto | — |
| T9-19 | Con `ruta_esperada` se localiza ese documento o se falla (sin `ActiveDocument`); la respuesta confirma la ruta; dos dibujos con handles/conteos idénticos; cambio de foco; dibujo cerrado | AUTOMATIZADO + PowerShell simulado (CI Windows) | `tw25`, `tw09` |
| T9-20 | `Documents.Item(i).FullName` coincide con la ruta esperada en AutoCAD 2027 real (mayúsculas, tildes, `\\?\`) | **NO VERIFICADO (HW)** | pendiente |
| T9-21 | Una sesión no puede apartar/borrar temporales de una escritura viva; operaciones abandonadas se recuperan sin pérdida; SIGKILL real; dos procesos simultáneos | AUTOMATIZADO (procesos reales) | `tw26` |
| T9-22 | Exclusión entre procesos sobre carpetas sincronizadas (OneDrive), antivirus, carpetas de red | **NO VERIFICADO (HW)** — el bloqueo asume FS local | pendiente |
| T9-23 | Destino de importación canónico: enlaces/junctions, TOCTOU, enlaces colgantes, colisiones de Windows, MAX_PATH | AUTOMATIZADO (symlinks en Linux; junctions en CI Windows) | `tw27` |
| T9-24 | ACL reales de Windows y junctions con permisos restringidos | **NO VERIFICADO (HW)** | pendiente |
| T9-25 | Ninguna escritura (id, respaldo, manifiestos, auditoría, JSON de proyecto, historiales) sale del proyecto con `.tannia`/carpetas enlazadas ni con sustitución durante la operación; el manifiesto final se valida justo antes y se deshace lo copiado si falla | AUTOMATIZADO (symlinks en Linux; junctions en CI Windows) | `tw28` |
| T9-26 | Un dueño de bloqueo VIVO con latido vencido nunca se interviene; caída real y pid reutilizado se recuperan sin pérdida | AUTOMATIZADO (procesos reales) | `tw29` |
| T9-27 | Identidad de proceso en Windows real (`Get-Process … StartTime`) y bloqueo con OneDrive/antivirus | **NO VERIFICADO (HW)** | pendiente |
| T9-28 | Nombres y rutas del paquete compatibles con Windows (validación previa al empaquetado); el bundle inicia, responde a `initialize`, publica exactamente las 61 herramientas sin esquemas inválidos; el servidor es idéntico al del paquete que falló | AUTOMATIZADO (cliente MCP sobre stdio, CI Windows+Ubuntu) | `tw30`, `.mcpb.verificacion.json` |
| T9-29 | El «path escape» de Claude Desktop se debía al «/» del nombre visible y el nuevo paquete se instala sin el aviso; reinstalación sobre la anterior conservando la carpeta de datos | **NO VERIFICADO (Claude Desktop real)** | `REEMPLAZO_INSTALADOR_TW09.md` |

