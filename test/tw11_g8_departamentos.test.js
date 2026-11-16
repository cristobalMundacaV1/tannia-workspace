// TW-11 G8 / Caso B: un departamento NO es una casa renombrada. Exige artefactos geométricos verificables (doc 06) y contraste tipológico.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome, startClient, call, data } from './helpers.js';
import { generarUnidad } from '../src/cic/edificacion/unidad.js';
import { generarDxfUnidad, verificarDxfUnidad } from '../src/cic/edificacion/dxf_unidad.js';
import { construirPrimitivas } from '../src/arq3d/geometria.js';

const DEP = { tipologia: 'departamento', nombre: 'Depto 5to piso', superficie_m2: 62, dormitorios: 2, banos: 1, nivel: { indice: 5 }, terraza: { presente: true } };
const clon = (o) => JSON.parse(JSON.stringify(o));

test('B1–B7: el departamento tiene entrepiso compartido, medianeros, acceso por circulación común, terraza con borde abierto y NINGÚN elemento de lote; desconocidos declarados', () => {
  const u = generarUnidad(DEP); const h = u.huella_tipologica;
  assert.equal(h.nivel_indice, 5); assert.ok(h.cota_piso_mm > 0, '(1) cota de piso ≠ 0: unidad en nivel superior');
  assert.equal(h.losa_inferior, 'entrepiso_compartido_con_unidad_inferior'); assert.equal(h.losa_superior, 'entrepiso_compartido_con_unidad_superior'); assert.deepEqual(u.losas.map((l) => l.condicion), ['entrepiso_compartido_con_unidad_inferior', 'entrepiso_compartido_con_unidad_superior']); assert.equal(u.cubiertas.length, 0, 'sin cubierta propia');
  assert.ok(h.tramos_por_clase.medianero >= 1 && h.tramos_por_clase.fachada >= 1 && h.tramos_por_clase.nucleo === 1, '(2) perímetro clasificado'); assert.equal(h.ventanas_en_muros_no_fachada, 0, 'sin ventanas ni orientación solar en medianeros/núcleo');
  for (const w of u.muros.filter((x) => x.clase === 'medianero' || x.clase === 'nucleo')) assert.ok(!w.vanos.some((v) => v.tipo === 'ventana'));
  assert.equal(h.acceso.desde, 'circulacion_comun'); const wN = u.muros.find((w) => w.clase === 'nucleo'); assert.ok(wN.vanos.some((v) => v.rol === 'acceso_desde_circulacion_comun'), '(3) acceso por el muro del núcleo');
  assert.ok(u.balcon && u.balcon.borde_abierto && u.balcon.baranda.length === 2, '(5) terraza con borde abierto y baranda'); assert.deepEqual(h.elementos_de_lote, []); assert.deepEqual(h.elementos_de_vivienda_unifamiliar, []);
  assert.ok(u.desconocidos.some((d) => /Orientación real/.test(d)) && u.desconocidos.some((d) => /Normativa/.test(d)) && u.desconocidos.some((d) => /ductos/.test(d)) && u.desconocidos.some((d) => /estructural/.test(d)), '(7) desconocidos');
  assert.ok(u.supuestos.some((s) => /editable/.test(s)));
  // modelo 3D válido y consistente con el programa
  const prim = construirPrimitivas(u.modelo3d); assert.ok(prim.resumen.n_primitivas > 15); assert.ok(prim.resumen.envolvente_mm.min[2] >= 13000, 'el sólido está a la cota del nivel 5'); assert.ok(prim.resumen.volumen_losas_m3 > 0);
  // áreas de recintos suman la huella (partición exacta, sin superposición)
  const suma = u.propiedades_recintos.reduce((a, r) => a + r.area_m2, 0); assert.ok(Math.abs(suma - (u.dimensiones_mm.ancho * u.dimensiones_mm.fondo) / 1e6) < 1e-9);
});

