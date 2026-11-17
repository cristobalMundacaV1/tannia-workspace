// Modelo geométrico AUTORIZADO para contrastar cubicaciones (QTY-01). Se genera desde el modelo de dibujo, no desde el DXF,
// y queda ligado al DXF por su SHA-256. Es un archivo auxiliar al lado del DXF: <nombre>.tannia-modelo.json
import crypto from 'node:crypto';
import { ESQUEMA_MODELO } from '../quantities/trazabilidad.js';

export const sidecarDe = (rutaDxf) => String(rutaDxf).replace(/\.dxf$/i, '') + '.tannia-modelo.json';
export const sha256Texto = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

/** Longitud tal como queda DIBUJADA en el DXF (con la exageración vertical del perfil), en metros. */
export function longitudDxf(view, e) {
  const ex = view.verticalScale ? view.scale / view.verticalScale : 1;
  if (e.kind === 'line') return Math.hypot(e.b[0] - e.a[0], (e.b[1] - e.a[1]) * ex);
  if (e.kind === 'arc') return e.radius * (e.end - e.start) * Math.PI / 180;
  return null;
}

export function buildQuantityModel(model, dxfText) {
  const entidades = [];
  for (const v of model.views) for (const e of v.entities) {
    const len = longitudDxf(v, e); if (len === null) continue;
    entidades.push({ ref: e.ref, elemento: e.element, vista: v.id, rol: e.role, magnitudes: { longitud_dxf_m: len } });
  }
  return { schema: ESQUEMA_MODELO, unidad: 'm', dxf_sha256: sha256Texto(dxfText), origen: 'tw.drawing/1', elementos: model.elements, entidades };
}
