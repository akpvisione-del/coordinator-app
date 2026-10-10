/** AKP Commander v10 — Netlify Functions / Supabase authenticated REST bridge.
 * SECURITY: NO service_role key, no demo accounts. Authorization on EVERY request.
 * Data operations are additionally enforced by Postgres Row Level Security.
 */
'use strict';

const BASE = '/.netlify/functions/api';
const FIELDS = 'id,reference,title,location,due_date,status,priority,instructions,created_at,updated_at';
const CHECKS = [
  'Sprawdź zakres i dokumentację', 'Zabezpiecz stanowisko',
  'Potwierdź wymiary i kolizje', 'Zweryfikuj materiały',
  'Wykonaj prace', 'Skontroluj jakość',
  'Udokumentuj rezultat', 'Zgłoś zakończenie lub przeszkody'
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE_BASE = 'Path=/; HttpOnly; Secure; SameSite=Strict';

function config(){
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const origin = (process.env.APP_ORIGIN || '').replace(/\/$/, '');
  return {url,key,origin,ready:/^https:\/\/[^/]+\.supabase\.co$/.test(url) && !!key && /^https:\/\//.test(origin)};
}
function reply(status, payload, cookies = [], headers = {}){
  return {
    statusCode:status,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',...headers},
    ...(cookies.length?{multiValueHeaders:{'Set-Cookie':cookies}}:{}),
    body:JSON.stringify(payload)
  };
}
function cookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; ${COOKIE_BASE}; Max-Age=${maxAge}`;}
function expireCookies(){return [cookie('akp_access','',0),cookie('akp_refresh','',0)];}
function cookiesFrom(headers){
  const result={};
  const raw=headers.cookie||headers.Cookie||'';
  for(const kv of raw.split(';')){
    const at=kv.indexOf('=');if(at<0)continue;
    const k=kv.slice(0,at).trim();
    try{result[k]=decodeURIComponent(kv.slice(at+1).trim())}catch{}
  }
  return result;
}
function bodyJson(event){
  const raw=event.body||'';
  if(raw.length>24000)throw Object.assign(new Error('Zbyt duże żądanie.'),{status:413});
  try{return raw?JSON.parse(raw):{}}catch{throw Object.assign(new Error('Nieprawidłowy JSON.'),{status:400})}
}
function pickText(value,max=250){return typeof value==='string'?value.trim().slice(0,max):''}
function notFound(){return reply(404,{message:'Nie znaleziono zasobu.'});}
function deny(){return reply(403,{message:'Brak uprawnień.'});}
function pathFrom(event){
  const p=(event.path||'').split('?')[0];
  if(p.startsWith('/api/'))return p.slice(4);
  const i=p.indexOf('/.netlify/functions/api');
  if(i>=0)return p.slice(i+BASE.length)||'/';
  return '/';
}
function mustUuid(value){if(!UUID.test(value||''))throw Object.assign(new Error('Nieprawidłowy identyfikator.'),{status:400});return value}
function safeError(e){
  const allowed=[400,401,403,404,409,413,422,503];
  return reply(allowed.includes(e.status)?e.status:502,{message: e.publicMessage || (allowed.includes(e.status)?e.message:'Usługa danych jest chwilowo niedostępna.')});
}
async function sbFetch(cfg, path, {method='GET',data,token,prefer}={}){
  const headers={apikey:cfg.key,Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(data!==undefined)headers['Content-Type']='application/json';
  if(prefer)headers.Prefer=prefer;
  const response=await fetch(cfg.url+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
  let json=null;const t=await response.text();try{json=t?JSON.parse(t):null}catch{json={message:'Błąd formatu usługi danych.'}}
  if(!response.ok){
    const err=new Error('Błąd połączenia z bazą.');err.status=response.status===401?401:response.status===403?403:response.status===409?409:502;
    err.providerCode=json?.code;throw err;
  }
  return json;
}
async function auth(cfg,event){
  const c=cookiesFrom(event.headers||{});
  if(!c.akp_access&&!c.akp_refresh)return null;
  let access=c.akp_access;let fresh=[];
  const getUser=async(jwt)=>{
    try{return await sbFetch(cfg,'/auth/v1/user',{token:jwt})}catch(e){if(e.status===401)return null;throw e}
  };
  let user=access?await getUser(access):null;
  if(!user&&c.akp_refresh){
    try{
      const tokens=await sbFetch(cfg,'/auth/v1/token?grant_type=refresh_token',{method:'POST',data:{refresh_token:c.akp_refresh}});
      access=tokens.access_token;
      user=await getUser(access);
      if(user)fresh=[cookie('akp_access',access,Math.min(tokens.expires_in||3600,3600)),cookie('akp_refresh',tokens.refresh_token,60*60*24*14)];
    }catch(e){if(e.status!==401)throw e}
  }
  if(!user)return null;
  const role=user.app_metadata?.akp_role;
  if(role!=='coordinator'&&role!=='worker')return null;
  // Fail closed if account has no provisioned profile or its role does not match signed Auth metadata.
  const rows=await table(cfg,{token:access},'akp_profiles',{select:'role,display_name',user_id:'eq.'+user.id,limit:'1'});
  if(rows.length!==1||rows[0].role!==role)return null;
  return {user,role,token:access,fresh,display:rows[0].display_name};
}
async function table(cfg,auth,tableName,query={},opts={}){
  const u=new URLSearchParams(query);
  return sbFetch(cfg,`/rest/v1/${tableName}${u.size?'?'+u.toString():''}`,{token:auth.token,...opts});
}
async function one(cfg,a,name,query,notFoundStatus=404){
  const rows=await table(cfg,a,name,{...query,limit:'1'});
  if(!rows||!rows.length)throw Object.assign(new Error('Nie znaleziono zasobu.'),{status:notFoundStatus});
  return rows[0];
}
async function loadJobs(cfg,a){
  const jobs=await table(cfg,a,'akp_jobs',{select:FIELDS,order:'due_date.asc.nullslast',limit:'500'});
  if(!jobs.length)return [];
  const assignments=await table(cfg,a,'akp_assignments',{select:'job_id,worker_id,active',active:'eq.true',limit:'500'});
  const who=new Map(assignments.map(x=>[x.job_id,x.worker_id]));
  let finances=new Map();
  if(a.role==='coordinator'){
    const f=await table(cfg,a,'akp_job_financials',{select:'job_id,revenue_net,crew_cost',limit:'500'});
    finances=new Map(f.map(x=>[x.job_id,x]));
  }
  return jobs.map(j=>{
    const f=finances.get(j.id)||{};
    const out={id:j.id,reference:j.reference||'',title:j.title,location:j.location||'',due:j.due_date,status:j.status,priority:j.priority,instructions:j.instructions||'',assignee:who.get(j.id)||null,updated_at:j.updated_at};
    if(a.role==='coordinator'){
      out.revenue_net=f.revenue_net??null;out.crew_cost=f.crew_cost??null;
      out.margin_net=(f.revenue_net!=null&&f.crew_cost!=null)?Number(f.revenue_net)-Number(f.crew_cost):null;
    }
    return out;
  });
}
async function isAssigned(cfg,a,job){
  if(a.role!=='worker')return false;
  const rows=await table(cfg,a,'akp_assignments',{select:'job_id',job_id:'eq.'+job,worker_id:'eq.'+a.user.id,active:'eq.true',limit:'1'});
  return rows.length===1;
}
async function recordAudit(cfg,a,action,entity,detail={}){
  try{await table(cfg,a,'akp_audit',{}, {method:'POST',data:{actor_id:a.user.id,action,entity_id:String(entity),detail},prefer:'return=minimal'});return true}catch{return false}
}
function checkOrigin(event,cfg,method){
  if(['GET','HEAD','OPTIONS'].includes(method))return true;
  const h=event.headers||{};
  const origin=h.origin||h.Origin;
  if(!origin || origin.replace(/\/$/,'')!==cfg.origin)return false;
  const proof=h['x-akp-request']||h['X-Akp-Request'];
  return proof==='commander-v10';
}
async function route(event,cfg,a,path){
  const method=(event.httpMethod||'GET').toUpperCase();
  const parts=path.split('/').filter(Boolean);
  if(path==='/me'&&method==='GET'){
    return reply(200,{id:a.user.id,display:a.display,role:a.role,email:a.user.email},a.fresh);
  }
  if(path==='/logout'&&method==='POST'){
    try{await sbFetch(cfg,'/auth/v1/logout',{method:'POST',token:a.token})}catch{}
    return reply(200,{ok:true},expireCookies());
  }
  if(path==='/jobs'&&method==='GET'){
    const jobs=await loadJobs(cfg,a);return reply(200,{items:jobs,total:jobs.length},a.fresh);
  }
  if(path==='/jobs'&&method==='POST'){
    if(a.role!=='coordinator')return deny();
    const b=bodyJson(event);
    const title=pickText(b.title,180);
    if(title.length<3)return reply(422,{message:'Nazwa zlecenia musi mieć co najmniej 3 znaki.'});
    if(b.due_date&&!/^\d{4}-\d{2}-\d{2}$/.test(b.due_date))return reply(422,{message:'Nieprawidłowa data.'});
    const fields={title,reference:pickText(b.reference,80)||null,location:pickText(b.location,200)||null,due_date:b.due_date||null,status:'NOWE',priority:['NORMALNY','WYSOKI','KRYTYCZNY'].includes(b.priority)?b.priority:'NORMALNY',instructions:pickText(b.instructions,2500)};
    const created=await table(cfg,a,'akp_jobs',{}, {method:'POST',data:fields,prefer:'return=representation'});
    await recordAudit(cfg,a,'JOB_CREATED',created[0].id,{reference:created[0].reference});
    return reply(201,{job:created[0]},a.fresh);
  }
  if(parts[0]==='jobs'&&parts.length>=2&&UUID.test(parts[1])){
    const jobId=parts[1];
    if(parts.length===2&&method==='GET'){
      const job=await one(cfg,a,'akp_jobs',{select:FIELDS,id:'eq.'+jobId});
      const steps=await table(cfg,a,'akp_checks',{select:'step_index,done',job_id:'eq.'+jobId,worker_id:'eq.'+a.user.id,limit:'50'});
      return reply(200,{job:{id:job.id,title:job.title,location:job.location,due:job.due_date,status:job.status,priority:job.priority,instructions:job.instructions,checklist:CHECKS.map((title,index)=>({index,title,done:steps.some(s=>s.step_index===index&&s.done)}))}},a.fresh);
    }
    if(parts[2]==='finance'&&parts.length===3&&method==='PATCH'){
      if(a.role!=='coordinator')return deny();
      await one(cfg,a,'akp_jobs',{select:'id',id:'eq.'+jobId});
      const b=bodyJson(event);
      const amount=x=>(x===null||x==='')?null:Number(x);
      const revenue=amount(b.revenue_net),cost=amount(b.crew_cost);
      if([revenue,cost].some(x=>x!==null&&(!Number.isFinite(x)||x<0||x>1000000000)))return reply(422,{message:'Kwoty muszą być dodatnie i w dozwolonym zakresie.'});
      await table(cfg,a,'akp_job_financials',{on_conflict:'job_id'}, {method:'POST',data:{job_id:jobId,revenue_net:revenue,crew_cost:cost},prefer:'resolution=merge-duplicates,return=minimal'});
      return reply(200,{ok:true},a.fresh);
    }
    if(parts[2]==='assign'&&parts.length===3&&method==='POST'){
      if(a.role!=='coordinator')return deny();
      await one(cfg,a,'akp_jobs',{select:'id',id:'eq.'+jobId});
      const b=bodyJson(event);const worker=b.worker||null;
      if(worker!==null){mustUuid(worker);
        const profile=await one(cfg,a,'akp_profiles',{select:'role',user_id:'eq.'+worker});
        if(profile.role!=='worker')return reply(422,{message:'Wybrana osoba nie ma roli pracownika.'});
        await table(cfg,a,'akp_assignments',{on_conflict:'job_id'}, {method:'POST',data:{job_id:jobId,worker_id:worker,active:true},prefer:'resolution=merge-duplicates,return=minimal'});
      }else{
        await table(cfg,a,'akp_assignments',{job_id:'eq.'+jobId}, {method:'DELETE',prefer:'return=minimal'});
      }
      await recordAudit(cfg,a,'JOB_ASSIGNED',jobId,{worker});
      return reply(200,{ok:true},a.fresh);
    }
    if(parts[2]==='checklist'&&parts.length===3&&method==='PATCH'){
      if(!(await isAssigned(cfg,a,jobId)))return notFound();
      const b=bodyJson(event);if(!Number.isInteger(b.index)||b.index<0||b.index>=CHECKS.length||typeof b.checked!=='boolean')return reply(422,{message:'Nieprawidłowy punkt checklisty.'});
      await table(cfg,a,'akp_checks',{on_conflict:'job_id,worker_id,step_index'},{method:'POST',data:{job_id:jobId,worker_id:a.user.id,step_index:b.index,done:b.checked},prefer:'resolution=merge-duplicates,return=minimal'});
      return reply(200,{ok:true},a.fresh);
    }
    if(parts[2]==='reports'&&parts.length===3&&method==='POST'){
      if(!(await isAssigned(cfg,a,jobId)))return notFound();
      const b=bodyJson(event);const key=pickText(b.idempotencyKey,100);
      if(!/^[A-Za-z0-9_-]{12,100}$/.test(key))return reply(422,{message:'Błędny identyfikator operacji.'});
      const payload={job_id:jobId,worker_id:a.user.id,idempotency_key:key,note:pickText(b.note,2000),issue:pickText(b.issue,1200),status:'SUBMITTED'};
      const check=await table(cfg,a,'akp_reports',{select:'id,status',worker_id:'eq.'+a.user.id,idempotency_key:'eq.'+key,limit:'1'});
      if(check.length)return reply(200,{report:check[0],duplicate:true},a.fresh);
      const rows=await table(cfg,a,'akp_reports',{}, {method:'POST',data:payload,prefer:'return=representation'});
      await recordAudit(cfg,a,'REPORT_SUBMITTED',rows[0].id,{job:jobId});
      return reply(201,{report:rows[0]},a.fresh);
    }
  }
  if(path==='/reports'&&method==='GET'){
    const rows=await table(cfg,a,'akp_reports',{select:'id,job_id,worker_id,note,issue,status,created_at,review_note',order:'created_at.desc',limit:'300'});
    const jobs=await loadJobs(cfg,a);const titles=new Map(jobs.map(x=>[x.id,x.title]));
    return reply(200,{items:rows.map(r=>({...r,job_title:titles.get(r.job_id)||'Zlecenie'}))},a.fresh);
  }
  if(parts[0]==='reports'&&parts.length===3&&parts[2]==='review'&&method==='POST'){
    if(a.role!=='coordinator')return deny();const id=mustUuid(parts[1]);const b=bodyJson(event);
    if(!['ACCEPTED','CHANGES_REQUESTED'].includes(b.decision))return reply(422,{message:'Nieprawidłowa decyzja.'});
    const rows=await table(cfg,a,'akp_reports',{id:'eq.'+id,status:'eq.SUBMITTED'}, {method:'PATCH',data:{status:b.decision,review_note:pickText(b.note,1200),reviewer_id:a.user.id,reviewed_at:new Date().toISOString()},prefer:'return=representation'});
    if(!rows.length)return reply(409,{message:'Raport zmieniono lub został już rozpatrzony.'});
    await recordAudit(cfg,a,'REPORT_REVIEWED',id,{decision:b.decision});
    return reply(200,{report:rows[0]},a.fresh);
  }
  if(path==='/team'&&method==='GET'){
    if(a.role!=='coordinator')return deny();
    const x=await table(cfg,a,'akp_profiles',{select:'user_id,display_name,role',role:'eq.worker',order:'display_name.asc'});
    return reply(200,{items:x.map(y=>({id:y.user_id,display:y.display_name,role:y.role}))},a.fresh);
  }
  if(path==='/dashboard'&&method==='GET'){
    if(a.role!=='coordinator')return deny();
    const [jobs,reports]=await Promise.all([loadJobs(cfg,a),table(cfg,a,'akp_reports',{select:'id,status,issue',limit:'500'})]);
    return reply(200,{jobs:jobs.length,unassigned:jobs.filter(j=>!j.assignee).length,pending_reports:reports.filter(r=>r.status==='SUBMITTED').length,issues:reports.filter(r=>r.issue&&r.status==='SUBMITTED').length,mode:'AUTH+RLS'},a.fresh);
  }
  if(path==='/audit'&&method==='GET'){
    if(a.role!=='coordinator')return deny();
    const items=await table(cfg,a,'akp_audit',{select:'id,actor_id,action,entity_id,detail,created_at',order:'created_at.desc',limit:'100'});
    return reply(200,{items},a.fresh);
  }
  if(path==='/sources'&&method==='GET'){
    if(a.role!=='coordinator')return deny();return reply(200,{status:'NOT_CONNECTED',message:'Google Drive/Gmail/Calendar nie są jeszcze podłączone do tej instalacji. Nie ma danych LIVE.'},a.fresh);
  }
  return notFound();
}
exports.handler=async function handler(event){
  const cfg=config(),method=(event.httpMethod||'GET').toUpperCase(),path=pathFrom(event);
  if(path==='/health')return reply(cfg.ready?200:503,{version:'v10-rc1',configured:cfg.ready,mode:'PRODUCTION_CANDIDATE',data:'NO_EMBEDDED_DATA'});
  if(!cfg.ready)return reply(503,{message:'Instalacja oczekuje na konfigurację bezpiecznego logowania i bazy.'});
  if(!checkOrigin(event,cfg,method))return reply(403,{message:'Niedozwolone źródło żądania.'});
  try{
    if(path==='/login'&&method==='POST'){
      const b=bodyJson(event),email=pickText(b.email,250),password=typeof b.password==='string'?b.password:'';
      if(!/^\S+@\S+\.\S+$/.test(email)||password.length<6||password.length>256)return reply(401,{message:'Nieprawidłowy adres e-mail lub hasło.'});
      let tokens;
      try{tokens=await sbFetch(cfg,'/auth/v1/token?grant_type=password',{method:'POST',data:{email,password}})}catch{return reply(401,{message:'Nieprawidłowy adres e-mail lub hasło.'});}
      const au=await auth(cfg,{headers:{cookie:`akp_access=${encodeURIComponent(tokens.access_token)}`}});
      if(!au)return reply(403,{message:'Konto nie ma aktywnej roli w AKP.'});
      const c=[cookie('akp_access',tokens.access_token,Math.min(tokens.expires_in||3600,3600)),cookie('akp_refresh',tokens.refresh_token,60*60*24*14)];
      return reply(200,{id:au.user.id,display:au.display,role:au.role,email:au.user.email},c);
    }
    const a=await auth(cfg,event);
    if(!a)return reply(401,{message:'Sesja jest nieaktywna. Zaloguj się ponownie.'},expireCookies());
    return await route(event,cfg,a,path);
  }catch(e){return safeError(e)}
};
exports._test={pathFrom,checkOrigin,config,loadJobs,UUID};
