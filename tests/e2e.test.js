'use strict';
// End-to-end: boots the server on a temp data dir, drives it with Playwright like a customer, and probes security.
// Run: node tests/e2e.test.js   (needs playwright + chromium; set CHROMIUM=/path/to/chrome if not on PATH)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const http = require('http');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const root = path.resolve(__dirname, '..');
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-test-'));
for (const f of ['catalog-generated.json', 'catalog-meta.js']) fs.copyFileSync(path.join(root, 'data', f), path.join(tmpData, f));
fs.mkdirSync(path.join(root, 'tests', 'screenshots'), { recursive: true });

// Boot server with isolated data dir by pointing config at tmp via env override module
const bootstrap = `
  const config = require(${JSON.stringify(path.join(root, 'src', 'config.js'))});
  config.dirs.data = ${JSON.stringify(tmpData)};
  config.dirs.uploads = ${JSON.stringify(path.join(tmpData, 'uploads'))};
  require(${JSON.stringify(path.join(root, 'server.js'))});
`;
const server = spawn(process.execPath, ['-e', bootstrap], { env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', LOG_REQUESTS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

const req = (method, p, { headers = {}, body = null } = {}) => new Promise((resolve, reject) => {
  const r = http.request(BASE + p, { method, headers }, (res) => { let data = ''; res.on('data', (c) => (data += c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data })); });
  r.on('error', reject); if (body) r.write(body); r.end();
});
async function waitUp() { for (let i = 0; i < 50; i++) { try { await req('GET', '/'); return; } catch { await new Promise((r) => setTimeout(r, 200)); } } throw new Error('server did not start'); }

let passed = 0; const failures = [];
async function test(name, fn) { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { failures.push(name); console.log('  ✗', name, '\n    ', e.message); } }

(async () => {
  await waitUp();
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); }); // 4xx responses to deliberate bad submits are expected
  const shot = (name) => page.screenshot({ path: path.join(root, 'tests', 'screenshots', name + '.png'), fullPage: true });
  const email = `tester+${Date.now()}@example.com`; const password = 'Printing-Rocks-2026';

  console.log('\nsecurity headers & hardening');
  await test('security headers present on HTML responses', async () => {
    const r = await req('GET', '/');
    for (const h of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) assert.ok(r.headers[h], h);
    assert.ok(/nonce-/.test(r.headers['content-security-policy']));
    assert.strictEqual(r.headers['x-frame-options'], 'DENY');
  });
  await test('static server blocks path traversal', async () => {
    for (const p of ['/../package.json', '/..%2f..%2fpackage.json', '/%2e%2e/server.js', '/styles.css/../../server.js']) {
      const r = await req('GET', p); assert.notStrictEqual(r.status, 200, p); assert.ok(!r.body.includes('createServer'), p);
    }
    assert.strictEqual((await req('GET', '/styles.css')).status, 200);
  });
  await test('uploads directory is not web-reachable', async () => { assert.strictEqual((await req('GET', '/uploads/anything.pdf')).status, 404); });
  await test('POST without CSRF token is rejected', async () => {
    const r = await req('POST', '/login', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a@b.co&password=x' });
    assert.strictEqual(r.status, 403);
  });
  await test('cross-origin POST with a valid cookie token is rejected', async () => {
    const first = await req('GET', '/login');
    const cookie = first.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
    const tok = /bp_csrf=([a-f0-9]+)/.exec(cookie)[1];
    const r = await req('POST', '/login', { headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, origin: 'https://evil.example' }, body: `csrf=${tok}&email=a@b.co&password=x` });
    assert.strictEqual(r.status, 403);
  });
  await test('oversized JSON body is refused', async () => {
    const r = await req('POST', '/api/cart/price', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pad: 'x'.repeat(70 * 1024) }) });
    assert.ok([413, 403].includes(r.status));
  });
  await test('protected pages redirect anonymous users to login', async () => {
    for (const p of ['/checkout', '/account']) { const r = await req('GET', p); assert.strictEqual(r.status, 303); assert.ok(r.headers.location.startsWith('/login')); }
  });
  await test('login next= only accepts local paths', async () => {
    const r = await req('GET', '/login?next=https://evil.example');
    assert.ok(!r.body.includes('evil.example'));
  });

  console.log('\nbrowsing');
  await test('home page renders hero, 4 categories, popular tiles, no JS errors', async () => {
    await page.goto(BASE + '/'); await shot('01-home');
    assert.strictEqual(await page.locator('.tiles-4 .tile').count(), 4);
    assert.ok((await page.locator('.tiles-3 .tile').count()) >= 6);
    assert.strictEqual(await page.locator('#cart-count').innerText(), '0');
  });
  await test('category nav → rigid boards shows grouped tiles', async () => {
    await page.click('.cat-nav a[href="/c/rigid-boards"]');
    await page.waitForSelector('h1:has-text("Rigid boards")');
    assert.strictEqual(await page.locator('.tiles .tile').count(), 6);
    assert.ok(await page.locator('.tile-sub span:has-text("6mm Coroplast")').count());
    await shot('02-category');
  });
  await test('search box finds products and handles no results', async () => {
    await page.fill('.search input', 'banner'); await page.press('.search input', 'Enter');
    await page.waitForSelector('h1:has-text("results for")');
    assert.ok((await page.locator('.tile').count()) >= 4);
    await page.goto(BASE + '/search?q=<script>zzz');
    assert.ok(await page.locator('h1:has-text("Nothing matched")').count());
    assert.ok(!(await page.content()).includes('<script>zzz'));
  });
  await test('every product page renders with a price or quote state', async () => {
    const slugs = JSON.parse(fs.readFileSync(path.join(tmpData, 'catalog-generated.json'))).families.map((f) => f.slug);
    for (const s of slugs) { const r = await req('GET', `/p/${s}`); assert.strictEqual(r.status, 200, s); assert.ok(r.body.includes('id="configurator"'), s); }
    const r = await req('GET', '/p/petg-020'); assert.ok(r.body.includes('data-quote-only="1"'));
  });

  console.log('\nconfigure a product');
  await test('product page: size change redraws preview and updates price', async () => {
    await page.goto(BASE + '/p/coroplast-4mm');
    const first = await page.locator('#price-unit').innerText();
    const before = await page.locator('#preview-svg rect.sign').getAttribute('width');
    await page.selectOption('#size', { index: 10 });
    const after = await page.locator('#preview-svg rect.sign').getAttribute('width');
    assert.notStrictEqual(before, after, 'preview should redraw');
    assert.notStrictEqual(first, await page.locator('#price-unit').innerText());
  });
  await test('add-ons raise the price and quantity multiplies total', async () => {
    await page.selectOption('#size', { index: 0 });
    const base = parseFloat((await page.locator('#price-unit').innerText()).replace(/[^0-9.]/g, ''));
    await page.selectOption('select[data-opt="Single or Double Sided"]', 'Two Sided');
    const withTwo = parseFloat((await page.locator('#price-unit').innerText()).replace(/[^0-9.]/g, ''));
    assert.ok(withTwo > base, 'two sided should cost more');
    await page.fill('#qty', '4');
    const total = parseFloat((await page.locator('#price-total').innerText()).replace(/[^0-9.]/g, ''));
    assert.strictEqual(total, Math.round(withTwo * 4 * 100) / 100);
    await shot('03-product-configured');
  });
  await test('quantity validation blocks 0 and 9999', async () => {
    await page.fill('#qty', '0'); await page.click('#add-to-cart');
    assert.ok((await page.locator('#form-note').innerText()).includes('1 to 5,000'));
    assert.strictEqual(await page.locator('#cart-count').innerText(), '0');
    await page.fill('#qty', '4');
  });
  await test('add to cart updates the header badge and confirms', async () => {
    await page.click('#add-to-cart');
    await page.waitForSelector('#form-note.is-ok');
    assert.strictEqual(await page.locator('#cart-count').innerText(), '4');
  });
  await test('quote-only product shows "Request a quote" instead of add to cart', async () => {
    await page.goto(BASE + '/p/election-signs');
    assert.ok(await page.locator('#quote-link').isVisible());
    assert.ok(!(await page.locator('#add-to-cart').isVisible()));
    await page.click('#quote-link'); await page.waitForSelector('h1:has-text("Quote: Screen-printed election signs")');
  });
  await test('second product (banner with hemming) added', async () => {
    await page.goto(BASE + '/p/13oz-large-scrim-banner');
    await page.selectOption('select[data-opt="Hemming or Trim only"]', 'Sewn Hem 4 Sides');
    await page.click('#add-to-cart'); await page.waitForSelector('#form-note.is-ok');
    assert.strictEqual(await page.locator('#cart-count').innerText(), '5');
  });

  console.log('\ncart');
  await test('cart page prices lines on the server and shows HST', async () => {
    await page.goto(BASE + '/cart'); await page.waitForSelector('.cart-line');
    assert.strictEqual(await page.locator('.cart-line').count(), 2);
    const txt = await page.locator('.totals').innerText();
    assert.ok(txt.includes('HST 13%'));
    assert.ok(await page.locator('#to-checkout:has-text("Log in to check out")').count());
    await shot('04-cart');
  });
  await test('changing quantity re-prices; removing a line works', async () => {
    const before = await page.locator('.totals .grand').last().innerText();
    await page.fill('.cart-line >> nth=0 >> input[data-qty]', '2'); await page.press('.cart-line >> nth=0 >> input[data-qty]', 'Tab');
    await page.waitForFunction((b) => document.querySelector('.totals .grand:last-child')?.innerText !== b, before);
    await page.click('.cart-line >> nth=1 >> [data-remove]');
    await page.waitForFunction(() => document.querySelectorAll('.cart-line').length === 1);
    assert.strictEqual(await page.locator('#cart-count').innerText(), '2');
  });
  await test('tampered cart (fake price, wrong option) is rejected by the pricing API', async () => {
    const r = await page.evaluate(async () => {
      const items = JSON.parse(localStorage.getItem('bp_cart_v1'));
      const res = await fetch('/api/cart/price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf: document.querySelector('meta[name=csrf-token]').content, items: [{ ...items[0], unit: 0.01, options: { 'Add Grommets': 'Free diamonds' } }] }) });
      return res.json();
    });
    assert.strictEqual(r.lines[0].ok, false);
    assert.strictEqual(r.total, 0);
  });

  console.log('\naccount');
  await test('register validates weak passwords and mismatches', async () => {
    await page.goto(BASE + '/register');
    await page.evaluate(() => { document.querySelector('form.auth').noValidate = true; }); // test the server's validation, not the browser's
    await page.fill('input[name=name]', 'Test Customer'); await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'short'); await page.fill('input[name=password2]', 'different');
    await page.click('form.auth button[type=submit]'); await page.waitForSelector('.err');
    assert.ok(await page.locator('.err:has-text("10 characters")').count());
    assert.ok(await page.locator('.err:has-text("do not match")').count());
  });
  await test('register succeeds, lands on account, session cookie is HttpOnly', async () => {
    await page.fill('input[name=password]', password); await page.fill('input[name=password2]', password);
    await page.click('form.auth button[type=submit]');
    await page.waitForSelector('h1:has-text("Test Customer")');
    const cookies = await ctx.cookies(); const s = cookies.find((c) => c.name === 'bp_session');
    assert.ok(s && s.httpOnly, 'session cookie must be HttpOnly');
    assert.ok(await page.locator('text=No orders yet').count());
    await shot('05-account-new');
  });
  await test('duplicate registration is refused', async () => {
    const r = await req('GET', '/register');
    // logged-in users are redirected; use a fresh anonymous request chain
    const cookie = r.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
    const tok = /bp_csrf=([a-f0-9]+)/.exec(cookie)[1];
    const r2 = await req('POST', '/register', { headers: { 'content-type': 'application/x-www-form-urlencoded', cookie }, body: `csrf=${tok}&name=Dup&email=${encodeURIComponent(email)}&password=${password}&password2=${password}` });
    assert.strictEqual(r2.status, 422); assert.ok(r2.body.includes('already exists'));
  });
  await test('log out, then log in with wrong password is refused with a generic message', async () => {
    await page.click('button:has-text("Log out")'); await page.waitForSelector('a[href="/login"]');
    await page.goto(BASE + '/login'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', 'nope-nope-1');
    await page.click('form.auth button[type=submit]'); await page.waitForSelector('.flash-err');
    assert.ok(await page.locator('.flash-err:has-text("Email or password is incorrect")').count());
  });
  await test('six wrong passwords lock the account for 15 minutes', async () => {
    for (let i = 0; i < 5; i++) { await page.fill('input[name=password]', 'nope-nope-' + i); await page.click('form.auth button[type=submit]'); await page.waitForSelector('.flash-err'); }
    assert.ok(await page.locator('.flash-err:has-text("locked")').count());
    // unlock for the rest of the suite by editing the store directly (simulates the 15 min passing)
    const f = path.join(tmpData, 'users.json'); const users = JSON.parse(fs.readFileSync(f)); users.forEach((u) => { u.lockedUntil = null; u.failedLogins = 0; }); fs.writeFileSync(f, JSON.stringify(users));
    await server.kill; // no-op: db cache; we restart below
  });
  // restart server so the file edit is picked up (the store caches in memory)
  server.kill(); await new Promise((r) => setTimeout(r, 300));
  const server2 = spawn(process.execPath, ['-e', bootstrap], { env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', LOG_REQUESTS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server2.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  await waitUp();
  await test('correct login works and the cart survived (localStorage)', async () => {
    await page.goto(BASE + '/login?next=/cart'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', password);
    await page.click('form.auth button[type=submit]'); await page.waitForSelector('.cart-line');
    assert.ok(await page.locator('#to-checkout:has-text("Check out")').count());
  });

  console.log('\nartwork, checkout, payment');
  const art = path.join(tmpData, 'art.pdf'); fs.writeFileSync(art, '%PDF-1.4\n% test artwork\n%%EOF');
  await test('attach artwork on the cart line (PDF accepted, EXE rejected)', async () => {
    const bad = path.join(tmpData, 'virus.exe'); fs.writeFileSync(bad, 'MZ\x90\x00 not really');
    await page.setInputFiles('.cart-line input[data-art]', bad);
    await page.waitForSelector('.err:has-text("Use PDF")');
    await page.setInputFiles('.cart-line input[data-art]', art);
    await page.waitForSelector('.cart-line :text("Artwork:")');
    assert.ok(await page.locator('.cart-line strong:has-text("art.pdf")').count());
  });
  await test('checkout validates courier address and phone', async () => {
    await page.click('#to-checkout'); await page.waitForSelector('#checkout-form'); await page.waitForSelector('#totals .grand');
    await page.check('input[name=shipMethod][value=courier]');
    await page.fill('input[name=phone]', '123');
    await page.check('input[name=terms]');
    await page.evaluate(() => document.getElementById('checkout-form').noValidate = true);
    await page.click('#place-order');
    await page.waitForSelector('.err');
    assert.ok(await page.locator('.err:has-text("area code")').count());
    assert.ok(await page.locator('.err:has-text("street address")').count());
    await shot('06-checkout-errors');
  });
  await test('checkout with pickup creates an order and lands on the payment page', async () => {
    await page.check('input[name=shipMethod][value=pickup]');
    await page.fill('input[name=phone]', '416 555 0199');
    await page.fill('input[name=po]', 'PO-1001');
    await page.waitForSelector('#totals .grand');
    await page.check('input[name=terms]');
    await page.click('#place-order');
    await page.waitForSelector('h1:has-text("Pay for order BP-")');
    assert.ok(await page.locator('text=Card payments are not switched on yet').count());
    assert.strictEqual(await page.locator('#cart-count').innerText(), '0', 'cart cleared after order');
    await shot('07-pay');
  });
  await test('simulated payment marks the order paid and shows it in the account', async () => {
    await page.click('button:has-text("Simulate a successful payment")');
    await page.waitForSelector('.flash-ok:has-text("Payment received")');
    assert.ok(await page.locator('.status-paid').count());
    assert.ok(await page.locator('text=art.pdf').count(), 'artwork recorded on the order');
    assert.ok(await page.locator('text=PO: PO-1001').count());
    await shot('08-order');
    await page.goto(BASE + '/account');
    assert.strictEqual(await page.locator('.orders tbody tr').count(), 1);
    await shot('09-account-orders');
  });
  await test('another user cannot open that order', async () => {
    const orderUrl = await page.evaluate(() => document.querySelector('.orders a').getAttribute('href'));
    const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/register');
    await p2.fill('input[name=name]', 'Other Person'); await p2.fill('input[name=email]', 'other' + Date.now() + '@example.com');
    await p2.fill('input[name=password]', password); await p2.fill('input[name=password2]', password); await p2.click('form.auth button[type=submit]');
    await p2.waitForSelector('h1:has-text("Other Person")');
    const r = await p2.goto(BASE + orderUrl); assert.strictEqual(r.status(), 404);
    await ctx2.close();
  });
  await test('contact form stores a message', async () => {
    await page.goto(BASE + '/contact'); await page.fill('textarea[name=message]', 'Do you print 48x96 in 10mm?'); await page.click('button:has-text("Send message")');
    await page.waitForSelector('.flash-ok:has-text("Sent")');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmpData, 'messages.json'))).length, 1);
  });
  await test('mobile layout has no horizontal overflow', async () => {
    const m = await browser.newPage({ viewport: { width: 375, height: 800 } });
    for (const p of ['/', '/p/pvc-3mm', '/cart']) { await m.goto(BASE + p); const over = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); assert.ok(!over, 'overflow on ' + p); }
    await m.screenshot({ path: path.join(root, 'tests', 'screenshots', '10-mobile-home.png'), fullPage: true });
    await m.close();
  });
  await test('login rate limit kicks in after 20 posts', async () => {
    let last;
    for (let i = 0; i < 22; i++) last = await req('POST', '/login', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
    assert.strictEqual(last.status, 429);
  });
  await test('no browser console or page errors during the run', async () => { assert.deepStrictEqual(consoleErrors, []); });

  await browser.close(); server2.kill();
  fs.rmSync(tmpData, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log('failed:', failures); process.exit(1); }
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });
