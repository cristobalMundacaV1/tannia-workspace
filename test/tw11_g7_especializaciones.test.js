// TW-11 G7: especializaciones declarativas, carga segura desde disco (T13), adaptador de enrutador con equivalencia y sin puertas por disciplina.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { tmpHome, startClient, call, data } from './helpers.js';
import { listarEspecializaciones, obtenerEspecializacion, registrarEspecializacion, especializacionesRechazadas } from '../src/cic/especializaciones.js';
import { cargarIntegradas, cargarDesdeDirectorio, cargarEspecializacion } from '../src/cic/especializaciones/index.js';
import { obtenerOperacion } from '../src/cic/ops/index.js';
import { evaluarEncargo } from '../src/politica/autonomia.js';
import { adaptarEnrutador } from '../src/cic/enrutador.js';

test('especializaciones integradas: válidas, solo declaran, referencian operaciones existentes y exigen validación competente', () => {
  cargarIntegradas(); const l = listarEspecializaciones(); const ids = l.map((e) => e.id);
  for (const id of ['obras_civiles.tuneles', 'obras_lineales.vial', 'transversal.cubicaciones', 'transversal.planificacion', 'edificacion.vivienda']) assert.ok(ids.includes(id), id);
  for (const e of l) { assert.ok(e.automation_limits.length, `${e.id}: límites`); assert.ok(e.required_validation.length, `${e.id}: validación requerida`); for (const m of e.methods) for (const op of m.operations) assert.ok(obtenerOperacion(op), `${e.id}: ${op}`); }
  const t = obtenerEspecializacion('obras_civiles.tuneles'); assert.ok(t.automation_limits.some((x) => /sostenimiento/i.test(x))); assert.ok(t.gaps.every((g) => ['external_professional', 'new_tool'].includes(g.resolution)));
  // una especialización no puede bajar restricciones del núcleo: el esquema estricto rechaza campos que lo intenten
  assert.equal(registrarEspecializacion({ ...t, id: 'x.malicioso', maturity_min: 'E0', mode_overrides: { permitir_e0: true } }).ok, false);
  assert.equal(registrarEspecializacion({ ...t, id: 'x.sinlimites', automation_limits: undefined }).ok, false);
});

test('T13: especialización corrupta o con referencias inexistentes en disco se DESACTIVA con motivo; el resto y el servidor siguen', async () => {
  cargarIntegradas(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esp ñ ')); const ok = { ...obtenerEspecializacion('transversal.planificacion'), id: 'usuario.mi_planificacion', title: 'Mi planificación' };
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(ok)); fs.writeFileSync(path.join(dir, 'b.json'), '{ esto no es json'); fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify({ ...ok, id: 'usuario.ref_mala', methods: [{ id: 'm', title: 't', steps: ['x'], operations: ['op.que.no.existe'], tools: [] }] })); fs.writeFileSync(path.join(dir, 'd.json'), JSON.stringify({ id: 'sin_esquema' }));
  const inf = cargarDesdeDirectorio(dir); assert.deepEqual(inf.map((x) => x.ok), [true, false, false, false]); assert.ok(listarEspecializaciones().some((e) => e.id === 'usuario.mi_planificacion')); assert.ok(especializacionesRechazadas().some((r) => r.id === 'usuario.ref_mala' && /no existe en el cat/.test(r.errores[0])));
  // por MCP con el servidor en marcha: el catálogo informa qué se desactivó y las capacidades siguen disponibles
  const home = tmpHome('Tannia ñ g7 '); const { client: c, close } = await startClient(home, undefined, { TANNIA_CIC: 'on', TANNIA_CIC_ESPECIALIZACIONES: dir });
  try {
    const cat = data(await call(c, 'tannia_cic_catalogo', { tipo: 'especializaciones' })); assert.ok(cat.especializaciones.some((e) => e.id === 'usuario.mi_planificacion')); assert.ok(cat.especializaciones_desactivadas.some((e) => e.id === 'usuario.ref_mala')); assert.match(cat.nota_especializaciones, /nunca bloquea/);
    const det = data(await call(c, 'tannia_cic_catalogo', { id: 'obras_civiles.tuneles' })); assert.ok(det.methods[0].steps.length >= 5); assert.ok(det.required_validation.length >= 1);
    const calc = await call(c, 'tannia_cic_calcular', { operacion: 'geo.section.circle', entradas: { radio: { value: 1, unit: 'm' } } }); assert.ok(!calc.isError, 'las capacidades transversales no dependen de ninguna especialización');
  } finally { await close(); }
});

