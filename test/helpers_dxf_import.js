// Mediciones sintéticas para simular lo que devuelve `importar_dxf_aislado` (NO es AutoCAD real).
import { esperadoDesdeDxf } from '../src/cad/dxf_api.js';

/** Medición que un AutoCAD «perfecto» devolvería para este DXF (todo se conserva). `mutar` permite simular pérdidas. */
export function medidoDesdeDxf(dxf, mutar = null) {
  const e = esperadoDesdeDxf(dxf);
  const m = {
    entidades_modelo: e.entidades_modelo, por_capa: { ...e.por_capa }, dimensiones: e.dimensiones, con_traza: e.con_traza, trazas: e.trazas.map((t) => ({ ...t })), ilegibles: 0,
    layouts: e.layouts.map((l) => ({ nombre: l.nombre, viewports: l.viewports.map((v) => ({ ...v })), textos: [...(e.textos_papel[l.nombre] || [])] })),
  };
  if (mutar) mutar(m);
  return m;
}

/** Respuesta `data` de importar_dxf_aislado. */
export function dataImportado(dxf, { mutar = null, extra = {} } = {}) {
  return { documento: 'Drawing2.dwg', nombre_aislado: 'Drawing2.dwg', ruta: 'Drawing2.dwg', guardado: false, aislado: true, via: 'Documents.Add+Import', documentos_abiertos: 2, sin_guardar: ['Dibujo1.dwg', 'Drawing2.dwg'], medido: medidoDesdeDxf(dxf, mutar), ...extra };
}
