// Componentes parametrizados del piloto de túnel (PR #38, C6): regiones de revestimiento, llamadas D1–D4, detalles y cuadros.
// Solo se dibuja lo DECLARADO (geometría de sección, espesor elegido, patrón de fortificación). Lo no declarado (placa, tuerca,
// diámetro, lechada, solera, drenaje, ancho de paño) queda como PENDIENTE visible: nunca se inventa geometría para ello.
// Ninguna entidad de detalle es fuente de cubicación (rol «representacion»): las cantidades salen solo de sus vistas fuente.

const c2 = (x, d = 2) => x.toFixed(d).replace('.', ',');
const rad = (g) => (g * Math.PI) / 180;
const P = (r, g, yc) => [r * Math.cos(rad(g)), yc + r * Math.sin(rad(g))];
const L = (id, layer, a, b, element, role = 'representacion') => ({ id, kind: 'line', layer, a, b, element, role });
const A = (id, layer, center, radius, start, end, element, role = 'representacion') => ({ id, kind: 'arc', layer, center, radius, start, end, element, role });
const dimL = (id, a, b, offset) => ({ id, kind: 'linear', a, b, offset, value: Math.hypot(b[0] - a[0], b[1] - a[1]), unit: 'm' });

export const MATERIAL_SHOTCRETE = (t) => ({ nombre: `Shotcrete e = ${Math.round(t * 100)} cm`, origen: `Partida declarada del ejercicio TW12 (revestimiento shotcrete, espesor elegido ${c2(t, 2)} m)`, estado: 'DECLARADO_SIN_VALIDAR', especificacion: 'PENDIENTE' });
export const MATERIAL_MALLA = (pct) => ({ nombre: 'Malla de acero', origen: `Fortificación declarada por la usuaria (malla: sí; traslapo ${pct} %)`, estado: 'DECLARADO_SIN_VALIDAR', especificacion: 'PENDIENTE' });

/** Región del revestimiento (hastiales + bóveda, sin solera) entre el contorno excavado de radio r y la cara interior r − t. */
export function regionRevestimiento(id, r, wall, t) {
  const ri = r - t;
  return { id, trama: 'SHOTCRETE_REGION', material: MATERIAL_SHOTCRETE(t), element: 'revestimiento', contorno: [[-r, 0], [-r, wall, -1], [r, wall], [r, 0], [ri, 0], [ri, wall, 1], [-ri, wall], [-ri, 0]], huecos: [] };
}

