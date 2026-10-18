'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../supabase/functions/akp-provision-worker/index.ts'),'utf8');

test('opaque Supabase secret key must not become a JWT bearer token',()=>{
  assert.match(code,/const headers=\{apikey:secret,'Content-Type':'application\/json'\}/);
  assert.match(code,/if\(!secret\.startsWith\('sb_secret_'\)\)headers\.Authorization='Bearer '\+secret/);
  assert.doesNotMatch(code,/apikey:secret,Authorization:'Bearer '\+secret/);
});
