# BoldPrint — retail print store

A complete web store for large-format printing: rigid boards (coroplast, PVC, aluminum composite, foam board, styrene, clear PETG), adhesive vinyl and window graphics, banners, and election signs. 30 products, 279 stock sizes, every one priced.

Built with **zero runtime dependencies** — plain Node.js 20+ (`http`, `crypto`, `fs`). No framework, no database server, nothing to install. `node server.js` and it runs.

## Run it

```bash
git clone https://github.com/raoof-pixel/Printingapp && cd Printingapp
node server.js
# → http://localhost:3000
```

Create an account, add a product to the cart, check out, and press **Simulate a successful payment** (shown only outside production) to see the whole flow.

### Production

```bash
cp .env.example .env     # fill in SESSION_SECRET (32+ random bytes) and BASE_URL
NODE_ENV=production node --env-file=.env server.js
```

Or with Docker: `docker build -t boldprint . && docker run -p 3000:3000 --env-file .env -v boldprint-data:/app/data -v boldprint-uploads:/app/uploads boldprint`

Put it behind HTTPS (Caddy, nginx, or your host's load balancer) and set `TRUST_PROXY=true` so rate limiting sees real client IPs.

## What's in the box

| Area | Details |
|---|---|
| Catalog | `data/catalog-generated.json` — built from a captured wholesale price list at **×1.30 retail markup** (`npm run build:catalog`, change `MARKUP` env to re-price). `data/catalog-meta.js` holds product copy, category grouping, option labels and add-on surcharges. |
| Product page | Size dropdown with price per size, finishing options with per-option surcharge, quantity, live total, and a **to-scale preview** of the chosen size against a 4×8 ft sheet. Quote-only items route to a quote form. |
| Cart | Stored in the browser (localStorage); every price is recomputed on the server via `/api/cart/price`. Client-side prices are never trusted. |
| Artwork | PDF / AI / JPG / PNG / TIFF up to 40 MB, type checked by MIME **and** file signature, stored outside the web root with random names, tied to the uploading account. |
| Accounts | Register, log in, order history, saved addresses. |
| Checkout | Pickup or courier, address validation (Canadian postal code), PO number, notes, terms acceptance, HST 13%. |
| Payment | Stripe Checkout via REST (`src/payments.js`), webhook signature verification, and a server-side verification on return. Without Stripe keys the order is saved as *awaiting payment* and a test-mode "simulate payment" button appears in development. |
| Pages | Home, 4 category pages, 30 product pages, search, cart, checkout, payment, order, account, login, register, contact/quote, help (artwork specs), delivery, about, privacy, terms, 404. |

## Security

- **Passwords**: scrypt (N=16384) with per-user salt, constant-time comparison; a dummy hash is checked for unknown emails so timing doesn't leak whether an account exists. 10+ chars with a letter and a number. **Six failed logins lock the account for 15 minutes.**
- **Sessions**: HMAC-SHA256 signed, `HttpOnly`, `SameSite=Lax`, `Secure` in production, 14-day expiry. Password hashes are never passed to templates.
- **CSRF**: double-submit cookie token (`SameSite=Strict`) on every POST plus an Origin/Referer host check.
- **Headers**: strict Content-Security-Policy with a per-request script nonce (no inline styles or scripts, no third-party origins), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, HSTS in production.
- **Input**: every value length-capped and validated server-side; all output HTML-escaped; `next=` redirects restricted to local paths; slugs and IDs pattern-checked.
- **Rate limiting**: per-IP fixed windows on auth (20/15 min), checkout, uploads and the pricing API; honeypot field on public forms.
- **Bodies**: 64 KB cap on form/JSON posts, 40 MB on uploads, answered with 413.
- **Static files**: path-traversal guard; `uploads/` is never served.
- **Payments**: card data never touches this server; amounts are built from the server-side order; Stripe webhooks are signature-checked with timestamp tolerance; order status only moves to *paid* from a verified provider response.
- **Authorization**: orders and uploads are scoped to the owning user; other users get 404.

## Connect Stripe

1. In Stripe, create a restricted key with Checkout Sessions write access → `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint `https://your-domain/webhooks/stripe` for `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`.
3. Set `BASE_URL` to your public URL. Restart. The payment page now shows **Pay with card**.

Other providers (Square, Moneris, PayPal): add an adapter in `src/payments.js` and a branch in the `/pay/:id` routes.

## Tests

```bash
npm test
```

- `tests/unit.test.js` — pricing math and markup for every captured wholesale item, option tampering, hashing, signing, escaping.
- `tests/e2e.test.js` — boots the server on a throwaway data directory and drives a real Chromium through 36 scenarios: headers, path traversal, CSRF, oversized bodies, browsing, configuring, cart maths, tampered carts, registration validation, lockout, artwork upload (bad file types rejected), checkout validation, order placement, simulated payment, cross-user access, contact form, mobile overflow, rate limiting, and a zero-console-error check. Screenshots land in `tests/screenshots/`. Needs Playwright (`npm i -g playwright && npx playwright install chromium`) if not already available.

## Customising

- **Brand name, phone, email, address**: `src/config.js → brand`.
- **Colours and type**: tokens at the top of `public/styles.css`.
- **Add-on prices**: `data/catalog-meta.js → surcharges` (CAD per unit).
- **Tax rate**: `src/config.js → taxRate`.
- **Storage**: `src/db.js` is a tiny atomic JSON store (fine for one instance). To move to Postgres/SQLite, reimplement its five functions.

## Layout

```
server.js            routes, body parsing, uploads, orders, webhooks
src/config.js        settings & env
src/security.js      headers, CSRF, signing, rate limit, validators, escaping
src/auth.js          scrypt, sessions, lockout
src/catalog.js       catalog + server-side pricing
src/render.js        all page templates
src/payments.js      Stripe adapter
src/pages-content.js help/about/terms copy
data/                catalog + runtime JSON store (users/orders ignored by git)
public/              styles.css, app.js, images
scripts/             catalog builder + source price list
tests/               unit + end-to-end
```
