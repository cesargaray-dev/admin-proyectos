import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ============================================================================
// Admin Proyectos — k6 Controlled Load Test (Ethical Resource-Aware Profile)
// ============================================================================
// - Hits ONLY real read-only endpoints verified in Spring Boot controllers so
//   production/Neon PostgreSQL data is never mutated or polluted.
// - Automatically scales virtual users via VUS_SCALE / TARGET_ENV so Render
//   and Neon Free Tiers are evaluated responsibly without overload or abuse.
// - Emits JSON, Markdown, and standalone HTML summary reports in
//   performance/reports/.
// ============================================================================

const API_URL = (__ENV.API_URL || 'http://localhost:8081').replace(/\/+$/, '');
const CLIENT_URL = (__ENV.CLIENT_URL || 'http://localhost:8082').replace(/\/+$/, '');
const TARGET_ENV = (__ENV.TARGET_ENV || 'local').toLowerCase();
const IS_RENDER = TARGET_ENV === 'render';
const DEFAULT_SCALE = IS_RENDER ? 0.5 : 1.0;
const VUS_SCALE = Math.max(0.1, Number(__ENV.VUS_SCALE || DEFAULT_SCALE));
const REPORT_PREFIX = __ENV.REPORT_PREFIX || `performance/reports/load-${TARGET_ENV}-latest`;

function scaleVus(baseVus) {
  return Math.max(1, Math.round(baseVus * VUS_SCALE));
}

const STAGE_RAMP = scaleVus(5);
const STAGE_STEADY = scaleVus(10);
const STAGE_PEAK = scaleVus(20);

// Custom observability & business metrics
const apiDuration = new Trend('api_response_time', true);
const clientDuration = new Trend('client_response_time', true);
const e2eProxyDuration = new Trend('e2e_proxy_response_time', true);
const businessChecksRate = new Rate('business_checks_rate');
const endpointErrors = new Counter('endpoint_errors');

export const options = {
  stages: [
    { duration: '15s', target: STAGE_RAMP },   // Warm-up / initial ramp-up
    { duration: '30s', target: STAGE_STEADY }, // Steady concurrent baseline
    { duration: '15s', target: STAGE_PEAK },   // Controlled peak load
    { duration: '15s', target: 0 },            // Graceful ramp-down
  ],
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: [
      IS_RENDER ? 'p(95)<2500' : 'p(95)<1500',
      IS_RENDER ? 'p(99)<4000' : 'p(99)<2500',
    ],
    api_response_time: [IS_RENDER ? 'p(95)<2000' : 'p(95)<1000'],
    client_response_time: [IS_RENDER ? 'p(95)<2500' : 'p(95)<1500'],
    e2e_proxy_response_time: [IS_RENDER ? 'p(95)<2500' : 'p(95)<1500'],
    business_checks_rate: ['rate>0.98'],
  },
  tags: {
    test_type: 'load',
    target_env: TARGET_ENV,
  },
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function trackResult(res, passed, trendMetric) {
  trendMetric.add(res.timings.duration);
  businessChecksRate.add(passed ? 1 : 0);
  if (!passed) {
    endpointErrors.add(1);
  }
}

