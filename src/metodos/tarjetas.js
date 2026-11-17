// MethodCards (Astra ASTRA_05 §3, E12–E14): métodos de cubicación versionados, con entradas tipadas y unidades, fórmula,
// supuestos, exclusiones, rechazos y oráculos de prueba. NO son normas: `normative_claim: none`. La regla de pago/descuento la
// aporta el contrato o la decisión profesional; el método solo la aplica de forma determinista y trazable.
// Procedencia de cada entrada (separación dato / inferencia / supuesto / decisión):
//   medido               = obtenido por una herramienta desde geometría (con archivo y huella)
//   declarado_usuaria    = dato informado por la usuaria (plano, EETT, contrato), no verificado por el sistema
//   supuesto             = valor provisional; obliga a needs_review y bloquea estado final
//   decision_profesional = criterio de la profesional (p. ej. política de descuento de vanos)
import { UserError } from '../mcp/util.js';

export const ORIGENES = ['medido', 'declarado_usuaria', 'supuesto', 'decision_profesional'];
const EPS = 1e-9;

export const TARJETAS = {
  'MC01-muro-area-neta': {
    id: 'MC01-muro-area-neta', version: '0.1', estado: 'propuesta', normative_claim: 'none', revisor: 'cubicador/a',
    alcance: 'Muro plano vertical, por tramos rectos, una o dos caras, sin retornos ni zonas curvas.',
    unidad: 'm2', formula: 'Q = caras × Σ(L_i × H) − caras × Σ deducciones según política',
    entradas: { tramos: 'longitudes L_i en m', altura_m: 'altura H en m', caras: '1 o 2', vanos: 'ancho×alto en m, asignados a un tramo (posición opcional)', politica_descuento: 'descontar_todos | descontar_mayores_a (umbral m2) | no_descontar' },
    supuestos: ['altura uniforme por tramo', 'vano completamente contenido en su tramo', 'neto geométrico ≠ cantidad de pago contractual salvo que la política lo establezca'],
    exclusiones: ['retornos/jambas', 'muros curvos', 'encuentros con solape', 'vanos solapados (se rechazan)'],
    oraculos: ['5 × 2,4 − 2 = 10 m²', 'vano fuera del tramo ⇒ rechazo', 'vanos solapados ⇒ rechazo'],
  },
  'MC02-losa-volumen': {
    id: 'MC02-losa-volumen', version: '0.1', estado: 'propuesta', normative_claim: 'none', revisor: 'cubicador/a',
    alcance: 'Losa o radier por zonas de espesor uniforme; huecos explícitos.',
    unidad: 'm3', formula: 'V = Σ (A_zona − Σ A_huecos_zona) × e_zona',
    entradas: { zonas: 'área (m2) o polígono (m) y espesor (m) por zona', huecos: 'área o polígono asignado a una zona' },
    supuestos: ['espesor uniforme dentro de cada zona', 'hueco totalmente contenido en su zona'],
    exclusiones: ['pendientes o espesor variable (otra zona)', 'vigas/capiteles (otra partida)', 'zonas solapadas (se rechazan)'],
    oraculos: ['A=20, hueco=2, e=0,1 ⇒ 1,8 m³', 'hueco mayor que la zona ⇒ rechazo', 'hueco fuera de la zona ⇒ rechazo'],
  },
  'MC04-conteo-fisico': {
    id: 'MC04-conteo-fisico', version: '0.1', estado: 'propuesta', normative_claim: 'none', revisor: 'arquitecta/cubicador/a',
    alcance: 'Conteo de objetos físicos (puertas, ventanas, artefactos) como identidades únicas, no como símbolos dibujados.',
    unidad: 'un', formula: 'N = |{ identidad_fisica de instancias en vista "planta" o "elevacion", excluidas leyenda/detalle }|',
    entradas: { instancias: 'lista de símbolos con vista (planta/elevacion/leyenda/detalle) e identidad física' },
    supuestos: ['planta y elevación del mismo objeto comparten identidad física'],
    exclusiones: ['símbolos de leyenda o detalle', 'bloques dinámicos/ocultos no interpretados ⇒ needs_review'],
    oraculos: ['3 puertas en planta + 3 símbolos de las mismas en elevación ⇒ 3 un (no 6)'],
  },
};

