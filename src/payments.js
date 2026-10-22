'use strict';
// Payment provider adapter. Stripe Checkout via REST (no SDK needed). Add other providers here.
const crypto = require('crypto');
const config = require('./config');

async function createStripeCheckout(order, { successUrl, cancelUrl }) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', order.id);
  params.set('customer_email', order.contact.email);
  params.set('metadata[order_number]', order.number);
  order.lines.forEach((l, i) => {
    params.set(`line_items[${i}][quantity]`, String(l.qty));
    params.set(`line_items[${i}][price_data][currency]`, 'cad');
    params.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.unit * 100)));
    params.set(`line_items[${i}][price_data][product_data][name]`, `${l.title} ${l.sizeLabel}`.slice(0, 120));
  });
  const n = order.lines.length;
  params.set(`line_items[${n}][quantity]`, '1');
  params.set(`line_items[${n}][price_data][currency]`, 'cad');
  params.set(`line_items[${n}][price_data][unit_amount]`, String(Math.round(order.tax * 100)));
  params.set(`line_items[${n}][price_data][product_data][name]`, 'HST 13%');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.payments.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `order-${order.id}-${order.paymentAttempts || 0}` },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Stripe rejected the request');
  return { id: json.id, url: json.url };
}

/** Verify a Stripe webhook signature (Stripe-Signature: t=...,v1=...). */
function verifyStripeSignature(rawBody, header, tolerance = 300) {
  if (!header || !config.payments.stripeWebhookSecret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > tolerance) return false;
  const expected = crypto.createHmac('sha256', config.payments.stripeWebhookSecret).update(`${t}.${rawBody}`).digest('hex');
  const given = parts.v1 || '';
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

module.exports = { createStripeCheckout, verifyStripeSignature };
