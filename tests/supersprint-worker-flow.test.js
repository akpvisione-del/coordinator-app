'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,ID}=require('./helpers/worker-flow.cjs');
const input={name:'Synthetic Worker',email:'worker@example.test',password:'Synthetic-password-938!',language:'uk',confirm_access:true};
async function run(fn){
 const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','APP_ORIGIN'];
 const previous=Object.fromEntries(names.map(k=>[k,process.env[k]])),oldFetch=global.fetch;
 process.env.SUPABASE_URL='https://mock.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_SYNTHETIC';process.env.APP_ORIGIN='https://sprint.example.test';delete process.env.SUPABASE_SECRET_KEY;
 const f=fixture();global.fetch=f.fetcher;
 try{await fn(f)}finally{global.fetch=oldFetch;for(const k of names){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}}
}
test('Netlify → real Edge → mock Auth/PostgREST creates, edits and revokes the same worker JWT',()=>run(async f=>{
 const created=await f.call('/team',{method:'POST',body:input});assert.equal(created.status,201);assert.equal(created.data.worker.id,ID.worker);
 assert.equal(JSON.stringify(created).includes(input.password),false);
 assert.equal((await f.call('/jobs',{role:'worker'})).data.items.length,0);
 assert.equal((await f.call('/jobs/'+ID.job+'/assign',{method:'POST',body:{worker:ID.worker}})).status,200);
 let jobs=await f.call('/jobs',{role:'worker'});assert.equal(jobs.status,200);assert.equal(jobs.data.items.length,1);
 for(const key of ['revenue_net','crew_cost','margin_net','source'])assert.equal(key in jobs.data.items[0],false);
 assert.equal((await f.call('/team/'+ID.worker,{method:'PATCH',body:{name:'Edited Worker',language:'ru'}})).status,200);
 assert.equal(f.profiles[1].display_name,'Edited Worker');assert.equal(f.profiles[1].preferred_lang,'ru');
 assert.equal((await f.call('/team/'+ID.worker,{method:'PATCH',body:{is_active:false}})).status,200);
 assert.equal((await f.call('/jobs',{role:'worker'})).status,401);
 assert.equal(f.assignments.length,1,'deactivation preserves history');
 assert.equal((await f.call('/team/'+ID.worker,{method:'PATCH',body:{is_active:true}})).status,200);
 assert.equal((await f.call('/jobs',{role:'worker'})).data.items.length,1);
 assert.equal((await f.call('/jobs/'+ID.job+'/assign',{method:'POST',body:{action:'unassign',worker:ID.worker}})).status,200);
 assert.equal(f.assignments.length,1);assert.equal(f.assignments[0].active,false);
 assert.equal((await f.call('/jobs',{role:'worker'})).data.items.length,0);
}));
test('worker management rejects privilege escalation and CSRF before invoking Edge',()=>run(async f=>{
 await f.call('/team',{method:'POST',body:input});
 const before=f.calls.filter(c=>c.path.includes('/functions/')).length;
 for(const body of [{role:'coordinator'},{email:'other@example.test'},{password:'not-allowed'}])assert.equal((await f.call('/team/'+ID.worker,{method:'PATCH',body})).status,422);
 assert.equal((await f.call('/team/'+ID.worker,{role:'worker',method:'PATCH',body:{is_active:false}})).status,403);
 assert.equal((await f.call('/team/'+ID.worker,{method:'PATCH',body:{is_active:false},proof:false})).status,403);
 assert.equal((await f.call('/team/'+ID.worker,{method:'PATCH',body:{is_active:false},origin:'https://evil.example.test'})).status,403);
 assert.equal(f.calls.filter(c=>c.path.includes('/functions/')).length,before);
}));
test('malformed account forms are validation errors, never provider writes',()=>run(async f=>{
 for(const body of [null,[],false,'not a form'])assert.equal((await f.call('/team',{method:'POST',body})).status,422);
 assert.equal(f.calls.some(c=>c.method==='POST'&&c.path==='/auth/v1/admin/users'),false);
}));
