// Arquitectura profesional RC: migración segura (E27), MethodCards con oráculos independientes (E12–E14), procedimientos
// accesibles desde Claude Desktop (E24), referencias normativas con fuente/versión/fecha/ámbito/límites (E20) y diagnóstico.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { startClient, call, data, tmpHome } from './helpers.js';
import { mc01, mc02, mc04 } from '../src/metodos/tarjetas.js';
import { consultarNormativa } from '../src/normativa/index.js';

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const H = (c) => ({
  OK: async (n, a) => { const r = await call(c.client, n, a); assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return data(r); },
  E: async (n, a, code) => { const r = await call(c.client, n, a); assert.equal(r.isError, true, `${n} debía fallar`); assert.equal(data(r).error, code, JSON.stringify(data(r)).slice(0, 300)); return data(r); },
});

test('migración: proyecto de versión anterior aprobado → respaldo byte a byte, aprobación sin recibo anulada, entregables heredados intactos, idempotente y reversible', { timeout: 120000 }, async () => {
  const home = tmpHome('rc migración ñ ');
  let c = await startClient(home, undefined, { TANNIA_SIN_DIALOGO: '1' }); let h = H(c);
  try {
    await h.OK('tannia_proyecto_crear', { nombre: 'Antiguo Ñ' });
    const root = path.join(home, 'Proyectos', 'Antiguo Ñ');
    // simular datos escritos por la versión rc.3: sin esquema, aprobado por nombre, partida «verificada», config vacía y un entregable
    fs.rmSync(path.join(root, '.tannia', 'esquema.json'));
    const pj = path.join(root, '.tannia', 'project.json'); const meta = JSON.parse(fs.readFileSync(pj, 'utf8')); meta.estado = 'aprobado'; meta.historial.push({ estado: 'aprobado', fecha: '2026-11-10T00:00:00Z', nota: 'Aprobado por Tannia' }); fs.writeFileSync(pj, JSON.stringify(meta));
    fs.writeFileSync(path.join(root, '04 Cubicaciones', 'partidas.json'), JSON.stringify([{ codigo: 'X', descripcion: 'Heredada', unidad: 'm2', cantidad: 3, regla: 'manual', cantidad_verificada: true, verificada_por: 'Tannia' }]));
    fs.writeFileSync(path.join(root, '07 Entregables', 'Presupuesto 20261110.xlsx'), 'XLSX-ANTIGUO');
    const antes = { pj: sha(pj), ent: sha(path.join(root, '07 Entregables', 'Presupuesto 20261110.xlsx')) };
    const est = await h.OK('tannia_proyecto_estado', { proyecto: 'Antiguo Ñ' });
    assert.equal(est.estado, 'borrador', 'aprobación sin recibo anulada');
    const m = await h.OK('tannia_proyecto_migracion', { proyecto: 'Antiguo Ñ', accion: 'estado' });
    assert.equal(m.version, 2); assert.equal(m.desde, 1); assert.equal(m.estado_previo, 'aprobado');
    assert.equal(m.entregables_heredados[0].estado, 'importado_sin_verificar');
    assert.ok(m.acciones.some((a) => /heredadas SIN recibo/.test(a)) && m.acciones.some((a) => /SIN DEFINIR/.test(a)));
    const resp = m.archivos_respaldados.find((x) => x.archivo === '.tannia/project.json');
    assert.equal(sha(path.join(root, ...resp.respaldo.split('/'))), antes.pj, 'respaldo idéntico al original');
    assert.equal(sha(path.join(root, '07 Entregables', 'Presupuesto 20261110.xlsx')), antes.ent, 'entregable heredado intacto');
    assert.equal((await h.OK('tannia_partidas_listar', { proyecto: 'Antiguo Ñ' })).partidas[0].verificada, false);
    // idempotente: no crea otro respaldo
    await h.OK('tannia_proyecto_estado', { proyecto: 'Antiguo Ñ' });
    assert.equal(fs.readdirSync(path.join(root, '.tannia')).filter((n) => n.startsWith('respaldo-migracion-')).length, 1);
    // reversión: restaura bytes exactos
    const rv = await h.OK('tannia_proyecto_migracion', { proyecto: 'Antiguo Ñ', accion: 'revertir' });
    assert.ok(rv.restaurados.includes('.tannia/project.json')); assert.equal(sha(pj), antes.pj);
    // esquema FUTURO: no se toca
    await c.close(); c = await startClient(home, undefined, { TANNIA_SIN_DIALOGO: '1' }); h = H(c);
    await h.OK('tannia_proyecto_crear', { nombre: 'Futuro' });
    const ej = path.join(home, 'Proyectos', 'Futuro', '.tannia', 'esquema.json'); fs.writeFileSync(ej, JSON.stringify({ version: 3 }));
    const pf = path.join(home, 'Proyectos', 'Futuro', '.tannia', 'project.json'); const sp = sha(pf);
    await h.E('tannia_proyecto_estado', { proyecto: 'Futuro' }, 'ESQUEMA_FUTURO'); assert.equal(sha(pf), sp);
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('MC01 muros/vanos: oráculos analíticos y rechazos topológicos', () => {
  const base = { tramos: [{ longitud_m: 5, origen: 'medido' }], altura: { valor_m: 2.4, origen: 'declarado_usuaria' }, vanos: [{ ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } };
  const r = mc01(base); assert.ok(Math.abs(r.cantidad - 10) < 1e-12); assert.equal(r.unidad, 'm2'); assert.equal(r.estado_revision, 'borrador');
  assert.ok(Math.abs(mc01({ ...base, caras: 2 }).cantidad - 20) < 1e-12);
  assert.ok(Math.abs(mc01({ ...base, politica_descuento: { tipo: 'descontar_mayores_a', umbral_m2: 2.5, origen: 'decision_profesional' } }).cantidad - 12) < 1e-12, 'vano de 2 m² no supera el umbral');
  assert.ok(Math.abs(mc01({ ...base, politica_descuento: { tipo: 'no_descontar', origen: 'decision_profesional' } }).cantidad - 12) < 1e-12);
  assert.throws(() => mc01({ ...base, vanos: [{ ancho_m: 6, alto_m: 2, tramo: 0, origen: 'medido' }] }), (e) => e.code === 'VANO_FUERA_DEL_MURO');
  assert.throws(() => mc01({ ...base, vanos: [{ ancho_m: 1, alto_m: 2, tramo: 0, posicion_m: 0, origen: 'medido' }, { ancho_m: 1, alto_m: 2, tramo: 0, posicion_m: 0.5, origen: 'medido' }] }), (e) => e.code === 'VANOS_SOLAPADOS');
  assert.throws(() => mc01({ ...base, vanos: [{ ancho_m: 1, alto_m: 2, tramo: 0, origen: 'medido' }, { ancho_m: 1, alto_m: 2, tramo: 0, origen: 'medido' }] }), (e) => e.code === 'VANOS_SIN_POSICION');
  assert.throws(() => mc01({ ...base, altura: { valor_m: 2.4 } }), (e) => e.code === 'ORIGEN_INVALIDO');
  assert.throws(() => mc01({ ...base, politica_descuento: undefined }), (e) => e.code === 'FALTA_DATO');
  const sup = mc01({ ...base, altura: { valor_m: 2.4, origen: 'supuesto' } });
  assert.equal(sup.estado_revision, 'needs_review'); assert.ok(sup.supuestos.some((x) => /altura/.test(x)));
});

test('MC02 losas: 20 m² − 2 m² × 0,1 m = 1,8 m³; huecos y zonas inválidos se rechazan', () => {
  const r = mc02({ zonas: [{ area_m2: 20, espesor_m: 0.1, origen: 'medido' }], huecos: [{ area_m2: 2, zona: 0, origen: 'medido' }] });
  assert.ok(Math.abs(r.cantidad - 1.8) < 1e-12); assert.equal(r.unidad, 'm3');
  const cuadrado = (x0, y0, l) => [{ x: x0, y: y0 }, { x: x0 + l, y: y0 }, { x: x0 + l, y: y0 + l }, { x: x0, y: y0 + l }];
  assert.ok(Math.abs(mc02({ zonas: [{ vertices: cuadrado(0, 0, 4), espesor_m: 0.15, origen: 'medido' }], huecos: [{ vertices: cuadrado(1, 1, 1), zona: 0, origen: 'medido' }] }).cantidad - 15 * 0.15) < 1e-12);
  assert.throws(() => mc02({ zonas: [{ area_m2: 2, espesor_m: 0.1, origen: 'medido' }], huecos: [{ area_m2: 3, zona: 0, origen: 'medido' }] }), (e) => e.code === 'HUECO_MAYOR_QUE_ZONA');
  assert.throws(() => mc02({ zonas: [{ vertices: cuadrado(0, 0, 4), espesor_m: 0.1, origen: 'medido' }], huecos: [{ vertices: cuadrado(3.5, 3.5, 1), zona: 0, origen: 'medido' }] }), (e) => e.code === 'HUECO_FUERA_DE_ZONA');
  assert.throws(() => mc02({ zonas: [{ vertices: cuadrado(0, 0, 4), espesor_m: 0.1, origen: 'medido' }, { vertices: cuadrado(2, 2, 4), espesor_m: 0.1, origen: 'medido' }] }), (e) => e.code === 'ZONAS_SOLAPADAS');
  assert.equal(mc02({ zonas: [{ vertices: cuadrado(0, 0, 4), espesor_m: 0.1, origen: 'medido' }, { vertices: cuadrado(4, 0, 4), espesor_m: 0.1, origen: 'medido' }] }).cantidad.toFixed(9), (32 * 0.1).toFixed(9), 'zonas contiguas (borde común) no se consideran solapadas');
});

test('MC04 conteo físico: 3 puertas en planta + 3 en elevación = 3 (no 6); leyenda excluida; sin identidad ⇒ needs_review', () => {
  const inst = [1, 2, 3].flatMap((k) => [{ id: `P${k}`, vista: 'planta', identidad_fisica: `puerta-${k}`, origen: 'medido' }, { id: `E${k}`, vista: 'elevacion', identidad_fisica: `puerta-${k}`, origen: 'declarado_usuaria' }]);
  assert.equal(mc04({ instancias: inst }).cantidad, 3);
  const r = mc04({ instancias: [...inst, { id: 'L1', vista: 'leyenda', origen: 'medido' }, { id: 'S?', vista: 'planta', origen: 'medido' }] });
  assert.equal(r.cantidad, 3); assert.equal(r.estado_revision, 'needs_review'); assert.equal(r.desglose.excluidas.length, 1); assert.deepEqual(r.desglose.sin_identidad, ['S?']);
});

test('MethodCard por MCP: la partida guarda método, entradas con origen y fórmula sustituida; un supuesto la deja en needs_review', { timeout: 60000 }, async () => {
  const home = tmpHome('rc metodo ñ '); const c = await startClient(home, undefined, { TANNIA_SIN_DIALOGO: '1' }); const h = H(c);
  try {
    await h.OK('tannia_proyecto_crear', { nombre: 'M' });
    const lst = await h.OK('tannia_metodo', { accion: 'listar' }); assert.equal(lst.metodos.length, 3); assert.ok(lst.metodos.every((m) => m.normative_claim === 'none'));
    const r = await h.OK('tannia_metodo', { proyecto: 'M', accion: 'calcular', metodo: 'MC01-muro-area-neta', datos: { tramos: [{ longitud_m: 5, origen: 'medido' }], altura: { valor_m: 2.4, origen: 'supuesto' }, vanos: [{ ancho_m: 1, alto_m: 2, tramo: 0, origen: 'declarado_usuaria' }], politica_descuento: { tipo: 'descontar_todos', origen: 'decision_profesional' } }, guardar_como: { codigo: 'M1', descripcion: 'Muro eje A' } });
    assert.ok(Math.abs(r.cantidad - 10) < 1e-12);
    const p = (await h.OK('tannia_partidas_listar', { proyecto: 'M' })).partidas[0];
    assert.equal(p.regla, 'metodo:MC01-muro-area-neta@0.1'); assert.equal(p.estado_revision, 'needs_review'); assert.equal(p.verificada, false);
    await h.E('tannia_metodo', { accion: 'calcular', metodo: 'MC02-losa-volumen', datos: { zonas: [{ area_m2: 2, espesor_m: 0.1, origen: 'medido' }], huecos: [{ area_m2: 3, zona: 0, origen: 'medido' }] } }, 'HUECO_MAYOR_QUE_ZONA');
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('procedimientos Desktop (prompts MCP), referencias normativas y diagnóstico de canales humanos', { timeout: 60000 }, async () => {
  const home = tmpHome('rc prompts ñ '); const c = await startClient(home, undefined, { TANNIA_SIN_DIALOGO: '1' }); const h = H(c);
  try {
    const ps = (await c.client.listPrompts()).prompts; assert.equal(ps.length, 6); // +tw-desarrollar-proyecto (auditoría integral 2026-11-17, §6.8) assert.ok(ps.every((p) => p.title && p.description));
    const tools = new Set((await c.client.listTools()).tools.map((t) => t.name));
    for (const p of ps) {
      const g = await c.client.getPrompt({ name: p.name, arguments: { proyecto: 'Casa Ñuñoa' } });
      const txt = g.messages[0].content.text; assert.match(txt, /Casa Ñuñoa/); assert.match(txt, /NO puede verificar cantidades ni aprobar/);
      for (const t of txt.match(/tannia_[a-z0-9_]+/g) || []) if (!t.endsWith('_')) assert.ok(tools.has(t), `${p.name} menciona ${t}, que no existe`);
    }
    const d = await h.OK('tannia_diagnostico', {});
    assert.equal(d.autorizacion_humana.ventana_del_cliente, false); assert.equal(d.autorizacion_humana.puede_aprobar, false);
    const n = consultarNormativa('cubicación de muros según NCh353');
    const ref = n.resultados[0].referencias.find((r) => r.id === 'NCh353');
    for (const k of ['fuente', 'version_observada', 'ambito', 'limites', 'licencia', 'verificacion']) assert.ok(ref[k], `falta ${k}`);
    assert.equal(ref.cumplimiento, 'NO EVALUADO'); assert.match(ref.limites, /NO adquirido/);
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
});
