'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const PATH = '../netlify/functions/api.js';
const ID = {a:'11111111-1111-4111-8111-111111111111',b:'22222222-2222-4222-8222-222222222222',coord:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',workerA:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',workerB:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
const jobs=[{id:ID.a,title:'Montaż A',reference:'TEST-A',location:'Warszawa',client_name:'Jan Kowalski',client_phone:'+48 501 234 567',client_address:'ul. Marszałkowska 10, Warszawa',due_date:null,status:'NOWE',priority:'NORMALNY',instructions:'Wymiana blatu',created_at:'2026-10-10T00:00:00.000Z',updated_at:'2026-10-10T00:00:00.000Z'},{id:ID.b,title:'Montaż B',reference:'TEST-B',location:'',due_date:null,status:'NOWE',priority:'NORMALNY',instructions:'',created_at:'2026-10-10T00:00:00.000Z',updated_at:'2026-10-10T00:00:00.000Z'}];
const profiles=[{user_id:ID.coord,role:'coordinator',display_name:'Koordynator',is_active:true},{user_id:ID.workerA,role:'worker',display_name:'Monter A',is_active:true},{user_id:ID.workerB,role:'worker',display_name:'Monter B',is_active:true}];
const assignments=[{job_id:ID.a,worker_id:ID.workerA,active:true},{job_id:ID.b,worker_id:ID.workerB,active:true}];
const finances=[{job_id:ID.a,revenue_net:1200,crew_cost:200},{job_id:ID.b,revenue_net:2100,crew_cost:400}];
const reports=[];
const photos=[];
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
  if(u.pathname==='/functions/v1/akp-provision-worker'){
    if(role!=='coordinator')return out(403,{message:'Forbidden'});
    const patch=JSON.parse(options.body||'{}');
    if(patch.action!=='update_worker')return out(422,{});
    const item=profiles.find(x=>x.user_id===patch.worker_id&&x.role==='worker');
    if(!item)return out(404,{});
    if(patch.name!==undefined)item.display_name=patch.name;
    if(patch.language!==undefined)item.preferred_lang=patch.language;
    if(patch.is_active!==undefined)item.is_active=patch.is_active;
    return out(200,{worker:{id:item.user_id,display:item.display_name,role:'worker',is_active:item.is_active,preferred_lang:item.preferred_lang||'pl'}});
  }
  if(!u.pathname.startsWith('/rest/v1/'))return out(404,{});
  if(!user)return out(401,{});
  const name=u.pathname.split('/').pop();
  let src={akp_jobs:jobs,akp_profiles:profiles,akp_assignments:assignments,akp_job_financials:finances,akp_reports:reports,akp_photos:photos,akp_checks:[],akp_audit:[],akp_job_sources:[{job_id:ID.a,source_record:{NETTO:"9999",KLIENT:"Test"},synced_at:"2026-10-10T00:00:00Z"}]}[name];
  if(!src)return out(404,{});
  if(name==='akp_job_financials'&&role!=='coordinator')return out(403,{});
  let rows=src.filter(x=>{
    if(name==='akp_jobs'&&role!=='coordinator'&&!assignments.some(a=>a.job_id===x.id&&a.worker_id===user.id&&a.active))return false;
    if(name==='akp_assignments'&&role!=='coordinator'&&(x.worker_id!==user.id||!x.active))return false;
    if(name==='akp_profiles'&&role!=='coordinator'&&x.user_id!==user.id)return false;
    if(name==='akp_reports'&&role!=='coordinator'&&x.worker_id!==user.id)return false;
    if(name==='akp_photos'&&role!=='coordinator'&&!assignments.some(a=>a.job_id===x.job_id&&a.worker_id===user.id&&a.active))return false;
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
      const at=assignments.findIndex(x=>x.job_id===data.job_id&&x.worker_id===data.worker_id);
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
    if(name==='akp_photos'){
      if(role!=='worker'&&role!=='coordinator')return out(403,{});
      const row={id:'88888888-8888-4888-8888-888888888888',...data,created_at:'2026-10-10T00:00:00Z'};
      photos.push(row);return out(201,[row]);
    }
    if(name==='akp_jobs'&&role==='coordinator'){
      const row={id:'44444444-4444-4444-8444-444444444444',...data};jobs.push(row);return out(201,[row]);
    }
    if(name==='akp_checks'&&role==='worker')return out(201,[]);
    if(name==='akp_audit')return out(403,{});
    return out(403,{});
  }
  if(method==='PATCH'&&name==='akp_assignments'){
    if(role!=='coordinator')return out(403,{});
    const payload=JSON.parse(options.body||'{}');
    for(const row of rows)Object.assign(row,payload);
    return out(200,rows);
  }
  if(method==='PATCH'&&(name==='akp_reports'||name==='akp_jobs'||name==='akp_profiles')){
    const r=rows[0];if(!r)return out(200,[]);Object.assign(r,JSON.parse(options.body));return out(200,[r]);
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
  assert.equal((await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{action:'unassign',worker:ID.workerA}})).status,200);
  assert.ok(assignments.some(a=>a.job_id===ID.a&&a.worker_id===ID.workerA&&a.active===false),'history must be preserved');
  assert.equal((await call('/jobs/'+ID.a,{role:'worker'})).status,404);
  assert.equal((await call('/jobs/'+ID.a+'/checklist',{method:'PATCH',role:'worker',body:{index:3,checked:true}})).status,404);
});
test('source information limited to coordinator',async()=>{assert.equal((await call('/sources',{role:'worker'})).status,403);assert.equal((await call('/sources',{role:'coordinator'})).data.status,'IMPORTED')});

