# Tannia Workspace — diseño arquitectónico asistido (una página)
**Instalar:** doble clic en el archivo `.mcpb` → Claude Desktop → *Instalar*. Reinicie Claude si se lo pide. No necesita consola.
**Usar:** hable con Claude como con una colega. Ejemplo: «Quiero una casa de 90 m² en L con patio, 3 dormitorios y 2 baños; veo a mis hijos desde la cocina; living luminoso pero fresco en verano».
1. Claude entiende el encargo y le hace **una** pregunta esencial si falta (p. ej. los m²).
2. Le muestra **tres ideas distintas** (compacta, en L, dos alas) con sus compromisos, un croquis comparativo y alertas.
3. Si tiene terreno: dé medidas, por dónde se entra, **norte verdadero**, ciudad y zona horaria. Recién ahí se estudian sol y sombras (junio/diciembre) y aleros. Con un archivo de clima `.epw` en el proyecto, se considera el viento *regional*.
4. Pida cambios en palabras («menos sol de tarde en el living», «alero de 60 cm»): se crea una **versión nueva**; las anteriores no se tocan.
5. Elija una alternativa y pida **publicarla**: se guardan DXF, SVG, informe y modelo 3D en `03 Trabajo/Arquitectura`. Para AutoCAD: «llévala a AutoCAD en 3D».
**Importante:** son **anteproyectos**, no planos de construcción. Las normas, la estructura, las instalaciones y la seguridad de una piscina (barreras y supervisión) las define su profesional. Si algo no se sabe, Claude dice «no sé» y qué dato falta.
**Dónde queda todo:** su carpeta de Tannia Workspace → proyecto → `03 Trabajo`. Los originales nunca se modifican.
