'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('public/app.js');
const html = read('public/index.html');
const css = read('public/styles.css');
const api = read('netlify/functions/api.js');

test('F01 job editor calls real PATCH /jobs/:id and handles 409, 422', () => {
  assert.match(app, /function jobEditForm\(/);
  assert.match(app, /function saveJobEdit\(/);
  assert.match(app, /method:'PATCH',body/);
  assert.match(app, /err\.status===409/);
  assert.match(app, /err\.status===422/);
  assert.match(api, /parts\.length===2&&method==='PATCH'/);
});

test('F02 preserves dirty form before navigation or reload', () => {
  assert.match(app, /function checkUnsavedEdit\(/);
  assert.match(app, /function markDirty\(/);
  assert.match(app, /beforeunload/);
  assert.match(app, /data-dirty="false"/);
});

test('F01 crew management uses exact backend assignment contract', () => {
  assert.match(app, /function crewSection\(/);
  assert.match(app, /function addAssignee\(/);
  assert.match(app, /function unassignWorker\(/);
  assert.match(app, /api\('\/jobs\/'\+jobId\+'\/assign',\{method:'POST',body:\{worker:workerId\}\}\)/);
  assert.match(app, /body:\{action:'unassign',worker:workerId\}/);
  assert.match(api, /b\.action==='unassign'/);
});

test('real login screen does not expose demo shortcut credentials', () => {
  for (const x of ['fillCoord', 'fillWorker', 'haslo123', 'DEMO_IN_MEMORY', 'coord@firma.pl', 'monter@firma.pl']) {
    assert.ok(!app.includes(x) && !html.includes(x), 'Found demo shortcut: ' + x);
  }
  assert.match(html, /id="loginForm"/);
});

test('photo metadata path uses full current user UUID', () => {
  assert.match(app, /const userPrefix = STATE\.me\?\.id \|\| ''/);
  assert.doesNotMatch(app, /const userPrefix =[^\n]*\.slice\(0,\s*8\)/);
  assert.match(app, /photoInvalidUser/);
  assert.match(api, /segments\[1\]\.startsWith\(a\.user\.id\+'_'/);
});

test('photo upload is not falsely described as durable Storage', () => {
  assert.match(app, /Plik NIE został przesłany do chmury Storage/);
  assert.match(app, /Podgląd lokalny/);
  assert.doesNotMatch(app, /await (?:supabase|storage)\.storage\.from/);
});

test('job instruction editor matches backend 2500 character contract', () => {
  assert.match(app, /name="instructions" maxlength="2500"/);
  assert.doesNotMatch(app, /name="instructions" maxlength="3000"/);
  assert.match(api, /fields\.instructions=pickText\(b\.instructions,2500\)/);
});

test('responsive mobile design remains in F02 frontend', () => {
  assert.match(css, /job-edit-form/);
  assert.match(css, /crew-section/);
  assert.match(css, /44px/);
});