test('worker cannot request Google synchronization',async()=>{assert.equal((await call('/google/sync',{method:'POST',role:'worker',body:{accessToken:'fake-token-for-test'}})).status,403)});

test('coordinator may update job details and check dedupe',async()=>{
  const res=await call('/jobs/'+ID.a,{method:'PATCH',role:'coordinator',body:{title:'Nowa nazwa montażu',priority:'WYSOKI',location:'Warszawa',expected_updated_at:jobs[0].updated_at}});
  assert.equal(res.status,200);
  assert.equal(res.data.ok,true);
  // Sprawdź próbę przypisania istniejącej referencji (TEST-B) do zlecenia A
  const dupe=await call('/jobs/'+ID.a,{method:'PATCH',role:'coordinator',body:{reference:'TEST-B',expected_updated_at:jobs[0].updated_at}});
  assert.equal(dupe.status,409);
  // A stale revision must fail closed instead of overwriting newer edits.
  const stale=await call('/jobs/'+ID.a,{method:'PATCH',role:'coordinator',body:{title:'Nadpisanie sprzed zmiany',expected_updated_at:'2026-10-10T00:00:00.000Z'}});
  assert.equal(stale.status,409);
});

test('worker cannot update job details',async()=>{
  assert.equal((await call('/jobs/'+ID.a,{method:'PATCH',role:'worker',body:{title:'Nieuprawniona zmiana'}})).status,403);
});

test('assignment endpoint fails closed: missing UUID never removes full team',async()=>{
  const addA=await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:ID.workerA}});
  assert.equal(addA.status,200);
  const addB=await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:ID.workerB}});
  assert.equal(addB.status,200);
  const before=assignments.filter(a=>a.job_id===ID.a&&a.active).map(a=>a.worker_id).sort();
  assert.equal(before.length,2);
  for(const {method,body} of [
    {method:'POST',body:{action:'unassign'}},
    {method:'POST',body:{worker:null}},
    {method:'POST',body:{action:'unassign',worker:'not-a-uuid'}},
    {method:'DELETE'}
  ]){
    const response=await call('/jobs/'+ID.a+'/assign',{method,role:'coordinator',body});
    assert.equal(response.status,422,method+' must reject missing/invalid worker UUID');
    const after=assignments.filter(a=>a.job_id===ID.a&&a.active).map(a=>a.worker_id).sort();
    assert.deepEqual(after,before,'entire assignment group must remain intact');
  }
});

