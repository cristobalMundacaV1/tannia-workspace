# TW-10 — Handoff para reanudar (leer primero)

**Rama:** `feat/tw10-architectural-reasoning` (worktree independiente), apilada sobre `feat/tw09-autonomia` @ `eb76789` (PR #11, draft, CI Windows+Ubuntu verde sobre ese SHA, run 43880085863).
**No hacer:** merge, release, despliegue, tocar `main`/PR #2/#7/#11, declarar AutoCAD real / Claude Desktop real / revisión profesional sin ejecución. El agente NO puede fijar `ACEPTADO_POR_PO`.

## Cómo reanudar
1. `git status`, `git branch --show-current`, `git rev-parse HEAD`; leer `docs/agent-continuity/TW10_STATE.json` (fuente de verdad del avance) y `docs/tw10/*`.
2. `npm ci && npm test` (línea base TW-09: 192 pruebas, 175 pasan, 0 fallan, 17 omitidas = PowerShell real en CI Windows).
3. Continuar en `current_gate` / `current_story` del estado. Ciclo: prueba roja → implementación mínima → pruebas enfocadas + completas → CI en el SHA exacto → commit/push → actualizar estado y matriz.
4. Máximo 3 intentos correctivos por causa; luego `BLOQUEADA_TECNICA` documentada y continuar con lo independiente.

## Estado actual (ver TW10_STATE.json)
`ESPERA_EXTERNA`: G0–G9 superadas en lo automatizable; G10 requiere AutoCAD 2027 real, taller con Tannia y revisión independiente, y decisión del PO. **No hay nada más que el agente pueda hacer sin esos externos**, salvo: corregir defectos que reporten, completar los parciales declarados (generador de patio central; consultas Open-Meteo si el PO las autoriza) o reaccionar a revisión del PR #12.

## Mapa del código nuevo (`src/architect/`)
`schemas.js` contratos Zod · `solar.js` posición solar + IANA · `clima.js` EPW/ERA5-caché/rosa · `sitio.js` predio/norte/fuentes · `briefing.js` encargo→brief · `poligonos.js`, `derivar_poly.js`, `a3d.js`, `convertir.js` geometría de scheme/2 y puente 3D · `partidos.js`, `alternativas.js`, `diversidad.js` generación y diversidad · `sombras.js` ray casting · `habitabilidad.js` recorridos/visuales/seguridad/privacidad/constructibilidad · `evaluacion.js` evaluador, Pareto, crítica, ledger · `reporte.js` SVG · `servicio.js` estudios versionados · herramientas en `src/tools/arquitectura.js` (11 `tannia_arq_*`).
Oráculos de desarrollo (no se empaquetan): pvlib `spa_python` → `fixtures/tw10/solar_oracle.json`.
Convención de signos: `true_north_deg_from_local_plus_y_clockwise` = n ⇒ rumbo local = n + rumbo geográfico (corregido en G3; ver historial de commits).

## Auditoría de campo G10 (F01–F05)
Corregida en el código (`6211397`); matriz en `docs/tw10/TW10_FIELD_FINDINGS_F01_F05.md`. Fixtures: `test/fixtures_tw10/`. Pruebas: `test/tw10_f_campo_brief.test.js`, `test/tw10_f_campo_respuestas.test.js`. Candidato rc2 (supera al rc1): `TW10_CANDIDATE.md`. El estudio v002 de «Prueba TW10 Los Robles» es evidencia histórica: no tocar.

## Entrega para el PO y la revisión independiente
`docs/tw10/entrega/` (fuentes del ZIP), `TW10_CANDIDATE.md` (hashes), `TW10_AUDIT_TRANSFER.md`. Reconstruir el ZIP: `npm run build`, `node scripts/paquete-prueba.mjs --fase tw10 …`, copiar el `.mcpb` junto a los documentos de `docs/tw10/entrega/` y recalcular `SHA256SUMS.txt`. Si el hash del `.mcpb` difiere del registrado, **no** presentarlo como idéntico: documentar la diferencia.

## Reanudar tras interrupción
1. `git status`; `git log -3`; leer `TW10_STATE.json`. 2. `npm ci && npm test`. 3. Si cambió el código: regenerar ejemplos (`node scripts/ejemplos-tw10.mjs`), `npm run build`, y el paquete: `node scripts/paquete-prueba.mjs --fase tw10 --etiqueta <sha7> --revision rcN --id tannia-workspace-tw10 --nombre "Tannia Workspace - PRUEBA TW-10 (<sha7>)" --esperadas 72`.
