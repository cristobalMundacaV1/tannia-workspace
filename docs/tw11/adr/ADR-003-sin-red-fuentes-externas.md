# ADR-003 — El servidor no tiene red; fuentes externas por candidatura y aprobación humana
**Estado:** adoptada (G3) y **revisada por el hallazgo P1 de seguridad** (`HARDENING.md`, «P1 consentimiento»).
El servidor MCP no accede a Internet. La investigación externa la hace Claude con herramientas que la usuaria autorizó en Claude Desktop; lo hallado entra como **fuente candidata** (extracto + URL + fecha) y solo una **persona** la aprueba. Estados separados: registrada ≠ aprobada ≠ contenido disponible ≠ extracto comprobado ≠ cita verificable.
## Límite de confianza (revisión)
El diseño original guardaba un código de aprobación en una ruta **dentro del proyecto**; como `tannia_cic_conocimiento` indexa texto del proyecto, el agente podía leerlo (reproducido: recuperó el código con `registrar_archivo` + `buscar`). **Principio nuevo:** ningún secreto de autorización existe en rutas legibles o escribibles por herramientas del modelo. Canales, por prioridad:
1. **Confirmación del cliente MCP** (elicitación): la respuesta viaja cliente→servidor sin pasar por el modelo.
2. **Diálogo nativo del sistema operativo** lanzado por el servidor (Windows: WPF `MessageBox`; macOS: `osascript`; Linux: `zenity`). El texto viaja por variable de entorno, nunca en el script; un fallo o el tiempo agotado jamás aprueba; no se abre en CI.
3. **Archivo creado por la persona en `<carpeta de Tannia>/.tannia-config/aprobaciones/`**, fuera de `Proyectos/`: las herramientas MCP solo resuelven rutas dentro de un proyecto y la importación rechaza ese origen. No contiene ni requiere secretos: es posesión de acceso al sistema de archivos fuera de las herramientas del modelo; solo vale si fue creado **después** de la solicitud, contiene exactamente `APRUEBO <id>`, corresponde a una solicitud registrada por el servidor y se **consume** (uso único).
Un «No» explícito (cliente o diálogo, o aceptar la ventana sin marcar «aprobar») prevalece sobre cualquier otro canal. Ningún parámetro o booleano que envíe Claude puede aprobar.
## Limitaciones declaradas
- El canal 3 puede falsificarse si el agente dispone de **otra** herramienta con escritura en la carpeta del usuario (p. ej. un servidor de archivos): por eso los canales 1 y 2 tienen prioridad y el 3 es último recurso (`TANNIA_SIN_DIALOGO=1` desactiva el 2).
- El diálogo del SO no se ha probado en una sesión real de Windows/macOS (N0 de hardware): protocolo en `entrega/PROTOCOLO_CLAUDE_DESKTOP.md`.
- El servidor no verifica que la web diga lo declarado ni impide que Claude envíe datos a una búsqueda externa.
