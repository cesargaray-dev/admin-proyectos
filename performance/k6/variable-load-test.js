import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ============================================================================
// Admin Proyectos — k6 Variable Traffic / Multi-Wave Scenario
// ============================================================================
// Diseñado específicamente para validar la respuesta de k6 y las gráficas en
// vivo de Grafana (Tasa HTTP, Latencia p50/p95/p99, Heap JVM y CPU) frente a
// variaciones claras de tráfico en el tiempo (olas + valle de recuperación +
// picos de distinta intensidad + mezcla ponderada de peticiones).
//
// Utiliza `ramping-arrival-rate` (tasa variable de iteraciones por segundo)
// y solo endpoints reales de lectura para proteger la integridad de datos.
// ============================================================================

const API_URL = (__ENV.API_URL || 'http://localhost:8081').replace(/\/+$/, '');
const CLIENT_URL = (__ENV.CLIENT_URL || 'http://localhost:8082').replace(/\/+$/, '');
const TARGET_ENV = (__ENV.TARGET_ENV || 'local').toLowerCase();
const IS_RENDER = TARGET_ENV === 'render';
const DEFAULT_SCALE = IS_RENDER ? 0.5 : 1.0;
const VUS_SCALE = Math.max(0.2, Number(__ENV.VUS_SCALE || DEFAULT_SCALE));
const REPORT_PREFIX = __ENV.REPORT_PREFIX || `performance/reports/variable-${TARGET_ENV}-latest`;

function scaleRate(baseRate) {
  return Math.max(1, Math.round(baseRate * VUS_SCALE));
}

// Tasas por etapa (iteraciones/seg; cada iteración ejecuta ~4–6 requests)
const RATE_LOW = scaleRate(1);
const RATE_WAVE_1 = scaleRate(5);
const RATE_VALLEY = scaleRate(1);
const RATE_WAVE_2_PEAK = scaleRate(8);
const RATE_PLATEAU = scaleRate(3);

// Métricas personalizadas por servicio y capa
const apiDuration = new Trend('api_response_time', true);
const clientDuration = new Trend('client_response_time', true);
const e2eProxyDuration = new Trend('e2e_proxy_response_time', true);
const businessChecksRate = new Rate('business_checks_rate');
const endpointErrors = new Counter('endpoint_errors');

