---
name: tw-qa-independiente
description: Guía del revisor independiente: verificar un SHA, ejecutar suites y gates, y reportar sin aprobar el propio cambio.
---

# tw-qa-independiente

> Skill de DESARROLLO (no se distribuye a la usuaria). Generado por scripts/gen-skills.mjs.

1. Registre SHA, árbol, lockfile, Node/OS y perfil de flags (BASE/CIC/ENGINEERING).
2. Ejecute `npm ci`, `npm test` y `npm run rc:zip`; adjunte TAP y hashes.
3. Ejecute las pruebas adversariales de autoridad (test/rc_autoridad_entrega.test.js) y fidelidad (test/rc_fidelidad_contrato.test.js).
4. Gates N2/N3 (AutoCAD, Claude Desktop, revisión profesional) solo se marcan con evidencia real: operador, build, fecha y archivos.
5. Prohibido: filtrar corpus retenido al implementador, marcar N2 por un mock, subir planos privados al repositorio, aprobar el propio cambio.
