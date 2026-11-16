// Puente 2D → 3D: convierte la geometría derivada de CUALQUIER anteproyecto (tannia_diseno_*) en un modelo 3D estructurado y
// verifica la coherencia entre ambos. No contiene coordenadas ni dimensiones propias: todo viene del modelo 2D.
import { UserError } from '../mcp/util.js';
import { unionMuros } from '../design/contorno.js';
import { construirPrimitivas } from './geometria.js';

export const SUPUESTOS_POR_DEFECTO = { altura_muros_mm: 2400, espesor_losa_mm: 150 };

/** @param geo derivar(modelo2d) @param p { altura_muros_mm, espesor_losa_mm, cubierta:{tipo,...}|null, cubierta_visible, origen } */
export function modeloDesdeGeo(geo, p = {}) {
  // Prioridad de la altura de muros: dato indicado > altura piso–cielo del plano 2D > supuesto por defecto. Siempre se declara su fuente.
  const altura = p.altura_muros_mm ?? p.altura_2d_mm ?? SUPUESTOS_POR_DEFECTO.altura_muros_mm;
  const fuenteAltura = p.altura_muros_mm != null ? 'indicada' : p.altura_2d_mm != null ? 'plano_2d' : 'supuesto_por_defecto'; const eL = p.espesor_losa_mm ?? SUPUESTOS_POR_DEFECTO.espesor_losa_mm;
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
    esquema: 1, unidades: 'mm', niveles: [{ id: 'N1', nombre: 'Planta baja', cota_mm: 0, altura_mm: altura, fuente_altura: fuenteAltura }], muros,
    losas: [{ id: 'L1', nivel: 'N1', contorno, espesor_mm: eL }], cubiertas: c ? [{ id: 'C1', nivel: 'N1', ...c }] : [],
    opciones: { cubierta_visible: !!p.cubierta_visible }, origen: p.origen || null,
  };
}

const R2 = (v) => Math.round(v * 100) / 100;
/**
 * Coherencia 3D ↔ 2D POR FACETAS. Cada faceta dice qué se comparó y su estado: verificado | discrepante | revisar | no_comparado.
 * `coherente_en_alcance` solo significa que lo COMPARABLE coincide; lo no comparado se lista y nunca se presenta como aprobado.
 * Semántica: la altura piso–cielo del 2D es una altura LIBRE; la altura de muro del 3D es una altura BRUTA. Un muro más bajo que la altura
 * libre es una discrepancia; uno más alto se marca "revisar" (puede incluir losa/cielo): nunca se fuerza la igualdad.
 */
