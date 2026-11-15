# Manual de Tannia Workspace — 1 página

Trabaja desde **Claude Desktop** escribiendo en español. Sus planos originales **nunca se modifican**.

## Primera vez
1. Instale la extensión (ver `INSTALACION.md`) y pida: **«Haz un diagnóstico de Tannia Workspace»**.
2. Pida: **«Crea un proyecto llamado Casa Peñalolén»**. Se crea la carpeta `Documentos\Tannia Workspace\Proyectos\Casa Peñalolén` con subcarpetas ordenadas.
3. Copie sus planos (DXF/PDF/DWG) en **`02 Originales`** (con el Explorador de Windows) y pida: **«Registra los originales del proyecto»**.

## 6 cosas que puede pedir
1. **«Inspecciona el plano plano.dxf: ¿qué capas y entidades tiene?»** — resumen de solo lectura.
2. **«Mide el plano.dxf; las unidades son metros»** — longitudes, perímetros, áreas por capa. *Claude le preguntará la unidad: confírmela usted, no el archivo.*
3. **«Cubica la capa LOSA como losa de 10 cm de espesor»** — crea una *partida* con fórmula y origen. Claude **no** supone espesores ni alturas: se los preguntará.
4. **«Arma el presupuesto con este APU…»** — Excel con fórmulas editables. Los precios los entrega usted (con fuente y fecha); los que falten quedan **PENDIENTE**.
5. **«Genera la memoria de cálculo en PDF»** — con trazabilidad, supuestos y advertencias.
6. **«¿Dónde consulto la normativa sobre altura de edificación?»** — le indica las fuentes oficiales (no certifica cumplimiento).

Para planos **PDF**: «Inspecciona planta.pdf», «Calibra la página 1 con esta cota de 5 m» y «mide ese recinto». **3D**: «¿Qué capacidades 3D tienes?» (ver `AUTOCAD_COMPATIBILITY.md`).

## Diseñar una casa
Pide un resultado, no líneas: «Diseña una casa de un piso de ~80 m², 3 dormitorios, 2 baños, living-comedor y cocina americana». Se genera un **anteproyecto editable** (DXF/SVG) que refinas conversando y puedes guardar como DWG. Ver `DISENAR_UNA_CASA.md`. Siempre es un anteproyecto, **no apto para construcción**.

## Cómo leer los resultados
- **needs_review**: hay algo dudoso (unidad, geometría abierta, duplicados…). No use esa cifra como final sin revisar.
- **BORRADOR / PENDIENTE**: faltan precios o usted no ha verificado las cantidades.
- Solo usted puede marcar una cantidad como **verificada** y **aprobar** el proyecto; Claude debe pedirle confirmación.

## Dónde quedan sus archivos
`03 Trabajo` (copias) · `04 Cubicaciones` · `05 Presupuestos` (Excel) · `06 Informes` (PDF) · `07 Entregables` (solo tras aprobar).

## Si algo no funciona
«Haz un diagnóstico» · «Repara el proyecto <nombre>» · ver `INSTALACION.md`. Los resultados son **apoyo profesional**: revise cantidades, precios y normativa antes de entregar.
