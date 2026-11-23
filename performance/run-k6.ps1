<#
.SYNOPSIS
    Wrapper de ejecucion para pruebas de rendimiento con Grafana k6 (Admin Proyectos).

.DESCRIPTION
    Ejecuta pruebas Smoke o Load contra el entorno local (Docker Compose) o contra
    el despliegue en la nube (Render HTTPS), guardando reportes en JSON, Markdown y HTML
    dentro de performance/reports/.

.PARAMETER Mode
    Tipo de prueba: 'smoke' (por defecto) o 'load'.

.PARAMETER Target
    Entorno objetivo: 'local' (por defecto) o 'render'. En modo 'render', escala
    automaticamente los VUs a 0.5x salvo que se especifique -VusScale.

.PARAMETER ApiUrl
    URL base del backend Ejercicio5MyAPIGestor (ej. http://localhost:8081 o https://...onrender.com).

.PARAMETER ClientUrl
    URL base del frontend Ejercicio5Cliente (ej. http://localhost:8082 o https://...onrender.com).

.PARAMETER VusScale
    Factor de escala opcional para los usuarios virtuales en modo 'load' (por defecto 1.0 local, 0.5 render).

.PARAMETER ReportName
    Prefijo personalizado del archivo de reporte dentro de performance/reports/.

.EXAMPLE
    .\performance\run-k6.ps1 -Mode smoke
.EXAMPLE
    .\performance\run-k6.ps1 -Mode load -ApiUrl http://localhost:8081 -ClientUrl http://localhost:8082
.EXAMPLE
    .\performance\run-k6.ps1 -Mode load -Target render -ApiUrl https://admin-proyectos-api.onrender.com -ClientUrl https://admin-proyectos-cliente.onrender.com
#>
[CmdletBinding()]
param(
    [ValidateSet('smoke', 'load')]
    [string]$Mode = 'smoke',

    [ValidateSet('local', 'render')]
    [string]$Target = 'local',

    [string]$ApiUrl = '',

    [string]$ClientUrl = '',

    [double]$VusScale = 0,

    [string]$ReportName = ''
)

$ErrorActionPreference = 'Stop'

# Locate k6 binary (PATH first, then standard Windows install path)
$k6Cmd = Get-Command k6 -ErrorAction SilentlyContinue
if ($k6Cmd) {
    $k6Bin = $k6Cmd.Source
} elseif (Test-Path 'C:\Program Files\k6\k6.exe') {
    $k6Bin = 'C:\Program Files\k6\k6.exe'
} else {
    Write-Error "Grafana k6 no fue encontrado en PATH ni en 'C:\Program Files\k6\k6.exe'. Instalalo antes de ejecutar este script."
    exit 1
}

# Resolve repository root from script location (performance/run-k6.ps1 -> repo root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$reportsDir = Join-Path $scriptDir 'reports'
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

# Resolve target URLs safely
if ($Target -eq 'local') {
    if ([string]::IsNullOrWhiteSpace($ApiUrl)) { $ApiUrl = 'http://localhost:8081' }
    if ([string]::IsNullOrWhiteSpace($ClientUrl)) { $ClientUrl = 'http://localhost:8082' }
} else {
    if ([string]::IsNullOrWhiteSpace($ApiUrl)) { $ApiUrl = $env:RENDER_API_URL }
    if ([string]::IsNullOrWhiteSpace($ClientUrl)) { $ClientUrl = $env:RENDER_CLIENT_URL }
    if ([string]::IsNullOrWhiteSpace($ApiUrl) -or [string]::IsNullOrWhiteSpace($ClientUrl)) {
        Write-Error "En modo -Target render debes pasar -ApiUrl y -ClientUrl (o definir `$env:RENDER_API_URL y `$env:RENDER_CLIENT_URL)."
        exit 2
    }
}

$ApiUrl = $ApiUrl.TrimEnd('/')
$ClientUrl = $ClientUrl.TrimEnd('/')

if ($VusScale -le 0) {
    $VusScale = if ($Target -eq 'render') { 0.5 } else { 1.0 }
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($ReportName)) {
    $ReportName = "$Mode-$Target-$timestamp"
}

$scriptFile = if ($Mode -eq 'smoke') { 'performance/k6/smoke-test.js' } else { 'performance/k6/load-test.js' }
$reportPrefix = "performance/reports/$ReportName"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Admin Proyectos — Ejecucion k6 ($Mode | $Target)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  k6 Binary  : $k6Bin"
Write-Host "  Script     : $scriptFile"
Write-Host "  API_URL    : $ApiUrl"
Write-Host "  CLIENT_URL : $ClientUrl"
Write-Host "  VUS_SCALE  : $VusScale"
Write-Host "  Report     : $reportPrefix.(json|md|html)"
Write-Host "====================================================================" -ForegroundColor Cyan

Push-Location $repoRoot
try {
    $k6Args = @(
        'run',
        '-e', "API_URL=$ApiUrl",
        '-e', "CLIENT_URL=$ClientUrl",
        '-e', "TARGET_ENV=$Target",
        '-e', "VUS_SCALE=$VusScale",
        '-e', "REPORT_PREFIX=$reportPrefix",
        $scriptFile
    )
    & $k6Bin @k6Args
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "[OK] Prueba k6 '$Mode' finalizada dentro de los umbrales definidos." -ForegroundColor Green
} else {
    Write-Host "[WARN] Prueba k6 '$Mode' finalizo con codigo $exitCode (revisa umbrales o disponibilidad)." -ForegroundColor Yellow
}

$generated = Get-ChildItem -Path $reportsDir -Filter "$ReportName.*" -ErrorAction SilentlyContinue
if ($generated) {
    Write-Host "Reportes generados:" -ForegroundColor Cyan
    foreach ($f in $generated) {
        Write-Host "  - $($f.FullName)"
    }
}

exit $exitCode
