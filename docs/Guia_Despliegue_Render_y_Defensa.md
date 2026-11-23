# Guía Operativa de Despliegue en Render y Preparación de Defensa Presencial

> **Proyecto:** `admin-proyectos` (`Ejercicio5Cliente` + `Ejercicio5MyAPIGestor` + Neon PostgreSQL)  
> **Alumno:** César Enrique Garay García · UTNG  
> **Evaluación:** Evaluación Final · Circuito DevOps con IaC (Unidad III)  
> **Defensa presencial:** Viernes 4 de diciembre de 2026  

---

## Prerrequisitos Antes de Empezar

Verifica que tienes listo lo siguiente en tu equipo Windows:

- [ ] **Docker Desktop** encendido y ejecutándose (backend WSL2 activo).
- [ ] **Grafana k6** instalado (`C:\Program Files\k6\k6.exe` o disponible en `PATH`).
- [ ] **Git** sincronizado con tu repositorio `https://github.com/Enrique1189/admin-proyectos` (rama `main` actualizada con todos los cambios de Unidad III).
- [ ] Cuenta activa en **Render** (`https://dashboard.render.com`) vinculada a tu cuenta de GitHub.
- [ ] Acceso a tu consola de **Neon PostgreSQL** (`https://console.neon.tech`).
- [ ] *(Opcional)* CLI nativa de **Terraform**; si no la tienes instalada, todos los comandos de esta guía funcionan usando el contenedor oficial `hashicorp/terraform` a través de Docker.

> [!CAUTION]
> **Regla de oro de seguridad:** Nunca subas a GitHub los archivos `infra/terraform/terraform.tfvars`, `.env`, `terraform.tfstate` ni pegues tu API Key de Render o contraseña de Neon en comandos públicos o capturas de pantalla sin ocultarlas.

---

## Paso 1: Seguridad Primero — Rotar la Contraseña de Neon PostgreSQL

En versiones anteriores de la Unidad II existió una contraseña en texto plano dentro de `Ejercicio5MyAPIGestor/src/main/resources/application.properties`. Aunque ya fue eliminada y sustituida por variables de entorno, **la buena práctica profesional obligatoria es rotar la contraseña en Neon antes de desplegar**:

1. Entra a `https://console.neon.tech` y abre tu proyecto de `admin-proyectos`.
2. Ve a **Roles** (o **Branches → Connection Details**) y selecciona el usuario propietario de tu base de datos (`neondb_owner`).
3. Haz clic en **Reset password** para generar una nueva contraseña segura.
4. Copia y guarda temporalmente en un gestor de contraseñas (nunca en el repo):
   - **Host pooler:** `ep-<tu-endpoint>-pooler.<region>.aws.neon.tech`
   - **Cadena JDBC (`DB_URL`):** `jdbc:postgresql://<host-pooler>/neondb?sslmode=require`
   - **Usuario (`DB_USERNAME`):** `neondb_owner`
   - **Nueva contraseña (`DB_PASSWORD`):** `<tu-nueva-contrasena-neon>`

---

## Paso 2: Obtener `RENDER_API_KEY` y `RENDER_OWNER_ID` y Llenar `terraform.tfvars`

### 2.1. Crear tu API Key de Render

1. Inicia sesión en `https://dashboard.render.com`.
2. Haz clic en tu avatar (esquina superior derecha) → **Account Settings** → **API Keys**.
3. Haz clic en **Create API Key**, asígnale un nombre claro (por ejemplo, `utng-terraform-devops`) y copia la clave generada *(Render solo la muestra una vez)*.

### 2.2. Obtener tu `RENDER_OWNER_ID`

El proveedor oficial `render-oss/render` necesita tu identificador de propietario/workspace (`tea-...` o `usr-...`). Puedes obtenerlo de forma segura en PowerShell consultando la API de Render **sin guardar tu clave en disco**:

```powershell
# Carga temporalmente tu API Key SOLO en esta sesión de PowerShell
$env:RENDER_API_KEY = Read-Host "Pega tu RENDER_API_KEY" -AsSecureString | ForEach-Object {
    [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)
    )
}

# Consulta tu Owner ID directamente en la API oficial de Render
$headers = @{ Authorization = "Bearer $env:RENDER_API_KEY"; Accept = "application/json" }
$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners?limit=20" -Headers $headers
$owners | ForEach-Object { [PSCustomObject]@{ Id = $_.owner.id; Name = $_.owner.name; Email = $_.owner.email; Type = $_.owner.type } } | Format-Table -AutoSize
```

