param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Resolve-NpmCommand {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmCommand) {
    return $npmCommand.Source
  }

  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCommand) {
    return $npmCommand.Source
  }

  throw "npm was not found."
}

function Remove-PathIfExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LiteralPath
  )

  if (Test-Path $LiteralPath) {
    Remove-Item -LiteralPath $LiteralPath -Recurse -Force
  }
}

$npmCommand = Resolve-NpmCommand

Remove-PathIfExists -LiteralPath (Join-Path $projectRoot "web\dist")
Remove-PathIfExists -LiteralPath (Join-Path $projectRoot "src-tauri\target")

& $npmCommand "run" "tauri:dev"
exit $LASTEXITCODE
