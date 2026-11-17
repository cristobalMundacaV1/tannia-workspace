# Registro de decisiones técnicas — 0.2.0-rc.1

Decisiones reversibles tomadas durante la implementación, con el problema, la alternativa y la evidencia. Las decisiones profesionales, comerciales o legales pendientes (D01–D12 de [ASTRA 07](../astra/ASTRA_07_RISK_DECISIONS_AND_EVIDENCE_MATRIX.md)) **no** se resolvieron aquí: se aplicó la alternativa conservadora y la capacidad afectada queda bloqueada o deshabilitada.

## Seguridad y autoridad

**D-SEC-01 · Recibo HMAC local en lugar de un broker de consentimiento.** Problema: A-01 (nombre/booleano del modelo bastaba). Alternativas: (a) broker en proceso aparte con otra cuenta; (b) recibo firmado emitido solo tras elicitación del cliente o diálogo del SO. Elegida (b): resuelve la vía reproducida (el modelo solo llama herramientas) sin infraestructura nueva. Frontera declarada: un proceso del **mismo usuario** con acceso al perfil (otro programa, otro MCP de archivos) podría leer la clave o simular clics; no se promete resistencia a eso (ASTRA 07 RISK01/RISK07). Revertir: borrar `src/autoridad` restauraría la vulnerabilidad; no se recomienda.

**D-SEC-02 · Canal de archivo «APRUEBO <id>» desactivado para autorizaciones profesionales.** Otro MCP con escritura en el perfil puede crearlo. Se mantiene para registrar fuentes CIC, borradores desactualizados y atribución de planos (acciones que no producen entrega final); queda como riesgo residual documentado y candidato a retiro en POC-CONSENT.

**D-SEC-03 · Verificación derivada, no almacenada.** `cantidad_verificada` ya no es un campo con autoridad: se calcula desde recibos vigentes (misma partida, misma `version_id`, misma huella de contenido). Un `true` heredado o editado a mano se muestra como «verificación heredada SIN recibo».

**D-SEC-04 · Los parámetros `aprobado_por`, `confirmo_revision_profesional`, `verificada_por` se conservan en el esquema sin efecto.** Mantener compatibilidad de llamadas de clientes antiguos sin que conserven autoridad (ASTRA 04 §9.2). El nombre válido es el que la persona escribe en la ventana.

**D-SEC-05 · Confirmaciones de datos (`confirmar_cambios`, `norte_confirmado`) no se tratan como autorización profesional.** Son declaraciones de datos aportados por la usuaria a través del asistente y quedan registradas como tales; no producen estados finales ni entregas. Riesgo residual: el modelo podría declararlas sin preguntar; mitigado porque cualquier resultado sigue requiriendo verificación y aprobación con recibo.

## Revisiones y entrega

**D-ARQ-01 · Invalidación conservadora.** Siguiendo ASTRA 03 (desacuerdo con la invalidación «semántica»): cualquier cambio de partidas, APU, parámetros, calibraciones, originales registrados, bytes de archivos de origen o verificaciones crea una revisión nueva e invalida artefactos y aprobación. A→B→A crea un número nuevo; recibos y artefactos anteriores no reviven.

**D-ARQ-02 · Verificar una partida también cambia la revisión.** El XLSX y la memoria muestran el estado de verificación; por coherencia, los archivos generados antes de verificar quedan desactualizados. Costo: hay que regenerar tras verificar. El procedimiento `tw-presupuestar-y-entregar` lo indica.

**D-ARQ-03 · CIC conserva su versionado por caso.** `tannia_cic_entregable` ya bloquea pasos/fuentes obsoletos y genera documentos *editables* del caso, no entregas aprobadas. No se fusionó con el manifiesto legacy para no reescribir un motor correcto (ASTRA 04 §9.5); la unificación queda como E11 «en curso».

**D-ARQ-04 · Redondeo sin cambios.** Legacy redondea PU antes del subtotal; CIC no. ASTRA 04 pide no imponer igualdad sin política por presupuesto; se mantuvo el comportamiento y se documenta. Sí se eliminó el valor implícito de GG/U/IVA (A-04).

**D-ARQ-05 · Planos TW-12 de revisión fuera de `07 Entregables`.** Se generaban en `07 Entregables/Planos` sin aprobación, contradiciendo el manual («solo tras aprobar»). Ahora van a `06 Informes/Planos`.

**D-ARQ-06 · Migración en el primer acceso, con respaldo y reversión.** Proyectos anteriores se migran al abrirse: respaldo byte a byte, aprobaciones/revisiones previas sin recibo vuelven a «borrador», entregables previos quedan «importados sin verificar». Un esquema más nuevo no se toca. `tannia_proyecto_migracion revertir` restaura los bytes previos.

## CAD

**D-CAD-01 · Contrato de fidelidad por tipo y estado `no_concluyente`.** Mejora sobre ASTRA (que pedía reforzar el oráculo): además de capa/orden/sentido/bulge/elevación, los tipos sin comparador (INSERT, DIMENSION, HATCH, MTEXT…) y las lecturas incompletas ya no se pueden declarar «fiel»; el conteo no acredita. Consecuencia: dibujos con esos tipos darán «no concluyente» hasta tener comparador. Es el lado seguro.

**D-CAD-02 · Lectura COM de `GetBulge`/`Elevation` añadida sin probar en AutoCAD.** Envuelta en `try`; si AutoCAD no la informa, el resultado es `no_concluyente`, nunca `fiel`. Validación N2 pendiente (E07).

## Producto y empaquetado

**D-PKG-01 · ZIP con `.mcpb` + lanzador `INSTALAR.cmd`.** El formato de distribución vigente del producto es `.mcpb` (extensión oficial de Claude Desktop). No se inventó un instalador MSI/EXE. El lanzador en lote (ASCII, sin PowerShell, sin `ExecutionPolicy`) comprueba arquitectura, integridad SHA-256 con `certutil`, presencia de Claude Desktop y AutoCAD (informativo) y abre la extensión: la persona pulsa «Instalar» en Claude Desktop (intervención declarada). No requiere administrador ni descarga nada.

**D-PKG-02 · ZIP determinista con `fflate` (MIT, 0.8.3) como devDependency fija.** Ya estaba en el lockfile como dependencia del CLI oficial `@anthropic-ai/mcpb`; se fijó explícitamente para no depender de un transitivo. No se distribuye en el producto.

**D-PKG-03 · Identidad del artefacto por su propia huella.** El contenido interno de la extensión es reproducible (16/16 archivos idénticos entre compilaciones), pero el empaquetador `mcpb` produce bytes distintos por compilación. Por eso CI construye el ZIP una sola vez y prueba **ese mismo** artefacto en Ubuntu y Windows.

**D-PKG-04 · Versión 0.2.0-rc.1.** Cambio de esquema de proyecto y de contrato de aprobación respecto de 0.1.0-rc.3.

## Pregunta concreta al Product Owner (no bloquea el resto)

Para pasar G1 y G7 a N2 se necesita **una sesión en un Windows con Claude Desktop** (idealmente el de Tannia): instalar el ZIP por doble clic y comprobar que la ventana de verificación/aprobación aparece y no puede ser respondida por el modelo. ¿Quién y cuándo puede ejecutar el protocolo de [PRUEBAS_REALES_PENDIENTES.md](PRUEBAS_REALES_PENDIENTES.md)?
