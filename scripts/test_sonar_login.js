const puppeteer = require('puppeteer-core');

const SONAR_USER = process.env.SONAR_USER || 'admin';
const SONAR_PASSWORD = process.env.SONAR_PASSWORD;

if (!SONAR_PASSWORD) {
  throw new Error('Missing required environment variable: SONAR_PASSWORD must be set.');
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:9000/sessions/new');
  await new Promise(r => setTimeout(r, 2000));
  await page.type('#login', SONAR_USER);
  await page.type('#password', SONAR_PASSWORD);
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 5000));
  console.log('Title after login:', await page.title());
  console.log('URL after login:', page.url());
  const body = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('Body after login:', body);
  await browser.close();
})();

