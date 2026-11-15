// Coherencia geométrica y constructiva del anteproyecto. NO es una evaluación de cumplimiento normativo:
// impide entregar geometría rota (errores) y avisa brevemente de lo que conviene revisar (advertencias).
import { RECINTOS, GENERALES, ORIGEN } from '../conocimiento/criterios.js';

const solapa = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1;
const dentro = (a, b, tol = 2) => a.x0 >= b.x0 - tol && a.x1 <= b.x1 + tol && a.y0 >= b.y0 - tol && a.y1 <= b.y1 + tol;
const bboxPoly = (p) => ({ x0: Math.min(...p.map((q) => q.x)), x1: Math.max(...p.map((q) => q.x)), y0: Math.min(...p.map((q) => q.y)), y1: Math.max(...p.map((q) => q.y)) });

export function verificarCoherencia(modelo, geo) {
  const errores = []; const advertencias = [];
  const E = (codigo, ids, mensaje) => errores.push({ codigo, severidad: 'error', ids, mensaje });
  const W = (codigo, ids, mensaje) => advertencias.push({ codigo, severidad: 'advertencia', ids, mensaje });
  const R = geo.recintos; const ids = Object.keys(R);

  // C01–C03 recintos
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (solapa(R[ids[i]].neto, R[ids[j]].neto)) E('C01_RECINTOS_SOLAPADOS', [ids[i], ids[j]], `Los recintos ${R[ids[i]].nombre} y ${R[ids[j]].nombre} se solapan.`);
  for (const id of ids) {
    const r = R[id];
    if (!dentro(r.neto, geo.exterior)) E('C02_RECINTO_FUERA_DEL_CONTORNO', [id], `${r.nombre} queda fuera del contorno exterior.`);
    if (!(r.ancho_neto_mm > 0 && r.fondo_neto_mm > 0)) E('C02_RECINTO_SIN_SUPERFICIE', [id], `${r.nombre} no tiene superficie útil.`);
  }
  const sumaBrutoMuros = geo.areas.util_neta_m2 + geo.areas.muros_union_bruta_m2;
  if (Math.abs(sumaBrutoMuros - geo.areas.construida_m2) > 0.05) E('C03_AREAS_NO_CUADRAN', [], `Superficie útil (${geo.areas.util_neta_m2}) + muros (${geo.areas.muros_union_bruta_m2}) no suma la superficie construida (${geo.areas.construida_m2}).`);

  // C04–C06 aberturas
  const validas = geo.aberturas.filter((a) => !a.invalida);
  for (const a of geo.aberturas.filter((x) => x.invalida)) E('C04_ABERTURA_INVALIDA', [a.id], `${a.id}: ${a.motivo}`);
  for (const a of validas) if (a.ajustada) W('C04_ABERTURA_AJUSTADA', [a.id], `${a.id} se corrió para respetar la distancia mínima a las esquinas.`);
  for (let i = 0; i < validas.length; i++) for (let j = i + 1; j < validas.length; j++) {
    const a = validas[i]; const b = validas[j];
    if (a.segmento === b.segmento && Math.min(a.hasta, b.hasta) - Math.max(a.desde, b.desde) > 0) E('C05_ABERTURAS_SOLAPADAS', [a.id, b.id], `${a.id} y ${b.id} se superponen en el mismo muro.`);
  }
  const puertas = validas.filter((a) => a.hoja);
  for (const p of puertas) {
    const objetivo = R[p.hoja.abre_hacia]; const bb = bboxPoly(p.hoja.barrido);
    if (!dentro(bb, objetivo.neto, 5)) E('C06_BARRIDO_FUERA_DEL_RECINTO', [p.id], `El barrido de ${p.id} no cabe dentro de ${objetivo.nombre}.`);
  }
  for (let i = 0; i < puertas.length; i++) for (let j = i + 1; j < puertas.length; j++) {
    if (solapa(bboxPoly(puertas[i].hoja.barrido), bboxPoly(puertas[j].hoja.barrido))) E('C06_BARRIDOS_CHOCAN', [puertas[i].id, puertas[j].id], `Los barridos de ${puertas[i].id} y ${puertas[j].id} se cruzan.`);
  }
  // el barrido no debe tapar ventanas ni pasos del mismo recinto (solo se avisa)
  // C07 acceso: grafo de conexiones (puertas, pasos y separaciones abiertas) desde el acceso principal
  const acceso = validas.find((a) => a.funcion === 'acceso');
  if (!acceso) E('C07_SIN_ACCESO', [], 'No hay puerta de acceso principal.');
  else {
    const ady = new Map(ids.map((i) => [i, new Set()]));
    const un = (a, b) => { ady.get(a)?.add(b); ady.get(b)?.add(a); };
    for (const a of validas) if (a.entre && (a.tipo === 'puerta' || a.tipo === 'paso')) un(a.entre[0], a.entre[1]);
    for (const s of modelo.separaciones) if (s.tipo === 'abierta') un(s.a, s.b);
    const vis = new Set([acceso.recinto]); const cola = [acceso.recinto];
    while (cola.length) { const c = cola.shift(); for (const n of ady.get(c) || []) if (!vis.has(n)) { vis.add(n); cola.push(n); } }
    for (const id of ids) if (!vis.has(id)) E('C07_RECINTO_SIN_ACCESO', [id], `${R[id].nombre} no tiene acceso desde la entrada.`);
  }

  // Advertencias breves de diseño (criterios iniciales de práctica, no normativos)
  const exteriores = (id) => validas.filter((a) => a.recinto === id && a.tipo === 'ventana');
  for (const id of ids) {
    const r = R[id]; const c = RECINTOS[r.tipo];
    if (r.tipo !== 'pasillo' && !exteriores(id).length) W('D01_SIN_VENTANA_EXTERIOR', [id], r.tipo === 'bano' ? `${r.nombre} sin ventana exterior: definir ventilación (ducto o extracción) con el proyectista sanitario.` : `${r.nombre} sin ventana al exterior.`);
    if (c && c.area_min_m2 && r.area_neta_m2 < c.area_min_m2) W('D02_SUPERFICIE_BAJO_CRITERIO', [id], `${r.nombre}: ${r.area_neta_m2} m², bajo el criterio inicial de ${c.area_min_m2} m² (práctica de diseño; confirmar el valor aplicable).`);
    if (c && c.lado_min_m && Math.min(r.ancho_neto_mm, r.fondo_neto_mm) / 1000 < c.lado_min_m) W('D03_LADO_BAJO_CRITERIO', [id], `${r.nombre}: lado menor ${(Math.min(r.ancho_neto_mm, r.fondo_neto_mm) / 1000).toFixed(2)} m, bajo el criterio inicial de ${c.lado_min_m} m.`);
    if (c && c.relacion_max && r.relacion > c.relacion_max) W('D04_PROPORCION', [id], `${r.nombre}: proporción ${r.relacion}:1, alargada para el uso (criterio inicial ${c.relacion_max}:1).`);
    if (r.tipo === 'pasillo' && Math.min(r.ancho_neto_mm, r.fondo_neto_mm) < RECINTOS.pasillo.ancho_libre_min_mm) W('D05_PASILLO_ANGOSTO', [id], `Pasillo con ${Math.min(r.ancho_neto_mm, r.fondo_neto_mm)} mm libres (criterio inicial ${RECINTOS.pasillo.ancho_libre_min_mm} mm).`);
  }
  for (const a of validas.filter((x) => x.tipo === 'ventana')) {
    const r = R[a.recinto]; if (!r || !RECINTOS[r.tipo]?.area_min_m2 || r.tipo === 'bano') continue;
    const ratio = (a.ancho_mm * a.alto_mm) / 1e6 / r.area_neta_m2;
    const suma = validas.filter((x) => x.tipo === 'ventana' && x.recinto === a.recinto).reduce((acc, x) => acc + (x.ancho_mm * x.alto_mm) / 1e6, 0) / r.area_neta_m2;
    if (a === validas.find((x) => x.tipo === 'ventana' && x.recinto === a.recinto) && suma < GENERALES.relacion_vano_piso_referencia * 0.8) W('D06_VENTANA_PEQUENA', [a.recinto], `${r.nombre}: ventanas ≈ ${(suma * 100).toFixed(0)} % de la superficie (referencia inicial ${(GENERALES.relacion_vano_piso_referencia * 100).toFixed(0)} %).`);
    void ratio;
  }
  const objetivo = modelo.programa.superficie_objetivo_m2;
  if (Math.abs(geo.areas.construida_m2 - objetivo) / objetivo > GENERALES.tolerancia_superficie) W('D07_SUPERFICIE_DISTINTA', [], `Superficie construida ${geo.areas.construida_m2} m² vs ${objetivo} m² pedidos.`);
  if (geo.indicadores.balance_x_y < GENERALES.balance_muros_minimo) W('D08_BALANCE_MUROS', [], `Distribución de muros desbalanceada entre direcciones (indicador ${geo.indicadores.balance_x_y}): revisar con el ingeniero estructural.`);
  return { errores, advertencias, origen_criterios: ORIGEN, estado: errores.length ? 'con_errores' : advertencias.length ? 'con_advertencias' : 'ok' };
}
