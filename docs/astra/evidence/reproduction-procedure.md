# Reproducción independiente A-01/A-02

Ejecutada en Linux/Node 24 sobre 2f4cdd0 antes de leer PR #22. Solo usa proyecto temporal ficticio y lo elimina al terminar. Para repetir: guardar el bloque como `docs/astra/evidence/repro.mjs`, ejecutar `node docs/astra/evidence/repro.mjs` con dependencias instaladas. No ejecutar sobre proyectos de usuario.

```js
import fs from 'node:fs';
import path from 'node:path';
import { startClient,call,data,tmpHome,FIX } from '../../../test/helpers.js';
const home=tmpHome('astra-audit-'); const c=await startClient(home,undefined,{TANNIA_SIN_DIALOGO:'1',TANNIA_CIC:'on',TANNIA_ENGINEERING:'on'});
const log=[]; const T=async(name,args)=>{const r=await call(c.client,name,args); if(r.isError)throw Error(JSON.stringify(r)); log.push({name,result:data(r)});return data(r);};
try {
await T('tannia_proyecto_crear',{nombre:'Auditoria'});
fs.copyFileSync(path.join(FIX,'dxf','simple_m.dxf'),path.join(home,'Proyectos','Auditoria','02 Originales','plano.dxf'));
const p={proyecto:'Auditoria'};
await T('tannia_originales_registrar',p);await T('tannia_proyecto_avanzar',{...p,a_estado:'analisis'});
await T('tannia_partida_manual',{...p,codigo:'P',descripcion:'Medicion ficticia auditoria',unidad:'m2',cantidad:10,origen:'fixture auditoria',apu:'A'});
await T('tannia_apu_definir',{...p,codigo:'A',unidad:'m2',insumos:[{tipo:'material',descripcion:'Ficticio',unidad:'m2',cantidad:1,precio_unitario:100,fuente_precio:'fixture',fecha_precio:'2026-11-17'}]});
await T('tannia_partida_verificar',{...p,codigo:'P',verificada_por:'NOMBRE_SUPLANTADO_SIN_PERSONA'});
await T('tannia_proyecto_avanzar',{...p,a_estado:'borrador'});
const old=await T('tannia_presupuesto_generar',p);await T('tannia_informe_generar',p);
// Change price AFTER artifacts, without regenerating. No human UI was involved.
await T('tannia_apu_definir',{...p,codigo:'A',unidad:'m2',insumos:[{tipo:'material',descripcion:'Ficticio',unidad:'m2',cantidad:1,precio_unitario:900,fuente_precio:'fixture',fecha_precio:'2026-11-17'}]});
await T('tannia_proyecto_avanzar',{...p,a_estado:'revision'});
await T('tannia_proyecto_avanzar',{...p,a_estado:'aprobado',aprobado_por:'NOMBRE_SUPLANTADO_SIN_PERSONA',confirmo_revision_profesional:true});
const ex=await T('tannia_entregable_exportar',p);
console.log(JSON.stringify({noHumanChannel:true,oldBudgetTotal:old.total,expectedNewTotal:10710,exported:ex,log},null,2));
}finally{await c.close();fs.rmSync(home,{recursive:true,force:true});}
```
