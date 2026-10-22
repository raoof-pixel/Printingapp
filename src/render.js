'use strict';
const config = require('./config');
const catalog = require('./catalog');
const { esc } = require('./security');

const LOGO = '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="16" r="5" fill="#f25c05"/><path d="M16 0v8M16 24v8M0 16h8M24 16h8" stroke="currentColor" stroke-width="3"/></svg>';
const money = (n) => `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const sizeLabel = (v) => (v.size ? `${fmtNum(v.size[0])} × ${fmtNum(v.size[1])} in` : v.label);
const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, ''));

/* ---------- Layout ---------- */
function layout(ctx, { title, body, bodyClass = '', description = '' }) {
  const { user, csrf, nonce, path } = ctx;
  const nav = catalog.CATEGORIES.map((c) => `<a href="/c/${c.slug}" ${path.startsWith('/c/' + c.slug) ? 'aria-current="page"' : ''}>${esc(c.title)}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} · ${config.brand.name}` : config.brand.name)}</title>
<meta name="description" content="${esc(description || config.brand.tagline)}">
<meta name="csrf-token" content="${esc(csrf)}">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
</head>
<body class="${esc(bodyClass)}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="/" aria-label="${esc(config.brand.name)} home">${LOGO}<span class="wordmark"><b>B2B</b>print<small>.ca</small></span></a>
    <form class="search" action="/search" method="get" role="search">
      <input type="search" name="q" placeholder="Search materials, e.g. coroplast 24x36" aria-label="Search" maxlength="80" value="${esc(ctx.query?.q || '')}">
      <button type="submit" aria-label="Search">Search</button>
    </form>
    <nav class="account-nav" aria-label="Account">
      ${user ? `<a href="/account">${esc(user.name.split(' ')[0])}</a><form method="post" action="/logout" class="inline"><input type="hidden" name="csrf" value="${esc(csrf)}"><button type="submit" class="linkish">Log out</button></form>` : `<a href="/login">Log in</a><a href="/register" class="btn btn-small">Create account</a>`}
      <a href="/cart" class="cart-link" id="cart-link">Cart <span class="cart-count" id="cart-count" aria-live="polite">0</span></a>
    </nav>
  </div>
  <nav class="cat-nav wrap" aria-label="Materials">${nav}<a href="/help">Help</a></nav>
</header>
<main id="main" class="wrap">${body}</main>
<footer class="site-foot">
  <div class="wrap foot-grid">
    <div>
      <p class="foot-brand">${esc(config.brand.name)}</p>
      <p>${esc(config.brand.tagline)} ${esc(config.brand.descriptor)}</p>
      <p><a href="mailto:${esc(config.brand.email)}">${esc(config.brand.email)}</a><br><a href="tel:${esc(config.brand.phoneTel)}">${esc(config.brand.phone)}</a><br>${esc(config.brand.address)}</p>
    </div>
    <div><p class="foot-h">Materials</p>${catalog.CATEGORIES.map((c) => `<a href="/c/${c.slug}">${esc(c.title)}</a>`).join('')}</div>
    <div><p class="foot-h">Ordering</p><a href="/help">Help and artwork specs</a><a href="/delivery">Delivery and pickup</a><a href="/account">Your orders</a><a href="/contact">Contact</a></div>
    <div><p class="foot-h">Company</p><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
  </div>
  <div class="wrap foot-base"><span>© ${new Date().getFullYear()} ${esc(config.brand.name)} · Prices in CAD, HST added at checkout.</span><span class="pay-marks" aria-label="Accepted payments">Visa · Mastercard · Amex · Interac</span></div>
</footer>
<script src="/app.js" nonce="${esc(nonce)}" defer></script>
</body>
</html>`;
}

