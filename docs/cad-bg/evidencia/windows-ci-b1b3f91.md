# Evidencia Windows CI sobre `b1b3f9145f0232d10ba3b32f520a177ecb325576` (run 44302989030, 2026-11-18)

Conservada antes de los cambios de la revisión BG-R01…R03. Es Windows de CI (`windows-latest`), **no** el PC de Tannia ni AutoCAD.

## rc-zip-windows (job 134797429108) — ZIP descargado con la misma huella
```
8441c1a2a4970098e9b53cb9a322e6d06072da5c542fc24cbe4bf8b63c77840b  Tannia-Workspace-0.3.0-rc.2-windows-x64.zip
OK   1. huella del ZIP
OK   2. extracción en ruta con espacios y ñ
OK   3. SHA256SUMS de cada archivo y manifiesto de la entrega
OK   4. instalación en perfil limpio (extensión extraída como la instala Claude Desktop)
OK   5. registro y conexión MCP (initialize, herramientas, procedimientos, diagnóstico)
OK   5b. motor de planos del paquete: tannia_planos expuesto y 5 láminas del túnel generadas (DXF AC1024 + PDF)
OK   5c. trabajo en segundo plano desde el paquete instalado (planos + cubicaciones sin bloquear el servidor; prioridad baja)
OK   6 … 11 (flujo profesional, entregables, cambio, interrupción, actualización, desinstalación)
OK   INSTALAR.cmd / DIAGNOSTICO.cmd (5/5)
```

## gui-windows (job 134797204496) — CAD-BG-02 con el Bloc de notas como ventana de trabajo
Trabajo «expediente» en segundo plano: planos, cubicaciones, presupuesto y memoria `hecho`; DWG `requiere_intervencion` (sin AutoCAD).
Recursos del proceso de fondo: CPU usuario 5218 ms, sistema 1046 ms, memoria máx. 287 MB, prioridad 10 (= BELOW_NORMAL), duración 6,7 s, equipo 4 CPU / 16 GB.
```
OK: sin cambio de foco, sin ventanas nuevas, cursor intacto, teclado y respuesta del Bloc de notas normales.
```
Alcance: Bloc de notas en CI ≠ Word/Excel + AutoCAD 2027 en el PC de Tannia (CAD-BG-02/03/04 reales: NO EJECUTADO).
