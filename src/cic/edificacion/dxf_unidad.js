// DXF de la unidad (metros, INSUNITS=6) y su verificación independiente: áreas de recintos, longitudes por clase de muro y reglas tipológicas.
import { textoDxf } from '../../design/salidas.js';
import { parseDxf } from '../../dxf/reader.js';
import { measureDxf } from '../../dxf/measure.js';

export const CAPAS_UNIDAD = { MURO_FACHADA: 7, MURO_MEDIANERO: 1, MURO_NUCLEO: 5, MURO_INT: 8, VENTANA: 4, PUERTA: 3, RECINTO: 2, BALCON: 6, BARANDA: 6, TEXTO: 2 };
const CAPA_CLASE = { fachada: 'MURO_FACHADA', medianero: 'MURO_MEDIANERO', nucleo: 'MURO_NUCLEO', interior: 'MURO_INT', vacio: 'MURO_INT' };
const num = (x) => (Math.round(x * 1e6) / 1e6).toString(); const m = (v) => v / 1000;

export function generarDxfUnidad(u) {
  const ent = []; const E = (...pares) => { for (const [c, v] of pares) ent.push(`${c}\n${v}`); };
  const linea = (capa, x0, y0, x1, y1) => E([0, 'LINE'], [8, capa], [10, num(x0)], [20, num(y0)], [30, 0], [11, num(x1)], [21, num(y1)], [31, 0]);
  const texto = (capa, x, y, h, s) => E([0, 'TEXT'], [8, capa], [10, num(x)], [20, num(y)], [30, 0], [40, h], [1, textoDxf(s)]);
  const poli = (capa, pts) => { E([0, 'POLYLINE'], [8, capa], [66, 1], [70, 1]); for (const q of pts) E([0, 'VERTEX'], [8, capa], [10, num(m(q[0]))], [20, num(m(q[1]))], [30, 0]); E([0, 'SEQEND'], [8, capa]); };
  for (const r of u.recintos) { poli('RECINTO', r.contorno); const a = u.propiedades_recintos.find((x) => x.id === r.id).area_m2; texto('TEXTO', m(r.x0) + 0.2, m((r.y0 + r.y1) / 2), 0.22, `${r.nombre}`); texto('TEXTO', m(r.x0) + 0.2, m((r.y0 + r.y1) / 2) - 0.35, 0.2, `${a.toFixed(2)} m2`); }
  for (const w of u.muros) {
    linea(CAPA_CLASE[w.clase], m(w.p1[0]), m(w.p1[1]), m(w.p2[0]), m(w.p2[1]));
    const L = Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]); const ux = (w.p2[0] - w.p1[0]) / L; const uy = (w.p2[1] - w.p1[1]) / L;
    for (const v of w.vanos) { const a = v.posicion_mm - v.ancho_mm / 2; const b = v.posicion_mm + v.ancho_mm / 2; linea(v.tipo === 'ventana' ? 'VENTANA' : 'PUERTA', m(w.p1[0] + ux * a), m(w.p1[1] + uy * a), m(w.p1[0] + ux * b), m(w.p1[1] + uy * b)); }
  }
  if (u.balcon) { poli('BALCON', u.balcon.contorno); const [a, b] = u.balcon.baranda; linea('BARANDA', m(a[0]), m(a[1]), m(b[0]), m(b[1])); texto('TEXTO', m(u.balcon.contorno[0][0]) + 0.2, m(u.balcon.contorno[0][1]) + 0.2, 0.2, 'Terraza (borde abierto)'); }
  texto('TEXTO', 0, -1.2, 0.3, `${u.programa.nombre} — ${u.programa.tipologia} — nivel ${u.huella_tipologica.nivel_indice}`); texto('TEXTO', 0, -1.7, 0.2, 'Ejes N/E/S/O del PLANO (orientación real desconocida). Anteproyecto geométrico: no apto para construcción.');
  const out = []; const P = (c, v) => out.push(`${c}\n${v}`);
  P(0, 'SECTION'); P(2, 'HEADER'); P(9, '$ACADVER'); P(1, 'AC1009'); P(9, '$INSUNITS'); P(70, 6); P(0, 'ENDSEC');
  P(0, 'SECTION'); P(2, 'TABLES'); P(0, 'TABLE'); P(2, 'LTYPE'); P(70, 1); P(0, 'LTYPE'); P(2, 'CONTINUOUS'); P(70, 0); P(3, 'Solid line'); P(72, 65); P(73, 0); P(40, 0); P(0, 'ENDTAB');
  P(0, 'TABLE'); P(2, 'LAYER'); P(70, Object.keys(CAPAS_UNIDAD).length); for (const [n, c] of Object.entries(CAPAS_UNIDAD)) { P(0, 'LAYER'); P(2, n); P(70, 0); P(62, c); P(6, 'CONTINUOUS'); } P(0, 'ENDTAB');
  P(0, 'TABLE'); P(2, 'STYLE'); P(70, 1); P(0, 'STYLE'); P(2, 'STANDARD'); P(70, 0); P(40, 0); P(41, 1); P(50, 0); P(71, 0); P(42, 2.5); P(3, 'txt'); P(4, ''); P(0, 'ENDTAB'); P(0, 'ENDSEC');
  P(0, 'SECTION'); P(2, 'BLOCKS'); P(0, 'ENDSEC'); P(0, 'SECTION'); P(2, 'ENTITIES'); out.push(...ent); P(0, 'ENDSEC'); P(0, 'EOF');
  return `${out.join('\n')}\n`;
}

