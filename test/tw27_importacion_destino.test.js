// Auditoría PR #11 — P2: seguridad del DESTINO de la importación (symlinks/junctions, ruta canónica, cambio de directorio durante la
// copia, colisiones de Windows). La importación legítima a 01 Antecedentes y 02 Originales sigue funcionando.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Sandbox, sha256File } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { Project } from '../src/project/store.js';
import { importarArchivos } from '../src/project/gestion.js';
import { tmpHome } from './helpers.js';

const mk = () => { const home = tmpHome("Tannia ñ imp '"); const sb = new Sandbox(home); createProject(sb, 'Obra'); const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'ext ñ ')); const fuera = fs.mkdtempSync(path.join(os.tmpdir(), 'FUERA ')); const pr = new Project(sb, 'Obra'); return { home, sb, ext, fuera, pr, done: () => { for (const d of [home, ext, fuera]) fs.rmSync(d, { recursive: true, force: true }); } }; };
const archivo = (dir, n, c) => { const f = path.join(dir, n); fs.writeFileSync(f, c); return f; };
const enlazar = (destino, enlace) => { try { fs.symlinkSync(destino, enlace, process.platform === 'win32' ? 'junction' : 'dir'); return true; } catch { return false; } };
const vacio = (d) => fs.readdirSync(d).length === 0;

test('carpeta destino reemplazada por enlace (symlink/junction) hacia fuera: se rechaza y NO se escribe nada fuera', () => {
  for (const carpeta of ['01 Antecedentes', '02 Originales']) {
    const e = mk();
    try {
      fs.rmSync(e.pr.p(carpeta), { recursive: true, force: true }); if (!enlazar(e.fuera, e.pr.p(carpeta))) { e.done(); continue; }
      const pdf = archivo(e.ext, 'a.pdf', '%PDF-1.4 x');
      const r = importarArchivos(e.sb, 'Obra', { archivos: [pdf], modo: carpeta.startsWith('02') ? 'original' : 'antecedente' });
      assert.equal(r.resumen.importados, 0, carpeta); assert.equal(r.resultados[0].estado, 'rechazado'); assert.ok(['DESTINO_NO_CANONICO', 'DESTINO_ENLAZADO'].includes(r.resultados[0].codigo), r.resultados[0].codigo);
      assert.ok(vacio(e.fuera), `${carpeta}: nada se escribió fuera del proyecto`);
    } finally { e.done(); }
  }
});

test('.tannia y el propio proyecto como enlace: el manifiesto tampoco se escribe fuera', () => {
  const e = mk();
  try {
    fs.rmSync(e.pr.p('.tannia'), { recursive: true, force: true }); if (!enlazar(e.fuera, e.pr.p('.tannia'))) return;
    const r = (() => { try { return importarArchivos(e.sb, 'Obra', { archivos: [archivo(e.ext, 'a.pdf', '%PDF')] }); } catch (x) { return { error: x.code }; } })();
    assert.ok(r.error || r.resumen.importados === 0, 'rechazado'); assert.ok(vacio(e.fuera) || !fs.existsSync(path.join(e.fuera, 'antecedentes.json')), 'sin manifiesto fuera');
  } finally { e.done(); }
});

test('cambio de directorio DURANTE la copia (TOCTOU): se detecta tras copiar, se elimina lo escrito y no queda nada fuera', () => {
  const e = mk();
  try {
    const pdf = archivo(e.ext, 'b.pdf', '%PDF-1.4 contenido');
    let llamado = false; const hook = (paso) => { if (paso === 'antes_de_copiar') { llamado = true; fs.rmSync(e.pr.p('01 Antecedentes'), { recursive: true, force: true }); enlazar(e.fuera, e.pr.p('01 Antecedentes')); } };
    const r = importarArchivos(e.sb, 'Obra', { archivos: [pdf], hook }); assert.ok(llamado, 'el punto de control previo a la copia existe'); if (!fs.lstatSync(e.pr.p('01 Antecedentes')).isSymbolicLink()) return; // el sistema no permitió enlaces
    assert.equal(r.resumen.importados, 0); assert.equal(r.resultados[0].estado, 'rechazado'); assert.ok(vacio(e.fuera), 'el archivo escrito por la carrera fue eliminado');
    assert.equal(fs.readFileSync(pdf, 'utf8'), '%PDF-1.4 contenido', 'el origen no se toca');
    const man = fs.existsSync(e.pr.p('.tannia', 'antecedentes.json')) ? JSON.parse(fs.readFileSync(e.pr.p('.tannia', 'antecedentes.json'), 'utf8')).importaciones : []; assert.equal(man.length, 0, 'no se registra una importación fallida');
  } finally { e.done(); }
});

