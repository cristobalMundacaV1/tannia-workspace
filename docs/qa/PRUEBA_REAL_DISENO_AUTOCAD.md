# Primera prueba real del asistente de anteproyectos en AutoCAD 2027

**Paquete de prueba:** `tannia-workspace-diseno-50dae1b.mcpb` — código **idéntico** al commit `50dae1b` de la rama `feat/tw-design-assistant` (CI verde en Windows y Ubuntu). Solo se cambió el *rótulo* del manifest (nombre, versión `0.1.0-diseno.50dae1b`) para que **no se mezcle con rc.3**; `server/index.js` tiene el mismo SHA-256 que la compilación pura del commit (`eebd07ee…33e8e0`).
**Estado:** ninguna de estas operaciones se ha ejecutado contra AutoCAD real. **La integración NO está aprobada** hasta completar esta prueba en tu equipo y registrar los resultados.
**Reglas de la prueba:** originales protegidos, todo el resultado en copias de trabajo (`03 Trabajo`), nada se borra, nada se publica.

Duración estimada: 45–60 min. Usa un proyecto **de prueba** (no de un cliente).

---
## 0. Antes de empezar
1. Verifica la descarga (PowerShell, en la carpeta del archivo):
   ```powershell
   (Get-Item .\tannia-workspace-diseno-50dae1b.mcpb).Length
   Get-FileHash .\tannia-workspace-diseno-50dae1b.mcpb -Algorithm SHA256
   ```
   Debe coincidir con `tannia-workspace-diseno-50dae1b.mcpb.sha256`.
2. Ten **AutoCAD 2027 abierto** (normal, no "como administrador") con **un dibujo cualquiera** (el de prueba sirve).
3. Anota: versión de AutoCAD (`_ABOUT`) y de Windows.

## 1. Instalar en Claude Desktop (sin tocar rc.3)
1. Claude Desktop → **Configuración → Extensiones**. Si tienes instalada **Tannia Workspace rc.3**, **desactívala** (no la quites: así vuelves atrás cuando quieras). Las dos extensiones exponen herramientas con los mismos nombres; deja **solo una activa**.
2. Arrastra `tannia-workspace-diseno-50dae1b.mcpb` a esa pantalla. Debe aparecer **«Tannia Workspace — PRUEBA anteproyectos (50dae1b)»**, versión `0.1.0-diseno.50dae1b`. Si Windows avisa que no está firmado: es esperado.
3. En la carpeta de datos deja la **sugerida** (`Documentos\Tannia Workspace`): comparte tus proyectos con rc.3 sin duplicarlos.
4. Actívala. En una conversación nueva escribe: **«Haz un diagnóstico de Tannia Workspace»** → debe decir «Todo en orden». (El diagnóstico imprime la etiqueta del código `0.1.0-rc.3`: es normal, el código es el del commit; lo que identifica este paquete es el nombre/versión en Extensiones.)
5. Pregunta: **«¿Tienes herramientas para diseñar anteproyectos de vivienda?»** → debe mencionar `tannia_diseno_crear`.
**Volver atrás:** desactiva esta extensión y activa rc.3.

