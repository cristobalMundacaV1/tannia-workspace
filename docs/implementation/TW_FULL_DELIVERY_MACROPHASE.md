# TW-FULL — Macrofase de ingeniería integral y entrega a Tannia

**Versión:** propuesta de ejecución, 2026-11-15  
**Estado:** planificación de implementación, no producto probado.  
**Repositorio:** `cristobalMundacaV1/tannia-workspace`  
**Implementador:** Claude Code. **Revisor independiente:** auditor del PO. **PO:** decide aceptación, merge y distribución.

## 0. Objetivo innegociable
Construir **un único entorno integrado** cuyo usuario abra AutoCAD y Claude Desktop, seleccione el proyecto y pida en español trabajos cotidianos de construcción. El asistente usa herramientas locales para leer/editar copias DWG, medir geometrías 2D/3D (cuando soportadas), cubicar PDF/DXF, preparar partidas, presupuestos/APU en XLSX y memorias/informes PDF, con consultas normativas orientativas basadas en fuentes oficiales chilenas.

La usuaria no debe abrir terminales, instalar librerías, ejecutar Docker, editar JSON, configurar MCP ni entender arquitectura. No BIM/IFC.

**Resultado de ingeniería solicitado:** candidato instalable/distribuible a Tannia, con pruebas automatizadas y de integración ejecutadas hasta donde el entorno permita. No prometer funcionamiento de AutoCAD real ni validación profesional si no se probaron.

## 1. Reglas de autonomía de Claude
1. Leer primero `AGENTS.md`, README, Scope, Architecture, Roadmap, PR #2, Issues #1/#3/#4 y los informes del auditor. Verificar ramas y SHA.
2. Hacer un inventario de entorno: Windows/CI, dependencias, presencia de AutoCAD, Claude Desktop y permisos de ejecución. **No pedir instalación de AutoCAD ni licencia al PO**.
3. Crear rama de trabajo limpia desde base acordada; no reescribir `main`, no editar rama de otros agentes, no crear un merge sin aprobación.
4. Avanzar **fase por fase, automáticamente**, y resolver errores reproducibles antes de avanzar. No frenar por la ausencia de AutoCAD o Tannia: usar mocks/fixtures y continuar, marcando el gate específico de hardware como pendiente.
5. En bloqueos por licencias, permisos o instalaciones que requieren credenciales o intervención humana: tomar alternativa reproducible, segura y legal; registrar `EXTERNAL_DEPENDENCY_PENDING` y continuar con trabajo independiente.
6. No hacer afirmaciones sin evidencia, no modificar originales, no crear dependencias ni servicios innecesarios y no ejecutar binarios opacos sin auditoría razonable.
7. Abrir PR(s) revisables y publicar artefactos de prueba **internos** solo cuando esté permitido. No realizar merge, release público ni autoaprobar revisiones.
8. Continuar hasta producir paquete transferible y dossier de pruebas; no detenerse tras una simple prueba de concepto.

## 2. Estrategia técnica y producto
- **UI:** Claude Desktop; un único proyecto seleccionado, herramientas localmente coordinadas, errores en español. **No frontend web nuevo**.
- **MCP:** un servidor local propio, con adaptadores de capacidad y herramienta segura para AutoCAD. Investigar fuentes de terceros antes de depender de ellas; fijar hashes/versiones.
- **CAD:** adaptar consulta/edición 2D y 3D con una interfaz de capacidad de entidades, sin confundir DXF, DWG ni IFC. Si no se puede probar AutoCAD, implementar la interfaz, pruebas contractuales y fixtures, pero dejar las afirmaciones de integración real pendientes.
- **DXF:** medidas geométricas 2D deterministas sobre elementos soportados, manejar arcos, polilíneas abiertas, bloques transformados, referencias, duplicados y unidades inválidas. No asumir precisión universal.
- **3D:** tipos/sólidos/superficies/mallas; no inventar volumen de entidades que no lo definan, usar adaptador COM/.NET/otro comprobable solo si compatible. Tests con cubos, prismas y geometrías de medida conocida; distinguir simulación de AutoCAD real.
- **PDF:** mediciones solo con calibración suficiente y rastro de página/región; auditar OpenTakeoff (incluida AGPL-3.0) antes de decidir integrar, no replicar sin motivos.
- **Cubicación:** pasos separados: medición geométrica → identificación de elemento/partida → regla constructiva → cantidad → revisión. Origen por archivo, versión, entidad/página, unidad, fórmula, advertencias y estado.
- **XLSX:** precios CLP editables, mano de obra/equipos/materiales, rendimientos, subtotales, gastos generales/IVA configurables; fuente y fecha de precio. Validar fórmulas y resultados por método independiente. Nunca precios inventados.
- **PDF y memorias:** fuentes, supuestos, cálculo detallado, cantidades dudosas, índice de archivos.
- **Normativa chilena:** consultas con enlaces a sitios oficiales (MINVU, BCN, MOP cuando corresponda), fecha/versión, límites; no incluir textos con restricciones de licencia ni declarar cumplimiento sin revisión.
- **Instalación:** probar preferentemente `.mcpb` autocontenido. Si no resuelve dependencias y experiencia, justificar y crear instalador Windows con diagnóstico/reparación/desinstalación; nunca un instalador que sobrescribe la configuración existente de Claude sin respaldo.

