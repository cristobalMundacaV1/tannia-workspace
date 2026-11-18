import { politicaDePrueba } from './helpers_com.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome } from './helpers.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { CadOperations } from '../src/cad/operations.js';
import { AutoCadCom, SCRIPTS, buildScript } from '../src/cad/autocad_com.js';
import { tunnelModel, compose, verifyDimensions } from '../src/drawing/model.js';
import { sceneForSheet, validateScene, buildSheetsPdf, verifyPdf } from '../src/drawing/pdf.js';
import { renderPdf } from '../src/drawing/render.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { DrawingService } from '../src/drawing/service.js';
import { sourceConsent, CONSENT_WPF } from '../src/cic/consent.js';
import { AprobacionHumana } from '../src/cic/aprobacion_humana.js';

function environment() { const home = tmpHome('TW12 ñ '); const sb = new Sandbox(home); createProject(sb, 'Piloto'); return { home, sb, root: sb.projectRoot('Piloto') }; }

test('TW12 journal: repeat, conflict, partial write, corrupt/missing checkpoint never replay', async () => {
  const { root } = environment(); const journal = new CadOperations(root); let writes = 0;
  const op = { id: 'lineas-01', intent: { route: 'own.dwg', version: 1 }, preflight: async () => ({}), apply: async () => { writes++; return { handles: ['ABC'] }; }, verify: async () => true };
  await journal.run(op); assert.equal((await journal.run(op)).reused, true); assert.equal(writes, 1);
  await assert.rejects(journal.run({ ...op, intent: { changed: true } }), { code: 'OPERACION_CONFLICTO' });
  const partial = { ...op, id: 'partial', verify: async () => false };
  await assert.rejects(journal.run(partial), { code: 'CAD_VERIFICACION_FALLIDA' });
  await assert.rejects(journal.run(partial), { code: 'ESCRITURA_INCIERTA' }); assert.equal(writes, 2);
  fs.writeFileSync(journal.file('partial'), '{'); await assert.rejects(journal.run(partial), { code: 'CHECKPOINT_DANADO' });
  fs.unlinkSync(journal.file('partial')); await assert.rejects(journal.run(partial), { code: 'ESCRITURA_INCIERTA' }); assert.equal(writes, 2);
  for (const id of ['../escape', 'CON', 'LPT1', '']) assert.throws(() => journal.status(id), { code: 'OPERACION_ID_INVALIDA' });
});

test('TW12 journal holds the project lock across asynchronous CAD calls', async () => {
  const { root } = environment(); let release; const wait = new Promise(r => { release = r; });
  const a = new CadOperations(root); const b = new CadOperations(root);
  const op = { id: 'a', intent: {}, preflight: async () => ({}), apply: async () => { await wait; return {}; }, verify: async () => true };
  const running = a.run(op); await new Promise(r => setImmediate(r));
  await assert.rejects(b.run({ ...op, id: 'b' }), { code: 'CAD_OPERACION_EN_CURSO' }); release(); await running;
});

test('TW12 strict session rejects wrong route, multiple processes, read-only, busy and closed target', async () => {
  const { sb, root } = environment(); const rel = '03 Trabajo/copia.dwg'; const file = path.join(root, rel); fs.writeFileSync(file, 'AC1032 fake test fixture');
  const baseline = { ruta: file, procesos: [123], ocupado: false, solo_lectura: false, guardado: true };
  for (const [patch, code] of [[{ ruta: path.join(root, 'otro.dwg') }, 'DOCUMENTO_DISTINTO'], [{ procesos: [1, 2] }, 'SESION_AMBIGUA'], [{ ocupado: true }, 'AUTOCAD_OCUPADO'], [{ solo_lectura: true }, 'DOCUMENTO_SOLO_LECTURA'], [{ guardado: false }, 'CAMBIOS_SIN_GUARDAR']]) {
    let calls = 0; const cad = new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, platform: 'win32', runner: async () => { calls++; return JSON.stringify({ ok: true, data: { ...baseline, ...patch } }); } });
    await assert.rejects(cad.lineasRecuperables('Piloto', { archivo: rel, operacion: `test${calls}${code}`, lineas: [{ x1: 0, y1: 0, x2: 1, y2: 1 }] }), { code }); assert.equal(calls, 1);
  }
  const closed = new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, platform: 'win32', runner: async () => JSON.stringify({ ok: false, codigo: 'DOCUMENTO_NO_ABIERTO' }) });
  await assert.rejects(closed.sesion('Piloto', rel), { code: 'DOCUMENTO_NO_ABIERTO' });
  assert.match(SCRIPTS.abrir_copia, /Documents\.Item/); assert.ok(SCRIPTS.abrir_copia.indexOf('Documents.Item') < SCRIPTS.abrir_copia.indexOf('Documents.Open'));
  const script = buildScript('agregar_lineas'); for (const text of ['ReadOnly', 'Get-FileHash', 'IsQuiescent', 'ruta_esperada']) assert.ok(script.includes(text));
});

