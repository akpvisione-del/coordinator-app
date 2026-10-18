'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/auth-premium.css'),'utf8');
const cfg=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');
test('AKP Premium login: new branding, same authenticated Commander',()=>{
  assert.match(html,/id="loginView" class="akp-auth-premium"/);
  assert.match(html,/id="loginForm"/);
  for(const id of ['username','password','loginError','startupHealth','appView','mainContent','sideNav','mobileNav'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/src="\/app.js"/);
  assert.match(html,/href="\/auth-premium.css"/);
  assert.match(html,/assets\/akp-premium-logo\.webp/);
  assert.match(cfg,/from = "\/login"\s+to = "\/index.html"/);
  assert.doesNotMatch(html,/class="cinema-login"/);
  assert.match(css,/akp-auth-premium\[hidden\]/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
