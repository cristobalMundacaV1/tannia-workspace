// CAD-OPEN-01 (3.ª incidencia): regresiones del contrato oficial de Autodesk — Documents.Open abre DWG; el DXF se importa.
// Fuente: https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-ActiveX-Reference/files/GUID-9ED7A548-7978-4BFD-8462-E2FA747E8880.htm
// Estas pruebas NO acreditan que AutoCAD 2027 real conserve layouts/viewports/XDATA al importar: ver docs/tw12/PROCEDIMIENTO_PRUEBA_DXF_AUTOCAD_2027.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpHome } from './helpers.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { AutoCadCom, SCRIPTS, buildScript } from '../src/cad/autocad_com.js';
import { viaApertura, esperadoDesdeDxf, verificarImportacion } from '../src/cad/dxf_api.js';
import { tunnelModel, compose } from '../src/drawing/model.js';
import { buildDrawingDxf } from '../src/drawing/dxf.js';
import { dataImportado, medidoDesdeDxf } from './helpers_dxf_import.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dxf = buildDrawingDxf(compose(tunnelModel({})));

function archivosFuente(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? archivosFuente(path.join(dir, d.name)) : /\.(js|mjs|ps1)$/.test(d.name) ? [path.join(dir, d.name)] : [])); }

test('escaneo estático del repositorio: Documents.Open solo existe en scripts DWG-only (abrir_copia y cerrar_reabrir), con guardia .dwg', () => {
  const aparece = Object.keys(SCRIPTS).filter((n) => /Documents\.Open\(/.test(buildScript(n))).sort();
  assert.deepEqual(aparece, ['abrir_copia', 'cerrar_reabrir']);
  for (const n of aparece) assert.match(buildScript(n), /\(\?i\)\[\.\]dwg\$/, `${n}: guardia de extensión .dwg antes de Open`);
  // ningún otro código fuente del producto llama a Documents.Open
  const otros = archivosFuente(path.join(ROOT, 'src')).filter((f) => !f.endsWith(path.join('cad', 'autocad_com.js'))).filter((f) => /Documents\.Open\(|\.Open\(\s*\[string\]\$in\.dxf/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(otros.map((f) => path.relative(ROOT, f)), [], 'solo autocad_com.js contiene llamadas Documents.Open');
  // y en autocad_com.js ningún Open recibe un valor de DXF
  assert.ok(!/Documents\.Open\(\s*\[string\]\$(in\.dxf|rutaDxf)/.test(fs.readFileSync(path.join(ROOT, 'src', 'cad', 'autocad_com.js'), 'utf8')));
});

test('la vía por extensión falla cerrado: dwg → Open; dxf → documento aislado; cualquier otra cosa no llega a AutoCAD', () => {
  assert.equal(viaApertura('C:\\x\\a.DWG'), 'open_dwg'); assert.equal(viaApertura('/x/a.dxf'), 'dxf_documento_aislado');
  for (const mala of ['a.sat', 'a.dwg.exe', 'a', 'a.dxf.txt', '']) assert.throws(() => viaApertura(mala), (e) => e.code === 'TIPO_NO_PERMITIDO', mala);
});

test('un .dxf NUNCA se envía a abrir_copia/Documents.Open: abrirCopia(DXF) despacha solo importar_dxf_aislado; un DWG despacha abrir_copia', async () => {
  const home = tmpHome('TW12 api ñ '); const sb = new Sandbox(home); createProject(sb, 'Piloto'); const root = sb.projectRoot('Piloto');
  fs.writeFileSync(path.join(root, '03 Trabajo', 'copia.dxf'), dxf);
  const dwgBytes = Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(2000)]); fs.writeFileSync(path.join(root, '03 Trabajo', 'copia.dwg'), dwgBytes);
  const scripts = [];
  const c = new AutoCadCom({ sandbox: sb, platform: 'win32', runner: async (script, input) => { scripts.push({ open: /Documents\.Open\(/.test(script), add: /Documents\.Add\(/.test(script), importar: /\.Import\(/.test(script), input }); return JSON.stringify({ ok: true, data: input.dxf ? dataImportado(dxf) : { documento: 'copia.dwg', ruta: input.ruta, reutilizado: false } }); } });
  await c.abrirCopia('Piloto', '03 Trabajo/copia.dxf');
  assert.deepEqual(scripts.map((s) => [s.open, s.add, s.importar]), [[false, true, true]], 'DXF: Add + Import, jamás Open');
  scripts.length = 0; await c.abrirCopia('Piloto', '03 Trabajo/copia.dwg');
  assert.deepEqual(scripts.map((s) => [s.open, s.add, s.importar]), [[true, false, false]], 'DWG: Open, sin Add ni Import');
});

test('flujo aislado: Dibujo1 y demás documentos del usuario nunca se activan, guardan, cierran ni modifican en la importación', () => {
  const s = buildScript('importar_dxf_aislado');
  assert.ok(!/\.Close\(|SaveAs|\.Save\(|\.Delete\(|SendCommand|\.Activate\(/.test(s), 'sin acciones sobre otros documentos');
  // el único acceso a ActiveDocument es la lectura de CMDACTIVO (solo lectura, en el preludio de ocupación)
  assert.ok([...s.matchAll(/ActiveDocument\.(\w+)/g)].every((m) => m[1] === 'GetVariable'), 'ActiveDocument solo se lee');
  assert.ok(!/\$acad\.Documents\.Item\(\$i\)\.(Activate|Close|Save)/.test(s));
  // los documentos del usuario solo se ENUMERAN (nombre/ruta/guardado) y la importación se hace en el documento recién creado
  assert.match(s, /\$nuevo = \$acad\.Documents\.Add\(\)/); assert.match(s, /\$nuevo\.Import\(/); assert.ok(!/\$doc\.Import\(|\$d\.Import\(|ActiveDocument\.Import/.test(s));
  assert.ok(s.indexOf('Documents.Add()') < s.indexOf('.Import('));
  // el guardado localiza el documento aislado por nombre sin ruta y único; nunca un documento con archivo en disco
  const g = buildScript('laminas_a_dwg'); assert.match(g, /\$c\.FullName -ceq \[string\]\$c\.Name/); assert.match(g, /\$hallados\.Count -ne 1/);
  assert.ok(g.indexOf('LocalizarAislado $in.nombre_aislado') < g.indexOf('SaveAs('));
});

test('extractor del DXF: layouts, viewports, cotas, XDATA y textos del cajetín se derivan del propio archivo', () => {
  const e = esperadoDesdeDxf(dxf);
  assert.equal(e.layouts.length, 4); assert.equal(e.viewports_total, 5); assert.equal(e.dimensiones, 9); assert.equal(e.por_capa.MODEL_DIMS, 9); assert.equal(e.con_traza, 20);
  assert.deepEqual(Object.keys(e.textos_papel).sort(), ['TW12-01', 'TW12-02', 'TW12-03', 'TW12-04']);
  assert.ok(Object.values(e.textos_papel).every((t) => t.some((x) => /Institución:/.test(x)) && t.some((x) => /Elaborado:/.test(x))), 'cajetín presente en cada layout');
});

test('puerta de verificación: una medición idéntica pasa; cada pérdida por separado se detecta con su causa', () => {
  const e = esperadoDesdeDxf(dxf);
  assert.deepEqual(verificarImportacion(e, medidoDesdeDxf(dxf)).issues, []);
  const casos = {
    'viewports_por_layout': (m) => m.layouts[3].viewports.pop(),
    'layout_faltante': (m) => m.layouts.shift(),
    'cotas': (m) => { m.dimensiones = 8; },
    'xdata_tannia_trace': (m) => { m.con_traza = 0; },
    'textos_papel_faltantes': (m) => m.layouts[1].textos.pop(),
    'entidades_modelo': (m) => { m.entidades_modelo = 0; },
    'capa_conteo': (m) => { m.por_capa.EJE = 1; },
  };
  for (const [causa, mutar] of Object.entries(casos)) { const r = verificarImportacion(e, medidoDesdeDxf(dxf, mutar)); assert.equal(r.ok, false, causa); assert.ok(r.issues.some((i) => i.issue === causa), `${causa}: ${JSON.stringify(r.issues.map((i) => i.issue))}`); }
  assert.equal(verificarImportacion(e, null).ok, false); assert.equal(verificarImportacion(e, undefined).ok, false);
  // un cajetín que cambió de contenido (no solo desapareció) también se detecta
  assert.equal(verificarImportacion(e, medidoDesdeDxf(dxf, (m) => { m.layouts[0].textos = m.layouts[0].textos.map((t) => t.replace('Institución: PENDIENTE', 'Institución: X')); })).ok, false);
});

test('contrato de datos entre scripts y Node: el script mide las claves que la puerta lee', () => {
  const s = buildScript('importar_dxf_aislado');
  for (const k of ['entidades_modelo', 'por_capa', 'dimensiones', 'con_traza', 'layouts', 'ilegibles', 'textos', 'viewports', 'centro_papel', 'centro_vista', 'escala', 'bloqueado']) assert.ok(s.includes(k), `el script no emite «${k}»`);
  assert.match(s, /GetXData\('TANNIA_TRACE'/); assert.match(s, /AcDb\*Dimension\*/);
});
