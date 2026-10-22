'use strict';
// Exports a static, read-only preview of the public pages (for GitHub Pages). Cart/login/checkout need the Node server.
// Usage: node scripts/export-static.js <outDir> <basePath>   e.g. node scripts/export-static.js /tmp/site /Printingapp
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const [, , outDir = 'site', base = ''] = process.argv;
const PORT = 3977;
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data', 'catalog-generated.json'), 'utf8'));
const meta = require('../data/catalog-meta');

const pages = ['/', '/search?q=banner', '/help', '/about', '/delivery', '/privacy', '/terms', '/contact', '/login', '/register', '/cart',
  ...meta.categories.map((c) => `/c/${c.slug}`), ...catalog.families.map((f) => `/p/${f.slug}`)];

const get = (p) => new Promise((resolve, reject) => http.get(`http://localhost:${PORT}${p}`, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d)); }).on('error', reject));
const fileFor = (p) => {
  const clean = p.split('?')[0];
  return clean === '/' ? 'index.html' : path.join(clean.slice(1), 'index.html');
};
const NOTE = `<div class="flash flash-ok" style="margin:16px auto;max-width:1180px">Design preview. Cart, accounts and checkout run on the Node server — see the README to run it locally.</div>`;

(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), LOG_REQUESTS: 'false' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await get('/'); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of pages) {
    let html = await get(p);
    html = html.replace(/(href|src|action)="\/(?!\/)/g, `$1="${base}/`)
      .replace(/<meta name="csrf-token"[^>]*>/, '')
      .replace('<main id="main" class="wrap">', `${NOTE}<main id="main" class="wrap">`)
      .replace(/<script src="[^"]*app\.js"[^>]*><\/script>/, `<script src="${base}/app.js"></script>`);
    const f = path.join(outDir, fileFor(p));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, html);
  }
  fs.cpSync(path.join(root, 'public'), outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
  server.kill();
  console.log(`Exported ${pages.length} pages to ${outDir}`);
})();