const BASES = ['casa de 90 m2 con 3 dormitorios', 'túnel carretero para el curso de obras civiles', 'puente peatonal de hormigón', 'carretera de 5 km con curvas', 'canal de riego revestido', 'bodega industrial de acero', 'departamento de 62 m2 en el 5to piso', 'proyecto eléctrico de una vivienda', 'permiso de edificación con firma de planos', 'cubicar un DXF con muros y losas', 'muro de contención con gaviones', 'planta de tratamiento de aguas', 'render fotorrealista de una casa', 'anteproyecto 3D de una casa en L con patio y piscina', 'estructura de hormigón armado de un edificio', 'presupuesto de un galpón', 'cronograma de obra de una vivienda', 'diseño de pavimento de una calle'];
const VERBOS = ['necesito', 'quiero', 'me piden', 'ayúdame con', 'tengo que entregar'];
const CORPUS = BASES.flatMap((b) => VERBOS.map((v) => `${v} ${b}`)).concat(BASES.map((b) => `${b}. Es un trabajo para la universidad`), BASES.map((b) => `Datos: ${b}; sin planos todavía`), BASES.map((b) => `URGENTE: ${b}`), BASES.map((b) => `${b} en Antofagasta con presupuesto ajustado`), BASES.map((b) => `¿Se puede hacer ${b}?`), BASES.map((b) => `Quiero aprender a resolver ${b}`), BASES.map((b) => `${b}, con planos adjuntos`));
test('migración M3: ≥200 frases históricas; la clasificación existente NO cambia; el adaptador solo AGREGA una ruta (y nunca bloquea)', () => {
  assert.ok(CORPUS.length >= 200, `${CORPUS.length}`);
  const dist = {}; let ns = 0;
  for (const f of CORPUS) {
    const viejo = evaluarEncargo({ solicitud: f }); const copia = JSON.parse(JSON.stringify(viejo)); const cic = adaptarEnrutador(viejo, f);
    assert.deepEqual(viejo, copia, 'el adaptador no muta la salida original'); dist[viejo.capacidad] = (dist[viejo.capacidad] || 0) + 1;
    if (viejo.capacidad === 'no_soportado') { ns++; assert.equal(cic.ruta, 'tannia_cic_encargo'); assert.match(cic.mensaje, /NO diga «no soportado»/); assert.ok(cic.herramientas_cic.includes('tannia_cic_catalogo')); } else assert.equal(cic.ruta, 'opcional');
    assert.ok(cic.operaciones_disponibles >= 10); assert.match(cic.nota, /ninguna disciplina condiciona/);
  }
  assert.ok(ns >= 20, `frases no soportadas: ${ns}`); // el corpus ejercita realmente el caso «sin generador»
  const t = adaptarEnrutador(evaluarEncargo({ solicitud: 'túnel carretero' }), 'túnel carretero con sostenimiento y revestimiento'); assert.equal(t.especializaciones_sugeridas[0].id, 'obras_civiles.tuneles');
  const desconocido = adaptarEnrutador(evaluarEncargo({ solicitud: 'obra de arte hidráulica zzz' }), 'obra de arte hidráulica zzz'); assert.deepEqual(desconocido.especializaciones_sugeridas, []); assert.ok(desconocido.herramientas_cic.length >= 5, 'sin especialización igual hay herramientas');
});

test('MCP: tannia_encargo_evaluar con el flag APAGADO es idéntico a rc3; ENCENDIDO solo agrega «cic» (60 frases)', async () => {
  const off = await startClient(tmpHome('Tannia ñ off '), undefined, { TANNIA_CIC: 'off' }); const on = await startClient(tmpHome('Tannia ñ on '), undefined, { TANNIA_CIC: 'on' });
  try {
    for (const f of CORPUS.filter((_, i) => i % 3 === 0).slice(0, 60)) {
      const a = await call(off.client, 'tannia_encargo_evaluar', { solicitud: f }); const b = await call(on.client, 'tannia_encargo_evaluar', { solicitud: f }); const da = data(a); const db = { ...data(b) }; assert.ok(!('cic' in da)); assert.ok('cic' in db); delete db.cic; assert.deepEqual(db, da, f);
      const resumen = (r) => r.content[0].text.split('\n\n```json')[0]; if (da.capacidad !== 'no_soportado') assert.equal(resumen(a), resumen(b), f); else assert.match(b.content[0].text, /tannia_cic_encargo|tannia_cic_catalogo/);
    }
  } finally { await off.close(); await on.close(); }
});