test('multi-worker assignment and selective unassign',async()=>{
  // Przypisz montera A oraz montera B do zlecenia A
  const addA=await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:ID.workerA}});
  assert.equal(addA.status,200);
  const addB=await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:ID.workerB}});
  assert.equal(addB.status,200);
  assert.equal(addB.data.assigned,ID.workerB);

  // Sprawdź czy koordynator widzi obu monterów w assignees
  const detail=await call('/jobs/'+ID.a,{role:'coordinator'});
  assert.equal(detail.status,200);
  assert.ok(Array.isArray(detail.data.job.assignees));
  assert.ok(detail.data.job.assignees.includes(ID.workerA));
  assert.ok(detail.data.job.assignees.includes(ID.workerB));

  // Sprawdź czy workerB ma teraz dostęp do zlecenia A
  const workerBAccess=await call('/jobs/'+ID.a,{role:'workerB'});
  assert.equal(workerBAccess.status,200);

  // Odpięcie wyłącznie montera A (workerA)
  const removeA=await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{action:'unassign',worker:ID.workerA}});
  assert.equal(removeA.status,200);
  assert.equal(removeA.data.unassigned,ID.workerA);
  assert.ok(assignments.some(a=>a.job_id===ID.a&&a.worker_id===ID.workerA&&a.active===false),'soft unassign retained');
  assert.ok(assignments.some(a=>a.job_id===ID.a&&a.worker_id===ID.workerB&&a.active===true),'worker B remains');

  // Monter A nie ma już dostępu
  const workerAAccessAfter=await call('/jobs/'+ID.a,{role:'worker'});
  assert.equal(workerAAccessAfter.status,404);

  // Monter B nadal ma dostęp!
  const workerBAccessStill=await call('/jobs/'+ID.a,{role:'workerB'});
  assert.equal(workerBAccessStill.status,200);
});

test('worker can update preferred language but CANNOT escalate role or status',async()=>{
  // Poprawna zmiana języka przez montera
  const langOk=await call('/me',{method:'PATCH',role:'worker',body:{preferred_lang:'uk'}});
  assert.equal(langOk.status,200);
  assert.equal(langOk.data.ok,true);

  // Próba podniesienia roli przez montera -> 403 Forbidden
  const badRole=await call('/me',{method:'PATCH',role:'worker',body:{role:'coordinator'}});
  assert.equal(badRole.status,403);

  // Próba wyłączenia is_active przez montera -> 403 Forbidden
  const badStatus=await call('/me',{method:'PATCH',role:'worker',body:{is_active:false}});
  assert.equal(badStatus.status,403);

  // Błędny język (spoza pl/uk/ru/en) -> 422
  const badLang=await call('/me',{method:'PATCH',role:'worker',body:{preferred_lang:'de'}});
  assert.equal(badLang.status,422);
});

test('photo registration and storage path validation',async()=>{
  // Przypisz workerA do zlecenia A
  await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:ID.workerA}});

  // Próba rejestracji zdjęcia z niepoprawną ścieżką (poza katalogiem zlecenia) -> 422
  const badPath=await call('/jobs/'+ID.a+'/photos',{method:'POST',role:'worker',body:{storage_path:'inny_katalog/foto.jpg',stage:'DURING'}});
  assert.equal(badPath.status,422);

  // Mylący 8-znakowy identyfikator oraz UUID innego montera są niedozwolone
  const shortId=await call('/jobs/'+ID.a+'/photos',{method:'POST',role:'worker',body:{storage_path:ID.a+'/'+ID.workerA.slice(0,8)+'_foto1.jpg',stage:'AFTER'}});
  assert.equal(shortId.status,422);
  const alienId=await call('/jobs/'+ID.a+'/photos',{method:'POST',role:'worker',body:{storage_path:ID.a+'/'+ID.workerB+'_foto1.jpg',stage:'AFTER'}});
  assert.equal(alienId.status,422);

  // Poprawna rejestracja zdjęcia przez przypisanego montera
  const photoOk=await call('/jobs/'+ID.a+'/photos',{method:'POST',role:'worker',body:{storage_path:ID.a+'/'+ID.workerA+'_foto1.jpg',stage:'AFTER',caption:'Zdjęcie gotowego montażu'}});
  assert.equal(photoOk.status,201);
  assert.equal(photoOk.data.photo.storage_path,ID.a+'/'+ID.workerA+'_foto1.jpg');

  // Weryfikacja czy zdjęcie jest widoczne w szczegółach zlecenia
  const jobDetail=await call('/jobs/'+ID.a,{role:'worker'});
  assert.equal(jobDetail.status,200);
  assert.ok(Array.isArray(jobDetail.data.job.photos));
  assert.ok(jobDetail.data.job.photos.some(p=>p.storage_path===ID.a+'/'+ID.workerA+'_foto1.jpg'));
});