test('TW12 pilot physical oracle: 5.5m at 1:50 = 110mm; exact areas, 4 sheets, independent bounds', () => {
  const model = tunnelModel(); const c = compose(model); assert.equal(c.sheets.length, 4);
  const v = c.sheets[2].views[0]; assert.equal((v.bounds.max[0] - v.bounds.min[0]) * v.transform.sx, 110);
  assert.ok(Math.abs(model.quantities[0].excavation_area_m2 - (5.5 * 2.5 + Math.PI * 2.75 ** 2 / 2)) < 1e-9);
  assert.equal(model.quantities[0].excavation_volume_m3, model.quantities[0].excavation_area_m2 * 150);
  assert.equal(verifyDimensions(model).ok, true); model.views[2].dimensions[0].value = 6; assert.equal(verifyDimensions(model).ok, false);
  assert.throws(() => compose(tunnelModel(), { orientation: 'portrait' }), { code: 'VISTA_NO_CABE' });
  for (const paper of ['A2', 'A1']) for (const orientation of ['landscape', 'portrait']) assert.equal(compose(tunnelModel(), { paper, orientation }).sheets.length, 4);
});

test('TW12 blocking legibility regressions: tiny section, overlap, corrupt glyph, wrong scale/region and clipped viewport', () => {
  const base = compose(tunnelModel());
  for (const s of base.sheets) assert.deepEqual(validateScene(sceneForSheet(base, s), s).issues, []);
  const s = structuredClone(base.sheets[2]); const normal = sceneForSheet(base, s);
  const collision = [...normal, { ...normal.find(e => e.kind === 'text') }]; assert.equal(validateScene(collision, s).ok, false);
  const glyph = structuredClone(normal); glyph.find(e => e.kind === 'text').value = 'Secci?n'; assert.equal(validateScene(glyph, s).ok, false);
  const geom = [...normal, { kind: 'text', value: 'Texto superpuesto', x: 155, y: 130, size: 2.5, maxWidth: 60 }];
  assert.equal(validateScene(geom, s).ok, false);
  for (const mutate of [v => { v.viewport.scale /= 100; }, v => { v.viewport.center[0] += 1000; }, v => { v.viewport.width = 10; }, v => { v.scale = 50000; }]) {
    const bad = structuredClone(s); mutate(bad.views[0]); assert.equal(validateScene(normal, bad).ok, false);
  }
});

test('TW12 PDF: rendered four physical A3 sheets, text and vector content survive reopening', async () => {
  const c = compose(tunnelModel()); const pdf = await buildSheetsPdf(c); const pages = await renderPdf(pdf);
  assert.equal(pages.length, 4); assert.ok(pages.every(p => p.qa.ok && p.png.length > 10000));
  const qa = await verifyPdf(pdf, c.sheets); assert.equal(qa.ok, true); assert.equal(qa.pages, 4);
  assert.equal((await verifyPdf(await buildSheetsPdf(c, '01'), [c.sheets[2]])).ok, false, 'wrong sheet must fail even though valid PDF');
  const dxf = buildDrawingDxf(c); assert.match(dxf, /\$INSUNITS\n70\n6/); assert.equal((dxf.match(/0\nVIEWPORT\n/g) || []).length, 5); assert.equal((dxf.match(/0\nDIMENSION\n/g) || []).length, 9);
});

