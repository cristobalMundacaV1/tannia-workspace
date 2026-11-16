// Gramáticas de partido (compacta, L con patio, dos alas con patio) con generación determinista.
// Cada partido se construye en un marco canónico (acceso por el sur) y luego se orienta con una de las 8 simetrías del cuadrado
// según el acceso/predio/norte; el espejo NO cuenta como alternativa distinta (ver diversidad.js).
import { UserError } from '../mcp/util.js';
import { SISTEMAS, RECINTOS, ABERTURAS, GENERALES } from '../conocimiento/criterios.js';
import { SCHEMA_IDS } from './schemas.js';
import { derivarEsquema, huellaDeEspacios } from './derivar_poly.js';
import { anilloDeRect } from './poligonos.js';
import { VERSION_MOTOR } from './version.js';

const PAS = RECINTOS.pasillo.ancho_eje_mm; // 1100
const W_DP = RECINTOS.dormitorio_principal.ancho_eje_mm; const W_D = RECINTOS.dormitorio.ancho_eje_mm; const W_BANO = RECINTOS.bano.ancho_eje_mm; const W_COC = RECINTOS.cocina.ancho_eje_mm;
const redondear = (v, p = 50) => Math.round(v / p) * p;
const sp = (id, nombre, tipo, zona, x0, y0, x1, y1) => ({ id, nombre, tipo, zona, ring: anilloDeRect({ x0, y0, x1, y1 }) });
const FACTOR_TOL = GENERALES.tolerancia_superficie;

export const LIMITES_PARTIDOS = { dormitorios: [1, 5], banos: [1, 2], superficie_m2: [45, 260] };

export function normalizarProgramaArq(p = {}) {
  const prog = { superficie_m2: p.superficie_m2 ?? null, dormitorios: p.dormitorios ?? 3, banos: p.banos ?? 2, cocina: p.cocina ?? 'americana', piscina: !!p.piscina, sistema: p.sistema_constructivo ?? 'albanileria_confinada' };
  const supuestos = [];
  if (prog.superficie_m2 == null) throw new UserError('FALTA_SUPERFICIE', 'Falta la superficie objetivo (m²): no se inventa.', 'Indique cuántos m² construidos desea.');
  if (p.dormitorios === undefined) supuestos.push('Dormitorios no indicados: se parte con 3 (editable).');
  if (p.banos === undefined) supuestos.push('Baños no indicados: se parte con 2 (editable).');
  if (!SISTEMAS[prog.sistema]) throw new UserError('PROGRAMA_NO_SOPORTADO', `Sistema constructivo no reconocido: ${prog.sistema}.`);
  const [dmin, dmax] = LIMITES_PARTIDOS.dormitorios; const [bmin, bmax] = LIMITES_PARTIDOS.banos; const [smin, smax] = LIMITES_PARTIDOS.superficie_m2;
  if (!Number.isInteger(prog.dormitorios) || prog.dormitorios < dmin || prog.dormitorios > dmax) throw new UserError('PROGRAMA_NO_SOPORTADO', `Se generan de ${dmin} a ${dmax} dormitorios (pidió ${prog.dormitorios}).`);
  if (!Number.isInteger(prog.banos) || prog.banos < bmin || prog.banos > bmax) throw new UserError('PROGRAMA_NO_SOPORTADO', `Se generan de ${bmin} a ${bmax} baños.`);
  if (!(prog.superficie_m2 >= smin && prog.superficie_m2 <= smax)) throw new UserError('PROGRAMA_NO_SOPORTADO', `Se generan viviendas de ${smin} a ${smax} m² (pidió ${prog.superficie_m2}).`);
  if (!['americana', 'cerrada'].includes(prog.cocina)) throw new UserError('PROGRAMA_NO_SOPORTADO', 'cocina debe ser "americana" o "cerrada".');
  return { programa: prog, supuestos };
}

// ---------- lista de recintos nocturnos (ancho a ejes) ----------
function nocturnos(prog, anchoUniforme = null) {
  const L = [{ id: 'R-DP', nombre: 'DORMITORIO PRINCIPAL', tipo: 'dormitorio_principal', w: anchoUniforme ?? W_DP }];
  for (let i = 2; i <= prog.dormitorios; i++) L.push({ id: `R-D${i}`, nombre: `DORMITORIO ${i}`, tipo: 'dormitorio', w: anchoUniforme ?? W_D });
  return L;
}

