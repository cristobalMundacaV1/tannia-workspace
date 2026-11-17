# Diagnóstico, recuperación, actualización y desinstalación — {{VERSION}}

## Diagnóstico
1. Doble clic en `DIAGNOSTICO.cmd` (solo lectura). Abre un informe en el Bloc de notas (`%TEMP%\Diagnostico-Tannia-Workspace.txt`). Revíselo antes de compartirlo: contiene nombres de carpetas de proyectos.
2. En Claude: «Ejecuta el diagnóstico de Tannia Workspace». Debe indicar versión `{{VERSION}}`, carpeta escribible y si hay **ventana de autorización** disponible (`autorizacion_humana.puede_aprobar`).

## Problemas frecuentes
| Mensaje / síntoma | Qué hacer |
|---|---|
| INSTALAR.cmd: «archivo dañado o modificado» (código 2) | Descargue de nuevo el ZIP y extráigalo completo. No instale el archivo dañado. |
| «No se encontró Claude Desktop» (código 3) | Instale Claude Desktop (https://claude.ai/download), inicie sesión y repita. Si ya está instalado en otra ubicación: `INSTALAR.cmd /forzar`. |
| Claude no ve las herramientas | Claude Desktop → Configuración → Extensiones: Tannia Workspace debe estar **activada**. Cierre y abra Claude Desktop. |
| «No hay un canal para que una PERSONA lo autorice» | La ventana de confirmación no apareció. En Windows aparece una ventana propia de Tannia Workspace; si no se ve, revise si quedó detrás de otras ventanas y vuelva a pedir la verificación/aprobación. |
| «El archivo … está abierto o bloqueado por otro programa» | Cierre el archivo en Excel, el visor PDF o AutoCAD y repita. No se entregó nada a medias. |
| «Los datos cambiaron después de la aprobación» | Regenere presupuesto y memoria y pida una nueva aprobación. Es la protección contra entregar archivos viejos. |
| Proyecto de una versión anterior | Se actualiza solo al abrirlo, con respaldo en `.tannia\respaldo-migracion-…`. Las aprobaciones antiguas deben repetirse. Para volver atrás: «Revierte la actualización del proyecto X». |

## Actualizar o reinstalar
Ejecute `INSTALAR.cmd` del ZIP nuevo y pulse *Instalar* en Claude Desktop: reemplaza la extensión. Sus proyectos no se tocan. Si la nueva versión falla, reinstale el ZIP anterior del mismo modo (los proyectos ya migrados pueden revertirse con «Revierte la actualización del proyecto X» antes de volver a la versión antigua).

## Desinstalar
Claude Desktop → Configuración → Extensiones → Tannia Workspace → **Desinstalar**. Esto **no borra** `Documentos\Tannia Workspace` ni sus proyectos. Si además quiere borrar el registro del instalador: `%LOCALAPPDATA%\Tannia Workspace`. Borrar la carpeta de proyectos es decisión suya y no la hace ningún instalador.
