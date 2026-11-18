# Reproducción Astra A-01/A-02/A-03 — antes y después

Fecha: 2026-11-17T13:20:10Z. Linux, Node v22.23.4. Scripts: [repro-a01a02.mjs](repro/repro-a01a02.mjs) (procedimiento de docs/astra/evidence/reproduction-procedure.md, parametrizado por raíz) y [repro-a03.mjs](repro/repro-a03.mjs). Cliente MCP sin canal humano; proyecto temporal ficticio.

## ANTES — b9292ef (base Astra = código PR #21 2f4cdd0)
```json
{
 "raiz": "b9292ef",
 "resultado": "VULNERABLE: aprobado y exportado sin persona; total exportado del presupuesto viejo",
 "total_viejo": 1190,
 "exportado": [
  "07 Entregables/Presupuesto 20261117-132011.xlsx",
  "07 Entregables/Memoria 20261117-132011.pdf"
 ],
 "llamadas": [
  {
   "name": "tannia_proyecto_crear",
   "error": null
  },
  {
   "name": "tannia_originales_registrar",
   "error": null
  },
  {
   "name": "tannia_proyecto_avanzar",
   "error": null
  },
  {
   "name": "tannia_partida_manual",
   "error": null
  },
  {
   "name": "tannia_apu_definir",
   "error": null
  },
  {
   "name": "tannia_presupuesto_config",
   "error": null
  },
  {
   "name": "tannia_partida_verificar",
   "error": null
  },
  {
   "name": "tannia_proyecto_avanzar",
   "error": null
  },
  {
   "name": "tannia_presupuesto_generar",
   "error": null
  },
  {
   "name": "tannia_informe_generar",
   "error": null
  },
  {
   "name": "tannia_apu_definir",
   "error": null
  },
  {
   "name": "tannia_proyecto_avanzar",
   "error": null
  },
  {
   "name": "tannia_proyecto_avanzar",
   "error": null
  },
  {
   "name": "tannia_entregable_exportar",
   "error": null
  }
 ]
}
{"raiz":"b9292ef","cuadrado_vs_cruzada":{"fiel":true,"estado":null},"capa_A_vs_B":{"fiel":true,"estado":null}}
```

## DESPUÉS — 420b860
```json
{
 "raiz": "420b860",
 "resultado": "BLOQUEADO en tannia_partida_verificar",
 "error": "VERIFICACION_HUMANA_REQUERIDA",
 "mensaje": "No hay un canal para que una PERSONA lo autorice: este cliente no ofrece ventanas de confirmación y el diálogo del sistema no está disponible (o no se respondió). Claude no puede autorizarlo por usted.",
 "llamadas": [
  {
   "name": "tannia_proyecto_crear",
   "error": null
  },
  {
   "name": "tannia_originales_registrar",
   "error": null
  },
  {
   "name": "tannia_proyecto_avanzar",
   "error": null
  },
  {
   "name": "tannia_partida_manual",
   "error": null
  },
  {
   "name": "tannia_apu_definir",
   "error": null
  },
  {
   "name": "tannia_presupuesto_config",
   "error": null
  },
  {
   "name": "tannia_partida_verificar",
   "error": "VERIFICACION_HUMANA_REQUERIDA"
  }
 ]
}
{"raiz":"420b860","cuadrado_vs_cruzada":{"fiel":false,"estado":"con_diferencias"},"capa_A_vs_B":{"fiel":false,"estado":"con_diferencias"}}
```

Interpretación: antes, un cliente sin persona verificó la partida, aprobó por nombre y exportó el presupuesto de 1.190 CLP aunque los datos vigentes valían 10.710 CLP; el comparador declaraba fiel un cambio de topología y otro de capa. Después, la verificación exige una ventana humana (sin canal: VERIFICACION_HUMANA_REQUERIDA) y el comparador informa con_diferencias. La variante con persona real que aprueba datos nuevos y entrega exactamente lo aprobado está en test/rc_autoridad_entrega.test.js (A-02) y en el verificador del ZIP (pasos 6–8).
