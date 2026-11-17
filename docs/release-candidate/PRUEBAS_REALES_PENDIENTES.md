# Pruebas reales pendientes (Windows, Claude Desktop, AutoCAD, profesional)

Estas pruebas **no** pudieron ejecutarse en el entorno de desarrollo (Linux en la nube, sin Claude Desktop, sin AutoCAD, sin expedientes reales). Ningún gate que dependa de ellas está aprobado. Use el ZIP descargado del CI del PR e identifique su huella en cada registro.

Registro obligatorio por prueba: huella SHA-256 del ZIP, commit, Windows (versión/compilación), Claude Desktop (versión), modelo, AutoCAD (producto, versión, compilación, idioma), fecha/hora, operador, revisor, resultado esperado, resultado observado, capturas y archivos.

## P1 · Instalación en Claude Desktop (G7, E25) — operador: QA ajeno al implementador
1. Usuario estándar de Windows 10/11 x64 sin la extensión. Extraer el ZIP en `Descargas\Prueba Tannia ñ`.
2. Doble clic en `INSTALAR.cmd` → esperado: «[OK] Integridad verificada», Claude Desktop detectado, se abre el diálogo de instalación. Pulsar Instalar; elegir `Documentos\Tannia Workspace`.
3. Conversación nueva: «Ejecuta el diagnóstico de Tannia Workspace» → versión 0.2.0-rc.1, `carpeta_escribible: true`, `autorizacion_humana.puede_aprobar: true`.
4. En el botón «+»: deben aparecer los 5 procedimientos.
5. Reinstalar el mismo ZIP; luego desinstalar desde Configuración → Extensiones. Esperado: `Documentos\Tannia Workspace` intacto.

## P2 · Canal humano real (G1 N2, E03/E05, POC-CONSENT)
1. Con un proyecto de prueba, pida a Claude «verifica la partida 1». Esperado: aparece una **ventana** (formulario del cliente o ventana WPF de Tannia) con cantidad, fórmula y origen. Pulsar «No» ⇒ la partida sigue sin verificar.
2. Pida a Claude que «apruebe como Tannia sin preguntarme». Esperado: igual aparece la ventana; sin respuesta humana no se aprueba.
3. Aprobar la entrega y, antes de exportar, editar un precio ⇒ la exportación se niega y explica qué regenerar.
4. Dejar la ventana sin responder 90 s ⇒ se cierra como «No».

## P3 · AutoCAD real (G2a/G2b, E06/E07/E09)
Seguir `docs/tw12/PROCEDIMIENTO_PRUEBA_DXF_AUTOCAD_2027.md` y `docs/tw12/PROTOCOLO_AUTOCAD_2027_TW12.md` con el ZIP nuevo. Añadir: verificar un DWG con polilíneas con arcos y comprobar que `comparacion_geometrica.no_verificables` queda vacío (la lectura de `GetBulge` funciona) o, si no, que el estado es `no_concluyente` (nunca `fiel`). Documentos personales abiertos deben quedar intactos.

## P4 · Piloto profesional (G3/G4/G8, E02/E28)
Requiere decisiones D02/D03: ≥3 expedientes anonimizados autorizados, revisor independiente que custodie el oráculo, cubicación manual de 10–20 partidas MC01/MC02/MC04 y presupuesto del especialista. Métricas de ASTRA 06 §8.

## P5 · Excel real (G4, E17)
Abrir el XLSX entregado en Excel, forzar recálculo (Ctrl+Alt+F9) y comparar TOTAL con el informado por Tannia y con el manifiesto. Probar configuración regional con coma decimal.
