# Roadmap de ingeniería — Tannia Workspace

> Estado inicial: documentación de fundación; funcionalidad sin implementar.

| Hito | Entregable | Gate de aceptación |
|---|---|---|
| TW-00 | Contratos, arquitectura y pruebas base | Alcance visible y riesgos documentados |
| TW-01 | Motor local DXF y cubicaciones | Entradas sintéticas verificadas, unidades correctas, trazabilidad por entidad, límites explícitos |
| TW-02 | XLSX de cubicaciones, presupuestos y APU | Fórmulas comprobadas, precios opcionales/no inventados, exportación estable |
| TW-03 | PDF de planos y memoria de cálculo | Calibración obligatoria para medir PDF; resultados reproducibles |
| TW-04 | MCP local y perfil Claude | Herramientas registradas, permisos acotados, operaciones seguras, pruebas de contrato |
| TW-05 | Instalador Windows | Instalación/desinstalación y diagnóstico sin consola en PC limpio |
| TW-06 | Validación AutoCAD real | DWG sobre copia, operaciones y PDF revisados en computador de Tannia |
| TW-07 | Piloto de uso real | Tannia completa una tarea de principio a fin sin asistencia técnica |

## Prioridad actual
**TW-01:** crear un pequeño motor de medición para DXF 2D con pruebas automatizadas, sin requerir AutoCAD. Entregables de cantidades deben contener valores, unidades, referencia geométrica y advertencias.

## Gates transversales
- Nunca modificar originales.
- No inventar medidas, alturas, espesores, precios ni cumplimiento normativo.
- No marcar un gate aprobado sin ejecución y evidencia real de pruebas.
- PR revisables; no hacer merge, publicar instalador o desplegar sin aprobación.
- El producto final debe ser usable por una persona sin conocimientos de programación.

## Dependencias de integración
Los MCP de terceros son **candidatos** y requieren auditoría de seguridad, mantenimiento, licencia, versiones, permisos y funcionamiento antes de distribuirse. Las pruebas DXF/PDF no sustituyen el gate de AutoCAD real.
