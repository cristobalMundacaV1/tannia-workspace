# Protocolo de prueba en Claude Desktop (NO ejecutado aún)
Objetivo: comprobar con la interfaz REAL lo que aquí solo se probó con un cliente MCP automatizado. Instale el paquete CIC-on. Anote fecha, versión del paquete (diagnóstico) y resultado de cada paso. **No marque nada como aprobado sin haberlo ejecutado.**
## A. Modo académico (túnel)
1. Importe `enunciado.docx` y `apuntes.docx` (ejemplo sintético en `examples/tw11/`) con «importa estos archivos al proyecto» (rutas locales).
2. «Soy estudiante, este es el trabajo de Obras Civiles II. Entiende el encargo, busca en mis apuntes cómo se cubica, haz el plan y calcula lo que se pueda; dime qué falta.» Esperado: usa `tannia_cic_conocimiento` con citas, `tannia_cic_encargo` con brechas (sostenimiento = profesional), `tannia_cic_ejecutar`; **no** inventa parámetros del macizo.
3. «Genera la planta, el perfil y 3 secciones y la memoria.» Esperado: DXF + memoria + planilla con marca «EJERCICIO ACADÉMICO». Abra el DXF en AutoCAD **solo si está disponible** y anote si abre y si coincide con la memoria.
## B. Modo profesional (cadena)
4. «Cubica el canal del DXF, presupuesta con estos precios (aporte precio, fuente y fecha) y haz el programa.» Esperado: sin precios inventados; si falta uno, lo pide.
5. Cambie un dato (p. ej. el ancho de base) y pida recalcular. Esperado: aviso de base desactualizada; no entrega documentos viejos.
## C. Departamento
6. «Departamento de 62 m², 2 dormitorios, piso 5, con terraza.» Esperado: planta con muro de circulación común, medianeros sin ventanas, terraza con borde abierto, sin jardín ni piscina. Pida el mismo programa «como casa» y compare.
## D. Fuentes externas
7. Pida que investigue un tema y proponga la fuente. Esperado: queda CANDIDATA; usted la aprueba en la ventana de confirmación o con el archivo indicado; Claude no puede aprobarla.
## Registro
Para cada paso: ✔/✘, captura y texto exacto de cualquier error. Pendiente adicional: validación en AutoCAD 2027 real, taller con Tannia, revisión profesional y evaluación retenida independiente.
