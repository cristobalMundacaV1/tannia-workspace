# Protocolo AutoCAD real (NO ejecutado)
Objetivo: comprobar con AutoCAD real lo que en CI solo se probó con DXF releídos por lectores independientes (repositorio y ezdxf) y con ejecutores COM simulados. Archivos de ejemplo: ZIP `ejemplos/gv1_tunel` (DXF del túnel) y los DXF/DWG que genere en las pruebas D de Claude Desktop (canal, departamento). **Trabaje siempre sobre copias.** Anote versión exacta de AutoCAD, Windows, rutas (con espacios/ñ) y OneDrive.
| # | Prueba | Esperado | Registrar |
|---|---|---|---|
| K1 | «Dime el estado de AutoCAD» (`tannia_cad_estado`, `tannia_cad_capacidades`) | Detecta la instalación y si está abierta; matriz de capacidades honesta | texto exacto |
| K2 | Abrir `tunel_oc2.dxf` en AutoCAD (doble clic) | Abre sin errores; unidades en metros; capas EJE, PROGRESIVAS, SECCION, INTERIOR, RASANTE, TERRENO, TEXTO | captura de capas |
| K3 | Ejecutar `AUDIT` (corregir = No) | 0 errores | resultado |
| K4 | Medir con `LIST`/`AREA`: las 3 secciones (capa SECCION) y el eje | Áreas ≈ 62,2148 m² (excavada) y 54,3086 m² (interior); largo del eje ≈ 504,7198 m (comparar con memoria/claims; tolerancia 1e-4) | valores AutoCAD vs memoria |
| K5 | Verificar el perfil: exageración vertical ×10 declarada en el texto; cotas de rasante en las progresivas | Coincide con la memoria | captura |
| K6 | «Abre una copia del DXF en AutoCAD y guárdala como DWG» (`tannia_cad_abrir_copia`, `tannia_cad_verificar_persistencia`) | DWG creado; verificación **global** de persistencia con conteo de entidades igual al DXF; el original intacto (hash) | conteos y hashes |
| K7 | Departamento: generar con `crear_3d` y enviar el modelo 3D a AutoCAD (`tannia_3d_a_autocad`, `tannia_3d_inspeccionar`) | Sólidos creados; cantidad y volumen (`MASSPROP`) ≈ claims de losas/muros; coherencia 2D–3D verificada | conteos/volúmenes |
| K8 | Departamento 2D: abrir el DXF: ventanas solo sobre muros de fachada; puerta de acceso sobre el muro de núcleo; terraza con baranda; ninguna capa de jardín/piscina | Se cumple visualmente | captura |
| K9 | Cerrar AutoCAD y pedir «guarda el DWG» | Error claro y real (AutoCAD no abierto/no responde); sin reintentos que dupliquen; el DXF sigue disponible | mensaje exacto |
| K10 | Abrir el DWG generado en otra máquina/versión si es posible | Abre; anote advertencias | resultado |
| K11 | Ruta con espacios, ñ y carpeta sincronizada con OneDrive | Sin errores de ruta ni archivos bloqueados | resultado |
| K12 | Repetir K6 con un DWG ya abierto por otro usuario/proceso | Falla de forma segura, sin pérdida de datos | mensaje |
**No concluir:** una prueba fallida se registra tal cual; no se reintenta con otros parámetros hasta que el equipo la analice.
