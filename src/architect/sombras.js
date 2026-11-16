// Sol directo por ray casting contra la escena 3D (muros, losas, cubierta, aleros, obstáculos de contexto con altura conocida).
// Mide LUZ SOLAR DIRECTA geométrica (horas con el sol visible desde el punto): NO es iluminancia interior, deslumbramiento, energía ni confort.
import { UserError } from '../mcp/util.js';
import { construirPrimitivas } from '../arq3d/geometria.js';
import { esquemaA3d } from './a3d.js';
import { muestrasDia, vectorSolLocal } from './solar.js';
import { rectDeAnillo, bbox } from './poligonos.js';

const NORMAL = { S: [0, -1], N: [0, 1], E: [1, 0], O: [-1, 0] };

/** Cajas AABB de la escena. `incierto` lista causas que vuelven no concluyente la sombra de contexto. */
export function escena(esq, geo, { sitio = null, aleros = [], cubierta = true } = {}) {
  const m = esquemaA3d(esq, geo, { cubierta: cubierta ? undefined : null });
  const p = construirPrimitivas(m);
  const cajas = p.primitivas.filter((q) => q.tipo === 'caja' && !q.rot_deg).map((q) => ({ x0: q.esperado.bbox_min[0], y0: q.esperado.bbox_min[1], z0: q.esperado.bbox_min[2], x1: q.esperado.bbox_max[0], y1: q.esperado.bbox_max[1], z1: q.esperado.bbox_max[2], origen: q.clase }));
  const incierto = [];
  const H = esq.altura_piso_cielo_mm;
  for (const a of aleros) { const c = caja_alero(a, geo, H); if (c) cajas.push(c); }
  for (const o of sitio?.context_obstacles ?? []) {
    if (o.height_mm == null) { incierto.push(`El obstáculo ${o.id} no tiene altura conocida: la sombra de contexto no es concluyente.`); continue; }
    const b = bbox([o.ring]); cajas.push({ x0: b.x0, y0: b.y0, z0: 0, x1: b.x1, y1: b.y1, z1: o.height_mm, origen: `contexto:${o.id}` });
  }
  for (const v of sitio?.vegetation ?? []) {
    if (v.height_mm == null) { incierto.push(`La vegetación ${v.id} no tiene altura conocida: se excluye y la sombra es no concluyente.`); continue; }
    if (v.deciduous === null) incierto.push(`La vegetación ${v.id}: se desconoce si es caduca; se modela como opaca.`);
    cajas.push({ x0: v.x_mm - v.radius_mm, y0: v.y_mm - v.radius_mm, z0: 0, x1: v.x_mm + v.radius_mm, y1: v.y_mm + v.radius_mm, z1: v.height_mm, origen: `vegetacion:${v.id}` });
  }
  return { cajas, incierto, altura_muro_mm: H };
}

/** Alero: { fachada: 'seg-id' | { recinto, lado }, profundidad_mm, margen_mm?, espesor_mm? } sobre el borde superior del muro. */
function caja_alero(a, geo, H) {
  const seg = typeof a.fachada === 'string' ? geo.murosSeg.find((s) => s.id === a.fachada) : geo.murosSeg.find((s) => s.tipo === 'ext' && s.recinto === a.fachada.recinto && s.lado === a.fachada.lado);
  if (!seg || seg.tipo !== 'ext') throw new UserError('ALERO_SIN_FACHADA', 'El alero debe apoyarse en un muro exterior existente.');
  const n = NORMAL[seg.lado]; const d = a.profundidad_mm; const mg = a.margen_mm ?? 300; const e = a.espesor_mm ?? 120; const z0 = H; const z1 = H + e; const t = seg.espesor / 2;
  if (seg.orient === 'h') { const y0 = n[1] > 0 ? seg.fijo + t : seg.fijo - t - d; return { x0: seg.desde - mg, x1: seg.hasta + mg, y0, y1: y0 + d + (n[1] > 0 ? 0 : 0), z0, z1, origen: 'alero' }; }
  const x0 = n[0] > 0 ? seg.fijo + t : seg.fijo - t - d; return { x0, x1: x0 + d, y0: seg.desde - mg, y1: seg.hasta + mg, z0, z1, origen: 'alero' };
}

