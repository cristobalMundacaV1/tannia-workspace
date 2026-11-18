# Protocolo de UAT real — Tannia Workspace 0.3.0-rc.1 (TW-PRO-E2E)

**Estado de cada paso: NO EJECUTADO** hasta que una persona lo haga en el equipo real y registre la evidencia. Requiere autorización del PO para instalar en el PC de Tannia. Usar SIEMPRE el ZIP reconstruido desde la cabeza final del PR y anotar su SHA-256.

Registrar en cada paso (03 §1): `SHA paquete, SHA código, Windows/versión, Claude Desktop/versión, AutoCAD/versión, hora, entradas (hash), salidas (hash), resultado, ejecutor, observador, limitaciones`. Capturas de pantalla de cada ventana.

## A. Instalación (G10)
1. Extraer el ZIP en una ruta con espacios y ñ (p. ej. `Descargas\Prueba Tannia ñ`). Doble clic en `INSTALAR.cmd`. Instalar en Claude Desktop.
2. Conversación nueva: «Ejecuta el diagnóstico de Tannia Workspace». Debe mostrar `0.3.0-rc.1`, el commit y la huella del servidor iguales a `release-manifest.json`.
3. **Pasa si:** sin consola, sin administrador; diagnóstico coherente.

## B. Expediente por una sola ruta (G03 / UAT-E2E-D / issue #31)
1. Guardar el ZIP real del túnel en `Descargas`. Decir a Claude: «Te dejo los antecedentes del túnel en Descargas\contexto_tunel.zip; prepara planos, cubicaciones, presupuesto y memoria».
2. Repetir con un RAR del mismo expediente (Windows 11 23H2 o posterior trae `tar.exe` con lector RAR; anotar la versión de Windows).
3. Repetir con un ZIP con contraseña y uno dañado.
4. **Pasa si:** Claude pide como máximo UNA ubicación; la frase de recepción indica cuántos documentos se leen y cuáles no y por qué; `02 Originales` contiene el ZIP con la misma huella que el original; ningún archivo del expediente se modifica. **Falla dura:** pedir rutas de cada PDF, declarar leído lo que no se abrió, ejecutar algo del ZIP.

## C. Encargo y una ronda de preguntas (G04 / UAT-E2E-I)
1. Observador sin intervenir. Contar preguntas totales e indispensables.
2. **Pasa si:** no se pregunta lo que está en el enunciado; las preguntas llegan juntas con su motivo; no aparecen nombres de herramientas, JSON ni rutas técnicas; ningún valor de hastial, pernos o precio se supone.

## D. Planos, cubicaciones, presupuesto, memoria (G05–G08)
1. Abrir las láminas PDF y el DXF (AutoCAD o visor). Comparar con las referencias visuales del PO.
2. Abrir el Excel en Excel real: recalcular (F9) y comparar el TOTAL con la memoria y con la ventana de aprobación.
3. **Pasa si:** cuadro de pernos de la lámina = partida de pernos del Excel; mismo total en Excel, memoria, ventana y manifiesto; precios 2010 rotulados como referenciales.

## E. AutoCAD 2027 (G05 / UAT-E2E-F) — requiere AutoCAD real
1. Abrir `Dibujo2.dwg` personal y modificarlo SIN guardar.
2. Pedir: «Guarda los planos en DWG». Seguir `docs/auditoria-integral-2026-11-17/PROTOCOLO_UAT-02_R2.md`, Anexo A.
3. **Pasa si:** `Dibujo2.dwg` sigue abierto, sin guardar y sin cambios; DWG nuevo en documento aislado, cerrado y reabierto con entidades, cotas, capas y layouts comparados; trazado a PDF. Hasta entonces el DWG es **NO VERIFICADO**.

## F. Autorización y cambio A→B→A (G01/G02/G09 / UAT-E2E-C, E)
1. Aprobar la entrega en la ventana real. Exportar.
2. Cambiar el largo del túnel; comprobar que la entrega anterior no se puede exportar como vigente y que Claude explica qué quedó desactualizado.
3. Volver al largo original; regenerar; comprobar que pide una aprobación NUEVA.
4. Probar «Rechazar», cerrar la ventana y dejarla expirar.
5. **Pasa si:** ningún archivo de otra revisión entra a la entrega; ninguna aprobación se reutiliza; rechazar no pierde nada.

## G. Interrupción (UAT-E2E-G)
Cerrar Claude Desktop durante la recepción del ZIP y durante la generación del presupuesto; reabrir y continuar. **Pasa si:** no quedan carpetas a medias en `02 Originales` ni entregas parciales; reintentar no duplica.

## H. Revisión profesional (N3)
Profesional de construcción/geotecnia revisa láminas, cubicaciones y presupuesto contra un cálculo propio. Sin esto, todo queda «borrador para revisión».
