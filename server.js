'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const config = require('./src/config');
const sec = require('./src/security');
const auth = require('./src/auth');
const db = require('./src/db');
const catalog = require('./src/catalog');
const view = require('./src/render');
const content = require('./src/pages-content');
const payments = require('./src/payments');

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

/* ---------- Response helpers ---------- */
function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
function redirect(res, location, status = 303) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.end();
}
function setFlash(res, type, text) {
  sec.setCookie(res, 'bp_flash', sec.sign(Buffer.from(JSON.stringify({ type, text })).toString('base64url')), { maxAge: 60, sameSite: 'Lax' });
}
function readFlash(cookies, res) {
  const raw = cookies.bp_flash;
  if (!raw) return null;
  sec.clearCookie(res, 'bp_flash');
  const v = sec.unsign(raw);
  if (!v) return null;
  try { return JSON.parse(Buffer.from(v, 'base64url').toString('utf8')); } catch { return null; }
}

/* ---------- Body parsing ---------- */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    let done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; chunks.length = 0; req.pause(); reject(Object.assign(new Error('Payload too large'), { status: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function parseForm(req) {
  const type = req.headers['content-type'] || '';
  if (type.startsWith('application/x-www-form-urlencoded')) {
    const buf = await readBody(req, config.limits.jsonBody);
    return Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
  }
  if (type.startsWith('application/json')) {
    const buf = await readBody(req, config.limits.jsonBody);
    try { const o = JSON.parse(buf.toString('utf8')); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
  }
  return {};
}
/** Minimal multipart/form-data parser: returns { fields, files:[{name, filename, type, data}] } */
async function parseMultipart(req) {
  const type = req.headers['content-type'] || '';
  const m = /boundary=("?)([^";]+)\1/.exec(type);
  if (!type.startsWith('multipart/form-data') || !m) throw Object.assign(new Error('Expected multipart form'), { status: 400 });
  const buf = await readBody(req, config.limits.uploadBody);
  const boundary = Buffer.from(`--${m[2]}`);
  const fields = {}; const files = [];
  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    pos += boundary.length;
    if (buf.slice(pos, pos + 2).toString() === '--') break;
    const headEnd = buf.indexOf('\r\n\r\n', pos);
    if (headEnd === -1) break;
    const head = buf.slice(pos, headEnd).toString('utf8');
    const next = buf.indexOf(boundary, headEnd);
    const body = buf.slice(headEnd + 4, next - 2); // strip trailing \r\n
    const nameM = /name="([^"]*)"/.exec(head); const fileM = /filename="([^"]*)"/.exec(head); const ctM = /Content-Type:\s*([^\r\n]+)/i.exec(head);
    if (fileM) files.push({ name: nameM ? nameM[1] : '', filename: fileM[1], type: ctM ? ctM[1].trim().toLowerCase() : '', data: body });
    else if (nameM) fields[nameM[1]] = body.toString('utf8');
    pos = next;
  }
  return { fields, files };
}

/* ---------- Static files (path-traversal safe) ---------- */
function serveStatic(req, res, urlPath) {
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(config.dirs.public, rel);
  if (!file.startsWith(config.dirs.public + path.sep)) return false;
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', config.isProd ? 'public, max-age=86400' : 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(file).pipe(res);
  return true;
}

/* ---------- Orders ---------- */
function nextOrderNumber() {
  const year = new Date().getFullYear();
  const count = db.filter('orders', (o) => o.number.startsWith(`B2B-${year}-`)).length + 1;
  return `B2B-${year}-${String(count).padStart(4, '0')}`;
}
function parseCart(raw) {
  let items;
  try { items = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!Array.isArray(items) || items.length === 0 || items.length > config.limits.cartItems) return null;
  const lines = [];
  for (const it of items) {
    if (!it || !sec.isUuid(it.variantId)) return null;
    const qty = sec.int(it.qty, 1, config.limits.qtyMax);
    if (qty === null) return null;
    const options = it.options && typeof it.options === 'object' && !Array.isArray(it.options) ? it.options : {};
    const priced = catalog.priceLine({ variantId: it.variantId.toLowerCase(), qty, options });
    if (!priced) return null;
    lines.push({ ...priced, artworkId: sec.isUuid(it.artworkId) ? it.artworkId : null });
  }
  return lines;
}
function totals(lines) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
  const tax = Math.round(subtotal * config.taxRate * 100) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

/* ---------- Router ---------- */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });
function match(pattern, pathname) {
  if (typeof pattern === 'string') return pattern === pathname ? {} : null;
  const m = pattern.exec(pathname);
  return m ? m.groups || {} : null;
}
const requireLogin = (ctx, res) => {
  if (ctx.user) return true;
  redirect(res, `/login?next=${encodeURIComponent(ctx.path)}`);
  return false;
};
async function postGuard(req, res, ctx, bucket) {
  const rl = sec.rateLimit(req, bucket);
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter)); send(res, 429, view.errorPage(ctx, 429, 'Too many requests. Please wait a few minutes and try again.')); return null; }
  const body = await parseForm(req);
  if (!sec.verifyCsrf(req, ctx.cookies, body.csrf)) { send(res, 403, view.errorPage(ctx, 403, 'This form has expired. Go back, reload the page and try again.')); return null; }
  if (body.website) { send(res, 400, view.errorPage(ctx, 400, 'Submission rejected.')); return null; } // honeypot
  return body;
}