test('TW12 service preserves originals, emits immutable PDF/DXF/PNG revisions and detects alteration', async () => {
  const { sb, root } = environment(); const original = path.join(root, '02 Originales', 'origen.dwg'); fs.writeFileSync(original, 'synthetic original');
  const svc = new DrawingService(sb); const first = await svc.generate('Piloto'); assert.equal(first.ready_for_delivery, false);
  assert.equal(first.files.filter(f => /lamina.*\.pdf$/.test(f)).length, 4); assert.equal(first.files.filter(f => /\.png$/.test(f)).length, 4);
  assert.equal((await svc.generate('Piloto')).reused, true); assert.equal(fs.readFileSync(original, 'utf8'), 'synthetic original');
  assert.equal(svc.status('Piloto').integrity.estado, 'integra');
  fs.appendFileSync(path.join(root, first.folder, first.files[0]), 'tampered');
  await assert.rejects(svc.generate('Piloto'), { code: 'ENTREGA_ALTERADA' });
});

test('TW12 trust: invalid pilot cannot reach any approval channel, no generic MessageBox or model secret', async () => {
  const bad = { id: 'source-test', title: 'Guía hash', state: 'candidate', origin: { path_or_url: 'https://x.invalid' }, content: { available: true }, license: { status: 'licensed', quote_limit_chars: 300 } };
  const consent = sourceConsent('Piloto', bad, [{ text: 'Extracto aportado sin evidencia suficiente.' }]);
  assert.equal(consent.canApprove, false); assert.ok(consent.blocked.length >= 2); assert.match(consent.publisher, /no informado/);
  const { sb } = environment(); let attempts = 0; const ah = new AprobacionHumana(sb, { dialogo: async () => { attempts++; return 'si'; } });
  assert.equal((await ah.decidir('Piloto', 'test', { consentimiento: consent, elicitar: async () => { attempts++; return { action: 'accept', content: { aprobar: true } }; } })).bloqueado, true); assert.equal(attempts, 0);
  assert.ok(!CONSENT_WPF.includes('MessageBox')); assert.match(CONSENT_WPF, /IsCancel = \$false/); assert.match(CONSENT_WPF, /Key -eq 'Escape'.*'cerrado'/); assert.match(CONSENT_WPF, /IsEnabled = \$false/); assert.match(CONSENT_WPF, /AutomationProperties/);
});

test('TW12 consent deduplicates simultaneous windows; close/decline never falls back to approve', async () => {
  const { sb } = environment(); let release; const waiting = new Promise(r => { release = r; }); let windows = 0;
  const ah = new AprobacionHumana(sb, { dialogo: async () => { windows++; return waiting; } });
  const first = ah.decidir('Piloto', 'same'); await new Promise(r => setImmediate(r));
  assert.equal((await ah.decidir('Piloto', 'same')).en_curso, true); assert.equal(windows, 1); release('no'); assert.equal((await first).rechazado, true);
});

test('TW12 audit: plan has A-A cut marker at 0+075, profile has height dimension, revision table and short dimension labels clear of geometry', () => {
  const model = tunnelModel({}); const c = compose(model);
  const plan = model.views.find(v => v.id === 'planta'); const cut = plan.entities.find(e => e.layer === 'CORTE');
  assert.equal(cut.a[0], 75); assert.equal(cut.b[0], 75);
  assert.ok(plan.labels.filter(l => l.text === 'A').length === 2);
  const profile = model.views.find(v => v.id === 'perfil'); const h = profile.dimensions.find(d => d.id === 'profile-height');
  assert.ok(Math.abs(h.value - 5.25) < 1e-12);
  for (const sheet of c.sheets) {
    const scene = sceneForSheet(c, sheet); const qa = validateScene(scene, sheet);
    assert.equal(qa.ok, true, JSON.stringify(qa.issues));
    assert.ok(scene.some(e => e.kind === 'text' && e.value.startsWith('REVISIONES')), 'revision table');
    assert.ok(scene.some(e => e.kind === 'text' && /^R01 /.test(e.value)));
  }
  assert.ok(compose(model).sheets[0].legend.some(l => l.id === 'CORTE'));
});

test('TW12 audit: physical 1:50 section — 5.5 m measures 110 mm in the PDF scene and 0.25 m radius arrows stay legible', () => {
  const c = compose(tunnelModel({})); const sheet = c.sheets.find(s => s.id === '03'); const v = sheet.views[0];
  const xs = sceneForSheet(c, sheet).filter(e => e.kind === 'path').flatMap(p => p.points.map(q => q[0]));
  assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) - 110) < 1e-6);
  assert.equal(v.viewport.scale, 20);
});

