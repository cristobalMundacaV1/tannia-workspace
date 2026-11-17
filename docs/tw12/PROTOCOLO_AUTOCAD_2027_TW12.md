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

## Anexo CAD-OPEN-01 (repetir con `Dibujo1.dwg` sin guardar abierto)
1. Con `Dibujo1` sin guardar, ejecutar `tannia_cad_abrir_copia` sobre la copia DXF de `03 Trabajo`. Registrar el resultado completo incluyendo `structuredContent.detalle` (etapa, hresult, tipo_excepcion, diagnostico.documentos, diagnostico.sin_guardar).
2. Repetirlo con la copia ya abierta: debe responder `reutilizado:true` sin abrir otra ventana ni instancia.
3. Con un cuadro de diálogo abierto en AutoCAD: esperar `AUTOCAD_CUADRO_MODAL`; con un comando activo: `AUTOCAD_COMANDO_ACTIVO`. En ambos casos no se abre nada.
4. Con un DXF corrupto: esperar `DXF_INVALIDO` sin que AutoCAD sea invocado.
5. Tras una apertura válida, `tannia_planos exportar_dwg`: un único DWG, sin sobrescritura; repetir la misma operación no duplica el guardado.
6. Si vuelve a fallar con `APERTURA_FALLIDA` o `AUTOCAD_COM_FALLO`, enviar el `detalle` completo: es la evidencia que confirma o descarta la hipótesis de la matriz.

## Anexo CAD-OPEN-01 (2.ª incidencia: tiempo agotado)
1. Repetir `tannia_cad_abrir_copia` con `Dibujo1` sin guardar. Si vuelve a agotar el tiempo, copiar el **texto visible** completo y `structuredContent.detalle` (etapa, estado_etapa, duracion_ms, etapas[], reconciliacion).
2. La última etapa con estado `inicio` y sin `ok` es el punto de bloqueo (p. ej. `abrir_documento` = `Documents.Open` no retornó; `consulta_ocupacion` = AutoCAD no responde a COM; `enumerar_documentos` = bloqueo al leer `Documents`).
3. Comprobar en AutoCAD si el DXF quedó abierto: `reconciliacion.estado` debe coincidir (`abierto` → `apertura_tardia:true`).
4. Repetir la llamada: con estado incierto debe responder `OPERACION_PENDIENTE_INCIERTA` o reconciliar, sin abrir otra ventana.
5. Con la copia abierta, `tannia_planos exportar_dwg`: un único DWG, layouts/viewports verificados; anotar que sigue sin acreditar validación de dibujo en AutoCAD real hasta contrastarlo visualmente.
