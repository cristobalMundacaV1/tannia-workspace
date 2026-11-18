# Consolidación de Astra — en curso

Base comprobada: PR #36, `eca3b6037c15d06c5993e92c4b5bf0c933947972`. Rama propia apilada sobre `claude/cad-bg-segundo-plano`. Implementador: Astra; requiere revisión independiente. Sin merge, release ni instalación en el PC de Tannia.

## Correcciones reproducibles

- Seis fallos CAD-BG Windows: ambos helpers creaban un ejecutable con `#!/bin/sh`. Windows no puede ejecutarlo mediante `spawn` sin shell. El simulador ahora usa un proceso Node nativo con precarga exclusiva de pruebas, sin modificar el lanzamiento productivo ni introducir shell. El mismo simulador y sus escenarios adversariales se ejecutan en ambos sistemas. No es AutoCAD real.
- Tres contratos antiguos: Windows sin canal humano debe denegar con `AUTORIZACION_INTERACTIVA_REQUERIDA`, antes de intentar la operación. Fuera de Windows corresponde `AUTOCAD_NO_DISPONIBLE`. Las aserciones distinguen explícitamente los entornos; no aceptan cualquier error. Los tests desactivan diálogos del sistema de forma explícita.
- BG-R04: sin caché de diez minutos. Un permiso cubre una sola solicitud/lote, sus parámetros, proyecto, documentos y huellas de archivo. Cambio durante la pregunta, parámetros diferentes, expiración y repetición se rechazan. El adaptador comprueba el contenido autorizado antes de cada script. Las líneas de un lote se describen juntas con coordenadas; una solicitud nueva exige otra aprobación.
- BG-R05: propiedad inmutable publicada mediante enlace exclusivo de un registro completo. Estado del proceso CAD separado y escrito atómicamente. Un JSON ilegible no significa propietario muerto. Recuperación de generaciones muertas con reclamo exclusivo; un segundo trabajo espera. Antes de spawn se persiste la fase de inicio para no recuperar a ciegas una caída entre creación del proceso y registro de PID.

Pruebas negativas escritas y ejecutadas antes de corregir: `evidencia/primero-falla-eca3b60.txt` (4 fallos). Después: `primero-pasa.txt` (4 aprobadas). Pruebas ampliadas: `test/cadbg_consolidacion.test.js`.

## Límites de seguridad y validación

- Si el propietario es ilegible, el PID de un proceso recién creado no llegó a registrarse, o el recuperador cayó tras tomar el reclamo, el sistema espera hasta el tiempo máximo y exige inspección de soporte; no roba el bloqueo. Solo retirar el registro después de comprobar que no queda trabajo ni CAD pesado activo. Esta recuperación excepcional no se automatiza por antigüedad.
- El bloqueo coordina servidores/proyectos que comparten el mismo directorio de trabajo de Tannia. Dos directorios raíz distintos todavía requieren configuración común; no se afirma exclusividad entre configuraciones independientes.
- Las huellas de aprobación cubren los archivos en disco. La detección de cambios concurrentes en memoria de AutoCAD y el estado de una sesión real requieren UAT; no afirmar que el SHA de archivo representa cambios sin guardar.
- Core Console 2027, fidelidad DWG real, foco de Word/Excel, Claude Desktop y revisión profesional: NO EJECUTADOS.
- CI Windows/Ubuntu y gates del candidato rc.4: pendientes del SHA publicado. El empaquetado CI depende de ambas suites exitosas.
- La integración de expediente, presentación profesional y UAT consolidada continúa. Este PR todavía no es candidato ofrecido para instalación.
