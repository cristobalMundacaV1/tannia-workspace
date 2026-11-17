# Protocolo de prueba real — TW-12 (AutoCAD 2027 + Claude Desktop)

Ejecutar en el equipo de Tannia/PO con una copia de trabajo; nunca sobre originales. Registrar cada resultado como PASA / FALLA / NO EJECUTADO con captura.

1. Instalar el `.mcpb` del candidato (verificar SHA-256 contra HASHES). Pedir: «Genera las cuatro láminas del túnel académico con ancho 5,5, hastiales 2,5, longitud 150, alternativa 6 cm».
2. Verificar que existen en `07 Entregables/Planos`: cuatro PDF, conjunto, DXF, PNG, `verificacion.json`, `historial.json`.
3. Abrir cada PDF a 100 %: medir con regla en pantalla/papel que la sección mide 110 mm de ancho (1:50). Comprobar cajetín, leyenda, tabla de revisiones, advertencia académica y que nada se corta.
4. Pedir `exportar_dwg` con AutoCAD abierto con UNA sola sesión y la copia ya abierta o cerrada. Debe: no abrir una segunda instancia, no sobrescribir un DWG existente, y detenerse con `SESION_AMBIGUA`/`DOCUMENTO_CAMBIO` si hay incertidumbre.
5. En AutoCAD: confirmar 4 layouts TW12-01..04, 5 viewports bloqueados, escalas 1:500, 1:500/1:100, 1:50, 1:10, INSUNITS = metros, cotas nativas editables, capas con colores/grosores.
6. Cerrar AutoCAD de forma abrupta durante una operación y reintentar la misma operación: debe reanudar o informar sin duplicar entidades.
7. Rechazar a propósito una solicitud de consentimiento (Guía hash / https://x.invalid / unknown / licensed): no debe poder aprobarse.
8. Cambiar el nivel de respuesta (breve/normal/detallado) y confirmar que persiste.
Resultado esperado hoy: **NO EJECUTADO**. Hasta registrar estas pruebas no se afirma funcionamiento en AutoCAD real.
