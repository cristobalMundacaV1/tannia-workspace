# TW-10 — Handoff para reanudar (leer primero)

**Rama:** `feat/tw10-architectural-reasoning` (worktree independiente), apilada sobre `feat/tw09-autonomia` @ `eb76789` (PR #11, draft, CI Windows+Ubuntu verde sobre ese SHA, run 43880085863).
**No hacer:** merge, release, despliegue, tocar `main`/PR #2/#7/#11, declarar AutoCAD real / Claude Desktop real / revisión profesional sin ejecución. El agente NO puede fijar `ACEPTADO_POR_PO`.

## Cómo reanudar
1. `git status`, `git branch --show-current`, `git rev-parse HEAD`; leer `docs/agent-continuity/TW10_STATE.json` (fuente de verdad del avance) y `docs/tw10/*`.
2. `npm ci && npm test` (línea base TW-09: 192 pruebas, 175 pasan, 0 fallan, 17 omitidas = PowerShell real en CI Windows).
3. Continuar en `current_gate` / `current_story` del estado. Ciclo: prueba roja → implementación mínima → pruebas enfocadas + completas → CI en el SHA exacto → commit/push → actualizar estado y matriz.
4. Máximo 3 intentos correctivos por causa; luego `BLOQUEADA_TECNICA` documentada y continuar con lo independiente.

## Mapa del código nuevo
`src/architect/` (módulos de dominio deterministas): `schemas.js` (contratos Zod), `solar.js` (posición solar + IANA), … ver `TW10_EVIDENCE_MATRIX.md`.
Oráculos de desarrollo (no se empaquetan): pvlib `spa_python` → `fixtures/tw10/solar_oracle.json`.

## Estado de campo (siempre pendiente hasta ejecución real)
AutoCAD 2027 real · Claude Desktop real · revisión arquitectónica independiente · aprobación del PO. Protocolo: `docs/tw10/TW10_FIELD_VALIDATION.md` (G10).
