# Reporte de Prueba de Carga Controlada — Grafana k6 (Admin Proyectos)

- **Fecha (UTC):** 2026-11-22T03:26:57.071Z
- **Entorno objetivo:** `local` (escala VUs: `1x`)
- **API URL:** `http://localhost:8081`
- **Cliente URL:** `http://localhost:8082`
- **Perfil de etapas:** 15s -> 5 VUs | 30s -> 10 VUs | 15s -> 20 VUs (pico controlado) | 15s -> 0 VUs
- **Estado global de umbrales:** **PASS**

## 1. Métricas Globales HTTP

| Indicador | Valor |
| --- | --- |
| Total de solicitudes HTTP (`http_reqs`) | 4816 |
| Iteraciones completadas | 344 |
| Throughput promedio (RPS) | 62.71 req/s |
| Tasa de error HTTP (`http_req_failed`) | 0.000% (0 fallos) |
| Checks de negocio exitosos | 100.00% (5504/5504) |
| Latencia mínima | 0.00 ms |
| Latencia promedio (avg) | 4.49 ms |
| Latencia mediana (p50) | 3.68 ms |
| Latencia p90 | 7.55 ms |
| Latencia p95 | 8.85 ms |
| Latencia p99 | 12.51 ms |
| Latencia máxima | 41.47 ms |

## 2. Desglose de Latencia por Capa

| Capa / Servicio | avg (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | max (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| Backend REST (`api-gestor`) | 3.68 | 3.44 | 4.71 | 5.44 | 8.96 | 39.93 |
| Frontend Web (`cliente`) | 5.29 | 5.72 | 8.56 | 10.04 | 13.88 | 41.47 |
| Integración E2E (`cliente -> api -> DB`) | 7.29 | 6.83 | 9.41 | 10.82 | 14.26 | 41.47 |

## 3. Evaluación de Umbrales (Thresholds)

| Métrica | Umbral | Resultado |
| --- | --- | --- |
| `client_response_time` | `p(95)<1500` | **PASS** |
| `e2e_proxy_response_time` | `p(95)<1500` | **PASS** |
| `api_response_time` | `p(95)<1000` | **PASS** |
| `http_req_duration` | `p(95)<1500` | **PASS** |
| `http_req_duration` | `p(99)<2500` | **PASS** |
| `business_checks_rate` | `rate>0.98` | **PASS** |
| `http_req_failed` | `rate<0.02` | **PASS** |
