// Dev helper: node tests/shot.js <path> <out.png> [width]
const { chromium } = require('playwright');
(async () => {
  const [, , p = '/', out = 'tests/screenshots/shot.png', width = '1280'] = process.argv;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
  await page.goto('http://localhost:3000' + p, { waitUntil: 'networkidle' });
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
})();
