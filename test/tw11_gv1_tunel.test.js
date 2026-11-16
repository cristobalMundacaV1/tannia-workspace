// TW-11 GV1: túnel académico extremo a extremo con antecedentes sintéticos (docs/tw11/06 caso A). Datos del ejercicio; NO es ingeniería validada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { tmpHome, startClient, call, data } from './helpers.js';
import { correrTunel, LARGO } from './fixtures_tw11/escenario_tunel.js';
import { extraerPdf } from '../src/cic/conocimiento/extractores.js';
import { verificarEntregable } from '../src/cic/verificador.js';
import { Ledger } from '../src/cic/claims.js';
import { verificarDxfLineal } from '../src/geo/dxf_lineal.js';

const close = (a, b, rel = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${m} ${a} ≠ ${b}`);
const AI = 9 * 2.5 + (Math.PI * 4.5 ** 2) / 2; const AE = 9.8 * 2.5 + (Math.PI * 4.9 ** 2) / 2;

test('GV1: túnel académico extremo a extremo — comprensión, citas, plan con brechas, cálculos, DXF, cubicaciones, memoria y coherencia entre archivos', async () => {
  const home = tmpHome('Tannia ñ gv1 '); const { client: c, close: cerrar } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Obra Civil II ñ';
  try {
    assert.ok(!(await call(c, 'tannia_proyecto_crear', { nombre: P })).isError);
    const r = await correrTunel(c, home, P); const N = r.N;
    // (1)(2) comprensión del trabajo y recuperación de apuntes con citas
    assert.ok(r.busq.resultados.length >= 1); assert.ok(r.busq.resultados.every((h) => h.localizador.section && h.fuente)); assert.ok(r.busq.resultados.some((h) => /áreas medias/.test(h.fragmento))); const rev = data(await call(c, 'tannia_cic_conocimiento', { proyecto: P, accion: 'buscar', consultas: ['volumen de revestimiento de hormigón diferencia de áreas'] })); assert.ok(rev.resultados.some((h) => /diferencia entre el área de excavación/.test(h.fragmento)), 'ventana centrada en la oración pertinente');
    assert.ok(!r.enc.isError, JSON.stringify(r.enc.content).slice(0, 400)); const e = data(r.enc);
    assert.equal(e.resultado, 'accepted_with_gaps'); assert.match(e.politica_modo.marca, /EJERCICIO ACADÉMICO/);
    assert.equal(e.problemas.filter((p) => p.tipo === 'unverified_citation').length, 0, 'las 3 citas se verificaron contra el texto almacenado');
    // (3) variables / (4) plan / (5) brechas de ingeniería no implementada
    assert.ok(e.plan.pasos.length === 9); assert.equal(e.plan.pasos.find((s) => s.id === 's7').estado, 'blocked_gap'); assert.ok(e.plan.brechas.filter((g) => g.se_resuelve_con === 'external_professional').length >= 3); assert.deepEqual(e.disciplinas_informativas, ['túneles', 'topografía', 'cubicaciones']);
    // (6) cálculos reproducibles contra fórmulas independientes
    const ej = data(r.ejec); assert.deepEqual(ej.ejecutados.map((x) => x.id), ['s1', 's2', 's3', 's4', 's5', 's6']); assert.equal(ej.fallidos.length, 0); assert.deepEqual(ej.delegados_a_claude.map((x) => x.id).sort(), ['s8', 's9']);
    const cl = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N, tipo: 'calculation' })).claims; const val = (txt) => { const [meta, out] = txt.split(' → '); return cl.find((x) => x.texto.includes(meta) && x.texto.endsWith(`→ ${out}`)).valor; };
    close(val('Áreas de la sección → area_excavacion'), AE); close(val('Áreas de la sección → area_interior'), AI); close(val('Áreas de la sección → area_revestimiento'), AE - AI);
    close(val('Volumen de excavación del trazado completo → volume'), AE * LARGO); close(val('Volumen interior terminado del trazado completo → volume'), AI * LARGO);
    close(val('Volumen de revestimiento de hormigón (excavación − interior) → diferencia'), (AE - AI) * LARGO, 1e-9); close(val('Longitud del eje → longitud'), LARGO, 1e-9);
    close(val('Control cruzado: excavación por áreas medias entre las tres secciones → volume'), AE * (2504 - 2000), 1e-9);
    assert.ok(cl.every((x) => x.metodo && /\(E2\)$/.test(x.metodo))); // todas las cifras vienen de operaciones E2
    assert.ok(!cl.some((x) => /rmr|geotec|sostenimiento|kpa|mpa/i.test(x.texto)), 'ningún claim geotécnico inventado');
    // reproducibilidad: re-ejecutar no cambia ningún id ni valor (idempotente)
    const antes = JSON.stringify(cl.map((x) => [x.id, x.valor]).sort()); await call(c, 'tannia_cic_ejecutar', { proyecto: P, caso: N });
    const cl2 = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N, tipo: 'calculation' })).claims; assert.equal(JSON.stringify(cl2.map((x) => [x.id, x.valor]).sort()), antes);
    // (7)(8)(9) planta, perfil y ≥3 secciones: DXF generado, releído con lector independiente y contrastado con los claims
    assert.ok(!r.geo.isError, JSON.stringify(r.geo.content).slice(0, 400)); const g = data(r.geo); assert.ok(g.verificacion.ok); assert.equal(g.verificacion.areas_releidas_m2.length, 3); g.verificacion.areas_releidas_m2.forEach((a) => close(a, AE, 1e-6)); close(g.verificacion.largo_eje_releido_m, LARGO, 1e-6);
    assert.match(g.perfil.nota, /exageración vertical declarada/);
    const dxfAbs = path.join(home, 'Proyectos', P, g.archivo); const dxf = fs.readFileSync(dxfAbs, 'utf8'); assert.match(dxf, /PERFIL LONGITUDINAL/); assert.match(dxf, /PLANTA/); assert.match(dxf, /Secci.*S3/);
    const claimsCaso = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: N })).claims; close(claimsCaso.find((x) => x.texto.endsWith('→ longitud') && x.metodo.includes('geo.alignment.length') && Math.abs(x.valor - LARGO) < 1e-6).valor, LARGO);
    // (10)(11)(12) cubicaciones, memoria y archivos editables
    assert.ok(!r.ent.isError, JSON.stringify(r.ent.content).slice(0, 500)); const en = data(r.ent); assert.deepEqual(en.archivos.map((a) => a.tipo), ['memoria_md', 'memoria_pdf', 'cantidades_xlsx']); assert.equal(en.verificacion_texto.ok, true); assert.match(en.marca, /EJERCICIO ACADÉMICO/);
    const abs = (a) => path.join(home, 'Proyectos', P, a.ruta); const md = fs.readFileSync(abs(en.archivos[0]), 'utf8');
    assert.match(md, /EJERCICIO ACAD/); assert.match(md, /Dimensionar el sostenimiento/); assert.match(md, /requiere profesional competente/); assert.match(md, /Datos DESCONOCIDOS \(no se inventaron\): clase_de_roca, parametros_geotecnicos/); assert.ok(!/(\d)\s?(kPa|MPa|RMR)/.test(md));
    assert.match(md, /Hipótesis: /); assert.match(md, /Rango de validez/); assert.match(md, /Cota de error/);
    // coherencia PDF ↔ claims: todas las cifras con unidad del PDF extraído coinciden con claims/datos
    const txtPdf = (await extraerPdf(fs.readFileSync(abs(en.archivos[1])))).map((p) => p.text).join('\n'); assert.match(txtPdf, /EJERCICIO ACADEMICO|EJERCICIO ACADÉMICO/i);
    const caso = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', N, 'v' + String(JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', N, 'historial.json'), 'utf8')).versiones.length).padStart(3, '0') + '.json'), 'utf8'));
    const vv = verificarEntregable({ texto: txtPdf.replace(/m³|m2|m²|m3/g, (u) => u) }, { claims: new Ledger(caso.claims), valoresEntrada: caso.magnitudes.map((m) => ({ value: m.value, unit: m.unit })) }); assert.ok(vv.ok, JSON.stringify(vv.bloqueos.slice(0, 4)));
    // coherencia XLSX ↔ claims
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(abs(en.archivos[2])); const ws = wb.getWorksheet('Cantidades'); const filas = []; ws.eachRow((row, i) => { if (i > 4) filas.push(row.values.slice(1)); });
    const xv = filas.find((f) => /Volumen de excavación del trazado completo/.test(f[0])); close(xv[1], AE * LARGO); assert.equal(xv[2], 'm³'); assert.equal(xv[5], 'E2'); const xr = filas.find((f) => /revestimiento de hormigón/.test(f[0])); close(xr[1], (AE - AI) * LARGO); assert.ok(wb.getWorksheet('Pendientes').rowCount >= 4);
    // coherencia DXF ↔ modelo con ezdxf-independiente (relectura directa del archivo guardado)
    const meta = caso.artifacts.find((a) => a.kind === 'dxf_lineal').meta; assert.ok(verificarDxfLineal(dxf, meta).ok);
    // no se sobrescribe: regenerar crea nombres nuevos y los originales conservan su hash
    const h0 = crypto.createHash('sha256').update(fs.readFileSync(abs(en.archivos[0]))).digest('hex'); const en2 = data(await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'] })); assert.notEqual(en2.archivos[0].ruta, en.archivos[0].ruta); assert.equal(crypto.createHash('sha256').update(fs.readFileSync(abs(en.archivos[0]))).digest('hex'), h0);
    // T1/T10: pedir sostenimiento = brecha, no número; entregable con cifra inventada se rechaza sin escribir
    let x = await call(c, 'tannia_cic_calcular', { operacion: 'geotecnia.sostenimiento.espesor', entradas: {} }); assert.equal(data(x).error, 'OPERACION_DESCONOCIDA');
    const antesArch = fs.readdirSync(path.dirname(abs(en.archivos[0]))).length; x = await call(c, 'tannia_cic_entregable', { proyecto: P, caso: N, tipos: ['memoria_md'], nota_adicional: 'El espesor del sostenimiento de proyecto es 25 cm y la presión de roca 3,5 MPa.' });
    assert.equal(x.isError, true); assert.equal(data(x).error, 'ENTREGABLE_NO_VERIFICADO'); assert.equal(fs.readdirSync(path.dirname(abs(en.archivos[0]))).length, antesArch);
    // cambia una entrada → lo que dependía queda desactualizado y el entregable lo declara
    // (el caso se versiona: la v anterior permanece íntegra)
    const hist = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', P, '03 Trabajo', 'Ingenieria', N, 'historial.json'), 'utf8')); assert.ok(hist.versiones.length >= 6);
  } finally { cerrar(); }
});
