# Instalar Tannia Workspace TW-10 (candidato de prueba) en Claude Desktop para Windows

Archivo: `tannia-workspace-tw10-151c0a1-rc1.mcpb`. Es un **candidato de prueba**, no un release. No hace falta consola.

1. **Descargue y extraiga el ZIP** en cualquier carpeta (puede tener espacios o tildes). Compruebe el hash si quiere: en PowerShell, `Get-FileHash .\tannia-workspace-tw10-151c0a1-rc1.mcpb -Algorithm SHA256` debe coincidir con `SHA256SUMS.txt`.
2. **Deshabilite temporalmente TW-09** (sin desinstalarlo ni borrar datos): Claude Desktop → *Configuración → Extensiones* → «Tannia Workspace …(TW-09…)» → interruptor en *Desactivado*. Así no se duplican las herramientas. **Sus proyectos y carpetas NO se tocan.**
3. **Instale TW-10:** doble clic en el `.mcpb` (o arrástrelo a *Configuración → Extensiones*) → *Instalar*. Se llama «Tannia Workspace - PRUEBA TW-10 (151c0a1)» (id `tannia-workspace-tw10`, distinto de TW-09).
4. **Carpeta de trabajo:** deje la sugerida (`Documentos\Tannia Workspace`) para que vea sus proyectos anteriores, o elija una carpeta de **pruebas nueva** si prefiere aislar todo. Active la extensión y reinicie Claude Desktop si lo pide.
5. **Compruebe:** abra una conversación nueva y escriba «Haz el diagnóstico de Tannia Workspace». Debe responder sin errores y mostrar la carpeta. En *Configuración → Extensiones → TW-10* deben verse 72 herramientas (61 anteriores + 11 `tannia_arq_*`). **Si alguna aparece «excluida por esquema inválido», copie el mensaje exacto** y envíelo al revisor.

**Volver atrás:** desactive TW-10 y reactive TW-09. Nada de lo anterior se borra. Los archivos de TW-10 quedan en `<carpeta>\Proyectos\<proyecto>\03 Trabajo\Arquitectura`.
**AutoCAD** solo se necesita para guardar DWG; el diseño funciona sin él.
