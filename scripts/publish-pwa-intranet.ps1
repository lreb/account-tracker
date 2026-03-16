[CmdletBinding()]
param(
    [int]$Port = 4173,
    [string]$HostAddress = "0.0.0.0",
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$StopExisting
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Get-LocalIPv4 {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -ne "127.0.0.1" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.PrefixOrigin -ne "WellKnown"
        } |
        Select-Object -ExpandProperty IPAddress -Unique

    return $ips
}

function Test-HttpEndpoint {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 12
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

Assert-Command -Name "npm"

if ($StopExisting) {
    Write-Step "Stopping existing process using TCP port $Port"
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process PID $procId" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "No listening process found on port $Port"
    }
}

if (-not $SkipInstall) {
    Write-Step "Installing dependencies (npm install)"
    npm install
}
else {
    Write-Step "Skipping dependency installation"
}

if (-not $SkipBuild) {
    Write-Step "Building production bundle (npm run build)"
    npm run build
}
else {
    Write-Step "Skipping build"
}

Write-Step "Starting intranet preview server"
$previewArgs = @("run", "preview", "--", "--host", $HostAddress, "--port", "$Port")
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$previewProcess = Start-Process -FilePath "npm.cmd" -ArgumentList $previewArgs -WorkingDirectory $projectRoot -PassThru

Write-Host "Preview server PID: $($previewProcess.Id)" -ForegroundColor Green

Start-Sleep -Seconds 4

$localUrls = @(
    "http://localhost:$Port/",
    "http://localhost:$Port/manifest.webmanifest",
    "http://localhost:$Port/sw.js"
)

Write-Step "Validating local endpoints"
foreach ($url in $localUrls) {
    $ok = Test-HttpEndpoint -Url $url
    $status = if ($ok) { "OK" } else { "FAIL" }
    $color = if ($ok) { "Green" } else { "Red" }
    Write-Host "[$status] $url" -ForegroundColor $color
}

$ips = @(Get-LocalIPv4)
Write-Step "Intranet URLs"
if ($ips.Count -eq 0) {
    Write-Host "No active local IPv4 addresses detected. Use localhost only." -ForegroundColor Yellow
}
else {
    foreach ($ip in $ips) {
        Write-Host "http://$ip`:$Port/" -ForegroundColor Magenta
    }
}

Write-Host "`nThe preview process is running in the background." -ForegroundColor Cyan
Write-Host "To stop it, run: Stop-Process -Id $($previewProcess.Id) -Force" -ForegroundColor Cyan
