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
| TW-05 paquete Windows | ✅ decisión `.mcpb` (UI Claude Desktop / Windows real 🔒) | actualización/rollback/desinstalación/logs/reparación probados; sin `.exe` por decisión documentada |
| TW-06 adaptador AutoCAD + 2D | ✅ contrato / 🔒 AutoCAD real | detección por registro, adaptador COM con guardas por código, matriz por entidad×operación; todo COM `UNVERIFIED` |
| TW-06A geometría 3D | ✅ DXF (mallas) / 🔒 sólidos ACIS | 3DFACE/MESH/POLYFACE con área y volumen verificados analíticamente; 3DSOLID/REGION/SURFACE detectados sin volumen inventado |
| TW-07A piloto 2D | 🔒 protocolo listo | `docs/pilot/PILOTO_2D_TW07A.md`; **no ejecutado** (requiere a Tannia) |
| TW-07B piloto 3D | 🔒 protocolo listo | `docs/pilot/PILOTO_3D_TW07B.md`; **no ejecutado** |
| TW-08 release candidate | ✅ RC técnico | dossier `scripts/release.mjs`, hashes, manual, limitaciones, riesgos, handoff |
| TW-DESIGN (rama feat/tw-design-assistant) | ✅ primera entrega 2D | generador + DXF/SVG + versiones + operaciones + cubicación + conocimiento; DWG real y validación profesional 🔒 |
