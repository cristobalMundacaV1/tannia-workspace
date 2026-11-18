// Lector DXF ASCII propio (sin dependencias). Solo lectura; nunca escribe.
// Produce entidades crudas con grupos de código; la geometría se interpreta en geometry.js.

export class DxfError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const INSUNITS = {
  0: 'sin_unidades', 1: 'pulgadas', 2: 'pies', 3: 'millas', 4: 'mm', 5: 'cm', 6: 'm', 7: 'km',
  8: 'micropulgadas', 9: 'mils', 10: 'yardas', 11: 'angstrom', 12: 'nm', 13: 'micras', 14: 'dm',
  15: 'dam', 16: 'hm', 17: 'gm', 18: 'ua', 19: 'años_luz', 20: 'parsec',
};
// metros por unidad (solo las usadas en construcción)
export const METERS_PER_UNIT = { mm: 0.001, cm: 0.01, dm: 0.1, m: 1, km: 1000, pulgadas: 0.0254, pies: 0.3048 };

export function readPairs(text) {
  const lines = text.split(/\r\n|\n|\r/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    if (!Number.isFinite(code) || !/^\s*-?\d+\s*$/.test(lines[i])) {
      throw new DxfError('DXF_CORRUPTO', `Código de grupo inválido en la línea ${i + 1}.`);
    }
    pairs.push({ c: code, v: lines[i + 1].replace(/^\s+|\s+$/g, ''), line: i + 1 });
  }
  return pairs;
}

const num = (v, line) => {
  const n = Number(v);
  if (!Number.isFinite(n) || v === '') throw new DxfError('DXF_CORRUPTO', `Valor numérico inválido "${v}" (línea ${line}).`);
  return n;
};

// Agrupa pares en entidades: cada código 0 inicia una entidad.
function groupEntities(pairs, start, endIdx) {
  const out = [];
  let cur = null;
  for (let i = start; i < endIdx; i++) {
    const p = pairs[i];
    if (p.c === 0) { cur = { type: p.v, pairs: [] }; out.push(cur); }
    else if (cur) cur.pairs.push(p);
  }
  return out;
}

const first = (e, code) => { const p = e.pairs.find((q) => q.c === code); return p ? p.v : undefined; };
const firstNum = (e, code, d) => { const p = e.pairs.find((q) => q.c === code); return p ? num(p.v, p.line) : d; };

function point(e, bx = 10, by = 20, bz = 30) {
  return { x: firstNum(e, bx, 0), y: firstNum(e, by, 0), z: firstNum(e, bz, 0) };
}

/** Traza TANNIA (XDATA): vincula la entidad gráfica con vista, elemento físico y rol. Solo texto; nunca se ejecuta. */
export const APP_TRAZA = 'TANNIA_TRACE';
function parseTraza(raw) {
  let dentro = false; const t = {};
  for (const p of raw.pairs) {
    if (p.c === 1001) dentro = p.v === APP_TRAZA;
    else if (dentro && p.c === 1000) { const i = p.v.indexOf('='); if (i > 0) t[p.v.slice(0, i)] = p.v.slice(i + 1).slice(0, 200); }
  }
  return Object.keys(t).length ? { elemento: t.elemento || null, vista: t.vista || null, rol: t.rol || null, ref: t.ref || null } : null;
}

