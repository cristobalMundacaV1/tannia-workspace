# Tannia Workspace

Asistente de trabajo para AutoCAD **2D y 3D** y construcción, operado desde Claude Desktop. Su objetivo es que una persona sin conocimientos técnicos de programación pueda trabajar con planos, cubicaciones, presupuestos y documentación mediante instrucciones en español.

> Estado: **inicio de ingeniería**. No existe todavía un instalador ni una integración validada en AutoCAD real. Las capacidades 3D son **alcance planificado**, no herramientas implementadas o demostradas.

## Experiencia prevista

1. Abrir AutoCAD y seleccionar el proyecto.
2. Pedir a Claude: «revisa este plano, cubica los muros y prepara el presupuesto».
3. Recibir resultados en carpetas ordenadas: DWG/DXF de trabajo, XLSX, PDF y memoria de cálculo.
4. Revisar medidas, supuestos y entregables antes de aprobar.

## Alcance del producto

- **AutoCAD 2D y 3D:** consultar geometría y entidades del DWG; crear o modificar copias de trabajo y preparar entregables. Primero se validará 2D; la lectura y cubicación de geometría 3D se desarrollarán y verificarán después.
- **Cubicaciones:** longitudes, áreas, volúmenes y conteos con unidades confirmadas, fuentes y advertencias. La geometría no identifica automáticamente materiales o partidas.
- **Presupuestos / APU:** XLSX con cantidades, precios editables, fórmulas y fuentes.
- **Documentos:** memorias de cálculo, informes, PDF y organización de proyectos.
- **Normativa chilena:** consultas orientativas con fuentes oficiales y fecha de consulta.
- **Experiencia:** Claude Desktop como interfaz, MCP local e instalación sin consola para la usuaria; evaluar primero extensiones `.mcpb` y después, si es necesario, instalador Windows propio.

**Fuera de alcance:** BIM/IFC, certificación normativa automática, inferencia de dimensiones faltantes, acceso no autorizado a datos o planos.

## Orden de validación

1. **TW-00A:** demostrar en Windows Claude Desktop → MCP local → lectura de DXF → respuesta, sin AutoCAD y sin terminal para la usuaria.
2. **TW-01 en adelante:** mediciones DXF 2D verificables, presupuestos, PDF y seguridad operacional.
3. **AutoCAD real:** validar lectura y edición sobre copia en el computador de Tannia, sin dar por válida una simulación.
4. **AutoCAD 3D:** verificar entidades, sólidos, superficies y volúmenes en DWG, con soporte MCP comprobado. No confundir 3D geométrico con BIM.

## Principios

- Proteger originales mediante controles técnicos, no solo instrucciones al asistente.
- Nunca inventar dimensiones, cantidades, precios, normativa ni resultados de pruebas.
- Cada cantidad identifica fuente, entidad o página, unidades, fórmula, supuestos y estado de validación.
- Las operaciones sensibles requieren autorización; las salidas son borradores hasta revisión de Tannia.
- Auditar licencia, código, permisos y versión fija de todo MCP de terceros.
- Los MCP pueden ejecutarse localmente, pero Claude sigue siendo un servicio remoto.
- El desarrollo inicial no requiere AutoCAD instalado en el PC del desarrollador.

## Cómo se desarrolla

- `main`: base estable.
- Ramas de función y PR revisables; no merge ni publicación sin aprobación.
- Pruebas reproducibles y evidencias para cada gate.
- Priorizar utilidad real sobre complejidad.

Consulta [alcance](docs/PRODUCT_SCOPE.md), [arquitectura](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md) y [respuesta a auditoría](docs/qa/AUDIT_RESPONSE_2026-11-15.md).

---
Proyecto independiente. No afiliado a Autodesk ni Anthropic.
