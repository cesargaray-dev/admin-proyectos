const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/login');
  await page.type('#j_username', 'garay');
  await page.type('#j_password', 'linux123');
  await page.click('button[name="Submit"]');
  await new Promise(r => setTimeout(r, 4000));
  console.log('Title after login:', await page.title());
  console.log('URL after login:', page.url());
  const body = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('Body after login:', body);
  await browser.close();
})();

