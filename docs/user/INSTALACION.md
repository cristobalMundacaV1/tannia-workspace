# Instalar Tannia Workspace (1 página)

**Qué necesita:** Windows 10/11, Claude Desktop (versión reciente) y, para trabajar con planos en vivo, AutoCAD completo (no LT). Para DXF y PDF **no** necesita AutoCAD abierto.

## Instalar
1. Guarde el archivo `tannia-workspace-<versión>.mcpb` en una carpeta (p. ej. Descargas).
2. Abra **Claude Desktop → Configuración → Extensiones** y **arrastre** el archivo, o haga doble clic sobre él.
3. Cuando pregunte por la **carpeta de Tannia Workspace**, deje la sugerida (`Documentos\Tannia Workspace`) o elija otra.
4. Active la extensión. Abra una conversación nueva y escriba: **«Haz un diagnóstico de Tannia Workspace»**. Debe responder «Todo en orden».

## Actualizar
Descargue el nuevo `.mcpb` y repita el paso 2 (reemplaza la versión anterior). **Sus proyectos no se tocan.**

## Volver a la versión anterior (rollback)
Desinstale la extensión (Configuración → Extensiones → Tannia Workspace → Quitar) e instale el `.mcpb` anterior. Los proyectos siguen en su carpeta.

## Desinstalar
Configuración → Extensiones → Tannia Workspace → **Quitar**. Sus proyectos y archivos **no se borran** (están en `Documentos\Tannia Workspace`). Si quiere borrarlos, elimine esa carpeta manualmente.

## Si algo falla
- Escriba: **«Haz un diagnóstico de Tannia Workspace»** y **«Repara el proyecto <nombre>»**.
- Verifique que Claude Desktop esté actualizado y que la extensión esté activada.
- Si no puede escribir en la carpeta, elija otra en la configuración de la extensión.
- Envíe a soporte el resultado del diagnóstico (no contiene sus planos ni nombres de proyecto).

## Privacidad
Los archivos se procesan en su computador, pero **lo que Claude lee de ellos se envía al servicio de Claude** para poder responderle. No suba planos confidenciales si su contrato lo prohíbe.

> Estado de este paquete: **candidato de lanzamiento técnico**. Aún no ha sido validado por Tannia ni probado con AutoCAD real.
