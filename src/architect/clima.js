// Clima: importador EPW (texto → datos; los comentarios del archivo son DATOS, nunca instrucciones), caché local de Open-Meteo/ERA5
// (sin consultas de red), perfiles estacionales y rosa de vientos. Un EPW no es clima medido en el predio: representatividad regional.
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';
import { SCHEMA_IDS, climaVacio, validar } from './schemas.js';

export const MAX_BYTES_CLIMA = 25 * 1024 * 1024;
const SECTORES = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const SECTORES_VIENTO = SECTORES;
const FALTANTE = { temp: (v) => v >= 99.9, rh: (v) => v >= 999, wdir: (v) => v >= 999, wspd: (v) => v >= 999, ghi: (v) => v >= 9999 };

export function estacionDeMes(mes, hemisferio) { const sur = hemisferio === 'S'; const m = mes % 12; const e = m >= 2 && m <= 4 ? 'otono' : m >= 5 && m <= 7 ? 'invierno' : m >= 8 && m <= 10 ? 'primavera' : 'verano'; // mes 1..12 → índices: 12→0
  const mapN = { otono: 'primavera', invierno: 'verano', primavera: 'otono', verano: 'invierno' }; return sur ? e : mapN[e]; }
// Nota: el mapa de arriba asume m=2..4 (feb-abr) → se corrige abajo con una tabla explícita para evitar errores de borde.
const ESTACION_SUR = { 12: 'verano', 1: 'verano', 2: 'verano', 3: 'otono', 4: 'otono', 5: 'otono', 6: 'invierno', 7: 'invierno', 8: 'invierno', 9: 'primavera', 10: 'primavera', 11: 'primavera' };
const OPUESTA = { verano: 'invierno', invierno: 'verano', otono: 'primavera', primavera: 'otono' };
export const estacion = (mes, hemisferio) => (hemisferio === 'S' ? ESTACION_SUR[mes] : OPUESTA[ESTACION_SUR[mes]]);

