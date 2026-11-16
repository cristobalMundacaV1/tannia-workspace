# TW-11 · 10 — Handoff para Claude Code (implementación)
## Antes de empezar
1. Leer `CLAUDE.md`, `AGENTS.md`, `docs/tw10/` (estado, límites), `docs/agent-continuity/TW10_HANDOFF.md`, y los docs 01–09 de este directorio.
2. Verificar: SHA de `feat/tw10-architectural-reasoning`, estado del PR #12 (borrador), PR #11/#2/#7 sin modificar. Rama de trabajo: `feat/tw11-g0-…` desde la rama de TW-10 (o su sucesora tras revisión), PR **borrador** apilado por gate.
3. Crear `docs/tw11/TW11_STATE.json` desde la plantilla y `EVIDENCE_MATRIX.md`.
## Reglas de ejecución
- Avanzar gate a gate (doc 08). No saltar. No ampliar el motor antes de G0–G2.
- Ningún cambio a las 72 herramientas; flag `TANNIA_CIC` por defecto `off` hasta G7.
- **Antes de cada commit:** ejecutar `npm test` y comprobar el código de salida **explícitamente** (no encadenar con `;` ni `&&` con `grep`). Lección de TW-10.
- Pruebas con SHA identificado; CI Windows+Ubuntu; sin saltar/silenciar pruebas.
- No tocar proyectos reales de la PO. No `git reset --hard`, no `clean -fd`, no `rm -rf` con comodines, no `--dangerously-skip-permissions`.
- No fusionar, no publicar releases, no autoaprobarse; no marcar `ACEPTADO_POR_PO`.
- No inventar valores normativos, precios ni parámetros; nada de red en el servidor.
- Respuestas MCP: resumen compacto + secciones (≤ 6 000 caracteres; lección F01); esquemas planos.
## Orden de trabajo inmediato (primer PR = G0+G1+G2)
1. TW11-01…04. 2. Motor de unidades + 5 operaciones con oráculos. 3. `tannia_cic_calcular/catalogo`. 4. Claims + verificador. 5. Demostración vertical: un encargo mínimo de túnel donde el sistema calcula áreas/volúmenes con claims y declara el gap de sostenimiento.
## Definición de terminado por historia
Código + pruebas (positivas, negativas, adversariales) + doc + ejemplos + fila en la matriz con nivel N y SHA + lista de no validado.
## Entrega a la PO por gate
Resumen corto: qué se hizo, qué pruebas, SHA/CI, hashes del paquete (cuando aplique), pendientes externos y bloqueos.
## Pendientes externos heredados de TW-10 (no los resuelve TW-11)
G10 en Claude Desktop con rc3, AutoCAD 2027 real, taller con Tannia y arquitecta independiente, revisión independiente y decisión del PO.
