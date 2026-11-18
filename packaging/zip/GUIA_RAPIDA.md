# Guía rápida — Tannia Workspace {{VERSION}}

> Candidato **no validado**. Úselo para probar con copias de planos, no para entregas profesionales todavía.

## Cómo se trabaja (sin consola, sin JSON)

Hable con Claude en español. En el botón **+** de la conversación encontrará los procedimientos de Tannia Workspace:

| Procedimiento | Pídalo así |
|---|---|
| Organizar los antecedentes | «Crea el proyecto Casa Ñuñoa e importa el plano C:\…\planta.dxf» |
| Revisar un plano | «Revisa este plano: capas, unidades y qué se puede medir» |
| Cubicar | «Cubica los muros del eje A: altura 2,4 m, descontando todos los vanos» |
| Presupuesto y entrega | «Prepara el presupuesto con estos precios y la memoria para revisión» |
| Recuperar | «La operación se interrumpió, revisa qué quedó hecho» |

## Lo que solo usted puede hacer

- **Verificar una cantidad**: aparece una ventana con la cantidad, la fórmula y el origen. Revísela y pulse *Verificar cantidad*. Claude no puede hacerlo por usted.
- **Aprobar una entrega**: aparece una ventana con el total y la lista exacta de archivos (con su huella). Si después cambia una cantidad, un precio o un parámetro, la aprobación deja de valer y hay que regenerar los archivos.
- **Gastos generales, utilidades e IVA**: Tannia ya no supone ningún porcentaje. Indíquelos (0 solo si usted lo decide).

## Dónde quedan los archivos

`Documentos\Tannia Workspace\Proyectos\<proyecto>\`: `02 Originales` (protegidos, nunca se modifican), `03 Trabajo` (copias), `04 Cubicaciones`, `05 Presupuestos`, `06 Informes`, y `07 Entregables\Entrega R<n> <fecha> …` (solo lo aprobado, con `manifiesto-entrega.json` y `HUELLAS-SHA256.txt`).
