// Motor 3D GENERAL de Tannia Workspace: de un modelo arquitectónico ESTRUCTURADO (niveles, muros con vanos, losas, cubiertas) a
// primitivas sólidas (cajas y cuñas) con su firma esperada (volumen, centroide, caja envolvente). No conoce ninguna vivienda:
// todo sale de los datos. Unidades: mm; Z hacia arriba; el plano XY es el del plano 2D.
// Alturas, espesores y pendientes son DATOS del modelo (supuestos explícitos y editables), nunca valores normativos inventados.
import { UserError } from '../mcp/util.js';
import { unionMuros } from '../design/contorno.js';

export const CAPAS_3D = {
  TW3D_MURO_EXT: { color: 7, descripcion: 'Muros exteriores (sólidos 3D)' },
  TW3D_MURO_INT: { color: 8, descripcion: 'Muros interiores (sólidos 3D)' },
  TW3D_VANOS: { color: 4, descripcion: 'Antepechos y dinteles bajo/sobre los vanos de puertas y ventanas' },
  TW3D_LOSA: { color: 9, descripcion: 'Losas de piso/entrepiso (sólidos 3D)' },
  TW3D_CUBIERTA: { color: 1, descripcion: 'Cubierta (sólido de visualización; oculta por defecto)' },
  TW3D_NOTAS: { color: 2, descripcion: 'Rótulo del modelo preliminar' },
};
export const LIMITES = { espesor_muro_mm: [20, 1000], altura_mm: [1000, 12000], espesor_losa_mm: [20, 1000], vano_ancho_mm: [100, 20000], pendiente_pct: [1, 100] };
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const pt = (p, ctx) => { if (!Array.isArray(p) || p.length < 2 || !isNum(p[0]) || !isNum(p[1])) throw new UserError('PUNTO_INVALIDO', `${ctx}: el punto debe ser [x, y] en mm.`); return [r4(p[0]), r4(p[1])]; };
const enRango = (v, [a, b]) => isNum(v) && v >= a && v <= b;
const eje = (w) => Math.abs(w.p1[0] - w.p2[0]) < 1e-6 || Math.abs(w.p1[1] - w.p2[1]) < 1e-6;

