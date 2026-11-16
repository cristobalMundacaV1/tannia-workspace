# TW-10 — Matriz de evidencia
Estados: `PASA_LOCAL` (prueba automatizada local) · `PASA_CI` (CI en SHA exacto) · `PENDIENTE` · `EXTERNO` (requiere hardware/persona; no ejecutado).

| Historia | Evidencia | Estado |
|---|---|---|
| 00-01 baseline | `docs/tw10/TW10_MATRIZ_COMPATIBILIDAD.md`; 192 pruebas/175 pasan/0 fallan/17 omitidas reproducidas localmente en `eb76789`; CI verde en base (run 43880085863) | PASA_LOCAL |
| 00-02 regresión | `test/tw10_g0_regresion.test.js` | PASA_LOCAL |
| 00-03 contratos | `src/architect/schemas.js`, `test/tw10_g0_contratos.test.js`, `test/tw10_g0_estado.test.js` | PASA_LOCAL |
| 00-04 ADR | `docs/tw10/TW10_ADR_DEPENDENCIAS.md` | PASA_LOCAL (revisión PO pendiente) |
| 03-01 solar (anticipada) | `test/tw10_g3_solar.test.js` vs `fixtures/tw10/solar_oracle.json` (pvlib/NREL SPA) | PASA_LOCAL |
