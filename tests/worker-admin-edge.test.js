'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {available,createWorker}=require('../netlify/functions/worker-admin.js');
const previous={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY,SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY};
process.env.SUPABASE_URL='https://mock.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
delete process.env.SUPABASE_SECRET_KEY;
const cfg={url:'https://mock.supabase.co',key:'sb_publishable_test'};
const actor={role:'coordinator',token:'fake.user.jwt',user:{id:'11111111-1111-4111-8111-111111111111'}};
const input={name:'Monter Test',email:'worker@example.test',password:'really-strong-test-pass',language:'pl',confirm_access:true};

test('Edge provisioning is available without a Netlify service-role secret',()=>assert.equal(available(),true));
test('Edge worker creation uses caller JWT, never a privileged secret',async()=>{
  let called=0;
  const fetcher=async(url,options)=>{
    called++;
    assert.equal(url,'https://mock.supabase.co/functions/v1/akp-provision-worker');
    assert.equal(options.headers.Authorization,'Bearer fake.user.jwt');
    assert.equal(options.headers.apikey,'sb_publishable_test');
    assert.equal(JSON.parse(options.body).role,undefined);
    assert.equal(JSON.parse(options.body).password,input.password);
    return new Response(JSON.stringify({worker:{id:'22222222-2222-4222-8222-222222222222',role:'worker',display:'Monter Test',preferred_lang:'pl'}}),{status:201});
  };
  const worker=await createWorker(cfg,actor,input,{fetcher});
  assert.equal(called,1);assert.equal(worker.role,'worker');
});
test('workers and invalid input cannot invoke privileged Edge Function',async()=>{
  let called=0;const fetcher=async()=>{called++;throw Error('must not call')};
  await assert.rejects(()=>createWorker(cfg,{...actor,role:'worker'},input,{fetcher}),{status:403});
  await assert.rejects(()=>createWorker(cfg,actor,{...input,password:'short'},{fetcher}),{status:422});
  assert.equal(called,0);
});
test('untrusted Edge result can never promote to coordinator',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({worker:{id:'22222222-2222-4222-8222-222222222222',role:'coordinator'}}),{status:201});
  await assert.rejects(()=>createWorker(cfg,actor,input,{fetcher}),{status:503});
});
test('unauthorized Edge responses are denied without leaking provider data',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({message:'PRIVATE'}),{status:403});
  await assert.rejects(()=>createWorker(cfg,actor,input,{fetcher}),{status:403});
});
process.on('exit',()=>{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