/** ¿El rayo desde `o` hacia `dir` (vector unitario) choca con alguna caja? */
export function rayoGolpea(o, dir, cajas, { tmax = 1e7 } = {}) {
  for (const c of cajas) {
    let tmin = 1e-3; let tM = tmax; let ok = true;
    for (const [k, lo, hi] of [[0, c.x0, c.x1], [1, c.y0, c.y1], [2, c.z0, c.z1]]) {
      const d = dir[k]; const p = o[k];
      if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) { ok = false; break; } continue; }
      let t1 = (lo - p) / d; let t2 = (hi - p) / d; if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tM = Math.min(tM, t2); if (tmin > tM) { ok = false; break; }
    }
    if (ok) return c;
  }
  return null;
}

function muestras(site, fecha, pasoMin) {
  return muestrasDia({ fecha, lat: site.coordinates.lat, lon: site.coordinates.lon, zona: site.timezone, pasoMin });
}
export function sitioApto(sitio) {
  const f = [];
  if (!sitio?.coordinates || sitio.coordinates.status !== 'confirmed') f.push('coordenadas confirmadas');
  if (!sitio?.timezone) f.push('zona horaria IANA');
  const n = sitio?.true_north_deg_from_local_plus_y_clockwise; if (!n || n.estado !== 'confirmed') f.push('norte verdadero confirmado');
  return f;
}

function ventanasExpuestas(esq, geo) {
  const out = [];
  for (const a of geo.aberturas.filter((x) => !x.invalida && x.ext && (x.tipo === 'ventana' || (x.tipo === 'puerta' && x.funcion !== 'acceso')))) {
    const seg = geo.murosSeg.find((s) => s.id === a.segmento); const n = NORMAL[seg.lado]; const zc = (a.tipo === 'ventana' ? (a.antepecho_mm ?? 900) : 0) + a.alto_mm / 2;
    const t = seg.espesor / 2 + 40; const c = a.orient === 'h' ? [a.centro, a.fijo] : [a.fijo, a.centro];
    out.push({ id: a.id, recinto: seg.recinto, lado: seg.lado, tipo: a.tipo, normal: n, punto: [c[0] + n[0] * t, c[1] + n[1] * t, zc] });
  }
  return out;
}

/** Horas de sol directo sobre cada ventana exterior en una fecha. */
export function horasSolVentanas({ esq, geo, sitio, fecha, aleros = [], pasoMin = 15, hipotesis = null }) {
  const s = hipotesis ?? sitio; const falt = hipotesis ? [] : sitioApto(sitio);
  if (falt.length) return { estado: 'no_concluyente', razon: `Falta ${falt.join(', ')}: sin esos datos no se afirman horas de sol reales.`, faltantes: falt, ventanas: [] };
  const norte = hipotesis ? hipotesis.norte_deg : sitio.true_north_deg_from_local_plus_y_clockwise.valor;
  const e = escena(esq, geo, { sitio, aleros }); const sol = muestras(hipotesis ? { coordinates: { lat: hipotesis.lat, lon: hipotesis.lon }, timezone: hipotesis.zona } : s, fecha, pasoMin);
  const ventanas = ventanasExpuestas(esq, geo).map((v) => {
    let lit = 0; let cara = 0;
    for (const m of sol) { const d = vectorSolLocal(m.azimut_deg, m.elevacion_aparente_deg, norte); if (d[0] * v.normal[0] + d[1] * v.normal[1] <= 1e-6) continue; cara++; if (!rayoGolpea(v.punto, d, e.cajas)) lit++; }
    return { id: v.id, recinto: v.recinto, lado: v.lado, horas_sol_directo: Math.round((lit * pasoMin) / 6) / 10, horas_con_cara_al_sol: Math.round((cara * pasoMin) / 6) / 10 };
  });
  return { estado: e.incierto.length ? 'no_concluyente_contexto' : hipotesis ? 'hipotesis_no_real' : 'calculado', ...(e.incierto.length ? { razon_contexto: e.incierto } : {}), fecha, paso_min: pasoMin, norte_deg: norte, ventanas, metodo: 'ray casting desde el centro de cada vano hacia el sol (posición solar propia contrastada con NREL SPA)', limites: 'Luz solar directa geométrica; no es iluminancia interior, deslumbramiento, ganancia térmica ni energía.' };
}

