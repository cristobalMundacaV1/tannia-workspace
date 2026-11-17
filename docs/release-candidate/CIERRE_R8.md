# Cierre de hallazgos de la prueba R7/R8

Evidencia de prueba analizada: chat, captura de la ventana y `Prueba_R8_generados.zip`, informados por el Product Owner. Las entregas R7 ($109.480) y R8 ($123.165) **no se modifican**; cualquier entrega corregida requiere nueva revisión y nueva aprobación.

## 1. Excel: IVA calculado sobre texto (crítico)
- Causa: al insertar la fila «Origen de precios y porcentajes» en `Parametros`, el IVA pasó a B5, pero `Presupuesto!F11` seguía usando `Parametros!B4`. La caché de los valores ocultaba el error.
- Reproducción con motor real (generador anterior, LibreOffice, caché eliminada): `IVA = #VALUE!` y `TOTAL = #VALUE!`.
- Corrección: los parámetros quedan en filas fijas con **nombres definidos** (`PCT_GG`, `PCT_UTILIDAD`, `PCT_IVA`) y las fórmulas usan esos nombres; las filas informativas van después. Se declara la política: GG y utilidades sobre el costo directo; IVA sobre costo directo + GG + utilidades; redondeo a peso.
- Verificación: `scripts/lib/recalcular_xlsx.mjs` elimina la caché de **todas** las fórmulas y recalcula con LibreOffice. Resultados: $8.000 → 80.000 / 8.000 / 4.000 / 92.000 / 17.480 / **109.480**; $9.000 → 90.000 / 9.000 / 4.500 / 103.500 / 19.665 / **123.165**. Estos valores coinciden con el PDF y el manifiesto de la misma revisión (`evidence/cierre/evidencia.json`).
- Pendiente: recálculo en **Microsoft Excel**. Se usó LibreOffice 7.x en Linux.

## 2–3. Explicación única de la cubicación y memorias
- `src/metodos/explicar.js` es la fuente única para la ventana, el Excel (hoja Cubicacion) y el PDF: cálculo, origen, alcance, supuestos, advertencias y límites, por separado.
- M1: «Superficie del muro: 5 m × 2,4 m = 12 m². Descuento por puerta: 1 m × 2 m = 2 m². Superficie neta: 12 − 2 = 10 m²». Origen: medidas proporcionadas en la conversación, no medidas en el plano. Alcance: se descontaron los vanos **informados**; no se comprobó en el plano si existen otros.
- Se eliminó la frase fija «las medidas provienen de la geometría»; el texto depende del origen de cada partida (manual, geométrico o mixto). Además se aclara que registrar y comprobar la huella de un archivo no acredita su autoridad técnica, y que confirmar una cantidad manual no la convierte en una medición.
- El PDF separa: 4.1 pendientes que impiden aprobar («Sin pendientes que bloqueen la entrega»), 4.2 advertencias que permanecen (por ejemplo, «sin trazabilidad geométrica») y 4.3 límites del método.

## 4–5. Ventanas y resultados
- Ventana de verificación con el contenido propuesto y botones «Confirmar 10 m²» / «No confirmar». La ventana WPF se ajusta al 90 % del área de trabajo y los botones quedan fijos al pie, fuera de la zona de desplazamiento.
- La aprobación de la entrega muestra proyecto, revisión, resumen económico, origen no acreditado de los valores, archivos con huella y advertencias.
- Códigos estables: `RECHAZADO_POR_LA_PERSONA`, `VENTANA_CERRADA_SIN_RESPUESTA`, `TIEMPO_AGOTADO`, `ERROR_TECNICO_VENTANA`, `SIN_CANAL_HUMANO`, `RESULTADO_DESCONOCIDO`. Cada respuesta incluye `ventana_mostrada` y `canal`.
- Solo «confirmado» autoriza. Ningún otro resultado revoca una verificación anterior vigente: el efecto se declara en cada respuesta y está probado.
- **Cambio de semántica:** «cancelar» ya no equivale a «rechazar». En las fuentes CIC, cancelar deja la fuente pendiente.

## 6. Vigencia y alcance
- Medidas, vanos, cantidad o método → la verificación deja de valer (nueva `version_id`).
- Precio, porcentajes o asignación de APU → invalidan los documentos económicos y la aprobación de entrega, **no** la verificación de la cantidad.
- Cualquier cambio en un archivo aprobado → la aprobación no se reutiliza.
- `tannia_recibos_verificar` distingue integridad, versión y alcance, vigencia, consumo e identidad declarada (no autenticada).

## 7. Conducta del asistente
Se añadió la regla 11 a las instrucciones del servidor. Exige informar solo resultados confirmados por la herramienta y separar capacidad detectada de operación ejecutada (AutoCAD en el registro de Windows no significa conexión). También exige no presentar cantidades manuales como mediciones ni tratar una fuente declarada como cotización comprobada, consultar el estado vigente, interpretar los códigos de ventana, evitar confirmaciones redundantes y no usar expresiones de género.

## 8. Pruebas
- `test/rc_cierre_aceptacion.test.js` cubre los pasos 1 a 14 en un proyecto aislado e incluye el recálculo real con LibreOffice cuando está disponible.
- Suite completa en Linux, Node 22: **490 pruebas, 471 correctas, 0 fallos, 19 omitidas**.
- Aprobaciones y verificaciones en estas pruebas: las responde un **cliente de prueba**. No son evidencia de aceptación humana.

## Pendientes de aceptación (no declarados cerrados)
- Captura de la ventana corregida en Windows real: no hay Windows con interfaz en este entorno.
- Verificar el escalado de pantalla (125 % / 150 %) y la navegación por teclado de los botones.
- Comprobar en Claude Desktop real que el asistente distingue rechazo, cierre y error.
- Aprobación y exportación con una respuesta humana real, sobre una revisión nueva.
- Recálculo en Microsoft Excel.
- **Fuera de lo validado:** medición automática de planos e integración real con AutoCAD.
