# Roadmap de ingeniería — Tannia Workspace

> Estado: ingeniería aún no validada. Producto objetivo: **AutoCAD 2D y 3D, cubicaciones, APU/presupuestos, PDF, XLSX, informes y normativa chilena** desde Claude Desktop. **No BIM/IFC**.
> Directiva de entrega: [Macrofase integral TW-FULL](docs/implementation/TW_FULL_DELIVERY_MACROPHASE.md).

| Fase | Resultado | Evidencia mínima para cierre |
|---|---|---|
| TW-00 | Contratos y decisiones de arquitectura | Auditoría y riesgos documentados; aceptación PO de merge |
| **TW-00A** | **Prueba vertical Claude Desktop → MCP local → DXF** + **paquete de instalación mínima reproducible** | Registro de instalación, conexión y lectura; sin consola para la usuaria; rollback básico |
| TW-01 | Motor DXF 2D, cantidades trazables | Fixtures sintéticos, unidades, geometría y pruebas negativas |
| TW-02 | Cubicaciones, APU y presupuesto XLSX | Fórmulas/valores comprobados independientemente |
| TW-03 | PDF calibrado y memorias de cálculo | Escalas contrastadas, referencias a páginas, PDF legibles |
| TW-04 | MCP local, selección de proyectos, permisos y recuperación | Pruebas contractuales, ruta segura, fallos de conexión |
| TW-05 | Distribución Windows sin terminal (`.mcpb` preferente o instalador justificado) | Instalación/desinstalación/actualización en Windows limpio |
| TW-06 | Integración AutoCAD real 2D y exploración 3D | Lectura y edición reversible de copias DWG en AutoCAD compatible; puede quedar NO VERIFICADO hasta equipo de Tannia |
| **TW-07A** | **Piloto de usabilidad 2D**, sin depender de 3D | Tannia completa apertura → cubicación → presupuesto → entrega sin apoyo técnico |
| **TW-06A** | **Reconocimiento/medición geométrica AutoCAD 3D** | Matriz de entidades × operaciones × estado y geometrías con medidas conocidas; validación AutoCAD real pendiente si no hay licencia |
| **TW-07B** | Piloto final 3D y aceptación de Tannia | Sesión 3D real sin asistencia, resultados revisados, aceptación del PO |
| **TW-08** | Candidato de distribución integral y handoff | Paquete comprobable, SHA/checksums, instalación, desinstalación, guía de una página, matriz de cobertura y pendientes hardware |

## Orden y autonomía
- TW-00A **antes** de expandir TW-01. Para TW-00A usar paquete provisional **reproducible**, por ejemplo extensión `.mcpb` de prueba con dependencias fijas; no supone instalador definitivo ni build autoaprobado.
- TW-07A puede ocurrir tras TW-06 **2D** y antes de TW-06A. Si AutoCAD real no está accesible, mantenerlo como pendiente de hardware y **seguir con TW-06A/TW-08**.
- Claude Code ejecuta todas las fases que pueda con recursos disponibles, **sin detenerse por etapas que requieren AutoCAD o presencia de Tannia**. Marca esas evidencias `NO VERIFICADO EN HARDWARE REAL` y continúa con simuladores, fixtures y validación local.
- Si falla una prueba automatizable, corregir e iterar hasta verde; no ocultar fallos ni fabricar evidencias.
- Separar ramas y PR; no aprobarse, fusionar, desplegar ni publicar releases públicos sin autorización expresa del PO.
- **Meta técnica:** dejar un **release candidate transferible**, probado hasta los límites reales del entorno, sin confundirlo con aceptación profesional final.

## Contrato de capacidades AutoCAD
El adaptador declara para cada **tipo de entidad × operación** el estado `supported / unsupported / unverified`, versión CAD probada, implementación, restricciones y evidencia. Tipos mínimos candidatos: LINE, LWPOLYLINE, ARC, CIRCLE, INSERT/BLOCK, 3DPOLY, 3DSOLID, REGION, SURFACE, MESH; operaciones: detect/read, measure length, area, volume, edit-copy, export. No publicar `supported` sin prueba específica.

## Gates generales
- Originales protegidos por controles técnicos y comprobación de integridad.
- No inferir unidades, espesores, alturas, precios, materiales ni normativa.
- Medida geométrica ≠ partida constructiva; cantidad y memoria trazables al origen.
- Acceso a carpetas limitado y herramientas MCP auditadas; revisar licencia y dependencias.
- Interfaz y recuperación sin terminal ni edición de JSON para Tannia.
- Distinguir `IMPLEMENTADO`, `PROBADO EN ENTORNO DISPONIBLE`, `NO VERIFICADO EN AUTOCAD REAL` y `VALIDADO POR TANNIA`.
