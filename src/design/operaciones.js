// Catálogo de operaciones de edición. Cada operación recibe un modelo y devuelve uno NUEVO (inmutable) más un resumen.
// Lo no afectado no se toca: los tamaños de recintos ajenos y las aberturas conservan sus valores.
import { UserError } from '../mcp/util.js';
import { SISTEMAS, ABERTURAS } from '../conocimiento/criterios.js';
import { calcularRects, caminoA, clonar, esHoja, hoja, divide, hojas, redondear } from './modelo.js';
import { derivar } from './derivar.js';

const MIN_TAMANO_MM = 800;
const bad = (msg, hint) => new UserError('OPERACION_INVALIDA', msg, hint);
const recinto = (m, id) => { if (!m.recintos[id]) throw bad(`No existe el recinto ${id}.`, `Recintos: ${Object.keys(m.recintos).join(', ')}.`); return m.recintos[id]; };
const mismoPar = (s, a, b) => (s.a === a && s.b === b) || (s.a === b && s.b === a);

export const CATALOGO = {
  ajustar_tamano: 'Cambia el ancho o la profundidad de un recinto: {recinto, eje:"ancho"|"profundidad", valor_mm, medida?:"util"|"ejes", compensar_con?}',
  intercambiar: 'Intercambia la posición de dos recintos: {a, b}',
  renombrar: 'Cambia el nombre de un recinto: {recinto, nombre}',
  agregar_abertura: 'Agrega puerta/ventana/paso: {tipo:"ventana"|"puerta"|"paso", recinto, lado:"N|S|E|O"} o {tipo, entre:[a,b]}; ancho_mm?, alto_mm?, antepecho_mm?, ancla?:"inicio|fin|centro", distancia_mm?, abre_hacia?',
  mover_abertura: 'Desplaza una abertura: {id, ancla:"inicio|fin|centro", distancia_mm}',
  cambiar_abertura: 'Cambia medidas: {id, ancho_mm?, alto_mm?, antepecho_mm?, abre_hacia?}',
  eliminar_abertura: 'Quita una abertura: {id}',
  separacion: 'Abre o cierra la separación entre dos recintos: {a, b, tipo:"muro"|"abierta"}',
  dividir_recinto: 'Divide un recinto en dos: {recinto, nuevo:{id,nombre,tipo}, eje:"ancho"|"profundidad", tamano_nuevo_mm, lado_nuevo?, acceso?:"puerta"|"abierta"|"ninguno"}',
  eliminar_recinto: 'Elimina un recinto y su superficie la absorbe un vecino: {recinto, absorbe?}',
  espesores: 'Cambia espesores de muro: {ext_mm?, int_mm?}',
  sistema_constructivo: 'Cambia el sistema constructivo (espesores iniciales): {sistema}',
};

function siguienteId(m, prefijo) { const ex = new Set(m.aberturas.map((a) => a.id)); let n = 1; while (ex.has(`${prefijo}-${n}`)) n++; return `${prefijo}-${n}`; }

/** Hijo directo de `padre` que contiene a la hoja `id`. */
function indiceHijoQueContiene(padre, id) { return padre.hijos.findIndex((h) => hojas(h).includes(id)); }