// ---------- layouts canónicos (acceso por el sur; x → este, y → norte). `p`: parámetros de ajuste {s, d} ----------
const LAYOUTS = {
  compacta(prog, { s, d }) {
    const night = nocturnos(prog); const items = [...night]; if (prog.banos >= 2) items.splice(1, 0, { id: 'R-BP', nombre: 'BAÑO PRINCIPAL', tipo: 'bano', w: W_BANO });
    const wN = items.reduce((a, i) => a + i.w, 0); const wBC = W_BANO - 100; const W = Math.max(wN, 5200 + W_COC + wBC) + s;
    const ds = 3100 + d; const dn = 2900 + d;
    // el ancho extra de la franja norte se reparte entre dormitorios
    const extra = W - wN; const dorms = items.filter((i) => i.id.startsWith('R-D')); let usado = 0;
    dorms.forEach((x, k) => { const add = k === dorms.length - 1 ? extra - usado : redondear((extra * x.w) / dorms.reduce((a, y) => a + y.w, 0)); x.w += add; usado += add; });
    const spaces = []; let x = 0;
    spaces.push(sp('R-LIV', 'LIVING-COMEDOR', 'living_comedor', 'social', 0, 0, W - W_COC - wBC, ds)); x = W - W_COC - wBC;
    spaces.push(sp('R-COC', prog.cocina === 'americana' ? 'COCINA AMERICANA' : 'COCINA', 'cocina', 'servicio', x, 0, x + W_COC, ds)); x += W_COC;
    spaces.push(sp('R-BC', prog.banos >= 2 ? 'BAÑO 1' : 'BAÑO', 'bano', 'servicio', x, 0, W, ds));
    spaces.push(sp('R-PAS', 'PASILLO', 'pasillo', 'circulacion', 0, ds, W, ds + PAS));
    x = 0; for (const it of items) { spaces.push(sp(it.id, it.nombre, it.tipo, it.tipo === 'bano' ? 'servicio' : 'privada', x, ds + PAS, x + it.w, ds + PAS + dn)); x += it.w; }
    const plan = [
      { id: 'P-ACC', tipo: 'puerta', funcion: 'acceso', entre: ['R-LIV'], lado: 'S', w: ABERTURAS.puerta_acceso.ancho_mm, h: 2100, en: 1100, desde: 'inicio' },
      { id: 'V-LIV-S', tipo: 'ventana', entre: ['R-LIV'], lado: 'S', w: 2400, h: 1300, ant: 800, en: 0.7 },
      { id: 'V-LIV-O', tipo: 'ventana', entre: ['R-LIV'], lado: 'O', w: 1500, h: 1300, ant: 800, en: 0.5 },
      { id: 'PS-LIV-PAS', tipo: 'paso', entre: ['R-LIV', 'R-PAS'], w: 1000, h: 2100, en: 1500, desde: 'inicio' },
      { id: 'V-COC', tipo: 'ventana', entre: ['R-COC'], lado: 'S', w: 1200, h: 1200, ant: 1000, en: 0.5 },
      { id: 'P-BC', tipo: 'puerta', entre: ['R-BC', 'R-PAS'], w: 700, h: 2100, en: 0.5 },
      { id: 'V-BC', tipo: 'ventana', entre: ['R-BC'], lado: 'S', w: 600, h: 600, ant: 1500, en: 0.5 },
      ...items.filter((i) => i.tipo !== 'bano').flatMap((i) => [{ id: `P-${i.id}`, tipo: 'puerta', entre: [i.id, 'R-PAS'], w: 800, h: 2100, en: 900, desde: 'inicio', abre: i.id }, { id: `V-${i.id}`, tipo: 'ventana', entre: [i.id], lado: 'N', w: 1500, h: 1200, ant: 900, en: 0.5 }]),
      ...(prog.banos >= 2 ? [{ id: 'P-BP', tipo: 'puerta', entre: ['R-DP', 'R-BP'], w: 700, h: 2100, en: 0.5, abre: 'R-BP' }, { id: 'V-BP', tipo: 'ventana', entre: ['R-BP'], lado: 'N', w: 600, h: 600, ant: 1500, en: 0.5 }] : []),
      ...(prog.cocina === 'cerrada' ? [{ id: 'P-COC', tipo: 'puerta', entre: ['R-LIV', 'R-COC'], w: 800, h: 2100, en: 0.5, abre: 'R-COC' }] : []),
    ];
    return { spaces, plan, abiertas: prog.cocina === 'americana' ? [['R-LIV', 'R-COC']] : [], ext: [], medida: { liv: [W - W_COC - wBC, ds] } };
  },

  L_con_patio(prog, { s, d }) {
    const wdorm = 3300; const wn = PAS + wdorm; const ds = 3100 + d; const wBC = 1800;
    const alturas = [{ id: 'R-DP', nombre: 'DORMITORIO PRINCIPAL', tipo: 'dormitorio_principal', h: 3500 }];
    if (prog.banos >= 2) alturas.push({ id: 'R-BP', nombre: 'BAÑO PRINCIPAL', tipo: 'bano', h: 1800 });
    for (let i = 2; i <= prog.dormitorios; i++) alturas.push({ id: `R-D${i}`, nombre: `DORMITORIO ${i}`, tipo: 'dormitorio', h: 3100 });
    const Ln = alturas.reduce((a, r) => a + r.h, 0) + (prog.banos >= 3 ? 0 : 0);
    const wL = 4400 + s; const Ws = wBC + wL + W_COC;
    const spaces = [sp('R-BC', prog.banos >= 2 ? 'BAÑO 1' : 'BAÑO', 'bano', 'servicio', 0, 0, wBC, ds), sp('R-LIV', 'LIVING-COMEDOR', 'living_comedor', 'social', wBC, 0, wBC + wL, ds), sp('R-COC', prog.cocina === 'americana' ? 'COCINA AMERICANA' : 'COCINA', 'cocina', 'servicio', wBC + wL, 0, Ws, ds)];
    spaces.push(sp('R-PAS', 'PASILLO', 'pasillo', 'circulacion', wdorm, ds, wn, ds + Ln));
    let y = ds; for (const r of alturas) { spaces.push(sp(r.id, r.nombre, r.tipo, r.tipo === 'bano' ? 'servicio' : 'privada', 0, y, wdorm, y + r.h)); y += r.h; }
    const patio = anilloDeRect({ x0: wn, y0: ds, x1: Ws, y1: ds + Ln });
    const plan = [
      { id: 'P-ACC', tipo: 'puerta', funcion: 'acceso', entre: ['R-LIV'], lado: 'S', w: ABERTURAS.puerta_acceso.ancho_mm, h: 2100, en: 1100, desde: 'inicio' },
      { id: 'V-LIV-S', tipo: 'ventana', entre: ['R-LIV'], lado: 'S', w: 2400, h: 1300, ant: 800, en: 0.75 },
      { id: 'P-LIV-PATIO', tipo: 'puerta', entre: ['R-LIV'], lado: 'N', w: 1800, h: 2100, en: 0.5, ajustar: true, patio: true },
      { id: 'P-BC', tipo: 'puerta', entre: ['R-BC', 'R-LIV'], w: 700, h: 2100, en: 0.5, abre: 'R-BC' },
      { id: 'V-BC', tipo: 'ventana', entre: ['R-BC'], lado: 'S', w: 600, h: 600, ant: 1500, en: 0.5 },
      { id: 'V-COC', tipo: 'ventana', entre: ['R-COC'], lado: 'N', w: 1500, h: 1200, ant: 1000, en: 0.5, patio: true },
      { id: 'V-COC-E', tipo: 'ventana', entre: ['R-COC'], lado: 'E', w: 1200, h: 1200, ant: 1000, en: 0.5 },
      { id: 'V-PAS', tipo: 'ventana', entre: ['R-PAS'], lado: 'E', w: 1200, h: 1200, ant: 900, en: 0.5, patio: true },
      ...alturas.filter((r) => r.tipo !== 'bano').flatMap((r) => [{ id: `P-${r.id}`, tipo: 'puerta', entre: [r.id, 'R-PAS'], w: 800, h: 2100, en: 0.5, abre: r.id }, { id: `V-${r.id}`, tipo: 'ventana', entre: [r.id], lado: 'O', w: 1500, h: 1200, ant: 900, en: 0.5 }]),
      ...(prog.banos >= 2 ? [{ id: 'P-BP', tipo: 'puerta', entre: ['R-DP', 'R-BP'], w: 700, h: 2100, en: 0.5, abre: 'R-BP' }, { id: 'V-BP', tipo: 'ventana', entre: ['R-BP'], lado: 'O', w: 600, h: 600, ant: 1500, en: 0.5 }] : []),
      ...(prog.cocina === 'cerrada' ? [{ id: 'P-COC', tipo: 'puerta', entre: ['R-LIV', 'R-COC'], w: 800, h: 2100, en: 0.5, abre: 'R-COC' }] : []),
    ];
    const abiertas = [['R-LIV', 'R-PAS'], ...(prog.cocina === 'americana' ? [['R-LIV', 'R-COC']] : [])];
    return { spaces, plan, abiertas, ext: [{ id: 'patio', use: 'family', ring: patio }], patio, medida: { liv: [wL, ds] } };
  },

  dos_alas(prog, { s, d }) {
    // C: franja sur (cocina + living), conector este (pasillo), franja norte (pasillo + dormitorios + baño social); patio abierto al oeste entre alas.
    const items = [...nocturnos(prog)]; if (prog.banos >= 2) items.splice(1, 0, { id: 'R-BP', nombre: 'BAÑO PRINCIPAL', tipo: 'bano', w: W_BANO });
    items.push({ id: 'R-BC', nombre: prog.banos >= 2 ? 'BAÑO 1' : 'BAÑO', tipo: 'bano', w: W_BANO });
    const wN = items.reduce((a, i) => a + i.w, 0); const ds = 3300 + d; const gap = 4200 + d; const dn = 3000 + d;
    const Ws = Math.max(wN, W_COC + 5200 + PAS) + s;
    const extra = Ws - wN; const dorms = items.filter((i) => i.id.startsWith('R-D')); let usado = 0;
    dorms.forEach((x, k) => { const add = k === dorms.length - 1 ? extra - usado : redondear((extra * x.w) / dorms.reduce((a, y) => a + y.w, 0)); x.w += add; usado += add; });
    const yN = ds + gap;
    const spaces = [sp('R-COC', prog.cocina === 'americana' ? 'COCINA AMERICANA' : 'COCINA', 'cocina', 'servicio', 0, 0, W_COC, ds), sp('R-LIV', 'LIVING-COMEDOR', 'living_comedor', 'social', W_COC, 0, Ws, ds),
      sp('R-PAS-E', 'PASILLO CONECTOR', 'pasillo', 'circulacion', Ws - PAS, ds, Ws, yN), sp('R-PAS', 'PASILLO', 'pasillo', 'circulacion', 0, yN, Ws, yN + PAS)];
    let x = 0; for (const it of items) { spaces.push(sp(it.id, it.nombre, it.tipo, it.tipo === 'bano' ? 'servicio' : 'privada', x, yN + PAS, x + it.w, yN + PAS + dn)); x += it.w; }
    const patio = anilloDeRect({ x0: 0, y0: ds, x1: Ws - PAS, y1: yN });
    const plan = [
      { id: 'P-ACC', tipo: 'puerta', funcion: 'acceso', entre: ['R-LIV'], lado: 'S', w: ABERTURAS.puerta_acceso.ancho_mm, h: 2100, en: 1100, desde: 'fin' },
      { id: 'V-LIV-S', tipo: 'ventana', entre: ['R-LIV'], lado: 'S', w: 2400, h: 1300, ant: 800, en: 0.35 },
      { id: 'P-LIV-PATIO', tipo: 'puerta', entre: ['R-LIV'], lado: 'N', w: 1800, h: 2100, en: 0.5, ajustar: true, patio: true },
      { id: 'V-COC', tipo: 'ventana', entre: ['R-COC'], lado: 'N', w: 1500, h: 1200, ant: 1000, en: 0.5, patio: true },
      { id: 'V-COC-O', tipo: 'ventana', entre: ['R-COC'], lado: 'O', w: 1200, h: 1200, ant: 1000, en: 0.5 },
      { id: 'V-PAS-E', tipo: 'ventana', entre: ['R-PAS-E'], lado: 'E', w: 1200, h: 1200, ant: 900, en: 0.5 },
      { id: 'V-PAS-N', tipo: 'ventana', entre: ['R-PAS'], lado: 'S', w: 1500, h: 1200, ant: 900, en: 0.35, patio: true },
      ...items.filter((i) => i.tipo !== 'bano' || i.id === 'R-BC').flatMap((i) => [{ id: `P-${i.id}`, tipo: 'puerta', entre: [i.id, 'R-PAS'], w: i.tipo === 'bano' ? 700 : 800, h: 2100, en: 0.5, abre: i.id }, { id: `V-${i.id}`, tipo: 'ventana', entre: [i.id], lado: 'N', w: i.tipo === 'bano' ? 600 : 1500, h: i.tipo === 'bano' ? 600 : 1200, ant: i.tipo === 'bano' ? 1500 : 900, en: 0.5 }]),
      ...(prog.banos >= 2 ? [{ id: 'P-BP', tipo: 'puerta', entre: ['R-DP', 'R-BP'], w: 700, h: 2100, en: 0.5, abre: 'R-BP' }, { id: 'V-BP', tipo: 'ventana', entre: ['R-BP'], lado: 'N', w: 600, h: 600, ant: 1500, en: 0.5 }] : []),
      ...(prog.cocina === 'cerrada' ? [{ id: 'P-COC', tipo: 'puerta', entre: ['R-LIV', 'R-COC'], w: 800, h: 2100, en: 0.5, abre: 'R-COC' }] : []),
    ].filter((o) => !(o.id === 'P-R-BP' || o.id === 'V-R-BP'));
    // el baño principal (R-BP) entra solo por el dormitorio principal
    const abiertas = [...(prog.cocina === 'americana' ? [['R-LIV', 'R-COC']] : [])];
    const conPasillo = new Set(['R-PAS-E']);
    void conPasillo;
    return { spaces, plan, abiertas: [...abiertas, ['R-PAS', 'R-PAS-E'], ['R-LIV', 'R-PAS-E']], ext: [{ id: 'patio', use: 'family', ring: patio }], patio, medida: { liv: [Ws - W_COC, ds] } };
  },
};

