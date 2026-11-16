// Confianza en el DWG: comparación tipada (LINE/ARC/polilíneas/TEXT), verificación por lotes, capas, arcos y textos con ñ/tildes.
// Servidor COM simulado en Node a partir de un DXF REAL del anteproyecto; los defectos se reproducen con interruptores.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generarModelo } from '../src/design/generador.js';
import { derivar } from '../src/design/derivar.js';
import { escribirDxf } from '../src/design/salidas.js';
import { parseDxf } from '../src/dxf/reader.js';
import { AutoCadCom, conteoPorCapa, verificarEstructura } from '../src/cad/autocad_com.js';
import { compararLecturas, coherenciaInterna, clasificarTextos, firmasDesdeDxf, firmasDesdeCom, compararFidelidad, posicionEfectiva } from '../src/cad/fidelidad.js';
import { Sandbox } from '../src/security/sandbox.js';
import { createProject } from '../src/project/projects.js';
import { entidadesCom, tipado, servidorSimulado } from './helpers_com.js';
import { tmpHome } from './helpers.js';

const modelo = generarModelo({}); const geo = derivar(modelo);
const DXF = escribirDxf(modelo, geo, { titulo: 'Casa ñandú 80', version: 'v001', fecha: '2026-11-16' });
const COM = entidadesCom(DXF);

function proyecto() {
  const home = tmpHome("Tannia 'ñ ó "); const sb = new Sandbox(home); createProject(sb, 'Casa');
  const root = path.join(home, 'Proyectos', 'Casa'); const dir = path.join(root, '03 Trabajo', 'Anteproyectos', 'Casa 80'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'v001.dxf'), DXF); fs.writeFileSync(path.join(dir, 'v001.dwg'), Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(4000, 7)]));
  fs.writeFileSync(path.join(root, '02 Originales', 'o.dwg'), 'ORIGINAL');
  return { home, sb, root, dir, dwg: path.join(dir, 'v001.dwg'), done: () => fs.rmSync(home, { recursive: true, force: true }) };
}
const L = (h, p = {}) => ({ handle: h, tipo: 'AcDbLine', capa: 'T', inicio: [0, 0, 0], fin: [6000, 0, 0], longitud: 6000, ...p });
const A = (h, p = {}) => ({ handle: h, tipo: 'AcDbArc', capa: 'TW_PUERTA', centro: [0, 0, 0], radio: 800, angulo_inicio: 0, angulo_fin: Math.PI / 2, longitud_arco: 800 * Math.PI / 2, ...p });
const P = (h, p = {}) => ({ handle: h, tipo: 'AcDb2dPolyline', capa: 'TW_RECINTO', coordenadas: [0, 0, 0, 10, 0, 0, 10, 5, 0, 0, 5, 0], cerrada: true, ...p });
const X = (h, p = {}) => ({ handle: h, tipo: 'AcDbText', capa: 'TW_TEXTO', texto: 'BAÑO', altura: 170, posicion: [0, 0, 0], alineacion: 1, punto_alineacion: [100, 200, 0], ...p });

test('comparación TIPADA: cada tipo se compara por sus propiedades reales y lo no informado NO se compara como null=null', () => {
  const antes = [L('1'), A('2'), P('3'), X('4')];
  let r = compararLecturas(antes, structuredClone(antes)); assert.equal(r.estado, 'verificada'); assert.deepEqual(r.cobertura.AcDbArc, { entidades: 1, verificadas: 1, propiedades_comparadas: 5 });
  assert.equal(r.cobertura.AcDbText.propiedades_comparadas, 3, 'texto, altura y posición efectiva');
  // un arco leído SIN propiedades de arco (como la lectura genérica antigua) ya no "pasa": queda no verificable
  const generica = [{ handle: '2', tipo: 'AcDbArc', capa: 'TW_PUERTA', longitud: 0 }];
  r = compararLecturas(generica, structuredClone(generica)); assert.equal(r.estado, 'no_concluyente'); assert.equal(r.diferencias.length, 0);
  assert.ok(r.no_verificables.some((x) => x.propiedad === 'centro') && r.no_verificables.some((x) => x.propiedad === 'longitud_arco'));
  // un texto sin posición ni altura tampoco se da por bueno
  r = compararLecturas([{ handle: '4', tipo: 'AcDbText', capa: 'T', texto: 'X' }], [{ handle: '4', tipo: 'AcDbText', capa: 'T', texto: 'X' }]); assert.equal(r.estado, 'no_concluyente');
  // tipos sin comparador y propiedades perdidas
  r = compararLecturas([{ handle: '5', tipo: 'AcDbHatch', capa: 'T', sin_propiedades_conocidas: true }], [{ handle: '5', tipo: 'AcDbHatch', capa: 'T' }]); assert.equal(r.no_verificables[0].motivo, 'tipo_de_entidad_sin_comparador');
  r = compararLecturas([L('1')], [L('1', { fin: null })]); assert.equal(r.estado, 'fallida'); assert.equal(r.diferencias[0].problema, 'propiedad_perdida');
});