/** Valida y normaliza el modelo estructurado. Lanza UserError con código y pista; nunca corrige en silencio. */
export function validarModelo(entrada) {
  const m = JSON.parse(JSON.stringify(entrada || {}));
  if (!Array.isArray(m.niveles) || !m.niveles.length) throw new UserError('SIN_NIVELES', 'El modelo necesita al menos un nivel: { id, cota_mm, altura_mm }.', 'La altura libre es un supuesto editable que usted debe indicar (p. ej. confirmada con la usuaria).');
  const niv = new Map();
  for (const n of m.niveles) {
    if (!n.id || niv.has(n.id)) throw new UserError('NIVEL_INVALIDO', `Nivel sin id o repetido: ${n.id}.`);
    if (!isNum(n.cota_mm)) throw new UserError('NIVEL_INVALIDO', `El nivel ${n.id} necesita cota_mm.`);
    if (!enRango(n.altura_mm, LIMITES.altura_mm)) throw new UserError('ALTURA_INVALIDA', `El nivel ${n.id} necesita altura_mm entre ${LIMITES.altura_mm.join(' y ')} (supuesto editable, no se asume).`);
    niv.set(n.id, n);
  }
  const ids = new Set(); const unico = (id, tipo) => { if (!id || ids.has(id)) throw new UserError('ID_INVALIDO', `${tipo} sin id o con id repetido: ${id}.`); ids.add(id); };
  m.muros = m.muros || []; m.losas = m.losas || []; m.cubiertas = m.cubiertas || [];
  for (const w of m.muros) {
    unico(w.id, 'Muro'); w.p1 = pt(w.p1, `Muro ${w.id}`); w.p2 = pt(w.p2, `Muro ${w.id}`);
    if (!niv.has(w.nivel)) throw new UserError('NIVEL_NO_EXISTE', `El muro ${w.id} usa el nivel ${w.nivel}, que no existe.`, `Niveles: ${[...niv.keys()].join(', ')}.`);
    if (Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]) < 100) throw new UserError('MURO_MUY_CORTO', `El muro ${w.id} mide menos de 100 mm.`);
    if (!enRango(w.espesor_mm, LIMITES.espesor_muro_mm)) throw new UserError('ESPESOR_INVALIDO', `El muro ${w.id} necesita espesor_mm entre ${LIMITES.espesor_muro_mm.join(' y ')}.`);
    if (w.altura_mm != null && !enRango(w.altura_mm, LIMITES.altura_mm)) throw new UserError('ALTURA_INVALIDA', `Altura del muro ${w.id} fuera de ${LIMITES.altura_mm.join('–')} mm.`);
    w.tipo = w.tipo === 'ext' ? 'ext' : 'int'; w.vanos = w.vanos || [];
    const L = Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]); const H = w.altura_mm ?? niv.get(w.nivel).altura_mm;
    const ordenados = [];
    for (const v of w.vanos) {
      unico(v.id, 'Vano');
      if (!['puerta', 'ventana', 'paso'].includes(v.tipo)) throw new UserError('VANO_INVALIDO', `Vano ${v.id}: tipo debe ser puerta, ventana o paso.`);
      if (!isNum(v.posicion_mm) || !enRango(v.ancho_mm, LIMITES.vano_ancho_mm) || !isNum(v.alto_mm) || v.alto_mm <= 0) throw new UserError('VANO_INVALIDO', `Vano ${v.id}: indique posicion_mm (centro desde p1), ancho_mm y alto_mm.`);
      v.antepecho_mm = v.tipo === 'ventana' ? (v.antepecho_mm ?? null) : 0;
      if (v.tipo === 'ventana' && !isNum(v.antepecho_mm)) throw new UserError('VANO_INVALIDO', `La ventana ${v.id} necesita antepecho_mm (no se asume).`);
      const a = v.posicion_mm - v.ancho_mm / 2; const b = v.posicion_mm + v.ancho_mm / 2;
      if (a < -1e-6 || b > L + 1e-6) throw new UserError('VANO_FUERA_DEL_MURO', `El vano ${v.id} (${r4(a)}–${r4(b)} mm) no cabe en el muro ${w.id} de ${r4(L)} mm.`, 'Ajuste posicion_mm o ancho_mm.');
      if (v.antepecho_mm < 0 || v.antepecho_mm >= H) throw new UserError('VANO_INVALIDO', `El antepecho del vano ${v.id} debe estar entre 0 y la altura del muro.`);
      ordenados.push({ id: v.id, a, b });
    }
    ordenados.sort((x, y) => x.a - y.a);
    for (let i = 1; i < ordenados.length; i++) if (ordenados[i].a < ordenados[i - 1].b - 1e-6) throw new UserError('VANOS_SOLAPADOS', `Los vanos ${ordenados[i - 1].id} y ${ordenados[i].id} se solapan en el muro ${w.id}.`);
  }
  for (const s of m.losas) {
    unico(s.id, 'Losa'); if (!niv.has(s.nivel)) throw new UserError('NIVEL_NO_EXISTE', `La losa ${s.id} usa el nivel ${s.nivel}, que no existe.`);
    if (!enRango(s.espesor_mm, LIMITES.espesor_losa_mm)) throw new UserError('ESPESOR_INVALIDO', `La losa ${s.id} necesita espesor_mm entre ${LIMITES.espesor_losa_mm.join(' y ')}.`);
    if (!Array.isArray(s.contorno) || s.contorno.length < 3) throw new UserError('CONTORNO_INVALIDO', `La losa ${s.id} necesita un contorno de al menos 3 puntos.`);
    s.contorno = s.contorno.map((p) => pt(p, `Losa ${s.id}`)); rectilineo(s.contorno, `La losa ${s.id}`);
  }
  for (const c of m.cubiertas) {
    unico(c.id, 'Cubierta'); if (!niv.has(c.nivel)) throw new UserError('NIVEL_NO_EXISTE', `La cubierta ${c.id} apoya en el nivel ${c.nivel}, que no existe.`);
    if (!['plana', 'un_agua', 'dos_aguas'].includes(c.tipo)) throw new UserError('CUBIERTA_INVALIDA', `Cubierta ${c.id}: tipo debe ser plana, un_agua o dos_aguas.`);
    c.voladizo_mm = c.voladizo_mm ?? 0; if (!isNum(c.voladizo_mm) || c.voladizo_mm < 0 || c.voladizo_mm > 3000) throw new UserError('CUBIERTA_INVALIDA', `Voladizo de ${c.id} entre 0 y 3000 mm.`);
    if (c.tipo === 'plana') { if (!enRango(c.espesor_mm, LIMITES.espesor_losa_mm)) throw new UserError('ESPESOR_INVALIDO', `La cubierta plana ${c.id} necesita espesor_mm.`); }
    else {
      if (!enRango(c.pendiente_pct, LIMITES.pendiente_pct)) throw new UserError('PENDIENTE_REQUERIDA', `La cubierta ${c.id} necesita pendiente_pct (${LIMITES.pendiente_pct.join('–')} %). La pendiente NO se asume: la define el proyectista según el material de cubierta.`, 'Consulte tannia_conocimiento_consultar y confirme el valor con la usuaria.');
      if (c.tipo === 'un_agua' && !['+x', '-x', '+y', '-y'].includes(c.direccion)) throw new UserError('CUBIERTA_INVALIDA', `La cubierta ${c.id} (un agua) necesita direccion de caída: +x, -x, +y o -y.`);
      if (c.tipo === 'dos_aguas' && !['x', 'y'].includes(c.eje_cumbrera)) throw new UserError('CUBIERTA_INVALIDA', `La cubierta ${c.id} (dos aguas) necesita eje_cumbrera: x o y.`);
    }
    if (c.contorno) { c.contorno = c.contorno.map((p) => pt(p, `Cubierta ${c.id}`)); rectilineo(c.contorno, `La cubierta ${c.id}`); if (c.tipo !== 'plana' && c.contorno.length !== 4) throw new UserError('CONTORNO_INVALIDO', `La cubierta inclinada ${c.id} requiere un contorno rectangular (4 puntos) o ninguno (se usa la envolvente de los muros).`); }
  }
  return m;
}

