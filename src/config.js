'use strict';
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';

// SESSION_SECRET must be set in production. In dev we derive a stable one per machine so sessions survive restarts.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) throw new Error('SESSION_SECRET environment variable is required in production');
  sessionSecret = crypto.createHash('sha256').update('dev-only-' + ROOT).digest('hex');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  baseUrl: process.env.BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  sessionSecret,
  brand: {
    name: 'B2Bprint.ca',
    short: 'B2Bprint',
    tagline: 'Wholesale-grade signs and banners. No minimums.',
    descriptor: 'Rigid boards, vinyl and banners printed in Mississauga and shipped across Ontario.',
    email: 'orders@b2bprint.ca',
    phone: '416 655 0205',
    phoneTel: '+14166550205',
    phone2: '437 778 4446',
    phone2Tel: '+14377784446',
    address: '6345 Dixie Rd, Unit 202',
    city: 'Mississauga, ON L5T 2E6',
  },
  currency: 'CAD',
  taxRate: 0.13, // Ontario HST
  dirs: {
    root: ROOT,
    public: path.join(ROOT, 'public'),
    data: path.join(ROOT, 'data'),
    uploads: path.join(ROOT, 'uploads'), // outside public/ — never served directly
  },
  limits: {
    jsonBody: 64 * 1024,          // 64 KB for JSON / form posts
    uploadBody: 40 * 1024 * 1024, // 40 MB artwork files
    uploadTypes: {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/tiff': 'tif',
      'application/postscript': 'ai',
      'application/illustrator': 'ai',
    },
    cartItems: 50,
    qtyMax: 5000,
  },
  security: {
    sessionTtlSec: 60 * 60 * 24 * 14,  // 14 days
    loginMaxAttempts: 6,
    loginLockMinutes: 15,
    rateLimits: {
      // key: [max requests, window in seconds]
      auth: [20, 15 * 60],
      checkout: [15, 15 * 60],
      upload: [30, 15 * 60],
      api: [300, 15 * 60],
    },
  },
  payments: {
    provider: process.env.PAYMENT_PROVIDER || (process.env.STRIPE_SECRET_KEY ? 'stripe' : 'none'),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    allowSimulatedPayments: !isProd || process.env.ALLOW_SIMULATED_PAYMENTS === 'true',
  },
};
