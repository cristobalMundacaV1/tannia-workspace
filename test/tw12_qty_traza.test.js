// QTY-01 (doble contabilización) y CAD-META-01 (atribuciones inferidas). Sin nombres de capa del túnel en la lógica.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome, startClient, call, data } from './helpers.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { tunnelModel, compose } from '../src/drawing/model.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { buildQuantityModel, sha256Texto } from '../src/drawing/quantity_model.js';
import { parseDxf } from '../src/dxf/reader.js';
import { measureDxf } from '../src/dxf/measure.js';
import { computeQuantity } from '../src/quantities/engine.js';
import { autorizarAtribucion, identidadesDelEquipo, coincideConCuentaDelEquipo } from '../src/drawing/atribucion.js';
import { AprobacionHumana } from '../src/cic/aprobacion_humana.js';

const cubicar = (dxf, { capas, regla = 'directa_longitud', modelo = null, sha = sha256Texto(dxf), unidad = 'm' } = {}) =>
  computeQuantity({ medicion: measureDxf(parseDxf(dxf), { unidad_confirmada: unidad }), archivo: 'x.dxf', sha256: sha, capas, regla, modelo });
const tr = (e, v, r, ref) => `1001\nTANNIA_TRACE\n1000\nelemento=${e}\n1000\nvista=${v}\n1000\nrol=${r}\n1000\nref=${ref}\n`;
const linea = (h, capa, x1, y1, x2, y2, xd = '') => `0\nLINE\n5\n${h}\n8\n${capa}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n${xd}`;
const dxfDe = (...ents) => `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${ents.join('')}0\nENDSEC\n0\nEOF\n`;

test('QTY-01 defecto del piloto: planta.axis y perfil.grade (mismo elemento, 150 m) ya no suman 300 m', () => {
  const m = tunnelModel({}); const dxf = buildDrawingDxf(compose(m)); const modelo = buildQuantityModel(m, dxf);
  const q = cubicar(dxf, { capas: ['EJE'], modelo });
  assert.equal(q.cantidad, 150); assert.equal(q.estado_revision, 'borrador');
  const t = q.fuente.trazabilidad;
  assert.deepEqual(t.fuentes_usadas.map(x => x.ref), ['planta/axis']); assert.deepEqual(t.representaciones_excluidas.map(x => x.ref), ['perfil/grade']);
  assert.ok(t.representaciones_excluidas[0].handle, 'referencia al handle de la entidad original'); assert.equal(t.contraste_modelo.estado, 'verificado'); assert.deepEqual(t.contraste_modelo.discrepancias, []);
  assert.deepEqual(q.descuentos, [], 'sin descuentos manuales');
  // sin modelo autorizado: misma suma, pero no se declara verificada contra el modelo
  const sin = cubicar(dxf, { capas: ['EJE'] }); assert.equal(sin.cantidad, 150); assert.equal(sin.estado_revision, 'needs_review'); assert.equal(sin.fuente.trazabilidad.contraste_modelo.estado, 'sin_modelo');
});

test('QTY-01 la lógica no depende de nombres de capa: renombrar las capas no cambia el resultado', () => {
  const m = tunnelModel({}); const dxf = buildDrawingDxf(compose(m)).replace(/\nEJE\n/g, '\nOTRA_CAPA\n'); const modelo = buildQuantityModel(m, buildDrawingDxf(compose(m)));
  const q = cubicar(dxf, { capas: ['OTRA_CAPA'], modelo, sha: modelo.dxf_sha256 }); assert.equal(q.cantidad, 150);
});

test('QTY-01 dos fuentes del mismo elemento en vistas distintas: ambiguas, no se suman, necesita revisión', () => {
  const dxf = dxfDe(linea('A1', 'X', 0, 0, 150, 0, tr('eje', 'planta', 'fuente', 'planta/axis')), linea('A2', 'X', 0, 1000, 150, 1000, tr('eje', 'perfil', 'fuente', 'perfil/grade')));
  const q = cubicar(dxf, { capas: ['X'] });
  assert.equal(q.cantidad, 0); assert.equal(q.estado_revision, 'needs_review');
  const t = q.fuente.trazabilidad; assert.equal(t.ambiguas_no_sumadas.length, 2); assert.ok(t.ambiguas_no_sumadas.every(a => a.motivo === 'vistas_distintas_del_mismo_elemento' && a.vistas.join() === 'perfil,planta'));
  assert.ok(q.advertencias.some(a => /no se suman/.test(a)));
});

