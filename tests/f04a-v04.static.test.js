'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
test('F04A v04: system note defaults to concise disclosure, no false import claim',()=>{
 assert.match(html,/<details class="system-notice f04a-system-notice">/);
 assert.doesNotMatch(html,/Zlecenia zaimportowano z centralnej bazy Google/);
 assert.match(html,/nie są automatycznie potwierdzone/);
});
test('F04A v04: advanced filters remain optional and preserve state',()=>{
 assert.match(app,/advancedFilters:false/);
 assert.match(app,/class="f04a-advanced-filters" \$\{STATE\.advancedFilters/);
 assert.match(app,/document\.addEventListener\('toggle'/);
});
test('F04A v04: archive unlocks after due-date selection',()=>{
 assert.match(app,/if\(STATE\.statusFilter==='ZAKONCZONE'\)\{STATE\.dueFilter='ALL';STATE\.categoryFilter='ALL';\}/);
 assert.match(app,/data-filter-status="ZAKONCZONE"/);
});
test('F04A v04: no promise of list search by absent personal data',()=>{
 assert.match(app,/\(numer, tytuł, lokalizacja\)\.\.\./);
 assert.doesNotMatch(app,/\(LM, AKP, klient, ulica\)\.\.\./);
});
test('F04A v04: translations and touch-size disclosure',()=>{
 assert.equal((app.match(/advancedFilters:/g)||[]).length,5); // state + PL/UK/RU/EN
 assert.match(css,/\.f04a-advanced-filters>summary\{[^}]*min-height:44px/);
 assert.match(css,/\.f04a-system-notice summary\{[^}]*min-height:46px/);
});
