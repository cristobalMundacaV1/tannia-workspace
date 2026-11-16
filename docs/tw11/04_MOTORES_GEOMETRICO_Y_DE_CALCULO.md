# TW-11 · 04 — Contratos del motor geométrico general y del motor de cálculo
## 1. Capas del modelo constructivo (nunca se infieren entre sí)
| Capa | Pregunta | Ejemplo | Origen permitido |
|---|---|---|---|
| **Geometry** | ¿Qué forma es? | polilínea, arco, superficie, sólido, perfil | DXF/PDF/operación geométrica |
| **Meaning** | ¿Qué es en la obra? | «eje de túnel», «muro», «calzada» | Declaración explícita (usuaria/capa/etiqueta confirmada); **nunca** por forma |
| **Measure** | ¿Qué se mide? | longitud, área, volumen por secciones | Operación de medición con unidad |
| **Partida/Material** | ¿Con qué partida y material? | «excavación en roca», «H25» | Usuaria/especificación; **no inventado** |
| **Requirement** | ¿Qué exige? | espesor mínimo, pendiente máxima | Fuente con localizador (clase A/B) |
| **Verification** | ¿Con qué evidencia cumple? | resultado de operación + revisión | `claim` + `verification/1` |
Un objeto del modelo es `{geometry_ref, meaning?, measures[], partida?, requirements[], verifications[]}`; cada capa tiene `status` epistémico. Prohibido: geometría→resultado estructural/geotécnico/normativo.

## 2. Geometría general (nuevo `src/geo/`, núcleo puro sin E/S)
**Primitivas:** punto, segmento, arco (centro/radio/ángulos/sentido), polilínea con *bulge*, círculo/elipse (E1), spline (aproximada por polilínea con tolerancia declarada), polígono con huecos, superficie triangulada (TIN), perfil 2D (polígono en plano de sección), sólido por extrusión / barrido a lo largo de un eje / revolución / loft entre secciones (mallas cerradas).
**Lineal:** `Alignment` (planta = tramos recta/arco circular/clotoide *opcional E1*, parametrizado por progresiva), `Profile` (rasante: tramos rectos + curvas verticales parabólicas), `Station` (progresiva, unidad y offset explícitos), `SectionTemplate` (perfil paramétrico por tramo), `SectionAt(station)` (interpolación lineal declarada; variable por tabla), `CrossSections[]` (secciones medidas del usuario o derivadas de TIN).
**Operaciones núcleo** (cada una con contrato §4): `offset`, `intersect`, `clip`, `area/perimeter/centroid/inertia_geométrica`, `polygon_boolean` (unión/diferencia/intersección con tolerancia), `section_cut(solid, plane)`, `profile_extract(surface, alignment)`, `volume_by_average_end_area`, `volume_by_prismoidal`, `sweep(profile, alignment)`, `mass_haul_table` (cuando existan entradas), `surface_area/volume(TIN)`.
**Verificación geométrica:** cierre, auto-intersecciones, orientación, manifold de sólidos, coherencia de unidades, tolerancias (`eps` explícito por operación, por defecto relativo 1e-9 sobre la escala).
**Interoperabilidad:** adaptadores *abiertos* analizados con ADR: DXF (ya), **LandXML** (alineamientos, superficies, perfiles — texto XML abierto), GeoJSON/CSV de puntos, OBJ/STL de mallas. **IFC/BIM: no se incorpora ni se simula en el MVP**; el ADR solo registra por qué y qué haría falta. Todo adaptador entra como *importador con validación y reporte de pérdidas*, nunca silencioso.
**AutoCAD:** las operaciones de dibujo nuevas (arco, polilínea con bulge, barrido) se exponen en el adaptador COM **solo** como capacidades `N1-simulado`/`UNVERIFIED` hasta evidencia real; el DXF generado se valida con lector independiente y `ezdxf` en pruebas.