/* ---- Public pages ---- */
route('GET', '/', (ctx, req, res) => send(res, 200, view.home(ctx)));
route('GET', /^\/c\/(?<slug>[a-z0-9-]+)$/, (ctx, req, res, p) => {
  const cat = catalog.category(p.slug);
  return cat ? send(res, 200, view.category(ctx, cat)) : send(res, 404, view.errorPage(ctx, 404, 'That category does not exist.'));
});
route('GET', /^\/p\/(?<slug>[a-z0-9-]+)$/, (ctx, req, res, p) => {
  const fam = catalog.family(p.slug);
  return fam ? send(res, 200, view.product(ctx, fam)) : send(res, 404, view.errorPage(ctx, 404, 'That product does not exist.'));
});
route('GET', '/search', (ctx, req, res) => {
  const q = sec.str(ctx.query.q, 80);
  return send(res, 200, view.searchPage(ctx, q, q ? catalog.search(q) : []));
});
route('GET', '/help', (ctx, req, res) => send(res, 200, view.staticPage(ctx, 'Help and artwork specs', content.help)));
route('GET', '/about', (ctx, req, res) => send(res, 200, view.staticPage(ctx, 'About', content.about)));
route('GET', '/delivery', (ctx, req, res) => send(res, 200, view.staticPage(ctx, 'Delivery and pickup', content.delivery)));
route('GET', '/privacy', (ctx, req, res) => send(res, 200, view.staticPage(ctx, 'Privacy', content.privacy)));
route('GET', '/terms', (ctx, req, res) => send(res, 200, view.staticPage(ctx, 'Terms', content.terms)));
route('GET', '/contact', (ctx, req, res) => send(res, 200, view.contact(ctx, { about: sec.slugOk(ctx.query.about) ? ctx.query.about : '', sent: ctx.query.sent === '1' })));
route('POST', '/contact', async (ctx, req, res) => {
  const b = await postGuard(req, res, ctx, 'auth'); if (!b) return;
  const values = { name: sec.str(b.name, 100), email: sec.str(b.email, 254), message: sec.str(b.message, 3000) };
  const errors = {};
  if (!values.name) errors.name = 'Enter your name.';
  if (!sec.isEmail(values.email)) errors.email = 'Enter a valid email.';
  if (values.message.length < 5) errors.message = 'Tell us a little more.';
  const about = sec.slugOk(b.about) ? b.about : '';
  if (Object.keys(errors).length) return send(res, 422, view.contact(ctx, { about, errors, values }));
  db.insert('messages', { id: sec.newId(), ...values, about, userId: ctx.user?.id || null, ip: sec.clientIp(req), createdAt: new Date().toISOString() });
  return redirect(res, `/contact?sent=1${about ? '&about=' + about : ''}`);
});