## 3. Fases ejecutables con criterios de salida

### TW-00 — Fundación y riesgos
Reconciliar contratos, aplicar informe de auditoría REV2-01/02/03, especificar amenazas, matriz de compatibilidad y calidad de entregables. Registrar decisiones y riesgos abiertos. No gastar semanas en documentos: habilitar implementación.

### TW-00A — Vertical mínima e instalación provisional
Crear un MCP mínimo de solo lectura sobre un DXF sintético de referencia, ejecutable localmente con prueba automática de protocolo. Empaquetar un mecanismo **provisional reproducible**: preferentemente `.mcpb`, manifiesto, dependencias fijas, instalación, desinstalación, diagnóstico y recuperación. Ejecutar prueba desde Claude Desktop cuando disponible, con procedimiento claro y resultado. No confundir test de protocolo con uso real en interfaz. Si Claude Desktop no está accesible, documentar exactamente esa limitación y continuar.

### TW-01 — Motor DXF
Desarrollar parser y cantidades de entidades 2D soportadas. Tests fixture con geometría y unidad conocida, transformaciones de bloques, curvas, referencias, geometría abierta, auto-intersección, entidades duplicadas y archivos corruptos. Emitir estructura de cálculo con unidades, incertidumbre y `needs_review`. El cálculo no debe inventar espesores/alturas.

### TW-02 — Cantidades, partidas, presupuestos y APU
Motor de partidas chilenas configurable (sin prometer catálogo oficial completo), fórmula visible, totales e impuestos diferenciados; XLSX con fórmulas comprobadas al reabrir o mediante evaluación independiente. Escenarios con precios faltantes y cantidades no verificadas bloquean el estado FINAL.

### TW-03 — PDF y documentos
Medición PDF calibrada (una o varias escalas por lámina), unidades, trazabilidad página/zona y alertas para escaneos. Memoria de cálculo legible y reportes en PDF. Evaluación escrita de OpenTakeoff y su licencia antes de adoptar o distribuir código.

### TW-04 — Flujo MCP de producto
Herramientas para crear/abrir proyecto, importar antecedentes, diagnosticar documentos, medir, cubicar, presupuestar, revisar y exportar. Establecer estados `nuevo → análisis → borrador → revisión → aprobado → entregable`, errores traducidos, reintento y recuperación tras reinicio. Validar prompts maliciosos incrustados en DXF/PDF y rutas fuera del proyecto, limitando ejecución/permisos a herramientas permitidas.

### TW-05 — Paquete Windows
Primero demostrar que extensión `.mcpb` resuelve la necesidad. Si no, crear asistente Windows con motivo documentado. Probar instalación nueva, actualización, desinstalación, permisos de usuario estándar, rutas con espacios/acentos, rollback, falta de internet, versiones incompatibles, logs sin información privada y diagnóstico comprensible. No empaquetar AutoCAD ni Claude Desktop si sus licencias no autorizan redistribución.

### TW-06 — Adaptador AutoCAD real, capacidad 2D y descubrimiento 3D
Implementar adaptador y pruebas de contrato; detectar si AutoCAD está instalado, edición/componente/versiones; si es LT o incompatible indicar alternativa clara. Protección de originales debe ser técnica y comprobable (copias, rutas y checksum). Si hay AutoCAD real, probar en dibujos de referencia y registrar versión, operación y resultado. Si no, generar fixtures y pruebas simuladas, etiquetar **NO VERIFICADO EN AUTOCAD REAL** y continuar.

### TW-07A — Piloto real 2D anticipado
Preparar un guion de tres trabajos reales: abrir/inspeccionar plano, cubicación y presupuesto, y memoria/entrega. Ejecutar con Tannia si está disponible; si no, dejar paquete y protocolo listos, sin frenar desarrollo 3D.

