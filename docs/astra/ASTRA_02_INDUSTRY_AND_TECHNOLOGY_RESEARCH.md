# ASTRA 02 — Investigación primaria y decisiones de integración

Consulta independiente realizada el 17-11-2026, **antes de leer PR #22**, después del diagnóstico congelado `c732f23`. Fuentes oficiales y repositorios originales; las prestaciones de proveedores son declaraciones documentadas, no resultados de una PoC propia. No se hicieron entrevistas, compra de normas, instalación de conectores externos ni pruebas con software comercial. No se reproducen textos de normas INN. Costos bajo/medio/alto son comparación cualitativa de integración + licencias + operación, no cotizaciones.

## 1. Trabajo profesional: qué cadena hay que asistir

La documentación técnica de la Dirección de Arquitectura MOP fija requisitos para sus proyectos, con exigencias adicionales del contrato [R12]. ONDAC enseña APU, itemizados, cotizaciones, respaldo y exportación Excel/Project [R18]. Son evidencia de flujos concretos; no una encuesta representativa del trabajo de Tannia. Inferimos una primera vertical de expediente de edificación y cubicación, a ratificar con su expediente real. La prueba de campo debe registrar también qué pasos sobran, no obligar a la profesional a adoptar el flujo del software.

| Etapa y actor | Insumos y decisión profesional | Salida útil / control de revisión | Estado Tannia / brecha |
|---|---|---|---|
| Encargo, arquitecta/mandante | finalidad (anteproyecto, licitación, obra), ubicación, programa, alcance contractual | brief con incógnitas y exclusiones; responsable por disciplina | `architect/briefing`, interpretación CIC; falta perfil contractual de entrega |
| Recepción, oficina técnica | planos DWG/DXF/PDF, EETT, revisiones, levantamiento, CIP cuando corresponda | índice documental, originales hash, dependencias/XREF y faltantes | `project/gestion` y protección existen; falta grafo de expediente completo |
| Inspección, CAD/cubicador | unidades, escala contrastada, layers, bloques, espacios, detalles, duplicados | mapa visual de medición, entidades excluidas, dudas | motor geométrico parcial; no tratar plano escaneado como CAD |
| Interpretación, profesional | qué se mide, qué partida incluye, bruto/neto, vanos, encuentros, etapas | regla de medición vinculada a plano y EETT; RFI si contradicen | reglas existentes reutilizables; falta MethodCard y resolución contractual |
| Edición, arquitecta | cambio solicitado y efectos sobre recintos/vanos/cotas | copia nueva, diferencias localizadas, revisión de dimensiones y presentación | operaciones de vivienda/CAD existentes; falta conservación probada en planos ajenos |
| Cubicación, cubicador | geometría + método + parámetros confirmados | planilla desglosada por elemento/sector, memoria verificable | `quantities` y CIC; falta unificar procedencia para toda ruta |
| Costos, presupuestista | precios fechados, rendimiento, cuadrilla, merma, inclusión de equipos/transportes | APU revisable, presupuesto por revisión, sensibilidad y faltantes | cálculo/XLSX existen; defaults y reconciliación pendientes |
| Planificación, constructor | cantidades, rendimientos, calendarios, restricciones, secuencia y recursos | programación base y lookahead; compromisos semanales humanos | CPM/duración/EVM existentes; no equivalen a planificación de obra con recursos |
| Ejecución, oficina técnica/ITO | avance medido/aceptado, contrato, cambios, inspecciones | estados de pago, RFI, no conformidades, versiones as-built | propuesto; no inferir aceptación de obra ni pago desde geometría |
| Revisión y entrega | destinatario, propósito, revisión competente, archivos coherentes | paquete aprobado con manifiesto, lista de pendientes y supersesión | exportadores existentes; A-01/A-02 impiden confiar en estado final |

RFI es una consulta, no autorización automática de cambio; preservar respuesta, emisor y efecto contractual [R20]. Control de calidad propone inspecciones por partida, punto de espera, evidencia y responsable. Se adopta como práctica de diseño del producto; la obligación específica se obtiene del contrato/regulación aplicable. Last Planner exige compromisos y eliminación de restricciones con quienes ejecutan; el asistente puede organizar y calcular PPC, no prometer trabajo en su nombre [R19]. No extrapolamos estadísticas de ahorro de proveedores a Tannia.