test('mobile worker receives client contact and navigation data without financial leakage',async()=>{
  const res=await call('/jobs/'+ID.a,{role:'worker'});
  assert.equal(res.status,200);
  const job=res.data.job;
  assert.equal(job.client_name,'Jan Kowalski');
  assert.equal(job.client_phone,'+48 501 234 567');
  assert.equal(job.client_address,'ul. Marszałkowska 10, Warszawa');
  assert.equal(job.instructions,'Wymiana blatu');
  // Finanse nie są ujawniane monterowi (klucze są całkowicie usunięte z obiektu)
  assert.equal(job.revenue_net,undefined);
  assert.equal(job.crew_cost,undefined);
  assert.equal(job.source,undefined);
});

test('worker language preferences support all four locales PL, UK, RU, EN',async()=>{
  for(const lang of ['pl','uk','ru','en']){
    const res=await call('/me',{method:'PATCH',role:'worker',body:{preferred_lang:lang}});
    assert.equal(res.status,200);
    assert.equal(res.data.profile.preferred_lang,lang);
  }
});

test('photo stage adheres to canonical schema stages',async()=>{
  for(const stage of ['BEFORE','DURING','AFTER','DEFECT','PROTOCOL']){
    const path=ID.a+`/${ID.workerA}_${stage.toLowerCase()}.jpg`;
    const res=await call('/jobs/'+ID.a+'/photos',{method:'POST',role:'worker',body:{storage_path:path,stage}});
    assert.equal(res.status,201);
    assert.equal(res.data.photo.stage,stage);
  }
});




test('disabled worker is rejected at authentication boundary',async()=>{
  const p=profiles.find(x=>x.user_id===ID.workerA);
  const was=p.is_active;
  try{
    p.is_active=false;
    const result=await call('/jobs',{role:'worker'});
    assert.equal(result.status,401);
  }finally{p.is_active=was;}
});

