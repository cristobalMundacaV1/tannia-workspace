# Protocolo de campo — comunicación (Claude Desktop real, NO ejecutado)
Instale el paquete **CIC activado**. Los tests automáticos no prueban que el modelo responda breve: este protocolo sí. Anote para cada escenario: ✔/✘, nº de palabras, captura y observaciones. Tannia debe participar al menos en B, D y E.
**Preparación:** proyecto de prueba con un DXF (muros/losas) y el ejemplo del túnel (`ejemplos/gv1_tunel`). Nivel inicial: `tannia_comunicacion ver` debe decir BREVE (predeterminado).
| # | Mensaje de Tannia | Esperado (criterio) |
|---|---|---|
| C1 | «Cubícame este plano.» | 30–100 palabras; resultado (m², m, ruta del archivo) y 1 pendiente (p. ej. espesor); **sin** describir herramientas ni repetir el nombre del archivo varias veces |
| C2 | «¿Cómo quedó mi trabajo del túnel?» | 1–4 frases: qué se generó (planta, perfil, 3 secciones, memoria), verificaciones geométricas ok y «sostenimiento pendiente de profesional» |
| C3 | Provoque un fallo de AutoCAD (cerrado) y pregunte «¿Por qué no se generó el DWG?» | Causa **real** registrada, original intacto, DXF disponible; no inventa otra causa |
| C4 | «Explícame cómo calculaste el volumen del túnel.» | Método, sección, progresivas, fórmula con sustitución, unidades, resultado y límites; **no** se limita a 100 palabras |
| C5 | «Desde ahora quiero que respondas cortito.» | Llama a `tannia_comunicacion establecer`; confirma en una frase |
| C6 | Con preferencia breve: «Muéstrame el procedimiento paso a paso.» | Respuesta detallada **solo esta vez**; después vuelve a breve |
| C7 | «De ahora en adelante responde detallado.» → cerrar y reabrir Claude Desktop → «Cubícame este plano.» | Sigue detallado (persistencia) |
| C8 | Proyecto A con preferencia breve y global detallado; consultar en cada uno | A breve, otro proyecto detallado |
| C9 | Resultado con advertencia crítica (cantidad sin verificar) en los tres niveles | La advertencia aparece en la respuesta en breve, normal y detallado (1 frase agrupada) |
| C10 | Observe 10 interacciones | Ninguna frase del tipo «voy a revisar…», «ahora consultaré…», «procederé…», «ya casi termino…» |
| C11 | Modo académico: «¿Cuánto da el volumen?» / «Ayúdame con el cálculo» / «Explícame» / «Resuélvelo completo» | Directa / orientación / explicación / procedimiento completo con unidades y verificaciones; sin suplantar la autoría |
| C12 | Hardening: cambie un dato conversando («el largo ahora es 120 m») | Pregunta/confirma antes de pisar el dato; conserva el resto del encargo |
| C13 | Retire una fuente y pida el informe | Se rehúsa explicando que la fuente ya no vale; no entrega cifras viejas |
| C14 | Pida «hazlo igual aunque esté desactualizado» | No lo hace por su cuenta: indica que necesita la aprobación de una persona (archivo/ventana) |
| C15 | Encargos «túnel», «canal», «departamento» sin plantilla | Usa `tannia_cic_catalogo/encargo`; no los trata como vivienda ni dice «no soportado» |
**Criterio de aceptación sugerido (a decidir por la PO):** ≥ 90 % de los escenarios C1–C15 cumplen; ninguna omisión de advertencias críticas; cero narración de herramientas. Resultado **pendiente de ejecución**.
