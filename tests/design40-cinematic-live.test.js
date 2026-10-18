'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('public/index.html','utf8');
const css=fs.readFileSync('public/akp-design-tokens.css','utf8');
test('Design40 Cinematic token layer loads after Unified styles in existing Commander',()=>{
 const old=html.indexOf('href="/akp-unified.css"'),next=html.indexOf('href="/akp-design-tokens.css"');
 assert.ok(old>=0&&next>old);
 assert.ok(html.includes('id="loginView"')&&html.includes('id="appView"'));
 assert.ok(html.includes('src="/app.js"'));
});
test('Light + dark styles remain scoped to actual signed-in app',()=>{
 assert.match(css,/#appView\s*\{/);
 assert.match(css,/:root\[data-theme="dark"\] #appView/);
 assert.match(css,/--akp-touch-min:48px/);
 assert.match(css,/#appView\s+:is\(button/);
 assert.doesNotMatch(css,/\.akp-financial-data\s*\{\s*display\s*:\s*none/i);
 assert.doesNotMatch(css,/\b(auth|fetch|localStorage|sessionStorage|indexedDB)\s*\(/i);
 assert.doesNotMatch(css,/@import|url\s*\(\s*https?:/i);
});
test('PWA repair remains wired after purely visual integration',()=>{
 assert.ok(html.includes('/manifest.webmanifest?v=20261016-commander-pwa-v03'));
 assert.ok(fs.existsSync('public/sw.js'));
 assert.ok(fs.existsSync('public/assets/akp-app-512.png'));
});
