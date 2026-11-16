# Reinstalación y continuación de la prueba 3D (paquete `0.1.0-modelo3d.e9084a0`)

**Causa del bloqueo anterior:** `tannia_3d_crear` y `tannia_3d_solido_transformar` declaraban coordenadas como *tuplas* (`z.tuple`), que se publican como `items: [{number},{number}]`; Claude Desktop/la API exige `items` como objeto y excluyó ambas herramientas. Ahora son arreglos de exactamente 2 números. Corregido y con prueba que reproduce el error con el esquema antiguo.
**Estado:** corregido y probado automáticamente. **NO VERIFICADO en Claude Desktop ni AutoCAD real** hasta que lo instales.

## Reinstalar
1. Verifica el SHA-256 del `.mcpb` (`Get-FileHash .\tannia-workspace-modelo3d-e9084a0.mcpb -Algorithm SHA256`).
2. Claude Desktop → Configuración → Extensiones: **quita o desactiva** el paquete `modelo3d.daf2276` (mismo nombre interno) y los demás Tannia. Instala este `.mcpb`; debe decir «PRUEBA modelo 3D (e9084a0)».
3. Cierra Claude Desktop por completo y ábrelo de nuevo (recarga las herramientas).
4. Verificación: «Haz un diagnóstico de Tannia Workspace» y «¿Tienes tannia_3d_crear y tannia_3d_solido_transformar?». Si Claude Desktop vuelve a mostrar un error de esquema, pégalo tal cual.
5. Tu proyecto `Prueba 3D` y el anteproyecto `Casa 3D 80` v001 **se conservan** (comparten la carpeta de datos); no se repiten los pasos 1 y 2.

## Continuar desde el paso 3
Pega `REINSTALACION_MODELO_3D_MENSAJE.txt`. Al terminar, confirma a ojo en AutoCAD: capas `TW3D_*`, sólidos 3D reales, vanos abiertos, vista isométrica, cubierta oculta/visible y `AUDIT`.
