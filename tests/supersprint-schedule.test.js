'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../public/app.js'),'utf8').replace(/\bboot\(\);\s*$/,'');
function load(role='coordinator',lang='pl'){
 const ctx={console,URL,Date,Math,Number,Intl,encodeURIComponent,decodeURIComponent,localStorage:{getItem:()=>null},document:{getElementById:()=>null}};
 vm.createContext(ctx);vm.runInContext(source+'\nglobalThis.app={STATE,I18N,schedulePage,scheduleJobs,scheduleWeekStart,shiftScheduleDate,validScheduleDate,rescheduleJob,resetSessionData,getNav};',ctx);
 ctx.app.STATE.me={role,preferred_lang:lang};ctx.app.STATE.scheduleDate='2026-10-12';return {app:ctx.app,ctx};
}
const jobs=[{id:'a',title:'Assigned A',due:'2026-10-12',status:'NOWE',assignees:['w1'],updated_at:'2026-10-17T12:00:00Z'},
 {id:'b',title:'Assigned B',due:'2026-10-12',status:'W_REALIZACJI',assignees:['w1']},
 {id:'c',title:'Unscheduled',due:null,status:'NOWE',assignees:[]},
 {id:'d',title:'Closed',due:'2026-10-12',status:'ZAKONCZONE',assignees:['w1']}];
test('schedule handles leap years, impossible dates, week/year boundaries and timezone independence',()=>{
 const {app:m}=load();
 assert.equal(m.scheduleWeekStart('2026-10-18'),'2026-10-12');assert.equal(m.scheduleWeekStart('2027-01-01'),'2026-12-28');
 assert.equal(m.shiftScheduleDate('2026-12-28',7),'2027-01-04');assert.equal(m.shiftScheduleDate('2026-03-29',1),'2026-03-30');
 assert.equal(m.validScheduleDate('2028-02-29'),true);
 for(const day of ['2026-02-29','2026-02-31','2026-13-01','0000-01-01','today',null])assert.equal(m.validScheduleDate(day),false);
});
test('coordinator sees date editors, crew filters and date-only workload warnings; closed jobs excluded',()=>{
 const {app:m}=load();m.STATE.jobs=jobs;m.STATE.team=[{id:'w1',display:'Test Worker'}];
 const html=m.schedulePage();
 assert.match(html,/Assigned A/);assert.match(html,/Assigned B/);assert.match(html,/Unscheduled/);assert.doesNotMatch(html,/>Closed</);
 assert.match(html,/schedule-form/);assert.match(html,/schedule-warning/);assert.match(html,/data-expected-updated-at="2026-10-17T12:00:00Z"/);
 m.STATE.scheduleWorker='NONE';let filtered=m.schedulePage();assert.match(filtered,/Unscheduled/);assert.doesNotMatch(filtered,/Assigned A/);
 m.STATE.scheduleWorker='w1';filtered=m.schedulePage();assert.match(filtered,/Assigned A/);assert.doesNotMatch(filtered,/>Unscheduled</);
});
test('worker schedule has no edits, team picker, other crew identities or financial values',()=>{
 const {app:m}=load('worker');m.STATE.jobs=[{...jobs[0],revenue_net:987654321,source:{record:{NETTO:123}}}];m.STATE.team=[{id:'w1',display:'PRIVATE CREW NAME'}];
 const html=m.schedulePage();assert.match(html,/Assigned A/);
 for(const forbidden of ['schedule-form','scheduleWorker','PRIVATE CREW NAME','987654321','source.record'])assert.equal(html.includes(forbidden),false);
 assert.ok(m.getNav('worker').some(x=>x[0]==='schedule'));
});
test('schedule escapes imported content, preserves empty-date drafts and clears them on session reset',()=>{
 const {app:m}=load();m.STATE.jobs=[{...jobs[0],title:'<img src=x onerror=alert(1)>'}];m.STATE.scheduleDrafts.a='';
 let html=m.schedulePage();assert.doesNotMatch(html,/<img /);assert.match(html,/&lt;img/);assert.match(html,/name="due_date"[^>]*value=""/);
 m.resetSessionData();assert.equal(Object.keys(m.STATE.scheduleDrafts).length,0);assert.equal(m.STATE.scheduleDate,'');assert.equal(m.STATE.scheduleWorker,'ALL');
});
test('every supported worker language contains the schedule labels',()=>{
 const {app:m}=load();for(const lang of ['pl','uk','ru','en'])for(const key of ['navSchedule','scheduleWeek','previousWeek','nextWeek','unscheduled','scheduleNotice'])assert.ok(m.I18N[lang][key],lang+'/'+key);
});
test('date editor uses existing CAS contract and retains draft after conflict',async()=>{
 const {app:m,ctx}=load();let sent;
 ctx.save=async(path,opt)=>{sent={path,opt};throw Error('Conflict — refresh required');};
 vm.runInContext('api=save;',ctx);
 const error={hidden:true},button={disabled:false},form={dataset:{jobId:'a',expectedUpdatedAt:'2026-10-17T12:00:00Z'},querySelector:s=>s==='[name="due_date"]'?{value:'2026-10-23'}:s==='[type="submit"]'?button:error};
 await m.rescheduleJob({preventDefault(){},target:form});
 assert.equal(sent.path,'/jobs/a');assert.equal(sent.opt.method,'PATCH');assert.equal(sent.opt.body.due_date,'2026-10-23');assert.equal(sent.opt.body.expected_updated_at,form.dataset.expectedUpdatedAt);
 assert.equal(m.STATE.scheduleDrafts.a,'2026-10-23');assert.equal(error.hidden,false);assert.match(error.textContent,/Conflict/);assert.equal(button.disabled,false);
});
