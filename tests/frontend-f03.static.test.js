'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
const style = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
const backend = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/api.js'), 'utf8');
const ONE_DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const date = shift => new Date(now.getTime() + shift * ONE_DAY).toISOString().slice(0,10);
const j = (id,title,due,status,priority='NORMALNY',extra={}) => ({
  id, title, reference:'LM/'+id, lm_number:'032/'+id, akp_id:'AKP-'+id,
  iproc_number:'iProc-'+id, client_name:'Klient '+id, client_phone:'+48123456789',
  client_address:'Ulica '+id+', Warszawa', due, status, priority, assignees:[],
  instructions:'Montaz', ...extra
});
const jobs = [
 j('a','Kuchnia Warszawa',date(-2),'W_REALIZACJI','KRYTYCZNY'),
 j('b','Lazienka Janki',date(2),'NOWE','WYSOKI'),
 j('c','Serwis Otwock',date(0),'ZAKONCZONE'),
 j('d','Meble Ursus',null,'DO_UMOWIENIA')
];
function harness(role='coordinator',lang='pl'){
  const src=source.replace(/\bboot\(\);\s*$/, '');
  assert.notEqual(src,source,'Source must end in a sole boot() call');
  const sandbox = {console,URL,Date,Math,Number,Intl,encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:()=>null},document:{getElementById:()=>null}};
  vm.createContext(sandbox);
  vm.runInContext(src + '\n globalThis.__akp = {STATE, I18N, t, jobCard, jobDetail, jobsPage, jobOpen, sortOperationalJobs, overview};',sandbox);
  const m=sandbox.__akp;m.STATE.me={role,preferred_lang:lang,display:'Demo',id:'550e8400-e29b-41d4-a716-446655440000'};
  m.STATE.jobs=jobs;m.STATE.team=[];m.STATE.detail=null;m.STATE.openJob=null;
  return m;
}
test('F03 features exist once; no overwritten old jobCard',()=>{
  assert.equal((source.match(/function jobCard\(/g)||[]).length,1);
  for (const name of ['jobDetail','jobsPage','crewSection','jobEditForm','checkUnsavedEdit','addAssignee','unassignWorker'])
    assert.match(source,new RegExp('function '+name+'\\('));
  assert.match(style,/priority-critical/);
  assert.match(style,/detail-tab-btn/);
  assert.match(style,/jobs-filter-panel/);
});
test('F03 coordinator cards filter by job/client/LM/AKP and show badges',()=>{
 const m=harness();m.STATE.search='Janki';let html=m.jobsPage();
 assert.match(html,/Lazienka Janki/);assert.doesNotMatch(html,/Kuchnia Warszawa/);
 m.STATE.search='032\/a';html=m.jobsPage();assert.match(html,/Kuchnia Warszawa/);assert.doesNotMatch(html,/Lazienka Janki/);
 m.STATE.search='';html=m.jobsPage();assert.match(html,/priority-critical/);assert.match(html,/priority-high/);
 assert.match(html,/data-filter-status="ACTIVE"/);assert.match(html,/data-filter-due="OVERDUE"/);
});
test('F03 status filters include/exclude cases correctly',()=>{
 const m=harness();m.STATE.statusFilter='ZAKONCZONE';let h=m.jobsPage();
 assert.match(h,/Serwis Otwock/);assert.doesNotMatch(h,/Kuchnia Warszawa/);
 m.STATE.statusFilter='REALIZACJA';h=m.jobsPage();assert.match(h,/Kuchnia Warszawa/);assert.doesNotMatch(h,/Lazienka Janki/);
 m.STATE.statusFilter='ACTIVE';h=m.jobsPage();assert.doesNotMatch(h,/Serwis Otwock/);assert.match(h,/Lazienka Janki/);
});
test('F03 due filters distinguish overdue/today/upcoming correctly',()=>{
 const m=harness();m.STATE.statusFilter='ALL';m.STATE.dueFilter='OVERDUE';let h=m.jobsPage();
 assert.match(h,/Kuchnia Warszawa/);assert.doesNotMatch(h,/Serwis Otwock/);
 m.STATE.dueFilter='TODAY';h=m.jobsPage();assert.doesNotMatch(h,/Serwis Otwock/);assert.doesNotMatch(h,/Kuchnia Warszawa/);
 m.STATE.dueFilter='UPCOMING';h=m.jobsPage();assert.match(h,/Lazienka Janki/);assert.doesNotMatch(h,/Kuchnia Warszawa/);
});
test('F04A presents one scrollable detail with coordinator-only finance',()=>{
 const m=harness();let h=m.jobDetail(jobs[0],false);
 for(const name of ['info','crew','tasks','photos','finance']){
   assert.match(h,new RegExp('id="job-section-'+name+'"'));
   assert.match(h,new RegExp('data-jump-section="'+name+'"'));
 }
 assert.doesNotMatch(h,/role="tablist"|data-job-tab=/);
 assert.match(h,/Przychód netto/);
 const worker=harness('worker');h=worker.jobDetail(jobs[0],true);
 for(const name of ['info','tasks','photos'])assert.match(h,new RegExp('id="job-section-'+name+'"'));
 assert.doesNotMatch(h,/job-section-crew|job-section-finance|Przychód netto|Zapisz kwoty/);
});

test('F03 i18n covers filter and detail names across PL, UA, RU, EN',()=>{
 const m=harness();
 for(const lang of ['pl','uk','ru','en']){
  m.STATE.me.preferred_lang=lang;
  for(const key of ['tabInfo','tabCrew','tabTasks','tabPhotos','filterActive','filterToday','filterReset','filterStatusLabel','filterDueLabel','photoInvalidUser'])
    assert.equal(typeof m.I18N[lang][key],'string',lang+': '+key);
  m.STATE.statusFilter='ACTIVE';const page=m.jobsPage();
  assert.ok(page.includes(m.I18N[lang].filterReset),lang+' reset label missing');
  assert.ok(page.includes(m.I18N[lang].allActive),lang+' active label missing');
 }
});
test('F03 does not regress F02 full-UUID photo path, length and auth',()=>{
 assert.match(source,/const userPrefix = STATE\.me\?\.id \|\| ''/);
 assert.match(source,/photoInvalidUser/);
 assert.doesNotMatch(source,/const userPrefix =[^\n]*slice\(0,\s*8\)/);
 assert.match(source,/name="instructions" maxlength="2500"/);
 assert.doesNotMatch(source,/name="instructions" maxlength="3000"/);
 assert.match(backend,/storagePath=pickText\(b\.storage_path/);
 for(const demo of ['fillCoord','fillWorker','haslo123'])assert.ok(!source.includes(demo)&&!index.includes(demo));
});
test('F03 string-escapes untrusted customer and job fields',()=>{
 const m=harness();const hostile=j('h','<img src=x onerror=alert(1)>',date(0),'NOWE', 'NORMALNY',{client_name:'<script>alert(9)</script>'});
 const h=m.jobCard(hostile,false);
 assert.doesNotMatch(h,/<script>alert|<img src=x/);
 assert.match(h,/&lt;img/);
});

test('F04A sorts undated first, dated ascending and archive last',()=>{
 const m=harness();
 const input=[
  j('later','Later','2026-11-05','NOWE'),
  j('closed','Closed',null,'ZAKONCZONE'),
  j('today','Today','2026-10-13','W_REALIZACJI'),
  j('nodate','Undated',null,'DO_UMOWIENIA')
 ];
 const ids=Array.from(m.sortOperationalJobs(input),x=>x.id);
 assert.deepEqual(ids,['nodate','today','later','closed']);
});
test('F04A active list hides closed and can show archive explicitly',()=>{
 const m=harness();let h=m.jobsPage();
 assert.doesNotMatch(h,/Serwis Otwock/);
 assert.match(h,/data-filter-status="ZAKONCZONE"/);
 assert.match(h,/data-filter-due="NODATE"/);
 assert.match(h,/id="jobSort"/);
 m.STATE.statusFilter='ZAKONCZONE';h=m.jobsPage();
 assert.match(h,/Serwis Otwock/);
});
test('F04A coordinator has truthful contact actions, worker has no finance',()=>{
 const m=harness();
 const list=m.jobCard(jobs[0],false);
 assert.doesNotMatch(list,/href="tel:|google.com\/maps\/search/);
 let detail=m.jobDetail({...jobs[0],client_phone:'+48 123456789',client_address:'Testowa 1, Warszawa'},false);
 assert.match(detail,/href="tel:/);
 assert.match(detail,/google.com\/maps\/search/);
 assert.match(detail,/f04a-single-detail/);
 const w=harness('worker');
 detail=w.jobDetail(jobs[0],true);
 assert.doesNotMatch(detail,/job-section-finance|Przychód netto|data-finance=/);
 assert.doesNotMatch(detail,/data-edit-job=/);
});
test('F04A finance draft value renders without database success claim',()=>{
 const m=harness();m.STATE.financeDrafts.a={revenue_net:'1234.50',crew_cost:'350',dirty:true};
 const html=m.jobDetail(jobs[0],false);
 assert.match(html,/data-finance-draft="a"/);
 assert.match(html,/value="1234.50"/);
 assert.match(html,/value="350"/);
 assert.match(html,/f04a-finance-warning/);
});
test('F04A dashboard contains real-data filters and safer photo status',()=>{
 const m=harness();let html=m.overview();
 assert.match(html,/data-dashboard-filter="NODATE"/);
 assert.match(html,/data-dashboard-filter="OVERDUE"/);
 assert.match(html,/data-dashboard-filter="ACCEPT"/);
 assert.doesNotMatch(source,/☁️ W chmurze/);
 assert.match(source,/Zarejestrowano metadane/);
});
test('F04A translations and mobile styles are present',()=>{
 const m=harness();
 for(const lang of ['pl','uk','ru','en']){
  m.STATE.me.preferred_lang=lang;
  for(const key of ['sortOperational','sortLabel','archiveLabel','jumpLabel','quickNavigate','dashboardNoDate']){
   assert.notEqual(m.t(key),key,lang+':'+key);
  }
 }
 assert.match(style,/f04a-detail-section/);
 assert.match(style,/f04a-kpi-grid/);
});

test('F04A create job form is collapsed by default on coordinator list',()=>{
 const m=harness();const html=m.jobsPage();
 assert.match(html,/<details class="f04a-new-job-details">/);
 assert.match(html,/<summary>＋ Dodaj nowe zlecenie<\/summary>/);
 assert.match(html,/id="jobCreate"/);
 assert.match(style,/\.f04a-new-job-details>summary/);
});

// F04A QA final DEV: compact navigation, state retention and single-worker safety.
test('F04A advanced audit is accessible from settings, not primary navigation',()=>{
  const m=harness();
  assert.doesNotMatch(source.split('const NAV=')[1].split('const STATE=')[0],/\['audit','◷','Historia'\]/);
  assert.match(source,/data-nav=\"audit\"/);
  assert.match(source,/function auditPage\(/);
});
test('F04A menu navigation retains job search text',()=>{
  const statement=source.match(/function go\(v\)\{[^}]+\}/)?.[0];
  assert.ok(statement);
  assert.doesNotMatch(statement,/STATE\.search\s*=\s*['\"]/);
});
test('F04A selective unassign validates UUID before sending request',()=>{
  const method=source.split('async function unassignWorker(')[1].split('async function finance(')[0];
  assert.match(method,/uuid\.test\(jobId/);
  assert.match(method,/uuid\.test\(workerId/);
  assert.ok(method.indexOf('uuid.test(workerId')<method.indexOf("api('/jobs/'"),'UUID guard must run before API call');
  assert.match(method,/body:\{action:'unassign',worker:workerId\}/);
});


test('F04A audio: no primary report navigation, no urgency or analytical panel',()=>{
 const m=harness(),h=m.overview();
 assert.doesNotMatch(h,/data-dashboard-filter="URGENT"|analizy operacyjne/);
 assert.doesNotMatch(source.split('const NAV=')[1].split('const STATE=')[0],/reports/);
});
test('F04A audio: worker archive stays hidden even if filter state is forced',()=>{
 const m=harness('worker');m.STATE.statusFilter='ZAKONCZONE';
 assert.doesNotMatch(m.jobsPage(),/Serwis Otwock|data-filter-status="ZAKONCZONE"/);
});
test('F04A audio: category is explicit, never inferred from title',()=>{
 const m=harness();m.STATE.categoryFilter='KUCHNIE';
 m.STATE.jobs=[j('1','Remont',date(0),'NOWE','NORMALNY',{category:'KUCHNIA'}),j('2','Kuchnia',date(0),'NOWE')];
 const h=m.jobsPage();assert.match(h,/class="job-title">Remont/);assert.doesNotMatch(h,/class="job-title">Kuchnia/);
});
test('F04A audio: date plans hide archive and never invent appointment hours',()=>{
 const m=harness();m.STATE.jobs=[j('1','Today active',date(0),'UMOWIONE'),j('2','Today closed',date(0),'ZAKONCZONE'),j('3','Tomorrow active',date(1),'UMOWIONE')];
 const h=m.overview();assert.match(h,/Today active/);assert.match(h,/Tomorrow active/);assert.doesNotMatch(h,/Today closed/);assert.match(h,/Godzina nieustalona/);
});
