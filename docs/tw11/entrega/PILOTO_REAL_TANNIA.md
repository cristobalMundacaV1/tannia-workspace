# Piloto real de Tannia Workspace — plan (preparado, NO iniciado)
**Estado:** listo para ejecutar cuando la PO lo autorice. No se ha realizado ninguna prueba con Tannia, Claude Desktop ni AutoCAD reales. Este documento no aprueba nada: los gates G10–G12 siguen pendientes.
## 1. Objetivo
Medir con trabajo real (académico y profesional liviano) si el candidato CIC **ayuda sin dañar**: resultados correctos y trazables, respuestas breves y útiles, ningún dato inventado, archivos protegidos y una instalación que Tannia pueda usar sin terminal.
## 2. Alcance y reglas de seguridad (obligatorias)
- **Candidato:** el ZIP vigente de `PROTOCOLO_CAMPO_TW11.md` (paquete CIC activado; el paquete «CIC apagado» queda como vuelta atrás). No instalar ambos a la vez.
- **Datos:** el piloto usa **copias**; no se tocan «Prueba TW10 Los Robles», «Prueba TW10 rc2» ni proyectos profesionales con valor legal. Originales siempre en `02 Originales` (protegidos).
- **Nada profesional se entrega como válido** sin revisión de una persona competente: el piloto no sustituye ninguna revisión ni firma.
- **Información privada:** no pegar datos de clientes en búsquedas externas; las fuentes investigadas entran solo como candidatas y las aprueba Tannia (ventana del cliente, diálogo del sistema o archivo en la carpeta de configuración).
- **Parada inmediata** si ocurre: pérdida o modificación de un original; un valor inventado presentado como verificado; una aprobación obtenida sin intervención de Tannia; un fallo de seguridad. Se detiene el piloto y se reporta.
## 3. Participantes y roles
Tannia (usuaria), PO (decide y observa), revisor independiente (si ya fue designado), soporte técnico (recibe diagnósticos; no interviene en el contenido).
## 4. Preparación (antes del día 1)
1. Ejecutar `PROTOCOLO_CAMPO_TW11.md` §S, D y K en el equipo de Tannia **o** declarar qué parte se omite y por qué. Registrar en `REGISTRO_PRUEBAS_CAMPO.md`.
2. Instalar el paquete CIC activado (`INSTALACION_1_PAGINA.md`), ejecutar «diagnóstico» y guardar la captura (versión del paquete, 84 herramientas).
3. Fijar la preferencia de respuesta con Tannia (por defecto **breve**; confirmar que entiende «responde más cortito / explícame paso a paso»).
4. Respaldar la carpeta de Tannia Workspace (copia comprimida) antes de empezar.
## 5. Estructura (propuesta: 2 semanas, 6 sesiones de 60–90 min)
| Sesión | Foco | Tareas reales | Qué se observa |
|---|---|---|---|
| 1 | Primer contacto y seguridad | Diagnóstico; importar un plano propio (copia); cubicar; pedir resumen breve y luego detallado | instalación sin terminal, respuestas breves, protección de originales |
| 2 | Académico (túnel/obra del curso) | Cargar apuntes y enunciado; plan; cálculos; planta/perfil/secciones; memoria | citas con fuente, brechas honestas, ayuda sin suplantar autoría |
| 3 | Profesional liviano (cantidades→presupuesto→programa) | Cadena completa con precios y rendimientos **aportados**; cambiar un dato y recalcular | sin precios inventados, aviso de resultados desactualizados |
| 4 | Edificación (departamento/oficina/casa) | Unidad con condiciones de borde; contraste casa vs departamento | geometría coherente, supuestos declarados |
| 5 | AutoCAD real | `PROTOCOLO_AUTOCAD_REAL.md` K1–K12 con sus archivos | DXF/DWG coinciden con la memoria; errores reales claros |
| 6 | Cierre | Tareas libres de Tannia; revisión de hallazgos; encuesta | utilidad, confianza, qué faltó |
## 6. Instrumentos de registro
`REGISTRO_PRUEBAS_CAMPO.md` por sesión; capturas; diagnóstico al inicio y ante cualquier error; hoja de hallazgos (id, severidad P1/P2/P3, pasos para reproducir, texto exacto, archivos). Tiempo por tarea y número de correcciones que Tannia debió pedir.
## 7. Medidas de éxito (a decidir con la PO antes de empezar)
- **Seguridad (obligatorio):** 0 incidentes de parada inmediata.
- **Exactitud:** 100 % de las cifras entregadas coinciden con el cálculo manual de Tannia/revisor en ≥ 10 verificaciones; 0 valores críticos inventados.
- **Trazabilidad:** cada resultado técnico con fuente/claim; informes sin cifras sin respaldo.
- **Comunicación:** ≥ 90 % de respuestas habituales entre 30 y 100 palabras en modo breve; cero narración de herramientas; advertencias críticas siempre presentes.
- **Utilidad (rúbrica 0–5, Tannia y revisor):** media ≥ 3,8; ningún caso < 3,0.
- **Instalación/uso sin terminal:** Tannia completa sus tareas sin ayuda técnica en ≥ 80 % de las sesiones.
- **Catálogo (D7):** sin degradación observable en la elección de herramientas (anotar casos donde Claude eligió mal).
## 8. Criterios de decisión al cierre
Cuatro resultados posibles, decididos por la PO: (1) continuar con más proyectos; (2) corregir hallazgos y repetir sesiones; (3) volver al paquete «CIC apagado»; (4) detener. El piloto **no** equivale a G10 (evaluación retenida independiente) ni a aprobación profesional.
## 9. Soporte y vuelta atrás
Contacto de soporte acordado; ante cualquier fallo: guardar texto exacto + diagnóstico y **no reintentar** repetidamente una escritura que falló. Vuelta atrás: desinstalar la extensión CIC e instalar el paquete «CIC apagado» (los proyectos y archivos no se tocan) o restaurar el respaldo del paso 4.
## 10. Pendientes antes de autorizar
Designación del revisor independiente; decisión sobre D7; ejecución previa de S/D/K o su omisión justificada; consentimiento de Tannia por escrito para registrar capturas y datos de uso.
