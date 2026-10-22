'use strict';
// Rebuilds data/catalog-generated.json from scripts/source-products.json (the captured wholesale list).
// Retail price = wholesale × MARKUP. Change MARKUP and re-run: `npm run build:catalog`.
const fs = require('fs');
const path = require('path');
const MARKUP = Number(process.env.MARKUP || 1.30);
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-products.json'), 'utf8'));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SIZE = /(\d+(?:\.\d+)?)\s*"?\s*h?\s*x\s*(\d+(?:\.\d+)?)\s*"?\s*w?/i;
function family(r) {
  const n = r.name, sub = r.sub;
  if (r.cat === 'ELECTION SIGNS') return ['Election signs (screened 4mm coroplast)', 'election-signs'];
  if (sub === 'ALUPANEL') return ['3mm Alupanel (aluminum composite)', 'alupanel-3mm'];
  if (sub === 'COROPLAST') { const m = /(4|6|10)\s*mm/i.exec(n); return [`${m[1]}mm Coroplast`, `coroplast-${m[1]}mm`]; }
  if (sub === 'FOAM BOARD') return ['3/16" Foam board', 'foam-board'];
  if (sub === 'PETG CLEAR') { const m = /\.0(2|4)0/.exec(n); return [`.0${m[1]}0 Clear PETG`, `petg-0${m[1]}0`]; }
  if (sub === 'PVC') { const m = /(3|6|10|12)\s*mm/i.exec(n); return [`${m[1]}mm PVC board`, `pvc-${m[1]}mm`]; }
  if (sub === 'STYRENE') { const m = /\.0(2|3|6)0/.exec(n); return [`.0${m[1]}0 Styrene`, `styrene-0${m[1]}0`]; }
  return [n.trim(), slug(n)];
}
const fams = new Map();
for (const r of raw) {
  const [name, fslug] = family(r);
  if (!fams.has(fslug)) fams.set(fslug, { slug: fslug, name, category: r.cat, subcategory: r.sub, variants: [], attrsets: new Map() });
  const f = fams.get(fslug);
  const m = SIZE.exec(r.name);
  const price = r.price > 0 ? Math.round(r.price * MARKUP * 100) / 100 : 0;
  f.variants.push({ id: r.id, label: r.name.replace(/\s+/g, ' ').trim(), size: m ? [Number(m[1]), Number(m[2])] : null, price, quote: price === 0 });
  const key = JSON.stringify(r.attrs); f.attrsets.set(key, (f.attrsets.get(key) || 0) + 1);
}
const families = [];
for (const f of fams.values()) {
  const best = [...f.attrsets.entries()].sort((a, b) => b[1] - a[1])[0][0];
  f.options = JSON.parse(best).filter((a) => a.options.length).map((a) => ({ label: a.label, choices: a.options }));
  delete f.attrsets;
  f.variants.sort((a, b) => ((a.size ? a.size[0] * a.size[1] : 0) - (b.size ? b.size[0] * b.size[1] : 0)) || a.label.localeCompare(b.label));
  const seen = new Set(); f.variants = f.variants.filter((v) => { const k = v.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  families.push(f);
}
const categories = {};
for (const f of families) (categories[f.category] = categories[f.category] || []).push(f.slug);
fs.writeFileSync(path.join(__dirname, '..', 'data', 'catalog-generated.json'), JSON.stringify({ markup: MARKUP, currency: 'CAD', families, categories }, null, 1));
console.log(`Wrote ${families.length} families, ${families.reduce((n, f) => n + f.variants.length, 0)} variants at ×${MARKUP}`);
