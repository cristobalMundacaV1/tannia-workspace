# Tannia Workspace

Asistente de trabajo para AutoCAD y construcción, operado desde Claude Desktop. Su objetivo es que una persona sin conocimientos técnicos de programación pueda trabajar con planos, cubicaciones, presupuestos y documentación mediante instrucciones en español.

> Estado: **inicio de ingeniería**. No existe todavía un instalador ni una integración validada en AutoCAD real.

## Experiencia prevista

1. Abrir AutoCAD y el proyecto.
2. Pedir a Claude: «revisa este plano, cubica los muros y prepara el presupuesto».
3. Recibir resultados en carpetas ordenadas: DWG/DXF de trabajo, XLSX, PDF y memoria de cálculo.
4. Revisar medidas, supuestos y entregables antes de aprobar.

## Alcance inicial

- **CAD 2D:** lectura de dibujos, capas, geometrías, cambios reversibles y exportación; integración por MCP local.
- **Cubicaciones:** longitudes, áreas, volúmenes y conteos a partir de geometría verificable, con trazabilidad.
- **Presupuestos / APU:** plantillas XLSX con unidades, precios, fórmulas, fecha y fuentes.
- **Documentos:** memorias de cálculo, informes, PDF y organización automática de proyectos.
- **Normativa chilena:** consultas respaldadas en fuentes oficiales, con referencias y fecha de consulta.
- **Distribución:** instalador sencillo para Windows; sin comandos ni Docker para la usuaria.

**Fuera del alcance inicial:** BIM/IFC, reemplazar criterio profesional, certificar conformidad normativa, inferir medidas ausentes, integrar servicios externos sin permiso.

## Principios

- Nunca sobrescribir los planos originales; usar copias de trabajo.
- Nunca inventar dimensiones, mediciones, normativa, precios ni resultados de pruebas.
- Las cantidades incluyen fuente (archivo, entidad o página), unidades, operación, supuestos y estado de validación.
- Las acciones destructivas o entregas finales requieren autorización explícita.
- Los MCP de terceros se auditan, se fijan a una versión y se prueban antes de integrarse.
- La operación local del MCP **no equivale** a IA totalmente sin conexión: Claude puede transmitir contexto a su servicio.
- AutoCAD real se probará en el computador de Tannia; el desarrollo inicial debe poder avanzar sin AutoCAD instalado.

## Cómo se desarrolla

- `main`: base estable.
- Trabajo en ramas de función y PR revisables, sin merges ni despliegues automáticos.
- Toda funcionalidad debe tener pruebas reproducibles y evidencias.
- Priorizar utilidad real y sencillez para la usuaria sobre complejidad de infraestructura.

Consulta [alcance del producto](docs/PRODUCT_SCOPE.md), [arquitectura](docs/ARCHITECTURE.md) y [hoja de ruta](docs/ROADMAP.md).

---
Proyecto independiente. No afiliado a Autodesk ni Anthropic.
