# P0 — DXF «aparentemente vacío»: defectos reproducidos y corrección

**Método:** el DXF de la UAT no está en el repositorio (propiedad del PO). Se regeneró con el código fijado de rc.4 (`2e5349f`, mismo
escritor que PR #37) el DXF equivalente (`test/fixtures_drawing/uat_rc4_planos_completos_regenerado.dxf`, 74.435 bytes, 47 entidades,
mismas 33 LINE / 4 ARC / 10 DIMENSION y 5 layouts que el informe de la UAT). Se escribió primero un inspector independiente del
escritor (`src/drawing/dxf_inspect.js`) y una prueba que **falla** con ese archivo.

## Defectos reproducidos en el DXF de rc.4 (inspector, 15 clases)
| Código | Qué faltaba / estaba mal | Efecto probable en AutoCAD |
|---|---|---|
| `EXTENSIONES_AUSENTES` | sin `$EXTMIN/$EXTMAX` | sin encuadre conocido al abrir |
| `VPORT_ACTIVE_FALTANTE` | sin tabla VPORT ni vista `*Active` | vista inicial por defecto, ajena a la geometría |
| `ENCUADRE_DISPERSO` | vistas separadas cada 1000 m (Y = 0…5007): ocupan 0,8 % de la extensión | incluso con ZOOM Extensión todo es diminuto |
| `SECCION_FALTANTE` | sin sección CLASSES | clase LAYOUT no declarada |
| `TABLA_FALTANTE` | sin VPORT, VIEW, UCS | estructura incompleta |
| `CAPA_0_FALTANTE`, `LTYPE_BASICO_FALTANTE` | capa «0», ByBlock/ByLayer ausentes | bloques referencian una capa inexistente |
| `PROPIETARIO_REGISTRO` | registros de tablas sin propietario (330) | |
| `DICCIONARIO_FALTANTE` | sin ACAD_GROUP, ACAD_MLINESTYLE, ACAD_PLOTSTYLENAME | |
| `PAPEL_ACTIVO_EN_BLOQUE`, `LAYOUT_SIN_VIEWPORT`, `LAYOUT_SIN_ANOTACION` | el contenido de TW12-01 estaba en el bloque `*Paper_Space` (AutoCAD lo lee de ENTITIES) | primera presentación vacía |
| `VIEWPORT_GENERAL_FALTANTE` | ningún viewport ID 1 por presentación | viewports de contenido sin activar |

## Corrección (escritor `src/drawing/dxf_doc.js` + `dxf.js`)
Documento AC1024 completo con la estructura de un dibujo nuevo de referencia: CLASSES, las 9 tablas, capa 0 y Defpoints, tipos básicos,
propietarios, viewport general por presentación seguido de viewports de contenido bloqueados (`90 = 32768|16384`), entidades del layout
activo en ENTITIES, diccionarios de OBJECTS, `LAYOUT` con «DWG To PDF.pc3» y papel ISO A3/A2/A1 a 1:1, **`$EXTMIN/$EXTMAX` que encierran
la geometría real** y **vista `*Active` con centro y altura que muestran toda la extensión**. Las vistas se disponen de forma compacta
(`colocacionModelo`): ocupación del encuadre 66 % (túnel) y 41 % (edificación). `$TILEMODE = 1`: se abre en Modelo, encuadrado.

## Después
- Inspector: 0 problemas (túnel y edificación). ezdxf 1.4.5 (`recover`): 0 errores, 0 correcciones; la vista inicial cubre la extensión.
- Render independiente (ezdxf): `evidencia/despues-rc5-dxf-modelo-ezdxf.png`, `…-TW12-05-ezdxf.png`, `…-TW12-06-ezdxf.png`
  frente a `evidencia/antes-rc4-dxf-modelo-ezdxf.png`.
- El servicio **no entrega** un DXF que no supere este gate (`DXF_NO_UTILIZABLE`).

## Lo que esto NO demuestra
La hipótesis del encuadre explica parte del síntoma, pero **no se ha comprobado en AutoCAD 2027**. El cierre real del P0 exige el
registro de `UAT-PLANOS-AUTOCAD-2027.md` (apertura sin ZOOM, REGENALL, AUDIT, SAVEAS, trazado). Estado: **NO VERIFICADO**.
