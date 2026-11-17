# Tannia Workspace 0.2.0-rc.1 — candidato de instalación NO VALIDADO

Implementación de la remodelación diseñada por Astra ([PR #24](https://github.com/cristobalMundacaV1/tannia-workspace/pull/24), `b9292ef`) sobre el código del [PR #21](https://github.com/cristobalMundacaV1/tannia-workspace/pull/21) (`2f4cdd0`). Rama `claude/sharp-gates-r4rbu5`. SHA inicial `b9292ef23a5a105c414ee19f6518c7d7c1108d4f`.

## Artefacto probado

| Campo | Valor |
|---|---|
| Archivo | `Tannia-Workspace-0.2.0-rc.1-windows-x64.zip` (17,9 MB) |
| SHA-256 | `abaa7e7ff8430a6f5f4d7ad1febe015c38e570f8ba45485b0b6e0395994ffb28` |
| Extensión interna | `tannia-workspace-0.2.0-rc.1.mcpb`, SHA-256 `70932ccbe3eddbe0222026ec9dcb249dd8240552c5c3e3e3e84fb5896f8ef54d` |
| Construido desde | commit `1316cb9b91a3b8f967abc9a579a03356f54c5890`, checkout limpio en CI (Ubuntu, Node 22), destino `win32-x64` |
| Descarga | artefacto `tannia-workspace-zip-instalacion` del [run 44092643510](https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/44092643510) (requiere sesión en GitHub; caduca 2027-02-15) |
| CI completo del commit | Ubuntu: suite 485 (0 fallos) · Windows: suite 485, 481 ok, 0 fallos, 4 omitidas (incluye las pruebas con PowerShell real) · build+pack ✅ |
| Pruebas sobre ESE archivo | Ubuntu: verificador 11/11. Windows (`windows-latest`, misma huella comprobada con `sha256sum`): verificador 11/11 y lanzadores `INSTALAR.cmd`/`DIAGNOSTICO.cmd` reales 5/5 |

Cada push vuelve a construir y probar un ZIP; el contenido de la extensión es reproducible, pero el contenedor `.mcpb` cambia de bytes en cada empaquetado. **Identifique siempre el ZIP por su SHA-256.**

## Instalar (Windows 10/11 x64, usuario estándar)
1. Descargar el artefacto y extraer el ZIP (clic derecho → Extraer todo).
2. Doble clic en **`INSTALAR.cmd`**: comprueba 64 bits, integridad SHA-256 y Claude Desktop; abre la extensión en Claude Desktop → pulsar **Instalar**, elegir la carpeta de proyectos.
3. Conversación nueva: «Ejecuta el diagnóstico de Tannia Workspace».

Requiere Claude Desktop instalado con sesión (Internet para hablar con Claude). No requiere administrador, Node.js ni compilar. AutoCAD completo es opcional.

## Revertir
- **Extensión:** Claude Desktop → Configuración → Extensiones → Desinstalar (no borra proyectos); para volver a 0.1.0-rc.3 instale su `.mcpb`.
- **Proyectos migrados:** pedir «Revierte la actualización del proyecto X» (`tannia_proyecto_migracion` → restaura bytes previos) **antes** de usar la versión anterior. Advertencia: la versión anterior vuelve a aceptar aprobaciones por nombre (A-01).
- **Código:** el PR es borrador y no se fusiona; descartar la rama no afecta `main` ni los PR anteriores.

## Documentos
- [Matriz E01–E30 y gates G0–G9](MATRIZ_EJECUCION_E01_E30.md)
- [Decisiones técnicas](DECISIONES.md)
- [Pruebas reales pendientes](PRUEBAS_REALES_PENDIENTES.md)
- Evidencia: [baseline](evidence/00-baseline-b9292ef-linux-node22.tap) · [antes/después A-01/A-02/A-03](evidence/01-reproduccion-antes-despues.md) · [suite final](evidence/02-suite-1316cb9-linux-node22.tap) · [verificación ZIP checkout limpio](evidence/03-verificacion-zip-checkout-limpio-b784bbb-linux.json)

## Estado honesto
Candidato **no validado**: ningún gate de liberación (G1–G9) está aprobado. Funciona de extremo a extremo con Node y el protocolo MCP reales en Linux y Windows, pero **no** se probó en Claude Desktop real, ni con AutoCAD, ni con expedientes reales ni revisión profesional. No usar para entregas profesionales.