/* ---------- Pieces ---------- */
function tile(href, title, blurb, texture, priceNote, extra = '') {
  return `<a class="tile" href="${esc(href)}">
    <span class="tile-art tex-${esc(texture)}" aria-hidden="true"><span class="tile-sign"></span></span>
    <span class="tile-body"><span class="tile-title">${esc(title)}</span><span class="tile-blurb">${esc(blurb)}</span>${extra}<span class="tile-price">${esc(priceNote)}</span></span>
  </a>`;
}
const priceNote = (min, quoteOnly) => (quoteOnly ? 'Quoted per order' : `From ${money(min)}`);
function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it, i) => (it.href ? `<a href="${esc(it.href)}">${esc(it.label)}</a>` : `<span aria-current="page">${esc(it.label)}</span>`) + (i < items.length - 1 ? '<span class="sep">/</span>' : '')).join('')}</nav>`;
}
function flash(ctx) {
  if (!ctx.flash) return '';
  return `<div class="flash flash-${esc(ctx.flash.type)}" role="status">${esc(ctx.flash.text)}</div>`;
}

/* ---------- Pages ---------- */
function home(ctx) {
  const cats = catalog.CATEGORIES.map((c) => {
    const cat = catalog.category(c.slug);
    const min = Math.min(...cat.groups.filter((g) => g.minPrice > 0).map((g) => g.minPrice));
    return tile(`/c/${c.slug}`, c.title, c.short, c.texture, Number.isFinite(min) ? `From ${money(min)}` : 'Quoted per order');
  }).join('');
  const popular = ['coroplast-4mm', 'pvc-3mm', '13oz-large-scrim-banner', 'white-vinyl-clear-adhesive', 'alupanel-3mm', 'foam-board']
    .map((s) => catalog.family(s)).filter(Boolean)
    .map((f) => tile(`/p/${f.slug}`, f.title, f.blurb, f.texture, priceNote(f.minPrice, f.quoteOnly))).join('');
  const body = `
<section class="hero">
  <div class="hero-copy">
    <h1>Wholesale-grade signs and banners. No minimums.</h1>
    <p>The same boards, vinyl and banner stock the trade buys, priced per piece so a business can order one or one hundred. 279 stock sizes, every one priced before you log in. Printed in Mississauga, shipped across Ontario, or picked up free.</p>
    <div class="hero-actions"><a class="btn" href="/c/rigid-boards">Browse rigid boards</a><a class="btn btn-ghost" href="/help#artwork">Artwork specs</a></div>
  </div>
  <div class="hero-swatches" aria-hidden="true">
    <div class="swatch tex-coroplast"><span>Coroplast</span></div>
    <div class="swatch tex-aluminum"><span>Alupanel</span></div>
    <div class="swatch tex-pvc"><span>PVC</span></div>
    <div class="swatch tex-banner"><span>Scrim banner</span></div>
    <div class="swatch tex-clear"><span>Clear PETG</span></div>
    <div class="swatch tex-vinyl"><span>Vinyl</span></div>
  </div>
</section>
<section class="section">
  <div class="section-head"><h2>Materials</h2><p>Four families, 30 products, 279 sizes.</p></div>
  <div class="tiles tiles-4">${cats}</div>
</section>
<section class="section">
  <div class="section-head"><h2>Most ordered</h2><p>What contractors, realtors, retailers and event teams reorder.</p></div>
  <div class="tiles tiles-3">${popular}</div>
</section>
<section class="section how">
  <h2>How an order works</h2>
  <ol class="steps">
    <li><strong>Choose a material and a stock size.</strong> The preview on each product page draws your size to scale.</li>
    <li><strong>Add finishing.</strong> Sides, grommets, holes, hems, contour cutting, rush. Each add-on shows its price before you add it.</li>
    <li><strong>Upload print-ready artwork.</strong> PDF, AI, JPG, PNG or TIFF with fonts outlined. Add it on the product page or at checkout.</li>
    <li><strong>Pay and track.</strong> Secure card payment at checkout. Lead times start when we confirm your art.</li>
  </ol>
</section>`;
  return layout(ctx, { title: '', body, bodyClass: 'page-home' });
}

function category(ctx, cat) {
  const tiles = cat.groups.map((g) => {
    const extra = g.families.length > 1 ? `<span class="tile-sub">${g.families.map((f) => `<span>${esc(f.title)}</span>`).join('')}</span>` : '';
    return tile(`/p/${g.families[0].slug}`, g.title, g.blurb, g.texture, priceNote(g.minPrice, g.quoteOnly), extra);
  }).join('');
  const body = `${crumbs([{ label: 'Home', href: '/' }, { label: cat.title }])}
