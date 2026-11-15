# Roadmap de ingeniería — Tannia Workspace

> Estado: contratos en revisión; **ninguna funcionalidad está aún implementada o validada**. AutoCAD **2D y 3D** pertenece al alcance; BIM/IFC está excluido.

| Hito | Entregable | Gate de aceptación |
|---|---|---|
| TW-00 | Alcance, riesgos, arquitectura y contrato UX revisados | Auditoría documental y decisiones de PO |
| **TW-00A** | **Prueba vertical Claude Desktop → MCP local → DXF simple** | **Demostración real en Windows sin consola para la usuaria** |
| TW-01 | Motor DXF **2D inicial**, mediciones y trazabilidad | Geometría y unidades verificadas con casos independientes |
| TW-02 | XLSX de cubicaciones, presupuestos y APU | Fórmulas y resultados comprobados, precios no inventados |
| TW-03 | PDF de planos y memoria de cálculo | Calibración obligatoria, cálculos reproducibles |
| TW-04 | MCP local y flujo de proyecto completo | Herramientas limitadas, estados y recuperación comprobados |
| TW-05 | Distribución mediante `.mcpb` o instalador justificado | Instalar/desinstalar/diagnosticar en Windows limpio sin consola |
| TW-06 | AutoCAD real **2D**, y comprobación inicial de capacidades 3D | Leer/editar copias DWG, recuperar fallos; registrar matriz de compatibilidad |
| **TW-06A** | **AutoCAD 3D: reconocimiento y medición geométrica** | Entidades 3D, área/volumen calculados contra referencias en AutoCAD real |
| TW-07 | Piloto de uso real con Tannia | Trabajo completo sin asistencia técnica |

## Primera prioridad
**TW-00A** precede al desarrollo extenso de TW-01: demostrar desde la interfaz de Claude una llamada MCP que lee DXF y entrega información útil en Windows. No requiere AutoCAD instalado en PC del desarrollador.

**TW-01** es deliberadamente **DXF 2D** para poder validar medición geométrica con fixtures. No limita al producto a 2D.

## Condiciones para 3D
- No suponer capacidades 3D en MCP existentes sin verificarlas.
- Separar medición geométrica 3D de identificación de elementos constructivos.
- Confirmar tipo de entidad, unidades, interpretación de volúmenes y precisión.
- 3D no autoriza BIM/IFC ni integración de modelos BIM.

## Gates transversales
- Proteger técnicamente originales y restringir rutas, comandos y herramientas.
- No inventar medidas, alturas, espesores, precios ni normas.
- No autoaprobar sin evidencia; documentar `NO VERIFICADO` cuando corresponda.
- PR revisables; sin merges ni publicación sin aprobación del PO.
- La usuaria debe poder instalar, trabajar y recuperar fallos sin soporte técnico.
- Evaluar licencias y seguridad de todo MCP antes de empaquetar.

## Dependencias
MCP CAD y PDF son candidatos, no componentes aprobados. Validar AutoCAD real en el equipo de Tannia tan pronto sea posible; la simulación no sustituye esa prueba.
