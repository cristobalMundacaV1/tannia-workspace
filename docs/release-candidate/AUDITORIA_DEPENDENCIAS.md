# Clasificación de `npm audit` (2026-11-17)

`npm audit` informa 8 hallazgos (3 altos). **No se ejecutó `npm audit fix --force`**: propondría bajar `exceljs` a 3.4.0 (cambio mayor regresivo) y no corrige los demás.

| Paquete | Severidad | Ruta | ¿Va en el producto? | Exposición | Decisión |
|---|---|---|---|---|---|
| `uuid` 8.3.2 (vía `exceljs` 4.4.0) | moderada | producción | sí (bundle) | El aviso afecta a v3/v5/v6 cuando quien llama entrega un búfer. `exceljs` solo usa `v4()` (`lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`) | **No alcanzable**. Se vigila la versión de `exceljs` que actualice `uuid` |
| `exceljs` | moderada | producción | sí | solo por `uuid` | igual que la fila anterior |
| `tmp`, `external-editor`, `@inquirer/*` | alta / baja | desarrollo (`@anthropic-ai/mcpb` CLI) | **no** | Solo se usan al empaquetar el `.mcpb` en CI o en la máquina de desarrollo; no hay entrada de terceros | Aceptado en desarrollo; actualizar cuando `@anthropic-ai/mcpb` publique una versión corregida |
| `zod` 3.x (vía `@anthropic-ai/mcpb`) | alta | desarrollo | **no** (el producto usa `zod` 4.6.7) | CLI de empaquetado | Igual que la fila anterior |

Verificación: `npm audit --omit=dev` informa solo los 2 moderados de `exceljs`/`uuid`. El servidor distribuido no incluye `tmp`, `@inquirer` ni `zod` 3.
