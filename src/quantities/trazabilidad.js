// Trazabilidad entidad gráfica → vista → elemento físico → cantidad (QTY-01).
// Regla de fondo: una representación gráfica NO es una fuente de cubicación por existir en una capa. Solo se suma lo que el
// modelo autorizado declara como fuente; las vistas distintas de un mismo elemento nunca se suman entre sí.
// Sin nombres de capa ni descuentos manuales: la semántica viaja con la entidad (XDATA TANNIA_TRACE) y con el modelo autorizado.
const TOL_REL = 1e-6;
const casi = (a, b) => Math.abs(a - b) <= TOL_REL * Math.max(1, Math.abs(a), Math.abs(b));

export const ESQUEMA_MODELO = 'tw.quantity.model/1';

/** Valida un modelo autorizado (sidecar). Devuelve { modelo|null, problema|null }. */
export function validarModelo(modelo, dxfSha256) {
  if (modelo == null) return { modelo: null, problema: null };
  if (typeof modelo !== 'object' || modelo.schema !== ESQUEMA_MODELO || !Array.isArray(modelo.entidades) || !Array.isArray(modelo.elementos)) return { modelo: null, problema: 'MODELO_INVALIDO' };
  if (!dxfSha256 || modelo.dxf_sha256 !== dxfSha256) return { modelo: null, problema: 'MODELO_NO_CORRESPONDE' };
  return { modelo, problema: null };
}

const refDe = (m) => m.traza?.ref || null;
const resumen = (m, dim) => ({ ref: refDe(m), handle: m.handle || null, elemento: m.traza?.elemento ?? null, vista: m.traza?.vista ?? null, capa: m.capa, valor_m: m.valor === null ? null : m.valor * dim });

/**
 * candidatas: mediciones de la magnitud pedida en las capas pedidas. dim: factor de conversión a metros (ya elevado a la magnitud).
 * Devuelve qué se suma y por qué se excluye el resto, con referencias verificables a las entidades originales.
 */
