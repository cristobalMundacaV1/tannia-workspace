# DIRECTIVA EJECUTABLE — TANNIA WORKSPACE, CIERRE DEL MOTOR DE PLANOS

**Rol:** Principal Drawing Engine Implementer (no revisor independiente). **Repositorio:** `cristobalMundacaV1/tannia-workspace`. **Base inmutable inicial:** PR #37, SHA `1c8849084eb99f436f74bfbf9d2b511a06a43ead`, salvo que al empezar se constate y registre una cabeza posterior. **Autoridad de aceptación:** PO. Prohibidos merge/release/instalación sin autorización.

## Objetivo

Transformar el motor geométrico existente en un generador de documentos gráficos técnicos verificables, con simbología, tramas, áreas, leyendas, tablas, referencias, detalles D1–D4 y composición PDF/DXF homogéneas. Cerrar el problema real de `PLANOS-COMPLETOS.dxf` que se abrió aparentemente vacío en AutoCAD. Entregar un **ZIP nuevo y único apto para UAT controlada**, con CI verde, sin afirmar validación profesional ni AutoCAD real si no se ejecutó.

## Fuentes obligatorias

Lee íntegramente `01_AUDITORIA_Y_DISENO.md` y `03_MATRIZ_GATES.csv`, además de `AGENTS.md`, `CLAUDE.md` y módulos `src/drawing/{model,pdf,dxf,especificacion,service,dxf_verificar,layouts_check}.js`. Usa como fixture real el expediente de UAT con su DXF de 74.505 bytes (SHA-256 `dd971a870fe2065757a2d5f251f2d139f913afdaef2dedb70112755747d41005`) y la referencia gráfica de Tannia. Si no tienes el ZIP/capturas, **pídelos como insumo de UAT**, pero no inventes su contenido. No reimplementes proyectos/cubicaciones/autorizaciones ya validados.

## Priorización estricta

1. **P0 CAD:** primero falla del DXF aparentemente vacío; autorizar hipótesis y tests diferenciales, corregir inicialización Model/Layout/VPORT/extents y comprobar con parser independiente. Establecer la prueba real de AutoCAD 2027 como gate externo; si falta el programa, estado NO EJECUTADO y seguir con ingeniería automatizable.
2. **IR v2 y contratos:** modelo intermedio único + registro de estilos/símbolos, compatibilidad con `tw.drawing/1`, trazabilidad sin doble medición.
3. **Representación:** HATCH/regiones cerradas y materialidad con origen; leyenda de símbolos usados (muestras reales), tablas tipadas calculadas, llamadas con referencias válidas y detalles constructivos D1–D4 **solo con información documentada**.
4. **Compositor:** paneles flexibles de página, tipografía legible, escalas exactas, papel A3/A2/A1, sin superposiciones, sin densidad artificial ni recortes; si falta espacio, redistribuye/separa hojas sin reducir escala encubiertamente.
5. **Paridad:** PDF y DXF deben compartir el mismo IR. Oráculo por entidad, fuente, estilo, trama, tabla, cotas y referencias; ensayos PDF rasterizado y DXF reabierto, no solo conteo de objetos.
6. **Corpus:** túnel (sección/fortificación + D1–D4) y edificación (muro + vano), idéntica revisión entre planos→cantidades→partidas; A→B→A y mutaciones adversariales.
7. **Cierre y ZIP:** CI Ubuntu/Windows, paso 5b/5c intactos, nuevos gates 5d/5e; versión nueva libre (no repetir rc.4 ni nombre usado), SHA limpio, checksum, paquete instalado y guía de prueba **sin Claude**. PR draft y reporte de limitaciones.

## Invariantes de seguridad y producto

- Ningún dato material/geotécnico/normativo se inventa, aunque figure en la referencia visual. Elementos pendientes no se convierten en soluciones aprobadas.
- AutoCAD de la persona no se abre en modo automático ni se modifica un dibujo personal. Nada de COM sin aprobación concreta de cada cambio.
- Geometría se mide una sola vez, aunque se repita en varios detalles. Las entidades de trama/leyenda son **representaciones no medibles**.
- No se mezclan fuentes/revisiones; cualquier cambio invalida cantidades/entregas derivadas.
- El DXF no se certifica por `ezdxf.audit` o un render PDF aislado. Exigir paso AutoCAD real antes de declarar el modo CAD aprobado.
- No alterar el código de otras ramas o `main`; crear rama/PR propio apilado, documentar diferencia de base. Revisión independiente posterior.

## Condiciones de salida

Un PR borrador con implementaciones, pruebas negativas primero-falla/luego-pasa, dos corpus de salida, montajes visuales, diagnóstico de DXF, CI Windows y Ubuntu 100% verde sobre un SHA, gates de ZIP instalado, nombre único + SHA256 y protocolo UAT AutoCAD, estado honesto de lo no ejecutado. No autodeclarar profesionalmente válido el producto por pasar CI. Si falta tiempo, publicar checkpoint verificable y no crear un ZIP que parezca definitivo.