export function coherenciaConGeo(modelo3d, geo, modelo2d = null) {
  const dif = []; const facetas = {};
  const prim = construirPrimitivas(modelo3d).primitivas.filter((q) => q.tipo === 'caja' && ['muro_ext', 'muro_int', 'dintel', 'antepecho'].includes(q.clase) && !q.rot_deg);
  // 1) Huella de muros
  const m3 = prim.filter((q) => q.clase === 'muro_ext' || q.clase === 'muro_int').map((q) => ({ x0: q.esperado.bbox_min[0], y0: q.esperado.bbox_min[1], x1: q.esperado.bbox_max[0], y1: q.esperado.bbox_max[1], clase: q.clase === 'muro_ext' ? 'ext' : 'int' }));
  const vanos3 = prim.filter((q) => q.clase === 'dintel' || q.clase === 'antepecho').map((q) => ({ x0: q.esperado.bbox_min[0], y0: q.esperado.bbox_min[1], x1: q.esperado.bbox_max[0], y1: q.esperado.bbox_max[1], clase: 'int' }));
  const planta3 = unionMuros([...m3, ...vanos3], []).area_mm2; const planta2 = geo.unionBruta.area_mm2;
  const okPlanta = Math.abs(planta3 - planta2) <= 1;
  facetas.planta = { estado: okPlanta ? 'verificado' : 'discrepante', comparado: 'área en planta de la unión de muros', area_3d_m2: R2(planta3 / 1e6), area_2d_m2: R2(planta2 / 1e6) };
  if (!okPlanta) dif.push({ faceta: 'planta', aspecto: 'huella_de_muros', area_3d_m2: R2(planta3 / 1e6), area_2d_m2: R2(planta2 / 1e6) });
  // 2) Vanos en planta (tipo, centro global, ancho)
  const globales = (m) => m.muros.flatMap((w) => { const L = Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]); return w.vanos.map((v) => ({ id: v.id, tipo: v.tipo, x: w.p1[0] + ((w.p2[0] - w.p1[0]) / L) * v.posicion_mm, y: w.p1[1] + ((w.p2[1] - w.p1[1]) / L) * v.posicion_mm, ancho: v.ancho_mm })); });
  const v3 = globales(modelo3d); const v2 = geo.aberturas.filter((a) => !a.invalida).map((a) => ({ id: a.id, tipo: a.tipo, x: a.orient === 'h' ? a.centro : a.fijo, y: a.orient === 'h' ? a.fijo : a.centro, ancho: a.ancho_mm }));
  const usados = new Set(); const difV = [];
  for (const a of v2) { const i = v3.findIndex((b, k) => !usados.has(k) && b.tipo === a.tipo && Math.hypot(a.x - b.x, a.y - b.y) <= 1 && Math.abs(a.ancho - b.ancho) <= 1); if (i < 0) difV.push({ faceta: 'vanos_en_planta', aspecto: 'vano_2d_ausente_en_3d', id: a.id, tipo: a.tipo, centro: [a.x, a.y], ancho_mm: a.ancho }); else usados.add(i); }
  v3.forEach((b, k) => { if (!usados.has(k)) difV.push({ faceta: 'vanos_en_planta', aspecto: 'vano_3d_sin_equivalente_en_2d', id: b.id, tipo: b.tipo, centro: [Math.round(b.x), Math.round(b.y)], ancho_mm: b.ancho }); });
  facetas.vanos_en_planta = { estado: difV.length ? 'discrepante' : 'verificado', comparado: 'tipo, posición del centro y ancho de cada vano', vanos_2d: v2.length, vanos_3d: v3.length }; dif.push(...difV);
  // 3) Altos y antepechos de vanos (por id)
  const a2 = new Map(geo.aberturas.filter((a) => !a.invalida).map((a) => [a.id, a])); const difH = []; let comparados = 0;
  for (const w of modelo3d.muros) for (const v of w.vanos) { const a = a2.get(v.id); if (!a) continue; comparados++; const alto2 = a.alto_mm || (a.tipo === 'ventana' ? 1200 : 2100); if (Math.abs(alto2 - v.alto_mm) > 1) difH.push({ faceta: 'altos_y_antepechos', aspecto: 'alto_de_vano', id: v.id, alto_2d_mm: alto2, alto_3d_mm: v.alto_mm }); if (v.tipo === 'ventana') { const ant2 = a.antepecho_mm ?? 900; if (Math.abs(ant2 - v.antepecho_mm) > 1) difH.push({ faceta: 'altos_y_antepechos', aspecto: 'antepecho', id: v.id, antepecho_2d_mm: ant2, antepecho_3d_mm: v.antepecho_mm }); } }
  facetas.altos_y_antepechos = { estado: difH.length ? 'discrepante' : comparados ? 'verificado' : 'no_comparado', comparado: 'alto de cada vano y antepecho de ventanas', vanos_comparados: comparados }; dif.push(...difH);
  // 4) Espesores de muro (por id)
  const s2 = new Map(geo.murosSeg.map((s) => [s.id, s])); const difE = []; let ce = 0;
  for (const w of modelo3d.muros) { const s2w = s2.get(w.id); if (!s2w) continue; ce++; if (Math.abs(s2w.espesor - w.espesor_mm) > 1) difE.push({ faceta: 'espesores', aspecto: 'espesor_de_muro', id: w.id, espesor_2d_mm: s2w.espesor, espesor_3d_mm: w.espesor_mm }); }
  facetas.espesores = { estado: difE.length ? 'discrepante' : ce ? 'verificado' : 'no_comparado', comparado: 'espesor de cada muro', muros_comparados: ce }; dif.push(...difE);
  // 5) Alturas (semántica distinta: libre 2D vs bruta 3D)
  const libre = modelo2d?.altura_piso_cielo_mm; const niveles = modelo3d.niveles;
  if (!Number.isFinite(libre)) facetas.alturas = { estado: 'no_comparado', motivo: 'El plano 2D no declara altura piso–cielo.' };
  else {
    const alturas = modelo3d.muros.map((w) => ({ muro: w.id, altura: w.altura_mm ?? niveles.find((n) => n.id === w.nivel)?.altura_mm })).filter((x) => x.altura != null);
    const bajos = alturas.filter((x) => x.altura < libre - 1); const altos = alturas.filter((x) => x.altura > libre + 1);
    const base = { comparado: 'altura de muro (bruta, 3D) frente a altura piso–cielo (libre, 2D)', altura_libre_2d_mm: libre, alturas_3d_mm: [...new Set(alturas.map((x) => x.altura))] };
    if (bajos.length) { facetas.alturas = { ...base, estado: 'discrepante', motivo: `${bajos.length} muro(s) más bajos que la altura libre del plano: no puede haber altura libre de ${libre} mm.` }; dif.push({ faceta: 'alturas', aspecto: 'muro_mas_bajo_que_altura_libre', altura_libre_2d_mm: libre, alturas_3d_mm: [...new Set(bajos.map((x) => x.altura))] }); }
    else if (altos.length) facetas.alturas = { ...base, estado: 'revisar', motivo: `Los muros miden más que la altura libre del plano (${[...new Set(altos.map((x) => x.altura - libre))].join(', ')} mm de diferencia): confirme si incluye losa/cielo u otra decisión; no se fuerza la igualdad.` };
    else facetas.alturas = { ...base, estado: 'verificado', motivo: 'Altura bruta de muro = altura piso–cielo del plano (no se suma el espesor de losa/cielo).' };
  }
  // 6) Lo que el 2D no define
  facetas.cubierta_losa_niveles = { estado: 'no_comparado', motivo: 'El plano 2D no define cubierta, losas ni niveles: son decisiones del modelo 3D (supuestos editables).' };
  const estados = Object.values(facetas).map((f) => f.estado);
  const estado = estados.includes('discrepante') ? 'con_diferencias' : estados.includes('revisar') ? 'con_observaciones' : 'coherente_en_alcance';
  return {
    estado, facetas, diferencias: dif, no_comparadas: Object.entries(facetas).filter(([, f]) => f.estado === 'no_comparado').map(([k]) => k),
    alcance: 'Compara huella, vanos, altos/antepechos, espesores y altura libre. NO es una verificación estructural ni normativa.',
    comprobado: { huella_muros_m2: R2(planta2 / 1e6), vanos_2d: v2.length, vanos_3d: v3.length },
  };
}
void UserError;
