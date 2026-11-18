// Reproducción de Astra (docs/astra/evidence/reproduction-procedure.md), parametrizada por raíz de repositorio.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const { startClient, call, data, tmpHome, FIX } = await import(path.join(ROOT, 'test', 'helpers.js'));
const home = tmpHome('astra-audit-'); const c = await startClient(home, path.join(ROOT, 'src', 'main.js'), { TANNIA_SIN_DIALOGO: '1', TANNIA_CIC: 'on', TANNIA_ENGINEERING: 'on' });
const log = []; const T = async (name, args) => { const r = await call(c.client, name, args); log.push({ name, error: r.isError ? data(r)?.error : null }); if (r.isError) throw Object.assign(new Error(name), { r: data(r) }); return data(r); };
let res;
try {
  await T('tannia_proyecto_crear', { nombre: 'Auditoria' });
  fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(home, 'Proyectos', 'Auditoria', '02 Originales', 'plano.dxf'));
  const p = { proyecto: 'Auditoria' };
  await T('tannia_originales_registrar', p); await T('tannia_proyecto_avanzar', { ...p, a_estado: 'analisis' });
  await T('tannia_partida_manual', { ...p, codigo: 'P', descripcion: 'Medicion ficticia auditoria', unidad: 'm2', cantidad: 10, origen: 'fixture auditoria', apu: 'A' });
  await T('tannia_apu_definir', { ...p, codigo: 'A', unidad: 'm2', insumos: [{ tipo: 'material', descripcion: 'Ficticio', unidad: 'm2', cantidad: 1, precio_unitario: 100, fuente_precio: 'fixture', fecha_precio: '2026-11-17' }] });
  await T('tannia_presupuesto_config', { ...p, gastos_generales_pct: 0, utilidades_pct: 0, iva_pct: 19 });
  await T('tannia_partida_verificar', { ...p, codigo: 'P', verificada_por: 'NOMBRE_SUPLANTADO_SIN_PERSONA' });
  await T('tannia_proyecto_avanzar', { ...p, a_estado: 'borrador' });
  const old = await T('tannia_presupuesto_generar', p); await T('tannia_informe_generar', p);
  await T('tannia_apu_definir', { ...p, codigo: 'A', unidad: 'm2', insumos: [{ tipo: 'material', descripcion: 'Ficticio', unidad: 'm2', cantidad: 1, precio_unitario: 900, fuente_precio: 'fixture', fecha_precio: '2026-11-17' }] });
  await T('tannia_proyecto_avanzar', { ...p, a_estado: 'revision' });
  await T('tannia_proyecto_avanzar', { ...p, a_estado: 'aprobado', aprobado_por: 'NOMBRE_SUPLANTADO_SIN_PERSONA', confirmo_revision_profesional: true });
  const ex = await T('tannia_entregable_exportar', p);
  res = { resultado: 'VULNERABLE: aprobado y exportado sin persona; total exportado del presupuesto viejo', total_viejo: old.total, exportado: ex.archivos.map((a) => a.archivo) };
} catch (e) { res = { resultado: `BLOQUEADO en ${e.message}`, error: e.r?.error, mensaje: e.r?.mensaje }; }
finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
console.log(JSON.stringify({ raiz: ROOT, ...res, llamadas: log }, null, 1));
