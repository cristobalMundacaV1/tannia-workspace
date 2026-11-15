// Análisis geométrico de líneas leídas de AutoCAD (StartPoint/EndPoint): cierre de contorno, rectangularidad, medidas.
// Puro y determinista (sin AutoCAD): se prueba contra valores analíticos. Unidades = las del dibujo (no se convierten).

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);

/**
 * @param lineas [{handle, inicio:[x,y,z], fin:[x,y,z]} | {handle, error}]
 * @param opts {tol=1e-6 (unidades del dibujo), ancho?, alto?}
 */
export function analizarContornoDeLineas(lineas, { tol = 1e-6, ancho, alto } = {}) {
  const disc = []; const out = { n_lineas: lineas.length, discrepancias: disc };
  const validas = lineas.filter((l) => l && Array.isArray(l.inicio) && Array.isArray(l.fin) && l.inicio.length >= 2 && l.fin.length >= 2 && [...l.inicio, ...l.fin].every(Number.isFinite));
  for (const l of lineas) if (!validas.includes(l)) disc.push(`La entidad ${l?.handle ?? '?'} no se pudo leer como línea con extremos (${l?.error || 'sin StartPoint/EndPoint'}).`);
  const L = validas.map((l) => ({ handle: l.handle, a: [l.inicio[0], l.inicio[1], l.inicio[2] || 0], b: [l.fin[0], l.fin[1], l.fin[2] || 0] }));
  for (const l of L) if (dist(l.a, l.b) <= tol) disc.push(`La línea ${l.handle} tiene longitud cero.`);
  if (!L.length) return { ...out, cerrado: false, es_rectangulo: false, estado: 'needs_review', discrepancias: [...disc, 'No hay líneas legibles.'] };

  // Encadenar: empezar por la primera y buscar la siguiente cuyo extremo coincide con el final actual (en cualquier sentido).
  const usadas = new Set([0]); const cadena = [{ handle: L[0].handle, de: L[0].a, a: L[0].b }]; let actual = L[0].b;
  for (;;) {
    let hallada = -1; let invertir = false; let mejor = Infinity;
    for (let i = 0; i < L.length; i++) {
      if (usadas.has(i)) continue;
      const d1 = dist(L[i].a, actual); const d2 = dist(L[i].b, actual);
      if (d1 <= tol && d1 < mejor) { hallada = i; invertir = false; mejor = d1; }
      if (d2 <= tol && d2 < mejor) { hallada = i; invertir = true; mejor = d2; }
    }
    if (hallada < 0) break;
    usadas.add(hallada); const l = L[hallada];
    cadena.push(invertir ? { handle: l.handle, de: l.b, a: l.a } : { handle: l.handle, de: l.a, a: l.b });
    actual = cadena[cadena.length - 1].a;
  }
  const sinUsar = L.filter((_, i) => !usadas.has(i));
  const cierra = dist(cadena[cadena.length - 1].a, cadena[0].de) <= tol;
  const cerrado = cierra && sinUsar.length === 0 && cadena.length >= 3;
  if (!cierra) disc.push(`El contorno NO cierra: entre el final de la cadena y su inicio hay ${dist(cadena[cadena.length - 1].a, cadena[0].de)} unidades.`);
  if (sinUsar.length) disc.push(`Hay ${sinUsar.length} línea(s) que no forman parte del contorno cerrado (${sinUsar.map((l) => l.handle).join(', ')}).`);
  if (cadena.length < 3) disc.push('Un contorno cerrado necesita al menos 3 líneas.');

  const lados = cadena.map((c) => ({ handle: c.handle, longitud: dist(c.de, c.a), de: c.de, a: c.a }));
  const zs = L.flatMap((l) => [l.a[2], l.b[2]]); const coplanar = Math.max(...zs) - Math.min(...zs) <= tol;
  if (!coplanar) disc.push('Los extremos no son coplanares en Z (diferencias de cota): el área en planta puede no ser la de la figura.');
  // Ángulos entre lados consecutivos (solo si cierra)
  const angulos = [];
  if (cerrado) for (let i = 0; i < cadena.length; i++) {
    const u = sub(cadena[i].a, cadena[i].de); const v = sub(cadena[(i + 1) % cadena.length].a, cadena[(i + 1) % cadena.length].de);
    angulos.push((Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v))))) * 180) / Math.PI);
  }
  // Área (shoelace en planta) y perímetro
  let area = null;
  if (cerrado) { let s = 0; for (const c of cadena) s += c.de[0] * c.a[1] - c.a[0] * c.de[1]; area = Math.abs(s / 2); }
  const perimetro = lados.reduce((x, l) => x + l.longitud, 0);
  const xs = L.flatMap((l) => [l.a[0], l.b[0]]); const ys = L.flatMap((l) => [l.a[1], l.b[1]]);
  const bbox = { ancho: Math.max(...xs) - Math.min(...xs), alto: Math.max(...ys) - Math.min(...ys) };

  let esRect = false;
  if (cerrado && cadena.length === 4) {
    const angOk = angulos.every((g) => Math.abs(g - 90) <= 1e-6);
    const opuestosOk = Math.abs(lados[0].longitud - lados[2].longitud) <= tol && Math.abs(lados[1].longitud - lados[3].longitud) <= tol;
    esRect = angOk && opuestosOk;
    if (!angOk) disc.push(`El contorno cierra pero sus ángulos no son 90° (${angulos.map((g) => g.toFixed(6)).join(', ')}).`);
    if (!opuestosOk) disc.push('El contorno cierra pero los lados opuestos no son iguales.');
  } else if (cerrado) disc.push(`El contorno cierra con ${cadena.length} lados (no es un rectángulo de 4).`);

  let dimensiones = null;
  if (esRect) {
    const a = lados[0].longitud; const b = lados[1].longitud; dimensiones = { lado_a: a, lado_b: b };
    if (ancho !== undefined || alto !== undefined) {
      const dirOk = (w, h) => (ancho === undefined || Math.abs(w - ancho) <= Math.max(tol, 1e-9 * ancho)) && (alto === undefined || Math.abs(h - alto) <= Math.max(tol, 1e-9 * alto));
      if (!dirOk(a, b) && !dirOk(b, a)) disc.push(`Las dimensiones leídas (${a} × ${b}) no coinciden con lo esperado (${ancho ?? '?'} × ${alto ?? '?'}).`);
    }
  }
  const dimensionesOk = !(ancho !== undefined || alto !== undefined) || (esRect && !disc.some((d) => /no coinciden con lo esperado/.test(d)));
  return {
    ...out, cerrado, es_rectangulo: esRect, dimensiones_coinciden_con_lo_esperado: (ancho !== undefined || alto !== undefined) ? dimensionesOk : null,
    lados_en_orden: lados, angulos_grados: angulos, dimensiones, area, perimetro, bbox, coplanar_z: coplanar,
    tolerancia_usada: tol, unidades: 'unidades del dibujo (sin convertir)',
    estado: cerrado && coplanar && disc.length === 0 ? 'ok' : 'needs_review',
  };
}

