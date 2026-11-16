// TW-11 hardening H1–H5 (auditoría independiente). Cada prueba demuestra el defecto en el código previo y la corrección.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ROOT, tmpHome, startClient, call, data } from './helpers.js';
import { docx } from './helpers_tw11.js';

const M = (value, unit = 'm') => ({ value, unit });
const P = 'Hardening ñ';
async function env(extra = {}) { const home = tmpHome('Tannia ñ hard '); const cl = await startClient(home, undefined, { TANNIA_CIC: 'on', TANNIA_SIN_DIALOGO: '1', ...extra }); await call(cl.client, 'tannia_proyecto_crear', { nombre: P }); return { home, ...cl }; }
const base = (o = {}) => ({ schema: 'tw.cic.interpretation/1', mode: 'professional', restatement: 'Cubicar un canal', intents: [{ kind: 'compute', text: 'cubicar' }], deliverables: [{ id: 'd1', kind: 'planilla', status: 'confirmed' }, { id: 'd2', kind: 'memoria', status: 'confirmed' }],
  magnitudes: [{ name: 'ancho', value: 3, unit: 'm', origin: 'user' }, { name: 'largo', value: 100, unit: 'm', origin: 'user' }, { name: 'espesor', value: 0.2, unit: 'm', origin: 'user' }],
  proposed_steps: [{ id: 's1', goal: 'Área base', capability_id: 'op.qty.product', inputs: { base: { ref: 'magnitude:ancho' }, factor: { ref: 'magnitude:largo' } } }, { id: 's2', goal: 'Volumen de hormigón', capability_id: 'op.qty.product', inputs: { base: { ref: 'step:s1.cantidad' }, factor: { ref: 'magnitude:espesor' } } }], ...o });