// ---------- colocación de aberturas a partir de los muros derivados ----------
function colocarAberturas(esqBase, geo, plan, notas) {
  const out = []; const margen = GENERALES.margen_abertura_a_esquina_mm;
  for (const a of plan) {
    const seg = a.entre.length === 2
      ? geo.murosSeg.filter((s) => s.tipo === 'int' && s.entre.includes(a.entre[0]) && s.entre.includes(a.entre[1]))
      : geo.murosSeg.filter((s) => s.tipo === 'ext' && s.recinto === a.entre[0] && s.lado === a.lado);
    const cand = seg.sort((p, q) => (q.hasta - q.desde) - (p.hasta - p.desde));
    let s = cand[0];
    if (a.patio && esqBase._patio) { const pb = esqBase._patio; const c2 = cand.find((c) => (c.orient === 'h' ? c.desde < pb.x1 && c.hasta > pb.x0 : c.desde < pb.y1 && c.hasta > pb.y0)); if (c2) s = c2; }
    if (!s) { notas.push(`Abertura ${a.id} omitida: ${a.entre.join('–')} no tiene muro ${a.lado ? `exterior ${a.lado}` : 'compartido'}.`); continue; }
    let desde = s.desde; let hasta = s.hasta;
    if (a.patio && esqBase._patio) { const pb = esqBase._patio; if (s.orient === 'h') { desde = Math.max(desde, pb.x0); hasta = Math.min(hasta, pb.x1); } else { desde = Math.max(desde, pb.y0); hasta = Math.min(hasta, pb.y1); } }
    const len = hasta - desde; let w = a.w;
    if (len < w + 2 * margen) { if (a.ajustar || a.tipo === 'ventana') w = Math.floor((len - 2 * margen) / 100) * 100; if (w < (a.tipo === 'ventana' ? 500 : 700)) { notas.push(`Abertura ${a.id} omitida: el muro de ${len} mm es corto.`); continue; } }
    let c;
    if (typeof a.en === 'number' && a.en <= 1) c = desde + len * a.en; else c = a.desde === 'fin' ? hasta - a.en : desde + a.en;
    c = Math.min(Math.max(c, desde + margen + w / 2), hasta - margen - w / 2); c = redondear(c, 10);
    const centro = s.orient === 'h' ? [c, s.fijo] : [s.fijo, c];
    out.push({ id: a.id, tipo: a.tipo, ...(a.funcion ? { funcion: a.funcion } : {}), ...(a.abre ? { abre_hacia: a.abre } : {}), entre: a.entre, ancho_mm: w, alto_mm: a.h, ...(a.tipo === 'ventana' ? { antepecho_mm: a.ant } : {}), centro, ...(a.lado ? { exterior_side: a.lado } : {}) });
  }
  return out;
}

