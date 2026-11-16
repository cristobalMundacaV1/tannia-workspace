# Prueba real TW-09 (Claude Desktop + AutoCAD 2027) — NO EJECUTADA

Estado de todo lo de este documento: **NO VERIFICADO** hasta que la ejecutes. Instala el `.mcpb` del instalador (quita antes los paquetes anteriores `modelo3d` y `dwgfix`), reinicia Claude Desktop y pega `PRUEBA_REAL_TW09_MENSAJE.txt` en una conversación NUEVA.

Registra por cada bloque: ✅ / ❌ / NO CONCLUYENTE y el JSON exacto de cualquier error:
1. Herramientas visibles (≈61) y ninguna excluida por esquema.
2. Proyecto creado y antecedentes: ¿Claude Desktop entrega la ruta del adjunto al servidor? (si no, el producto debe decirlo y pedir una ruta).
3. 2D → 3D → DWG 3D: `verificacion_solidos` y `verificacion_estructura`.
4. `tannia_cad_verificar_persistencia` sin handles: `verificacion_global` (conteos de 5 fuentes) y el campo `reapertura` (`conteo_inicial_tras_abrir`, `espera_ms`) — **si vuelve a salir 0 tras reabrir, es el dato que falta para la causa real**.
5. A ojo: capas `TW3D_*`, sólidos 3D reales, vanos abiertos, isométrica, cubierta oculta/visible y `AUDIT` sin errores.
6. Continuidad: cierra la conversación, abre otra y pide «la casa de ayer».
7. Cambio de altura a 2,6 m: la coherencia debe decir `con_observaciones` (faceta alturas) y no «coherente».
8. Originales: con un DWG real en `02 Originales`, antes/después SHA-256 iguales.