test('comparación tipada: detecta cambios reales por tipo (línea, arco, polilínea, texto con ñ, capa, desaparición, tipo)', () => {
  const antes = [L('1'), A('2'), P('3'), X('4'), L('5')];
  const mod = structuredClone(antes);
  mod[0].fin = [6000, 0.5, 0]; mod[1].radio = 799; mod[2].coordenadas[4] = 11; mod[3].texto = 'BA?O'; mod[4].capa = 'OTRA';
  const r = compararLecturas(antes, mod);
  assert.equal(r.estado, 'fallida');
  assert.deepEqual(r.diferencias.map((d) => d.problema).sort(), ['capa_distinta', 'coordenadas_distinto', 'fin_distinto', 'radio_distinto', 'texto_distinto']);
  assert.deepEqual(compararLecturas(antes, structuredClone(antes).slice(1)).diferencias.map((d) => d.problema), ['desaparecio_tras_reabrir']);
  const t = structuredClone(antes); t[0].tipo = 'AcDbPolyline'; assert.ok(compararLecturas(antes, t).diferencias.some((d) => d.problema === 'tipo_distinto'));
  // el texto con alineación usa el punto de alineación (no el de inserción): cambiar solo el de inserción no es un cambio
  const x2 = structuredClone(antes); x2[3].posicion = [9, 9, 9]; assert.equal(compararLecturas(antes, x2).estado, 'verificada');
  assert.deepEqual(posicionEfectiva(X('4')), [100, 200, 0]); assert.deepEqual(posicionEfectiva(X('4', { alineacion: 0 })), [0, 0, 0]);
});

