# Incidente del instalador TW-09 H4/H5 en Claude Desktop (Windows): «path escape»

**Síntoma reportado:** extensión «Tannia Workspace — PRUEBA TW-09 H4/H5 (fc48937)» instalada y habilitada, con advertencia de que no pudo iniciar. `main.log`: `[error] [mcp] Could not launch … path escape: "Tannia Workspace — PRUEBA TW-09 H4/H5 (fc48937)"`; ~2 s después, mensajes de conexión y anuncio de 61 herramientas.

## Qué está demostrado localmente
1. **Origen del nombre:** lo introduje yo al re-rotular el manifiesto durante el empaquetado de prueba (un paso manual fuera del repositorio): `display_name = "Tannia Workspace — PRUEBA TW-09 H4/H5 (fc48937)"`. El build del producto (`scripts/build.mjs`) genera `display_name: "Tannia Workspace"` y **no** contenía «/». El ZIP del instalador (nombres de archivo en la raíz, sin «/» ni caracteres de Windows) **no** es el origen.
2. **Reproducción:** el nombre con «/» no es un único segmento de ruta (`esSegmentoSeguro` = falso); con «H4-H5» sí. **El validador oficial `mcpb validate` acepta el manifiesto con «/»** (prueba en `tw30`): por eso el defecto pasó todas las verificaciones previas.
3. **Comparación de paquetes (extraídos con el CLI oficial):**
   | Paquete | `display_name` | `server/index.js` (SHA-256) |
   |---|---|---|
   | fc48937 (el que falló) | `… PRUEBA TW-09 H4/H5 (fc48937)` | `700c4bd0…` |
   | c59dcd5 (anterior) | `… PRUEBA TW-09 auditoría PR11 (c59dcd5)` | `05103e3e…` |
   | **fc48937-r2 (nuevo)** | `Tannia Workspace - TW09 H4-H5 (fc48937)` | **`700c4bd0…` (idéntico al que falló)** |
   Entre el paquete que falló y el nuevo solo cambian `display_name`, `version` y `description` del manifiesto. **El servidor es byte a byte el mismo**: no hay cambios de geometría, COM, seguridad ni gestión de proyectos. Entre c59dcd5 y fc48937 solo difieren `store/transaccion/gestion` y los dos servicios (H4/H5).
4. **El nuevo bundle inicia y responde (cliente MCP real sobre stdio):** se desempaqueta en una carpeta con espacios y Unicode, se lanza con el mismo comando/argumentos del manifiesto, `initialize` devuelve `serverInfo`, instrucciones y capacidad `tools`, se publican **exactamente 61 herramientas** (idénticas a las declaradas en el manifiesto), 0 esquemas inválidos y `tannia_diagnostico` responde. Resultado guardado en `…mcpb.verificacion.json`.
5. **Validación automática antes de empaquetar** (`scripts/lib/nombres.mjs`, usada por `scripts/pack.mjs` y `scripts/paquete-prueba.mjs`): nombre visible sin `\ / : * ? " < > |`, sin control, sin punto/espacio inicial o final, no reservado de Windows, ≤ 80 caracteres y solo letras/dígitos/espacio/`._()+#-`; `name` interno en minúsculas sin «/»; versión válida; herramientas únicas; rutas internas relativas, con «/», sin traversal, sin caracteres/reservados de Windows, ≤ 180 caracteres y sin colisión de mayúsculas. Un nombre inseguro **no se empaqueta** (falla antes de crear archivos).
6. **Identificador interno conservado** (`name: tannia-workspace-tw09`) para permitir reemplazar la instalación anterior; la versión sube a `0.1.0-tw09.fc48937.r2` para distinguirla.

## Lo que NO está demostrado (exige Claude Desktop real)
- Que «/» sea **la** causa del «path escape»: es la hipótesis más fuerte (única diferencia relevante con el paquete anterior que instaló sin ese mensaje, junto con el servidor idéntico) pero no se conoce el código del administrador de extensiones. El validador modela la comprobación; no la reproduce.
- **El segundo evento** (conexión y anuncio de 61 herramientas ~2 s después): no se pudo explicar. Es compatible con que el proceso MCP sí arrancara (el servidor lo hace en la verificación local) y con un reintento del cliente; **no se asume ni se descarta** que el aviso fuera cosmético. Cómo comprobarlo con el paquete nuevo: que `main.log` **no** contenga `path escape` y que aparezca la conexión con 61 herramientas.
- Si el em dash «—» (presente en paquetes anteriores) es problemático: no hay evidencia; el validador lo rechaza por conservadurismo y el nombre nuevo usa guion ASCII.
- Reinstalación sobre la anterior en el administrador real (conservación de la carpeta de datos).

## Archivos
`scripts/lib/nombres.mjs`, `scripts/lib/verificar_bundle.mjs`, `scripts/paquete-prueba.mjs`, `scripts/pack.mjs` (valida antes de empaquetar), `test/tw30_paquete_nombres.test.js`.
