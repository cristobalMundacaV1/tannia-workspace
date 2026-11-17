# A-03: reproducción pura, ejecutada antes de PR #22

Sobre 2f4cdd0, desde raíz del repo con Node:

```js
import {compararFidelidad,firmasDesdeDxf} from './src/cad/fidelidad.js';
const p=(verts,layer='A')=>firmasDesdeDxf({entities:[{type:'LWPOLYLINE',layer,closed:true,verts:verts.map(([x,y])=>({x,y}))}]});
console.log(compararFidelidad(p([[0,0],[2,0],[2,2],[0,2]]),p([[0,0],[2,2],[2,0],[0,2]])));
console.log(compararFidelidad(p([[0,0],[2,0],[2,2]],'A'),p([[0,0],[2,0],[2,2]],'B')));
```

Ambos devuelven `fiel:true`, faltan/sobran vacíos, esperadas=informadas=1.
Primero cambia orden/conectividad; segundo cambia capa. Alcance: comparador puro. No demuestra bypass de todos los otros gates de importación ni ejecución real de AutoCAD.
