# Protocolo de prueba real G10 — Claude Desktop (Windows) + AutoCAD 2027
**Quién:** Product Owner. **Qué NO es:** aprobación; es la recolección de evidencias para el Director de Revisión Independiente. Use un **proyecto nuevo** y no abra DWG reales de clientes.
Reglas: pegue los mensajes tal cual (en conversación nueva de Claude Desktop). **No escriba nombres de herramientas.** En cada paso, si algo falla: copie el **mensaje de error completo** (texto, no resumen) y una captura. No reintente más de una vez sin anotarlo.

## 0. Preparación
- Instalar según `INSTALAR_EN_WINDOWS.md` (TW-09 deshabilitado, no desinstalado). Abrir **AutoCAD 2027** con un dibujo **en blanco** guardado en una carpeta de pruebas.
- **Antes de empezar**, para demostrar que no se altera nada anterior: en PowerShell, desde su carpeta de Tannia Workspace:
  `Get-ChildItem -Recurse -File .\Proyectos | Get-FileHash | Export-Csv "$env:USERPROFILE\Desktop\hash_ANTES.csv" -NoTypeInformation`
- Anote: versión de Claude Desktop (Ayuda → Acerca de), versión de AutoCAD (`ACADVER`), fecha/hora.

## 1. Encargo familiar (sin terreno)
Pegar `MENSAJE_PRUEBA_CLAUDE.txt`.
**Esperado:** crea el proyecto; entiende superficie/dormitorios/baños/piscina/vista cocina→piscina/luz/verano/ahorro; hace ≤3 preguntas (ninguna sobre un dato que ya dio); ofrece **3 ideas distintas** (rectangular compacta, en L con patio, dos alas en C) con compromisos; dice que sin terreno/norte no calcula sol; advierte que **la vista a la piscina no es seguridad** (barreras y supervisión).
**Capturar:** la respuesta completa; el archivo `…\03 Trabajo\Arquitectura\<estudio>\v00X-comparacion.svg` (abrir en el navegador).
**Falla si:** inventa horas de sol o normas; da 3 plantas que son espejos; dice «piscina segura»; pide JSON/ids.

## 2. Terreno y norte confirmado
Pegar: «El terreno mide 16 por 30 metros, se entra por el lado sur del plano, el norte **verdadero** queda hacia arriba del plano (lo confirmo con un levantamiento), está en Santiago, latitud -33,45 y longitud -70,67, zona horaria America/Santiago. Genera de nuevo las alternativas con el terreno.»
**Esperado:** reconoce datos confirmados; regenera; ahora puede hablar de sol real (junio vs diciembre); archivos `…-sombras-invierno.svg` por alternativa.
**Falla si:** trata el norte como supuesto aunque lo confirmó, o ignora el acceso por el sur.

## 3. Casa en L con patio descubierto (revisión visual y geométrica)
Pegar: «Muéstrame la alternativa en L: ¿el patio queda realmente descubierto (sin losa ni techo encima)? ¿Cuánto mide la huella y el volumen de la losa?»
**Esperado:** huella ≈ 90 m² **menor** que su caja envolvente (≈ 111 m²); patio vacío.
**Capturar:** `v00X-comparacion.svg` y el plano `…-p00N.svg` tras publicar (paso 6).

## 4. Aleros, orientación, ventanas y visuales
Pegar: «Estudia el sol de invierno y de verano en las ventanas del living de la L y dime qué profundidad de alero recomiendas hacia el norte. ¿Se ve la piscina desde la cocina? ¿Qué riesgos o alertas hay?»
**Esperado:** horas de sol por ventana (cifras provienen de la herramienta), tabla verano/invierno de aleros con límites («sol directo, no confort térmico»), visual cocina→piscina con **alerta crítica de barreras** y `seguridad no demostrada`.
**Falla si:** dice que el alero «garantiza confort»/«ahorra energía»; da cifras sin herramienta; declara segura la piscina.

