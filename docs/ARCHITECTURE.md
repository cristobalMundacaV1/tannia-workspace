# Arquitectura objetivo — diseño preliminar

## Experiencia de usuario
- **Interfaz:** Claude Desktop (conversación natural).
- **En el computador de Tannia:** AutoCAD completo Windows + MCP CAD local + motor local de documentos y cuantificación.
- **Instalación:** paquete Windows que detecta versiones y requisitos, instala recursos verificados, configura directorios y valida conexión. La autorización/inicio de sesión de Claude puede seguir siendo manual.
- **Sin AutoCAD en PC del desarrollador:** pruebas sobre DXF sintéticos, PDF de prueba, XLSX y mocks del adaptador CAD; la validación DWG queda explícitamente pendiente hasta equipo real.

## Componentes
1. **adaptador CAD:** interfaz de consulta/edición con capacidades detectables; candidato inicial `ajaquin8/autocad-mcp`; no se incorpora ni ejecuta automáticamente antes de auditar versión, licencia, origen y compatibilidad.
2. **lector DXF:** analizar capas, entidades, unidades y áreas/longitudes medibles en archivos de prueba.
3. **takeoff PDF:** usar mediciones calibradas sobre páginas; candidato `Kentucky-ai/opentakeoff`, sujeto a auditoría. No asumir que reconocimiento automático de elementos es infalible.
4. **motor de cantidades:** partidas, unidad, fórmula, datos de origen, exclusiones, supuestos e incertidumbre explícita. Reglas de cubicación chilena configurables; no distribuir normas protegidas sin licencia.
5. **presupuestos:** archivos XLSX con fórmulas, partidas y precios editables, fecha, proveedor/fuente e impuestos documentados.
6. **documentos:** informe PDF, memoria de cálculo y registro de cambios/validaciones.
7. **orquestación:** herramientas MCP locales para que Claude solicite operaciones; límites de carpetas, autorización y política de no sobrescritura.

## Directorios de trabajo
```text
Tannia Workspace/
  Proyectos/
    <proyecto>/
      01 Antecedentes/
      02 Originales/       # solo lectura
      03 Trabajo/
      04 Cubicaciones/
      05 Presupuestos/
      06 Informes/
      07 Entregables/
```

## Contrato mínimo de trazabilidad de una cantidad
```text
partida, unidad, cantidad, formula, fuente_archivo, referencia_entidad_o_pagina,
unidades_origen, conversion_aplicada, supuestos, advertencias, estado_revision
```

## Seguridad y distribución
- Operaciones de solo lectura por defecto; cambios por copia, con vista previa y deshacer cuando esté disponible.
- Sin escritura fuera de la carpeta autorizada del proyecto.
- Sin ejecutar texto arbitrario de un plano/documento como comando.
- Versiones de dependencias fijadas, verificadas y compatibles con sus licencias.
- Secretos fuera del código y del repositorio; no almacenar conversaciones ni planos personales por defecto.
- El procesamiento MCP ocurre localmente; el modelo Claude sigue siendo un servicio remoto y deben revisarse sus políticas de datos.

## Opciones técnicas tentativas, no implementadas
Python para motor local (`ezdxf`, `openpyxl`, bibliotecas PDF/documentos de licencia verificada), pruebas `pytest`, empaquetador Windows evaluado tras prototipo. Elegir un solo mecanismo de instalación comprobable y recuperable. No agregar frontend ni contenedores si no son necesarios.