/** Detalles D1–D4 + llamadas desde la sección de fortificación. Devuelve vistas, llamadas y la nota de procedencia. */
export function detallesTunel({ r, wall, t, f, laminaSeccion = '05', laminaDetalles = '06' }) {
  const ri = r - t; const rm = r - 0.03; const Lp = f.perno_longitud; const P0 = 2 * wall + Math.PI * r; const n = Math.ceil(P0 / f.espaciamiento_transversal - 1e-9); const s1 = P0 / n / 2;
  const views = []; const callouts = [];
  const back = 'Detalles D1 a D4: llamadas en la sección de fortificación (ver lámina indicada en cada título).';
  // D1 — CORONA (1:20): contorno excavado, cara interior, revestimiento declarado, malla y perno de corona (truncado al marco).
  {
    const half = 0.7; const al = (Math.asin(half / r) * 180) / Math.PI; const a1 = 90 - al; const a2 = 90 + al; const lt = Math.min(Lp, 0.7); const yc = wall;
    const ents = [A('d1-exc', 'EXCAVACION', [0, yc], r, a1, a2, 'tunel-excavacion'), A('d1-int', 'INTERIOR', [0, yc], ri, a1, a2, 'revestimiento')];
    if (f.malla) ents.push(A('d1-malla', 'MALLA', [0, yc], rm, a1, a2, 'malla'));
    ents.push(L('d1-perno', 'PERNOS', [0, yc + r], [0, yc + r + lt], 'pernos'));
    const bulge = Math.tan(rad(a2 - a1) / 4);
    views.push({ id: 'D1', title: 'D1 Corona', scale: 20, detail_ref: 'D1', back_ref: { sheet: laminaSeccion, view: 'fortificacion' }, entities: ents,
      dimensions: [dimL('d1-esp', [0, yc + ri], [0, yc + r], 18)], labels: [],
      regions: [{ id: 'd1-rev', trama: 'SHOTCRETE_REGION', material: MATERIAL_SHOTCRETE(t), element: 'revestimiento', contorno: [[...P(r, a1, yc), bulge], P(r, a2, yc), [...P(ri, a2, yc), -bulge], P(ri, a1, yc)], huecos: [] }],
      symbols: [{ id: 'd1-cabeza', symbol: 'ANCHOR_HEAD', at: [0, yc + r], rot: 180, element: 'pernos' }, { id: 'd1-pend', symbol: 'PENDING_MARK', at: [0.45, yc + r + 0.45], rot: 0, element: 'unbound' }],
      notes: [`D1: revestimiento e = ${c2(t)} m declarado; perno de corona L = ${c2(Lp)} m dibujado truncado a ${c2(lt)} m (completo en lámina ${laminaSeccion}).`, 'D1: placa, tuerca, diámetro y lechada del perno PENDIENTES (símbolo de cabeza esquemático).', back] });
  }
  // D2 — HASTIAL Y PIE (1:20): encuentro del hastial con el piso. Sin solera/drenaje/fundación: no declarados.
  {
    const top = Math.max(1, s1 + 0.25); const lt = Math.min(Lp, 0.6);
    const ents = [L('d2-hastial', 'EXCAVACION', [-r, 0], [-r, top], 'tunel-excavacion'), L('d2-piso', 'EXCAVACION', [-r, 0], [-r + 0.6, 0], 'tunel-excavacion'), L('d2-int', 'INTERIOR', [-ri, 0], [-ri, top], 'revestimiento')];
    if (f.malla) ents.push(L('d2-malla', 'MALLA', [-rm, 0], [-rm, top], 'malla'));
    ents.push(L('d2-perno', 'PERNOS', [-r, s1], [-r - lt, s1], 'pernos'));
    views.push({ id: 'D2', title: 'D2 Hastial y pie', scale: 20, detail_ref: 'D2', back_ref: { sheet: laminaSeccion, view: 'fortificacion' }, entities: ents,
      dimensions: [dimL('d2-esp', [-r, top], [-ri, top], -10)], labels: [],
      regions: [{ id: 'd2-rev', trama: 'SHOTCRETE_REGION', material: MATERIAL_SHOTCRETE(t), element: 'revestimiento', contorno: [[-r, 0], [-ri, 0], [-ri, top], [-r, top]], huecos: [] }],
      symbols: [{ id: 'd2-pend', symbol: 'PENDING_MARK', at: [-r + 0.35, -0.12], rot: 0, element: 'unbound' }],
      notes: ['D2: solera, drenaje, fundación del hastial y encuentro con el piso NO declarados: PENDIENTES (no se dibujan).', `D2: el revestimiento termina en el piso (hipótesis de cubicación sin solera). Perno P1 a ${c2(s1, 3)} m del pie, truncado.`, back] });
  }
  // D3 — PERNO, MALLA Y SHOTCRETE (1:10): sistema en el perno P1 del hastial izquierdo.
  {
    const lt = Math.min(Lp, 0.4); const y0 = s1 - 0.2; const y1 = s1 + 0.2;
    const ents = [L('d3-exc', 'EXCAVACION', [-r, y0], [-r, y1], 'tunel-excavacion'), L('d3-int', 'INTERIOR', [-ri, y0], [-ri, y1], 'revestimiento')];
    if (f.malla) ents.push(L('d3-malla', 'MALLA', [-rm, y0], [-rm, y1], 'malla'));
    ents.push(L('d3-perno', 'PERNOS', [-r, s1], [-r - lt, s1], 'pernos'));
    views.push({ id: 'D3', title: 'D3 Perno, malla y shotcrete', scale: 10, detail_ref: 'D3', back_ref: { sheet: laminaSeccion, view: 'fortificacion' }, entities: ents,
      dimensions: [dimL('d3-esp', [-r, y1], [-ri, y1], -10)], labels: [{ at: [-r - lt / 2, s1], dy: -4, text: 'P1' }],
      regions: [{ id: 'd3-rev', trama: 'SHOTCRETE_REGION', material: MATERIAL_SHOTCRETE(t), element: 'revestimiento', contorno: [[-r, y0], [-ri, y0], [-ri, y1], [-r, y1]], huecos: [] }],
      symbols: [{ id: 'd3-cabeza', symbol: 'ANCHOR_HEAD', at: [-r, s1], rot: 270, element: 'pernos' }, { id: 'd3-pend', symbol: 'PENDING_MARK', at: [-r - 0.3, s1 + 0.12], rot: 0, element: 'unbound' }],
      notes: [`D3: perno L = ${c2(Lp)} m (declarado), dibujado truncado. Tipo, diámetro, lechada, placa y tuerca: PENDIENTES.`, f.malla ? 'D3: malla representada a 3 cm del contorno: hipótesis esquemática del motor, NO especificación.' : 'D3: sin malla declarada.', back] });
  }
  // D4 — TRASLAPO DE MALLA (esquemático, sin escala): el porcentaje NO se convierte en longitud sin ancho de paño declarado.
  if (f.malla) {
    const W = 2; const o = (W * f.traslapo_malla_pct) / 100; const H = 1;
    const ents = [L('d4-a1', 'MALLA', [0, 0], [W, 0], 'malla'), L('d4-a2', 'MALLA', [W, 0], [W, H], 'malla'), L('d4-a3', 'MALLA', [W, H], [0, H], 'malla'), L('d4-a4', 'MALLA', [0, H], [0, 0], 'malla'),
      L('d4-b1', 'MALLA', [W - o, 0], [2 * W - o, 0], 'malla'), L('d4-b2', 'MALLA', [2 * W - o, 0], [2 * W - o, H], 'malla'), L('d4-b3', 'MALLA', [2 * W - o, H], [W - o, H], 'malla'), L('d4-b4', 'MALLA', [W - o, H], [W - o, 0], 'malla')];
    const M = MATERIAL_MALLA(f.traslapo_malla_pct);
    views.push({ id: 'D4', title: 'D4 Traslapo de malla', scale: 50, schematic: true, detail_ref: 'D4', back_ref: { sheet: laminaSeccion, view: 'fortificacion' }, entities: ents, dimensions: [],
      labels: [{ at: [W - o / 2, H], dy: -4, text: `${f.traslapo_malla_pct} %` }, { at: [W / 2 - o, H / 2], dy: 0, text: 'Paño A' }, { at: [1.5 * W, H / 2], dy: 0, text: 'Paño B' }],
      regions: [{ id: 'd4-pa', trama: 'WIRE_MESH_REGION', material: M, element: 'malla', contorno: [[0, 0], [W - o, 0], [W - o, H], [0, H]], huecos: [] },
        { id: 'd4-tr', trama: 'MESH_OVERLAP_ZONE', material: M, etiqueta: 'Zona de traslapo de malla (longitud PENDIENTE)', element: 'malla', contorno: [[W - o, 0], [W, 0], [W, H], [W - o, H]], huecos: [] },
        { id: 'd4-pb', trama: 'WIRE_MESH_REGION', material: M, element: 'malla', contorno: [[W, 0], [2 * W - o, 0], [2 * W - o, H], [W, H]], huecos: [] }],
      symbols: [{ id: 'd4-pend', symbol: 'PENDING_MARK', at: [W - o / 2, -0.25], rot: 0, element: 'unbound' }],
      notes: [`D4: SIN ESCALA. Traslapo declarado ${f.traslapo_malla_pct} % del ancho de paño; el ancho de paño NO está declarado, por lo que la longitud de traslapo es PENDIENTE (no se infiere).`, `D4: la cubicación aplica el ${f.traslapo_malla_pct} % sobre la superficie desarrollada (fórmula en el cuadro de cantidades).`, back] });
  }
  const anchors = { D1: [0, wall + r], D2: [-r, 0], D3: [-r, s1], D4: [rm, wall / 2] };
  for (const v of views) callouts.push({ id: `C-${v.id}`, label: v.id, from_view: 'fortificacion', at: anchors[v.id], target_view: v.id, target_sheet: laminaDetalles });
  return { views, callouts };
}

