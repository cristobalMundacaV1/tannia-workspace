// Inspección y previsualización PURAS del anteproyecto (no escriben archivos ni crean versiones).
// SEMÁNTICA de posición de aberturas (ahora formal y única):
//   • Cada muro tiene un eje con sentido: horizontal ('h') va de oeste (x menor) a este; vertical ('v') va de sur (y menor) a norte.
//     `inicio` = extremo de menor coordenada; `fin` = extremo de mayor coordenada.
//   • `distancia_mm` mide el CENTRO de la abertura (no su borde): ancla "inicio" → desde el inicio; "fin" → desde el fin hacia el inicio;
//     "centro" → desplazamiento del centro respecto del punto medio del muro (+ hacia el fin).
//   • El borde de la abertura queda a ancho/2 del centro. El centro se limita para dejar un margen a la esquina (se informa si se ajustó).
import { GENERALES } from '../conocimiento/criterios.js';

const R = (v) => Math.round(v * 100) / 100;

export function inspeccionarMuros(geo) {
  const margen = GENERALES.margen_abertura_a_esquina_mm;
  return geo.murosSeg.map((s) => {
    const largo = s.hasta - s.desde; const vanos = geo.aberturas.filter((a) => !a.invalida && a.segmento === s.id).sort((a, b) => a.pos_mm - b.pos_mm);
    const desc = s.tipo === 'ext' ? `exterior de ${s.recinto}, lado ${s.lado}` : `interior entre ${s.entre.join(' y ')}`;
    return {
      id: s.id, tipo: s.tipo, descripcion: desc, orientacion: s.orient === 'h' ? 'horizontal (oeste→este)' : 'vertical (sur→norte)',
      eje: s.orient === 'h' ? { desde: [s.desde, s.fijo], hasta: [s.hasta, s.fijo] } : { desde: [s.fijo, s.desde], hasta: [s.fijo, s.hasta] },
      largo_mm: largo, espesor_mm: s.espesor, margen_a_esquina_mm: margen,
      aberturas: vanos.map((a) => ({ id: a.id, tipo: a.tipo, centro_desde_inicio_mm: R(a.pos_mm), borde_inicio_mm: R(a.pos_mm - a.ancho_mm / 2), borde_fin_mm: R(a.pos_mm + a.ancho_mm / 2), ancho_mm: a.ancho_mm, alto_mm: a.alto_mm ?? null, antepecho_mm: a.antepecho_mm ?? null, ajustada_por_margen: !!a.ajustada })),
      tramos_libres_mm: tramosLibres(largo, vanos, margen),
    };
  });
}

function tramosLibres(largo, vanos, margen) {
  const ocupados = vanos.map((a) => [a.pos_mm - a.ancho_mm / 2, a.pos_mm + a.ancho_mm / 2]).sort((x, y) => x[0] - y[0]); const out = []; let cur = 0;
  for (const [a, b] of ocupados) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); }
  if (largo > cur) out.push([cur, largo]);
  return out.map(([a, b]) => ({ desde_mm: R(a), hasta_mm: R(b), largo_mm: R(b - a) })).filter((t) => t.largo_mm > 0 && margen >= 0);
}

/** Posiciones viables (rango del CENTRO) para una abertura de `ancho_mm` en el muro `segmento`. Geometría, no certificación estructural. */
export function candidatosLibres(geo, segmentoId, ancho_mm) {
  const margen = GENERALES.margen_abertura_a_esquina_mm; const s = geo.murosSeg.find((x) => x.id === segmentoId);
  if (!s) return null;
  const largo = s.hasta - s.desde; const lo = margen + ancho_mm / 2; const hi = largo - margen - ancho_mm / 2;
  if (hi < lo) return { segmento: s.id, largo_mm: largo, ancho_mm, viable: false, motivo: `La abertura de ${ancho_mm} mm no cabe en ${largo} mm dejando ${margen} mm a cada esquina.`, rangos_centro_mm: [] };
  let libres = [[lo, hi]];
  for (const a of geo.aberturas.filter((x) => !x.invalida && x.segmento === s.id)) {
    const dentro = [a.pos_mm - a.ancho_mm / 2 - ancho_mm / 2 - margen, a.pos_mm + a.ancho_mm / 2 + ancho_mm / 2 + margen]; const nuevo = [];
    for (const [x, y] of libres) { if (dentro[1] <= x || dentro[0] >= y) { nuevo.push([x, y]); continue; } if (dentro[0] > x) nuevo.push([x, dentro[0]]); if (dentro[1] < y) nuevo.push([dentro[1], y]); }
    libres = nuevo;
  }
  const rangos = libres.filter(([x, y]) => y >= x).map(([x, y]) => ({ centro_min_mm: R(x), centro_max_mm: R(y), ejemplo: { ancla: 'inicio', distancia_mm: R((x + y) / 2) } }));
  return { segmento: s.id, largo_mm: largo, ancho_mm, viable: rangos.length > 0, motivo: rangos.length ? null : 'No queda espacio libre respetando el margen a esquinas y entre aberturas.', rangos_centro_mm: rangos, nota: 'Solo geometría: que quepa no es una aprobación estructural ni normativa (el profesional define pilares, cadenas y dinteles).' };
}
