# Alcance del producto — v0.2

## Para quién
Tannia: usuaria profesional de **AutoCAD 2D y 3D**. Debe poder trabajar sin terminal, Git, Docker o configuración manual de servidores después de la instalación.

## Trabajo que el sistema debe resolver
1. **Planos CAD 2D/3D:** consultar DWG con AutoCAD abierto, identificar entidades y geometría disponible, proponer cambios y generar solo copias de trabajo. La cobertura de operaciones 3D queda condicionada a desarrollo y pruebas reales.
2. **Cubicaciones:** medir geometría 2D, planos PDF calibrados y, en una fase posterior, elementos geométricos 3D (longitudes, superficies, volúmenes) con unidades y origen verificables. Clasificar partidas constructivas por separado: un sólido 3D no implica por sí mismo un material o elemento constructivo.
3. **Presupuestos/APU:** transformar cantidades validadas en XLSX con precios editables, desglose, fórmulas y fuentes.
4. **Informes:** memoria de cálculo, advertencias y entregables PDF/Excel organizados.
5. **Normativa:** orientación con fuentes oficiales chilenas, artículo, versión y fecha, sin declarar certificación automática.

## Flujo esperado
Tannia abre su proyecto y pide «revisa este plano o modelo y prepara la cubicación y el presupuesto». El sistema identifica tipo de documento y capacidades disponibles, verifica unidades y escala, separa medidas directas de supuestos, trabaja sobre copias y presenta resultados revisables. Solo solicita datos profesionales que realmente falten.

## MVP y validación progresiva
- **TW-00A — primero:** demostración real en Windows de Claude Desktop → MCP local → lectura DXF sencillo → respuesta, desde una instalación sin consola para la usuaria.
- Diagnóstico comprensible de dependencias, errores y reparación.
- Medición DXF **2D** sobre fixtures sintéticos con cantidades y unidades verificadas: es el **primer incremento**, no el límite del producto.
- Generación XLSX con fórmulas y memoria de cálculo.
- Integración y controles de seguridad MCP verificados.
- Lectura, copia, edición reversible y exportación DWG en AutoCAD **real**, en el PC de Tannia.
- Piloto completo con Tannia sin asistencia de desarrollo.

## AutoCAD 3D — fase explícita posterior
- Reconocer tipos geométricos 3D del DWG: sólidos, superficies, mallas y entidades 3D, según soporte real disponible.
- Extraer dimensiones, superficies y volúmenes donde sean calculables y comprobables.
- Cubicaciones de geometría 3D con trazabilidad a entidad, unidades y método.
- Crear o modificar modelos 3D solo después de demostrar seguridad de edición y capacidades de herramienta.
- Validar resultados con objetos 3D de referencia y AutoCAD real; **no declarar soporte 3D probado** antes de ello.

## Límites y decisiones
- BIM/IFC está **excluido**. AutoCAD 3D geométrico no es BIM.
- No tomar `INSUNITS`, una etiqueta o una inferencia visual como prueba suficiente de unidades/escala.
- Nunca presentar cubicación completa a partir de geometría sola si faltan alturas, espesores, materiales o reglas.
- Precios sin procedencia se mantienen pendientes, nunca inventados.
- Ningún MCP de terceros se redistribuye sin auditoría de licencia, seguridad y versión.
- Originales protegidos por controles técnicos y no por promesas en prompts.