function ajustarTamano(m, { recinto: id, eje, valor_mm, medida = 'util', compensar_con }) {
  recinto(m, id);
  if (!['ancho', 'profundidad'].includes(eje)) throw bad('eje debe ser "ancho" o "profundidad".');
  if (!(valor_mm > 0)) throw bad('valor_mm debe ser positivo.');
  const camino = caminoA(m.arbol, id); const tipoBuscado = eje === 'ancho' ? 'v' : 'h';
  const paso = [...camino].reverse().find((c) => c.nodo !== camino[camino.length - 1].nodo && !esHoja(c.nodo) && c.nodo.tipo === tipoBuscado);
  // el ancestro (no la hoja) de ese tipo que contiene la hoja
  const anc = camino.filter((c) => !esHoja(c.nodo) && c.nodo.tipo === tipoBuscado).pop();
  void paso;
  if (!anc) throw bad(`El recinto ${id} ocupa todo el ${eje === 'ancho' ? 'ancho' : 'fondo'} de la vivienda: no hay vecino que compense; cambie la superficie total o regenere.`);
  const idx = indiceHijoQueContiene(anc.nodo, id);
  const geo = derivar(m); const r = geo.recintos[id];
  const actualNeto = eje === 'ancho' ? r.ancho_neto_mm : r.fondo_neto_mm; const actualEje = anc.nodo.tamanos[idx];
  const objetivoEje = medida === 'util' ? Math.round(valor_mm + (actualEje - actualNeto)) : Math.round(valor_mm);
  const delta = objetivoEje - actualEje;
  if (delta === 0) throw bad('El recinto ya tiene esa medida.');
  let vecino = -1;
  if (compensar_con) { recinto(m, compensar_con); vecino = indiceHijoQueContiene(anc.nodo, compensar_con); if (vecino < 0 || vecino === idx) throw bad(`${compensar_con} no es vecino directo de ${id} en esa dirección.`, 'Elija un recinto contiguo en esa dirección.'); }
  else vecino = idx + 1 < anc.nodo.hijos.length ? idx + 1 : idx - 1;
  if (vecino < 0) throw bad('No hay vecino para compensar el cambio.');
  if (anc.nodo.tamanos[vecino] - delta < MIN_TAMANO_MM) throw bad(`El vecino quedaría con ${anc.nodo.tamanos[vecino] - delta} mm: demasiado angosto (mínimo ${MIN_TAMANO_MM} mm).`, 'Pida un cambio menor o indique con qué recinto compensar.');
  if (objetivoEje < MIN_TAMANO_MM) throw bad(`El recinto quedaría con ${objetivoEje} mm a ejes: demasiado angosto.`);
  const n = clonar(m); const nodo = caminoNodo(n.arbol, anc.ruta);
  nodo.tamanos[idx] = objetivoEje; nodo.tamanos[vecino] -= delta;
  const afectados = hojas(nodo.hijos[vecino]).concat(hojas(nodo.hijos[idx]));
  return { modelo: n, resumen: `${n.recintos[id].nombre}: ${eje} ${medida === 'util' ? 'útil' : 'a ejes'} ${(actualNeto / 1000).toFixed(2)} → ${valor_mm / 1000 >= 0 ? (medida === 'util' ? valor_mm / 1000 : (valor_mm - (actualEje - actualNeto)) / 1000).toFixed(2) : ''} m; compensa ${hojas(nodo.hijos[vecino]).map((h) => n.recintos[h].nombre).join(', ')}`, afectados };
}
function caminoNodo(arbol, ruta) { return ruta.reduce((x, i) => x.hijos[i], arbol); }

function intercambiar(m, { a, b }) {
  recinto(m, a); recinto(m, b); if (a === b) throw bad('Indique dos recintos distintos.');
  const n = clonar(m);
  const visitar = (x) => { if (esHoja(x)) { if (x.id === a) x.id = b; else if (x.id === b) x.id = a; } else x.hijos.forEach(visitar); };
  visitar(n.arbol);
  // las aberturas ligadas a un recinto siguen al LUGAR (muro), no al recinto: se reasignan los ids
  const swap = (v) => (v === a ? b : v === b ? a : v);
  n.aberturas = n.aberturas.map((x) => ({ ...x, recinto: x.recinto ? swap(x.recinto) : x.recinto, entre: x.entre ? x.entre.map(swap) : x.entre, abre_hacia: x.abre_hacia ? swap(x.abre_hacia) : x.abre_hacia }));
  n.separaciones = n.separaciones.map((s) => ({ ...s, a: swap(s.a), b: swap(s.b) }));
  return { modelo: n, resumen: `${m.recintos[a].nombre} y ${m.recintos[b].nombre} intercambian su ubicación (cada uno toma las medidas del lugar del otro)`, afectados: [a, b] };
}

function renombrar(m, { recinto: id, nombre }) {
  recinto(m, id); if (!nombre || !String(nombre).trim()) throw bad('Falta el nombre.');
  const n = clonar(m); n.recintos[id].nombre = String(nombre).trim().toUpperCase();
  return { modelo: n, resumen: `${m.recintos[id].nombre} → ${n.recintos[id].nombre}`, afectados: [id] };
}