Copia el valor de la columna **`Id`** correspondiente a tu cuenta o workspace y cárgalo también en tu sesión actual:

```powershell
$env:RENDER_OWNER_ID = "<PEGA_AQUI_TU_OWNER_ID>"
```

### 2.3. Crear y completar `infra/terraform/terraform.tfvars`

Desde la raíz del repositorio (`admin-proyectos`):

```powershell
Copy-Item infra\terraform\terraform.tfvars.example infra\terraform\terraform.tfvars
```

Abre `infra/terraform/terraform.tfvars` en tu editor y llena los valores reales:
- `github_repo_url = "https://github.com/Enrique1189/admin-proyectos"` y `github_branch = "main"`.
- `render_region = "ohio"` (alineada con Neon `us-east-2` para mínima latencia) y `render_plan = "free"`.
- `db_url` (cadena JDBC completa con `?sslmode=require`), `db_username` y `db_password` (la contraseña recién rotada en el Paso 1).
- Deja comentadas `render_api_key` y `render_owner_id` en el archivo para que Terraform las lea desde `$env:RENDER_API_KEY` y `$env:RENDER_OWNER_ID` en memoria (mayor seguridad).

### 2.4. Verificación obligatoria de `.gitignore`

Antes de continuar, ejecuta:

```powershell
git status
```

Confirma que **`infra/terraform/terraform.tfvars` NO aparece** en la lista de archivos sin seguimiento (*Untracked files*). Si llegara a aparecer, **detente** y revisa `.gitignore` antes de hacer cualquier `git add`.

---

## Paso 3: Aprovisionar la Infraestructura con Terraform (`init`, `validate`, `plan`, `apply`)

> [!IMPORTANT]
> Asegúrate primero de haber hecho `git push origin main` con los `Dockerfile` y cambios de código de Unidad III para que Render pueda construir ambos contenedores desde GitHub.

### 3.1. Validar sintaxis y formato (sin crear nada aún)

```powershell
.\infra\terraform\validate.ps1
```

Debes ver confirmación limpia de `terraform fmt -check` y `terraform validate` con **0 errores**.

### 3.2. Ejecutar `init`, `plan` y `apply`

Si tienes `terraform` instalado en tu PATH, ejecuta directamente dentro de `infra/terraform/`:

```powershell
Set-Location infra\terraform
terraform init
terraform plan -out=tfplan
```

Si prefieres ejecutarlo mediante Docker (sin instalar Terraform localmente), usa esta función auxiliar en la misma ventana de PowerShell donde definiste `$env:RENDER_API_KEY` y `$env:RENDER_OWNER_ID`:

```powershell
$tfDir = (Resolve-Path ".\infra\terraform").Path
function Invoke-Tf {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ArgsList)
    docker run --rm -it `
        -v "${tfDir}:/workspace" `
        -w /workspace `
        -e "RENDER_API_KEY=$env:RENDER_API_KEY" `
        -e "RENDER_OWNER_ID=$env:RENDER_OWNER_ID" `
        hashicorp/terraform:1.9 @ArgsList
}

Invoke-Tf init
Invoke-Tf plan -out=tfplan
```

### 3.3. Revisar el plan antes de aplicar

Verifica en la salida de `plan` que:
1. Se crearán **3 recursos** (`render_project.admin_proyectos`, `render_web_service.api_gestor` y `render_web_service.cliente`).
2. Las variables sensibles (`db_url`, `db_username`, `db_password`, `render_api_key`) aparecen ocultas como `(sensitive value)`.
3. La variable `API_BASE_URL` del frontend está enlazada automáticamente a `render_web_service.api_gestor.url`.

Cuando todo sea correcto, aplica el plan y consulta las URLs generadas:

```powershell
# Con Terraform nativo:
terraform apply tfplan
terraform output

# O con el contenedor Docker:
Invoke-Tf apply tfplan
Invoke-Tf output
```

> [!TIP]
> **Para demostrar reproducibilidad o limpiar recursos:** Al terminar tus pruebas finales (después de tu evaluación), puedes desmontar todo con un solo comando: `terraform destroy` (o `Invoke-Tf destroy`). **No ejecutes `destroy` antes de tu defensa del 4 de diciembre.**

---

## Paso 4: Verificar las URLs en Vivo en Render + Neon PostgreSQL

Render tardará entre **3 y 6 minutos** en construir por primera vez las imágenes Docker multi-etapa de Java 21. Supervisa el progreso en `https://dashboard.render.com` hasta que ambos servicios muestren estado **`Live`**.

