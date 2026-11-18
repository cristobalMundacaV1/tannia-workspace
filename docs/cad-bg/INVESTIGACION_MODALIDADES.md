# G-BG0 — Motor interno vs AutoCAD COM vs Core Console vs .NET

**Pregunta:** ¿qué operaciones del flujo de obra pueden hacerse sin tocar la ventana ni los documentos de la persona?
**Método:** inventario del código real (`src/cad/autocad_com.js`, 118 KB; `src/drawing/*`; `src/tools/*`), evidencia publicada por terceros y prueba técnica comparativa (`scripts/cadbg-comparativa.mjs`).
**Límite de esta investigación:** en este entorno no hay Windows gráfico ni AutoCAD. Todo lo marcado **A VERIFICAR** queda para [PROTOCOLO_AUTOCAD_2027.md](PROTOCOLO_AUTOCAD_2027.md).

## 1. Lo que hace hoy el adaptador COM (comprobado leyendo el código)

| Llamada | Dónde | Efecto en el escritorio de la persona |
|---|---|---|
| `GetActiveObject('AutoCAD.Application…')` | todas las operaciones COM | se conecta a **su** AutoCAD abierto (no hay instancia propia) |
| `Documents.Add()` + `Import()` | `importar_dxf_aislado` (exportar DWG, abrir copia DXF) | crea una **pestaña nueva** en su AutoCAD; AutoCAD la activa |
| `$d.Activate()` | `laminas_a_dwg`, `AbrirDwg` | cambia el dibujo activo de su sesión |
| `SaveAs` | `laminas_a_dwg`, `dxf_a_dwg`, `construir_3d` | escribe desde su sesión (solo documentos propios de Tannia) |
| `ActiveDocument` | lecturas (`estado`, `listar`, `medir`), escritura de líneas sin `ruta_esperada` | depende de qué dibujo tenga ella activo |
| `SendCommand` | `construir_3d`, `vista_3d` | envía comandos a la línea de comandos de su sesión |
| `Close` | `cerrar_reabrir`, `construir_3d` | solo documentos propios, nunca los de ella |

Conclusión: **toda** la vía COM actúa dentro de la sesión de la persona. Es aceptable solo con su autorización y su atención (modo C), no en segundo plano.

## 2. Comparación

| Criterio | A — Motor interno | C — AutoCAD COM | B — Core Console (`accoreconsole.exe`) | .NET (AcCoreMgd/AcDbMgd) |
|---|---|---|---|---|
| Requiere AutoCAD | No | Sí, abierto | Sí, instalado (no abierto) | Sí; dentro de Core Console solo AcCoreMgd/AcDbMgd |
| Toca la sesión de la persona | No | **Sí** (pestañas, activación, comandos) | No: proceso propio (A VERIFICAR: licencia y archivos de bloqueo compartidos) | Igual que el anfitrión |
| Ventanas | Ninguna | La de AutoCAD | Consola; se lanza oculta (`windowsHide` → `CREATE_NO_WINDOW`) | — |
| DXF/PDF, cantidades, Excel, memoria | **Sí** (probado, N1) | No aplica | No aplica | No aplica |
| Escribir DWG | No (solo AutoCAD) | Sí (Import+SaveAs; fidelidad parcial, PL-08) | Sí según uso publicado: entrada `/i archivo` + `_.saveas` (acadbp) — **A VERIFICAR en 2027** | Sí (`Database.SaveAs`) — A VERIFICAR |
| Releer DWG | Lecturas COM por lotes | — | `/i dwg` + `_.saveas DXF` → comparación con el modelo (implementado) — A VERIFICAR | `ReadDwgFile` — A VERIFICAR |
| Cotas, capas, XDATA, layouts | Escritos y verificados en DXF | Verificación parcial (conteos, capas, XDATA, layouts) | Se comprueban en la relectura contra el modelo; si algo se pierde **no se publica** | — |
| Impresión (plot) | PDF propio | Posible | `-PLOT` documentado por terceros; **no implementado** (A VERIFICAR) | — |
| Cuadros de diálogo | No | Pueden bloquear (se detecta `CMDACTIVE`) | `FILEDIA 0`, `CMDDIA 0`; sin entrada estándar: no puede quedar esperando a la persona | — |
| Rutas con ñ | Sí | Sí (JSON base64) | El guion `.scr` se lee con la página de códigos del sistema (acadbp la hace configurable): **solo nombres ASCII dentro del guion**; la ruta Unicode va como argumento `/i` | — |
| Licencia | No aplica | La de la sesión | **A VERIFICAR** (suscripción/usuario nombrado, sin sesión iniciada) | — |
| Instalación adicional | Ninguna | Ninguna | Ninguna (viene con AutoCAD; **no** con LT según su documentación habitual — A VERIFICAR, acadbp declara compatibilidad con LT 2013+) | Compilar y firmar un ensamblado por versión; NETLOAD (foros reportan «Unknown command NETLOAD» en algunos casos) |
| Recursos | 1 proceso Node, ~270 MB máx. medido aquí | Comparte el de AutoCAD | Un proceso AutoCAD sin interfaz por trabajo (pesado): **máximo 1 a la vez** | — |