<header class="page-head"><h1>${esc(cat.title)}</h1><p class="lede">${esc(cat.blurb)}</p></header>
<div class="tiles tiles-3">${tiles}</div>`;
  return layout(ctx, { title: cat.title, body, description: cat.blurb });
}

function product(ctx, fam) {
  const cat = catalog.CATEGORIES.find((c) => c.slug === fam.categorySlug);
  const siblings = fam.group ? catalog.families.filter((f) => f.group === fam.group) : [];
  const sizeOpts = fam.variants.map((v, i) => `<option value="${esc(v.id)}" data-w="${v.size ? v.size[0] : ''}" data-h="${v.size ? v.size[1] : ''}" data-price="${v.price}" data-quote="${v.quote ? 1 : 0}" ${i === 0 ? 'selected' : ''}>${esc(sizeLabel(v))}${v.size && v.label.replace(/\s+/g, ' ').match(/flutes?\s+\w+/i) ? ` — ${esc(v.label.match(/flutes?\s+\w+/i)[0].toLowerCase())}` : ''}${v.quote ? ' — quote' : ` — ${money(v.price)}`}</option>`).join('');
  const meta = require('../data/catalog-meta');
  const optionFields = fam.options.map((o, i) => `
    <label class="field"><span>${esc(meta.prettyLabel(o.label))}</span>
      <select name="opt_${i}" data-opt="${esc(o.label)}">
        <option value="">None</option>
        ${o.choices.map((c) => `<option value="${esc(c)}" data-add="${meta.surcharges[c] || 0}">${esc(meta.prettyChoice(c))}${meta.surcharges[c] ? ` (+${money(meta.surcharges[c])})` : ' (included)'}</option>`).join('')}
      </select></label>`).join('');
  const body = `${crumbs([{ label: 'Home', href: '/' }, { label: cat.title, href: `/c/${cat.slug}` }, { label: fam.title }])}
<article class="product" data-family="${esc(fam.slug)}" data-quote-only="${fam.quoteOnly ? 1 : 0}">
  <div class="product-visual">
    <div class="preview tex-${esc(fam.texture)}" id="preview" aria-label="Size preview"><svg id="preview-svg" viewBox="0 0 400 400" role="img" aria-label="Scale preview of the selected size"></svg></div>
    <p class="preview-note">Drawn to scale against a 4 × 8 ft sheet. Not a proof.</p>
    ${siblings.length ? `<div class="siblings"><span>Also in ${esc(fam.group)}:</span>${siblings.map((f) => (f.slug === fam.slug ? `<strong>${esc(f.title)}</strong>` : `<a href="/p/${f.slug}">${esc(f.title)}</a>`)).join('')}</div>` : ''}
    <section class="product-copy">
      <h2>About this material</h2>
      <p>${esc(fam.description)}</p>
      ${fam.uses.length ? `<h3>Good for</h3><ul>${fam.uses.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
      <h3>Artwork</h3>
      <p>Send a PDF, AI, JPG, PNG or TIFF at final size with fonts outlined and 0.125 in bleed. One artwork per line; add “additional art” for versions. <a href="/help#artwork">Full specs</a>.</p>
    </section>
  </div>
  <form class="configurator" id="configurator" method="post" action="/cart/add" novalidate>
    <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
    <h1>${esc(fam.title)}</h1>
    <p class="lede">${esc(fam.blurb)} Lead time ${esc(fam.leadTime)}.</p>
    <label class="field"><span>Size</span><select name="variantId" id="size" required>${sizeOpts}</select></label>
    ${optionFields}
    <label class="field field-qty"><span>Quantity</span><input type="number" name="qty" id="qty" value="1" min="1" max="${config.limits.qtyMax}" inputmode="numeric" required></label>
    <div class="price-box" aria-live="polite">
      <div><span class="price-label">Each</span><span class="price-unit" id="price-unit">—</span></div>
      <div><span class="price-label">Total before HST</span><span class="price-total" id="price-total">—</span></div>
    </div>
    <div class="actions">
      <button type="submit" class="btn btn-big" id="add-to-cart">Add to cart</button>
      <a class="btn btn-ghost btn-big" id="quote-link" href="/contact?about=${esc(fam.slug)}" hidden>Request a quote</a>
    </div>
    <p class="form-note" id="form-note"></p>
  </form>
</article>`;
  return layout(ctx, { title: fam.title, body, description: `${fam.title} — ${fam.blurb} ${fam.description}`.slice(0, 160) });
}

