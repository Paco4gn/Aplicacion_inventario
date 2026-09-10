[CmdletBinding()]
param(
  [string]$OutputPath = ".\inventario-equipo.csv",
  [string]$SerialNumber = "",
  [string]$Location = "",
  [string]$AssetType = "",
  [string]$Notes = "Inventario automatico",
  [string]$ApiUrl = "",
  [string]$AgentToken = "",
  [switch]$SyncToInventory,
  [switch]$InstallScheduledTask,
  [switch]$Install,
  [int]$IntervalMinutes = 60,
  [int]$IntervalDays = 0,
  [switch]$RunAtStartup,
  [string]$TaskName = "IT Inventario - Inventario automatico"
)

$ErrorActionPreference = "Stop"
$ConfigDir = Join-Path $env:ProgramData "ITInventario"
$ConfigPath = Join-Path $ConfigDir "agent.json"

function First-Value {
  param($Value, $Fallback = "")
  if ($null -eq $Value) { return $Fallback }
  if ($Value -is [array]) {
    if ($Value.Count -eq 0) { return $Fallback }
    return $Value[0]
  }
  return $Value
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
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Load-AgentConfig {
  if (Test-Path -LiteralPath $ConfigPath) {
    return Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  }
  return $null
}

function Save-AgentConfig {
  param([hashtable]$Config)
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
  $Config | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
}

function Apply-ConfigDefaults {
  $config = Load-AgentConfig
  if ($null -eq $config) { return }
  if (-not $ApiUrl) { $script:ApiUrl = $config.api_url }
  if (-not $AgentToken -and $config.agent_token_protected) { $script:AgentToken = Unprotect-Text $config.agent_token_protected }
  if (-not $SerialNumber) { $script:SerialNumber = $config.serial_number }
  if (-not $Location) { $script:Location = $config.location }
  if (-not $AssetType -and $config.asset_type) { $script:AssetType = $config.asset_type }
  if (-not $Notes -and $config.notes) { $script:Notes = $config.notes }
}

function Get-DetectedAssetType {
  param($ChassisTypes)
  $laptopTypes = @(8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32)
  foreach ($type in @($ChassisTypes)) {
    if ($laptopTypes -contains [int]$type) { return "Laptop" }
  }
  return "Torre"
}

function Get-InventoryRow {
  $bios = Get-CimInstance Win32_BIOS
  $computer = Get-CimInstance Win32_ComputerSystem
  $enclosure = Get-CimInstance Win32_SystemEnclosure | Select-Object -First 1
  $os = Get-CimInstance Win32_OperatingSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"
  $network = Get-CimInstance Win32_NetworkAdapterConfiguration |
    Where-Object { $_.IPEnabled -eq $true -and $_.MACAddress } |
    Select-Object -First 1

  $serial = if ($bios.SerialNumber) { $bios.SerialNumber.Trim() } else { "" }
  if ([string]::IsNullOrWhiteSpace($serial) -or $serial -match "To be filled|Default|string") {
    $serial = $env:COMPUTERNAME
  }
  if ($SerialNumber) { $serial = $SerialNumber.Trim() }

  $ramGb = [math]::Round(($computer.TotalPhysicalMemory / 1GB), 2)
  $storageGb = [math]::Round((($disks | Measure-Object -Property Size -Sum).Sum / 1GB), 2)
  $now = (Get-Date).ToUniversalTime().ToString("o")

  return [ordered]@{
    serial_number = $serial
    name = $env:COMPUTERNAME
    asset_type = if ($AssetType) { $AssetType } else { Get-DetectedAssetType -ChassisTypes $enclosure.ChassisTypes }
    brand = $computer.Manufacturer
    model = $computer.Model
    status = "active"
    location = $Location
    operating_system = "$($os.Caption) $($os.Version)"
    ip_address = First-Value $network.IPAddress
    mac_address = $network.MACAddress
    processor = $cpu.Name
    ram_gb = $ramGb
    storage_gb = $storageGb
    last_inventory_at = $now
    notes = $Notes
  }
}

function Sync-Inventory {
  param([hashtable]$Row)
  if (-not $ApiUrl -or -not $AgentToken) {
    throw "Faltan ApiUrl y AgentToken. Instala o configura el agente antes de sincronizar."
  }
  $endpoint = if ($ApiUrl.TrimEnd('/') -match '/api/agent/sync$') {
    $ApiUrl.TrimEnd('/')
  } else {
    "$($ApiUrl.TrimEnd('/'))/api/agent/sync"
  }
  $headers = @{ Authorization = "Bearer $AgentToken" }
  $result = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -ContentType "application/json" -Body ($Row | ConvertTo-Json -Depth 5)
  Write-Host "Activo $($result.action): $($result.serial_number)"
}

function Install-AgentTask {
  if (-not $ApiUrl -or -not $AgentToken) {
    throw "Para instalar la tarea indica -ApiUrl y -AgentToken."
  }
  $scriptPath = $PSCommandPath
  if (-not $scriptPath) { throw "No se pudo localizar la ruta del script." }
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
  $installedScriptPath = Join-Path $ConfigDir "collect-windows-inventory.ps1"
  if ($scriptPath -ne $installedScriptPath) {
    Copy-Item -LiteralPath $scriptPath -Destination $installedScriptPath -Force
  }

  Save-AgentConfig @{
    api_url = $ApiUrl.TrimEnd('/')
    agent_token_protected = Protect-Text $AgentToken
    serial_number = $SerialNumber
    location = $Location
    asset_type = $AssetType
    notes = $Notes
  }

  $arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$installedScriptPath`" -SyncToInventory"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
  $repeatEvery = if ($IntervalDays -gt 0) { New-TimeSpan -Days $IntervalDays } else { New-TimeSpan -Minutes $IntervalMinutes }
  $triggers = @(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval $repeatEvery -RepetitionDuration (New-TimeSpan -Days 3650))
  if ($RunAtStartup) { $triggers += New-ScheduledTaskTrigger -AtStartup }
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Description "Actualiza automaticamente este equipo en IT Inventario" -Force | Out-Null
  Write-Host "Tarea programada instalada: $TaskName"
  Write-Host "Agente instalado en: $installedScriptPath"
}

if ($Install) {
  $InstallScheduledTask = $true
  $SyncToInventory = $true
}

Apply-ConfigDefaults

if ($InstallScheduledTask) { Install-AgentTask }

$row = Get-InventoryRow
[pscustomobject]$row | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8
Write-Host "Inventario exportado en: $((Resolve-Path $OutputPath).Path)"

if ($SyncToInventory) {
  Sync-Inventory -Row $row
  Write-Host "Inventario sincronizado para el equipo: $($row.serial_number)"
}