const mags = (d) => Object.fromEntries(d.magnitudes.map((m) => [m.name, `${m.value} ${m.unit}`]));
const caso = (home, N) => { const dir = path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', N); const h = JSON.parse(fs.readFileSync(path.join(dir, 'historial.json'), 'utf8')); return { h, doc: (v) => JSON.parse(fs.readFileSync(path.join(dir, `${v || h.head}.json`), 'utf8')), dir }; };
const enc = (c, N, args) => call(c, 'tannia_cic_encargo', { proyecto: P, caso: N, ...args });

test('H1: actualizar CONSERVA lo no mencionado; reemplazar es explícito; conflictos piden confirmación; retiro solo explícito; A→B→A restaura', async () => {
  const { home, client: c, close } = await env(); const N = 'Canal A';
  try {
    let r = await enc(c, N, { interpretacion: base() }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300)); await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N });
    const vA = caso(home, N).h.head; const docA = caso(home, N).doc();
    // B parcial (solo un dato) cambia 'largo' → conflicto: pide confirmación y NO guarda
    r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1', magnitudes: [{ name: 'largo', value: 120, unit: 'm', origin: 'user' }] } }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300)); let d = data(r);
    assert.equal(d.resultado, 'needs_confirmation'); assert.equal(d.necesita_confirmacion[0].dato, 'largo'); assert.equal(caso(home, N).h.head, vA, 'sin confirmación no se guardó nada'); assert.match(r.content[0].text, /confirm/i);
    // con confirmación explícita: solo cambia lo indicado; ancho, espesor, entregables y pasos se CONSERVAN
    r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1', magnitudes: [{ name: 'largo', value: 120, unit: 'm', origin: 'user' }] }, confirmar_cambios: ['largo'] }); d = data(r); assert.ok(!r.isError); assert.notEqual(d.resultado, 'needs_confirmation');
    let doc = caso(home, N).doc(); assert.deepEqual(mags(doc), { ancho: '3 m', largo: '120 m', espesor: '0.2 m' }); assert.deepEqual(doc.engagement.interpretation.deliverables.map((x) => x.id), ['d1', 'd2']); assert.deepEqual(doc.plan.steps.map((s) => s.id), ['s1', 's2']); assert.equal(doc.engagement.interpretation.restatement, 'Cubicar un canal');
    assert.deepEqual(doc.plan.steps.map((s) => s.status), ['stale', 'stale'], 'lo que dependía del dato cambiado queda desactualizado');
    // cambio de unidades EQUIVALENTE (3 m = 3000 mm) no es conflicto; dimensión distinta sí
    r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1', magnitudes: [{ name: 'ancho', value: 3000, unit: 'mm', origin: 'user' }] } }); assert.notEqual(data(r).resultado, 'needs_confirmation'); assert.deepEqual(mags(caso(home, N).doc()), { ancho: '3000 mm', largo: '120 m', espesor: '0.2 m' });
    r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1', magnitudes: [{ name: 'espesor', value: 0.2, unit: 'm2', origin: 'user' }] } }); assert.equal(data(r).resultado, 'needs_confirmation', 'cambio de dimensión = conflicto');
    // agregar un entregable no borra los anteriores; omitir NUNCA elimina
    r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1', deliverables: [{ id: 'd3', kind: 'informe', status: 'assumed' }] } }); doc = caso(home, N).doc(); assert.deepEqual(doc.engagement.interpretation.deliverables.map((x) => x.id), ['d1', 'd2', 'd3']); assert.equal(Object.keys(mags(doc)).length, 3);
    // eliminación explícita
    r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1' }, retirar: { entregables: ['d2'], magnitudes: ['espesor'] } }); doc = caso(home, N).doc(); assert.deepEqual(doc.engagement.interpretation.deliverables.map((x) => x.id), ['d1', 'd3']); assert.ok(!('espesor' in mags(doc))); assert.ok(data(r).cambios.retirados.length >= 2);
    // retirar algo inexistente: error claro (no silencioso)
    r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1' }, retirar: { magnitudes: ['no_existe'] } }); assert.equal(r.isError, true);
    // A de nuevo (integral): vuelve a los valores originales; las versiones intermedias siguen íntegras
    r = await enc(c, N, { interpretacion: base(), confirmar_cambios: ['largo', 'espesor', 'ancho'] }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300)); doc = caso(home, N).doc(); assert.deepEqual(mags(doc), { ancho: '3 m', largo: '100 m', espesor: '0.2 m' });
    r = await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N }); assert.equal(data(r).fallidos.length, 0); const vol = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N, tipo: 'calculation', estado: 'computed' })).claims.find((x) => x.texto.includes('Volumen de hormigón')); assert.ok(Math.abs(vol.valor - 60) < 1e-9, `3·100·0,2=60 (obtenido ${vol.valor})`);
    assert.deepEqual(mags(JSON.parse(fs.readFileSync(path.join(caso(home, N).dir, `${vA}.json`), 'utf8'))), { ancho: '3 m', largo: '100 m', espesor: '0.2 m' }, 'la versión A original no se tocó');
    // reemplazar: nueva interpretación integral; la anterior queda en el historial
    const antes = caso(home, N).h.versiones.length; r = await enc(c, N, { modo: 'reemplazar', interpretacion: base({ restatement: 'Otro encargo', magnitudes: [{ name: 'ancho', value: 5, unit: 'm', origin: 'user' }], deliverables: [{ id: 'x1', kind: 'plano', status: 'confirmed' }], proposed_steps: [] }) }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300));
    doc = caso(home, N).doc(); assert.deepEqual(mags(doc), { ancho: '5 m' }); assert.deepEqual(doc.engagement.interpretation.deliverables.map((x) => x.id), ['x1']); assert.ok(caso(home, N).h.versiones.length > antes);
    // parcial sobre un caso inexistente: error claro (falta el encargo base)
    r = await enc(c, 'Caso nuevo', { interpretacion: { schema: 'tw.cic.interpretation/1', magnitudes: [{ name: 'a', value: 1, unit: 'm', origin: 'user' }] } }); assert.equal(r.isError, true);
  } finally { await close(); }
});

