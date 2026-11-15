# Alcance del producto — v0.1

## Para quién
Tannia: usuaria de AutoCAD 2D. Debe poder trabajar sin terminal, Git, Docker o configuraciones manuales después de la instalación.

## Trabajo que el sistema debe resolver
1. **Planos:** inspeccionar DWG con AutoCAD abierto, consultar capas y entidades, elaborar propuestas y guardar ediciones solo en una copia.
2. **Cubicaciones:** medir desde geometría CAD 2D y planos PDF calibrados; informar partidas con unidades, cantidades, expresiones de cálculo y evidencia de origen.
3. **Presupuestos/APU:** transformar cantidades verificadas en XLSX con precios editables, desglose y fórmulas.
4. **Informes:** generar memoria de cálculo, advertencias y entregables PDF/Excel organizados por proyecto.
5. **Normativa:** orientar con fuentes oficiales chilenas, dejando explícito el alcance y la fecha de la información.

## Flujo ideal
Tannia abre su proyecto y dice en Claude Desktop «cubica los muros del plano y arma el presupuesto». El asistente inspecciona los archivos y unidades, identifica medidas o datos pendientes, trabaja en una carpeta separada, produce un borrador con trazabilidad y solicita su revisión profesional.

## MVP verificable
- Instalación guiada en Windows sin consola para la usuaria.
- Diagnóstico local de dependencias, con resultado legible y rutas de reparación.
- Prueba local de importación DXF 2D sintético y cuantificación básica.
- XLSX con fórmulas y documento de memoria de cálculo.
- Integración de Claude Desktop MCP local en entorno de prueba.
- Prueba de lectura y modificación reversible DWG en AutoCAD real, en el PC de Tannia.
- Demostración extremo a extremo y procedimiento de reversión.

## Límites y decisiones
- BIM/IFC excluido hasta nueva decisión.
- Nunca afirmar que geometría DXF y PDF constituye cubicación completa de obra sin espesores/alturas/criterios.
- Precios sin fuente o desactualizados se marcan como pendientes; el asistente no los inventa.
- Las referencias normativas son informativas; no equivalen a visación ni certificación.
- No instalar software de origen dudoso ni incluir MCP de terceros sin revisión de código/licencia/versión.
- Nunca trabajar directamente sobre documentos originales confidenciales sin autorización.