// Convierte una entidad cruda en un objeto estructurado.
export function buildEntity(raw, following = []) {
  const t = raw.type;
  const base = {
    type: t,
    handle: first(raw, 5) || null,
    layer: first(raw, 8) || '0',
    traza: parseTraza(raw),
    paper: String(first(raw, 67) ?? '').trim() === '1',
    extrusion: { x: firstNum(raw, 210, 0), y: firstNum(raw, 220, 0), z: firstNum(raw, 230, 1) },
  };
  switch (t) {
    case 'LINE':
      return { ...base, a: point(raw, 10, 20, 30), b: point(raw, 11, 21, 31) };
    case 'CIRCLE':
      return { ...base, c: point(raw), r: firstNum(raw, 40, NaN) };
    case 'ARC':
      return { ...base, c: point(raw), r: firstNum(raw, 40, NaN), a0: firstNum(raw, 50, 0), a1: firstNum(raw, 51, 0) };
    case 'LWPOLYLINE': {
      const verts = [];
      let cur = null;
      for (const p of raw.pairs) {
        if (p.c === 10) { cur = { x: num(p.v, p.line), y: 0, bulge: 0 }; verts.push(cur); }
        else if (p.c === 20 && cur) cur.y = num(p.v, p.line);
        else if (p.c === 42 && cur) cur.bulge = num(p.v, p.line);
      }
      const flags = firstNum(raw, 70, 0);
      return { ...base, verts, closed: (flags & 1) === 1, elevation: firstNum(raw, 38, 0) };
    }
    case 'INSERT':
      return {
        ...base, name: first(raw, 2), p: point(raw),
        sx: firstNum(raw, 41, 1), sy: firstNum(raw, 42, 1), sz: firstNum(raw, 43, 1),
        rot: firstNum(raw, 50, 0), cols: firstNum(raw, 70, 1), rows: firstNum(raw, 71, 1),
        dx: firstNum(raw, 44, 0), dy: firstNum(raw, 45, 0),
      };
    case '3DFACE': {
      const pts = [0, 1, 2, 3].map((k) => point(raw, 10 + k, 20 + k, 30 + k));
      return { ...base, pts };
    }
    case 'TEXT': case 'MTEXT':
      return { ...base, text: raw.pairs.filter((p) => p.c === 1 || p.c === 3).map((p) => p.v).join(''),
        p: point(raw), altura: firstNum(raw, 40, 0), rot: firstNum(raw, 50, 0), just: firstNum(raw, 72, 0), alin: point(raw, 11, 21, 31) };
    case 'MESH': {
      // Datos SubD: 92 = nº vértices, luego 10/20/30; 93 = tamaño lista de caras, luego 90 (n, idx...)
      const pairs = raw.pairs;
      let i = pairs.findIndex((p) => p.c === 92);
      const verts = [];
      const faces = [];
      if (i >= 0) {
        const nv = num(pairs[i].v, pairs[i].line);
        i++;
        while (verts.length < nv && i + 2 < pairs.length + 1) {
          if (pairs[i].c === 10) { verts.push({ x: num(pairs[i].v, pairs[i].line), y: num(pairs[i + 1].v, pairs[i + 1].line), z: num(pairs[i + 2].v, pairs[i + 2].line) }); i += 3; } else i++;
        }
        const j = pairs.findIndex((p, k) => k >= i && p.c === 93);
        if (j >= 0) {
          let k = j + 1; // lista de enteros con código 90
          const ints = [];
          for (; k < pairs.length; k++) { if (pairs[k].c === 90) ints.push(num(pairs[k].v, pairs[k].line)); else if (ints.length && pairs[k].c !== 90) break; }
          let q = 0;
          while (q < ints.length) { const n = ints[q++]; faces.push(ints.slice(q, q + n)); q += n; }
        }
      }
      return { ...base, verts, faces };
    }
    case 'POLYLINE': {
      const flags = firstNum(raw, 70, 0);
      const verts = [];
      const faces = [];
      for (const v of following) {
        const vf = firstNum(v, 70, 0);
        const rec = { x: firstNum(v, 10, 0), y: firstNum(v, 20, 0), z: firstNum(v, 30, 0), bulge: firstNum(v, 42, 0), flags: vf };
        if ((flags & 64) && (vf & 128) && !(vf & 64)) {
          faces.push([firstNum(v, 71, 0), firstNum(v, 72, 0), firstNum(v, 73, 0), firstNum(v, 74, 0)].filter((x) => x !== 0).map((x) => Math.abs(x) - 1));
        } else verts.push(rec);
      }
      return { ...base, verts, faces, closed: (flags & 1) === 1, poly3d: (flags & 8) === 8, polygonMesh: (flags & 16) === 16, polyface: (flags & 64) === 64, elevation: firstNum(raw, 30, 0) };
    }
    default:
      return { ...base, unsupported: true };
  }
}

