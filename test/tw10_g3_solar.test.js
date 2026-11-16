// TW10-03-01: motor solar contrastado con el oráculo independiente NREL SPA (pvlib), zonas horarias y DST.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posicionSolar, localAInstante, desfaseMinutos, vectorSolLocal, muestrasDia } from '../src/architect/solar.js';

const oraculo = JSON.parse(readFileSync(new URL('../fixtures/tw10/solar_oracle.json', import.meta.url), 'utf8'));
const dAz = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

test('solar: coincide con NREL SPA (pvlib) en 168 casos, 7 lugares, ambos hemisferios', () => {
  let maxAz = 0; let maxEl = 0; let n = 0;
  for (const c of oraculo.casos) {
    const p = posicionSolar(c.utc_ms, c.lat, c.lon);
    if (c.elevacion < 3) continue; // cerca del horizonte la refracción domina; no se compara
    maxEl = Math.max(maxEl, Math.abs(p.elevacion_aparente_deg - c.elevacion_aparente));
    maxAz = Math.max(maxAz, dAz(p.azimut_deg, c.azimut)); n++;
  }
  assert.ok(n > 120, `casos comparados: ${n}`);
  assert.ok(maxEl < 0.05, `error máx. elevación ${maxEl}`);
  assert.ok(maxAz < 0.06, `error máx. azimut ${maxAz}`);
});

test('solar: la hora local civil usa IANA (DST) y coincide con los instantes del oráculo', () => {
  for (const c of oraculo.casos) assert.equal(localAInstante(c.local, c.zona), c.utc_ms, `${c.lugar} ${c.local}`);
});

test('solar: Chile — diciembre UTC−3 y junio UTC−4; hora inexistente se rechaza', () => {
  assert.equal(desfaseMinutos(localAInstante('2026-12-21T12:00', 'America/Santiago'), 'America/Santiago'), -180);
  assert.equal(desfaseMinutos(localAInstante('2026-06-21T12:00', 'America/Santiago'), 'America/Santiago'), -240);
  assert.throws(() => localAInstante('2026-09-06T00:30', 'America/Santiago'), /no existe/);
  assert.throws(() => localAInstante('2026-06-21T12:00', 'Nada/Nada'), /IANA/);
});

test('solar: hemisferio sur — al mediodía solar el sol está al NORTE; hemisferio norte al SUR; polaridad de estaciones', () => {
  const sur = posicionSolar(localAInstante('2026-06-21T13:00', 'America/Santiago'), -33.45, -70.67);
  assert.ok(dAz(sur.azimut_deg, 0) < 15, `sur invierno azimut ${sur.azimut_deg}`);
  const jun = posicionSolar(localAInstante('2026-06-21T13:15', 'America/Santiago'), -33.45, -70.67).elevacion_deg;
  const dic = posicionSolar(localAInstante('2026-12-21T13:30', 'America/Santiago'), -33.45, -70.67).elevacion_deg;
  assert.ok(jun < 36 && jun > 30, `junio ${jun}`); assert.ok(dic > 76 && dic < 82, `diciembre ${dic}`);
  const mad = posicionSolar(localAInstante('2026-06-21T14:15', 'Europe/Madrid'), 40.42, -3.70);
  assert.ok(dAz(mad.azimut_deg, 180) < 15);
});

test('solar: vector local respeta el norte dibujado (rotar el norte rota el sol, no la casa)', () => {
  const v0 = vectorSolLocal(0, 30, 0); assert.ok(v0[1] > 0.8 && Math.abs(v0[0]) < 1e-9);
  const v90 = vectorSolLocal(0, 30, 90); // el norte verdadero está a 90° horarios de +Y (apunta a +X): un sol al norte queda hacia +X
  assert.ok(v90[0] > 0.8);
  const e = vectorSolLocal(90, 30, 0); assert.ok(e[0] > 0.8, 'sol al este con norte arriba: +X');
  const e2 = vectorSolLocal(90, 30, 90); assert.ok(e2[1] < -0.8, 'norte a la derecha: el este queda abajo (−Y)');
  const n = Math.hypot(...vectorSolLocal(123, 41, 17)); assert.ok(Math.abs(n - 1) < 1e-12);
});

test('solar: muestras de un día solo con sol sobre el horizonte; entradas fuera de rango rechazadas', () => {
  const m = muestrasDia({ fecha: '2026-06-21', lat: -33.45, lon: -70.67, zona: 'America/Santiago', pasoMin: 60 });
  assert.ok(m.length > 8 && m.length < 12 && m.every((x) => x.elevacion_deg > 0));
  assert.throws(() => posicionSolar(0, 95, 0), /fuera de rango/);
});