// ---------- simetrías del cuadrado ----------
const DIRS = { S: [0, -1], N: [0, 1], E: [1, 0], O: [-1, 0] }; const NOMBRE_DIR = (v) => Object.entries(DIRS).find(([, d]) => d[0] === v[0] && d[1] === v[1])[0];
export function transformarEsquema(esq, k) { // k 0..7: bit 2 = espejo en X, bits 0-1 = giros de 90° antihorarios
  const rot = k & 3; const esp = (k & 4) !== 0;
  const f = ([x, y]) => { let p = esp ? [-x, y] : [x, y]; for (let i = 0; i < rot; i++) p = [-p[1], p[0]]; return p; };
  const fd = (v) => { let p = esp ? [-v[0], v[1]] : v; for (let i = 0; i < rot; i++) p = [-p[1], p[0]]; return p; };
  const anillo = (r) => r.map(f);
  const pts = esq.spaces.flatMap((s) => anillo(s.ring)); const mx = Math.min(...pts.map((p) => p[0])); const my = Math.min(...pts.map((p) => p[1]));
  const g = ([x, y]) => { const [a, b] = f([x, y]); return [a - mx, b - my]; };
  const ga = (r) => { const q = r.map(g); return q; };
  const out = JSON.parse(JSON.stringify(esq));
  out.spaces = esq.spaces.map((s) => ({ ...s, ring: ga(s.ring) })); out.open_courts_mm = esq.open_courts_mm.map(ga);
  out.openings = esq.openings.map((o) => ({ ...o, centro: g(o.centro), ...(o.exterior_side ? { exterior_side: NOMBRE_DIR(fd(DIRS[o.exterior_side])) } : {}) }));
  out.exterior_areas = (esq.exterior_areas || []).map((e) => ({ ...e, ...(e.ring ? { ring: ga(e.ring) } : {}) }));
  out.footprint_polygons_mm = huellaDeEspacios(out.spaces);
  return out;
}