function buildList(rawList) {
  const out = [];
  for (let i = 0; i < rawList.length; i++) {
    const r = rawList[i];
    if (r.type === 'VERTEX' || r.type === 'SEQEND') continue;
    if (r.type === 'POLYLINE') {
      const following = [];
      let j = i + 1;
      while (j < rawList.length && rawList[j].type === 'VERTEX') { following.push(rawList[j]); j++; }
      out.push(buildEntity(r, following));
      i = j - 1;
    } else out.push(buildEntity(r));
  }
  return out;
}

export function parseDxf(input) {
  if (typeof input !== 'string') input = Buffer.from(input).toString('utf8');
  if (input.startsWith('AutoCAD Binary DXF')) throw new DxfError('DXF_BINARIO', 'El DXF es binario; guarde como DXF ASCII o use el adaptador AutoCAD.');
  if (input.includes('\u0000')) throw new DxfError('NO_ES_DXF', 'El archivo no parece un DXF de texto.');
  const pairs = readPairs(input);
  if (!pairs.length) throw new DxfError('DXF_VACIO', 'El archivo está vacío.');
  if (!(pairs[0].c === 0 && pairs[0].v === 'SECTION')) throw new DxfError('NO_ES_DXF', 'No se encontró la estructura DXF (SECTION).');
  const sections = {};
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].c === 0 && pairs[i].v === 'SECTION' && pairs[i + 1] && pairs[i + 1].c === 2) {
      const name = pairs[i + 1].v;
      let j = i + 2;
      while (j < pairs.length && !(pairs[j].c === 0 && pairs[j].v === 'ENDSEC')) j++;
      if (j >= pairs.length) throw new DxfError('DXF_CORRUPTO', `La sección ${name} no termina (falta ENDSEC).`);
      sections[name] = [i + 2, j];
      i = j;
    }
  }
  if (!sections.ENTITIES) throw new DxfError('DXF_CORRUPTO', 'Falta la sección ENTITIES.');

  const header = {};
  if (sections.HEADER) {
    const [s, e] = sections.HEADER;
    for (let i = s; i < e; i++) {
      if (pairs[i].c === 9) {
        const vars = pairs[i].v;
        const vals = [];
        let j = i + 1;
        while (j < e && pairs[j].c !== 9) { vals.push(pairs[j]); j++; }
        header[vars] = vals.length === 1 ? vals[0].v : vals.map((p) => p.v);
      }
    }
  }
  const insunits = header.$INSUNITS !== undefined ? Number(header.$INSUNITS) : 0;
  const layers = [];
  if (sections.TABLES) {
    const [s, e] = sections.TABLES;
    for (const ent of groupEntities(pairs, s, e)) if (ent.type === 'LAYER') layers.push(first(ent, 2));
  }
  const blocks = {};
  if (sections.BLOCKS) {
    const [s, e] = sections.BLOCKS;
    const all = groupEntities(pairs, s, e);
    let cur = null;
    for (const r of all) {
      if (r.type === 'BLOCK') { cur = { name: first(r, 2), base: { x: firstNum(r, 10, 0), y: firstNum(r, 20, 0), z: firstNum(r, 30, 0) }, raw: [] }; blocks[cur.name] = cur; }
      else if (r.type === 'ENDBLK') cur = null;
      else if (cur) cur.raw.push(r);
    }
    for (const b of Object.values(blocks)) { b.entities = buildList(b.raw); delete b.raw; }
  }
  const [s, e] = sections.ENTITIES;
  // Solo el ESPACIO MODELO se mide: las entidades de papel (código 67 = 1: cajetín, cuadros, leyendas del layout activo, que
  // AutoCAD y este motor escriben en ENTITIES) se separan y nunca entran a una cubicación.
  const todas = buildList(groupEntities(pairs, s, e)); const entities = todas.filter((x) => !x.paper); const paperEntities = todas.filter((x) => x.paper);
  return {
    paperEntities,
    version: header.$ACADVER || null,
    insunits,
    insunitsName: INSUNITS[insunits] || `desconocido(${insunits})`,
    layers, blocks, entities,
  };
}