test('archivo del destino que es un enlace colgante: no se escribe a través de él y se elige otro nombre', () => {
  const e = mk();
  try {
    const colgante = path.join(e.pr.p('01 Antecedentes'), 'Plano.pdf'); try { fs.symlinkSync(path.join(e.fuera, 'no-existe.pdf'), colgante); } catch { e.done(); return; }
    const r = importarArchivos(e.sb, 'Obra', { archivos: [archivo(e.ext, 'Plano.pdf', '%PDF-1.4 plano')] });
    assert.equal(r.resumen.importados, 1); assert.match(r.resultados[0].destino, /Plano \(2\)\.pdf$/); assert.ok(vacio(e.fuera), 'nada se escribió a través del enlace'); assert.ok(fs.lstatSync(colgante).isSymbolicLink(), 'el enlace existente no se modificó');
  } finally { e.done(); }
});

test('colisiones de Windows: mismo nombre con otra capitalización, nombres reservados, ADS, puntos/espacios finales y rutas demasiado largas', () => {
  const e = mk();
  try {
    archivo(e.pr.p('01 Antecedentes'), 'PLANO.PDF', '%PDF existente');
    const origen = (n, c) => archivo(e.ext, n, c);
    const r = importarArchivos(e.sb, 'Obra', { archivos: [origen('plano.pdf', '%PDF-1.4 otro'), origen('CON.pdf', '%PDF c'), origen('nul.txt', 'n'), origen('Aux.csv', 'a'), origen('Informe.pdf. ', '%PDF i'), origen('base.pdf', '%PDF ads')] });
    const d = r.resultados.map((x) => x.destino ? path.basename(x.destino) : x.estado); assert.equal(r.resumen.rechazados, 0, JSON.stringify(r.resultados));
    assert.match(d[0], /^plano \(2\)\.pdf$/, 'misma palabra con distinta capitalización = colisión (Windows no distingue)'); assert.equal(fs.readFileSync(e.pr.p('01 Antecedentes', 'PLANO.PDF'), 'utf8'), '%PDF existente');
    assert.match(d[1], /^_CON\.pdf$/); assert.match(d[2], /^_nul\.txt$/); assert.match(d[3], /^_Aux\.csv$/); assert.ok(!/[. ]$/.test(d[4]), d[4]);
    // ADS / caracteres inválidos
    const ads = (() => { try { return origen('x:evil.pdf', '%PDF ads2'); } catch { return null; } })(); if (ads) { const r2 = importarArchivos(e.sb, 'Obra', { archivos: [ads] }); assert.ok(!/[:*?"<>|]/.test(path.basename(r2.resultados[0].destino))); }
    // ruta destino demasiado larga para Windows (MAX_PATH)
    const largo = origen(`${'n'.repeat(200)}.pdf`, '%PDF largo'); const r3 = importarArchivos(e.sb, 'Obra', { archivos: [largo] }); const rutaDest = r3.resultados[0].destino ? e.pr.p(...r3.resultados[0].destino.split('/')) : ''; assert.ok(r3.resultados[0].estado === 'rechazado' || rutaDest.length <= 259, 'la ruta final no excede el límite de Windows');
  } finally { e.done(); }
});

test('la importación legítima a 01 Antecedentes y 02 Originales sigue funcionando (hash, manifiesto, registro y protección)', () => {
  const e = mk();
  try {
    const pdf = archivo(e.ext, 'Certificado ñ.pdf', '%PDF-1.7 ok'); const dwg = archivo(e.ext, 'Plano ñ.dwg', 'AC1032 ok ok ok');
    const a = importarArchivos(e.sb, 'Obra', { archivos: [pdf] }); assert.equal(a.resumen.importados, 1); assert.equal(sha256File(e.pr.p(...a.resultados[0].destino.split('/'))), sha256File(pdf));
    const o = importarArchivos(e.sb, 'Obra', { archivos: [dwg], modo: 'original' }); assert.equal(o.resumen.importados, 1); assert.equal(e.pr.verifyOriginals().estado, 'integros');
    assert.deepEqual(fs.readdirSync(e.pr.p('01 Antecedentes')), ['Certificado ñ.pdf']); assert.deepEqual(fs.readdirSync(e.pr.p('02 Originales')), ['Plano ñ.dwg']);
  } finally { e.done(); }
});
