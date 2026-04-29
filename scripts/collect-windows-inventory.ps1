param(
  [string]$OutputPath = ".\inventario-equipo.csv",
  [string]$Location = "",
  [string]$AssetType = "Laptop",
  [string]$Notes = "Inventario automatico",
  [string]$SupabaseUrl = "",
  [string]$SupabaseAnonKey = "",
  [string]$SupabaseEmail = "",
  [string]$SupabasePassword = "",
  [switch]$SyncToSupabase,
  [switch]$InstallScheduledTask,
  [int]$IntervalMinutes = 60,
  [string]$TaskName = "IT Inventario - Inventario automatico"
)

$ErrorActionPreference = "Stop"
$ConfigDir = Join-Path $env:ProgramData "ITInventario"
$ConfigPath = Join-Path $ConfigDir "agent.json"

function FirstValue($value, $fallback = "") {
  if ($null -eq $value) { return $fallback }
  if ($value -is [array]) {
    if ($value.Count -eq 0) { return $fallback }
    return $value[0]
  }
  return $value
}

function Load-AgentConfig {
  if (Test-Path $ConfigPath) {
    return Get-Content $ConfigPath -Raw | ConvertFrom-Json
  }
  return $null
}

function Save-AgentConfig {
  param([hashtable]$Config)
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
  $Config | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8
}

function Apply-ConfigDefaults {
  $config = Load-AgentConfig
  if ($null -eq $config) { return }
  if (-not $SupabaseUrl) { $script:SupabaseUrl = $config.supabase_url }
  if (-not $SupabaseAnonKey) { $script:SupabaseAnonKey = $config.supabase_anon_key }
  if (-not $SupabaseEmail) { $script:SupabaseEmail = $config.supabase_email }
  if (-not $SupabasePassword) { $script:SupabasePassword = $config.supabase_password }
  if (-not $Location) { $script:Location = $config.location }
  if (-not $AssetType -and $config.asset_type) { $script:AssetType = $config.asset_type }
  if (-not $Notes -and $config.notes) { $script:Notes = $config.notes }
}

function Get-InventoryRow {
  $bios = Get-CimInstance Win32_BIOS
  $computer = Get-CimInstance Win32_ComputerSystem
  $os = Get-CimInstance Win32_OperatingSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"
  $net = Get-CimInstance Win32_NetworkAdapterConfiguration |
    Where-Object { $_.IPEnabled -eq $true -and $_.MACAddress } |
    Select-Object -First 1

  $serial = ""
  if ($null -ne $bios.SerialNumber) {
    $serial = $bios.SerialNumber.Trim()
  }
  if ([string]::IsNullOrWhiteSpace($serial) -or $serial -match "To be filled|Default|string") {
    $serial = $env:COMPUTERNAME
  }

  $ramGb = [math]::Round(($computer.TotalPhysicalMemory / 1GB), 2)
  $storageGb = [math]::Round((($disks | Measure-Object -Property Size -Sum).Sum / 1GB), 2)
  $ip = FirstValue $net.IPAddress
  $now = (Get-Date).ToUniversalTime().ToString("o")
  $culture = [System.Globalization.CultureInfo]::InvariantCulture

  return [ordered]@{
    "serial_number" = $serial
    "name" = $env:COMPUTERNAME
    "asset_type" = $AssetType
    "brand" = $computer.Manufacturer
    "model" = $computer.Model
    "status" = "active"
    "location" = $Location
    "operating_system" = "$($os.Caption) $($os.Version)"
    "ip_address" = $ip
    "mac_address" = $net.MACAddress
    "processor" = $cpu.Name
    "ram_gb" = $ramGb.ToString($culture)
    "storage_gb" = $storageGb.ToString($culture)
    "last_inventory_at" = $now
    "notes" = $Notes
  }
}

function Get-SupabaseAccessToken {
  if (-not $SupabaseEmail -or -not $SupabasePassword) {
    return ""
  }

  $authUrl = "$($SupabaseUrl.TrimEnd('/'))/auth/v1/token?grant_type=password"
  $headers = @{
    "apikey" = $SupabaseAnonKey
    "Content-Type" = "application/json"
  }
  $body = @{
    email = $SupabaseEmail
    password = $SupabasePassword
  } | ConvertTo-Json

  $response = Invoke-RestMethod -Method Post -Uri $authUrl -Headers $headers -Body $body
  return $response.access_token
}

function Sync-InventoryToSupabase {
  param([hashtable]$Row)

  if (-not $SupabaseUrl -or -not $SupabaseAnonKey) {
    throw "Faltan SupabaseUrl y SupabaseAnonKey. Instala/configura el agente antes de sincronizar."
  }

  $token = Get-SupabaseAccessToken
  if (-not $token) {
    $token = $SupabaseAnonKey
  }

  $restUrl = "$($SupabaseUrl.TrimEnd('/'))/rest/v1/assets?on_conflict=serial_number"
  $headers = @{
    "apikey" = $SupabaseAnonKey
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
    "Prefer" = "resolution=merge-duplicates,return=minimal"
  }
  $body = @($Row) | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Uri $restUrl -Headers $headers -Body $body | Out-Null
}

function Install-AgentTask {
  $scriptPath = $PSCommandPath
  if (-not $scriptPath) { throw "No se pudo localizar la ruta del script." }

  Save-AgentConfig @{
    supabase_url = $SupabaseUrl
    supabase_anon_key = $SupabaseAnonKey
    supabase_email = $SupabaseEmail
    supabase_password = $SupabasePassword
    location = $Location
    asset_type = $AssetType
    notes = $Notes
  }

  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -SyncToSupabase"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description "Actualiza automaticamente este equipo en IT Inventario" -Force | Out-Null
  Write-Host "Tarea programada instalada: $TaskName cada $IntervalMinutes minutos"
  Write-Host "Config guardada en: $ConfigPath"
}

Apply-ConfigDefaults

if ($InstallScheduledTask) {
  if (-not $SupabaseUrl -or -not $SupabaseAnonKey) {
    throw "Para instalar la tarea indica -SupabaseUrl y -SupabaseAnonKey."
  }
  Install-AgentTask
}

$row = Get-InventoryRow
[pscustomobject]$row | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8
Write-Host "Inventario exportado en: $((Resolve-Path $OutputPath).Path)"

if ($SyncToSupabase) {
  Sync-InventoryToSupabase -Row $row
  Write-Host "Inventario sincronizado con Supabase para el equipo: $($row.serial_number)"
}