function porDefectoAbertura(tipo, m, o) {
  const tipoRec = o.recinto ? m.recintos[o.recinto]?.tipo : null;
  if (tipo === 'ventana') { const d = tipoRec === 'bano' ? ABERTURAS.ventana_bano : tipoRec === 'living_comedor' ? ABERTURAS.ventana_living : ABERTURAS.ventana_habitable; return { ancho_mm: d.ancho_mm, alto_mm: d.alto_mm, antepecho_mm: d.antepecho_mm }; }
  if (tipo === 'paso') return { ancho_mm: ABERTURAS.paso_libre.ancho_mm, alto_mm: ABERTURAS.paso_libre.alto_mm };
  const esBano = [o.recinto, ...(o.entre || [])].some((r) => r && m.recintos[r]?.tipo === 'bano');
  return esBano ? { ancho_mm: ABERTURAS.puerta_bano.ancho_mm, alto_mm: ABERTURAS.puerta_bano.alto_mm } : { ancho_mm: ABERTURAS.puerta_interior.ancho_mm, alto_mm: ABERTURAS.puerta_interior.alto_mm };
}

function agregarAbertura(m, o) {
  if (!['ventana', 'puerta', 'paso'].includes(o.tipo)) throw bad('tipo debe ser ventana, puerta o paso.');
  if (o.recinto) recinto(m, o.recinto);
  if (o.entre) { if (o.entre.length !== 2) throw bad('entre necesita dos recintos.'); o.entre.forEach((r) => recinto(m, r)); }
  if (!o.recinto && !o.entre) throw bad('Indique recinto+lado (muro exterior) o entre:[a,b] (muro interior).');
  if (o.recinto && !o.entre && !['N', 'S', 'E', 'O'].includes(o.lado)) throw bad('lado debe ser N, S, E u O.');
  const d = porDefectoAbertura(o.tipo, m, o);
  const n = clonar(m);
  const ab = { id: siguienteId(n, o.tipo === 'ventana' ? 'V' : 'P'), tipo: o.tipo, ...(o.entre ? { entre: o.entre } : { recinto: o.recinto, lado: o.lado }), ancho_mm: o.ancho_mm ?? d.ancho_mm, alto_mm: o.alto_mm ?? d.alto_mm, ...(o.tipo === 'ventana' ? { antepecho_mm: o.antepecho_mm ?? d.antepecho_mm } : {}), ancla: o.ancla ?? 'centro', distancia_mm: o.distancia_mm ?? 0 };
  if (o.tipo === 'puerta') ab.abre_hacia = o.abre_hacia ?? (o.entre ? o.entre[0] : o.recinto);
  if (o.funcion) ab.funcion = o.funcion;
  n.aberturas.push(ab);
  return { modelo: n, resumen: `Se agrega ${o.tipo} ${ab.id} (${ab.ancho_mm} mm) ${o.entre ? `entre ${o.entre.map((r) => m.recintos[r].nombre).join(' y ')}` : `en ${m.recintos[o.recinto].nombre}, lado ${o.lado}`}`, afectados: o.entre || [o.recinto] };
}

function abertura(m, id) { const a = m.aberturas.find((x) => x.id === id); if (!a) throw bad(`No existe la abertura ${id}.`, `Aberturas: ${m.aberturas.map((x) => x.id).join(', ')}.`); return a; }
function moverAbertura(m, { id, ancla = 'centro', distancia_mm }) { abertura(m, id); if (!Number.isFinite(distancia_mm)) throw bad('Falta distancia_mm.'); const n = clonar(m); const a = abertura(n, id); a.ancla = ancla; a.distancia_mm = distancia_mm; return { modelo: n, resumen: `${id} se desplaza (${ancla} ${distancia_mm} mm)`, afectados: [id] }; }
function cambiarAbertura(m, { id, ...cambios }) { abertura(m, id); const n = clonar(m); const a = abertura(n, id); for (const k of ['ancho_mm', 'alto_mm', 'antepecho_mm', 'abre_hacia']) if (cambios[k] !== undefined) a[k] = cambios[k]; if (a.abre_hacia) recinto(n, a.abre_hacia); return { modelo: n, resumen: `${id} actualizada (${Object.keys(cambios).join(', ')})`, afectados: [id] }; }
function eliminarAbertura(m, { id }) { const a = abertura(m, id); const n = clonar(m); n.aberturas = n.aberturas.filter((x) => x.id !== id); return { modelo: n, resumen: `Se elimina ${a.tipo} ${id}`, afectados: [id] }; }

