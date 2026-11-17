# Astra — Diseño maestro independiente de Tannia Workspace

Mandato: [issue #23](https://github.com/cristobalMundacaV1/tannia-workspace/issues/23). Base auditada: PR #21 `2f4cdd07a4a24ee76e993bedf56e4e0f02630db2`. Rama independiente: `docs/astra-independent-master-design`. Solo documentación; no sustituye contratos vigentes hasta decisión PO, no acepta producto ni autoriza merge/despliegue.

Comenzar por el [memo ejecutivo](ASTRA_EXECUTIVE_DECISION_MEMO.md).

1. [Diagnóstico independiente congelado antes del PR22](ASTRA_01_INDEPENDENT_BASELINE_AND_AUDIT.md).
2. [Investigación primaria de industria, tecnología y normativa](ASTRA_02_INDUSTRY_AND_TECHNOLOGY_RESEARCH.md).
3. [Contraste crítico íntegro con PR22](ASTRA_03_COMPARISON_WITH_PR22.md).
4. [Diseño de producto, arquitectura, contratos y migración](ASTRA_04_PROFESSIONAL_PRODUCT_AND_SYSTEM_DESIGN.md).
5. [Catálogo de Skills, procedimientos Desktop y MethodCards](ASTRA_05_SKILLS_MCP_AND_METHOD_CARDS.md).
6. [Roadmap maestro: 30 historias y gates](ASTRA_06_FINAL_MASTER_ROADMAP_AND_GATES.md).
7. [Riesgos, decisiones PO, evidencia y cobertura del mandato](ASTRA_07_RISK_DECISIONS_AND_EVIDENCE_MATRIX.md).

Secuencia de independencia verificable: `c732f23` guardó auditoría propia; `b78a281` guardó investigación; solo después se consultaron los cuatro documentos de PR22 `3139a04`. No se reescriben esos snapshots para simular independencia.

La suite local pasó con 16 omisiones Windows; existen reproducciones de aprobación model-writable, exportación obsoleta y comparador geométrico insuficiente. Todo el código auditado permanece sin correcciones en esta rama de documentación. Gates AutoCAD/Claude Desktop real y revisión profesional humana **no ejecutados por Astra**.