test('QTY-01 elementos físicos realmente independientes de igual longitud SÍ se suman (sin falso positivo)', () => {
  const dxf = dxfDe(linea('B1', 'MURO', 0, 0, 100, 0, tr('muro-a', 'planta', 'fuente', 'planta/a')), linea('B2', 'MURO', 0, 50, 100, 50, tr('muro-b', 'planta', 'fuente', 'planta/b')));
  const modelo = { schema: 'tw.quantity.model/1', dxf_sha256: sha256Texto(dxf), elementos: [{ id: 'muro-a', magnitudes: { longitud_m: 100 } }, { id: 'muro-b', magnitudes: { longitud_m: 100 } }], entidades: [
    { ref: 'planta/a', elemento: 'muro-a', vista: 'planta', rol: 'fuente', magnitudes: { longitud_dxf_m: 100 } }, { ref: 'planta/b', elemento: 'muro-b', vista: 'planta', rol: 'fuente', magnitudes: { longitud_dxf_m: 100 } }] };
  const q = cubicar(dxf, { capas: ['MURO'], modelo }); assert.equal(q.cantidad, 200); assert.equal(q.estado_revision, 'borrador');
  assert.equal(q.fuente.trazabilidad.ambiguas_no_sumadas.length, 0); assert.equal(q.fuente.trazabilidad.fuentes_usadas.length, 2);
  // segmentos del MISMO elemento en la misma vista también suman
  const seg = dxfDe(linea('C1', 'V', 0, 0, 60, 0, tr('viga', 'planta', 'fuente', 'planta/s1')), linea('C2', 'V', 60, 0, 100, 0, tr('viga', 'planta', 'fuente', 'planta/s2')));
  assert.equal(cubicar(seg, { capas: ['V'] }).cantidad, 100);
});

test('QTY-01 sin semántica: DXF heredado se mide como antes; las posibles copias de una misma forma se marcan (no se descuentan) y se citan sus handles', () => {
  const dxf = dxfDe(linea('D1', 'EJE2', 0, 0, 150, 0), linea('D2', 'EJE2', 0, 1000, 150, 1000));
  const q = cubicar(dxf, { capas: ['EJE2'] }); assert.equal(q.cantidad, 300, 'no se adivina ni se resta'); assert.equal(q.estado_revision, 'needs_review');
  const g = q.fuente.trazabilidad.posibles_copias_sin_semantica; assert.equal(g.length, 1); assert.deepEqual(g[0].entidades.map(e => e.handle).sort(), ['D1', 'D2']); assert.ok(q.advertencias.some(a => /sin semántica/.test(a)));
  const distintas = dxfDe(linea('E1', 'L', 0, 0, 10, 0), linea('E2', 'L', 0, 5, 7, 5)); const q2 = cubicar(distintas, { capas: ['L'] }); assert.equal(q2.cantidad, 17); assert.equal(q2.estado_revision, 'borrador');
});

