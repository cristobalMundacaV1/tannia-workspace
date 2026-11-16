// Registro de capacidades (docs/tw11/02 §3): envuelve las herramientas MCP existentes y las operaciones de cálculo, con su nivel de evidencia.
// Los niveles NO se elevan automáticamente: N2 (hardware real) y N3 (profesional) solo por evidencia registrada a mano.
import { CapacidadSchema } from './schemas.js';
import { listarOperaciones } from './ops/index.js';

// Prefijo → atributos. real_hardware: 'pending' donde la validación real es un gate externo abierto; 'no' si no aplica.
const GRUPOS = [
  { p: 'tannia_cad_', disc: ['transversal', 'cad'], efecto: 'write_copy', riesgo: 'medium', real: 'pending', lim: ['Adaptador AutoCAD COM validado solo con ejecutor simulado en CI; AutoCAD real = pendiente de hardware'] },
  { p: 'tannia_3d_', disc: ['edificacion', 'cad'], efecto: 'write_project', riesgo: 'medium', real: 'pending', lim: ['Modelo 3D por prismas/cuñas; coherencia 2D↔3D por facetas; DWG real pendiente'] },
  { p: 'tannia_diseno_', disc: ['edificacion', 'vivienda'], efecto: 'write_project', riesgo: 'medium', real: 'pending', lim: ['Anteproyecto de UN piso rectangular (55–130 m²); no apto para construcción'] },
  { p: 'tannia_arq_', disc: ['edificacion', 'vivienda', 'arquitectura'], efecto: 'write_project', riesgo: 'medium', real: 'pending', lim: ['Razonamiento arquitectónico conceptual de vivienda (TW-10); validación de campo G10 pendiente', 'Anteproyecto conceptual: no apto para construcción'] },
  { p: 'tannia_dxf_', disc: ['transversal', 'cubicaciones'], efecto: 'read', riesgo: 'low', real: 'no', lim: ['Lector DXF propio probado con fixtures sintéticos; DXF reales de AutoCAD sin validar'] },
  { p: 'tannia_pdf_', disc: ['transversal', 'cubicaciones'], efecto: 'write_copy', riesgo: 'low', real: 'no', lim: ['Medición vectorial con calibración; PDF escaneados no medibles'] },
  { p: 'tannia_cubicar_', disc: ['cubicaciones'], efecto: 'write_project', riesgo: 'medium', real: 'no', lim: ['Reglas de cantidad sin valores por defecto; resultados requieren revisión'] },
  { p: 'tannia_partida', disc: ['cubicaciones', 'presupuestos'], efecto: 'write_project', riesgo: 'medium', real: 'no', lim: ['Partidas y APU con precios aportados por la usuaria; nunca inventados'] },
  { p: 'tannia_apu_', disc: ['presupuestos'], efecto: 'write_project', riesgo: 'medium', real: 'no', lim: ['Sin precios por defecto'] },
  { p: 'tannia_presupuesto_', disc: ['presupuestos'], efecto: 'write_project', riesgo: 'medium', real: 'no', lim: ['XLSX con fórmulas; precios de la usuaria'] },
  { p: 'tannia_normativa_', disc: ['transversal'], efecto: 'read', riesgo: 'medium', real: 'no', lim: ['Índice orientativo sin valores normativos'] },
  { p: 'tannia_conocimiento_', disc: ['transversal'], efecto: 'read', riesgo: 'medium', real: 'no', lim: ['Registro estático de instrumentos de vivienda; no es el límite del conocimiento'] },
  { p: 'tannia_proyecto_', disc: ['transversal'], efecto: 'write_project', riesgo: 'medium', real: 'no', lim: ['Gestión de proyectos con originales protegidos'] },
  { p: 'tannia_originales_', disc: ['transversal'], efecto: 'write_project', riesgo: 'low', real: 'no', lim: [] },
  { p: 'tannia_', disc: ['transversal'], efecto: 'read', riesgo: 'low', real: 'no', lim: [] },
];
const grupoDe = (n) => GRUPOS.find((g) => n.startsWith(g.p));

export function construirRegistro({ herramientas = [], operaciones = listarOperaciones() } = {}) {
  const caps = [];
  for (const n of herramientas) {
    const g = grupoDe(n);
    caps.push(CapacidadSchema.parse({ schema: 'tw.cic.capability/1', id: `tool.${n}`, kind: 'tool', mcp_tool: n, title: n, disciplines: g.disc, preconditions: [], side_effects: g.efecto, risk_class: g.riesgo, validation: { level: 'N1', evidence: ['pruebas automatizadas con fixtures/simuladores (CI)'], real_hardware: g.real }, maturity: null, limits: g.lim }));
  }
  for (const o of operaciones) {
    caps.push(CapacidadSchema.parse({ schema: 'tw.cic.capability/1', id: `op.${o.id}`, kind: 'operation', mcp_tool: 'tannia_cic_calcular', title: o.title, disciplines: o.disciplines, preconditions: o.inputs.filter((i) => i.required).map((i) => i.name), side_effects: 'none', risk_class: o.requires_review_by.length ? 'high' : 'low', validation: { level: 'N1', evidence: [`oráculos independientes (${o.tolerance.oracle.join('; ')})`], real_hardware: 'no' }, maturity: o.maturity, limits: [...o.applicability.validity, o.applicability.error_bound] }));
  }
  return caps;
}
export const NIVELES = { N0: 'solo documentado', N1: 'implementado y probado con simuladores/fixtures/oráculos', N2: 'validado con herramienta real (AutoCAD/Claude Desktop) por la PO', N3: 'revisado por profesional competente' };