const num = (v, campo) => { if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) throw new UserError('DATO_INVALIDO', `«${campo}» debe ser un número positivo.`); return v; };
function entrada(v, campo) {
  if (!v || typeof v !== 'object') throw new UserError('FALTA_DATO', `Falta «${campo}» con su valor y su origen (medido, declarado_usuaria, supuesto o decision_profesional).`);
  if (!ORIGENES.includes(v.origen)) throw new UserError('ORIGEN_INVALIDO', `El origen de «${campo}» debe ser uno de: ${ORIGENES.join(', ')}.`);
  return v;
}

function areaPoligono(vs) { let a = 0; for (let i = 0; i < vs.length; i++) { const p = vs[i]; const q = vs[(i + 1) % vs.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; }
function dentro(pt, vs) { let c = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const a = vs[i]; const b = vs[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; }
const enBorde = (pt, vs) => vs.some((a, i) => { const b = vs[(i + 1) % vs.length]; const cr = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x); if (Math.abs(cr) > 1e-9) return false; return pt.x >= Math.min(a.x, b.x) - 1e-9 && pt.x <= Math.max(a.x, b.x) + 1e-9 && pt.y >= Math.min(a.y, b.y) - 1e-9 && pt.y <= Math.max(a.y, b.y) + 1e-9; });
const contenido = (inner, outer) => inner.every((p) => dentro(p, outer) || enBorde(p, outer));

/** Resultado común: cantidad, fórmula sustituida, trazas de entrada con origen, supuestos y estado de revisión. */
function resultado(t, cantidad, sustitucion, entradas, extra = {}) {
  const supuestas = entradas.filter((e) => e.origen === 'supuesto').map((e) => e.campo);
  return {
    metodo: { id: t.id, version: t.version, estado: t.estado, normative_claim: t.normative_claim },
    cantidad, unidad: t.unidad, formula: t.formula, sustitucion, entradas,
    supuestos: [...t.supuestos, ...supuestas.map((c) => `«${c}» es un SUPUESTO provisional`)], exclusiones: t.exclusiones,
    estado_revision: supuestas.length || extra.needs_review ? 'needs_review' : 'borrador', advertencias: extra.advertencias || [],
  };
}

export function mc01(a) {
  const t = TARJETAS['MC01-muro-area-neta'];
  if (!Array.isArray(a.tramos) || !a.tramos.length) throw new UserError('FALTA_DATO', 'Indique al menos un tramo de muro.');
  const tramos = a.tramos.map((x, i) => ({ ...entrada(x, `tramos[${i}]`), L: num(x.longitud_m, `tramos[${i}].longitud_m`) }));
  const H = entrada(a.altura, 'altura'); num(H.valor_m, 'altura.valor_m');
  const caras = a.caras ?? 1; if (![1, 2].includes(caras)) throw new UserError('DATO_INVALIDO', '«caras» debe ser 1 o 2.');
  const pol = entrada(a.politica_descuento, 'politica_descuento');
  if (!['descontar_todos', 'descontar_mayores_a', 'no_descontar'].includes(pol.tipo)) throw new UserError('DATO_INVALIDO', 'politica_descuento.tipo: descontar_todos | descontar_mayores_a | no_descontar.');
  if (pol.tipo === 'descontar_mayores_a') num(pol.umbral_m2, 'politica_descuento.umbral_m2');
  const vanos = (a.vanos || []).map((v, i) => {
    entrada(v, `vanos[${i}]`); num(v.ancho_m, `vanos[${i}].ancho_m`); num(v.alto_m, `vanos[${i}].alto_m`);
    const tr = tramos[v.tramo]; if (!tr) throw new UserError('VANO_SIN_TRAMO', `El vano ${i + 1} no está asignado a un tramo existente.`);
    if (v.ancho_m > tr.L + EPS || v.alto_m > H.valor_m + EPS) throw new UserError('VANO_FUERA_DEL_MURO', `El vano ${i + 1} (${v.ancho_m}×${v.alto_m} m) no cabe en su tramo (${tr.L}×${H.valor_m} m).`, 'Revise el vano o el tramo; no se descuenta algo que no está contenido.');
    if (v.posicion_m != null && (v.posicion_m < -EPS || v.posicion_m + v.ancho_m > tr.L + EPS)) throw new UserError('VANO_FUERA_DEL_MURO', `El vano ${i + 1} queda fuera de su tramo según su posición.`);
    return { ...v, area: v.ancho_m * v.alto_m };
  });
  for (let i = 0; i < vanos.length; i++) for (let j = i + 1; j < vanos.length; j++) {
    const p = vanos[i]; const q = vanos[j];
    if (p.tramo !== q.tramo) continue;
    if (p.posicion_m == null || q.posicion_m == null) throw new UserError('VANOS_SIN_POSICION', `Los vanos ${i + 1} y ${j + 1} están en el mismo tramo sin posición: no se puede descartar un solape.`, 'Indique posicion_m de cada vano (distancia desde el inicio del tramo).');
    if (p.posicion_m < q.posicion_m + q.ancho_m - EPS && q.posicion_m < p.posicion_m + p.ancho_m - EPS) throw new UserError('VANOS_SOLAPADOS', `Los vanos ${i + 1} y ${j + 1} se solapan en el tramo ${p.tramo + 1}.`, 'Defina una partición explícita; no se descuenta dos veces la misma superficie.');
  }
  const bruto = tramos.reduce((s, x) => s + x.L, 0) * H.valor_m;
  const descontables = pol.tipo === 'no_descontar' ? [] : vanos.filter((v) => pol.tipo === 'descontar_todos' || v.area > pol.umbral_m2 + EPS);
  const ded = descontables.reduce((s, v) => s + v.area, 0);
  const neto = caras * (bruto - ded);
  const ent = [...tramos.map((x, i) => ({ campo: `tramo ${i + 1}`, valor: x.L, unidad: 'm', origen: x.origen, fuente: x.fuente || null })), { campo: 'altura', valor: H.valor_m, unidad: 'm', origen: H.origen, fuente: H.fuente || null }, ...vanos.map((v, i) => ({ campo: `vano ${i + 1}`, valor: v.area, unidad: 'm2', origen: v.origen, fuente: v.fuente || null })), { campo: 'politica_descuento', valor: pol.tipo + (pol.umbral_m2 ? ` > ${pol.umbral_m2} m2` : ''), unidad: null, origen: pol.origen, fuente: pol.fuente || null }];
  return { ...resultado(t, neto, `${caras} × (${tramos.map((x) => x.L).join(' + ')}) × ${H.valor_m} − ${caras} × ${ded} = ${neto}`, ent), desglose: { bruto_por_cara_m2: bruto, deducciones_por_cara_m2: ded, vanos_descontados: descontables.length, vanos_no_descontados: vanos.length - descontables.length } };
}

export function mc02(a) {
  const t = TARJETAS['MC02-losa-volumen'];
  if (!Array.isArray(a.zonas) || !a.zonas.length) throw new UserError('FALTA_DATO', 'Indique al menos una zona de losa.');
  const zonas = a.zonas.map((z, i) => {
    entrada(z, `zonas[${i}]`); num(z.espesor_m, `zonas[${i}].espesor_m`);
    const A = Array.isArray(z.vertices) ? areaPoligono(z.vertices) : num(z.area_m2, `zonas[${i}].area_m2`);
    if (!(A > EPS)) throw new UserError('DATO_INVALIDO', `La zona ${i + 1} no tiene área.`);
    return { ...z, A };
  });
  for (let i = 0; i < zonas.length; i++) for (let j = i + 1; j < zonas.length; j++) {
    const p = zonas[i]; const q = zonas[j]; if (!p.vertices || !q.vertices) continue;
    if (p.vertices.some((v) => dentro(v, q.vertices) && !enBorde(v, q.vertices)) || q.vertices.some((v) => dentro(v, p.vertices) && !enBorde(v, p.vertices))) throw new UserError('ZONAS_SOLAPADAS', `Las zonas ${i + 1} y ${j + 1} se solapan.`, 'Defina zonas que no se superpongan; no se suma dos veces el mismo hormigón.');
  }
  const huecos = (a.huecos || []).map((h, i) => {
    entrada(h, `huecos[${i}]`); const z = zonas[h.zona]; if (!z) throw new UserError('HUECO_SIN_ZONA', `El hueco ${i + 1} no está asignado a una zona existente.`);
    const A = Array.isArray(h.vertices) ? areaPoligono(h.vertices) : num(h.area_m2, `huecos[${i}].area_m2`);
    if (h.vertices && z.vertices && !contenido(h.vertices, z.vertices)) throw new UserError('HUECO_FUERA_DE_ZONA', `El hueco ${i + 1} no está contenido en su zona.`);
    return { ...h, A };
  });
  let V = 0; const desglose = [];
  zonas.forEach((z, i) => {
    const ah = huecos.filter((h) => h.zona === i).reduce((s, h) => s + h.A, 0);
    if (ah > z.A + EPS) throw new UserError('HUECO_MAYOR_QUE_ZONA', `Los huecos de la zona ${i + 1} (${ah} m²) superan su área (${z.A} m²).`);
    const v = (z.A - ah) * z.espesor_m; V += v; desglose.push({ zona: i + 1, area_m2: z.A, huecos_m2: ah, espesor_m: z.espesor_m, volumen_m3: v });
  });
  const ent = [...zonas.flatMap((z, i) => [{ campo: `zona ${i + 1} área`, valor: z.A, unidad: 'm2', origen: z.origen, fuente: z.fuente || null }, { campo: `zona ${i + 1} espesor`, valor: z.espesor_m, unidad: 'm', origen: z.origen_espesor || z.origen, fuente: z.fuente || null }]), ...huecos.map((h, i) => ({ campo: `hueco ${i + 1}`, valor: h.A, unidad: 'm2', origen: h.origen, fuente: h.fuente || null }))];
  return { ...resultado(t, V, desglose.map((d) => `(${d.area_m2} − ${d.huecos_m2}) × ${d.espesor_m}`).join(' + ') + ` = ${V}`, ent), desglose };
}

export function mc04(a) {
  const t = TARJETAS['MC04-conteo-fisico'];
  if (!Array.isArray(a.instancias) || !a.instancias.length) throw new UserError('FALTA_DATO', 'Indique las instancias a contar.');
  const VISTAS = ['planta', 'elevacion', 'leyenda', 'detalle'];
  const sinIdentidad = []; const ids = new Set(); const excluidas = [];
  for (const [i, x] of a.instancias.entries()) {
    entrada(x, `instancias[${i}]`);
    if (!VISTAS.includes(x.vista)) throw new UserError('DATO_INVALIDO', `instancias[${i}].vista debe ser: ${VISTAS.join(', ')}.`);
    if (x.vista === 'leyenda' || x.vista === 'detalle') { excluidas.push(x.id || `#${i + 1}`); continue; }
    if (!x.identidad_fisica) { sinIdentidad.push(x.id || `#${i + 1}`); continue; }
    ids.add(String(x.identidad_fisica));
  }
  const ent = a.instancias.map((x, i) => ({ campo: `instancia ${x.id || i + 1}`, valor: `${x.vista}${x.identidad_fisica ? ` → ${x.identidad_fisica}` : ''}`, unidad: null, origen: x.origen, fuente: x.fuente || null }));
  const adv = [...(sinIdentidad.length ? [`${sinIdentidad.length} símbolo(s) sin identidad física (${sinIdentidad.slice(0, 10).join(', ')}): no se cuentan; requiere revisión.`] : []), ...(excluidas.length ? [`${excluidas.length} símbolo(s) de leyenda/detalle excluidos.`] : [])];
  return { ...resultado(t, ids.size, `identidades únicas = ${ids.size}`, ent, { needs_review: sinIdentidad.length > 0, advertencias: adv }), desglose: { identidades: [...ids], excluidas, sin_identidad: sinIdentidad } };
}

export const CALCULAR = { 'MC01-muro-area-neta': mc01, 'MC02-losa-volumen': mc02, 'MC04-conteo-fisico': mc04 };
