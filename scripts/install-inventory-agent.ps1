param(
  [string]$SerialNumber = "",
  [string]$Location = "",
  [string]$AssetType = "Laptop",
  [int]$IntervalMinutes = 0,
  [int]$IntervalDays = 15,
  [switch]$RunAtStartup,
  [string]$TaskName = "IT Inventario - Inventario automatico"
)

$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:ProgramData "ITInventario"
$AgentPath = Join-Path $InstallDir "collect-windows-inventory.ps1"
$AgentUrl = "https://raw.githubusercontent.com/Paco4gn/Aplicacion_inventario/main/scripts/collect-windows-inventory.ps1"

$SupabaseUrl = "https://dwudqkzkwsqwxshumlza.supabase.co"
$SupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhc2UiLCJyZWYiOiJkd3VkcWt6a3dzcXd4c2h1bWx6YSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc3MjQzNDU2LCJleHAiOjIwOTI4MTk0NTZ9.uJF1whOlEYgaNeXy4uJ1mXR6MONxuXSGdecJAyYWObo"
$SupabaseEmail = "informatica@feval.com"
$SupabasePassword = "p2p1l10n1t"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Invoke-WebRequest -Uri $AgentUrl -OutFile $AgentPath -UseBasicParsing

$installArgs = @(
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$AgentPath`"",
  "-InstallScheduledTask",
  "-SyncToSupabase",
  "-TaskName", "`"$TaskName`"",
  "-SupabaseUrl", "`"$SupabaseUrl`"",
  "-SupabaseAnonKey", "`"$SupabaseAnonKey`"",
  "-SupabaseEmail", "`"$SupabaseEmail`"",
  "-SupabasePassword", "`"$SupabasePassword`""
)

if ($IntervalDays -gt 0) {
  $installArgs += @("-IntervalDays", $IntervalDays)
} else {
  $installArgs += @("-IntervalMinutes", $IntervalMinutes)
}
if ($RunAtStartup) { $installArgs += "-RunAtStartup" }
if ($SerialNumber) { $installArgs += @("-SerialNumber", "`"$SerialNumber`"") }
if ($Location) { $installArgs += @("-Location", "`"$Location`"") }
if ($AssetType) { $installArgs += @("-AssetType", "`"$AssetType`"") }

$argLine = $installArgs -join " "
Start-Process -FilePath "powershell.exe" -ArgumentList $argLine -Wait -NoNewWindow

Write-Host ""
Write-Host "Agente instalado en: $AgentPath"
Write-Host "Tarea programada: $TaskName"
if ($IntervalDays -gt 0) {
  Write-Host "Se ejecutara cada $IntervalDays dias."
} else {
  Write-Host "Se ejecutara cada $IntervalMinutes minutos."
}
if ($RunAtStartup) { Write-Host "Tambien se ejecutara al arrancar Windows." }
