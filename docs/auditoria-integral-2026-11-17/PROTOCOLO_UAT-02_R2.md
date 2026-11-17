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
| 3 | Fortificación | Los pernos y la malla aparecen dibujados en la lámina 05 y sus cantidades (`fortificacion.csv`) coinciden con el conteo de la lámina |
| 4 | AutoCAD | Exportar DWG; cerrar y reabrir; layouts y cotas presentes; el dibujo propio sin guardar queda intacto |
| 5 | Presupuesto | Rotulado «PRESUPUESTO PARCIAL (…)» si solo cubre la fortificación; advertencia de que los precios de 2019 no están vigentes; ninguna conversión CLP/USD sin tasa |
| 6 | Coherencia | Las cifras del Excel, la memoria PDF y la ventana de aprobación coinciden |
| 7 | PDF | Ninguna página vacía; el pie de página está en cada hoja con contenido |
| 8 | Ventanas | Título en forma de pregunta; Tannia puede explicar, sin ayuda, por qué apareció la ventana y qué pasa si acepta o rechaza |
| 9 | Seguridad | Si se cambia un precio después de aprobar, la exportación se bloquea; al volver al precio original, la aprobación anterior no se reactiva |
| 10 | Entrega | La respuesta final es breve, con nombres comprensibles, la carpeta y los supuestos; sin SHA ni IDs. Anota si Claude Desktop mostró los archivos como adjuntos o como enlaces |
| 11 | Originales | Las huellas de los antecedentes coinciden antes y después de la prueba |

Resultado: **ACEPTADO** solo si se cumplen los criterios 2 a 11 (el 1 es cualitativo). Cualquier falla en 4, 6, 9 u 11 bloquea la aceptación.
