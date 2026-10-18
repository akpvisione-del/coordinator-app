'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../public/app.js'),'utf8').replace(/\bboot\(\);\s*$/,'');
function load(){const ctx={console,URL,Date,Math,Number,Intl,encodeURIComponent,decodeURIComponent,localStorage:{getItem:()=>null},document:{getElementById:()=>null}};vm.runInNewContext(code+'\nglobalThis.app={STATE,teamPage,jobsPage,teamHistoryPanel};',ctx);ctx.app.STATE.me={role:'coordinator',preferred_lang:'pl'};return ctx.app;}
test('team search/status filters existing accounts, supports worker-to-jobs and password-free invitation',()=>{
 const {STATE,teamPage}=load();STATE.canCreateWorker=true;STATE.team=[{id:'a',display:'Jan Testowy',is_active:true},{id:'b',display:'Anna Inactive',is_active:false}];
 let html=teamPage();assert.match(html,/workerInvite/);assert.doesNotMatch(html.match(/<form id="workerInvite"[\s\S]*?<\/form>/)[0],/type="password"/);assert.match(html,/data-team-jobs="a"/);
 STATE.teamSearch='jan';html=teamPage();assert.match(html,/Jan Testowy/);assert.doesNotMatch(html,/Anna Inactive/);
 STATE.teamSearch='';STATE.teamStatus='INACTIVE';html=teamPage();assert.match(html,/Anna Inactive/);assert.doesNotMatch(html,/Jan Testowy/);
 STATE.teamSearch='missing';assert.match(teamPage(),/Brak pracowników pasujących/);
});
test('worker-to-job filter shows only assigned work and history content is escaped',()=>{
 const {STATE,jobsPage,teamHistoryPanel}=load();STATE.team=[{id:'a',display:'Worker A'}];STATE.jobs=[{id:'j1',title:'My Assigned Job',status:'NOWE',assignees:['a']},{id:'j2',title:'Other Work',status:'NOWE',assignees:['b']}];STATE.workerFilter='a';
 const html=jobsPage();assert.match(html,/My Assigned Job/);assert.doesNotMatch(html,/Other Work/);assert.match(html,/data-clear-worker/);
 STATE.teamHistory['worker/a']={items:[{action:'ACCOUNT_UPDATED',created_at:'2026-10-17T12:00:00Z',after:{display_name:'<script>alert(1)</script>'}}]};
 const history=teamHistoryPanel('worker','a');assert.doesNotMatch(history,/<script>/);assert.match(history,/&lt;script&gt;/);
});
