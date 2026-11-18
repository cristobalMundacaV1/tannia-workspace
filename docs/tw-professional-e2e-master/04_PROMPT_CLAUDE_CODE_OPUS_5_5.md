# 04 — Prompt de ejecución para Claude Code Opus 5.5

> **Copiar íntegro como orden de trabajo.** Este prompt no equivale a aprobación de PR, merge o release.

# MUNDACA'S SOLUTIONS — TANNIA WORKSPACE
## MISIÓN DE IMPLEMENTACIÓN: TW-PRO-E2E — OFICINA TÉCNICA DIGITAL DE PRINCIPIO A FIN

**Rol:** Principal Software & Construction Systems Engineer — Claude Code Opus 5.5  
**Repositorio:** \`cristobalMundacaV1/tannia-workspace\`.  
**Autoridad:** el Product Owner decide alcance, aceptación, merges, distribución e instalación; Astra revisa independientemente los resultados cerrados. Tú implementas y demuestras, **no apruebas tu propio trabajo**.

### 1. Tu misión

Quiero que Tannia Workspace deje de comportarse como una colección de herramientas y sea un colaborador técnico capaz de cumplir **un encargo profesional completo** a partir de los antecedentes de una obra.

La experiencia correcta es sencilla: la persona entrega un ZIP/RAR, carpeta, planos o documentos; explica qué necesita; Tannia recibe el contenido utilizable, identifica lo que falta, genera planos, mide cantidades, prepara partidas/APU/presupuesto, produce memoria/EETT/PDF/Excel, solicita únicamente autorizaciones pertinentes y entrega un expediente organizado y verificable.

No inventes datos. No simules cálculos, operaciones de AutoCAD ni autorizaciones. No afirmes que un esquema académico es diseño aprobado. Si tienes todos los datos y capacidades, **haz el trabajo, sin pedirle al usuario instrucciones informáticas**. Si falta una decisión humana, pide solo lo necesario y explica su impacto en la obra.

### 2. Recuperación obligatoria antes de programar

1. Lee \`AGENTS.md\`, \`CLAUDE.md\`, estado de continuidad, arquitectura, \`docs/ROADMAP.md\`, contratos de herramientas y documentación relevante.
2. Recupera todas las ramas/PR apilados, especialmente #29, #30, #33 y el nuevo PR **documental** que contiene esta macrofase. Verifica head SHA y si Claude ya implementó componentes equivalentes desde la última inspección. **No deshagas ni dupliques trabajo activo**.
3. Lee completamente:
   - \`docs/tw-professional-e2e-master/README.md\`
   - \`01_MACROFASE_EJECUCION_Y_GATES.md\`
   - \`02_CONTRATOS_TRANSVERSALES.md\`
   - \`03_UAT_INTEGRAL_Y_METRICAS.md\`
   - \`05_TRAZABILIDAD_AUDITORIAS.md\`.
4. Lee auditoría independiente de Astra (A-01…A-07, roadmap E01…E30), auditoría profesional TW-PRO-01…12 y el expediente del motor de planos PR #33 / issues #31/#32.
5. Identifica qué está implementado, qué está probado solo en CI, qué exige Windows/AutoCAD real y qué es propuesta. No uses como base funcional un \`main\` que todavía no tiene esos módulos sin recuperar el stack.

**Entrega inicial obligatoria:** tabla de baseline por SHA, módulos existentes reutilizables, huecos por gate, dependencias, prioridades y plan de PRs. Después **implementa**; no te limites a devolver planificación.

### 3. Secuencia de implementación

Ejecuta la macrofase \`G00→G12\` del documento 01 con dependencias, manteniendo una **ruta vertical demostrable desde el primer corte**:

\`antecedentes → proyecto → planos → mediciones → partidas/APU → presupuesto → memoria/documentos → autorización/manifest → entrega\`.

Prioriza primero fallos de confianza P0: suplantación de aprobación humana (A-01/TW-PRO-01), exportación desactualizada (A-02) y una única revisión/cadena de datos. Después recepción de ZIP/RAR, orquestación y motor de planos/CAD, cantidades, presupuestos y documentos de especialidad. Extiende a perfiles de construcción posteriores solo sobre capacidades respaldadas por evidencia.

**Regla de implementación:** reutiliza \`src/project/\`, \`src/cic/\`, \`src/quantities/\`, \`src/budget/\`, \`src/drawing/\`, \`src/cad/\`, \`src/design/\`, sus esquemas y tests. Emplea adaptadores/migración gradual donde existan rutas legacy y CIC; evita reescribir motores válidos o introducir BIM/IFC sin autorización.

### 4. Experiencia no negociable

Tannia no debe exigir saber qué es MCP, un servidor, una variable de entorno, un JSON, una ruta por cada PDF ni una transacción.

- Al entregar un solo ZIP/RAR, el sistema debe **poder trabajar con el expediente completo** de manera segura, sin omitir silenciosamente archivos. Verifica el puente real con Claude Desktop; si el host no entrega bytes al MCP local, solicita una sola ubicación local del archivo y automatiza todo lo restante. No prometas un acceso que la plataforma no ofrece.
- Si los antecedentes alcanzan, continúa sin preguntas rutinarias. Si falta algo determinante, agrupa una ronda de preguntas con explicación de por qué importa.
- Cada autorización humana: **qué hará, motivo, archivo/obra afectados, cambio, versión anterior conservada y efecto de rechazar**, con botones claros «Autorizar / Mantener anterior». La aprobación es un acto humano fuera del control del modelo, ligado al hash de la revisión.
- Las respuestas del asistente deben ser breves, naturales y orientadas a construcción. La jerga de desarrollo solo se usa en bitácoras técnicas, nunca como explicación primaria a la usuaria.
- La salida debe indicar en una frase el estado y dónde están los archivos; jamás \`DWG generado\` si AutoCAD no lo ejecutó.

### 5. Calidad de planos y construcción

Tu objetivo no es producir líneas: es generar **documentación de obra legible y editable** dentro de un perfil técnico demostrado.

**Caso túnel:** cuadro geométrico, geometría de excavación, secciones portal/interior, materiales/EETT, cuadro de pernos calculado, notas/hipótesis/pedientes, referencias, simbología/grosores, corona, hastial y pie, detalle perno–malla–shotcrete y traslape de malla. No copiar parámetros de las imágenes si no son datos del expediente. Geotecnia/fortificación sin validación: **esquema académico/preliminar**.

**Caso edificación:** plantas, cortes, elevaciones, detalles, ejes/niveles, vanos, materiales, cuadros y cotas; mediciones trazables sin doble cuenta; presupuesto y documentos coherentes. Otras especialidades (vialidad, estructuras, sanitaria, eléctrica) requieren sus propias reglas, simbología y evidencia, no etiquetas vacías.

DXF, PDF, DWG y cantidades proceden de un modelo canónico. Validar estilos, escalas, anotación, XDATA, entidades, layouts, texto, impresión y fidelidad DXF→DWG→reapertura. Nunca tocar un dibujo AutoCAD ajeno sin guardar. Si no hay AutoCAD real, deja N2 **NO EJECUTADO**, pero continúa lo automatizable.

### 6. Cantidades, presupuesto y documentos

Un elemento físico se mide una vez conforme a un método versionado; sus representaciones múltiples son no sumables. Implementa el vínculo obligatorio \`PhysicalElement→Measurement/MethodCard→ConstructionItem→APU→BudgetRevision→TechnicalDocument→DeliveryManifest\`. Reutiliza \`tw.cantidades/1\` y separa detalle de totales; bloquea mediciones sin identidad/procedencia para uso presupuestario.

Precios históricos y parámetros no confirmados se mantienen **pendientes**; desconocido no se convierte en cero. Excel debe contener fórmulas correctas, precios con fuente/fecha, GG/U/impuestos confirmados; PDF, memoria y manifest deben representar la **misma revisión**. Una modificación debe recalcular o invalidar todos los derivados afectados, con A→B→A probado.

### 7. Pruebas de ingeniería y UAT

Antes de reparar un defecto reproducible, escribe un test que **falle en el SHA anterior**; corrige causa raíz; demuestra que pasa sin relajar aserciones. Exige oráculos independientes y pruebas negativas.

El gate principal no es \`npm test\`: es la ejecución **del mismo expediente de principio a fin** con los archivos, revisiones y autorizaciones coherentes. Usa \`03_UAT_INTEGRAL_Y_METRICAS.md\`: túnel 150 m; edificación; revisiones A→B→A; ZIP/RAR con archivos adversariales; autorización rechazada; AutoCAD con dibujo ajeno sin guardar; crash/reinicio; presupuesto y normas obsoletas; usuaria sin conocimientos informáticos.

Por cada gate guarda SHA de código y paquete, test, entorno, logs, hashes, errores, capturas y pendientes. Distingue \`IMPLEMENTADO\`, \`PROBADO AUTOMÁTICAMENTE\`, \`PROBADO WINDOWS/CLAUDE/AUTOCAD REAL\`, \`REVISADO PROFESIONALMENTE\`.

### 8. Autonomía y límites

- Trabaja de forma autónoma en fases y PRs borrador propios, con checkpoints e informes de progreso breves. **No me consultes cada cambio ordinario ni esperes confirmación entre gates técnicamente habilitados.**
- No modifiques ni abandones silenciosamente una rama de otro implementador. No toques \`main\`, PR #29/#30/#33 u otros PR activos sin plan de integración expresamente autorizado.
- Si el usuario no aprobó merge, release, despliegue, instalación en su PC, exposición de datos o una operación destructiva, **no los ejecutes**.
- No prometas trabajo futuro en segundo plano sin proceso real; no declares gates externos aprobados por pruebas simuladas.
- Astra es **revisor independiente**, convocado al entregar un SHA estable/gate cerrado, no durante cada commit. Registra observaciones, corrige defectos y vuelve a presentar evidencia.
- Si falta AutoCAD 2027, especialista humano o licencia de norma, la ingeniería compatible continúa; el gate real queda PENDIENTE EXTERNO y el alcance del producto no se promociona.

### 9. Entregables exigidos

1. Baseline y matriz de trazabilidad auditoría→gate→código→test→evidencia.
2. PRs borrador implementados, con cambios reales, sin merges.
3. Contratos de datos integrados, pruebas negativas, documentación y migración/rollback.
4. Paquete Windows identificable (versión nueva y checksum, sin reutilizar nombre de RC con bytes distintos).
5. Demo E2E de un expediente completo, con originales protegidos, DXF/PDF, cantidades, Excel, memoria y manifest coherentes.
6. Protocolo de UAT real AutoCAD/Claude Desktop, indicando qué no se ejecutó y por qué.
7. Resumen claro de lo que funciona, lo que sigue limitado y qué decisión necesita el PO.
8. Evidencia de revisión independiente y rechazo de defectos críticos.

### 10. Definición absoluta de terminado

No declares «Tannia Workspace profesional» mientras quede un camino a aprobación ficticia, entrega obsoleta, cifra técnica inventada, pérdida de originales, CAD supuestamente fiel sin prueba real o documentos que se contradicen.

**La meta no es más herramientas. Es que una persona de construcción pueda entregar un problema y recibir un trabajo correcto, trazable y útil, con mínimas preguntas y una experiencia sencilla.**

**ORDEN: recupera el estado real, lee toda la macrofase, registra baseline, inicia por G00–G02 y sigue ejecutando los demás gates por dependencias, sin interrumpirte por confirmaciones rutinarias.**
