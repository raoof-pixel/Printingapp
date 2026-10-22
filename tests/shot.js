// Dev helper: node tests/shot.js <path> <out.png> [width]
const { chromium } = require('playwright');
(async () => {
  const [, , p = '/', out = 'tests/screenshots/shot.png', width = '1280'] = process.argv;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
  await page.goto('http://localhost:3000' + p, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
})();