## 3. Contrato de operación de cálculo (`tw.cic.operation/1`)
```jsonc
{ "id":"geo.volume.average_end_area","version":"1.0.0","title":"Volumen por áreas medias",
  "disciplines":["transversal","obras_lineales","movimiento_de_tierras"],
  "inputs":[{"name":"areas","dimension":"L2","unit_in":"m2","shape":"vector","min_len":2},
            {"name":"stations","dimension":"L","unit_in":"m","shape":"vector","monotonic":"increasing"}],
  "outputs":[{"name":"volume","dimension":"L3","unit_out":"m3"}],
  "applicability":{"assumptions":["variación lineal del área entre secciones"],
                   "validity":["secciones consecutivas con espaciamiento declarado","sin curvatura significativa entre secciones o error aceptado por usuaria"],
                   "error_bound":"formula: documentada; ≠ prismoidal en variaciones no lineales"},
  "formula_ref":{"text":"V=Σ(A_i+A_{i+1})/2·Δs","source":"geometría elemental (sin fuente normativa)"},
  "tolerance":{"relative":1e-9,"oracle":"analytic:prism/cone"},
  "maturity":"E2","requires_review_by":[],"deterministic":true,
  "failure_modes":["unidades incompatibles","estaciones no monótonas","área negativa"] }
```
**Madurez de operación:** **E0** documentada/no ejecutable · **E1** ejecutable, solo para ejercicio académico (fórmula educativa, parámetros del enunciado) · **E2** verificada contra oráculo analítico y/o implementación independiente, rango de validez probado · **E3** E2 + revisión por profesional competente registrada (solo el PO/revisor puede subirla; no el código). Modo profesional exige ≥E2 para cifras en entregables; las de seguridad/estructura/geotecnia exigen E3 o salen como `pending`.

## 4. Motor dimensional
Magnitud = `{valor, unidad, dimensión base [L,M,T,…]}` con conversión exacta (decimal/racional para presupuesto; flotante con eps para geometría). Operaciones declaran dimensión; la suma de magnitudes incompatibles **falla**. Soporte: L, L², L³, M, T, ángulo, pendiente (adimensional con representación %/‰/1:n), caudal, tasa (m³/m), moneda (sin conversión implícita). Tabla de unidades cerrada y probada; unidad desconocida = error, no suposición (continuidad de la regla INSUNITS).

## 5. Catálogo inicial (priorizado; ≥E2 salvo indicación)
| Id | Operación | Prioridad | Oráculo |
|---|---|---|---|
| `geo.polygon.area/centroid/perimeter` (con arcos) | núcleo | P0 | círculos, sectores, fórmulas analíticas |
| `geo.section.horseshoe/circular/arch.area` (herradura = rect + semicírculo, circular, bóveda) | túneles/obras | P0 | analítico |
| `geo.volume.average_end_area`, `…prismoidal` | lineal | P0 | prismas, conos, cuñas |
| `geo.sweep.volume` (Pappus: ÁreaXlongitud del centroide) | lineal | P0 | toros, cilindros |
| `geo.profile.slope/grade/vertical_curve` | carreteras | P1 | parábola analítica |
| `geo.tin.volume_between` | topografía | P1 | prisma sobre TIN conocido |
| `qty.rule.*` (las 9 existentes + `perimetro_por_altura`, `volumen_por_seccion`, `tasa_por_metro`) | transversal | P0 | tablas manuales |
| `sched.cpm`, `sched.scurve`, `sched.earned_value` | planificación | P1 | casos de libro con solución cerrada |
| `bud.apu`, `bud.rollup` (existente) | presupuesto | P0 | existente |
| `edu.*` fórmulas de curso | académico | E1 | solo con parámetros del enunciado |
| `hyd.manning_full_pipe`/`…circular_partial` | hidráulica | P2 | fórmula pública, **E1** hasta revisión |
| `str.*`, `geo_tech.*` (capacidad, estabilidad, sostenimiento) | — | **No se construye**; se registran como `gap` con `external_professional` | — |

## 6. Orquestación sin inventar cifras
`tannia_cic_calcular(operacion, entradas)` valida contrato (dimensiones, rango de validez, madurez vs modo) y devuelve `claim` con hash de entradas. Fuera del rango de validez → **error tipificado con razón**, nunca un número «aproximado». Si no hay operación: `gap` + qué solver faltaría + resultado `no_verificable`. Claude puede *explicar* la fórmula pero el valor lo emite el código; el verificador de entregables rechaza cualquier número sin `claim`.

## 7. Estrategia de pruebas de motores
Oráculos analíticos independientes; *property tests* (invariancia por traslación/rotación/unidad, monotonía, simetría); *mutation tests* (se corrompe una fórmula y la suite debe fallar); comparación cruzada con `ezdxf`/implementación independiente de referencia en CI cuando exista; casos de borde (secciones degeneradas, arcos de 0° y 360°, polilíneas cerradas con huecos).
