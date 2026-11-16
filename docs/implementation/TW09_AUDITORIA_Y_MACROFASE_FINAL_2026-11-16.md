# TANNIA WORKSPACE — TW-09
## Auditoría independiente, investigación y macrofase final de refinamiento

**Fecha:** 16 de noviembre de 2026  
**Producto:** extensión privada MCP de Claude Desktop + AutoCAD 2027 para Windows  
**Repositorio:** `cristobalMundacaV1/tannia-workspace`  
**Baseline leído:** rama `feat/tw-modelo-3d`, HEAD `16a7bd7fb68bf62486f4258a6834e52f82ee2251`; código 3D corregido en ancestro `e9084a0`  
**Nombre propuesto:** **TW-09 — Autonomía Profesional, Gestión Integral de Proyectos y Confiabilidad CAD**  
**Autoridad:** Product Owner conserva aprobación, merges, distribución y validación profesional.  
**Estado de este documento:** propuesta de arquitectura y backlog tras lectura de código remoto. **No se ejecutó la suite, no se corrigió código, no se probó AutoCAD en este turno, no se aprobó el producto.**

## 1. Visión / contrato de experiencia

Tannia debe poder decir en español corriente: «Crea un proyecto llamado Casa Los Robles; te dejo los antecedentes y necesito una propuesta en 3D, guardada para revisar en AutoCAD». El asistente debe abrir o crear el proyecto correcto, registrar el ingreso real de archivos, leer solo lo soportado, analizar limitaciones, decidir supuestos conceptuales reversibles, solicitar solo datos indispensables, crear propuesta 2D/3D dentro de las capacidades realmente implementadas, producir DWG editable, comprobar resultados y entregar una respuesta breve: qué hizo, dónde guardó, qué decisiones tomó y qué requiere revisión profesional.

No hacer que Tannia conozca MCP, `ancla`, `distancia_mm`, ids, handles, JSON, Git o coordenadas salvo que ella las pida. No convertir a la IA en autoridad estructural/normativa, ni prometer convertir cualquier PDF/DWG a un proyecto constructivo completo. La herramienta valida hechos geométricos; el profesional valida las decisiones de diseño, permisos, materiales y normas.

### Reglas conductuales técnicas
- **Actuar:** operaciones seguras, necesarias y reversibles; no confirmar pasos rutinarios.
- **Decidir y revelar:** decisiones conceptuales que no fijan obligaciones estructurales, como una orientación de vista, variante inicial o cubierta provisional debidamente rotulada.
- **Preguntar:** proyecto ambiguo, fuentes insuficientes para una medida que se presentará como real, unidades/escala de cubicación, dato crítico de predio, operaciones destructivas, publicación final o decisión profesional de seguridad.
- **Detenerse:** fallo verificable, inconsistencia, permiso ausente, documento activo incorrecto, herramienta inexistente, falta de evidencia de persistencia. No ocultar problemas.
- **Comunicar:** breve para Tannia; evidencia técnica detallada en archivo de auditoría y bajo petición.

## 2. Alcance de la lectura y confianza en resultados

Se consultó el repositorio GitHub real en el baseline identificado: `AGENTS.md`, `CLAUDE.md`, `src/project/{projects,store}.js`, `src/security/sandbox.js`, `src/cad/{autocad_com,fidelidad}.js`, `src/design/{generador,derivar,coherencia,operaciones,servicio}.js`, `src/arq3d/{desde_anteproyecto,geometria,operaciones,servicio}.js`, `src/tools/{index,diseno,arq3d,cad}.js`, `src/mcp/util.js`, `src/server.js`, `package.json`, pruebas `tw15_dwg_confianza`, y documentación de limitaciones, QA y la directiva del PO. Se verificó el estado de los PR #2 y #7: ambos abiertos y draft. **No fue una ejecución dinámica del repositorio**: los escenarios de falla/riesgo identificados por análisis estático requieren pruebas de reproducción antes de la corrección.

**Clasificación:** `C` confirmado en código; `E` evidenciado por el ensayo de Claude Desktop reportado por el usuario; `H` hipótesis/riesgo plausible pendiente de demostrar. `P0` pérdida de datos/alteración de originales/validación falsa en situación crítica; `P1` defecto relevante de confiabilidad o autonomía; `P2` ergonomía/consistencia/limitación recuperable.

## 3. Hallazgos técnicos independientes

### TW09-F01 — P1 — Certificación de persistencia sin corroboración global (C+E)
**Evidencia real:** `persistencia="verificada"`, `entidades_leidas=51`, `entidades_tras_reabrir=0`, 50 sólidos + 1 texto supuestamente coincidentes y SHA antes/después idéntica. El estado es internamente contradictorio; el gate de persistencia no se puede aprobar.

