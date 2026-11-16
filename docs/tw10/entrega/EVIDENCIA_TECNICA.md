# TW-10 — Informe de transferencia para la revisión independiente (PR #12) — rev. rc3 (tras las pruebas reales rc1/rc2: F01–F10)
> **Actualización rc3:** esta revisión incorpora las correcciones de la auditoría de campo G10 (`HALLAZGOS_CAMPO_F01_F05.md` y `HALLAZGOS_CAMPO_F06_F10.md`). Lo que sigue describe el estado vigente; rc1 (`151c0a1`) y rc2 (`6211397`) quedan como históricos.
Autor: agente implementador (Claude Code). **Este informe no es una aprobación.** CI verde ≠ aceptación de arquitectura, UX ni producto. Revisor: Director de Revisión Independiente (ChatGPT), separado del implementador.

## 1. Identidad del PR
- PR: https://github.com/cristobalMundacaV1/tannia-workspace/pull/12 (**draft**), rama `feat/tw10-architectural-reasoning` → base `feat/tw09-autonomia`.
- **Base exacta:** `eb767891fe2dacbb4d3070653b1353ebde245243` (merge-base verificado; CI verde en la base: run 43880085863).
- **SHA de código final (rc3):** `f0141fac621a770fd391e946ba080c250f12b6e1` (`f0141fa`). Los commits posteriores **solo cambian `docs/`** (verifique con `git diff f0141fa..<HEAD> --stat -- src scripts test fixtures`; debe estar vacío). Históricos: rc1 = `ee8a0e6`; `505444d` (commit intermedio con una prueba E14/E11 desactualizada, corregida en `6211397`: su CI debe ignorarse). `git rev-parse HEAD` da el HEAD completo actual.
- Alcance del diff vs base: 67 archivos, +13 003 / −4, 12 commits al empaquetar. Archivos **existentes** modificados (4): `src/tools/index.js` (registro), `src/politica/autonomia.js` (rama de enrutamiento), `src/server.js` (instrucciones), `scripts/paquete-prueba.mjs` (`--fase`). **Todo lo demás es nuevo.** No se tocó `main`, el PR #11 ni otras ramas.

## 2. Inventario
- `src/architect/` (20 módulos, ~1 800 líneas): `schemas` (Zod brief/1, site/1, weather/1, scheme/2, decision/1, analysis/1) · `solar` · `clima` · `sitio` · `briefing` · `poligonos` · `derivar_poly` · `a3d` · `convertir` · `partidos` · `alternativas` · `diversidad` · `sombras` · `habitabilidad` · `evaluacion` · `reporte` · `servicio` · `version`.
- `src/tools/arquitectura.js`: 11 herramientas `tannia_arq_{encargo,sitio,clima,generar_alternativas,evaluar,estudiar_sol,comparar,decisiones,refinar,publicar,ver}`.
- `test/tw10_*.test.js` (14 archivos nuevos, 86 pruebas), `test/helpers_epw.js`, `fixtures/tw10/solar_oracle.json`, `examples/tw10/`, `docs/tw10/`, `docs/agent-continuity/TW10_{STATE.json,HANDOFF.md}`.
- Se reutilizan sin modificar: `src/arq3d/*` (motor 3D), `src/design/{contorno,salidas,servicio}` (DXF/SVG), `src/project/transaccion` (versiones transaccionales), `src/cad/*`.

## 3. Contratos arquitectónicos implementados
- `tw.arch.{brief/1,site/1,weather/1,scheme/2,decision/1,analysis/1}` en `src/architect/schemas.js`. Política epistémica: `unknown ⇒ valor null`; evidencia `computed` exige método+hash de entrada; clima de archivo nunca `validated`; estado global del análisis ∈ {`no_conclusive`,`con_alertas_criticas`,`sin_alertas_detectadas`} (nunca «excelente/apto/cumple»).
- **Convención del norte:** `true_north_deg_from_local_plus_y_clockwise = n` ⇒ rumbo local = n + rumbo geográfico (+Y local arriba; horario). **Defecto encontrado y corregido** en G3: `vectorSolLocal` usaba el signo opuesto y una prueba temprana codificaba ese error; ahora hay pruebas de ambos sentidos (norte a +X, este a −Y).
- **Geometría (L, C, patio) — `derivar_poly.js`:** recintos rectangulares a ejes sin solapes (error `RECINTOS_SOLAPADOS`); muros por aristas elementales (exterior = 1 recinto, interior = 2); extensión de encuentros por semiespesor del muro perpendicular; **huella = unión de rectángulos (muros ∪ recintos)** por compresión de coordenadas, anillos exteriores CCW y huecos CW (`poligonos.contornosDeUnion`); un vacío interior **debe estar declarado** (`open_courts_mm`) o es `HUECO_NO_DECLARADO`; `PATIO_INEXISTENTE`; `HUELLA_INCONSISTENTE`; recinto sin acceso ⇒ `RECINTO_SIN_ACCESO` (BFS sobre puertas/pasos/separaciones abiertas); vano inválido/solapado ⇒ error. El 3D (`a3d.js`) usa losa/cubierta **sobre la huella real** (anillo; con patio central, rectángulos disjuntos), nunca la caja envolvente; cubierta inclinada sobre huella no rectangular ⇒ rechazo explícito `CUBIERTA_NO_SOPORTADA`. Reutiliza `coherenciaConGeo` (2D↔3D por facetas) sin cambios.
- **Diversidad real:** `diversidad.js` = clase de huella (rectangular/L/C/patio_interior…) + hash de topología Weisfeiler–Lehman del grafo de conexiones; invariante a giros/espejos (probado con las 8 simetrías del cuadrado y con las variantes A/B de v1).

