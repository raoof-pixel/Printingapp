'use strict';
// Catalog: generated price data + curated copy. Prices are computed server-side only.
const fs = require('fs');
const path = require('path');
const config = require('./config');

const generated = JSON.parse(fs.readFileSync(path.join(config.dirs.data, 'catalog-generated.json'), 'utf8'));
const meta = require('../data/catalog-meta');

const CATEGORIES = meta.categories; // ordered, with slugs & copy
const familyBySlug = new Map();
const families = generated.families.map((f) => {
  const m = meta.families[f.slug] || {};
  const fam = {
    ...f,
    title: m.title || f.name,
    blurb: m.blurb || '',
    description: m.description || '',
    uses: m.uses || [],
    leadTime: m.leadTime || '4 to 5 business days',
    texture: m.texture || 'plain',
    photo: m.photo ? `/img/photos/pexels-${m.photo}.jpg` : null,
    categorySlug: meta.categorySlugFor[f.category],
    group: m.group || null, // e.g. "Coroplast" groups 4/6/10mm families on category pages
    minPrice: Math.min(...f.variants.filter((v) => v.price > 0).map((v) => v.price), Infinity),
    quoteOnly: f.variants.every((v) => v.quote),
  };
  if (fam.minPrice === Infinity) fam.minPrice = 0;
  familyBySlug.set(f.slug, fam);
  return fam;
});

const variantIndex = new Map();
for (const f of families) for (const v of f.variants) variantIndex.set(v.id, { family: f, variant: v });

function category(slug) {
  const c = CATEGORIES.find((c) => c.slug === slug);
  if (!c) return null;
  const items = families.filter((f) => f.categorySlug === slug);
  // group by `group` so Coroplast 4/6/10mm show as one tile with sub-links
  const groups = [];
  const seen = new Map();
  for (const f of items) {
    const key = f.group || f.slug;
    if (!seen.has(key)) {
      const g = { key, title: f.group || f.title, texture: f.texture, photo: f.photo, families: [], blurb: f.group ? (meta.groups[f.group] || '') : f.blurb, minPrice: Infinity, quoteOnly: true };
      seen.set(key, g); groups.push(g);
    }
    const g = seen.get(key);
    g.families.push(f);
    if (f.minPrice > 0) g.minPrice = Math.min(g.minPrice, f.minPrice);
    if (!f.quoteOnly) g.quoteOnly = false;
  }
  for (const g of groups) if (g.minPrice === Infinity) g.minPrice = 0;
  return { ...c, groups };
}

function search(q) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return [];
  return families.filter((f) => {
    const hay = `${f.title} ${f.name} ${f.category} ${f.subcategory} ${f.blurb} ${f.uses.join(' ')}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/** Server-side price for one line. Options are free add-ons unless meta gives a surcharge. */
function priceLine({ variantId, qty, options }) {
  const hit = variantIndex.get(variantId);
  if (!hit) return null;
  const { family, variant } = hit;
  if (variant.quote) return null;
  const chosen = [];
  let unit = variant.price;
  for (const opt of family.options) {
    const pick = options && options[opt.label];
    if (!pick) continue;
    if (!opt.choices.includes(pick)) return null; // tampered option
    chosen.push({ label: meta.prettyLabel(opt.label), choice: meta.prettyChoice(pick) });
    const surcharge = meta.surcharges[pick];
    if (surcharge) unit += surcharge;
  }
  unit = Math.round(unit * 100) / 100;
  return { family, variant, qty, options: chosen, unit, total: Math.round(unit * qty * 100) / 100 };
}

module.exports = { CATEGORIES, families, family: (slug) => familyBySlug.get(slug) || null, category, search, priceLine, variant: (id) => variantIndex.get(id) || null, currency: generated.currency };
