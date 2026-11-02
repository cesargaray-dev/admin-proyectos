const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'evidencia_entrega');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('=== Iniciando captura de evidencias visuales con Chrome ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();

  // ==========================================
  // 1. CAPTURAS DE JENKINS
  // ==========================================
  console.log('Iniciando sesión en Jenkins...');
  await page.goto('http://localhost:8080/login');
  await page.type('#j_username', 'garay');
  await page.type('#j_password', 'linux123');
  await page.click('button[name="Submit"]');
  await wait(4000);

  // Captura 1: Dashboard de Jenkins mostrando los 3 pipelines
  console.log('Capturando: 01_jenkins_dashboard_3_pipelines.png');
  await page.goto('http://localhost:8080/');
  await wait(3000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_jenkins_dashboard_3_pipelines.png') });

  // Captura 2: Pipeline-AdminProyectos (Frontend)
  console.log('Capturando: 02_jenkins_pipeline_cliente.png');
  await page.goto('http://localhost:8080/job/Pipeline-AdminProyectos/7/');
  await wait(3000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_jenkins_pipeline_cliente.png') });

  // Captura 3: Pipeline-APIGestor (Backend)
  console.log('Capturando: 03_jenkins_pipeline_apigestor.png');
  await page.goto('http://localhost:8080/job/Pipeline-APIGestor/4/');
  await wait(3000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_jenkins_pipeline_apigestor.png') });

  // Captura 4: Pipeline-BaseDatos (Base de Datos)
  console.log('Capturando: 04_jenkins_pipeline_basedatos.png');
  await page.goto('http://localhost:8080/job/Pipeline-BaseDatos/1/');
  await wait(3000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_jenkins_pipeline_basedatos.png') });

  // Captura 5: JaCoCo Cobertura Cliente (96.9%)
  console.log('Capturando: 05_jenkins_jacoco_cliente.png');
  await page.goto('http://localhost:8080/job/Pipeline-AdminProyectos/7/jacoco/');
  await wait(3000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_jenkins_jacoco_cliente.png') });

  // Captura 6: JaCoCo Cobertura APIGestor (99.3%)
  console.log('Capturando: 06_jenkins_jacoco_apigestor.png');
  await page.goto('http://localhost:8080/job/Pipeline-APIGestor/4/jacoco/');
  await wait(3000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06_jenkins_jacoco_apigestor.png') });

  // ==========================================
  // 2. CAPTURAS DE SONARQUBE
  // ==========================================
  console.log('Iniciando sesión en SonarQube...');
  await page.goto('http://localhost:9000/sessions/new');
  await wait(2000);
  const loginInput = await page.$('#login');
  if (loginInput) {
    await page.type('#login', 'admin');
    await page.type('#password', 'linux123');
    await page.click('button[type="submit"]');
    await wait(5000);
  }

  // Captura 7: Dashboard de Proyectos con >80% Cobertura
  console.log('Capturando: 07_sonarqube_proyectos_cobertura.png');
  await page.goto('http://localhost:9000/projects');
  await wait(5000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07_sonarqube_proyectos_cobertura.png') });

  // Captura 8: Detalle de Cobertura y Métricas - Cliente
  console.log('Capturando: 08_sonarqube_detalle_cliente.png');
  await page.goto('http://localhost:9000/dashboard?id=Ejercicio5Cliente');
  await wait(5000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '08_sonarqube_detalle_cliente.png') });

  // Captura 9: Detalle de Cobertura y Métricas - APIGestor
  console.log('Capturando: 09_sonarqube_detalle_apigestor.png');
  await page.goto('http://localhost:9000/dashboard?id=Ejercicio5MyAPIGestor');
  await wait(5000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '09_sonarqube_detalle_apigestor.png') });

  // Captura 10: Listado de Incidencias Reales - Cliente
  console.log('Capturando: 10_sonarqube_incidencias_cliente.png');
  await page.goto('http://localhost:9000/project/issues?id=Ejercicio5Cliente');
  await wait(5000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '10_sonarqube_incidencias_cliente.png') });

  // Captura 11: Listado de Incidencias Reales - APIGestor
  console.log('Capturando: 11_sonarqube_incidencias_apigestor.png');
  await page.goto('http://localhost:9000/project/issues?id=Ejercicio5MyAPIGestor');
  await wait(5000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '11_sonarqube_incidencias_apigestor.png') });

  // Captura 12: Regla java:S4684 en SonarQube
  console.log('Capturando: 12_sonarqube_regla_s4684_explicacion.png');
  await page.goto('http://localhost:9000/coding_rules#rule_key=java%3AS4684');
  await wait(5000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '12_sonarqube_regla_s4684_explicacion.png') });

  console.log('=== ¡Todas las 12 capturas de evidencia se guardaron exitosamente! ===');
  await browser.close();
})();

