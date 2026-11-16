// Compilador esquema/2 → modelo 3D estructurado (esquema 3D v1 de TW-09). La losa y la cubierta siguen la HUELLA REAL
// (anillo exterior; si hay patio central, rectángulos disjuntos): nunca la caja envolvente.
import { UserError } from '../mcp/util.js';
import { anilloDeRect } from './poligonos.js';

export const SUPUESTOS_3D = { espesor_losa_mm: 150, espesor_cubierta_mm: 150 };

export function esquemaA3d(esq, geo, p = {}) {
  if (geo.errores.length) throw new UserError('ESQUEMA_CON_ERRORES', `El esquema tiene errores geométricos y no se compila a 3D: ${geo.errores.map((e) => e.mensaje).join(' | ')}`);
  const altura = p.altura_muros_mm ?? esq.altura_piso_cielo_mm; const eL = p.espesor_losa_mm ?? SUPUESTOS_3D.espesor_losa_mm;
  const cub = p.cubierta === undefined ? { tipo: 'plana', espesor_mm: SUPUESTOS_3D.espesor_cubierta_mm } : p.cubierta;
  if (cub && cub.tipo !== 'plana') throw new UserError('CUBIERTA_NO_SOPORTADA', `Cubierta "${cub.tipo}" no soportada para huellas no rectangulares (L/U/patio): use cubierta plana o modele la cubierta inclinada por tramos rectangulares con el motor 3D.`, 'La cubierta plana sigue la huella real.');
  const muros = geo.murosSeg.map((s) => {
    const h = s.orient === 'h';
    return { id: s.id, nivel: 'N1', tipo: s.tipo, espesor_mm: s.espesor, p1: h ? [s.desde, s.fijo] : [s.fijo, s.desde], p2: h ? [s.hasta, s.fijo] : [s.fijo, s.hasta],
      vanos: geo.aberturas.filter((a) => !a.invalida && a.segmento === s.id).map((a) => ({ id: a.id, tipo: a.tipo, posicion_mm: a.pos_mm, ancho_mm: a.ancho_mm, alto_mm: a.alto_mm, ...(a.tipo === 'ventana' ? { antepecho_mm: a.antepecho_mm ?? 900 } : {}) })) };
  });
  const sinHuecos = geo.huella.huecos === 0 && geo.anillos_exteriores === 1;
  const contornos = sinHuecos ? [geo.huella.anillos.find((a) => !a.hueco).ring] : geo.union.corridas.length ? realRects(geo) : [];
  const losas = contornos.map((c, i) => ({ id: `L${i + 1}`, nivel: 'N1', contorno: c, espesor_mm: eL }));
  const cubiertas = cub ? contornos.map((c, i) => ({ id: `C${i + 1}`, nivel: 'N1', tipo: 'plana', espesor_mm: cub.espesor_mm ?? SUPUESTOS_3D.espesor_cubierta_mm, voladizo_mm: 0, contorno: c })) : [];
  return { esquema: 1, unidades: 'mm', niveles: [{ id: 'N1', nombre: 'Planta baja', cota_mm: 0, altura_mm: altura, fuente_altura: p.altura_muros_mm != null ? 'indicada' : 'plano_2d' }], muros, losas, cubiertas, opciones: { cubierta_visible: !!p.cubierta_visible }, origen: p.origen || { esquema: esq.id } };
}

/** Huella con patio: rectángulos disjuntos (celdas fusionadas por fila) de la unión muros + recintos. */
function realRects(geo) {
  const rs = [...geo.rectsMuro.map((r) => ({ ...r, clase: 'ext' })), ...Object.values(geo.rect).map((r) => ({ ...r, clase: 'ext' }))];
  return fusionarVertical(rectsCeldas(rs)).map(anilloDeRect);
}
import { unionMuros } from '../design/contorno.js';
function rectsCeldas(rs) { return unionMuros(rs, []).corridas; }
function fusionarVertical(rs) {
  const por = new Map(); for (const r of rs) { const k = `${r.x0}|${r.x1}`; (por.get(k) || por.set(k, []).get(k)).push(r); }
  const out = [];
  for (const l of por.values()) { l.sort((a, b) => a.y0 - b.y0); let cur = { ...l[0] }; for (let i = 1; i < l.length; i++) { if (l[i].y0 === cur.y1) cur.y1 = l[i].y1; else { out.push(cur); cur = { ...l[i] }; } } out.push(cur); }
  return out;
}
