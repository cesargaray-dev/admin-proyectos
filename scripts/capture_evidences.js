const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'evidencia_entrega');
const JENKINS_USER = process.env.JENKINS_USER || 'garay';
const JENKINS_PASSWORD = process.env.JENKINS_PASSWORD;
const SONAR_USER = process.env.SONAR_USER || 'admin';
const SONAR_PASSWORD = process.env.SONAR_PASSWORD;

if (!JENKINS_PASSWORD || !SONAR_PASSWORD) {
  throw new Error('Missing required environment variables: JENKINS_PASSWORD and SONAR_PASSWORD must be set.');
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('Iniciando captura automatizada con Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // 1. JENKINS
    console.log('Autenticando en Jenkins...');
    await page.authenticate({ username: JENKINS_USER, password: JENKINS_PASSWORD });

    // Captura 1: Dashboard con los 3 Pipelines
    console.log('Capturando 01_jenkins_dashboard_3_pipelines...');
    await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01_jenkins_dashboard_3_pipelines.png') });

    // Captura 2: Pipeline-AdminProyectos Build #7
    console.log('Capturando 02_jenkins_pipeline_cliente...');
    await page.goto('http://localhost:8080/job/Pipeline-AdminProyectos/7/', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_jenkins_pipeline_cliente.png') });

    // Captura 3: Pipeline-APIGestor Build #4
    console.log('Capturando 03_jenkins_pipeline_apigestor...');
    await page.goto('http://localhost:8080/job/Pipeline-APIGestor/4/', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_jenkins_pipeline_apigestor.png') });

    // Captura 4: Pipeline-BaseDatos Build #1
    console.log('Capturando 04_jenkins_pipeline_basedatos...');
    await page.goto('http://localhost:8080/job/Pipeline-BaseDatos/1/', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_jenkins_pipeline_basedatos.png') });

    // Captura 5: JaCoCo Cliente
    console.log('Capturando 05_jenkins_jacoco_cliente...');
    await page.goto('http://localhost:8080/job/Pipeline-AdminProyectos/7/jacoco/', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_jenkins_jacoco_cliente.png') });

    // Captura 6: JaCoCo APIGestor
    console.log('Capturando 06_jenkins_jacoco_apigestor...');
    await page.goto('http://localhost:8080/job/Pipeline-APIGestor/4/jacoco/', { waitUntil: 'domcontentloaded' });
    await wait(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06_jenkins_jacoco_apigestor.png') });

    // 2. SONARQUBE
    console.log('Autenticando en SonarQube...');
    const sonarPage = await browser.newPage();
    await sonarPage.authenticate({ username: SONAR_USER, password: SONAR_PASSWORD });

    await sonarPage.goto('http://localhost:9000/sessions/new', { waitUntil: 'domcontentloaded' });
    await wait(2000);
    const loginInput = await sonarPage.$('input[name="login"]');
    if (loginInput) {
      await sonarPage.type('input[name="login"]', SONAR_USER);
      await sonarPage.type('input[name="password"]', SONAR_PASSWORD);
      await sonarPage.click('button[type="submit"]');
      await wait(3000);
    }

    // Captura 7: SonarQube Projects Overview (>80% cobertura)
    console.log('Capturando 07_sonarqube_proyectos_cobertura...');
    await sonarPage.goto('http://localhost:9000/projects', { waitUntil: 'domcontentloaded' });
    await wait(4000);
    await sonarPage.screenshot({ path: path.join(OUTPUT_DIR, '07_sonarqube_proyectos_cobertura.png') });

    // Captura 8: SonarQube Detalle Cliente
    console.log('Capturando 08_sonarqube_detalle_cliente...');
    await sonarPage.goto('http://localhost:9000/dashboard?id=Ejercicio5Cliente', { waitUntil: 'domcontentloaded' });
    await wait(4000);
    await sonarPage.screenshot({ path: path.join(OUTPUT_DIR, '08_sonarqube_detalle_cliente.png') });

    // Captura 9: SonarQube Detalle APIGestor
    console.log('Capturando 09_sonarqube_detalle_apigestor...');
    await sonarPage.goto('http://localhost:9000/dashboard?id=Ejercicio5MyAPIGestor', { waitUntil: 'domcontentloaded' });
    await wait(4000);
    await sonarPage.screenshot({ path: path.join(OUTPUT_DIR, '09_sonarqube_detalle_apigestor.png') });

    // Captura 10: SonarQube Incidencias Cliente
    console.log('Capturando 10_sonarqube_incidencias_cliente...');
    await sonarPage.goto('http://localhost:9000/project/issues?id=Ejercicio5Cliente', { waitUntil: 'domcontentloaded' });
    await wait(4000);
    await sonarPage.screenshot({ path: path.join(OUTPUT_DIR, '10_sonarqube_incidencias_cliente.png') });

    // Captura 11: SonarQube Incidencias APIGestor
    console.log('Capturando 11_sonarqube_incidencias_apigestor...');
    await sonarPage.goto('http://localhost:9000/project/issues?id=Ejercicio5MyAPIGestor', { waitUntil: 'domcontentloaded' });
    await wait(4000);
    await sonarPage.screenshot({ path: path.join(OUTPUT_DIR, '11_sonarqube_incidencias_apigestor.png') });

    console.log('¡Todas las capturas de evidencia se han completado con éxito!');
  } catch (err) {
    console.error('Error durante la captura:', err);
  } finally {
    await browser.close();
  }
})();
