# TW-10 — runner LOCAL OPCIONAL de ciclos Claude Code; no es un servicio ni un daemon.
# Ejecutar DESPUÉS de crear un worktree aislado con la documentación TW-10 colocada en docs/tw10.
# Requiere Claude Code CLI reciente; se ejecuta en la computadora del usuario, consume su cuota/costo, y NO hace merge/release.
# No usar bypassPermissions: --permission-mode auto, --permission-prompts none (rechaza lo que requiere aprobación).
param(
    [Parameter(Mandatory = $true)] [string] $Worktree,
    [int] $MaxCycles = 25,
    [int] $MaxStagnantCycles = 3
)

$ErrorActionPreference = 'Stop'
if ($MaxCycles -lt 1 -or $MaxCycles -gt 100) { throw 'MaxCycles debe estar entre 1 y 100.' }
if ($MaxStagnantCycles -lt 1 -or $MaxStagnantCycles -gt 10) { throw 'MaxStagnantCycles debe estar entre 1 y 10.' }

$repo = (Resolve-Path -LiteralPath $Worktree).Path
Push-Location -LiteralPath $repo
try {
    if (!(Get-Command claude -ErrorAction SilentlyContinue)) { throw 'Falta Claude Code CLI o no figura en PATH.' }
    if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw 'Falta git.' }
    $gitRoot = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'La ruta no corresponde a un repositorio Git.' }
    if ([IO.Path]::GetFullPath($gitRoot.Trim()).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) -ne [IO.Path]::GetFullPath($repo).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)) {
        throw 'Worktree debe señalar exactamente la raíz del repositorio (no una subcarpeta).'
    }
    $branch = (& git branch --show-current).Trim()
    if ($branch -ne 'feat/tw10-architectural-reasoning') {
        throw "Rama inesperada '$branch'. Este runner solo opera en feat/tw10-architectural-reasoning."
    }

    $required = @(
      'docs/tw10/TW10_INVESTIGACION_Y_AUDITORIA_ARQUITECTONICA_2026-11-16.md',
      'docs/tw10/TW10_CONTRATO_CAPA_RAZONAMIENTO_ARQUITECTONICO_V1.md',
      'docs/tw10/TW10_ROADMAP_MAESTRO_Y_GATES_2026-11-16.md',
      'docs/tw10/TW10_DIRECTIVA_EJECUCION_AUTONOMA_DE_EXTREMO_A_EXTREMO_V2.md',
      'docs/tw10/TW10_PROMPT_EJECUCION_AUTONOMA_E2E_V2.md'
    )
    $missing = $required | Where-Object { !(Test-Path (Join-Path $repo $_)) }
    if ($missing.Count -gt 0) { throw ('Documentos faltantes en el worktree: ' + ($missing -join ', ')) }

    $stateDir = Join-Path $repo 'docs/agent-continuity'
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    $statePath = Join-Path $stateDir 'TW10_STATE.json'
    if (!(Test-Path $statePath)) {
        $template = Join-Path $repo 'docs/tw10/TW10_STATE_TEMPLATE.json'
        if (!(Test-Path $template)) { throw 'Falta TW10_STATE_TEMPLATE.json.' }
        Copy-Item -LiteralPath $template -Destination $statePath
    }

    $logsDir = Join-Path $repo '.agent-runs/tw10'
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    $sessionFile = Join-Path $logsDir 'claude-session-id.txt'
    $sessionId = if (Test-Path $sessionFile) { (Get-Content $sessionFile -Raw).Trim() } else { '' }
    $previousFingerprint = ''
    $stagnant = 0

    for ($cycle = 1; $cycle -le $MaxCycles; $cycle++) {
        # Verificar estado y rama en CADA iteración: no reusar un contexto equivocado.
        $currentBranch = (& git branch --show-current).Trim()
        if ($currentBranch -ne 'feat/tw10-architectural-reasoning') { throw "Se cambió de rama durante la ejecución: $currentBranch" }
        $head = (& git rev-parse HEAD).Trim()
        $status = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($status.overall_status -eq 'ACEPTADO_POR_PO') {
            Write-Warning 'El estado dice ACEPTADO_POR_PO. El runner NO valida autorizaciones externas: suspender y verificar manualmente.'
            break
        }
        if ($status.overall_status -eq 'CANDIDATO_TECNICO_COMPLETO' -or $status.overall_status -eq 'ESPERA_EXTERNA') {
            Write-Host 'Todo lo automatizable aparece completado o queda un bloqueo externo. La macrofase sigue abierta para G10 real y la aceptación del PO.'
            break
        }

        $message = if ($cycle -eq 1 -and !$sessionId) {
            'EJECUTA AHORA la misión íntegra de docs/tw10/TW10_PROMPT_EJECUCION_AUTONOMA_E2E_V2.md y docs/tw10/TW10_DIRECTIVA_EJECUCION_AUTONOMA_DE_EXTREMO_A_EXTREMO_V2.md. Lee los contratos originales completos. Estás en tu worktree TW10. Debes avanzar gates consecutivos, implementar código y pruebas, preservar TW09, evidenciar CI, actualizar docs/agent-continuity/TW10_STATE.json y TW10_HANDOFF.md; no merge, no release, no falsos gates. No termines con un primer reporte.'
        } else {
            'REANUDA TW10 sin pedir permiso: lee docs/agent-continuity/TW10_STATE.json, TW10_HANDOFF.md, docs/tw10/TW10_DIRECTIVA_EJECUCION_AUTONOMA_DE_EXTREMO_A_EXTREMO_V2.md, Git/CI y sigue ejecutando la siguiente historia concreta hasta el siguiente gate y MÁS ALLÁ. Investiga fallos y repáralos. Mantén PR draft. Si queda solo G10 real fuera de este equipo, clasifica ESPERA_EXTERNA con evidencia; NO cierres la macrofase ni simules pruebas profesionales.'
        }

        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $stdout = Join-Path $logsDir ("cycle-$cycle-$stamp.json")
        $stderr = Join-Path $logsDir ("cycle-$cycle-$stamp.stderr.txt")
        Write-Host "TW10: ciclo $cycle/$MaxCycles, HEAD $($head.Substring(0,8)), rama $currentBranch"
        $args = @('-p', $message, '--output-format', 'json', '--permission-mode', 'auto', '--permission-prompts', 'none')
        if ($sessionId) { $args += @('--resume', $sessionId) }
        try {
            $output = & claude @args 2>$stderr
            $exit = $LASTEXITCODE
        } catch {
            Write-Warning "No se pudo iniciar Claude: $($_.Exception.Message). Los checkpoints anteriores permanecen."
            break
        }
        $outputText = ($output | Out-String)
        [IO.File]::WriteAllText($stdout, $outputText, [Text.UTF8Encoding]::new($false))
        try {
            $json = $outputText | ConvertFrom-Json
            if ($json.session_id -and $json.session_id -match '^[0-9a-fA-F-]{36}$') {
                $sessionId = [string]$json.session_id
                [IO.File]::WriteAllText($sessionFile, $sessionId, [Text.UTF8Encoding]::new($false))
            }
            if ($json.is_error) { Write-Warning "Claude indicó error en ciclo $cycle; inspeccionar $stdout" }
        } catch {
            Write-Warning "No se pudo interpretar la respuesta JSON de Claude en ciclo $cycle; inspeccionar $stdout"
        }
        if ($exit -ne 0) {
            Write-Warning "Claude terminó con exit $exit. Ver $stderr. No se reintenta indefinidamente."
            break
        }

        $updated = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        $newHead = (& git rev-parse HEAD).Trim()
        $gitChanges = (& git status --porcelain | Out-String).Trim()
        $fingerprint = "$newHead|$($updated.current_gate)|$($updated.current_story)|$($updated.overall_status)|$gitChanges"
        Write-Host "Estado: $($updated.overall_status); gate $($updated.current_gate); historia $($updated.current_story); HEAD $($newHead.Substring(0,8))"
        if ($updated.overall_status -eq 'CANDIDATO_TECNICO_COMPLETO' -or $updated.overall_status -eq 'ESPERA_EXTERNA') {
            Write-Host 'Detengo el runner local: verificar gate externo/hardware. El PR permanece abierto; NO hay aceptación automática.'
            break
        }
        if ($fingerprint -eq $previousFingerprint) { $stagnant++ } else { $stagnant = 0 }
        $previousFingerprint = $fingerprint
        if ($stagnant -ge $MaxStagnantCycles) {
            Write-Warning 'Sin progreso observable en varias sesiones. Se detiene SOLO el runner para diagnóstico; NO se cierra TW10.'
            break
        }
    }
    Write-Host "Continuidad: $statePath"
    Write-Host "Registros:  $logsDir"
    Write-Host 'Reanudar: ejecutar otra vez este script con el mismo Worktree. No hacer merge/release.'
} finally {
    Pop-Location
}
