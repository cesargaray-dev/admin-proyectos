<#
.SYNOPSIS
  Despliegue interactivo y seguro a Render Cloud mediante Terraform IaC.

.DESCRIPTION
  Automatiza el flujo `terraform init -> plan -> apply -> output` usando Terraform
  nativo o el contenedor oficial `hashicorp/terraform:1.9`, obtiene automaticamente
  tu RENDER_OWNER_ID desde la API de Render y nunca escribe llaves en disco ni Git.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\infra\terraform\deploy-render.ps1
  powershell -ExecutionPolicy Bypass -File .\infra\terraform\deploy-render.ps1 -PlanOnly
  powershell -ExecutionPolicy Bypass -File .\infra\terraform\deploy-render.ps1 -Destroy
#>
[CmdletBinding()]
param(
    [switch]$PlanOnly,
    [switch]$Destroy,
    [switch]$AutoApprove
)

$ErrorActionPreference = 'Stop'

$tfDir       = Split-Path -Parent $MyInvocation.MyCommand.Path
$tfvarsPath  = Join-Path $tfDir 'terraform.tfvars'
$examplePath = Join-Path $tfDir 'terraform.tfvars.example'

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Admin Proyectos - Despliegue IaC en Render Cloud (Terraform)" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. Verificar archivo local terraform.tfvars (ignorado por Git)
if (-not (Test-Path $tfvarsPath)) {
    Copy-Item $examplePath $tfvarsPath
    Write-Host "[!] Se creo 'infra/terraform/terraform.tfvars' desde la plantilla." -ForegroundColor Yellow
    Write-Host "    Abrelo, llena db_url, db_username y db_password de Neon PostgreSQL, y vuelve a correr este script." -ForegroundColor Yellow
    exit 1
}

$tfvarsRaw = Get-Content -Path $tfvarsPath -Raw
if ($tfvarsRaw -match '<your-neon-|REEMPLAZAR_CON_TU') {
    Write-Host "[ERROR] 'infra/terraform/terraform.tfvars' todavia contiene valores de ejemplo (<your-neon-...>)." -ForegroundColor Red
    Write-Host "        Edita db_url, db_username y db_password con tus credenciales reales de Neon antes de desplegar." -ForegroundColor Yellow
    exit 1
}

# 2. Determinar motor Terraform (nativo o Docker hashicorp/terraform:1.9)
$nativeTf = Get-Command terraform -ErrorAction SilentlyContinue
$useDocker = ($null -eq $nativeTf)
if ($useDocker) {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($null -eq $dockerCmd) {
        Write-Host "[ERROR] No se encontro 'terraform' ni 'docker' en PATH." -ForegroundColor Red
        exit 1
    }
    Write-Host "[*] Motor Terraform : Docker (hashicorp/terraform:1.9)" -ForegroundColor Gray
} else {
    Write-Host "[*] Motor Terraform : $($nativeTf.Source)" -ForegroundColor Gray
}

# 3. Obtener RENDER_API_KEY en memoria (sin guardar en disco)
$apiKey = $env:RENDER_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host ""
    Write-Host "Ingresa tu RENDER_API_KEY (Render -> Account Settings -> API Keys, empieza con 'rnd_'):" -ForegroundColor Yellow
    $secKey = Read-Host -Prompt "RENDER_API_KEY" -AsSecureString
    $bstr   = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secKey)
    try {
        $apiKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr).Trim()
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "[ERROR] RENDER_API_KEY no puede estar vacia." -ForegroundColor Red
    exit 1
}

# 4. Obtener RENDER_OWNER_ID automaticamente desde la API de Render si no esta definido
$ownerId = $env:RENDER_OWNER_ID
if ([string]::IsNullOrWhiteSpace($ownerId)) {
    Write-Host "[*] Consultando tu RENDER_OWNER_ID automaticamente en la API de Render..." -ForegroundColor Cyan
    try {
        $ownersResp = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Headers @{
            Authorization = "Bearer $apiKey"
            Accept        = "application/json"
        }
        $owners = @($ownersResp | ForEach-Object { if ($_.owner) { $_.owner } else { $_ } })
        if ($owners.Count -eq 0) {
            throw "La API de Render no devolvio ningun workspace/owner."
        } elseif ($owners.Count -eq 1) {
            $ownerId = $owners[0].id
            Write-Host "[OK] Owner detectado: $($owners[0].name) ($ownerId)" -ForegroundColor Green
        } else {
            Write-Host "Se encontraron varios workspaces en Render:" -ForegroundColor Yellow
            for ($i = 0; $i -lt $owners.Count; $i++) {
                Write-Host "  [$i] $($owners[$i].name) | $($owners[$i].email) | $($owners[$i].id)"
            }
            $choice = Read-Host "Elige el numero del workspace a usar [0]"
            if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "0" }
            $ownerId = $owners[[int]$choice].id
            Write-Host "[OK] Usando Owner ID: $ownerId" -ForegroundColor Green
        }
    } catch {
        Write-Host "[ERROR] No se pudo autenticar contra Render API: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "        Verifica que tu RENDER_API_KEY sea valida y este activa." -ForegroundColor Yellow
        exit 1
    }
}

