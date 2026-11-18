// Gate 5d / P0 (PR #38, PL-DXF-01/02): inspector INDEPENDIENTE del escritor que comprueba que un DXF AC1024 abre de forma
// utilizable: estructura completa, tablas y propietarios coherentes, extensiones que encierran la geometría, vista inicial
// *Active que la muestra entera, presentaciones con viewport general y viewports de contenido que ven geometría real.
// No sustituye la apertura en AutoCAD 2027 real (gate externo G11, NO VERIFICADO hasta ejecutarse).
const num = (v) => Number(v);
function pares(texto) { const l = String(texto).split(/\r?\n/); const out = []; for (let i = 0; i + 1 < l.length; i += 2) out.push([Number(l[i].trim()), l[i + 1].trim()]); return out; }

export function leerDxf(texto) {
  const P = pares(texto); const secciones = {}; let sec = null; let ent = null; let espera = false;
  for (const [c, v] of P) {
    if (c === 0 && v === 'SECTION') { espera = true; sec = null; ent = null; continue; }
    if (espera && c === 2) { sec = v; secciones[v] = []; espera = false; continue; }
    if (c === 0 && v === 'ENDSEC') { sec = null; ent = null; continue; }
    if (!sec) continue;
    if (c === 0) { ent = { tipo: v, g: [] }; secciones[sec].push(ent); } else if (ent) ent.g.push([c, v]);
  }
  return secciones;
}
const get = (e, c) => e.g.find(([k]) => k === c)?.[1];
const all = (e, c) => e.g.filter(([k]) => k === c).map(([, v]) => v);
const xd = (e, clave) => { const v = e.g.find(([k, x]) => k === 1000 && String(x).startsWith(`${clave}=`)); return v ? String(v[1]).slice(clave.length + 1) : null; };

/** Puntos representativos de una entidad del modelo (m). */
function puntos(e) {
  const p = (cx) => [num(get(e, cx)), num(get(e, cx + 10))];
  switch (e.tipo) {
    case 'LINE': return [p(10), p(11)];
    case 'CIRCLE': case 'ARC': { const c = p(10); const r = num(get(e, 40)); return [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]]; }
    case 'INSERT': return [p(10)];
    case 'DIMENSION': return [p(10), p(13), p(14)].filter((q) => q.every(Number.isFinite));
    case 'HATCH': { const xs = all(e, 10).map(Number).slice(1); const ys = all(e, 20).map(Number).slice(1); return xs.map((x, i) => [x, ys[i]]); }
    case 'LWPOLYLINE': { const xs = all(e, 10).map(Number); const ys = all(e, 20).map(Number); return xs.map((x, i) => [x, ys[i]]); }
    case 'TEXT': return [p(10)];
    default: return [];
  }
}