const APUNTE = 'El radio de la sección circular del ejercicio es de 2 metros.\n\nEl espesor del revestimiento es de 0,4 metros.';
const interpFuente = (src, extra = {}) => ({ schema: 'tw.cic.interpretation/1', mode: 'professional', restatement: 'Área de sección circular con radio del apunte', intents: [{ kind: 'compute', text: 'área' }], antecedents: [{ ref: src, quote: 'El radio de la sección circular del ejercicio es de 2 metros', use: 'radio' }], magnitudes: [{ name: 'radio', value: 2, unit: 'm', origin: 'source', ref: src }], proposed_steps: [{ id: 's1', goal: 'Área de la sección', capability_id: 'op.geo.section.circle', inputs: { radio: { ref: 'magnitude:radio' } } }], ...extra });
async function conFuente(c, home, nombre = 'apunte.txt', extra = {}) { const f = path.join(home, 'Proyectos', P, '01 Antecedentes', nombre); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, APUNTE); return data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'registrar_archivo', ruta: `01 Antecedentes/${nombre}`, clase: 'B', titulo: nombre, ...extra })).id; }

test('H2: fuente registrada → cálculo → fuente retirada / vencida / reemplazada → el informe NO se genera y lo derivado queda pendiente', async () => {
  const { home, client: c, close } = await env(); const N = 'Fuente';
  try {
    const src = await conFuente(c, home); let r = await enc(c, N, { interpretacion: interpFuente(src) }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300)); await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N });
    const cl0 = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N })).claims; const dato = cl0.find((x) => x.tipo === 'data' && x.texto === 'radio'); assert.equal(dato.estado, 'reported_by_source'); assert.equal(dato.fuentes[0].source_id, src); const area = cl0.find((x) => x.tipo === 'calculation'); assert.ok(area.depende_de.includes(dato.id), 'el cálculo depende del dato de la fuente');
    let en = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'] }); assert.ok(!en.isError, JSON.stringify(en.content).slice(0, 300));
    // retirar la fuente: los claims dependientes y los pasos quedan desactualizados; el informe se bloquea
    const rt = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'retirar', id: src, motivo: 'apunte erróneo' })); assert.ok(rt.casos_afectados.includes('Fuente') && rt.claims_invalidados >= 2);
    const cl1 = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N })).claims; assert.equal(cl1.find((x) => x.id === dato.id).estado, 'stale'); assert.equal(cl1.find((x) => x.id === area.id).estado, 'stale'); assert.equal(data(await call(c, 'tannia_cic_plan', { proyecto: P, caso: N })).plan.pasos[0].estado, 'stale');
    en = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N }); assert.equal(en.isError, true); assert.match(data(en).error, /BASE_DESACTUALIZADA|FUENTE_NO_VIGENTE/); assert.match(en.content[0].text, /apunte|fuente|retirad/i);
    assert.equal(data(await call(c, 'tannia_cic_verificar', { proyecto: P, caso: N })).ok, false);
    // vencida (sin retiro): el claim sigue «computed» pero la fuente no está vigente → bloqueo por vigencia
    const N2 = 'Vencida'; const src2 = await conFuente(c, home, 'apunte2.txt', { vigente_hasta: '2020-01-01' }); r = await enc(c, N2, { interpretacion: interpFuente(src2) }); assert.ok(!r.isError); await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N2 });
    en = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N2, tipos: ['memoria_md'] }); assert.equal(en.isError, true); assert.equal(data(en).error, 'FUENTE_NO_VIGENTE'); assert.ok(data(en).detalle.fuentes.some((f) => f.motivo === 'vencida'));
    assert.match(JSON.stringify(data(await call(c, 'tannia_cic_verificar', { proyecto: P, caso: N2 })).fuentes_no_vigentes), /vencida/);
    // reemplazada: pendiente de revisión hasta apuntar el dato a la fuente nueva
    const N3 = 'Reemplazada'; const src3 = await conFuente(c, home, 'apunte3.txt'); r = await enc(c, N3, { interpretacion: interpFuente(src3) }); await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N3 });
    const nuevo = path.join(home, 'Proyectos', P, '01 Antecedentes', 'apunte3_v2.txt'); fs.writeFileSync(nuevo, APUNTE); const src3b = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'registrar_archivo', ruta: '01 Antecedentes/apunte3_v2.txt', clase: 'B', titulo: 'apunte3 v2', reemplaza: src3 })).id;
    en = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N3, tipos: ['memoria_md'] }); assert.equal(en.isError, true); assert.ok(data(en).detalle.fuentes.some((f) => f.motivo === 'reemplazada'));
    r = await enc(c, N3, { interpretacion: { schema: 'tw.cic.interpretation/1', antecedents: [{ ref: src3b, quote: 'El radio de la sección circular del ejercicio es de 2 metros', use: 'radio' }], magnitudes: [{ name: 'radio', value: 2, unit: 'm', origin: 'source', ref: src3b }] }, confirmar_cambios: ['radio'] }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 300));
    await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N3 }); en = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N3, tipos: ['memoria_md'] }); assert.ok(!en.isError, JSON.stringify(en.content).slice(0, 400));
  } finally { await close(); }
});

