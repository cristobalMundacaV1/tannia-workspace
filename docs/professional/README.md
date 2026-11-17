# Consolidación profesional Tannia Workspace — 2026-11-17

**Propuesta para revisión, no aprobación del producto.** Base auditada: `fix/cad-open-dxf-import` @ `2f4cdd07` (PR #21), apilado sobre PR #20 y la cadena anterior. Esta carpeta es una **única entrada de lectura** para la auditoría y arquitectura objetivo; los contratos existentes TW-00–TW-12 siguen vigentes hasta que el Product Owner apruebe reemplazos concretos.

## Orden de lectura
1. [TW_PROFESSIONAL_AUDIT_2026-11-17.md](TW_PROFESSIONAL_AUDIT_2026-11-17.md) — hallazgos P0/P1/P2, estado de evidencias, riesgos y límites de auditoría.
2. [TW_PROFESSIONAL_ARCHITECTURE_V1.md](TW_PROFESSIONAL_ARCHITECTURE_V1.md) — misión, arquitectura canónica, contratos de evidencia/partidas/dibujos, Skills y propuesta de gobierno.
3. [TW_PROFESSIONAL_ROADMAP_GATES_V1.md](TW_PROFESSIONAL_ROADMAP_GATES_V1.md) — paquetes de ingeniería, criterios comprobables, gates reales, pruebas adversariales y no-go.

## Principios vinculantes propuestos
- Claude interpreta y coordina; el código calcula y comprueba; una persona competente revisa y aprueba.
- Originales nunca se modifican; toda afirmación técnica tiene fuente, unidad, método, versión y estado.
- Un test con simulador o CI no acredita el comportamiento de AutoCAD real.
- Un argumento enviado por Claude no constituye aprobación humana.
- El alcance actual es AutoCAD 2D/3D geométrico; BIM/IFC y certificación automática quedan excluidos.
- El diseño debe evolucionar a partir de los motores existentes, no duplicarlos ni reescribirlo todo.
- Un documento normativo licenciado no se incorpora sin autorización y una norma no es automáticamente obligatoria por estar vigente.

## Antes de programar
Ratificar objetivos con PO, asignar revisor independiente y especialista en cubicaciones/arquitectura; acordar validación en AutoCAD+Claude Desktop reales. Prioridad absoluta: aprobación humana general (PRO-G1) y fidelidad DWG (PRO-G2). Crear PRs funcionales separados solo después de la decisión de alcance. No mergear ni publicar sin aprobación.

## Alcance de esta entrega
Documentación solamente: no modificó src/, tests, permisos, ramas de implementación, main ni producción. La auditoría utilizó lectura de código/contratos/CI del repositorio; no ejecutó AutoCAD, Claude Desktop ni las suites en un entorno propio. Cualquier evidencia posterior debe registrar SHA exacto y autor humano.
