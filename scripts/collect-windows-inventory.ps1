param(
  [string]$OutputPath = ".\inventario-equipo.csv",
  [string]$SerialNumber = "",
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

function Protect-Text {
  param([string]$Text)
  if (-not $Text) { return "" }
  return ConvertTo-SecureString $Text -AsPlainText -Force | ConvertFrom-SecureString
}

function Unprotect-Text {
  param([string]$ProtectedText)
  if (-not $ProtectedText) { return "" }
  $secure = ConvertTo-SecureString $ProtectedText
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
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
  if (-not $SupabasePassword -and $config.supabase_password_protected) { $script:SupabasePassword = Unprotect-Text $config.supabase_password_protected }
  if (-not $SupabasePassword -and $config.supabase_password) { $script:SupabasePassword = $config.supabase_password }
  if (-not $SerialNumber) { $script:SerialNumber = $config.serial_number }
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
  if (-not [string]::IsNullOrWhiteSpace($SerialNumber)) {
    $serial = $SerialNumber.Trim()
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

  $baseUrl = $SupabaseUrl.TrimEnd('/')
  $headers = @{
    "apikey" = $SupabaseAnonKey
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
  }

  $encodedSerial = [System.Uri]::EscapeDataString("eq.$($Row.serial_number)")
  $lookupUrl = "$baseUrl/rest/v1/assets?serial_number=$encodedSerial&select=id,serial_number"
  $existing = Invoke-RestMethod -Method Get -Uri $lookupUrl -Headers $headers

  if ($existing.Count -gt 0) {
    $technicalPayload = @{
      name = $Row.name
      brand = $Row.brand
      model = $Row.model
      operating_system = $Row.operating_system
      ip_address = $Row.ip_address
      mac_address = $Row.mac_address
      processor = $Row.processor
      ram_gb = $Row.ram_gb
      storage_gb = $Row.storage_gb
      last_inventory_at = $Row.last_inventory_at
      updated_at = $Row.last_inventory_at
    }
    $patchUrl = "$baseUrl/rest/v1/assets?serial_number=$encodedSerial"
    $patchHeaders = $headers.Clone()
    $patchHeaders["Prefer"] = "return=minimal"
    Invoke-RestMethod -Method Patch -Uri $patchUrl -Headers $patchHeaders -Body ($technicalPayload | ConvertTo-Json -Depth 5) | Out-Null
    Write-Host "Activo existente actualizado por numero de serie: $($Row.serial_number)"
    return
  }

  $createHeaders = $headers.Clone()
  $createHeaders["Prefer"] = "return=minimal"
  $body = @($Row) | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Uri "$baseUrl/rest/v1/assets" -Headers $createHeaders -Body $body | Out-Null
  Write-Host "Activo nuevo creado por numero de serie: $($Row.serial_number)"
}

function Install-AgentTask {
  $scriptPath = $PSCommandPath
  if (-not $scriptPath) { throw "No se pudo localizar la ruta del script." }

  Save-AgentConfig @{
    supabase_url = $SupabaseUrl
    supabase_anon_key = $SupabaseAnonKey
    supabase_email = $SupabaseEmail
    supabase_password_protected = Protect-Text $SupabasePassword
    serial_number = $SerialNumber
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
