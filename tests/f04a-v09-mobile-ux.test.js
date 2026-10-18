'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.resolve(__dirname,'../public/app.js'),'utf8');
const css=fs.readFileSync(path.resolve(__dirname,'../public/styles.css'),'utf8');
const start=app.indexOf('function overview(){'),stop=app.indexOf('\nfunction jobEditForm(',start);
assert.ok(start>=0&&stop>start);
const snippet=app.slice(start,stop);
function dashboard(jobs){
  const today='2026-10-13',tomorrow='2026-10-14';
  const ctx={STATE:{jobs},todayLocalISO:()=>today,tomorrowLocalISO:()=>tomorrow,
  isClosedJob:j=>['ZAKONCZONE','ANULOWANE'].includes(j.status),
  t:k=>k,esc:x=>String(x),header:()=>'',refreshBtn:()=>'',card:(name,value)=>value,
  dayPlan:()=>''};vm.createContext(ctx);vm.runInContext(snippet,ctx);return ctx.overview();
}
test('v09 mobile dashboard shows exactly 3 KPI in primary grid',()=>{
 const h=dashboard([{status:'NOWE',due:'2026-10-13'},{status:'W_REALIZACJI',due:'2026-10-14'}]);
 const primary=h.match(/<div class="f04a-kpi-grid">([\s\S]*?)<\/div>/)[1];
 assert.equal((primary.match(/class="f04a-kpi"/g)||[]).length,3);
 assert.match(primary,/data-dashboard-filter="NEW"/);
 assert.match(primary,/data-dashboard-filter="TODAY"/);
 assert.match(primary,/data-dashboard-filter="TOMORROW"/);
 assert.match(h,/data-dashboard-filter="OVERDUE"/);
 assert.match(h,/data-dashboard-filter="NODATE"/);
});
test('v09 dashboard does not invent unassigned crew without metadata',()=>{
 const h=dashboard([{status:'NOWE',due:'2026-10-13'}]);
 assert.doesNotMatch(h,/data-dashboard-filter="UNASSIGNED"/);
 const verified=dashboard([{status:'NOWE',assignees:[]},{status:'W_REALIZACJI',assignees:['worker']}]);
 assert.match(verified,/data-dashboard-filter="UNASSIGNED"/);
});
test('v09 does not count closed jobs in KPIs',()=>{
 const h=dashboard([{status:'ZAKONCZONE',due:'2026-10-13'},{status:'NOWE',due:'2026-10-13'}]);
 assert.match(h,/data-dashboard-filter="TODAY" aria-label="filterToday: 1"/);
});
test('v09 category filters rely on metadata and hide inert chips',()=>{
 assert.match(app,/STATE\.jobs\.some\(j=>jobCategory\(j\)\)\?`<div class="chips f04a-category-chips"/);
 assert.match(app,/categoryMissing/);
 assert.match(app,/if\(STATE\.categoryFilter!=='ALL'&&!STATE\.jobs\.some/);
});
test('v09 active archive clears category and new KPI uses real new status',()=>{
 assert.match(app,/if\(STATE\.statusFilter==='ZAKONCZONE'\)\{STATE\.dueFilter='ALL';STATE\.categoryFilter='ALL';\}/);
 assert.match(app,/STATE\.statusFilter=filter==='NEW'\?'NOWE':'ACTIVE'/);
});
test('v09 adds coherent i18n in four languages and mobile KPI span',()=>{
 assert.equal((app.match(/dashboardMore:/g)||[]).length,4);
 assert.equal((app.match(/dashboardArchiveHint:/g)||[]).length,4);
 assert.equal((app.match(/categoryEvidenceNotice:/g)||[]).length,4);
 assert.match(css,/\.f04a-dashboard>\.f04a-kpi-grid>\.f04a-kpi:last-child:nth-child\(odd\)/);
});