test('missing Supabase configuration cannot start demo fallback',async()=>{
  const saved={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY,APP_ORIGIN:process.env.APP_ORIGIN};
  try{
    delete process.env.SUPABASE_URL;
    assert.equal((await call('/health')).status,503);
    const result=await call('/login',{method:'POST',body:{email:'coord@example.test',password:'correct-pass'}});
    assert.equal(result.status,503);
    assert.equal((await call('/jobs',{role:'coordinator'})).status,503);
    process.env.SUPABASE_URL=saved.SUPABASE_URL;
    delete process.env.APP_ORIGIN;
    assert.equal((await call('/health')).status,503);
  }finally{
    for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});

test('list returns searchable client fields without worker finances',async()=>{
 const c=await call('/jobs',{role:'coordinator'});
 assert.equal(c.status,200);
 const j=c.data.items.find(x=>x.id===ID.a);
 assert.equal(j.client_name,'Jan Kowalski');
 assert.equal(j.client_phone,'+48 501 234 567');
 assert.equal(j.client_address,'ul. Marszałkowska 10, Warszawa');
 const w=await call('/jobs',{role:'worker'});
 assert.equal(w.status,200);
 const own=w.data.items.find(x=>x.id===ID.a);
 assert.ok(own);
 assert.equal(own.client_phone,'+48 501 234 567');
 assert.equal(own.revenue_net,undefined);
 assert.equal(own.crew_cost,undefined);
});


test('worker cannot create accounts through team endpoint',async()=>{assert.equal((await call('/team',{method:'POST',role:'worker',body:{name:'Test'}})).status,403)});
test('worker account requires validated fields',async()=>{assert.equal((await call('/team',{method:'POST',role:'coordinator',body:{name:'Test'}})).status,422)});

test('team listing includes inactive workers for reversible account access',async()=>{
  const list=await call('/team',{role:'coordinator'});
  assert.equal(list.status,200);
  assert.ok(list.data.items.some(x=>x.id===ID.workerA&&x.is_active===true));
});
test('team management rejects worker mutations and privileged fields',async()=>{
  const path='/team/'+ID.workerA;
  assert.equal((await call(path,{method:'PATCH',role:'worker',body:{name:'Changed'}})).status,403);
  assert.equal((await call(path,{method:'PATCH',role:'coordinator',withProof:false,body:{name:'Changed'}})).status,403);
  for(const invalid of [{role:'coordinator'},{email:'new@example.test'},{password:'whatever'},{is_active:'false'},{name:'x'},{language:'xx'},{}]){
    const result=await call(path,{method:'PATCH',role:'coordinator',body:invalid});
    assert.equal(result.status,422,JSON.stringify(invalid));
  }
});
test('coordinator can update profile and soft deactivate/reactivate without removing history',async()=>{
  const path='/team/'+ID.workerB,original={...profiles.find(p=>p.user_id===ID.workerB)};
  const beforeAssignments=assignments.length;
  try{
    const update=await call(path,{method:'PATCH',role:'coordinator',body:{name:'Monter Testowy',language:'ru'}});
    assert.equal(update.status,200);
    assert.equal(update.data.worker.role,'worker');
    let listing=await call('/team',{role:'coordinator'});
    assert.ok(listing.data.items.some(m=>m.id===ID.workerB&&m.display==='Monter Testowy'&&m.preferred_lang==='ru'));
    const stop=await call(path,{method:'PATCH',role:'coordinator',body:{is_active:false}});
    assert.equal(stop.status,200);
    assert.equal(stop.data.worker.is_active,false);
    listing=await call('/team',{role:'coordinator'});
    assert.ok(listing.data.items.some(m=>m.id===ID.workerB&&m.is_active===false));
    assert.equal((await call('/me',{role:'workerB'})).status,401);
    assert.equal(assignments.length,beforeAssignments);
    const restart=await call(path,{method:'PATCH',role:'coordinator',body:{is_active:true}});
    assert.equal(restart.status,200);
    assert.equal((await call('/me',{role:'workerB'})).status,200);
  }finally{Object.assign(profiles.find(p=>p.user_id===ID.workerB),original);}
});

test('assignment rejects malformed, unknown and contradictory commands without any writes',async()=>{
 const before=JSON.stringify(assignments);
 for(const body of [null,[],{worker:ID.workerA,action:'unasign'},{worker:ID.workerA,active:'false'},{worker:ID.workerA,unassign:'true'},{worker:ID.workerA,action:'assign',active:false},{worker:ID.workerA,action:'unassign',unassign:false},{worker:ID.workerA,role:'coordinator'}]){
  const start=calls.length;
  assert.equal((await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body})).status,422,JSON.stringify(body));
  assert.ok(calls.slice(start).every(c=>(c.options.method||'GET')==='GET'));
  assert.equal(JSON.stringify(assignments),before);
 }
 assert.equal((await call('/jobs/'+ID.a+'/assign',{method:'DELETE',role:'coordinator',body:{worker:ID.workerA,action:'assign'}})).status,422);
});
test('inactive workers cannot receive new assignments but existing history can be detached',async()=>{
 const p=profiles.find(p=>p.user_id===ID.workerB),before=p.is_active;
 try{
  p.is_active=false;
  assert.equal((await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:ID.workerB}})).status,422);
  assert.equal((await call('/jobs/'+ID.a+'/assign',{method:'POST',role:'coordinator',body:{worker:ID.workerB,action:'unassign'}})).status,200);
  assert.ok(assignments.some(a=>a.job_id===ID.a&&a.worker_id===ID.workerB&&a.active===false));
 }finally{p.is_active=before}
});

test('schedule date updates validate real calendar dates and use existing optimistic locking',async()=>{
 const original={...jobs[0]};
 try{
  for(const due_date of ['2026-02-29','2026-02-31','2026-13-01','0000-01-01',false,123,{}]){
   const body={due_date,expected_updated_at:jobs[0].updated_at};
   assert.equal((await call('/jobs/'+ID.a,{method:'PATCH',role:'coordinator',body})).status,422);
   assert.equal((await call('/jobs',{method:'POST',role:'coordinator',body:{title:'Synthetic invalid date',due_date}})).status,422);
  }
  assert.equal((await call('/jobs/'+ID.a,{method:'PATCH',role:'worker',body:{due_date:'2028-02-29',expected_updated_at:jobs[0].updated_at}})).status,403);
  assert.equal((await call('/jobs/'+ID.a,{method:'PATCH',role:'coordinator',body:{due_date:'2028-02-29',expected_updated_at:'2020-01-01T00:00:00Z'}})).status,409);
  assert.equal((await call('/jobs/'+ID.a,{method:'PATCH',role:'coordinator',body:{due_date:'2028-02-29',expected_updated_at:jobs[0].updated_at}})).status,200);
  assert.equal(jobs[0].due_date,'2028-02-29');
  assert.equal((await call('/jobs/'+ID.a,{method:'PATCH',role:'coordinator',body:{due_date:null,expected_updated_at:jobs[0].updated_at}})).status,200);
  assert.equal(jobs[0].due_date,null);
 }finally{Object.assign(jobs[0],original)}
});