export default function () {
  // Journey 1: Backend REST API read queries (PostgreSQL/JPA via Ejercicio5MyAPIGestor)
  group('API Gestor — Consultas REST de Lectura', () => {
    const rHealth = http.get(`${API_URL}/actuator/health`, {
      tags: { service: 'api-gestor', endpoint: 'GET /actuator/health' },
    });
    trackResult(
      rHealth,
      check(rHealth, { 'API health 200': (r) => r.status === 200 }),
      apiDuration
    );

    const rProyectos = http.post(`${API_URL}/buscarProyectos`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarProyectos' },
    });
    trackResult(
      rProyectos,
      check(rProyectos, {
        'API /buscarProyectos 200': (r) => r.status === 200,
        'API /buscarProyectos array JSON': (r) => {
          try {
            return Array.isArray(r.json());
          } catch (_) {
            return false;
          }
        },
      }),
      apiDuration
    );

    const rTareas = http.post(`${API_URL}/buscarTareas`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarTareas' },
    });
    trackResult(
      rTareas,
      check(rTareas, { 'API /buscarTareas 200': (r) => r.status === 200 }),
      apiDuration
    );

    const rComentarios = http.post(`${API_URL}/buscarComentarios`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarComentarios' },
    });
    trackResult(
      rComentarios,
      check(rComentarios, { 'API /buscarComentarios 200': (r) => r.status === 200 }),
      apiDuration
    );

    const rUsuarios = http.post(`${API_URL}/buscarUsuarios`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarUsuarios' },
    });
    trackResult(
      rUsuarios,
      check(rUsuarios, { 'API /buscarUsuarios 200': (r) => r.status === 200 }),
      apiDuration
    );

    const rAsignaciones = http.post(`${API_URL}/buscarAsignaciones`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'api-gestor', endpoint: 'POST /buscarAsignaciones' },
    });
    trackResult(
      rAsignaciones,
      check(rAsignaciones, { 'API /buscarAsignaciones 200': (r) => r.status === 200 }),
      apiDuration
    );

    const rProyectoId = http.get(`${API_URL}/buscarProyecto?id_proyecto=1`, {
      tags: { service: 'api-gestor', endpoint: 'GET /buscarProyecto' },
    });
    trackResult(
      rProyectoId,
      check(rProyectoId, { 'API /buscarProyecto 200': (r) => r.status === 200 }),
      apiDuration
    );
  });

  sleep(0.5);

  // Journey 2: Frontend SSR views (Thymeleaf via Ejercicio5Cliente)
  group('Cliente Web — Vistas Thymeleaf SSR', () => {
    const rHome = http.get(`${CLIENT_URL}/`, {
      tags: { service: 'cliente', endpoint: 'GET /' },
    });
    trackResult(
      rHome,
      check(rHome, { 'Cliente GET / 200': (r) => r.status === 200 }),
      clientDuration
    );

    const rInicio = http.get(`${CLIENT_URL}/inicio`, {
      tags: { service: 'cliente', endpoint: 'GET /inicio' },
    });
    trackResult(
      rInicio,
      check(rInicio, { 'Cliente GET /inicio 200': (r) => r.status === 200 }),
      clientDuration
    );

    const rTutorial = http.get(`${CLIENT_URL}/tutorial`, {
      tags: { service: 'cliente', endpoint: 'GET /tutorial' },
    });
    trackResult(
      rTutorial,
      check(rTutorial, { 'Cliente GET /tutorial 200': (r) => r.status === 200 }),
      clientDuration
    );
  });

  sleep(0.5);

  // Journey 3: End-to-End Frontend -> Backend -> Database integration
  group('Integracion E2E — Cliente -> API -> PostgreSQL', () => {
    const rProyectoPage = http.get(`${CLIENT_URL}/proyecto`, {
      tags: { service: 'cliente', endpoint: 'GET /proyecto' },
    });
    const okProyectoPage = check(rProyectoPage, {
      'Cliente GET /proyecto 200': (r) => r.status === 200,
    });
    clientDuration.add(rProyectoPage.timings.duration);
    trackResult(rProyectoPage, okProyectoPage, e2eProxyDuration);

    const rConsultarProyectos = http.post(`${CLIENT_URL}/consultarProyectos`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'cliente', endpoint: 'POST /consultarProyectos' },
    });
    const okConsultarProyectos = check(rConsultarProyectos, {
      'Cliente /consultarProyectos 200': (r) => r.status === 200,
      'Cliente /consultarProyectos array JSON': (r) => {
        try {
          return Array.isArray(r.json());
        } catch (_) {
          return false;
        }
      },
    });
    clientDuration.add(rConsultarProyectos.timings.duration);
    trackResult(rConsultarProyectos, okConsultarProyectos, e2eProxyDuration);

    const rConsultarTareas = http.post(`${CLIENT_URL}/consultarTareas`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'cliente', endpoint: 'POST /consultarTareas' },
    });
    const okConsultarTareas = check(rConsultarTareas, {
      'Cliente /consultarTareas 200': (r) => r.status === 200,
    });
    clientDuration.add(rConsultarTareas.timings.duration);
    trackResult(rConsultarTareas, okConsultarTareas, e2eProxyDuration);

    const rConsultarComentarios = http.post(`${CLIENT_URL}/consultarComentarios`, null, {
      headers: JSON_HEADERS,
      tags: { service: 'cliente', endpoint: 'POST /consultarComentarios' },
    });
    const okConsultarComentarios = check(rConsultarComentarios, {
      'Cliente /consultarComentarios 200': (r) => r.status === 200,
    });
    clientDuration.add(rConsultarComentarios.timings.duration);
    trackResult(rConsultarComentarios, okConsultarComentarios, e2eProxyDuration);
  });

  sleep(0.8);
}

