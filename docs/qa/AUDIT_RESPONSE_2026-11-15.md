# Respuesta a auditoría independiente — 2026-11-15

**Origen:** informe de auditoría entregado por el Product Owner sobre PR #2, fechado el 15 de noviembre de 2026. **Estado:** hallazgos tratados documentalmente; **ninguna prueba funcional ejecutada** en esta respuesta.

## Rectificación de alcance
Se corrige el error documental «AutoCAD 2D» como límite del producto. Tannia Workspace debe permitir **AutoCAD 2D y 3D**. La etapa TW-01 sigue siendo una prueba de **DXF 2D**, porque se puede validar sin AutoCAD; el reconocimiento, cálculo geométrico y posible edición de sólidos/superficies **3D** entra en **TW-06A** y requiere AutoCAD real. **BIM/IFC continúa excluido**.

## Tratamiento de hallazgos
| Hallazgo | Decisión | Evidencia aún pendiente |
|---|---|---|
| AUD-01 Priorización | **Aceptado**: agregar TW-00A antes de TW-01 | Demostración Claude Desktop → MCP → DXF en Windows |
| AUD-02 Compatibilidad AutoCAD | **Aceptado**: matriz por edición y pruebas reales tempranas | Equipo/versión de Tannia; lectura/edición reversible DWG |
| AUD-03 Protección de originales | **Aceptado**: controles de escritura/copias/rollback en adaptador | Pruebas negativas con integridad del original |
| AUD-04 Geometría ≠ construcción | **Aceptado**: medición, clasificación y cantidades como pasos distintos | Casos independientes de unidades, duplicados, referencias y geometría |
| AUD-05 Instalación | **Aceptado provisionalmente**: evaluar extensión `.mcpb` antes de crear `.exe` | Instalación, recuperación y desinstalación en Windows limpio |
| AUD-06 Frontera MCP | **Aceptado**: rutas y herramientas autorizadas, rechazo de entradas maliciosas | Pruebas de seguridad negativas |
| AUD-07 OpenTakeoff | **Aceptado**: revisar capacidades, licencia y reutilización | Evaluación técnica y legal de distribución |
| AUD-08 Contrato UX | **Aceptado**: estados proyecto→borrador→revisión→entrega y recuperación | Sesión real de Tannia sin asistencia |

## Decisiones de gobernanza
- El PR #2 sigue siendo **documental y en borrador**. No autoaprobar ni fusionar.
- El informe del auditor distinguió diseño plausible de producto verificable; se mantiene esa distinción.
- Esta respuesta corrige contratos, **no cierra ningún hallazgo** ni sustituye pruebas.
- El implementador deberá comunicar al auditor los cambios y recopilar evidencia sobre SHA identificable.
- Los MCP externos siguen siendo **candidatos**, no componentes probados ni seguros por defecto.

## Próxima prueba
TW-00A: en Windows, desde Claude Desktop, usar un MCP local para inspeccionar un DXF simple y devolver una medición o inventario. Sin terminal ni configuración manual para la usuaria. Registrar versión, instalación, comandos ejecutados por el desarrollador, resultado y límites. Si fracasa, resolver integración antes de ampliar el motor de cubicación.
