'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../public/app.js'),'utf8').replace(/\bboot\(\);\s*$/,'');
function load(){const sandbox={console,URL,Date,Math,Number,Intl,encodeURIComponent,decodeURIComponent,localStorage:{getItem:()=>null},document:{getElementById:()=>null}};vm.runInNewContext(source+'\nglobalThis.app={STATE,crewSection};',sandbox);sandbox.app.STATE.me={role:'coordinator'};return sandbox.app;}
test('crew picker omits inactive accounts; existing disabled member remains detachable and escaped',()=>{
 const {STATE,crewSection}=load();
 STATE.team=[{id:'active',display:'Active',is_active:true},{id:'inactive',display:'Inactive',is_active:false},{id:'attached',display:'<script>bad</script>',is_active:false}];
 const html=crewSection({id:'job',assignees:['attached']});
 assert.match(html,/<option value="active">Active<\/option>/);
 assert.doesNotMatch(html,/<option value="inactive"/);
 assert.doesNotMatch(html,/<option value="attached"/);
 assert.match(html,/data-unassign-worker="attached"/);assert.match(html,/Konto nieaktywne/);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('crew picker explains why adding is disabled when no active candidates remain',()=>{
 const {STATE,crewSection}=load();STATE.team=[{id:'inactive',display:'Inactive',is_active:false}];
 const html=crewSection({id:'job',assignees:[]});assert.match(html,/Brak aktywnych monterów do dodania/);assert.match(html,/data-add-assignee="job" disabled/);
});