export function parsearEpw(texto, { nombre = 'archivo.epw' } = {}) {
  if (typeof texto !== 'string') throw new UserError('EPW_INVALIDO', 'El EPW debe ser texto.');
  if (Buffer.byteLength(texto) > MAX_BYTES_CLIMA) throw new UserError('EPW_MUY_GRANDE', 'El archivo de clima excede 25 MB.');
  const lineas = texto.split(/\r?\n/); const loc = lineas.find((l) => l.startsWith('LOCATION,'));
  if (!loc) throw new UserError('EPW_INVALIDO', 'No es un EPW: falta la línea LOCATION.', 'Use un archivo .epw de una fuente confiable (p. ej. la fuente que indique su arquitecto/a).');
  const p = loc.split(','); const lat = Number(p[6]); const lon = Number(p[7]); const tz = Number(p[8]); const elev = Number(p[9]);
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) throw new UserError('EPW_INVALIDO', 'Coordenadas de la estación fuera de rango.');
  const ini = lineas.findIndex((l) => l.startsWith('DATA PERIODS,')); if (ini < 0) throw new UserError('EPW_INVALIDO', 'Falta DATA PERIODS.');
  const comentarios = lineas.filter((l) => /^COMMENTS [12],/.test(l)).map((l) => l.slice(0, 200)); // se guardan como DATO, truncados
  const filas = []; let malas = 0;
  for (let i = ini + 1; i < lineas.length; i++) {
    const l = lineas[i]; if (!l.trim()) continue; const c = l.split(',');
    if (c.length < 22) { malas++; continue; }
    const f = { mes: Number(c[1]), dia: Number(c[2]), hora: Number(c[3]), temp: Number(c[6]), rh: Number(c[8]), ghi: Number(c[13]), dni: Number(c[14]), dhi: Number(c[15]), wdir: Number(c[20]), wspd: Number(c[21]) };
    if (!(f.mes >= 1 && f.mes <= 12 && f.hora >= 1 && f.hora <= 24)) { malas++; continue; }
    filas.push(f);
  }
  if (filas.length < 8000) throw new UserError('EPW_INCOMPLETO', `El EPW trae ${filas.length} horas válidas (se esperan ~8760).`, 'No se completa ni se interpola un archivo incompleto.');
  const hemisferio = lat < 0 ? 'S' : 'N';
  const faltante = { temperature: 0, humidity: 0, wind_speed_10m: 0, wind_direction_10m: 0, radiation: 0 };
  for (const f of filas) { if (FALTANTE.temp(f.temp)) faltante.temperature++; if (FALTANTE.rh(f.rh)) faltante.humidity++; if (FALTANTE.wspd(f.wspd)) faltante.wind_speed_10m++; if (FALTANTE.wdir(f.wdir)) faltante.wind_direction_10m++; if (FALTANTE.ghi(f.ghi)) faltante.radiation++; }
  for (const k of Object.keys(faltante)) faltante[k] = Math.round((faltante[k] / filas.length) * 10000) / 10000;
  const sha = crypto.createHash('sha256').update(texto).digest('hex');
  const clima = {
    schema: SCHEMA_IDS.weather, source_kind: 'epw', source_ref: String(nombre).slice(0, 200), source_sha256: sha, station_or_grid: `${p[1] || ''} (${p[3] || ''})`.slice(0, 200), geospatial_resolution: `estación a (${lat}, ${lon}), elev ${elev} m`,
    coverage_period: 'año meteorológico tipo (datos horarios)', variables: ['temperature', 'humidity', 'wind_speed_10m', 'wind_direction_10m', 'radiation'], missingness: faltante, license_note: 'Licencia/atribución del archivo: verificar con la fuente antes de distribuir.', representativeness: 'regional', status: 'loaded',
  };
  const v = validar('weather', clima); if (!v.ok) throw new UserError('EPW_INVALIDO', v.errores.join(' | '));
  return { clima: v.valor, datos: filas, estacion: { lat, lon, tz_utc_offset_h: tz, elevacion_m: elev, hemisferio }, comentarios_archivo: comentarios, filas_descartadas: malas };
}

/** Importa una respuesta de Open-Meteo (JSON) ya descargada por otros medios: caché local; el servidor no hace consultas de red. */
export function importarOpenMeteoCache(json, { lat, lon, nombre = 'open-meteo.json' }) {
  const h = json?.hourly; if (!h?.time?.length || !Array.isArray(h.temperature_2m)) throw new UserError('CLIMA_INVALIDO', 'JSON sin hourly.time/temperature_2m (formato Open-Meteo).');
  const n = h.time.length; if (n > 9000) throw new UserError('CLIMA_INVALIDO', 'Demasiadas horas (máx. ~1 año).');
  const filas = h.time.map((t, i) => { const mes = Number(String(t).slice(5, 7)); const hora = Number(String(t).slice(11, 13)) + 1; const num = (a) => (a && Number.isFinite(a[i]) ? a[i] : null);
    return { mes, dia: Number(String(t).slice(8, 10)), hora, temp: num(h.temperature_2m) ?? 99.9, rh: num(h.relative_humidity_2m) ?? 999, ghi: num(h.shortwave_radiation) ?? 9999, dni: 9999, dhi: 9999, wdir: num(h.wind_direction_10m) ?? 999, wspd: (num(h.wind_speed_10m) ?? 999) / (json.hourly_units?.wind_speed_10m === 'km/h' ? 3.6 : 1) }; });
  const clima = { ...climaVacio(), source_kind: 'open_meteo_era5', source_ref: nombre.slice(0, 200), source_sha256: crypto.createHash('sha256').update(JSON.stringify(json)).digest('hex'), station_or_grid: 'celda de reanálisis ERA5 (resolución ~0.25°)', geospatial_resolution: 'reanálisis: no es medición del predio',
    coverage_period: `${h.time[0]} … ${h.time[n - 1]}`, variables: ['temperature', 'wind_speed_10m', 'wind_direction_10m', 'radiation'], missingness: null, license_note: 'Open-Meteo/ERA5: atribución requerida; verificar términos y plan comercial antes de distribuir.', representativeness: 'regional', status: 'loaded' };
  return { clima, datos: filas, estacion: { lat, lon, hemisferio: lat < 0 ? 'S' : 'N' }, comentarios_archivo: [], filas_descartadas: 0 };
}

