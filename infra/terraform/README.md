# Infraestructura como Código (IaC) – Render Cloud + Neon PostgreSQL

Este módulo de **Terraform** aprovisiona de forma declarativa, reproducible y libre de secretos en Git la infraestructura cloud del sistema **Admin Proyectos** sobre **Render Cloud**, conectando los dos microservicios Spring Boot 3 / Java 21 (contenerizados vía Docker multi-stage) con la base de datos gestionada **Neon PostgreSQL**.

---

## Arquitectura Aprovisionada

| Recurso Terraform | Tipo | Servicio / Rol | Runtime | Health Check |
| :--- | :--- | :--- | :--- | :--- |
| `render_project.admin_proyectos` | `render_project` | Agrupación lógica del proyecto y entorno (`production`) | N/A | N/A |
| `render_web_service.api_gestor` | `render_web_service` | Backend REST (`Ejercicio5MyAPIGestor`) conectado a Neon PostgreSQL | Docker (`./Ejercicio5MyAPIGestor/Dockerfile`) | `/actuator/health` |
| `render_web_service.cliente` | `render_web_service` | Frontend Web Thymeleaf (`Ejercicio5Cliente`) enlazado dinámicamente vía `API_BASE_URL` | Docker (`./Ejercicio5Cliente/Dockerfile`) | `/actuator/health` |

- **Provider oficial verificado:** `render-oss/render` (`~> 1.9.1`).
- **Alineación regional:** región por defecto `ohio`, coincidente con Neon PostgreSQL (`us-east-2`) para minimizar latencia entre la API y la base de datos.
- **Inyección dinámica de dependencias:** `render_web_service.cliente` recibe `API_BASE_URL = render_web_service.api_gestor.url`, garantizando orden de creación correcto y cero URLs hardcodeadas.
- **Filtros de monorepo (`build_filter`):** cada servicio solo reconstruye su imagen Docker cuando cambian archivos dentro de su propio subdirectorio (`Ejercicio5MyAPIGestor/**` o `Ejercicio5Cliente/**`).

---

## Estructura de Archivos

```text
infra/terraform/
├── versions.tf               # Versión mínima de Terraform (>= 1.6) y provider render-oss/render (~> 1.9.1)
├── providers.tf              # Configuración del provider Render (soporta env vars RENDER_API_KEY / RENDER_OWNER_ID)
├── variables.tf              # Variables tipadas, validaciones y marcado sensitive = true para secretos
├── main.tf                   # Recursos declarativos: proyecto, api_gestor y cliente
├── outputs.tf                # Salidas útiles: URLs públicas, /actuator/health, /actuator/prometheus, IDs
├── terraform.tfvars.example  # Plantilla sin secretos reales (copiar a terraform.tfvars localmente)
├── validate.ps1              # Script reproducible de validación (nativo o vía Docker hashicorp/terraform:1.9)
└── README.md                 # Esta documentación
```

---

## Validación Rápida (Sin Credenciales de Render)

Desde PowerShell en la raíz del repositorio:

```powershell
.\infra\terraform\validate.ps1
```

El script detecta si `terraform` está instalado localmente y, en caso contrario, ejecuta automáticamente el contenedor oficial `hashicorp/terraform:1.9` para correr:
1. `terraform fmt -check -recursive -diff`
2. `terraform init -backend=false -input=false`
3. `terraform validate`

---

## Despliegue en Render Cloud (`init` -> `plan` -> `apply`)

### 1. Configurar credenciales de forma segura (fuera de Git)

Copia la plantilla local (el archivo `terraform.tfvars` está bloqueado en `.gitignore`):

```powershell
Copy-Item infra\terraform\terraform.tfvars.example infra\terraform\terraform.tfvars
```

Edita `infra\terraform\terraform.tfvars` con tu cadena JDBC de Neon (`?sslmode=require`), usuario y contraseña rotada.

Exporta tus credenciales de Render en la sesión actual de PowerShell (recomendado frente a guardarlas en disco):

```powershell
$env:RENDER_API_KEY  = "<TU_RENDER_API_KEY>"
$env:RENDER_OWNER_ID = "<TU_RENDER_OWNER_ID>"
```

### 2. Ejecutar el ciclo de vida de Terraform

**Opción A — Con Terraform CLI nativo:**
```powershell
cd infra\terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
terraform output
```

**Opción B — Vía Docker (`hashicorp/terraform:1.9`) sin instalar Terraform localmente:**
```powershell
$tfDir = (Resolve-Path .\infra\terraform).Path

docker run --rm -v "${tfDir}:/workspace" -w /workspace `
  -e RENDER_API_KEY=$env:RENDER_API_KEY `
  -e RENDER_OWNER_ID=$env:RENDER_OWNER_ID `
  hashicorp/terraform:1.9 init

docker run --rm -v "${tfDir}:/workspace" -w /workspace `
  -e RENDER_API_KEY=$env:RENDER_API_KEY `
  -e RENDER_OWNER_ID=$env:RENDER_OWNER_ID `
  hashicorp/terraform:1.9 plan

docker run --rm -v "${tfDir}:/workspace" -w /workspace `
  -e RENDER_API_KEY=$env:RENDER_API_KEY `
  -e RENDER_OWNER_ID=$env:RENDER_OWNER_ID `
  hashicorp/terraform:1.9 apply -auto-approve
```

### 3. Destrucción limpia de recursos (reproducibilidad completa)

```powershell
terraform destroy
```

---

## Notas Técnicas Importantes

1. **Plan `free` vs `starter`:** `render_plan` usa `"free"` por defecto para despliegue académico sin costos. En el plan gratuito de Render las instancias entran en suspensión tras 15 minutos de inactividad (*cold start* de ~30–60 s en la primera petición). Para cambiar a un tier siempre encendido, basta ajustar `render_plan = "starter"` en `terraform.tfvars` y ejecutar `terraform apply`.
2. **Integración con Jenkins CD (Deploy Hooks):** El provider oficial `render-oss/render` v1.9.x aún no expone las URLs de *Deploy Hooks* como atributos de salida. Tras el primer `terraform apply`, copia los Deploy Hooks desde **Render Dashboard → Servicio → Settings → Deploy Hook** y guárdalos en Jenkins como credenciales *Secret text* con los IDs:
   - `render-deploy-hook-api`
   - `render-deploy-hook-cliente`
3. **Seguridad del estado (`terraform.tfstate`):** Dado que `env_vars` contiene credenciales de base de datos, los archivos `*.tfstate*`, `*.tfvars`, `*.tfplan` y `.terraform/` están estrictamente excluidos en `.gitignore`. Para entornos productivos multi-equipo se recomienda migrar el backend a almacenamiento remoto cifrado (p. ej., HCP Terraform o S3 + DynamoDB).
