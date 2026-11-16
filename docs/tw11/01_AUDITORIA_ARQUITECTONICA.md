# TW-11 · 01 — Auditoría arquitectónica del estado actual (TW-00 → TW-10)
**Base auditada:** rama `feat/tw10-architectural-reasoning` @ `64cdec3` (código `f0141fa`; PR #12 draft). Hechos verificados leyendo el repositorio el 2026-11-16 (tamaños en líneas de JS; `src/`). **Auditoría estática**: no se ejecutó AutoCAD ni Claude Desktop reales. Una capacidad *implementada* no es una capacidad *validada en hardware real* (columna «Nivel»).
Niveles de validación usados en todo el expediente: **N0** solo documentado · **N1** implementado y probado con simuladores/fixtures (CI) · **N2** probado con herramienta real (AutoCAD/Claude Desktop) por el PO · **N3** revisado por profesional competente.

> **Revisión R1:** esta auditoría no cambia; sus hallazgos H1 y H3 se resuelven con el contrato de interpretación (doc 02 §0.1) y la política de roles numéricos (doc 02 §8). Ver `11_MATRIZ_RESOLUCION_CIC.md`.

## 1. Inventario real
| Área | Módulo (`src/…`) | Líneas | Qué hace realmente | Nivel |
|---|---|---|---|---|
| Servidor MCP | `server.js`, `tools/*` (6 archivos), `mcp/` | ~1 100 | 72 herramientas (61 TW-09 + 11 `tannia_arq_*`); instrucciones del servidor; respuestas `ok()/fail()` con tope de texto | N1 (Desktop: pruebas reales rc1–rc2 con defectos F01–F10 ya corregidos en rc3; rc3 sin repetir) |
| Seguridad y proyectos | `security/sandbox.js`, `project/*` | ~800 | Sandbox de rutas, originales protegidos, identidad de proyecto, importación segura, **versiones transaccionales** (`commitConHistorial`, bloqueos entre procesos) | N1 (ACL/OneDrive/antivirus reales: N0) |
| DXF 2D/3D (lectura) | `dxf/{reader,measure,geometry,mesh3d,inspect}.js` | 679 | Lector propio de DXF: `LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE, INSERT, 3DFACE, MESH, TEXT, MTEXT`; longitudes, perímetros, áreas, volumen de mallas cerradas; unidades (`INSUNITS` vs confirmación) | N1 (solo fixtures `ezdxf`; **DXF reales de AutoCAD: N0**) |
| PDF | `pdf/pdf.js` | 182 | Inspección vectorial, calibración de escala, medición con polilíneas | N1 |
| Cantidades | `quantities/engine.js` | 77 | Medición → partida → **regla constructiva** (9 reglas, p. ej. `area_por_espesor`) → cantidad; sin parámetros por defecto | N1 |
| Presupuesto | `budget/{calc,xlsx}.js` | 214 | APU (insumos, rendimientos), presupuesto, XLSX con fórmulas | N1 |
| Informes | `report/memoria.js` | 62 | Memoria PDF (pdfkit) con trazabilidad | N1 |
| Normativa/conocimiento | `normativa/`, `conocimiento/{fuentes,criterios,index}.js` | ~165 | **Registro estático** de 16 instrumentos (LGUC, OGUC, NCh433/430/2123/1198/1537/3171/853/1079, NCh Elec 4, RIDAA, gas, INN, BCN…) con tema y URL; criterios de diseño de **vivienda** (espesores, anchos de recintos). **No contiene valores normativos ni búsqueda de texto** | N1 |
| Autonomía | `politica/autonomia.js` | 88 | Política actuar/suponer/preguntar/detenerse + **enrutador de 5 capacidades** (`anteproyecto_vivienda`, `modelo_3d_estructurado`, `trabajo_sobre_antecedentes`, `diseno_arquitectonico_razonado`, `no_soportado`) | N1 |
| Diseño v1 (vivienda) | `design/*` | 1 092 | Generador de **un piso rectangular** (2–3 dorm., 1–2 baños, 55–130 m²), operaciones editables, DXF R12/SVG | N1 |
| Modelo 3D | `arq3d/*` | 456 | **Modelo estructurado general**: niveles, muros con vanos, losas poligonales ortogonales, cubiertas (plana/1 agua/2 aguas) → prismas/cuñas; coherencia 2D↔3D por facetas; 14 operaciones | N1 |
| CAD (AutoCAD COM) | `cad/*` | 1 201 | Adaptador COM por PowerShell: líneas, `construir_3d` (cajas y cuñas), vistas, inspección de sólidos, verificación de persistencia global, identidad por ruta | N1 (simulador COM + CI Windows con mock). **AutoCAD real: evidencia parcial histórica (rc.2, issue #8); TW-09/10: N0** |
| Razonamiento arquitectónico (TW-10) | `architect/*` | 2 162 | Brief, sitio, solar (NREL SPA ≤0,024°), clima EPW, partidos (compacta/L/dos alas/lineal), huella poligonal, sombras, visuales, evaluación, Pareto, ledger de decisiones | N1 |

**Lo que NO existe hoy (comprobado por búsqueda en `src/`):** nada de cronograma/planificación, alineamientos/progresivas, topografía, túneles, hidráulica/hidrología, geotecnia, estructuras (cálculo), instalaciones, medio ambiente, seguridad en obra, ni recuperación de conocimiento por contenido (ningún índice de texto, ningún lector DOCX).

## 2. Capacidades genuinamente transversales y reutilizables
1. **Gobernanza de datos y versiones** (`project/*`, `security/*`): proyecto→carpetas, originales protegidos, versiones inmutables transaccionales, auditoría. *Totalmente agnóstico de dominio.* → base del «historial entre sesiones».
2. **Medición DXF/PDF + unidades** (`dxf/*`, `pdf/*`): geometría 2D/3D con unidad confirmada, calibración. Agnóstico (no sabe qué es un muro).
3. **Motor de cantidades por reglas** (`quantities/engine.js`): separa medida / partida / regla / cantidad / revisión con parámetros obligatorios. Es el germen correcto del «motor de cálculo con contratos». Limitado a 9 reglas y a una sola magnitud por regla.
4. **APU y presupuesto XLSX** (`budget/*`): agnóstico de especialidad.
5. **Política de autonomía** (`politica/autonomia.js`): reglas actuar/suponer/preguntar/detenerse y «nunca automático». Reutilizable tal cual; su **enrutador** es el que no escala.
6. **Matriz entidad×operación×backend con evidencia** (`cad/capabilities.js`): el patrón de «SUPPORTED solo con evidencia» es exactamente el de un *registro de capacidades*; hoy solo cubre CAD.
7. **Modelo 3D estructurado** (`arq3d/*`): niveles/muros/losas/cubiertas sirven a **cualquier edificación ortogonal** (edificios, bodegas, departamentos por pisos), no solo casas.
8. **Patrones de TW-10 reutilizables:** esquemas Zod con política epistémica (`confirmed|assumed|unknown`), `DecisionLedger` (decisión→evidencia con método+hash), resúmenes compactos por secciones (F01), preguntas por ambigüedad (F02/F06), conteo honesto de elegibles (F10), identidad servidor/motor/paquete (F08).
9. **Operaciones geométricas puras** (`architect/poligonos.js`, `dxf/geometry.js`): área, contornos de uniones ortogonales, intersecciones, arcos con bulge.

## 3. Dependencias injustificadas de programas residenciales
| # | Dónde | Acoplamiento | Consecuencia | Remedio (TW-11) |
|---|---|---|---|---|
| A1 | `design/generador.js` (`LIMITES`, franjas día/noche) y `design/modelo.js` (árbol de **un** rectángulo) | La «verdad» del sistema de diseño es un árbol de particiones de una planta | Un departamento, un edificio o una nave **no tienen representación** | Representación de programa/espacios independiente de la tipología (G10) |
| A2 | `conocimiento/criterios.js` (`RECINTOS`, `SISTEMAS` con ancho de dormitorio, etc.) | Criterios de **vivienda** como «conocimiento» | Se confundiría con conocimiento general | Reubicar como *especialización* «vivienda»; el núcleo no importa criterios de dominio |
| A3 | `politica/autonomia.js` (`NO_SOPORTADO`, 5 capacidades, regex de vivienda) | El enrutador clasifica por palabras de vivienda y por límites del generador | Un encargo de túnel cae en `no_soportado`/`modelo_3d_estructurado` por exclusión, no por comprensión | Enrutador basado en **registro de capacidades** y plan (G4) |
| A4 | `tools/diseno.js`, `tools/arquitectura.js` | Herramientas con nombres y esquemas de vivienda (`dormitorios`, `banos`) | La IA «ve» solo vivienda | Herramientas de núcleo `tannia_cic_*` + especializaciones; las de vivienda se conservan |
| A5 | `architect/*` | Muy genérico en geometría (huella poligonal) pero con programa de vivienda cableado (`R-DP`, `R-COC`, `piscina`) | Reutilizable solo como especialización | Extraer la «gramática de programa» (G10) |
| A6 | `cad/autocad_com.js` `construir_3d` | Solo cajas y cuñas | No hay arcos/curvas extruidas, barridos ni revolución | Operaciones generales (G6), **UNVERIFIED** sin hardware |
| A7 | `normativa/index.js` | Registro estático + `FECHA_INDICE`; no hay recuperación | «Conocimiento» = lista de enlaces | Arquitectura de conocimiento (G3) |

## 4. Restricciones artificiales de los generadores actuales
- 1 piso, planta ortogonal, recintos rectangulares, 45–260 m², ≤5 dorm., ≤2 baños (`architect/partidos.js`, `design/generador.js`).
- Sin multi-nivel, sin unidades repetidas (departamentos), sin núcleos de circulación vertical, sin medianeros ni áreas comunes.
- Un solo sistema de muros/espesores por vivienda; sin elementos lineales ni curvos.
- Cubiertas inclinadas solo sobre huella rectangular.
- Predio ortogonal; sin topografía.

## 5. Operaciones CAD generales aprovechables en otros dominios
`agregar_lineas`, `leer_geometria`, `verificar_contorno`, `verificar_persistencia` (conteo global, 5 conteos, ambos sentidos), `abrir_copia`, `dxfADwg`, `verificarDwg`, `construir3d`/`vista3d`/`inspeccionarSolidos`/`transformarSolido`/`verificarSolidos`. **Aprovechables sin cambios:** protocolo de copia segura, identidad documental por ruta, verificación de persistencia, vistas. **A extender:** primitivas (arco, polilínea 2D/3D, spline), sólidos por extrusión/barrido/revolución, secciones (`SECTION`), bloques, capas por disciplina, cotas reales (`DIMENSION`: hoy son geometría + texto).

## 6. Cálculos disponibles y límites de validez
| Cálculo | Dónde | Válido para | Límite |
|---|---|---|---|
| Longitud/perímetro/área/volumen de mallas | `dxf/measure.js`, `mesh3d.js` | Geometría con unidad confirmada | No implica material, partida ni requisito |
| 9 reglas de cantidad | `quantities/engine.js` | Σ geometría × parámetros confirmados | Sin pérdidas por defecto; no hay reglas por perfil/sección variable |
| APU/presupuesto | `budget/calc.js` | Insumos y precios aportados | No estima precios |
| Posición solar | `architect/solar.js` | Cualquier lugar/fecha (≤0,03°) | Geometría solar; no energía |
| Sombras/visuales por ray casting | `architect/sombras.js`, `habitabilidad.js` | Escenas de cajas AABB | Preliminar; sin mobiliario |
| Huella/áreas/volúmenes de losa | `architect/derivar_poly.js`, `arq3d` | Polígonos ortogonales | No curvas |
| **Estructural, geotécnico, hidráulico, normativo** | — | **No existe** | Nunca por inferencia |

## 7. Deficiencias en recuperación de conocimiento técnico
1. Sin índice, sin extracción de texto de documentos de la usuaria (solo inspección PDF vectorial para medir).
2. Sin metadatos de fuente (licencia, versión, fecha, página/sección, confianza).
3. Sin separación entre fuente institucional, académica, de proyecto y método computable.
4. El registro de normas no distingue **vinculante** de **referencial** ni versiones vigentes.
5. Sin mecanismo de actualización controlada ni de obsolescencia.
6. La red está deliberadamente excluida del servidor (política vigente); la investigación web depende de Claude Desktop y **no queda registrada con procedencia**.

## 8. Qué necesita especialización real y qué solo orquestación
| Necesidad | Naturaleza | Comentario |
|---|---|---|
| Clasificar encargo, planificar, componer herramientas, gestionar fuentes y claims | **Orquestación** (núcleo común) | Es lo que falta; no requiere conocimiento de un dominio |
| Planta/perfil/secciones de un trazado lineal, volúmenes por secciones | **Geometría general nueva** (curvas, alineamientos) | Matemática pública y verificable por oráculos analíticos |
| Cubicación de movimiento de tierras, revestimiento, hormigón | **Orquestación + reglas de cantidad ampliadas** | Reutiliza `quantities` |
| Programación (CPM), curvas S, control de avance | **Algoritmos deterministas nuevos** (públicos) | No existe nada hoy |
| Dimensionamiento geotécnico/estructural, hidráulica de diseño, normativa | **Especialización real + validación profesional** | Fuera del alcance automático: se orquesta **método y verificación**, no se inventan resultados |
| Topografía (coordenadas, superficies, curvas de nivel) | **Geometría + importación de datos** | Datos del levantamiento deben venir del usuario/documento |

## 9. Hallazgos de riesgo para TW-11
- **H1 (alto):** el enrutador por regex (A3) hará que cualquier dominio nuevo se rechace o se encaje en vivienda. Requiere reemplazo, no parche.
- **H2 (alto):** sin registro de capacidades con nivel de validación, Claude no puede saber qué es ejecutable, simulado o solo documentado.
- **H3 (alto):** sin esquema de *claims* a nivel de plataforma, la honestidad hoy depende de cada módulo (TW-10 lo hizo para arquitectura).
- **H4 (medio):** dependencia de AutoCAD real para toda verificación CAD: la mayoría de las nuevas primitivas serán **UNVERIFIED** hasta hardware.
- **H5 (medio):** extracción de texto de DOCX/PPTX/XLSX no existe; PDF tiene lector pero no de texto.
- **H6 (bajo):** el límite de 6 000 caracteres del texto MCP (F01) condiciona el diseño de respuestas: todo contrato nuevo debe tener **resumen compacto + secciones**.
