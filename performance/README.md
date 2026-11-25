# Suite de Evaluación de Rendimiento (`performance/`)

Suite reproducible de pruebas de humo (*smoke*) y carga controlada (*load*) con **Grafana k6**, diseñada para evaluar el rendimiento real de **Ejercicio5MyAPIGestor** (Backend REST + PostgreSQL) y **Ejercicio5Cliente** (Frontend Thymeleaf + proxy REST) tanto en el entorno local contenerizado como en el despliegue en **Render Cloud**.

## 1. Metodología y Uso Ético de Recursos

- **100% endpoints reales de solo lectura:** Todos los escenarios invocan rutas reales verificadas directamente en los controladores Spring Boot (`ProyectosController`, `TareasController`, `ComentariosController`, `UsuarioController`, `AsignacionesController` y `GestorController`), evitando operaciones `add`/`update`/`delete` para **no contaminar ni alterar los datos de Neon PostgreSQL**.
- **Límites éticos en capa gratuita (Render + Neon Free Tier):**
  - Se incorpora *think time* (`sleep(0.5s - 1.0s)`) entre grupos de solicitudes para simular navegación humana real en lugar de tráfico abusivo tipo DoS.
  - En modo `-Target local`, la prueba de carga escala hasta un pico controlado de **20 VUs** (75 s totales: `15s -> 5 VUs`, `30s -> 10 VUs`, `15s -> 20 VUs`, `15s -> 0 VUs`).
  - En modo `-Target render`, el script aplica automáticamente `VUS_SCALE=0.5` (**máximo 10 VUs**, umbral p95 adaptado a latencia de red WAN) para proteger los límites de CPU/RAM (512 MB) y cómputo gratuito de Render y Neon.

## 2. Endpoints Evaluados

### Backend (`Ejercicio5MyAPIGestor`)
- `GET /actuator/health` y `GET /actuator/info`
- `POST /buscarProyectos`, `POST /buscarTareas`, `POST /buscarComentarios`, `POST /buscarUsuarios`, `POST /buscarAsignaciones`
- `GET /buscarProyecto?id_proyecto=1`

### Frontend (`Ejercicio5Cliente`)
- `GET /actuator/health` y `GET /actuator/info`
- Vistas SSR Thymeleaf: `GET /`, `GET /login`, `GET /inicio`, `GET /tutorial`
- Flujos integrados E2E (`Cliente -> API -> PostgreSQL`): `GET /proyecto`, `POST /consultarProyectos`, `POST /consultarTareas`, `POST /consultarComentarios`

## 3. Comandos de Ejecución

### Entorno Local (Docker Compose en `localhost:8081` y `localhost:8082`)

```powershell
# Smoke test rápido (2 VUs, 20s)
powershell -ExecutionPolicy Bypass -File .\performance\run-k6.ps1 -Mode smoke

# Carga controlada (rampa 5 -> 10 -> 20 -> 0 VUs, 75s)
powershell -ExecutionPolicy Bypass -File .\performance\run-k6.ps1 -Mode load

# Escenario de oleadas variables (ramping-arrival-rate, 155s: Base -> Ola 1 -> Valle -> Pico -> Meseta -> Fin)
powershell -ExecutionPolicy Bypass -File .\performance\run-k6.ps1 -Mode variable
```

### Despliegue en Vivo en Render Cloud (HTTPS)

```powershell
# Smoke test contra Render
.\performance\run-k6.ps1 -Mode smoke -Target render `
  -ApiUrl https://<tu-api>.onrender.com `
  -ClientUrl https://<tu-cliente>.onrender.com

# Carga controlada contra Render (escala automática 0.5x = máx. 10 VUs)
powershell -ExecutionPolicy Bypass -File .\performance\run-k6.ps1 -Mode load -Target render `
  -ApiUrl https://admin-proyectos-api-gestor.onrender.com `
  -ClientUrl https://admin-proyectos-cliente.onrender.com

# Escenario de oleadas variables contra Render (ideal para validar variaciones en vivo en Grafana)
powershell -ExecutionPolicy Bypass -File .\performance\run-k6.ps1 -Mode variable -Target render `
  -ApiUrl https://admin-proyectos-api-gestor.onrender.com `
  -ClientUrl https://admin-proyectos-cliente.onrender.com
```

> También puedes definir `$env:RENDER_API_URL` y `$env:RENDER_CLIENT_URL` y ejecutar directamente `.\performance\run-k6.ps1 -Mode smoke -Target render`.

## 4. Interpretación de Métricas y Umbrales (`thresholds`)

| Métrica | Significado Técnico | Umbral Local | Umbral Render |
| --- | --- | --- | --- |
| **p50 (`med`)** | Latencia típica (50% de solicitudes por debajo) | Informativo | Informativo |
| **p95 (`p(95)`)** | Latencia del 95% de usuarios (SLO principal) | `< 1500 ms` | `< 2500 ms` |
| **p99 (`p(99)`)** | Latencia de cola (*tail latency*) | `< 2500 ms` | `< 4000 ms` |
| **Throughput (`http_reqs.rate`)** | Solicitudes procesadas por segundo (RPS) | Informativo | Informativo |
| **Tasa de error (`http_req_failed`)** | Proporción de fallos HTTP/red | `< 1%` (smoke) / `< 2%` (load) | `< 1%` / `< 2%` |
| **`business_checks_rate`** | Validaciones funcionales (status 200, JSON válido, health `UP`) | `> 99%` (smoke) / `> 98%` (load) | `> 99%` / `> 98%` |

## 5. Reportes Generados

Cada ejecución guarda automáticamente evidencia estructurada en `performance/reports/`:
- `<prefijo>.json` — Salida completa de métricas k6 para auditoría y trazabilidad.
- `<prefijo>.md` — Tabla resumen en Markdown lista para anexar al informe técnico.
- `<prefijo>.html` — *(en `load-test.js` y `variable-load-test.js`)* Reporte visual autónomo para abrir en el navegador durante la defensa.