function fmt(val, digits = 2) {
  return typeof val === 'number' && !Number.isNaN(val) ? val.toFixed(digits) : 'N/A';
}

function extractThresholds(metrics) {
  const rows = [];
  for (const [metricName, metricObj] of Object.entries(metrics || {})) {
    if (metricObj && metricObj.thresholds) {
      for (const [expr, res] of Object.entries(metricObj.thresholds)) {
        rows.push({ metric: metricName, expr, ok: Boolean(res.ok) });
      }
    }
  }
  return rows;
}

function buildMarkdownReport(data, generatedAt) {
  const m = data.metrics || {};
  const reqs = m.http_reqs ? m.http_reqs.values : {};
  const failed = m.http_req_failed ? m.http_req_failed.values : {};
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const api = m.api_response_time ? m.api_response_time.values : {};
  const cli = m.client_response_time ? m.client_response_time.values : {};
  const e2e = m.e2e_proxy_response_time ? m.e2e_proxy_response_time.values : {};
  const chk = m.checks ? m.checks.values : {};
  const iters = m.iterations ? m.iterations.values : {};
  const thresholds = extractThresholds(m);
  const allPassed = thresholds.every((t) => t.ok);

  return [
    '# Reporte de Prueba de Carga Controlada — Grafana k6 (Admin Proyectos)',
    '',
    `- **Fecha (UTC):** ${generatedAt}`,
    `- **Entorno objetivo:** \`${TARGET_ENV}\` (escala VUs: \`${VUS_SCALE}x\`)`,
    `- **API URL:** \`${API_URL}\``,
    `- **Cliente URL:** \`${CLIENT_URL}\``,
    `- **Perfil de etapas:** 15s -> ${STAGE_RAMP} VUs | 30s -> ${STAGE_STEADY} VUs | 15s -> ${STAGE_PEAK} VUs (pico controlado) | 15s -> 0 VUs`,
    `- **Estado global de umbrales:** **${allPassed ? 'PASS' : 'FAIL'}**`,
    '',
    '## 1. Métricas Globales HTTP',
    '',
    '| Indicador | Valor |',
    '| --- | --- |',
    `| Total de solicitudes HTTP (\`http_reqs\`) | ${reqs.count ?? 0} |`,
    `| Iteraciones completadas | ${iters.count ?? 0} |`,
    `| Throughput promedio (RPS) | ${fmt(reqs.rate)} req/s |`,
    `| Tasa de error HTTP (\`http_req_failed\`) | ${fmt((failed.rate || 0) * 100, 3)}% (${failed.passes ?? 0} fallos) |`,
    `| Checks de negocio exitosos | ${fmt((chk.rate || 0) * 100, 2)}% (${chk.passes ?? 0}/${(chk.passes ?? 0) + (chk.fails ?? 0)}) |`,
    `| Latencia mínima | ${fmt(dur.min)} ms |`,
    `| Latencia promedio (avg) | ${fmt(dur.avg)} ms |`,
    `| Latencia mediana (p50) | ${fmt(dur.med)} ms |`,
    `| Latencia p90 | ${fmt(dur['p(90)'])} ms |`,
    `| Latencia p95 | ${fmt(dur['p(95)'])} ms |`,
    `| Latencia p99 | ${fmt(dur['p(99)'])} ms |`,
    `| Latencia máxima | ${fmt(dur.max)} ms |`,
    '',
    '## 2. Desglose de Latencia por Capa',
    '',
    '| Capa / Servicio | avg (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | max (ms) |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    `| Backend REST (\`api-gestor\`) | ${fmt(api.avg)} | ${fmt(api.med)} | ${fmt(api['p(90)'])} | ${fmt(api['p(95)'])} | ${fmt(api['p(99)'])} | ${fmt(api.max)} |`,
    `| Frontend Web (\`cliente\`) | ${fmt(cli.avg)} | ${fmt(cli.med)} | ${fmt(cli['p(90)'])} | ${fmt(cli['p(95)'])} | ${fmt(cli['p(99)'])} | ${fmt(cli.max)} |`,
    `| Integración E2E (\`cliente -> api -> DB\`) | ${fmt(e2e.avg)} | ${fmt(e2e.med)} | ${fmt(e2e['p(90)'])} | ${fmt(e2e['p(95)'])} | ${fmt(e2e['p(99)'])} | ${fmt(e2e.max)} |`,
    '',
    '## 3. Evaluación de Umbrales (Thresholds)',
    '',
    '| Métrica | Umbral | Resultado |',
    '| --- | --- | --- |',
    ...thresholds.map((t) => `| \`${t.metric}\` | \`${t.expr}\` | **${t.ok ? 'PASS' : 'FAIL'}** |`),
    '',
  ].join('\n');
}

function buildHtmlReport(data, generatedAt) {
  const m = data.metrics || {};
  const reqs = m.http_reqs ? m.http_reqs.values : {};
  const failed = m.http_req_failed ? m.http_req_failed.values : {};
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const api = m.api_response_time ? m.api_response_time.values : {};
  const cli = m.client_response_time ? m.client_response_time.values : {};
  const e2e = m.e2e_proxy_response_time ? m.e2e_proxy_response_time.values : {};
  const thresholds = extractThresholds(m);
  const allPassed = thresholds.every((t) => t.ok);

  const thresholdRows = thresholds
    .map(
      (t) =>
        `<tr><td><code>${t.metric}</code></td><td><code>${t.expr}</code></td><td class="${t.ok ? 'pass' : 'fail'}">${t.ok ? 'PASS' : 'FAIL'}</td></tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte k6 Load Test — Admin Proyectos (${TARGET_ENV})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem auto; max-width: 960px; color: #1f2937; background: #f9fafb; }
    .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    h1 { margin-top: 0; color: #111827; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-weight: 700; font-size: 0.85rem; }
    .badge.pass { background: #dcfce7; color: #166534; }
    .badge.fail { background: #fee2e2; color: #991b1b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .kpi { background: #f3f4f6; border-radius: 8px; padding: 1rem; }
    .kpi-label { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; }
    .kpi-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
    th, td { text-align: left; padding: 0.65rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    td.pass { color: #15803d; font-weight: 700; }
    td.fail { color: #b91c1c; font-weight: 700; }
    code { background: #f3f4f6; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Evaluación de Rendimiento k6 — Admin Proyectos</h1>
    <p>
      <span class="badge ${allPassed ? 'pass' : 'fail'}">${allPassed ? 'UMBRALES SUPERADOS (PASS)' : 'UMBRALES INCUMPLIDOS (FAIL)'}</span>
    </p>
    <p><strong>Fecha (UTC):</strong> ${generatedAt} | <strong>Entorno:</strong> <code>${TARGET_ENV}</code> (escala ${VUS_SCALE}x)</p>
    <p><strong>API:</strong> <code>${API_URL}</code> | <strong>Cliente:</strong> <code>${CLIENT_URL}</code></p>
    <p><strong>Etapas:</strong> 15s &rarr; ${STAGE_RAMP} VUs | 30s &rarr; ${STAGE_STEADY} VUs | 15s &rarr; ${STAGE_PEAK} VUs | 15s &rarr; 0 VUs</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Solicitudes</div><div class="kpi-value">${reqs.count ?? 0}</div></div>
      <div class="kpi"><div class="kpi-label">Throughput</div><div class="kpi-value">${fmt(reqs.rate)} req/s</div></div>
      <div class="kpi"><div class="kpi-label">Error Rate</div><div class="kpi-value">${fmt((failed.rate || 0) * 100, 3)}%</div></div>
      <div class="kpi"><div class="kpi-label">Latencia p95</div><div class="kpi-value">${fmt(dur['p(95)'])} ms</div></div>
      <div class="kpi"><div class="kpi-label">Latencia p99</div><div class="kpi-value">${fmt(dur['p(99)'])} ms</div></div>
    </div>
  </div>
  <div class="card">
    <h2>Latencia por Capa (ms)</h2>
    <table>
      <thead><tr><th>Capa / Servicio</th><th>avg</th><th>p50</th><th>p90</th><th>p95</th><th>p99</th><th>max</th></tr></thead>
      <tbody>
        <tr><td>Global HTTP</td><td>${fmt(dur.avg)}</td><td>${fmt(dur.med)}</td><td>${fmt(dur['p(90)'])}</td><td>${fmt(dur['p(95)'])}</td><td>${fmt(dur['p(99)'])}</td><td>${fmt(dur.max)}</td></tr>
        <tr><td>Backend REST (<code>api-gestor</code>)</td><td>${fmt(api.avg)}</td><td>${fmt(api.med)}</td><td>${fmt(api['p(90)'])}</td><td>${fmt(api['p(95)'])}</td><td>${fmt(api['p(99)'])}</td><td>${fmt(api.max)}</td></tr>
        <tr><td>Frontend Web (<code>cliente</code>)</td><td>${fmt(cli.avg)}</td><td>${fmt(cli.med)}</td><td>${fmt(cli['p(90)'])}</td><td>${fmt(cli['p(95)'])}</td><td>${fmt(cli['p(99)'])}</td><td>${fmt(cli.max)}</td></tr>
        <tr><td>Integración E2E (<code>cliente &rarr; api &rarr; DB</code>)</td><td>${fmt(e2e.avg)}</td><td>${fmt(e2e.med)}</td><td>${fmt(e2e['p(90)'])}</td><td>${fmt(e2e['p(95)'])}</td><td>${fmt(e2e['p(99)'])}</td><td>${fmt(e2e.max)}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h2>Evaluación de Umbrales (Thresholds)</h2>
    <table>
      <thead><tr><th>Métrica</th><th>Condición</th><th>Estado</th></tr></thead>
      <tbody>${thresholdRows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

export function handleSummary(data) {
  const generatedAt = new Date().toISOString();
  const m = data.metrics || {};
  const reqs = m.http_reqs ? m.http_reqs.values : {};
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const failed = m.http_req_failed ? m.http_req_failed.values : {};
  const thresholds = extractThresholds(m);
  const allPassed = thresholds.every((t) => t.ok);

  const stdoutSummary = [
    '',
    '========================================================================',
    `  k6 LOAD TEST SUMMARY (${TARGET_ENV.toUpperCase()} | scale=${VUS_SCALE}x | ${allPassed ? 'PASS' : 'FAIL'})`,
    '========================================================================',
    `  API_URL    : ${API_URL}`,
    `  CLIENT_URL : ${CLIENT_URL}`,
    `  Stages     : 15s->${STAGE_RAMP} VUs | 30s->${STAGE_STEADY} VUs | 15s->${STAGE_PEAK} VUs | 15s->0 VUs`,
    `  Requests   : ${reqs.count ?? 0} (${fmt(reqs.rate)} req/s)`,
    `  Error Rate : ${fmt((failed.rate || 0) * 100, 3)}%`,
    `  Latency    : avg=${fmt(dur.avg)}ms | p50=${fmt(dur.med)}ms | p90=${fmt(dur['p(90)'])}ms | p95=${fmt(dur['p(95)'])}ms | p99=${fmt(dur['p(99)'])}ms | max=${fmt(dur.max)}ms`,
    `  Reports    : ${REPORT_PREFIX}.json | .md | .html`,
    '========================================================================',
    '',
  ].join('\n');

  return {
    stdout: stdoutSummary,
    [`${REPORT_PREFIX}.json`]: JSON.stringify(data, null, 2),
    [`${REPORT_PREFIX}.md`]: buildMarkdownReport(data, generatedAt),
    [`${REPORT_PREFIX}.html`]: buildHtmlReport(data, generatedAt),
  };
}
