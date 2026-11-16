# TW-10 — Limitaciones conocidas (honestas)
- **No es un arquitecto habilitado.** Es una metodología computable de diseño asistido; salidas = ANTEPROYECTO conceptual, no apto para construcción, tramitación ni cálculo.
- **No verificado en AutoCAD real, Claude Desktop real ni por Tannia/arquitecta independiente** (ver `TW10_FIELD_VALIDATION.md`).
- Recintos rectangulares; huellas L/C/patio por unión de rectángulos. Sin recintos en L, sin muros inclinados, sin curvas. Predio ortogonal.
- Cubierta: solo **plana** sobre huella L/C/patio; la inclinada se rechaza explícitamente.
- Partidos generados: compacta, L con patio, dos alas (C). **Patio central**: la geometría está soportada y probada, pero no hay generador. 1 piso; 1–5 dormitorios, 1–2 baños, 45–260 m². Con superficies pequeñas, el partido entrega su mínimo con aviso (p. ej. «dos alas» ≥ ~104 m² para 3 dorm./2 baños).
- La **posición de la piscina** es un supuesto (centro del patio); no hay geometría de piscina ni verificación de barreras. La visual **nunca** equivale a seguridad.
- **Sol**: sol directo geométrico (ray casting, posición solar propia contrastada con NREL SPA: err. máx. 0,024° azimut / 0,006° elevación). No es iluminancia, deslumbramiento, ganancia térmica ni energía. Requiere norte verdadero, coordenadas y zona horaria **confirmados**; sin ellos `no concluyente`.
- **Viento**: rosa **regional** (EPW o caché ERA5); sin CFD; no estima velocidad en el patio ni ventilación real. Open-Meteo: solo caché local importable; **no hay consultas de red** (términos/plan comercial por decidir por el PO).
- Sombra de contexto: con altura de vecino/árbol desconocida, `no concluyente`.
- **Normativa**: ningún valor normativo se infiere ni se declara «cumple». Las restricciones urbanísticas solo entran con documento fuente + fecha; el servidor no extrae datos de CIP (sin OCR).
- **Precios**: no se estiman; índices de envolvente son relativos.
- Interpretación del encargo: reglas léxicas en español (no un modelo de lenguaje); frases fuera de ellas quedan como `desconocido`/pregunta. Claude Desktop conversa; el código valida.
- Privacidad/acústica/accesibilidad: heurísticas editables (`heur-1`), no normativas.
- Dependencias: sin runtime Python en el paquete; pvlib solo como oráculo de desarrollo (fixture `fixtures/tw10/solar_oracle.json`).
- Heredadas de TW-09: ver `docs/KNOWN_LIMITATIONS.md` (AutoCAD COM, ACL/junctions reales, OneDrive/antivirus sin validar).

## Qué NO se ha verificado nunca (hasta que se ejecute G10)
AutoCAD 2027 real (ningún DWG ha sido abierto por AutoCAD real con este código TW-10), instalación gráfica en Claude Desktop, uso por Tannia, revisión arquitectónica independiente. El CI ejecuta simuladores COM y, en Windows, pruebas de PowerShell sin AutoCAD.

## Cambios y límites tras la auditoría de campo (rc2)
- La interpretación del encargo sigue siendo léxica: frases fuera de sus reglas quedan «desconocidas»; las referencias visuales ambiguas generan una **pregunta**. «Ver a mis hijos desde la cocina» sin decir dónde juegan **no** crea la visual.
- «Actualizar» solo elimina un requisito con un retiro explícito reconocido («ya no quiero…», «quita…», «olvida…»); cambios relativos («un dormitorio más») se preguntan.
- Cambios de contrato: `tannia_arq_evaluar` (resumen por defecto; `seccion:'completo'` = contrato anterior), `tannia_arq_ver` (brief compacto; `brief_completo`), `tannia_arq_encargo` (`modo`).
- El índice 0–1 de cada objetivo es geométrico/heurístico; **no** es satisfacción ni calidad.

## Cambios y límites tras la prueba real rc2 (rc3)
- La interpretación por cláusulas sigue siendo léxica (español): frases fuera de sus reglas quedan sin interpretar; las instrucciones al asistente («no inventes…», «dime…») y los datos desconocidos se registran como **notas**, nunca como preferencias.
- **La visual es geométrica y preliminar** salvo que la usuaria confirme un punto de observación; **no modela mobiliario ni encimeras** y no acredita supervisión ni seguridad de la piscina.
- **Alternativas:** por defecto se generan 4 partidos (compacta, L con patio, dos alas, lineal). A 90 m² con 3 dormitorios y 2 baños son **elegibles 3** (dos alas ≥104 m²). Con otras superficies/terrenos pueden ser menos; el sistema lo dice y **no rebaja requisitos**. El patio central **no** está implementado (solo su geometría).
- La lineal supone un **jardín posterior continuo** (zona exterior fuera de la huella) y un terreno largo; la piscina sigue siendo un supuesto de ubicación.
- El diagnóstico lee la identidad del paquete del `manifest.json` instalado; desde el código fuente no hay paquete.
