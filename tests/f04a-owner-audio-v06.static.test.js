'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
function extract(name){
 const start=app.indexOf('function '+name+'(');
 assert.ok(start!==-1,'missing '+name);
 const end=app.indexOf('\nfunction ',start+9);
 return app.slice(start,end<0?app.length:end);
}
const context=vm.createContext({});
vm.runInContext(extract('jobCategory'),context);
const classify=x=>context.jobCategory(x);
test('owner audio v06: explicit category has priority over title',()=>{
 assert.equal(classify({category:'POMIARY',title:'Montaż kuchni'}),'POMIARY');
 assert.equal(classify({work_type:'KUCHNIA',title:'Remont'}),'KUCHNIE');
 assert.equal(classify({category:'NIEZNANA',title:'Remont'}),'');
});
test('owner audio v06: unclassified titles never become false category data',()=>{
 assert.equal(classify({title:'Pomiar zabudowy'}),'');
 assert.equal(classify({title:'Montaż kuchni u klienta'}),'');
 assert.equal(classify({title:'Remont mieszkania'}),'');
 assert.equal(classify({title:'Serwis drzwi',location:'Kuchnia'}),'');
});
test('owner audio v06: missing category is disclosed and reset clears stale date',()=>{
 assert.match(app,/Zlecenia bez potwierdzonej kategorii są widoczne tylko pod/);
 assert.match(app,/if\(b\.dataset\.filterCategory\)\{STATE\.categoryFilter=b\.dataset\.filterCategory;STATE\.statusFilter='ACTIVE';STATE\.dueFilter='ALL'/);
});
test('owner audio v06: high-priority KPI display is compact and secondary group collapses',()=>{
 assert.match(app,/const mainCards=\[/);
 assert.match(app,/const extraCards=\[/);
 assert.match(app,/<details class="f04a-more-kpis"><summary>/);
 assert.match(app,/dashboardArchiveHint:/);
 assert.match(css,/\.f04a-more-kpis>summary\{[^}]*min-height:48px/);
});
test('owner audio v06: horizontal day plan does not invent times absent from due_date',()=>{
 assert.match(app,/function dayPlan\(day,label\)/);
 assert.match(app,/t\('timeNotSet'\)/);
 assert.match(css,/\.f04a-plan-track\{[^}]*overflow-x:auto/);
});
test('owner audio v06: light and dark modes cover mobile nav and forms',()=>{
 assert.match(css,/:root\[data-theme="dark"\] body\{/);
 assert.match(css,/:root\[data-theme="dark"\] :is\(\.topbar,\.sidebar,\.mobile-nav/);
 assert.match(css,/:root\[data-theme="dark"\] :is\(\.chip,\.btn/);
 assert.match(html,/id="themeToggle"/);
 assert.match(app,/button\.setAttribute\('aria-label',t\('toggleTheme'\)\)/);
});
test('owner audio v06: mobile navigation has accessible page semantics',()=>{
 assert.match(css,/\.mobile-nav button\{min-height:54px;min-width:48px/);
 assert.match(app,/aria-current="page"/);
 assert.match(app,/aria-hidden="true"/);
});
test('owner audio v06: worker routes remain minimal and no fake cloud write is claimed',()=>{
 assert.match(app,/worker:\[\['jobs','▤','Moje zlecenia'\],\['settings','⚙','Konto'\]\]/);
 assert.match(app,/if\(worker && isClosedJob\(x\)\)return false/);
 assert.match(app,/Plik NIE został przesłany do chmury Storage/);
});
