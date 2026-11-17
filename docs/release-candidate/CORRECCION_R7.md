# Corrección de inconsistencias de la entrega R7 (prueba de campo 0.2.0-rc.1)

La entrega R7 está en el equipo de la usuaria y **no se modifica**: se conserva como evidencia. Cualquier entrega corregida debe generarse con esta versión, en una revisión nueva y con aprobación nueva.

| # | Hallazgo | Causa | Corrección | Prueba |
|---|---|---|---|---|
| 1 | Se exportaron documentos que decían «BORRADOR» | La memoria solo quitaba la marca si el proyecto ya estaba en `entregable`, lo que ocurre DESPUÉS de exportar | El estado del documento se deriva de su contenido (presupuesto completo y verificado ⇒ «CANDIDATO A ENTREGA — revisión Rn»); el manifiesto revisa el contenido real del PDF y del XLSX y bloquea marcas de borrador / no final / total parcial / desactualizada | `rc_r7_regresion` R7-1/2 |
| 2 | Circularidad aprobar→final | Idem | Flujo: generar candidatos → revisar → aprobar huellas exactas → exportar los mismos bytes. Nada se edita tras aprobar; si cambian, la aprobación deja de valer | R7-1/2 (huellas exportadas = aprobadas), R7-7 |
| 3 | El PDF mezclaba originales y fuentes | Una sola sección «archivos de origen» con las fuentes de partidas | Secciones separadas: 1.1 originales registrados; 1.2 fuentes geométricas por partida (con partidas vinculadas) | R7-3/6 |
| 4 | `cantidad_verificada` contradictoria | `partidas.json` guardaba `false` mientras la API derivaba `true` de los recibos | El campo ya no se guarda en disco; la verificación existe solo como recibo vigente, igual en API, XLSX, PDF y manifiesto | R7-4/5 |
| 5 | Recibos no auditables | — | `tannia_recibos_verificar` (solo lectura): integridad HMAC, canal, identidad **declarada y no autenticada**, alcance, vigencia y consumo; no expone la clave | R7-4/5 |
| 6 | APU $8.000 y 10/5/19 atribuidos a la usuaria | Los valores llegan como argumentos del asistente | **Origen no acreditado.** No existe en el sistema evidencia de quién los aportó; además, esos valores provienen del guion de prueba redactado por el asistente. XLSX y PDF lo declaran así | R7-3/6 |
| 7 | Aprobación anterior tras cambio de precio | — | Bloqueado (también A→B→A y forzando el estado) | R7-7 |

Suite: 489 pruebas, 470 ok, 0 fallos, 19 omitidas (`evidence/04-suite-fix-r7-linux-node22.tap`).
Limitaciones: no probado aún en Claude Desktop real; la detección por contenido reconoce las marcas que emiten los generadores de Tannia, no textos libres arbitrarios.