function searchPage(ctx, q, results) {
  const body = `${crumbs([{ label: 'Home', href: '/' }, { label: 'Search' }])}
<header class="page-head"><h1>${results.length ? `${results.length} result${results.length === 1 ? '' : 's'} for “${esc(q)}”` : `Nothing matched “${esc(q)}”`}</h1>
${results.length ? '' : '<p class="lede">Try a material (coroplast, PVC, vinyl, banner) or a use (lawn sign, window). Or browse the four categories above.</p>'}</header>
<div class="tiles tiles-3">${results.map((f) => tile(`/p/${f.slug}`, f.title, f.blurb, f.texture, priceNote(f.minPrice, f.quoteOnly))).join('')}</div>`;
  return layout(ctx, { title: `Search: ${q}`, body });
}

function cart(ctx) {
  const body = `${crumbs([{ label: 'Home', href: '/' }, { label: 'Cart' }])}
<header class="page-head"><h1>Your cart</h1></header>
${flash(ctx)}
<div id="cart-root" class="cart" data-logged-in="${ctx.user ? 1 : 0}">
  <p class="muted">Loading your cart…</p>
</div>
<template id="cart-empty"><div class="empty"><h2>Your cart is empty.</h2><p>Start with <a href="/c/rigid-boards">rigid boards</a> or <a href="/c/banners">banners</a>. Prices are shown on every size.</p></div></template>`;
  return layout(ctx, { title: 'Cart', body });
}

