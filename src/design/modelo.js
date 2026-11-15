// Modelo de diseño: árbol de particiones ortogonales (hojas = recintos). Unidades: mm. Medidas a EJES de muros.
// 'v' = división en X (hijos de oeste a este, `tamanos` = anchos); 'h' = división en Y (de sur a norte, `tamanos` = profundidades).
import { UserError } from '../mcp/util.js';

export const hoja = (id) => ({ tipo: 'recinto', id });
export const divide = (tipo, hijos, tamanos) => ({ tipo, hijos, tamanos });
export const esHoja = (n) => n.tipo === 'recinto';

/** Rectángulos de recintos a ejes, en coordenadas locales de ejes (origen en la esquina SO de los ejes). */
export function calcularRects(arbol, ancho, profundidad) {
  const rects = {};
  const visitar = (n, x0, y0, x1, y1, ruta) => {
    if (esHoja(n)) { if (rects[n.id]) throw new UserError('ARBOL_INCONSISTENTE', `Recinto repetido: ${n.id}.`); rects[n.id] = { x0, y0, x1, y1, ruta }; return; }
    const total = n.tipo === 'v' ? x1 - x0 : y1 - y0;
    const suma = n.tamanos.reduce((a, b) => a + b, 0);
    if (n.hijos.length !== n.tamanos.length || suma !== total || n.tamanos.some((t) => !(t > 0))) throw new UserError('ARBOL_INCONSISTENTE', `Las medidas de una división suman ${suma} y deberían sumar ${total}.`);
    let c = n.tipo === 'v' ? x0 : y0;
    n.hijos.forEach((h, i) => {
      const t = n.tamanos[i];
      if (n.tipo === 'v') visitar(h, c, y0, c + t, y1, [...ruta, i]); else visitar(h, x0, c, x1, c + t, [...ruta, i]);
      c += t;
    });
  };
  visitar(arbol, 0, 0, ancho, profundidad, []);
  return rects;
}

/** Nodo en una ruta de índices. */
export function nodoEn(arbol, ruta) { return ruta.reduce((n, i) => n.hijos[i], arbol); }

/** Camina el árbol y devuelve [{nodo, padre, indice, ruta}] para la hoja `id`, de la raíz a la hoja. */
export function caminoA(arbol, id) {
  const out = [];
  const visitar = (n, padre, indice, ruta) => {
    if (esHoja(n)) { if (n.id === id) { out.push({ nodo: n, padre, indice, ruta }); return true; } return false; }
    for (let i = 0; i < n.hijos.length; i++) if (visitar(n.hijos[i], n, i, [...ruta, i])) { out.unshift({ nodo: n, padre, indice, ruta }); return true; }
    return false;
  };
  return visitar(arbol, null, -1, []) ? out : null;
}

export function hojas(arbol) { return esHoja(arbol) ? [arbol.id] : arbol.hijos.flatMap(hojas); }

export function clonar(x) { return JSON.parse(JSON.stringify(x)); }

export const redondear = (v, paso = 50) => Math.round(v / paso) * paso;