/** Compara lecturas antes/después de cerrar y reabrir. Devuelve discrepancias por handle (vacío => persistió idéntico). */
export function compararLecturas(antes, despues, { tol = 1e-6 } = {}) {
  const dif = [];
  const mapa = new Map(despues.map((d) => [String(d.handle).toUpperCase(), d]));
  for (const a of antes) {
    const h = String(a.handle).toUpperCase(); const d = mapa.get(h);
    if (a.error) { dif.push({ handle: a.handle, problema: 'no_existia_antes_de_cerrar' }); continue; }
    if (!d || d.error) { dif.push({ handle: a.handle, problema: 'desaparecio_tras_reabrir' }); continue; }
    if (a.capa !== d.capa) dif.push({ handle: a.handle, problema: 'capa_distinta', antes: a.capa, despues: d.capa });
    if (a.tipo !== d.tipo) dif.push({ handle: a.handle, problema: 'tipo_distinto', antes: a.tipo, despues: d.tipo });
    for (const k of ['inicio', 'fin']) {
      if (!a[k] || !d[k] || a[k].length !== d[k].length || a[k].some((v, i) => !(Math.abs(v - d[k][i]) <= tol))) dif.push({ handle: a.handle, problema: `${k}_distinto`, antes: a[k] ?? null, despues: d[k] ?? null });
    }
    if (a.longitud != null && !(Math.abs(a.longitud - d.longitud) <= tol)) dif.push({ handle: a.handle, problema: 'longitud_distinta', antes: a.longitud, despues: d.longitud });
  }
  return dif;
}