// ---------- ensamblado y ajuste de superficie ----------
function ensamblar(concepto, prog, p, ctx) {
  const lay = LAYOUTS[concepto](prog, p); const sis = SISTEMAS[prog.sistema];
  const base = {
    schema: SCHEMA_IDS.scheme, id: ctx.id, brief_ref: ctx.briefRef, site_ref: ctx.siteRef ?? null, engine_version: VERSION_MOTOR, concept: concepto, rationale: '',
    footprint_polygons_mm: huellaDeEspacios(lay.spaces), open_courts_mm: [], espesores_mm: { ext: sis.espesor_muro_ext_mm, int: sis.espesor_muro_int_mm }, altura_piso_cielo_mm: GENERALES.altura_piso_cielo_mm,
    spaces: lay.spaces, openings: [], exterior_areas: lay.ext, separaciones_abiertas: lay.abiertas, adjacencies: [], line_of_sight_goals: [], sources: [], model_status: 'concept',
  };
  if (lay.patio) { base._patio = { x0: Math.min(...lay.patio.map((q) => q[0])), x1: Math.max(...lay.patio.map((q) => q[0])), y0: Math.min(...lay.patio.map((q) => q[1])), y1: Math.max(...lay.patio.map((q) => q[1])) }; }
  const geo0 = derivarEsquema(base); const notas = [];
  const ab = colocarAberturas(base, geo0, lay.plan, notas); delete base._patio; base.openings = ab;
  return { esq: base, notas, medida: lay.medida, lay };
}

