# CLAUDE.md — Tannia Workspace | Mandato de implementación

## Tu encargo
Actúa como **ingeniero implementador principal**. Completa la macrofase integral [TW-FULL](docs/implementation/TW_FULL_DELIVERY_MACROPHASE.md) de principio a fin, con todas las pruebas que permitan las herramientas y el hardware disponibles. Tu destino es **un paquete transferible para que Tannia lo instale y trabaje desde Claude Desktop**, no una demo ni solo documentación.

Lee primero `AGENTS.md`, `docs/PRODUCT_SCOPE.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, los informes de auditoría en `docs/qa/` y los issues #1, #3 y #4. Comprueba SHA, estado de ramas y PR #2.

## Reglas operativas
1. Inicia con TW-00A y un flujo vertical real de MCP + DXF. No amplíes el motor antes de comprobar el protocolo y un empaquetado provisional reproducible.
2. Continúa TW-01 → TW-02 → TW-03 → TW-04 → TW-05 → TW-06 → TW-07A → TW-06A → TW-07B → TW-08, modificando el orden únicamente si pruebas/dependencias lo justifican. **Avanza autónomamente** sin detenerte tras un hito.
3. **No pidas al PO que instale o recupere AutoCAD en su computador.** Desarrolla con DXF/PDF sintéticos, mocks y pruebas contractuales; si no tienes AutoCAD real, anota ese gate como pendiente de hardware y continúa hasta el RC.
4. Si falta acceso a Claude Desktop gráfico en tu entorno, automatiza el test de MCP y registra la prueba de UI como pendiente; no afirmes haberla ejecutado.
5. La funcionalidad será **AutoCAD 2D y 3D geométrico**, sin BIM/IFC. Los MCP candidatos de terceros solo se incorporan tras revisar código, licencia, versiones y superficie de permisos.
6. Construye experiencia sin terminal: instalación/desinstalación, errores claros, recuperación, carpetas y exportaciones ordenadas. Prioriza `.mcpb` si demuestra resolverlo; usa instalador adicional solo con justificación y pruebas.
7. Protege originales técnicamente; medidas, unidades, materiales, normas y precios no se infieren ni inventan. El código no puede aprobar por sí solo una entrega profesional.
8. Haz y ejecuta tests de geometría, seguridad, empaquetado y regresión. Los tests pasan sobre SHA identificado. Repite, corrige y vuelve a ejecutar. No inventes resultados.
9. Trabaja en rama propia/PRs auditables. No fusiones `main`, no publiques releases públicos, no te autoapruebes; solicita revisión independiente. Si el PR #2 sigue sin merge, crea una rama **desde el head de fundación** y PR apilado, sin modificar la rama del auditor.
10. Registra progreso en el repositorio, no solo en el chat: checklist de fases y `EVIDENCE_MATRIX.md` con evidencia y estados. Deja un resumen corto para el PO con los bloqueos inevitables.

## Meta de salida
Código final, paquete `.mcpb` y/o instalador según viabilidad verificada, pruebas automatizadas, fixtures, ejemplos de resultados, instrucciones de una página, compatibilidad, limitaciones, hashes, reporte QA y handoff a Tannia.

**No declares la validación en AutoCAD real ni el piloto de Tannia como aprobados sin ejecución.** La falta de estas pruebas **no impide terminar el RC de ingeniería**, pero sí impide prometer que funciona de maravilla en su PC.
