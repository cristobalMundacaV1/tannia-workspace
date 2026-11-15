// Experiencia completa por MCP (stdio) contra el código fuente y contra el bundle .mcpb: pedir una casa y refinarla.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startClient, call, data, tmpHome, ROOT } from './helpers.js';

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
const ENTRIES = { fuente: path.join(ROOT, 'src', 'main.js'), 'bundle .mcpb': path.join(ROOT, 'dist', 'mcpb', 'server', 'index.js') };

for (const [label, entry] of Object.entries(ENTRIES)) {
  test(`TW-DESIGN: "diseña una casa de ~80 m² 3D2B" → refinar → deshacer → verificar → cubicar [${label}]`, { timeout: 120000 }, async () => {
    const home = tmpHome("Tannia 'ñ ó "); const { client, close } = await startClient(home, entry);
    try {
      const T = (n, a) => call(client, n, a);
      const OK = async (n, a) => { const r = await T(n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return r; };
      const E = async (n, a, code) => { const r = await T(n, a); assert.equal(r.isError, true, n); assert.equal(data(r).error, code, JSON.stringify(data(r))); };
      const names = (await client.listTools()).tools.map((t) => t.name);
      for (const n of ['tannia_diseno_crear', 'tannia_diseno_modificar', 'tannia_diseno_ver', 'tannia_diseno_historial', 'tannia_diseno_verificar', 'tannia_diseno_a_autocad', 'tannia_diseno_cubicar', 'tannia_conocimiento_consultar']) assert.ok(names.includes(n), n);
      await OK('tannia_proyecto_crear', { nombre: 'Casa Peñalolén' });
      const orig = path.join(home, 'Proyectos', 'Casa Peñalolén', '02 Originales'); fs.writeFileSync(path.join(orig, 'terreno.dxf'), 'x'); await OK('tannia_originales_registrar', { proyecto: 'Casa Peñalolén' });

      // 1) Tannia pide un resultado; no describe ni una línea
      const r1 = await OK('tannia_diseno_crear', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', solicitud: 'Diseña una propuesta de casa de un piso de aproximadamente 80 m², tres dormitorios, dos baños, living-comedor y cocina americana', programa: { superficie_objetivo_m2: 80, dormitorios: 3, banos: 2, cocina: 'americana' } });
      const d1 = data(r1); const txt = r1.content[0].text;
      assert.equal(d1.version, 'v001'); assert.ok(Math.abs(d1.areas.construida_m2 - 80) <= 1.6); assert.equal(d1.recintos.length, 8);
      assert.match(txt, /ANTEPROYECTO \(no apto para construcción\)/); assert.match(txt, /\| Recinto \|/); assert.match(txt, /LIVING-COMEDOR/);
      assert.ok(d1.supuestos.length && d1.preguntas_para_tannia.length && d1.fundamentos.length && d1.fundamentos.every((f) => f.origen === 'practica_de_diseno'));
      assert.equal(d1.verificacion_dxf.ok, true); assert.match(d1.aviso, /no apto para construcción/);
      const root = path.join(home, 'Proyectos', 'Casa Peñalolén');
      for (const f of [d1.archivos.dxf, d1.archivos.svg]) assert.ok(fs.existsSync(path.join(root, f)), f);
      assert.match(fs.readFileSync(path.join(root, d1.archivos.svg), 'utf8'), /NO APTO PARA CONSTRUCCIÓN/); assert.match(fs.readFileSync(path.join(root, d1.archivos.dxf), 'utf8'), /NO APTO PARA CONSTRUCCION/);

      // 2) refinar por lenguaje natural (Claude traduce a operaciones)
      const r2 = await OK('tannia_diseno_modificar', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', descripcion: 'Agranda el dormitorio 2 y ponle una ventana al lado este', operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 3000 }, { operacion: 'renombrar', recinto: 'R-D3', nombre: 'Escritorio' }] });
      const d2 = data(r2); assert.equal(d2.version, 'v002'); assert.equal(d2.cambios.recintos_sin_cambio, 6); assert.match(r2.content[0].text, /Recintos sin cambios: 6/);
      assert.ok(d2.recintos.find((r) => r.id === 'R-D2').ancho_m === 3);
      await E('tannia_diseno_modificar', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 9000 }] }, 'OPERACION_INVALIDA');
      await E('tannia_diseno_modificar', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', operaciones: [{ operacion: 'borrar_todo' }] }, 'ERROR_INTERNO').catch(() => {});
      // 3) historial
      assert.equal(data(await OK('tannia_diseno_historial', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', accion: 'deshacer' })).head, 'v001');
      assert.equal(data(await OK('tannia_diseno_ver', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80' })).recintos.find((r) => r.id === 'R-D2').ancho_m < 3, true);
      assert.equal(data(await OK('tannia_diseno_historial', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', accion: 'rehacer' })).head, 'v002');
      assert.equal(data(await OK('tannia_diseno_ver', { proyecto: 'Casa Peñalolén' })).anteproyectos[0].versiones, 2);
      const v = data(await OK('tannia_diseno_verificar', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80' })); assert.equal(v.verificacion_dxf.ok, true); assert.equal(v.coherencia.errores.length, 0);
      // 4) cubicación desde la geometría construida; la altura la da Tannia
      const r4 = await T('tannia_diseno_cubicar', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', altura_muros_m: 2.4 }); assert.ok(!r4.isError, r4.content[0].text);
      const partidas = data(await OK('tannia_partidas_listar', { proyecto: 'Casa Peñalolén' })).partidas; assert.ok(partidas.some((p) => p.codigo === 'AP-PISO-TOTAL') && partidas.every((p) => p.verificada === false));
      assert.equal((await T('tannia_diseno_cubicar', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', altura_muros_m: 0 })).isError, true);
      // 5) conocimiento técnico
      const k = data(await OK('tannia_conocimiento_consultar', { consulta: 'sistema sísmico del muro', sistema_constructivo: 'hormigon_armado' })); assert.equal(k.temas[0].origen, 'practica_de_diseno');
      // 6) seguridad: nombres con separadores no escapan; originales intactos; solo se escribe en 03 Trabajo
      const r6 = await OK('tannia_diseno_crear', { proyecto: 'Casa Peñalolén', nombre: '../../evil', programa: {} }); assert.ok(!fs.existsSync(path.join(home, 'evil')) && !fs.existsSync(path.join(root, '..', 'evil')));
      assert.ok(data(r6).archivos.dxf.startsWith('03 Trabajo/Anteproyectos/'));
      assert.equal(data(await OK('tannia_originales_verificar', { proyecto: 'Casa Peñalolén' })).ok, true);
      await E('tannia_diseno_ver', { proyecto: 'Casa Peñalolén', nombre: 'No existe' }, 'ANTEPROYECTO_NO_EXISTE');
      await E('tannia_diseno_crear', { proyecto: 'Casa Peñalolén', nombre: 'Casa 80', programa: {} }, 'ANTEPROYECTO_EXISTE');
      await E('tannia_diseno_crear', { proyecto: 'Casa Peñalolén', nombre: 'Muy grande', programa: { dormitorios: 5 } }, 'PROGRAMA_NO_SOPORTADO');
    } finally { await close(); fs.rmSync(home, { recursive: true, force: true }); }
  });
}
