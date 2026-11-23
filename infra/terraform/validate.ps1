<#
.SYNOPSIS
    Validates Terraform IaC formatting and configuration in infra/terraform/.
.DESCRIPTION
    Executes `terraform fmt -check`, `terraform init -backend=false`, and
    `terraform validate` using the native `terraform` binary if available on PATH,
    or seamlessly falls back to a single `hashicorp/terraform:1.9` Docker container.
#>

[CmdletBinding()]
param(
    [string]$TerraformImage = "hashicorp/terraform:1.9",
    [switch]$ForceInit
)

$ErrorActionPreference = "Stop"
$tfDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$useLocalTf = [bool](Get-Command terraform -ErrorAction SilentlyContinue)
$cachedProviderRoot = Join-Path $tfDir ".terraform\providers\registry.terraform.io\render-oss\render"
$hasCachedProvider = (-not $ForceInit) -and (Test-Path $cachedProviderRoot)

if ($useLocalTf) {
    Push-Location $tfDir
    try {
        Write-Host "=== 1/3 Checking HCL formatting (terraform fmt -check) ===" -ForegroundColor Yellow
        & terraform fmt -check -recursive -diff
        if ($LASTEXITCODE -ne 0) { throw "terraform fmt failed ($LASTEXITCODE)" }

        Write-Host "=== 2/3 Initializing providers without remote backend ===" -ForegroundColor Yellow
        if ($hasCachedProvider) {
            & terraform init -backend=false -input=false -plugin-dir=.terraform/providers -no-color
        }
        else {
            & terraform init -backend=false -input=false -no-color
        }
        if ($LASTEXITCODE -ne 0) { throw "terraform init failed ($LASTEXITCODE)" }

        Write-Host "=== 3/3 Validating Terraform schema and references ===" -ForegroundColor Yellow
        & terraform validate -no-color
        if ($LASTEXITCODE -ne 0) { throw "terraform validate failed ($LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }
}
elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    $initCmd = if ($hasCachedProvider) {
        "terraform init -backend=false -input=false -plugin-dir=/workspace/.terraform/providers -no-color"
    }
    else {
        "terraform init -backend=false -input=false -no-color"
    }

    $shellScript = "set -e; echo '=== 1/3 Checking HCL formatting (terraform fmt -check) ==='; terraform fmt -check -recursive -diff; echo '=== 2/3 Initializing providers without remote backend ==='; $initCmd; echo '=== 3/3 Validating Terraform schema and references ==='; terraform validate -no-color"

    Write-Host "[docker $TerraformImage] Running fmt -> init -> validate..." -ForegroundColor Cyan
    & docker run --rm `
        --entrypoint sh `
        -v "${tfDir}:/workspace" `
        -w /workspace `
        $TerraformImage -c $shellScript

    if ($LASTEXITCODE -ne 0) {
        throw "Dockerized Terraform validation failed with exit code $LASTEXITCODE"
    }
}
else {
    throw "Neither 'terraform' nor 'docker' was found on PATH. Install Terraform >= 1.6 or start Docker Desktop."
}

Write-Host "`n[OK] Terraform IaC validation passed with zero errors." -ForegroundColor Green