import { spawnSync } from 'node:child_process';
import os from 'node:os';
const pyOk = spawnSync('python3', ['-I', '-c', 'import ezdxf'], { encoding: 'utf8' }).status === 0;
test('TW12 oracle (ezdxf, independent reader): 4 layouts, no audit errors, viewport paper size / view height == scale', { skip: pyOk ? false : 'requiere python3 + ezdxf' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw12-ez-')); const file = path.join(dir, 'p.dxf');
  fs.writeFileSync(file, buildDrawingDxf(compose(tunnelModel({}))));
  const code = `import sys,json,ezdxf\nfrom ezdxf import recover\nd,a=recover.readfile(sys.argv[1])\nout={'errors':len(a.errors),'layouts':[l.name for l in d.layouts],'vp':{l.name:[[v.dxf.width,v.dxf.height,v.dxf.view_height] for v in l.viewports()] for l in d.layouts if l.name!='Model'}}\nprint(json.dumps(out))`;
  const r = spawnSync('python3', ['-I', '-c', code, file], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout); assert.equal(o.errors, 0); assert.deepEqual(o.layouts, ['Model', 'TW12-01', 'TW12-02', 'TW12-03', 'TW12-04']);
  const scale = { 'TW12-01': 500, 'TW12-03': 50 };
  for (const [name, s] of Object.entries(scale)) for (const [w, h, vh] of o.vp[name]) assert.ok(Math.abs(vh - h * s / 1000) < 1e-6, `${name}: ${vh} vs ${h * s / 1000}`);
  assert.equal(Object.values(o.vp).flat().length, 5);
});

import { expectedLayouts, verifyLayouts, viewportsFromDxf } from '../src/drawing/layouts_check.js';
import { dataImportado } from './helpers_dxf_import.js';
const composed = () => compose(tunnelModel({}));
// Mock of what AutoCAD returns, derived from the expectation (an independent description, then mutated).
const mock = (exp, { overall = true } = {}) => exp.map(l => ({ nombre: l.name, viewports: [...(overall ? [{ centro_papel: [l.size[0] / 2, l.size[1] / 2], ancho: l.size[0], alto: l.size[1], escala: 1, bloqueado: false }] : []), ...l.viewports.map(v => ({ centro_papel: [...v.paperCenter], ancho: v.width, alto: v.height, escala: v.scale, bloqueado: true, centro_vista: [...v.modelCenter] }))] }));
const issuesOf = (layouts, exp) => verifyLayouts(layouts, exp).issues.map(i => i.issue);

test('TW12 layouts: DXF written by the generator satisfies the structural check read by an independent parser', () => {
  const c = composed(); const r = verifyLayouts(viewportsFromDxf(buildDrawingDxf(c)), expectedLayouts(c));
  assert.deepEqual(r.issues, []); assert.equal(r.ok, true); assert.equal(r.level, 'completo'); assert.equal(r.region_verificada, true);
});

test('TW12 layouts: positive mock passes; negatives are rejected with the precise issue', () => {
  const exp = expectedLayouts(composed());
  assert.deepEqual(issuesOf(mock(exp), exp), []); assert.deepEqual(issuesOf(mock(exp, { overall: false }), exp), []);
  const clone = () => JSON.parse(JSON.stringify(mock(exp)));
  let m = clone(); m[3].viewports.pop(); assert.ok(issuesOf(m, exp).includes('viewport_faltante'));                                  // missing
  m = clone(); m[0].viewports.push({ ...m[0].viewports[1] }); assert.ok(issuesOf(m, exp).includes('viewport_sobrante'));             // extra/duplicate
  assert.ok(issuesOf(m, exp).includes('viewport_duplicado'));
  m = clone(); m[3].viewports[2] = { ...m[3].viewports[1] }; { const got = issuesOf(m, exp); assert.ok(got.includes('viewport_duplicado') || got.includes('viewport_desplazado_o_ausente')); }
  m = clone(); m[2].viewports[1].centro_papel[0] += 5; assert.ok(issuesOf(m, exp).includes('viewport_desplazado_o_ausente'));        // displaced
  m = clone(); m[2].viewports[1].escala = 10; assert.ok(issuesOf(m, exp).includes('viewport_escala'));                                // wrong scale
  m = clone(); { const a = m[3].viewports[1]; const b = m[3].viewports[2]; [a.centro_papel, b.centro_papel] = [b.centro_papel, a.centro_papel]; [a.centro_vista, b.centro_vista] = [b.centro_vista, a.centro_vista]; const got = issuesOf(m, exp); assert.ok(got.includes('viewport_dimensiones')); } // viewport tied to the other detail view
  m = clone(); m[2].viewports[1].bloqueado = false; assert.ok(issuesOf(m, exp).includes('viewport_sin_bloqueo'));                      // unlocked
  m = clone(); m[2].viewports[1].ancho += 1; assert.ok(issuesOf(m, exp).includes('viewport_dimensiones'));                           // size
  m = clone(); m[2].viewports[1].centro_vista[0] += 0.5; assert.ok(issuesOf(m, exp).includes('viewport_region_equivocada'));         // wrong region
  m = clone(); m[2].viewports[1].centro_vista[1] += 1000; assert.ok(issuesOf(m, exp).includes('viewport_region_equivocada'));        // other view's region
  m = clone(); m.pop(); assert.ok(issuesOf(m, exp).includes('layout_faltante'));
  m = clone(); m.push({ nombre: 'EXTRA', viewports: [] }); assert.ok(issuesOf(m, exp).includes('layout_inesperado'));
  m = clone(); m.push(JSON.parse(JSON.stringify(m[0]))); assert.ok(issuesOf(m, exp).includes('layout_duplicado'));
  m = clone(); m[0].viewports.push({ ...m[0].viewports[0] }); assert.ok(issuesOf(m, exp).includes('viewport_global_duplicado'));      // two overall viewports
  assert.equal(verifyLayouts(undefined, exp).ok, false); assert.equal(verifyLayouts([], exp).ok, false);
});

