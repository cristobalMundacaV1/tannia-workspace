// TW-11 G10 (ejecutor): corre CASOS DE EVALUACIÓN contra el servidor MCP real y mide las dimensiones del doc 06 §5.2. Los casos retenidos son del revisor
// independiente (NO están en este repositorio): solo se versiona este ejecutor y casos públicos de DESARROLLO.
//   node scripts/tw11-eval.mjs --casos <carpeta> [--compromiso <archivo hashes>] [--entry <server index.js>] [--salida informe.json] [--rubrica <json del revisor>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export const UMBRALES = { precision_numerica: 0.95, errores_criticos: 0, fuera_de_rango_con_numero: 0, artefactos: 1, falsos_bloqueos: 0, reproducibilidad: 1, incertidumbre_senalada: 0.95, valores_criticos_inventados: 0, contradicciones_detectadas: 0.9, brechas_justificadas: 0.9, utilidad_media: 3.8, utilidad_minima: 3.0 };

/** Un caso: {id, tipo, archivos:{ruta_rel: texto|base64}, pasos:[{herramienta, args, guardar?}], esperados:[...]} — `${proyecto}` y `${home}` se sustituyen. */
export async function correrCaso(caso, { entry, cic = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tw11-eval ')); const P = `Eval ${caso.id}`.slice(0, 40); const c = new Client({ name: 'tw11-eval', version: '1' });
  await c.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env: { ...process.env, TANNIA_HOME: home, ...(cic ? { TANNIA_CIC: 'on' } : {}) }, stderr: 'pipe' }));
  const sub = (v) => (typeof v === 'string' ? v.replaceAll('${proyecto}', P) : Array.isArray(v) ? v.map(sub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)])) : v);
  const memoria = {}; const resultados = []; const textoTotal = []; const t0 = Date.now();
  try {
    await c.callTool({ name: 'tannia_proyecto_crear', arguments: { nombre: P } });
    for (const [rel, cont] of Object.entries(caso.archivos || {})) { const f = path.join(home, 'Proyectos', P, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, cont.startsWith('base64:') ? Buffer.from(cont.slice(7), 'base64') : cont); }
    for (const [i, paso] of (caso.pasos || []).entries()) {
      const args = sub(paso.args || {}); for (const [k, v] of Object.entries(args)) if (typeof v === 'string' && v.startsWith('@')) args[k] = get(memoria, v.slice(1));
      const r = await c.callTool({ name: paso.herramienta, arguments: args }); const d = r.structuredContent || {}; textoTotal.push(JSON.stringify(d)); resultados.push({ i, herramienta: paso.herramienta, error: r.isError ? d.error || 'ERROR' : null }); if (paso.guardar) memoria[paso.guardar] = d;
      if (paso.espera_error && !r.isError) resultados.at(-1).fallo = 'se esperaba un error tipificado'; if (paso.espera_error && r.isError && d.error !== paso.espera_error) resultados.at(-1).fallo = `error ${d.error} ≠ ${paso.espera_error}`; if (!paso.espera_error && r.isError && !paso.tolera_error) resultados.at(-1).fallo = `error inesperado ${d.error}`;
    }
    const claims = []; for (const cn of caso.casos_ingenieria || []) { const r = await c.callTool({ name: 'tannia_cic_claims', arguments: { proyecto: P, caso: sub(cn) } }); claims.push(...(r.structuredContent?.claims || [])); }
    const dir = path.join(home, 'Proyectos', P); const archivos = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String) : []; const textoArchivos = []; for (const a of archivos) { const f = path.join(dir, a); if (fs.statSync(f).isFile() && /\.(md|txt|json|dxf)$/i.test(a)) textoArchivos.push(fs.readFileSync(f, 'utf8')); }
    const todo = `${textoTotal.join('\n')}\n${textoArchivos.join('\n')}`; const ev = { numeros: [], artefactos: [], incertidumbre: [], prohibidos: [], contradicciones: [], brechas: [] };
    for (const e of caso.esperados || []) {
      if (e.tipo === 'numero') { const cl = claims.find((x) => new RegExp(e.claim).test(x.texto) && (!e.estado || x.estado === e.estado)); const ok = !!cl && typeof cl.valor === 'number' && Math.abs(cl.valor - e.valor) <= (e.tol_rel ?? 1e-9) * Math.max(1, Math.abs(e.valor)); ev.numeros.push({ id: e.id, ok, obtenido: cl?.valor ?? null, esperado: e.valor, critico: !!e.critico }); }
      else if (e.tipo === 'artefacto') { const m = archivos.find((a) => new RegExp(e.ruta_regex).test(a)); let ok = !!m; if (ok && e.min_bytes) ok = fs.statSync(path.join(dir, m)).size >= e.min_bytes; ev.artefactos.push({ id: e.id, ok, ruta: m || null }); }
      else if (e.tipo === 'incertidumbre') ev.incertidumbre.push({ id: e.id, ok: new RegExp(e.debe_aparecer, 'i').test(todo) });
      else if (e.tipo === 'prohibido') ev.prohibidos.push({ id: e.id, ok: !new RegExp(e.regex, 'i').test(todo), critico: true });
      else if (e.tipo === 'contradiccion') ev.contradicciones.push({ id: e.id, ok: new RegExp(e.debe_aparecer, 'i').test(todo) });
      else if (e.tipo === 'brecha') ev.brechas.push({ id: e.id, ok: new RegExp(e.debe_aparecer, 'i').test(todo) });
    }
    return { id: caso.id, tipo: caso.tipo, ms: Date.now() - t0, pasos: resultados, fallos_de_paso: resultados.filter((r) => r.fallo).length, evidencia: ev, ids_claims: claims.map((x) => x.id).sort() };
  } finally { await c.close(); fs.rmSync(home, { recursive: true, force: true }); }
}
const frac = (a) => (a.length ? a.filter((x) => x.ok).length / a.length : 1);
export function consolidar(casosRes, rubrica = {}) {
  const ev = (k) => casosRes.flatMap((c) => c.evidencia[k]); const num = ev('numeros');
  const m = { precision_numerica: frac(num), errores_criticos: num.filter((x) => !x.ok && x.critico).length, artefactos: frac(ev('artefactos')), incertidumbre_senalada: frac(ev('incertidumbre')), valores_criticos_inventados: ev('prohibidos').filter((x) => !x.ok).length, contradicciones_detectadas: frac(ev('contradicciones')), brechas_justificadas: frac(ev('brechas')), fallos_de_paso: casosRes.reduce((a, c) => a + c.fallos_de_paso, 0) };
  const u = Object.values(rubrica.utilidad || {}); m.utilidad_media = u.length ? u.reduce((a, b) => a + b, 0) / u.length : null; m.utilidad_minima = u.length ? Math.min(...u) : null;
  const incumple = []; if (m.precision_numerica < UMBRALES.precision_numerica) incumple.push('precision_numerica'); if (m.errores_criticos > 0) incumple.push('errores_criticos'); if (m.artefactos < UMBRALES.artefactos) incumple.push('artefactos'); if (m.incertidumbre_senalada < UMBRALES.incertidumbre_senalada) incumple.push('incertidumbre_senalada');
  if (m.valores_criticos_inventados > 0) incumple.push('valores_criticos_inventados (FALLA DURA)'); if (m.contradicciones_detectadas < UMBRALES.contradicciones_detectadas) incumple.push('contradicciones_detectadas'); if (m.brechas_justificadas < UMBRALES.brechas_justificadas) incumple.push('brechas_justificadas'); if (m.fallos_de_paso) incumple.push('fallos_de_paso');
  if (m.utilidad_media === null) incumple.push('utilidad: falta la rúbrica del revisor (no la calcula el código)'); else { if (m.utilidad_media < UMBRALES.utilidad_media) incumple.push('utilidad_media'); if (m.utilidad_minima < UMBRALES.utilidad_minima) incumple.push('utilidad_minima'); }
  return { metricas: m, umbrales: UMBRALES, incumple, veredicto_automatico: incumple.length ? 'NO_CUMPLE_O_INCOMPLETO' : 'CUMPLE_UMBRALES_AUTOMATICOS', nota: 'Este veredicto NO es una aprobación: G10 solo la concede el revisor independiente sobre casos retenidos, y la decisión final es del Product Owner.' };
}
export async function evaluarCarpeta(dir, { entry = path.join(ROOT, 'src', 'main.js'), compromiso = null, rubrica = {} } = {}) {
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'rubrica.json').sort(); const hashes = {}; const problemas = [];
  for (const f of archivos) hashes[f] = sha(fs.readFileSync(path.join(dir, f)));
  if (compromiso) { const esp = Object.fromEntries(fs.readFileSync(compromiso, 'utf8').split('\n').filter(Boolean).map((l) => { const [h, n] = l.trim().split(/\s+/); return [n, h]; })); for (const f of archivos) if (esp[f] !== hashes[f]) problemas.push(`caso ${f}: el hash no coincide con el compromiso del revisor`); for (const f of Object.keys(esp)) if (!archivos.includes(f)) problemas.push(`falta el caso comprometido ${f}`); }
  const res = []; if (!problemas.length) for (const f of archivos) { const caso = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); const a = await correrCaso(caso, { entry }); const b = await correrCaso(caso, { entry }); a.reproducible = JSON.stringify(a.ids_claims) === JSON.stringify(b.ids_claims); res.push(a); }
  const cons = consolidar(res, rubrica); cons.metricas.reproducibilidad = res.length ? res.filter((r) => r.reproducible).length / res.length : 1; if (cons.metricas.reproducibilidad < 1) cons.incumple.push('reproducibilidad');
  return { generado: new Date().toISOString(), servidor: entry, casos: res.map((r) => ({ id: r.id, tipo: r.tipo, reproducible: r.reproducible, fallos_de_paso: r.fallos_de_paso, evidencia: r.evidencia })), hashes_de_casos: hashes, problemas_de_integridad: problemas, ...cons };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const dir = arg('casos'); if (!dir) { console.error('Uso: node scripts/tw11-eval.mjs --casos <carpeta> [--compromiso hashes.txt] [--entry index.js] [--rubrica rubrica.json] [--salida informe.json]'); process.exit(2); }
  const rub = arg('rubrica') ? JSON.parse(fs.readFileSync(arg('rubrica'), 'utf8')) : {}; const inf = await evaluarCarpeta(dir, { entry: arg('entry') || path.join(ROOT, 'src', 'main.js'), compromiso: arg('compromiso'), rubrica: rub });
  if (arg('salida')) fs.writeFileSync(arg('salida'), JSON.stringify(inf, null, 2)); console.log(JSON.stringify({ veredicto: inf.veredicto_automatico, incumple: inf.incumple, metricas: inf.metricas, integridad: inf.problemas_de_integridad }, null, 2)); process.exit(inf.veredicto_automatico === 'CUMPLE_UMBRALES_AUTOMATICOS' ? 0 : 1);
}