const PROHIBIDAS_NO_CASA = /JARDIN|PISCINA|ANTEJARDIN|TECHUMBRE|ALERO|GARAGE|PATIO/i;
/** Relee el DXF con el lector independiente y verifica coherencia con el modelo y reglas tipológicas. */
export function verificarDxfUnidad(dxfTexto, u, { tolRel = 1e-5 } = {}) {
  const d = parseDxf(dxfTexto); const med = measureDxf(d, { unidad_confirmada: 'm' }); const problemas = [];
  const areas = med.mediciones.filter((x) => x.capa === 'RECINTO' && x.magnitud === 'area' && x.estado === 'ok').map((x) => x.valor).sort((a, b) => a - b); const esp = u.propiedades_recintos.map((r) => r.area_m2).sort((a, b) => a - b);
  if (areas.length !== esp.length) problemas.push({ codigo: 'N_RECINTOS', mensaje: `Se releyeron ${areas.length} recintos; el modelo tiene ${esp.length}.` }); else areas.forEach((a, i) => { if (Math.abs(a - esp[i]) > tolRel * Math.max(1, esp[i])) problemas.push({ codigo: 'AREA_RECINTO', mensaje: `Recinto ${i}: DXF ${a.toFixed(4)} m² vs modelo ${esp[i].toFixed(4)} m².` }); });
  const largos = {}; for (const [clase, capa] of Object.entries({ fachada: 'MURO_FACHADA', medianero: 'MURO_MEDIANERO', nucleo: 'MURO_NUCLEO' })) { largos[clase] = med.mediciones.filter((x) => x.capa === capa && x.magnitud === 'longitud' && x.estado === 'ok').reduce((a, x) => a + x.valor, 0); const e = u.muros.filter((w) => w.clase === clase).reduce((a, w) => a + Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]) / 1000, 0); if (Math.abs(largos[clase] - e) > tolRel * Math.max(1, e)) problemas.push({ codigo: 'LARGO_MURO', mensaje: `Muros ${clase}: DXF ${largos[clase].toFixed(3)} m vs modelo ${e.toFixed(3)} m.` }); }
  // Regla geométrica independiente: toda ventana yace sobre un muro de FACHADA
  const lineas = (capa) => d.entities.filter((e) => e.type === 'LINE' && e.layer === capa); const sobre = (p, a, b) => { const cr = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)); const L = Math.hypot(b.x - a.x, b.y - a.y); const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (L * L); return cr / L < 1e-6 && t >= -1e-9 && t <= 1 + 1e-9; };
  const fach = lineas('MURO_FACHADA'); let ventanasFuera = 0; for (const v of lineas('VENTANA')) { const c = { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 }; if (!fach.some((w) => sobre(c, w.a, w.b))) ventanasFuera++; }
  if (ventanasFuera) problemas.push({ codigo: 'VENTANA_FUERA_DE_FACHADA', mensaje: `${ventanasFuera} ventana(s) no están sobre un muro de fachada.` });
  const nuc = lineas('MURO_NUCLEO'); const puertasAcceso = lineas('PUERTA').filter((v) => { const c = { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 }; return nuc.some((w) => sobre(c, w.a, w.b)); }).length;
  if (u.programa.tipologia !== 'casa' && puertasAcceso < 1) problemas.push({ codigo: 'ACCESO_SIN_NUCLEO', mensaje: 'No hay puerta de acceso sobre el muro de circulación común.' });
  const capas = new Set(d.entities.map((e) => e.layer)); const textos = d.entities.filter((e) => e.type === 'TEXT').map((e) => e.text || '').join(' ');
  if (u.programa.tipologia !== 'casa') { const prohibidas = [...capas].filter((c) => PROHIBIDAS_NO_CASA.test(c)); if (prohibidas.length || /jard[ií]n|piscina|antejard[ií]n/i.test(textos)) problemas.push({ codigo: 'ELEMENTOS_DE_LOTE', mensaje: 'El departamento contiene elementos propios de una vivienda unifamiliar de lote (jardín, piscina, antejardín, techumbre).' }); }
  return { ok: problemas.length === 0, problemas, medidos: { areas_recintos_m2: areas, largos_muro_m: largos, puertas_de_acceso_en_nucleo: puertasAcceso, ventanas_fuera_de_fachada: ventanasFuera }, entidades: d.entities.length };
}