test('TW12 layouts: scale-only coincidence (old some() check) no longer passes; missing model region is declared partial, never complete', () => {
  const exp = expectedLayouts(composed()); const m = mock(exp);
  m[3].viewports = m[3].viewports.filter((_, i) => i === 1); m[3].viewports.push({ ...m[3].viewports[0], centro_papel: [1, 1] });
  assert.equal(verifyLayouts(m, exp).ok, false);
  const noRegion = mock(exp); for (const l of noRegion) for (const v of l.viewports) delete v.centro_vista;
  const r = verifyLayouts(noRegion, exp); assert.equal(r.ok, true); assert.equal(r.level, 'parcial_sin_region_modelo'); assert.equal(r.region_verificada, false);
});

test('TW12 guardarLaminas: structural mismatch in the saved DWG fails verification and never claims real-AutoCAD validation', async () => {
  const { sb, root } = environment(); const c = composed(); const exp = expectedLayouts(c);
  const dxfRel = '03 Trabajo/CAD/modelos/x/planos.dxf'; const dwgRel = '03 Trabajo/CAD/modelos/x/planos.dwg';
  fs.mkdirSync(path.join(root, path.dirname(dxfRel)), { recursive: true }); fs.writeFileSync(path.join(root, dxfRel), buildDrawingDxf(c));
  const dwgAbs = path.join(root, dwgRel);
  const make = mutate => new AutoCadCom({ politica: politicaDePrueba(),  sandbox: sb, platform: 'win32', runner: async (script, input) => {
    if (input.dxf && !input.dwg) return JSON.stringify({ ok: true, data: dataImportado(buildDrawingDxf(c)) }); // paso 1: importación aislada (puerta aprobada)
    if (/SaveAs/.test(script)) { fs.writeFileSync(dwgAbs, 'AC1032 synthetic stub, not a real DWG'); return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true } }); }
    const layouts = mock(exp); mutate(layouts); return JSON.stringify({ ok: true, data: { ruta: dwgAbs, guardado: true, unidades: 6, layouts } });
  } });
  const good = await make(() => {}).guardarLaminas('Piloto', { dxf: dxfRel, dwg: dwgRel, operacion: 'ok-1', composition: c });
  assert.equal(good.dwg_validado_autocad_real, false); assert.equal(good.verificacion_layouts.ok, true); assert.equal(good.autocad_real, 'REQUIERE_REGISTRO_DE_EVIDENCIA');
  fs.rmSync(dwgAbs);
  await assert.rejects(make(l => { l[2].viewports[1].centro_papel[0] += 9; }).guardarLaminas('Piloto', { dxf: dxfRel, dwg: dwgRel, operacion: 'bad-1', composition: c }));
  fs.rmSync(dwgAbs, { force: true });
  await assert.rejects(make(l => { l[3].viewports.pop(); }).guardarLaminas('Piloto', { dxf: dxfRel, dwg: dwgRel, operacion: 'bad-2', composition: c }));
});
