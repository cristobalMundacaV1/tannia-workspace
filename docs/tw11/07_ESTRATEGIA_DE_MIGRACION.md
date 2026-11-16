# TW-11 · 07 — Estrategia de migración compatible con TW-00 → TW-10
**Patrón:** *strangler*. El CIC se añade **junto** al código existente; nada se reescribe antes de tener pruebas de equivalencia.
## Invariantes (rompen el gate si fallan)
1. Las **72 herramientas actuales** conservan nombre, esquema de entrada y semántica (test de contrato congelado: snapshot de `tools/list`). Las nuevas (`tannia_cic_*`) son aditivas.
2. **Identidad del paquete** y mecanismo de instalación/desinstalación (`.mcpb`, manifest, `identidadPaquete()`): sin cambios de id; versión del paquete sube, nunca el id (política TW-09).
3. Ningún cambio en `main`, PR #11/TW-09, PR #2/#7 ni ramas ajenas; TW-11 se apila sobre `feat/tw10-architectural-reasoning` y, si TW-10 cambia por revisión, se rebasa/mezcla sin forzar.
4. Originales protegidos, sandbox y transacciones: **intactos** (sus pruebas son prerrequisito de cada gate).
5. TW-10 mantiene sus validaciones de campo pendientes; TW-11 no las marca ni las sustituye.
6. Proyectos reales de la PO («Prueba TW10 Los Robles» v002, «rc2») no se leen ni escriben en pruebas.
## Etapas
| Etapa | Cambio | Compatibilidad |
|---|---|---|
| M0 | Congelar `tools/list` + esquemas (snapshot) y suite actual como línea base (SHA identificado) | solo pruebas |
| M1 | `src/cic/` nuevo (contratos, registro, claims) sin tocar rutas existentes | aditivo |
| M2 | `CapabilityRegistry` envuelve los 72 tools **leyendo** su definición (no la modifica) + manifiesto `capabilities.manifest.json` con nivel N0/N1/N2 y evidencia (reusa `cad/capabilities.js`) | lectura |
| M3 | Enrutador: `politica/autonomia.js` conserva su salida actual; se añade *adaptador* que consulta el registro. La decisión nueva solo se usa si la antigua devuelve `no_soportado` o por flag de prueba; test de equivalencia sobre el corpus histórico (≥ 200 frases de TW-09/10) | retrocompatible |
| M4 | `vivienda` y `arquitectura_razonada` pasan a ser **especializaciones** que apuntan a los mismos módulos; sin mover código | declarativo |
| M5 | `quantities` se extiende (reglas nuevas) preservando las 9 actuales y su salida | aditivo |
| M6 | Memoria: `03 Trabajo/Ingenieria/` nueva; `Arquitectura/` sin tocar | aditivo |
| M7 | Instrucciones del servidor: una regla nueva (CIC) sin reescribir las previas; verificar que el tamaño de instrucciones no degrade (límite de tokens medido) | aditivo |
## Riesgos de migración
Crecimiento de `tools/list` (72→81): medir impacto en contexto de Claude; si es alto, agrupar y ocultar herramientas bajo `tannia_cic_catalogo` (ADR). Tamaño del bundle: presupuesto ≤ +30 % sobre rc3 (medido en G0). Dependencias nuevas: **ninguna nativa**; solo JS puro auditada (ADR por cada una).
## Retrocesión
Cada etapa va tras un flag `TANNIA_CIC=off|on` (por defecto **off** hasta G7). Desactivar el flag devuelve exactamente el comportamiento rc3 (test).