### TW-06A — Geometría AutoCAD 3D
Matriz de capacidades obligatoria por tipo geométrico (mínimo LINE, LWPOLYLINE, ARC, CIRCLE, BLOCK/INSERT, 3DPOLY, 3DSOLID, REGION, SURFACE, MESH) y operación (detectar, leer, longitud, superficie, volumen, edición en copia, exportar). Estados `SUPPORTED`, `UNSUPPORTED`, `UNVERIFIED`, ligados a versiones/test. Preparar casos 3D de volumen/área conocidos. Solo marcar `SUPPORTED` tras evidencia real de ese adaptador y entorno.

### TW-07B — Piloto final 3D
Preparar la evaluación con Tannia: reconocimiento de entidades 3D, cantidades trazables, reporte de elementos no soportados, edición en copia si es segura. Ejecutar si hay AutoCAD real; si no, handoff sin afirmar validación.

### TW-08 — Release candidate transferible
Producir paquete versionado (instalable o extensión verificada), hashes SHA-256, changelog, lista de archivos, guía de instalación de una página, guía «qué pedirle a Claude», diagnóstico, reparaciones, desinstalador o mecanismo inverso y repositorio con PRs. Añadir `EVIDENCE_MATRIX.md`, `KNOWN_LIMITATIONS.md`, `AUTOCAD_COMPATIBILITY.md`, `TANNIA_HANDOFF.md` y reporte de cobertura y fallos. **El RC no supone aceptación de Tannia ni garantía en AutoCAD real**.

## 4. Gates de seguridad y confiabilidad (bloqueantes para RC)
- Copiar originales antes de cualquier modificación; comparar checksum y rechazar rutas fuera de proyecto. Ataques de path traversal, symlinks/junctions y privilegios deben estar cubiertos.
- Ningún cambio destructivo ni escritura sobre originales aunque Claude lo solicite.
- Permisos mínimos de MCP y rechazo de instrucciones del contenido de documentos como comandos.
- Distinción de geometría vs partida; unidades ambivalentes requieren decisión, no conversión inventada.
- Correctitud en operaciones numéricas y manejo explícito de errores/precisión.
- Integridad de XLSX y memoria/archivos; no entregar archivos corruptos.
- Dependencias revisadas y fijadas con licencias documentadas. Cero secretos en repositorio o logs.
- Instalación/upgrade/desinstalación reproducibles; guía simple y una ruta de reparación para fallo.
- Todos los tests automatizables disponibles pasan sobre SHA registrado; cero P0/P1 conocidos sin resolver para RC. P2/P3 no bloqueantes documentados según impacto real.
- Los gates de AutoCAD real y Tannia se separan: **PENDIENTE DE HARDWARE/USUARIO** no bloquea culminar el trabajo técnico posible, pero sí impide declaración `VALIDADO FINAL`.

## 5. Qué se considera evidencia
Para cada fase, registrar: commit SHA, Windows/OS/build, dependencias y versiones, comandos ejecutados, resultados y exit codes, fixtures, resultados esperados vs observados, CI Actions si disponible, fallos reproducidos, compatibilidad real vs simulada. Capturas reales solo si se ejecutó la interfaz. **No usar capturas inventadas ni tests afirmados sin ejecutar.**

**Estados por capacidad:** `IMPLEMENTADO`, `TEST_AUTOMATIZADO_APROBADO`, `TEST_INTEGRACIÓN_APROBADO`, `NO VERIFICADO EN AUTOCAD REAL`, `PILOTO TANNIA APROBADO`, `NO SOPORTADO`.

## 6. Entregables de handoff
- Código fuente y PR(s) auditables.
- Paquete transferible `.mcpb` y/o `.exe` solo según lo logrado y verificado; no publicar un instalador ficticio.
- Artefactos de prueba DXF/PDF/3D, XLSX y memorias exportadas.
- Resumen de qué se instala exactamente en el PC de Tannia y qué debe tener instalado (Claude Desktop y AutoCAD completo compatible).
- Evidencia del uso sin consola y procedimiento de revertir.
- Manual de Tannia en español, una página, con 6 instrucciones ejemplo.
- Matriz de riesgos y **lista honesta de verificaciones que solo se pueden hacer en su PC**.
- Dictamen independiente solicitado, no fabricado por el implementador.

## 7. Criterio de finalización de la misión
Claude no termina por tener documentación o 100% de código compilado. Termina la **fase de ingeniería autónoma** cuando ofrece un paquete íntegro y transferible, pruebas de todo lo ejecutable, bitácora fiel de fallos y pendientes inevitables y PR(s) listos para revisión. El auditor independiente evalúa y el PO decide entrega y merge. La aceptación con AutoCAD real y Tannia queda en un gate separado si físicamente no es posible probarla antes.
