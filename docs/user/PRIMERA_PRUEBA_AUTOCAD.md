# Primera prueba con tu AutoCAD real (15 min)

> El adaptador de AutoCAD **nunca se ha probado con AutoCAD real**. Un fallo aquí es información valiosa, no un problema tuyo: anota el mensaje exacto y envíalo.

## 1. Instalar
1. Descarga `tannia-workspace-0.1.0-rc.1.mcpb` y `.sha256`.
2. (Opcional) En PowerShell: `Get-FileHash .\tannia-workspace-0.1.0-rc.1.mcpb -Algorithm SHA256` → debe coincidir con el `.sha256`.
3. Claude Desktop → **Configuración → Extensiones** → arrastra el `.mcpb` → deja la carpeta sugerida → activa.
   *Windows puede avisar que el archivo no está firmado: es esperado en este RC.*

## 2. Prueba A — detección (no toca AutoCAD)
Con AutoCAD **cerrado**, escribe en Claude: **«Usa tannia_cad_estado»**.
Esperado: `instalacion.instalado: true`, `compatible: true`, producto y release correctos, y sin sesión (AutoCAD cerrado).
Luego abre AutoCAD con un dibujo y repite: debe aparecer `sesion` con versión, nombre y ruta del documento.

## 3. Prueba B — lectura (solo lectura)
Crea un dibujo **de prueba** con: una línea de 10 unidades, un rectángulo cerrado (polilínea) 5×4, un círculo r=1 y, si puedes, una caja 3D sólida 2×3×4.
Pide: **«Lista las entidades del dibujo abierto en AutoCAD»** y luego **«Mide la entidad con handle XX»** (usa los handles que devuelva). Esperado: Length=10, Area=20, Area≈3.14159, Volume=24.

## 4. Prueba C — edición solo en copia
1. **«Crea el proyecto Prueba AutoCAD»**. Copia tu DWG de prueba a `Documentos\Tannia Workspace\Proyectos\Prueba AutoCAD\02 Originales`.
2. **«Registra los originales»** → **«Crea una copia de trabajo de <archivo>.dwg»**.
3. **«Abre esa copia en AutoCAD»**, luego **«Agrega 4 líneas en la copia que formen un rectángulo de 6000 × 4000 en la capa TW_PRUEBA»** (usa `tannia_cad_agregar_lineas`; si falla algo se revierte todo).
   Esperado: la línea aparece **solo en la copia**.
4. **«Verifica la integridad de los originales»** → debe decir íntegros.
5. Con el **original** como dibujo activo pide agregar una línea → debe ser **rechazado** (ORIGINAL_PROTEGIDO).

### Si algo falla
Pide **«Usa tannia_cad_estado»**: ahora informa por separado el registro de Windows y la conexión COM, con la **etapa** y el código de error (sin rutas). Envíame ese resultado.

## 5. Qué enviarme
Para cada prueba: ✅/❌, versión exacta de AutoCAD (`ACADVER`/Ayuda → Acerca de), y el texto del error si falla. Capturas solo si son reales. Con eso actualizo la matriz `docs/qa/CAD_CAPABILITY_MATRIX.md`.

## Seguridad durante la prueba
Usa dibujos de prueba, no planos de clientes. Tannia Workspace no borra ni cierra nada en AutoCAD y solo guarda la **copia** activa.