## 2. Tecnología CAD: decidir por operación

Autodesk documenta COM/ActiveX para Windows y distingue AutoCAD completo de LT; LT no ofrece automatización externa equivalente y no soporta Managed .NET/ObjectARX como AutoCAD completo [R01–R02]. La propuesta actual debe declarar **AutoCAD completo Windows** y builds concretos. PDF/DXF sin AutoCAD puede seguir siendo otro perfil de capacidades, sin llamarlo soporte DWG.

Open documenta DWG; Import documenta importación en un documento y su ejemplo incluye DXF [R03–R04]. Esto respalda investigar la ruta del PR #21, pero no acredita preservación de layouts, DIMENSION, XDATA, XREF o sólidos. Tampoco demuestra la causa de la excepción observada. En particular, Import retorna null salvo WMF; no usar su retorno como documento importado. La revisión de parámetros COM debe incluir SAFEARRAY(double), WCS, documento propietario y etapa/HRESULT. Es una hipótesis diagnóstica a verificar, no causa declarada.

.NET ofrece acceso a la base de datos y DxfIn documentado en 2026 [R05]; ObjectARX trabaja en proceso y AutoLISP permite automatización. **Decisión propuesta:** conservar COM para operaciones actualmente acotadas y comprobables; PoC .NET tipado para preservación/editabilidad si la ruta COM no supera el corpus. No introducir comandos/arbitrary LISP del modelo como fallback. La documentación de interfaces 2027 fue consultada, pero no se verificó compilación ni compatibilidad binaria de un plugin .NET 2027. Pin de SDK/runtime y prueba real por versión son condición, no detalle pospuesto.

| Dato CAD | Requisito de fidelidad | Qué no basta |
|---|---|---|
| Layout/viewport | papel, dispositivo/CTB o STB, orientación, centro, escala, twist, recorte, bloqueo y región | contar 4 layouts/5 viewports |
| DIMENSION | puntos, valor medido, texto override, estilo, asociatividad y visualización | contar 9 cotas |
| XDATA/ext dictionaries | aplicación, códigos tipados, valores y vínculos objeto-revisión | conservar solo TANNIA_TRACE |
| XREF | árbol, hashes de dependencias, transformaciones, path resuelto bajo allowlist, estado cargada/no resuelta | explotar/bind automáticamente o omitir faltantes |
| 3DSOLID/ACIS | tipo nativo, topología cuando accesible, masa/volumen/centroide/bbox y unidades | volumen+centroide, o lectura parcial DXF |
| Bloques/atributos | definición, instancias, matrices acumuladas, visibilidad/dinámica, atributos | sumar geometría repetida de planta y detalle |
| Texto/capa | Unicode, fuentes disponibles, style, altura, posición, rotación, capa y overrides | igualdad del texto sin posición ni papel |

APS Automation procesa dibujos en nube con motores AutoCAD [R06]. Es una vía posible para lotes, pero añade transferencia de planos, autenticación, colas, costos y empaquetado de dependencias. No es sustituto inmediato de edición interactiva local. Autodesk Product Help MCP ofrece documentación oficial, incluida referencia APS desde 12-11-2026 [R07]; **no confundir documentación con control de AutoCAD**. Se puede integrar para investigación sin enviar geometría del cliente.

## 3. MCP, Skills y candidatos: decisión hacer/integrar/comprar/no incorporar

Revisión del estado de los repositorios originales el 17-11-2026: los tres consultados por API son públicos y no archivados; leídos README y LICENSE. No se auditó todo su código ni se corrió su CI: no hay elegibilidad de distribución aún. La licencia MIT permite reutilizar bajo sus términos, no acredita seguridad ni compatibilidad AutoCAD 2027. Se debe capturar commit exacto y revisar cadena de suministro en la PoC; no instalar `main` flotante.