test('arcos de puerta: la longitud 0 era una conversión de propiedad inexistente; ahora se lee ArcLength y se cruza con r×ángulo', () => {
  const arcos = COM.filter((e) => e.tipo === 'AcDbArc'); assert.equal(arcos.length, 6, 'las 6 puertas con barrido');
  for (const a of arcos) {
    assert.equal(a.props.Length, undefined, 'IAcadArc no tiene Length');
    const t = tipado(a, '1'); assert.equal(t.longitud, undefined, 'no se inventa "longitud": 0'); near(t.longitud_arco, t.radio * Math.PI / 2);
    assert.deepEqual(coherenciaInterna(t), []);
  }
  near(tipado(arcos[0], '1').longitud_arco, arcos[0].props.Radius * Math.PI / 2, 1e-6);
  assert.ok(tipado(arcos[0], '1').longitud_arco > 1000, 'longitud real del arco, no 0');
  // la lectura defectuosa (0) se detecta como incoherente aunque "pase" la comparación antes/después
  const mala = { ...tipado(arcos[0], '1'), longitud_arco: 0 };
  assert.equal(coherenciaInterna(mala)[0].problema, 'arco_longitud_incoherente');
  assert.equal(compararLecturas([mala], [mala]).estado, 'no_concluyente'); assert.equal(compararLecturas([mala], [mala]).inconsistencias_internas.length, 1);
  assert.equal(coherenciaInterna({ ...mala, longitud_arco: null })[0].problema, 'arco_sin_longitud_informada');
  assert.equal(coherenciaInterna({ handle: '1', tipo: 'AcDbLine', inicio: [0, 0, 0], fin: [3, 4, 0], longitud: 0 })[0].problema, 'linea_longitud_incoherente');
});
function near(a, b, tol = 1e-6) { assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`); }

test('textos con tildes y Ñ: clasificación exacta / secuencia \\U+ sin decodificar / corrupta, con puntos de código', () => {
  const esperados = ['BAÑO 1', 'DORMITORIO 2', 'COCINA', 'BAÑO PRINCIPAL'];
  let r = clasificarTextos(esperados, [...esperados]); assert.equal(r.ok, true); assert.equal(r.con_acentos_correctos, 2);
  r = clasificarTextos(esperados, ['BA\\U+00D1O 1', 'DORMITORIO 2', 'COCINA', 'BAÑO PRINCIPAL']); assert.equal(r.ok, false); assert.deepEqual(r.escape_sin_decodificar, ['BA\\U+00D1O 1']); assert.equal(r.faltantes[0].texto, 'BAÑO 1'); assert.deepEqual(r.faltantes[0].codepoints, ['U+00D1']);
  r = clasificarTextos(esperados, ['BA?O 1', 'DORMITORIO 2', 'COCINA', 'BAÑO PRINCIPAL']); assert.equal(r.ok, false); assert.equal(r.corruptos[0].esperado, 'BAÑO 1'); assert.deepEqual(r.corruptos[0].codepoints_informados, ['U+003F']);
  r = clasificarTextos(esperados, ['BAÃ‘O 1', 'DORMITORIO 2', 'COCINA', 'BAÑO PRINCIPAL']); assert.equal(r.ok, false); assert.equal(r.corruptos.length, 1, 'mojibake UTF-8 leído como cp1252');
  r = clasificarTextos(esperados, esperados.slice(1)); assert.equal(r.ok, false); assert.equal(r.faltantes.length, 1);
});

test('el DXF del anteproyecto contiene textos con Ñ/tildes escapados y el esperado se decodifica a caracteres reales', () => {
  const dxf = parseDxf(DXF); const textos = dxf.entities.filter((e) => e.type === 'TEXT');
  assert.ok(textos.some((t) => /BA\\U\+00D1O/.test(t.text)), 'BAÑO escapado como \\U+00D1');
  assert.ok(COM.some((e) => e.tipo === 'AcDbText' && e.props.TextString === 'BAÑO 1'));
  assert.ok(COM.some((e) => e.tipo === 'AcDbText' && /CONSTRUCCION/.test(e.props.TextString)));
});

test('fidelidad DXF→DWG por firmas: fiel cuando coincide; detecta faltantes, sobrantes y conversiones erróneas', () => {
  const esp = firmasDesdeDxf(parseDxf(DXF)); assert.equal(esp.length, 232);
  const lect = COM.map((e, i) => tipado(e, String(i)));
  const { firmas, ilegibles } = firmasDesdeCom(lect); assert.equal(ilegibles.length, 0);
  assert.equal(compararFidelidad(esp, firmas).fiel, true);
  const sin = lect.filter((e) => e.tipo !== 'AcDbArc'); const r1 = compararFidelidad(esp, firmasDesdeCom(sin).firmas); assert.equal(r1.fiel, false); assert.equal(r1.faltan_por_tipo.ARC, 6);
  const mov = structuredClone(lect); const l = mov.find((e) => e.tipo === 'AcDbLine'); l.fin = [l.fin[0] + 10, l.fin[1], 0]; const r2 = compararFidelidad(esp, firmasDesdeCom(mov).firmas); assert.equal(r2.faltan_por_tipo.LINE, 1); assert.equal(r2.sobran_por_tipo.LINE, 1);
  const lw = structuredClone(lect).map((e) => (e.tipo === 'AcDb2dPolyline' ? { ...e, tipo: 'AcDbPolyline', coordenadas: e.coordenadas.filter((_, i) => i % 3 !== 2) } : e));
  assert.equal(compararFidelidad(esp, firmasDesdeCom(lw).firmas).fiel, true, 'LWPOLYLINE (2 valores por vértice) equivale a la polilínea 2D');
});

test('estructura: capas y conteos por capa; una lista de capas vacía (defecto "capas: []") NO se da por buena', () => {
  const esperado = conteoPorCapa(parseDxf(DXF)); assert.equal(esperado.TW_RECINTO, 8); assert.equal(esperado.TW_PUERTA, 12);
  const info = { capas: ['0', ...Object.keys(esperado)], entidades_por_capa: esperado, entidades: 232 };
  assert.equal(verificarEstructura(esperado, info).ok, true);
  const vacia = verificarEstructura(esperado, { ...info, capas: [] }); assert.equal(vacia.ok, false); assert.equal(vacia.capas_no_informadas, true);
  const falta = verificarEstructura(esperado, { ...info, capas: ['0', 'TW_MURO_EXT'] }); assert.ok(falta.capas_faltantes.includes('TW_RECINTO'));
  const cuenta = verificarEstructura(esperado, { ...info, entidades_por_capa: { ...esperado, TW_COTA: 60 }, entidades: 232 - esperado.TW_COTA + 60 }); assert.deepEqual(cuenta.diferencias_conteo, [{ capa: 'TW_COTA', esperadas: esperado.TW_COTA, informadas: 60 }]);
});

test('dxfADwg: reporta capas reales y conteos por capa; valida cabecera; detecta capas vacías o conteos distintos', async () => {
  const e = proyecto();
  try {
    const rel = '03 Trabajo/Anteproyectos/Casa 80/v001.dxf'; fs.unlinkSync(e.dwg);
    const escribe = (f) => fs.writeFileSync(f, Buffer.concat([Buffer.from('AC1032'), Buffer.alloc(4000)]));
    const mk = (o) => new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(COM, { activePath: e.dwg, escribeDwg: escribe, ...o }) });
    const ok = await mk({}).dxfADwg('Casa', rel);
    assert.ok(ok.capas.length >= 8 && ok.capas.includes('TW_RECINTO')); assert.equal(ok.entidades, 232); assert.equal(ok.verificacion_estructura.ok, true); assert.equal(ok.archivo_dwg.cabecera_dwg_valida, true); assert.match(ok.verificacion, /coinciden con el DXF/);
    fs.unlinkSync(e.dwg);
    const vacio = await mk({ capasVacias: true }).dxfADwg('Casa', rel); assert.equal(vacio.verificacion_estructura.ok, false); assert.equal(vacio.verificacion_estructura.capas_no_informadas, true); assert.match(vacio.verificacion, /ATENCIÓN/);
  } finally { e.done(); }
});

test('persistencia por LOTES: 2000 entidades sin superar el límite por llamada; cada lote es una llamada independiente', async () => {
  const e = proyecto();
  try {
    const grande = []; for (let i = 0; i < 2000; i++) grande.push({ tipo: 'AcDbLine', capa: 'TW_MURO_EXT', props: { StartPoint: [i, 0, 0], EndPoint: [i, 10, 0], Length: 10 } });
    const calls = []; const com = new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(grande, { activePath: e.dwg, maxHandles: 160, calls }) });
    const r = await com.verificarPersistencia('Casa', { archivo: '03 Trabajo/Anteproyectos/Casa 80/v001.dwg' });
    assert.equal(r.persistencia, 'verificada'); assert.equal(r.entidades_leidas, 2000); assert.deepEqual(r.lotes, { antes: 14, despues: 14, tam_lote: 150 });
    assert.ok(calls.filter((c) => c.name === 'leer_lote').every((c) => c.input.handles.length <= 150), 'ninguna llamada supera el tamaño de lote');
    assert.equal(calls.filter((c) => c.name === 'enumerar').length, 8, 'enumeración global en páginas de 500, antes y después de reabrir');
    assert.equal(calls.filter((c) => c.name === 'cerrar_reabrir').length, 1, 'se cierra y reabre UNA sola vez');
    assert.ok(calls.findIndex((c) => c.name === 'cerrar_reabrir') > calls.findLastIndex((c) => c.name === 'leer_lote' && calls.indexOf(c) < calls.findIndex((x) => x.name === 'cerrar_reabrir')), 'lee antes, cierra, lee después');
    // sin lotes, la misma verificación habría excedido el límite por llamada (simulación de timeout)
    await assert.rejects(() => com.leerLote(grande.map((_, i) => (0x100 + i).toString(16)), { tam: 400 }), (x) => x.code === 'AUTOCAD_ERROR' && x.detalle.clase === 'tiempo_agotado');
    // acotada por capa y por handles
    assert.equal((await com.verificarPersistencia('Casa', { archivo: '03 Trabajo/Anteproyectos/Casa 80/v001.dwg', capa: 'TW_MURO_EXT', tam_lote: 150 })).lotes.antes, 14);
    assert.equal((await com.verificarPersistencia('Casa', { archivo: '03 Trabajo/Anteproyectos/Casa 80/v001.dwg', handles: ['100', '101'] })).entidades_leidas, 2);
    await assert.rejects(() => com.verificarPersistencia('Casa', { archivo: '03 Trabajo/Anteproyectos/Casa 80/v001.dwg', capa: "x'; Quit" }), (x) => x.code === 'DATO_INVALIDO');
  } finally { e.done(); }
});

test('persistencia del anteproyecto completo (LINE, ARC, POLYLINE, TEXT): verificada; pérdida, texto corrupto y arco defectuoso se detectan', async () => {
  const e = proyecto(); const archivo = '03 Trabajo/Anteproyectos/Casa 80/v001.dwg';
  try {
    const run = (o) => new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(COM, { activePath: e.dwg, ...o }) }).verificarPersistencia('Casa', { archivo });
    const ok = await run({}); assert.equal(ok.persistencia, 'verificada'); assert.equal(ok.entidades_leidas, 232); assert.deepEqual(Object.keys(ok.cobertura).sort(), ['AcDb2dPolyline', 'AcDbArc', 'AcDbLine', 'AcDbText']);
    assert.ok(Object.values(ok.cobertura).every((c) => c.verificadas === c.entidades && c.propiedades_comparadas > 0), 'todas las entidades comparadas con propiedades reales');
    assert.equal(ok.no_verificables_total, 0); assert.equal(ok.inconsistencias_total, 0); assert.equal(ok.archivo_en_disco.sin_cambios_por_el_cierre_y_reapertura, true);
    const perdida = await run({ alReabrir: (ents) => ents.filter((x) => x.tipo !== 'AcDbArc') }); assert.equal(perdida.persistencia, 'fallida'); assert.equal(perdida.diferencias_total, 6);
    const corrupto = await run({ alReabrir: (ents) => ents.map((x) => (x.tipo === 'AcDbText' ? { ...x, props: { ...x.props, TextString: x.props.TextString.replace(/Ñ/g, '?') } } : x)) }); assert.equal(corrupto.persistencia, 'fallida'); assert.ok(corrupto.diferencias.every((d) => d.problema === 'texto_distinto'));
    const arco = await run({ arcoLongitud0: true }); assert.equal(arco.persistencia, 'no_concluyente'); assert.equal(arco.inconsistencias_total, 6, 'los 6 arcos defectuosos');
  } finally { e.done(); }
});

test('verificar DWG contra el DXF: fiel; y cada defecto (faltantes, textos sin decodificar/corruptos, capas vacías, arcos en 0) se reporta', async () => {
  const e = proyecto(); const args = { dxfRel: '03 Trabajo/Anteproyectos/Casa 80/v001.dxf', dwgRel: '03 Trabajo/Anteproyectos/Casa 80/v001.dwg' };
  try {
    const v = (ents, o = {}) => new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(ents, { activePath: e.dwg, ...o }) }).verificarDwg('Casa', args);
    const ok = await v(COM); assert.equal(ok.fidelidad, 'fiel'); assert.equal(ok.entidades.en_dxf, 232); assert.equal(ok.entidades.leidas_en_dwg, 232); assert.equal(ok.textos.ok, true); assert.ok(ok.textos.con_acentos_correctos >= 2); assert.equal(ok.estructura.ok, true); assert.deepEqual(ok.lotes, 2);
    const esc = await v(entidadesCom(DXF, { textoComo: 'escape' })); assert.equal(esc.fidelidad, 'con_diferencias'); assert.ok(esc.textos.escape_sin_decodificar.some((t) => /\\U\+00D1/.test(t)));
    const cor = await v(entidadesCom(DXF, { textoComo: 'corrupto' })); assert.equal(cor.fidelidad, 'con_diferencias'); assert.ok(cor.textos.corruptos.length >= 1 && cor.textos.corruptos[0].codepoints_informados.includes('U+003F'));
    const falt = await v(COM.filter((x) => x.tipo !== 'AcDbLine' || x.capa !== 'TW_COTA')); assert.equal(falt.fidelidad, 'con_diferencias'); assert.equal(falt.comparacion_geometrica.faltan_por_tipo.LINE, 55);
    const vac = await v(COM, { capasVacias: true }); assert.equal(vac.fidelidad, 'con_diferencias'); assert.equal(vac.estructura.capas_no_informadas, true);
    const arc = await v(COM, { arcoLongitud0: true }); assert.equal(arc.fidelidad, 'no_concluyente'); assert.equal(arc.inconsistencias_total, 6);
    // seguridad: solo lectura y solo con la copia activa en 03 Trabajo; el original jamás
    await assert.rejects(() => new AutoCadCom({ sandbox: e.sb, platform: 'win32', runner: servidorSimulado(COM, { activePath: path.join(e.root, '02 Originales', 'o.dwg') }) }).verificarDwg('Casa', args), (x) => x.code === 'ORIGINAL_PROTEGIDO');
    assert.equal(fs.readFileSync(path.join(e.root, '02 Originales', 'o.dwg'), 'utf8'), 'ORIGINAL');
  } finally { e.done(); }
});
