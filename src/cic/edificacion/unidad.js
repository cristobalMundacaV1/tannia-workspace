// G8: programa arquitectónico INDEPENDIENTE de la tipología (espacios, condiciones de borde, niveles). Generador paramétrico por franjas:
// produce geometría real (recintos, muros clasificados, vanos, losas, balcón) y un modelo 3D arq3d. NO es un buscador de plantillas: la tipología cambia las
// condiciones de borde, el acceso y las losas. Todo valor de práctica (espesores, alturas, proporción) es un SUPUESTO declarado y editable, nunca normativo.
import { z } from 'zod';
import { UserError } from '../../mcp/util.js';
import { propiedades } from '../../geo/geom.js';

export const TIPOLOGIAS = ['departamento', 'casa', 'oficina', 'local_comercial'];
export const LADOS = ['N', 'E', 'S', 'O'];
export const BORDE = z.enum(['fachada', 'medianero', 'nucleo', 'vacio']);
export const ProgramaSchema = z.object({
  tipologia: z.enum(TIPOLOGIAS), nombre: z.string().min(1).max(60), superficie_m2: z.number().positive().max(2000), dormitorios: z.number().int().min(0).max(6).optional(), banos: z.number().int().min(0).max(6).optional(),
  nivel: z.object({ indice: z.number().int().min(0).max(80), ultimo_piso: z.boolean().optional() }).strict().optional(),
  terraza: z.object({ presente: z.boolean(), area_m2: z.number().positive().max(200).optional() }).strict().optional(),
  lados: z.record(z.enum(LADOS), BORDE).optional().describe('condición de borde por lado del dibujo (N/E/S/O del PLANO, no norte verdadero)'),
  frente_m: z.number().positive().max(60).optional(), altura_entrepiso_mm: z.number().min(2200).max(6000).optional(),
}).strict();

const mm = (m) => Math.round(m * 1000);
const SUPUESTOS_DEFAULT = { espesor_muro_perimetral_mm: 200, espesor_muro_interior_mm: 100, espesor_losa_mm: 150, altura_entrepiso_mm: 2800, proporcion_frente_fondo: 1.4, balcon_profundidad_mm: 1500, ventana: { ancho_mm: 1200, alto_mm: 1200, antepecho_mm: 900 }, puerta_acceso: { ancho_mm: 900, alto_mm: 2100 }, puerta_interior: { ancho_mm: 800, alto_mm: 2100 } };

/** Condiciones de borde por tipología (los lados NO declarados se completan con un supuesto editable y se informa). */
function bordes(p, supuestos) {
  const decl = p.lados || {}; const out = {};
  const def = p.tipologia === 'casa' ? { N: 'fachada', E: 'fachada', S: 'fachada', O: 'fachada' } : { N: 'fachada', E: 'medianero', S: 'nucleo', O: 'medianero' };
  for (const l of LADOS) { if (decl[l]) out[l] = decl[l]; else { out[l] = def[l]; if (p.lados) supuestos.push(`Lado ${l} del plano: «${def[l]}» (supuesto editable; la usuaria no lo indicó).`); } }
  if (!p.lados) supuestos.push(`Condiciones de borde por defecto para ${p.tipologia}: ${LADOS.map((l) => `${l}=${out[l]}`).join(', ')} (ejes del PLANO; la orientación real del edificio es desconocida).`);
  const v = Object.values(out); if (!v.includes('fachada')) throw new UserError('SIN_FACHADA', 'Debe haber al menos un lado con fachada: los recintos habitables necesitan ventana.', 'Declare lados con al menos una fachada.');
  if (p.tipologia !== 'casa' && !v.includes('nucleo')) throw new UserError('SIN_NUCLEO', 'Un departamento/oficina necesita un lado de acceso desde circulación común (nucleo).', 'Declare un lado como "nucleo".');
  if (p.tipologia === 'casa' && v.some((b) => b === 'medianero')) { /* casa pareada: permitido */ }
  return out;
}