Guarda tus URLs de salida en variables de PowerShell (reemplaza por los valores reales de `terraform output`):

```powershell
$API_URL    = "https://<tu-servicio-api>.onrender.com"
$CLIENT_URL = "https://<tu-servicio-cliente>.onrender.com"
```

### 4.1. Verificar salud y métricas Actuator

*(Nota: si el servicio estaba dormido por el plan gratuito, la primera petición puede tardar 30–60 segundos en despertar el contenedor.)*

```powershell
# 1. Salud del backend (verifica Spring Boot + conexión TLS a Neon PostgreSQL)
Invoke-RestMethod "$API_URL/actuator/health" | ConvertTo-Json -Depth 5

# 2. Salud del frontend
Invoke-RestMethod "$CLIENT_URL/actuator/health" | ConvertTo-Json -Depth 5

# 3. Verificar exposición de métricas Prometheus
(Invoke-WebRequest "$API_URL/actuator/prometheus").StatusCode
(Invoke-WebRequest "$CLIENT_URL/actuator/prometheus").StatusCode
```

Debes obtener `"status": "UP"` en ambos `/actuator/health` y código `200` en `/actuator/prometheus`.

### 4.2. Verificación funcional en el navegador

1. Abre `$CLIENT_URL` en tu navegador.
2. Verifica que carga la vista `home` con estilos Bootstrap/FontAwesome correctos.
3. Inicia sesión o registra un usuario de prueba y navega a proyectos/tareas.
4. Confirma que las acciones en el frontend reflejan persistencia real en **Neon PostgreSQL** (evidenciando que `API_BASE_URL` enlaza correctamente Frontend → Backend → Neon).

---

## Paso 5: Monitoreo y Pruebas de Carga contra Render

### 5.1. Levantar el Stack de Observabilidad (Local o Apuntando a Render)

> [!IMPORTANT]
> Ejecuta siempre `docker-compose.app.yml` y `monitoring/docker-compose.monitoring.yml` como **dos comandos separados** compartiendo el mismo nombre de proyecto (`-p admin-proyectos`), para que las rutas relativas de `monitoring/` se resuelvan correctamente y ambos stacks compartan la red `devops-net`.

**Opción A — Monitorear el entorno local contenerizado:**

```powershell
docker compose -p admin-proyectos -f docker-compose.app.yml --profile local-db up -d --build
docker compose -p admin-proyectos -f monitoring/docker-compose.monitoring.yml up -d
```

**Opción B — Monitorear tus servicios en vivo en Render Cloud desde Grafana local:**

1. Abre `monitoring/prometheus/prometheus.render.yml` y sustituye los hostnames de ejemplo por los dominios reales obtenidos de `terraform output api_url` y `terraform output client_url` (solo el dominio, sin `https://`).
2. Levanta (o recrea) Prometheus apuntando a la configuración HTTPS de Render:

```powershell
$env:PROMETHEUS_CONFIG = "./prometheus/prometheus.render.yml"
docker compose -p admin-proyectos -f monitoring/docker-compose.monitoring.yml up -d --force-recreate prometheus
```

*(Para volver después al modo local: `Remove-Item Env:PROMETHEUS_CONFIG -ErrorAction SilentlyContinue` y repite el comando `up -d --force-recreate prometheus`.)*

3. Verifica en el navegador:
   - **Prometheus Targets:** `http://localhost:9090/targets` → `api-gestor` y `cliente` en estado **`UP`**.
   - **Prometheus Alerts / Rules:** `http://localhost:9090/alerts` → las 5 reglas del grupo `admin-proyectos-slo-alerts` (`ServiceDown`, `HighHttpErrorRate5xx`, `HighHttpLatencyP95`, `HighJvmHeapUsage`, `HighProcessCpuUsage`) cargadas.
   - **Alertmanager:** `http://localhost:9093` → agrupación y regla de inhibición activas.
   - **Grafana:** `http://localhost:3000` (credenciales locales por defecto en `monitoring/.env.example`: `admin` / `changeme`) → abre el tablero aprovisionado automáticamente **Admin Proyectos — Observabilidad DevOps** (`uid: admin-proyectos-devops`, 11 paneles con métricas HTTP, latencia p50/p95/p99, memoria JVM Heap, CPU, alertas activas y logs Loki con `traceId`/`spanId`).

