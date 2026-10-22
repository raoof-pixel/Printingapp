'use strict';
// Unit tests, no browser: node tests/unit.test.js
process.env.NODE_ENV = 'test';
const assert = require('assert');
const catalog = require('../src/catalog');
const auth = require('../src/auth');
const sec = require('../src/security');
const meta = require('../data/catalog-meta');
const source = require('../scripts/source-products.json');

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('  ✓', name); };
console.log('unit');

test('every priced wholesale item is +30% in the catalog', () => {
  for (const r of source) {
    const hit = catalog.variant(r.id);
    if (!hit) continue; // deduped duplicate labels
    if (r.price > 0) assert.strictEqual(hit.variant.price, Math.round(r.price * 1.3 * 100) / 100, r.name);
    else assert.ok(hit.variant.quote, r.name + ' should be quote-only');
  }
});
test('30 product families across 4 categories', () => {
  assert.strictEqual(catalog.families.length, 30);
  assert.strictEqual(catalog.CATEGORIES.length, 4);
});
test('priceLine computes unit, add-ons and totals server-side', () => {
  const fam = catalog.family('coroplast-4mm');
  const v = fam.variants.find((x) => x.label.includes('24x48'));
  const base = catalog.priceLine({ variantId: v.id, qty: 3, options: {} });
  assert.strictEqual(base.unit, v.price);
  assert.strictEqual(base.total, Math.round(v.price * 3 * 100) / 100);
  const withOpts = catalog.priceLine({ variantId: v.id, qty: 1, options: { 'Single or Double Sided': 'Two Sided', 'Add Grommets': 'Grommets All 4 Corners' } });
  assert.strictEqual(withOpts.unit, Math.round((v.price + meta.surcharges['Two Sided'] + meta.surcharges['Grommets All 4 Corners']) * 100) / 100);
});
test('priceLine rejects tampered option values and unknown variants', () => {
  const fam = catalog.family('pvc-3mm');
  assert.strictEqual(catalog.priceLine({ variantId: fam.variants[0].id, qty: 1, options: { 'Add Grommets': 'Free gold grommets' } }), null);
  assert.strictEqual(catalog.priceLine({ variantId: '00000000-0000-0000-0000-000000000000', qty: 1, options: {} }), null);
});
test('quote-only variants cannot be priced', () => {
  const fam = catalog.family('petg-020');
  assert.strictEqual(catalog.priceLine({ variantId: fam.variants[0].id, qty: 1, options: {} }), null);
});
test('search finds by material and use', () => {
  assert.ok(catalog.search('lawn sign').some((f) => f.slug === 'coroplast-4mm'));
  assert.ok(catalog.search('window').length >= 3);
  assert.strictEqual(catalog.search('zzzz-nothing').length, 0);
});
test('passwords hash with scrypt and verify in constant time helpers', () => {
  const h = auth.hashPassword('correct horse 42');
  assert.ok(h.startsWith('scrypt$'));
  assert.ok(auth.verifyPassword('correct horse 42', h));
  assert.ok(!auth.verifyPassword('wrong', h));
  assert.ok(auth.passwordProblems('short1').length > 0);
  assert.strictEqual(auth.passwordProblems('longenough123').length, 0);
});
test('signed values round-trip and reject tampering', () => {
  const s = sec.sign('hello');
  assert.strictEqual(sec.unsign(s), 'hello');
  assert.strictEqual(sec.unsign(s.replace('hello', 'hellp')), null);
  assert.strictEqual(sec.unsign('garbage'), null);
});
test('html escaping neutralises script tags', () => {
  assert.strictEqual(sec.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});
test('validators', () => {
  assert.ok(sec.isEmail('a@b.co')); assert.ok(!sec.isEmail('nope'));
  assert.strictEqual(sec.int('5', 1, 10), 5); assert.strictEqual(sec.int('11', 1, 10), null); assert.strictEqual(sec.int('x', 1, 10), null);
});
console.log(`${n} unit tests passed\n`);