function separacion(m, { a, b, tipo }) {
  recinto(m, a); recinto(m, b); if (!['muro', 'abierta'].includes(tipo)) throw bad('tipo debe ser "muro" o "abierta".');
  if (tipo === 'abierta') {
    const geo = derivar(m); const seg = geo.segmentos.find((s) => s.tipo === 'int' && s.entre.includes(a) && s.entre.includes(b));
    if (!seg) throw bad(`${m.recintos[a].nombre} y ${m.recintos[b].nombre} no comparten muro.`);
    const completo = (id) => { const r = geo.rect[id]; const [d0, d1] = seg.orient === 'v' ? [r.y0, r.y1] : [r.x0, r.x1]; return seg.desde === d0 && seg.hasta === d1; };
    if (!(completo(a) && completo(b))) throw bad('Para abrir esta separación sin dejar un recinto de forma irregular, ambos recintos deben compartir toda su frontera.', 'Abra solo recintos que se enfrentan por todo el lado (p. ej. cocina y living); si no, cree un paso libre con agregar_abertura tipo "paso".');
  }
  const n = clonar(m); n.separaciones = n.separaciones.filter((s) => !mismoPar(s, a, b));
  let quitadas = [];
  if (tipo === 'abierta') { n.separaciones.push({ a, b, tipo: 'abierta' }); const antes = n.aberturas.length; quitadas = n.aberturas.filter((x) => x.entre && mismoPar({ a: x.entre[0], b: x.entre[1] }, a, b)).map((x) => x.id); n.aberturas = n.aberturas.filter((x) => !quitadas.includes(x.id)); void antes; }
  if (tipo === 'muro' && !n.aberturas.some((x) => x.entre && mismoPar({ a: x.entre[0], b: x.entre[1] }, a, b))) {
    // al cerrar con muro un límite que era abierto hace falta un acceso: se agrega una puerta hacia el recinto de uso más privado
    const priv = ['bano', 'dormitorio', 'dormitorio_principal', 'cocina', 'closet'];
    const hacia = priv.includes(m.recintos[b].tipo) ? b : priv.includes(m.recintos[a].tipo) ? a : b;
    quitadas = [];
    n.aberturas.push({ id: siguienteId(n, 'P'), tipo: 'puerta', entre: [a, b], ancho_mm: porDefectoAbertura('puerta', n, { entre: [a, b] }).ancho_mm, alto_mm: 2100, ancla: 'centro', distancia_mm: 0, abre_hacia: hacia });
    return { modelo: n, resumen: `${m.recintos[a].nombre} y ${m.recintos[b].nombre}: se cierra con muro y se agrega una puerta hacia ${m.recintos[hacia].nombre}`, afectados: [a, b] };
  }
  return { modelo: n, resumen: `${m.recintos[a].nombre} y ${m.recintos[b].nombre}: ${tipo === 'abierta' ? 'se abre la separación' : 'se cierra con muro'}${quitadas.length ? ` (se quitan ${quitadas.join(', ')})` : ''}`, afectados: [a, b] };
}

