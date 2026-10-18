'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const cfg = fs.readFileSync(path.join(root, 'netlify.toml'),'utf8');
const landing = fs.readFileSync(path.join(root, 'public/landing.html'),'utf8');

test('Premium Cinematic: force landing at root; app and API routes preserved', () => {
  assert.match(cfg, /from\s*=\s*"\/"\s*\n\s*to\s*=\s*"\/landing\.html"\s*\n\s*status\s*=\s*200\s*\n\s*force\s*=\s*true/);
  assert.match(cfg, /from\s*=\s*"\/login"\s*\n\s*to\s*=\s*"\/index\.html"/);
  assert.match(cfg, /from\s*=\s*"\/api\/\*"/);
  assert.match(landing, /href="\/login"[^>]*data-login/);
  assert.match(landing, /content="index,follow"/);
  for (const f of ['public/index.html','public/app.js','public/akp-cinematic.css','public/akp-cinematic.js','public/assets/akp-premium-logo.webp','public/assets/architecture-atmosphere.webp']) {
    assert.ok(fs.existsSync(path.join(root,f)), f + ' missing');
  }
});
