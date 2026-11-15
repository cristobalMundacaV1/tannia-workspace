// Generador de distribución para vivienda de un piso (planta rectangular): del programa a un modelo editable.
// Esquema: franja sur (día: living-comedor + cocina + baño), pasillo, franja norte (noche: dormitorios y baño principal).
import { UserError } from '../mcp/util.js';
import { SISTEMAS, RECINTOS, ABERTURAS, GENERALES, ORIGEN, CONFIRMAR } from '../conocimiento/criterios.js';
import { hoja, divide, redondear, clonar } from './modelo.js';

export const LIMITES = { dormitorios: [2, 3], banos: [1, 2], superficie_m2: [55, 130] };

export function normalizarPrograma(entrada = {}) {
  const supuestos = [];
  const p = {
    superficie_objetivo_m2: entrada.superficie_objetivo_m2 ?? 80,
    dormitorios: entrada.dormitorios ?? 3,
    banos: entrada.banos ?? 2,
    cocina: entrada.cocina ?? 'americana',
    sistema_constructivo: entrada.sistema_constructivo ?? 'albanileria_confinada',
    variante: entrada.variante ?? 'A',
  };
  if (entrada.superficie_objetivo_m2 === undefined) supuestos.push('Superficie objetivo no indicada: se parte con 80 m² construidos.');
  if (entrada.sistema_constructivo === undefined) supuestos.push('Sistema constructivo no indicado: se parte con albañilería confinada (el más habitual en vivienda de un piso); es modificable.');
  if (entrada.cocina === undefined) supuestos.push('Cocina: americana (abierta al living-comedor).');
  if (!SISTEMAS[p.sistema_constructivo]) throw new UserError('PROGRAMA_NO_SOPORTADO', `Sistema constructivo no reconocido: ${p.sistema_constructivo}.`, `Opciones: ${Object.keys(SISTEMAS).join(', ')}.`);
  if (!['americana', 'cerrada'].includes(p.cocina)) throw new UserError('PROGRAMA_NO_SOPORTADO', 'cocina debe ser "americana" o "cerrada".');
  if (!['A', 'B'].includes(p.variante)) throw new UserError('PROGRAMA_NO_SOPORTADO', 'variante debe ser "A" o "B" (B es la planta espejada).');
  const [dmin, dmax] = LIMITES.dormitorios; const [bmin, bmax] = LIMITES.banos; const [smin, smax] = LIMITES.superficie_m2;
  if (!Number.isInteger(p.dormitorios) || p.dormitorios < dmin || p.dormitorios > dmax) throw new UserError('PROGRAMA_NO_SOPORTADO', `Esta primera entrega genera de ${dmin} a ${dmax} dormitorios (pidió ${p.dormitorios}).`, 'Pruebe con otra cantidad o dibuje el resto como modificación.');
  if (!Number.isInteger(p.banos) || p.banos < bmin || p.banos > bmax) throw new UserError('PROGRAMA_NO_SOPORTADO', `Esta primera entrega genera de ${bmin} a ${bmax} baños (pidió ${p.banos}).`);
  if (!(p.superficie_objetivo_m2 >= smin && p.superficie_objetivo_m2 <= smax)) throw new UserError('PROGRAMA_NO_SOPORTADO', `Esta primera entrega genera viviendas de ${smin} a ${smax} m² (pidió ${p.superficie_objetivo_m2}).`);
  return { programa: p, supuestos };
}

