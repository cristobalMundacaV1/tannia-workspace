# TW-10 — Cómo ejecutar la macrofase completa sin cortar en G1

Este paquete reemplaza **la directiva de ejecución** anterior; conserva intactos los contratos arquitectónicos y las 45 historias. **No equivale a haber instalado o ejecutado código en tu computador.**

## Modo recomendado: Claude Code Desktop o terminal, interactivo/Auto

1. Extraer el ZIP en una carpeta temporal. Dentro del repositorio `tannia-workspace`, el implementador debe crear un worktree TW-10 aislado apilado sobre el SHA **verificado** del PR #11. No se debe abrir PR sobre `main` directamente ni modificar la rama TW-09.
2. Copiar estos **seis archivos** al worktree en `docs/tw10/`: los tres documentos base, la directiva v2, el prompt v2 y el `TW10_STATE_TEMPLATE.json`. El prompt de ejecución v1 queda como antecedente histórico, no como directiva operativa vigente.
3. Pegar **completo** `TW10_PROMPT_EJECUCION_AUTONOMA_E2E_V2.md` en la sesión de Claude Code. Activar el modo Auto desde las opciones de la aplicación cuando esté disponible, dentro del worktree correcto. Dejar el modo de permisos protegido. No habilitar bypassPermissions.
4. El implementador debe avanzar consecutivamente G0–G9 y el G10 automatizable, enviar commits/PR draft con logs y reanudar sesiones mediante `TW10_STATE.json` y `TW10_HANDOFF.md`. Al terminar una ventana de contexto, no pedir otra vez el alcance.
5. La validación final en AutoCAD 2027 y con Tannia/arquitecta/o independiente requiere intervención externa. **El PR no se cierra por ello** y nunca se declara aceptado sin evidencia de G10 + PO.

## Modo opcional: runner local resumible en PowerShell

El script `TW10_RUNNER_RESUMIBLE.ps1` permite ejecutar llamadas sucesivas a `claude -p`, apoyándose en el estado de disco. Está pensado **solo para una máquina de desarrollo autorizada** con Claude Code CLI instalado, `git` y un worktree preparado. No es un servicio ni corre cuando el script termina o el computador se apaga. Consume la cuota o API de Claude Code durante cada ciclo. Un ciclo puede terminar por política de seguridad, permisos, contexto o error; el estado queda para reanudar.

Preparación inicial sugerida (ajustar las rutas a tu clon):

```powershell
# Clon principal (no debe tener cambios sin resolver en ramas de otros agentes)
cd 'C:\ruta\a\tannia-workspace'
git fetch origin
# Solo cuando la rama y el worktree todavía no existan:
git worktree add '..\tannia-workspace-tw10' -b feat/tw10-architectural-reasoning origin/feat/tw09-autonomia

# Dentro del worktree nuevo:
cd '..\tannia-workspace-tw10'
New-Item -ItemType Directory -Force 'docs\tw10' | Out-Null
# Copiar a docs\tw10 los documentos requeridos del ZIP.
# Verificar que todos existan antes de comenzar.
```

Con los archivos en `docs/tw10`:

```powershell
# Sustituir la ruta por la ubicación REAL del archivo descargado.
& 'C:\ruta\al\TW10_RUNNER_RESUMIBLE.ps1' -Worktree (Get-Location).Path -MaxCycles 25
```

El runner verifica rama, fuentes, estado y detiene ciclos si no hay progreso observable. Usará `--permission-mode auto --permission-prompts none`, **no** `--dangerously-skip-permissions`. Si el entorno bloquea una herramienta, hay que autorizarla de forma segura en la configuración de Claude Code o ejecutar la parte puntual manualmente; el runner no intenta eludir controles.

Para reanudar tras un corte, ejecutar nuevamente el mismo comando. Los logs locales quedan en `.agent-runs/tw10` (añadirlo al `.gitignore` si no está). No contienen la evidencia oficial: el agente debe publicar los logs de QA sanitizados en el PR y actualizar `TW10_STATE.json`/handoff.

### Límites honestos

- **No hay garantía de trabajo infinito o ininterrumpido:** la sesión/computador, permisos, costo y límites de servicio existen. Lo que sí queda diseñado es la **continuidad recuperable de la macrofase**, sin declararla terminada artificialmente.
- El runner **no valida por sí solo** la veracidad de `TW10_STATE.json` ni la aprobación profesional. El auditor debe corroborar SHA, GitHub CI, artefactos y evidencias.
- No instalar/desinstalar el `.mcpb` de uso cotidiano de Tannia sin una prueba separada y autorización. No trabajar sobre sus proyectos ni los DWG existentes.
- Si un bloqueo externo es el único pendiente, el estado correcto es `ESPERA_EXTERNA`; continuar cuando el acceso a hardware/arquitecta/o esté disponible. Ese estado **no significa TW-10 terminada**.

## Referencias técnicas de Claude Code

- Ejecución programática y reanudación: https://code.claude.com/docs/en/headless
- Flags de CLI y modos Auto: https://code.claude.com/docs/en/cli-reference
- Permisos y sandbox: https://code.claude.com/docs/en/permissions
- Diagnóstico, sesiones y contexto: https://code.claude.com/docs/en/troubleshooting
