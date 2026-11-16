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

## 2b. Rigor matemático: métodos de volumen con hipótesis distintas (revisión CIC-03)
**Principio:** son métodos **distintos con hipótesis distintas**; el sistema **no exige que coincidan**. Cada uno declara su dominio de validez, su error conocido y el *plano de sección*. Elegir método es una decisión registrada (claim `assumption`) y se reporta junto al resultado; el sistema puede mostrar la diferencia entre métodos como **indicador de sensibilidad**, no como error.
Notación: A(s) área de sección en la progresiva s; L longitud entre secciones.
| Método | Fórmula | Hipótesis (aplicabilidad) | Exacto cuando | Error conocido / advertencia |
|---|---|---|---|---|
| **Áreas medias** (`geo.volume.average_end_area`) | V = Σ (Aᵢ+Aᵢ₊₁)/2 · Δsᵢ | secciones **perpendiculares al eje de referencia de s**; A(s) ≈ lineal entre secciones; Δs medido a lo largo del eje de referencia declarado | A(s) lineal (prisma, cuña de cara plana) | Para A(s)=a·s²+b·s+c en un tramo: **V_AEA − V_exacto = a·L³/6** (sobrestima si a>0). Ej.: cono/pirámide desde vértice: AEA = A·L/2 vs exacto A·L/3. En curva, Δs a lo largo del eje **no** corrige efecto de curvatura (ver barrido). Secciones mixtas corte/relleno: **partir en el cruce de cota cero** antes de aplicar |
| **Prismoidal** (`geo.volume.prismoidal`) | V = (L/6)(A₁ + 4·Aₘ + A₂) por tramo | Aₘ = **área medida/construida en la sección intermedia real** (no promedio de A₁ y A₂ ni de dimensiones); A(s) polinomial de grado ≤3 | A(s) polinomio de grado ≤3 (tronco de cono/pirámide, cuña, prisma) | Si Aₘ se interpola linealmente, **no es prismoidal**: degenera a AEA. Requiere sección intermedia disponible o geometría que permita construirla |
| **Extrusión de sección constante** (`geo.solid.extrude`) | V = A_n · L | sección constante; trayectoria **recta**; A_n = área en el plano **normal** a la dirección | siempre (en las hipótesis) | Si el plano de sección forma ángulo α con la dirección de extrusión: **V = A_plano · L · cos α**. Se exige declarar `section_plane`: `normal_to_path` o `vertical_cut` (p. ej. perfil vertical sobre eje en planta). Ejemplo: túnel con pendiente φ y sección **vertical** de área A_v: V = A_v·L_horiz (= A_v·L_3D·cosφ); con sección **normal** de área A_n = A_v·cosφ: V = A_n·L_3D. Mezclar ambas sin declararlo produce error de 1/cosφ, por eso `section_plane` es obligatorio |
| **Barrido sobre alineación curva** (`geo.sweep.volume`) | V = ∫ A·(1 − κ(s)·e(s)) ds, con e = desplazamiento del centroide desde el eje, medido hacia el centro de curvatura | sección **plana, constante, normal a la trayectoria**; marco sin torsión de sección (rotation-minimizing) o `twist` declarado; **1 − κ·x > 0 para todo punto de la sección** (sin auto-solape); curvatura continua a tramos | cálculo numérico (cuadratura adaptativa) siempre en las hipótesis | **Teorema de Pappus** es el caso particular: para trayectoria **plana** con sección normal y sin torsión, **V = A · L_c**, con L_c = longitud de la trayectoria del **centroide** (en arco circular de radio R_c y ángulo θ: V = A·θ·R_c). **No** es V = A·L_eje salvo que el centroide esté sobre el eje (e=0). En trayectorias espaciales con torsión o rotación de sección **no se aplica la forma cerrada**; se usa la integral |
| **Estimación de movimiento de tierras** (`earth.volume_estimate`) | AEA o prismoidal **sobre secciones medidas/derivadas de TIN**, separando corte y relleno | secciones transversales verticales al eje en planta; superficie natural y de proyecto confiables; **factores de esponjamiento/compactación aportados por la usuaria** (no se asumen) | — | Es una **estimación**: depende de espaciamiento de secciones, interpolación del terreno y factores; reporta incertidumbre por sensibilidad AEA vs prismoidal vs espaciamiento y declara que **no es** un volumen geométrico exacto |
**Diferencias a aclarar en la documentación de usuario y en los claims:** (1) *estimación de movimiento de tierras* (terreno + proyecto + factores, método aproximado), (2) *extrusión de sección constante* (volumen geométrico exacto de un sólido recto) y (3) *barrido sobre alineación curva* (volumen geométrico del sólido barrido; exacto bajo sus hipótesis, depende de curvatura y desplazamiento del centroide). Un mismo túnel puede requerir (2) para un tramo recto y (3) para otro; el plan puede **partir** el eje en tramos con método distinto.
### Oráculos independientes
| Oráculo | Independencia | Prueba |
|---|---|---|
| Sólidos analíticos: prisma, cuña, tronco de cono y pirámide, cilindro recto/oblicuo, toro/sector de toro (V = 2π²·R·r² con r<R), sector anular con sección rectangular (V = θ·R_c·A) | fórmula cerrada fuera del código | valores exactos con tolerancia 1e-9 relativa |
| **Malla cerrada + teorema de la divergencia** (suma de tetraedros con signo, ya existe `mesh3d`) | otro algoritmo: se genera la malla del sólido y se mide su volumen sin usar la fórmula del método | concordancia ≤ tolerancia de discretización **declarada** (error teórico de la malla) |
| Cuadratura adaptativa de A(s) (Simpson/Gauss) con A(s) analítica | implementación separada | el barrido numérico converge con refinamiento (orden de convergencia medido) |
| Voxelización/Monte Carlo con semilla (solo como verificación gruesa, ±1 %) | independiente | rango estadístico |
**Pruebas obligatorias:** (i) *No equivalencia*: para tronco de cono, el test **afirma** AEA−exacto = a·L³/6 y prismoidal=exacto; (ii) *Equivalencia legítima*: en prisma y cuña, AEA = prismoidal = extrusión; (iii) Pappus vs integral coinciden en trayectoria plana y **difieren** en trayectoria con sección desplazada y rotación de sección; (iv) condición `1−κ·x>0` violada ⇒ error `SELF_OVERLAP`, no valor; (v) *mutación*: cambiar L³/6 por L³/5 o usar Aₘ promedio rompe el oráculo; (vi) invariancia de unidad y de traslación/rotación rígida; (vii) cruce cota cero.

