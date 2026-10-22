'use strict';
// Password hashing (scrypt), sessions (signed httpOnly cookies), lockout.
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const sec = require('./security');

const SESSION_COOKIE = 'bp_session';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
function verifyPassword(password, stored) {
  try {
    const [algo, saltB64, keyB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const key = crypto.scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(key, expected);
  } catch { return false; }
}

function passwordProblems(pw) {
  const problems = [];
  if (typeof pw !== 'string' || pw.length < 10) problems.push('Use at least 10 characters.');
  if (pw && pw.length > 128) problems.push('Keep it under 128 characters.');
  if (pw && !/[a-zA-Z]/.test(pw)) problems.push('Include a letter.');
  if (pw && !/[0-9]/.test(pw)) problems.push('Include a number.');
  if (pw && /^(password|12345|qwerty)/i.test(pw)) problems.push('That password is too common.');
  return problems;
}

/* ---------- Users ---------- */
function findUserByEmail(email) {
  const e = String(email).toLowerCase();
  return db.find('users', (u) => u.email === e);
}
function createUser({ name, email, company, password }) {
  const user = {
    id: sec.newId(),
    name, company: company || '',
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    failedLogins: 0, lockedUntil: null,
    addresses: [],
  };
  db.insert('users', user);
  return user;
}

/* ---------- Login with lockout ---------- */
function attemptLogin(email, password) {
  const user = findUserByEmail(email);
  // Always run a hash check so timing doesn't reveal whether the email exists.
  const dummy = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  if (!user) { verifyPassword(password, dummy); return { ok: false }; }
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return { ok: false, locked: true };
  if (!verifyPassword(password, user.passwordHash)) {
    const failed = (user.failedLogins || 0) + 1;
    const patch = { failedLogins: failed };
    if (failed >= config.security.loginMaxAttempts) {
      patch.lockedUntil = new Date(Date.now() + config.security.loginLockMinutes * 60 * 1000).toISOString();
      patch.failedLogins = 0;
    }
    db.update('users', (u) => u.id === user.id, patch);
    return { ok: false, locked: Boolean(patch.lockedUntil) };
  }
  db.update('users', (u) => u.id === user.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() });
  return { ok: true, user };
}

/* ---------- Sessions ---------- */
function startSession(res, user) {
  const payload = JSON.stringify({ uid: user.id, iat: Date.now(), nonce: crypto.randomBytes(8).toString('hex') });
  const token = sec.sign(Buffer.from(payload).toString('base64url'));
  sec.setCookie(res, SESSION_COOKIE, token, { maxAge: config.security.sessionTtlSec, sameSite: 'Lax' });
}
function endSession(res) { sec.clearCookie(res, SESSION_COOKIE); }
function currentUser(cookies) {
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  const value = sec.unsign(raw);
  if (!value) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.uid !== 'string') return null;
  if (Date.now() - payload.iat > config.security.sessionTtlSec * 1000) return null;
  const user = db.find('users', (u) => u.id === payload.uid);
  if (!user) return null;
  const { passwordHash, ...safe } = user; // never expose the hash to templates
  return safe;
}

module.exports = { hashPassword, verifyPassword, passwordProblems, findUserByEmail, createUser, attemptLogin, startSession, endSession, currentUser };