## 5. Clima (archivo de datos)
Copie `clima_sintetico_PRUEBA.epw` (incluido; **sintético, no es clima real**) a `…\Proyectos\Prueba TW10 Los Robles\01 Antecedentes\`. (Si tiene un EPW real de Santiago, úselo y anótelo.) Pegar: «Carga el clima del archivo 01 Antecedentes/clima_sintetico_PRUEBA.epw y dime qué viento domina en invierno y si el patio queda abrigado.»
**Esperado:** clima «regional», con hash y salvedades («no es el viento dentro del patio»); abrigo del patio como **índice geométrico**; sin afirmar ventilación real.

## 6. Elegir, publicar, DWG
Con AutoCAD abierto y activo, pegar: «Elijo la alternativa en L. Publícala: guarda el plano 2D como DWG y llévala a AutoCAD en 3D con los sólidos. Verifica que quedó bien guardado.»
**Esperado:** crea DXF/SVG/informe y modelo 3D versionado en `03 Trabajo`; DWG 2D guardado; 3D construido y **verificado** por la herramienta; si falla algo, error claro (sin inventar éxito).
**Verificar usted en AutoCAD (capturas):**
1. El patio está **vacío** (sin sólido de losa/cubierta) y la losa sigue la forma de L (`VISUALSTYLES`/vista isométrica; `LIST` de un sólido de losa).
2. Capas `TW_*` (2D) y `TW3D_*` (3D); cubierta **oculta** por defecto.
3. Comando `MASSPROP` en un sólido de losa: volumen ≈ área L × 0,15 m (~13,5 m³ en total para ~90 m²).
4. **Guardar, cerrar y reabrir** el DWG; confirmar que siguen los sólidos y que Claude (si se lo pide: «verifica la persistencia») lo confirma.
5. Ejecutar `AUDIT` (corregir = No) y copiar el texto resultante.
6. Repetir 6.1–6.5 con la alternativa **compacta**.

## 7. Preservación de lo anterior
Cerrar AutoCAD. Repetir el comando de hashes con salida `hash_DESPUES.csv` y comparar: `Compare-Object (Import-Csv hash_ANTES.csv) (Import-Csv hash_DESPUES.csv) -Property Path,Hash`. **Esperado:** solo aparecen archivos **nuevos** del proyecto de prueba; **ningún** archivo anterior cambió. Pegue: «Lista mis proyectos» y confirme que los anteriores siguen.
En Claude: «Vuelve a la versión anterior del estudio» → debe usar el historial (no borrar).

## 8. Registro de resultados (copiar y completar)
```
Fecha/hora:            Claude Desktop (versión):         AutoCAD (ACADVER):
SO Windows (versión):  Carpeta de Tannia Workspace:      SHA-256 del .mcpb instalado:
Paso | Resultado (OK / FALLA / NO PROBADO) | Evidencia (archivo/captura) | Error COMPLETO (texto) | Observaciones
 0 Instalación y 72 herramientas |
 1 Encargo y 3 alternativas |
 2 Terreno/norte confirmado |
 3 L con patio descubierto |
 4 Aleros/ventanas/visuales/alertas |
 5 Clima |
 6a DXF/SVG publicados |
 6b DWG 2D guardado |
 6c 3D construido y verificado |
 6d Cerrar/reabrir y AUDIT |
 6e Alternativa compacta |
 7 Hashes antes/después idénticos (solo archivos nuevos) |
Defectos encontrados (descripción, pasos, mensaje exacto):
Opinión del PO (no sustituye al revisor): 
```
**Adjuntar para el revisor:** este registro, capturas, `main.log` de Claude Desktop (`%APPDATA%\Claude\logs\`), las carpetas `03 Trabajo\Arquitectura\<estudio>` y los DWG generados, `hash_ANTES.csv`/`hash_DESPUES.csv`, salida de `AUDIT`.

## 9. Taller con Tannia y profesional independiente (PENDIENTE)
≥15 encargos contrastantes, puntuaciones cualitativas por criterio (uso, estética/espacio, geometría, ambiente, seguridad, comunicación), rechazos documentados, revisor distinto del implementador. **No ejecutado.** Este protocolo no lo sustituye.
