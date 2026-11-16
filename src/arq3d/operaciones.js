// Catálogo de operaciones sobre el modelo 3D estructurado. Cada operación es explícita (sin "texto libre"): Claude Desktop traduce
// el lenguaje natural a estas operaciones. Se aplican todas o ninguna (la validación corre sobre el resultado completo).
import { UserError } from '../mcp/util.js';
import { validarModelo } from './geometria.js';

const buscar = (lista, id, tipo) => { const x = lista.find((e) => e.id === id); if (!x) throw new UserError('NO_EXISTE', `No existe ${tipo} "${id}".`, `Existentes: ${lista.map((e) => e.id).join(', ') || '(ninguno)'}.`); return x; };
const agregar = (lista, obj, tipo) => { if (!obj?.id) throw new UserError('FALTA_ID', `El ${tipo} nuevo necesita un id.`); if (lista.some((e) => e.id === obj.id)) throw new UserError('ID_REPETIDO', `Ya existe ${tipo} "${obj.id}".`); lista.push(obj); };
const quitar = (lista, id, tipo) => { const i = lista.findIndex((e) => e.id === id); if (i < 0) throw new UserError('NO_EXISTE', `No existe ${tipo} "${id}".`); lista.splice(i, 1); };
const parchear = (obj, cambios) => { if (!cambios || typeof cambios !== 'object') throw new UserError('SIN_CAMBIOS', 'Indique "cambios".'); for (const k of Object.keys(cambios)) { if (k === 'id') throw new UserError('CAMBIO_INVALIDO', 'No se cambia el id.'); obj[k] = cambios[k]; } };
const muroDeVano = (m, id) => { for (const w of m.muros) { const v = w.vanos?.find((x) => x.id === id); if (v) return { w, v }; } throw new UserError('NO_EXISTE', `No existe el vano "${id}".`); };