const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/** Perfiles por estación + rosa de vientos. Siempre con la salvedad: viento REGIONAL, no microclima del patio. */
export function perfilesClima({ datos, estacion: est }) {
  const hem = est.hemisferio; const out = {};
  for (const e of ['verano', 'otono', 'invierno', 'primavera']) {
    const f = datos.filter((d) => estacion(d.mes, hem) === e);
    const T = f.filter((d) => !FALTANTE.temp(d.temp)).map((d) => d.temp); const RH = f.filter((d) => !FALTANTE.rh(d.rh)).map((d) => d.rh);
    const W = f.filter((d) => !FALTANTE.wspd(d.wspd) && !FALTANTE.wdir(d.wdir)); const G = f.filter((d) => !FALTANTE.ghi(d.ghi)).map((d) => d.ghi);
    const calmas = W.filter((d) => d.wspd < 0.5).length; const conv = W.filter((d) => d.wspd >= 0.5);
    const rosa = SECTORES.map((s, i) => { const sel = conv.filter((d) => Math.floor((((d.wdir + 11.25) % 360) / 22.5)) % 16 === i); return { sector: s, frecuencia: W.length ? r2(sel.length / W.length) : null, velocidad_media_ms: r2(media(sel.map((d) => d.wspd))) }; });
    const dom = [...rosa].sort((a, b) => (b.frecuencia ?? 0) - (a.frecuencia ?? 0))[0];
    out[e] = { horas: f.length, temperatura_c: { media: r2(media(T)), min: T.length ? Math.min(...T) : null, max: T.length ? Math.max(...T) : null }, humedad_relativa_media_pct: r2(media(RH)), radiacion_global_horizontal_media_wh_m2: r2(media(G)), viento: { calmas_frecuencia: W.length ? r2(calmas / W.length) : null, rosa, direccion_dominante_desde: dom?.frecuencia ? dom.sector : null, velocidad_media_ms: r2(media(conv.map((d) => d.wspd))) } };
  }
  return { hemisferio: hem, estaciones: out, salvedades: ['Viento y temperatura son REGIONALES (archivo/estación o reanálisis), no mediciones del predio ni del patio.', 'La rosa de vientos no permite afirmar velocidad dentro del patio ni ventilación de interiores sin modelado adecuado.', 'Un clima de archivo no se considera validado para el predio.'] };
}

/** Exposición a viento de cada fachada (normal exterior en ejes locales) según la rosa de una estación; sin norte verdadero devuelve null. */
export function exposicionFachadas(perfil, norte_deg, estacionNombre) {
  if (norte_deg == null) return null;
  const rosa = perfil.estaciones[estacionNombre]?.viento?.rosa; if (!rosa) return null;
  const normales = { S: 180, N: 0, E: 90, O: 270 }; // direcciones locales (desde +Y, horario) hacia las que mira cada fachada
  const out = {};
  for (const [lado, a] of Object.entries(normales)) {
    const dirVerdadera = (((a - norte_deg) % 360) + 360) % 360; // rumbo geográfico hacia el que mira la fachada (local = norte + rumbo)
    let f = 0; for (let i = 0; i < 16; i++) { const centro = i * 22.5; const d = Math.abs(((centro - dirVerdadera + 540) % 360) - 180); if (d <= 67.5) f += (rosa[i].frecuencia ?? 0) * Math.cos((d * Math.PI) / 180); }
    out[lado] = r2(f);
  }
  return { fachada_sector_relativo: out, nota: 'Índice relativo de frecuencia de viento regional que incide sobre cada fachada (no es presión ni caudal; sin CFD).' };
}
