# Tannia Workspace — Auditoría de madurez profesional (2026-11-17)

**Estado:** auditoría estática y de evidencia de GitHub, NO aceptación del producto ni revisión profesional de un proyecto.  
**Base exacta:** fix/cad-open-dxf-import @ 2f4cdd07a4a24ee76e993bedf56e4e0f02630db2 (PR #21), apilado sobre PR #20 → #19 → #18 ... → #2.  
**Método:** lectura de código y contratos, ramas/PR, matrices de evidencia, issues, informes de CI y referencias oficiales. No se ejecutaron las pruebas locales en esta auditoría ni AutoCAD 2027 ni Claude Desktop gráfico. No atribuir al auditor la ejecución de los CI ajenos.
**Autoridad:** Product Owner decide aceptación, merge y distribución; profesional habilitado decide aptitud técnica dentro de su competencia.

## 1. Veredicto

**NO APTO TODAVÍA PARA ENTREGA PROFESIONAL FINAL.** Sí existe un candidato técnico amplio y valioso. El cierre requiere demostrar interoperabilidad real, revisión humana con canal independiente del modelo, reglas de especialidad aprobadas y evaluación con casos retenidos reales.

No reconstruir el producto ni copiar 240 herramientas de terceros. Evolucionar la arquitectura existente con migración por contratos y pruebas de equivalencia.

## 2. Hechos observados

- main @ 115baec105fff5ffe0fbaf182f40bc62666280be contiene solo README.md: el producto está en PR apilados, no integrado.
- PR #2 (fundación) y #7 (TW-FULL), #11 (TW-09), #12 (TW-10), #13–#19 (TW-11 CIC/hardening), #20 (TW-12), #21 (CAD-OPEN-01) permanecen borradores sin merge. No asumir que un PR implica aceptación.
- PR #21 @ 2f4cdd0: GitHub Actions en Windows y Ubuntu reportan success. Ejemplo run: https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/44077443232 . No equivale a AutoCAD real.
- PR #20 @ 21b4ae9: CI Windows+Ubuntu success. Ejemplo: https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/44003722892 .
- En los PR #7, #11, #12, #19, #20 y #21 no se observaron revisiones GitHub enviadas (no implica que no existan auditorías documentales).
- Árbol del head #21: 474 entradas; contiene servidor MCP, seguridad, CAD COM/DXF, dibujo, cubicación, APU, conocimiento, CIC, diseño, informes, fixtures, tests y workflows. NO aparece carpeta .claude/skills.
- El contrato de capacidades CAD declara muchas operaciones COM como UNVERIFIED; existe evidencia histórica aportada por el PO de operaciones puntuales en AutoCAD 2027 (issue #8, TW-09), sin gate integrado de los flujos actuales.
- TW-11 declara E2/N1 para operaciones sustentadas en oráculos y exige E3/revisión humana; G10 de evaluación retenida sigue sin aprobarse.
- TW-12 genera láminas de un túnel académico mediante un modelo explícito, no un motor universal de planos de construcción.
- La base MCP usa Node 22 en CI; dependencia de MCP SDK, Zod, PDFKit, ExcelJS y canvas. Paquete .mcpb, sin validación de instalación de usuario estándar en PC objetivo.

## 3. Hallazgos (evidencia, riesgo y criterio de cierre)

### TW-PRO-01 — P0 de salida: aprobación general controlable por el modelo

**Evidencia:** src/tools/index.js, herramienta de cambio de estado, acepta aprobado_por (string) y confirmo_revision_profesional (boolean) para pasar a aprobado. La revisión de partidas registra verificada_por desde parámetros de herramienta. Un modelo con permiso para llamar esa herramienta puede suministrar esos valores: el backend no autentica al humano por canal fuera del modelo para esas rutas. src/cic/aprobacion_humana.js sí implementa otro mecanismo de consentimiento en TW-11, pero aún no gobierna todas las aprobaciones.

**Impacto:** elevación ficticia de un borrador a «aprobado»; riesgo de confianza profesional. **No se afirma explotación observada.**

**Cierre:** aprobación firmada por acto humano cliente/OS de rechazo predeterminado y asociada a proyecto, documento, revisión, SHA-256, acción, identidad declarada del aprobador, instante y expiración; no basta un campo booleano. Un cambio de contenido invalida aprobación. Prueba adversarial: parámetros del agente sin señal humana no aprueban; una aprobación del artefacto A no sirve para B ni A posterior modificado. El canal alternativo de archivo tiene amenaza residual por otros MCP y debe documentarse/restringirse.

### TW-PRO-02 — P1: fidelidad DXF→DWG incompleta en hardware real

**Evidencia:** src/cad/dxf_api.js, src/cad/autocad_com.js, docs/tw12/PROCEDIMIENTO_PRUEBA_DXF_AUTOCAD_2027.md, PR #21. Se sustituyó Open(DXF) por un flujo de documento aislado + Import + puerta pre-SaveAs con layouts, viewports, cotas, XDATA, textos y entidades. Autodesk confirma que el método Import soporta DXF, pero NO constituye evidencia de conservación del espacio papel al convertirlo. Docs y pruebas marcan hardware real pendiente.

**Cierre:** abrir, importar, guardar, cerrar y reabrir en AutoCAD 2027 con documento preexistente sin guardar; original inalterado; diff semántico y visual verificable de espacios modelo/papel, cotas, XDATA y configuración de impresión; fallo cerrado sin producir DWG si hay pérdidas. Si Import no conserva los layouts, evaluar experimento aislado con API .NET Database.DxfIn, no agregar bypass por SendCommand sin contrato nuevo.

### TW-PRO-03 — P1: reglas de cubicación normativas ausentes como método aprobable

**Evidencia:** src/quantities/engine.js implementa reglas geométricas (área×espesor, longitud×altura, conteos) sin repertorio versionado de reglas específicas por partida, descuentos, vacíos, medición neta/bruta y umbrales con referencia normativa contractual. src/cic/ops/gestion.js agrega operaciones dimensionales generales, pero no acredita NCh353:2018 aplicada por capítulos y casos. Normativa actual es un índice orientativo; no motor de cumplimiento.

**Cierre:** registrar MethodCard por partida con alcance, fuente/edición/cláusula licenciada, parámetros, geometrías elegibles, exclusiones, deducciones, redondeo, revisión profesional y fixtures de obra. NCh353:2018 y NCh1156:2018 son referencias candidatas; no presumir que cualquier NCh es automáticamente vinculante. No distribuir texto protegido sin licencia.

### TW-PRO-04 — P1: dos rutas para cifras y decisiones de entrega

**Evidencia:** src/quantities y src/budget operan con partidas previas; src/cic/claims, src/cic/verificador y src/cic/entregables tienen ledger y gates propios. TW-11 adopta migración strangler, pero no hay prueba transversal de equivalencia completa legacy → CIC para todos los formatos/estados. **Riesgo de inconsistencia, no defecto de cálculo demostrado.**

**Cierre:** definir una única autoridad de cantidad, método, evidencia y estado; adaptadores de compatibilidad para las herramientas antiguas; golden tests de equivalencia, invalidación cruzada de cambios, y no cambiar esquemas públicos sin versionado.

### TW-PRO-05 — P1: configuración económica parcialmente implícita

**Evidencia:** src/budget/calc.js establece gastos_generales_pct=0, utilidades_pct=0 e iva_pct=19 si no son aportados; src/cic/ops/gestion.js exige porcentajes explícitos. La declaración de «no inventar» no queda homogénea. No se afirma que la tasa 19% sea incorrecta.

**Cierre:** presupuesto profesional requiere base de precios, fecha, fuente, moneda, proyecto tributario, alcance, GG, utilidad y fórmula de impuestos confirmados; sin datos emite escenario/borrador y no un total final.

### TW-PRO-06 — P1: generador de láminas acoplado a túnel

**Evidencia:** src/drawing/service.js invoca tunnelModel y src/tools/drawing.js expone generar_tunel con geometría de túnel; capaz para una especialidad, no un contrato universal de planta/corte/elevación/detalle.

**Cierre:** contrato DrawingDocument/Sheet/View/Annotation/Dimension/Revision/PrintProfile universal y especializaciones como adaptadores. Demostrar dos dominios (vivienda y túnel) sobre mismo compositor sin duplicar exportadores; no declarar permiso de construcción.

### TW-PRO-07 — P2: controlador COM de gran tamaño y puntos frágiles de integración

**Evidencia:** src/cad/autocad_com.js ~116.707 caracteres, combina transporte Node/PowerShell, COM, operaciones, inspección, fidelidad y recuperación. Historial de incidencias Unicode, COM ocupado y persistencia DXF/DWG.

**Cierre:** separar contratos de transporte, sesión, documento, operaciones, fidelidad y recuperación; test de cada frontera. Investigar plugin AutoCAD .NET de privilegios acotados si COM no supera las pruebas, sin prometer que .NET resolverá por sí solo la compatibilidad.

### TW-PRO-08 — P2: saturación de herramientas y experiencia

**Evidencia:** TW-11 declara tools/list de 79.386 bytes (72 herramientas) a 107.690 bytes (84 herramientas; +35,7%) en PR #19; PR #21 propone 85. No hay evaluación real de selección del modelo en Desktop ni de comprensión por la usuaria.

**Cierre:** catálogo por intenciones; herramientas de alto nivel estables; no ocultar acceso por disciplina; mantener snapshot de esquemas; medir precisión de selección y errores en 30 tareas reales. Evitar exigir IDs y JSON a la usuaria.

### TW-PRO-09 — P2: documentación no canónica

**Evidencia:** docs/ARCHITECTURE.md sigue como «diseño preliminar», docs/tw11/README.md dice «no hay código implementado» aun existiendo PR #14–#19, docs/AUTOCAD_COMPATIBILITY.md declara ausencia de validación real general aunque issue #8 recoge pruebas históricas puntuales.

**Cierre:** un único estado de producto por SHA/PR y matriz N0/N1/N2/N3 por capacidad, con vigencia de cada evidencia. Actualizar documentación heredada solo después de aceptación del contrato maestro, sin reescribir el historial.

### TW-PRO-10 — P2: falta institucionalizar Skills/competencias profesionales

**Evidencia:** el head no contiene .claude/skills; sí src/cic/especializaciones y múltiples contratos. Especializaciones no equivalen a entrenamiento/flujo de Claude Code ni a revisión profesional del contenido.

**Cierre:** contratos de Skills como procedimientos versionados, con pruebas, prohibiciones, herramientas de acceso mínimo y dueño profesional; distinguir Skills de ingeniería de desarrollo vs. procedimientos utilizables por Claude Desktop.

### TW-PRO-11 — P1: falta de evidencia de uso final, casos retenidos y calidad externa

**Evidencia:** protocolos TW-09/10/11/12 dicen NO EJECUTADOS; TW-11 G10 exige revisor y casos externos retenidos; no hay revisión profesional E3. Existen ensayos históricos parciales en AutoCAD real; no bastan para declarar el flujo profesional aprobado.

**Cierre:** evaluación ciega de errores, tiempos, completitud, reutilización de artefactos, claridad de incertidumbre, facilidad sin terminal, recuperación de errores, seguridad de originales y corrección humana. Exigir umbrales absolutos de tolerancia por operación, no un porcentaje genérico.

### TW-PRO-12 — P2: políticas de privacidad y distribución verificadas solo parcialmente

**Evidencia:** src/cic/conocimiento almacena fuentes por proyecto y usa aprobación humana; docs/RISKS.md advierte que el contenido expuesto a Claude puede salir a la nube. Instalación .mcpb y permisos Windows reales siguen pendientes. Licencia de fuentes NCh y datos de clientes debe controlarse por documento.

**Cierre:** opt-in de apertura/envío de fragmentos, minimización de datos por herramientas, trazas redactadas, retención por proyecto, permisos NTFS, SBOM/licencias, firma o checksum y rollback de extensión.

## 4. Cosas que NO se deben perder

- Protección de originales mediante rutas canónicas, hashes y transacciones.
- Falla cerrada, reconciliación de operaciones parciales y no repetición insegura de escrituras.
- Registro de claims, reglas epistémicas, unidades tipadas y estados stale.
- Separación entre cálculo geométrico y juicio profesional.
- Feature flag CIC, snapshot de herramientas previas y estrategia strangler.
- Motor solar y de alternativas con incertidumbres y oráculos.
- Documentación y reportes con fuentes y versiones.
- Seguridad contra prompt injection en archivos y aprobación de fuentes no autodeclarada.

## 5. Fuentes verificables

- Base y PR: https://github.com/cristobalMundacaV1/tannia-workspace/pull/21
- TW-12: https://github.com/cristobalMundacaV1/tannia-workspace/pull/20
- Hardening TW-11: https://github.com/cristobalMundacaV1/tannia-workspace/pull/19
- Autodesk ActiveX Import: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-ActiveX-Reference/files/GUID-5B441D77-BE99-454A-AAE3-9E19731B07D5.htm
- Autodesk API .NET DxfIn: https://help.autodesk.com/cloudhelp/2026/ENU/OARX-ManagedRefGuide/files/OARX-ManagedRefGuide-Autodesk_AutoCAD_DatabaseServices_Database_DxfIn_string_string.html
- Normas construcción: https://www.iconstruccion.cl/listado-nch/
- OGUC oficial: https://www.minvu.gob.cl/elementos-tecnicos/decretos/d-s-n47-1992-ordenanza-general-de-urbanismo-y-construccione/

## 6. Límites de la presente auditoría

No se descargó ni ejecutó la suite local ni se hizo pentest, perfilado real o verificación de licencias a nivel de cada dependencia. No se inspeccionó una muestra de planos reales de Tannia ni se realizó validación por un arquitecto, especialista de costos o ingeniero competente. Las prioridades son recomendación de auditoría, no decisiones ya aprobadas por el PO.
