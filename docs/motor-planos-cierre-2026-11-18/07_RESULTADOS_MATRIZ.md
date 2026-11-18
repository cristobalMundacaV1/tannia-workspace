# Resultados de la matriz de 40 casos (03_MATRIZ_GATES.csv) — implementación 0.3.0-rc.5

**Rama:** `claude/lucid-hamilton-2onsol` (apilada sobre PR #38, base `2e5349f`). **Versión:** `0.3.0-rc.6` (rc.5 retirada tras G11 fallido).
**Leyenda de estado:**
- `AUTOMÁTICO ✔` — prueba ejecutable en `npm test` (Ubuntu y Windows en CI; ezdxf obligatorio con `TW_REQUIRE_EZDXF=1`).
- `ZIP ✔` — paso del verificador del ZIP instalado (`scripts/rc-verificar-zip.mjs`), Ubuntu y Windows.
- `WINDOWS CI` — solo se ejecuta completo en `rc-zip-windows` (binario gráfico win32-x64).
- `NO VERIFICADO` — requiere AutoCAD 2027 real o revisión profesional; **no se simula**.

| Gate | Caso | Estado | Evidencia (prueba / paso) |
|---|---|---|---|
| G0 | PL-G00 | AUTOMÁTICO ✔ | `tw33` «PL-G00 baseline»: DXF de rc.4 regenerado (SHA-256 `fbbda8cd…`, 47 entidades) + oráculos 3844,372083 / 162,164593 / 1010 / 2234,946783 |
| G1 | PL-DXF-01 | AUTOMÁTICO ✔ (primero-falla) | `tw33` «PL-DXF-01»: el DXF de rc.4 falla 15 clases de defecto; el nuevo pasa. Mutaciones (sin *Active, sin $EXTMIN, sin capa 0, sin viewport general) vuelven a fallar |
| G1 | PL-DXF-02 | AUTOMÁTICO ✔ + ezdxf | `tw33` «PL-DXF-02» (inspector) y «lector independiente (ezdxf)»: 7 layouts, 0 errores, *Active cubre la extensión real, altura de vista = altura × escala; `tw12_workspace` oráculo ezdxf |
| G1 | PL-DXF-03 | **NO VERIFICADO** | AutoCAD 2027 real: `documentos/UAT-PLANOS-AUTOCAD-2027.md` (pasos A–H) |
| G1 | PL-DXF-04 | AUTOMÁTICO ✔ (parcial) | `tw33` «PL-DXF-04»: DIMENSION girada 90°, DIMLFAC = 1/5 en el perfil, estilo de cota por escala; REGEN en AutoCAD real **NO VERIFICADO** |
| G2 | PL-IR-01 | AUTOMÁTICO ✔ | `tw33` «PL-IR-01»: inventario tw.drawing/1 completo en tw.drawing-ir/2; cantidades idénticas |
| G2 | PL-IR-02 | AUTOMÁTICO ✔ | `tw33` «PL-IR-02 / PL-HATCH-03»; edificación: medir planta → `MEDICION_NO_AUTORIZADA` |
| G2 | PL-SYM-01 | AUTOMÁTICO ✔ | `tw33` «PL-SYM-01»: catálogo válido; entradas corruptas, símbolo o estilo inexistentes rechazados |
| G2 | PL-SYM-02 | AUTOMÁTICO ✔ | `tw33` «PL-SYM-02»: color/mono con mismo grosor y trazo; DXF con capa/tipo/grosor equivalentes |
| G3 | PL-HATCH-01 | AUTOMÁTICO ✔ | `tw33` «PL-HATCH-01»: 7 casos inválidos rechazados antes de escribir |
| G3 | PL-HATCH-02 | AUTOMÁTICO ✔ | `tw33` «PL-HATCH-02»: HATCH con mismo patrón/paso/contorno/material/ref; tinta en el PDF rasterizado; área de control = área de revestimiento |
| G3 | PL-HATCH-03 | AUTOMÁTICO ✔ | `tw33` «PL-IR-02 / PL-HATCH-03»: cubicaciones idénticas con y sin tramas/detalles |
| G4 | PL-LEG-01 | AUTOMÁTICO ✔ | `tw33` «PL-LEG-01»: leyenda = estilos/tramas/símbolos usados por lámina, cada fila con muestra y texto |
| G4 | PL-CALLOUT-01 | AUTOMÁTICO ✔ | `tw33` «PL-CALLOUT-01»: D1–D4 05→06 y 06→05; huérfano, duplicado, destino inexistente rechazados |
| G4 | PL-CALLOUT-02 | AUTOMÁTICO ✔ | `tw33` «PL-CALLOUT-02»: 0 colisiones; colisión forzada detectada |
| G4 | PL-DETAIL-01 | AUTOMÁTICO ✔ | `tw33` «PL-DETAIL-01…04» (D1: arcos r y r−e, espesor 0,08) |
| G4 | PL-DETAIL-02 | AUTOMÁTICO ✔ | idem (D2: sin geometría bajo el piso; solera/drenaje PENDIENTES) |
| G4 | PL-DETAIL-03 | AUTOMÁTICO ✔ | idem (D3: cabeza = símbolo esquemático no medible; sin placa/tuerca/lechada) |
| G4 | PL-DETAIL-04 | AUTOMÁTICO ✔ | idem (D4: SIN ESCALA, sin cota de traslapo; longitud PENDIENTE) |
| G5 | PL-TABLE-01 | AUTOMÁTICO ✔ | `tw33` «PL-TABLE»: 10 filas × 101 anillos = 1010 = cubicación; «1010 pernos» en PDF y DXF; `e2e_g06` |
| G5 | PL-TABLE-02 | AUTOMÁTICO ✔ | idem: 5,50 y 25,629147 impresos |
| G5 | PL-TABLE-03 | AUTOMÁTICO ✔ | idem: especificaciones técnicas PENDIENTE (ninguna inventada) |
| G5 | PL-CSV-01 | AUTOMÁTICO ✔ | `tw33` «PL-CSV-01 / PL-E2E»: columnas `distribucion.*`, sin «[object Object]» |
| G6 | PL-SHEET-01 | AUTOMÁTICO ✔ | `tw33` «PL-SHEET-01/02»: A3/A2/A1 × 2 dominios, 0 recortes/colisiones/solapes, escala exacta |
| G6 | PL-SHEET-02 | AUTOMÁTICO ✔ / impresión **NO VERIFICADA** | perfil ≥ 2,5 mm, jerarquía lámina 4 > vista 3 > cuerpo 2,5; prueba de impresión al 100 % pendiente |
| G6 | PL-SHEET-03 | AUTOMÁTICO ✔ | `tw33` «PL-SHEET-03»: paginación a láminas de continuación sin reescalar; `VISTA_NO_CABE` |
| G7 | PL-PARITY-01 | AUTOMÁTICO ✔ + ZIP 5e | `tw33` «PL-PARITY-01»; servicio: `PARIDAD_DXF_FALLIDA` / `PARIDAD_PDF_FALLIDA` bloquean la entrega |
| G7 | PL-PARITY-02 | AUTOMÁTICO ✔ | `tw33` «PL-PARITY-02»: trama, globo, celda eliminados; valor y tipo de línea alterados; PDF de otra revisión |
| G7 | PL-VISUAL-01 | AUTOMÁTICO ✔ / revisión humana **PENDIENTE** | firmas golden `test/fixtures_drawing/golden_firmas.json` (regenerar solo tras revisar PNG: `scripts/drawing-golden.mjs`) |
| G8 | PL-DOMAIN-01 | AUTOMÁTICO ✔ | 6 láminas: planta, perfil, sección, detalles, fortificación, D1–D4; 4 cuadros; leyenda en todas |
| G8 | PL-DOMAIN-02 | AUTOMÁTICO ✔ | muro con vano: 15,6 − 1,8 = 13,8 m², solo la elevación se mide; sin material declarado no hay trama |
| G9 | PL-E2E-01 | AUTOMÁTICO ✔ | `e2e_g06` (A→B→A), `tw12_workspace` (revisión inmutable / alteración detectada) |
| G9 | PL-E2E-02 | AUTOMÁTICO ✔ | `tw12_workspace` (originales intactos), `tw28`/`tw29`, verificador ZIP pasos 6–11 |
| G10 | PL-RC-5B | ZIP ✔ / WINDOWS CI | 5b: láminas 01–05 + 06 (D1–D4) desde el paquete instalado |
| G10 | PL-RC-5C | ZIP ✔ / WINDOWS CI | 5c sin cambios |
| G10 | PL-RC-5D | ZIP ✔ (Ubuntu: juego de referencia) / WINDOWS CI (instalado) | 5d: inspector + paridad DXF↔IR, HATCH y cuadros |
| G10 | PL-RC-5E | ZIP ✔ / WINDOWS CI (sin Claude) | 5e: paridad PDF, firmas, CSV, 2 dominios; en Windows `--planos-prueba` idéntico byte a byte al juego de referencia |
| G10 | PL-RC-VERSION | AUTOMÁTICO ✔ | `0.3.0-rc.5` en `src/version.js`, `package.json`, `package-lock.json`, manifiesto y nombre del ZIP (rc.5 libre en todas las ramas remotas) |
| G11 | PL-UAT-CAD-01 | **FALLIDO en rc.5** (DIMSTYLE código 5 → AutoCAD descartó el DXF); corregido en rc.6, **NO VERIFICADO** en AutoCAD hasta nueva UAT | regresión `tw33` «G11 UAT AutoCAD 2027»; AutoCAD 2027 real (registro en `UAT-PLANOS-AUTOCAD-2027.md`) |
| G12 | PL-UAT-PRO-01 | **NO VERIFICADO** | revisión profesional externa; hasta entonces «BORRADOR PARA REVISIÓN» |

**Resumen:** 36 casos con evidencia automática ejecutada (algunos con componente humano pendiente: PL-DXF-04 REGEN, PL-SHEET-02 impresión, PL-VISUAL-01 revisión); 4 casos **NO VERIFICADOS** por requerir AutoCAD 2027 real o un profesional (PL-DXF-03, PL-UAT-CAD-01, PL-UAT-PRO-01 y la parte AutoCAD de PL-DXF-04). Los resultados de CI por SHA se registran en `09_CANDIDATO_RC5.md`.
