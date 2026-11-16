// Posición solar (azimut geográfico desde el norte verdadero, sentido horario; elevación). Implementación propia en Node
// (ecuaciones de Meeus/NOAA con refracción estándar). Se contrasta con el oráculo independiente NREL SPA (pvlib.spa_python)
// en fixtures/tw10/solar_oracle.json. No calcula iluminancia, energía ni confort: solo geometría solar.
import { UserError } from '../mcp/util.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const PRESION_HPA = 1013.25; const TEMP_C = 12; // atmósfera estándar de referencia (igual que el oráculo)
const norm360 = (x) => ((x % 360) + 360) % 360;

/** Día juliano de un instante UTC (ms epoch). */
export const diaJuliano = (ms) => ms / 86400000 + 2440587.5;

/** ΔT aproximado (s), Espenak–Meeus, válido 2005–2050. Afecta <0.001°. */
const deltaT = (anio) => { const t = anio - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; };

/**
 * @param {number} ms instante absoluto (epoch ms, UTC)
 * @param {number} lat grados (sur negativo) @param {number} lon grados (oeste negativo)
 * @returns {{azimut_deg:number, elevacion_deg:number, elevacion_aparente_deg:number, cenit_deg:number, declinacion_deg:number}}
 */
export function posicionSolar(ms, lat, lon) {
  if (!Number.isFinite(ms)) throw new UserError('SOLAR_ENTRADA', 'Instante inválido.');
  if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) throw new UserError('SOLAR_ENTRADA', 'Latitud/longitud fuera de rango (lat −90…90, lon −180…180).');
  const anio = new Date(ms).getUTCFullYear();
  const jdUT = diaJuliano(ms);
  const jde = jdUT + deltaT(anio) / 86400;
  const T = (jde - 2451545.0) / 36525;
  const L0 = norm360(280.46646 + T * (36000.76983 + 0.0003032 * T));
  const M = norm360(357.52911 + T * (35999.05029 - 0.0001537 * T));
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(M * RAD) + (0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD) + 0.000289 * Math.sin(3 * M * RAD);
  const lonVerd = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lamb = lonVerd - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lamb * RAD)) * DEG;
  const ra = Math.atan2(Math.cos(eps * RAD) * Math.sin(lamb * RAD), Math.cos(lamb * RAD)) * DEG;
  // tiempo sidéreo aparente en Greenwich
  const T0 = (jdUT - 2451545.0) / 36525;
  const gmst = norm360(280.46061837 + 360.98564736629 * (jdUT - 2451545.0) + 0.000387933 * T0 * T0 - (T0 * T0 * T0) / 38710000);
  const dpsi = -0.00478 * Math.sin(omega * RAD) - 0.00036 * Math.sin(2 * L0 * RAD); // nutación en longitud (aprox., grados)
  const gast = gmst + dpsi * Math.cos(eps * RAD);
  const H = norm360(gast + lon - ra);
  const Hr = H * RAD; const latr = lat * RAD; const decr = dec * RAD;
  const sinEl = Math.sin(latr) * Math.sin(decr) + Math.cos(latr) * Math.cos(decr) * Math.cos(Hr);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl))) * DEG;
  // azimut desde el norte, horario
  const az = norm360(Math.atan2(Math.sin(Hr), Math.cos(Hr) * Math.sin(latr) - Math.tan(decr) * Math.cos(latr)) * DEG + 180);
  // paralaje (8.794") y refracción atmosférica estándar (1010 mbar, 10 °C)
  const elTopo = el - (8.794 / 3600) * Math.cos(el * RAD);
  const refrac = elTopo > -1 ? (1.02 / Math.tan((elTopo + 10.3 / (elTopo + 5.11)) * RAD)) / 60 * (PRESION_HPA / 1010) * (283 / (273 + TEMP_C)) : 0;
  const elAp = elTopo + (elTopo > -1 ? refrac : 0);
  return { azimut_deg: az, elevacion_deg: elTopo, elevacion_aparente_deg: elAp, cenit_deg: 90 - elTopo, declinacion_deg: dec };
}

/** Convierte hora local civil (YYYY-MM-DDTHH:MM) de una zona IANA a epoch ms UTC. Maneja DST; rechaza horas inexistentes. */
export function localAInstante(isoLocal, zonaIana) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(isoLocal);
  if (!m) throw new UserError('SOLAR_ENTRADA', 'Fecha local debe ser YYYY-MM-DDTHH:MM.');
  const [Y, Mo, D, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] || '0'].map(Number);
  let fmt; try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: zonaIana, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { throw new UserError('ZONA_INVALIDA', `Zona horaria IANA no reconocida: ${zonaIana}.`); }
  const nominal = Date.UTC(Y, Mo - 1, D, h, mi, s);
  const parte = (ms) => { const o = {}; for (const p of fmt.formatToParts(new Date(ms))) o[p.type] = Number(p.value); return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second); };
  const candidatos = new Set();
  for (const off of [-14, -12, -10, -8, -6, -4, -3, -2, 0, 2, 3, 4, 5.5, 8, 10, 12, 13]) { const t = nominal - off * 3600000; const delta = parte(t) - t; const c = nominal - delta; if (parte(c) === nominal) candidatos.add(c); }
  if (!candidatos.size) throw new UserError('HORA_INEXISTENTE', `La hora local ${isoLocal} no existe en ${zonaIana} (salto de horario de verano).`);
  return Math.min(...candidatos); // en ambigüedad (retroceso), el primer instante
}

/** Desfase UTC (minutos) de una zona en un instante. */
export function desfaseMinutos(ms, zonaIana) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zonaIana, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const o = {}; for (const p of fmt.formatToParts(new Date(ms))) o[p.type] = Number(p.value);
  return Math.round((Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second) - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Vector unitario hacia el sol en ejes locales (+X derecha del plano, +Y arriba del plano, +Z altura).
 *  `norte_deg`: ángulo en que el norte verdadero está medido desde +Y local en sentido horario (campo true_north_deg_from_local_plus_y_clockwise). */
export function vectorSolLocal(azimut_deg, elevacion_deg, norte_deg) {
  const azLocal = (azimut_deg + norte_deg) * RAD; // rumbo local (horario desde +Y) = ángulo del norte verdadero + rumbo geográfico
  const el = elevacion_deg * RAD;
  return [Math.sin(azLocal) * Math.cos(el), Math.cos(azLocal) * Math.cos(el), Math.sin(el)];
}

/** Muestras de sol de un día local: paso en minutos, solo con elevación > 0. */
export function muestrasDia({ fecha, lat, lon, zona, pasoMin = 30 }) {
  const out = [];
  for (let min = 0; min < 24 * 60; min += pasoMin) {
    const hh = String(Math.floor(min / 60)).padStart(2, '0'); const mm = String(min % 60).padStart(2, '0');
    let ms; try { ms = localAInstante(`${fecha}T${hh}:${mm}`, zona); } catch (e) { if (e.codigo === 'HORA_INEXISTENTE' || e.code === 'HORA_INEXISTENTE') continue; throw e; }
    const p = posicionSolar(ms, lat, lon);
    if (p.elevacion_deg > 0) out.push({ hora_local: `${hh}:${mm}`, ms, ...p });
  }
  return out;
}
