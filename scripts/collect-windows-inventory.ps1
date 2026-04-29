param(
  [string]$OutputPath = ".\inventario-equipo.csv",
  [string]$Location = "",
  [string]$AssetType = "Laptop",
  [string]$Notes = "Inventario automatico"
)

$ErrorActionPreference = "Stop"

function FirstValue($value, $fallback = "") {
  if ($null -eq $value) { return $fallback }
  if ($value -is [array]) {
    if ($value.Count -eq 0) { return $fallback }
    return $value[0]
  }
  return $value
}

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

$row = [ordered]@{
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

[pscustomobject]$row | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8
Write-Host "Inventario exportado en: $((Resolve-Path $OutputPath).Path)"
