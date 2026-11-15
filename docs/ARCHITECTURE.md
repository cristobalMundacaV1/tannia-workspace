# Arquitectura objetivo — diseño preliminar corregido

## Experiencia de usuario
- **Interfaz única:** Claude Desktop, lenguaje cotidiano; Tannia no necesita elegir MCP ni usar consola.
- **En el PC de Tannia:** AutoCAD completo compatible en Windows + MCP CAD local + módulos internos de cantidades y documentos.
- **Distribución:** **evaluar primero una extensión `.mcpb`** con instalación/desinstalación sencilla; solo desarrollar instalador Windows adicional si pruebas reales demuestran que hace falta. Ningún mecanismo está validado todavía.
- **Sin AutoCAD en PC del desarrollador:** fixtures DXF/PDF, XLSX y simulación de adaptador. Las simulaciones no sustituyen la validación DWG real.

## Diseño: un producto, módulos internos
1. **adaptador CAD 2D/3D:** API de capacidades detectables para lectura/edición segura en copia. Candidato: `ajaquin8/autocad-mcp`, pendiente de auditoría y pruebas de compatibilidad. **No asumir que el candidato permite operar sólidos 3D**.
2. **lector DXF 2D inicial:** geometría, capas, identificadores, unidades y mediciones medibles; DXF no reemplaza todas las propiedades del DWG.
3. **extensión CAD 3D posterior:** inspección de sólidos, superficies, mallas y geometría tridimensional mediante AutoCAD y APIs compatibles, con pruebas de áreas/volúmenes y soporte documentado por tipo de entidad.
4. **mediciones PDF:** geometría calibrada con escala explícita; candidato `Kentucky-ai/opentakeoff`, sujeto a evaluación técnica y de licencia (incluida distribución).
5. **motor de cantidades:** separar (a) medición geométrica, (b) clasificación de partidas y (c) cálculo constructivo. Cada cantidad muestra fuente, unidad, operación, supuestos, exclusiones y revisión.
6. **presupuestos:** XLSX con fórmulas, partidas y precios editables, proveedor/fuente, fecha e impuestos claros.
7. **documentos:** PDF de informe, memoria de cálculo y registro de cambios.
8. **orquestación MCP local:** catálogo de herramientas permitido, carpetas autorizadas, autorizaciones específicas y estados recuperables.

## Contrato de proyecto y archivos
```text
Tannia Workspace/
  Proyectos/
    <proyecto>/
      01 Antecedentes/
      02 Originales/       # nunca modificar
      03 Trabajo/
      04 Cubicaciones/
      05 Presupuestos/
      06 Informes/
      07 Entregables/
```

## Contrato de medidas
```text
partida, tipo_geometria, unidad, cantidad, formula,
fuente_archivo, referencia_entidad_o_pagina,
unidades_origen, escala_o_conversion_verificada,
supuestos, advertencias, estado_revision
```
- Unidad desconocida → **bloquear conversión** hasta confirmación.
- Geometría abierta/duplicada, bloques transformados, arcos, referencias externas y entidades no soportadas → marcar advertencia o impedir cantidad final según riesgo.
- Una medida no prueba una partida constructiva sin criterios profesionales.

## Protección exigible
- Crear copia de trabajo antes de cualquier operación de escritura.
- Bloquear técnicamente guardado, eliminación o comandos destructivos sobre originales, mediante control en el adaptador y restricciones de rutas; verificar integridad antes/después.
- Rechazar acceso fuera de proyecto autorizado y entradas de documentos que intenten dar instrucciones.
- Estados de proyecto y errores simples: selección, análisis, borrador, revisión, aprobado, entrega; recuperación tras fallos.
- Versionar y auditar componentes de terceros, licencias y permisos mínimos; pruebas negativas y rollback.
- Un MCP local no elimina la transmisión de contexto al servicio remoto Claude.

## Estrategia de prueba
1. Prueba vertical **TW-00A** Claude Desktop → MCP local → lectura DXF → resultado en Windows, antes de implementar extensamente el motor.
2. Pruebas independientes de geometría DXF y medición constructiva.
3. Pruebas de generación XLSX, fórmulas, PDF y protección de archivos.
4. Pruebas con AutoCAD real en el PC de Tannia (edición y recuperación sobre copia).
5. Pruebas CAD 3D con geometrías de volumen/área conocidos y compatibilidad de entidades.
6. Piloto real sin asistencia técnica de la usuaria.

## Decisiones todavía abiertas
- Inventario de edición y versión exacta de AutoCAD de Tannia.
- Seguridad, licencias y compatibilidad de los MCP candidatos.
- Si `.mcpb` cubre toda la instalación, sin ejecutable adicional.
- Herramientas exactas para edición y medición 3D.
No declarar integración instalada, auditada o probada hasta disponer de evidencia.