## 3. Decisión

1. **Modo A por defecto** para todo lo que no exige un DWG: planos DXF/PDF, cubicaciones, partidas, presupuesto, memoria. Proceso propio, oculto y de prioridad baja (implementado y probado, N1; CI Windows con prueba de no interferencia).
2. **Modo B para DWG** cuando exista Core Console: entrada `/i`, `_.SAVEAS`, relectura `_.SAVEAS DXF` y comparación con el modelo; **publicación solo si coincide**. Implementado y probado con un simulador; **la compatibilidad con AutoCAD 2027 está sin verificar**.
3. **Modo C solo con autorización explícita** (`exportar_dwg_interactivo`): ventana con qué se hará, por qué, qué dibujo, qué queda intacto y qué pasa si se pospone. **Nunca** como sustituto silencioso de B (probado con espía COM: cero llamadas sin autorización).
4. **.NET no se adopta** sin la prueba real: exige compilar/firmar por versión e instalar un componente más en el PC de Tannia, y no aporta aislamiento adicional sobre B. Se reevalúa si B falla en el protocolo real.
5. Todas las operaciones COM que interrumpen (incluidas las herramientas antiguas `tannia_cad_*`, `*_a_autocad`) pasan por la **política única** de modo C (`src/cad/politica_interactiva.js`), verificada en el punto de paso del adaptador (revisión BG-R03).

## 4. Fuentes de terceros consultadas (no son evidencia de AutoCAD 2027)

- acadbp (MIT): utilidad de procesamiento por lotes con Core Console — usa `accoreconsole /i <archivo> /s <guion>`, `_.saveas <formato>`, salida UTF-16LE y codificación configurable del guion: <https://github.com/k-awata/acadbp>
- Foro de AutoCAD (CADTutor), conversión por lotes DXF→DWG y comportamiento de DXFIN: <https://www.cadtutor.net/forum/topic/78909-batch-convert-dxf-to-dwg/>
- Foros de Autodesk sobre complementos .NET en Core Console (solo AcCoreMgd/AcDbMgd; AcMgd no): <https://forums.autodesk.com/t5/net-forum/creating-a-accoreconsole-exe-net-addin/m-p/4334752>, <https://forums.autodesk.com/t5/net/can-t-load-dll-file-in-coreconsole/td-p/11963424>, <https://forums.autodesk.com/t5/autocad-forum/can-t-run-netload-from-accoreconsole-unknown-command-quot/m-p/10748578/highlight/true>
- Contrato de apertura COM (Autodesk ActiveX 2027), ya citado en el código: <https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-ActiveX-Reference/files/GUID-9ED7A548-7978-4BFD-8462-E2FA747E8880.htm>
