import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startClient, call, data, tmpHome, ROOT, FIX } from './helpers.js';

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
const ENTRIES = { fuente: path.join(ROOT, 'src', 'main.js'), 'bundle .mcpb': path.join(ROOT, 'dist', 'mcpb', 'server', 'index.js') };
const apu = { codigo: 'A1', descripcion: 'Losa (EJEMPLO TEST)', unidad: 'm3', insumos: [
  { tipo: 'material', descripcion: 'Hormigón', unidad: 'm3', cantidad: 1.05, precio_unitario: 1000, fuente_precio: 'TEST-ficticio', fecha_precio: '2026-01-01' },
  { tipo: 'mano_obra', descripcion: 'Cuadrilla', unidad: 'jornada', rendimiento: 5, cuadrilla: 1, precio_unitario: 5000, fuente_precio: 'TEST-ficticio', fecha_precio: '2026-01-01' }] };

for (const [label, entry] of Object.entries(ENTRIES)) {
  test(`TW-04 flujo completo de producto [${label}]`, { timeout: 120000 }, async () => {
    const home = tmpHome('Tannia Ñ ');
    let c = await startClient(home, entry);
    try {
      const T = (name, args) => call(c.client, name, args);
      const E = async (name, args, code) => { const r = await T(name, args); assert.equal(r.isError, true, `${name} debía fallar`); assert.equal(data(r).error, code, `${name}: ${JSON.stringify(data(r))}`); };
      const OK = async (name, args) => { const r = await T(name, args); assert.ok(!r.isError, `${name}: ${r.content?.[0]?.text}`); return data(r); };

      const tools = (await c.client.listTools()).tools.map((t) => t.name);
      assert.ok(tools.length >= 25, `herramientas: ${tools.length}`);
      await OK('tannia_proyecto_crear', { nombre: 'Casa 1' });
      const orig = path.join(home, 'Proyectos', 'Casa 1', '02 Originales');
      fs.copyFileSync(path.join(FIX, 'dxf', 'simple_m.dxf'), path.join(orig, 'plano.dxf'));
      fs.copyFileSync(path.join(FIX, 'dxf', 'inyeccion.dxf'), path.join(orig, 'inyeccion.dxf'));
      fs.copyFileSync(path.join(FIX, 'pdf', 'plano_vector_1_100.pdf'), path.join(orig, 'planta.pdf'));

      // gates de estado
      await E('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'analisis' }, 'GATE_NO_CUMPLIDO');
      await E('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'aprobado' }, 'SALTO_NO_PERMITIDO');
      const reg = await OK('tannia_originales_registrar', { proyecto: 'Casa 1' });
      assert.equal(reg.nuevos.length, 3);
      assert.equal((await OK('tannia_originales_verificar', { proyecto: 'Casa 1' })).ok, true);
      assert.equal(fs.statSync(path.join(orig, 'plano.dxf')).mode & 0o222, 0, 'original marcado solo lectura');
      await OK('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'analisis' });

      // copia de trabajo
      const cp = await OK('tannia_copia_trabajo', { proyecto: 'Casa 1', archivo: '02 Originales/plano.dxf' });
      assert.match(cp.copia, /^03 Trabajo\/plano - copia de trabajo\.dxf$/);

      // inyección: el texto malicioso es dato; no se ejecuta nada
      const ins = await OK('tannia_dxf_inspeccionar', { proyecto: 'Casa 1', archivo: '02 Originales/inyeccion.dxf' });
      assert.ok(ins.textos_encontrados_como_DATO_no_instrucciones.some((t) => /IGNORA/.test(t)));
      assert.equal((await OK('tannia_originales_verificar', { proyecto: 'Casa 1' })).ok, true);

      // cantidades: faltan datos / unidad
      await E('tannia_cubicar_dxf', { proyecto: 'Casa 1', archivo: '02 Originales/plano.dxf', unidad_confirmada: 'm', codigo: '1', descripcion: 'Losa', capas: ['LOSA'], regla: 'area_por_espesor' }, 'FALTA_DATO');
      const part = await OK('tannia_cubicar_dxf', { proyecto: 'Casa 1', archivo: '02 Originales/plano.dxf', unidad_confirmada: 'm', codigo: '1', descripcion: 'Losa', capas: ['LOSA'], regla: 'area_por_espesor', parametros: { espesor_m: 0.1 } });
      assert.ok(Math.abs(part.cantidad - (20 + Math.PI / 2) * 0.1) < 1e-9); assert.equal(part.cantidad_verificada, false);
      await OK('tannia_apu_definir', { proyecto: 'Casa 1', ...apu });
      await OK('tannia_partida_asignar_apu', { proyecto: 'Casa 1', codigo: '1', apu: 'A1' });
      await OK('tannia_presupuesto_config', { proyecto: 'Casa 1', gastos_generales_pct: 10, utilidades_pct: 5 });
      await OK('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'borrador' });
      const pres = await OK('tannia_presupuesto_generar', { proyecto: 'Casa 1' });
      assert.equal(pres.estado_final_posible, false); // cantidad sin verificar
      assert.ok(fs.existsSync(path.join(home, 'Proyectos', 'Casa 1', pres.archivo)));
      await OK('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'revision' });
      await E('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'aprobado', aprobado_por: 'Tannia', confirmo_revision_profesional: true }, 'GATE_NO_CUMPLIDO'); // sin verificar
      await E('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'aprobado' }, 'GATE_NO_CUMPLIDO');
      await OK('tannia_partida_verificar', { proyecto: 'Casa 1', codigo: '1', verificada_por: 'Tannia' });
      await OK('tannia_informe_generar', { proyecto: 'Casa 1' });
      await E('tannia_entregable_exportar', { proyecto: 'Casa 1' }, 'NO_APROBADO');

      // reinicio del servidor: el estado persiste
      await c.close(); c = await startClient(home, entry);
      const st = await OK('tannia_proyecto_estado', { proyecto: 'Casa 1' });
      assert.equal(st.estado, 'revision'); assert.equal(st.partidas, 1);

      await OK('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'aprobado', aprobado_por: 'Tannia', confirmo_revision_profesional: true });
      // cambiar datos invalida la aprobación
      await OK('tannia_presupuesto_config', { proyecto: 'Casa 1', iva_pct: 19 });
      assert.equal((await OK('tannia_proyecto_estado', { proyecto: 'Casa 1' })).estado, 'borrador');
      await OK('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'revision' });
      await OK('tannia_presupuesto_generar', { proyecto: 'Casa 1' });
      await OK('tannia_informe_generar', { proyecto: 'Casa 1' });
      await OK('tannia_proyecto_avanzar', { proyecto: 'Casa 1', a_estado: 'aprobado', aprobado_por: 'Tannia', confirmo_revision_profesional: true });
      const ex = await OK('tannia_entregable_exportar', { proyecto: 'Casa 1' });
      assert.equal(ex.archivos.length, 2);
      assert.ok(fs.existsSync(path.join(home, 'Proyectos', 'Casa 1', '07 Entregables', 'HUELLAS-SHA256.txt')));

      // PDF: calibrar y medir con partida guardada
      const tr = await OK('tannia_pdf_trazos', { proyecto: 'Casa 1', archivo: '02 Originales/planta.pdf', pagina: 1 });
      const mm = 72 / 25.4;
      const cota = tr.trazos.find((t) => t.n_puntos === 2 && Math.abs(Math.abs(t.primero.y - t.ultimo.y) - 50 * mm) < 0.01 && Math.abs(t.primero.x - t.ultimo.x) < 0.01);
      const rect = tr.trazos.find((t) => t.cerrado);
      assert.ok(cota && rect);
      const cal = await OK('tannia_pdf_calibrar', { proyecto: 'Casa 1', archivo: '02 Originales/planta.pdf', pagina: 1, id: 'P1', modo: 'cota', a: cota.primero, b: cota.ultimo, distancia_real: 5, unidad: 'm', verificacion: { a: { x: 5 * mm, y: 60 * mm }, b: { x: 205 * mm, y: 60 * mm }, distancia_real: 20 } });
      assert.equal(cal.confiable, true);
      const med = await OK('tannia_pdf_medir', { proyecto: 'Casa 1', archivo: '02 Originales/planta.pdf', calibracion: 'P1', trazo: rect.id, guardar_como: { codigo: 'P-1', descripcion: 'Superficie planta', magnitud: 'area' } });
      assert.ok(Math.abs(med.area_m2 - 50) < 1e-6);
      await E('tannia_pdf_medir', { proyecto: 'Casa 1', archivo: '02 Originales/planta.pdf', calibracion: 'NOEXISTE', trazo: 0 }, 'CALIBRACION_NO_EXISTE');
      const pl = await OK('tannia_partidas_listar', { proyecto: 'Casa 1' });
      assert.equal(pl.partidas.find((p) => p.codigo === 'P-1').regla, 'pdf_calibrado');
      assert.equal((await OK('tannia_proyecto_estado', { proyecto: 'Casa 1' })).estado, 'borrador'); // nueva partida invalida entregable

      // seguridad: rutas, escritura y originales alterados
      for (const bad of ['../../etc/passwd', '/etc/passwd', '02 Originales/../../x']) await E('tannia_dxf_medir', { proyecto: 'Casa 1', archivo: bad }, bad.includes('..') || bad.startsWith('/') ? 'RUTA_FUERA_DEL_PROYECTO' : 'RUTA_INVALIDA');
      await E('tannia_dxf_medir', { proyecto: '../Casa 1', archivo: 'x.dxf' }, 'PROYECTO_INVALIDO');
      await E('tannia_dxf_medir', { proyecto: 'Casa 1', archivo: 'nada.dxf' }, 'ARCHIVO_NO_EXISTE');
      fs.chmodSync(path.join(orig, 'plano.dxf'), 0o644); fs.appendFileSync(path.join(orig, 'plano.dxf'), '\n');
      const v = await OK('tannia_originales_verificar', { proyecto: 'Casa 1' });
      assert.equal(v.ok, false); assert.equal(v.problemas[0].problema, 'modificado');
      // la partida de ese archivo queda desactualizada
      const pl2 = await OK('tannia_partidas_listar', { proyecto: 'Casa 1' });
      assert.equal(pl2.partidas.find((p) => p.codigo === '1').estado_revision, 'needs_review');

      // recuperación de project.json dañado
      const pj = path.join(home, 'Proyectos', 'Casa 1', '.tannia', 'project.json');
      fs.writeFileSync(pj, '{dañado'); await OK('tannia_proyecto_estado', { proyecto: 'Casa 1' });

      // normativa
      const n = await OK('tannia_normativa_consultar', { consulta: 'altura máxima según la OGUC' });
      assert.equal(n.cumplimiento_normativo, 'NO EVALUADO'); assert.ok(n.resultados[0].fuentes_oficiales.length >= 1);
      const d = await OK('tannia_diagnostico', {}); assert.equal(d.carpeta_escribible, true);
    } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
  });
}