| Candidato / evidencia | Decisión propuesta y aporte | Compatibilidad/licencia/dependencia | Seguridad, mantenimiento, actividad | Costo / PoC mínima y rechazo |
|---|---|---|---|---|
| Núcleo local actual + COM [A-01…07] | **Hacer** correcciones; conservar inversión y UX | Node, Windows PowerShell, AutoCAD completo; repo UNLICENSED | corregir autoridad/entrega antes de crecer; CI activo observado | medio; expediente con edición preservando contenido ajeno y crash seguro |
| Plugin .NET [R01,R05] | **Hacer PoC**, integrar solo si mejora conservación | SDK por build, AutoCAD completo; licencia Autodesk y código propio | IPC local allowlist, sin eval; coste de actualizar plugin | alto; mismos DWG/DXF que COM, abort transacción y save/reopen; rechazar si no mejora cobertura |
| ObjectARX / AutoLISP [R01] | **No incorporar como motor nuevo** ahora; AutoLISP cerrado solo si PoC justifica | ObjectARX nativo, ABI/build; AutoLISP disponibilidad por producto | superficie de código ejecutable; mantenimiento alto | alto/medio; operación faltante concreta; rechazar shell/LISP libre del modelo |
| Porta048/AutoCad-MCP [R21] | **No incorporar** al runtime; referencia de primitivas | MIT verificada; Python ≥3.10; COM Windows; declara AutoCAD/GstarCAD/ZWCAD | README arranca CAD y permite guardar; no evidencia propia de sandbox/recuperación ni 2027; actividad reciente no cuantificada | bajo demo/alto endurecimiento; intentar guardar original y timeout sin repetición en copia descartable |
| ACKaraca/AutoCAD_MCP [R22] | **No incorporar** como reemplazo | MIT; Python ≥3.12; apunta full AutoCAD 2021–2026, no LT | README actual describe 5 tools no mutantes y ausencia de prueba COM real; upstream original no disponible; no confundir archivo legacy con producto activo | medio; handshake limpio, lectura 2026 real, licencia/transitivas; no satisface edición hoy |
| U-C4N/Autocad-MCP [R23] | **Investigar integración selectiva**; no comprar promesa de producción | MIT; Python ≥3.11; COM o ezdxf; README v1.8 declara 257 tools, discovery reducido | declara journal/checkpoints y QA; dato del proveedor, no validación propia. Desarrollo reciente v1.8; bus factor/SLA no verificados | medio/alto; comparar 10 operaciones, documentación de no comprobado, cancelación, aislamiento; admitir solo capacidades que superen gates |
| MCP SDK / mcpb [R08,R09] | **Integrar y mantener** lo ya usado | SDK fijado 1.32.2, paquete @anthropic-ai/mcpb 2.1.2 en lock; upstream mcpb redirige a modelcontextprotocol | verificar procedencia de próxima actualización; paquete no confiere privilegios ni seguridad | bajo/medio; instalar como usuario estándar, prueba texto MCP, rollback; no migrar mayor SDK sin contratos |
| Skills Claude Code [R10] | **Hacer** catálogo y procedimientos equivalentes | SKILL.md; frontmatter depende host; Claude Desktop requiere verificación de cliente/plan | allowed-tools es configuración de host, no frontera de dominio; prohibir Bash general sobre expediente en perfil profesional | bajo; medir disparadores y rutas no permitidas; ASTRA 05 |
| Autodesk Product Help MCP [R07] | **Integrar opcional**, solo investigación pública | servicio oficial de documentación; términos del proveedor | sin planos/ubicaciones; disponibilidad/red; cita con versión | bajo; consulta API 2026/2027 con link y abstención si no existe |
| APS Automation [R06] | **No incorporar** primera entrega; PoC posterior PO | pago por servicio/cuenta; cloud y motor versionado | OAuth mínimo, dependencias empaquetadas, residencia/retención por contrato | alto; dibujo anónimo, XREF y salida hash; sin autorización de nube se descarta |
| Bluebeam Revu/Quantity Link/Max MCP [R16,R17] | **Comprar si ya encaja en oficina**, integrar resultados | propietario; Revu/Excel, Quantity Link Complete/Max; MCP listado en Max | comparar revisiones/mediciones; no se verificó MCP real, API ni condiciones de datos | medio; PDF real con dos escalas, cambio de revisión y reconciliación con XLSX; evitar doble fuente maestra |
| Forma Takeoff/Docs [R15] | **Comprar si colaboración multiempresa lo requiere**, no base actual | propietario/cloud; 2D y 3D; BIM fuera de alcance | catálogo/revisiones compartidas; permisos y exportabilidad a validar | alto; piloto 2D con exportación trazable; no adoptar BIM implícitamente |
| ONDAC Evolution/Estimate [R18] | **Integrar intercambio / comprar según uso real** | propietario Chile; APU, Excel/Project declarados; no API/MCP pública verificada | precios/catálogos requieren licencia y actualización; no extraer base sin derecho | medio; importar/exportar 20 partidas y cotejar redondeos, códigos y fuentes |
| Excel + Project desktop [R24] | **Integrar archivos primero** | licencias propias; XLSX probado por motor, Excel real pendiente | fórmulas externas/macros deshabilitadas, fechas/locales y cálculo cacheado | bajo/medio; recalcular XLSX con Excel real y mapear tareas/calendario; no confundir Project Online retirado con desktop |
| Procore [R20] | **No incorporar** hasta demanda contractual | plataforma comercial; RFI/control documental | autenticar roles/destino; envíos requieren autorización; API no probada | alto; expediente con RFI vinculada a revisión y respuesta sin convertirse en orden de cambio |
| BIM/IFC | **No incorporar**; investigación solamente | software/competencias/intercambio adicionales | no autorizado, cambia modelo de negocio y evaluación | alto; PO debe justificar clientes, cantidad de modelos y retorno antes de cualquier desarrollo |

