# ADR-TW10-001 — Dependencias, licencias y modo sin red

**Estado:** aceptado por el implementador para G0–G9; revisión del PO pendiente. **Fecha:** 2026-11-16.

| Tema | Decisión | Razón / verificación |
|---|---|---|
| Posición solar | **Implementación propia en Node** (Meeus/NOAA + refracción estándar), sin dependencia nueva. | Error máx. medido vs. oráculo NREL SPA: azimut 0,024°, elevación 0,006° en 149 casos (7 lugares, 4 fechas, ambos hemisferios). Test `test/tw10_g3_solar.test.js`. |
| Oráculo | `pvlib` (BSD-3-Clause) `spa_python` **solo en desarrollo** para generar `fixtures/tw10/solar_oracle.json`. Reproduce el ejemplo publicado de NREL SPA (zenit 50,11162°, azimut 194,34024°). | No se empaqueta ni se ejecuta en producción: **sin runtime Python en el `.mcpb`**. |
| Zona horaria | `Intl.DateTimeFormat` (IANA, incluido en Node 22). Sin librería. | DST de Chile probado (UTC−3 dic / UTC−4 jun; hora inexistente rechazada). |
| Clima | **EPW** importado por parser propio (texto CSV; datos tratados como datos). **Open-Meteo/ERA5: no implementado como dependencia**; solo se define el esquema `open_meteo_era5` y una caché local importable. Ninguna llamada de red del servidor. | Sin red el producto funciona; términos/atribución de Open-Meteo requieren decisión del PO antes de habilitar consultas. |
| Ladybug/Honeybee/Radiance/EnergyPlus/Forma/Rhino | **No incluidos.** | AGPL-3.0 (ladybug-core) y dependencias nativas; sin ADR de empaquetado Windows no entran. |
| Geometría de polígonos | Implementación propia (ortogonal, enteros en mm) reutilizando `rectangulosDePoligono` del motor 3D. | Sin dependencias nuevas; pruebas de propiedades (G10). |
| Fuentes de documentos (CIP/EPW) | Siempre como **datos**; nunca se ejecuta ni se obedece su contenido. | Escenario 15. |

Consecuencia: `package.json` no cambia sus dependencias de producción.
