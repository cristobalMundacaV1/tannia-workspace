// G09 / Definition of Done (TW-PRO-E2E): el MISMO expediente produce planos, cubicaciones, Excel, memoria y manifiesto coherentes,
// por el protocolo MCP real; A→B→A invalida y reproduce. La «persona» es el guion (rotulada PERSONA SIMULADA en el recibo): N1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpHome } from './helpers.js';
import { ejecutarDemo, reporteMarkdown, PERSONA } from '../scripts/demo-e2e.mjs';

test('UAT-E2E-A + C (N1): expediente ZIP → encargo → planos → cubicaciones → presupuesto → memoria → aprobación → entrega, con una sola revisión y A→B→A', { timeout: 600000 }, async () => {
  const R = await ejecutarDemo({ home: tmpHome() });
  const c = R.coherencia;
  assert.equal(c.misma_revision_de_planos, true, JSON.stringify(c));
  assert.equal(c.totales_coinciden, true, `oráculo ${c.total_oraculo} / xlsx ${c.total_xlsx} / manifiesto ${c.total_manifiesto} / respuesta ${c.total_respuesta}`);
  assert.equal(c.huellas_de_entrega_correctas, true); assert.equal(c.zip_original_intacto, true); assert.equal(c.copia_protegida_del_zip_identica, true); assert.equal(c.originales_integros, true);
  assert.equal(c.aprobacion_declarada_por, PERSONA, 'la demo nunca se hace pasar por una persona real');
  const hist = R.pasos.find((p) => p.paso === 'presupuesto con precios 2010'); assert.equal(hist.estado_final_posible, false); assert.match(hist.etiqueta, /PRECIOS HISTÓRICOS/);
  assert.equal(R.pasos.find((p) => p.paso === 'recepción').alertas, 1, 'el correo con instrucciones queda marcado');
  assert.ok(R.preguntas.some((p) => /hastial/.test(p)) && !R.preguntas.some((p) => /Cuál es el largo del túnel|Cuál es el ancho/.test(p)), 'solo se pregunta lo que no está en los antecedentes');
  const a = R.abba; assert.equal(a.vuelve_a_A, true); assert.equal(a.cubicaciones_B, 'DESACTUALIZADO'); assert.equal(a.cantidades_A_reproducidas, true); assert.equal(a.exportar_sin_nueva_aprobacion, 'NO_APROBADO');
  const md = reporteMarkdown(R); assert.match(md, /N1 \(automatizada\)/); assert.doesNotMatch(md, /```json/);
});