test('B6 contraste: el MISMO programa interpretado como casa produce un modelo tipológicamente DIFERENTE (≥6 diferencias estructurales); una casa renombrada falla', () => {
  const dep = generarUnidad(DEP); const casa = generarUnidad({ ...DEP, tipologia: 'casa', nombre: 'Casa' }); const a = dep.huella_tipologica; const b = casa.huella_tipologica;
  const dif = []; for (const k of ['losa_inferior', 'losa_superior', 'acceso', 'tramos_por_clase', 'lados_borde', 'cota_piso_mm', 'nivel_indice']) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) dif.push(k); assert.ok(dif.length >= 6, `diferencias: ${dif}`);
  assert.equal(b.losa_inferior, 'sobre_terreno'); assert.equal(b.losa_superior, 'cubierta_expuesta'); assert.equal(b.acceso.desde, 'exterior'); assert.equal(b.tramos_por_clase.fachada, 4); assert.equal(b.cota_piso_mm, 0); assert.ok(casa.cubiertas.length === 1 && dep.cubiertas.length === 0);
  assert.ok(casa.desconocidos.some((d) => /Terreno/.test(d)), 'la casa declara el terreno como desconocido');
  // «casa renombrada»: tomar el modelo de la casa y etiquetarlo departamento debe FALLAR los chequeos automáticos (1)–(4)
  const falso = clon(casa); falso.programa.tipologia = 'departamento'; falso.huella_tipologica.tipologia = 'departamento';
  const fallos = []; const hf = falso.huella_tipologica; if (hf.cota_piso_mm === 0) fallos.push('cota 0'); if (hf.losa_inferior === 'sobre_terreno') fallos.push('losa sobre terreno'); if (!falso.muros.some((w) => w.clase === 'nucleo')) fallos.push('sin núcleo'); if (falso.cubiertas.length) fallos.push('cubierta propia'); if (hf.acceso.desde === 'exterior') fallos.push('acceso exterior');
  assert.ok(fallos.length >= 4, `una casa renombrada falla: ${fallos}`);
  const dxfFalso = generarDxfUnidad(falso); assert.equal(verificarDxfUnidad(dxfFalso, falso).problemas.some((p) => p.codigo === 'ACCESO_SIN_NUCLEO'), true);
});

test('DXF del departamento: releído con lector independiente (áreas, largos por clase, ventanas solo en fachada, sin elementos de lote); manipulaciones se detectan', () => {
  const u = generarUnidad(DEP); const dxf = generarDxfUnidad(u); const v = verificarDxfUnidad(dxf, u); assert.ok(v.ok, JSON.stringify(v.problemas)); assert.equal(v.medidos.ventanas_fuera_de_fachada, 0); assert.ok(v.medidos.puertas_de_acceso_en_nucleo >= 1);
  assert.equal(verificarDxfUnidad(dxf.replace(/\n8\nMURO_NUCLEO\n/g, '\n8\nMURO_INT\n'), u).ok, false, 'sin muro de núcleo en el DXF');
  assert.equal(verificarDxfUnidad(dxf.replace(/\n8\nMURO_FACHADA\n/g, '\n8\nMURO_MEDIANERO\n'), u).ok, false, 'ventanas ya no están sobre fachada');
  const conPiscina = dxf.replace('ENDSEC\n0\nEOF', 'ENDSEC\n0\nEOF').replace(/\n0\nSECTION\n2\nENTITIES\n/, '\n0\nSECTION\n2\nENTITIES\n0\nTEXT\n8\nTEXTO\n10\n0\n20\n0\n30\n0\n40\n0.2\n1\nPiscina del jardin\n'); assert.ok(verificarDxfUnidad(conPiscina, u).problemas.some((p) => p.codigo === 'ELEMENTOS_DE_LOTE'));
});