function ajustar(concepto, prog, ctx) {
  const objetivo = prog.superficie_m2; const resultado = (p) => { const r = ensamblar(concepto, prog, p, ctx); const g = derivarEsquema(r.esq); return { ...r, geo: g, area: g.huella.area_m2 }; };
  let ultimo = null;
  for (const d of [0, 200, 400, 600, 800, 1000, 1400, 1800, 2400]) {
    const r0 = resultado({ s: 0, d });
    let r = r0;
    if (r0.area < objetivo * (1 - FACTOR_TOL)) { // buscar s por bisección (área creciente con s)
      let lo = 0; let hi = 40000; let mejor = null;
      for (let it = 0; it < 24; it++) { const mid = redondear((lo + hi) / 2); const rm = resultado({ s: mid, d }); if (rm.area < objetivo) lo = mid; else { hi = mid; mejor = rm; } if (hi - lo <= 50) break; }
      r = mejor ?? resultado({ s: hi, d });
    }
    ultimo = { ...r, d };
    const [lw, ld] = r.medida.liv; const razon = Math.max(lw, ld) / Math.min(lw, ld);
    if (razon <= 2.3 && Math.abs(r.area - objetivo) / objetivo <= FACTOR_TOL + 0.02) return { ...r, d };
    if (r0.area > objetivo * (1 + FACTOR_TOL)) break; // ya el mínimo excede lo pedido
  }
  return ultimo;
}