export function inspeccionarDxf(texto) {
  const S = leerDxf(texto); const problemas = []; const add = (codigo, detalle = '') => problemas.push({ codigo, detalle });
  for (const s of ['HEADER', 'CLASSES', 'TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS']) if (!S[s]) add('SECCION_FALTANTE', s);
  const H = {};
  // Cabecera: pares 9 → variables.
  { const P = pares(texto); let dentro = false; let v = null; for (const [c, x] of P) { if (c === 2 && x === 'HEADER') { dentro = true; continue; } if (dentro && c === 0) break; if (!dentro) continue; if (c === 9) { v = x; H[v] = {}; } else if (v) H[v][c] = x; } }
  if (H.$ACADVER?.[1] !== 'AC1024') add('VERSION', H.$ACADVER?.[1]);
  if (!H.$INSUNITS) add('SIN_UNIDADES');
  const tablas = {}; let actual = null; const handles = new Map(); const dup = [];
  for (const e of S.TABLES || []) {
    if (e.tipo === 'TABLE') { actual = { nombre: get(e, 2), h: get(e, 5), registros: [] }; tablas[actual.nombre] = actual; continue; }
    if (e.tipo === 'ENDTAB') { actual = null; continue; }
    if (actual) { actual.registros.push(e); const h = get(e, 5) ?? get(e, 105); if (get(e, 330) !== actual.h) add('PROPIETARIO_REGISTRO', `${e.tipo} ${get(e, 2)}`); if (h) { if (handles.has(h)) dup.push(h); handles.set(h, e); } }
  }
  for (const t of ['VPORT', 'LTYPE', 'LAYER', 'STYLE', 'VIEW', 'UCS', 'APPID', 'DIMSTYLE', 'BLOCK_RECORD']) if (!tablas[t]) add('TABLA_FALTANTE', t);
  const nombres = (t) => new Set((tablas[t]?.registros || []).map((e) => get(e, 2)));
  const capas = nombres('LAYER'); const ltypes = nombres('LTYPE'); const estilos = nombres('STYLE'); const dimst = nombres('DIMSTYLE'); const btr = new Map((tablas.BLOCK_RECORD?.registros || []).map((e) => [get(e, 2), e]));
  if (!capas.has('0')) add('CAPA_0_FALTANTE');
  for (const l of ['ByBlock', 'ByLayer', 'Continuous']) if (![...ltypes].some((x) => x.toLowerCase() === l.toLowerCase())) add('LTYPE_BASICO_FALTANTE', l);
  for (const e of tablas.LAYER?.registros || []) if (!ltypes.has(get(e, 6))) add('CAPA_SIN_LTYPE', `${get(e, 2)} → ${get(e, 6)}`);
  if (!(S.CLASSES || []).some((e) => get(e, 1) === 'LAYOUT')) add('CLASE_LAYOUT_FALTANTE');
  // Entidades: capas, estilos, bloques y propietarios.
  const btrH = new Map([...btr].map(([n, e]) => [get(e, 5), n]));
  const bloques = []; let blq = null; const contenidoBloque = new Map();
  for (const e of S.BLOCKS || []) { if (e.tipo === 'BLOCK') { blq = get(e, 2); contenidoBloque.set(blq, []); continue; } if (e.tipo === 'ENDBLK') { blq = null; continue; } if (blq) { contenidoBloque.get(blq).push(e); bloques.push({ e, blq }); } }
  const entidades = [...(S.ENTITIES || []).map((e) => ({ e, blq: null })), ...bloques];
  for (const { e } of entidades) {
    const h = get(e, 5); if (h) { if (handles.has(h)) dup.push(h); handles.set(h, e); }
    const capa = get(e, 8); if (capa !== undefined && !capas.has(capa)) add('CAPA_NO_DECLARADA', `${e.tipo} en ${capa}`);
    const lt = get(e, 6); if (lt && !ltypes.has(lt)) add('LTYPE_NO_DECLARADO', `${e.tipo} ${lt}`);
    if (!btrH.has(get(e, 330))) add('PROPIETARIO_ENTIDAD', `${e.tipo} ${h} → ${get(e, 330)}`);
    if (e.tipo === 'TEXT' && !estilos.has(get(e, 7) ?? 'Standard')) add('ESTILO_TEXTO_NO_DECLARADO', get(e, 7));
    if (e.tipo === 'TEXT' && !(num(get(e, 40)) > 0)) add('TEXTO_SIN_ALTURA', get(e, 1));
    if (e.tipo === 'DIMENSION') { if (!dimst.has(get(e, 3) ?? 'Standard')) add('DIMSTYLE_NO_DECLARADO', get(e, 3)); if (!btr.has(get(e, 2))) add('BLOQUE_COTA_FALTANTE', get(e, 2)); if (!(num(get(e, 42)) > 0)) add('COTA_SIN_MEDIDA', h); }
    if (e.tipo === 'INSERT' && !btr.has(get(e, 2))) add('BLOQUE_INSERTADO_FALTANTE', get(e, 2));
  }
  if (dup.length) add('HANDLE_DUPLICADO', dup.slice(0, 5).join(','));
  const maxH = Math.max(...[...handles.keys()].map((h) => parseInt(h, 16)).filter(Number.isFinite));
  if (!(parseInt(H.$HANDSEED?.[5] || '0', 16) > maxH)) add('HANDSEED_INVALIDO', `${H.$HANDSEED?.[5]} ≤ ${maxH.toString(16)}`);
  // OBJECTS: diccionarios y layouts.
  const obj = S.OBJECTS || []; const raiz = obj.find((e) => e.tipo === 'DICTIONARY' && get(e, 330) === '0');
  const claves = raiz ? all(raiz, 3) : []; for (const k of ['ACAD_GROUP', 'ACAD_LAYOUT', 'ACAD_MLINESTYLE', 'ACAD_PLOTSTYLENAME']) if (!claves.includes(k)) add('DICCIONARIO_FALTANTE', k);
  const layouts = obj.filter((e) => e.tipo === 'LAYOUT').map((e) => ({ nombre: all(e, 1)[1] ?? all(e, 1)[0], h: get(e, 5), tab: num(all(e, 71).pop()), btr: all(e, 330).pop() }));
  for (const l of layouts) { const b = btrH.get(l.btr); if (!b) add('LAYOUT_SIN_BLOQUE', l.nombre); else if (get(btr.get(b), 340) !== l.h) add('BLOQUE_SIN_LAYOUT', `${b} ↔ ${l.nombre}`); l.bloque = b; }
  if (!layouts.some((l) => l.nombre === 'Model')) add('LAYOUT_MODEL_FALTANTE');
  // Geometría del modelo y extensiones.
  const modelo = (S.ENTITIES || []).filter((e) => get(e, 67) !== '1');
  const pts = modelo.flatMap(puntos).filter((p) => p.every(Number.isFinite));
  if (!pts.length) add('MODELO_VACIO');
  const real = pts.length ? { min: [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))], max: [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))] } : null;
  const ext = H.$EXTMIN && H.$EXTMAX ? { min: [num(H.$EXTMIN[10]), num(H.$EXTMIN[20])], max: [num(H.$EXTMAX[10]), num(H.$EXTMAX[20])] } : null;
  if (!ext || ![...ext.min, ...ext.max].every(Number.isFinite)) add('EXTENSIONES_AUSENTES');
  else if (real && (real.min[0] < ext.min[0] - 1e-6 || real.min[1] < ext.min[1] - 1e-6 || real.max[0] > ext.max[0] + 1e-6 || real.max[1] > ext.max[1] + 1e-6)) add('EXTENSIONES_NO_ENCIERRAN', JSON.stringify({ real, ext }));
  // Ocupación: fracción del encuadre cubierta por las cajas de las vistas (XDATA vista=). Una extensión inflada por vistas muy
  // separadas (UAT: Y = 0…5007 m) deja todo diminuto al abrir.
  const porVista = new Map(); for (const e of modelo) { const v = xd(e, 'vista') ?? (xd(e, 'ir') || '').replace(/^[a-z]+:/, '').split('/')[0]; if (!v) continue; for (const p of puntos(e)) if (p.every(Number.isFinite)) { const b = porVista.get(v) || { min: [...p], max: [...p] }; b.min = [Math.min(b.min[0], p[0]), Math.min(b.min[1], p[1])]; b.max = [Math.max(b.max[0], p[0]), Math.max(b.max[1], p[1])]; porVista.set(v, b); } }
  const areaVistas = [...porVista.values()].reduce((s, b) => s + (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]), 0);
  const areaReal = real ? (real.max[0] - real.min[0]) * (real.max[1] - real.min[1]) : 0; const ocupacion = areaReal > 0 ? areaVistas / areaReal : 0;
  if (real && ocupacion < 0.1) add('ENCUADRE_DISPERSO', `las vistas ocupan ${(ocupacion * 100).toFixed(2)} % de la extensión del modelo`);
  // Vista inicial *Active: debe existir y mostrar la extensión completa.
  const act = (tablas.VPORT?.registros || []).find((e) => get(e, 2)?.toUpperCase() === '*ACTIVE');
  if (!act) add('VPORT_ACTIVE_FALTANTE');
  else {
    const c = [num(get(act, 12)), num(get(act, 22))]; const h = num(get(act, 40)); const asp = num(get(act, 41));
    if (![...c, h, asp].every(Number.isFinite) || !(h > 0) || !(asp > 0)) add('VPORT_ACTIVE_SIN_ENCUADRE');
    else if (real && (Math.abs(c[0] - (real.min[0] + real.max[0]) / 2) * 2 + (real.max[0] - real.min[0]) > h * asp * 1.0001 + 1e-6 || Math.abs(c[1] - (real.min[1] + real.max[1]) / 2) * 2 + (real.max[1] - real.min[1]) > h * 1.0001 + 1e-6)) add('VISTA_INICIAL_NO_MUESTRA_TODO', JSON.stringify({ c, h, asp, real }));
  }
  // Presentaciones: viewport general + viewports de contenido que ven geometría.
  const activo = layouts.find((l) => l.tab === 1);
  const papel = (S.ENTITIES || []).filter((e) => get(e, 67) === '1');
  if (activo && (contenidoBloque.get('*Paper_Space') || []).length) add('PAPEL_ACTIVO_EN_BLOQUE', 'las entidades del layout activo deben estar en ENTITIES');
  if (activo && papel.some((e) => get(e, 410) !== activo.nombre)) add('PAPEL_ACTIVO_MEZCLADO');
  const resumen = [];
  for (const l of layouts.filter((x) => x.nombre !== 'Model').sort((a, b) => a.tab - b.tab)) {
    const ents = l === activo ? papel : (contenidoBloque.get(l.bloque) || []);
    const vps = ents.filter((e) => e.tipo === 'VIEWPORT'); const ids = vps.map((v) => num(get(v, 69)));
    if (!vps.length || ids[0] !== 1) add('VIEWPORT_GENERAL_FALTANTE', l.nombre);
    const contenido = vps.filter((v) => num(get(v, 69)) !== 1);
    if (!contenido.length) add('LAYOUT_SIN_VIEWPORT', l.nombre);
    const vistos = contenido.map((v) => {
      const c = [num(get(v, 12)), num(get(v, 22))]; const vh = num(get(v, 45)); const asp = num(get(v, 40)) / num(get(v, 41)); const st = num(get(v, 90)) || 0;
      if (num(get(v, 68)) <= 0 || (st & 131072)) add('VIEWPORT_APAGADO', `${l.nombre} #${get(v, 69)}`);
      const dentro = pts.filter((p) => Math.abs(p[0] - c[0]) <= (vh * asp) / 2 && Math.abs(p[1] - c[1]) <= vh / 2).length;
      if (!dentro) add('VIEWPORT_SIN_GEOMETRIA', `${l.nombre} #${get(v, 69)}`);
      return { id: num(get(v, 69)), puntos_visibles: dentro };
    });
    if (!ents.some((e) => e.tipo === 'TEXT')) add('LAYOUT_SIN_ANOTACION', l.nombre);
    resumen.push({ nombre: l.nombre, tab: l.tab, entidades: ents.length, viewports: vistos });
  }
  if (layouts.filter((x) => x.nombre !== 'Model').length === 0) add('SIN_PRESENTACIONES');
  return { ok: problemas.length === 0, problemas, metricas: { entidades_modelo: modelo.length, extension: real, extmin_extmax: ext, ocupacion_encuadre: ocupacion, presentaciones: resumen, vista_inicial: act ? { centro: [num(get(act, 12)), num(get(act, 22))], altura: num(get(act, 40)) } : null }, alcance: 'Estructural e independiente del escritor. La apertura real en AutoCAD 2027 sigue siendo gate externo (NO VERIFICADO).' };
}