function rectilineo(c, ctx) {
  for (let i = 0; i < c.length; i++) { const a = c[i]; const b = c[(i + 1) % c.length]; if (Math.abs(a[0] - b[0]) > 1e-6 && Math.abs(a[1] - b[1]) > 1e-6) throw new UserError('CONTORNO_NO_ORTOGONAL', `${ctx} tiene un lado inclinado: el motor 3D admite contornos ortogonales (se descomponen en prismas). Descomponga la forma en rectángulos.`); }
}

const enPoligono = (x, y, poly) => { let dentro = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i]; const [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro; } return dentro; };
function mergeVertical(corridas) {
  const por = new Map();
  for (const r of corridas) { const k = `${r.x0}|${r.x1}`; if (!por.has(k)) por.set(k, []); por.get(k).push(r); }
  const out = [];
  for (const lista of por.values()) { lista.sort((a, b) => a.y0 - b.y0); let cur = { ...lista[0] }; for (let i = 1; i < lista.length; i++) { if (lista[i].y0 === cur.y1) cur.y1 = lista[i].y1; else { out.push(cur); cur = { ...lista[i] }; } } out.push(cur); }
  return out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}
/** Polígono ortogonal → rectángulos disjuntos (compresión de coordenadas). */
export function rectangulosDePoligono(poly) {
  const xs = [...new Set(poly.map((p) => p[0]))].sort((a, b) => a - b); const ys = [...new Set(poly.map((p) => p[1]))].sort((a, b) => a - b); const cor = [];
  for (let j = 0; j + 1 < ys.length; j++) { let i = 0; while (i + 1 < xs.length) { const dentro = (k) => enPoligono((xs[k] + xs[k + 1]) / 2, (ys[j] + ys[j + 1]) / 2, poly); if (!dentro(i)) { i++; continue; } const k0 = i; while (i + 1 < xs.length && dentro(i)) i++; cor.push({ x0: xs[k0], x1: xs[i], y0: ys[j], y1: ys[j + 1] }); } }
  return mergeVertical(cor);
}

