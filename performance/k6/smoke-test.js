import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ============================================================================
// Admin Proyectos — k6 Smoke Test (Lightweight Functional & Availability Check)
// ============================================================================
// Verifies 100% real read-only endpoints across Ejercicio5MyAPIGestor (API)
// and Ejercicio5Cliente (Frontend) without mutating database state.
// ============================================================================

const API_URL = (__ENV.API_URL || 'http://localhost:8081').replace(/\/+$/, '');
const CLIENT_URL = (__ENV.CLIENT_URL || 'http://localhost:8082').replace(/\/+$/, '');
const TARGET_ENV = (__ENV.TARGET_ENV || 'local').toLowerCase();
const REPORT_PREFIX = __ENV.REPORT_PREFIX || 'performance/reports/smoke-latest';

const apiDuration = new Trend('api_response_time', true);
const clientDuration = new Trend('client_response_time', true);
const businessChecks = new Rate('business_checks_rate');

export const options = {
  vus: Number(__ENV.SMOKE_VUS || 2),
  duration: __ENV.SMOKE_DURATION || '20s',
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [TARGET_ENV === 'render' ? 'p(95)<2500' : 'p(95)<1500'],
    checks: ['rate>0.99'],
    business_checks_rate: ['rate>0.99'],
  },
  tags: {
    test_type: 'smoke',
    target_env: TARGET_ENV,
  },
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function recordCheck(passed) {
  businessChecks.add(passed ? 1 : 0);
}

export default function () {
  group('Backend API — Actuator & Read Endpoints', () => {
    // 1. Actuator Health
    const healthRes = http.get(`${API_URL}/actuator/health`, {
      tags: { service: 'api-gestor', endpoint: 'GET /actuator/health' },
    });
    apiDuration.add(healthRes.timings.duration);
    recordCheck(
      check(healthRes, {
        'API /actuator/health status 200': (r) => r.status === 200,
        'API /actuator/health is UP': (r) => {
          try {
            return r.json('status') === 'UP';
          } catch (_) {
            return false;
          }
        },
      })
    );

    // 2. Actuator Info
    const infoRes = http.get(`${API_URL}/actuator/info`, {
      tags: { service: 'api-gestor', endpoint: 'GET /actuator/info' },
    });
    apiDuration.add(infoRes.timings.duration);
    recordCheck(
      check(infoRes, {
        'API /actuator/info status 200': (r) => r.status === 200,
      })
    );

    // 3. Real Controller Read Endpoints (POST /buscarProyectos, /buscarTareas, /buscarUsuarios)
    const proyectosRes = http.post(`${API_URL}/buscarProyectos`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarProyectos' },
    });
    apiDuration.add(proyectosRes.timings.duration);
    recordCheck(
      check(proyectosRes, {
        'API POST /buscarProyectos status 200': (r) => r.status === 200,
        'API POST /buscarProyectos returns JSON array': (r) => {
          try {
            return Array.isArray(r.json());
          } catch (_) {
            return false;
          }
        },
      })
    );

    const tareasRes = http.post(`${API_URL}/buscarTareas`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarTareas' },
    });
    apiDuration.add(tareasRes.timings.duration);
    recordCheck(
      check(tareasRes, {
        'API POST /buscarTareas status 200': (r) => r.status === 200,
      })
    );

    const usuariosRes = http.post(`${API_URL}/buscarUsuarios`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarUsuarios' },
    });
    apiDuration.add(usuariosRes.timings.duration);
    recordCheck(
      check(usuariosRes, {
        'API POST /buscarUsuarios status 200': (r) => r.status === 200,
      })
    );

    const proyectoByIdRes = http.get(`${API_URL}/buscarProyecto?id_proyecto=1`, {
      tags: { service: 'api-gestor', endpoint: 'GET /buscarProyecto' },
    });
    apiDuration.add(proyectoByIdRes.timings.duration);
    recordCheck(
      check(proyectoByIdRes, {
        'API GET /buscarProyecto status 200': (r) => r.status === 200,
      })
    );
  });

  group('Frontend Cliente — Actuator, Views & E2E Proxy', () => {
    // 1. Actuator Health
    const clientHealthRes = http.get(`${CLIENT_URL}/actuator/health`, {
      tags: { service: 'cliente', endpoint: 'GET /actuator/health' },
    });
    clientDuration.add(clientHealthRes.timings.duration);
    recordCheck(
      check(clientHealthRes, {
        'Cliente /actuator/health status 200': (r) => r.status === 200,
        'Cliente /actuator/health is UP': (r) => {
          try {
            return r.json('status') === 'UP';
          } catch (_) {
            return false;
          }
        },
      })
    );

    // 2. Actuator Info
    const clientInfoRes = http.get(`${CLIENT_URL}/actuator/info`, {
      tags: { service: 'cliente', endpoint: 'GET /actuator/info' },
    });
    clientDuration.add(clientInfoRes.timings.duration);
    recordCheck(
      check(clientInfoRes, {
        'Cliente /actuator/info status 200': (r) => r.status === 200,
      })
    );

    // 3. Thymeleaf SSR Views
    const homeRes = http.get(`${CLIENT_URL}/`, {
      tags: { service: 'cliente', endpoint: 'GET /' },
    });
    clientDuration.add(homeRes.timings.duration);
    recordCheck(
      check(homeRes, {
        'Cliente GET / status 200': (r) => r.status === 200,
      })
    );

    const loginRes = http.get(`${CLIENT_URL}/login`, {
      tags: { service: 'cliente', endpoint: 'GET /login' },
    });
    clientDuration.add(loginRes.timings.duration);
    recordCheck(
      check(loginRes, {
        'Cliente GET /login status 200': (r) => r.status === 200,
      })
    );

    // 4. End-to-End Frontend -> Backend -> DB Endpoints
    const proyectoViewRes = http.get(`${CLIENT_URL}/proyecto`, {
      tags: { service: 'cliente', endpoint: 'GET /proyecto' },
    });
    clientDuration.add(proyectoViewRes.timings.duration);
    recordCheck(
      check(proyectoViewRes, {
        'Cliente GET /proyecto status 200': (r) => r.status === 200,
      })
    );

    const consultarProyectosRes = http.post(`${CLIENT_URL}/consultarProyectos`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'cliente', endpoint: 'POST /consultarProyectos' },
    });
    clientDuration.add(consultarProyectosRes.timings.duration);
    recordCheck(
      check(consultarProyectosRes, {
        'Cliente POST /consultarProyectos status 200': (r) => r.status === 200,
        'Cliente POST /consultarProyectos returns JSON array': (r) => {
          try {
            return Array.isArray(r.json());
          } catch (_) {
            return false;
          }
        },
      })
    );
  });

  sleep(1);
}

