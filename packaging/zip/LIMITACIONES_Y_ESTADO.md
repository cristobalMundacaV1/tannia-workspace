# Estado, capacidades y límites — Tannia Workspace {{VERSION}}

**Estado: CANDIDATO NO VALIDADO.** Construido desde el commit `{{COMMIT}}`. Pruebas automatizadas en Linux y Windows (CI) sin AutoCAD ni Claude Desktop reales.

## Utilizable para probar con copias
- Proyectos con originales protegidos por huella, copias de trabajo, migración con respaldo.
- Lectura y medición DXF 2D, PDF vectorial con calibración verificada.
- Cubicación con métodos explícitos (MC01 muros/vanos, MC02 losas, MC04 conteo físico): no son normas chilenas.
- APU y presupuesto XLSX con fórmulas; memoria PDF; parámetros económicos explícitos.
- Verificación de cantidades y aprobación de entregas **solo por una persona**; entrega exacta de lo aprobado.

## Bloqueado o no validado
- **AutoCAD real**: ninguna versión probada con este candidato; la importación DXF→DWG tiene un fallo real previo sin causa confirmada (CAD-OPEN-02). Use las funciones de AutoCAD solo en copias.
- **Claude Desktop real**: instalación, ventanas de confirmación y procedimientos no probados en su equipo.
- **Uso profesional**: requiere piloto con expedientes reales anonimizados y revisión de un profesional competente (gates G2b, G3, G7, G8 del roadmap).
- Normativa: solo referencias con fuente, versión y límites; **no evalúa cumplimiento**. Las NCh de pago no se reproducen.
- Fuera de alcance: BIM/IFC, cálculo estructural, instalaciones, certificaciones, envío a terceros.