test('QTY-01 contraste con el modelo autorizado: magnitud alterada, entidad no autorizada, traza distinta, modelo ajeno', () => {
  const m = tunnelModel({}); const dxf = buildDrawingDxf(compose(m)); const modelo = buildQuantityModel(m, dxf);
  // 1) la entidad fuente fue editada tras generarse (hash del DXF distinto → modelo no corresponde)
  const marca = dxf.indexOf('elemento=eje\n1000\nvista=planta'); const i11 = dxf.lastIndexOf('\n11\n', marca) + 4; const editado = `${dxf.slice(0, i11)}140${dxf.slice(i11 + dxf.slice(i11).indexOf('\n'))}`;
  const q1 = cubicar(editado, { capas: ['EJE'], modelo, sha: sha256Texto(editado) }); assert.equal(q1.estado_revision, 'needs_review'); assert.equal(q1.fuente.trazabilidad.contraste_modelo.estado, 'no_verificable'); assert.equal(q1.fuente.trazabilidad.contraste_modelo.problema, 'MODELO_NO_CORRESPONDE');
  // 2) el DXF coincide por hash pero la magnitud medida difiere de la autorizada
  const adulterado = { ...modelo, entidades: modelo.entidades.map(e => e.ref === 'planta/axis' ? { ...e, magnitudes: { longitud_dxf_m: 120 } } : e) };
  const q2 = cubicar(dxf, { capas: ['EJE'], modelo: adulterado }); assert.equal(q2.estado_revision, 'needs_review'); assert.equal(q2.fuente.trazabilidad.contraste_modelo.discrepancias[0].tipo, 'magnitud_distinta');
  // 3) entidad con traza que el modelo no declara
  const sinRef = { ...modelo, entidades: modelo.entidades.filter(e => e.ref !== 'planta/axis') };
  const q3 = cubicar(dxf, { capas: ['EJE'], modelo: sinRef }); assert.equal(q3.cantidad, 0); assert.equal(q3.estado_revision, 'needs_review'); assert.equal(q3.fuente.trazabilidad.ambiguas_no_sumadas[0].motivo, 'entidad_no_autorizada_por_el_modelo');
  // 4) la traza del DXF afirma otro rol que el modelo
  const otroRol = { ...modelo, entidades: modelo.entidades.map(e => e.ref === 'planta/axis' ? { ...e, rol: 'representacion' } : e) };
  assert.equal(cubicar(dxf, { capas: ['EJE'], modelo: otroRol }).fuente.trazabilidad.ambiguas_no_sumadas[0].motivo, 'traza_distinta_del_modelo');
  // 5) suma por elemento distinta de la magnitud física del elemento
  const elem = { ...modelo, elementos: modelo.elementos.map(e => e.id === 'eje' ? { ...e, magnitudes: { longitud_m: 100 } } : e) };
  const q5 = cubicar(dxf, { capas: ['EJE'], modelo: elem }); assert.equal(q5.estado_revision, 'needs_review'); assert.ok(q5.fuente.trazabilidad.contraste_modelo.discrepancias.some(d => d.tipo === 'suma_distinta_del_elemento'));
  // 6) sidecar inválido
  assert.equal(cubicar(dxf, { capas: ['EJE'], modelo: { schema: 'otro' } }).fuente.trazabilidad.contraste_modelo.problema, 'MODELO_INVALIDO');
});

test('QTY-01 semántica incompleta o rol desconocido: ambigua, no se suma; las otras magnitudes/capas no se alteran', () => {
  const dxf = dxfDe(linea('F1', 'Q', 0, 0, 10, 0, '1001\nTANNIA_TRACE\n1000\nelemento=e\n'), linea('F2', 'Q', 0, 0, 20, 0, tr('e2', 'v', 'otra', 'v/2')), linea('F3', 'Q', 0, 5, 30, 5));
  const q = cubicar(dxf, { capas: ['Q'] }); assert.equal(q.cantidad, 30); assert.equal(q.fuente.trazabilidad.ambiguas_no_sumadas.length, 2); assert.equal(q.estado_revision, 'needs_review');
});

test('QTY-01 extremo a extremo (MCP): tannia_planos genera el DXF con su modelo autorizado y tannia_cubicar_dxf cubica 150 m', async () => {
  const home = tmpHome('TW12 qty ñ '); const { client: c, close } = await startClient(home, undefined, { TANNIA_ENGINEERING: 'on', TANNIA_SIN_DIALOGO: '1' });
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: 'Tunel' });
    const g = await call(c, 'tannia_planos', { proyecto: 'Tunel', accion: 'generar_tunel', datos: { length: 150, width: 5.5, wall: 2.5, selected: 0.06 } }); assert.ok(!g.isError, JSON.stringify(data(g)));
    assert.equal(data(g).atribucion.estado, 'PENDIENTE');
    const dxfRel = `06 Informes/Planos/${data(g).revision}-planos.dxf`; assert.ok(data(g).files.some(f => f.endsWith('planos.tannia-modelo.json')));
    const r = await call(c, 'tannia_cubicar_dxf', { proyecto: 'Tunel', archivo: dxfRel, unidad_confirmada: 'm', codigo: 'EJE-1', descripcion: 'Eje', capas: ['EJE'], regla: 'directa_longitud' });
    assert.ok(!r.isError, JSON.stringify(data(r))); assert.equal(data(r).cantidad, 150); assert.equal(data(r).estado_revision, 'borrador'); assert.equal(data(r).fuente.trazabilidad.contraste_modelo.estado, 'verificado');
    assert.equal(data(r).fuente.trazabilidad.representaciones_excluidas[0].ref, 'perfil/grade');
  } finally { await close(); }
});

