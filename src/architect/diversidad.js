// Diversidad REAL de partidos: clase de huella + topología de conexiones (hash Weisfeiler–Lehman, invariante a giros y espejos).
// Un espejo, una rotación o un cambio de nombre NO cuentan como alternativa distinta.
import crypto from 'node:crypto';
import { derivarEsquema } from './derivar_poly.js';
import { areaFirmada } from './poligonos.js';

export function firmaHuella(geo) {
  const ext = geo.huella.anillos.filter((a) => !a.hueco); const huecos = geo.huella.anillos.filter((a) => a.hueco).length;
  const verts = ext.reduce((a, r) => a + r.ring.length, 0);
  let concavos = 0;
  for (const { ring, hueco } of geo.huella.anillos) { if (hueco) continue; const sg = Math.sign(areaFirmada(ring)); for (let i = 0; i < ring.length; i++) { const a = ring[(i + ring.length - 1) % ring.length]; const b = ring[i]; const c = ring[(i + 1) % ring.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.sign(cr) === -sg) concavos++; } }
  const clase = huecos ? 'patio_interior' : ext.length > 1 ? 'pabellones' : concavos === 0 ? 'rectangular' : concavos === 1 ? 'L' : concavos === 2 ? 'C' : 'compleja';
  return { clase, anillos_exteriores: ext.length, huecos, vertices: verts, concavos };
}

/** Grafo de conexiones: nodos = recintos (etiqueta = tipo), aristas = paso (puerta/paso/separación abierta) o muro compartido. */
export function grafoConexiones(esq, geo) {
  const tipo = new Map(esq.spaces.map((s) => [s.id, s.tipo])); const nodos = [...tipo.keys()].sort();
  const aristas = new Map(); const k = (a, b) => [a, b].sort().join('|');
  for (const s of geo.murosSeg.filter((x) => x.tipo === 'int')) { const key = k(s.entre[0], s.entre[1]); if (!aristas.has(key)) aristas.set(key, 'muro'); }
  for (const [a, b] of esq.separaciones_abiertas) aristas.set(k(a, b), 'paso');
  for (const a of esq.openings) if (a.entre.length === 2 && (a.tipo === 'puerta' || a.tipo === 'paso')) aristas.set(k(a.entre[0], a.entre[1]), 'paso');
  for (const [key] of [...aristas]) { const [a, b] = key.split('|'); if (!tipo.has(a) || !tipo.has(b)) aristas.delete(key); }
  const ext = esq.openings.filter((a) => a.entre.length === 1 && a.tipo === 'puerta').map((a) => a.entre[0]);
  return { nodos, tipo, aristas: [...aristas].map(([key, t]) => [...key.split('|'), t]), entradas: ext };
}

export function hashTopologia(g) {
  const adj = new Map(g.nodos.map((n) => [n, []])); for (const [a, b, t] of g.aristas) { adj.get(a).push([b, t]); adj.get(b).push([a, t]); }
  const h = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
  let col = new Map(g.nodos.map((n) => [n, `${g.tipo.get(n)}${g.entradas.includes(n) ? '*' : ''}`]));
  for (let it = 0; it < 4; it++) { const nc = new Map(); for (const n of g.nodos) nc.set(n, h(`${col.get(n)}|${adj.get(n).map(([m, t]) => `${t}:${col.get(m)}`).sort().join(',')}`)); col = nc; }
  return h([...col.values()].sort().join('/'));
}

export function firmaTopologica(esq, geo = derivarEsquema(esq)) {
  const f = firmaHuella(geo); const t = hashTopologia(grafoConexiones(esq, geo));
  return { huella: f, topologia: t, clave: `${f.clase}:${f.concavos}:${f.huecos}:${t}` };
}

/** Dos esquemas son genuinamente distintos si difieren en clase de huella o en topología de conexiones. */
export function sonDistintos(a, b) { return a.clave !== b.clave; }

export function conjuntoDiverso(lista) {
  const firmas = lista.map((e) => firmaTopologica(e.esquema ?? e, e.geo));
  const clases = new Set(firmas.map((f) => f.huella.clase)); const claves = new Set(firmas.map((f) => f.clave));
  const pares = []; for (let i = 0; i < firmas.length; i++) for (let j = i + 1; j < firmas.length; j++) pares.push({ a: i, b: j, distintos: sonDistintos(firmas[i], firmas[j]), misma_clase_huella: firmas[i].huella.clase === firmas[j].huella.clase });
  return { firmas, clases_de_huella: clases.size, topologias_distintas: claves.size, pares, todos_distintos: pares.every((p) => p.distintos) };
}
