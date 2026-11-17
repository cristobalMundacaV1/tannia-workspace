# Procedimiento de prueba en AutoCAD 2027 — CAD-OPEN-01 (3.ª incidencia): DXF por `Import`, no por `Open`

**Estado de este documento:** procedimiento NO EJECUTADO. Ninguna afirmación de funcionamiento en AutoCAD real se hace aquí.
Rama de código: `fix/cad-open-dxf-import` (PR #20 sigue en borrador; sin merge ni release).

## 1. Hallazgo y alcance

- La ayuda oficial de Autodesk (AutoCAD 2027, ActiveX, método `Open`) indica que `Documents.Open` abre un dibujo DWG y remite a `Import` para SAT, EPS, **DXF**, WMF y BMP.
  Fuente: <https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-ActiveX-Reference/files/GUID-9ED7A548-7978-4BFD-8462-E2FA747E8880.htm>
- El driver anterior llamaba `Documents.Open` con archivos `.dxf` (`abrir_copia`, `laminas_a_dwg`, `dxf_a_dwg`). Es una **incompatibilidad con el contrato documentado**.
- **No se afirma que esa sea la causa del tiempo agotado repetido** (`abrir_documento`, 30 s, luego `0x80010001`). Es una hipótesis fuerte; solo esta prueba en AutoCAD real puede confirmarla o descartarla.
  Si tras la corrección sigue habiendo bloqueos, la causa es otra y la etapa registrada dirá dónde.

## 2. Qué cambió (auditoría de llamadas)

| Llamada | Antes | Ahora |
|---|---|---|
| `abrir_copia` con `.dxf` | `Documents.Open(dxf)` | `importar_dxf_aislado`: `Documents.Add()` + `Document.Import(dxf, (0,0,0), 1.0)` en un documento nuevo; solo mide |
| `abrir_copia` con `.dwg` | `Documents.Open(dwg)` | igual, con guardia `.dwg` en PowerShell y en Node (`viaApertura`) |
| `laminas_a_dwg` | `Open(dxf)` + `SaveAs` | 1) `importar_dxf_aislado`; 2) **puerta** en Node; 3) `SaveAs` del documento aislado, solo si la puerta pasa |
| `dxf_a_dwg` | `Open(dxf)` + `SaveAs` | igual flujo (importar → puerta → guardar) |
| `cerrar_reabrir` | `Open(dwg)` | igual, con guardia `.dwg` |

`Documents.Open` ya no aparece en ningún script que reciba un DXF; una prueba estática lo impide (`test/tw12_dxf_api_contrato.test.js`).
**No se sustituyó `Open` por `Import` a ciegas:** `Import` opera sobre un documento y no se asume que conserve layouts, viewports, cotas, textos ni XDATA. Por eso existe la puerta.

## 3. Aislamiento (Dibujo1 y otros documentos del usuario)

- El DXF se importa en un documento **nuevo y propio** (`Documents.Add`). Nunca se importa en `Dibujo1` ni en el documento activo previo.
- Los documentos existentes solo se **enumeran** (nombre, si tienen ruta, si están guardados). No se guardan, cierran ni modifican.
- Efecto visible esperado: AutoCAD activa el documento nuevo (`Drawing2` o similar); `Dibujo1` sigue abierto, con su asterisco si lo tenía.
- Si la importación falla o la puerta rechaza, el documento nuevo **queda abierto y sin guardar**: el producto no cierra nada automáticamente. Ciérrelo con «No guardar».
- El guardado (`SaveAs`) localiza el documento aislado por nombre, sin ruta en disco y único; nunca un documento del usuario guardado.

## 4. La puerta de verificación (antes de guardar cualquier DWG)

Node compara lo **medido** por AutoCAD en el documento importado con lo **esperado** leído del propio DXF (`src/cad/dxf_api.js`):

| Elemento | Esperado (cuadernillo TW-12) | Medición en AutoCAD |
|---|---|---|
| Layouts | 4 (`TW12-01` … `TW12-04`) | `Layouts` no-modelo y nombres |
| Viewports | 5 (1+1+1+2) con centro, tamaño, escala, bloqueo, región de modelo | `AcDbViewport` en cada `Layout.Block` |
| Cotas | 9 (`MODEL_DIMS`) | entidades `AcDb*Dimension*` en espacio modelo |
| XDATA | 20 entidades con `TANNIA_TRACE` | `GetXData('TANNIA_TRACE')` por entidad del modelo |
| Textos del cajetín | los del DXF por layout (institución, elaborado, etc.) | `TextString` de `AcDbText/AcDbMText` por layout |
| Entidades y capas | conteo total y por capa del modelo | `ModelSpace` |

Los valores esperados salen de este DXF concreto (no son constantes mágicas): si cambia el DXF, cambia el esperado.
Si algo difiere, la herramienta devuelve `IMPORTACION_DXF_INCOMPLETA` con la lista de diferencias y **no guarda ningún DWG**.

## 5. Cómo se mantiene el manejo de estados inciertos