export function generarModelo(entrada = {}) {
  const { programa, supuestos } = normalizarPrograma(entrada);
  const sis = SISTEMAS[programa.sistema_constructivo];
  const te = entrada.espesor_ext_mm ?? sis.espesor_muro_ext_mm; const ti = entrada.espesor_int_mm ?? sis.espesor_muro_int_mm;
  const fundamentos = []; const preguntas = [];

  // Anchos a ejes de la franja norte (dormitorios y baño principal) y mínimos de la franja sur
  const nAnchos = [RECINTOS.dormitorio_principal.ancho_eje_mm];
  const nIds = ['R-DP'];
  if (programa.banos === 2) { nAnchos.push(RECINTOS.bano.ancho_eje_mm); nIds.push('R-BP'); }
  for (let i = 2; i <= programa.dormitorios; i++) { nAnchos.push(RECINTOS.dormitorio.ancho_eje_mm); nIds.push(`R-D${i}`); }
  const wNmin = nAnchos.reduce((a, b) => a + b, 0);
  const sBano = RECINTOS.bano.ancho_eje_mm - 100; const sCocina = RECINTOS.cocina.ancho_eje_mm; const sLivMin = 5200;
  const wSmin = sBano + sCocina + sLivMin;

  // Profundidades base (a ejes): día, pasillo, noche
  const dm = RECINTOS.pasillo.ancho_eje_mm; let ds = 3100; let dn = 2900;
  const A = programa.superficie_objetivo_m2 * 1e6;
  let W = A / (ds + dm + dn + te) - te; // ancho a ejes si se mantienen las profundidades base
  if (W < Math.max(wNmin, wSmin)) {
    W = Math.max(wNmin, wSmin);
    const D = A / (W + te) - te; const dMin = 6300;
    const Dc = Math.max(D, dMin);
    const reparto = Dc - dm; ds = redondear(reparto * 0.52); dn = redondear(reparto - ds);
    if (D < dMin) supuestos.push(`Con los anchos de recinto de partida, el programa necesita al menos ${(((W + te) * (dMin + te)) / 1e6).toFixed(1)} m²: se genera con ese mínimo (más que lo pedido).`);
  }
  W = redondear(W);
  const D = ds + dm + dn;

  // Reparto del ancho sobrante entre los dormitorios (franja norte) y el living (franja sur)
  const extraN = W - wNmin; const nW = [...nAnchos];
  const idxDorm = nIds.map((id, i) => (id.startsWith('R-D') ? i : -1)).filter((i) => i >= 0);
  const sumaD = idxDorm.reduce((a, i) => a + nAnchos[i], 0);
  let usado = 0; idxDorm.forEach((i, k) => { const add = k === idxDorm.length - 1 ? extraN - usado : redondear((extraN * nAnchos[i]) / sumaD); nW[i] += add; usado += add; });
  const sW = [W - sBano - sCocina, sCocina, sBano];

  // Árbol (variante B = espejo en X)
  const recintos = {};
  const R = (id, nombre, tipo) => { recintos[id] = { id, nombre, tipo }; return hoja(id); };
  recintos['R-LIV'] = { id: 'R-LIV', nombre: 'LIVING-COMEDOR', tipo: 'living_comedor' };
  recintos['R-COC'] = { id: 'R-COC', nombre: programa.cocina === 'americana' ? 'COCINA AMERICANA' : 'COCINA', tipo: 'cocina' };
  recintos['R-BC'] = { id: 'R-BC', nombre: programa.banos === 2 ? 'BAÑO 1' : 'BAÑO', tipo: 'bano' };
  recintos['R-PAS'] = { id: 'R-PAS', nombre: 'PASILLO', tipo: 'pasillo' };
  recintos['R-DP'] = { id: 'R-DP', nombre: 'DORMITORIO PRINCIPAL', tipo: 'dormitorio_principal' };
  if (programa.banos === 2) recintos['R-BP'] = { id: 'R-BP', nombre: 'BAÑO PRINCIPAL', tipo: 'bano' };
  for (let i = 2; i <= programa.dormitorios; i++) recintos[`R-D${i}`] = { id: `R-D${i}`, nombre: `DORMITORIO ${i}`, tipo: 'dormitorio' };
  void R;
  let sIds = ['R-LIV', 'R-COC', 'R-BC']; let sTam = [...sW]; let nIdsO = [...nIds]; let nTam = [...nW];
  if (programa.variante === 'B') { sIds = sIds.reverse(); sTam = sTam.reverse(); nIdsO = nIdsO.reverse(); nTam = nTam.reverse(); }
  const arbol = divide('h', [
    divide('v', sIds.map(hoja), sTam),
    hoja('R-PAS'),
    divide('v', nIdsO.map(hoja), nTam),
  ], [ds, dm, dn]);

  const separaciones = programa.cocina === 'americana' ? [{ a: 'R-LIV', b: 'R-COC', tipo: 'abierta' }] : [];

  // Fundamentos y preguntas (breves): decisiones con criterio técnico y dónde confirmarlas
  fundamentos.push({ decision: `Sistema constructivo: ${sis.nombre}; muros exteriores ${te} mm e interiores ${ti} mm (totales, con revestimientos)`, criterio: 'Espesores iniciales por sistema; los define el proyecto de cálculo', origen: ORIGEN, confirmar_en: sis.normas });
  fundamentos.push({ decision: 'Planta rectangular, ortogonal y regular, con muros alineados en ambas direcciones', criterio: 'Regularidad en planta favorece el comportamiento sísmico y simplifica la construcción', origen: ORIGEN, confirmar_en: ['nch433'] });
  fundamentos.push({ decision: `Altura piso–cielo inicial ${GENERALES.altura_piso_cielo_mm / 1000} m`, criterio: 'Valor de partida de práctica de diseño', origen: ORIGEN, confirmar_en: CONFIRMAR.altura_cielo });
  fundamentos.push({ decision: 'Recintos húmedos (baños, cocina) agrupados; franja de día al frente y de noche al fondo', criterio: 'Simplifica instalaciones y separa zonas de uso', origen: ORIGEN, confirmar_en: ['ridaa'] });
  fundamentos.push({ decision: 'Ventanas en muros exteriores; baños con ventana pequeña alta', criterio: 'Iluminación y ventilación natural de recintos habitables', origen: ORIGEN, confirmar_en: CONFIRMAR.iluminacion_ventilacion });
  preguntas.push('¿Dimensiones, forma y orientación del terreno, y comuna? (determinan retranqueos, rasantes, coeficientes y zona térmica)');
  if (entrada.sistema_constructivo === undefined) preguntas.push('¿Prefiere otro sistema constructivo (hormigón armado, entramado de madera)?');

  const modelo = {
    version_modelo: 1,
    programa, sistema: programa.sistema_constructivo, espesores: { ext: te, int: ti },
    ejes: { ancho: W, profundidad: D }, arbol, recintos, separaciones, aberturas: [],
    altura_piso_cielo_mm: GENERALES.altura_piso_cielo_mm,
    supuestos, fundamentos, preguntas,
  };
  modelo.aberturas = aberturasPorDefecto(modelo);
  return modelo;
}

