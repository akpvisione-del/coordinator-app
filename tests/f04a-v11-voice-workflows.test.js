'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parseFieldIntent:parse,proposeFieldPlan:plan,fieldLanguages:langs}=require('../public/field-assistant.js');
const src=fs.readFileSync(path.resolve(__dirname,'../public/field-assistant.js'),'utf8');
const css=fs.readFileSync(path.resolve(__dirname,'../public/field-assistant.css'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
const expected=[
 ['Umów pomiar u Marka na jutro 10:00','planKindAppointment'],
 ['zaplanuj pomiar w Warszawie','planKindAppointment'],
 ['schedule appointment tomorrow','planKindAppointment'],
 ['признач майстра','planKindAppointment'],
 ['приcвой бригаду',''],
 ['przydziel montera Valerego do kuchni','planKindAssignment'],
 ['przypisz montera do zlecenia','planKindAssignment'],
 ['assign worker to job','planKindAssignment'],
 ['wycena remontu łazienki','planKindQuote'],
 ['przygotuj wycenę remontu','planKindQuote'],
 ['estimate a kitchen','planKindQuote'],
 ['кошторис ремонту','planKindQuote'],
 ['смета кухни','planKindQuote'],
 ['zrób listę materiałów','planKindMaterials'],
 ['materials for the bathroom','planKindMaterials'],
 ['материалы для кухни','planKindMaterials'],
 ['protokół odbioru kuchni','planKindProtocol'],
 ['acceptance report for kitchen','planKindProtocol'],
 ['utwórz zlecenie remontu','planKindJob'],
 ['dodaj zlecenie','planKindJob'],
 ['create job','planKindJob'],
 ['выślij fakturę',''],
 ['wyślij fakturę do klienta','planKindMessage'],
 ['send email to customer','planKindMessage'],
 ['napisz wiadomość dla montera','planKindMessage']
];
for(const [phrase,want] of expected)test('draft parser: '+phrase,()=>{
 assert.equal(plan(phrase)?.category||'',want);
 if(want){assert.equal(plan(phrase).write_allowed,false);assert.equal(plan(phrase).confirmation_required,true);}
});
for(const phrase of ['usuń wszystkie zlecenia','delete all jobs','przelej pieniądze','transfer 1000','удали всё','оплатить счет','', 'x', 'x'.repeat(150)])test('reject destructive or invalid proposed request: '+phrase.slice(0,30),()=>assert.equal(plan(phrase),null));
for(const [name,kind] of [['do odbioru','accept'],['do wyceny','quoteJobs'],['do rozliczeń','settle'],['to settle','settle'],['for acceptance','accept'],['awaiting quote','quoteJobs']])test('recognized operational status: '+name,()=>assert.equal(parse(name)?.kind,kind));
test('typed status filters preserve role restrictions',()=>{assert.match(src,/\['dashboard','team','archive','measurements','kitchens','renovations','accept','quoteJobs','settle'\]/);assert.match(src,/if\(i.kind==='accept'\)STATE\.quickFilter='ACCEPT'/);assert.match(src,/if\(i.kind==='quoteJobs'\)STATE\.quickFilter='QUOTE'/);assert.match(src,/if\(i.kind==='settle'\)STATE\.quickFilter='SETTLE'/);});
test('missing category does not mutate active list before validation',()=>{
 const ixCheck=src.indexOf("if(types[i.kind]&&!STATE.jobs.some");
 const ixMutate=src.indexOf("STATE.view='jobs'",src.indexOf('function execute()'));
 assert.ok(ixCheck>0 && ixMutate>ixCheck);
});
test('worker search never resets filter to coordinator active',()=>assert.match(src,/STATE\.statusFilter=coordinator\?'ACTIVE':'CURRENT'/));
test('copy plan requires explicit click; no automatic outbound requests',()=>{
 assert.match(src,/akpFieldCopy'\)\.addEventListener\('click',copyProposal\)/);
 assert.match(src,/navigator\.clipboard\.writeText\(draft\)/);
 assert.match(src,/run\.disabled=!preview;copy\.hidden=!proposed/);
 assert.doesNotMatch(src,/\bfetch\s*\(|\bapi\s*\(|\/api\//);
});
test('dialog preview renders user input with textContent to avoid HTML execution',()=>{assert.match(src,/out\.textContent=\[t\('draftTitle'\)/);assert.doesNotMatch(src,/innerHTML\s*=\s*[^`]*proposed\.request/);});
test('voice is opt-in, aborted on hide and page unload',()=>{assert.match(src,/window\.addEventListener\('pagehide',stop\)/);assert.match(src,/document\.addEventListener\('visibilitychange'/);assert.match(src,/rec\.interimResults=false/);});
test('keyboard focus, accessible labels and live preview',()=>{assert.ok(src.includes("setAttribute('aria-modal','true')"));assert.match(src,/aria-describedby="akpFieldPrivacy akpFieldPreview/);assert.match(src,/aria-atomic="true/);assert.match(src,/e\.key==='Tab'/);});
test('four languages include every draft and critical warning',()=>{
 for(const [code,entries] of Object.entries(langs)){
 for(const key of ['draftTitle','draftExplain','draftApproval','copyPlan','copyFail','noCategories','voiceRisk','blocked','unknown','safeMode','accept','quoteJobs','settle'])
 assert.ok(entries[key],code+':'+key);
 }
});
test('mobile density and safe area do not hide jobs or controls',()=>{
 assert.match(css,/akp-field-quick .*?\{min-height:48px/s);
 assert.match(css,/white-space:pre-line/);
 assert.match(css,/max-width:390px/);
 assert.match(css,/safe-area-inset-top/);
});
test('no new dependency or production publishing',()=>{
 assert.match(html,/<script src="\/field-assistant.js" defer><\/script>/);
 assert.doesNotMatch(src,/Supabase\.from|GoogleDrive|netlify\.app|fetch\(/);
});
