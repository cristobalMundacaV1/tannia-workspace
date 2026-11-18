import path from 'node:path';
const { compararFidelidad, firmasDesdeDxf } = await import(path.join(process.argv[2], 'src', 'cad', 'fidelidad.js'));
const p = (verts, layer = 'A') => firmasDesdeDxf({ entities: [{ type: 'LWPOLYLINE', layer, closed: true, extrusion: { x: 0, y: 0, z: 1 }, verts: verts.map(([x, y]) => ({ x, y })) }] });
const a = compararFidelidad(p([[0, 0], [2, 0], [2, 2], [0, 2]]), p([[0, 0], [2, 2], [2, 0], [0, 2]]));
const b = compararFidelidad(p([[0, 0], [2, 0], [2, 2]], 'A'), p([[0, 0], [2, 0], [2, 2]], 'B'));
console.log(JSON.stringify({ raiz: process.argv[2], cuadrado_vs_cruzada: { fiel: a.fiel, estado: a.estado ?? null }, capa_A_vs_B: { fiel: b.fiel, estado: b.estado ?? null } }));
