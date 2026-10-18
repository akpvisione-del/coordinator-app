'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createWorker,available}=require('../netlify/functions/worker-admin');
const actor={role:'coordinator',user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}};
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const input={name:'Monter Testowy',email:'worker@example.test',password:'Synthetic-Test-Only-483!',language:'ru',confirm_access:true};
const cfg={url:'https://mock.supabase.co'};
process.env.SUPABASE_SECRET_KEY='sb_secret_SYNTHETIC_TEST_ONLY';
function mock(failAt=0){const calls=[];return {calls,fetcher:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});const n=calls.length;return new Response(JSON.stringify(n===1?{id}:{}),{status:n===failAt?500:200})}}}
test('worker and anonymous cannot provision users even when service configured',async()=>{
 const m=mock();for(const role of ['worker',undefined])await assert.rejects(createWorker(cfg,{...actor,role},input,m),e=>e.status===403);assert.equal(m.calls.length,0);
});
test('missing ALL server configuration fails closed without external requests',async()=>{
 // Netlify build may supply publishable Supabase vars even when no admin key is present.
 // Isolate this test from the real build environment; do NOT require production secrets in CI.
 const names=['SUPABASE_SECRET_KEY','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 const m=mock();
 try{
   for(const name of names)delete process.env[name];
   assert.equal(available(),false);
   await assert.rejects(createWorker(cfg,actor,input,m),e=>e.status===503);
   assert.equal(m.calls.length,0);
 }finally{
   for(const name of names){
     if(previous[name]===undefined)delete process.env[name];
     else process.env[name]=previous[name];
   }
 }
});
test('publishable-only configuration never creates user without coordinator JWT',async()=>{
 const names=['SUPABASE_SECRET_KEY','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 const m=mock();
 try{
   delete process.env.SUPABASE_SECRET_KEY;
   process.env.SUPABASE_URL='https://mock.supabase.co';
   process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic_test_only';
   assert.equal(available(),true);
   await assert.rejects(createWorker({...cfg,key:'sb_publishable_synthetic_test_only'},actor,input,m),e=>e.status===503);
   assert.equal(m.calls.length,0);
 }finally{
   for(const name of names){
     if(previous[name]===undefined)delete process.env[name];
     else process.env[name]=previous[name];
   }
 }
});
test('reject invalid email, weak password, absent consent and unknown language',async()=>{
 for(const change of [{email:'bad'},{password:'short'},{confirm_access:false},{language:'bad'},{name:''}]){const m=mock();await assert.rejects(createWorker(cfg,actor,{...input,...change},m),e=>e.status===422);assert.equal(m.calls.length,0)}
});
test('successful creation fixes worker role and returns no credentials',async()=>{
 const m=mock();const out=await createWorker(cfg,actor,{...input,role:'coordinator',is_active:false},m);
 assert.equal(m.calls.length,3);assert.equal(m.calls[0].body.app_metadata.akp_role,undefined);
 assert.equal(m.calls[1].body.role,'worker');assert.equal(m.calls[1].body.is_active,true);
 assert.equal(m.calls[2].body.app_metadata.akp_role,'worker');assert.equal(m.calls[2].body.password,undefined);
 assert.equal(out.role,'worker');assert.equal(out.id,id);assert.ok(!JSON.stringify(out).includes(input.password));assert.ok(!JSON.stringify(out).includes('sb_secret'));
});
test('profile write failure never grants app role or deletes the account',async()=>{
 const m=mock(2);await assert.rejects(createWorker(cfg,actor,input,m),e=>e.status===503);
 assert.equal(m.calls.length,2);assert.ok(m.calls.every(c=>c.options.method!=='DELETE'));assert.equal(m.calls[0].body.app_metadata.akp_role,undefined);
});
test('existing account error never updates its password, metadata or profile',async()=>{
 const calls=[];await assert.rejects(createWorker(cfg,actor,input,{fetcher:async(url,options)=>{calls.push({url,options});return new Response('{}',{status:422})}}),e=>e.status===409);assert.equal(calls.length,1);
});
test('opaque admin keys use apikey only; legacy JWT retains Bearer authorization',async()=>{
 const previous=process.env.SUPABASE_SECRET_KEY;
 try{
  for(const secret of ['sb_secret_SYNTHETIC_TEST_ONLY','eyJ.synthetic.jwt']){
   process.env.SUPABASE_SECRET_KEY=secret;
   const m=mock();await createWorker(cfg,actor,input,m);
   for(const c of m.calls){assert.equal(c.options.headers.apikey,secret);assert.equal(c.options.headers.Authorization,secret.startsWith('sb_secret_')?undefined:'Bearer '+secret)}
  }
 }finally{process.env.SUPABASE_SECRET_KEY=previous}
});
