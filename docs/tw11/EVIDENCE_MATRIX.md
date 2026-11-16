# TW-11 — Matriz de evidencia
Niveles de evidencia de capacidad: **N0** documentado · **N1** implementado y probado con simuladores/fixtures/oráculos (CI) · **N2** validado en herramienta real por la PO · **N3** revisado por profesional competente. Madurez de operación: E0–E3. **Nada aquí es N2/N3.**

| Gate | Estado | SHA de código | Pruebas (local) | CI Windows+Ubuntu | Evidencia | Limitaciones / pendiente |
|---|---|---|---|---|---|---|
| G0 Baseline y contratos | técnicamente superado (N1) | `5982018` | `tw11_g0_contratos` 4/4 | ✅ run 43945926639 | snapshot `fixtures/tw11/tools_baseline.json` (72 herramientas, 79 386 B, ≈19 757 tokens); flag `TANNIA_CIC` apagado = 72 idénticas; contratos Zod | Línea base para D7 medida; umbral lo fija el PO |
| G1 Unidades y operaciones | técnicamente superado (N1) | `5982018` | `tw11_g1_units_ops` 12/12 | ✅ | 10 operaciones; oráculos analíticos, malla+divergencia (convergencia O(1/n²)), property tests (unidad/traslación/rotación), mutación del oráculo; P01 respetada | Operaciones E2 = verificadas contra oráculos del repositorio; **sin revisión profesional (E3)**; `edu.*` es E1 |
| G2 Claims y roles numéricos | técnicamente superado (N1) | `5982018` | `tw11_g2_claims` 4/4 | ✅ | ledger reproducible (ids deterministas), T10, T10b (0 falsos bloqueos), flujo MCP con versiones inmutables | Heurística de «cifra con unidad en texto libre» puede tener falsos negativos (declarado) |
| G3 Conocimiento | implementado, pendiente de CI | — | — | — | — | — |
| G4 Interpretación y plan | implementado, pendiente de CI | — | — | — | — | — |
| G5 / GV1 / G6 / G7 / G8 / G9 / G10 | pendiente | — | — | — | — | — |

**Pendientes humanos (no aprobados):** AutoCAD real · Claude Desktop real · evaluación retenida independiente (G10) · revisión profesional por especialidad · taller con Tannia · decisión de aceptación del PO · merge y distribución.