/* ---- Auth ---- */
route('GET', '/login', (ctx, req, res) => (ctx.user ? redirect(res, '/account') : send(res, 200, view.authPage(ctx, 'login', { next: safeNext(ctx.query.next) }))));
route('GET', '/register', (ctx, req, res) => (ctx.user ? redirect(res, '/account') : send(res, 200, view.authPage(ctx, 'register', { next: safeNext(ctx.query.next) }))));
const safeNext = (n) => (typeof n === 'string' && /^\/[a-zA-Z0-9/_-]*$/.test(n) ? n : '');
route('POST', '/register', async (ctx, req, res) => {
  const b = await postGuard(req, res, ctx, 'auth'); if (!b) return;
  const values = { name: sec.str(b.name, 100), company: sec.str(b.company, 100), email: sec.str(b.email, 254).toLowerCase() };
  const next = safeNext(b.next);
  const errors = {};
  if (values.name.length < 2) errors.name = 'Enter your name.';
  if (!sec.isEmail(values.email)) errors.email = 'Enter a valid email.';
  const pw = typeof b.password === 'string' ? b.password : '';
  const problems = auth.passwordProblems(pw);
  if (problems.length) errors.password = problems.join(' ');
  if (pw !== b.password2) errors.password2 = 'Passwords do not match.';
  if (!errors.email && auth.findUserByEmail(values.email)) errors.email = 'An account with this email already exists. Log in instead.';
  if (Object.keys(errors).length) return send(res, 422, view.authPage(ctx, 'register', { errors, values, next }));
  const user = auth.createUser({ ...values, password: pw });
  auth.startSession(res, user);
  setFlash(res, 'ok', `Welcome, ${user.name}. Your account is ready.`);
  return redirect(res, next || '/account');
});
route('POST', '/login', async (ctx, req, res) => {
  const b = await postGuard(req, res, ctx, 'auth'); if (!b) return;
  const email = sec.str(b.email, 254); const next = safeNext(b.next);
  const result = auth.attemptLogin(email, typeof b.password === 'string' ? b.password : '');
  if (!result.ok) {
    const msg = result.locked ? 'Too many failed attempts. This account is locked for 15 minutes.' : 'Email or password is incorrect.';
    return send(res, 401, view.authPage(ctx, 'login', { errors: { _: msg }, values: { email }, next }));
  }
  auth.startSession(res, result.user);
  return redirect(res, next || '/account');
});
route('POST', '/logout', async (ctx, req, res) => {
  const b = await postGuard(req, res, ctx, 'auth'); if (!b) return;
  auth.endSession(res);
  return redirect(res, '/');
});

