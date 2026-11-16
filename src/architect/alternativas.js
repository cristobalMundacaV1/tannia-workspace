// Generación de alternativas: determinista (mismo encargo + predio + norte + semilla ⇒ mismas opciones), con orientación y encaje en el predio.
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { generarPartido, CONCEPTOS_GENERABLES, transformarEsquema, ACCESO_CANONICO } from './partidos.js';
import { derivarEsquema, huellaDeEspacios } from './derivar_poly.js';
import { conjuntoDiverso } from './diversidad.js';
import { enPoligono, segmentosSeCruzan, bbox } from './poligonos.js';
import { VERSION_MOTOR } from './version.js';

const DIR = { S: [0, -1], N: [0, 1], E: [1, 0], O: [-1, 0] };
const hashDe = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

/** ¿A qué lado queda el acceso canónico (S) tras la simetría k? */
function ladoAcceso(k, canon = 'S') { let p = [...DIR[canon]]; if (k & 4) p = [-p[0], p[1]]; for (let i = 0; i < (k & 3); i++) p = [-p[1], p[0]]; return Object.entries(DIR).find(([, d]) => d[0] === p[0] && d[1] === p[1])[0]; }

export function desplazarEsquema(esq, dx, dy) {
  const o = JSON.parse(JSON.stringify(esq)); const m = ([x, y]) => [x + dx, y + dy];
  o.spaces.forEach((s) => { s.ring = s.ring.map(m); }); o.footprint_polygons_mm = o.footprint_polygons_mm.map((r) => r.map(m)); o.open_courts_mm = o.open_courts_mm.map((r) => r.map(m));
  o.openings.forEach((a) => { a.centro = m(a.centro); }); o.exterior_areas.forEach((e) => { if (e.ring) e.ring = e.ring.map(m); });
  return o;
}

/** ¿Cabe la huella exterior en el predio (polígono) con retranqueos confirmados? Devuelve {cabe, motivo}. */
export function cabeEnPredio(geo, parcela, retranqueos = {}) {
  const ext = geo.huella.anillos.filter((a) => !a.hueco).map((a) => a.ring);
  const P = parcela.ring; const pb = bbox([P]);
  const inset = { S: retranqueos.S ?? 0, N: retranqueos.N ?? 0, E: retranqueos.E ?? 0, O: retranqueos.O ?? 0 };
  for (const r of ext) for (const [x, y] of r) {
    if (!enPoligono(x, y, P) && !puntoEnBorde(x, y, P)) return { cabe: false, motivo: `La huella sale del predio en (${x}, ${y}).` };
    if (x < pb.x0 + inset.O - 1e-6 || x > pb.x1 - inset.E + 1e-6 || y < pb.y0 + inset.S - 1e-6 || y > pb.y1 - inset.N + 1e-6) return { cabe: false, motivo: 'La huella invade un retranqueo confirmado.' };
  }
  for (const r of ext) for (let i = 0; i < r.length; i++) for (let j = 0; j < P.length; j++) { if (cruzaPropio(r[i], r[(i + 1) % r.length], P[j], P[(j + 1) % P.length])) return { cabe: false, motivo: 'La huella cruza un deslinde.' }; }
  return { cabe: true };
}
/** Las zonas exteriores propias del partido (patio/jardín) también deben caber en el predio. */
export function exterioresDentro(esq, parcela) { for (const a of esq.exterior_areas ?? []) for (const [x, y] of a.ring ?? []) if (!enPoligono(x, y, parcela.ring) && !puntoEnBorde(x, y, parcela.ring)) return { cabe: false, motivo: `La zona exterior «${a.id}» del partido sale del predio en (${x}, ${y}).` }; return { cabe: true }; }
const puntoEnBorde = (x, y, P) => P.some((a, i) => { const b = P[(i + 1) % P.length]; return (a[0] === b[0] && x === a[0] && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1])) || (a[1] === b[1] && y === a[1] && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0])); });
const cruzaPropio = (p1, p2, p3, p4) => segmentosSeCruzan(p1, p2, p3, p4) && !(puntoEnBorde(p1[0], p1[1], [p3, p4]) && puntoEnBorde(p2[0], p2[1], [p3, p4])) && propioCruce(p1, p2, p3, p4);
function propioCruce(p1, p2, p3, p4) { // cruce transversal estricto (no solo tocar)
  const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
}

/**
 * @param entrada { programa, predio:{ring}|null, acceso:'S'|'N'|'E'|'O'|null, norte_deg:number|null (true_north_deg_from_local_plus_y_clockwise), hemisferio:'S'|'N'|null,
 *                  retranqueos:{S,N,E,O}|{}, conceptos:string[], semilla:number, briefRef, siteRef, preferirPatioAlNorte:boolean }
 */