function checkout(ctx, { errors = {}, values = {} } = {}) {
  const u = ctx.user;
  const v = (k, d = '') => esc(values[k] ?? d);
  const err = (k) => (errors[k] ? `<span class="err">${esc(errors[k])}</span>` : '');
  const saved = (u.addresses || []).length ? `<label class="field"><span>Saved addresses</span><select id="saved-address"><option value="">Choose…</option>${u.addresses.map((a, i) => `<option value="${i}" data-json="${esc(JSON.stringify(a))}">${esc(a.label || a.address1)}</option>`).join('')}</select></label>` : '';
  const body = `${crumbs([{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }])}
<header class="page-head"><h1>Checkout</h1></header>
${flash(ctx)}
<form class="checkout" method="post" action="/checkout" id="checkout-form" novalidate>
  <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
  <input type="hidden" name="cart" id="cart-field" value="">
  <div class="co-col">
    <h2>Contact</h2>
    <label class="field"><span>Name</span><input name="name" required maxlength="100" value="${v('name', u.name)}">${err('name')}</label>
    <label class="field"><span>Company (optional)</span><input name="company" maxlength="100" value="${v('company', u.company)}"></label>
    <label class="field"><span>Email for confirmation</span><input type="email" name="email" required maxlength="254" value="${v('email', u.email)}">${err('email')}</label>
    <label class="field"><span>Phone</span><input type="tel" name="phone" required maxlength="30" value="${v('phone')}">${err('phone')}</label>
    <h2>Delivery</h2>
    <fieldset class="choice"><legend>How do you want it?</legend>
      <label><input type="radio" name="shipMethod" value="pickup" ${values.shipMethod !== 'courier' ? 'checked' : ''}> Free pickup in Mississauga</label>
      <label><input type="radio" name="shipMethod" value="courier" ${values.shipMethod === 'courier' ? 'checked' : ''}> Courier (quoted on the invoice by weight and size)</label>
    </fieldset>
    ${saved}
    <div id="ship-fields">
      <label class="field"><span>Address</span><input name="address1" maxlength="120" autocomplete="address-line1" value="${v('address1')}">${err('address1')}</label>
      <label class="field"><span>Unit / suite (optional)</span><input name="address2" maxlength="60" autocomplete="address-line2" value="${v('address2')}"></label>
      <div class="row">
        <label class="field"><span>City</span><input name="city" maxlength="60" autocomplete="address-level2" value="${v('city')}">${err('city')}</label>
        <label class="field"><span>Province</span><select name="region">${['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'].map((p) => `<option ${(values.region || 'ON') === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="field"><span>Postal code</span><input name="postal" maxlength="10" autocomplete="postal-code" value="${v('postal')}">${err('postal')}</label>
      </div>
      <label class="check"><input type="checkbox" name="saveAddress" value="1" ${values.saveAddress ? 'checked' : ''}> Save this address to my account</label>
    </div>
    <label class="field"><span>Purchase order number (optional)</span><input name="po" maxlength="40" value="${v('po')}"></label>
    <label class="field"><span>Notes for the press (optional)</span><textarea name="notes" maxlength="1000" rows="3">${v('notes')}</textarea></label>
    <label class="check"><input type="checkbox" name="terms" value="1" required> I have read the <a href="/terms" target="_blank" rel="noopener">terms</a>, and my artwork is print-ready.${err('terms')}</label>
    <div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  </div>
  <aside class="co-summary" id="co-summary" aria-live="polite">
    <h2>Order summary</h2>
    <div id="summary-lines" class="muted">Loading…</div>
    <dl class="totals" id="totals"></dl>
    <button type="submit" class="btn btn-big" id="place-order">Continue to payment</button>
    <p class="form-note">You will review the total once more before paying. Nothing is charged on this page.</p>
  </aside>
</form>`;
  return layout(ctx, { title: 'Checkout', body });
}

function pay(ctx, order) {
  const lines = order.lines.map((l) => `<li><span>${esc(l.title)} · ${esc(l.sizeLabel)} × ${l.qty}</span><span>${money(l.total)}</span></li>`).join('');
  const provider = config.payments.provider;
  let gateway;
  if (order.status === 'paid') {
    gateway = `<div class="flash flash-ok">Paid ${esc(new Date(order.paidAt).toLocaleString('en-CA'))}. <a href="/orders/${esc(order.id)}">View order</a></div>`;
  } else if (provider === 'stripe') {
    gateway = `<form method="post" action="/pay/${esc(order.id)}/stripe"><input type="hidden" name="csrf" value="${esc(ctx.csrf)}"><button class="btn btn-big" type="submit">Pay ${money(order.total)} with card</button><p class="form-note">You will be taken to a secure Stripe page. We never see or store your card number.</p></form>`;
  } else {
    gateway = `<div class="gateway-off"><h3>Card payments are not switched on yet.</h3><p>Your order is saved as <strong>awaiting payment</strong>. We will email you an invoice with a secure payment link, or you can pay on pickup.</p>
    ${config.payments.allowSimulatedPayments ? `<form method="post" action="/pay/${esc(order.id)}/simulate"><input type="hidden" name="csrf" value="${esc(ctx.csrf)}"><button class="btn btn-big" type="submit">Simulate a successful payment (test mode)</button><p class="form-note">Visible only outside production.</p></form>` : ''}</div>`;
  }
  const body = `${crumbs([{ label: 'Checkout', href: '/checkout' }, { label: 'Payment' }])}
<header class="page-head"><h1>Pay for order ${esc(order.number)}</h1></header>
${flash(ctx)}
<div class="pay-grid">
  <section class="co-summary">
    <h2>Summary</h2><ul class="lines">${lines}</ul>
    <dl class="totals"><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd><dt>HST 13%</dt><dd>${money(order.tax)}</dd><dt>Delivery</dt><dd>${order.shipMethod === 'pickup' ? 'Free pickup' : 'Quoted on invoice'}</dd><dt class="grand">Total</dt><dd class="grand">${money(order.total)}</dd></dl>
  </section>
  <section class="gateway">${gateway}<p class="secure-note">Secure checkout: encrypted connection, card details handled only by the payment provider, order totals computed on our server.</p></section>
</div>`;
  return layout(ctx, { title: `Payment · ${order.number}`, body });
}

function orderPage(ctx, order) {
  const lines = order.lines.map((l) => `<li><div><strong>${esc(l.title)}</strong><br><span class="muted">${esc(l.sizeLabel)} · qty ${l.qty}${l.options.length ? ' · ' + esc(l.options.map((o) => o.choice).join(', ')) : ''}${l.artwork ? ` · artwork: ${esc(l.artwork.name)}` : ''}</span></div><span>${money(l.total)}</span></li>`).join('');
  const body = `${crumbs([{ label: 'Account', href: '/account' }, { label: `Order ${order.number}` }])}
<header class="page-head"><h1>Order ${esc(order.number)}</h1><p class="lede">Placed ${esc(new Date(order.createdAt).toLocaleString('en-CA'))} · <span class="status status-${esc(order.status)}">${esc(statusText(order.status))}</span></p></header>
${flash(ctx)}
<div class="pay-grid">
  <section class="co-summary"><h2>Items</h2><ul class="lines">${lines}</ul>
  <dl class="totals"><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd><dt>HST</dt><dd>${money(order.tax)}</dd><dt class="grand">Total</dt><dd class="grand">${money(order.total)}</dd></dl>
  ${order.status === 'awaiting_payment' ? `<a class="btn" href="/pay/${esc(order.id)}">Pay now</a>` : ''}</section>
  <section class="co-summary"><h2>Delivery</h2><p>${order.shipMethod === 'pickup' ? 'Pickup in Mississauga. We email you when it is ready.' : `Courier to:<br>${esc(order.ship.address1)}${order.ship.address2 ? '<br>' + esc(order.ship.address2) : ''}<br>${esc(order.ship.city)}, ${esc(order.ship.region)} ${esc(order.ship.postal)}`}</p>
  <h2>Contact</h2><p>${esc(order.contact.name)}${order.contact.company ? ' · ' + esc(order.contact.company) : ''}<br>${esc(order.contact.email)}<br>${esc(order.contact.phone)}</p>${order.po ? `<p>PO: ${esc(order.po)}</p>` : ''}${order.notes ? `<h2>Notes</h2><p>${esc(order.notes)}</p>` : ''}</section>
</div>`;
  return layout(ctx, { title: `Order ${order.number}`, body });
}
const statusText = (s) => ({ awaiting_payment: 'Awaiting payment', paid: 'Paid — in production', shipped: 'Shipped', ready: 'Ready for pickup', cancelled: 'Cancelled' }[s] || s);

function account(ctx, orders) {
  const u = ctx.user;
  const rows = orders.length ? `<table class="orders"><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>${orders.map((o) => `<tr><td><a href="/orders/${esc(o.id)}">${esc(o.number)}</a></td><td>${esc(new Date(o.createdAt).toLocaleDateString('en-CA'))}</td><td>${o.lines.reduce((n, l) => n + l.qty, 0)}</td><td>${money(o.total)}</td><td><span class="status status-${esc(o.status)}">${esc(statusText(o.status))}</span></td></tr>`).join('')}</tbody></table>` : `<div class="empty"><h2>No orders yet.</h2><p>Your first order will show up here with its status and invoice.</p></div>`;
  const body = `<header class="page-head"><h1>${esc(u.name)}</h1><p class="lede">${esc(u.email)}${u.company ? ' · ' + esc(u.company) : ''}</p></header>
${flash(ctx)}
<h2>Orders</h2>${rows}
<h2>Saved addresses</h2>${(u.addresses || []).length ? `<ul class="addr-list">${u.addresses.map((a) => `<li>${esc(a.address1)}${a.address2 ? ', ' + esc(a.address2) : ''}, ${esc(a.city)} ${esc(a.region)} ${esc(a.postal)}</li>`).join('')}</ul>` : '<p class="muted">Addresses you save at checkout appear here.</p>'}
<h2>Security</h2><p class="muted">Signed in since ${esc(new Date(u.lastLoginAt || u.createdAt).toLocaleString('en-CA'))}. Passwords are stored as scrypt hashes; sessions expire after 14 days.</p>`;
  return layout(ctx, { title: 'Account', body });
}

function authPage(ctx, mode, { errors = {}, values = {}, next = '' } = {}) {
  const isLogin = mode === 'login';
  const v = (k) => esc(values[k] || '');
  const err = (k) => (errors[k] ? `<span class="err">${esc(errors[k])}</span>` : '');
  const body = `<div class="auth-wrap">
<form class="auth" method="post" action="/${mode}" novalidate>
  <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
  <input type="hidden" name="next" value="${esc(next)}">
  <h1>${isLogin ? 'Log in' : 'Create your account'}</h1>
  ${errors._ ? `<div class="flash flash-err">${esc(errors._)}</div>` : ''}
  ${flash(ctx)}
  ${isLogin ? '' : `<label class="field"><span>Your name</span><input name="name" required maxlength="100" autocomplete="name" value="${v('name')}">${err('name')}</label>
  <label class="field"><span>Company (optional)</span><input name="company" maxlength="100" autocomplete="organization" value="${v('company')}"></label>`}
  <label class="field"><span>Email</span><input type="email" name="email" required maxlength="254" autocomplete="email" value="${v('email')}">${err('email')}</label>
  <label class="field"><span>Password</span><input type="password" name="password" required minlength="${isLogin ? 1 : 10}" maxlength="128" autocomplete="${isLogin ? 'current-password' : 'new-password'}">${err('password')}${isLogin ? '' : '<small>At least 10 characters with a letter and a number.</small>'}</label>
  ${isLogin ? '' : `<label class="field"><span>Confirm password</span><input type="password" name="password2" required maxlength="128" autocomplete="new-password">${err('password2')}</label>`}
  <div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <button class="btn btn-big" type="submit">${isLogin ? 'Log in' : 'Create account'}</button>
  <p class="form-note">${isLogin ? `New here? <a href="/register${next ? '?next=' + encodeURIComponent(next) : ''}">Create an account</a>.` : `Already have one? <a href="/login${next ? '?next=' + encodeURIComponent(next) : ''}">Log in</a>.`}</p>
</form></div>`;
  return layout(ctx, { title: isLogin ? 'Log in' : 'Create account', body });
}

function staticPage(ctx, title, html) {
  return layout(ctx, { title, body: `${crumbs([{ label: 'Home', href: '/' }, { label: title }])}<article class="prose"><h1>${esc(title)}</h1>${html}</article>` });
}

function contact(ctx, { about = '', sent = false, errors = {}, values = {} } = {}) {
  const fam = about ? catalog.family(about) : null;
  const v = (k, d = '') => esc(values[k] ?? d);
  const err = (k) => (errors[k] ? `<span class="err">${esc(errors[k])}</span>` : '');
  const body = `${crumbs([{ label: 'Home', href: '/' }, { label: 'Contact' }])}
<div class="contact-grid">
<article class="prose"><h1>${fam ? `Quote: ${esc(fam.title)}` : 'Contact'}</h1>
<p>${fam ? `${esc(fam.title)} is quoted per order. Tell us sizes, quantity, colours and when you need it, and we reply with a price the same business day.` : 'Questions about a material, a file, or an order in progress. We answer the same business day.'}</p>
<p><a href="mailto:${esc(config.brand.email)}">${esc(config.brand.email)}</a><br><a href="tel:${esc(config.brand.phoneTel)}">${esc(config.brand.phone)}</a><br>Mon to Fri, 8:30 to 5:00 ET<br>${esc(config.brand.address)}</p></article>
${sent ? `<div class="flash flash-ok">Sent. We reply by email, usually within a few hours on business days.</div>` : `
<form class="auth" method="post" action="/contact" novalidate>
  <input type="hidden" name="csrf" value="${esc(ctx.csrf)}">
  <input type="hidden" name="about" value="${esc(about)}">
  <label class="field"><span>Name</span><input name="name" required maxlength="100" value="${v('name', ctx.user?.name)}">${err('name')}</label>
  <label class="field"><span>Email</span><input type="email" name="email" required maxlength="254" value="${v('email', ctx.user?.email)}">${err('email')}</label>
  <label class="field"><span>Message</span><textarea name="message" rows="6" required maxlength="3000">${v('message')}</textarea>${err('message')}</label>
  <div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <button class="btn btn-big" type="submit">Send message</button>
</form>`}</div>`;
  return layout(ctx, { title: 'Contact', body });
}

function errorPage(ctx, code, text) {
  return layout(ctx, { title: String(code), body: `<div class="empty"><h1>${code}</h1><p>${esc(text)}</p><p><a class="btn" href="/">Back to the home page</a></p></div>` });
}

module.exports = { layout, home, category, product, searchPage, cart, checkout, pay, orderPage, account, authPage, staticPage, contact, errorPage, money, sizeLabel };