### 5.2. Ejecutar Pruebas de Rendimiento con Grafana k6 contra Render

Respetando los límites éticos del plan gratuito de Render (`-Target render` escala automáticamente los usuarios virtuales a `VUS_SCALE=0.5`, máximo 10 VUs, y solo consulta endpoints de lectura sin mutar Neon PostgreSQL):

```powershell
# 1. Smoke test contra Render (calentamiento y verificación rápida: 2 VUs / 20 s)
.\performance\run-k6.ps1 -Mode smoke -Target render -ApiUrl $API_URL -ClientUrl $CLIENT_URL

# 2. Load test controlado contra Render (pico ético de 10 VUs con VUS_SCALE=0.5)
.\performance\run-k6.ps1 -Mode load -Target render -ApiUrl $API_URL -ClientUrl $CLIENT_URL
```

Revisa los reportes generados en `performance/reports/` (archivos `.json`, `.md` y `.html` autocontenido) y compáralos contra la **línea base local contenerizada ya verificada** (`performance/reports/smoke-local-verified.md` y `load-local-verified.{md,html}`: **4,816 peticiones**, **62.71 req/s**, **p95 8.85 ms**, **p99 12.51 ms**, **0.000% errores**, **7/7 umbrales PASS**).

---

## Paso 6: Guión de Defensa Presencial (Viernes 4 de diciembre de 2026 — 10 Minutos)

### Preparación 15 Minutos Antes de Pasar al Frente

1. **Despierta ambos servicios en Render** abriendo `$API_URL/actuator/health` y `$CLIENT_URL` para evitar esperar el *cold start* frente al profesor.
2. Deja abiertas en pestañas ordenadas del navegador:
   1. Repositorio GitHub (`Enrique1189/admin-proyectos`)
   2. Jenkins local (`http://localhost:8080`) y SonarQube (`http://localhost:9000`)
   3. Dashboard de Render (`api-gestor` y `cliente` en verde `Live`)
   4. Aplicación desplegada en vivo (`$CLIENT_URL`) y `/actuator/health`
   5. Grafana (`http://localhost:3000`), Prometheus (`http://localhost:9090/targets` y `/alerts`) y Alertmanager (`http://localhost:9093`)
3. Ten abierta una terminal PowerShell en la raíz del proyecto lista para mostrar `validate.ps1`, `terraform output` y el reporte más reciente de `k6`.

### Cronograma Minuto a Minuto (10 Minutos Exactos)

| Tiempo | Bloque | Qué Mostrar y Qué Explicar |
| :---: | :--- | :--- |
| **0:00 – 1:00** | **1. Contexto y Arquitectura** | Presenta el salto de Unidad II → Unidad III apoyándote en el diagrama Mermaid de `docs/Informe_Tecnico_Evaluacion_Final_DevOps_IaC.md`. Explica en una frase por qué cada pieza encaja (Jenkins local + Terraform `render-oss/render` + Docker + Render + Neon + Prometheus/Grafana/Loki/OTel + k6). |
| **1:00 – 3:00** | **2. IaC con Terraform** | Muestra `infra/terraform/main.tf`, `variables.tf` (`sensitive = true`) y `outputs.tf`. Ejecuta `.\infra\terraform\validate.ps1` en vivo y muestra cómo `API_BASE_URL` se conecta dinámicamente al backend sin hardcodear URLs. Enseña `.gitignore` demostrando cero secretos en Git. |
| **3:00 – 5:00** | **3. Despliegue Cloud Vivo (Render + Neon)** | Enseña ambos servicios `Live` en Render, abre `/actuator/health` (`UP`) y ejecuta una acción real en la app web (`$CLIENT_URL`) demostrando comunicación real Frontend → Backend → Neon PostgreSQL bajo HTTPS/TLS. |
| **5:00 – 6:30** | **4. Circuito CI/CD, Calidad y Seguridad** | Abre Jenkins (`Jenkinsfile`), muestra las etapas (Java 21, Surefire, JaCoCo $\ge 80\%$, SonarQube, Semgrep SAST, Docker Build, Terraform Validate y CD opcional con *Deploy Hooks*). Señala rápidamente cobertura en SonarQube y cero secretos en el repo. |
| **6:30 – 8:00** | **5. Monitoreo, Observabilidad y Alertas** | Muestra Prometheus Targets `UP`, las 5 reglas PromQL en `/alerts`, Alertmanager y el tablero aprovisionado en Grafana (métricas HTTP, JVM Heap para 512 MB, CPU y logs en Loki mostrando `traceId` y `spanId`). |
| **8:00 – 9:15** | **6. Rendimiento (k6) e Incidencias** | Muestra `performance/k6/load-test.js`, los resultados reales verificados (línea base local: **4,816** reqs, **62.71 req/s**, **p95 8.85 ms**, **0% error**, **7/7 PASS** + reporte contra Render) y destaca 2–3 incidencias reales de tu Bitácora (`INC-U3-01` credenciales Neon, `INC-U3-02` `@GetMapping`, `INC-U3-03` `API_BASE_URL`, `INC-U3-07` buckets histograma Micrometer). |
| **9:15 – 10:00** | **7. Conclusiones y Limitaciones** | Cierra con honestidad técnica: logros comprobados, limitaciones conocidas del plan gratuito (*cold start*, estado local Terraform, deuda técnica DTO/BCrypt) y cómo escalaría a producción empresarial. |