// ---- CAD-META-01 ----
const claveAH = (sb) => new AprobacionHumana(sb, { dialogo: async () => null });
test('CAD-META-01 sin autor/institución: los planos quedan PENDIENTE y no se pide nada; correo o URL en cualquier campo se rechaza', async () => {
  const home = tmpHome('TW12 meta ñ '); const sb = new Sandbox(home); createProject(sb, 'P');
  const r = await autorizarAtribucion({ sandbox: sb, ah: claveAH(sb), project: 'P', datos: { length: 150, author: 'PENDIENTE', institution: '  ' } }); assert.equal(r.atribucion, null); assert.equal(r.datos.author, undefined);
  for (const [campo, valor] of [['author', 'cristobal.mundacav@gmail.com'], ['institution', 'https://empresa.cl'], ['revision', 'R1 por ana@x.cl'], ['date', 'www.x.cl']]) await assert.rejects(autorizarAtribucion({ sandbox: sb, ah: claveAH(sb), project: 'P', datos: { [campo]: valor } }), e => e.code === 'ATRIBUCION_INFERIDA' && e.detalle.campo === campo);
});

test('CAD-META-01 un nombre propuesto por Claude NO se aplica sin autorización humana; con ella se reutiliza sin volver a preguntar', async () => {
  const home = tmpHome('TW12 meta ñ '); const sb = new Sandbox(home); createProject(sb, 'P'); let preguntas = 0; let descripcion = '';
  const ah = new AprobacionHumana(sb, { dialogo: async (msg) => { preguntas++; descripcion = msg; return 'no'; } });
  const datos = { author: 'Ana Pérez', institution: 'Universidad X' };
  await assert.rejects(autorizarAtribucion({ sandbox: sb, ah, project: 'P', datos }), e => e.code === 'ATRIBUCION_REQUIERE_AUTORIZACION' && e.detalle.rechazado === true); assert.equal(preguntas, 1);
  assert.match(descripcion, /lo propuso Claude/); assert.match(descripcion, /Ana Pérez/);
  // elicitación que declina: tampoco
  await assert.rejects(autorizarAtribucion({ sandbox: sb, ah: claveAH(sb), project: 'P', datos, elicitar: async () => ({ action: 'decline' }) }), e => e.code === 'ATRIBUCION_REQUIERE_AUTORIZACION');
  // el modelo no puede autoaprobar con parámetros: no existe ningún parámetro que lo haga
  await assert.rejects(autorizarAtribucion({ sandbox: sb, ah: claveAH(sb), project: 'P', datos: { ...datos, aprobar: true, autorizado: true } }), e => e.code === 'ATRIBUCION_REQUIERE_AUTORIZACION');
  const ok = await autorizarAtribucion({ sandbox: sb, ah: claveAH(sb), project: 'P', datos, elicitar: async () => ({ action: 'accept', content: { aprobar: true } }) });
  assert.equal(ok.atribucion.por, 'human_elicitation'); assert.equal(ok.atribucion.reutilizada, false);
  let nuevas = 0; const otra = await autorizarAtribucion({ sandbox: sb, ah: claveAH(sb), project: 'P', datos, elicitar: async () => { nuevas++; return { action: 'decline' }; } });
  assert.equal(otra.atribucion.reutilizada, true); assert.equal(nuevas, 0, 'misma atribución: no se pide de nuevo');
  await assert.rejects(autorizarAtribucion({ sandbox: sb, ah: claveAH(sb), project: 'P', datos: { author: 'Otra Persona' } }), e => e.code === 'ATRIBUCION_REQUIERE_AUTORIZACION', 'un texto distinto sí requiere nueva autorización');
  const registro = path.join(home, '.tannia-config', 'atribuciones'); assert.ok(fs.existsSync(registro), 'registro fuera de Proyectos');
  assert.ok(!fs.readdirSync(path.join(sb.projectRoot('P'))).some(n => /atribuc/i.test(n)));
});

test('CAD-META-01 si el nombre coincide con la cuenta del equipo se advierte en la solicitud; la lista de identidades solo usa datos locales', async () => {
  const home = tmpHome('TW12 meta ñ '); const sb = new Sandbox(home); createProject(sb, 'P'); let desc = '';
  const ah = new AprobacionHumana(sb, { dialogo: async (m) => { desc = m; return 'no'; } });
  const env = { USERNAME: 'cmundaca', USER: '', LOGNAME: '' };
  const ids = identidadesDelEquipo(env, path.join('C:', 'Users', 'cmundaca', 'Documents')); assert.ok(ids.has('cmundaca')); assert.equal(coincideConCuentaDelEquipo('Cristóbal Mundaca', ids), false); assert.equal(coincideConCuentaDelEquipo('cmundaca', ids), true);
  await assert.rejects(autorizarAtribucion({ sandbox: sb, ah, project: 'P', datos: { author: 'cmundaca' }, env }), e => e.code === 'ATRIBUCION_REQUIERE_AUTORIZACION'); assert.match(desc, /coincide con el nombre de la cuenta/);
});

test('CAD-META-01 extremo a extremo (MCP): author propuesto por Claude → autorización fuera de banda → rótulo; el correo de la cuenta nunca aparece en los artefactos', async () => {
  const home = tmpHome('TW12 meta ñ '); const { client: c, close } = await startClient(home, undefined, { TANNIA_ENGINEERING: 'on', TANNIA_SIN_DIALOGO: '1' });
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: 'T' }); const datos = { length: 150, width: 5.5, wall: 2.5, selected: 0.06, author: 'Ana Pérez' };
    const bad = await call(c, 'tannia_planos', { proyecto: 'T', accion: 'generar_tunel', datos: { ...datos, author: 'cristobal.mundacav@gmail.com' } }); assert.equal(data(bad).error, 'ATRIBUCION_INFERIDA');
    const pend = await call(c, 'tannia_planos', { proyecto: 'T', accion: 'generar_tunel', datos }); assert.equal(data(pend).error, 'ATRIBUCION_REQUIERE_AUTORIZACION');
    const af = data(pend).detalle.archivo_aprobacion; assert.ok(af.startsWith(path.join(home, '.tannia-config')), 'fuera de Proyectos'); assert.ok(!fs.existsSync(path.join(home, 'Proyectos', 'T', '06 Informes', 'Planos', 'historial.json')), 'no se generó nada');
    fs.writeFileSync(af, `APRUEBO ${data(pend).detalle.id_consentimiento}\n`);
    const ok = await call(c, 'tannia_planos', { proyecto: 'T', accion: 'generar_tunel', datos }); assert.ok(!ok.isError, JSON.stringify(data(ok))); assert.equal(data(ok).atribucion.autorizada_por, 'human_out_of_band');
    const dir = path.join(home, 'Proyectos', 'T', '06 Informes', 'Planos'); const comp = fs.readFileSync(path.join(dir, `${data(ok).revision}-modelo.json`), 'utf8'); assert.match(comp, /"author": "Ana Pérez"/);
    for (const f of fs.readdirSync(dir)) if (/\.(json|dxf|csv)$/.test(f)) assert.ok(!/cristobal|gmail|@/i.test(fs.readFileSync(path.join(dir, f), 'utf8')), f);
    const again = await call(c, 'tannia_planos', { proyecto: 'T', accion: 'generar_tunel', datos: { ...datos, length: 120 } }); assert.ok(!again.isError, 'sin nueva autorización'); assert.equal(data(again).atribucion.reutilizada, true);
  } finally { await close(); }
});
