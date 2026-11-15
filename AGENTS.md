# Instrucciones para agentes — Tannia Workspace

## Misión
Construir un asistente práctico y confiable para una usuaria de AutoCAD 2D con experiencia de «abrir y trabajar»: planos, cubicaciones, presupuestos, informes y consulta de normativa chilena desde Claude.

## Autoridad y flujo
- El Product Owner decide el alcance, aceptación, merges y distribución.
- Trabajar en ramas de función y PR; no autoaprobar gates, mergear ni publicar instaladores.
- Verificar estado real de GitHub, documentación y pruebas antes de modificar.
- No crear complejidad no solicitada (BIM/IFC, SaaS, Docker, frontend propio).
- La usuaria final no debe usar consola, editar JSON, Git ni instalar dependencias manualmente.

## Invariantes
1. Originales intactos; guardar resultados versionados en copias.
2. Cifras trazables a geometría/documentos/partidas y unidades identificadas.
3. No inventar medidas, alturas, materiales, precios o conformidad normativa.
4. Restringir lectura/escritura a proyecto explícitamente autorizado.
5. No introducir, ejecutar ni distribuir MCP de terceros sin análisis de licencia y seguridad y versión fija.
6. Evaluar privacidad: Claude es servicio remoto aunque el MCP funcione en el equipo.
7. Informar límites y errores con lenguaje no técnico, ofreciendo recuperación.
8. Tests y evidencias reproducibles para cada gate; documentar todo lo no validado.

## Desarrollo prioritario
Ver `docs/ROADMAP.md`. Empezar con mediciones DXF sintéticas y exportación verificable, sin AutoCAD local del desarrollador. Prueba de DWG real queda para el PC de Tannia.

## Comunicación con Product Owner
Entregar decisiones concretas, un paso siguiente cada vez y distinguir «implementado», «probado» y «pendiente». Evitar abrumar con múltiples instrucciones simultáneas.
