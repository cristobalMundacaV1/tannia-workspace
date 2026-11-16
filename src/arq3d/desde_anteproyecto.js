// Puente 2D → 3D: convierte la geometría derivada de CUALQUIER anteproyecto (tannia_diseno_*) en un modelo 3D estructurado y
// verifica la coherencia entre ambos. No contiene coordenadas ni dimensiones propias: todo viene del modelo 2D.
import { UserError } from '../mcp/util.js';
import { unionMuros } from '../design/contorno.js';
import { construirPrimitivas } from './geometria.js';

export const SUPUESTOS_POR_DEFECTO = { altura_muros_mm: 2400, espesor_losa_mm: 150 };

/** @param geo derivar(modelo2d) @param p { altura_muros_mm, espesor_losa_mm, cubierta:{tipo,...}|null, cubierta_visible, origen } */
export function modeloDesdeGeo(geo, p = {}) {
  const altura = p.altura_muros_mm ?? SUPUESTOS_POR_DEFECTO.altura_muros_mm; const eL = p.espesor_losa_mm ?? SUPUESTOS_POR_DEFECTO.espesor_losa_mm;
  const muros = geo.murosSeg.map((s) => {
    const horiz = s.orient === 'h';
    return {
      id: s.id, nivel: 'N1', tipo: s.tipo, espesor_mm: s.espesor,
      p1: horiz ? [s.desde, s.fijo] : [s.fijo, s.desde], p2: horiz ? [s.hasta, s.fijo] : [s.fijo, s.hasta],
      vanos: geo.aberturas.filter((a) => !a.invalida && a.segmento === s.id).map((a) => ({
        id: a.id, tipo: a.tipo, posicion_mm: a.pos_mm, ancho_mm: a.ancho_mm, alto_mm: a.alto_mm || (a.tipo === 'ventana' ? 1200 : 2100), ...(a.tipo === 'ventana' ? { antepecho_mm: a.antepecho_mm ?? 900 } : {}),
      })),
    };
  });
  const xs = geo.rectsMuro.flatMap((r) => [r.x0, r.x1]); const ys = geo.rectsMuro.flatMap((r) => [r.y0, r.y1]);
  const contorno = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]];
  const c = p.cubierta === null ? null : (p.cubierta || { tipo: 'plana', espesor_mm: 150 });
  return {
    esquema: 1, unidades: 'mm', niveles: [{ id: 'N1', nombre: 'Planta baja', cota_mm: 0, altura_mm: altura }], muros,
    losas: [{ id: 'L1', nivel: 'N1', contorno, espesor_mm: eL }], cubiertas: c ? [{ id: 'C1', nivel: 'N1', ...c }] : [],
    opciones: { cubierta_visible: !!p.cubierta_visible }, origen: p.origen || null,
    supuestos: { altura_muros_mm: altura, espesor_losa_mm: eL, nota: 'Alturas y espesores verticales: supuestos preliminares editables (no vienen del plano 2D ni son normativos).' },
  };
}

/** Coherencia 3D ↔ 2D: huella de muros y vanos (posición y ancho) deben ser los del plano 2D. */
export function coherenciaConGeo(modelo3d, geo) {
  const dif = [];
  const prim = construirPrimitivas(modelo3d).primitivas.filter((q) => q.tipo === 'caja' && ['muro_ext', 'muro_int', 'dintel', 'antepecho'].includes(q.clase) && !q.rot_deg);
  // 1) Huella: unión de las cajas de muro (sin vanos) frente a la unión bruta del 2D.
  const m3 = prim.filter((q) => q.clase === 'muro_ext' || q.clase === 'muro_int').map((q) => ({ x0: q.esperado.bbox_min[0], y0: q.esperado.bbox_min[1], x1: q.esperado.bbox_max[0], y1: q.esperado.bbox_max[1], clase: q.clase === 'muro_ext' ? 'ext' : 'int' }));
  const vanos3 = prim.filter((q) => q.clase === 'dintel' || q.clase === 'antepecho').map((q) => ({ x0: q.esperado.bbox_min[0], y0: q.esperado.bbox_min[1], x1: q.esperado.bbox_max[0], y1: q.esperado.bbox_max[1], clase: 'int' }));
  const planta3 = unionMuros([...m3, ...vanos3], []).area_mm2; const planta2 = geo.unionBruta.area_mm2;
  if (Math.abs(planta3 - planta2) > 1) dif.push({ aspecto: 'huella_de_muros', area_3d_m2: Math.round(planta3 / 1e4) / 100, area_2d_m2: Math.round(planta2 / 1e4) / 100 });
  // 2) Vanos: mismo conjunto (tipo, centro global, ancho).
  const globales = (m) => m.muros.flatMap((w) => { const L = Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]); return w.vanos.map((v) => ({ tipo: v.tipo, x: w.p1[0] + ((w.p2[0] - w.p1[0]) / L) * v.posicion_mm, y: w.p1[1] + ((w.p2[1] - w.p1[1]) / L) * v.posicion_mm, ancho: v.ancho_mm })); });
  const v3 = globales(modelo3d); const v2 = geo.aberturas.filter((a) => !a.invalida).map((a) => ({ tipo: a.tipo, x: a.orient === 'h' ? a.centro : a.fijo, y: a.orient === 'h' ? a.fijo : a.centro, ancho: a.ancho_mm }));
  const usados = new Set();
  for (const a of v2) { const i = v3.findIndex((b, k) => !usados.has(k) && b.tipo === a.tipo && Math.hypot(a.x - b.x, a.y - b.y) <= 1 && Math.abs(a.ancho - b.ancho) <= 1); if (i < 0) dif.push({ aspecto: 'vano_2d_ausente_en_3d', tipo: a.tipo, centro: [a.x, a.y], ancho_mm: a.ancho }); else usados.add(i); }
  v3.forEach((b, k) => { if (!usados.has(k)) dif.push({ aspecto: 'vano_3d_sin_equivalente_en_2d', tipo: b.tipo, centro: [Math.round(b.x), Math.round(b.y)], ancho_mm: b.ancho }); });
  return { estado: dif.length ? 'con_diferencias' : 'coherente', diferencias: dif, comprobado: { huella_muros_m2: Math.round(planta2 / 1e4) / 100, vanos_2d: v2.length, vanos_3d: v3.length } };
}
void UserError;
