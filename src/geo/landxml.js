// Importador LandXML (alineamientos, perfiles y superficies) con REPORTE DE PÉRDIDAS: lo no soportado se declara, nunca se descarta en silencio.
// Seguridad: se rechazan DOCTYPE/ENTITY (sin expansión de entidades) y archivos excesivos.
import { GeoError } from './geom.js';
export const MAX_LANDXML = 20 * 1024 * 1024;

function parsear(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new GeoError('XML_PELIGROSO', 'El LandXML contiene DOCTYPE/ENTITY: se rechaza por seguridad.');
  const raiz = { n: '#', a: {}, h: [], t: '' }; const pila = [raiz]; const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g; let m;
  while ((m = re.exec(xml))) {
    if (m[5] !== undefined) { pila.at(-1).t += m[5]; continue; } if (m[2] === undefined) continue;
    if (m[1]) { if (pila.length > 1) pila.pop(); continue; }
    const a = {}; for (const q of (m[3] || '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[q[1]] = q[2] ?? q[3];
    const nodo = { n: m[2].replace(/^.*:/, ''), a, h: [], t: '' }; pila.at(-1).h.push(nodo); if (!m[4]) pila.push(nodo);
  }
  return raiz;
}
const hijos = (n, nombre) => n.h.filter((x) => x.n === nombre); const uno = (n, nombre) => n.h.find((x) => x.n === nombre);
const nums = (t) => t.trim().split(/\s+/).map(Number);

export function importarLandXml(xml) {
  if (Buffer.byteLength(xml) > MAX_LANDXML) throw new GeoError('ARCHIVO_DEMASIADO_GRANDE', 'LandXML demasiado grande.');
  const raiz = parsear(xml); const lx = raiz.h.find((x) => x.n === 'LandXML'); if (!lx) throw new GeoError('NO_ES_LANDXML', 'El archivo no es un LandXML válido.');
  const out = { unidades: null, alineamientos: [], superficies: [], perfiles: [], no_soportado: [], advertencias: [] };
  const u = uno(lx, 'Units'); const met = u && uno(u, 'Metric'); out.unidades = met ? { sistema: 'metrico', longitud: met.a.linearUnit || 'meter' } : u ? { sistema: 'otro', longitud: 'no_metrica' } : { sistema: 'no_declarado', longitud: null };
  if (out.unidades.sistema !== 'metrico' || (out.unidades.longitud && out.unidades.longitud !== 'meter')) out.advertencias.push('Unidades no métricas o no declaradas: confirme la unidad antes de calcular (no se convierte automáticamente).');
  for (const al of hijos(uno(lx, 'Alignments') || { h: [] }, 'Alignment')) {
    const cg = uno(al, 'CoordGeom'); const tramos = []; const adv = []; let inicio = null; let prevEnd = null; let prevH = null;
    if (!cg) { out.no_soportado.push({ elemento: `Alignment ${al.a.name}`, motivo: 'sin CoordGeom' }); continue; }
    for (const el of cg.h) {
      const pt = (nombre) => { const q = uno(el, nombre); return q ? nums(q.t) : null; }; const s = pt('Start'); const e = pt('End');       // LandXML: norte(y) este(x)
      if (el.n === 'Line' && s && e) { const [y0, x0] = s; const [y1, x1] = e; const L = Math.hypot(x1 - x0, y1 - y0); const h = Math.atan2(y1 - y0, x1 - x0); if (!inicio) inicio = { x: x0, y: y0, azimut_deg: (h * 180) / Math.PI, progresiva: Number(al.a.staStart || 0) }; else if (Math.hypot(x0 - prevEnd[0], y0 - prevEnd[1]) > 0.01) adv.push(`Discontinuidad antes de una recta (${Math.hypot(x0 - prevEnd[0], y0 - prevEnd[1]).toFixed(3)} m).`); tramos.push({ type: 'straight', length: L }); prevEnd = [x1, y1]; prevH = h; }
      else if (el.n === 'Curve' && s && e) { const c = pt('Center'); const R = Number(el.a.radius); const [y0, x0] = s; const [y1, x1] = e; const k = el.a.rot === 'cw' ? -1 : 1; if (!c || !(R > 0)) { out.no_soportado.push({ elemento: `Curve en ${al.a.name}`, motivo: 'sin centro o radio' }); continue; } const [cy, cx] = c; let a0 = Math.atan2(y0 - cy, x0 - cx); let a1 = Math.atan2(y1 - cy, x1 - cx); let d = k > 0 ? a1 - a0 : a0 - a1; while (d <= 0) d += 2 * Math.PI; const th = d; if (Math.abs(Math.hypot(x0 - cx, y0 - cy) - R) > 0.01) adv.push('El radio declarado no coincide con la geometría de la curva.'); if (!inicio) inicio = { x: x0, y: y0, azimut_deg: ((a0 + k * Math.PI / 2) * 180) / Math.PI, progresiva: Number(al.a.staStart || 0) }; tramos.push({ type: 'arc', radius: R, angle_deg: (th * 180) / Math.PI, turn: k > 0 ? 'left' : 'right' }); prevEnd = [x1, y1]; }
      else out.no_soportado.push({ elemento: `${el.n} en alineamiento ${al.a.name || ''}`, motivo: el.n === 'Spiral' ? 'clotoides no soportadas en esta versión: el alineamiento se importa INCOMPLETO' : 'elemento no soportado' });
    }
    const incompleto = out.no_soportado.some((x) => x.elemento.includes(al.a.name || '') && /Spiral/.test(x.elemento)); if (incompleto) adv.push('Alineamiento incompleto por elementos no soportados: NO usar para cálculos.');
    if (tramos.length) out.alineamientos.push({ nombre: al.a.name || 'sin_nombre', tramos, inicio, largo_declarado: al.a.length ? Number(al.a.length) : null, advertencias: adv, utilizable: !incompleto });
    for (const pa of hijos(al, 'Profile')) for (const pf of hijos(pa, 'ProfAlign')) { const pivs = hijos(pf, 'PVI').map((p) => { const [s, z] = nums(p.t); return { s, z }; }); const cur = hijos(pf, 'CircCurve').concat(hijos(pf, 'ParaCurve')); if (pivs.length >= 2) out.perfiles.push({ alineamiento: al.a.name || null, nombre: pf.a.name || null, pivs, curvas_ignoradas: cur.length }); if (cur.length) out.advertencias.push(`Perfil ${pf.a.name || ''}: ${cur.length} curva(s) vertical(es) declarada(s) no importadas (se usan solo los PIV; defina la longitud de curva en cada PIV).`); }
  }
  for (const sf of hijos(uno(lx, 'Surfaces') || { h: [] }, 'Surface')) { const def = uno(sf, 'Definition'); if (!def) continue; const pn = uno(def, 'Pnts'); if (!pn) continue; const pts = hijos(pn, 'P').map((p) => { const [y, x, z] = nums(p.t); return [x, y, z]; }); out.superficies.push({ nombre: sf.a.name || 'sin_nombre', puntos: pts, caras_declaradas: hijos(uno(def, 'Faces') || { h: [] }, 'F').length }); }
  for (const n of ['Parcels', 'PlanFeatures', 'Roadways', 'Pipe', 'Structures']) if (uno(lx, n)) out.no_soportado.push({ elemento: n, motivo: 'fuera del alcance geométrico actual' });
  return out;
}
