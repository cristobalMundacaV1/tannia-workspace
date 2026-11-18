// G1 / PL-03..08 (issue #32): verificación INDEPENDIENTE del DXF generado contra el modelo canónico.
// No reutiliza el escritor: lee el texto DXF con un analizador propio y compara entidad por entidad
// (tipo, capa, coordenadas), cotas (valor físico frente a distancia dibujada × DIMLFAC), duplicados
// de cotas en papel y tipos de línea. Cualquier error deliberado de escala, entidad o cota la hace fallar.
import { capasDe, patronLinea, colocacionDe } from './model.js';
import { buildIR } from './ir.js';
import { paridadDxf } from './paridad.js';

const TOL = 1e-6;

/** Analiza un DXF ASCII en secciones → lista de entidades {tipo, codigos: [[c, v]]}. */
export function analizarDxf(texto) {
  const l = String(texto).split(/\r?\n/); const pares = [];
  for (let i = 0; i + 1 < l.length; i += 2) pares.push([Number(l[i].trim()), l[i + 1]]);
  const secciones = {}; let actual = null; let ent = null;
  for (const [c, v] of pares) {
    if (c === 0 && v === 'SECTION') { actual = null; ent = null; continue; }
    if (c === 2 && actual === null && ent === null) { actual = v; secciones[v] = []; continue; }
    if (c === 0 && v === 'ENDSEC') { actual = null; ent = null; continue; }
    if (!actual) continue;
    if (c === 0) { ent = { tipo: v, codigos: [] }; secciones[actual].push(ent); continue; }
    if (ent) ent.codigos.push([c, v]);
  }
  return secciones;
}
const g = (e, c) => { const p = e.codigos.find(([k]) => k === c); return p ? p[1] : undefined; };
const n = (e, c) => Number(g(e, c));
const todos = (e, c) => e.codigos.filter(([k]) => k === c).map(([, v]) => v);
const r6 = (x) => (Math.abs(x) < 5e-7 ? 0 : Math.round(x * 1e6) / 1e6).toFixed(6);
const ang = (a) => r6(((a % 360) + 360) % 360);

/** Firmas esperadas a partir del modelo (colocación documentada en la composición —colocacionModelo—; Y × exageración). */
const transformador = (composition) => { const T = new Map(); const off = colocacionDe(composition); composition.model.views.forEach((v) => { const ex = v.verticalScale ? v.scale / v.verticalScale : 1; const o = off[v.id]; T.set(v.id, (p) => [p[0] + o[0], p[1] * ex + o[1]]); }); return T; };
// Identidad (XDATA TANNIA_TRACE): forma parte de la firma; geometría idéntica con ref/elemento/vista/rol alterados NO coincide.
const trazaModelo = (e, vista) => (e.ref ? `|elemento=${e.element}|vista=${vista}|rol=${e.role}|ref=${e.ref}` : '');
function trazaDxf(e) {
  const i = e.codigos.findIndex(([c, v]) => c === 1001 && v === 'TANNIA_TRACE'); if (i < 0) return '';
  const vals = []; for (let k = i + 1; k < e.codigos.length && e.codigos[k][0] === 1000; k++) vals.push(e.codigos[k][1]); return vals.length ? `|${vals.join('|')}` : '';
}
function esperadas(composition) {
  const model = composition.model; const out = []; const T = transformador(composition);
  for (const v of model.views) {
    const P = T.get(v.id);
    for (const e of v.entities) {
      const t = trazaModelo(e, v.id);
      if (e.kind === 'line') { const a = P(e.a); const b = P(e.b); out.push(`LINE|${e.layer}|${r6(a[0])},${r6(a[1])}|${r6(b[0])},${r6(b[1])}${t}`); }
      else if (e.end - e.start >= 360) { const c = P(e.center); out.push(`CIRCLE|${e.layer}|${r6(c[0])},${r6(c[1])}|${r6(e.radius)}${t}`); }
      else { const c = P(e.center); out.push(`ARC|${e.layer}|${r6(c[0])},${r6(c[1])}|${r6(e.radius)}|${ang(e.start)}|${ang(e.end)}${t}`); }
    }
  }
  return out;
}
function firmaDxf(e) {
  const capa = g(e, 8); const t = trazaDxf(e);
  if (e.tipo === 'LINE') return `LINE|${capa}|${r6(n(e, 10))},${r6(n(e, 20))}|${r6(n(e, 11))},${r6(n(e, 21))}${t}`;
  if (e.tipo === 'CIRCLE') return `CIRCLE|${capa}|${r6(n(e, 10))},${r6(n(e, 20))}|${r6(n(e, 40))}${t}`;
  if (e.tipo === 'ARC') return `ARC|${capa}|${r6(n(e, 10))},${r6(n(e, 20))}|${r6(n(e, 40))}|${ang(n(e, 50))}|${ang(n(e, 51))}${t}`;
  return null;
}
const multiset = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());

