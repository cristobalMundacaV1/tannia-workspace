# Astra — Memo de decisión de ingeniería

17-11-2026 · Mandato issue #23 · Propuesta independiente para revisión, no aprobación del producto.

## Qué tenemos

Un candidato amplio en PR apilados, con geometría DXF/PDF, edición/diseño acotado, CAD COM, cubicaciones, presupuestos, CIC, trazabilidad y recuperación. `main` aún no reúne esa implementación. Audité `2f4cdd0` del PR #21 y ejecuté la suite con dependencias reales: **463 pruebas, 447 aprobadas, 16 omitidas por requerir PowerShell Windows, cero fallos**. GitHub también muestra CI Windows/Ubuntu verde. Eso no acredita el flujo profesional en AutoCAD/Claude Desktop reales.

El diagnóstico propio quedó congelado en `c732f23` y la investigación en `b78a281`, ambos anteriores a leer PR #22. La comparación posterior coincide con varios riesgos, corrige su alcance y añade evidencia reproducida.

## Qué corregir primero

1. **P0: aprobación falsa.** Un cliente MCP puede marcar revisión humana y aprobar usando nombre/boolean sin persona. Reproducido con CIC encendido.
2. **P0: entrega obsoleta.** Generar presupuesto a precio100, cambiar a900 y aprobar sin regenerar permite exportar archivos del precio antiguo. La aprobación debe cubrir los artefactos exactos de una única revisión.
3. **P1: fidelidad insuficiente.** Un comparador acepta distinta conectividad/capa como «fiel». Conteos no prueban conservación. Reforzar oráculos y ejecutar CAD-OPEN-02 real antes de elegir otra API.
4. **P1: método/economía/evidencia.** Eliminar porcentajes no confirmados de modo profesional; definir reglas por partida y reconciliar las rutas legacy/CIC sin duplicar motores.

## Arquitectura recomendada

**Núcleo común pequeño de revisiones, procedencia, autorizaciones y entrega; métodos especializados de edificación primero.** Priorizar editar un plano existente, cubicar muros/losas/carpinterías y preparar presupuesto/memoria revisables sobre expediente real. Mantener anteproyecto de vivienda y vertical de túnel con sus límites, sin convertirlos en promesa universal.

Conservar COM para operaciones que superen pruebas; comparar .NET con el mismo corpus si Import no preserva lo requerido. No usar .NET, un MCP oficial, Skills o número de herramientas como sustituto de validación. Autodesk Product Help MCP aporta documentación, no control local de AutoCAD. Investigar Bluebeam/ONDAC cuando encajen en el trabajo real; mantener Excel interoperable. BIM/IFC/SaaS siguen fuera de implementación autorizada.

## Qué desechar

La aprobación por argumentos del modelo; exportar «el último archivo»; declarar fidelidad por conteos; extrapolar el túnel a toda construcción; convertir normas vigentes en obligaciones universales; reducir tools solo por su cantidad; reescribir motores correctos; anunciar aptitud profesional por CI verde. Fallar seguro es necesario, pero no cumple una promesa de producir DWG útil.

## Roadmap definitivo propuesto

- **Confianza:** baseline + canal humano + manifiesto de revisión + protección/recuperación.
- **Utilidad:** edición CAD preservada, métodos de cubicación con oráculo humano, APU explícitos y archivos coherentes.
- **Producto:** fuentes aplicables, procedimientos Desktop/Skills, instalación y rollback sin consola.
- **Validación:** tres expedientes reales anónimos, veinte tareas retenidas y casos adversariales; medir tiempo con revisión, errores, intervenciones y confianza.
- **Liberación acotada:** solo capacidades verificadas, licencias/privacidad/soporte resueltos y decisión PO.

El plan contiene **30 historias**, dependencias, módulos, esfuerzo relativo, gates G0–G9, PoC CAD/consentimiento/tools/XREF/medición, criterios cuantitativos y RACI. No hay fechas ni ahorro prometido sin línea base.

## Decisiones que necesita el PO

Ratificar primera vertical y límites; designar revisores competentes y custodio independiente; habilitar expedientes anónimos y equipo CAD objetivo; decidir privacidad/transferencia a Claude; aprobar política de consentimiento y licencias INN/producto; financiar PoC .NET solo por evidencia; elegir integraciones según software de la oficina. Detalle y alternativas: [D01–D12](ASTRA_07_RISK_DECISIONS_AND_EVIDENCE_MATRIX.md).

**Resultado de esta misión:** diseño y plan investigados, críticos y auditables. **Pendiente para producto:** pruebas reales AutoCAD/Desktop, revisión humana profesional y decisiones de implementación. No se modificó código, no se fusionó ninguna rama ni se desplegó.

Lectura técnica: [auditoría](ASTRA_01_INDEPENDENT_BASELINE_AND_AUDIT.md), [investigación](ASTRA_02_INDUSTRY_AND_TECHNOLOGY_RESEARCH.md), [contraste PR22](ASTRA_03_COMPARISON_WITH_PR22.md), [diseño](ASTRA_04_PROFESSIONAL_PRODUCT_AND_SYSTEM_DESIGN.md), [Skills/métodos](ASTRA_05_SKILLS_MCP_AND_METHOD_CARDS.md), [roadmap](ASTRA_06_FINAL_MASTER_ROADMAP_AND_GATES.md), [evidencia/decisiones](ASTRA_07_RISK_DECISIONS_AND_EVIDENCE_MATRIX.md).