// ---- primitivas con firma esperada ----
function caja(capa, clase, nombre, ref, x0, y0, z0, x1, y1, z1, rotDeg = 0, centroRot = null) {
  const dx = x1 - x0; const dy = y1 - y0; const dz = z1 - z0; const c = [x0 + dx / 2, y0 + dy / 2, z0 + dz / 2];
  let bmin = [x0, y0, z0]; let bmax = [x1, y1, z1]; let cen = c; let centro = c;
  if (rotDeg) {
    const a = (rotDeg * Math.PI) / 180; const co = Math.cos(a); const si = Math.sin(a); const O = centroRot || [c[0], c[1]];
    const rot = (x, y) => [O[0] + (x - O[0]) * co - (y - O[1]) * si, O[1] + (x - O[0]) * si + (y - O[1]) * co];
    const cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => rot(x, y)); const xs = cs.map((q) => q[0]); const ys = cs.map((q) => q[1]);
    bmin = [Math.min(...xs), Math.min(...ys), z0]; bmax = [Math.max(...xs), Math.max(...ys), z1]; const cr = rot(c[0], c[1]); cen = [cr[0], cr[1], c[2]];
  }
  const f = (v) => r4(v);
  return { tipo: 'caja', capa, clase, nombre, ref, dx: f(dx), dy: f(dy), dz: f(dz), centro_inicial: c.map(f), rot_deg: rotDeg, rot_centro: rotDeg ? c.slice(0, 2).map(f) : null,
    esperado: { volumen: r4(dx * dy * dz), centroide: cen.map(f), bbox_min: bmin.map(f), bbox_max: bmax.map(f) } };
}
function cuna(capa, clase, nombre, ref, x0, y0, z0, x1, y1, z1, altoLado) {
  const dx = x1 - x0; const dy = y1 - y0; const dz = z1 - z0; const c = [x0 + dx / 2, y0 + dy / 2, z0 + dz / 2];
  const off = { '-x': [-dx / 6, 0], '+x': [dx / 6, 0], '-y': [0, -dy / 6], '+y': [0, dy / 6] }[altoLado]; const f = (v) => r4(v);
  return { tipo: 'cuna', capa, clase, nombre, ref, dx: f(dx), dy: f(dy), dz: f(dz), alto_lado: altoLado, centro_inicial: c.map(f),
    esperado: { volumen: r4((dx * dy * dz) / 2), centroide: [c[0] + off[0], c[1] + off[1], z0 + dz / 3].map(f), bbox_min: [x0, y0, z0].map(f), bbox_max: [x1, y1, z1].map(f) } };
}

/** Extensión de cada extremo del muro: media espesor del muro más grueso que toca ese punto (cierra esquinas y encuentros). */
function extensiones(w, todos) {
  const tol = 1; const ext = [0, 0];
  [w.p1, w.p2].forEach((P, k) => {
    for (const o of todos) {
      if (o === w || o.nivel !== w.nivel) continue;
      const dx = o.p2[0] - o.p1[0]; const dy = o.p2[1] - o.p1[1]; const L2 = dx * dx + dy * dy; const t = Math.max(0, Math.min(1, ((P[0] - o.p1[0]) * dx + (P[1] - o.p1[1]) * dy) / L2));
      if (Math.hypot(o.p1[0] + t * dx - P[0], o.p1[1] + t * dy - P[1]) <= tol) ext[k] = Math.max(ext[k], o.espesor_mm / 2);
    }
  });
  return ext;
}
const marco = (w) => { const L = Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]); const u = [(w.p2[0] - w.p1[0]) / L, (w.p2[1] - w.p1[1]) / L]; return { L, u, n: [-u[1], u[0]] }; };
const globalDe = (w, u0, u1, ancho) => { const { u, n } = marco(w); const t = ancho / 2; const P = (a, b) => [w.p1[0] + u[0] * a + n[0] * b, w.p1[1] + u[1] * a + n[1] * b]; const cs = [P(u0, -t), P(u1, -t), P(u1, t), P(u0, t)]; const xs = cs.map((q) => r4(q[0])); const ys = cs.map((q) => r4(q[1])); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };

/**
 * Construye las primitivas del modelo.
 * Muros ortogonales de un mismo nivel/altura: se unen y descomponen en prismas DISJUNTOS (sin solapes). Con muros inclinados se
 * crea un prisma por tramo de muro y los encuentros pueden solaparse (se informa).
 */
export function construirPrimitivas(entrada) {
  const m = validarModelo(entrada); const niv = new Map(m.niveles.map((n) => [n.id, n]));
  const prims = []; const advertencias = []; const capaDe = (w) => (w.tipo === 'ext' ? 'TW3D_MURO_EXT' : 'TW3D_MURO_INT');
  const grupos = new Map();
  for (const w of m.muros) { const n = niv.get(w.nivel); const H = w.altura_mm ?? n.altura_mm; const k = `${w.nivel}|${H}`; if (!grupos.has(k)) grupos.set(k, { z0: n.cota_mm, H, muros: [] }); grupos.get(k).muros.push(w); }
  for (const g of grupos.values()) {
    const { z0, H } = g; const z1 = z0 + H;
    const vanos = (w) => w.vanos.map((v) => ({ w, v, u0: v.posicion_mm - v.ancho_mm / 2, u1: v.posicion_mm + v.ancho_mm / 2 }));
    const piezasVano = (w) => { for (const { v, u0, u1 } of vanos(w)) {
      const rect = globalDe(w, u0, u1, w.espesor_mm); const ant = v.antepecho_mm || 0; const tope = ant + v.alto_mm; const nombre = `${v.tipo === 'ventana' ? 'Ventana' : v.tipo === 'puerta' ? 'Puerta' : 'Paso'} ${v.id}`;
      const ang = (Math.atan2(w.p2[1] - w.p1[1], w.p2[0] - w.p1[0]) * 180) / Math.PI;
      const mk = (nm, a, b, extra) => (eje(w) ? caja('TW3D_VANOS', extra, nm, v.id, rect.x0, rect.y0, z0 + a, rect.x1, rect.y1, z0 + b) : caja('TW3D_VANOS', extra, nm, v.id, ...(([cx, cy]) => [cx - (u1 - u0) / 2, cy - w.espesor_mm / 2, z0 + a, cx + (u1 - u0) / 2, cy + w.espesor_mm / 2, z0 + b])(centroUV(w, (u0 + u1) / 2)), ang, centroUV(w, (u0 + u1) / 2)));
      if (ant > 0) prims.push(mk(`Antepecho ${nombre}`, 0, Math.min(ant, H), 'antepecho'));
      if (tope > H + 1e-6) advertencias.push(`El vano ${v.id} (${r4(tope)} mm de altura total) supera la altura del muro ${w.id} (${H} mm): queda abierto hasta arriba, sin dintel.`);
      else if (tope < H - 1e-6) prims.push(mk(`Dintel ${nombre}`, tope, H, 'dintel'));
    } };
    if (g.muros.every(eje)) {
      const rects = g.muros.map((w) => { const [e1, e2] = extensiones(w, m.muros); const { L } = marco(w); return { ...globalDe(w, -e1, L + e2, w.espesor_mm), clase: w.tipo, w }; });
      const cortes = g.muros.flatMap((w) => vanos(w).map(({ u0, u1 }) => globalDe(w, u0, u1, w.espesor_mm)));
      const rExt = rects.filter((r) => r.clase === 'ext'); const rInt = rects.filter((r) => r.clase !== 'ext');
      if (rExt.length) mergeVertical(unionMuros(rExt, cortes).corridas).forEach((r) => prims.push(caja('TW3D_MURO_EXT', 'muro_ext', 'Muro exterior', null, r.x0, r.y0, z0, r.x1, r.y1, z1)));
      if (rInt.length) mergeVertical(unionMuros(rInt, [...cortes, ...rExt]).corridas).forEach((r) => prims.push(caja('TW3D_MURO_INT', 'muro_int', 'Muro interior', null, r.x0, r.y0, z0, r.x1, r.y1, z1)));
      g.muros.forEach(piezasVano);
    } else {
      advertencias.push('Hay muros inclinados: se crea un prisma por tramo de muro y los encuentros pueden SOLAPARSE (no se unifican; no sume volúmenes de encuentros).');
      for (const w of g.muros) {
        const [e1, e2] = extensiones(w, m.muros); const { L } = marco(w); const ang = (Math.atan2(w.p2[1] - w.p1[1], w.p2[0] - w.p1[0]) * 180) / Math.PI; const t = w.espesor_mm;
        const huecos = vanos(w).sort((a, b) => a.u0 - b.u0); const tramos = []; let cur = -e1;
        for (const h of huecos) { if (h.u0 > cur + 1e-6) tramos.push([cur, h.u0]); cur = Math.max(cur, h.u1); }
        if (L + e2 > cur + 1e-6) tramos.push([cur, L + e2]);
        for (const [a, b] of tramos) { const [cx, cy] = centroUV(w, (a + b) / 2); prims.push(caja(capaDe(w), w.tipo === 'ext' ? 'muro_ext' : 'muro_int', `Muro ${w.id}`, w.id, cx - (b - a) / 2, cy - t / 2, z0, cx + (b - a) / 2, cy + t / 2, z1, ang, [cx, cy])); }
        piezasVano(w);
      }
    }
  }
  // Losas
  for (const s of m.losas) { const zt = niv.get(s.nivel).cota_mm; rectangulosDePoligono(s.contorno).forEach((r) => prims.push(caja('TW3D_LOSA', 'losa', `Losa ${s.id}`, s.id, r.x0, r.y0, zt - s.espesor_mm, r.x1, r.y1, zt))); }
  // Cubiertas
  for (const c of m.cubiertas) {
    const muros = m.muros.filter((w) => w.nivel === c.nivel); const n = niv.get(c.nivel);
    const zb = n.cota_mm + Math.max(n.altura_mm, ...muros.map((w) => w.altura_mm ?? 0));
    let poly = c.contorno;
    if (!poly) {
      if (!muros.length) throw new UserError('CUBIERTA_SIN_APOYO', `La cubierta ${c.id} no tiene contorno y el nivel ${c.nivel} no tiene muros para deducir la envolvente.`);
      const xs = muros.flatMap((w) => [w.p1[0], w.p2[0]]); const ys = muros.flatMap((w) => [w.p1[1], w.p2[1]]); const t = Math.max(...muros.map((w) => w.espesor_mm)) / 2;
      poly = [[Math.min(...xs) - t, Math.min(...ys) - t], [Math.max(...xs) + t, Math.min(...ys) - t], [Math.max(...xs) + t, Math.max(...ys) + t], [Math.min(...xs) - t, Math.max(...ys) + t]];
    }
    const v = c.voladizo_mm; const bx = poly.map((p) => p[0]); const by = poly.map((p) => p[1]);
    const R = { x0: Math.min(...bx) - v, x1: Math.max(...bx) + v, y0: Math.min(...by) - v, y1: Math.max(...by) + v };
    if (c.tipo === 'plana') {
      const pol = v === 0 ? poly : [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]];
      rectangulosDePoligono(pol).forEach((r) => prims.push(caja('TW3D_CUBIERTA', 'cubierta', `Cubierta ${c.id}`, c.id, r.x0, r.y0, zb, r.x1, r.y1, zb + c.espesor_mm)));
    } else if (c.tipo === 'un_agua') {
      const run = c.direccion.endsWith('x') ? R.x1 - R.x0 : R.y1 - R.y0; const alto = { '+x': '-x', '-x': '+x', '+y': '-y', '-y': '+y' }[c.direccion];
      prims.push(cuna('TW3D_CUBIERTA', 'cubierta', `Cubierta ${c.id}`, c.id, R.x0, R.y0, zb, R.x1, R.y1, zb + r4((run * c.pendiente_pct) / 100), alto));
    } else {
      const horiz = c.eje_cumbrera === 'y'; // cumbrera paralela a Y: las aguas caen hacia ±X
      const mid = horiz ? (R.x0 + R.x1) / 2 : (R.y0 + R.y1) / 2; const half = (horiz ? R.x1 - R.x0 : R.y1 - R.y0) / 2; const rise = r4((half * c.pendiente_pct) / 100);
      if (horiz) { prims.push(cuna('TW3D_CUBIERTA', 'cubierta', `Cubierta ${c.id} (agua oeste)`, c.id, R.x0, R.y0, zb, mid, R.y1, zb + rise, '+x')); prims.push(cuna('TW3D_CUBIERTA', 'cubierta', `Cubierta ${c.id} (agua este)`, c.id, mid, R.y0, zb, R.x1, R.y1, zb + rise, '-x')); }
      else { prims.push(cuna('TW3D_CUBIERTA', 'cubierta', `Cubierta ${c.id} (agua sur)`, c.id, R.x0, R.y0, zb, R.x1, mid, zb + rise, '+y')); prims.push(cuna('TW3D_CUBIERTA', 'cubierta', `Cubierta ${c.id} (agua norte)`, c.id, R.x0, mid, zb, R.x1, R.y1, zb + rise, '-y')); }
    }
  }
  prims.forEach((p, i) => { p.id = `S${String(i + 1).padStart(3, '0')}`; });
  const sup = [];
  const textoFuente = { plano_2d: 'tomada de la altura piso–cielo del plano 2D (valor de práctica de diseño; no se suma losa/cielo)', indicada: 'indicada por el proyectista', supuesto_por_defecto: 'supuesto por defecto (el plano 2D no declara altura)' };
  for (const w of m.muros) if (!w.altura_mm) { const n = niv.get(w.nivel); sup.push(`Altura de muros del nivel ${w.nivel} = ${n.altura_mm} mm, ${textoFuente[n.fuente_altura] || 'supuesto preliminar editable'}. Editable; no normativa.`); }
  const oculta = m.opciones?.cubierta_visible !== true;
  const capas = Object.entries(CAPAS_3D).map(([nombre, c]) => ({ nombre, color: c.color, visible: !(nombre === 'TW3D_CUBIERTA' && oculta) }));
  const vol = (cl) => prims.filter((p) => cl.includes(p.clase)).reduce((a, p) => a + p.esperado.volumen, 0) / 1e9;
  const todas = prims.flatMap((p) => [p.esperado.bbox_min, p.esperado.bbox_max]);
  return {
    modelo: m, primitivas: prims, capas, advertencias, supuestos: [...new Set(sup)],
    nota: `MODELO 3D PRELIMINAR - alturas y espesores supuestos editables - no apto para construccion ni calculo estructural`,
    resumen: {
      n_primitivas: prims.length, por_clase: prims.reduce((a, p) => { a[p.clase] = (a[p.clase] || 0) + 1; return a; }, {}),
      volumen_muros_m3: r4(vol(['muro_ext', 'muro_int', 'antepecho', 'dintel'])), volumen_losas_m3: r4(vol(['losa'])), volumen_cubierta_m3: r4(vol(['cubierta'])),
      envolvente_mm: todas.length ? { min: [0, 1, 2].map((i) => Math.min(...todas.map((q) => q[i]))), max: [0, 1, 2].map((i) => Math.max(...todas.map((q) => q[i]))) } : null,
    },
  };
}
const centroUV = (w, u) => { const { u: d } = marco(w); return [r4(w.p1[0] + d[0] * u), r4(w.p1[1] + d[1] * u)]; };
