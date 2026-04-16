param(
  [string]$BackendHost = "127.0.0.1",
  [int]$Port = 33200
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$desktopIdentifier = "com.prism.agent.desktop"
$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { "" }
$desktopCacheDir = if ($localAppData) {
  Join-Path $localAppData $desktopIdentifier
} else {
  ""
}
$devScript = Join-Path $PSScriptRoot "dev-tauri-windows.ps1"

function Stop-PrismDesktopProcess {
  $desktopProcesses = Get-Process -Name "prism_agent_desktop" -ErrorAction SilentlyContinue
  if (-not $desktopProcesses) {
    return
  }

  foreach ($process in $desktopProcesses) {
    try {
      & taskkill /PID $process.Id /T /F *> $null
    } catch {
      try {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      } catch {
        # ignore cleanup failure
      }
    }
  }
}

Stop-PrismDesktopProcess

if ($desktopCacheDir -and (Test-Path $desktopCacheDir)) {
  Remove-Item -LiteralPath $desktopCacheDir -Recurse -Force
}

& $devScript -BackendHost $BackendHost -Port $Port
exit $LASTEXITCODE