function Invoke-Terraform {
    param([string[]]$TfArgs)
    if ($useDocker) {
        & docker run --rm `
            -v "${tfDir}:/workspace" `
            -w /workspace `
            -e "RENDER_API_KEY=$apiKey" `
            -e "RENDER_OWNER_ID=$ownerId" `
            hashicorp/terraform:1.9 @TfArgs
    } else {
        Push-Location $tfDir
        try {
            $prevKey = $env:RENDER_API_KEY
            $prevOwn = $env:RENDER_OWNER_ID
            $env:RENDER_API_KEY  = $apiKey
            $env:RENDER_OWNER_ID = $ownerId
            & terraform @TfArgs
        } finally {
            $env:RENDER_API_KEY  = $prevKey
            $env:RENDER_OWNER_ID = $prevOwn
            Pop-Location
        }
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Terraform fallo ejecutando: $($TfArgs -join ' ')"
    }
}

# 5. Ejecutar ciclo de vida Terraform
Write-Host "`n[1/4] Ejecutando terraform init..." -ForegroundColor Cyan
Invoke-Terraform @("init", "-input=false")

if ($Destroy) {
    Write-Host "`n[!] Modo DESTROY solicitado." -ForegroundColor Yellow
    if (-not $AutoApprove) {
        $confirm = Read-Host "Seguro que deseas DESTRUIR los recursos de Render? (S/N)"
        if ($confirm -notin @('S','s','Y','y')) {
            Write-Host "Cancelado." -ForegroundColor Gray
            exit 0
        }
    }
    Invoke-Terraform @("destroy", "-auto-approve")
    Write-Host "[OK] Recursos destruidos correctamente." -ForegroundColor Green
    exit 0
}

Write-Host "`n[2/4] Ejecutando terraform validate..." -ForegroundColor Cyan
Invoke-Terraform @("validate")

Write-Host "`n[3/4] Ejecutando terraform plan (vista previa sin modificar Render)..." -ForegroundColor Cyan
Invoke-Terraform @("plan", "-out=tfplan")

if ($PlanOnly) {
    Write-Host "`n[OK] Plan generado (-PlanOnly). No se aplicaron cambios en Render." -ForegroundColor Green
    exit 0
}

if (-not $AutoApprove) {
    Write-Host ""
    $confirm = Read-Host "Deseas aplicar este plan y crear/actualizar los servicios en Render Cloud? (S/N)"
    if ($confirm -notin @('S','s','Y','y')) {
        Write-Host "Despliegue cancelado por el usuario. No se modifico Render." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "`n[4/4] Ejecutando terraform apply..." -ForegroundColor Cyan
Invoke-Terraform @("apply", "tfplan")

Write-Host "`n====================================================================" -ForegroundColor Green
Write-Host "  DESPLIEGUE TERRAFORM COMPLETADO - OUTPUTS DE RENDER" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Invoke-Terraform @("output")

# Extraer URLs para imprimir comandos listos de verificacion y k6
try {
    $outJson = if ($useDocker) {
        & docker run --rm -v "${tfDir}:/workspace" -w /workspace `
            -e "RENDER_API_KEY=$apiKey" -e "RENDER_OWNER_ID=$ownerId" `
            hashicorp/terraform:1.9 output -json | Out-String
    } else {
        Push-Location $tfDir; try { & terraform output -json | Out-String } finally { Pop-Location }
    }
    $parsed = $outJson | ConvertFrom-Json
    $apiUrl    = $parsed.api_url.value
    $clientUrl = $parsed.client_url.value

    if ($apiUrl -and $clientUrl) {
        Write-Host "`nSiguientes pasos cuando ambos servicios esten 'Live' en https://dashboard.render.com:" -ForegroundColor Cyan
        Write-Host "  1. Verifica salud del Backend : $apiUrl/actuator/health"
        Write-Host "  2. Abre la App en tu navegador: $clientUrl"
        Write-Host "  3. Corre la prueba de carga k6 contra Render:"
        Write-Host "     powershell -ExecutionPolicy Bypass -File .\performance\run-k6.ps1 -Mode load -Target render -ApiUrl `"$apiUrl`" -ClientUrl `"$clientUrl`"" -ForegroundColor White
    }
} catch {
    # No bloquear si cambia el formato de salida
}