export function generarAlternativas(entrada) {
  const conceptos = entrada.conceptos?.length ? entrada.conceptos : CONCEPTOS_GENERABLES;
  const salida = []; const descartadas = [];
  for (const c of conceptos) {
    const ks = [0, 1, 2, 3, 4, 5, 6, 7];
    const cands = [];
    for (const k of ks) {
      if (entrada.acceso && ladoAcceso(k, ACCESO_CANONICO[c] ?? 'S') !== entrada.acceso) continue;
      let r; try { r = generarPartido(c, entrada.programa, { id: `alt-${c}`, briefRef: entrada.briefRef, siteRef: entrada.siteRef, simetria: k }); } catch (e) { if (e instanceof UserError) { descartadas.push({ concepto: c, motivo: e.message }); break; } throw e; }
      if (!r.factible) { if (k === 0 || (entrada.acceso && cands.length === 0)) descartadas.push({ concepto: c, motivo: r.motivo }); continue; }
      cands.push(r);
    }
    if (!cands.length) continue;
    // encaje en el predio y preferencia solar (centro del patio hacia el ecuador, si hay norte conocido)
    let mejor = null;
    for (const r of cands) {
      let esq = r.esquema; let geo = r.geo; let encaje = { cabe: null, motivo: 'Sin predio: no se verifica encaje.' };
      if (entrada.predio) {
        const hb = bbox([...geo.huella.anillos.filter((a) => !a.hueco).map((a) => a.ring), ...esq.exterior_areas.filter((a) => a.ring).map((a) => a.ring)]); const pb = bbox([entrada.predio.ring]); const rt = entrada.retranqueos ?? {};
        const dx = Math.round((pb.x0 + pb.x1) / 2 - (hb.x0 + hb.x1) / 2 / 1); const dxc = dx - Math.round((hb.x0 + hb.x1) / 2 - 0) + Math.round((hb.x0 + hb.x1) / 2);
        void dxc;
        const cx = Math.round(((pb.x0 + pb.x1) - (hb.x0 + hb.x1)) / 2 / 50) * 50; const lado = entrada.acceso;
        const cy = lado === 'N' ? pb.y1 - (rt.N ?? 0) - hb.y1 : pb.y0 + (rt.S ?? 0) - hb.y0;
        esq = desplazarEsquema(esq, cx, lado === 'S' || lado === 'N' || !lado ? Math.round(cy / 50) * 50 : Math.round(((pb.y0 + pb.y1) - (hb.y0 + hb.y1)) / 2 / 50) * 50);
        if (lado === 'E') esq = desplazarEsquema(esq, Math.round((pb.x1 - (rt.E ?? 0) - hb.x1 - cx) / 50) * 50, 0); else if (lado === 'O') esq = desplazarEsquema(esq, Math.round((pb.x0 + (rt.O ?? 0) - hb.x0 - cx) / 50) * 50, 0);
        esq.footprint_polygons_mm = huellaDeEspacios(esq.spaces); geo = derivarEsquema(esq); encaje = cabeEnPredio(geo, entrada.predio, entrada.retranqueos); if (encaje.cabe) encaje = exterioresDentro(esq, entrada.predio);
        if (!encaje.cabe) continue;
      }
      let sol = 0;
      const patio = esq.exterior_areas.find((e) => e.id === 'patio');
      if (patio && entrada.norte_deg != null && entrada.preferirPatioAlNorte !== false) {
        const bb = bbox(geo.huella.anillos.filter((a) => !a.hueco).map((a) => a.ring)); const pc = bbox([patio.ring]);
        const v = [(pc.x0 + pc.x1) / 2 - (bb.x0 + bb.x1) / 2, (pc.y0 + pc.y1) / 2 - (bb.y0 + bb.y1) / 2]; const a = (entrada.norte_deg * Math.PI) / 180; // norte verdadero en ejes locales
        const nv = [Math.sin(a), Math.cos(a)]; const dot = (v[0] * nv[0] + v[1] * nv[1]); sol = entrada.hemisferio === 'N' ? -dot : dot;
      }
      const cand = { ...r, esquema: esq, geo, encaje, puntaje_orientacion: sol };
      if (!mejor || cand.puntaje_orientacion > mejor.puntaje_orientacion + 1e-9) mejor = cand;
    }
    if (!mejor) { descartadas.push({ concepto: c, motivo: 'No cabe en el predio con el acceso indicado en ninguna orientación.' }); continue; }
    mejor.esquema.id = `alt-${c}`; mejor.esquema.engine_version = VERSION_MOTOR; mejor.esquema.line_of_sight_goals = (entrada.vistas ?? []).map((v, i) => ({ id: `vista${i + 1}`, from: v.from, to: v.to }));
    salida.push(mejor);
  }
  // orden determinista por semilla (rota el orden de presentación; el contenido no cambia)
  const s = (entrada.semilla ?? 0) % Math.max(1, salida.length); const ordenadas = [...salida.slice(s), ...salida.slice(0, s)];
  const diversidad = ordenadas.length ? conjuntoDiverso(ordenadas.map((r) => ({ esquema: r.esquema, geo: r.geo }))) : null;
  const huella = hashDe({ p: entrada.programa, pr: entrada.predio, a: entrada.acceso, n: entrada.norte_deg, c: conceptos, s: entrada.semilla ?? 0, v: VERSION_MOTOR });
  return { alternativas: ordenadas, descartadas, diversidad, entrada_hash: huella, minimo_cumplido: ordenadas.length >= 3 && diversidad?.topologias_distintas >= 3, nota: ordenadas.length < 3 ? 'Menos de 3 alternativas factibles: ver `descartadas` para el motivo de cada una.' : null };
}
export { transformarEsquema };