function fmt(val, digits = 2) {
  return typeof val === 'number' && !Number.isNaN(val) ? val.toFixed(digits) : 'N/A';
}

function buildMarkdownSummary(data) {
  const m = data.metrics || {};
  const reqs = m.http_reqs ? m.http_reqs.values : {};
  const failed = m.http_req_failed ? m.http_req_failed.values : {};
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const api = m.api_response_time ? m.api_response_time.values : {};
  const cli = m.client_response_time ? m.client_response_time.values : {};
  const chk = m.checks ? m.checks.values : {};

  const thresholdLines = [];
  for (const [metricName, metricObj] of Object.entries(m)) {
    if (metricObj && metricObj.thresholds) {
      for (const [expr, result] of Object.entries(metricObj.thresholds)) {
        thresholdLines.push(`| \`${metricName}\` | \`${expr}\` | ${result.ok ? 'PASS' : 'FAIL'} |`);
      }
    }
  }

  return [
    '# Reporte de Smoke Test — Grafana k6 (Admin Proyectos)',
    '',
    `- **Fecha (UTC):** ${new Date().toISOString()}`,
    `- **Entorno objetivo:** \`${TARGET_ENV}\``,
    `- **API URL:** \`${API_URL}\``,
    `- **Cliente URL:** \`${CLIENT_URL}\``,
    `- **Configuración:** ${options.vus} VUs durante ${options.duration}`,
    '',
    '## Métricas Globales HTTP',
    '',
    '| Métrica | Valor |',
    '| --- | --- |',
    `| Total de solicitudes (\`http_reqs\`) | ${reqs.count ?? 0} |`,
    `| Throughput (req/s) | ${fmt(reqs.rate)} req/s |`,
    `| Tasa de error HTTP (\`http_req_failed\`) | ${fmt((failed.rate || 0) * 100, 3)}% |`,
    `| Checks exitosos | ${fmt((chk.rate || 0) * 100, 2)}% (${chk.passes ?? 0}/${(chk.passes ?? 0) + (chk.fails ?? 0)}) |`,
    `| Latencia mínima | ${fmt(dur.min)} ms |`,
    `| Latencia promedio (avg) | ${fmt(dur.avg)} ms |`,
    `| Latencia mediana (p50) | ${fmt(dur.med)} ms |`,
    `| Latencia p90 | ${fmt(dur['p(90)'])} ms |`,
    `| Latencia p95 | ${fmt(dur['p(95)'])} ms |`,
    `| Latencia p99 | ${fmt(dur['p(99)'])} ms |`,
    `| Latencia máxima | ${fmt(dur.max)} ms |`,
    '',
    '## Latencia por Servicio',
    '',
    '| Servicio | avg (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | max (ms) |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| \`api-gestor\` | ${fmt(api.avg)} | ${fmt(api.med)} | ${fmt(api['p(90)'])} | ${fmt(api['p(95)'])} | ${fmt(api['p(99)'])} | ${fmt(api.max)} |`,
    `| \`cliente\` | ${fmt(cli.avg)} | ${fmt(cli.med)} | ${fmt(cli['p(90)'])} | ${fmt(cli['p(95)'])} | ${fmt(cli['p(99)'])} | ${fmt(cli.max)} |`,
    '',
    '## Evaluación de Umbrales (Thresholds)',
    '',
    '| Métrica | Umbral | Resultado |',
    '| --- | --- | --- |',
    ...thresholdLines,
    '',
  ].join('\n');
}

export function handleSummary(data) {
  const md = buildMarkdownSummary(data);
  const reqs = data.metrics.http_reqs ? data.metrics.http_reqs.values : {};
  const dur = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};

  const consoleSummary = [
    '',
    '====================================================================',
    `  k6 SMOKE TEST SUMMARY (${TARGET_ENV.toUpperCase()})`,
    '====================================================================',
    `  API_URL    : ${API_URL}`,
    `  CLIENT_URL : ${CLIENT_URL}`,
    `  Requests   : ${reqs.count ?? 0} (${fmt(reqs.rate)} req/s)`,
    `  Error Rate : ${fmt((failed.rate || 0) * 100, 3)}%`,
    `  Latency    : avg=${fmt(dur.avg)}ms | p50=${fmt(dur.med)}ms | p90=${fmt(dur['p(90)'])}ms | p95=${fmt(dur['p(95)'])}ms | p99=${fmt(dur['p(99)'])}ms`,
    `  Reports    : ${REPORT_PREFIX}.json | ${REPORT_PREFIX}.md`,
    '====================================================================',
    '',
  ].join('\n');

  return {
    stdout: consoleSummary,
    [`${REPORT_PREFIX}.json`]: JSON.stringify(data, null, 2),
    [`${REPORT_PREFIX}.md`]: md,
  };
}