## 2. Preparar el proyecto y proteger un original
1. «Crea un proyecto llamado **Prueba Diseño 80m2**».
2. Copia **un DWG cualquiera** (ajeno al diseño) a `Documentos\Tannia Workspace\Proyectos\Prueba Diseño 80m2\02 Originales\` con el Explorador. **No lo tengas abierto en AutoCAD** (si no, aparecerán `.dwl` y una advertencia de captura inestable: es el comportamiento esperado).
3. «Registra los originales del proyecto» → debe registrar ese archivo (solo DWG/DXF/PDF y similares).

## 3. Generar el anteproyecto (caso ~80 m²)
Escribe **tal cual**:
> Diseña una propuesta de casa de un piso de aproximadamente 80 m², tres dormitorios, dos baños, living-comedor y cocina americana. Llámala «Casa 80 m2».

**Esperado** (ver `caso-80m2/respuesta-v001.txt` y `Casa80m2-v001.png`): versión **v001**; construida **79,75 m²**, útil **68,11 m²**; 8 recintos:

| Recinto | Medidas útiles (m) | Superficie |
|---|---|---|
| Baño 1 | 1,43 × 2,93 | 4,19 m² |
| Baño principal | 1,56 × 2,68 | 4,18 m² |
| Cocina americana | 2,93 × 2,93 | 8,58 m² |
| Dormitorio 2 | 2,76 × 2,68 | 7,40 m² |
| Dormitorio 3 | 2,73 × 2,68 | 7,32 m² |
| Dormitorio principal | 3,13 × 2,68 | 8,39 m² |
| Living-comedor | 6,10 × 2,93 | 17,87 m² |
| Pasillo | 10,60 × 0,96 | 10,18 m² |

Debe mostrar **supuestos** (p. ej. sistema constructivo) y **preguntas** (terreno/comuna), y el aviso **ANTEPROYECTO — no apto para construcción**. Los archivos quedan en `03 Trabajo\Anteproyectos\Casa 80 m2\`:
- Abre `v001.svg` con el navegador: debe verse igual a `Casa80m2-v001.png`.

## 4. Abrir en AutoCAD y guardar el DWG
1. Pide: **«Guarda el anteproyecto Casa 80 m2 como DWG en AutoCAD»** (herramienta `tannia_diseno_a_autocad`).
   **Esperado:** `…\Casa 80 m2\v001.dwg` creado; en el resultado, `cabecera_dwg_valida: true` (cabecera `AC10xx`), `entidades: 232`, capas `TW_MURO_EXT, TW_MURO_INT, TW_PUERTA, TW_VENTANA, TW_RECINTO, TW_TEXTO, TW_COTA, TW_EJES`, `unidades_insunits: 4` (mm).
   AutoCAD debe dejar `v001.dwg` como dibujo activo.
2. **Si falla** (puede ocurrir: esta ruta nunca se ejecutó en AutoCAD real): anota el mensaje exacto y usa el plan B: en AutoCAD `OPEN` → `…\Casa 80 m2\v001.dxf` → `SAVEAS` → `v001 (manual).dwg` en la misma carpeta. Registra qué ocurrió con el DXF (mensajes de recuperación, avisos de versión).
3. Comprueba la conexión: **«Usa tannia_cad_estado»** → debe indicar conexión COM y el documento activo.

## 5. Comprobar que las entidades son editables (en AutoCAD)
Con `v001.dwg` abierto:
| # | Acción | Esperado |
|---|---|---|
| 5.1 | Paleta de capas (`LAYER`) | Existen las 8 capas `TW_*` |
| 5.2 | `ZOOM` → `E` | Todo el plano a la vista, sin objetos lejanos sueltos |
| 5.3 | Clic en un muro | Es una **LINE** (Propiedades), con pinzamientos; muévelo con `STRETCH` sin errores; **`UNDO`** lo devuelve |
| 5.4 | Clic en el contorno de un recinto (capa `TW_RECINTO`) | Es una **polilínea cerrada**; `AREA` → `Objeto` → mide p. ej. el **Living-comedor ≈ 17 870 000 mm²** (6,10 × 2,93 m) |
| 5.5 | Doble clic en un texto | Se edita; los nombres muestran bien **ñ** (BAÑO) y no aparecen secuencias `\U+` |
| 5.6 | `DIST` entre las caras exteriores | **11 000 mm** de ancho y **7 250 mm** de fondo |
| 5.7 | `INSUNITS` | **4** (milímetros) |
| 5.8 | `AUDIT` (corregir: Sí) | 0 errores |
| 5.9 | Cotas | Son líneas + texto (no entidades DIMENSION): es lo esperado en esta entrega |
| 5.10 | Puertas | Hoja (LINE) + arco (ARC) en `TW_PUERTA` |
Anota cualquier objeto que se comporte como bloque/proxy, texto con caracteres extraños, o capas con colores inesperados.

## 6. Comprobar que el DWG se conserva (cierre y reapertura)
1. Con `v001.dwg` activo y **guardado**: **«Lista las entidades de la capa TW_MURO_EXT con medidas, máximo 4»** (`tannia_cad_listar_entidades`) → anota los 4 *handles*.
2. **«Verifica la persistencia de 03 Trabajo/Anteproyectos/Casa 80 m2/v001.dwg con esos handles»** (`tannia_cad_verificar_persistencia`).
   **Esperado:** `persistencia: verificada`, 4 entidades, `diferencias: []`; el archivo en disco **sin cambios** por el cierre/reapertura (mismo SHA-256 antes/después). AutoCAD cierra y reabre el DWG solo.
3. «Lista las entidades con máximo 5000»: la cantidad debe seguir siendo **232**.
4. Cierra AutoCAD y ábrelo de nuevo, abre `v001.dwg` a mano: mismo contenido.

## 7. Prueba de refinamiento (conservar el resto, verificar, deshacer)
1. **«Agranda el dormitorio 2 a 3 metros de ancho.»** → **v002**.
   Esperado: Dormitorio 2 **3,00 × 2,68 = 8,04 m²**; Dormitorio 3 pasa a **2,49 × 2,68 = 6,67 m²** (compensa); **«Recintos sin cambios: 6»**; superficie construida sigue en 79,75 m².
2. **«Agrega un walk-in closet al dormitorio principal, de 1,2 m de fondo hacia el norte.»** → **v003**.
   Esperado: **Walk-in closet 3,13 × 1,03 = 3,22 m²** (nuevo, con puerta); Dormitorio principal **3,13 × 1,51 = 4,73 m²**; **«Recintos sin cambios: 7»**; informa que la **ventana norte del dormitorio principal se retiró** (ya no tiene muro exterior) y avisos breves (superficies bajo el criterio inicial, dormitorio sin ventana exterior). *Esto prueba que el motor es honesto: no es una recomendación de diseño.*
3. **«Verifica el anteproyecto Casa 80 m2.»** → coherencia **sin errores** (solo advertencias) y verificación del DXF `ok: true`.
4. **«Vuelve atrás un paso.»** → versión actual **v002**; el dormitorio principal vuelve a **8,39 m²**; v003 **sigue en disco** (nada se borra); «Rehaz» vuelve a v003.
5. **«Guarda esta versión como DWG en AutoCAD»** (queda en v002) → `v002.dwg` (232 entidades). Con v003: `v003.dwg` tendría **245**. **No se sobrescribe** un DWG existente: si repites, debe negarse (`DWG_YA_EXISTE`).
6. Abre `v002.dwg` y compara con `Casa80m2-v002.png`.

## 8. Cantidades (opcional)
«Dame las cantidades con muros de 2,4 m» → partidas `AP-*` (pisos, muros, vanos), sin verificar, trazables a la versión.

## 9. Cierre: originales intactos
«Verifica la integridad de los originales» → **íntegros**. Comprueba que en `02 Originales` solo está tu DWG de prueba (ningún archivo nuevo) y que todo lo generado está en `03 Trabajo\Anteproyectos\Casa 80 m2\`.

## 10. Qué enviarme
Llena `HOJA_RESULTADOS.md` (✅/❌ por paso) con: versión de AutoCAD/Windows, el texto **exacto** de cualquier error, y capturas **reales** si las tienes. No marques nada que no hayas ejecutado.

---
## Limitaciones conocidas (no son fallas de la prueba)
- **Anteproyecto:** no apto para construcción; sin cálculo estructural/térmico/acústico ni proyecto de instalaciones; valores iniciales de práctica de diseño, **no normativos**; no se evalúa cumplimiento. Fuentes oficiales indicadas sin números de artículo.
- **Alcance:** un piso, planta rectangular, 2–3 dormitorios, 1–2 baños, 55–130 m²; sin mobiliario ni sanitarios dibujados; sin terreno/orientación (se preguntan); sin 3D.
- **DXF** formato AC1009 (R12): AutoCAD lo convierte a polilíneas 2D (no LWPOLYLINE); cotas como geometría; muros como contorno de líneas.
- **Lenguaje natural:** lo interpreta Claude y puede equivocarse; cada cambio muestra qué cambió y se puede deshacer.
- **Lo que solo se comprueba con AutoCAD real (este documento):** apertura del DXF R12 sin avisos, `SaveAs` a DWG (tipo 2018), textos con `\U+`, unidades (`INSUNITS`), cierre/reapertura por COM, edición posterior, `AUDIT`. Hasta que lo ejecutes: **NO VERIFICADO**.
