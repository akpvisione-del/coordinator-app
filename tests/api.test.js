'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const PATH = '../netlify/functions/api.js';
const ID = {a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',coord:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',workerA:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',workerB:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
const jobs=[{id:ID.a,title:'Montaż A',reference:'TEST-A',location:'',due_date:null,status:'NOWE',priority:'NORMALNY',instructions:'',created_at:'',updated_at:''},{id:ID.b,title:'Montaż B',reference:'TEST-B',location:'',due_date:null,status:'NOWE',priority:'NORMALNY',instructions:'',created_at:'',updated_at:''}];
const profiles=[{user_id:ID.coord,role:'coordinator',display_name:'Koordynator'},{user_id:ID.workerA,role:'worker',display_name:'Monter A'},{user_id:ID.workerB,role:'worker',display_name:'Monter B'}];
const assignments=[{job_id:ID.a,worker_id:ID.workerA,active:true},{job_id:ID.b,worker_id:ID.workerB,active:true}];
const finances=[{job_id:ID.a,revenue_net:1200,crew_cost:200},{job_id:ID.b,revenue_net:2100,crew_cost:400}];
const reports=[];
process.env.SUPABASE_URL='https://mock.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fake_test_only';
process.env.APP_ORIGIN='https://staging.example.test';
const {handler,_test}=require(PATH);
const tokenRole={'jwt-coord':{id:ID.coord,app_metadata:{akp_role:'coordinator'},email:'coord@example.test'},'jwt-a':{id:ID.workerA,app_metadata:{akp_role:'worker'},email:'a@example.test'},'jwt-b':{id:ID.workerB,app_metadata:{akp_role:'worker'},email:'b@example.test'},'jwt-unassigned':{id:ID.workerB,app_metadata:{akp_role:'unknown'},email:'bad@example.test'}};
let calls=[];
global.fetch=async(url,options={})=>{
  calls.push({url:String(url),options});
  const u=new URL(url),method=options.method||'GET',h=options.headers||{},jwt=(h.Authorization||'').replace('Bearer ','');
  const user=tokenRole[jwt],role=user?.app_metadata.akp_role;
  function out(code,data){return new Response(code===204?null:JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json'}})}
  if(u.pathname==='/auth/v1/token'){
    const body=JSON.parse(options.body||'{}');if(body.email==='coord@example.test'&&body.password==='correct-pass')return out(200,{access_token:'jwt-coord',refresh_token:'jwt-refresh',expires_in:3000});
    return out(400,{message:'wrong login'});
  }
  if(u.pathname==='/auth/v1/user')return user?out(200,user):out(401,{message:'invalid'});
  if(u.pathname==='/auth/v1/logout')return out(204,{});
  if(!u.pathname.startsWith('/rest/v1/'))return out(404,{});
  if(!user)return out(401,{});
  const name=u.pathname.split('/').pop();
  let src={akp_jobs:jobs,akp_profiles:profiles,akp_assignments:assignments,akp_job_financials:finances,akp_reports:reports,akp_checks:[],akp_audit:[],akp_job_sources:[{job_id:ID.a,source_record:{NETTO:"9999",KLIENT:"Test"},synced_at:"2026-10-10T00:00:00Z"}]}[name];
  if(!src)return out(404,{});
  if(name==='akp_job_financials'&&role!=='coordinator')return out(403,{});
  let rows=src.filter(x=>{
    if(name==='akp_jobs'&&role!=='coordinator'&&!assignments.some(a=>a.job_id===x.id&&a.worker_id===user.id&&a.active))return false;
    if(name==='akp_assignments'&&role!=='coordinator'&&(x.worker_id!==user.id||!x.active))return false;
    if(name==='akp_profiles'&&role!=='coordinator'&&x.user_id!==user.id)return false;
    if(name==='akp_reports'&&role!=='coordinator'&&x.worker_id!==user.id)return false;
    for(const [key,val] of u.searchParams)if(val.startsWith('eq.')){
      if(String(x[key])!==val.slice(3))return false;
    }
    return true;
  });
  if(method==='GET')return out(200,rows);
  if(method==='POST'){
    const data=JSON.parse(options.body||'{}');
    if(name==='akp_assignments'){
      if(role!=='coordinator')return out(403,{});
      const at=assignments.findIndex(x=>x.job_id===data.job_id);
      if(at>=0)assignments[at]={...assignments[at],...data};else assignments.push(data);
      return out(201,[]);
    }
    if(name==='akp_job_financials'){
      if(role!=='coordinator')return out(403,{});
      const at=finances.findIndex(x=>x.job_id===data.job_id);
      if(at>=0)finances[at]={...finances[at],...data};else finances.push(data);
      return out(201,[]);
    }
    if(name==='akp_reports'){
      if(role!=='worker'||!assignments.some(a=>a.worker_id===user.id&&a.job_id===data.job_id&&a.active))return out(403,{});
      const row={id:'33333333-3333-4333-8333-333333333333',...data,created_at:'2026-10-10T00:00:00Z'};
      reports.push(row);return out(201,[row]);
    }
    if(name==='akp_jobs'&&role==='coordinator'){
      const row={id:'44444444-4444-4444-8444-444444444444',...data};jobs.push(row);return out(201,[row]);
    }
    if(name==='akp_checks'&&role==='worker')return out(201,[]);
    if(name==='akp_audit')return out(403,{});
    return out(403,{});
  }
  if(method==='PATCH'&&name==='akp_reports'&&role==='coordinator'){
    const r=rows[0];if(!r)return out(200,[]);Object.assign(r,JSON.parse(options.body));return out(200,[r]);
  }
  if(method==='DELETE'&&name==='akp_assignments'&&role==='coordinator'){
    const ids=new Set(rows.map(x=>x.job_id));for(let i=assignments.length-1;i>=0;i--)if(ids.has(assignments[i].job_id))assignments.splice(i,1);
    return out(204,{});
  }
  return out(200,[]);
};
function event(path,{method='GET',role,origin='https://staging.example.test',body,withProof=true}={}){
  const token=role==='coordinator'?'jwt-coord':role==='workerB'?'jwt-b':role==='unassigned'?'jwt-unassigned':role==='worker'?'jwt-a':null;
  return {path:'/api'+path,httpMethod:method,headers:{origin,...(withProof?{'x-akp-request':'commander-v10'}:{}),...(token?{cookie:'akp_access='+token}:{})},body:body===undefined?undefined:JSON.stringify(body)};
}
async function call(path,settings){const result=await handler(event(path,settings));return {status:result.statusCode,data:JSON.parse(result.body),headers:result.headers,cookies:result.multiValueHeaders?.['Set-Cookie']||[]}}

test('health endpoint is independent of sessions',async()=>{assert.equal((await call('/health')).status,200)});
test('unknown origin is blocked for writes',async()=>{assert.equal((await call('/jobs',{method:'POST',role:'coordinator',origin:'https://attacker.example',body:{title:'Bad job'}})).status,403)});
test('CSRF proof header mandatory',async()=>{assert.equal((await call('/jobs',{method:'POST',role:'coordinator',withProof:false,body:{title:'Bad job'}})).status,403)});
test('non-signed user cannot list jobs',async()=>{assert.equal((await call('/jobs')).status,401)});
test('new role must be assigned by admin',async()=>{assert.equal((await call('/me',{role:'unassigned'})).status,401)});
test('valid login sends HttpOnly Secure Strict cookies',async()=>{
  const result=await call('/login',{method:'POST',body:{email:'coord@example.test',password:'correct-pass'}});
  assert.equal(result.status,200);assert.equal(result.data.role,'coordinator');assert.match(result.cookies[0],/HttpOnly; Secure; SameSite=Strict/);
});
test('wrong password rejected',async()=>{assert.equal((await call('/login',{method:'POST',body:{email:'coord@example.test',password:'wrong-pass'}})).status,401)});
test('coordinator sees money, worker cannot',async()=>{
  const coord=await call('/jobs',{role:'coordinator'}),worker=await call('/jobs',{role:'worker'});
  assert.equal(coord.data.items.length,2);assert.equal(coord.data.items[0].revenue_net,1200);
  assert.equal(worker.data.items.length,1);assert.equal(worker.data.items[0].id,ID.a);assert.equal('revenue_net' in worker.data.items[0],false);assert.equal('source' in worker.data.items[0],false);assert.equal(coord.data.items[0].source.record.NETTO,'9999');
});
test('worker cannot access another worker job by URL',async()=>{assert.equal((await call('/jobs/'+ID.b,{role:'worker'})).status,404)});
test('worker cannot access team nor dashboard',async()=>{assert.equal((await call('/team',{role:'worker'})).status,403);assert.equal((await call('/dashboard',{role:'worker'})).status,403)});
test('worker cannot assign anyone or change finances',async()=>{
  assert.equal((await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'worker',body:{worker:ID.workerB}})).status,403);
  assert.equal((await call('/jobs/'+ID.a+'/finance',{method:'PATCH',role:'worker',body:{revenue_net:1,crew_cost:0}})).status,403);
});
test('assigned worker may update his checklist',async()=>{assert.equal((await call('/jobs/'+ID.a+'/checklist',{method:'PATCH',role:'worker',body:{index:3,checked:true}})).status,200)});
test('worker cannot report another worker job',async()=>{assert.equal((await call('/jobs/'+ID.b+'/reports',{method:'POST',role:'worker',body:{idempotencyKey:'testing-123456'}})).status,404)});
test('worker creates report; coordinator approves',async()=>{
  const first=await call('/jobs/'+ID.a+'/reports',{method:'POST',role:'worker',body:{idempotencyKey:'testing-123456',note:'Gotowe',issue:''}});
  assert.equal(first.status,201);
  const second=await call('/reports/33333333-3333-4333-8333-333333333333/review',{method:'POST',role:'coordinator',body:{decision:'ACCEPTED'}});
  assert.equal(second.status,200);assert.equal(second.data.report.status,'ACCEPTED');
});
test('revoking assignment removes worker access',async()=>{
  assert.equal((await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:null}})).status,200);
  assert.equal((await call('/jobs/'+ID.a,{role:'worker'})).status,404);
  assert.equal((await call('/jobs/'+ID.a+'/checklist',{method:'PATCH',role:'worker',body:{index:3,checked:true}})).status,404);
});
test('source information limited to coordinator',async()=>{assert.equal((await call('/sources',{role:'worker'})).status,403);assert.equal((await call('/sources',{role:'coordinator'})).data.status,'IMPORTED')});

test('worker cannot request Google synchronization',async()=>{assert.equal((await call('/google/sync',{method:'POST',role:'worker',body:{accessToken:'fake-token-for-test'}})).status,403)});