---

## Paso 7: Banco de las 10 Preguntas Técnicas Más Difíciles del Profesor (y Cómo Responderlas)

### 1. *¿Por qué usaste Terraform y no Ansible (o por qué no usaste ambos)?*
> **Respuesta sólida:** Terraform y Ansible resuelven capas distintas. **Terraform** es aprovisionamiento declarativo de infraestructura cloud con archivo de estado (`tfstate`), grafo de dependencias, previsualización con `terraform plan` y destrucción reproducible (`terraform destroy`). **Ansible** gestiona configuración sobre sistemas operativos vía SSH en VMs o servidores *bare-metal*. Como aquí usamos una arquitectura **PaaS + contenedores inmutables (Render + Docker)**, no administramos máquinas virtuales ni SSH: la configuración del entorno va sellada de forma reproducible dentro de los `Dockerfile` multi-etapa y Terraform aprovisiona los servicios y sus variables de entorno. Agregar Ansible sería sobre-ingeniería sin objetivo técnico real.

### 2. *¿Por qué elegiste Render en vez de AWS, Azure o GCP? ¿El plan gratuito no es una limitación?*
> **Respuesta sólida:** Render ofrece un PaaS orientado a Docker con TLS automático, health checks nativos sobre `/actuator/health`, despliegue continuo desde GitHub y un proveedor oficial de Terraform (`render-oss/render`). Frente a AWS/Azure, evita complejidad innecesaria de VPC/IAM y el riesgo de sobrecostos accidentales en un proyecto académico. Reconocemos las limitaciones del plan gratuito (512 MB de RAM y *spin-down* tras 15 min de inactividad), y precisamente por eso optimizamos la JVM (`-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC`), acotamos HikariCP a 5 conexiones y diseñamos pruebas k6 éticas y controladas.

### 3. *¿Dónde está tu `terraform.tfstate` y qué pasaría si trabajaras en un equipo de 5 desarrolladores?*
> **Respuesta sólida:** En este proyecto individual el archivo `terraform.tfstate` vive localmente y está excluido de Git en `.gitignore` porque el estado puede contener valores sensibles en texto plano. En un equipo de 5 personas jamás se comparte por Git ni se deja en una laptop: se configura un **Remote Backend** cifrado con bloqueo de estado (*state locking*), como **HCP Terraform** o **AWS S3 + DynamoDB**, para evitar carreras cuando dos ingenieros ejecutan `apply` al mismo tiempo.

