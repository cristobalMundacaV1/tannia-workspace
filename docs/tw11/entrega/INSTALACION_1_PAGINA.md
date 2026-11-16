# Tannia Workspace TW-11 — Instalación (1 página)
**Es un candidato de PRUEBA para ingeniería asistida. No está validado en AutoCAD real, ni en Claude Desktop real, ni por un profesional.**
Hay dos paquetes: **no instale ambos a la vez**.
| Paquete | Qué es | Cuándo usarlo |
|---|---|---|
| `tannia-workspace-tw11-<sha>-cicoff.mcpb` | Igual que rc3: **72 herramientas**, el motor nuevo está APAGADO | Compatibilidad / volver atrás |
| `tannia-workspace-tw11-<sha>-cicon.mcpb` | 72 + herramientas `tannia_cic_*` (motor de ingeniería ACTIVADO solo en este paquete) | Pruebas controladas del CIC |
## Pasos
1. Cierre Claude Desktop por completo.
2. Haga doble clic en el `.mcpb` elegido (o Configuración → Extensiones → Instalar extensión).
3. Elija la carpeta de Tannia Workspace (la misma de siempre; sus proyectos no se tocan).
4. Abra un chat nuevo y escriba: «Ejecuta el diagnóstico de Tannia Workspace». Debe mostrar la versión del **paquete** y, en el paquete CIC, el catálogo (`tannia_cic_catalogo`).
5. Para volver atrás: Configuración → Extensiones → Desactivar/Desinstalar. Sus archivos quedan intactos.
## Qué NO hace
No dimensiona sostenimiento, estructuras ni hidráulica de diseño; no verifica normativa; no inventa precios ni datos. Todo lo que no puede calcular aparece como **brecha** con quién debe validarlo.
## Si algo falla
Ejecute el diagnóstico y envíelo con el mensaje exacto. No reintente repetidamente una escritura que falló.
