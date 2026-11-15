// Motor de medición geométrica DXF (2D, con longitudes 3D de LINE/3DPOLYLINE).
// Mide GEOMETRÍA; no interpreta partidas ni inventa alturas/espesores.
import { METERS_PER_UNIT } from './reader.js';
import {
  apply, compose, insertTransform, IDENTITY, similarityScale, det2, dist3,
  polyLength, polySignedArea, selfIntersects, arcSweep, bulgeSeg,
} from './geometry.js';

const MAX_DEPTH = 8;
const MAX_ITEMS = 500000;
const TOL_CLOSE = 1e-6;
const f6 = (x) => (Math.round(x * 1e6) / 1e6).toFixed(6).replace(/^-0\.000000$/, '0.000000');

/** Resuelve unidades: INSUNITS declarado vs confirmación explícita del usuario. */
export function resolveUnits(dxf, confirmed) {
  const declared = dxf.insunitsName;
  const out = { declaradas: declared, confirmadas: confirmed || null, conversion: 'bloqueada', factor_a_metros: null, advertencias: [] };
  if (confirmed) {
    const fac = METERS_PER_UNIT[confirmed];
    if (!fac) { out.advertencias.push(`Unidad confirmada "${confirmed}" no reconocida.`); return out; }
    out.conversion = 'aplicada'; out.factor_a_metros = fac;
    if (declared !== 'sin_unidades' && declared !== confirmed) {
      out.advertencias.push(`El archivo declara "${declared}" pero se confirmó "${confirmed}". Se usa la unidad confirmada; verifique con una cota conocida.`);
      out.discrepancia = true;
    }
  } else if (declared === 'sin_unidades') {
    out.advertencias.push('El archivo no declara unidades: no se convierte a metros hasta que se confirme la unidad real.');
  } else {
    out.advertencias.push(`El archivo declara "${declared}" (INSUNITS), pero eso no certifica la escala real: confirme la unidad para convertir.`);
  }
  return out;
}

function polyKey(verts, closed) {
  const fwd = verts.map((v) => `${f6(v.x)},${f6(v.y)},${f6(v.bulge || 0)}`).join(';');
  const rev = [...verts].reverse().map((v, i, a) => `${f6(v.x)},${f6(v.y)},${f6(-(a[i + 1] ? a[i + 1].bulge || 0 : 0))}`).join(';');
  return `P${closed ? 'c' : 'o'}|${fwd < rev ? fwd : rev}`;
}

