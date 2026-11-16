# TW-09 — Informe de regresión

Base `16a7bd7` (`feat/tw-modelo-3d`) → rama `feat/tw09-autonomia`.
- Suite local (tras la auditoría del PR #11): **176 pruebas, 159 pasan, 0 fallan, 17 omitidas** (antes de la auditoría: 156 / 140 / 0 / 16) (las de PowerShell real, solo Windows). El CI de Windows las ejecuta.
- Pruebas nuevas: `tw17` persistencia global/ciclo COM (4), `tw18` coherencia por facetas (4), `tw19` semántica de vanos (4), `tw20` proyectos (6), `tw21` versiones transaccionales (5), `tw22` política y encargos (4), `tw23` seguridad (4), `tw24` flujo del encargo (1); auditoría PR #11: `tw25` identidad documental (4), `tw26` concurrencia con procesos reales (9), `tw27` destino de importación (6) y 1 prueba PowerShell nueva en `tw09`.
- Pruebas existentes ajustadas por cambios de contrato intencionales (no por ocultar fallos): conteo de enumeraciones (ahora antes y después de reabrir), estado de coherencia (`coherente_en_alcance`), contrato COM de scripts (SendCommand/Close/Delete solo en los scripts 3D que lo requieren), mensaje de originales vacíos.
- Sin regresiones en herramientas 2D/CAD/originales: las suites `tw01`–`tw16` pasan sin cambios de expectativa funcional.
- CI Windows/Ubuntu: ver el SHA del paquete en `ORIGEN.json` del instalador.
- Límite: el CI no ejecuta AutoCAD ni Claude Desktop.

- Cambios de contrato por la auditoría (intencionales): las lecturas confirman la ruta del documento; la reapertura de otro documento falla con `DOCUMENTO_REABIERTO_DISTINTO`; con ruta esperada ausente, el error es `DOCUMENTO_NO_ABIERTO` (antes `DOCUMENTO_CAMBIO` en el caso de `agregarLineas`); un journal sin ids de historial exige reconciliar (`VERSION_PENDIENTE_RECONCILIAR`).
