'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const edge=fs.readFileSync(path.join(__dirname,'../supabase/functions/akp-provision-worker/index.ts'),'utf8');
const coordinator='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_ANON_KEY:'mock-anon',SUPABASE_SERVICE_ROLE_KEY:'mock-service'};
function load(fetcher) {
  let handler;
  const sandbox={Deno:{env:{get:k=>env[k]},serve:f=>{handler=f}},fetch:fetcher,Response,AbortSignal,JSON,URL,Error};
  vm.runInNewContext(edge,sandbox,{filename:'index.ts'});
  assert.equal(typeof handler,'function');
  return handler;
}
const request=(extra={})=>new Request('https://mock.supabase.co/functions/v1/akp-provision-worker',{
  method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc','Content-Type':'application/json'},
  body:JSON.stringify({name:'Monter Test',email:'worker@example.test',password:'a-strong-password-123',language:'ru',confirm_access:true,...extra})
});
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function api(role='coordinator',active=true,profileFails=false){
  const calls=[];
  const fetcher=async(url,opt={})=>{
    const p=new URL(url).pathname,method=opt.method||'GET';
    calls.push({p,method,opt});
    if(p==='/auth/v1/user')return json(200,{id:coordinator,app_metadata:{akp_role:role}});
    if(p==='/rest/v1/akp_profiles'&&method==='GET')return json(200,[{role,is_active:active}]);
    if(p==='/auth/v1/admin/users'&&method==='POST')return json(201,{id:worker});
    if(p==='/rest/v1/akp_profiles'&&method==='POST')return profileFails?json(503,{error:'db'}):json(201,[{user_id:worker}]);
    if(p==='/auth/v1/admin/users/'+worker&&method==='PUT')return json(200,{id:worker});
    if(p==='/auth/v1/admin/users/'+worker&&method==='DELETE')return new Response(null,{status:204});
    throw Error('Unexpected '+method+' '+p);
  };
  return {calls,fetcher};
}
test('Edge auth is coordinator-only, validates role and active profile',async()=>{
  const workerCall=api('worker');
  const denied=await load(workerCall.fetcher)(request());
  assert.equal(denied.status,403);assert.equal(workerCall.calls.length,1);
  const inactive=api('coordinator',false);
  assert.equal((await load(inactive.fetcher)(request())).status,403);
  assert.ok(inactive.calls.every(c=>!c.p.includes('/admin/users')));
});
test('Edge creates only worker (ignores any injected coordinator role)',async()=>{
  const a=api(),handle=load(a.fetcher);
  const res=await handle(request({role:'coordinator',is_active:false}));
  assert.equal(res.status,201);
  assert.equal((await res.json()).worker.role,'worker');
  const created=a.calls.find(c=>c.method==='POST'&&c.p==='/auth/v1/admin/users');
  const authBody=JSON.parse(created.opt.body);
  assert.equal(authBody.app_metadata.akp_role,undefined);
  const profileWrite=a.calls.find(c=>c.method==='POST'&&c.p==='/rest/v1/akp_profiles');
  assert.equal(JSON.parse(profileWrite.opt.body).role,'worker');
  const promoted=a.calls.find(c=>c.method==='PUT');
  assert.equal(JSON.parse(promoted.opt.body).app_metadata.akp_role,'worker');
});
test('Edge preserves incomplete identity without granting role if profile write fails',async()=>{
  const a=api('coordinator',true,true);
  const res=await load(a.fetcher)(request());
  assert.equal(res.status,503);
  assert.ok(a.calls.every(c=>c.method!=='DELETE'));
  assert.ok(!a.calls.some(c=>c.method==='PUT'));
});
test('Edge rejects invalid input without creating users',async()=>{
  const a=api(),res=await load(a.fetcher)(request({password:'short'}));
  assert.equal(res.status,422);
  assert.ok(!a.calls.some(c=>c.p==='/auth/v1/admin/users'));
});