function dividirRecinto(m, { recinto: id, nuevo, eje, tamano_nuevo_mm, lado_nuevo, acceso = 'puerta' }) {
  recinto(m, id); if (!nuevo?.id || !nuevo?.nombre || !nuevo?.tipo) throw bad('nuevo necesita {id, nombre, tipo}.');
  if (m.recintos[nuevo.id]) throw bad(`Ya existe el recinto ${nuevo.id}.`);
  if (!['ancho', 'profundidad'].includes(eje)) throw bad('eje debe ser "ancho" o "profundidad".');
  const geo = derivar(m); const r = geo.recintos[id]; const total = eje === 'ancho' ? r.eje.x1 - r.eje.x0 : r.eje.y1 - r.eje.y0;
  if (!(tamano_nuevo_mm >= MIN_TAMANO_MM && tamano_nuevo_mm <= total - MIN_TAMANO_MM)) throw bad(`El recinto mide ${total} mm a ejes en esa dirección: el nuevo debe medir entre ${MIN_TAMANO_MM} y ${total - MIN_TAMANO_MM} mm.`);
  const n = clonar(m); const camino = caminoA(n.arbol, id); const hojaN = camino[camino.length - 1];
  const nuevoAlFinal = ['E', 'N'].includes(lado_nuevo ?? (eje === 'ancho' ? 'E' : 'N'));
  const hijos = nuevoAlFinal ? [hoja(id), hoja(nuevo.id)] : [hoja(nuevo.id), hoja(id)];
  const tam = nuevoAlFinal ? [total - tamano_nuevo_mm, tamano_nuevo_mm] : [tamano_nuevo_mm, total - tamano_nuevo_mm];
  const reemplazo = divide(eje === 'ancho' ? 'v' : 'h', hijos, tam);
  if (!hojaN.padre) n.arbol = reemplazo; else hojaN.padre.hijos[hojaN.indice] = reemplazo;
  // caminoA devolvió referencias al clon `n`, por lo que el reemplazo ya quedó aplicado
  n.recintos[nuevo.id] = { id: nuevo.id, nombre: String(nuevo.nombre).toUpperCase(), tipo: nuevo.tipo };
  if (acceso === 'abierta') n.separaciones.push({ a: id, b: nuevo.id, tipo: 'abierta' });
  else if (acceso === 'puerta') n.aberturas.push({ id: siguienteId(n, 'P'), tipo: 'puerta', entre: [id, nuevo.id], ancho_mm: porDefectoAbertura('puerta', n, { entre: [id, nuevo.id] }).ancho_mm, alto_mm: 2100, ancla: 'centro', distancia_mm: 0, abre_hacia: nuevo.id });
  return { modelo: n, resumen: `${m.recintos[id].nombre} se divide: nuevo ${n.recintos[nuevo.id].nombre} de ${tamano_nuevo_mm} mm (${acceso === 'puerta' ? 'con puerta' : acceso === 'abierta' ? 'abierto' : 'sin acceso'})`, afectados: [id, nuevo.id] };
}

function eliminarRecinto(m, { recinto: id, absorbe }) {
  recinto(m, id); const n = clonar(m); const camino = caminoA(n.arbol, id); const h = camino[camino.length - 1];
  if (!h.padre) throw bad('No se puede eliminar el único recinto.');
  const p = h.padre; const i = h.indice;
  let j = absorbe ? indiceHijoQueContiene(p, absorbe) : (i + 1 < p.hijos.length ? i + 1 : i - 1);
  if (absorbe) { recinto(m, absorbe); if (j < 0 || j === i) throw bad(`${absorbe} no es vecino directo de ${id}.`); }
  const tam = p.tamanos[i]; p.tamanos[j] += tam; p.hijos.splice(i, 1); p.tamanos.splice(i, 1);
  const abs = hojas(p.hijos[j > i ? j - 1 : j]);
  // colapsar si queda un solo hijo
  if (p.hijos.length === 1) { const g = camino[camino.length - 2]; const ruta = camino[camino.length - 2]?.ruta; void ruta; const unico = p.hijos[0]; const gp = camino.length >= 3 ? camino[camino.length - 3] : null; if (!gp) n.arbol = unico; else gp.nodo.hijos[g.indice] = unico; }
  delete n.recintos[id];
  n.aberturas = n.aberturas.filter((x) => x.recinto !== id && !(x.entre || []).includes(id) && x.abre_hacia !== id);
  n.separaciones = n.separaciones.filter((s) => s.a !== id && s.b !== id);
  return { modelo: n, resumen: `Se elimina ${m.recintos[id].nombre}; su superficie pasa a ${abs.map((a) => m.recintos[a].nombre).join(', ')}`, afectados: abs };
}