/**
 * Genera el partido `concepto`. Devuelve { factible, esquema, geo, supuestos, motivo } sin lanzar por falta de factibilidad.
 * @param ctx {id, briefRef, siteRef, simetria}
 */
export function generarPartido(concepto, programaEntrada, ctx = {}) {
  if (!LAYOUTS[concepto]) throw new UserError('PARTIDO_NO_SOPORTADO', `Partido no soportado: ${concepto}. Opciones: ${Object.keys(LAYOUTS).join(', ')}.`);
  const { programa, supuestos } = normalizarProgramaArq(programaEntrada);
  const id = ctx.id ?? `alt-${concepto}`; const c = { id, briefRef: ctx.briefRef ?? 'sin-brief', siteRef: ctx.siteRef ?? null };
  const r = ajustar(concepto, programa, c);
  const notas = [...supuestos, ...r.notas];
  const desv = (r.area - programa.superficie_m2) / programa.superficie_m2;
  if (desv > FACTOR_TOL) notas.push(`Con los recintos mínimos este partido ocupa ${r.area.toFixed(1)} m² (más de lo pedido, ${programa.superficie_m2} m²): se entrega con ese mínimo, no con la superficie objetivo.`);
  let esq = r.esq; let geo = r.geo;
  const k = ctx.simetria ?? 0; if (k) { esq = transformarEsquema(esq, k); geo = derivarEsquema(esq); }
  esq.rationale = MOTIVOS[concepto];
  if (geo.errores.length) return { factible: false, concepto, motivo: geo.errores.map((e) => e.mensaje).join(' | '), esquema: esq, geo, supuestos: notas };
  return { factible: true, concepto, esquema: esq, geo, supuestos: notas, area_m2: geo.huella.area_m2, desviacion_pct: Math.round(desv * 1000) / 10, simetria: k };
}

export const MOTIVOS = {
  compacta: 'Volumen rectangular compacto: franja de día al frente, pasillo y franja de noche al fondo. Menor perímetro y cubierta simple (más económico de envolver), pero sin patio propio y con zonas de día y noche separadas solo por un pasillo.',
  L_con_patio: 'Dos alas en L que abrazan un patio de uso diario: el living y la cocina se abren al patio y los dormitorios quedan en el ala larga, apartados del frente. Gana relación interior–exterior y separación de zonas; pierde en perímetro exterior, encuentros de cubierta y complejidad constructiva.',
  dos_alas: 'Dos alas paralelas (día al sur, noche al norte) unidas por un conector, con un patio entre ellas abierto a un costado: mayor separación día/noche y patio protegido por tres lados, a costa de más perímetro, más pasillos y más superficie de circulación.',
};
export const CONCEPTOS_GENERABLES = Object.keys(LAYOUTS);