export const CATALOGO_3D = {
  agregar_nivel: { descripcion: 'Agrega un nivel (piso).', campos: 'nivel:{id,cota_mm,altura_mm,nombre?}', aplicar: (m, o) => { agregar(m.niveles, o.nivel, 'nivel'); return `Nivel ${o.nivel.id} agregado.`; } },
  modificar_nivel: { descripcion: 'Cambia cota o altura de un nivel (afecta a todos sus muros sin altura propia).', campos: 'id, cambios:{cota_mm?,altura_mm?,nombre?}', aplicar: (m, o) => { parchear(buscar(m.niveles, o.id, 'el nivel'), o.cambios); return `Nivel ${o.id} modificado.`; } },
  agregar_muro: { descripcion: 'Agrega un muro por su eje (p1→p2) con espesor y, si corresponde, vanos.', campos: 'muro:{id,nivel,p1:[x,y],p2:[x,y],espesor_mm,tipo:"ext"|"int",altura_mm?,vanos?[]}', aplicar: (m, o) => { agregar(m.muros, o.muro, 'muro'); return `Muro ${o.muro.id} agregado.`; } },
  modificar_muro: { descripcion: 'Cambia puntos, espesor, altura, tipo o nivel de un muro.', campos: 'id, cambios:{p1?,p2?,espesor_mm?,altura_mm?,tipo?,nivel?}', aplicar: (m, o) => { parchear(buscar(m.muros, o.id, 'el muro'), o.cambios); return `Muro ${o.id} modificado.`; } },
  eliminar_muro: { descripcion: 'Elimina un muro (y sus vanos).', campos: 'id', aplicar: (m, o) => { quitar(m.muros, o.id, 'el muro'); return `Muro ${o.id} eliminado.`; } },
  agregar_vano: { descripcion: 'Agrega una puerta, ventana o paso en un muro (posición = centro medido desde p1).', campos: 'muro, vano:{id,tipo,posicion_mm,ancho_mm,alto_mm,antepecho_mm (ventanas)}', aplicar: (m, o) => { const w = buscar(m.muros, o.muro, 'el muro'); w.vanos = w.vanos || []; agregar(w.vanos, o.vano, 'vano'); return `Vano ${o.vano.id} agregado al muro ${o.muro}.`; } },
  modificar_vano: { descripcion: 'Cambia posición, ancho, alto o antepecho de un vano.', campos: 'id, cambios', aplicar: (m, o) => { parchear(muroDeVano(m, o.id).v, o.cambios); return `Vano ${o.id} modificado.`; } },
  eliminar_vano: { descripcion: 'Elimina un vano (el muro queda continuo).', campos: 'id', aplicar: (m, o) => { const { w } = muroDeVano(m, o.id); quitar(w.vanos, o.id, 'el vano'); return `Vano ${o.id} eliminado.`; } },
  agregar_losa: { descripcion: 'Agrega una losa de contorno ortogonal bajo la cota del nivel.', campos: 'losa:{id,nivel,contorno:[[x,y],…],espesor_mm}', aplicar: (m, o) => { agregar(m.losas, o.losa, 'losa'); return `Losa ${o.losa.id} agregada.`; } },
  modificar_losa: { descripcion: 'Cambia contorno, espesor o nivel de una losa.', campos: 'id, cambios', aplicar: (m, o) => { parchear(buscar(m.losas, o.id, 'la losa'), o.cambios); return `Losa ${o.id} modificada.`; } },
  eliminar_losa: { descripcion: 'Elimina una losa.', campos: 'id', aplicar: (m, o) => { quitar(m.losas, o.id, 'la losa'); return `Losa ${o.id} eliminada.`; } },
  definir_cubierta: { descripcion: 'Agrega o reemplaza una cubierta: plana (espesor_mm), un_agua (pendiente_pct, direccion) o dos_aguas (pendiente_pct, eje_cumbrera). La pendiente NO se asume.', campos: 'cubierta:{id,nivel,tipo,espesor_mm?,pendiente_pct?,direccion?,eje_cumbrera?,voladizo_mm?,contorno?}', aplicar: (m, o) => { if (!o.cubierta?.id) throw new UserError('FALTA_ID', 'La cubierta necesita id.'); const i = m.cubiertas.findIndex((c) => c.id === o.cubierta.id); if (i >= 0) m.cubiertas[i] = o.cubierta; else m.cubiertas.push(o.cubierta); return `Cubierta ${o.cubierta.id} definida (${o.cubierta.tipo}).`; } },
  eliminar_cubierta: { descripcion: 'Elimina una cubierta.', campos: 'id', aplicar: (m, o) => { quitar(m.cubiertas, o.id, 'la cubierta'); return `Cubierta ${o.id} eliminada.`; } },
  mostrar_cubierta: { descripcion: 'Decide si la capa de cubierta queda visible (false = oculta para ver el interior).', campos: 'visible:boolean', aplicar: (m, o) => { m.opciones = { ...(m.opciones || {}), cubierta_visible: !!o.visible }; return `Cubierta ${o.visible ? 'visible' : 'oculta'}.`; } },
};

export function aplicarOperaciones3d(modelo, operaciones) {
  if (!Array.isArray(operaciones) || !operaciones.length) throw new UserError('SIN_OPERACIONES', 'Indique al menos una operación.', `Operaciones: ${Object.keys(CATALOGO_3D).join(', ')}.`);
  const m = JSON.parse(JSON.stringify(modelo)); const resumen = [];
  for (const [i, o] of operaciones.entries()) {
    const def = CATALOGO_3D[o?.operacion];
    if (!def) throw new UserError('OPERACION_DESCONOCIDA', `Operación ${i + 1}: "${o?.operacion}" no existe.`, `Operaciones: ${Object.keys(CATALOGO_3D).join(', ')}.`);
    try { resumen.push(def.aplicar(m, o)); } catch (e) { if (e instanceof UserError) throw new UserError(e.code, `Operación ${i + 1} (${o.operacion}): ${e.message}`, e.hint, e.detalle); throw e; }
  }
  return { modelo: validarModelo(m), resumen };
}
