# Reemplazar el instalador TW-09 H4/H5 sin tocar la carpeta de proyectos

**Estado: NO VERIFICADO en Claude Desktop real.** Tus proyectos están en `Documentos\Tannia Workspace\Proyectos\…`; desinstalar/instalar una extensión **no los toca** (probado en TW-05 con el servidor; en Claude Desktop real, a comprobar).

1. **No abras ni modifiques** esa carpeta. (Opcional: copia de seguridad de solo lectura con el Explorador: copiar `Documentos\Tannia Workspace` a otra ubicación.)
2. Verifica el instalador: `Get-FileHash .\tannia-workspace-tw09-fc48937-r2.mcpb -Algorithm SHA256` debe coincidir con el `.sha256`.
3. Claude Desktop → Configuración → Extensiones: **quita** «Tannia Workspace — PRUEBA TW-09 H4/H5 (fc48937)» (y cualquier otro paquete Tannia de prueba anterior). No marques borrar datos.
4. **Cierra Claude Desktop por completo** (también en la bandeja del sistema) y ábrelo.
5. Arrastra el nuevo `.mcpb`. Debe decir **«Tannia Workspace - TW09 H4-H5 (fc48937)»**, versión `0.1.0-tw09.fc48937.r2`. En «Carpeta de Tannia Workspace» deja la sugerida (la misma de antes). Actívala y reinicia Claude Desktop.
6. **Comprueba el registro** (PowerShell): `Select-String -Path "$env:APPDATA\Claude\logs\main.log" -Pattern "path escape|Could not launch|Tannia" | Select-Object -Last 15`
   - Esperado: **ninguna** línea `path escape` posterior a la instalación; sí la conexión del servidor y el anuncio de **61 herramientas**.
7. En una conversación nueva: «Haz un diagnóstico de Tannia Workspace» → «Todo en orden». Luego «Resume mi proyecto Casa Los Robles» (o el que tengas) debe encontrarlo sin recrearlo.
8. Envíame: captura de Extensiones, las líneas del paso 6 (`main.log`) y el resultado del paso 7. Si vuelve a aparecer `path escape`, pega la línea exacta.

Continuar con la prueba real: `PRUEBA_REAL_TW09_MENSAJE.txt` del instalador anterior sigue vigente.