let seq = 0;
const nuevoId = (prefijo, existentes) => { let n = 1; while (existentes.has(`${prefijo}-${n}`)) n++; return `${prefijo}-${n}`; };

/** Puertas y ventanas iniciales, referenciadas a recinto/lado o frontera entre recintos. */
export function aberturasPorDefecto(modelo) {
  const ab = []; const ids = new Set();
  const add = (o) => { const id = nuevoId(o.tipo === 'ventana' ? 'V' : 'P', ids); ids.add(id); ab.push({ id, ...o }); };
  const A = ABERTURAS; const rec = modelo.recintos;
  const B = modelo.programa.variante === 'B';
  // Entrada principal y ventanas del living (frente, lado S)
  add({ tipo: 'puerta', funcion: 'acceso', recinto: 'R-LIV', lado: 'S', ancho_mm: A.puerta_acceso.ancho_mm, alto_mm: A.puerta_acceso.alto_mm, ancla: B ? 'fin' : 'inicio', distancia_mm: 1100, abre_hacia: 'R-LIV' });
  add({ tipo: 'ventana', recinto: 'R-LIV', lado: 'S', ancho_mm: A.ventana_living.ancho_mm, alto_mm: A.ventana_living.alto_mm, antepecho_mm: A.ventana_living.antepecho_mm, ancla: B ? 'inicio' : 'fin', distancia_mm: 1900 });
  add({ tipo: 'ventana', recinto: 'R-LIV', lado: B ? 'E' : 'O', ancho_mm: A.ventana_habitable.ancho_mm, alto_mm: A.ventana_living.alto_mm, antepecho_mm: A.ventana_living.antepecho_mm, ancla: 'centro', distancia_mm: 0 });
  // Paso libre living–pasillo
  add({ tipo: 'paso', entre: ['R-LIV', 'R-PAS'], ancho_mm: A.paso_libre.ancho_mm, alto_mm: A.paso_libre.alto_mm, ancla: B ? 'fin' : 'inicio', distancia_mm: 3300 });
  // Cocina: ventana al frente
  add({ tipo: 'ventana', recinto: 'R-COC', lado: 'S', ancho_mm: 1200, alto_mm: A.ventana_habitable.alto_mm, antepecho_mm: 1000, ancla: 'centro', distancia_mm: 0 });
  // Cocina cerrada: puerta desde el living
  if (modelo.programa.cocina === 'cerrada') add({ tipo: 'puerta', entre: ['R-LIV', 'R-COC'], ancho_mm: A.puerta_interior.ancho_mm, alto_mm: A.puerta_interior.alto_mm, ancla: 'centro', distancia_mm: 0, abre_hacia: 'R-COC' });
  // Baño 1 (franja sur): puerta al pasillo y ventana pequeña
  add({ tipo: 'puerta', entre: ['R-BC', 'R-PAS'], ancho_mm: A.puerta_bano.ancho_mm, alto_mm: A.puerta_bano.alto_mm, ancla: 'centro', distancia_mm: 0, abre_hacia: 'R-BC' });
  add({ tipo: 'ventana', recinto: 'R-BC', lado: 'S', ancho_mm: A.ventana_bano.ancho_mm, alto_mm: A.ventana_bano.alto_mm, antepecho_mm: A.ventana_bano.antepecho_mm, ancla: 'centro', distancia_mm: 0 });
  // Dormitorios (franja norte): puerta al pasillo (lado S del recinto) y ventana al norte
  const dorms = Object.values(rec).filter((r) => r.tipo === 'dormitorio_principal' || r.tipo === 'dormitorio');
  for (const d of dorms) {
    add({ tipo: 'puerta', entre: [d.id, 'R-PAS'], ancho_mm: A.puerta_interior.ancho_mm, alto_mm: A.puerta_interior.alto_mm, ancla: 'inicio', distancia_mm: 700, abre_hacia: d.id });
    add({ tipo: 'ventana', recinto: d.id, lado: 'N', ancho_mm: A.ventana_habitable.ancho_mm, alto_mm: A.ventana_habitable.alto_mm, antepecho_mm: A.ventana_habitable.antepecho_mm, ancla: 'centro', distancia_mm: 0 });
  }
  // Baño principal: puerta desde el dormitorio principal (en suite) y ventana al norte
  if (rec['R-BP']) {
    add({ tipo: 'puerta', entre: ['R-DP', 'R-BP'], ancho_mm: A.puerta_bano.ancho_mm, alto_mm: A.puerta_bano.alto_mm, ancla: 'fin', distancia_mm: 700, abre_hacia: 'R-BP' });
    add({ tipo: 'ventana', recinto: 'R-BP', lado: 'N', ancho_mm: A.ventana_bano.ancho_mm, alto_mm: A.ventana_bano.alto_mm, antepecho_mm: A.ventana_bano.antepecho_mm, ancla: 'centro', distancia_mm: 0 });
  }
  void seq; void clonar;
  return ab;
}