/** @returns {{ok:boolean, problemas:string[], resumen:object}} */
export function verificarDxfContraModelo(dxf, composition) {
  const model = composition.model; const S = analizarDxf(dxf); const problemas = [];
  const todas = [...(S.ENTITIES || []), ...(S.BLOCKS || [])]; const ents = (S.ENTITIES || []).filter((e) => g(e, 67) !== '1'); const bloques = todas;
  // 1) Geometría: el espacio modelo contiene EXACTAMENTE las entidades del modelo (multiconjunto de firmas).
  const esp = multiset(esperadas(composition)); const obt = multiset(ents.map(firmaDxf).filter(Boolean));
  for (const [k, c] of esp) if ((obt.get(k) || 0) !== c) problemas.push(`entidad esperada ${c}× y presente ${obt.get(k) || 0}×: ${k}`);
  for (const [k, c] of obt) if (!esp.has(k)) problemas.push(`entidad no esperada (${c}×): ${k}`);
  if (ents.some((e) => e.tipo === 'ARC' && Math.abs(((n(e, 51) - n(e, 50)) % 360)) < TOL)) problemas.push('círculo completo emitido como ARC de 360°');
  // 2) Cotas: una DIMENSION por cota del modelo; valor físico = distancia dibujada × DIMLFAC.
  const dims = ents.filter((e) => e.tipo === 'DIMENSION'); const nDims = model.views.reduce((t, v) => t + v.dimensions.length, 0);
  if (dims.length !== nDims) problemas.push(`cotas nativas ${dims.length} ≠ cotas del modelo ${nDims}`);
  let k = 0; const T = transformador(composition);
  const cerca = (e, cx, cy, p) => Math.abs(n(e, cx) - p[0]) <= TOL && Math.abs(n(e, cy) - p[1]) <= TOL;
  model.views.forEach((v) => v.dimensions.forEach((d) => {
    const e = dims[k++]; if (!e) return; const P = T.get(v.id);
    // Anclajes: cada cota se asocia a su vista/orden y sus puntos de definición deben ser los del modelo transformados.
    if (d.kind === 'linear' && (!cerca(e, 13, 23, P(d.a)) || !cerca(e, 14, 24, P(d.b)))) problemas.push(`cota ${v.id}/${d.id ?? k}: anclajes (${n(e, 13)}, ${n(e, 23)})–(${n(e, 14)}, ${n(e, 24)}) ≠ modelo ${P(d.a)}–${P(d.b)}`);
    if (d.kind === 'radial' && !cerca(e, 10, 20, P(d.center))) problemas.push(`cota radial ${v.id}/${d.id ?? k}: centro (${n(e, 10)}, ${n(e, 20)}) ≠ modelo ${P(d.center)}`);
    if (d.kind === 'radial') { const a = (d.angle * Math.PI) / 180; const c = P(d.center); const tip = [c[0] + d.radius * Math.cos(a), c[1] + d.radius * Math.sin(a)]; if (!cerca(e, 15, 25, tip)) problemas.push(`cota radial ${v.id}/${d.id ?? k}: punto en el arco ≠ modelo`); }
    const lfacIdx = e.codigos.findIndex(([c, x]) => c === 1070 && Number(x) === 144); const lfac = lfacIdx >= 0 ? Number(e.codigos[lfacIdx + 1][1]) : 1;
    if (d.kind === 'linear') {
      const geom = Math.hypot(n(e, 14) - n(e, 13), n(e, 24) - n(e, 23));
      if (Math.abs(geom * lfac - d.value) > 1e-6 * Math.max(1, d.value)) problemas.push(`cota ${v.id}#${k}: distancia dibujada ${geom} × DIMLFAC ${lfac} ≠ valor ${d.value}`);
    } else if (Math.abs(n(e, 42) - d.value) > 1e-6) problemas.push(`cota radial ${v.id}#${k}: ${n(e, 42)} ≠ ${d.value}`);
  }));
  // 3) Sin duplicados en papel: ningún texto de papel repite el rótulo de una cota (las cotas las muestra el viewport).
  const enPapel = bloques.filter((e) => g(e, 67) === '1' && e.tipo === 'TEXT').map((e) => g(e, 1));
  const rotulos = new Set(model.views.flatMap((v) => v.dimensions.map((d) => d.kind === 'radial' ? `R ${d.value}` : `${d.value}`)));
  const dup = enPapel.filter((t) => /^R? ?[\d.,]+ m$/.test(t || '') || (/ m$/.test(t || '') && rotulos.has(String(t).replace(/ m$/, '').replace(',', '.'))));
  if (dup.length) problemas.push(`cotas duplicadas como texto en el papel: ${dup.slice(0, 5).join(' | ')}`);
  // 4) Tipos de línea: cada capa referencia el patrón declarado; el patrón existe con sus elementos exactos.
  const tabla = (S.TABLES || []); const lts = new Map(tabla.filter((e) => e.tipo === 'LTYPE').map((e) => [g(e, 2), todos(e, 49).map(Number)]));
  const C = capasDe(model);
  for (const capa of tabla.filter((e) => e.tipo === 'LAYER')) {
    const nombre = g(capa, 2); if (!C[nombre]) continue; const pat = patronLinea(nombre, C[nombre]);
    if (g(capa, 6) !== pat.nombre) problemas.push(`capa ${nombre}: tipo de línea ${g(capa, 6)} ≠ ${pat.nombre}`);
    else if (pat.elementos.length && JSON.stringify(lts.get(pat.nombre)) !== JSON.stringify(pat.elementos)) problemas.push(`tipo de línea ${pat.nombre}: elementos ${JSON.stringify(lts.get(pat.nombre))} ≠ ${JSON.stringify(pat.elementos)}`);
  }
  // 5) Regiones y símbolos (PR #38): un HATCH por región declarada y un INSERT por símbolo del modelo, cada uno con su id de IR.
  const irDe = (e) => { const i = e.codigos.findIndex(([c, v]) => c === 1000 && String(v).startsWith('ir=')); return i >= 0 ? String(e.codigos[i][1]).slice(3) : null; };
  const regiones = model.views.flatMap((v) => (v.regions || []).map((r) => `hatch:${v.id}/${r.id}`)); const hatches = ents.filter((e) => e.tipo === 'HATCH').map(irDe);
  for (const r of regiones) if (!hatches.includes(r)) problemas.push(`región sin HATCH en el modelo: ${r}`);
  for (const h of hatches) if (!regiones.includes(h)) problemas.push(`HATCH no declarado: ${h}`);
  const simbolos = model.views.flatMap((v) => (v.symbols || []).map((x) => `sym:${v.id}/${x.id}`)); const inserts = ents.filter((e) => e.tipo === 'INSERT').map(irDe);
  for (const x of simbolos) if (!inserts.includes(x)) problemas.push(`símbolo sin INSERT en el modelo: ${x}`);
  // 6) Composición tw.sheets/2: el papel completo (cuadros, leyendas, llamadas, cajetín) se contrasta con la IR por id y capa.
  if (composition.schema === 'tw.sheets/2') { const par = paridadDxf(buildIR(composition), dxf); for (const p of par.problemas) problemas.push(`paridad IR: ${p}`); }
  return { ok: problemas.length === 0, problemas, resumen: { entidades_modelo: [...esp.values()].reduce((a, b) => a + b, 0), cotas: dims.length, tipos_de_linea: lts.size, hatch: hatches.length, simbolos: inserts.length } };
}
