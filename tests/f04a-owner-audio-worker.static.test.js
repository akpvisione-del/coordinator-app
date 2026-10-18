'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.resolve(__dirname,'../public/app.js'),'utf8');

test('audio UX F04A: worker defaults to current jobs, coordinator remains active',()=>{
  assert.match(app,/STATE\.statusFilter=me\.role==='worker'\?'CURRENT':'ACTIVE'/);
});
test('audio UX F04A: worker current filter does not include incoming jobs',()=>{
  assert.match(app,/sStatus==='CURRENT'\s*&&\s*\(isClosedJob\(x\)\|\|\['NOWE','DO_KONTAKTU','DO_UMOWIENIA'\]\.includes\(x\.status\)\)/);
  assert.match(app,/data-filter-status="CURRENT">\$\{t\('currentJobs'\)\}/);
  assert.match(app,/STATE\.jobs\.filter\(j=>!isClosedJob\(j\)&&!\['NOWE','DO_KONTAKTU','DO_UMOWIENIA'\]\.includes\(j\.status\)\)\.length/);
});
test('audio UX F04A: worker reset never activates coordinator all-active filter',()=>{
  assert.match(app,/if\(b\.dataset\.resetFilters\)[\s\S]{0,180}STATE\.statusFilter = STATE\.me\?\.role==='worker'\?'CURRENT':'ACTIVE'/);
});
test('audio UX F04A: archive stays inaccessible in daily worker filter but retained for coordinator',()=>{
  assert.match(app,/if\(worker && isClosedJob\(x\)\)return false/);
  assert.match(app,/data-filter-status="ZAKONCZONE"/);
});
