# Reporte de Smoke Test — Grafana k6 (Admin Proyectos)

- **Fecha (UTC):** 2026-11-22T03:25:39.095Z
- **Entorno objetivo:** `local`
- **API URL:** `http://localhost:8081`
- **Cliente URL:** `http://localhost:8082`
- **Configuración:** 2 VUs durante 20s

## Métricas Globales HTTP

| Métrica | Valor |
| --- | --- |
| Total de solicitudes (`http_reqs`) | 432 |
| Throughput (req/s) | 21.57 req/s |
| Tasa de error HTTP (`http_req_failed`) | 0.000% |
| Checks exitosos | 100.00% (576/576) |
| Latencia mínima | 1.93 ms |
| Latencia promedio (avg) | 9.00 ms |
| Latencia mediana (p50) | 6.08 ms |
| Latencia p90 | 14.90 ms |
| Latencia p95 | 18.71 ms |
| Latencia p99 | 37.04 ms |
| Latencia máxima | 162.40 ms |

## Latencia por Servicio

| Servicio | avg (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | max (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| `api-gestor` | 7.86 | 6.32 | 10.56 | 14.32 | 35.81 | 75.09 |
| `cliente` | 10.14 | 5.51 | 17.95 | 21.54 | 37.08 | 162.40 |

## Evaluación de Umbrales (Thresholds)

| Métrica | Umbral | Resultado |
| --- | --- | --- |
| `business_checks_rate` | `rate>0.99` | PASS |
| `http_req_failed` | `rate<0.01` | PASS |
| `checks` | `rate>0.99` | PASS |
| `http_req_duration` | `p(95)<1500` | PASS |
