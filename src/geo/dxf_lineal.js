// Exportación DXF de infraestructura lineal: planta (eje + progresivas), perfil longitudinal (exageración vertical DECLARADA) y secciones transversales.
// Todo en metros (INSUNITS=6). La verificación se hace releyendo el DXF con el lector independiente del repositorio.
import { textoDxf } from '../design/salidas.js';
import { Alineamiento, Perfil, formatoProgresiva } from './lineal.js';
import { propiedades } from './geom.js';

const num = (x) => (Math.round(x * 1e6) / 1e6).toString();
export const CAPAS_LINEAL = { EJE: 1, PROGRESIVAS: 3, TERRENO: 8, RASANTE: 5, SECCION: 7, INTERIOR: 4, TEXTO: 2, CUADRICULA: 9 };

export function generarDxfLineal({ alineamiento, perfil = null, terreno = null, secciones = [], exageracion_vertical = 10, paso_progresivas = 20, titulo = 'Infraestructura lineal' }) {
  if (!(alineamiento instanceof Alineamiento)) throw new Error('alineamiento inválido');
  const ent = []; const E = (...pares) => { for (const [c, v] of pares) ent.push(`${c}\n${v}`); };
  const linea = (capa, x0, y0, x1, y1) => E([0, 'LINE'], [8, capa], [10, num(x0)], [20, num(y0)], [30, 0], [11, num(x1)], [21, num(y1)], [31, 0]);
  const texto = (capa, x, y, h, s, rot = 0) => E([0, 'TEXT'], [8, capa], [10, num(x)], [20, num(y)], [30, 0], [40, h], [1, textoDxf(s)], ...(rot ? [[50, num(rot)]] : []));
  const arco = (capa, cx, cy, r, a0, a1) => E([0, 'ARC'], [8, capa], [10, num(cx)], [20, num(cy)], [30, 0], [40, num(r)], [50, num(a0)], [51, num(a1)]);
  const poli = (capa, pts, cerrada) => { E([0, 'POLYLINE'], [8, capa], [66, 1], [70, cerrada ? 1 : 0]); for (const q of pts) E([0, 'VERTEX'], [8, capa], [10, num(q[0])], [20, num(q[1])], [30, 0], ...(q[2] ? [[42, num(q[2])]] : [])); E([0, 'SEQEND'], [8, capa]); };
  const deg = (r) => ((r * 180) / Math.PI + 360) % 360;
  const meta = { eje: { tramos: alineamiento.tramos.length, largo_m: alineamiento.largo }, secciones: [], perfil: null };
  // ---- Planta ----
  alineamiento.tramos.forEach((t) => { if (t.type === 'straight') linea('EJE', t.x0, t.y0, t.x1, t.y1); else { const a0 = deg(t.k > 0 ? t.h0 - Math.PI / 2 : t.h1 + Math.PI / 2); const a1 = deg(t.k > 0 ? t.h1 - Math.PI / 2 : t.h0 + Math.PI / 2); arco('EJE', t.cx, t.cy, t.R, a0, a1); } });
  const est = alineamiento.estaciones(paso_progresivas);
  for (const s of est) { const p = alineamiento.punto(s); const nx = -Math.sin(p.heading); const ny = Math.cos(p.heading); linea('PROGRESIVAS', p.x - 3 * nx, p.y - 3 * ny, p.x + 3 * nx, p.y + 3 * ny); texto('TEXTO', p.x + 4 * nx, p.y + 4 * ny, 2, formatoProgresiva(s), deg(p.heading)); }
  const xs = alineamiento.tramos.flatMap((t) => [t.x0, t.x1, ...(t.type === 'arc' ? [t.cx - t.R, t.cx + t.R] : [])]); const ys = alineamiento.tramos.flatMap((t) => [t.y0, t.y1, ...(t.type === 'arc' ? [t.cy - t.R, t.cy + t.R] : [])]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  texto('TEXTO', minX, maxY + 20, 4, `${titulo} — PLANTA (m)`); texto('TEXTO', minX, maxY + 14, 2.5, 'Documento generado por Tannia Workspace. Ingeniería asistida: requiere revisión de un profesional competente.');
  // ---- Perfil ----
  if (perfil instanceof Perfil) {
    const zs = []; const muestras = []; const paso = Math.max((alineamiento.largo) / 400, 0.5); for (let s = perfil.s0; s <= perfil.s1 + 1e-9; s += paso) muestras.push(Math.min(s, perfil.s1)); if (muestras.at(-1) < perfil.s1) muestras.push(perfil.s1);
    const zRas = muestras.map((s) => perfil.cota(s)); zs.push(...zRas); const terr = terreno ? terreno.map(([s, z]) => [s, z]) : null; if (terr) zs.push(...terr.map((q) => q[1]));
    const zMin = Math.floor(Math.min(...zs) - 2); const oy = minY - 60 - (Math.max(...zs) - zMin) * exageracion_vertical; const ox = minX; const X = (s) => ox + (s - alineamiento.s0); const Y = (z) => oy + (z - zMin) * exageracion_vertical;
    poli('RASANTE', muestras.map((s, i) => [X(s), Y(zRas[i])]), false); if (terr) poli('TERRENO', terr.map(([s, z]) => [X(s), Y(z)]), false);
    for (const s of est.filter((q) => q >= perfil.s0 - 1e-9 && q <= perfil.s1 + 1e-9)) { linea('CUADRICULA', X(s), Y(zMin), X(s), Y(perfil.cota(s))); texto('TEXTO', X(s) + 0.5, Y(zMin) - 5, 2, formatoProgresiva(s), 90); texto('TEXTO', X(s) + 0.5, Y(perfil.cota(s)) + 1.5, 2, `${perfil.cota(s).toFixed(2)}`, 90); }
    texto('TEXTO', ox, oy - 14, 4, `${titulo} — PERFIL LONGITUDINAL (m) — exageración vertical ×${exageracion_vertical} (horizontal 1:1)`); meta.perfil = { exageracion_vertical, cota_ref: zMin, origen: [ox, oy], puntos: muestras.length };
  }
  // ---- Secciones ----
  const sx0 = maxX + 80; let sy = maxY; let col = 0; const sepX = Math.max(30, ...secciones.map((q) => (q.ancho || 0) + 10));
  secciones.forEach((sec, i) => {
    const ox = sx0 + (col % 3) * sepX * 1.4; const oy = sy - Math.floor(col / 3) * (Math.max(...secciones.map((q) => q.alto || 10)) + 25); col++;
    const pts = sec.poligono.map(([x, y, b]) => [ox + x, oy + y, b]); poli('SECCION', pts, true); const pr = propiedades(sec.poligono); let prI = null; if (sec.interior) { poli('INTERIOR', sec.interior.map(([x, y, b]) => [ox + x, oy + y, b]), true); prI = propiedades(sec.interior); }
    texto('TEXTO', ox - 6, oy - 5, 2.5, `Sección ${sec.nombre || formatoProgresiva(sec.progresiva)} — PK ${formatoProgresiva(sec.progresiva)}`); texto('TEXTO', ox - 6, oy - 9, 2.5, `${prI ? 'Área excavada' : 'Área'} = ${pr.area.toFixed(2)} m2`); if (prI) texto('TEXTO', ox - 6, oy - 13, 2.5, `Área interior = ${prI.area.toFixed(2)} m2`);
    meta.secciones.push({ progresiva: sec.progresiva, nombre: sec.nombre || null, area_m2: pr.area, area_interior_m2: prI ? prI.area : null, origen: [ox, oy] });
  });
  // ---- Ensamblado ----
  const out = []; const P = (c, v) => out.push(`${c}\n${v}`);
  P(0, 'SECTION'); P(2, 'HEADER'); P(9, '$ACADVER'); P(1, 'AC1009'); P(9, '$INSUNITS'); P(70, 6); P(0, 'ENDSEC');
  P(0, 'SECTION'); P(2, 'TABLES'); P(0, 'TABLE'); P(2, 'LTYPE'); P(70, 1); P(0, 'LTYPE'); P(2, 'CONTINUOUS'); P(70, 0); P(3, 'Solid line'); P(72, 65); P(73, 0); P(40, 0); P(0, 'ENDTAB');
  P(0, 'TABLE'); P(2, 'LAYER'); P(70, Object.keys(CAPAS_LINEAL).length); for (const [n, c] of Object.entries(CAPAS_LINEAL)) { P(0, 'LAYER'); P(2, n); P(70, 0); P(62, c); P(6, 'CONTINUOUS'); } P(0, 'ENDTAB');
  P(0, 'TABLE'); P(2, 'STYLE'); P(70, 1); P(0, 'STYLE'); P(2, 'STANDARD'); P(70, 0); P(40, 0); P(41, 1); P(50, 0); P(71, 0); P(42, 2.5); P(3, 'txt'); P(4, ''); P(0, 'ENDTAB'); P(0, 'ENDSEC');
  P(0, 'SECTION'); P(2, 'BLOCKS'); P(0, 'ENDSEC'); P(0, 'SECTION'); P(2, 'ENTITIES'); out.push(...ent); P(0, 'ENDSEC'); P(0, 'EOF');
  return { dxf: `${out.join('\n')}\n`, meta };
}

import { parseDxf } from '../dxf/reader.js';
import { measureDxf } from '../dxf/measure.js';
/** Relee el DXF con el lector INDEPENDIENTE del repositorio y contrasta con lo esperado (largo del eje, áreas de secciones, capas). */
export function verificarDxfLineal(dxfTexto, meta, { tolRel = 1e-5 } = {}) {
  const d = parseDxf(dxfTexto); const m = measureDxf(d, { unidad_confirmada: 'm' }); const problemas = []; const medidos = {};
  const largoEje = m.mediciones.filter((x) => x.capa === 'EJE' && x.magnitud === 'longitud' && x.estado === 'ok').reduce((a, x) => a + x.valor, 0); medidos.largo_eje_m = largoEje;
  if (Math.abs(largoEje - meta.eje.largo_m) > tolRel * meta.eje.largo_m) problemas.push({ codigo: 'LARGO_EJE', mensaje: `El eje releído mide ${largoEje.toFixed(4)} m y el modelo ${meta.eje.largo_m.toFixed(4)} m.` });
  const areas = m.mediciones.filter((x) => x.capa === 'SECCION' && x.magnitud === 'area' && x.estado === 'ok').map((x) => x.valor).sort((a, b) => a - b); const esperadas = meta.secciones.map((s) => s.area_m2).sort((a, b) => a - b); medidos.areas_secciones_m2 = areas;
  if (areas.length !== esperadas.length) problemas.push({ codigo: 'N_SECCIONES', mensaje: `Se releyeron ${areas.length} secciones; el modelo tiene ${esperadas.length}.` });
  else areas.forEach((a, i) => { if (Math.abs(a - esperadas[i]) > tolRel * Math.max(1, esperadas[i])) problemas.push({ codigo: 'AREA_SECCION', mensaje: `Sección ${i}: DXF ${a.toFixed(4)} m² vs modelo ${esperadas[i].toFixed(4)} m².` }); });
  const interiores = m.mediciones.filter((x) => x.capa === 'INTERIOR' && x.magnitud === 'area' && x.estado === 'ok').map((x) => x.valor).sort((a, b) => a - b); const esperI = meta.secciones.filter((s) => s.area_interior_m2 !== null && s.area_interior_m2 !== undefined).map((s) => s.area_interior_m2).sort((a, b) => a - b); medidos.areas_interiores_m2 = interiores;
  if (interiores.length !== esperI.length) problemas.push({ codigo: 'N_INTERIORES', mensaje: `Se releyeron ${interiores.length} contornos interiores; el modelo tiene ${esperI.length}.` }); else interiores.forEach((a, i) => { if (Math.abs(a - esperI[i]) > tolRel * Math.max(1, esperI[i])) problemas.push({ codigo: 'AREA_INTERIOR', mensaje: `Interior ${i}: DXF ${a.toFixed(4)} m² vs modelo ${esperI[i].toFixed(4)} m².` }); });
  const capas = new Set(d.entities.map((e) => e.layer)); const faltan = ['EJE', 'PROGRESIVAS', 'SECCION', 'TEXTO'].filter((c) => !capas.has(c)); if (faltan.length) problemas.push({ codigo: 'CAPAS', mensaje: `Faltan capas: ${faltan.join(', ')}.` });
  if (meta.perfil && !capas.has('RASANTE')) problemas.push({ codigo: 'PERFIL', mensaje: 'Falta la capa RASANTE del perfil.' });
  return { ok: problemas.length === 0, problemas, medidos, entidades: d.entities.length, unidades: d.insunitsName };
}
