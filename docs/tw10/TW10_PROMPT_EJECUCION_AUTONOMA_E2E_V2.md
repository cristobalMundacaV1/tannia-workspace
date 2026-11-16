# PARA PEGAR EN CLAUDE CODE — TW-10 E2E AUTÓNOMA

Asume el rol de **MUNDACA'S SOLUTIONS — TANNIA WORKSPACE PRODUCT ENGINEERING LEAD IMPLEMENTER**. El Product Owner **autoriza ejecutar la macrofase TW-10 COMPLETA, no únicamente G0/G1**.

**Repositorio:** `cristobalMundacaV1/tannia-workspace`.

## Fuentes obligatorias

Lee íntegros los tres documentos base del expediente TW-10 (investigación, contrato y roadmap) y el documento adjunto `TW10_DIRECTIVA_EJECUCION_AUTONOMA_DE_EXTREMO_A_EXTREMO_V2.md`. Si no están dentro del repositorio, cópialos desde las rutas efectivamente disponibles y agrégalos en una ruta documental apropiada de tu nueva rama. No los inventes ni presumas que ya fueron publicados. Si el usuario te ha proporcionado los documentos, NO pidas de nuevo el alcance.

La **directiva v2 prevalece para el MODO DE EJECUCIÓN Y CRITERIOS DE CIERRE**; los documentos v1 siguen siendo la fuente del alcance arquitectónico, schemas, historias y gates. Conserva las 45 historias G0–G10.

## Orden de operación

1. Comprueba rama, PR #11, commits, `AGENTS.md`, `CLAUDE.md`, documentación de continuidad y CI. El baseline revisado al 16-11-2026 era `eb767891fe2dacbb4d3070653b1353ebde245243`; verifica que sigue siendo apropiado.
2. Trabaja en un **worktree independiente** con rama nueva `feat/tw10-architectural-reasoning` apilada sobre el SHA TW-09 verificado. No cambies `main`, PR #2/#7/#11 ni ramas ajenas. Publica solo en PR draft nuevo, sin merge/release/deploy.
3. Implementa desde G0 hasta G9 y las partes automatizables de G10, **sin finalizar tu misión ni pedir mi permiso al aprobar un gate**. Tras cada historia/gate, registra pruebas y SHA, realiza commit/push, actualiza PR draft y guarda estado/handoff, y sigue inmediatamente con la siguiente.
4. Si una prueba falla, investiga la causa, reproduce en rojo, corrige y ejecuta tests reales (incluido CI Windows/Ubuntu). No maquilles los tests ni declares verde por un SHA distinto.
5. Mantén trazabilidad en `docs/agent-continuity/TW10_STATE.json` + `TW10_HANDOFF.md`. Son persistencia entre sesiones, no certificados. Al cambiar de sesión, lee ambos y continúa en la historia concreta pendiente. Un contexto agotado no concluye el roadmap.
6. Entrega un sistema **real**: brief/terreno/clima con procedencia; partidos distintos incluidas L y patio sin losas falsas; sol y sombra con oráculo; recorridos, privacidad, vistas/piscina, riesgos y costo relativo; evaluación crítica/Pareto/bitácora; conversación MCP; versiones y DWG 2D/3D; paquete de prueba funcional.
7. Conserva todas las herramientas y los proyectos de TW-09. No alteres originales, no cambies DWG abiertos con modificaciones, no fuerces permisos ni uses atajos destructivos.
8. Ejecuta los 15 escenarios de aceptación previstos, matrices QA, pruebas de regresión, Windows, Ubuntu y bundle `.mcpb` desempaquetado. Cada decisión debe tener evidencia y estado epistemológico correcto. Nada de cumplir normativa, CFD, Radiance o aptitud para construcción sin prueba/autoridad.
9. Cuando hayas concluido todo lo automatizable, prepara piloto en AutoCAD 2027 real con Tannia y revisión de arquitecta/o independiente. **No inventes esas evidencias**. Si ese equipo o esa persona no están disponibles, declara `CANDIDATO_TECNICO_COMPLETO` y `ESPERA_EXTERNA`, entrega protocolo exacto y conserva TW-10 ABIERTA en draft. El PO decide aceptación, merges y release.

## Definición de terminado

**NO es terminado:** un plan, un prompt, G0/G1, documentación, un SVG ilustrativo, CI parcial, 3 alternativas espejadas, un JSON de 3D sin DWG, la palabra «coherente» sin facetas, un plugin no probado o una casa estructuralmente «aprobada» por IA.

**Sí es candidato técnico:** G0–G9 completos, la parte automatizable de G10, tests/CI y artefactos reales del SHA final, benchmark Casa Los Robles y reporte completo de límites.

**Solo es final:** G10 hardware + revisión independiente + aprobación PO. El mismo implementador no puede elevarlo unilateralmente a final.

### Primera acción en ESTA sesión

Verifica repositorio/stack; lee contrato y directiva; crea la rama y el worktree autorizados; crea estado/handoff y tests de la plantilla fija; implementa G0/G1 **y continúa con G2, G3, G4… hasta G9 sin esperar respuesta**. Reporta avances solo como checkpoints, no como terminación. Ante bloqueo externo documenta y sigue todo trabajo independiente.

**Este mandato sustituye la instrucción antigua «empieza por G0/G1». El alcance aprobado abarca la macrofase TW-10 íntegra.**