/** Genera la unidad. Devuelve geometría, huella tipológica, supuestos y desconocidos. */
export function generarUnidad(entrada) {
  const p = ProgramaSchema.parse(entrada); const S = JSON.parse(JSON.stringify(SUPUESTOS_DEFAULT)); const supuestos = []; const desconocidos = [];
  const hEntre = p.altura_entrepiso_mm ?? S.altura_entrepiso_mm; if (!p.altura_entrepiso_mm) supuestos.push(`Altura de entrepiso ${hEntre} mm (valor de práctica, editable; no normativo).`);
  supuestos.push(`Espesores: muros perimetrales ${S.espesor_muro_perimetral_mm} mm, interiores ${S.espesor_muro_interior_mm} mm, losa ${S.espesor_losa_mm} mm (valores de práctica editables; no estructurales).`);
  const B = bordes(p, supuestos); const nDorm = p.dormitorios ?? (p.tipologia === 'oficina' || p.tipologia === 'local_comercial' ? 0 : 2); const nBano = p.banos ?? 1;
  if (p.dormitorios === undefined && ['departamento', 'casa'].includes(p.tipologia)) supuestos.push(`Dormitorios: ${nDorm} (la usuaria no lo indicó; supuesto editable).`);
  // Huella: área dada = huella bruta (supuesto: no se distingue útil/bruta)
  const A = p.superficie_m2; desconocidos.push('Si la superficie indicada es útil o bruta (se usa como huella bruta)');
  const frente = p.frente_m ?? Math.sqrt(A * S.proporcion_frente_fondo); if (!p.frente_m) supuestos.push(`Proporción frente:fondo ${S.proporcion_frente_fondo} (supuesto editable) → frente ${frente.toFixed(2)} m.`);
  const W = mm(frente); const D = mm(A / frente); if (D < 3000) throw new UserError('PROGRAMA_INVIABLE', 'La superficie con ese frente deja un fondo menor a 3 m.', 'Reduzca el frente o aumente la superficie.');
  const t = S.espesor_muro_perimetral_mm; const ti = S.espesor_muro_interior_mm;
  const sideFachadaN = B.N === 'fachada'; const sideNucleoS = B.S === 'nucleo';
  // La franja habitable se apoya en el lado con fachada; la de servicio en el opuesto (N/S) o, en una casa, se reparte.
  const habitableAlNorte = sideFachadaN || !(B.S === 'fachada'); const dHab = Math.max(3000, Math.min(Math.round(D * 0.62), 6500)); const dServ = D - dHab;
  const yHab0 = habitableAlNorte ? D - dHab : 0; const yHab1 = habitableAlNorte ? D : dHab; const yServ0 = habitableAlNorte ? 0 : dHab; const yServ1 = habitableAlNorte ? D - dHab : D;
  const recintos = []; const R = (id, tipo, nombre, x0, y0, x1, y1) => recintos.push({ id, tipo, nombre, x0, y0, x1, y1, contorno: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });
  // Franja habitable: living-comedor(-cocina abierta) + dormitorios (o puestos de trabajo)
  const nHab = p.tipologia === 'oficina' || p.tipologia === 'local_comercial' ? 1 : 1 + nDorm; const pesos = Array.from({ length: nHab }, (_, i) => (i === 0 ? 1.6 : 1)); const suma = pesos.reduce((a, b) => a + b, 0); let x = 0;
  const nombresHab = p.tipologia === 'oficina' ? ['Área de trabajo'] : p.tipologia === 'local_comercial' ? ['Sala de ventas'] : ['Living-comedor', ...Array.from({ length: nDorm }, (_, i) => (i === 0 ? 'Dormitorio principal' : `Dormitorio ${i + 1}`))];
  pesos.forEach((w, i) => { const x1 = i === nHab - 1 ? W : x + Math.round((W * w) / suma); R(`rec-${i + 1}`, i === 0 ? 'estar' : 'dormitorio', nombresHab[i], x, yHab0, x1, yHab1); x = x1; });
  // Franja de servicio: hall de acceso, baños, cocina (si el estar no la incluye), pasillo/circulación
  const servicios = []; servicios.push(['hall', 'Hall de acceso']); if (['departamento', 'casa'].includes(p.tipologia)) { servicios.push(['cocina', 'Cocina']); } for (let i = 0; i < nBano; i++) servicios.push(['bano', nBano > 1 ? `Baño ${i + 1}` : 'Baño']);
  if (['oficina', 'local_comercial'].includes(p.tipologia)) { servicios.length = 0; servicios.push(['hall', 'Recepción'], ['bano', 'Servicios higiénicos']); }
  const pesosS = servicios.map(([tp]) => (tp === 'hall' ? 1.3 : tp === 'cocina' ? 1.5 : 1)); const sumaS = pesosS.reduce((a, b) => a + b, 0); x = 0;
  servicios.forEach(([tp, nom], i) => { const x1 = i === servicios.length - 1 ? W : x + Math.round((W * pesosS[i]) / sumaS); R(`srv-${i + 1}`, tp, nom, x, yServ0, x1, yServ1); x = x1; });
  const hall = recintos.find((r) => r.tipo === 'hall'); const estar = recintos[0];
  // Muros perimetrales por lado con su CLASE (condición de borde)
  const clase = { N: B.N, E: B.E, S: B.S, O: B.O }; const lado = { S: [[0, 0], [W, 0]], E: [[W, 0], [W, D]], N: [[W, D], [0, D]], O: [[0, D], [0, 0]] };
  const muros = []; const vanos = []; const M = (id, ladoId, p1, p2, cl, tipo) => muros.push({ id, lado: ladoId, p1, p2, clase: cl, tipo, espesor_mm: tipo === 'ext' ? t : ti, vanos: [] });
  for (const l of LADOS) M(`mp-${l}`, l, lado[l][0], lado[l][1], clase[l], 'ext');
  // Muros interiores entre franjas y entre recintos (todo separador interior es 'int')
  const xs = (rs) => rs.slice(0, -1).map((r) => r.x1); const hab = recintos.filter((r) => r.id.startsWith('rec-')); const srv = recintos.filter((r) => r.id.startsWith('srv-'));
  M('mi-franja', 'int', [0, yHab0 === 0 ? yHab1 : yHab0], [W, yHab0 === 0 ? yHab1 : yHab0], 'interior', 'int');
  xs(hab).forEach((xx, i) => M(`mi-h${i + 1}`, 'int', [xx, yHab0], [xx, yHab1], 'interior', 'int')); xs(srv).forEach((xx, i) => M(`mi-s${i + 1}`, 'int', [xx, yServ0], [xx, yServ1], 'interior', 'int'));
  const largo = (w) => Math.hypot(w.p2[0] - w.p1[0], w.p2[1] - w.p1[1]); let vid = 0; const addVano = (w, v) => { w.vanos.push({ id: `v${++vid}`, ...v }); };
  const enLado = (r, l) => (l === 'N' ? Math.abs(r.y1 - D) < 1 : l === 'S' ? Math.abs(r.y0) < 1 : l === 'E' ? Math.abs(r.x1 - W) < 1 : Math.abs(r.x0) < 1);
  // Ventanas SOLO en lados con fachada y en recintos habitables que apoyan en ese lado
  const wall = (l) => muros.find((w) => w.id === `mp-${l}`); const centroEn = (r, l) => { const w = wall(l); const [a] = [w.p1]; const horiz = l === 'N' || l === 'S'; const c = horiz ? (r.x0 + r.x1) / 2 : (r.y0 + r.y1) / 2; const u = horiz ? (l === 'S' ? c : W - c) : (l === 'E' ? c : D - c); return u; };
  // distancia a lo largo del muro desde p1: S: de x=0→W (u=x); E: y=0→D (u=y); N: x=W→0 (u=W-x); O: y=D→0 (u=D-y)
  for (const l of LADOS) if (clase[l] === 'fachada') for (const r of recintos.filter((q) => (q.tipo === 'estar' || q.tipo === 'dormitorio' || q.tipo === 'cocina') && enLado(q, l))) { const w = wall(l); const hz = l === 'N' || l === 'S'; const ancho = Math.min(S.ventana.ancho_mm, (hz ? r.x1 - r.x0 : r.y1 - r.y0) - 600); if (ancho >= 600) addVano(w, { tipo: 'ventana', posicion_mm: Math.round(centroEn(r, l)), ancho_mm: ancho, alto_mm: S.ventana.alto_mm, antepecho_mm: S.ventana.antepecho_mm, recinto: r.id }); }
  // Puerta de acceso: sobre el lado «nucleo» (departamento/oficina) o sobre el lado de acceso exterior (casa: lado S, supuesto)
  const ladoAcceso = p.tipologia === 'casa' ? 'S' : LADOS.find((l) => clase[l] === 'nucleo');
  const hallEnAcceso = enLado(hall, ladoAcceso) ? hall : recintos.find((r) => enLado(r, ladoAcceso) && ['hall', 'estar'].includes(r.tipo)) || recintos.find((r) => enLado(r, ladoAcceso)); const wA = wall(ladoAcceso);
  addVano(wA, { tipo: 'puerta', posicion_mm: Math.round(centroEn(hallEnAcceso, ladoAcceso)), ancho_mm: S.puerta_acceso.ancho_mm, alto_mm: S.puerta_acceso.alto_mm, antepecho_mm: 0, recinto: hallEnAcceso.id, rol: p.tipologia === 'casa' ? 'acceso_exterior' : 'acceso_desde_circulacion_comun' });
  // Puertas interiores: hall↔estar y baños↔circulación (pasos de franja)
  const franja = muros.find((w) => w.id === 'mi-franja'); const xsHab = hab.map((r) => (r.x0 + r.x1) / 2); xsHab.forEach((cx, i) => { if (i < 4) addVano(franja, { tipo: 'puerta', posicion_mm: Math.round(cx), ancho_mm: S.puerta_interior.ancho_mm, alto_mm: S.puerta_interior.alto_mm, antepecho_mm: 0, recinto: hab[i].id, rol: 'interior' }); });
  // Balcón/terraza: solo si se pide y hay fachada al lado del estar; rectángulo exterior con borde abierto y baranda
  let balcon = null; const ladoBalcon = LADOS.find((l) => clase[l] === 'fachada' && enLado(estar, l));
  if (p.terraza?.presente) {
    if (!ladoBalcon) throw new UserError('TERRAZA_SIN_FACHADA', 'La terraza necesita que el estar tenga un lado de fachada.', 'Declare lados con fachada junto al estar.');
    const prof = p.terraza.area_m2 ? Math.min(3500, Math.max(900, mm(p.terraza.area_m2 / ((ladoBalcon === 'N' || ladoBalcon === 'S' ? estar.x1 - estar.x0 : estar.y1 - estar.y0) / 1000)))) : S.balcon_profundidad_mm; if (!p.terraza.area_m2) supuestos.push(`Terraza/balcón de ${S.balcon_profundidad_mm} mm de profundidad (supuesto editable).`);
    const ext = { N: [estar.x0, D, estar.x1, D + prof], S: [estar.x0, -prof, estar.x1, 0], E: [W, estar.y0, W + prof, estar.y1], O: [-prof, estar.y0, 0, estar.y1] }[ladoBalcon]; const [bx0, by0, bx1, by1] = ext;
    balcon = { lado: ladoBalcon, contorno: [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]], profundidad_mm: prof, borde_abierto: true, baranda: ({ N: [[bx0, by1], [bx1, by1]], S: [[bx0, by0], [bx1, by0]], E: [[bx1, by0], [bx1, by1]], O: [[bx0, by0], [bx0, by1]] })[ladoBalcon], nota: 'Baranda: protección del borde abierto; su diseño y altura NO se determinan aquí.' };
    const wb = wall(ladoBalcon); const hz = ladoBalcon === 'N' || ladoBalcon === 'S'; const ancho = Math.min(1800, (hz ? estar.x1 - estar.x0 : estar.y1 - estar.y0) - 600); addVano(wb, { tipo: 'puerta', posicion_mm: Math.round(centroEn(estar, ladoBalcon)) + (wb.vanos.some((v) => v.tipo === 'ventana') ? 0 : 0), ancho_mm: ancho, alto_mm: 2100, antepecho_mm: 0, recinto: estar.id, rol: 'salida_a_terraza' });
    // la ventana del estar en ese lado cede su lugar a la puerta-ventana
    wb.vanos = wb.vanos.filter((v) => !(v.tipo === 'ventana' && v.recinto === estar.id));
  }
  // Niveles y losas con su condición de borde
  const k = p.tipologia === 'casa' ? 0 : (p.nivel?.indice ?? 1); if (p.tipologia === 'casa' && p.nivel && p.nivel.indice !== 0) supuestos.push('Una casa unifamiliar se modela a nivel de terreno: se ignora el nivel indicado.'); const cota = k * hEntre; const ultimo = !!p.nivel?.ultimo_piso || p.tipologia === 'casa';
  if (p.tipologia !== 'casa' && !p.nivel) supuestos.push('Nivel de la unidad: 1 (la usuaria no indicó piso; supuesto editable).');
  if (p.tipologia !== 'casa') supuestos.push(`Cota del piso = nivel × altura de entrepiso = ${cota} mm (la cota real del nivel en el edificio es desconocida).`);
  const huellaPoly = [[0, 0], [W, 0], [W, D], [0, D]]; const nivelId = `N${k}`; const nivelSupId = `N${k + 1}`;
  const losas = [{ id: 'losa-inferior', nivel: nivelId, espesor_mm: S.espesor_losa_mm, contorno: huellaPoly, condicion: p.tipologia === 'casa' ? 'sobre_terreno' : (k === 0 ? 'sobre_terreno_o_subterraneo' : 'entrepiso_compartido_con_unidad_inferior') }];
  const cubiertas = []; if (ultimo) cubiertas.push({ id: 'cubierta', nivel: nivelSupId, tipo: 'plana', espesor_mm: S.espesor_losa_mm, contorno: huellaPoly, condicion: 'expuesta_a_la_intemperie' }); else losas.push({ id: 'losa-superior', nivel: nivelSupId, espesor_mm: S.espesor_losa_mm, contorno: huellaPoly, condicion: 'entrepiso_compartido_con_unidad_superior' });
  desconocidos.push('Orientación real del edificio (los lados N/E/S/O son del plano)', 'Ubicación de ductos/shafts y ventilación de baños y cocina', 'Normativa aplicable a departamentos/edificios (no se verifica)', 'Sistema estructural (muros/ejes portantes)', 'Circulación vertical y núcleo común (ascensor/escalera): no se modelan', 'Cota real del nivel y condición de los vecinos');
  if (p.tipologia === 'casa') desconocidos.push('Terreno, antejardín y emplazamiento (no se modelan elementos de lote)');
  // Modelo 3D arq3d (muros con vanos, losas, cubierta)
  const modelo3d = { niveles: [{ id: nivelId, cota_mm: cota, altura_mm: hEntre }, { id: nivelSupId, cota_mm: cota + hEntre, altura_mm: 1000 }], muros: muros.map((w) => ({ id: w.id, nivel: nivelId, p1: w.p1, p2: w.p2, espesor_mm: w.espesor_mm, tipo: w.tipo, vanos: w.vanos.map((v) => ({ id: v.id, tipo: v.tipo, posicion_mm: v.posicion_mm, ancho_mm: v.ancho_mm, alto_mm: v.alto_mm, ...(v.tipo === 'ventana' ? { antepecho_mm: v.antepecho_mm } : {}) })) })), losas: losas.map(({ condicion, ...l }) => l), cubiertas: cubiertas.map(({ condicion, ...c }) => c), opciones: { cubierta_visible: ultimo } };
  const prop = recintos.map((r) => ({ id: r.id, nombre: r.nombre, tipo: r.tipo, area_m2: propiedades(r.contorno.map(([a, b]) => [a / 1000, b / 1000])).area }));
  const tramos = { fachada: 0, medianero: 0, nucleo: 0, vacio: 0 }; for (const w of muros.filter((q) => q.id.startsWith('mp-'))) tramos[w.clase] += 1;
  const huella = { tipologia: p.tipologia, nivel_indice: k, cota_piso_mm: cota, losa_inferior: losas[0].condicion, losa_superior: ultimo ? 'cubierta_expuesta' : 'entrepiso_compartido_con_unidad_superior', lados_borde: B, tramos_por_clase: tramos, acceso: { desde: p.tipologia === 'casa' ? 'exterior' : 'circulacion_comun', lado: ladoAcceso }, ventanas_en_muros_no_fachada: muros.filter((w) => w.clase !== 'fachada' && w.vanos.some((v) => v.tipo === 'ventana')).length, balcon: balcon ? { lado: balcon.lado, borde_abierto: true } : null, elementos_de_lote: [], elementos_de_vivienda_unifamiliar: [] };
  return { programa: p, supuestos, desconocidos: [...new Set(desconocidos)], dimensiones_mm: { ancho: W, fondo: D }, bordes: B, recintos, muros, balcon, losas, cubiertas, modelo3d, propiedades_recintos: prop, huella_tipologica: huella };
}
