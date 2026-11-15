// Cantidades derivadas de la geometría REALMENTE construida del anteproyecto. La altura de muros la entrega Tannia (no se asume).
// Son cantidades de anteproyecto: no equivalen a las de un proyecto de construcción.
const r3 = (v) => Math.round(v * 1000) / 1000;

export function cubicarAnteproyecto(modelo, geo, { altura_muros_m }) {
  if (!(altura_muros_m > 0)) throw Object.assign(new Error('falta altura'), { code: 'FALTA_DATO' });
  const H = altura_muros_m * 1000; const out = [];
  const add = (codigo, descripcion, unidad, cantidad, formula, extra = {}) => out.push({ codigo, descripcion, unidad, cantidad: r3(cantidad), formula, ...extra });
  const validas = geo.aberturas.filter((a) => !a.invalida);
  const huecoDe = (seg) => validas.filter((a) => a.segmento === seg.id).reduce((acc, a) => acc + a.ancho_mm * (a.alto_mm || 2100), 0);
  const segsMuro = geo.murosSeg;
  const sum = (arr, f) => arr.reduce((acc, x) => acc + f(x), 0);
  const ext = segsMuro.filter((s) => s.tipo === 'ext'); const int = segsMuro.filter((s) => s.tipo === 'int');
  // Pisos y cielos
  for (const r of Object.values(geo.recintos)) add(`AP-PISO-${r.id.replace('R-', '')}`, `Superficie útil ${r.nombre}`, 'm2', r.area_neta_m2, 'ancho útil × fondo útil del recinto');
  add('AP-PISO-TOTAL', 'Superficie útil total', 'm2', geo.areas.util_neta_m2, 'Σ superficies útiles de recintos');
  add('AP-CONSTRUIDA', 'Superficie construida (contorno exterior)', 'm2', geo.areas.construida_m2, 'ancho exterior × fondo exterior');
  // Muros (una cara): longitud a ejes × altura − vanos
  const lExt = sum(ext, (s) => s.hasta - s.desde) / 1000; const lInt = sum(int, (s) => s.hasta - s.desde) / 1000;
  const aExt = sum(ext, (s) => (s.hasta - s.desde) * H - huecoDe(s)) / 1e6; const aInt = sum(int, (s) => (s.hasta - s.desde) * H - huecoDe(s)) / 1e6;
  add('AP-MURO-EXT-LONG', 'Longitud de muros exteriores (a ejes)', 'm', lExt, 'Σ longitud de segmentos exteriores');
  add('AP-MURO-INT-LONG', 'Longitud de muros interiores (a ejes)', 'm', lInt, 'Σ longitud de segmentos interiores (sin separaciones abiertas)');
  add('AP-MURO-EXT-AREA', 'Área de muros exteriores (una cara, descontados vanos)', 'm2', aExt, 'Σ (longitud × altura de muros) − Σ vanos', { supuestos: [`Altura de muros = ${altura_muros_m} m (dato entregado por la usuaria)`] });
  add('AP-MURO-INT-AREA', 'Área de muros interiores (una cara, descontados vanos)', 'm2', aInt, 'Σ (longitud × altura de muros) − Σ vanos', { supuestos: [`Altura de muros = ${altura_muros_m} m (dato entregado por la usuaria)`] });
  add('AP-MURO-EXT-VOL', 'Volumen de muros exteriores', 'm3', sum(ext, (s) => ((s.hasta - s.desde) * H - huecoDe(s)) * s.espesor) / 1e9, 'Σ (área neta × espesor)', { supuestos: [`Espesor exterior ${modelo.espesores.ext} mm (inicial del sistema; lo define el cálculo)`] });
  add('AP-MURO-INT-VOL', 'Volumen de muros interiores', 'm3', sum(int, (s) => ((s.hasta - s.desde) * H - huecoDe(s)) * s.espesor) / 1e9, 'Σ (área neta × espesor)', { supuestos: [`Espesor interior ${modelo.espesores.int} mm (inicial del sistema; lo define el cálculo)`] });
  // Aberturas: por tipo y medida
  const grupos = new Map();
  for (const a of validas.filter((x) => x.tipo !== 'paso')) { const k = `${a.tipo}|${a.ancho_mm}x${a.alto_mm}`; grupos.set(k, (grupos.get(k) || 0) + 1); }
  for (const [k, n] of [...grupos].sort()) { const [tipo, med] = k.split('|'); add(`AP-${tipo.toUpperCase()}-${med}`, `${tipo === 'ventana' ? 'Ventanas' : 'Puertas'} ${med} mm`, 'un', n, 'conteo de aberturas de esa medida'); }
  const pasos = validas.filter((a) => a.tipo === 'paso').length; if (pasos) add('AP-PASO-LIBRE', 'Pasos libres (vanos sin hoja)', 'un', pasos, 'conteo');
  add('AP-VANOS-AREA', 'Área total de vanos', 'm2', sum(validas, (a) => a.ancho_mm * (a.alto_mm || 2100)) / 1e6, 'Σ ancho × alto de aberturas');
  return out;
}
