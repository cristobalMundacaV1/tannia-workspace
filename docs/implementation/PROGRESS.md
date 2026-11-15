# Checklist de avance TW-FULL

Rama de trabajo: `claude/trusting-hawking-9mumc1` (base: head de `feat/project-foundation`, PR #2). `main` no se toca.
Estados: ✅ hecho y probado en este entorno · 🟡 parcial · ⬜ pendiente · 🔒 pendiente de hardware/usuario.

| Fase | Estado | Notas |
|---|---|---|
| TW-00A vertical + paquete provisional | ✅ (UI Claude Desktop 🔒) | MCP stdio Node, `.mcpb` empaquetado/validado/desempaquetado/ejecutado en limpio |
| TW-01 motor DXF 2D | ✅ | `src/dxf/{reader,geometry,measure}.js`, 8+1 pruebas vs oráculo analítico (ezdxf para fixtures) |
| TW-02 cantidades/APU/presupuesto/XLSX | ✅ | reglas sin defaults, bloqueos FINAL, XLSX con fórmulas recalculado por LibreOffice. Catálogo oficial y precios: NO incluidos (solo datos del usuario) |
| TW-03 PDF + informes | ✅ | extracción vectorial, calibración verificada, escaneados, memoria PDF; OpenTakeoff evaluado (AGPL-3.0, no incorporado) |
| TW-04 flujo MCP de producto | ✅ | ~28 herramientas, máquina de estados con gates, persistencia/recuperación, huellas de originales, partidas desactualizadas, normativa orientativa; e2e contra fuente Y bundle |
