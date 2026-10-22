'use strict';
// Security primitives: headers, rate limiting, CSRF, signed cookies, input helpers.
const crypto = require('crypto');
const config = require('./config');

/* ---------- HTML escaping (XSS) ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const escAttr = esc;

/* ---------- Security headers ---------- */
function securityHeaders(res, nonce) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Cache-Control', 'no-store');
}

/* ---------- Signed values (HMAC-SHA256) ---------- */
function sign(value) {
  const mac = crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
  return `${value}.${mac}`;
}
function unsign(signed) {
  if (typeof signed !== 'string') return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const mac = signed.slice(i + 1);
  const expected = crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

/* ---------- Cookies ---------- */
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}
function setCookie(res, name, value, { maxAge, httpOnly = true, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (config.isProd) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}
function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

/* ---------- CSRF: double-submit cookie + Origin check ---------- */
const CSRF_COOKIE = 'bp_csrf';
function ensureCsrfToken(req, res, cookies) {
  let token = cookies[CSRF_COOKIE];
  if (!token || !/^[a-f0-9]{48}$/.test(token)) {
    token = crypto.randomBytes(24).toString('hex');
    setCookie(res, CSRF_COOKIE, token, { httpOnly: true, sameSite: 'Strict', maxAge: 60 * 60 * 24 });
  }
  return token;
}
function verifyCsrf(req, cookies, submitted) {
  const cookieTok = cookies[CSRF_COOKIE];
  if (!cookieTok || !submitted || cookieTok.length !== submitted.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(cookieTok), Buffer.from(submitted))) return false;
  // Origin / Referer must match our own host (defence in depth against cross-site posts).
  const origin = req.headers.origin || (req.headers.referer ? safeOrigin(req.headers.referer) : null);
  if (origin) {
    const host = req.headers.host;
    try {
      const u = new URL(origin);
      if (u.host !== host) return false;
    } catch { return false; }
  }
  return true;
}
function safeOrigin(ref) {
  try { return new URL(ref).origin; } catch { return null; }
}

/* ---------- Rate limiting (fixed window, in-memory, per IP) ---------- */
const buckets = new Map();
function clientIp(req) {
  // Only trust X-Forwarded-For when explicitly behind a proxy you control.
  if (process.env.TRUST_PROXY === 'true') {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '0.0.0.0';
}
function rateLimit(req, bucketName) {
  const [max, windowSec] = config.security.rateLimits[bucketName];
  const key = `${bucketName}:${clientIp(req)}`;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowSec * 1000 };
    buckets.set(key, b);
  }
  b.count += 1;
  return { ok: b.count <= max, retryAfter: Math.ceil((b.reset - now) / 1000) };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60 * 1000).unref();

/* ---------- Validation helpers ---------- */
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmail = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const int = (v, min, max) => {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};
const slugOk = (v) => typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v);

module.exports = {
  esc, escAttr, securityHeaders, sign, unsign, parseCookies, setCookie, clearCookie,
  ensureCsrfToken, verifyCsrf, rateLimit, clientIp, str, isEmail, isUuid, int, slugOk,
  newId: () => crypto.randomUUID(),
  nonce: () => crypto.randomBytes(16).toString('base64'),
};
