# Hoja de resultados — primera prueba real del asistente de anteproyectos

Paquete: `tannia-workspace-diseno-50dae1b.mcpb` (commit `50dae1b`).
Fecha: ____ · AutoCAD (`_ABOUT`): ________ · Windows: ________ · Extensión visible en Claude Desktop: ________
Marca ✅ solo si lo ejecutaste y coincidió; ❌ si falló (anota el texto EXACTO del error); ➖ si no lo ejecutaste. **No dejes ✅ sin haberlo hecho.**

| Paso | Qué se comprueba | Resultado | Observaciones / error exacto |
|---|---|---|---|
| 0.1 | Tamaño y SHA-256 del `.mcpb` coinciden | | |
| 1.2 | Se instala; aparece «PRUEBA anteproyectos (50dae1b)»; rc.3 desactivada | | |
| 1.4 | Diagnóstico «Todo en orden» | | |
| 1.5 | Menciona `tannia_diseno_crear` | | |
| 2.3 | Original de prueba registrado (solo ese archivo) | | |
| 3 | v001: 79,75 m² construidos, 68,11 útiles, 8 recintos con las superficies de la guía | | |
| 3 | Supuestos, preguntas y aviso «no apto para construcción» presentes | | |
| 3 | `v001.svg` se ve como `Casa80m2-v001.png` | | |
| 4.1 | `v001.dwg` creado por AutoCAD; `cabecera_dwg_valida: true`; 232 entidades; 8 capas `TW_*`; INSUNITS 4 | | |
| 4.2 | (si falló) plan B: abrir el DXF a mano y `SAVEAS`; avisos al abrir el DXF | | |
| 4.3 | `tannia_cad_estado` conecta | | |
| 5.1 | Las 8 capas existen | | |
| 5.2 | `ZOOM E` sin objetos lejanos | | |
| 5.3 | Muro = LINE; mover con STRETCH y UNDO OK | | |
| 5.4 | Recinto = polilínea cerrada; `AREA` del living ≈ 17 870 000 mm² | | |
| 5.5 | Textos editables; «BAÑO» con ñ, sin `\U+` | | |
| 5.6 | `DIST`: 11 000 × 7 250 mm | | |
| 5.7 | `INSUNITS` = 4 | | |
| 5.8 | `AUDIT`: 0 errores | | |
| 5.9–5.10 | Cotas como líneas+texto; puertas = LINE + ARC | | |
| 6.2 | `tannia_cad_verificar_persistencia`: `verificada`, sin diferencias, mismo SHA-256 antes/después | | |
| 6.3 | 232 entidades tras reabrir | | |
| 6.4 | Cerrar AutoCAD y reabrir el DWG: mismo contenido | | |
| 7.1 | v002: D2 3,00×2,68 = 8,04 m²; D3 6,67 m²; «sin cambios: 6» | | |
| 7.2 | v003: closet 3,22 m²; DP 4,73 m²; «sin cambios: 7»; ventana norte retirada y avisada | | |
| 7.3 | Verificar: 0 errores de coherencia; DXF ok | | |
| 7.4 | Deshacer → v002 (DP 8,39 m²); v003 sigue en disco; rehacer → v003 | | |
| 7.5 | `v002.dwg` creado (232); repetir se niega (`DWG_YA_EXISTE`) | | |
| 9 | Originales íntegros; nada nuevo en `02 Originales`; todo en `03 Trabajo\Anteproyectos\Casa 80 m2\` | | |

## Veredicto del PO
☐ APROBADO ☐ APROBADO CON OBSERVACIONES ☐ NO APROBADO (la integración solo se declara aprobada tras completar esta hoja en tu equipo)

Observaciones generales (distribución arquitectónica según tu criterio profesional, calidad del plano, edición en AutoCAD):
