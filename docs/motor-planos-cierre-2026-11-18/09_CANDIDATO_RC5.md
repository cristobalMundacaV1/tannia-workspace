# Candidato 0.3.0-rc.5 — registro de CI y ZIP

**Estado: RETIRADO. G11 FALLIDO en AutoCAD 2027 real** (PR #39, comentario del PO: «Error en la tabla DIMSTYLE / eHandleInUse / dibujo descartado»). Causa: handle de DIMSTYLE en código 5 en vez de 105 (`dxf_doc.js`, el 105 se pasaba a `.map()` y no a `rec()`). Corregido en 0.3.0-rc.6. No reutilizar rc.5.

~~Estado anterior: CANDIDATO PARA UAT CONTROLADA.~~ **No** aceptado profesionalmente. AutoCAD 2027 real (G11) y revisión profesional (G12): **NO VERIFICADOS**.

| Dato | Valor |
|---|---|
| Versión | `0.3.0-rc.5` |
| Commit del candidato | `06e997009a0ce1667859ee926b75f02987f0ec72` |
| Ejecución CI | https://github.com/cristobalMundacaV1/tannia-workspace/actions/runs/44354289528 (run 235) |
| ZIP | `Tannia-Workspace-0.3.0-rc.5-windows-x64.zip` (artefacto `tannia-workspace-zip-instalacion`) |
| SHA-256 del ZIP | `6610ad6cf9d07485a3e47ce46af57be37be53a38cee884d5374512fbd37db6b3` (igual en Ubuntu y Windows) |

## Jobs (mismo SHA)
| Job | Resultado |
|---|---|
| test (ubuntu-latest), ezdxf obligatorio | ✔ |
| test (windows-latest), ezdxf obligatorio | ✔ |
| gui-windows (WPF + no interferencia CAD-BG-02) | ✔ |
| rc-zip (construcción + verificador del ZIP en Ubuntu) | ✔ |
| rc-zip-windows (verificador del ZIP instalado + instalador) | ✔ pasos 1–11, 5b, 5c, **5d**, **5e** (incluye `--planos-prueba` sin Claude idéntico byte a byte al juego de referencia) |

## Incidencia registrada
`BG-R01` falló una vez en `test (windows-latest)` sobre `adc2e15` (reconversión DWG en «FALLÓ»), sin causa visible en el log. El código de producto no cambió entre `211457a` (verde), `adc2e15` (rojo) y `06e9970` (verde). Se añadió diagnóstico del paso a la aserción. **Causa raíz DETERMINADA** (CI 1fba032, con el diagnóstico añadido): `EPERM` en el `rename` atómico del registro del trabajo (`…json.<pid>.tmp` → `…json`) mientras otro proceso lo leía. Corregido en rc.6 con `renombrarConReintento` (EPERM/EACCES/EBUSY, máx. ~1,5 s; persistentes y otros errores se propagan) y prueba `store_renombrar`. Se mantiene como riesgo residual y no se modificó ni se omitió la prueba.

## Pendiente humano
1. UAT AutoCAD 2027: `documentos/UAT-PLANOS-AUTOCAD-2027.md` del ZIP (registro A–H).
2. Revisión visual y aprobación de las firmas golden.
3. Revisión profesional de los planos (siguen como «BORRADOR PARA REVISIÓN»).
4. Decisión del PO sobre merge, release e instalación.