## 3b. Cambios de la auditoría de campo (rc2)
F01 evaluar compacto + secciones; F02 vistas/luz/presupuesto con preguntas por ambigüedad; F03 `modo` actualizar/reemplazar; F04 métricas con fórmula/lectura/límites; F05 alertas con código y acción. Matriz con causa, reproducción, corrección y evidencia: `HALLAZGOS_CAMPO_F01_F05.md`. **Cambios de contrato:** `tannia_arq_evaluar` (resumen por defecto; `seccion:'completo'` = anterior), `tannia_arq_ver` (brief compacto; `brief_completo`), `tannia_arq_encargo` (`modo`); `ok()` genera el JSON del texto sin sangría antes de recortar.

## 3c. Cambios de la prueba real rc2 (rc3)
F06 interpretación por cláusulas (negación, intención, prioridad local); F07 deduplicación semántica e idempotencia; F08 identidad servidor/motor/paquete; F09 visual preliminar vs. punto de observación confirmado; F10 tercera alternativa `lineal` y conteo honesto de elegibles. Matriz: `HALLAZGOS_CAMPO_F06_F10.md`. **Evidencia literal del mensaje rc2: pendiente de aportar por el PO** (fixture reconstruido, declarado).

## 4. Correspondencia 45 historias ↔ evidencia
Ver `docs/tw10/TW10_EVIDENCE_MATRIX.md` (tabla completa con archivo de prueba por historia y estado `PASA_CI`/`PARCIAL`/`EXTERNO`; incluye los 15 escenarios). Parciales **declarados**: 03-03 (Open-Meteo solo caché local, sin red, por ADR), 05-01 (patio central: geometría probada, sin generador), 06-04 (sin conectores avanzados), 10-04 (dossier a falta de campo).

## 5. Estado G0–G10
| Gate | Automatizado | Real |
|---|---|---|
| G0–G9 | SUPERADA_TECNICA_AUTOMATIZABLE (CI verde, ver §7) | — |
| G10 (CI/propiedades/fuzz) | Propiedad de 150 huellas aleatorias (rect/L/U), fuzz de nombres, CI Windows+Ubuntu | — |
| G10 AutoCAD 2027 real | — | **NO EJECUTADO** |
| G10 Claude Desktop real | verificación como cliente MCP stdio desde el bundle | **NO EJECUTADO** (instalación gráfica) |
| G10 taller Tannia + revisión independiente | — | **NO EJECUTADO** |
Nada de lo «real» está aprobado. El agente no fija `ACEPTADO_POR_PO`.

## 6. Pruebas
- Línea base TW-09: 192 pruebas / 175 pasan / 0 fallan / 17 omitidas. **TW-10 rc3: 320 / 303 pasan / 0 fallan / 17 omitidas** (+128 nuevas: 86 de G0–G9, 16 de F01–F05 y 26 de F06–F10; ninguna de TW-09 modificada; una prueba propia de TW-10, E14/E11, se adaptó al brief compacto de `ver`).
- **Las 17 omitidas** (idénticas a la base): 16 «PowerShell real» (`test/tw09_windows_powershell.test.js`, requieren `powershell.exe`; **se ejecutan en el job `windows-latest` del CI**, sin AutoCAD: usan un mock COM) y 1 «TW-05: carpeta sin permiso de escritura» (se omite por diseño si se ejecuta como root **o en Windows**; en el job Ubuntu del CI, que no es root, sí corre). En Linux local como root se omiten las 17; en el CI Windows corren las 16 de PowerShell y se omite la de TW-05.
- Reproducir: `npm ci && npm test` (Node 22).

## 7. CI (Windows + Ubuntu, matriz del workflow `ci`)
| SHA | Contenido | Run push | Resultado |
|---|---|---|---|
| ff428ff | G0 | 43892140557 | success |
| 63019ca | G5 | 43893628283 | success |
| fd5fb4c | G7/G8 | 43895263785 | success |
| 56aef38 | G9 | 43900583395 | success |
| ee8a0e6 | código rc1 | 43901501563 (PR: 43901518587) | success |
| 505444d | rc2 intermedio (prueba desactualizada) | 43931677488 | failure (esperado: prueba E14/E11 desactualizada; corregida en 6211397) |
| **6211397** | **código final rc2** | **43931959889** | **success** (Windows+Ubuntu) |
| dc5b58d | docs | 43901639327 | success |
| 280d1b4 | docs (HEAD al empaquetar) | 43902401079 (PR: 43902414522) | success |
URL: `https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/<id>`. **Artefactos del CI** (`tannia-mcpb-windows-latest` 2 010 528 B, `…ubuntu-latest` 2 010 538 B en el run 43901501563) son **otro build**: `npm run pack` con el manifiesto por defecto (`name: tannia-workspace`, versión `0.1.0-rc.3`, **mismo id que TW-09**); **no** son el candidato entregado (`tannia-workspace-tw10`). No instale esos artefactos.

