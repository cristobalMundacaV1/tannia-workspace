# TW-10 — Protocolo de validación de campo (G10) — NO EJECUTADO
> La versión detallada, con formulario de registro y captura de errores, es `docs/tw10/entrega/PROTOCOLO_PRUEBA_REAL.md` (va en el ZIP de entrega). Este documento queda como resumen.

Estado: **PENDIENTE DE EXTERNOS**. Ninguna línea de este protocolo se declara aprobada. El implementador no puede completar §A–§C.
Paquete a usar: el `.mcpb` del candidato (hash en `TW10_CANDIDATE.md`). Trabajar en un proyecto descartable; no usar proyectos ni DWG reales.

## A. AutoCAD 2027 real (persona con AutoCAD)
1. Instalar el `.mcpb` en Claude Desktop (doble clic). Confirmar en Configuración › Extensiones que aparece "Tannia Workspace" y 72 herramientas. Si algún `tannia_arq_*` aparece excluida por esquema, **copiar el mensaje exacto**.
2. Abrir AutoCAD 2027 con un dibujo en blanco. En Claude: «Crea el proyecto *Prueba TW10* y diseña una casa de 90 m² en L con patio, 3 dormitorios y 2 baños».
3. Pedir «publica la alternativa en L y guárdala como DWG 2D» (`tannia_arq_publicar` con `a_autocad`) y «llévala a AutoCAD en 3D» (`tannia_3d_a_autocad`).
4. Verificar con las herramientas existentes: `tannia_3d_verificar`, `tannia_cad_verificar_persistencia`, `tannia_diseno_verificar_dwg` (2D). Anotar resultados tal cual.
5. Comprobar **visualmente** en AutoCAD: la L tiene el patio **vacío** (sin losa ni cubierta sobre él), capas `TW_*` / `TW3D_*`, cubierta oculta por defecto, 3D coherente con el 2D.
6. Cerrar y **reabrir** el DWG; ejecutar `AUDIT` y registrar el resultado. Repetir con la alternativa compacta.
Registrar: versión de AutoCAD (`ACADVER`), fecha, resultados, capturas, y toda divergencia. Cualquier fallo ⇒ RC parcial.

## B. Taller con Tannia y arquitecta/o revisor independiente
Al menos **15 encargos contrastantes** (incluir: sin terreno, terreno angosto, piscina, privacidad, viento, ahorro, cambio de programa, CIP ilegible, hemisferio). Por encargo, puntuaciones **cualitativas separadas** (no promediar): uso, estética/espacio, geometría, ambiente, seguridad, comunicación. Registrar rechazos y por qué. La revisión debe hacerla una persona distinta del implementador.

## C. Decisión del Product Owner
El PO decide aceptación, merge y distribución. El agente no marca `ACEPTADO_POR_PO`.

## Mensaje de prueba para pegar en Claude Desktop (un solo bloque)
> Crea (o usa) el proyecto «Prueba TW10». Quiero una casa de 90 m², 3 dormitorios, 2 baños, de un piso, en L con patio. Mis hijos juegan cerca de la piscina y quiero verlos desde la cocina; el living con mucha luz pero fresco en verano. Muéstrame al menos tres ideas distintas y dime qué compromisos tiene cada una. No tengo el terreno todavía: no inventes el sol ni las normas; dime qué datos necesitas para estudiarlos.
> Luego (si funciona): «el terreno es de 16×30 m, se entra por el sur, el norte verdadero está arriba, en Santiago» y «estudia un alero para el living».