Se evita fabricar un catálogo alternativo de precios o un editor CAD completo: la diferenciación defendible es **procedencia por cifra, cambios verificables, conocimiento chileno contextual y entrega coherente**, integrando las herramientas que la profesional ya usa. Ningún candidato se adopta por número de tools o estrellas.

## 4. Fuentes normativas y licencia: registro operativo

| Fuente | Verificado el 17-11-2026 | Uso permitido en diseño / límite |
|---|---|---|
| LGUC/MINVU [R11] | compilación publicada de junio 2026, Ley 21.826 | registrar versión y disposición aplicable; contrastar texto legal y transitorios antes de codificar regla |
| OGUC/MINVU [R11] | página indica actualización DS 68, DO 02-10-2026 | reglas por artículo/fecha/tipo de obra; ni el texto consolidado ni el modelo sustituyen decisión DOM |
| DDU [R13] | hay catálogo y lista de circulares derogadas | interpretar según competencia/materia; no usar DDU retirada ni asignarle rango de ley |
| PRC/PRI/PRM, CIP, DOM [R14] | Portal IPT reúne antecedentes; visores son referenciales | expediente territorial de la parcela; ordenanza/plan/publicación/CIP y aclaración DOM ante discrepancia; no hay comuna elegida, por tanto ninguna altura/rasante concreta validada |
| NCh353:2018 [R25] | catálogo INN: vigente; 2000 no vigente | método de cubicación de edificación; contenido protegido no adquirido: reglas detalladas quedan pendientes de consulta licenciada y revisión competente |
| NCh1156:2018 [R26] | vigente; partes 1999 listadas no vigentes | ordenación de EETT/partidas; no inventar códigos normativos ni copiar tablas |
| Otras NCh (hormigón, sísmica, térmica/acústica, accesibilidad) | pertinentes según proyecto; **ediciones y cláusulas no verificadas aquí** | inventario por especialista, vínculo reglamentario/contractual y licencia; fuera del motor de cálculo estructural |
| SEC/RIC [R27] | portal oficial y RIC18/19 sobre proyectos/puesta en servicio | apoyo documental; ejecución/declaración por profesional autorizado; Tannia no diseña ni certifica instalaciones autónomamente |
| MOP [R12] | D05 y manuales por Dirección de Arquitectura | aplicabilidad contractual/institucional, no obligación de toda vivienda privada |
| INN derechos/exigibilidad [R28] | normas voluntarias salvo incorporación reglamentaria en su ámbito; derechos reservados | además registrar adopción contractual. Acceso a PDF no concede redistribución ni incorporación a RAG comercial |
| Privacidad Ley 19.628 / 21.719 [R29] | BCN indica vigencia diferida general de 21.719 al 01-12-2026 | al 17-11-2026 no presentar todo régimen nuevo como vigente; preparar minimización/retención/derechos/transferencias para despliegue, revisión jurídica pendiente |

Una regla normativa debe guardar: autoridad, instrumento, artículo/localizador, edición, publicación, fecha efectiva, territorio, tipología, condición de aplicación, excepciones, derogaciones, licencia, fecha de verificación, persona revisora y fuentes contradictorias. `verified_exact` de CIC significa coincidencia con texto almacenado; jamás se renombra a «cumple OGUC». Fuente aprobada para citar no es fuente jurídicamente comprobada.

