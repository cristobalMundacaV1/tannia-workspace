---
name: tw-paquete-y-migracion
description: Construir el ZIP de instalación, verificarlo extraído y probar migración/reversión de proyectos.
---

# tw-paquete-y-migracion

> Skill de DESARROLLO (no se distribuye a la usuaria). Generado por scripts/gen-skills.mjs.

1. Construya desde checkout limpio: `npm ci && npm run rc:zip`.
2. Verifique `SHA256SUMS.txt` y `release-manifest.json` del ZIP extraído en otra ruta (con espacios y ñ).
3. Ejecute `node scripts/rc-verificar-zip.mjs <zip>`: instala en un perfil temporal, conecta por MCP al servidor extraído y corre un flujo de extremo a extremo.
4. Migración: un proyecto antiguo se respalda antes de actualizarse; `tannia_proyecto_migracion revertir` restaura bytes exactos.
5. Prohibido: auto-merge, release pública, borrar proyectos al desinstalar, convertir esquemas sin respaldo.