export function clasificarFuentes(candidatas, { modelo = null, problemaModelo = null, dim = 1 } = {}) {
  const incluidas = []; const representaciones = []; const ambiguas = []; const desconocidas = []; const avisos = []; let revision = false;
  const conTraza = candidatas.filter((m) => m.traza); const sinTraza = candidatas.filter((m) => !m.traza);

  // 1) Entidades con semántica declarada
  const fuentesPorElemento = new Map();
  for (const m of conTraza) {
    const rol = m.traza.rol;
    if (!m.traza.elemento || !m.traza.vista || !m.traza.ref || !['fuente', 'representacion'].includes(rol)) { ambiguas.push({ ...resumen(m, dim), motivo: 'semantica_incompleta' }); continue; }
    if (rol === 'representacion') { representaciones.push(resumen(m, dim)); continue; }
    if (!fuentesPorElemento.has(m.traza.elemento)) fuentesPorElemento.set(m.traza.elemento, []);
    fuentesPorElemento.get(m.traza.elemento).push(m);
  }
  for (const [elemento, lista] of fuentesPorElemento) {
    const vistas = new Set(lista.map((m) => m.traza.vista));
    if (vistas.size > 1) { for (const m of lista) ambiguas.push({ ...resumen(m, dim), motivo: 'vistas_distintas_del_mismo_elemento', vistas: [...vistas].sort() }); avisos.push(`El elemento «${elemento}» tiene fuentes de cubicación en ${vistas.size} vistas (${[...vistas].sort().join(', ')}): son representaciones del mismo elemento y no se suman. Declare una sola fuente en el modelo.`); continue; }
    incluidas.push(...lista);
  }

  // 2) Contraste con el modelo geométrico autorizado
  const contraste = { estado: modelo ? 'verificado' : problemaModelo ? 'no_verificable' : 'sin_modelo', problema: problemaModelo, discrepancias: [] };
  if (modelo) {
    const porRef = new Map(modelo.entidades.map((x) => [x.ref, x]));
    const validas = [];
    for (const m of incluidas) {
      const aut = porRef.get(refDe(m));
      if (!aut) { desconocidas.push({ ...resumen(m, dim), motivo: 'entidad_no_autorizada_por_el_modelo' }); contraste.discrepancias.push({ ref: refDe(m), tipo: 'entidad_no_autorizada' }); continue; }
      if (aut.elemento !== m.traza.elemento || aut.vista !== m.traza.vista || aut.rol !== m.traza.rol) { ambiguas.push({ ...resumen(m, dim), motivo: 'traza_distinta_del_modelo' }); contraste.discrepancias.push({ ref: refDe(m), tipo: 'traza_distinta', modelo: { elemento: aut.elemento, vista: aut.vista, rol: aut.rol } }); continue; }
      const esperado = aut.magnitudes?.[m.magnitud === 'longitud' ? 'longitud_dxf_m' : `${m.magnitud}_dxf_m`];
      const medido = m.valor === null ? null : m.valor * dim;
      if (typeof esperado === 'number' && medido !== null && !casi(medido, esperado)) { contraste.discrepancias.push({ ref: refDe(m), tipo: 'magnitud_distinta', medido_m: medido, modelo_m: esperado }); revision = true; }
      validas.push(m);
    }
    incluidas.length = 0; incluidas.push(...validas);
    // Σ por elemento frente a la magnitud física autorizada del elemento
    const porElemento = new Map();
    for (const m of incluidas) porElemento.set(m.traza.elemento, (porElemento.get(m.traza.elemento) || 0) + (m.valor || 0) * dim);
    for (const [id, suma] of porElemento) {
      const el = modelo.elementos.find((x) => x.id === id); const esperado = el?.magnitudes?.[candidatas[0]?.magnitud === 'longitud' ? 'longitud_m' : `${candidatas[0]?.magnitud}_m`];
      if (typeof esperado === 'number' && !casi(suma, esperado)) { contraste.discrepancias.push({ elemento: id, tipo: 'suma_distinta_del_elemento', medido_m: suma, modelo_m: esperado }); revision = true; }
    }
    if (contraste.discrepancias.length) contraste.estado = 'con_discrepancias';
  } else if (conTraza.length) {
    revision = true; avisos.push(problemaModelo ? `El modelo autorizado no se pudo usar (${problemaModelo}): las cantidades no se contrastaron.` : 'Las entidades traen trazabilidad, pero no hay modelo autorizado para contrastar: revise antes de usar la cantidad.');
  }

  // 3) Entidades sin semántica: se miden como antes, pero las posibles copias de una misma forma se señalan (no se descuentan)
  const grupos = new Map();
  for (const m of sinTraza) { if (!m.forma || m.valor === null) continue; const k = `${m.capa}|${m.magnitud}|${m.forma}`; (grupos.get(k) || grupos.set(k, []).get(k)).push(m); }
  const posiblesCopias = [...grupos.values()].filter((g) => g.length > 1).map((g) => ({ cantidad: g.length, valor_m_cada_una: g[0].valor * dim, entidades: g.map((m) => ({ handle: m.handle || null, capa: m.capa })) }));
  if (posiblesCopias.length) { revision = true; avisos.push(`${posiblesCopias.length} grupo(s) de entidades sin semántica tienen forma y medida idénticas (posibles vistas o copias del mismo elemento). Se sumaron tal como están dibujadas y quedan marcadas para revisión; el dibujo no declara si son elementos independientes.`); }
  if (ambiguas.length || desconocidas.length) revision = true;
  const usadas = [...incluidas, ...sinTraza];
  return { usadas, representaciones, ambiguas, desconocidas, posiblesCopias, contraste, avisos, revision, resumen: { con_traza: conTraza.length, sin_traza: sinTraza.length, fuentes_usadas: incluidas.map((m) => resumen(m, dim)) } };
}