function espesores(m, { ext_mm, int_mm }) {
  if (ext_mm === undefined && int_mm === undefined) throw bad('Indique ext_mm y/o int_mm.');
  for (const v of [ext_mm, int_mm]) if (v !== undefined && !(v >= 80 && v <= 500)) throw bad('Los espesores deben estar entre 80 y 500 mm.');
  const n = clonar(m); if (ext_mm !== undefined) n.espesores.ext = ext_mm; if (int_mm !== undefined) n.espesores.int = int_mm;
  return { modelo: n, resumen: `Espesores: exterior ${n.espesores.ext} mm, interior ${n.espesores.int} mm (los ejes no cambian; varía el contorno exterior y las superficies útiles)`, afectados: [] };
}

function sistemaConstructivo(m, { sistema }) {
  const s = SISTEMAS[sistema]; if (!s) throw bad(`Sistema no reconocido: ${sistema}.`, `Opciones: ${Object.keys(SISTEMAS).join(', ')}.`);
  const n = clonar(m); n.sistema = sistema; n.programa.sistema_constructivo = sistema; n.espesores = { ext: s.espesor_muro_ext_mm, int: s.espesor_muro_int_mm };
  n.fundamentos = n.fundamentos.filter((f) => !/^Sistema constructivo/.test(f.decision));
  n.fundamentos.unshift({ decision: `Sistema constructivo: ${s.nombre}; muros exteriores ${n.espesores.ext} mm e interiores ${n.espesores.int} mm (totales, con revestimientos)`, criterio: 'Espesores iniciales por sistema; los define el proyecto de cálculo', origen: 'practica_de_diseno', confirmar_en: s.normas });
  return { modelo: n, resumen: `Sistema constructivo: ${s.nombre} (muros ${n.espesores.ext}/${n.espesores.int} mm). Requiere proyecto de cálculo estructural.`, afectados: [] };
}

const IMPL = { ajustar_tamano: ajustarTamano, intercambiar, renombrar, agregar_abertura: agregarAbertura, mover_abertura: moverAbertura, cambiar_abertura: cambiarAbertura, eliminar_abertura: eliminarAbertura, separacion, dividir_recinto: dividirRecinto, eliminar_recinto: eliminarRecinto, espesores, sistema_constructivo: sistemaConstructivo };

/** Retira aberturas que ya no tienen muro (por una edición de recintos) y lo informa; nunca toca las recién agregadas. */
function retirarAberturasSinMuro(modelo, protegidas) {
  const geo = derivar(modelo);
  const sinMuro = geo.aberturas.filter((a) => a.invalida && !protegidas.has(a.id));
  if (!sinMuro.length) return { modelo, retiradas: [] };
  const n = clonar(modelo); const ids = new Set(sinMuro.map((a) => a.id));
  n.aberturas = n.aberturas.filter((a) => !ids.has(a.id));
  return { modelo: n, retiradas: sinMuro.map((a) => `${a.tipo} ${a.id} (${a.motivo})`) };
}

export function aplicarOperacion(modelo, op) {
  const { operacion, ...args } = op;
  const f = IMPL[operacion];
  if (!f) throw bad(`Operación desconocida: ${operacion}.`, `Operaciones: ${Object.keys(CATALOGO).join(', ')}.`);
  const r = f(modelo, args);
  calcularRects(r.modelo.arbol, r.modelo.ejes.ancho, r.modelo.ejes.profundidad); // el árbol debe seguir siendo consistente
  const previas = new Set(modelo.aberturas.map((a) => a.id)); const nuevas = new Set(r.modelo.aberturas.map((a) => a.id).filter((id) => !previas.has(id)));
  const lim = retirarAberturasSinMuro(r.modelo, nuevas);
  for (const a of derivar(lim.modelo).aberturas) if (a.invalida && nuevas.has(a.id)) throw bad(`No se puede agregar la abertura: ${a.motivo}`);
  return { ...r, modelo: lim.modelo, resumen: lim.retiradas.length ? `${r.resumen}. Se retiraron aberturas que ya no tienen muro: ${lim.retiradas.join('; ')}` : r.resumen, retiradas: lim.retiradas };
}
void redondear;