## 5. Seguridad y calidad derivadas de investigación

MCP es protocolo de herramientas, no sandbox [R08]. Documentos, texto CAD, atributos, hojas ocultas y metadatos pueden inducir instrucciones; usar extracción sin ejecución, esquema validado y selección de herramientas por efecto. Ni «ignora instrucciones del documento» ni Skill bastan: una orden de escritura requiere precondiciones verificadas, revisión objetivo y permisos de servidor. No otorgar shell, file system irrestricto o red al lector de antecedentes.

Prevenir: path traversal/UNC/ADS/reparse points; ZIP bomb y DOCX externo; PDF malformado; macro/fórmula DDE/hipervínculo de planilla; XREF externo y recursos de ploteo; LISP/autoload en carpetas del proyecto; prompt injection que suplanta aprobador o pide envío de planos. Aprobar intención no exime de revisar diff ni contenido. Consentimiento para usar fuente, modificar copia, transferir datos y entregar son finalidades distintas.

Cloud Claude recibe el contenido que se le expone aunque MCP sea local. Reducir resultados a selección necesaria, redactar identificadores en diagnósticos, mostrar destino/finalidad antes de enviar y registrar política de retención. Cifrado de disco/ACL/backup protege archivos; usuario local comprometido y herramientas con el mismo privilegio quedan fuera de una garantía puramente Node. Para receipts fuertes, broker restringido y aislamiento de permisos; hasta demostrarlo, declarar el límite.

La calidad profesional es por operación y expediente: oráculo geométrico independiente, extracción nativa CAD real, recálculo Excel, revisión visual de planos y revisión constructiva. Un PDF bonito, CI verde o firma SHA-256 demuestran propiedades distintas. No usar una función que genera datos como único verificador de esos mismos datos.

## Referencias primarias verificadas

Todos los enlaces consultados el 17-11-2026; fechas de publicación solo donde la fuente las identifica. Las conclusiones de diseño son de Astra, no certificaciones de estos autores.