**Código:** [`src/cad/autocad_com.js` alrededor de L551–583](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/cad/autocad_com.js#L551-L583) asigna `persistencia` exclusivamente desde `compararLecturas(antes.entidades, despues.entidades)`, pero `entidades_tras_reabrir: cierre.entidades` es solo un dato devuelto. [`src/cad/fidelidad.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/cad/fidelidad.js) compara propiedades por handle, **sin contrastar el conteo de `ModelSpace` ni reenumerar todo el espacio modelo después de reabrir**. Por lo tanto, `cierre.entidades=0` jamás veta el éxito si los handles siguen leyéndose correctamente. Además, el comparador detecta desapariciones en el conjunto previo pero no necesariamente entidades nuevas no incluidas en la lista de handles anterior.

**Qué NO se puede afirmar todavía:** la causa de que AutoCAD informara `ModelSpace.Count=0`. Podría involucrar activación de documento, enumeración COM o estado transitorio; no quedó reproducida/instrumentada.

**Corrección requerida:** nueva identidad documental y snapshot por fase; cerrar/reabrir, activar documento esperado, comprobar ruta y estado de carga, reenumerar handles, conteos, tipos/capas y lecturas tipadas de la versión del disco; validar cobertura en ambos sentidos, lecturas desconocidas, cardinalidad y coherencia interna; `verificada` solo cuando todas las comprobaciones aplicables coinciden. Diferenciar `fallida`, `no_concluyente`, `verificada`, sin permitir `verificada` frente a 51→0 aunque el SHA sea idéntico. Contrato de status + evidencia por lote. Probar 51/0, incremento, pérdida, duplicación, handle huérfano, documento equivocado, sin guardado, reapertura fallida, 2.000 entidades y textos Unicode.

### TW09-F02 — P1 — Verificación 2D↔3D tiene un alcance más estrecho que el mensaje (C+E)
**Evidencia:** 2D `altura_piso_cielo_mm=2500`; 3D creado con 2400; `coherencia_2d="coherente"`. Posteriormente 3D fue elevado a 2600 y siguió reportando coherente.

**Código:** [`src/arq3d/desde_anteproyecto.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/arq3d/desde_anteproyecto.js) fija `SUPUESTOS_POR_DEFECTO.altura_muros_mm=2400`; `coherenciaConGeo` comprueba huella y ubicación/anchura de vanos, **no** altura de nivel, dintel/antepecho, espesores verticales, cubiertas, ni autoridad de cotas. [`src/design/generador.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/design/generador.js) conserva la altura del plano. [`src/arq3d/servicio.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/arq3d/servicio.js) sincroniza conservando `niveles` y `supuestos` del 3D: revisar si el registro de supuestos queda desactualizado tras cambios de altura.

**Corrección requerida:** contrato facetado `planta`, `vanos_en_planta`, `alturas`, `altos_y_antepechos`, `espesores`, `revision_origen`, con `verificado/no_comparado/discrepante` por faceta. Altura piso–cielo 2D ≠ altura bruta de muro automáticamente: documentar relación, criterio y tolerancia según qué representa cada valor; nunca forzar igualdad si tienen semánticas diferentes. Mostrar `coherente_en_alcance` en vez de una aprobación ambigua. Derivar valores cuando realmente tengan la misma semántica o declararlos como supuestos. Sincronizar metadatos de altura, cubierta y estado de fuente al modificar.

### TW09-F03 — P1 — Ciclo de vida COM dependiente de documento activo (C; error real E)
**Evidencia:** `AUTOCAD_SIN_DOCUMENTO` transitorio al cambiar la vista; recuperación posterior. No se ha establecido causa precisa.

**Código:** [`src/cad/autocad_com.js` PS_CONNECT](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/cad/autocad_com.js#L59-L75) obliga a obtener `ActiveDocument` **antes** de ejecutar cualquier script, incluso `construir_3d`, que crea un nuevo dibujo mediante `Documents.Add`. El script `cerrar_reabrir` busca documento por ruta pero las posteriores llamadas `leer_lote` vuelven a tomar el `ActiveDocument` general. La documentación oficial de Autodesk permite `Documents.Add/Open` cuando hay **cero documentos abiertos**; `SendCommand` puede ser asíncrono si requiere interacción.

**Corrección requerida:** separar conexión a `Application` de resolución de documento; operaciones de crear/abrir no necesitan documento activo previo. Operaciones de leer/escribir seleccionan por ruta/ID esperados, revalidan identidad antes y después; manejo de busy, ventanas y comandos; serializar transiciones COM/evitar reintentos de mutaciones no idempotentes; registrar modo cero-documentos, cambio de foco, documento con cambios sin guardar, múltiples dibujos, AutoCAD abierto sin dibujo, errores COM, vista/estilo `solicitado` ≠ `confirmado`.

### TW09-F04 — P1 — Descripciones ambiguas de posicionamiento de vanos (C+E)
[`src/design/derivar.js` L70–79](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/design/derivar.js#L70-L79): con `ancla="inicio"`, `distancia_mm` mide **el centro del vano** desde el origen del muro; con `fin`, mide el centro respecto del extremo; con `centro`, es desplazamiento relativo al punto medio del muro. Los descriptores del catálogo en [`src/design/operaciones.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/design/operaciones.js) no lo aclaran. El modelo tuvo que crear ensayos descartables para descubrirlo.

**Corrección requerida:** una semántica formal para centro, borde, orientación y origen, ejemplos y pruebas de contrato en cada herramienta. Agregar consulta estructurada de muros/vanos y **previsualización pura** de modificaciones, además de cálculo de candidatos libres. El asistente no debería pedir IDs a Tannia si es capaz de inspeccionarlos. No traducir un vacío geométrico automáticamente a conformidad estructural.

### TW09-F05 — P1 — La creación de documentos del proyecto sigue siendo manual (C)
[`src/project/projects.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/project/projects.js) ya crea `Proyectos/<nombre>` con siete carpetas estándar; [`src/security/sandbox.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/security/sandbox.js) limita rutas. [`src/tools/index.js` L63–76](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/tools/index.js#L63-L76) expone crear/listar, pero el mensaje posterior dice **«Copie sus planos originales a 02 Originales»**. No hay herramienta equivalente para importar explícitamente archivos adjuntos al proyecto ni para abrir/seleccionar contexto de proyecto con identidad estable.

**Corrección requerida:** mantener la estructura existente; metadata UUID estable migrable, creación idempotente y nombres Windows robustos; `proyecto_resolver/seleccionar`, `proyecto_resumen`, `proyecto_importar_antecedentes` con origen **realmente accesible y autorizado**. La entrega no debe depender de que Claude Desktop proporcione automáticamente rutas de archivos adjuntos si eso no se verificó. Detectar capacidades reales y ofrecer un mecanismo local seguro para importar por consentimiento, con copia al proyecto, hash, manifiesto, formatos y límites; si solo hay un archivo en la conversación y el servidor no puede acceder a sus bytes, reportar claramente el límite y solicitar un mecanismo compatible. Nunca fingir importación.

### TW09-F06 — P1 — La autonomía de diseño general aún tiene límites reales (C)
[`src/design/generador.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/design/generador.js) genera plantas rectangulares de **un piso**, 2–3 dormitorios, 1–2 baños, 55–130 m², con variantes espejo A/B. El motor 3D sí admite modelos estructurados más generales, pero eso **no hace genérico al generador 2D**. `docs/KNOWN_LIMITATIONS.md` lo reconoce expresamente.

**Corrección requerida:** interfaz de encargo/capability routing: (a) anteproyecto de vivienda soportado; (b) modelado general 3D desde un programa estructurado sustentado en insumos; (c) transformación desde planos aportados, solo si las entidades y su semántica pueden interpretarse realmente; (d) declaración explícita de lo que requiere detalle profesional o no se puede hacer. Para proyectos diversos, proporcionar operaciones y plantillas reutilizables, sin introducir una casa hardcodeada ni prometer BIM/IFC. Pruebas sobre vivienda no rectangular, dos niveles y recinto comercial dentro de lo soportado.

### TW09-F07 — P1/P2 — Riesgos de consistencia de archivos y versiones (C → hipótesis de falla)
[`src/design/servicio.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/design/servicio.js) escribe DXF, SVG, JSON y luego historial en pasos separados. [`src/arq3d/servicio.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/arq3d/servicio.js) escribe modelo y posteriormente historial. [`src/project/store.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/project/store.js) usa `atomicWriteJson` para un único archivo, no para la transacción compuesta. Ante cierre abrupto puede quedar una versión huérfana u otros parciales. No consta que haya ocurrido.

**Corrección requerida:** staging/journal, reconciliación/reanudación segura, manifest inmutable por versión, hashes y enlaces 2D↔3D↔DWG, nombres únicos incluso si se solicita dos veces en el mismo segundo, operaciones idempotentes, no sobrescribir. Probar `kill`/errores de disco/permisos entre cada paso con fixtures y recuperación. `tannia_entregable_exportar` debe auditarse frente a reemplazos accidentales en destino: hoy usa `fs.copyFileSync` sobre un nombre existente sin opción de exclusividad.

### TW09-F08 — P2 — Respuestas orientadas a depuración, no a conversación (C)
[`src/mcp/util.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/mcp/util.js) coloca el resumen más **todo el JSON legible** en el campo de texto del resultado y además devuelve `structuredContent`. Esto facilita diagnóstico, pero expone grandes detalles al contexto que utiliza Claude. [`src/server.js`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/server.js) instruye a **preguntar siempre** alturas/espesores/valores, sin diferenciar decisión conceptual editable frente a una cantidad real exigible.

**Corrección requerida:** contrato con mensaje compacto (resultado, camino legible, pendiente crítico, decisiones), detalle estructurado cuando corresponda y `auditoria` para el rastro. **No retirar a ciegas el fallback textual** sin probar compatibilidad con el cliente. Política de tres categorías `actuar/suponer_y_declarar/preguntar_o_detenerse`, con trazabilidad por decisión, no solo prompt. Guías de herramienta claras y pruebas de transcripciones reales, sin inundar la conversación con JSON.

### TW09-F09 — P1 — Aprobación de originales sin evidencia cuando no hay originales (C+E)
[`src/project/store.js` verifyOriginals](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/project/store.js) devuelve `ok: true` si no detecta cambios; con manifiesto vacío informa 0 `verificados`, lo cual solo prueba que no encontró modificaciones, **no** que las reglas de protección hayan sido ejercidas sobre archivos reales. `chmod` puede ser best-effort en Windows; la garantía principal debe ser el sandbox y la prohibición efectiva de escritura, no el atributo de lectura.

**Corrección requerida:** distinguir `integros=0` de `originales_protegidos_validado=true`; pruebas reales con DWG/DXF/PDF, bloqueo `.dwl`, `.bak`, ACL de Windows, symlink/junction, mayúsculas/acentos/UNC/long paths, inyección de rutas y AutoCAD con original abierto, antes/después SHA.

### TW09-F10 — P2 — Contratos MCP, reintentos y documentación envejecida (C)
El fallo de `z.tuple` fue corregido en `e9084a0` y la prueba recursiva reportó 54 herramientas; queda test de instalación real en cada versión del `.mcpb`. En [`src/cad/autocad_com.js` `#exec`](https://github.com/cristobalMundacaV1/tannia-workspace/blob/16a7bd7/src/cad/autocad_com.js), los HRESULT ocupados pueden provocar reintento automático **incluso de operaciones con efectos**, sin prueba universal de idempotencia. El encabezado del adaptador dice que no usa `Close`, `SaveAs` ni `SendCommand`, pero el código actual sí los usa en sus flujos específicos. `docs/KNOWN_LIMITATIONS.md` aún dice que no hay AutoCAD real, aunque el usuario ya aportó evidencias de 2D y 3D posteriores.

**Corrección requerida:** auditoría transversal de todas las 54 herramientas (registro, JSON Schema, inputs reales, anotaciones RO/RW/destructive, tiempo, retries, output/errores, permisos, compilado `.mcpb`), evitar retry inseguro, actualizar referencias a evidencias con SHA y gate correspondiente. Separar prueba visual, `AUDIT`, persistencia, ejecución profesional.

### TW09-F11 — Riesgos a verificar en pruebas de integración (H)
Concurrencia de dos sesiones MCP, cambio del proyecto activo mientras AutoCAD muestra otro DWG, documentos con rutas Unicode, sesiones de permisos elevados y modo sin documentos; un `SaveAs` parcialmente completado; protección de archivos copiados desde una carpeta externa; prompt injection dentro de planos/PDF o nombres de capa; colisiones entre slug recortado de anteproyectos, nombres equivalentes en Windows, enlaces/junctions; escala/unidad incorrecta. **Estos son riesgos de prueba, no defectos comprobados en campo.**

## 4. Investigación de contratos y decisiones resultantes

**MCP:** la especificación oficial de herramientas (`https://modelcontextprotocol.io/specification/2025-11-25/server/tools`) define el llamado por el modelo, descripciones y `inputSchema` JSON Schema y permite respuestas estructuradas; el modelo puede elegir herramientas, pero ese diseño no garantiza decisiones correctas. La negociación de capacidades de `initialize` (`https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle`) determina qué opciones puede utilizar el cliente. Elicitation (`https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation`) permite pedir aclaraciones, pero **solo si Claude Desktop declara soporte**; no se implementará una dependencia obligatoria de una capacidad no comprobada. Por simplicidad, conversación ordinaria primero, formularios únicamente cuando verdaderamente hagan falta.

**AutoCAD/COM:** documentación Autodesk: `https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-ActiveX-Reference/files/GUID-E13A580D-04CA-46C1-B807-95BB461A0A57.htm` (`SendCommand`) explica que puede continuar de forma asíncrona según interacción; `https://help.autodesk.com/cloudhelp/2025/CHS/AutoCAD-LT-ActiveX/files/GUID-83045B84-E056-4AE6-AEF5-D48AFB4F9F78.htm` documenta estado cero documentos y uso de `Documents`. **No atribuir automáticamente el conteo 0 a una carrera COM:** instrumentar y reproducir antes.

**MCPB/Claude Desktop:** ayuda oficial `https://support.claude.com/es/articles/10949351-primeros-pasos-con-servidores-mcp-locales-en-claude-desktop`: extensiones privadas `.mcpb`, instalación e inspección de herramientas, reinicio ante problemas. El acceso a adjuntos debe probarse en la superficie exacta que usa Tannia: que un archivo aparezca en el chat no demuestra que el servidor MCP pueda leer su ruta local.

**Decisión:** no agregar segundo agente, otro LLM, SaaS ni frontend propio por defecto. Claude Desktop es el agente conversacional; Tannia Workspace ofrece capacidades deterministas, estado por proyecto, herramientas de diseño/inspección/edición y garantías. Evaluar mejoras instrumentales antes de incorporar dependencias nuevas, y actualizar paquetes solo por necesidad demostrada.

## 5. Arquitectura objetivo

```text
Tannia (lenguaje natural)
  ↓
Claude Desktop (agente, interpretación, criterio de preguntar/actuar)
  ↓ protocolo MCP con schemas validados
Tannia Workspace local
  ├── contexto de sesión/identidad de proyecto (sin estado global ambiguo)
  ├── registro de proyectos + manifest de fuentes + permisos
  ├── importación segura de documentos y análisis de capacidades
  ├── decisiones/supuestos + previsualización/plan de edición
  ├── motor 2D + motor 3D + historial y transacciones
  ├── adaptador AutoCAD COM con identidad documental + serialización
  ├── verificadores independientes: geometría, fidelidad, persistencia, QA
  └── entregables guardados con ruta, versión, SHA, evidencia, límites
      ↓
Proyectos/<proyecto>/[01 Antecedentes, 02 Originales,
 03 Trabajo, 04 Cubicaciones, 05 Presupuestos,
 06 Informes, 07 Entregables]/ + .tannia
```

**Separación entre modelo y archivos:** `anteproyecto` (datos y DXF), `modelo3d` (datos y primitivas), `dwg_generado` (archivo disco), `dwg_persistido` (comparación efectiva tras reapertura), `revisado_profesionalmente` (Tannia). Ninguno implica el estado siguiente por defecto.

**Modelo de proyecto:** ID estable (UUID o equivalente) + nombre visible + ruta canónica + manifest + sesiones/vínculos explícitos + permisos + versiones. La inferencia «el proyecto de ayer» solo si hay una correspondencia inequívoca; en otros casos pregunta breve. No un global mutable compartido entre conversaciones que pueda dirigir operaciones a otro proyecto.

**Modelo de importación:** manifiesto con ruta relativa dentro del proyecto, nombre de origen legible, SHA-256, bytes, fecha, formato detectado, modo (original/antecedente), autenticidad/autoridad, fuente, revisión y restricciones. Se copia solo tras acceso real autorizado; insumos no fiables son datos, no instrucciones. Nunca importar automáticamente rutas arbitrarias suministradas en un documento.

**Política de decisiones por riesgo:** concepto reversible -> puede proponer bajo supuestos; atributos que determinan cantidad real/coste/norma -> exigir evidencia o confirmación; alteración destructiva/sustitución de originales/aprobación profesional -> detenerse y solicitar autorización. La herramienta puede recomendar una ubicación libre, nunca certificar por sí misma un pilar de albañilería confinada.

## 6. Backlog de TW-09 y orden de ejecución

**TW09-00 — Baseline, matriz de evidencias y reproducción (3 historias)**
- `09-001` Congelar SHA, árbol de PRs, contratos, mapa de 54 herramientas, matriz C/E/H y fixture de las pruebas reales (sin exponer documentos personales).
- `09-002` Reproducir 51→0, altura 2500/2400, ventana centrada y `AUTOCAD_SIN_DOCUMENTO` por separado; no inventar reproducciones.
- `09-003` Gate de compatibilidad del `.mcpb` instalado: 54/54 esquemas y smoke protocolario real, sin aprobar el UI sin observarlo.
**Gate G0:** defectos localizados; evidencia de reproducción o estado `no_reproducido`, baseline sellado; tests rojos cuando aplique.

**TW09-01 — Verdad documental y COM (4 historias)**
- `09-004` Reparar el resultado de persistencia, conteos globales, extraños, doble enumeración, identidad tras cerrar/reabrir.
- `09-005` Estabilizar lifecycle COM en 0/múltiples documentos, documento activo, guardado, vista y cambio de foco; identidad por ruta.
- `09-006` Prohibir retry inseguro de operaciones mutantes; serialización e idempotencia/recovery.
- `09-007` Diagnóstico y auditoría de AutoCAD `AUDIT`, diferencias y errores sin falsa certificación; tipo de comprobación claramente rotulado.
**Gate G1:** 0 falsos `verificada` en todos los fixtures de fallos; repro 51→0 no verde; Windows y COM simulado verdes; prueba real con AutoCAD queda pendiente hasta ejecutarse.

**TW09-02 — Diseño coherente y ediciones predecibles (4 historias)**
- `09-008` Contrato semántico de altura, cubierta, espesor, nivel, geometría y fuente 2D↔3D por facetas.
- `09-009` Unificar centro/borde/ancla de vanos en catálogos, esquemas y documentación; pruebas geométricas.
- `09-010` Añadir inspección y previsualización pura de ventana, recolocaciones y huecos factibles, con explicaciones simples y alertas no normativas.
- `09-011` Resincronización 2D→3D conserva decisiones válidas, actualiza supuestos y marca claramente desfasajes.
**Gate G2:** 2500/2400 y 2500/2600 no se presentan como coherencia total sin faceta vertical; 15/15 vanos y luego 16/16 tras redistribución; ensayo de vanos ya no necesita mutar un proyecto descartable para interpretar semántica; sin falso cumplimiento estructural.

**TW09-03 — N proyectos y documentos iniciales (4 historias)**
- `09-012` Identidad estable, selección contextual segura y migración de proyectos anteriores sin cambiar rutas ni hashes.
- `09-013` Creación idempotente, nombre único Windows Unicode y manejo de carpetas parciales; lista, selección, reanudación.
- `09-014` Importación local segura con consentimiento, manifiestos, deduplicación y registro de originales reales; establecer capacidad de adjuntos del cliente mediante ensayo real.
- `09-015` Búsqueda y resumen por proyecto: antecedentes, último anteproyecto, modelo 3D, último DWG persistido, pendientes y entregables.
**Gate G3:** mínimo tres proyectos concurrentes con proyectos, originales, modelos e historial independientes; solicitudes ambiguas no eligen carpeta equivocada; importación se certifica solo si bytes realmente copiadas y hasheadas, no porque el chat diga «adjunto».

**TW09-04 — Versiones y recuperación (3 historias)**
- `09-016` Transacciones de versiones 2D/3D/DWG con estado journal, staging/commit y reparación de parciales.
- `09-017` Garantía de no sobrescritura en exportaciones y artefactos, manifiesto de provenance y SHA; impedir contaminación entre proyectos.
- `09-018` Recuperación de interrupciones, errores de disco, reboot, documento con cambios sin guardar, rollback/restore sin borrar versiones.
**Gate G4:** pruebas de fallos inyectados en cada transición; cero artefactos considerados completos sin manifest válido; SHA de versiones históricas inalterado.

**TW09-05 — Capacidad profesional desde el encargo (3 historias)**
- `09-019` Enrutador de capacidad del proyecto/archivos: diseño 2D soportado, 3D estructurado, transformación de origen, no soportado / requiere dato.
- `09-020` Flujo completo «nuevo proyecto + antecedentes + propuesta 2D/3D + AutoCAD + guardar» usando herramientas del motor y supuestos explícitos, sin casa hardcodeada.
- `09-021` Trabajo sobre documentos reales: distinguir geometría extraíble, información inferida y requerimientos de revisión, limitar alcance de formatos actuales.
**Gate G5:** encargos diferentes de la casa demo, con outputs editables donde el motor lo soporta y negativa clara donde no; sin promesas de BIM/IFC, proyectos firmados o cumplimiento normativo.

**TW09-06 — Autonomía y diálogo natural (4 historias)**
- `09-022` Política de autonomía y protocolo de decisiones de bajo/medio/alto riesgo implementados en contratos + instrucciones del servidor; control real de autorización en herramientas.
- `09-023` Respuestas compactas para Tannia: contexto, cambio, ubicación del DWG, supuestos críticos, revisión; telemetría técnica separada. Mantener fallback MCP compatible.
- `09-024` Continuidad proyecto/versión entre sesiones; desambiguación conversacional sin preguntar lo que ya consta en fuentes.
- `09-025` Recuperación de errores por caminos seguros, sin reintentos destructivos ni alucinaciones de éxito.
**Gate G6:** evaluación de transcripciones naturales sobre tareas exitosas, ambiguas e imposibles; no pedir IDs, JSON, coordenadas o herramientas a Tannia. Cada supuesto relevante informado sin preguntas innecesarias y cero aprobaciones profesionales automáticas.

**TW09-07 — Seguridad y operación Windows (3 historias)**
- `09-026` Pruebas reales de originales con contenido, ACL/locks/junctions/Unicode; auditoría de rutas y garantías de rollback.
- `09-027` Seguridad de archivos aportados, cuotas, tipos, prompt injection, logs mínimos y privacidad explicada.
- `09-028` Perfilado y resistencia: grandes dibujos, batching, timeouts, dos conversaciones/instancias, colisiones de nombres, rutas largas, recuperación; empaquetado `.mcpb` privado.
**Gate G7:** zero access outside sandbox en pruebas, 0 originales modificados, COM no actúa sobre documento equivocado, permisos de cliente respetados, rendimiento con datasets definidos y log reproducible.

**TW09-08 — Piloto real, auditoría independiente y RC (3 historias)**
- `09-029` Matriz de pruebas en Claude Desktop/Windows/AutoCAD 2027: instalación, herramientas visibles, proyecto, docs, 2D/3D, reabrir, editar, `AUDIT`, guardado y originales.
- `09-030` Pruebas de aceptación con usuaria: 15 encargos naturales variados (crear, continuar, cambiar, cancelar, documento insuficiente, errores y proyecto ambiguo), evaluados con criterios observables; ningún encargo de producción sin revisión.
- `09-031` Informe final de evidencias por SHA, límites, licencias, manual de 1 página, instalación, backup, rollback, incidentes y PR draft para auditoría; no merge/release.
**Gate G8:** RC técnico listo solo cuando G0–G7 y CI están respaldados; `VALIDADO EN AUTOCAD REAL` solo con logs/capturas de la ejecución real; `VALIDADO POR TANNIA` únicamente con su participación y aceptación explícita; liberar solo tras autorización del PO.

**Total propuesto:** 9 subfases, 31 historias, 9 gates. La numeración es nueva y no altera TW-00A–TW-08.

## 7. Matriz de validación crítica

| Caso | Acción y criterio de aprobación |
|---|---|
| Conteo reabierto 0 con 51 handles antes | Persistencia no puede ser `verificada`; evidencia del alcance y documento real |
| Se agrega entidad nueva no presente en handles previos | Diferencia detectada en verificación completa |
| Documento cambia entre dos llamadas COM | Aborta o resuelve por ruta; jamás manipula el otro DWG |
| AutoCAD sin documento al intentar nuevo proyecto | Se permite creación con `Documents.Add` sin exigir ActiveDocument |
| Vista/estilo tarda en aplicarse | Resultado `solicitado`, no `verificado` antes de comprobación |
| 2D 2500 vs 3D 2400/2600 | Faceta de alturas explícita y explicación de semántica; no falso verde |
| Nueva ventana en tramo sin lugar | Previsualiza, explica opciones, no rompe ni certifica estructura |
| Dos proyectos con el mismo nombre normalizado | No se mezclan; colisión resuelta o aclarada |
| Se solicita un plano con adjunto inaccesible al MCP | No simula lectura; ofrece importación segura si existe |
| `02 Originales` vacío | Estado `sin originales que verificar`, nunca prueba positiva de protección |
| El proceso muere tras escribir SVG pero antes de historial | Recuperación o limpieza de staging segura, sin versión falsa |
| Original DWG/DXF/PDF con hash | Todas las operaciones mantienen SHA del original |
| Tannia dice «abre la casa de ayer» con dos candidatas | Consulta breve: cuál proyecto; no adivina |
| Tannia pide cubierta/detalles estructurales | Separa propuesta editable de aprobación profesional |
| CI verde / pruebas simuladas | No equivalen a AutoCAD real ni prueba de conversación de Tannia |

## 8. Métricas de aceptación predefinidas (objetivos, no resultados actuales)

- **Seguridad:** 0 originales modificados; 0 escrituras a proyectos equivocados; 0 aprobaciones normativas/estructurales automáticas en tests.
- **Persistencia:** 0 falsos positivos con fixtures de alteración/incoherencia; cobertura exacta y evidencia de reapertura para cada archivo certificado.
- **Compatibilidad:** 100 % de herramientas registradas y llamadas válidas bajo el protocolo y paquete de prueba; `.mcpb` instalado manualmente en Claude Desktop antes de certificar compatibilidad de UI.
- **Reversibilidad:** 100 % de operaciones del catálogo que prometen nuevas versiones conserva anteriores y recupera correctamente ante fallos inyectados.
- **Proyectos:** al menos 3 proyectos de prueba diferentes y simultáneos; cero referencias cruzadas; ids permanentes luego de reinicio.
- **Conversación:** 15 escenarios naturales evaluados; todos los críticos (privacidad, proyecto ambiguo, cantidades reales, aprobación) bloqueados cuando proceda; en los escenarios suficientemente definidos no se aceptan interrogatorios superfluos como vía para eludir implementación.
- **Transparencia:** estado separado para `artefacto_generado`, `persistencia_verificada`, `revision_profesional` y `cumplimiento_normativo`, sin inferencias entre ellos.

## 9. Seguridad, migraciones y restricciones de alcance

- Mantener **sin BIM/IFC**, sin SaaS, sin nuevo frontend, sin dependencia de ChatGPT: el cliente seguirá siendo Claude Desktop.
- No editar ni borrar archivos de `Proyectos/` de Tannia para probar. Test fixtures aislados; importar solo con consentimiento y ruta efectivamente permitida.
- No mutar `main`, ramas ajenas, PR #2/#7 ni releases; crear rama desde el HEAD 3D vigente después de comprobar ancestros y su PR apilado. El diseño no se considera mergeado por estar en esta carpeta.
- Detectar versiones existentes y migrar **sin reescribir** sus DWG/DXF ni alterar hashes; respaldos de metadatos e idempotencia.
- Los antiguos ensayos `Ensayo semantica vanos` y `Ensayo 3D semantica` deben considerarse evidencia de QA y **no borrarse** por un mecanismo de cleanup automático.
- No presentar `AUDIT` visual, coherencia geométrica, certificación normativa o integridad de originales como equivalentes.

## 10. Productos de ingeniería exigidos al implementador

1. `docs/implementation/TW09_AUTONOMIA_PROFESIONAL_MACROFASE.md` y `docs/implementation/TW09_BACKLOG.md` adoptando/refinando esta propuesta con trazabilidad de historias.
2. `docs/qa/TW09_AUDIT_INITIAL.md`, `docs/qa/TW09_EVIDENCE_MATRIX.md`, `docs/qa/TW09_REGRESSION_REPORT.md`, fixtures anónimos de contradicciones y protocolos de prueba de campo.
3. Contratos para identidad de proyecto, importación, semántica de vanos/alturas, decisiones y verificaciones por faceta.
4. Código + tests incrementales por subfase y CI Windows/Ubuntu sobre SHA exacto.
5. `.mcpb` privado para prueba real y manual para Tannia (solo cuando el RC lo permita; no distribuir como release final).
6. Handoff al Director de Revisión independiente: causas comprobadas, hipótesis descartadas, riesgos abiertos, hashes, versiones y pasos de aceptación de la usuaria.

**Decisión recomendada:** ejecutar TW09-00 → TW09-01 y cerrar P1 de verdad documental **antes** de trabajar la capa conversacional. Un agente agradable que certifica incorrectamente un DWG no está listo para Tannia.

---

### Referencias primarias

- GitHub, baseline leído: `https://github.com/cristobalMundacaV1/tannia-workspace/tree/16a7bd7`
- Directiva del PO registrada el 16-11-2026: `TANNIA_WORKSPACE_DIRECTIVA_FASE_AUTONOMIA_Y_PROYECTOS_2026-11-16.md` (documento anterior).
- MCP Tools: `https://modelcontextprotocol.io/specification/2025-11-25/server/tools`
- MCP Lifecycle: `https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle`
- MCP Elicitation: `https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation`
- Autodesk ActiveX SendCommand: `https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-ActiveX-Reference/files/GUID-E13A580D-04CA-46C1-B807-95BB461A0A57.htm`
- Autodesk zero-document state: `https://help.autodesk.com/cloudhelp/2025/CHS/AutoCAD-LT-ActiveX/files/GUID-83045B84-E056-4AE6-AEF5-D48AFB4F9F78.htm`
- Claude Desktop MCP locales: `https://support.claude.com/es/articles/10949351-primeros-pasos-con-servidores-mcp-locales-en-claude-desktop`