async function clienteElic(home, resp) { const client = new Client({ name: 't', version: '1' }, { capabilities: { elicitation: {} } }); client.setRequestHandler(ElicitRequestSchema, async () => resp); await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'src', 'main.js')], env: { ...process.env, TANNIA_HOME: home, TANNIA_CIC: 'on', TANNIA_SIN_DIALOGO: '1' }, stderr: 'pipe' })); return client; }
async function casoDesactualizado(c, N, modo = 'professional') { let r = await enc(c, N, { interpretacion: base({ mode: modo }) }); assert.ok(!r.isError); await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N }); r = await enc(c, N, { interpretacion: { schema: 'tw.cic.interpretation/1', magnitudes: [{ name: 'largo', value: 130, unit: 'm', origin: 'user' }] }, confirmar_cambios: ['largo'] }); assert.ok(!r.isError); }
test('H3: «permitir_desactualizado» autodeclarado NO autoriza nada; el borrador desactualizado exige consentimiento humano comprobable y se rotula inequívocamente', async () => {
  const { home, client: c, close } = await env(); const N = 'Obsoleto';
  try {
    await casoDesactualizado(c, N); const dirArt = path.join(caso(home, N).dir, 'artefactos');
    // intento autodeclarado (parámetro ya inexistente + variantes): sigue bloqueado y no escribe nada
    for (const extra of [{ permitir_desactualizado: true }, { borrador_desactualizado: false, permitir_desactualizado: true, humano: true, confirmado_por_usuario: true }]) { const r = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'], ...extra }); assert.equal(r.isError, true); assert.equal(data(r).error, 'BASE_DESACTUALIZADA'); }
    assert.ok(!fs.existsSync(dirArt) || fs.readdirSync(dirArt).length === 0);
    // pedir el borrador SIN consentimiento humano: error con instrucciones; sigue sin escribir
    let r = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'], borrador_desactualizado: true }); assert.equal(r.isError, true); assert.equal(data(r).error, 'CONSENTIMIENTO_HUMANO_REQUERIDO'); assert.match(r.content[0].text, /tannia-config|configuración/); assert.ok(!fs.existsSync(dirArt) || fs.readdirSync(dirArt).length === 0);
    // consentimiento humano: archivo en la carpeta de configuración (fuera de los proyectos); un archivo dentro del proyecto o con otro contenido no sirve
    const idc = data(r).detalle.id_consentimiento; const dentro = path.join(home, 'Proyectos', P, '01 Antecedentes', 'Aprobaciones', `${idc}.txt`); fs.mkdirSync(path.dirname(dentro), { recursive: true }); fs.writeFileSync(dentro, `APRUEBO ${idc}\n`);
    r = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'], borrador_desactualizado: true }); assert.equal(data(r).error, 'CONSENTIMIENTO_HUMANO_REQUERIDO');
    const aprob = data(r).detalle.archivo_aprobacion; assert.ok(!aprob.startsWith(path.join(home, 'Proyectos'))); fs.writeFileSync(aprob, `APRUEBO ${idc}\n`);
    r = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md', 'memoria_pdf'], borrador_desactualizado: true }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 400)); const d = data(r); assert.ok(d.archivos.every((a) => /BORRADOR-DESACTUALIZADO/.test(a.ruta)), 'nombre inequívoco'); assert.match(r.content[0].text, /BORRADOR DESACTUALIZADO/); assert.equal(d.entrega_valida, false);
    const md = fs.readFileSync(path.join(home, 'Proyectos', P, d.archivos[0].ruta), 'utf8'); assert.match(md, /BORRADOR DESACTUALIZADO/); assert.match(md, /NO es una entrega válida|no es una entrega válida/i);
    const art = caso(home, N).doc().artifacts.at(-1); assert.equal(art.kind, 'borrador_desactualizado'); assert.ok(art.consentimiento.por === 'human_out_of_band');
    assert.equal(data(await call(c, 'tannia_cic_verificar', { proyecto: P, caso: N })).ok, false, 'el caso sigue sin verificarse');
  } finally { await close(); }
  for (const [resp, ok] of [[{ action: 'accept', content: { aprobar: true } }, true], [{ action: 'decline' }, false]]) { const home2 = tmpHome('Tannia ñ elic2 '); const c2 = await clienteElic(home2, resp); try { await call(c2, 'tannia_proyecto_crear', { nombre: P }); await casoDesactualizado(c2, 'Obs2', 'academic'); const r = await call(c2, 'tannia_cic_entregable', { proyecto: P, caso: 'Obs2', tipos: ['memoria_md'], borrador_desactualizado: true }); assert.equal(!r.isError, ok, JSON.stringify(r.content).slice(0, 200)); if (ok) assert.equal(data(r).consentimiento, 'human_elicitation'); } finally { await c2.close(); } }
});

test('H4: referencias psg-*: pasaje correcto, inexistente, fuente retirada, cita distinta y fuente sin contenido verificable', async () => {
  const { home, client: c, close } = await env(); const N = 'Pasajes';
  try {
    const src = await conFuente(c, home); const hit = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'buscar', consultas: ['espesor del revestimiento'] })).resultados[0]; assert.ok(hit.passage_id);
    const q = (ref, quote, extra = {}) => enc(c, N, { modo: 'reemplazar', solo_validar: true, interpretacion: base({ antecedents: [{ ref, ...(quote ? { quote } : {}), ...extra }], proposed_steps: [] }) });
    let d = data(await q(hit.passage_id, 'El espesor del revestimiento es de 0,4 metros')); assert.equal(d.antecedentes[0].verificacion, 'verified_exact'); assert.equal(d.problemas.filter((p) => p.tipo === 'unverified_citation').length, 0);
    d = data(await q(hit.passage_id)); assert.equal(d.antecedentes[0].verificacion, 'passage_verified', 'sin cita: se comprueba que el pasaje exista, esté registrado y su fuente vigente');
    d = data(await q(hit.passage_id, 'El espesor del revestimiento es de 9 metros')); assert.equal(d.antecedentes[0].verificacion, 'not_found_in_source'); assert.equal(d.problemas.filter((p) => p.tipo === 'unverified_citation').length, 1);
    d = data(await q('psg-inventado-0001', 'cualquier texto razonable')); assert.equal(d.antecedentes[0].verificacion, 'passage_not_found'); assert.equal(d.problemas.filter((p) => p.tipo === 'unverified_citation').length, 1);
    d = data(await q(hit.passage_id, 'El espesor del revestimiento es de 0,4 metros', { locator: { page: 7 } })); assert.equal(d.antecedentes[0].verificacion, 'locator_mismatch');
    await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'retirar', id: src, motivo: 'x' }); d = data(await q(hit.passage_id, 'El espesor del revestimiento es de 0,4 metros')); assert.equal(d.antecedentes[0].verificacion, 'source_not_approved'); assert.equal(d.problemas.filter((p) => p.tipo === 'unverified_citation').length, 1);
  } finally { await close(); }
  // fuente sin contenido verificable (solo hash): el pasaje existe pero la cita no puede comprobarse
  const { Sandbox } = await import('../src/security/sandbox.js'); const { createProject } = await import('../src/project/projects.js'); const { Conocimiento } = await import('../src/cic/conocimiento/almacen.js'); const { validarInterpretacion } = await import('../src/cic/interpretacion.js'); const { InterpretacionSchema } = await import('../src/cic/schemas.js'); const crypto = await import('node:crypto');
  const home2 = tmpHome('Tannia ñ psg '); const sb = new Sandbox(home2); sb.ensureHome(); createProject(sb, 'PP'); const K = new Conocimiento(sb);
  const pr = K.proponerFuente('PP', { titulo: 'Guía hash', url: 'https://x.invalid', extracto: 'Texto literal de la guía de prueba para hash.', almacenamiento: 'hash_only', licencia: 'licensed' });
  fs.writeFileSync(K.aprob.archivoAprobacion('PP', pr.fuente.id), `APRUEBO ${pr.fuente.id}\n`); assert.equal((await K.decidir('PP', pr.fuente.id)).estado, 'registered');
  const pas = JSON.parse(fs.readFileSync(path.join(home2, 'Proyectos', 'PP', '03 Trabajo', 'Conocimiento', 'pasajes', `${pr.fuente.id}.json`), 'utf8'))[0]; assert.equal(pas.text, null);
  const v = validarInterpretacion(InterpretacionSchema.parse({ schema: 'tw.cic.interpretation/1', mode: 'professional', restatement: 'x', intents: [{ kind: 'plan', text: 'p' }], antecedents: [{ ref: pas.id, quote: 'Texto literal de la guía de prueba para hash.' }] }), { modo: 'professional', herramientas: [], conocimiento: K, proyecto: 'PP' });
  assert.equal(v.antecedentes[0].verificacion, 'content_not_available'); assert.equal(v.issues.filter((i) => i.kind === 'unverified_citation').length, 1); void crypto;
});