test('generalidad (retenidos de desarrollo): oficina, local comercial, otro nivel, lados declarados, terraza con área, último piso; errores claros', () => {
  const of = generarUnidad({ tipologia: 'oficina', nombre: 'Oficina p3', superficie_m2: 120, nivel: { indice: 3 } }); assert.ok(of.muros.some((w) => w.clase === 'nucleo')); assert.equal(of.huella_tipologica.ventanas_en_muros_no_fachada, 0); assert.ok(!of.recintos.some((r) => r.tipo === 'dormitorio')); assert.ok(of.recintos.some((r) => r.nombre === 'Servicios higiénicos'));
  const lo = generarUnidad({ tipologia: 'local_comercial', nombre: 'Local', superficie_m2: 80, nivel: { indice: 0 }, lados: { N: 'fachada', S: 'medianero', E: 'medianero', O: 'nucleo' } }); assert.equal(lo.huella_tipologica.acceso.lado, 'O'); assert.equal(lo.huella_tipologica.losa_inferior, 'sobre_terreno_o_subterraneo');
  const esq = generarUnidad({ tipologia: 'departamento', nombre: 'Esquina', superficie_m2: 75, dormitorios: 3, banos: 2, nivel: { indice: 8, ultimo_piso: true }, lados: { N: 'fachada', E: 'fachada', S: 'nucleo', O: 'medianero' }, terraza: { presente: true, area_m2: 8 }, frente_m: 9 });
  assert.equal(esq.huella_tipologica.losa_superior, 'cubierta_expuesta'); assert.equal(esq.cubiertas.length, 1); assert.equal(esq.huella_tipologica.tramos_por_clase.fachada, 2); assert.ok(esq.recintos.filter((r) => r.tipo === 'dormitorio').length === 3); assert.ok(verificarDxfUnidad(generarDxfUnidad(esq), esq).ok); assert.ok(esq.supuestos.some((s) => /Lado O/.test(s)) === false, 'todos los lados declarados: sin supuesto de lados');
  assert.throws(() => generarUnidad({ ...DEP, lados: { N: 'medianero', E: 'medianero', S: 'nucleo', O: 'medianero' } }), (e) => e.code === 'SIN_FACHADA'); assert.throws(() => generarUnidad({ ...DEP, lados: { N: 'fachada', E: 'medianero', S: 'medianero', O: 'medianero' } }), (e) => e.code === 'SIN_NUCLEO');
  assert.throws(() => generarUnidad({ ...DEP, lados: { N: 'medianero', E: 'fachada', S: 'nucleo', O: 'medianero' } }), (e) => e.code === 'TERRAZA_SIN_FACHADA'); assert.throws(() => generarUnidad({ ...DEP, superficie_m2: 10, frente_m: 20 }), (e) => e.code === 'PROGRAMA_INVIABLE'); assert.throws(() => generarUnidad({ tipologia: 'departamento', nombre: 'x', superficie_m2: -3 }));
  for (const t of ['departamento', 'oficina', 'local_comercial']) for (const A of [40, 62, 95, 150]) { const u = generarUnidad({ tipologia: t, nombre: 'v', superficie_m2: A, nivel: { indice: 2 } }); assert.ok(verificarDxfUnidad(generarDxfUnidad(u), u).ok, `${t} ${A}`); construirPrimitivas(u.modelo3d); }
});

test('MCP tannia_cic_edificacion: artefactos reales (DXF + modelo + 3D versionado), claims de superficie y contraste casa/departamento por herramienta', async () => {
  const home = tmpHome('Tannia ñ g8 '); const { client: c, close } = await startClient(home, undefined, { TANNIA_CIC: 'on' }); const P = 'Edificio ñ';
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: P });
    let r = await call(c, 'tannia_cic_edificacion', { proyecto: P, caso: 'Depto', accion: 'generar_unidad', programa: DEP, crear_3d: true }); assert.ok(!r.isError, JSON.stringify(r.content).slice(0, 400)); const d = data(r);
    assert.equal(d.huella_tipologica.tipologia, 'departamento'); assert.ok(d.verificacion_dxf.ok); assert.ok(d.modelo_3d.primitivas > 15); assert.equal(d.modelo_3d.creado.version, 'v001'); assert.ok(d.desconocidos.length >= 6);
    for (const f of [d.archivos.dxf, d.archivos.modelo]) assert.ok(fs.existsSync(path.join(home, 'Proyectos', P, f)), f);
    assert.ok(fs.existsSync(path.join(home, 'Proyectos', P, '03 Trabajo', 'Modelos3D')), 'modelo 3D reutilizando tannia_3d');
    const cl = data(await call(c, 'tannia_cic_claims', { proyecto: P, caso: 'Depto', tipo: 'calculation' })).claims; assert.equal(cl.length, 6); assert.ok(Math.abs(cl.reduce((a, x) => a + x.valor, 0) - (9317 * 6655) / 1e6) < 1e-3);
    const modelo = JSON.parse(fs.readFileSync(path.join(home, 'Proyectos', P, d.archivos.modelo), 'utf8')); assert.equal(modelo.huella_tipologica.acceso.desde, 'circulacion_comun');
    r = await call(c, 'tannia_cic_edificacion', { proyecto: P, caso: 'Casa', accion: 'generar_unidad', programa: { ...DEP, tipologia: 'casa', nombre: 'Casa' } }); const b = data(r); assert.equal(b.huella_tipologica.acceso.desde, 'exterior'); assert.notDeepEqual(b.huella_tipologica.tramos_por_clase, d.huella_tipologica.tramos_por_clase);
    r = await call(c, 'tannia_cic_edificacion', { proyecto: P, caso: 'Malo', accion: 'generar_unidad', programa: { ...DEP, superficie_m2: -1 } }); assert.equal(r.isError, true);
    r = await call(c, 'tannia_cic_edificacion', { proyecto: P, caso: 'Sin fachada', accion: 'generar_unidad', programa: { ...DEP, lados: { N: 'medianero', E: 'medianero', S: 'nucleo', O: 'medianero' } } }); assert.equal(data(r).error, 'SIN_FACHADA');
  } finally { await close(); }
});