/* ---- Account ---- */
route('GET', '/account', (ctx, req, res) => {
  if (!requireLogin(ctx, res)) return;
  const orders = db.filter('orders', (o) => o.userId === ctx.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return send(res, 200, view.account(ctx, orders));
});
route('GET', /^\/orders\/(?<id>[0-9a-f-]{36})$/, (ctx, req, res, p) => {
  if (!requireLogin(ctx, res)) return;
  const order = db.find('orders', (o) => o.id === p.id && o.userId === ctx.user.id);
  return order ? send(res, 200, view.orderPage(ctx, order)) : send(res, 404, view.errorPage(ctx, 404, 'Order not found.'));
});

/* ---- Cart & pricing API (prices always computed here) ---- */
route('GET', '/cart', (ctx, req, res) => send(res, 200, view.cart(ctx)));
route('POST', '/cart/add', async (ctx, req, res) => { // no-JS fallback: the cart needs the browser script
  await parseForm(req);
  setFlash(res, 'err', 'Adding to the cart needs JavaScript switched on. Enable it and try again.');
  return redirect(res, '/cart');
});
route('POST', '/api/cart/price', async (ctx, req, res) => {
  const rl = sec.rateLimit(req, 'api'); if (!rl.ok) return json(res, 429, { error: 'Too many requests' });
  const body = await parseForm(req);
  if (!sec.verifyCsrf(req, ctx.cookies, body.csrf)) return json(res, 403, { error: 'Bad token' });
  const items = Array.isArray(body.items) ? body.items : [];
  const out = [];
  for (const it of items.slice(0, config.limits.cartItems)) {
    const qty = sec.int(it?.qty, 1, config.limits.qtyMax);
    const priced = sec.isUuid(it?.variantId) && qty !== null ? catalog.priceLine({ variantId: it.variantId.toLowerCase(), qty, options: it.options || {} }) : null;
    out.push(priced ? { ok: true, key: it.key, title: priced.family.title, slug: priced.family.slug, sizeLabel: view.sizeLabel(priced.variant), unit: priced.unit, total: priced.total, qty, options: priced.options } : { ok: false, key: it?.key });
  }
  const t = totals(out.filter((l) => l.ok));
  return json(res, 200, { lines: out, ...t, taxRate: config.taxRate });
});

/* ---- Artwork upload (login required; stored outside web root) ---- */
route('POST', '/api/upload', async (ctx, req, res) => {
  if (!ctx.user) return json(res, 401, { error: 'Log in to upload artwork.' });
  const rl = sec.rateLimit(req, 'upload'); if (!rl.ok) return json(res, 429, { error: 'Too many uploads. Try again in a few minutes.' });
  let parsed;
  try { parsed = await parseMultipart(req); } catch (e) { return json(res, e.status || 400, { error: e.status === 413 ? 'File is larger than 40 MB.' : 'Could not read the upload.' }); }
  if (!sec.verifyCsrf(req, ctx.cookies, parsed.fields.csrf)) return json(res, 403, { error: 'Bad token' });
  const f = parsed.files[0];
  if (!f || !f.data.length) return json(res, 400, { error: 'Choose a file first.' });
  const ext = config.limits.uploadTypes[f.type] || extByMagic(f.data);
  if (!ext) return json(res, 415, { error: 'Use PDF, AI, JPG, PNG or TIFF.' });
  const id = sec.newId();
  fs.mkdirSync(config.dirs.uploads, { recursive: true });
  fs.writeFileSync(path.join(config.dirs.uploads, `${id}.${ext}`), f.data, { mode: 0o600 });
  const safeName = path.basename(f.filename || 'artwork').replace(/[^\w.() -]/g, '_').slice(0, 120);
  db.insert('uploads', { id, userId: ctx.user.id, name: safeName, ext, bytes: f.data.length, createdAt: new Date().toISOString() });
  return json(res, 200, { id, name: safeName, bytes: f.data.length });
});
function extByMagic(buf) {
  const head = buf.slice(0, 8);
  if (head.slice(0, 4).toString() === '%PDF') return 'pdf';
  if (head[0] === 0xff && head[1] === 0xd8) return 'jpg';
  if (head.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (head.slice(0, 4).toString('hex') === '49492a00' || head.slice(0, 4).toString('hex') === '4d4d002a') return 'tif';
  if (head.slice(0, 4).toString() === '%!PS') return 'ai';
  return null;
}

/* ---- Checkout ---- */
route('GET', '/checkout', (ctx, req, res) => { if (!requireLogin(ctx, res)) return; return send(res, 200, view.checkout(ctx)); });
route('POST', '/checkout', async (ctx, req, res) => {
  if (!requireLogin(ctx, res)) return;
  const b = await postGuard(req, res, ctx, 'checkout'); if (!b) return;
  const values = { name: sec.str(b.name, 100), company: sec.str(b.company, 100), email: sec.str(b.email, 254), phone: sec.str(b.phone, 30), shipMethod: b.shipMethod === 'courier' ? 'courier' : 'pickup', address1: sec.str(b.address1, 120), address2: sec.str(b.address2, 60), city: sec.str(b.city, 60), region: sec.str(b.region, 2).toUpperCase(), postal: sec.str(b.postal, 10).toUpperCase(), po: sec.str(b.po, 40), notes: sec.str(b.notes, 1000), saveAddress: b.saveAddress === '1' };
  const errors = {};
  if (values.name.length < 2) errors.name = 'Enter a name.';
  if (!sec.isEmail(values.email)) errors.email = 'Enter a valid email.';
  if (values.phone.replace(/\D/g, '').length < 10) errors.phone = 'Enter a phone number with area code.';
  if (values.shipMethod === 'courier') {
    if (values.address1.length < 4) errors.address1 = 'Enter a street address.';
    if (values.city.length < 2) errors.city = 'Enter a city.';
    if (!/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(values.postal)) errors.postal = 'Enter a Canadian postal code.';
  }
  if (b.terms !== '1') errors.terms = 'Please accept the terms.';
  const lines = parseCart(b.cart);
  if (!lines) { setFlash(res, 'err', 'Your cart could not be verified. Please review it and try again.'); return redirect(res, '/cart'); }
  if (Object.keys(errors).length) return send(res, 422, view.checkout(ctx, { errors, values }));
  // artwork ids must belong to this user
  for (const l of lines) {
    if (l.artworkId) {
      const up = db.find('uploads', (u) => u.id === l.artworkId && u.userId === ctx.user.id);
      l.artwork = up ? { id: up.id, name: up.name } : null;
    }
  }
  const t = totals(lines);
  const order = {
    id: sec.newId(), number: nextOrderNumber(), userId: ctx.user.id, status: 'awaiting_payment', createdAt: new Date().toISOString(),
    contact: { name: values.name, company: values.company, email: values.email, phone: values.phone },
    shipMethod: values.shipMethod, ship: values.shipMethod === 'courier' ? { address1: values.address1, address2: values.address2, city: values.city, region: values.region, postal: values.postal } : null,
    po: values.po, notes: values.notes,
    lines: lines.map((l) => ({ variantId: l.variant.id, slug: l.family.slug, title: l.family.title, sizeLabel: view.sizeLabel(l.variant), qty: l.qty, options: l.options, unit: l.unit, total: l.total, artwork: l.artwork || null })),
    ...t, currency: config.currency, paymentAttempts: 0,
  };
  db.insert('orders', order);
  if (values.saveAddress && order.ship) db.update('users', (u) => u.id === ctx.user.id, (u) => ({ addresses: [...(u.addresses || []), { label: `${order.ship.address1}, ${order.ship.city}`, ...order.ship }].slice(-5) }));
  return redirect(res, `/pay/${order.id}`);
});

/* ---- Payment ---- */
const ownOrder = (ctx, id) => db.find('orders', (o) => o.id === id && o.userId === ctx.user.id);
route('GET', /^\/pay\/(?<id>[0-9a-f-]{36})$/, (ctx, req, res, p) => {
  if (!requireLogin(ctx, res)) return;
  const order = ownOrder(ctx, p.id);
  return order ? send(res, 200, view.pay(ctx, order).replace('<body class="', '<body data-clear-cart="1" class="')) : send(res, 404, view.errorPage(ctx, 404, 'Order not found.'));
});
route('POST', /^\/pay\/(?<id>[0-9a-f-]{36})\/stripe$/, async (ctx, req, res, p) => {
  if (!requireLogin(ctx, res)) return;
  const b = await postGuard(req, res, ctx, 'checkout'); if (!b) return;
  const order = ownOrder(ctx, p.id);
  if (!order || order.status !== 'awaiting_payment') return send(res, 404, view.errorPage(ctx, 404, 'Order not found or already paid.'));
  if (config.payments.provider !== 'stripe') return send(res, 400, view.errorPage(ctx, 400, 'Card payments are not configured.'));
  try {
    const session = await payments.createStripeCheckout(order, { successUrl: `${config.baseUrl}/pay/${order.id}/return?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${config.baseUrl}/pay/${order.id}` });
    db.update('orders', (o) => o.id === order.id, { stripeSessionId: session.id, paymentAttempts: (order.paymentAttempts || 0) + 1 });
    return redirect(res, session.url);
  } catch (e) {
    console.error('stripe error', e.message);
    setFlash(res, 'err', 'The payment provider did not respond. Nothing was charged. Please try again.');
    return redirect(res, `/pay/${order.id}`);
  }
});
route('GET', /^\/pay\/(?<id>[0-9a-f-]{36})\/return$/, async (ctx, req, res, p) => {
  if (!requireLogin(ctx, res)) return;
  const order = ownOrder(ctx, p.id);
  if (!order) return send(res, 404, view.errorPage(ctx, 404, 'Order not found.'));
  if (order.status === 'awaiting_payment' && config.payments.provider === 'stripe' && order.stripeSessionId) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.stripeSessionId)}`, { headers: { Authorization: `Bearer ${config.payments.stripeSecretKey}` } });
      const s = await r.json();
      if (r.ok && s.payment_status === 'paid') db.update('orders', (o) => o.id === order.id, { status: 'paid', paidAt: new Date().toISOString(), paymentRef: s.payment_intent });
    } catch (e) { console.error('stripe verify', e.message); }
  }
  return redirect(res, `/orders/${order.id}`);
});
route('POST', /^\/pay\/(?<id>[0-9a-f-]{36})\/simulate$/, async (ctx, req, res, p) => {
  if (!requireLogin(ctx, res)) return;
  const b = await postGuard(req, res, ctx, 'checkout'); if (!b) return;
  if (!config.payments.allowSimulatedPayments) return send(res, 403, view.errorPage(ctx, 403, 'Simulated payments are disabled.'));
  const order = ownOrder(ctx, p.id);
  if (!order || order.status !== 'awaiting_payment') return send(res, 404, view.errorPage(ctx, 404, 'Order not found or already paid.'));
  db.update('orders', (o) => o.id === order.id, { status: 'paid', paidAt: new Date().toISOString(), paymentRef: 'simulated' });
  setFlash(res, 'ok', `Payment received. Order ${order.number} is in production.`);
  return redirect(res, `/orders/${order.id}`);
});
route('POST', '/webhooks/stripe', async (ctx, req, res) => {
  const raw = (await readBody(req, 1024 * 1024)).toString('utf8');
  if (!payments.verifyStripeSignature(raw, req.headers['stripe-signature'])) return json(res, 400, { error: 'Bad signature' });
  let event; try { event = JSON.parse(raw); } catch { return json(res, 400, { error: 'Bad JSON' }); }
  if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
    const s = event.data.object;
    db.update('orders', (o) => o.id === s.client_reference_id && o.status === 'awaiting_payment', { status: 'paid', paidAt: new Date().toISOString(), paymentRef: s.payment_intent });
  }
  return json(res, 200, { received: true });
});

/* ---------- Server ---------- */
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (pathname !== '/' && serveStatic(req, res, pathname)) return;
    }
    const cookies = sec.parseCookies(req);
    const nonce = sec.nonce();
    sec.securityHeaders(res, nonce);
    const csrf = pathname === '/webhooks/stripe' ? '' : sec.ensureCsrfToken(req, res, cookies);
    const ctx = { path: pathname, query: Object.fromEntries(url.searchParams), cookies, csrf, nonce, user: auth.currentUser(cookies), flash: null };
    ctx.flash = readFlash(cookies, res);
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const params = match(r.pattern, pathname);
      if (params) { await r.handler(ctx, req, res, params); return; }
    }
    send(res, 404, view.errorPage(ctx, 404, 'We could not find that page.'));
  } catch (e) {
    console.error(`${req.method} ${req.url} failed:`, e);
    if (!res.headersSent) {
      const status = e.status || 500;
      if (status === 413) res.setHeader('Connection', 'close');
      try { send(res, status, view.errorPage({ path: req.url, query: {}, cookies: {}, csrf: '', nonce: '', user: null }, status, status === 413 ? 'That upload is too large.' : 'Something went wrong on our side. Please try again.')); } catch { res.end(); }
    } else res.end();
  } finally {
    if (process.env.LOG_REQUESTS !== 'false') console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`);
  }
});
server.headersTimeout = 20_000;
server.requestTimeout = 120_000;
server.listen(config.port, config.host, () => console.log(`${config.brand.name} listening on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'}, payments: ${config.payments.provider})`));