export const options = {
  scenarios: {
    oleadas_variables: {
      executor: 'ramping-arrival-rate',
      startRate: RATE_LOW,
      timeUnit: '1s',
      preAllocatedVUs: IS_RENDER ? 10 : 18,
      maxVUs: IS_RENDER ? 25 : 40,
      stages: [
        { duration: '25s', target: RATE_LOW },          // 1. Línea base suave
        { duration: '30s', target: RATE_WAVE_1 },       // 2. Primera ola ascendente
        { duration: '25s', target: RATE_VALLEY },       // 3. Valle de recuperación (descenso claro en Grafana)
        { duration: '30s', target: RATE_WAVE_2_PEAK },  // 4. Segunda ola / pico máximo controlado
        { duration: '25s', target: RATE_PLATEAU },      // 5. Meseta intermedia
        { duration: '20s', target: 0 },                 // 6. Enfriamiento gradual
      ],
    },
  },
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
    test_type: 'variable-waves',
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
  // Mezcla dinámica ponderada: cada iteración varía el tipo de tráfico
  const selector = (__ITER + __VU) % 10;

  if (selector < 4) {
    // 40%: Tráfico mixto ligero Frontend SSR + Health API
    group('Perfil A — Navegacion Frontend + Health', () => {
      const rHome = http.get(`${CLIENT_URL}/`, {
        tags: { service: 'cliente', endpoint: 'GET /' },
      });
      trackResult(rHome, check(rHome, { 'Cliente GET / 200': (r) => r.status === 200 }), clientDuration);

      const rInicio = http.get(`${CLIENT_URL}/inicio`, {
        tags: { service: 'cliente', endpoint: 'GET /inicio' },
      });
      trackResult(rInicio, check(rInicio, { 'Cliente GET /inicio 200': (r) => r.status === 200 }), clientDuration);

      const rHealth = http.get(`${API_URL}/actuator/health`, {
        tags: { service: 'api-gestor', endpoint: 'GET /actuator/health' },
      });
      trackResult(rHealth, check(rHealth, { 'API health 200': (r) => r.status === 200 }), apiDuration);
    });
  } else if (selector < 7) {
    // 30%: Consultas REST directas al Backend + PostgreSQL
    group('Perfil B — Consultas REST Backend', () => {
      const rProyectos = http.post(`${API_URL}/buscarProyectos`, null, {
        headers: JSON_HEADERS,
        tags: { service: 'api-gestor', endpoint: 'POST /buscarProyectos' },
      });
      trackResult(
        rProyectos,
        check(rProyectos, { 'API /buscarProyectos 200': (r) => r.status === 200 }),
        apiDuration
      );

      const rTareas = http.post(`${API_URL}/buscarTareas`, null, {
        headers: JSON_HEADERS,
        tags: { service: 'api-gestor', endpoint: 'POST /buscarTareas' },
      });
      trackResult(rTareas, check(rTareas, { 'API /buscarTareas 200': (r) => r.status === 200 }), apiDuration);

      const rUsuarios = http.post(`${API_URL}/buscarUsuarios`, null, {
        headers: JSON_HEADERS,
        tags: { service: 'api-gestor', endpoint: 'POST /buscarUsuarios' },
      });
      trackResult(rUsuarios, check(rUsuarios, { 'API /buscarUsuarios 200': (r) => r.status === 200 }), apiDuration);

      const rAsign = http.post(`${API_URL}/buscarAsignaciones`, null, {
        headers: JSON_HEADERS,
        tags: { service: 'api-gestor', endpoint: 'POST /buscarAsignaciones' },
      });
      trackResult(rAsign, check(rAsign, { 'API /buscarAsignaciones 200': (r) => r.status === 200 }), apiDuration);
    });
  } else {
    // 30%: Flujo completo E2E (Frontend -> Backend -> PostgreSQL) + vista Thymeleaf pesada
    group('Perfil C — Integracion E2E Completa', () => {
      const rProyectoPage = http.get(`${CLIENT_URL}/proyecto`, {
        tags: { service: 'cliente', endpoint: 'GET /proyecto' },
      });
      const okPage = check(rProyectoPage, { 'Cliente GET /proyecto 200': (r) => r.status === 200 });
      clientDuration.add(rProyectoPage.timings.duration);
      trackResult(rProyectoPage, okPage, e2eProxyDuration);

      const rConsProy = http.post(`${CLIENT_URL}/consultarProyectos`, null, {
        headers: JSON_HEADERS,
        tags: { service: 'cliente', endpoint: 'POST /consultarProyectos' },
      });
      const okProy = check(rConsProy, { 'Cliente /consultarProyectos 200': (r) => r.status === 200 });
      clientDuration.add(rConsProy.timings.duration);
      trackResult(rConsProy, okProy, e2eProxyDuration);

      const rConsTar = http.post(`${CLIENT_URL}/consultarTareas`, null, {
        headers: JSON_HEADERS,
        tags: { service: 'cliente', endpoint: 'POST /consultarTareas' },
      });
      const okTar = check(rConsTar, { 'Cliente /consultarTareas 200': (r) => r.status === 200 });
      clientDuration.add(rConsTar.timings.duration);
      trackResult(rConsTar, okTar, e2eProxyDuration);

      const rConsCom = http.post(`${CLIENT_URL}/consultarComentarios`, null, {
        headers: JSON_HEADERS,
        tags: { service: 'cliente', endpoint: 'POST /consultarComentarios' },
      });
      const okCom = check(rConsCom, { 'Cliente /consultarComentarios 200': (r) => r.status === 200 });
      clientDuration.add(rConsCom.timings.duration);
      trackResult(rConsCom, okCom, e2eProxyDuration);
    });
  }
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
    '# Reporte de Escenario de Carga Variable (Oleadas) — Grafana k6',
    '',
    `- **Fecha (UTC):** ${generatedAt}`,
    `- **Entorno objetivo:** \`${TARGET_ENV}\` (escala tasas: \`${VUS_SCALE}x\`)`,
    `- **API URL:** \`${API_URL}\``,
    `- **Cliente URL:** \`${CLIENT_URL}\``,
    `- **Perfil variable (155s):** Base ${RATE_LOW}/s (25s) -> Ola 1 ${RATE_WAVE_1}/s (30s) -> Valle ${RATE_VALLEY}/s (25s) -> Pico ${RATE_WAVE_2_PEAK}/s (30s) -> Meseta ${RATE_PLATEAU}/s (25s) -> Fin 0/s (20s)`,
    `- **Estado global de umbrales:** **${allPassed ? 'PASS' : 'FAIL'}**`,
    '',
    '## 1. Métricas Globales HTTP',
    '',
    '| Indicador | Valor |',
    '| --- | --- |',
    `| Total de solicitudes HTTP (\`http_reqs\`) | ${reqs.count ?? 0} |`,
    `| Iteraciones completadas | ${iters.count ?? 0} |`,
    `| Throughput promedio (RPS) | ${fmt(reqs.rate)} req/s |`,
    `| Tasa de error HTTP (\`http_req_failed\`) | ${fmt((failed.rate || 0) * 100, 3)}% (${failed.fails ?? 0} fallos) |`,
    `| Checks de negocio exitosos | ${fmt((chk.rate || 0) * 100, 2)}% (${chk.passes ?? 0}/${(chk.passes ?? 0) + (chk.fails ?? 0)}) |`,
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
  <title>Reporte k6 Variable Waves — Admin Proyectos (${TARGET_ENV})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem auto; max-width: 980px; color: #1f2937; background: #f9fafb; }
    .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    h1 { margin-top: 0; color: #111827; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-weight: 700; font-size: 0.85rem; }
    .badge.pass { background: #dcfce7; color: #166534; }
    .badge.fail { background: #fee2e2; color: #991b1b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .kpi { background: #f3f4f6; border-radius: 8px; padding: 1rem; }
    .kpi-label { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; }
    .kpi-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; color: #111827; }
    .wave-bar { display: flex; align-items: flex-end; gap: 10px; height: 90px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 0.75rem; }
    .wave-step { flex: 1; background: linear-gradient(180deg, #0284c7, #38bdf8); border-radius: 4px 4px 0 0; color: #fff; font-size: 0.72rem; font-weight: 700; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; }
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
    <h1>Escenario de Carga Variable (Oleadas) k6 — Admin Proyectos</h1>
    <p><span class="badge ${allPassed ? 'pass' : 'fail'}">${allPassed ? 'UMBRALES SUPERADOS (PASS)' : 'UMBRALES INCUMPLIDOS (FAIL)'}</span></p>
    <p><strong>Fecha (UTC):</strong> ${generatedAt} | <strong>Entorno:</strong> <code>${TARGET_ENV}</code> (escala ${VUS_SCALE}x)</p>
    <p><strong>API:</strong> <code>${API_URL}</code> | <strong>Cliente:</strong> <code>${CLIENT_URL}</code></p>
    <p><strong>Perfil (155s):</strong> Base ${RATE_LOW}/s &rarr; Ola 1 ${RATE_WAVE_1}/s &rarr; Valle ${RATE_VALLEY}/s &rarr; Pico ${RATE_WAVE_2_PEAK}/s &rarr; Meseta ${RATE_PLATEAU}/s &rarr; 0/s</p>
    <div class="wave-bar">
      <div class="wave-step" style="height:22%">Base (${RATE_LOW}/s)</div>
      <div class="wave-step" style="height:64%">Ola 1 (${RATE_WAVE_1}/s)</div>
      <div class="wave-step" style="height:22%; background: linear-gradient(180deg,#0d9488,#2dd4bf);">Valle (${RATE_VALLEY}/s)</div>
      <div class="wave-step" style="height:98%; background: linear-gradient(180deg,#2563eb,#60a5fa);">Pico (${RATE_WAVE_2_PEAK}/s)</div>
      <div class="wave-step" style="height:45%">Meseta (${RATE_PLATEAU}/s)</div>
      <div class="wave-step" style="height:12%; background: #64748b;">Fin (0/s)</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Solicitudes</div><div class="kpi-value">${reqs.count ?? 0}</div></div>
      <div class="kpi"><div class="kpi-label">Throughput Avg</div><div class="kpi-value">${fmt(reqs.rate)} req/s</div></div>
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
    `  k6 VARIABLE WAVES SUMMARY (${TARGET_ENV.toUpperCase()} | scale=${VUS_SCALE}x | ${allPassed ? 'PASS' : 'FAIL'})`,
    '========================================================================',
    `  API_URL    : ${API_URL}`,
    `  CLIENT_URL : ${CLIENT_URL}`,
    `  Waves      : ${RATE_LOW}/s -> ${RATE_WAVE_1}/s -> ${RATE_VALLEY}/s -> ${RATE_WAVE_2_PEAK}/s -> ${RATE_PLATEAU}/s -> 0/s (155s)`,
    `  Requests   : ${reqs.count ?? 0} (${fmt(reqs.rate)} req/s avg)`,
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