- R01 [Autodesk: interfaces 2026](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm) y [matriz 2027](https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-LT-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm).
- R02 [ActiveX y limitación externa LT](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-ActiveX/files/GUID-9C082B2D-015E-43C1-9168-623A2EA91D94.htm).
- R03 [Open 2027](https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-ActiveX-Reference/files/GUID-9ED7A548-7978-4BFD-8462-E2FA747E8880.htm).
- R04 [Import 2027](https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-ActiveX-Reference/files/GUID-5B441D77-BE99-454A-AAE3-9E19731B07D5.htm).
- R05 [.NET Database.DxfIn, 2026](https://help.autodesk.com/cloudhelp/2026/ENU/OARX-ManagedRefGuide/files/OARX-ManagedRefGuide-Autodesk_AutoCAD_DatabaseServices_Database_DxfIn_string_string.html).
- R06 [APS Automation](https://aps.autodesk.com/automation-apis) y [motor 2027](https://aps.autodesk.com/blog/end-autocad-2021-engine-new-autocad-2027-engine-released).
- R07 [Autodesk Product Help MCP: APS, 12-11-2026](https://aps.autodesk.com/blog/build-faster-aps-api-documentation-now-available-through-autodesk-product-help-mcp), [servicio read-only](https://aps.autodesk.com/blog/now-available-chatgpt-autodesk-product-help-plugin).
- R08 [MCP Security Best Practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices), [SDK capabilities](https://ts.sdk.modelcontextprotocol.io/capabilities).
- R09 [mcpb upstream](https://github.com/modelcontextprotocol/mcpb).
- R10 [Claude Code Skills](https://code.claude.com/docs/en/skills).
- R11 [OGUC vigente publicada por MINVU](https://www.minvu.gob.cl/elementos-tecnicos/decretos/d-s-n47-1992-ordenanza-general-de-urbanismo-y-construccione/), [LGUC junio 2026](https://www.minvu.gob.cl/wp-content/uploads/2020/05/Ley-General-Junio-2026-Ley-21.826-D.O.-24-06-2026_jcb-avc-21.10.2026vf.pdf).
- R12 [Dirección Arquitectura MOP: documentación técnica](https://arquitectura.mop.gob.cl/documentacion-tecnica/).
- R13 [DDU CIP](https://www.minvu.gob.cl/elementos-tecnicos/circulares-division-de-desarrollo-urbano-ddu/permisos-aprobaciones-y-recepciones-certificado-de-informaciones-previas/), [circulares derogadas](https://www.minvu.gob.cl/elementos-tecnicos/circulares-division-de-desarrollo-urbano-ddu/circulares-derogadas/).
- R14 [MINVU: Portal IPT y visores](https://centrodeestudios.minvu.gob.cl/planes-reguladores/).
- R15 [Forma Takeoff](https://construction.autodesk.com/tools/construction-takeoff-software/), [ejercicios técnicos 2D](https://help.autodesk.com/cloudhelp/ENU/Takeoff-Takeoff/files/Takeoff_2D_Sheets.html).
- R16 [Bluebeam Quantity Link](https://support.bluebeam.com/revu/how-to/tips-and-tricks/improve-takeoffs-with-quantity-link.html).
- R17 [Bluebeam Revu 21 prestaciones por plan](https://support.bluebeam.com/revu/subscription/subscription-features.html).
- R18 [ONDAC: formación oficial APU y presupuestos](https://ondac.com/certificacion-en-el-uso-de-software-presupuestos-de-obra-evolution/).
- R19 [Lean Construction Institute: Last Planner](https://leanconstruction.org/lean-topics/last-planner-system/).
- R20 [Procore: RFI y contrato](https://www.procore.com/library/rfi-construction).
- R21 [Porta048/AutoCad-MCP](https://github.com/Porta048/AutoCad-MCP), README blob `c9e13c28232e5836b0de221a4d79bca23157ac1b`, LICENSE blob `4cbf77b36bf352e9a951880155c34323ad12d7e0`.
- R22 [ACKaraca/AutoCAD_MCP](https://github.com/ACKaraca/AutoCAD_MCP), README blob `085ec2c18b6a6f1aed12a75ee3699c11b6dd0809`, LICENSE blob `4d9e96dc2158dda487d6ea5a5670c6c90f9d6651`.
- R23 [U-C4N/Autocad-MCP](https://github.com/U-C4N/Autocad-MCP), LICENSE blob `745aae3580c1da8f5bd5622e5a62881c0677c766`; README consultado v1.8, claims del autor no reproducidos.
- R24 [Microsoft: exportación Project desktop a Excel](https://support.microsoft.com/en-us/project/export-your-project-to-excel), [retiro Project Online](https://support.microsoft.com/en-us/project/export-your-project-online-project-to-microsoft-excel).
- R25 [Catálogo INN: NCh353:2018 y 2000](https://ecommerce.inn.cl/normas-chilenas?orderby=6&pagenumber=230&pagesize=9&viewmode=list).
- R26 [Catálogo INN: NCh1156:2018 y partes anteriores](https://ecommerce.inn.cl/normas-chilenas?pagenumber=22&pagesize=9).
- R27 [SEC normas eléctricas](https://www.sec.cl/normas-tecnicas-electricas/), [RIC18 proyectos](https://www.sec.cl/sitio-web/wp-content/uploads/2021/01/RIC-N18-Presentacion-de-Proyectos.pdf), [RIC19 puesta en servicio](https://www.sec.cl/sitio-web/wp-content/uploads/2021/06/RIC-N19-Puesta-en-Servicio-080621.pdf).
- R28 [INN FAQ: exigibilidad y copyright](https://www.inn.cl/faqs/).
- R29 [BCN Ley 21.719](https://www.bcn.cl/leychile/navegar?idNorma=1209272), [BCN balance y vigencia](https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13), [Ley 19.628](https://www.bcn.cl/leychile/Navegar?idNorma=141599&idParte=8642686).

## Resultado de la investigación antes del contraste

Seleccionar núcleo común de evidencia y métodos especializados de edificación primero. Priorizar edición localizada y cubicación de expediente existente sobre generación automática de diseños nuevos. Reutilizar COM con gates concretos; someter .NET a PoC comparativa. Diferir APS/BIM/plataforma colaborativa hasta que una demanda real justifique coste y permisos. Mantener planillas interoperables y evaluación humana retenida. Estas son propuestas de ingeniería, no ampliaciones autorizadas del alcance.
