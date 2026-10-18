'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const api=fs.readFileSync(path.join(__dirname,'../netlify/functions/api.js'),'utf8');
test('coordinator team UI exposes reversible profile management only',()=>{
  for(const s of ['worker-edit-form','data-worker-toggle','Dezaktywuj konto','Przywróć konto','saveWorkerEdit(e)','toggleWorkerActive(']){
    assert.ok(app.includes(s),'missing team control '+s);
  }
  assert.match(app,/if\(STATE\.me\?\.role!==['"]coordinator['"]\)return/);
  assert.match(app,/await api\('\/team\/'\+encodeURIComponent\(id\),\{method:'PATCH',body:\{name,language\}\}\)/);
  assert.match(app,/await api\('\/team\/'\+encodeURIComponent\(id\),\{method:'PATCH',body:\{is_active:!active\}\}\)/);
  assert.match(app,/form class="worker-edit-form/);
  assert.match(app,/esc\(x\.display\)/);
  assert.doesNotMatch(app,/api\('\/team\/'\+encodeURIComponent\(id\),\{method:'DELETE'/);
});
test('the team REST API rejects privilege-bearing fields',()=>{
  assert.match(api,/const allowed=new Set\(\['name','language','is_active'\]\)/);
  assert.match(api,/if\(a\.role!=='coordinator'\)return deny\(\)/);
  assert.match(api,/if\(Object\.keys\(b\)\.some\(k=>!allowed\.has\(k\)\)\)/);
  assert.ok(api.includes("role:'eq.worker'"));
});
