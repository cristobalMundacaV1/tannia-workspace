# Protocolo de repetición UAT-02 (túnel minero de 150 m) — candidato 0.2.0-rc.2

**Lo ejecuta:** Product Owner o un revisor independiente, junto con Tannia. **Antecedentes:** los mismos de UAT-02 (`contexto_tunel.zip`), sin modificarlos.

## Preparación
1. Desinstala la versión anterior desde Claude Desktop (los proyectos se conservan).
2. Comprueba la huella de `Tannia-Workspace-0.2.0-rc.2-windows-x64.zip` contra su archivo `.sha256`. Luego extrae el ZIP y ejecuta `INSTALAR.cmd`.
3. Ten AutoCAD 2027 instalado. Antes de empezar, deja abierto un dibujo propio **sin guardar**.

## Solicitud (literal, en una conversación nueva)
> «Te envié los planos y las especificaciones. Necesito que desarrolles este proyecto y me entregues los planos, las cubicaciones y el presupuesto.»

Adjunta o indica la carpeta de los antecedentes. Elige el procedimiento «Desarrollar un proyecto completo» en «+» (opcional).

## Criterios (marca cada uno como OK, FALLA o N/A, con evidencia)

| # | Criterio | Esperado |
|---|---|---|
| 1 | Preguntas | Una sola ronda agrupada; sin pedir unidades para % ni conteos; sin pedir IDs ni JSON |
| 2 | Planos | 5 láminas (planta, perfil, sección, detalles y fortificación) desde el motor de Tannia; DXF AC1024 con cotas, layouts `TW12-01…05` y escalas 1:500, 1:100, 1:50, 1:10 y 1:75 |
| 3 | Fortificación | Los pernos y la malla aparecen dibujados en la lámina 05 y sus cantidades (`fortificacion.csv`) coinciden con el conteo de la lámina (pernos por anillo × anillos, con un anillo en cada extremo). El CSV y el plano dicen que es un **patrón esquemático académico**, no una disposición geotécnica validada; las 1.010 unidades del ejemplo **no** son una exigencia de construcción |
| 4 | AutoCAD | Exportar DWG; cerrar y reabrir; layouts y cotas presentes; el dibujo propio sin guardar queda intacto |
| 5 | Presupuesto | Rotulado «PRESUPUESTO PARCIAL (…): no es el costo total de la obra» si solo cubre la fortificación; «TOTAL (alcance no declarado)» si no se declaró el alcance; «TOTAL INCOMPLETO» solo si faltan datos (son dos cosas distintas); advertencia de que los precios de 2019 no están vigentes; ninguna conversión CLP/USD sin tasa |
| 6 | Coherencia | Las cifras **y la misma etiqueta del total** coinciden en la respuesta de Claude, la ventana de aprobación, el Excel, la memoria PDF y `manifiesto-entrega.json` |
| 7 | PDF | Ninguna página vacía; el pie de página está en cada hoja con contenido |
| 8 | Ventanas | Título en forma de pregunta; la ventana de verificación dice que confirmar una cantidad **no** aprueba el presupuesto ni su entrega; se ve bien al 100, 125 y 150 % de escala; Tannia puede explicar, sin ayuda, por qué apareció la ventana y qué pasa si acepta o rechaza |
| 9 | Seguridad | Si se cambia un precio después de aprobar, la exportación se bloquea; al volver al precio original, la aprobación anterior no se reactiva |
| 10 | Entrega | La respuesta final es breve, con nombres comprensibles, la carpeta y los supuestos; sin SHA ni IDs. Anota si Claude Desktop mostró los archivos como adjuntos o como enlaces |
| 11 | Originales | Las huellas de los antecedentes coinciden antes y después de la prueba |

Resultado: **ACEPTADO** solo si se cumplen los criterios 2 a 11 (el 1 es cualitativo). Cualquier falla en 4, 6, 9 u 11 bloquea la aceptación.

## Anexo A — Validación real en AutoCAD 2027 (estado: **NO EJECUTADO**)

En el CI se comprueba automáticamente: cabecera `AC1024`, `$INSUNITS = 6` (metros), cotas nativas `DIMENSION`, layouts y viewports esperados con su escala y PDF sin páginas vacías (`test/tw31_motor_planos.test.js`). Ninguna de estas pruebas sustituye a AutoCAD. En un PC con AutoCAD 2027:

1. Abre cada DXF entregado (`ABRIR`). Anota los avisos de importación (deben ser cero errores).
2. `UNIDADES` → metros. Mide con `DIST` una cota de la lámina 03: debe coincidir con el texto de la cota.
3. Selecciona una cota → `PROPIEDADES`: tipo *Cota alineada/lineal* (no texto ni bloque explotado).
4. Recorre los layouts `TW12-01…05`: un viewport por vista, con escala 1:500, 1:100, 1:50, 1:10 y 1:75; cajetín visible.
5. `GUARDARCOMO` DWG 2018 en una carpeta temporal; cierra; vuelve a abrir. Repite los pasos 2 a 4.
6. Comprueba que el dibujo propio que dejaste abierto sin guardar sigue intacto y que los SHA-256 de los antecedentes no cambiaron.
7. Comprueba las propiedades (capa, color, tipo de línea) de PERNOS y MALLA antes y después del ciclo DWG.

Registra fecha, versión de AutoCAD, capturas y resultado (OK/FALLA) de cada paso. Hasta entonces, este gate queda **pendiente de hardware**.

## Anexo B — Archivos como `resource_link` (estado: **NO VERIFICADO en Claude Desktop**)

Las respuestas incluyen bloques `resource_link` (`file://`, `name`, `mimeType`, `size`) solo para archivos regulares existentes dentro de la carpeta del proyecto: se rechazan las rutas con `..`, las absolutas externas y los enlaces simbólicos (`test/rc_resource_link.test.js`). El protocolo MCP no obliga al cliente a ofrecer la descarga con un clic. **No se declara resuelta la descarga con un clic.** Alternativa garantizada: la respuesta siempre indica la carpeta del proyecto y los nombres de archivo en texto. En el criterio 10, anota qué mostró Claude Desktop.
