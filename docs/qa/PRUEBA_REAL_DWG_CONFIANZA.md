# Prueba real — confianza del DWG (AutoCAD 2027) · paquete `0.1.0-dwgfix.ebf1dc6`

**Código:** commit `ebf1dc6` de `fix/tw-dwg-confianza` (CI verde en Windows y Ubuntu). **NO VERIFICADO EN AUTOCAD REAL** hasta que completes esto.
**Reglas:** nada de originales ni del plano de prueba anterior se toca: el anteproyecto se genera de nuevo en un proyecto **nuevo** (`Prueba Confianza DWG`). No se publica nada. Duración: ~20 min.

## 0. Instalar (sin tocar versiones anteriores)
1. Verifica el SHA-256 del `.mcpb` (PowerShell): `Get-FileHash .\tannia-workspace-dwgfix-ebf1dc6.mcpb -Algorithm SHA256` → debe coincidir con el `.sha256`.
2. Claude Desktop → Configuración → Extensiones: **desactiva** rc.3 y el paquete `50dae1b` (no los quites). Arrastra este `.mcpb`; debe decir «PRUEBA confianza DWG (ebf1dc6)». Carpeta de datos: la sugerida.
3. AutoCAD 2027 abierto (normal, no administrador) con cualquier dibujo. Anota versión (`_ABOUT`) y Windows.

## 1. Anteproyecto sin tocar originales
Proyecto nuevo + anteproyecto ~80 m² (mismo caso que la prueba anterior) con **nombre nuevo**, así el DWG previo no se toca ni se sobrescribe. El DWG se crea en `03 Trabajo\Anteproyectos\Casa 80 m2 verif\v001.dwg`.

## 2. Fidelidad DXF↔DWG — `tannia_diseno_verificar_dwg`
Esperado: `fidelidad: "fiel"`, 232 entidades en DXF y 232 leídas en DWG, `estructura.ok: true` (capas no vacías), `textos.ok: true` con `con_acentos_correctos` ≥ 2, `inconsistencias_total: 0`.

## 3. Persistencia completa — `tannia_cad_verificar_persistencia` **sin handles**
Esperado: `persistencia: "verificada"`, `entidades_leidas: 232`, `lotes` antes/después = 2/2, `no_verificables_total: 0`, `inconsistencias_total: 0`, `diferencias_total: 0`, `archivo_en_disco.sin_cambios_por_el_cierre_y_reapertura: true`. AutoCAD cierra y reabre el DWG solo.

## 4. Confirmación a ojo, tras cerrar y reabrir (en AutoCAD)
| # | Comprobación | Esperado |
|---|---|---|
| 4.1 | `LAYER` | 8 capas `TW_*` |
| 4.2 | Capa `TW_PUERTA`, clic en un arco → Propiedades | Es ARC; **Longitud de arco > 0** (= radio × π/2; p. ej. radio 900 mm → 1 413,7 mm) |
| 4.3 | Textos de recintos | **BAÑO** con Ñ, sin `\U+`, sin `?` |
| 4.4 | `ZOOM E` y conteo | Todo visible; 232 entidades (`tannia_cad_listar_entidades`, máx 5000) |
| 4.5 | `AUDIT` (Sí) | 0 errores |

## 5. Registrar (HOJA_RESULTADOS.md)
Por paso: ✅/❌/**NO CONCLUYENTE**, y **el JSON exacto** devuelto (mensaje de error completo, `codigo`, `detalle`). Qué significa cada estado:
- `no_concluyente`: AutoCAD no informó una propiedad (campo `no_verificables` / `inconsistencias_internas` dice cuál). **No es aprobado.** Envíalo completo.
- `con_diferencias` / `fallida`: hay una diferencia real; envía `diferencias` y `faltan_por_tipo`.
- Error (`AUTOCAD_ERROR`, `tiempo_agotado`…): copia texto y `detalle` tal cual.
No marques nada que no hayas ejecutado. Al terminar: «Verifica la integridad de los originales» → íntegros.
Volver atrás: desactiva esta extensión y activa la anterior.