### 4. *Me dices que no hay contraseñas en Git, pero antes tenías la contraseña de Neon en `application.properties`. ¿Con borrarla basta?*
> **Respuesta sólida:** No basta solo con borrarla del commit actual, porque queda en el historial de Git si alguna vez se hizo *push*. Por eso aplicamos dos medidas complementarias: primero, eliminamos el secreto del archivo sustituyéndolo por variables de entorno (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`) y protegimos `.env`/`*.tfvars` en `.gitignore`; segundo, **rotamos la contraseña directamente en la consola de Neon** para invalidar inmediatamente la credencial anterior.

### 5. *¿Cómo sabe el microservicio Cliente dónde está el Backend en Render sin tener `localhost:8081` en el código?*
> **Respuesta sólida:** En `GestorController.java` externalizamos la URL base con `@Value("${api.base-url:http://localhost:8081}")` y la mapeamos en `application.properties` a `${API_BASE_URL:http://localhost:8081}`, sin romper los constructores de pruebas unitarias. En local, `docker-compose.app.yml` inyecta `http://api-gestor:8081` sobre la red `devops-net`; en la nube, **Terraform** lee dinámicamente el atributo `.url` del servicio backend en Render y lo inyecta en la variable `API_BASE_URL` del cliente automáticamente.

### 6. *¿Por qué mantuviste Jenkins local en lugar de mover todo el CI/CD a GitHub Actions?*
> **Respuesta sólida:** Por continuidad arquitectónica con la Unidad II y control de recursos. Jenkins local corre en Docker junto con nuestra instancia local de **SonarQube Community LTS** sin exponer SonarQube a Internet, sin límites mensuales de minutos gratuitos para compilar Java 21, correr Semgrep, construir imágenes Docker y validar Terraform, y aun así logra Despliegue Continuo hacia la nube disparando *Deploy Hooks* de Render con credenciales protegidas en Jenkins.

### 7. *¿Cuál es la diferencia entre monitoreo y observabilidad, y cómo se refleja en tu proyecto?*
> **Respuesta sólida:** El **monitoreo** responde preguntas conocidas de antemano ("¿está arriba el servicio?", "¿la latencia superó 1.5 s?"), lo cual cubrimos con Prometheus y las 5 reglas de Alertmanager. La **observabilidad** permite diagnosticar fallos desconocidos inspeccionando el estado interno desde afuera mediante tres pilares: **métricas** (Actuator/Micrometer/Prometheus), **logs estructurados** (Promtail + Loki) y **trazas correlacionadas** (`micrometer-tracing-bridge-otel` inyectando `traceId` y `spanId` en los logs para seguir una petición completa).

### 8. *¿Por qué miras el percentil p95 en k6 en vez de quedarte solo con el promedio, y por qué no probaste con 500 usuarios virtuales?*
> **Respuesta sólida:** El promedio (`avg`) oculta picos severos: si el 95% responde en 30 ms y el 5% tarda 4 segundos, el promedio parece bajo pero 1 de cada 20 usuarios sufre lentitud grave. El **p95** garantiza que el 95% de las solicitudes responde por debajo de ese tiempo. No lanzamos 500 VUs porque sería antiético y técnicamente inválido contra un plan gratuito de 512 MB: en pruebas de rendimiento se dimensiona la carga a la capacidad real del entorno objetivo para encontrar su línea base y validar umbrales sin causar denegación de servicio.

### 9. *¿Cómo funcionan tus alertas en Prometheus y Alertmanager? ¿Qué ocurre si cae `Ejercicio5MyAPIGestor`?*
> **Respuesta sólida:** Prometheus realiza *scraping* cada 15 segundos a `/actuator/prometheus`. Si el backend cae, la métrica `up` cambia de `1` a `0`. Al mantenerse así durante 1 minuto (`for: 1m`), la regla `ServiceDown` pasa de estado `Pending` a `Firing` con severidad `critical` y Prometheus envía la alerta a **Alertmanager** (`:9093`), que la agrupa por `alertname`, `service` y `severity` para evitar tormentas de notificaciones y la despacha al receptor configurado.

### 10. *Si mañana tuvieras que llevar este proyecto a una empresa real con clientes de pago, ¿qué deuda técnica corregirías primero?*
> **Respuesta sólida:** Cuatro prioridades claras documentadas en la Sección 8.2 del informe: (1) implementar **Spring Security** con hash **BCrypt/Argon2** para contraseñas de usuarios y autenticación basada en sesiones seguras/JWT; (2) reemplazar las entidades JPA en controladores (`@SuppressWarnings("java:S4684")`) por **DTOs** con `@Valid` para eliminar riesgo de *Mass Assignment*; (3) cambiar `ddl-auto=update` por migraciones versionadas con **Flyway**; y (4) mover el `tfstate` a un *remote backend* con bloqueo de estado y habilitar alertas reales (Slack/PagerDuty) + TLS en toda la capa de observabilidad.
