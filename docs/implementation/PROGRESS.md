# Checklist de avance TW-FULL

Rama de trabajo: `claude/trusting-hawking-9mumc1` (base: head de `feat/project-foundation`, PR #2). `main` no se toca.
Estados: ✅ hecho y probado en este entorno · 🟡 parcial · ⬜ pendiente · 🔒 pendiente de hardware/usuario.

| Fase | Estado | Notas |
|---|---|---|
| TW-00A vertical + paquete provisional | ✅ (UI Claude Desktop 🔒) | MCP stdio Node, `.mcpb` empaquetado/validado/desempaquetado/ejecutado en limpio |
| TW-01 motor DXF 2D | ✅ | `src/dxf/{reader,geometry,measure}.js`, 8+1 pruebas vs oráculo analítico (ezdxf para fixtures) |
