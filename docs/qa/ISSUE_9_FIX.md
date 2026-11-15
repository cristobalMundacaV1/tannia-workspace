# Issue #9 y cierre de la validación 2D — análisis y corrección (RC 0.1.0-rc.3)

> Estado: **corregido y probado con pruebas automatizadas (Linux y Windows PowerShell 5.1 real con AutoCAD simulado)**. La validación funcional 2D contra AutoCAD 2027 real queda **PENDIENTE de la repetición final** (§Protocolo).

## Issue #9 — archivos DWL/DWL2
| Aspecto | Antes (rc.2) | Ahora (rc.3) |
|---|---|---|
| Qué se registra | Todo archivo de `02 Originales`, incluidos `.dwl/.dwl2` | Solo lo admitido por la **política explícita** `src/project/originals_policy.js` |
| Política | — | **Deny** de residuos transitorios con justificación (`.dwl`, `.dwl2`, `.sv$`, `.ac$`, `.bak`, `~$*`, `.tmp/.part/.crdownload`, `Thumbs.db`, `desktop.ini`, `.DS_Store`). **Invariante**: DWG/DXF/PDF/DWT/DWS/DWF *nunca* son excluibles (se comprueba con nombres adversarios: `x.dwl.dwg`, `~$x.dwg`, `x.tmp.pdf`) |
| Locks | hash + `chmod 444` (podía impedir que AutoCAD los borrara) | **no se hashean ni se les cambian permisos**; no cuentan como evidencia de integridad |
| Verificación | un lock cambiado/ausente = falso "modificado/faltante" | ignora residuos; reporta `posiblemente_abiertos_en_autocad` (informativo) |
| Dibujo abierto al registrar | se fingía respaldo inmutable | **`captura_inestable`**: advertencia explícita + marca en el manifiesto + nota si luego difiere el hash |
| Copia de trabajo con lock | sin aviso | advierte; **no toca ni borra** locks; no copia residuos (`ARCHIVO_TRANSITORIO`) |
| `.bak` | registrado como original | no es original; advertencia (AutoCAD lo crea al *guardar* un dibujo existente: posible guardado del original) |
| Manifiesto | mapa plano | **v2** `{archivos, migrados}`; **migración segura**: entradas de DWG genuinos intactas (sha256, bytes, fecha), locks apartados *con su hash histórico*, permisos de escritura restaurados solo en los que este producto había protegido; idempotente; también vía `tannia_proyecto_reparar` |
| Metadatos | solo hash | hash (autoridad) + tamaño + fecha: cambio de fecha con hash idéntico se informa como nota |

Pruebas: `test/tw11_originals_policy.test.js` (lock presente/ausente/cambiado, DWG modificado/faltante con locks, nombres adversarios, migración desde manifiesto rc.2, original sin cambios de hash/tamaño/fecha tras copiar y registrar). Se encontró y corrigió un defecto durante el desarrollo: el nombre del lock es el del dibujo **sin extensión** (`plano.dwl` para `plano.dwg`).

## Lectura real de geometría y cierre del rectángulo
- `tannia_cad_leer_geometria`: `StartPoint`/`EndPoint`/`Length`/capa/tipo por COM. `tannia_cad_medir_entidad` también los devuelve.
- `tannia_cad_verificar_contorno`: encadena las líneas sin importar orden/sentido y calcula **en Node, de forma independiente**: cierre (tolerancia explícita), ángulos de 90°, lados opuestos iguales, área, perímetro, coplanaridad en Z y coincidencia con ancho/alto esperados. Detecta huecos, líneas sueltas, duplicadas, longitud cero, no-rectángulos.
## Persistencia del DWG guardado
`tannia_cad_verificar_persistencia`: con la **copia** activa y guardada → lee → `Close($false)` → `Documents.Open` → vuelve a leer → compara. Guardas: la copia pedida y la activa deben ser la misma y estar en `03 Trabajo` (nunca originales); se exige `Saved=true` (nunca se cierra con cambios pendientes); un único `Close`, siempre sin guardar; huella/tamaño/fecha del archivo antes y después (el cierre/reapertura no debe alterarlo); `creado_en` opcional prueba que el archivo se escribió *después* de crear las líneas. Límite declarado: el contenido del DWG no se interpreta fuera de AutoCAD.

## Evidencia
Ver `EVIDENCE_MATRIX.md` (E-I9-*) y `CAD_CAPABILITY_MATRIX.md`: `autocad_com` marca SUPPORTED **solo** `LINE.longitud` y `LINE.editar_en_copia`, con la evidencia real del usuario (AutoCAD 2027 R26.0, rc.2, issue #8). Lectura de extremos y persistencia siguen UNVERIFIED hasta la repetición.

## Protocolo de la repetición final (aceptación 2D)
Ruta **con apóstrofo y acentos** (sin renombrar carpetas). 1) `tannia_diagnostico` (carpeta y advertencias). 2) Original DWG 6000×4000 en `02 Originales` con AutoCAD **abierto** (así aparecen `.dwl`): `tannia_originales_registrar` → debe listar los locks en `ignorados` y advertir captura inestable. 3) Cerrar el original, `tannia_originales_registrar` de nuevo si se desea captura estable. 4) `tannia_copia_trabajo` → `tannia_cad_abrir_copia` → `tannia_cad_agregar_lineas` (4 líneas, `TW_PRUEBA`). 5) `tannia_cad_verificar_contorno` con los 4 handles (`ancho 6000`, `alto 4000`): esperado `cerrado`, `es_rectangulo`, área 24 000 000. 6) `tannia_cad_verificar_persistencia` con `creado_en` devuelto en el paso 4: esperado `verificada`. 7) `tannia_originales_verificar`: íntegros (hash). Registrar versión y resultado por operación → actualizar la matriz.