## 3. Contrato de operación de cálculo (`tw.cic.operation/1`)
```jsonc
{ "id":"geo.volume.average_end_area","version":"1.0.0","title":"Volumen por áreas medias",
  "disciplines":["transversal","obras_lineales","movimiento_de_tierras"],
  "inputs":[{"name":"areas","dimension":"L2","unit_in":"m2","shape":"vector","min_len":2},
            {"name":"stations","dimension":"L","unit_in":"m","shape":"vector","monotonic":"increasing"}],
  "outputs":[{"name":"volume","dimension":"L3","unit_out":"m3"}],
  "applicability":{"assumptions":["A(s) lineal entre secciones","secciones perpendiculares al eje de referencia (section_plane declarado)"],
                   "validity":["≥2 secciones, estaciones monótonas","partir en cruce corte/relleno","sin auto-solape"],
                   "error_bound":"AEA−exacto = a·L³/6 para A(s) cuadrática (documentado); no se exige igualdad con prismoidal"},
  "formula_ref":{"text":"V=Σ(A_i+A_{i+1})/2·Δs","source":"geometría elemental (sin fuente normativa)"},
  "tolerance":{"relative":1e-9,"oracle":["analytic:prism/wedge (exacto)","analytic:cone_frustum (error conocido)","mesh_divergence"]},
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
| `geo.volume.average_end_area`, `geo.volume.prismoidal` | lineal | P0 | §2b (no se exige igualdad entre ellos) |
| `geo.solid.extrude` (constante, recta; con `section_plane`) | lineal | P0 | prismas, cilindros oblicuos |
| `geo.sweep.volume` (integral general; Pappus como caso particular plano) | lineal | P0 | toro, sector anular, malla+divergencia |
| `earth.volume_estimate` (corte/relleno con factores del usuario) | tierras | P1 | casos manuales + §2b |
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
