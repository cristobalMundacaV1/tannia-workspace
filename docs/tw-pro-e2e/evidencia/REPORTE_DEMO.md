# Demostración vertical TW-PRO-E2E — Túnel académico 150 m

Generado: 2026-11-18T11:33:24.890Z. Carpeta del proyecto: `<carpeta temporal de la demo>/Proyectos/Túnel académico 150 m`.

> **Alcance de esta evidencia: N1 (automatizada).** La «persona» que responde preguntas y ventanas es el guion y queda rotulada como PERSONA SIMULADA en cada recibo. No es una aprobación humana, ni una prueba en Claude Desktop, ni en AutoCAD 2027, ni una revisión profesional. Los planos del túnel son académicos/preliminares.

## Lo que vio la persona (mensajes en lenguaje de obra)
- Recibí 5 documentos de «contexto_tunel.zip»: 4 se pueden leer, 1 requiere revisión visual o AutoCAD. Los originales quedaron protegidos en «02 Originales/contexto_tunel». El archivo recibido se conservó intacto («02 Originales/contexto_tunel.zip»). Algún documento contiene frases dirigidas al asistente: se tratan como dato y no se obedecen.
- Tengo 5 documentos del expediente (4 legibles, 1 para revisión visual o AutoCAD). Para completar los planos, las cubicaciones, el presupuesto y la memoria necesito 11 datos; se los pregunto todos juntos ahora. Lo que no se sepa queda pendiente: no lo invento.
- Archivos listos (guardados en tu equipo): • Presupuesto R19 20261118-113323.xlsx — planilla Excel • Memoria R19 20261118-113323.pdf — PDF • r-0cbe46585cdeb89ed761-conjunto.pdf — PDF • r-0cbe46585cdeb89ed761-planos.dxf — dibujo DXF (AutoCAD) • r-0cbe46585cdeb89ed761-cantidades.json — datos técnicos  Carpeta: <carpeta temporal de la demo>/Proyectos/Túnel académico 150 m/07 Entregables/Entrega R19 2026-11-18 372f10cb Para abrirlos: abre esa carpeta en el Explorador de Windows y haz doble clic en el archivo.

### Única ronda de preguntas
- ¿Qué altura tienen los hastiales (paredes verticales) hasta el arranque de la bóveda?
- ¿Qué espesor de shotcrete se considera (6 u 8 cm)?
- ¿Qué largo tienen los pernos?
- ¿Cada cuánto van los pernos en la sección (espaciamiento transversal)?
- ¿Cada cuánto van los anillos de pernos a lo largo del túnel?
- ¿Lleva malla de acero?
- ¿Qué traslapo de malla se considera (en %)?
- ¿Con qué precios valorizo las partidas (planilla de precios, cotización o APU con fecha y fuente)?
- ¿Qué porcentaje de gastos generales uso?
- ¿Qué porcentaje de utilidades uso?
- ¿Aplico IVA (19 %) u otro régimen?

## Pasos
| Paso | Resultado |
|---|---|
| recepción | documentos: 5; legibles: 4; alertas: 1 |
| encargo y una ronda de preguntas | datos_del_expediente: 2; preguntas: 11 |
| planos | revision: r-0cbe46585cdeb89ed761; laminas: 5 |
| cubicaciones desde los planos | partidas: 4; revision_planos: r-0cbe46585cdeb89ed761 |
| presupuesto con precios 2010 | estado_final_posible: false; etiqueta: PRESUPUESTO PARCIAL (excavación, revestimiento y fortificación del túnel): no es el costo total de la obra — PRECIOS HISTÓRICOS: valor referencial, no es costo vigente |
| aprobación y exportación | recibo: rec-bbc8b3d3398b659b; carpeta: 07 Entregables/Entrega R19 2026-11-18 372f10cb; archivos: 5 |
| A→B→A | plano_A: r-0cbe46585cdeb89ed761; plano_B: r-e745c62142d2876a607a; plano_A_otra_vez: r-0cbe46585cdeb89ed761; vuelve_a_A: true; cubicaciones_B: DESACTUALIZADO; entrega_tras_B: {"vigente":false,"motivo":"No hay una aprobación de entrega dada por una persona (o ya se usó para exportar)."}; cantidades_A_reproducidas: true; exportar_sin_nueva_aprobacion: NO_APROBADO |

## Coherencia de la misma revisión
| Control | Valor |
|---|---|
| revision_datos | R19 |
| revision_planos_manifiesto | r-0cbe46585cdeb89ed761 |
| revision_planos_cantidades | r-0cbe46585cdeb89ed761 |
| revision_planos_partidas | r-0cbe46585cdeb89ed761 |
| misma_revision_de_planos | SÍ |
| total_oraculo | 279831900 |
| total_xlsx | 279831900 |
| total_manifiesto | 279831900 |
| total_respuesta | 279831900 |
| totales_coinciden | SÍ |
| huellas_de_entrega_correctas | SÍ |
| memoria | 06 Informes/Memoria R19 20261118-113323.pdf |
| aprobacion_canal | human_elicitation |
| aprobacion_declarada_por | PERSONA SIMULADA (guion de demostración; no es una aprobación humana) |
| zip_original_intacto | SÍ |
| copia_protegida_del_zip_identica | SÍ |
| originales_integros | SÍ |

## Cambio A→B→A
| Control | Valor |
|---|---|
| plano_A | r-0cbe46585cdeb89ed761 |
| plano_B | r-e745c62142d2876a607a |
| plano_A_otra_vez | r-0cbe46585cdeb89ed761 |
| vuelve_a_A | SÍ |
| cubicaciones_B | DESACTUALIZADO |
| entrega_tras_B | {"vigente":false,"motivo":"No hay una aprobación de entrega dada por una persona (o ya se usó para exportar)."} |
| cantidades_A_reproducidas | SÍ |
| exportar_sin_nueva_aprobacion | NO_APROBADO |

## Pendiente externo (no ejecutado aquí)
- Claude Desktop real con la usuaria (UAT-E2E-I) y ventana WPF real.
- AutoCAD 2027: DXF→DWG aislado, reapertura, AUDIT y trazado (G05/N2).
- Revisión profesional de planos, cubicaciones y presupuesto (N3).