/** Cuadros técnicos del túnel con la MISMA fuente que la cubicación (tw.cantidades/1 y la vista dibujada). */
export function cuadrosTunel(model, { cantidadesFortificacion, cantidadesTunelContrato }) {
  const tables = []; const q = model.quantities.find((x) => x.thickness_m === model.selected_thickness_m);
  const g = model.geometria;
  tables.push({ id: 'T-GEOM', sheet: '03', title: 'CUADRO GEOMÉTRICO (sección A-A)', source: 'model.quantities + parámetros declarados',
    columns: [{ key: 'mag', label: 'Magnitud' }, { key: 'val', label: 'Valor', align: 'right' }, { key: 'u', label: 'Unidad' }],
    rows: [
      { id: 'ancho', refs: ['seccion/outer-floor'], values: { mag: 'Ancho (luz)', val: g.width, u: 'm' }, fmt: { val: 2 } },
      { id: 'hastial', refs: ['seccion/outer-right'], values: { mag: 'Altura de hastial', val: g.wall, u: 'm' }, fmt: { val: 2 } },
      { id: 'radio', refs: ['seccion/outer-arch'], values: { mag: 'Radio de bóveda', val: g.width / 2, u: 'm' }, fmt: { val: 2 } },
      { id: 'altura', refs: ['seccion/outer-arch'], values: { mag: 'Altura total', val: g.wall + g.width / 2, u: 'm' }, fmt: { val: 2 } },
      { id: 'contorno', refs: ['seccion/outer-arch', 'seccion/outer-left', 'seccion/outer-right'], values: { mag: 'Contorno (hastiales + bóveda)', val: 2 * g.wall + Math.PI * g.width / 2, u: 'm' }, fmt: { val: 3 } },
      { id: 'area-exc', refs: ['q-excavacion'], quantity_ref: 'excavation_area_m2', values: { mag: 'Área excavada', val: q.excavation_area_m2, u: 'm²' }, fmt: { val: 6 } },
      { id: 'area-int', refs: ['seccion/inner-arch'], quantity_ref: 'interior_area_m2', values: { mag: 'Área interior', val: q.interior_area_m2, u: 'm²' }, fmt: { val: 6 } },
      { id: 'area-rev', refs: ['q-revestimiento'], quantity_ref: 'lining_area_m2', values: { mag: `Área revestimiento e = ${Math.round(q.thickness_m * 100)} cm`, val: q.lining_area_m2, u: 'm²' }, fmt: { val: 6 } },
    ], footnotes: ['Valores calculados de la sección dibujada (misma fuente que la cubicación).'] });
  const contrato = cantidadesTunelContrato(model);
  if (contrato) tables.push({ id: 'T-CANT', sheet: '01', title: 'CUADRO DE CANTIDADES (tw.cantidades/1, detalle sumable)', source: 'tw.cantidades/1',
    columns: [{ key: 'partida', label: 'Partida' }, { key: 'valor', label: 'Cantidad', align: 'right' }, { key: 'u', label: 'Unidad' }, { key: 'estado', label: 'Estado' }],
    rows: contrato.detalle.map((d) => ({ id: d.id, refs: [d.id], quantity_ref: d.id, values: { partida: d.partida, valor: d.valor, u: d.unidad, estado: d.estado }, fmt: { valor: d.unidad === 'u' ? 0 : 3 } })),
    footnotes: [`Largo ${c2(model.length_m, 0)} m. Alternativas no elegidas: comparación NO sumable.`] });
  const fort = cantidadesFortificacion(model);
  if (fort) {
    const vf = model.views.find((v) => v.id === 'fortificacion'); const pernos = vf.entities.filter((e) => e.layer === 'PERNOS'); const fP = fort.find((x) => x.unidad === 'u');
    const P0 = 2 * model.geometria.wall + Math.PI * model.geometria.width / 2; const paso = P0 / pernos.length; const w = model.geometria.wall;
    const zona = (s) => (s <= w ? 'hastial izq.' : s >= w + Math.PI * model.geometria.width / 2 ? 'hastial der.' : 'bóveda');
    tables.push({ id: 'T-PERNOS', sheet: '05', title: 'CUADRO DE PERNOS (calculado)', source: 'fortificacion/perno-* + cantidadesFortificacion',
      columns: [{ key: 'id', label: 'Perno' }, { key: 's', label: 's (m)', align: 'right' }, { key: 'L', label: 'L (m)', align: 'right' }, { key: 'zona', label: 'Ubicación' }],
      rows: [...pernos.map((e, i) => ({ id: `P${i + 1}`, refs: [e.ref], values: { id: `P${i + 1}`, s: (i + 0.5) * paso, L: Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), zona: zona((i + 0.5) * paso) }, fmt: { s: 3, L: 2 } })),
        { id: 'anillos', refs: ['q-pernos-de-anclaje'], values: { id: 'Anillos', s: '', L: '', zona: `${fP.distribucion.anillos} (ambos extremos)` } },
        { id: 'total', refs: ['q-pernos-de-anclaje'], quantity_ref: 'q-pernos-de-anclaje', values: { id: 'TOTAL', s: '', L: fP.longitud_total_m, zona: `${fP.cantidad} pernos` }, fmt: { L: 1 } }],
      footnotes: ['s: abscisa sobre el contorno desde el pie del hastial izquierdo. Patrón declarado; no es diseño geotécnico.'] });
    const t = model.selected_thickness_m; const f = model.fortificacion;
    tables.push({ id: 'T-MAT', sheet: '06', title: 'CUADRO DE MATERIALES Y ESPECIFICACIONES', source: 'datos declarados',
      columns: [{ key: 'el', label: 'Elemento' }, { key: 'dato', label: 'Dato declarado' }, { key: 'eett', label: 'Especificación técnica' }],
      rows: [
        { id: 'shotcrete', refs: ['q-revestimiento'], values: { el: 'Shotcrete', dato: `e = ${c2(t)} m`, eett: 'PENDIENTE' } },
        ...(f.malla ? [{ id: 'malla', refs: ['q-malla-de-acero'], values: { el: 'Malla de acero', dato: `traslapo ${f.traslapo_malla_pct} %`, eett: 'PENDIENTE' } }] : []),
        { id: 'pernos', refs: ['q-pernos-de-anclaje'], values: { el: 'Pernos', dato: `L = ${c2(f.perno_longitud)} m; ${c2(f.espaciamiento_transversal)} × ${c2(f.espaciamiento_longitudinal)} m`, eett: 'PENDIENTE' } },
        { id: 'placa', refs: [], values: { el: 'Placa y tuerca', dato: 'no declarado', eett: 'PENDIENTE' } },
      ], footnotes: ['Ninguna especificación técnica fue aportada: no se afirma calidad, resistencia ni norma.'] });
  }
  return tables;
}