export function measureDxf(dxf, { unidad_confirmada } = {}) {
  const items = [];
  const warnings = [];
  const unsupported = {};
  const seen = new Map();
  let nextId = 1;
  const units = resolveUnits(dxf, unidad_confirmada);

  const add = (e, path, kind, tipo, valor, formula, extra = {}) => {
    if (items.length >= MAX_ITEMS) throw Object.assign(new Error('demasiadas'), { code: 'DEMASIADAS_ENTIDADES' });
    items.push({
      id: nextId++, tipo_geometria: tipo, capa: e.layer, handle: e.handle, bloque: path.length ? path.join(' > ') : null,
      magnitud: kind, valor, formula, estado: 'ok', advertencias: [], ...extra,
    });
    return items[items.length - 1];
  };
  const dupCheck = (item, key) => {
    const k = `${item.capa}|${item.magnitud}|${key}`;
    if (seen.has(k)) { item.estado = 'duplicada'; item.advertencias.push(`Duplicada de #${seen.get(k)}: excluida de los totales.`); return true; }
    seen.set(k, item.id); return false;
  };
  const review = (item, msg) => { if (item.estado === 'ok') item.estado = 'needs_review'; item.advertencias.push(msg); };

  function measureEntity(e, T, path, ctx) {
    const sim = similarityScale(T);
    const mirrored = det2(T) < 0;
    const base = { ...e };
    switch (e.type) {
      case 'LINE': {
        const a = apply(T, e.a), b = apply(T, e.b);
        const it = add(e, path, 'longitud', 'LINE', dist3(a, b), 'distancia(P1,P2)');
        dupCheck(it, `L|${[`${f6(a.x)},${f6(a.y)},${f6(a.z)}`, `${f6(b.x)},${f6(b.y)},${f6(b.z)}`].sort().join('|')}`);
        return;
      }
      case 'CIRCLE': {
        if (!(e.r > 0)) { review(add(e, path, 'area', 'CIRCLE', null, 'π·r²'), 'Radio inválido.'); return; }
        if (sim === null) { review(add(e, path, 'area', 'CIRCLE', null, 'π·r²'), 'Escala no uniforme: el círculo se convierte en elipse; no soportado.'); return; }
        const r = e.r * sim; const c = apply(T, e.c);
        const key = `C|${f6(c.x)},${f6(c.y)}|${f6(r)}`;
        const a = add(e, path, 'area', 'CIRCLE', Math.PI * r * r, `π·r² con r=${r}`);
        const p = add(e, path, 'perimetro', 'CIRCLE', 2 * Math.PI * r, `2·π·r con r=${r}`);
        if (dupCheck(a, key)) { p.estado = 'duplicada'; p.advertencias.push('Duplicada: excluida.'); } else seen.set(`${e.layer}|perimetro|${key}`, p.id);
        return;
      }
      case 'ARC': {
        if (!(e.r > 0)) { review(add(e, path, 'longitud', 'ARC', null, 'r·Δθ'), 'Radio inválido.'); return; }
        if (sim === null) { review(add(e, path, 'longitud', 'ARC', null, 'r·Δθ'), 'Escala no uniforme: arco no soportado.'); return; }
        const sweep = arcSweep(e.a0, e.a1); const r = e.r * sim; const c = apply(T, e.c);
        const it = add(e, path, 'longitud', 'ARC', r * sweep, `r·Δθ con r=${r}, Δθ=${(sweep * 180 / Math.PI).toFixed(6)}°`);
        const lo = mirrored ? -e.a1 : e.a0; const hi = mirrored ? -e.a0 : e.a1;
        dupCheck(it, `A|${f6(c.x)},${f6(c.y)}|${f6(r)}|${f6(lo)}|${f6(hi)}`);
        return;
      }
      case 'LWPOLYLINE': case 'POLYLINE': {
        if (e.type === 'POLYLINE' && (e.polygonMesh || e.polyface)) return measureMesh(e, T, path);
        if (e.type === 'POLYLINE' && e.poly3d) {
          const pts = e.verts.map((v) => apply(T, v));
          let L = 0; for (let i = 1; i < pts.length; i++) L += dist3(pts[i - 1], pts[i]);
          if (e.closed && pts.length > 2) L += dist3(pts[pts.length - 1], pts[0]);
          const it = add(e, path, 'longitud', 'POLYLINE3D', L, 'Σ distancia 3D entre vértices');
          dupCheck(it, polyKey(pts, e.closed));
          return;
        }
        const hasBulge = e.verts.some((v) => v.bulge);
        if (hasBulge && sim === null) { review(add(e, path, 'longitud', e.type, null, 'Σ segmentos'), 'Escala no uniforme con arcos: no soportado.'); return; }
        const verts = e.verts.map((v) => { const p = apply(T, { x: v.x, y: v.y, z: e.elevation || 0 }); return { x: p.x, y: p.y, bulge: mirrored ? -(v.bulge || 0) : v.bulge || 0 }; });
        if (verts.length < 2) { review(add(e, path, 'longitud', e.type, null, 'Σ segmentos'), 'Polilínea con menos de 2 vértices.'); return; }
        const L = polyLength(verts, e.closed);
        const key = polyKey(verts, e.closed);
        if (e.closed) {
          const per = add(e, path, 'perimetro', e.type, L, 'Σ longitud de segmentos (rectos y arcos)', { vertices: verts.length });
          if (dupCheck(per, key)) { return; }
          if (verts.length < 3 && !hasBulge) { review(per, 'Cerrada con menos de 3 vértices: sin área.'); return; }
          const A = Math.abs(polySignedArea(verts));
          const ar = add(e, path, 'area', e.type, A, hasBulge ? 'Shoelace + segmentos circulares' : 'Fórmula del polígono (shoelace)', { vertices: verts.length });
          seen.set(`${e.layer}|area|${key}`, ar.id);
          if (selfIntersects(verts, true)) { review(ar, 'Autointersección: el área neta no es confiable.'); review(per, 'Autointersección.'); }
        } else {
          const it = add(e, path, 'longitud', e.type, L, 'Σ longitud de segmentos', { vertices: verts.length, abierta: true });
          if (dupCheck(it, key)) return;
          const a = verts[0], b = verts[verts.length - 1];
          if (verts.length > 2 && Math.hypot(a.x - b.x, a.y - b.y) < TOL_CLOSE * Math.max(1, L)) review(it, 'Polilínea abierta con extremos coincidentes: ¿debía estar cerrada? No se calculó área.');
          else it.advertencias.push('Polilínea abierta: solo se mide longitud (sin área).');
          if (selfIntersects(verts, false)) review(it, 'Autointersección en polilínea abierta.');
        }
        return;
      }
      case '3DFACE': {
        const pts = e.pts.map((p) => apply(T, p));
        const tri = (a, b, c) => { const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z; return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); };
        const quad = Math.hypot(pts[3].x - pts[2].x, pts[3].y - pts[2].y, pts[3].z - pts[2].z) > 1e-12;
        const area = quad ? tri(pts[0], pts[1], pts[2]) + tri(pts[0], pts[2], pts[3]) : tri(pts[0], pts[1], pts[2]);
        const it = add(e, path, 'area', '3DFACE', area, quad ? 'Σ 2 triángulos' : 'Área del triángulo');
        review(it, 'Cara 3D suelta: es área de superficie, no una partida; agrupe en un sólido cerrado para volumen (ver tannia_cad3d_*).');
        return;
      }
      case 'INSERT': return expandInsert(e, T, path, ctx);
      case 'TEXT': case 'MTEXT': return; // anotaciones: no medibles
      default:
        unsupported[e.type] = (unsupported[e.type] || 0) + 1;
    }
    void base;
  }

  function measureMesh(e, T, path) {
    // Mallas se tratan con el módulo 3D (mesh3d.js) desde tannia_cad3d_*; aquí solo se registran.
    unsupported[`${e.type}(malla)`] = (unsupported[`${e.type}(malla)`] || 0) + 1;
  }

  function expandInsert(e, T, path, ctx) {
    const blk = dxf.blocks[e.name];
    if (!blk) {
      const it = add(e, path, 'conteo', 'INSERT', 1, 'bloque/referencia no encontrada');
      review(it, `Bloque "${e.name}" no está definido en el archivo (¿referencia externa?): su contenido no se midió.`);
      return;
    }
    if (path.length >= MAX_DEPTH || ctx.stack.includes(e.name)) {
      const it = add(e, path, 'conteo', 'INSERT', 1, 'anidamiento');
      review(it, `Bloque "${e.name}" recursivo o demasiado anidado: no se expandió.`);
      return;
    }
    const cols = Math.max(1, Math.floor(e.cols)), rows = Math.max(1, Math.floor(e.rows));
    if (cols * rows > 100000) { review(add(e, path, 'conteo', 'INSERT', 1, 'arreglo'), 'Arreglo demasiado grande.'); return; }
    const w = add(e, path, 'conteo', 'INSERT', cols * rows, `${cols}×${rows} instancia(s) de "${e.name}"`);
    w.bloque_nombre = e.name;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const T2 = compose(T, insertTransform(e, blk.base, c, r));
      for (const sub of blk.entities) measureEntity(sub, T2, [...path, e.name], { stack: [...ctx.stack, e.name] });
    }
  }

  for (const e of dxf.entities) measureEntity(e, IDENTITY, [], { stack: [] });

  // Totales por capa (solo items 'ok' y 'needs_review' con valor; duplicadas excluidas)
  const layers = {};
  let reviewCount = 0;
  for (const it of items) {
    if (it.estado === 'needs_review') reviewCount++;
    if (it.magnitud === 'conteo' || it.estado === 'duplicada' || it.valor === null) continue;
    const L = (layers[it.capa] ||= { longitud: 0, perimetro: 0, area: 0, items_para_revision: 0 });
    L[it.magnitud] += it.valor;
    if (it.estado === 'needs_review') L.items_para_revision++;
  }
  const f = units.factor_a_metros;
  const converted = f ? Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, { longitud_m: v.longitud * f, perimetro_m: v.perimetro * f, area_m2: v.area * f * f }])) : null;
  if (Object.keys(unsupported).length) warnings.push(`Entidades no medidas (no soportadas en 2D): ${JSON.stringify(unsupported)}.`);
  const dups = items.filter((i) => i.estado === 'duplicada').length;
  if (dups) warnings.push(`${dups} medición(es) duplicada(s) excluida(s) de los totales.`);
  if (reviewCount) warnings.push(`${reviewCount} medición(es) requieren revisión (needs_review): no use esas cifras como finales.`);
  if (units.conversion !== 'aplicada') warnings.push('Cantidades en unidades de dibujo; conversión a metros BLOQUEADA hasta confirmar la unidad.');
  return {
    unidades: units,
    totales_por_capa_unidades_dibujo: layers,
    totales_por_capa_metros: converted,
    mediciones: items,
    entidades_no_soportadas: unsupported,
    advertencias: warnings,
    incertidumbre: 'Cálculo analítico exacto sobre la geometría del archivo (precisión de doble). No incluye incertidumbre de escala: la conversión solo vale si la unidad confirmada es correcta.',
    necesita_revision: reviewCount > 0 || units.conversion !== 'aplicada' || !!units.discrepancia,
  };
}
