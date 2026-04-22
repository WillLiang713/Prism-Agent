param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Resolve-BunCommand {
  $bunCommand = Get-Command bun.exe -ErrorAction SilentlyContinue
  if ($bunCommand) {
    return $bunCommand.Source
  }

  $bunCommand = Get-Command bun -ErrorAction SilentlyContinue
  if ($bunCommand) {
    return $bunCommand.Source
  }

  throw "bun was not found."
}

$bunCommand = Resolve-BunCommand
& $bunCommand "run" "tauri:build"
exit $LASTEXITCODE
