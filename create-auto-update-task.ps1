param(
  [string]$TaskName = "AttendProAutoUpdate",
  [string]$Branch = "main",
  [int]$EveryMinutes = 10
)

$repoPath = $PSScriptRoot
$scriptPath = Join-Path $repoPath "update-and-restart.ps1"

if (-not (Test-Path $scriptPath)) {
  Write-Error "Не найден скрипт обновления: $scriptPath"
  exit 1
}

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Branch $Branch"

schtasks /Create /TN $TaskName /SC MINUTE /MO $EveryMinutes /TR $taskCommand /F
Write-Output "Задача создана: $TaskName (каждые $EveryMinutes минут)"