- Tiempo límite por defecto de PowerShell: **sin cambios (30 s)**. La importación usa 120 s (el mismo que ya tenía `dxf_a_dwg`) por ser más pesada que un `Open`; es una decisión revisable.
- Una sola instancia: `PS_STRICT` exige un único proceso `acad` (`SESION_AMBIGUA` si no).
- Antes de actuar: cuadro modal (`CMDACTIVE & 8`), comando activo (`& 7`) y ocupación (`IsQuiescent`) bloquean con código propio.
- Tras un tiempo agotado en la importación **no se reintenta**: se deja marca pendiente, se reconcilia por COM (solo lectura: ¿sigue el documento aislado? ¿cuántas entidades?) y se informa. Mientras haya un documento aislado presente o el estado no sea verificable, ninguna importación nueva arranca (`OPERACION_PENDIENTE_INCIERTA`). Con el estado limpio comprobado, la siguiente llamada explícita puede importar una vez.
- Una importación tardía NO se da por buena: no se mide ni se guarda automáticamente; se pide cerrar el documento sin guardar y repetir.
- Los originales de `02 Originales` siguen protegidos; solo se importan copias de `03 Trabajo`.

## 6. Procedimiento para la persona que prueba (AutoCAD 2027, PC de la prueba)

Requisitos: paquete construido desde la rama `fix/cad-open-dxf-import` (no existe aún; ver §8), un solo AutoCAD abierto, `Dibujo1` sin guardar abierto, ningún comando ni cuadro de diálogo activo.

1. Anote la hora y deje `Dibujo1` como está. **No lo guarde ni lo cierre.**
2. Pida `tannia_cad_abrir_copia` sobre la copia de trabajo del DXF de la revisión (una sola vez).
3. Observe: ¿aparece un documento nuevo? ¿`Dibujo1` conserva su contenido y su asterisco?
4. Copie del resultado: `aislado`, `via`, `verificacion_importacion` (`ok`, `issues`, `resumen`). Resultado esperado si todo se conserva: `resumen = {layouts: 4, viewports: 5, cotas: 9, con_traza: 20, entidades_modelo: 29}`.
5. Si pasó: ejecute `exportar_dwg` con la misma revisión. Debe crear el DWG solo si la puerta pasa. Compruebe en AutoCAD: 4 pestañas de layout, 5 viewports con las escalas del cuadernillo, 9 cotas, cajetín completo, y `LIST`/propiedades con XDATA `TANNIA_TRACE` en una entidad.
6. Compare visualmente cada layout con el PDF de la revisión (misma numeración 01/4 … 04/4).
7. Cierre el documento nuevo sin guardar si no lo necesita. `Dibujo1` no debe haber cambiado.
8. Si hay tiempo agotado: **no repita**. Copie el mensaje completo (última etapa, duración, reconciliación). La etapa dirá si se bloqueó en `crear_documento_aislado`, `importar_dxf` o `medir_importado`.

## 7. Criterios de resultado (se registran en `EVIDENCE_MATRIX.md` solo con ejecución real)

| Resultado | Significado | Qué sigue |
|---|---|---|
| `PASA` | Importación + puerta + DWG conformes, `Dibujo1` intacto | Registrar evidencia (capturas, sha256 del DWG); validación humana de los planos sigue pendiente |
| `FALLA: puerta` | `Import` no conserva algo (p. ej. viewports/XDATA) | La vía `Import` no basta. Decisión de producto entre las alternativas B/C (abajo); no se improvisa |
| `FALLA: bloqueo en importar_dxf` | `Import` también se bloquea | Hipótesis descartada para esa etapa; investigar con la etapa y el HRESULT |
| `FALLA: otra etapa` | `Add`/`medir` | Registrar etapa/HRESULT; no repetir |

Alternativas documentadas, **sin implementar y sin validar** (requieren decisión y prueba real): (B) `DXFIN` por `SendCommand` sobre un documento nuevo (cambia el contrato «sin SendCommand» y depende del estado de la línea de comandos); (C) `accoreconsole.exe` fuera de la sesión interactiva (otro proceso, otra superficie de permisos y de instalación).

## 8. Límites de la verificación en este entorno

- Pruebas automáticas sobre un runner simulado: acreditan el **contrato** (qué API recibe cada tipo de archivo, qué se mide, cuándo se guarda y cuándo no), no el comportamiento de AutoCAD 2027.
- El entorno de desarrollo no tenía red: se ejecutaron las pruebas que no dependen de `zod`, `exceljs`, `esbuild`, del SDK de MCP ni de `pdfkit`, con stubs locales mínimos (no versionados) para poder cargar los módulos de generación del DXF. **No se reconstruyó el `.mcpb`** ni se calculó un hash nuevo: el paquete con esta corrección está pendiente de construirse en un entorno completo.
- La ejecución real en AutoCAD 2027 y el piloto de la persona usuaria siguen **NO VERIFICADOS**.

## Anexo CAD-OPEN-02 — si la importación falla o queda parcial
1. Copie el **texto visible completo** del error (etapa, HRESULT, excepción, mensaje, últimas etapas, documento aislado y entidades).
2. `tannia_planos` acción `marcas`: lista las ejecuciones parciales/inciertas (las marcas nunca se borran).
3. `tannia_planos` acción `inspeccionar_aislado` (solo lectura): entidades, layouts, viewports y nombre del documento aislado.
4. Cierre usted `Dibujo2` (o el documento aislado indicado) **sin guardar**; Tannia no cierra ni guarda documentos.
5. `tannia_planos` acción `reconciliar_marcas` (con `archivo` para las marcas históricas `apertura-*`): resuelve por adición, conservando las marcas.
6. Solo entonces repita **una** importación. Mientras haya un documento aislado pendiente, Tannia la bloqueará.
