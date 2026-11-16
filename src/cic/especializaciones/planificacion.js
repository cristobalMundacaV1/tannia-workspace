export default {
  schema: 'tw.cic.specialization/1', id: 'transversal.planificacion', version: '0.1.0', parent: null, status: 'active', title: 'Planificación y control de obras (CPM, curva S, valor ganado)',
  concepts: [{ term: 'ruta crítica', synonyms: ['CPM'] }, { term: 'curva S', synonyms: [] }, { term: 'valor ganado', synonyms: ['EVM'] }],
  inputs: [{ name: 'actividades con precedencias', kind: 'datum', required: true }, { name: 'rendimientos y cuadrillas', kind: 'datum', required: true }, { name: 'costos por actividad', kind: 'datum', required: false }],
  deliverables: [{ kind: 'programa_de_obra', editable: true }, { kind: 'curva_s', editable: true }, { kind: 'informe_de_control', editable: true }],
  methods: [{ id: 'mc-cpm', title: 'Programa por ruta crítica desde cantidades', steps: ['Duraciones desde cantidades y rendimientos aportados (sched.duration)', 'Ruta crítica (sched.cpm)', 'Curva S con costos (sched.scurve)', 'Seguimiento con valor ganado (sched.evm)'], operations: ['sched.duration', 'sched.cpm', 'sched.scurve', 'sched.evm'], tools: ['tannia_cic_entregable'] }],
  automation_limits: ['Solo relaciones fin-a-inicio, sin calendarios ni restricciones de recursos', 'Duraciones y rendimientos los aporta la usuaria'], required_validation: [{ what: 'Realismo del programa y de los rendimientos', by: 'profesional de planificación competente' }], competencies: ['programación', 'control'], gaps: [{ need: 'calendarios, recursos y relaciones con desfase', resolution: 'new_tool' }],
};