test('H5: con TANNIA_CIC=on las instrucciones priorizan el enrutamiento transversal (túnel/canal/departamento no se tratan como vivienda); con CIC apagado se conservan las de TW-10', async () => {
  const { INSTRUCCIONES } = await import('../src/server.js'); const apagado = await startClient(tmpHome(), undefined, { TANNIA_CIC: 'off' }); const encendido = await startClient(tmpHome(), undefined, { TANNIA_CIC: 'on' });
  try {
    assert.equal(apagado.client.getInstructions(), INSTRUCCIONES, 'CIC apagado: exactamente las instrucciones de TW-10'); const t = encendido.client.getInstructions();
    assert.notEqual(t, INSTRUCCIONES); assert.match(t, /PRIORIDAD/); assert.match(t, /tannia_cic_catalogo/); assert.ok(!/5\) Al recibir un encargo nuevo use tannia_encargo_evaluar para saber qué capacidad real corresponde \(anteproyecto de vivienda/.test(t), 'la regla 5 residencial fue reemplazada');
    assert.match(t, /túnel|canal|departamento/i); assert.match(t, /no obliga|no limita|orientativ/i);
    const tools = (await encendido.client.listTools()).tools; assert.match(tools.find((x) => x.name === 'tannia_encargo_evaluar').description, /orientativ/i); const offT = (await apagado.client.listTools()).tools; assert.ok(!/CIC/.test(offT.find((x) => x.name === 'tannia_encargo_evaluar').description));
    // enrutamiento observable (sin modelo): para encargos nuevos y conocidos la salida de la herramienta orienta al CIC y nunca fuerza «vivienda»
    for (const [frase, esperado] of [['túnel carretero para obras civiles II', 'tannia_cic_encargo'], ['canal de riego revestido de 1,2 km', 'tannia_cic_encargo'], ['departamento de 62 m2 en el 5to piso', 'tannia_cic_encargo'], ['casa de 90 m2 con 3 dormitorios', 'opcional'], ['cubicar un DXF con muros y losas', 'opcional']]) { const d = data(await call(encendido.client, 'tannia_encargo_evaluar', { solicitud: frase })); assert.ok(d.cic, frase); if (esperado === 'tannia_cic_encargo' && d.capacidad !== 'no_soportado') assert.ok(['anteproyecto_vivienda', 'modelo_3d_estructurado', 'diseno_arquitectonico_razonado'].includes(d.capacidad) && /tannia_cic/.test(d.cic.mensaje), `${frase}: ${d.capacidad}`); else assert.equal(d.cic.ruta, esperado, frase); assert.ok(d.cic.herramientas_cic.includes('tannia_cic_catalogo')); }
  } finally { await apagado.close(); await encendido.close(); }
});
