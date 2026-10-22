/* B2Bprint.ca front-end. Cart lives in localStorage; every price shown from the cart page onward comes from the server. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const csrf = () => $('meta[name="csrf-token"]')?.content || '';
  const money = (n) => '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Cart store ---------- */
  const KEY = 'b2b_cart_v1';
  const cart = {
    read() { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } },
    write(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} cart.badge(); },
    add(item) { const items = cart.read(); const same = items.find((i) => i.variantId === item.variantId && JSON.stringify(i.options) === JSON.stringify(item.options) && !i.artworkId && !item.artworkId); if (same) same.qty = Math.min(5000, same.qty + item.qty); else items.push({ key: Math.random().toString(36).slice(2, 10), ...item }); cart.write(items); },
    remove(key) { cart.write(cart.read().filter((i) => i.key !== key)); },
    setQty(key, qty) { const items = cart.read(); const it = items.find((i) => i.key === key); if (it) it.qty = qty; cart.write(items); },
    setArt(key, art) { const items = cart.read(); const it = items.find((i) => i.key === key); if (it) { it.artworkId = art ? art.id : null; it.artworkName = art ? art.name : null; } cart.write(items); },
    clear() { cart.write([]); },
    badge() { const n = cart.read().reduce((s, i) => s + (Number(i.qty) || 0), 0); const el = $('#cart-count'); if (el) el.textContent = n; },
    async price() {
      const items = cart.read();
      if (!items.length) return { lines: [], subtotal: 0, tax: 0, total: 0 };
      const res = await fetch('/api/cart/price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrf: csrf(), items }) });
      if (!res.ok) throw new Error('price failed');
      return res.json();
    },
  };
  cart.badge();
  if (document.body.dataset.clearCart === '1') cart.clear();

  /* ---------- Product page ---------- */
  const form = $('#configurator');
  if (form) {
    const size = $('#size'); const qty = $('#qty'); const unitEl = $('#price-unit'); const totalEl = $('#price-total');
    const addBtn = $('#add-to-cart'); const quoteLink = $('#quote-link'); const note = $('#form-note');
    const svg = $('#preview-svg');
    const opts = $$('select[data-opt]', form);

    function selected() { return size.options[size.selectedIndex]; }
    function unitPrice() {
      const o = selected(); if (!o || o.dataset.quote === '1') return null;
      let u = Number(o.dataset.price);
      for (const s of opts) { const c = s.options[s.selectedIndex]; if (c && c.value) u += Number(c.dataset.add || 0); }
      return Math.round(u * 100) / 100;
    }
    function draw() {
      const o = selected(); if (!svg || !o) return;
      const w = Number(o.dataset.w) || 24, h = Number(o.dataset.h) || 18;
      const sheetW = 96, sheetH = 48;
      const maxW = Math.max(sheetW, w), maxH = Math.max(sheetH, h);
      const pad = 28, box = 400 - pad * 2;
      const scale = Math.min(box / maxW, box / maxH);
      const ox = pad + (box - maxW * scale) / 2, oy = pad + (box - maxH * scale) / 2;
      const sx = ox + (maxW - sheetW) * scale, sy = oy + (maxH - sheetH) * scale; // sheet bottom-right aligned
      const x = ox + (maxW - w) * scale, y = oy + (maxH - h) * scale;
      const label = (Number.isInteger(w) ? w : w.toFixed(2).replace(/\.?0+$/, '')) + ' × ' + (Number.isInteger(h) ? h : h.toFixed(2).replace(/\.?0+$/, '')) + ' in';
      svg.innerHTML = `
        <rect x="${sx}" y="${sy}" width="${sheetW * scale}" height="${sheetH * scale}" fill="none" stroke="#141b2d" stroke-opacity="0.35" stroke-dasharray="4 4"/>
        <text x="${sx + 6}" y="${sy - 6}" font-size="11" fill="#5b6475">4 × 8 ft sheet</text>
        <rect class="sign" x="${x}" y="${y}" width="${w * scale}" height="${h * scale}" fill="#0c2340" fill-opacity="0.92" stroke="#fff" stroke-width="2"/>
        <text x="${x + (w * scale) / 2}" y="${y + (h * scale) / 2 + 5}" text-anchor="middle" font-size="${Math.max(10, Math.min(16, w * scale / 8))}" font-weight="700" fill="#fff">${w * scale > 70 ? label : ''}</text>
        <line x1="${x}" y1="${y + h * scale + 12}" x2="${x + w * scale}" y2="${y + h * scale + 12}" stroke="#f25c05" stroke-width="1.5"/>
        <text x="${x + (w * scale) / 2}" y="${y + h * scale + 26}" text-anchor="middle" font-size="12" fill="#f25c05" font-weight="700">${label}</text>`;
    }
    function update() {
      const u = unitPrice(); const q = Math.max(1, Math.min(5000, parseInt(qty.value, 10) || 1));
      if (u === null) { unitEl.textContent = 'Quoted'; totalEl.textContent = '—'; addBtn.hidden = true; quoteLink.hidden = false; }
      else { unitEl.textContent = money(u); totalEl.textContent = money(u * q); addBtn.hidden = false; quoteLink.hidden = true; }
      draw();
    }
    size.addEventListener('change', update); qty.addEventListener('input', update); opts.forEach((s) => s.addEventListener('change', update));
    update();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const o = selected(); const q = parseInt(qty.value, 10);
      if (!o || o.dataset.quote === '1') return;
      if (!(q >= 1 && q <= 5000)) { note.textContent = 'Enter a quantity from 1 to 5,000.'; note.className = 'form-note is-err'; qty.focus(); return; }
      const options = {}; for (const s of opts) if (s.value) options[s.dataset.opt] = s.value;
      cart.add({ variantId: o.value, qty: q, options });
      note.innerHTML = 'Added to your cart. <a href="/cart">View cart</a> or keep browsing.'; note.className = 'form-note is-ok';
      addBtn.textContent = 'Add another'; setTimeout(() => { addBtn.textContent = 'Add to cart'; }, 2500);
    });
  }

  /* ---------- Artwork upload helper ---------- */
  async function uploadFile(file, onStatus) {
    if (file.size > 40 * 1024 * 1024) { onStatus('That file is over 40 MB.', 'err'); return null; }
    const fd = new FormData(); fd.append('csrf', csrf()); fd.append('file', file);
    onStatus('Uploading ' + file.name + '…');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { onStatus(data.error || 'Upload failed.', 'err'); return null; }
      onStatus('Attached ' + data.name, 'ok'); return data;
    } catch { onStatus('Upload failed. Check your connection and try again.', 'err'); return null; }
  }

  /* ---------- Cart page ---------- */
  const cartRoot = $('#cart-root');
  if (cartRoot) {
    const loggedIn = cartRoot.dataset.loggedIn === '1';
    async function render() {
      const items = cart.read();
      if (!items.length) { cartRoot.innerHTML = $('#cart-empty').innerHTML; return; }
      let data; try { data = await cart.price(); } catch { cartRoot.innerHTML = '<p class="err">We could not price your cart. Reload the page to try again.</p>'; return; }
      const bad = data.lines.filter((l) => !l.ok).map((l) => l.key);
      if (bad.length) { cart.write(items.filter((i) => !bad.includes(i.key))); return render(); }
      cartRoot.innerHTML = data.lines.map((l) => {
        const it = items.find((i) => i.key === l.key) || {};
        return `<div class="cart-line" data-key="${escapeHtml(l.key)}">
          <div><a href="/p/${escapeHtml(l.slug)}"><strong>${escapeHtml(l.title)}</strong></a><br><span class="opts">${escapeHtml(l.sizeLabel)}${l.options.length ? ' · ' + escapeHtml(l.options.map((o) => o.choice).join(', ')) : ''} · ${money(l.unit)} each</span>
            <div class="upload-field">${it.artworkName ? `Artwork: <strong>${escapeHtml(it.artworkName)}</strong> <button type="button" class="linkish" data-clear-art>Remove</button>` : loggedIn ? `<label>Attach artwork (PDF, AI, JPG, PNG, TIFF) <input type="file" accept=".pdf,.ai,.jpg,.jpeg,.png,.tif,.tiff" data-art></label><span class="muted" data-art-status></span>` : `Artwork: <a href="/login?next=/cart">log in</a> to attach a file, or add it at checkout.`}</div></div>
          <label class="qty">Qty <input type="number" min="1" max="5000" value="${Number(l.qty)}" data-qty aria-label="Quantity for ${escapeHtml(l.title)}"></label>
          <div><div class="line-total">${money(l.total)}</div><button type="button" class="linkish" data-remove>Remove</button></div>
        </div>`;
      }).join('') + `<div class="cart-foot">
          <a class="btn btn-ghost" href="/c/rigid-boards">Keep shopping</a>
          <div><dl class="totals"><dt>Subtotal</dt><dd>${money(data.subtotal)}</dd><dt>HST 13%</dt><dd>${money(data.tax)}</dd><dt class="grand">Total</dt><dd class="grand">${money(data.total)}</dd></dl>
          <p class="muted cart-ship-note">Delivery is free for pickup; courier is quoted on the invoice.</p>
          <a class="btn btn-big" href="${loggedIn ? '/checkout' : '/login?next=/checkout'}" id="to-checkout">${loggedIn ? 'Check out' : 'Log in to check out'}</a></div></div>`;
    }
    cartRoot.addEventListener('click', (e) => {
      const line = e.target.closest('.cart-line'); if (!line) return;
      if (e.target.matches('[data-remove]')) { cart.remove(line.dataset.key); render(); }
      if (e.target.matches('[data-clear-art]')) { cart.setArt(line.dataset.key, null); render(); }
    });
    cartRoot.addEventListener('change', async (e) => {
      const line = e.target.closest('.cart-line'); if (!line) return;
      if (e.target.matches('[data-qty]')) { const q = parseInt(e.target.value, 10); if (q >= 1 && q <= 5000) { cart.setQty(line.dataset.key, q); render(); } else e.target.value = 1; }
      if (e.target.matches('[data-art]') && e.target.files[0]) {
        const status = $('[data-art-status]', line);
        const art = await uploadFile(e.target.files[0], (t, k) => { status.textContent = t; status.className = k === 'err' ? 'err' : 'muted'; });
        if (art) { cart.setArt(line.dataset.key, art); render(); }
      }
    });
    render();
  }

  /* ---------- Checkout page ---------- */
  const co = $('#checkout-form');
  if (co) {
    const summary = $('#summary-lines'); const totalsEl = $('#totals'); const field = $('#cart-field'); const place = $('#place-order');
    const shipFields = $('#ship-fields'); const methods = $$('input[name="shipMethod"]', co);
    function toggleShip() { const courier = co.shipMethod.value === 'courier'; shipFields.hidden = !courier; $$('input', shipFields).forEach((i) => { if (i.name !== 'saveAddress' && i.name !== 'address2') i.required = courier; }); }
    methods.forEach((m) => m.addEventListener('change', toggleShip)); toggleShip();
    $('#saved-address')?.addEventListener('change', (e) => {
      const o = e.target.options[e.target.selectedIndex]; if (!o.dataset.json) return;
      const a = JSON.parse(o.dataset.json); ['address1', 'address2', 'city', 'region', 'postal'].forEach((k) => { if (co[k]) co[k].value = a[k] || ''; });
      co.shipMethod.value = 'courier'; toggleShip();
    });
    async function renderSummary() {
      const items = cart.read();
      if (!items.length) { summary.innerHTML = '<p>Your cart is empty. <a href="/c/rigid-boards">Add something first.</a></p>'; place.disabled = true; return; }
      let data; try { data = await cart.price(); } catch { summary.innerHTML = '<p class="err">Could not load your cart. Reload to try again.</p>'; place.disabled = true; return; }
      const ok = data.lines.filter((l) => l.ok);
      summary.innerHTML = '<ul class="lines">' + ok.map((l) => { const it = items.find((i) => i.key === l.key) || {}; return `<li><div>${escapeHtml(l.title)}<br><span class="muted">${escapeHtml(l.sizeLabel)} × ${l.qty}</span><br>${it.artworkName ? `<span class="muted">Art: ${escapeHtml(it.artworkName)}</span>` : `<label class="muted">Artwork <input type="file" data-key="${escapeHtml(l.key)}" accept=".pdf,.ai,.jpg,.jpeg,.png,.tif,.tiff" data-co-art></label><span class="muted" data-co-status></span>`}</div><span>${money(l.total)}</span></li>`; }).join('') + '</ul>';
      totalsEl.innerHTML = `<dt>Subtotal</dt><dd>${money(data.subtotal)}</dd><dt>HST 13%</dt><dd>${money(data.tax)}</dd><dt class="grand">Total</dt><dd class="grand">${money(data.total)}</dd>`;
      field.value = JSON.stringify(items.map(({ variantId, qty, options, artworkId }) => ({ variantId, qty, options, artworkId: artworkId || undefined })));
      place.disabled = false;
    }
    summary.addEventListener('change', async (e) => {
      if (!e.target.matches('[data-co-art]') || !e.target.files[0]) return;
      const status = e.target.closest('li').querySelector('[data-co-status]');
      const art = await uploadFile(e.target.files[0], (t, k) => { status.textContent = ' ' + t; status.className = k === 'err' ? 'err' : 'muted'; });
      if (art) { cart.setArt(e.target.dataset.key, art); renderSummary(); }
    });
    co.addEventListener('submit', (e) => {
      if (!cart.read().length) { e.preventDefault(); return; }
      field.value = JSON.stringify(cart.read().map(({ variantId, qty, options, artworkId }) => ({ variantId, qty, options, artworkId: artworkId || undefined })));
      if (!co.terms.checked) { e.preventDefault(); co.terms.focus(); alertNote('Please accept the terms to continue.'); return; }
      place.disabled = true; place.textContent = 'Saving your order…';
    });
    function alertNote(t) { const n = $('.form-note', co); if (n) { n.textContent = t; n.className = 'form-note is-err'; } }
    renderSummary();
  }
})();