const updateRequest=(patch)=>new Request('https://mock.supabase.co/functions/v1/akp-provision-worker',{
  method:'POST',
  headers:{authorization:'Bearer aaa.bbb.ccc','Content-Type':'application/json'},
  body:JSON.stringify({action:'update_worker',worker_id:worker,...patch})
});
const managementMock=({callerRole='coordinator',targetExists=true,failWrite=false}={})=>{
  const calls=[],target={user_id:worker,role:'worker',is_active:true,display_name:'Monter Test',preferred_lang:'pl'};
  const fetcher=async(url,opts={})=>{
    const u=new URL(url),method=opts.method||'GET';
    calls.push({url:u,method,opts});
    if(u.pathname==='/auth/v1/user')return json(200,{id:coordinator,app_metadata:{akp_role:callerRole}});
    if(u.pathname==='/rest/v1/akp_profiles'&&method==='GET'){
      if(u.searchParams.has('role'))return json(200,targetExists?[{user_id:worker,role:'worker',is_active:target.is_active}]:[]);
      return json(200,[{role:callerRole,is_active:true}]);
    }
    if(u.pathname==='/rest/v1/akp_profiles'&&method==='PATCH'){
      if(failWrite)return json(403,{code:'42501'});
      const data=JSON.parse(opts.body);
      Object.assign(target,data);
      return json(200,[target]);
    }
    throw Error('Unexpected request '+method+' '+u.pathname);
  };
  return {calls,target,fetcher};
};
test('Edge worker management is coordinator-only, never mutates role or Auth users',async()=>{
  const a=managementMock();
  const res=await load(a.fetcher)(updateRequest({name:'Monter Nowy',language:'ru',is_active:false}));
  assert.equal(res.status,200);
  const workerResult=(await res.json()).worker;
  assert.equal(workerResult.id,worker);
  assert.equal(workerResult.is_active,false);
  assert.equal(workerResult.preferred_lang,'ru');
  assert.equal(a.target.role,'worker');
  assert.equal(a.target.display_name,'Monter Nowy');
  assert.ok(a.calls.some(c=>c.method==='PATCH'&&c.url.pathname==='/rest/v1/akp_profiles'));
  assert.ok(a.calls.every(c=>!c.url.pathname.includes('/auth/v1/admin/users')));
});
test('Edge rejects all privilege-changing fields and unauthorized users before profile mutation',async()=>{
  for(const badFields of [{role:'coordinator'},{email:'changed@example.test'},{password:'not-allowed'},{is_active:'false'},{language:'fr'},{name:'X'},{}]){
    const a=managementMock();
    const res=await load(a.fetcher)(updateRequest(badFields));
    assert.equal(res.status,422,'bad field '+JSON.stringify(badFields));
    assert.ok(!a.calls.some(c=>c.method==='PATCH'));
  }
  const unauthorized=managementMock({callerRole:'worker'});
  assert.equal((await load(unauthorized.fetcher)(updateRequest({is_active:false}))).status,403);
  assert.ok(!unauthorized.calls.some(c=>c.method==='PATCH'));
});
test('Edge refuses to edit nonworker profiles and fails closed on DB permissions',async()=>{
  const noWorker=managementMock({targetExists:false});
  assert.equal((await load(noWorker.fetcher)(updateRequest({name:'Test Worker'}))).status,404);
  assert.ok(!noWorker.calls.some(c=>c.method==='PATCH'));
  const dbDenied=managementMock({failWrite:true});
  const denied=await load(dbDenied.fetcher)(updateRequest({is_active:false}));
  assert.equal(denied.status,503);
  assert.equal(dbDenied.target.is_active,true);
});
test('Edge validates null, scalar and array forms without provisioning writes',async()=>{
 for(const body of [null,[],false,'form']){
  const a=api();const req=new Request('https://mock.supabase.co/functions/v1/akp-provision-worker',{method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc'},body:JSON.stringify(body)});
  assert.equal((await load(a.fetcher)(req)).status,422);
  assert.ok(!a.calls.some(c=>c.method!=='GET'));
 }
});

test('invitation creates no password and sends Supabase password setup only to configured origin',async()=>{
 env.AKP_APP_ORIGIN='https://app.example.test';
 const a=api(),calls=[];
 const fetcher=async(url,opts={})=>{calls.push({url,opts});if(new URL(url).pathname==='/auth/v1/recover')return json(200,{});return a.fetcher(url,opts)};
 try{
  const res=await load(fetcher)(new Request('https://mock.supabase.co/functions/v1/akp-provision-worker',{method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc'},body:JSON.stringify({action:'invite_worker',name:'Invited Worker',email:'invite@example.test',language:'uk',confirm_access:true})}));
  assert.equal(res.status,201);
  const created=calls.find(c=>c.url.endsWith('/auth/v1/admin/users'));
  assert.equal(JSON.parse(created.opts.body).password,undefined);
  const invitation=calls.find(c=>c.url.includes('/recover?'));
  assert.equal(new URL(invitation.url).searchParams.get('redirect_to'),'https://app.example.test/reset-password.html');
  assert.equal(invitation.opts.headers.apikey,env.SUPABASE_ANON_KEY);
  assert.equal(JSON.parse(invitation.opts.body).email,'invite@example.test');
  assert.ok(calls.every(c=>c.opts.method!=='DELETE'));
 }finally{delete env.AKP_APP_ORIGIN}
});
test('invitation without configured trusted origin never creates an account',async()=>{
 const a=api();const req=new Request('https://mock.supabase.co/functions/v1/akp-provision-worker',{method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc'},body:JSON.stringify({action:'invite_worker',name:'Invite Worker',email:'invite@example.test',language:'pl',confirm_access:true})});
 assert.equal((await load(a.fetcher)(req)).status,503);assert.ok(a.calls.every(c=>c.method==='GET'));
});
