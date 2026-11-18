# Protocolo de pruebas reales CAD-BG — Windows de una pantalla, Claude Desktop y AutoCAD 2027

**Estado de todos los pasos: NO EJECUTADO.** Requiere el PC real, AutoCAD 2027 completo (no LT) y autorización del PO. Usar el ZIP reconstruido desde la cabeza final del PR y anotar su SHA-256. Registrar en cada paso: hora, versión de Windows, de Claude Desktop y de AutoCAD; capturas; resultado; observaciones de la persona.

Ajustes de soporte (no los hace la persona): `%USERPROFILE%\Tannia Workspace\.tannia-trabajos\config.json` admite `trabajos_simultaneos`, `memoria_libre_minima_mb` y `tiempo_maximo_ms`.

## 0. Preparación
1. Instalar el candidato; diagnóstico OK.
2. En Claude: «¿Qué puede hacer este equipo en segundo plano?» → `tannia_trabajos capacidades`. Anotar si detecta Core Console y la ruta de origen (registro / ruta habitual).

## CAD-BG-01 — Generación sin AutoCAD
AutoCAD **cerrado**. Pedir: «Prepara los planos, cubicaciones, presupuesto y memoria del túnel». **Pasa si:** la respuesta llega en segundos («Estoy preparando…»); el Administrador de tareas no muestra `acad.exe` ni `accoreconsole.exe` hasta el paso DWG; los archivos aparecen; ninguna ventana nueva.

## CAD-BG-02 — Una sola pantalla
Abrir Word (o Excel) con un documento y escribir en él. Desde Claude, iniciar un expediente y volver de inmediato a Word. Escribir de forma continua 2–3 minutos. **Pasa si:** Word conserva el foco todo el tiempo; no aparecen consolas, ventanas de AutoCAD ni cuadros de autorización; el cursor no se mueve; no se pierden pulsaciones; al terminar aparece una notificación en la esquina (sin robar el foco). Grabar la pantalla.
*Evidencia previa (no sustituye este paso):* CI `windows-latest` con el Bloc de notas activo (`tools/gui/prueba_no_interferencia.py`).

## CAD-BG-03 — AutoCAD minimizado
AutoCAD abierto y minimizado con un dibujo propio. Pedir el DWG de los planos. **Pasa si:** con Core Console, la ventana de AutoCAD no se restaura ni se activa, la lista de pestañas de AutoCAD no cambia, y el DWG aparece en `03 Trabajo\CAD\modelos\<revisión>\planos.dwg` con su registro de verificación. Sin Core Console: Claude explica y pregunta; **nada** se abre hasta que la persona acepta.

## CAD-BG-04 — Dibujo personal sin guardar
Abrir `Dibujo2.dwg`, dibujar una línea **sin guardar**. Ejecutar el DWG por modo B. **Pasa si:** `Dibujo2.dwg` sigue con el asterisco de cambios pendientes, sin entidades nuevas, sin guardarse ni cerrarse; su fecha en disco no cambia. Repetir con modo C autorizado: la pestaña nueva aparece, pero `Dibujo2` conserva todo.

## CAD-BG-05 — Cancelación y recuperación
(a) Pedir «detén el trabajo» durante el DWG. (b) Cerrar Claude Desktop durante el DWG; reabrir y preguntar «¿cómo va el trabajo?». (c) Apagar con el Administrador de tareas `node.exe` del trabajo. **Pasa si:** no queda `planos.dwg` a medias ni carpetas `.preparando-*`; tras reabrir, el trabajo continúa sin repetir planos/presupuesto; `accoreconsole.exe` no queda vivo.

## CAD-BG-06 — Coherencia geométrica
`node scripts/cadbg-comparativa.mjs <carpeta>` (corpus túnel + edificación). Abrir cada `B-planos.dwg` en AutoCAD: comparar entidades, capas, cotas, layouts y textos con el DXF; trazar a PDF manualmente. **Pasa si:** `comparativa.json` indica `PUBLICADO_VERIFICADO` y la inspección visual coincide. Si la relectura no coincide, el DWG no debe haberse publicado (comprobar). Registrar `AUDIT`.
Puntos a confirmar en este paso: (1) que Core Console acepta `/i` con un **DXF**; (2) que `_.SAVEAS` responde a la secuencia `2018` + nombre, y `DXF P N V 2018 16` + nombre; (3) rutas con ñ en la carpeta del proyecto; (4) si exige sesión de licencia iniciada.

## CAD-BG-07 — Carga del equipo
Durante CAD-BG-02, registrar con el Monitor de recursos: CPU y memoria de `node.exe` y `accoreconsole.exe`, prioridad (debe ser «Por debajo de lo normal»), y latencia percibida en Word. Definir con la persona el umbral aceptable según este hardware (no se fija de antemano).

## CAD-BG-08 — Flujo integral
Expediente de túnel y uno de edificación (muro con vanos). **Pasa si:** todo corre sin intervención visual hasta la única pregunta real (DWG sin Core Console, o verificar cantidades / aprobar la entrega, que siempre son de la persona); planos, cantidades, Excel, memoria y DWG citan la misma revisión.

## Comparativa COM (solo con autorización)
`node scripts/cadbg-comparativa.mjs <carpeta> --incluir-com` deja instrucciones para medir el modo C con `exportar_dwg_interactivo` sobre el mismo corpus: tiempo, pestaña creada, foco, resultado de `verificarDwg`.