## 8. Oráculos, fixtures y tolerancias (solar)
- Oráculo independiente: **pvlib 0.16.1 `solarposition.spa_python`** (implementación del algoritmo NREL SPA), solo desarrollo (no empaquetado). Valida su fidelidad: reproduce el ejemplo publicado de NREL SPA (39,742476°, −105,1786°, 2003-10-17 12:30:30 −07:00: cenit aparente 50,111622°, azimut 194,340241°).
- Fixture: `fixtures/tw10/solar_oracle.json` — 168 casos (7 lugares: Santiago, Puerto Montt, Arica, Buenos Aires, Madrid, Quito, Oslo × solsticios/equinoccios × 6 horas locales), presión 101 325 Pa, 12 °C. Se comparan los 149 con elevación >3° (cerca del horizonte domina la refracción).
- Motor propio `src/architect/solar.js` (Meeus/NOAA + paralaje + refracción estándar, ΔT Espenak–Meeus). **Error máximo medido: azimut 0,0242°, elevación aparente 0,0064°.** Tolerancias de la prueba: <0,06° y <0,05°. Hora civil → UTC por IANA (`Intl`), DST de Chile (UTC−3 dic/UTC−4 jun) y hora inexistente rechazada; los 168 instantes locales coinciden con los del oráculo.
- Sombras: oráculo geométrico de `rayoGolpea` (casos analíticos), invarianza por rotación casa+norte, monotonía de aleros (prueba), sol de contexto con altura desconocida ⇒ `no_concluyente`.

## 9. Preservación de versiones y originales
`tw10_escenarios` E14/E11: proyecto con anteproyecto v1 y modelo 3D previos → tras el flujo TW-10 **el SHA-256 de todos los archivos previos de `03 Trabajo` es idéntico**, otro proyecto no cambia, el estudio conserva versiones (v002 sigue con el encargo de 90 m² tras cambiar a 110 m²). `tw10_g9_mcp`: `v002.json` mantiene su hash tras 8+ versiones; aislamiento entre proyectos; fuzz de nombres (`../../x`, `CON`, `a:b`, NUL…) no sale de `03 Trabajo/Arquitectura`. Las versiones usan `commitConHistorial` (staging+journal+manifiesto+bloqueo) de TW-09. **Pendiente real:** ACL/junctions/OneDrive/antivirus (heredado de TW-09).

## 10. Paquete (verificado en Linux)
`tannia-workspace-tw10-f0141fa-rc3.mcpb` (SHA-256 `a50c568362f59196a7ad518d95b3e3198bf82111f377ecae89528db7f0077cc9`), construido desde el código `f0141fa` (rc1 `13e37b45…9f31` y rc2 `de7a502a…2f6d` quedan **superados**; los hashes **difieren** porque el código cambió): manifiesto 0.3 válido (`mcpb validate`), nombre ASCII sin separadores, **desempaquetado en una ruta con espacios y «ñ»** y ejecutado **solo con `server/index.js`** (sin node_modules): 72 herramientas (61 TW-09 + 11 `tannia_arq_*`), 0 esquemas inválidos (sin `items` en arreglo), `tannia_diagnostico` OK, flujo encargo→alternativas→evaluar compacto OK con carpeta Unicode (el texto de `evaluar` llega completo: 6 885 caracteres sin recorte, con alertas, circulación y objetivos). **No verificado en Windows real ni en Claude Desktop.**

## 11. Limitaciones y riesgos pendientes
Ver `LIMITACIONES_CONOCIDAS.md`. Riesgos principales: (1) sin AutoCAD real, los DWG 2D/3D de TW-10 no están validados (el adaptador COM es el de TW-09); (2) el léxico de interpretación es por reglas en español: frases fuera de él quedan «desconocidas»; (3) posición de piscina supuesta; (4) superficies <~104 m² con «dos alas» exceden lo pedido (avisado); (5) generación limitada a 1 piso, recintos rectangulares; (6) UX conversacional real sin probar con Tannia; (7) la elección «en L = orienta, no bloquea» es una decisión de producto a confirmar; (8) las heurísticas de privacidad/acústica (`heur-1`) no son normativas.

## 12. Qué revisar primero (sugerido)
1) Que `git diff ee8a0e6..HEAD -- src test scripts fixtures` esté vacío. 2) `src/architect/derivar_poly.js` + `a3d.js` (huella real) y `test/tw10_g4_geometria`. 3) `src/architect/evaluacion.js` (gates duros vs informativos, Pareto, ledger). 4) Lenguaje de las salidas (nunca «cumple», «seguro», «apto»). 5) `servicio.js` (versionado inmutable, saneo de nombres). 6) El protocolo `PROTOCOLO_PRUEBA_REAL.md`.
