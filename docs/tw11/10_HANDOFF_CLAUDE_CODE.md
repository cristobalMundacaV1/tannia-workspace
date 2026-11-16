# TW-11 · 10 — Handoff para Claude Code (implementación)
> **Estado de autorización:** la implementación integral **no está autorizada** hasta que la PO revise esta versión (R1). Este handoff es el contrato para cuando se autorice.
> **Casos retenidos:** Claude Code **no** conoce ni debe solicitar los casos de evaluación independiente; solo usa `test/tw11/dev/`.
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
- Interpretación: Claude propone `interpretation/1`; el servidor valida (doc 02 §0.1). Prohibido introducir un clasificador léxico como puerta de acceso.
- Conocimiento externo: solo por el flujo `candidate→registered` con confirmación humana (doc 03 §3c).
- Un PR en borrador por agrupación (doc 08); commit/etiqueta y evidencia por gate.
- Respuestas MCP: resumen compacto + secciones (≤ 6 000 caracteres; lección F01); esquemas planos.
## Orden de trabajo inmediato (PR-1 = G0+G1+G2; luego PR-2…PR-6 según doc 08)
1. TW11-01…04 (incluye medición de línea base de herramientas). 2. Motor de unidades + operaciones con oráculos (doc 04 §2b). 3. `tannia_cic_calcular/catalogo`. 4. Claims + verificador de **roles numéricos**. 5. Demostración **de contratos** (no de proyecto). La demostración vertical de túnel es **GV1**, después de G3–G5.
## Definición de terminado por historia
Código + pruebas (positivas, negativas, adversariales) + doc + ejemplos + fila en la matriz con nivel N y SHA + lista de no validado.
## Entrega a la PO por gate
Resumen corto: qué se hizo, qué pruebas, SHA/CI, hashes del paquete (cuando aplique), pendientes externos y bloqueos.
## Pendientes externos heredados de TW-10 (no los resuelve TW-11)
G10 en Claude Desktop con rc3, AutoCAD 2027 real, taller con Tannia y arquitecta independiente, revisión independiente y decisión del PO.

## Actualización — hardening y comunicación (PR de hardening sobre #18)
- Ver `docs/tw11/HARDENING.md`: H1–H5 reproducidos, corregidos y probados; contrato de comunicación (`tannia_comunicacion`, nivel por defecto breve, precedencia, advertencias en el texto).
- Semántica vigente de `tannia_cic_encargo`: `actualizar` (por defecto) conserva todo; `reemplazar` explícito; `needs_confirmation` + `confirmar_cambios` nombrados; `retirar` explícito.
- `permitir_desactualizado` ya no existe; el borrador desactualizado exige consentimiento humano (`src/cic/consentimiento.js`).
- Los gates G10–G12 siguen **pendientes** (revisor independiente, casos retenidos, decisión de la PO). Pruebas reales pendientes: Claude Desktop (protocolos de entrega A–D y de comunicación C1–C15) y AutoCAD.