/** Horas de sol directo del patio (rejilla de puntos al nivel del suelo). */
export function horasSolPatio({ esq, geo, sitio, fecha, pasoMin = 30, paso_rejilla_mm = 500 }) {
  const falt = sitioApto(sitio); const patio = esq.exterior_areas.find((x) => x.id === 'patio' && x.ring);
  if (!patio) return { estado: 'no_aplica', razon: 'El partido no tiene patio.' };
  if (falt.length) return { estado: 'no_concluyente', razon: `Falta ${falt.join(', ')}.`, faltantes: falt };
  const norte = sitio.true_north_deg_from_local_plus_y_clockwise.valor; const e = escena(esq, geo, { sitio }); const sol = muestras(sitio, fecha, pasoMin); const b = bbox([patio.ring]);
  let n = 0; let suma = 0; let min = Infinity; let max = 0;
  for (let x = b.x0 + paso_rejilla_mm / 2; x < b.x1; x += paso_rejilla_mm) for (let y = b.y0 + paso_rejilla_mm / 2; y < b.y1; y += paso_rejilla_mm) {
    let lit = 0; for (const m of sol) { const d = vectorSolLocal(m.azimut_deg, m.elevacion_aparente_deg, norte); if (!rayoGolpea([x, y, 50], d, e.cajas)) lit++; }
    const h = (lit * pasoMin) / 60; suma += h; n++; min = Math.min(min, h); max = Math.max(max, h);
  }
  return { estado: e.incierto.length ? 'no_concluyente_contexto' : 'calculado', fecha, puntos: n, horas_media: Math.round((suma / n) * 10) / 10, horas_min: Math.round(min * 10) / 10, horas_max: Math.round(max * 10) / 10, ...(e.incierto.length ? { razon_contexto: e.incierto } : {}), limites: 'Sol directo sobre el suelo del patio; no considera vegetación caduca ni nubosidad.' };
}

/** Estudio de aleros: profundidades candidatas sobre una fachada, verano (diciembre/junio según hemisferio) vs invierno. */
export function estudioAlero({ esq, geo, sitio, fachada, profundidades = [0, 300, 600, 900, 1200], pasoMin = 15 }) {
  const falt = sitioApto(sitio); if (falt.length) return { estado: 'no_concluyente', razon: `Falta ${falt.join(', ')}: no se dimensiona alero sin sol real.`, faltantes: falt };
  const sur = sitio.coordinates.lat < 0; const fechaVerano = sur ? '2026-12-21' : '2026-06-21'; const fechaInvierno = sur ? '2026-06-21' : '2026-12-21';
  const filas = [];
  for (const d of profundidades) {
    const aleros = d > 0 ? [{ fachada, profundidad_mm: d }] : [];
    const v = horasSolVentanas({ esq, geo, sitio, fecha: fechaVerano, aleros, pasoMin }); const i = horasSolVentanas({ esq, geo, sitio, fecha: fechaInvierno, aleros, pasoMin });
    const sel = (r) => r.ventanas.filter((x) => (typeof fachada === 'object' ? x.recinto === fachada.recinto && x.lado === fachada.lado : true));
    const suma = (r) => Math.round(sel(r).reduce((a, x) => a + x.horas_sol_directo, 0) * 10) / 10;
    filas.push({ profundidad_mm: d, horas_verano: suma(v), horas_invierno: suma(i) });
  }
  const base = filas[0]; const conAlero = filas.slice(1);
  const mejor = conAlero.find((f) => base.horas_verano > 0 && f.horas_verano <= base.horas_verano * 0.5 && f.horas_invierno >= base.horas_invierno * 0.8);
  return { estado: 'calculado', fecha_verano: fechaVerano, fecha_invierno: fechaInvierno, filas, recomendacion: mejor ? { profundidad_mm: mejor.profundidad_mm, motivo: 'Reduce ≥50 % el sol directo de verano conservando ≥80 % del de invierno en las ventanas de esa fachada.' } : { profundidad_mm: null, motivo: base.horas_verano === 0 ? 'La fachada no recibe sol directo en verano: el alero no aporta.' : 'Ninguna profundidad probada logra el compromiso (≥50 % menos en verano y ≥80 % del invierno).' },
    limites: 'Compara sol directo geométrico; no equivale a confort térmico ni a ahorro energético. Fijaciones, carga de viento y mantención son de proyecto.', metodo: 'ray casting, paso de muestreo declarado (el muestreo insuficiente no equivale a certeza)' };
}
export { rectDeAnillo };
