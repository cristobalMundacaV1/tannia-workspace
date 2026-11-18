# Candidato 0.3.0-rc.6 — registro de CI y ZIP

**Estado:** CANDIDATO PARA UAT CONTROLADA. **No** aceptado. G11 (AutoCAD 2027 real) **pendiente de repetir** con este ZIP; G12 profesional pendiente.

| Dato | Valor |
|---|---|
| Versión | `0.3.0-rc.6` (rc.5 retirada: G11 fallido) |
| Commit | `489b34d4a5bbc2445624eb7e4e61b8209d011012` |
| CI | https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/44373442968 (push) y run 44373460962 (pull_request), ambos verdes |
| ZIP | `Tannia-Workspace-0.3.0-rc.6-windows-x64.zip` (artefacto `tannia-workspace-zip-instalacion`) |
| SHA-256 | `037deabceac5a8ff13959e04323857bfe24e6601d4d77be528354b1cca04e5f9` |

Jobs (mismo SHA): test Ubuntu ✔ · test Windows ✔ · gui-windows ✔ · rc-zip ✔ · rc-zip-windows ✔ (pasos 1–11, 5b, 5c, 5d, 5e, incluida la prueba sin Claude).

## Correcciones respecto de rc.5 (derivadas de la UAT real del PO)
1. Handle de DIMSTYLE en código 105 (AutoCAD descartaba el DXF: eHandleInUse) y sin `$MSLTSCALE`.
2. Altura de TEXT en el DXF = altura de mayúsculas (0,716 × cuerpo) y misma línea base que el PDF: cuadros, leyendas y notas ya no se desbordan; gate de paridad espacial DXF↔IR.
3. Escala gráfica con extremos «0» y «x m» rotulados.
4. Causa raíz de la falla intermitente de BG-R01 en Windows: `EPERM` en el rename atómico de un registro leído en paralelo; reintento acotado.

## Para la UAT en AutoCAD 2027
Repetir `documentos/UAT-PLANOS-AUTOCAD-2027.md` (A–H) con este ZIP: apertura sin descarte ni ZOOM, Modelo y presentaciones legibles (EDI-01/02, TW12-01…06), REGENALL, AUDIT, SAVEAS + reapertura, trazado. Informar cualquier mensaje literal del lector.
