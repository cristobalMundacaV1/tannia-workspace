// Utilidades compartidas por las pruebas CAD-BG (segundo plano). El «AutoCAD sin interfaz» es un SIMULADOR.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { tmpHome, startClient, call, data, ROOT } from './helpers.js';

export const TUNEL = { length: 150, width: 5.5, wall: 3, selected: 0.06, fortificacion: { perno_longitud: 2.4, espaciamiento_transversal: 1.5, espaciamiento_longitudinal: 1.5, malla: true, traslapo_malla_pct: 10 } };
export const FINAL = new Set(['TERMINADO', 'REQUIERE_INTERVENCIÓN', 'FALLÓ', 'CANCELADO']);
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
export function hogar(config = {}) { const home = tmpHome(); fs.mkdirSync(path.join(home, '.tannia-trabajos'), { recursive: true }); fs.writeFileSync(path.join(home, '.tannia-trabajos', 'config.json'), JSON.stringify({ memoria_libre_minima_mb: 0, ...config })); return home; }
export function simulador(dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc ')), modo = 'normal') {
  const exe = path.join(dir, 'accoreconsole-simulado'); const ctl = path.join(dir, 'modo.txt'); const log = path.join(dir, 'invocaciones.jsonl');
  fs.writeFileSync(exe, `#!/bin/sh\nexec "${process.execPath}" "${path.join(ROOT, 'test', 'proc', 'accoreconsole_simulado.mjs')}" "$@"\n`, { mode: 0o755 }); fs.writeFileSync(ctl, modo);
  const lineas = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { exe, ctl, log, modo: (m) => fs.writeFileSync(ctl, m), invocaciones: () => lineas().filter((x) => !x.fin), intervalos: () => { const ls = lineas(); return ls.filter((x) => !x.fin).map((x) => ({ pid: x.pid, ini: x.t_inicio, fin: ls.find((y) => y.fin && y.pid === x.pid)?.t_fin ?? null })); }, env: { TANNIA_ACCORECONSOLE: exe, TANNIA_SIM_ACC_CTL: ctl, TANNIA_SIM_ACC_LOG: log, TANNIA_ACCORECONSOLE_VERSION: 'SIMULADOR' } };
}
export async function sesion(home, env = {}) {
  const c = await startClient(home, undefined, { TANNIA_AVISOS: 'off', ...env });
  const T = async (n, a, falla = false) => { const r = await call(c.client, n, a); if (!falla) assert.ok(!r.isError, `${n}: ${r.content?.[0]?.text}`); return r; };
  const hasta = async (id, cond = (e) => FINAL.has(e.estado_interno), maxMs = 120000) => { const t0 = Date.now(); for (;;) { const e = data(await T('tannia_trabajos', { accion: 'estado', trabajo: id })); if (cond(e)) return e; if (Date.now() - t0 > maxMs) throw new Error(`tiempo agotado esperando ${id}: ${JSON.stringify(e).slice(0, 400)}`); await esperar(300); } };
  const crear = async (args) => data(await T('tannia_trabajos', { accion: 'crear', ...args })).trabajo;
  return { c, T, hasta, crear, close: () => c.close() };
}
export const leerTrabajo = (home, id) => JSON.parse(fs.readFileSync(path.join(home, '.tannia-trabajos', `${id}.json`), 'utf8'));
