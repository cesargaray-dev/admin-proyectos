# Stack de Observabilidad y Monitoreo (`monitoring/`)

Stack completo de observabilidad open-source para los microservicios **Ejercicio5MyAPIGestor** (Backend) y **Ejercicio5Cliente** (Frontend), basado en **Prometheus + Alertmanager + Grafana + Loki + Promtail** y conectado a las métricas Micrometer/Actuator y trazas OpenTelemetry (`traceId`/`spanId`) de Spring Boot 3.

## 1. Arquitectura y Puertos

| Servicio | Imagen | Puerto Host | Propósito |
| --- | --- | --- | --- |
| **Prometheus** | `prom/prometheus:v2.54.1` | `9090` | Recolección (*scraping*) de `/actuator/prometheus` y evaluación de reglas de alerta |
| **Alertmanager** | `prom/alertmanager:v0.27.0` | `9093` | Agrupación, enrutamiento e inhibición de alertas |
| **Grafana** | `grafana/grafana:11.2.2` | `3000` | Visualización con datasources y tablero aprovisionados como código |
| **Loki** | `grafana/loki:2.9.10` | `3100` | Agregación e indexación centralizada de logs |
| **Promtail** | `grafana/promtail:2.9.10` | *(interno 9080)* | Recolección de logs de contenedores vía Docker Engine (`docker_sd_configs`) |

> **Sin colisión de puertos:** Jenkins (`8080`, `50000`), API Gestor (`8081`), Cliente Web (`8082`) y SonarQube (`9000`) operan en puertos independientes. Todos los servicios de aplicación y monitoreo se conectan a la red compartida `devops-net`.

## 2. Estructura de Archivos

```text
monitoring/
├── .env.example                                  # Variables locales seguras (sin secretos reales)
├── docker-compose.monitoring.yml                 # Orquestación del stack de observabilidad
├── prometheus/
│   ├── prometheus.yml                            # Scraping local (api-gestor:8081, cliente:8082)
│   ├── prometheus.render.yml                     # Plantilla HTTPS para Render Cloud
│   └── alert_rules.yml                           # 5 reglas PromQL (SLO + recursos JVM)
├── alertmanager/
│   └── alertmanager.yml                          # Ruteo por severidad + inhibición + webhooks placeholder
├── loki/
│   └── loki-config.yml                           # Configuración compatible con Loki 2.9.10
├── promtail/
│   └── promtail-config.yml                       # Docker SD + extracción de nivel y app (con traceId en log)
└── grafana/
    └── provisioning/
        ├── datasources/datasources.yml           # Datasources Prometheus (uid: prometheus) y Loki (uid: loki)
        └── dashboards/
            ├── dashboards.yml                    # Auto-aprovisionamiento de tableros
            └── admin-proyectos-devops.json       # Tablero preconstruido (uid: admin-proyectos-devops)
```

## 3. Ejecución Local Integrada (Docker Compose)

1. *(Opcional)* Crea `monitoring/.env` desde `monitoring/.env.example` si deseas cambiar las credenciales locales de desarrollo de Grafana (`GF_ADMIN_USER` / `GF_ADMIN_PASSWORD`, por defecto `admin` / `changeme`, **uso exclusivo local**):

   ```powershell
   Copy-Item monitoring\.env.example monitoring\.env
   ```

2. Levanta primero los microservicios y enseguida el stack de monitoreo compartiendo el mismo nombre de proyecto (`-p admin-proyectos`) para que los volúmenes relativos de `monitoring/` se resuelvan correctamente y ambos compartan la red `devops-net`:

   ```powershell
   docker compose -p admin-proyectos -f docker-compose.app.yml --profile local-db up -d --build
   docker compose -p admin-proyectos -f monitoring/docker-compose.monitoring.yml up -d
   ```

3. Verifica los endpoints de salud y descubrimiento:
   - **Prometheus Targets:** <http://localhost:9090/targets> (verifica que `api-gestor` y `cliente` aparezcan en estado `UP`).
   - **Prometheus Rules & Alerts:** <http://localhost:9090/rules> y <http://localhost:9090/alerts>.
   - **Alertmanager:** <http://localhost:9093>.
   - **Grafana:** <http://localhost:3000> (tablero automático: **Admin Proyectos — Observabilidad DevOps**, UID `admin-proyectos-devops`).
   - **Loki Ready:** <http://localhost:3100/ready>.

## 4. Monitoreo de Servicios en Vivo en Render Cloud

Para monitorear las instancias desplegadas en **Render** directamente desde tu Prometheus + Grafana locales durante la defensa:

1. Edita `monitoring/prometheus/prometheus.render.yml` y coloca los hostnames exactos obtenidos de `terraform output api_url` y `terraform output client_url` (solo el dominio, sin `https://`).
2. Recrea el contenedor de Prometheus apuntando a la configuración de Render:

   ```powershell
   $env:PROMETHEUS_CONFIG = "./prometheus/prometheus.render.yml"
   docker compose -p admin-proyectos -f monitoring/docker-compose.monitoring.yml up -d --force-recreate prometheus
   ```

3. Confirma en <http://localhost:9090/targets> que los targets HTTPS en Render estén `UP` y abre el tablero en <http://localhost:3000>.
4. Para volver al modo local:

   ```powershell
   Remove-Item Env:PROMETHEUS_CONFIG -ErrorAction SilentlyContinue
   docker compose -p admin-proyectos -f monitoring/docker-compose.monitoring.yml up -d --force-recreate prometheus
   ```

## 5. Reglas de Alerta Configuradas (`alert_rules.yml`)

| Alerta | Condición PromQL | Ventana (`for`) | Severidad | Categoría |
| --- | --- | --- | --- | --- |
| `ServiceDown` | `up{job=~"api-gestor\|cliente"} == 0` | `1m` | `critical` | Disponibilidad |
| `HighHttpErrorRate5xx` | Ratio HTTP `5xx` > `5%` en ventana de 2m | `2m` | `critical` | Confiabilidad |
| `HighHttpLatencyP95` | `histogram_quantile(0.95, ...)` > `1.5s` | `2m` | `warning` | Latencia |
| `HighJvmHeapUsage` | `jvm_memory_used_bytes / jvm_memory_max_bytes` (heap) > `85%` | `2m` | `warning` | Memoria |
| `HighProcessCpuUsage` | `process_cpu_usage > 0.85` | `2m` | `warning` | CPU |

Además, Alertmanager incluye una **regla de inhibición** que suprime alertas `warning` cuando `ServiceDown` está activa para el mismo servicio, evitando ruido de alertas en cascada.

## 6. Trazabilidad en Logs (Loki + OpenTelemetry)

Promtail recolecta automáticamente los logs de los contenedores con `docker_sd_configs` y extrae `level` y `app` como etiquetas de bajo volumen, manteniendo `traceId` y `spanId` dentro de la línea de log para evitar explosión de cardinalidad en el índice de Loki.

Para filtrar una traza específica en Grafana Explore (Loki):

```logql
{service=~"api-gestor|cliente"} |= "<traceId>"
```

## 7. Detener y Limpiar

```powershell
docker compose -p admin-proyectos -f monitoring/docker-compose.monitoring.yml down
```

*(Agrega `-v` únicamente si deseas borrar los volúmenes de datos históricos de Prometheus, Grafana y Loki.)*
